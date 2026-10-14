import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
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
} from '../../types/opportunities';
import { useOpportunityStages } from '../../hooks/useOpportunityStages';
import {
  canAssignOpportunityOwner,
  formatAssignableUserLabel,
  isAssignableSalesRepresentative,
} from '../../utils/permissions';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
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
  const { alert, confirm } = useDialog();

  const canWrite =
    (hasPermission('crm.opportunities.write') || hasPermission('crm.leads.write')) && !isClient;
  const canDelete = hasPermission('crm.opportunities.delete') && !isClient;
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

  const runConvertSalesOrder = async () => {
    if (!item) return;
    if (item.generatedSalesOrderId) {
      await alert({
        title: 'Opportunity Converted',
        message: 'This opportunity converted',
      });
      return;
    }
    if (!(await confirm(`Generate sales order from "${item.title}"?`))) return;
    setBusy(true);
    setInfo('');
    try {
      const res = await crmApi.convertOpportunityToSalesOrder(item._id);
      await load();
      await alert({
        title: 'Opportunity Converted',
        message: 'This opportunity converted',
      });
      setInfo('This opportunity converted');
      const salesOrderId =
        (res.data as { salesOrderId?: string })?.salesOrderId ||
        (res.data as { _id?: string })?._id;
      if (salesOrderId) {
        navigate(`/sales-orders/${salesOrderId}`);
      }
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : 'Sales order conversion failed';
      if (msg.toLowerCase().includes('converted')) {
        await load();
        await alert({
          title: 'Opportunity Converted',
          message: 'This opportunity converted',
        });
        setInfo('This opportunity converted');
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

  const dealValue = item.expectedRevenue ?? item.value ?? financials.expectedRevenue;
  const weighted = item.weightedRevenue ?? financials.weightedRevenue;

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

      {item.generatedSalesOrderId && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">
          <span>✓ This opportunity converted</span>
          <span className="text-emerald-400">·</span>
          <span>Sales Order generated</span>
          <Link
            to={`/sales-orders/${item.generatedSalesOrderId}`}
            className="text-emerald-900 underline font-bold ml-auto no-underline hover:underline"
          >
            {item.generatedSalesOrderNo ? `View ${item.generatedSalesOrderNo}` : 'View Sales Order'} &rarr;
          </Link>
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
          {canRequestSample && (
            <Link
              to={`/samples/create?opportunityId=${encodeURIComponent(item._id)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold no-underline text-zinc-800 hover:bg-zinc-50"
              data-tour="opportunities-detail-request-sample"
            >
              Request Sample
            </Link>
          )}
          {canWrite && canCreateOpportunityQuotation(item) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runConvertQuotation()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50 hover:bg-zinc-50"
            >
              <RequestQuoteOutlinedIcon sx={{ fontSize: 15 }} />
              Create Quotation
            </button>
          )}
          {canWrite && isOpportunityWonStage(item.stage) && !item.generatedSalesOrderId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runConvertSalesOrder()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50 hover:bg-zinc-50"
            >
              <ShoppingCartOutlinedIcon sx={{ fontSize: 15 }} />
              Sales Order
            </button>
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
          {item.generatedSalesOrderId && (
            <Link
              to={`/sales-orders/${item.generatedSalesOrderId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold no-underline text-zinc-800 hover:bg-zinc-50"
            >
              <OpenInNewIcon sx={{ fontSize: 15 }} />
              Open sales order
            </Link>
          )}
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
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { label: 'Deal value', value: formatMoney(dealValue, item.currency) },
          { label: 'Weighted forecast', value: formatMoney(weighted, item.currency) },
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
          <h2 className="text-sm font-bold text-zinc-950 m-0 mb-4">Primary contact</h2>
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
          <div className="px-5 py-4 border-b border-zinc-200">
            <h2 className="text-sm font-bold text-zinc-950 m-0">
              Proposed Products &amp; Line Items
            </h2>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              {products.length} line{products.length === 1 ? '' : 's'} · Subtotal{' '}
              {formatMoney(financials.subtotal, item.currency)} · Tax{' '}
              {formatMoney(financials.taxTotal, item.currency)}
            </p>
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
          <h2 className="text-sm font-bold text-zinc-950 m-0 mb-4">Shipping &amp; financials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoRow label="Destination state">{item.shippingState || '—'}</InfoRow>
            <InfoRow label="Products subtotal">
              {formatMoney(financials.subtotal, item.currency)}
            </InfoRow>
            <InfoRow label="Estimated GST">
              {formatMoney(financials.taxTotal, item.currency)}
            </InfoRow>
            <InfoRow label="Total deal value">{formatMoney(dealValue, item.currency)}</InfoRow>
            <InfoRow label="Weighted forecast">{formatMoney(weighted, item.currency)}</InfoRow>
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
              {item.generatedSalesOrderId ? (
                <Link
                  to={`/sales-orders/${item.generatedSalesOrderId}`}
                  className="font-semibold text-zinc-950 no-underline hover:underline"
                >
                  {item.generatedSalesOrderNo || 'Open sales order'}
                </Link>
              ) : (
                'Not generated'
              )}
            </InfoRow>
            <InfoRow label="Created">{formatDateTime(item.createdAt)}</InfoRow>
            <InfoRow label="Updated">{formatDateTime(item.updatedAt)}</InfoRow>
          </div>
        </section>
      </div>
    </div>
  );
};
