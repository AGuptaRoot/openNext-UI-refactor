import { displayLabel } from '../../utils/displayLabels';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import {
  financeFieldClass,
  financeTextAreaClass,
} from '../../components/finance/FinanceFormElements';
import {
  REFUND_MODES,
  type PaymentItem,
  type PaymentRefund,
} from '../../types/payments';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Completed: 'bg-emerald-50 text-emerald-800',
    Pending: 'bg-amber-50 text-amber-800',
    'Partially Refunded': 'bg-orange-50 text-orange-800',
    Refunded: 'bg-stone-100 text-stone-700',
    'Pending Approval': 'bg-amber-50 text-amber-800',
    Approved: 'bg-emerald-50 text-emerald-800',
    Rejected: 'bg-red-50 text-red-800',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

export const PaymentDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { hasPermission, isClient } = useAuth();
  const canWriteFinance = hasPermission('crm.finance.write') && !isClient;
  const [payment, setPayment] = useState<PaymentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMode, setRefundMode] = useState('Bank Transfer');
  const [refundTxn, setRefundTxn] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [rejectOpen, setRejectOpen] = useState<PaymentRefund | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await crmApi.getPayment(id);
      setPayment(response.data);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load payment');
      setPayment(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const maxRefundable = useMemo(() => {
    if (!payment) return 0;
    return Math.max(0, Number(payment.amount || 0) - Number(payment.refundedAmount || 0));
  }, [payment]);

  const requestRefund = async () => {
    if (!canWriteFinance || !payment) return;
    const amount = Number(refundAmount);
    if (!(amount > 0) || amount > maxRefundable + 0.0001) {
      setError('Enter a valid refund amount within refundable balance.');
      return;
    }
    if (!refundReason.trim()) {
      setError('Refund reason is required.');
      return;
    }
    setBusy(true);
    try {
      await crmApi.requestPaymentRefund(payment._id, {
        amount,
        mode: refundMode,
        transactionId: refundTxn || undefined,
        reason: refundReason.trim(),
        autoApprove,
      });
      setRefundOpen(false);
      setRefundAmount('');
      setRefundReason('');
      setRefundTxn('');
      setAutoApprove(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Refund request failed');
    } finally {
      setBusy(false);
    }
  };

  const approve = async (refundId: string) => {
    if (!canWriteFinance) return;
    setBusy(true);
    try {
      await crmApi.approvePaymentRefund(id, refundId);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!canWriteFinance || !rejectOpen) return;
    if (!rejectReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setBusy(true);
    try {
      await crmApi.rejectPaymentRefund(id, rejectOpen._id, { reason: rejectReason.trim() });
      setRejectOpen(null);
      setRejectReason('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-sm text-zinc-500">Loading payment…</div>;
  if (!payment) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-zinc-500 mb-4">{error || 'Payment not found.'}</p>
        <Link to="/payments" className="text-sm font-semibold text-zinc-950">← Back to payments</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <Link to="/payments" className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950">← Payments</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold m-0">{displayLabel(payment.paymentNumber, payment.paymentNo)}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(String(payment.status))}`}>
              {payment.status}
            </span>
          </div>
          <p className="text-sm text-zinc-500 m-0 mt-1">{displayLabel(payment.clientName)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWriteFinance && maxRefundable > 0 && !['Refunded', 'Cancelled'].includes(String(payment.status)) && (
            <button
              type="button"
              onClick={() => {
                setRefundOpen(true);
                setRefundAmount(String(maxRefundable));
              }}
              className="h-9 px-3 text-xs font-semibold rounded-lg border border-amber-200 bg-amber-50 text-amber-900 cursor-pointer"
            >
              Refund
            </button>
          )}
          {(payment.receiptUrl || payment.receipt) && (
            <a
              href={payment.receiptUrl || payment.receipt}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3 inline-flex items-center text-xs font-semibold rounded-lg border border-zinc-300 bg-white no-underline text-zinc-800"
            >
              View receipt
            </a>
          )}
        </div>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Amount', value: formatFinanceMoney(payment.amount, payment.currency) },
          { label: 'Refunded', value: formatFinanceMoney(payment.refundedAmount || 0, payment.currency) },
          { label: 'Refundable', value: formatFinanceMoney(maxRefundable, payment.currency) },
          { label: 'Date', value: payment.paymentDate },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase text-zinc-500">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-300 bg-white p-5">
        <h2 className="text-sm font-semibold m-0 mb-3">Payment details</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm m-0">
          <div>
            <dt className="text-[11px] uppercase text-zinc-500">Mode</dt>
            <dd className="m-0 font-medium">
              {payment.displayMode || payment.paymentGateway || payment.mode || 'Razorpay'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-zinc-500">Invoice #</dt>
            <dd className="m-0 font-medium">
              {payment.invoiceId ? (
                <Link to={`/invoices/${payment.invoiceId}`} className="text-sky-800 no-underline hover:underline">
                  {displayLabel(payment.invoiceNo, payment.invoiceNumber)}
                </Link>
              ) : (
                displayLabel(payment.invoiceNo, payment.invoiceNumber)
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-zinc-500">Sales Order #</dt>
            <dd className="m-0 font-medium">{displayLabel(payment.salesOrderNo)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-zinc-500">Transaction ID</dt>
            <dd className="m-0 font-medium">{payment.transactionId || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-zinc-500">Exchange rate</dt>
            <dd className="m-0 font-medium">{payment.exchangeRate}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] uppercase text-zinc-500">Remark</dt>
            <dd className="m-0 whitespace-pre-wrap">{payment.remark || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 text-sm font-semibold">Allocations</div>
        {(payment.allocations || []).length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">
            {displayLabel(payment.invoiceNo, payment.invoiceNumber) !== '—'
              ? `Allocated to ${displayLabel(payment.invoiceNo, payment.invoiceNumber)}${
                  payment.salesOrderNo ? ` · SO ${payment.salesOrderNo}` : ''
                }`
              : 'No invoice allocation recorded.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left">Invoice</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations!.map((alloc) => (
                <tr key={`${alloc.invoiceId}-${alloc.amount}`} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${alloc.invoiceId}`} className="font-semibold no-underline hover:underline text-zinc-950">
                      {displayLabel(alloc.invoiceNumber)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatFinanceMoney(alloc.amount, payment.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 text-sm font-semibold">Refund history</div>
        {(payment.refunds || []).length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">No refunds requested.</div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-left">Mode</th>
                <th className="px-4 py-2 text-left">Reason</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(payment.refunds || []).map((refund) => (
                <tr key={refund._id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-semibold">{formatFinanceMoney(refund.amount, payment.currency)}</td>
                  <td className="px-4 py-3">{refund.mode}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{refund.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(String(refund.status))}`}>
                      {refund.status}
                    </span>
                    {refund.rejectionReason && (
                      <div className="text-[11px] text-red-600 mt-1">{refund.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWriteFinance && refund.status === 'Pending Approval' ? (
                      <div className="flex gap-1">
                        <button type="button" disabled={busy} onClick={() => approve(refund._id)} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 cursor-pointer disabled:opacity-50">Approve</button>
                        <button type="button" disabled={busy} onClick={() => { setRejectOpen(refund); setRejectReason(''); }} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-red-200 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50">Reject</button>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canWriteFinance && refundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="m-0 text-lg font-bold">Request refund</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-zinc-50 p-2">Paid<br /><strong>{formatFinanceMoney(payment.amount, payment.currency)}</strong></div>
              <div className="rounded-lg bg-zinc-50 p-2">Refundable<br /><strong>{formatFinanceMoney(maxRefundable, payment.currency)}</strong></div>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Refund amount
                <input className={financeFieldClass} type="number" min="0.01" max={maxRefundable} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Refund mode
                <select className={financeFieldClass} value={refundMode} onChange={(e) => setRefundMode(e.target.value)}>
                  {REFUND_MODES.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Transaction reference
                <input className={financeFieldClass} maxLength={150} value={refundTxn} onChange={(e) => setRefundTxn(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Reason
                <textarea className={financeTextAreaClass} rows={3} maxLength={1000} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
                Auto-approve (admin / finance)
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRefundOpen(false)} className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer">Cancel</button>
              <button type="button" disabled={busy} onClick={requestRefund} className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50">Submit</button>
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
              <button type="button" disabled={busy} onClick={reject} className="h-9 px-3 text-xs font-semibold rounded-lg border border-red-700 bg-red-700 text-white cursor-pointer disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
