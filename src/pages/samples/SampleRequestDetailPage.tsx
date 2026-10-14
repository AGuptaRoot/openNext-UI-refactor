import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StarIcon from '@mui/icons-material/Star';
import RefreshIcon from '@mui/icons-material/Refresh';
import PrintIcon from '@mui/icons-material/Print';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NotesIcon from '@mui/icons-material/Notes';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import type { CrmSettings } from '../../types/admin';
import type {
  SampleItem,
  SampleRoutedDepartment,
} from '../../types/samples';
import {
  SAMPLE_DEPARTMENTS,
  SAMPLE_RATING_LABELS,
  sampleStatusTone,
  sampleUrgencyEmoji,
  sampleUrgencyTone,
} from '../../types/samples';
import { SampleRequestTimelineTracker } from '../../components/samples/SampleRequestTimelineTracker';

function localToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

const fieldClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950';

export const SampleRequestDetailPage: React.FC = () => {
  const { id = '' } = useParams();
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
  const canManageStockAddress = isSampleLifecycleManager;
  const canFeedbackSamples = hasPermission('crm.samples.feedback') || isClient;

  const [sample, setSample] = useState<SampleItem | null>(null);
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Approval modal state
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveAction, setApproveAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  // Stock Address modal state (for adding/updating stock address after approval)
  const [stockAddressModalOpen, setStockAddressModalOpen] = useState(false);
  const [editingStockAddress, setEditingStockAddress] = useState('');

  // Dispatch modal state
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [courierName, setCourierName] = useState('');
  const [dispatchDate, setDispatchDate] = useState(localToday());
  const [etaDate, setEtaDate] = useState('');

  // Feedback modal state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [interestedInOrder, setInterestedInOrder] = useState('true');
  const [comments, setComments] = useState('');
  const [requiresImprovement, setRequiresImprovement] = useState(false);
  const [routedDepartment, setRoutedDepartment] = useState<SampleRoutedDepartment | string>('R&D / Technical');
  const [improvementNotes, setImprovementNotes] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [sampleRes, settingsRes] = await Promise.all([
        crmApi.getSample(id),
        // Catch gracefully: clients and non-admin staff do not hold crm.settings.manage permission
        crmApi.getSettings().catch(() => ({ data: null })),
      ]);
      setSample(sampleRes.data || null);
      setSettings(settingsRes?.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Extract office locations configured in Settings module
  const officeLocations = useMemo(() => {
    const list: string[] = [];
    if (settings?.office_address?.trim()) {
      list.push(settings.office_address.trim());
    }
    if (Array.isArray(settings?.office_addresses)) {
      settings.office_addresses.forEach((a) => {
        const trimmed = String(a || '').trim();
        if (trimmed && !list.includes(trimmed)) list.push(trimmed);
      });
    }
    return list;
  }, [settings]);

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

  // Modal openers
  const openApprove = (action: 'approve' | 'reject') => {
    if (!sample) return;
    setApproveAction(action);
    setRejectionReason('');
    setApproveOpen(true);
    setError('');
  };

  const openStockAddressModal = () => {
    if (!sample) return;
    setEditingStockAddress(sample.stockLocation || (officeLocations[0] || ''));
    setStockAddressModalOpen(true);
    setError('');
  };

  const submitStockAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sample) return;
    setSaving(true);
    try {
      const response = await crmApi.updateSampleStockAddress(
        sample._id,
        editingStockAddress.trim()
      );
      setSuccess(response.message || 'Stock address updated successfully.');
      setStockAddressModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save stock address');
    } finally {
      setSaving(false);
    }
  };

  const submitApprove = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sample) return;
    if (approveAction === 'reject' && !rejectionReason.trim()) {
      return setError('Rejection reason is required.');
    }
    setSaving(true);
    try {
      const response = await crmApi.approveSample(sample._id, {
        action: approveAction,
        rejectionReason: approveAction === 'reject' ? rejectionReason.trim() : undefined,
      });
      setSuccess(response.message || `Sample request ${approveAction}d.`);
      setApproveOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval update failed');
    } finally {
      setSaving(false);
    }
  };

  const openDispatch = () => {
    if (!sample) return;
    const existingCourier = String(sample.courierName || '').trim();
    setCourierName(existingCourier || courierOptions[0] || '');
    setDispatchDate(sample.dispatchDate?.slice(0, 10) || localToday());
    setEtaDate(sample.estimatedDeliveryDate?.slice(0, 10) || '');
    setDispatchOpen(true);
    setError('');
  };

  const submitDispatch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sample) return;
    if (!courierName.trim()) {
      return setError('Courier / carrier is required.');
    }
    setSaving(true);
    try {
      const response = await crmApi.dispatchSample(sample._id, {
        courierName: courierName.trim(),
        trackingNumber: '',
        dispatchDate: dispatchDate || undefined,
        estimatedDeliveryDate: etaDate || undefined,
      });
      setSuccess(response.message || 'Sample dispatched.');
      setDispatchOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch update failed');
    } finally {
      setSaving(false);
    }
  };

  const markDelivered = async () => {
    if (!sample) return;
    if (!(await confirm(`Mark sample request ${sample.sampleNumber} as delivered to recipient?`))) {
      return;
    }
    setSaving(true);
    try {
      const response = await crmApi.deliverSample(sample._id);
      setSuccess(response.message || 'Sample marked delivered.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark delivered');
    } finally {
      setSaving(false);
    }
  };

  const openFeedback = () => {
    if (!sample) return;
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
    if (!sample) return;
    if (requiresImprovement && !routedDepartment) {
      return setError('Please select a department for quality improvement routing.');
    }
    setSaving(true);
    try {
      const response = await crmApi.submitSampleFeedback(sample._id, {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSaving(false);
    }
  };

  const printSummary = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zinc-900 border-r-transparent align-[-0.125em]" />
          <p className="mt-3 text-sm text-zinc-600 font-medium">Loading sample request details…</p>
        </div>
      </div>
    );
  }

  if (error && !sample) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <Link
          to="/samples"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:underline"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to Sample Requests
        </Link>
      </div>
    );
  }

  if (!sample) return null;

  // Resolve linked entity link
  const linkedUrl =
    sample.linkType === 'lead' && sample.leadId
      ? `/leads/${sample.leadId}`
      : sample.linkType === 'client' && sample.clientId
        ? `/clients/${sample.clientId}`
        : sample.linkType === 'opportunity' && sample.opportunityId
          ? `/opportunities/${sample.opportunityId}`
          : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/samples"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 no-underline"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to Sample Requests
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={printSummary}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <PrintIcon sx={{ fontSize: 16 }} /> Print Summary
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <RefreshIcon sx={{ fontSize: 16 }} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Header Card */}
      <header className="rounded-2xl border border-zinc-300 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-950 m-0">
                {sample.sampleNumber}
              </h1>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sampleStatusTone(
                  sample.status
                )}`}
              >
                {sample.status}
              </span>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sampleUrgencyTone(
                  sample.urgency
                )}`}
              >
                {sampleUrgencyEmoji(sample.urgency)} {sample.urgency} Urgency
              </span>
            </div>
            <p className="mt-1.5 text-sm text-zinc-600 m-0">
              {sample.productName} · Requested for{' '}
              <strong className="text-zinc-900 font-semibold">{sample.linkedName || '—'}</strong>
            </p>
          </div>

          {/* Lifecycle Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {sample.status === 'Requested' && canApproveSamples && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => openApprove('approve')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-emerald-700 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                >
                  <CheckCircleIcon sx={{ fontSize: 16 }} /> Approve Sample
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => openApprove('reject')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <CloseIcon sx={{ fontSize: 16 }} /> Reject Sample
                </button>
              </>
            )}

            {(sample.status === 'Approved' || sample.status === 'Preparing') && canDispatchSamples && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={openStockAddressModal}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 disabled:opacity-50"
                  title="Configure or update Stock Address from Office Location"
                >
                  <LocationOnIcon sx={{ fontSize: 16 }} />
                  {sample.stockLocation ? 'Change Stock Address' : 'Add Stock Address'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={openDispatch}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-slate-950 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  <LocalShippingIcon sx={{ fontSize: 16 }} /> Dispatch Sample
                </button>
              </>
            )}

            {sample.status === 'Dispatched' && canDeliverSamples && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void markDelivered()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-emerald-700 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
              >
                <CheckCircleIcon sx={{ fontSize: 16 }} /> Mark Delivered
              </button>
            )}

            {(sample.status === 'Delivered' || sample.status === 'Completed') && canFeedbackSamples && (
              <button
                type="button"
                disabled={saving}
                onClick={openFeedback}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                <StarIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                {sample.feedback?.rating ? 'Edit Review' : 'Submit Review'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {/* KPI Highlights Summary Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 block mb-1">
            Product & Quantity
          </span>
          <div className="text-sm font-bold text-zinc-900 truncate">{sample.productName}</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {sample.quantity} {sample.unit}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 block mb-1">
            Requester Account
          </span>
          <div className="text-sm font-bold text-zinc-900 truncate">
            {sample.linkedName || '—'}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 capitalize">
            {sample.linkType} record
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 block mb-1">
            Logistics & Courier
          </span>
          <div className="text-sm font-bold text-zinc-900 truncate">
            {sample.courierName || 'Pending dispatch'}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 font-mono">
            {sample.trackingNumber ? `AWB: ${sample.trackingNumber}` : '—'}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 block mb-1">
            Client Rating & Review
          </span>
          <div className="text-sm font-bold text-zinc-900 flex items-center gap-1">
            {sample.feedback?.rating ? (
              <>
                <span className="text-amber-500 flex items-center">
                  <StarIcon sx={{ fontSize: 16 }} />
                </span>
                <span>{sample.feedback.rating} / 5</span>
              </>
            ) : (
              <span className="text-zinc-400 font-normal">Pending evaluation</span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {sample.feedback?.interestedInOrder ? '✓ Bulk Order Interest' : '—'}
          </div>
        </div>
      </div>

      {/* Main Timeline & Shipping Progress Tracker */}
      <SampleRequestTimelineTracker sample={sample} />

      {/* Detailed Specifications & Requester Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Sample Request Details */}
        <section className="bg-white border border-zinc-300 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
            <Inventory2Icon sx={{ fontSize: 20, color: '#09090b' }} />
            <h2 className="text-sm font-semibold text-zinc-950 m-0">Sample request specifications</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Sample ID</span>
              <span className="font-semibold text-zinc-900">{sample.sampleNumber}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Urgency</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${sampleUrgencyTone(sample.urgency)}`}>
                {sampleUrgencyEmoji(sample.urgency)} {sample.urgency}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Product Name</span>
              <span className="font-medium text-zinc-900">{sample.productName}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Quantity & Unit</span>
              <span className="font-medium text-zinc-900">
                {sample.quantity} {sample.unit}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Requested On</span>
              <span className="text-zinc-700">{formatDateTime(sample.createdAt)}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Last Updated</span>
              <span className="text-zinc-700">{formatDateTime(sample.updatedAt)}</span>
            </div>
          </div>

          {sample.items && sample.items.length > 0 && (
            <div className="border-t border-zinc-100 pt-3">
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-2">
                Sample Items ({sample.items.length})
              </span>
              <div className="rounded-lg border border-zinc-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold">
                    <tr>
                      <th className="py-2 px-3 w-8">#</th>
                      <th className="py-2 px-3">Product / Item</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                      <th className="py-2 px-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sample.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="py-2 px-3 text-zinc-400 font-medium">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-zinc-900">{it.productName}</td>
                        <td className="py-2 px-3 text-right font-semibold text-zinc-800">{it.quantity}</td>
                        <td className="py-2 px-3 text-zinc-600">{it.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-1 flex items-center gap-1">
              <NotesIcon sx={{ fontSize: 14 }} /> Internal Notes & Requirements
            </span>
            <p className="m-0 rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-xs leading-relaxed text-zinc-800">
              {sample.notes || 'No special requirements or notes provided for this sample request.'}
            </p>
          </div>
        </section>

        {/* Card 2: Requester & Recipient Contact */}
        <section className="bg-white border border-zinc-300 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
            <PersonIcon sx={{ fontSize: 20, color: '#09090b' }} />
            <h2 className="text-sm font-semibold text-zinc-950 m-0">Requester & recipient details</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Linked Entity</span>
              {linkedUrl && !isClient ? (
                <Link
                  to={linkedUrl}
                  className="font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs"
                >
                  {sample.linkedName || 'Open Record'}
                  <OpenInNewIcon sx={{ fontSize: 13 }} />
                </Link>
              ) : (
                <span className="font-semibold text-zinc-900">{sample.linkedName || '—'}</span>
              )}
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Relationship</span>
              <span className="font-medium text-zinc-700 capitalize">
                {sample.linkType === 'opportunity' ? 'Deal / Opportunity' : `${sample.linkType} Account`}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Recipient Contact</span>
              <span className="font-medium text-zinc-900">{sample.recipientName || '—'}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Email Address</span>
              {sample.recipientEmail ? (
                <a
                  href={`mailto:${sample.recipientEmail}`}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <EmailIcon sx={{ fontSize: 13 }} /> {sample.recipientEmail}
                </a>
              ) : (
                <span className="text-zinc-400 text-xs">—</span>
              )}
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Phone Number</span>
              {sample.recipientPhone ? (
                <a
                  href={`tel:${sample.recipientPhone}`}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <PhoneIcon sx={{ fontSize: 13 }} /> {sample.recipientPhone}
                </a>
              ) : (
                <span className="text-zinc-400 text-xs">—</span>
              )}
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500 block">Stock Address</span>
              {sample.stockLocation ? (
                <div className="flex items-start gap-1.5 mt-0.5">
                  <span className="text-zinc-900 text-xs font-medium leading-snug">{sample.stockLocation}</span>
                  {canManageStockAddress && (
                    <button
                      type="button"
                      onClick={openStockAddressModal}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline shrink-0 border-0 bg-transparent p-0 cursor-pointer"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-0.5">
                  {canManageStockAddress && sample.status !== 'Requested' && sample.status !== 'Rejected' ? (
                    <button
                      type="button"
                      onClick={openStockAddressModal}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border-0 bg-transparent p-0 cursor-pointer"
                    >
                      <LocationOnIcon sx={{ fontSize: 13 }} /> Add Stock Address
                    </button>
                  ) : (
                    <span className="text-zinc-400 text-xs">Not added</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-1 flex items-center gap-1">
              <LocationOnIcon sx={{ fontSize: 14 }} /> Delivery Destination Address
            </span>
            <p className="m-0 rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-xs leading-relaxed text-zinc-800">
              {sample.deliveryAddress || 'No shipping address provided.'}
            </p>
          </div>
        </section>
      </div>

      {/* Card 3: Client Feedback & Product Evaluation */}
      <section className="bg-white border border-zinc-300 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
          <div className="flex items-center gap-2">
            <StarIcon sx={{ fontSize: 20, color: '#f59e0b' }} />
            <h2 className="text-sm font-semibold text-zinc-950 m-0">Client feedback & evaluation</h2>
          </div>
          {canFeedbackSamples && (sample.status === 'Delivered' || sample.status === 'Completed') && (
            <button
              type="button"
              onClick={openFeedback}
              className="text-xs font-semibold text-blue-600 hover:underline border-0 bg-transparent cursor-pointer p-0"
            >
              {sample.feedback?.rating ? 'Edit Feedback' : '+ Record Feedback'}
            </button>
          )}
        </div>

        {sample.feedback && (sample.feedback.rating != null || sample.feedback.comments) ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-zinc-600">Client Rating:</span>
                <span className="inline-flex text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      sx={{
                        fontSize: 18,
                        color: (sample.feedback?.rating || 0) >= star ? '#f59e0b' : '#e4e4e7',
                      }}
                    />
                  ))}
                </span>
                <span className="text-xs font-bold text-zinc-900 ml-1">
                  {sample.feedback.rating ? SAMPLE_RATING_LABELS[sample.feedback.rating] : ''}
                </span>
              </div>

              {sample.feedback.feedbackDate && (
                <div className="text-xs text-zinc-500">
                  Recorded on {formatDate(sample.feedback.feedbackDate)}
                </div>
              )}
            </div>

            {sample.feedback.comments && (
              <div>
                <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-1">
                  Review & Comments
                </span>
                <p className="m-0 rounded-lg bg-amber-50/60 border border-amber-200 p-3 text-xs leading-relaxed text-zinc-900 italic">
                  &ldquo;{sample.feedback.comments}&rdquo;
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-0.5">
                  Commercial Purchase Intent
                </span>
                <span className={sample.feedback.interestedInOrder ? 'text-emerald-700 font-semibold' : 'text-zinc-600'}>
                  {sample.feedback.interestedInOrder ? '✓ Highly interested in placing bulk order' : 'Not interested at this stage'}
                </span>
              </div>

              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-0.5">
                  Quality Improvement Needed
                </span>
                <span className={sample.feedback.requiresImprovement ? 'text-amber-800 font-semibold' : 'text-zinc-600'}>
                  {sample.feedback.requiresImprovement
                    ? `Yes — Routed to ${sample.feedback.routedDepartment || 'R&D / Technical'}`
                    : 'No — Meets specifications'}
                </span>
              </div>
            </div>

            {sample.feedback.improvementNotes && (
              <div>
                <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-1">
                  Improvement Action Items
                </span>
                <p className="m-0 rounded-lg bg-zinc-50 border border-zinc-200 p-2.5 text-xs text-zinc-800">
                  {sample.feedback.improvementNotes}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-zinc-50 border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-500">
            {sample.status === 'Delivered'
              ? 'Sample package has been delivered. Customer evaluation and feedback can now be recorded.'
              : 'Feedback evaluation is unlocked once the sample package has been dispatched and delivered.'}
            {canFeedbackSamples && sample.status === 'Delivered' && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={openFeedback}
                  className="h-8 rounded-lg border-0 bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 cursor-pointer"
                >
                  ⭐ Record Client Feedback Now
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* APPROVE / REJECT MODAL */}
      {approveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-base font-semibold text-zinc-950">
                  {approveAction === 'approve' ? 'Approve Sample Request' : 'Reject Sample Request'}
                </h2>
                <p className="mb-0 mt-0.5 text-xs text-zinc-500">{sample.sampleNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setApproveOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 cursor-pointer"
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
                    rows={3}
                    className={fieldClass}
                    maxLength={1000}
                    placeholder="State the reason for rejecting this sample request…"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </label>
              )}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setApproveOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`h-9 rounded-lg border-0 px-4 text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-50 ${
                    approveAction === 'approve' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {saving ? 'Processing…' : approveAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH MODAL */}
      {dispatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-base font-semibold text-zinc-950">Dispatch Sample & Courier</h2>
                <p className="mb-0 mt-0.5 text-xs text-zinc-500">{sample.sampleNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setDispatchOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 cursor-pointer"
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
                  onChange={(e) => setCourierName(e.target.value)}
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
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Dispatch Date
                  </span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
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
                    onChange={(e) => setEtaDate(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setDispatchOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Record Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-base font-semibold text-zinc-950">Record Client Feedback</h2>
                <p className="mb-0 mt-0.5 text-xs text-zinc-500">{sample.sampleNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitFeedback} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
              {error && feedbackOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Rating (1 to 5 Stars) *
                </span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="border-0 bg-transparent p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <StarIcon
                        sx={{
                          fontSize: 28,
                          color: rating >= star ? '#f59e0b' : '#d4d4d8',
                        }}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-zinc-700">
                    {SAMPLE_RATING_LABELS[rating]}
                  </span>
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Client Comments / Evaluation Notes
                </span>
                <textarea
                  rows={3}
                  className={fieldClass}
                  maxLength={2000}
                  placeholder="Record customer comments on texture, quality, color, finish, etc."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Interested in placing bulk order?
                </span>
                <select
                  className={fieldClass}
                  value={interestedInOrder}
                  onChange={(e) => setInterestedInOrder(e.target.value)}
                >
                  <option value="true">Yes — Client interested in bulk order</option>
                  <option value="false">No — Not interested at this time</option>
                </select>
              </label>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresImprovement}
                  onChange={(e) => setRequiresImprovement(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                />
                <span className="text-xs font-semibold text-zinc-800">
                  Requires product or formulation improvement
                </span>
              </label>

              {requiresImprovement && (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-amber-950">
                      Route Improvement To Department *
                    </span>
                    <select
                      className={fieldClass}
                      value={routedDepartment}
                      onChange={(e) => setRoutedDepartment(e.target.value)}
                    >
                      {SAMPLE_DEPARTMENTS.filter((d) => d !== 'None').map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-amber-950">
                      Improvement Notes & Feedback
                    </span>
                    <textarea
                      rows={2}
                      className={fieldClass}
                      maxLength={2000}
                      placeholder="Specify technical parameters, alterations, or adjustments needed…"
                      value={improvementNotes}
                      onChange={(e) => setImprovementNotes(e.target.value)}
                    />
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Submitting…' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK ADDRESS MODAL (Configured via Settings office locations or custom) */}
      {stockAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-base font-semibold text-zinc-950">
                  {sample.stockLocation ? 'Update Stock Address' : 'Add Stock Address'}
                </h2>
                <p className="mb-0 mt-0.5 text-xs text-zinc-500">
                  {sample.sampleNumber} · Office dispatch location
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStockAddressModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitStockAddress} className="space-y-4 p-5">
              {error && stockAddressModalOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {officeLocations.length > 0 ? (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Select from Office Locations (Configured in Settings):
                  </label>
                  <div className="space-y-1.5">
                    {officeLocations.map((loc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditingStockAddress(loc)}
                        className={`w-full text-left rounded-lg p-2.5 text-xs border transition-all cursor-pointer flex items-start gap-2 ${
                          editingStockAddress === loc
                            ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-medium ring-1 ring-indigo-400'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        <LocationOnIcon sx={{ fontSize: 16, color: editingStockAddress === loc ? '#4f46e5' : '#71717a' }} />
                        <span className="flex-1 break-words">{loc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  No office address saved in Settings yet. You can type the address below, or configure office locations in Settings &gt; General tab.
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Stock Address / Dispatch Location *
                </span>
                <textarea
                  rows={3}
                  required
                  className={fieldClass}
                  maxLength={500}
                  placeholder="Enter office / dispatch stock address…"
                  value={editingStockAddress}
                  onChange={(e) => setEditingStockAddress(e.target.value)}
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setStockAddressModalOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !editingStockAddress.trim()}
                  className="h-9 rounded-lg border-0 bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Stock Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
