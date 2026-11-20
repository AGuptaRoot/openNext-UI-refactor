import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, crmApi } from '../../services/api';
import { REFUND_MODES, type PaymentItem } from '../../types/payments';
import { formatFriendlyDateTime } from '../../utils/dateFormat';

/**
 * Refund a payment from the invoice page (CRM 3.54.0). Same API and approval rules as the Payments page
 * (POST /payments/:id/refunds, approve / reject), so it also works when the active extension hides the
 * Payments module (e.g. Travel). Shows the payment's refunds; pending ones can be approved or rejected.
 * A processed cash refund appears in the Cash Book by itself.
 */

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1 block text-xs font-semibold text-zinc-700';
const btn = 'h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 disabled:opacity-50';
const primary = 'h-9 cursor-pointer rounded-lg border-none bg-zinc-900 px-3 text-xs font-semibold text-white disabled:opacity-50';

const errText = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message : fallback);
const money = (n: number, currency: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

interface Props {
  paymentId: string;
  invoiceNo: string;
  currency: string;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export const RefundPaymentDialog: React.FC<Props> = ({ paymentId, invoiceNo, currency, canWrite, onClose, onChanged }) => {
  const [payment, setPayment] = useState<PaymentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<string>('Bank Transfer');
  const [txn, setTxn] = useState('');
  const [reason, setReason] = useState('');
  const [approveNow, setApproveNow] = useState(false);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPayment((await crmApi.getPayment(paymentId)).data);
      setError('');
    } catch (err) {
      setError(errText(err, 'Could not load the payment'));
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refundable = useMemo(
    () => (payment ? Math.max(0, Number(payment.amount || 0) - Number(payment.refundedAmount || 0)) : 0),
    [payment]
  );
  const pending = (payment?.refunds || []).filter((r) => r.status === 'Pending Approval');
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount || 0), 0);
  const free = Math.max(0, Math.round((refundable - pendingTotal) * 100) / 100);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      onChanged();
      return true;
    } catch (err) {
      setError(errText(err, 'That did not work'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const value = Number(amount);
    if (!(value > 0) || value > free + 0.0001) {
      setError(`Enter an amount between 0 and ${money(free, currency)}.`);
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required (e.g. trip cancelled).');
      return;
    }
    const ok = await run(() =>
      crmApi.requestPaymentRefund(paymentId, {
        amount: value,
        mode,
        transactionId: txn.trim() || undefined,
        reason: reason.trim(),
        autoApprove: approveNow,
      })
    );
    if (ok) {
      setAmount('');
      setTxn('');
      setReason('');
      setApproveNow(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Refund payment">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="m-0 text-base font-bold text-zinc-950">Refund payment</h2>
            <p className="m-0 mt-0.5 text-xs text-zinc-500">
              Invoice {invoiceNo}
              {payment ? ` · ${payment.mode || 'Payment'} of ${money(payment.amount, currency)} on ${formatFriendlyDateTime(payment.paymentDate)}` : ''}
            </p>
          </div>
          <button type="button" className={btn} onClick={onClose} disabled={busy}>Close</button>
        </div>

        {loading && !payment ? <p className="m-0 text-sm text-zinc-500">Loading…</p> : null}
        {error ? <p className="m-0 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">{error}</p> : null}

        {payment ? (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-zinc-50 p-2"><div className="text-zinc-500">Paid</div><div className="font-bold">{money(payment.amount, currency)}</div></div>
              <div className="rounded-lg bg-zinc-50 p-2"><div className="text-zinc-500">Refunded</div><div className="font-bold">{money(payment.refundedAmount || 0, currency)}</div></div>
              <div className="rounded-lg bg-zinc-50 p-2"><div className="text-zinc-500">Can refund</div><div className="font-bold">{money(free, currency)}</div></div>
            </div>

            {(payment.refunds || []).length ? (
              <div className="mb-4">
                <p className="m-0 mb-1 text-xs font-semibold text-zinc-700">Refunds of this payment</p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {(payment.refunds || []).map((r) => (
                    <li key={r._id} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{money(r.amount, currency)} · {r.mode}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.status === 'Pending Approval' ? 'bg-amber-50 text-amber-800' : r.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{r.status}</span>
                      </div>
                      <div className="mt-0.5 text-zinc-500">{r.reason}</div>
                      {canWrite && r.status === 'Pending Approval' ? (
                        rejecting && rejecting.id === r._id ? (
                          <div className="mt-2 flex gap-2">
                            <input className={inputClass} placeholder="Why is it rejected?" value={rejecting.reason}
                              onChange={(e) => setRejecting({ id: r._id, reason: e.target.value })} />
                            <button type="button" className={btn} disabled={busy || !rejecting.reason.trim()}
                              onClick={() => void run(() => crmApi.rejectPaymentRefund(paymentId, r._id, { reason: rejecting.reason.trim() })).then((ok) => ok && setRejecting(null))}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 flex gap-2">
                            <button type="button" className={primary} disabled={busy} onClick={() => void run(() => crmApi.approvePaymentRefund(paymentId, r._id))}>Approve</button>
                            <button type="button" className={btn} disabled={busy} onClick={() => setRejecting({ id: r._id, reason: '' })}>Reject…</button>
                          </div>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canWrite && free > 0 ? (
              <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3">
                <p className="m-0 text-xs font-semibold text-zinc-700">New refund</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelClass}>Amount *</span>
                    <input className={inputClass} type="number" min={0} step="0.01" max={free} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Refund by</span>
                    <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}>
                      {REFUND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className={labelClass}>Reference / UTR</span>
                  <input className={inputClass} value={txn} maxLength={120} onChange={(e) => setTxn(e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelClass}>Reason *</span>
                  <input className={inputClass} value={reason} maxLength={300} placeholder="e.g. Trip cancelled by the client" onChange={(e) => setReason(e.target.value)} />
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={approveNow} onChange={(e) => setApproveNow(e.target.checked)} />
                  Approve now (otherwise it waits for approval)
                </label>
                <div className="flex justify-end">
                  <button type="button" className={primary} disabled={busy} onClick={() => void submit()}>{busy ? 'Saving…' : 'Save refund'}</button>
                </div>
              </div>
            ) : canWrite ? (
              <p className="m-0 text-xs text-zinc-500">Nothing left to refund on this payment{pendingTotal > 0 ? ' (the rest is waiting for approval)' : ''}.</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default RefundPaymentDialog;
