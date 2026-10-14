import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import type { CrmSettings } from '../../types/admin';
import {
  SAMPLE_DEPARTMENTS,
  SAMPLE_RATING_LABELS,
  SAMPLE_STATUSES,
  sampleStatusTone,
  sampleUrgencyEmoji,
  sampleUrgencyTone,
  type SampleItem,
} from '../../types/samples';
import { triggerFileDownload } from '../../utils/fileDownload';

const fieldClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-400';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
}

export const SamplesPage: React.FC = () => {
  const { hasPermission, isClient, isAdmin, activeRole } = useAuth();
  const { confirm } = useDialog();

  const isSampleLifecycleManager =
    !isClient &&
    (isAdmin ||
      activeRole === 'crm-manager' ||
      activeRole === 'sales-manager' ||
      activeRole === 'finance-manager');

  // Only the client can approve / reject sample requests (admin / staff must not).
  const canApproveSamples = isClient;
  const canDispatchSamples = isSampleLifecycleManager && (hasPermission('crm.samples.write') || isAdmin);
  const canDeliverSamples = isSampleLifecycleManager && (hasPermission('crm.samples.write') || isAdmin);
  const canWriteSamples = hasPermission('crm.samples.write') && !isClient;
  const canFeedbackSamples = hasPermission('crm.samples.feedback') || isClient;
  const [items, setItems] = useState<SampleItem[]>([]);
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveAction, setApproveAction] = useState<'approve' | 'reject'>('approve');
  const [approveSample, setApproveSample] = useState<SampleItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchSample, setDispatchSample] = useState<SampleItem | null>(null);
  const [courierName, setCourierName] = useState('');
  const [dispatchDate, setDispatchDate] = useState(localToday());
  const [etaDate, setEtaDate] = useState('');

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSample, setFeedbackSample] = useState<SampleItem | null>(null);
  const [rating, setRating] = useState(5);
  const [interestedInOrder, setInterestedInOrder] = useState('true');
  const [comments, setComments] = useState('');
  const [requiresImprovement, setRequiresImprovement] = useState(false);
  const [routedDepartment, setRoutedDepartment] = useState('R&D / Technical');
  const [improvementNotes, setImprovementNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await crmApi.listSamples({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      });
      setItems(response.data || []);
      setPagination(response.pagination || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load samples');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    crmApi
      .getSettings()
      .then((res) => {
        if (res.data) setSettings(res.data);
      })
      .catch(() => {});
  }, []);

  const courierOptions = useMemo(() => {
    const fromSettings = (settings?.courier_carriers || [])
      .map((c) => String(c || '').trim())
      .filter(Boolean);
    if (fromSettings.length) return fromSettings;
    return [
      'BlueDart Express',
      'Delhivery Logistics',
      'Shiprocket Direct',
      'FedEx Express',
      'DTDC Courier',
      'Professional Courier',
      'Custom Courier',
    ];
  }, [settings?.courier_carriers]);

  const openApprove = (sample: SampleItem, action: 'approve' | 'reject') => {
    setApproveSample(sample);
    setApproveAction(action);
    setRejectionReason('');
    setApproveOpen(true);
    setError('');
  };

  const submitApprove = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!approveSample) return;
    if (approveAction === 'reject' && !rejectionReason.trim()) {
      return setError('Rejection reason is required.');
    }
    setSaving(true);
    setBusyId(approveSample._id);
    try {
      const response = await crmApi.approveSample(approveSample._id, {
        action: approveAction,
        rejectionReason: rejectionReason.trim() || undefined,
      });
      setSuccess(response.message || `Sample ${approveAction}d.`);
      setApproveOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Approval failed');
    } finally {
      setSaving(false);
      setBusyId('');
    }
  };

  const openDispatch = (sample: SampleItem) => {
    setDispatchSample(sample);
    const existingCourier = String(sample.courierName || '').trim();
    setCourierName(existingCourier || courierOptions[0] || '');
    setDispatchDate(sample.dispatchDate?.slice(0, 10) || localToday());
    setEtaDate(sample.estimatedDeliveryDate?.slice(0, 10) || '');
    setDispatchOpen(true);
    setError('');
  };

  const submitDispatch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dispatchSample) return;
    if (!courierName.trim()) {
      return setError('Courier / carrier is required.');
    }
    setSaving(true);
    setBusyId(dispatchSample._id);
    try {
      const response = await crmApi.dispatchSample(dispatchSample._id, {
        courierName: courierName.trim(),
        trackingNumber: '',
        dispatchDate: dispatchDate || undefined,
        estimatedDeliveryDate: etaDate || undefined,
      });
      setSuccess(response.message || 'Sample dispatched.');
      setDispatchOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dispatch failed');
    } finally {
      setSaving(false);
      setBusyId('');
    }
  };

  const markDelivered = async (sample: SampleItem) => {
    if (!(await confirm(`Mark ${sample.sampleNumber} as delivered?`))) return;
    setBusyId(sample._id);
    try {
      const response = await crmApi.deliverSample(sample._id);
      setSuccess(response.message || 'Sample marked delivered.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to mark delivered');
    } finally {
      setBusyId('');
    }
  };

  const openFeedback = (sample: SampleItem) => {
    setFeedbackSample(sample);
    setRating(sample.feedback?.rating || 5);
    setInterestedInOrder(sample.feedback?.interestedInOrder === false ? 'false' : 'true');
    setComments(sample.feedback?.comments || '');
    setRequiresImprovement(Boolean(sample.feedback?.requiresImprovement));
    setRoutedDepartment(sample.feedback?.routedDepartment || 'R&D / Technical');
    setImprovementNotes(sample.feedback?.improvementNotes || '');
    setFeedbackOpen(true);
    setError('');
  };

  const submitFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!feedbackSample) return;
    if (requiresImprovement && !routedDepartment) {
      return setError('Select a department for improvement routing.');
    }
    setSaving(true);
    setBusyId(feedbackSample._id);
    try {
      const response = await crmApi.submitSampleFeedback(feedbackSample._id, {
        rating,
        comments: comments.trim() || undefined,
        interestedInOrder: interestedInOrder === 'true',
        requiresImprovement,
        routedDepartment: requiresImprovement ? routedDepartment : undefined,
        improvementNotes: requiresImprovement ? improvementNotes.trim() || undefined : undefined,
      });
      setSuccess(response.message || 'Feedback submitted.');
      setFeedbackOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to submit feedback');
    } finally {
      setSaving(false);
      setBusyId('');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    try {
      const response = await crmApi.exportSamples({
        format,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      if (!response.data?.content) throw new Error('Empty export');
      triggerFileDownload({
        filename: response.data.filename,
        content: response.data.content,
        format,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    }
  };

  const renderClientReview = (item: SampleItem) => {
    if (item.status === 'Completed' && item.feedback?.rating) {
      return (
        <div className="text-xs text-zinc-700">
          <div className="font-semibold text-amber-600">
            {'⭐'.repeat(item.feedback.rating)} {item.feedback.rating}/5
          </div>
          <div className="mt-0.5 text-zinc-500">
            {item.feedback.interestedInOrder ? 'Interested in order' : 'Not ordering yet'}
          </div>
        </div>
      );
    }
    if (item.status === 'Delivered') {
      return (
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          ⏳ Review Pending
        </span>
      );
    }
    if (item.status === 'Rejected') {
      return <span className="text-xs text-red-600">Rejected</span>;
    }
    return <span className="text-xs text-zinc-400">—</span>;
  };

  const renderActions = (item: SampleItem) => {
    const busy = busyId === item._id;
    return (
      <div className="flex flex-wrap gap-1.5">
        {item.status === 'Requested' && canApproveSamples && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => openApprove(item, 'approve')}
              className="h-8 rounded-lg border-0 bg-emerald-700 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              ✓ Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openApprove(item, 'reject')}
              className="h-8 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 disabled:opacity-50"
            >
              ✕ Reject
            </button>
          </>
        )}
        {(item.status === 'Approved' || item.status === 'Preparing') && canDispatchSamples && (
          <button
            type="button"
            disabled={busy}
            onClick={() => openDispatch(item)}
            className="h-8 rounded-lg border-0 bg-slate-950 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            🚚 Dispatch
          </button>
        )}
        {item.status === 'Dispatched' && canDeliverSamples && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void markDelivered(item)}
            className="h-8 rounded-lg border-0 bg-emerald-700 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            ✅ Delivered
          </button>
        )}
        {(item.status === 'Delivered' || item.status === 'Completed') && canFeedbackSamples && (
          <button
            type="button"
            disabled={busy}
            onClick={() => openFeedback(item)}
            className="h-8 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 disabled:opacity-50"
          >
            ⭐ {item.status === 'Completed' ? 'View Review' : 'Give Review'}
          </button>
        )}
        <Link
          to={`/samples/${item._id}`}
          className="h-8 inline-flex items-center rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 no-underline"
        >
          View Details
        </Link>
      </div>
    );
  };

  return (
    <div data-tour="samples-tour-landing" className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div data-tour="samples-title">
          <h1 className="m-0 text-2xl font-bold text-zinc-950">Sample Requests</h1>
          <p className="mt-1 mb-0 text-sm text-zinc-500">
            Manage sampling lifecycle from request to customer evaluation.
          </p>
        </div>
        <div data-tour="samples-header-actions" className="flex flex-wrap items-center gap-2">
          {!isClient && (
            <div className="relative" data-tour="samples-export-btn">
              <button
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"
              >
                <DownloadIcon sx={{ fontSize: 18 }} />
                Export
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg">
                  <button
                    type="button"
                    className="block w-full border-0 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    onClick={() => void handleExport('csv')}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="block w-full border-0 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    onClick={() => void handleExport('json')}
                  >
                    Export JSON
                  </button>
                </div>
              )}
            </div>
          )}
          {canWriteSamples && (
            <Link
              to="/samples/create"
              data-tour="samples-create-btn"
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white no-underline hover:bg-slate-800"
            >
              <AddIcon sx={{ fontSize: 18 }} />
              New Sample
            </Link>
          )}
          {!isClient && (
            <TourButton
              moduleId="samples"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"
            />
          )}
        </div>
      </header>

      {error && !approveOpen && !dispatchOpen && !feedbackOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div
        data-tour="samples-filters"
        className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] font-semibold uppercase text-zinc-500">Search</span>
          <input
            className={fieldClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sample # or account (e.g. SMP-2026-0001, AR)…"
          />
        </label>
        <label className="min-w-[180px]">
          <span className="mb-1 block text-[11px] font-semibold uppercase text-zinc-500">Status</span>
          <select
            className={fieldClass}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {SAMPLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setStatusFilter('');
          }}
          className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"
        >
          <RefreshIcon sx={{ fontSize: 18 }} />
          Refresh
        </button>
      </div>

      <section data-tour="samples-table" className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
        {loading ? (
          <div className="p-10 text-center text-sm text-zinc-500">Loading samples…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">No sample requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sample</th>
                  <th className="px-4 py-3 font-semibold">Product & Qty</th>
                  <th className="px-4 py-3 font-semibold">Urgency</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Prospect / Client</th>
                  <th className="px-4 py-3 font-semibold">Courier & AWB</th>
                  <th className="px-4 py-3 font-semibold">Client Review</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item._id}
                    data-tour={index === 0 ? 'samples-row-first' : undefined}
                    className="border-t border-zinc-100 align-top"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/samples/${item._id}`}
                        className="font-semibold text-zinc-950 hover:text-blue-600 hover:underline inline-block"
                      >
                        {item.sampleNumber}
                      </Link>
                      <div className="mt-0.5 text-[11px] text-zinc-400">
                        {formatDate(item.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800">{item.productName}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {item.quantity} {item.unit}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sampleUrgencyTone(String(item.urgency))}`}
                      >
                        {sampleUrgencyEmoji(String(item.urgency))} {item.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sampleStatusTone(String(item.status))}`}
                      >
                        {item.status}
                      </span>
                      {item.rejectionReason && (
                        <div className="mt-1 max-w-[180px] text-[11px] text-red-600">
                          {item.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800">{item.linkedName || '—'}</div>
                      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
                        {item.linkType === 'opportunity'
                          ? 'Opportunity Deal'
                          : item.linkType === 'lead'
                            ? 'Prospect Lead'
                            : 'Client Account'}
                      </div>
                      {item.recipientName && (
                        <div className="mt-0.5 text-xs text-zinc-500">{item.recipientName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.courierName || item.trackingNumber ? (
                        <div>
                          <div className="text-sm text-zinc-800">{item.courierName || '—'}</div>
                          <code className="mt-0.5 block text-xs text-zinc-600">
                            {item.trackingNumber || '—'}
                          </code>
                          {item.estimatedDeliveryDate && (
                            <div className="mt-0.5 text-[11px] text-zinc-400">
                              ETA {formatDate(item.estimatedDeliveryDate)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{renderClientReview(item)}</td>
                    <td
                      className="px-4 py-3"
                      data-tour={index === 0 ? 'samples-row-actions-first' : undefined}
                    >
                      {renderActions(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div data-tour="samples-pagination">
          <ListPager pagination={pagination} onPageChange={setPage} label="samples" />
        </div>
      </section>

      {approveOpen && approveSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-lg font-semibold text-zinc-950">
                  {approveAction === 'approve' ? 'Approve Sample' : 'Reject Sample'}
                </h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">{approveSample.sampleNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setApproveOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitApprove} className="space-y-4 p-5">
              {error && approveOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {approveAction === 'approve' ? (
                <p className="m-0 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                  Confirm you want to approve this sample request. Our team will prepare and dispatch it after approval.
                </p>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Rejection Reason *
                  </span>
                  <textarea
                    required
                    maxLength={1000}
                    rows={4}
                    className="w-full box-border rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                  />
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApproveOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : approveAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dispatchOpen && dispatchSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-lg font-semibold text-zinc-950">Dispatch Sample</h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">{dispatchSample.sampleNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setDispatchOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitDispatch} className="space-y-4 p-5">
              {error && dispatchOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Courier / Carrier *
                </span>
                <select
                  required
                  className={fieldClass}
                  value={courierName}
                  onChange={(event) => setCourierName(event.target.value)}
                >
                  <option value="">Select courier / carrier…</option>
                  {courierOptions.map((carrier) => (
                    <option key={carrier} value={carrier}>
                      {carrier}
                    </option>
                  ))}
                  {courierName && !courierOptions.includes(courierName) ? (
                    <option value={courierName}>{courierName}</option>
                  ) : null}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Dispatch Date</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={dispatchDate}
                    onChange={(event) => setDispatchDate(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Estimated Delivery
                  </span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={etaDate}
                    onChange={(event) => setEtaDate(event.target.value)}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDispatchOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Dispatching…' : 'Submit Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {feedbackOpen && feedbackSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-lg font-semibold text-zinc-950">Customer Feedback</h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">{feedbackSample.sampleNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitFeedback} className="space-y-4 p-5">
              {error && feedbackOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Rating *</span>
                <select
                  required
                  className={fieldClass}
                  value={rating}
                  onChange={(event) => setRating(Number(event.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {SAMPLE_RATING_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Interested in Order?
                </span>
                <select
                  className={fieldClass}
                  value={interestedInOrder}
                  onChange={(event) => setInterestedInOrder(event.target.value)}
                >
                  <option value="true">Yes — Client interested in placing order</option>
                  <option value="false">No — Not interested / Revision needed</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Comments</span>
                <textarea
                  maxLength={2000}
                  rows={3}
                  className="w-full box-border rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={requiresImprovement}
                  onChange={(event) => setRequiresImprovement(event.target.checked)}
                />
                Route improvement task
              </label>
              {requiresImprovement && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                      Target Department *
                    </span>
                    <select
                      required
                      className={fieldClass}
                      value={routedDepartment}
                      onChange={(event) => setRoutedDepartment(event.target.value)}
                    >
                      {SAMPLE_DEPARTMENTS.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                      Improvement Notes
                    </span>
                    <textarea
                      maxLength={2000}
                      rows={3}
                      className="w-full box-border rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                      value={improvementNotes}
                      onChange={(event) => setImprovementNotes(event.target.value)}
                    />
                  </label>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
