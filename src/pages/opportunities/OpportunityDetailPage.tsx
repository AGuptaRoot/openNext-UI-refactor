import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { ApiError, crmApi } from '../../services/api';
import { LeadPortalAccessButton } from '../../components/leads/LeadPortalAccess';
import { AssignableUser } from '../../types/leads';
import {
  OpportunityItem,
  stageProbability,
  isOpportunityStageLocked,
  opportunityLockLabel,
  computeOpportunityFinancials,
  isOpportunityWonStage,
  isOpportunityLostStage,
  canCreateOpportunityQuotation,
  describeOpportunityAmountBlock,
} from '../../types/opportunities';
import { useOpportunityStages } from '../../hooks/useOpportunityStages';
import {
  canAssignOpportunityOwner,
  formatAssignableUserLabel,
  isAssignableSalesRepresentative,
} from '../../utils/permissions';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import {
  OpportunityEditModal,
  type OpportunityEditSection,
} from '../../components/opportunities/OpportunityEditModal';
import { formatCrmMoney } from '../../utils/currency';

function formatMoney(value?: number, currency?: string) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return formatCrmMoney(value, currency, { maximumFractionDigits: 2 });
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function stageTone(stage: string): string {
  if (isOpportunityWonStage(stage)) return 'bg-zinc-950 text-white';
  if (isOpportunityLostStage(stage)) return 'bg-zinc-100 text-zinc-500';
  return 'bg-zinc-100 text-zinc-800';
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </div>
      <div className="text-sm text-zinc-900 break-words">{children}</div>
    </div>
  );
}

export const OpportunityDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isClient, user, activeRole } = useAuth();
  const { confirm } = useDialog();

  const canWrite =
    (hasPermission('crm.opportunities.write') || hasPermission('crm.leads.write')) && !isClient;
  const canDelete = hasPermission('crm.opportunities.delete') && !isClient;
  const canViewSalesOrders = hasPermission('crm.orders.read') && !isClient;
  const canCreateSalesOrders = hasPermission('crm.orders.write') && !isClient;
  const canRequestSample =
    (hasPermission('crm.samples.write') ||
      hasPermission('crm.opportunities.write') ||
      hasPermission('crm.leads.write')) &&
    !isClient;
  const canAssignOwner = canAssignOpportunityOwner(user, { isClient, activeRole });
  const opportunityStages = useOpportunityStages();
  const settingsCurrency = useDefaultCurrency();

  const [item, setItem] = useState<OpportunityItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [assignOwnerId, setAssignOwnerId] = useState('');
  /** Which section the edit modal is showing, or null when closed. */
  const [editSection, setEditSection] = useState<OpportunityEditSection | null>(null);
  /** Stage types offered by this deal's own pipeline (drives the sample button). */
  const [pipelineStageTypes, setPipelineStageTypes] = useState<string[] | null>(null);

  /**
   * The sample workflow only exists for pipelines that actually model it, so
   * hide the button unless this deal's pipeline defines a sample stage. While
   * the pipeline is still loading (null) the button stays hidden rather than
   * flickering in and out.
   */
  const pipelineSupportsSamples =
    pipelineStageTypes !== null &&
    pipelineStageTypes.some((type) => type === 'SAMPLE_SENT' || type === 'SAMPLE_APPROVED');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await crmApi.getOpportunity(id);
      setItem(response.data);
      setAssignOwnerId(String(response.data?.salesOwner || '').trim());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load opportunity');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Load the stage types of the deal's own pipeline. Falls back to the active
   * pipeline when the deal carries no pipelineId (older records), and to an
   * empty list on failure — which keeps the sample button hidden rather than
   * offering a workflow the pipeline does not model.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!item) return;
      try {
        const res = item.pipelineId
          ? await crmApi.getOpportunityPipeline(String(item.pipelineId))
          : await crmApi.getActiveOpportunityPipeline();
        if (cancelled) return;
        const stages = res.data?.stages;
        setPipelineStageTypes(
          Array.isArray(stages) ? stages.map((st) => String(st.type || '')) : []
        );
      } catch {
        if (!cancelled) setPipelineStageTypes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.pipelineId, item?._id]);

  useEffect(() => {
    if (!canAssignOwner) {
      setAssignableUsers([]);
      return;
    }
    let cancelled = false;
    crmApi
      .getAssignableUsers()
      .then((res) => {
        if (cancelled) return;
        const users = Array.isArray(res.data)
          ? res.data
              .map((u) => {
                const uid = String(u.id || u._id || u.userId || '').trim();
                const username = String(u.username || '').trim();
                const email = String(u.email || '').trim();
                const displayName =
                  username ||
                  u.name ||
                  email ||
                  String(u.displayName || '')
                    .replace(/\s*\([^)]*\)\s*$/, '')
                    .trim() ||
                  'User';
                return {
                  ...u,
                  id: uid,
                  username: username || displayName,
                  name: u.name || displayName,
                  displayName,
                  email,
                  role: u.role || u.designation || '',
                  cmsRole: u.cmsRole ?? undefined,
                };
              })
              .filter((u) => {
                if (!u.id) return false;
                if (u.isClient || u.isClientUser) return false;
                const role = String(u.role || '').toLowerCase();
                if (role.includes('client') || role.includes('customer') || role.includes('portal')) {
                  return false;
                }
                return true;
              })
          : [];
        setAssignableUsers(users);
      })
      .catch(() => {
        if (!cancelled) setAssignableUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canAssignOwner]);

  const salesRepOptions = useMemo(() => {
    const reps = assignableUsers.filter((u) => isAssignableSalesRepresentative(u));
    const list = reps.length > 0 ? reps : assignableUsers;
    return [...list].sort((a, b) =>
      formatAssignableUserLabel(a).localeCompare(formatAssignableUserLabel(b), undefined, {
        sensitivity: 'base',
      })
    );
  }, [assignableUsers]);

  const currentUserId = String(user?.userId || '').trim();

  const products = item?.products || [];
  const probability =
    item?.probability ?? stageProbability(item?.stage || 'Discovery', opportunityStages);
  const financials = useMemo(
    () =>
      computeOpportunityFinancials(products, 0, probability),
    [products, probability]
  );

  const locked = item ? isOpportunityStageLocked(item) : false;
  const lockLabel = item ? opportunityLockLabel(item) : '';
  const stageMeta = opportunityStages.find((s) => s.key === item?.stage);

  const runAssignOwner = async () => {
    if (!item || !canAssignOwner) return;
    const nextOwner = String(assignOwnerId || '').trim();
    if (!nextOwner) {
      setError('Select a sales representative to assign');
      return;
    }
    if (nextOwner === String(item.salesOwner || '').trim()) {
      setInfo('Already assigned to this sales representative');
      return;
    }
    setAssigning(true);
    setError('');
    setInfo('');
    try {
      const response = await crmApi.assignOpportunityOwner(item._id, { salesOwner: nextOwner });
      setItem(response.data);
      setAssignOwnerId(String(response.data?.salesOwner || nextOwner).trim());
      setInfo('Opportunity assigned to sales representative');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to assign opportunity');
    } finally {
      setAssigning(false);
    }
  };

  const runConvertQuotation = async () => {
    if (!item) return;
    if (!(await confirm(`Generate quotation from "${item.title}"?`))) return;
    setBusy(true);
    setInfo('');
    try {
      const res = await crmApi.convertOpportunityToQuotation(item._id);
      setInfo(res.message || 'Quotation generated successfully');
      await load();
      const quotationId =
        (res.data as { quotationId?: string })?.quotationId ||
        (res.data as { _id?: string })?._id;
      if (quotationId) {
        window.setTimeout(() => navigate(`/quotations/${quotationId}`), 400);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Convert failed');
    } finally {
      setBusy(false);
    }
  };

  const promptOpenExistingSalesOrder = async (salesOrderId?: string | null) => {
    const open = await confirm({
      title: 'Sales Order exists',
      message: 'A Sales Order already exists for this Opportunity.',
      confirmLabel: 'Open Sales Order',
      cancelLabel: 'Close',
    });
    if (open && salesOrderId && salesOrderId !== 'converted') {
      navigate(`/sales-orders/${salesOrderId}`);
    }
  };

  const runConvertSalesOrder = async () => {
    if (!item) return;
    if (item.generatedSalesOrderId) {
      await promptOpenExistingSalesOrder(item.generatedSalesOrderId);
      return;
    }
    if (!(await confirm(`Create sales order from "${item.title}"?`))) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await crmApi.convertOpportunityToSalesOrder(item._id);
      const salesOrderId =
        (res.data as { salesOrderId?: string })?.salesOrderId ||
        (res.data as { _id?: string })?._id ||
        '';
      setItem((prev) =>
        prev
          ? {
              ...prev,
              generatedSalesOrderId: salesOrderId || prev.generatedSalesOrderId || null,
            }
          : prev
      );
      setInfo('Sales Order created');
      await load();
      if (salesOrderId) {
        navigate(`/sales-orders/${salesOrderId}`);
      }
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : 'Sales order conversion failed';
      const existingId =
        reason instanceof ApiError && reason.data && typeof reason.data === 'object'
          ? String((reason.data as { salesOrderId?: string }).salesOrderId || '')
          : '';
      if (
        reason instanceof ApiError &&
        (reason.status === 409 ||
          reason.code === 'SALES_ORDER_EXISTS' ||
          /already exists|converted/i.test(msg))
      ) {
        const soId = existingId || item.generatedSalesOrderId;
        setItem((prev) =>
          prev ? { ...prev, generatedSalesOrderId: soId || prev.generatedSalesOrderId || null } : prev
        );
        setInfo('A Sales Order already exists for this Opportunity.');
        await load();
        await promptOpenExistingSalesOrder(soId);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    if (!item) return;
    if (
      !(await confirm({
        message: `Delete opportunity "${item.title}"? This cannot be undone.`,
        tone: 'danger',
        confirmLabel: 'Delete',
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await crmApi.deleteOpportunity(item._id);
      navigate('/opportunities');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Delete failed');
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-sm text-zinc-500">Loading opportunity…</div>;
  }

  if (!item) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-zinc-500 mb-4">{error || 'Opportunity not found.'}</p>
        <Link to="/opportunities" className="text-sm font-semibold text-zinc-950 no-underline">
          ← Back to opportunities
        </Link>
      </div>
    );
  }

  const dealValue =
    item.estimatedDealValue ?? item.expectedRevenue ?? item.value ?? financials.expectedRevenue;

  return (
    <div data-tour="opportunities-detail" className="flex flex-col gap-5 pb-10">
      {(error || info) && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || info}
        </div>
      )}

      <header
        data-tour="opportunities-detail-header"
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-zinc-200"
      >
        <div>
          <Link
            to="/opportunities"
            data-tour="opportunities-detail-back"
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950"
          >
            <ArrowBackIcon sx={{ fontSize: 14 }} />
            Opportunities
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">{item.title}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stageTone(
                item.stage
              )}`}
            >
              {stageMeta?.label || item.stage}
            </span>
            {locked && lockLabel && (
              <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
                {lockLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {item.opportunityNumber ? (
              <code className="font-mono text-xs">{item.opportunityNumber}</code>
            ) : (
              'Deal workspace'
            )}
            {item.clientName ? ` · ${item.clientName}` : ''}
          </p>
        </div>

        <div data-tour="opportunities-detail-actions" className="flex flex-wrap gap-2">
          {canRequestSample && pipelineSupportsSamples && (
            <Link
              to={`/samples/create?opportunityId=${encodeURIComponent(item._id)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold no-underline text-zinc-800 hover:bg-zinc-50"
              data-tour="opportunities-detail-request-sample"
            >
              Request Sample
            </Link>
          )}
          {canWrite && item.leadId && !item.isPortal && !item.leadIsPortal ? (
            <LeadPortalAccessButton
              leadId={String(item.leadId)}
              leadEmail={item.contactEmail}
              leadName={item.title}
              canWrite={canWrite}
              hideIfPortalActive
              showToast={(message, tone) =>
                tone === 'error' ? setError(message) : setInfo(message)
              }
            />
          ) : null}
          {canWrite && canCreateOpportunityQuotation(item) && (
            <button
              type="button"
              disabled={busy || Boolean(describeOpportunityAmountBlock(item))}
              title={
                describeOpportunityAmountBlock(item) || 'Create a quotation from this deal'
              }
              onClick={() => void runConvertQuotation()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50 hover:bg-zinc-50"
            >
              <RequestQuoteOutlinedIcon sx={{ fontSize: 15 }} />
              Create Quotation
            </button>
          )}
          {isOpportunityWonStage(item.stage, item.stageType) &&
            !item.generatedSalesOrderId &&
            canCreateSalesOrders && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runConvertSalesOrder()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50 hover:bg-zinc-50"
            >
              <ShoppingCartOutlinedIcon sx={{ fontSize: 15 }} />
              Create Sales Order
            </button>
          )}
          {isOpportunityWonStage(item.stage, item.stageType) &&
            item.generatedSalesOrderId &&
            item.generatedSalesOrderId !== 'converted' &&
            canViewSalesOrders && (
            <Link
              to={`/sales-orders/${item.generatedSalesOrderId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold no-underline text-emerald-800 hover:bg-emerald-100"
            >
              <OpenInNewIcon sx={{ fontSize: 15 }} />
              Open Sales Order
            </Link>
          )}
          {(item.acceptedQuotationId || item.generatedQuotationId) && (
            <Link
              to={`/quotations/${item.acceptedQuotationId || item.generatedQuotationId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold no-underline text-zinc-800 hover:bg-zinc-50"
            >
              <OpenInNewIcon sx={{ fontSize: 15 }} />
              {item.acceptedQuotationId ? 'Accepted quotation' : 'Latest quotation'}
            </Link>
          )}
          <Link
            to={`/quotations?opportunityId=${encodeURIComponent(item._id)}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold no-underline text-zinc-800 hover:bg-zinc-50"
          >
            Quotation history
          </Link>
          {canDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runDelete()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 cursor-pointer disabled:opacity-50"
            >
              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
              Delete
            </button>
          )}
        </div>
      </header>

      <div
        data-tour="opportunities-detail-kpis"
        className="grid grid-cols-2 md:grid-cols-3 gap-3"
      >
        {[
          { label: 'Estimated Deal Value', value: formatMoney(dealValue, item.currency) },
          { label: 'Probability', value: `${probability}%` },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-zinc-300 rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {card.label}
            </div>
            <div className="text-lg font-bold text-zinc-950 mt-1">{card.value}</div>
          </div>
        ))}
      </div>

      <div data-tour="opportunities-detail-sections" className="flex flex-col gap-5">
        {isOpportunityWonStage(item.stage, item.stageType) &&
          item.generatedSalesOrderId &&
          item.generatedSalesOrderId !== 'converted' &&
          canViewSalesOrders && (
            <section
              data-tour="opportunities-detail-sales-order"
              className="bg-white border border-emerald-200 rounded-xl p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-zinc-950 m-0 mb-1">Sales Order</h2>
                  <p className="text-xs text-zinc-500 m-0">
                    Linked by opportunityId · one Sales Order per opportunity
                  </p>
                </div>
                <Link
                  to={`/sales-orders/${item.generatedSalesOrderId}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold no-underline text-emerald-800 hover:bg-emerald-100"
                >
                  <OpenInNewIcon sx={{ fontSize: 15 }} />
                  Open Sales Order
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <InfoRow label="Sales Order Number">
                  <code className="font-mono text-xs font-semibold">
                    {item.generatedSalesOrderNo || item.generatedSalesOrderId}
                  </code>
                </InfoRow>
                <InfoRow label="Status">{item.generatedSalesOrderStatus || '—'}</InfoRow>
                <InfoRow label="Date">{formatDate(item.generatedSalesOrderDate)}</InfoRow>
                <InfoRow label="Amount">
                  {item.generatedSalesOrderAmount != null
                    ? formatMoney(
                        item.generatedSalesOrderAmount,
                        item.generatedSalesOrderCurrency || item.currency || settingsCurrency
                      )
                    : '—'}
                </InfoRow>
                <InfoRow label="Currency">
                  {item.generatedSalesOrderCurrency || item.currency || settingsCurrency}
                </InfoRow>
              </div>
              <p className="mt-3 mb-0 text-sm font-semibold text-zinc-800">
                {[
                  item.generatedSalesOrderNo || 'SO',
                  item.generatedSalesOrderStatus || null,
                  item.generatedSalesOrderAmount != null
                    ? formatMoney(
                        item.generatedSalesOrderAmount,
                        item.generatedSalesOrderCurrency || item.currency || settingsCurrency
                      )
                    : null,
                ]
                  .filter(Boolean)
                  .join(' | ')}
              </p>
            </section>
          )}

        <section
          data-tour="opportunities-detail-overview"
          className="bg-white border border-zinc-300 rounded-xl p-5"
        >
          <h2 className="text-sm font-bold text-zinc-950 m-0 mb-4">Deal overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoRow label="Opportunity number">
              <code className="font-mono text-xs">{item.opportunityNumber || '—'}</code>
            </InfoRow>
            <InfoRow label="Title">{item.title}</InfoRow>
            <InfoRow label="Stage">{stageMeta?.label || item.stage}</InfoRow>
            <InfoRow label="Client">
              {item.clientId ? (
                <Link
                  to={`/clients/${item.clientId}`}
                  className="font-semibold text-zinc-950 no-underline hover:underline"
                >
                  {item.clientName || 'View client'}
                </Link>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </InfoRow>
            <InfoRow label="Linked lead">
              {item.leadId ? (
                <Link
                  to={`/leads/${item.leadId}`}
                  className="font-semibold text-zinc-950 no-underline hover:underline"
                >
                  {item.leadName || item.clientName || 'Open lead'}
                </Link>
              ) : (
                '—'
              )}
            </InfoRow>
            <InfoRow label="Sales owner">
              {canAssignOwner ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-950"
                    value={assignOwnerId}
                    onChange={(e) => setAssignOwnerId(e.target.value)}
                    disabled={assigning || busy}
                    data-tour="opportunities-detail-assign-owner"
                  >
                    <option value="">Select sales representative…</option>
                    {salesRepOptions.length === 0 ? (
                      <option value="" disabled>
                        No assignable sales users found
                      </option>
                    ) : (
                      salesRepOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {formatAssignableUserLabel(u)}
                          {u.id === currentUserId ? ' (you)' : ''}
                        </option>
                      ))
                    )}
                    {assignOwnerId &&
                    !salesRepOptions.some((u) => u.id === assignOwnerId) ? (
                      <option value={assignOwnerId}>
                        {item.salesOwnerName || assignOwnerId} (current)
                      </option>
                    ) : null}
                  </select>
                  <button
                    type="button"
                    disabled={
                      assigning ||
                      busy ||
                      !assignOwnerId ||
                      assignOwnerId === String(item.salesOwner || '').trim()
                    }
                    onClick={() => void runAssignOwner()}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-zinc-950 px-3 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 hover:bg-zinc-800"
                    data-tour="opportunities-detail-assign-owner-save"
                  >
                    {assigning ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              ) : (
                item.salesOwnerName || item.salesOwner || '—'
              )}
            </InfoRow>
            <InfoRow label="Expected close">{formatDate(item.expectedCloseDate)}</InfoRow>
            <InfoRow label="Closed at">{formatDateTime(item.closedAt)}</InfoRow>
            <InfoRow label="Currency">{item.currency || settingsCurrency}</InfoRow>
            {item.source && <InfoRow label="Source">{item.source}</InfoRow>}
            {isOpportunityLostStage(item.stage) && (
              <InfoRow label="Lost reason">{item.lostReason || '—'}</InfoRow>
            )}
            {item.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <InfoRow label="Description">{item.description}</InfoRow>
              </div>
            )}
          </div>
        </section>

        <section
          data-tour="opportunities-detail-contact"
          className="bg-white border border-zinc-300 rounded-xl p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-sm font-bold text-zinc-950 m-0">Primary contact</h2>
            {canWrite && (
              <button
                type="button"
                onClick={() => setEditSection('contact')}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-[11px] font-semibold text-zinc-800 cursor-pointer hover:bg-zinc-50"
              >
                <EditOutlinedIcon sx={{ fontSize: 13 }} />
                Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoRow label="Contact person">{item.contactPerson || '—'}</InfoRow>
            <InfoRow label="Email">{item.contactEmail || '—'}</InfoRow>
            <InfoRow label="Mobile">{item.contactMobile || '—'}</InfoRow>
          </div>
        </section>

        <section
          data-tour="opportunities-detail-products"
          className="bg-white border border-zinc-300 rounded-xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-zinc-200 flex items-start justify-between gap-3">
            <div>
            <h2 className="text-sm font-bold text-zinc-950 m-0">
              Proposed Products &amp; Line Items
            </h2>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              {products.length} line{products.length === 1 ? '' : 's'} · Subtotal{' '}
              {formatMoney(financials.subtotal, item.currency)} · Tax{' '}
              {formatMoney(financials.taxTotal, item.currency)}
            </p>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => setEditSection('products')}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-[11px] font-semibold text-zinc-800 cursor-pointer hover:bg-zinc-50"
              >
                <EditOutlinedIcon sx={{ fontSize: 13 }} />
                Edit
              </button>
            )}
          </div>
          {products.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">No proposed products on this deal.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    {['#', 'Product / Service', 'Qty', 'Unit price', 'Tax %', 'Amount'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((line, index) => {
                    const base = Number(line.quantity || 0) * Number(line.unitPrice || 0);
                    const amount =
                      line.amount != null
                        ? Number(line.amount)
                        : base + (base * Number(line.tax || 0)) / 100;
                    return (
                      <tr key={`${line.productName}-${index}`} className="border-b border-zinc-100">
                        <td className="px-4 py-3 text-xs text-zinc-500">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-950">
                          <div>{line.productName || '—'}</div>
                          {line.description && (
                            <div className="text-xs text-zinc-500 font-normal mt-0.5">{line.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700">{line.quantity}</td>
                        <td className="px-4 py-3 text-xs text-zinc-700">
                          {formatMoney(line.unitPrice, item.currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700">{line.tax ?? 0}%</td>
                        <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                          {formatMoney(amount, item.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          data-tour="opportunities-detail-shipping"
          className="bg-white border border-zinc-300 rounded-xl p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-sm font-bold text-zinc-950 m-0">Shipping &amp; financials</h2>
            {canWrite && (
              <button
                type="button"
                onClick={() => setEditSection('financials')}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-[11px] font-semibold text-zinc-800 cursor-pointer hover:bg-zinc-50"
              >
                <EditOutlinedIcon sx={{ fontSize: 13 }} />
                Edit currency &amp; charges
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoRow label="Destination state">{item.shippingState || '—'}</InfoRow>
            <InfoRow label="Products subtotal">
              {formatMoney(financials.subtotal, item.currency)}
            </InfoRow>
            <InfoRow label="Estimated GST">
              {formatMoney(financials.taxTotal, item.currency)}
            </InfoRow>
            <InfoRow label="Estimated Deal Value">{formatMoney(dealValue, item.currency)}</InfoRow>
          </div>
        </section>

        <section
          data-tour="opportunities-detail-conversions"
          className="bg-white border border-zinc-300 rounded-xl p-5"
        >
          <h2 className="text-sm font-bold text-zinc-950 m-0 mb-4">Generated documents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Latest quotation">
              {item.generatedQuotationId ? (
                <Link
                  to={`/quotations/${item.generatedQuotationId}`}
                  className="font-semibold text-zinc-950 no-underline hover:underline"
                >
                  {item.generatedQuotationNo || 'Open quotation'}
                </Link>
              ) : (
                'Not generated'
              )}
            </InfoRow>
            <InfoRow label="Accepted quotation">
              {item.acceptedQuotationId ? (
                <Link
                  to={`/quotations/${item.acceptedQuotationId}`}
                  className="font-semibold text-zinc-950 no-underline hover:underline"
                >
                  {item.acceptedQuotationNo || 'Open accepted quotation'}
                </Link>
              ) : (
                'None yet — more quotes allowed'
              )}
            </InfoRow>
            <InfoRow label="Sales order">
              {item.generatedSalesOrderId && item.generatedSalesOrderId !== 'converted' ? (
                canViewSalesOrders ? (
                  <Link
                    to={`/sales-orders/${item.generatedSalesOrderId}`}
                    className="font-semibold text-zinc-950 no-underline hover:underline"
                  >
                    {item.generatedSalesOrderNo || 'Open Sales Order'}
                  </Link>
                ) : (
                  item.generatedSalesOrderNo || 'Linked'
                )
              ) : isOpportunityWonStage(item.stage, item.stageType) && canCreateSalesOrders ? (
                'Not created yet — use Create Sales Order'
              ) : (
                'Not generated'
              )}
            </InfoRow>
            <InfoRow label="Created">{formatDateTime(item.createdAt)}</InfoRow>
            <InfoRow label="Updated">{formatDateTime(item.updatedAt)}</InfoRow>
          </div>
        </section>
      </div>

      {editSection && item ? (
        <OpportunityEditModal
          item={item}
          section={editSection}
          fallbackCurrency={settingsCurrency}
          showToast={(message, kind) => {
            if (kind === 'error') setError(message);
            else setInfo(message);
          }}
          onClose={() => setEditSection(null)}
          onSaved={(updated) => {
            setItem(updated);
            setEditSection(null);
            setError('');
            setInfo(
              updated.contactSynced
                ? 'Opportunity updated and the contact record was synced'
                : 'Opportunity updated'
            );
          }}
        />
      ) : null}
    </div>
  );
};
