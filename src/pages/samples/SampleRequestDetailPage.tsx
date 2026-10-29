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
import EditIcon from '@mui/icons-material/Edit';
import NotesIcon from '@mui/icons-material/Notes';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CheckCircle2, Star } from 'lucide-react';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import type { CrmSettings } from '../../types/admin';
import type {
  SampleItem,
  SampleProductItem,
  SampleRoutedDepartment,
} from '../../types/samples';
import {
  SAMPLE_DEPARTMENTS,
  SAMPLE_RATING_LABELS,
  SAMPLE_UNITS,
  SAMPLE_URGENCIES,
  canCancelSampleRequest,
  canEditSampleRequest,
  sampleStatusTone,
  sampleUrgencyTone,
} from '../../types/samples';
import { SampleRequestTimelineTracker } from '../../components/samples/SampleRequestTimelineTracker';
import { SampleUrgencyDot } from '../../components/icons/SampleUrgencyDot';
import {
  BADGE,
  BTN_CONFIRM,
  BTN_DANGER_QUIET,
  BTN_INLINE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_TOOLBAR,
  CARD,
  CARD_HEAD,
  CARD_HEAD_BETWEEN,
  CARD_TITLE,
  FIELD_EMPTY,
  FIELD_LABEL,
  FIELD_LABEL_ROW,
  FIELD_VALUE,
  FIELD_VALUE_MUTED,
  FIELD_VALUE_STRONG,
  HEADER_CARD,
  INPUT,
  LINK,
  LINK_SMALL,
  MODAL_BACKDROP,
  MODAL_PANEL,
  NOTE_BOX,
  STAT_CARD,
  STAT_HINT,
  STAT_LABEL,
  STAT_VALUE,
  TABLE,
  TABLE_HEAD,
  TABLE_TD,
  TABLE_TH,
  TABLE_WRAP,
} from '../../components/samples/sampleUi';

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

/**
 * The headline product name for a multi-item request. SampleRequest.productName
 * is capped at 200 characters, so a long list is summarised rather than sent and
 * rejected.
 */
function summariseItemNames(items: { productName: string }[]): string {
  const joined = items.map((item) => item.productName).join(', ');
  if (joined.length <= 200) return joined;
  const summary = `${items[0].productName} +${items.length - 1} more`;
  return summary.slice(0, 200);
}

const fieldClass = INPUT;

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

  // Only Sales Manager (or CRM admin) can approve / reject sample requests — not clients.
  const canApproveSamples =
    !isClient &&
    (isAdmin || activeRole === 'sales-manager' || activeRole === 'crm-manager');
  const canDispatchSamples = isSampleLifecycleManager && (hasPermission('crm.samples.write') || isAdmin);
  const canDeliverSamples = isSampleLifecycleManager && (hasPermission('crm.samples.write') || isAdmin);
  const canManageStockAddress = isSampleLifecycleManager;
  const canFeedbackSamples = hasPermission('crm.samples.feedback') || isClient;
  // The request can still be corrected until it is handed to the courier.
  const canWriteSamples = !isClient && (hasPermission('crm.samples.write') || isAdmin);
  /**
   * Cancelling is the client's own escape hatch; on the staff side it is a
   * manager's call, so a sales representative (or finance manager) does not get
   * the button even though they can otherwise write to samples. The server
   * applies the same rule.
   */
  const canCancelFromRole =
    isClient || isAdmin || activeRole === 'crm-manager' || activeRole === 'sales-manager';

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

  // Edit modal state — only open while the request has not been dispatched
  const [editOpen, setEditOpen] = useState(false);
  const [editItems, setEditItems] = useState<SampleProductItem[]>([]);
  const [editUrgency, setEditUrgency] = useState<string>('Normal');
  const [editDeliveryAddress, setEditDeliveryAddress] = useState('');
  const [editRecipientName, setEditRecipientName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsChargeable, setEditIsChargeable] = useState(false);
  const [editChargeAmount, setEditChargeAmount] = useState('0');

  // Dispatch modal state
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [courierName, setCourierName] = useState('');
  /** Optional: blank when the courier has not issued the AWB yet. */
  const [trackingNumber, setTrackingNumber] = useState('');
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

  const availableUnits = useMemo(() => {
    const list = settings?.sample_units_of_measure;
    if (Array.isArray(list) && list.length > 0) return list;
    return Array.from(SAMPLE_UNITS);
  }, [settings]);

  const openEdit = () => {
    if (!sample) return;
    const rows =
      Array.isArray(sample.items) && sample.items.length
        ? sample.items.map((item) => ({
            productName: String(item.productName || ''),
            quantity: Math.max(1, Number(item.quantity) || 1),
            unit: String(item.unit || 'pcs'),
          }))
        : [
            {
              productName: String(sample.productName || ''),
              quantity: Math.max(1, Number(sample.quantity) || 1),
              unit: String(sample.unit || 'pcs'),
            },
          ];
    setEditItems(rows);
    setEditUrgency(String(sample.urgency || 'Normal'));
    setEditDeliveryAddress(sample.deliveryAddress || '');
    setEditRecipientName(sample.recipientName || '');
    setEditNotes(sample.notes || '');
    setEditIsChargeable(Boolean(sample.isChargeable));
    setEditChargeAmount(String(sample.chargeAmount || 0));
    setEditOpen(true);
    setError('');
  };

  const patchEditItem = (index: number, patch: Partial<SampleProductItem>) => {
    setEditItems((current) =>
      current.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const addEditItem = () => {
    setEditItems((current) => [
      ...current,
      { productName: '', quantity: 1, unit: availableUnits[0] || 'pcs' },
    ]);
  };

  const removeEditItem = (index: number) => {
    setEditItems((current) =>
      current.length === 1 ? current : current.filter((_, idx) => idx !== index)
    );
  };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sample) return;
    const validItems = editItems
      .filter((item) => item.productName.trim())
      .map((item) => ({
        productName: item.productName.trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit: item.unit || 'pcs',
      }));
    if (!validItems.length) {
      return setError('At least one item name is required.');
    }
    setSaving(true);
    try {
      const response = await crmApi.updateSample(sample._id, {
        // The headline product / quantity / unit mirror the rows, the same way
        // the create form writes them, so the two never disagree. The model
        // caps productName at 200 characters, so a long list is summarised.
        productName: summariseItemNames(validItems),
        quantity: validItems.reduce((sum, item) => sum + item.quantity, 0),
        unit: validItems[0].unit,
        items: validItems,
        urgency: editUrgency,
        deliveryAddress: editDeliveryAddress.trim(),
        recipientName: editRecipientName.trim(),
        notes: editNotes.trim(),
        isChargeable: editIsChargeable,
        chargeAmount: editIsChargeable ? Number(editChargeAmount) || 0 : 0,
      });
      setSuccess(response.message || 'Sample request updated.');
      setEditOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the sample request');
    } finally {
      setSaving(false);
    }
  };

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

  /**
   * Call off the request. Offered to the client who asked for it and to staff
   * acting on their behalf, and never once the kit has been delivered.
   */
  const cancelRequest = async () => {
    if (!sample) return;
    const agreed = await confirm({
      title: 'Cancel this sample request?',
      message: `${sample.sampleNumber} will be marked Cancelled. This cannot be undone — a new request would have to be raised.`,
      confirmLabel: 'Yes, cancel it',
      cancelLabel: 'Keep it',
    });
    if (!agreed) return;

    setSaving(true);
    setError('');
    try {
      const response = await crmApi.cancelSample(sample._id);
      setSuccess(response.message || 'Sample request cancelled.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this sample request');
    } finally {
      setSaving(false);
    }
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
    setTrackingNumber(String(sample.trackingNumber || '').trim());
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
        trackingNumber: trackingNumber.trim(),
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
        <div className="rounded-lg border border-zinc-950 bg-zinc-50 p-4 text-sm text-zinc-900 font-medium">
          {error}
        </div>
        <Link
          to="/samples"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:underline cursor-pointer"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to sample requests
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
          <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to sample requests
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={printSummary} className={BTN_TOOLBAR}>
            <PrintIcon sx={{ fontSize: 16 }} /> Print summary
          </button>
          <button type="button" onClick={() => void load()} className={BTN_TOOLBAR}>
            <RefreshIcon sx={{ fontSize: 16 }} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Header Card */}
      <header className={HEADER_CARD}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-950 m-0">
                {sample.sampleNumber}
              </h1>
              <span className={`${BADGE} ${sampleStatusTone(sample.status)}`}>{sample.status}</span>
              <span className={`${BADGE} ${sampleUrgencyTone(sample.urgency)}`}>
                <SampleUrgencyDot urgency={sample.urgency} />
                {sample.urgency} urgency
              </span>
            </div>
            <p className="mt-1.5 text-sm text-zinc-600 m-0">
              {sample.productName} · Requested for{' '}
              <strong className="text-zinc-900 font-semibold">{sample.linkedName || '—'}</strong>
            </p>
          </div>

          {/* Lifecycle Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canWriteSamples && canEditSampleRequest(sample.status) && (
              <button
                type="button"
                disabled={saving}
                onClick={openEdit}
                className={BTN_SECONDARY}
                title="Correct the items, quantities or delivery details before dispatch"
              >
                <EditIcon sx={{ fontSize: 16 }} /> Edit request
              </button>
            )}

            {sample.status === 'Requested' && canApproveSamples && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => openApprove('approve')}
                  className={BTN_CONFIRM}
                >
                  <CheckCircleIcon sx={{ fontSize: 16 }} /> Approve sample
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => openApprove('reject')}
                  className={BTN_DANGER_QUIET}
                >
                  <CloseIcon sx={{ fontSize: 16 }} /> Reject sample
                </button>
              </>
            )}

            {(sample.status === 'Approved' || sample.status === 'Preparing') && canDispatchSamples && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={openStockAddressModal}
                  className={BTN_SECONDARY}
                  title="Pick the office location this sample ships from"
                >
                  <LocationOnIcon sx={{ fontSize: 16 }} />
                  {sample.stockLocation ? 'Change stock address' : 'Add stock address'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={openDispatch}
                  className={BTN_PRIMARY}
                >
                  <LocalShippingIcon sx={{ fontSize: 16 }} /> Dispatch sample
                </button>
              </>
            )}

            {sample.status === 'Dispatched' && canDeliverSamples && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void markDelivered()}
                className={BTN_CONFIRM}
              >
                <CheckCircleIcon sx={{ fontSize: 16 }} /> Mark delivered
              </button>
            )}

            {canCancelFromRole && canCancelSampleRequest(sample.status) && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void cancelRequest()}
                className={BTN_DANGER_QUIET}
                title="Call off this sample request"
              >
                <CloseIcon sx={{ fontSize: 16 }} /> Cancel request
              </button>
            )}

            {(sample.status === 'Delivered' || sample.status === 'Completed') && canFeedbackSamples && (
              <button
                type="button"
                disabled={saving}
                onClick={openFeedback}
                className={BTN_SECONDARY}
              >
                <StarIcon sx={{ fontSize: 16 }} className="text-zinc-900" />
                {sample.feedback?.rating ? 'Edit review' : 'Submit review'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg border border-zinc-950 bg-zinc-50 p-3 text-sm font-medium text-zinc-900">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm font-medium text-zinc-900">
          {success}
        </div>
      )}

      {/* KPI Highlights Summary Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={STAT_CARD}>
          <span className={STAT_LABEL}>Product &amp; quantity</span>
          <div className={STAT_VALUE}>{sample.productName}</div>
          <div className={STAT_HINT}>
            {sample.quantity} {sample.unit}
          </div>
        </div>

        <div className={STAT_CARD}>
          <span className={STAT_LABEL}>Requester account</span>
          <div className={STAT_VALUE}>{sample.linkedName || '—'}</div>
          <div className={`${STAT_HINT} capitalize`}>{sample.linkType} record</div>
        </div>

        <div className={STAT_CARD}>
          <span className={STAT_LABEL}>Logistics &amp; courier</span>
          <div className={STAT_VALUE}>{sample.courierName || 'Pending dispatch'}</div>
          <div className={`${STAT_HINT} font-mono`}>
            {sample.trackingNumber ? `AWB: ${sample.trackingNumber}` : 'No tracking number'}
          </div>
        </div>

        <div className={STAT_CARD}>
          <span className={STAT_LABEL}>Client rating</span>
          <div className={`${STAT_VALUE} flex items-center gap-1`}>
            {sample.feedback?.rating ? (
              <>
                <StarIcon sx={{ fontSize: 16 }} className="text-zinc-900" />
                <span>{sample.feedback.rating} / 5</span>
              </>
            ) : (
              <span className="text-zinc-400 font-normal">Pending evaluation</span>
            )}
          </div>
          <div className={STAT_HINT}>
            {sample.feedback?.interestedInOrder ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                Bulk order interest
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      {/* Main Timeline & Shipping Progress Tracker */}
      <SampleRequestTimelineTracker sample={sample} />

      {/* Detailed Specifications & Requester Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Sample Request Details */}
        <section className={`${CARD} space-y-4`}>
          <div className={CARD_HEAD}>
            <Inventory2Icon sx={{ fontSize: 18 }} className="text-zinc-500" />
            <h2 className={CARD_TITLE}>Sample request specifications</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className={FIELD_LABEL}>Sample ID</span>
              <span className={FIELD_VALUE_STRONG}>{sample.sampleNumber}</span>
            </div>
            <div>
              <span className={FIELD_LABEL}>Urgency</span>
              <span className={`${BADGE} ${sampleUrgencyTone(sample.urgency)}`}>
                <SampleUrgencyDot urgency={sample.urgency} />
                {sample.urgency}
              </span>
            </div>
            <div>
              <span className={FIELD_LABEL}>Product Name</span>
              <span className={FIELD_VALUE}>{sample.productName}</span>
            </div>
            <div>
              <span className={FIELD_LABEL}>Quantity & Unit</span>
              <span className={FIELD_VALUE}>
                {sample.quantity} {sample.unit}
              </span>
            </div>
            <div>
              <span className={FIELD_LABEL}>Requested On</span>
              <span className={FIELD_VALUE_MUTED}>{formatDateTime(sample.createdAt)}</span>
            </div>
            <div>
              <span className={FIELD_LABEL}>Last Updated</span>
              <span className={FIELD_VALUE_MUTED}>{formatDateTime(sample.updatedAt)}</span>
            </div>
          </div>

          {sample.items && sample.items.length > 0 && (
            <div className="border-t border-zinc-100 pt-3">
              <span className={`${FIELD_LABEL} mb-2`}>
                Sample items ({sample.items.length})
              </span>
              <div className={TABLE_WRAP}>
                <table className={TABLE}>
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className={`${TABLE_TH} w-8`}>#</th>
                      <th className={TABLE_TH}>Product / item</th>
                      <th className={`${TABLE_TH} text-right`}>Quantity</th>
                      <th className={TABLE_TH}>Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {sample.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className={`${TABLE_TD} font-medium text-zinc-400`}>{idx + 1}</td>
                        <td className={`${TABLE_TD} font-medium text-zinc-900`}>{it.productName}</td>
                        <td className={`${TABLE_TD} text-right font-semibold text-zinc-800`}>
                          {it.quantity}
                        </td>
                        <td className={`${TABLE_TD} text-zinc-600`}>{it.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <span className={FIELD_LABEL_ROW}>
              <NotesIcon sx={{ fontSize: 14 }} /> Internal notes &amp; requirements
            </span>
            <p className={NOTE_BOX}>
              {sample.notes || 'No special requirements or notes provided for this sample request.'}
            </p>
          </div>
        </section>

        {/* Card 2: Requester & Recipient Contact */}
        <section className={`${CARD} space-y-4`}>
          <div className={CARD_HEAD}>
            <PersonIcon sx={{ fontSize: 18 }} className="text-zinc-500" />
            <h2 className={CARD_TITLE}>Requester &amp; recipient details</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className={FIELD_LABEL}>Linked Entity</span>
              {linkedUrl && !isClient ? (
                <Link
                  to={linkedUrl}
                  className={LINK}
                >
                  {sample.linkedName || 'Open record'}
                  <OpenInNewIcon sx={{ fontSize: 13 }} />
                </Link>
              ) : (
                <span className={FIELD_VALUE_STRONG}>{sample.linkedName || '—'}</span>
              )}
            </div>
            <div>
              <span className={FIELD_LABEL}>Relationship</span>
              <span className={`${FIELD_VALUE_MUTED} capitalize`}>
                {sample.linkType === 'opportunity' ? 'Deal / opportunity' : `${sample.linkType} account`}
              </span>
            </div>
            <div>
              <span className={FIELD_LABEL}>Recipient Contact</span>
              <span className={FIELD_VALUE}>{sample.recipientName || '—'}</span>
            </div>
            <div>
              <span className={FIELD_LABEL}>Email Address</span>
              {sample.recipientEmail ? (
                <a
                  href={`mailto:${sample.recipientEmail}`}
                  className={LINK_SMALL}
                >
                  <EmailIcon sx={{ fontSize: 13 }} /> {sample.recipientEmail}
                </a>
              ) : (
                <span className={FIELD_EMPTY}>—</span>
              )}
            </div>
            <div>
              <span className={FIELD_LABEL}>Phone Number</span>
              {sample.recipientPhone ? (
                <a
                  href={`tel:${sample.recipientPhone}`}
                  className={LINK_SMALL}
                >
                  <PhoneIcon sx={{ fontSize: 13 }} /> {sample.recipientPhone}
                </a>
              ) : (
                <span className={FIELD_EMPTY}>—</span>
              )}
            </div>
            <div>
              <span className={FIELD_LABEL}>Stock Address</span>
              {sample.stockLocation ? (
                <div className="flex items-start gap-1.5 mt-0.5">
                  <span className="text-xs font-medium leading-snug text-zinc-900">
                    {sample.stockLocation}
                  </span>
                  {canManageStockAddress && (
                    <button
                      type="button"
                      onClick={openStockAddressModal}
                      className={`${BTN_INLINE} shrink-0`}
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
                      className={`${BTN_INLINE} inline-flex items-center gap-1`}
                    >
                      <LocationOnIcon sx={{ fontSize: 13 }} /> Add stock address
                    </button>
                  ) : (
                    <span className={FIELD_EMPTY}>Not added</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <span className={FIELD_LABEL_ROW}>
              <LocationOnIcon sx={{ fontSize: 14 }} /> Delivery destination address
            </span>
            <p className={NOTE_BOX}>
              {sample.deliveryAddress || 'No shipping address provided.'}
            </p>
          </div>
        </section>
      </div>

      {/* Card 3: Client Feedback & Product Evaluation */}
      <section className={`${CARD} space-y-4`}>
        <div className={CARD_HEAD_BETWEEN}>
          <div className="flex items-center gap-2">
            <StarIcon sx={{ fontSize: 18 }} className="text-zinc-900" />
            <h2 className={CARD_TITLE}>Client feedback &amp; evaluation</h2>
          </div>
          {canFeedbackSamples && (sample.status === 'Delivered' || sample.status === 'Completed') && (
            <button
              type="button"
              onClick={openFeedback}
              className="text-xs font-semibold text-zinc-950 hover:underline border-0 bg-transparent cursor-pointer p-0"
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
                <span className="inline-flex text-zinc-900">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      sx={{
                        fontSize: 18,
                        color: (sample.feedback?.rating || 0) >= star ? '#18181b' : '#e4e4e7',
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
                <p className="m-0 rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-xs leading-relaxed text-zinc-900 italic">
                  &ldquo;{sample.feedback.comments}&rdquo;
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-0.5">
                  Commercial Purchase Intent
                </span>
                <span className={sample.feedback.interestedInOrder ? 'text-zinc-950 font-semibold' : 'text-zinc-600'}>
                  {sample.feedback.interestedInOrder ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-950" aria-hidden />
                      Highly interested in placing bulk order
                    </span>
                  ) : (
                    'Not interested at this stage'
                  )}
                </span>
              </div>

              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
                <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-0.5">
                  Quality Improvement Needed
                </span>
                <span className={sample.feedback.requiresImprovement ? 'text-zinc-950 font-semibold' : 'text-zinc-600'}>
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
                  className="h-8 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 shrink-0" aria-hidden />
                    Record Client Feedback Now
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* APPROVE / REJECT MODAL */}
      {approveOpen && (
        <div className={MODAL_BACKDROP}>
          <div className={`w-full max-w-md ${MODAL_PANEL}`}>
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
                <div className="rounded-lg border border-zinc-950 bg-zinc-50 p-3 text-sm font-medium text-zinc-900">
                  {error}
                </div>
              )}
              {approveAction === 'approve' ? (
                <p className="m-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800">
                  Confirm Sales Manager approval for this sample request. The team can prepare and dispatch it after approval.
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
                  className="h-9 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
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
        <div className={MODAL_BACKDROP}>
          <div className={`w-full max-w-md ${MODAL_PANEL}`}>
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
                <div className="rounded-lg border border-zinc-950 bg-zinc-50 p-3 text-sm text-zinc-900 font-medium">
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
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Tracking number / AWB
                </span>
                <input
                  className={fieldClass}
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Leave blank if not issued yet"
                />
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
                  className="h-9 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Record Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL — pre-dispatch corrections */}
      {editOpen && (
        <div className={MODAL_BACKDROP}>
          <div className={`w-full max-w-2xl ${MODAL_PANEL}`}>
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-base font-semibold text-zinc-950">Edit Sample Request</h2>
                <p className="mb-0 mt-0.5 text-xs text-zinc-500">
                  {sample.sampleNumber} · editable until dispatch
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitEdit} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
              {error && editOpen && (
                <div className="rounded-lg border border-zinc-950 bg-zinc-50 p-3 text-sm font-medium text-zinc-900">
                  {error}
                </div>
              )}

              {sample.status !== 'Requested' && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800">
                  This request was already approved. Changing the items or quantities here does
                  not ask for approval again — tell the approver what changed.
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-700">Items *</span>
                  <button
                    type="button"
                    onClick={addEditItem}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-dashed border-zinc-400 bg-white px-2.5 text-[11px] font-semibold text-zinc-800 hover:border-zinc-950 hover:bg-zinc-50 cursor-pointer"
                  >
                    + Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div
                      key={`edit-item-${idx}`}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 sm:grid-cols-12"
                    >
                      <div className="sm:col-span-6">
                        <span className="mb-1 block text-[11px] font-medium text-zinc-600">
                          Item {idx + 1}
                        </span>
                        <input
                          type="text"
                          maxLength={200}
                          className={fieldClass}
                          placeholder="Product / item name"
                          value={item.productName}
                          onChange={(e) => patchEditItem(idx, { productName: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <span className="mb-1 block text-[11px] font-medium text-zinc-600">
                          Quantity
                        </span>
                        <input
                          type="number"
                          min={1}
                          className={fieldClass}
                          value={item.quantity}
                          onChange={(e) =>
                            patchEditItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <span className="mb-1 block text-[11px] font-medium text-zinc-600">Unit</span>
                        <select
                          className={fieldClass}
                          value={item.unit}
                          onChange={(e) => patchEditItem(idx, { unit: e.target.value })}
                        >
                          {Array.from(new Set([item.unit, ...availableUnits]))
                            .filter(Boolean)
                            .map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="flex items-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => removeEditItem(idx)}
                          disabled={editItems.length === 1}
                          aria-label={`Remove item ${idx + 1}`}
                          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950 hover:bg-zinc-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Urgency</span>
                  <select
                    className={fieldClass}
                    value={editUrgency}
                    onChange={(e) => setEditUrgency(e.target.value)}
                  >
                    {SAMPLE_URGENCIES.map((urgency) => (
                      <option key={urgency} value={urgency}>
                        {urgency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Recipient name
                  </span>
                  <input
                    type="text"
                    maxLength={200}
                    className={fieldClass}
                    value={editRecipientName}
                    onChange={(e) => setEditRecipientName(e.target.value)}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Delivery address
                </span>
                <textarea
                  rows={2}
                  maxLength={1000}
                  className={fieldClass}
                  value={editDeliveryAddress}
                  onChange={(e) => setEditDeliveryAddress(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Internal notes
                </span>
                <textarea
                  rows={2}
                  maxLength={2000}
                  className={fieldClass}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </label>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsChargeable}
                    onChange={(e) => setEditIsChargeable(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                  />
                  <span className="text-xs font-semibold text-zinc-800">
                    Chargeable sample
                  </span>
                </label>
                {editIsChargeable && (
                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                      Charge amount ({sample.currency || sample.currencyCode || 'INR'})
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={fieldClass}
                      value={editChargeAmount}
                      onChange={(e) => setEditChargeAmount(e.target.value)}
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {feedbackOpen && (
        <div className={MODAL_BACKDROP}>
          <div className={`w-full max-w-lg ${MODAL_PANEL}`}>
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
                <div className="rounded-lg border border-zinc-950 bg-zinc-50 p-3 text-sm text-zinc-900 font-medium">
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
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-zinc-900">
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
                    <span className="mb-1 block text-xs font-semibold text-zinc-900">
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
                  className="h-9 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
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
        <div className={MODAL_BACKDROP}>
          <div className={`w-full max-w-md ${MODAL_PANEL}`}>
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
                <div className="rounded-lg border border-zinc-950 bg-zinc-50 p-3 text-sm text-zinc-900 font-medium">
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
                            ? 'bg-zinc-950 border-zinc-950 text-white font-medium shadow-xs'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        <LocationOnIcon sx={{ fontSize: 16, color: editingStockAddress === loc ? '#ffffff' : '#71717a' }} />
                        <span className="flex-1 break-words">{loc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800">
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
                  className="h-9 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
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
