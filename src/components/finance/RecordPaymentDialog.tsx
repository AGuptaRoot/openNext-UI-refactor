import React, { useMemo, useState } from 'react';

import { ApiError, crmApi } from '../../services/api';
import { PAYMENT_MODES } from '../../types/payments';

/**
 * Record payment (GST suite, CRM 3.53.0; documentation/gst-planning/02 §5.1).
 * Money received outside Razorpay (cash, UPI, bank transfer, cheque, card) on a proforma or tax invoice.
 * Saved through the existing POST /payments, so balances, status, the proforma follow-up (accept / tax
 * invoice / booking), the advance receipt voucher and the cash book all follow by themselves.
 */

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1 block text-xs font-semibold text-zinc-700';

/** Today as YYYY-MM-DD in the browser's local time (not the UTC day). */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  invoiceId: string;
  invoiceNo: string;
  balanceDue: number;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}

export const RecordPaymentDialog: React.FC<Props> = ({ invoiceId, invoiceNo, balanceDue, currency, onClose, onSaved }) => {
  const [amount, setAmount] = useState<string>(String(balanceDue));
  const [mode, setMode] = useState<string>('Cash');
  const [date, setDate] = useState<string>(todayLocal());
  const [reference, setReference] = useState('');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const problem = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 'Enter an amount more than 0.';
    if (n > balanceDue + 0.005) return `The amount can't be more than the balance due (${currency} ${balanceDue.toFixed(2)}).`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Choose the payment date.';
    if (date > todayLocal()) return "The payment date can't be in the future.";
    return '';
  }, [amount, balanceDue, currency, date]);

  const save = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await crmApi.recordInvoicePayment(invoiceId, {
        amount: Math.round(Number(amount) * 100) / 100,
        mode,
        paymentDate: date,
        transactionId: reference.trim() || undefined,
        remark: remark.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Record payment">
      <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-xl">
        <h2 className="m-0 text-base font-bold text-zinc-950">Record payment</h2>
        <p className="mb-4 mt-1 text-xs text-zinc-500">
          {invoiceNo} · balance due {currency} {balanceDue.toFixed(2)}. Use this for money received in cash, UPI, bank transfer, cheque or card.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Amount *</span>
            <input className={inputClass} type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Mode *</span>
            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Payment date *</span>
            <input className={inputClass} type="date" max={todayLocal()} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Reference</span>
            <input className={inputClass} value={reference} maxLength={120} placeholder="UPI ref, cheque no…" onChange={(e) => setReference(e.target.value)} />
          </label>
          <label className="col-span-2 block">
            <span className={labelClass}>Remark</span>
            <input className={inputClass} value={remark} maxLength={500} placeholder="e.g. Paid at office counter" onChange={(e) => setRemark(e.target.value)} />
          </label>
        </div>
        {mode === 'Cash' ? <p className="m-0 mt-3 text-[11px] text-emerald-700">Cash payments appear in the Cash Book by themselves.</p> : null}
        {error ? <p role="alert" className="m-0 mt-3 text-xs font-semibold text-red-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer">
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void save()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordPaymentDialog;
