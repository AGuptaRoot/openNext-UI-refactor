import { displayLabel } from '../../utils/displayLabels';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import {
  financeFieldClass,
  financeTextAreaClass,
} from '../../components/finance/FinanceFormElements';
import {
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  REFUND_MODES,
  type PaymentItem,
  type RefundListItem,
} from '../../types/payments';
import { triggerFileDownload } from '../../utils/fileDownload';
import { CrmFeatures } from '../../utils/featureFlags';

type TabMode = 'payments' | 'refunds';

function paymentInvoiceLabel(item: PaymentItem): string {
  const invoiceNo = String(item.invoiceNo || item.invoiceNumber || '').trim();
  if (invoiceNo) return invoiceNo;
  const fromAlloc = (item.allocations || [])
    .map((row) => String(row.invoiceNumber || '').trim())
    .filter(Boolean);
  if (fromAlloc.length === 1) return fromAlloc[0];
  if (fromAlloc.length > 1) return `${fromAlloc.length} invoices`;
  return '';
}

function paymentModeLabel(item: PaymentItem): string {
  return String(item.displayMode || item.paymentGateway || item.mode || 'Razorpay');
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Completed: 'bg-emerald-50 text-emerald-800',
    Pending: 'bg-amber-50 text-amber-800',
    'Partially Refunded': 'bg-orange-50 text-orange-800',
    Refunded: 'bg-stone-100 text-stone-700',
    Disputed: 'bg-rose-50 text-rose-800',
    Failed: 'bg-red-50 text-red-800',
    Cancelled: 'bg-zinc-100 text-zinc-600',
    'Pending Approval': 'bg-amber-50 text-amber-800',
    Approved: 'bg-emerald-50 text-emerald-800',
    Rejected: 'bg-red-50 text-red-800',
    Processed: 'bg-sky-50 text-sky-800',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

function refundableAmount(item: PaymentItem): number {
  return Math.max(0, Number(item.amount || 0) - Number(item.refundedAmount || 0));
}

function canRefundPayment(item: PaymentItem): boolean {
  const status = String(item.status || '');
  if (['Refunded', 'Cancelled', 'Failed'].includes(status)) return false;
  return refundableAmount(item) > 0;
}

export const PaymentsPage: React.FC = () => {
  const { hasPermission, isClient } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWriteFinance = hasPermission('crm.finance.write') && !isClient;
  const canRecordManualPayment = canWriteFinance && CrmFeatures.isManualPaymentEnabled();
  const [tab, setTab] = useState<TabMode>('payments');
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [refunds, setRefunds] = useState<RefundListItem[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [method, setMethod] = useState(
    () => searchParams.get('method') || searchParams.get('mode') || ''
  );
  const [clientId, setClientId] = useState(() => searchParams.get('clientId') || '');
  const [refundStatus, setRefundStatus] = useState('Pending Approval');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [refundItem, setRefundItem] = useState<PaymentItem | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMode, setRefundMode] = useState('Bank Transfer');
  const [refundTxn, setRefundTxn] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [rejectOpen, setRejectOpen] = useState<{ paymentId: string; refundId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = searchParams.get('status') || '';
    const nextMethod = searchParams.get('method') || searchParams.get('mode') || '';
    const nextClientId = searchParams.get('clientId') || '';
    setStatus((prev) => (prev === next ? prev : next));
    setMethod((prev) => (prev === nextMethod ? prev : nextMethod));
    setClientId((prev) => (prev === nextClientId ? prev : nextClientId));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (status) params.set('status', status);
    else params.delete('status');
    if (method) {
      params.set('method', method);
      params.delete('mode');
    } else {
      params.delete('method');
      params.delete('mode');
    }
    if (clientId) params.set('clientId', clientId);
    else params.delete('clientId');
    setSearchParams(params, { replace: true });
  }, [status, method, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listPayments({
        search: search || undefined,
        status: status || undefined,
        mode: method || undefined,
        clientId: clientId || undefined,
        page,
        limit: 20,
      });
      setItems(response.data || []);
      setPagination(response.pagination || null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [search, status, method, clientId, page]);

  const loadRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listPaymentRefunds({
        search: search || undefined,
        status: refundStatus || undefined,
      });
      setRefunds(response.data || []);
      setPagination(null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [search, refundStatus]);

  useEffect(() => {
    setPage(1);
  }, [search, status, method, clientId]);

  useEffect(() => {
    if (!canWriteFinance && tab !== 'payments') setTab('payments');
  }, [canWriteFinance, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === 'payments') loadPayments();
      else loadRefunds();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [tab, loadPayments, loadRefunds]);

  const pendingRefundCount = useMemo(
    () =>
      tab === 'refunds'
        ? refunds.filter((item) => item.status === 'Pending Approval').length
        : items.reduce(
            (count, item) =>
              count + (item.refunds || []).filter((refund) => refund.status === 'Pending Approval').length,
            0
          ),
    [tab, refunds, items]
  );

  const kpis = useMemo(() => {
    const completed = items.filter((item) => item.status === 'Completed' || item.status === 'Partially Refunded');
    const total = completed.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const refunded = items.reduce((sum, item) => sum + Number(item.refundedAmount || 0), 0);
    return {
      count: items.length,
      total,
      refunded,
      pending: pendingRefundCount,
    };
  }, [items, pendingRefundCount]);

  const openRefund = (item: PaymentItem) => {
    if (!canWriteFinance) return;
    const max = refundableAmount(item);
    setRefundItem(item);
    setRefundAmount(String(max));
    setRefundMode('Original Payment Method');
    setRefundTxn('');
    setRefundReason('');
    setAutoApprove(false);
    setError('');
  };

  const closeRefund = () => {
    setRefundItem(null);
    setRefundAmount('');
    setRefundReason('');
    setRefundTxn('');
    setAutoApprove(false);
  };

  const submitRefund = async () => {
    if (!canWriteFinance || !refundItem) return;
    const max = refundableAmount(refundItem);
    const amount = Number(refundAmount);
    if (!(amount > 0) || amount > max + 0.0001) {
      setError('Enter a valid refund amount within refundable balance.');
      return;
    }
    if (!refundReason.trim()) {
      setError('Refund reason is required.');
      return;
    }
    setBusyId(refundItem._id);
    try {
      await crmApi.requestPaymentRefund(refundItem._id, {
        amount,
        mode: refundMode,
        transactionId: refundTxn || undefined,
        reason: refundReason.trim(),
        autoApprove,
      });
      closeRefund();
      await loadPayments();
      await loadRefunds();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Refund request failed');
    } finally {
      setBusyId('');
    }
  };

  useEffect(() => {
    if (!exportOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [exportOpen]);

  const exportData = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    try {
      const response = await crmApi.exportPayments({
        search: search || undefined,
        status: status || undefined,
        mode: method || undefined,
        clientId: clientId || undefined,
        format,
      });
      triggerFileDownload({
        filename: response.data.filename,
        content: response.data.content,
        format,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    }
  };

  const approveRefund = async (paymentId: string, refundId: string) => {
    if (!canWriteFinance) return;
    setBusyId(refundId);
    try {
      await crmApi.approvePaymentRefund(paymentId, refundId);
      await loadRefunds();
      await loadPayments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Approve failed');
    } finally {
      setBusyId('');
    }
  };

  const rejectRefund = async () => {
    if (!canWriteFinance || !rejectOpen) return;
    if (!rejectReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setBusyId(rejectOpen.refundId);
    try {
      await crmApi.rejectPaymentRefund(rejectOpen.paymentId, rejectOpen.refundId, {
        reason: rejectReason.trim(),
      });
      setRejectOpen(null);
      setRejectReason('');
      await loadRefunds();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reject failed');
    } finally {
      setBusyId('');
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRefund();
        setRejectOpen(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const maxRefundable = refundItem ? refundableAmount(refundItem) : 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">Collections</p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0">Payments & Receipts</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {canRecordManualPayment
              ? 'Record remittances, allocate across invoices, reconcile receipts, and manage refunds.'
              : 'View Razorpay payments recorded against invoices after send. Manual payment entry is disabled.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRecordManualPayment && (
            <Link
              to="/payments/create"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white no-underline hover:bg-zinc-800"
            >
              Record payment
            </Link>
          )}
          <button type="button" onClick={() => (tab === 'payments' ? loadPayments() : loadRefunds())} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer">
            <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
          </button>
          <div className="relative" ref={exportRef} data-tour="payments-export-btn">
            <button
              type="button"
              onClick={() => setExportOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
            >
              <DownloadIcon sx={{ fontSize: 15 }} /> Export
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => void exportData('csv')}
                  className="w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => void exportData('json')}
                  className="w-full cursor-pointer border-0 border-t border-zinc-100 bg-transparent px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {canWriteFinance && (
        <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 self-start">
          <button
            type="button"
            onClick={() => setTab('payments')}
            className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer ${
              tab === 'payments' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
            }`}
          >
            Payments
          </button>
          <button
            type="button"
            onClick={() => setTab('refunds')}
            className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer ${
              tab === 'refunds' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
            }`}
          >
            Refund Requests
            {pendingRefundCount > 0 && (
              <span className="ml-2 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-amber-500 text-[10px] text-white px-1">
                {pendingRefundCount}
              </span>
            )}
          </button>
        </div>
      )}

      {tab === 'payments' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Receipts', value: String(kpis.count) },
            { label: 'Collected', value: formatFinanceMoney(kpis.total) },
            { label: 'Refunded', value: formatFinanceMoney(kpis.refunded) },
            { label: 'Pending refunds', value: String(kpis.pending) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase text-zinc-500">{card.label}</div>
              <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-zinc-300 rounded-xl p-4 flex flex-col lg:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === 'payments' ? 'Search payment # or client (e.g. Pay-0011, AR)…' : 'Search refund reason, payment, client…'}
          className="h-9 flex-1 px-3 text-sm border border-zinc-200 rounded-lg"
        />
        {tab === 'payments' ? (
          <>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 px-3 text-sm border border-zinc-300 rounded-lg bg-white lg:w-44">
              <option value="">All statuses</option>
              {PAYMENT_STATUSES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-9 px-3 text-sm border border-zinc-300 rounded-lg bg-white lg:w-44"
            >
              <option value="">All methods</option>
              {PAYMENT_MODES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
              {method && !(PAYMENT_MODES as readonly string[]).includes(method) ? (
                <option value={method}>{method}</option>
              ) : null}
            </select>
            {clientId ? (
              <button
                type="button"
                className="h-9 px-3 text-xs font-semibold border border-zinc-300 rounded-lg bg-zinc-50 text-zinc-800 cursor-pointer"
                onClick={() => setClientId('')}
                title={`Client filter: ${clientId}`}
              >
                Clear client
              </button>
            ) : null}
          </>
        ) : (
          <select value={refundStatus} onChange={(e) => setRefundStatus(e.target.value)} className="h-9 px-3 text-sm border border-zinc-300 rounded-lg bg-white lg:w-52">
            <option value="">All refund statuses</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Processed">Processed</option>
          </select>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading…</div>
        ) : tab === 'payments' ? (
          items.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              <p className="m-0 mb-3">
                {canRecordManualPayment
                  ? 'No payments found.'
                  : 'No Razorpay payments yet. Clients pay from the invoice after it is sent.'}
              </p>
              {canRecordManualPayment && (
                <Link
                  to="/payments/create"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white no-underline"
                >
                  Record payment
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Sales Order #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <Link to={`/payments/${item._id}`} className="font-semibold text-zinc-950 no-underline hover:underline">
                          {displayLabel(item.paymentNumber, item.paymentNo, item.receiptNumber)}
                        </Link>
                        {item.transactionId && (
                          <div className="text-[11px] text-zinc-500">{item.transactionId}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{displayLabel(item.clientName)}</td>
                      <td className="px-4 py-3">
                        {item.invoiceId && paymentInvoiceLabel(item) ? (
                          <Link
                            to={`/invoices/${item.invoiceId}`}
                            className="font-semibold text-sky-800 no-underline hover:underline"
                          >
                            {paymentInvoiceLabel(item)}
                          </Link>
                        ) : (
                          displayLabel(paymentInvoiceLabel(item))
                        )}
                      </td>
                      <td className="px-4 py-3">{displayLabel(item.salesOrderNo)}</td>
                      <td className="px-4 py-3">{item.paymentDate ? new Date(item.paymentDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                          {paymentModeLabel(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatFinanceMoney(item.amount, item.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canWriteFinance && canRefundPayment(item) ? (
                          <button
                            type="button"
                            disabled={busyId === item._id}
                            onClick={() => openRefund(item)}
                            className="h-7 px-2.5 text-[11px] font-semibold rounded-md border border-amber-200 bg-amber-50 text-amber-900 cursor-pointer disabled:opacity-50"
                          >
                            Refund
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : refunds.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">No refund requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <Link to={`/payments/${item.paymentId}`} className="font-semibold no-underline hover:underline text-zinc-950">
                        {displayLabel(item.paymentNumber)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{displayLabel(item.clientName)}</td>
                    <td className="px-4 py-3 font-semibold">{formatFinanceMoney(item.amount, item.currency)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 max-w-xs">{item.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(String(item.status))}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canWriteFinance && item.status === 'Pending Approval' ? (
                        <div className="flex gap-1">
                          <button type="button" disabled={busyId === item._id} onClick={() => approveRefund(item.paymentId, item._id)} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 cursor-pointer disabled:opacity-50">
                            Approve
                          </button>
                          <button type="button" disabled={busyId === item._id} onClick={() => { setRejectOpen({ paymentId: item.paymentId, refundId: item._id }); setRejectReason(''); }} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-red-200 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50">
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'payments' && (
          <ListPager pagination={pagination} onPageChange={setPage} label="payments" />
        )}
      </div>

      {refundItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeRefund}>
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="m-0 text-lg font-bold">Request refund</h3>
            <p className="mt-1 mb-3 text-xs text-zinc-500">
              {displayLabel(refundItem.paymentNumber, refundItem.paymentNo)}
            </p>
            <div className="rounded-lg bg-zinc-50 p-2 text-xs mb-3">
              Refundable{' '}
              <strong>{formatFinanceMoney(maxRefundable, refundItem.currency)}</strong>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Refund amount
                <input
                  className={financeFieldClass}
                  type="number"
                  min="0.01"
                  max={maxRefundable}
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Refund mode
                <select className={financeFieldClass} value={refundMode} onChange={(e) => setRefundMode(e.target.value)}>
                  {REFUND_MODES.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Transaction ID
                <input className={financeFieldClass} maxLength={150} value={refundTxn} onChange={(e) => setRefundTxn(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Reason
                <textarea className={financeTextAreaClass} rows={3} maxLength={1000} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
                <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
                Auto-approve refund
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeRefund} className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === refundItem._id}
                onClick={submitRefund}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="m-0 text-lg font-bold">Reject refund</h3>
            <textarea className={`${financeTextAreaClass} mt-3`} rows={4} maxLength={1000} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Mandatory rejection reason" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejectOpen(null)} className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer">Cancel</button>
              <button type="button" disabled={busyId === rejectOpen.refundId} onClick={rejectRefund} className="h-9 px-3 text-xs font-semibold rounded-lg border border-red-700 bg-red-700 text-white cursor-pointer disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
