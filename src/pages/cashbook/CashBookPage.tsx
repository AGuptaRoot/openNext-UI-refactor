import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

import { notify } from '@/components/notifications';
import { ApiError, crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { CashBookView, CashCategories, CashEntryInput, CashLine, CashSummary } from '../../types/cashbook';

/**
 * Cash Book (GST suite, CRM 3.53.0; documentation/gst-planning/02).
 * Cash in hand with a running balance, built by the server from cash payments, cash refunds, approved
 * cash expenses and manual entries (opening balance, petty cash, bank deposits / withdrawals, trip costs).
 */

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1 block text-xs font-semibold text-zinc-700';
const btn =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Preset = 'month' | 'lastMonth' | 'fy' | 'all' | 'custom';

function rangeOf(preset: Preset, today = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  if (preset === 'month') return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (preset === 'lastMonth') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (preset === 'fy') {
    const start = m >= 3 ? y : y - 1;
    return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
  }
  return { from: '', to: '' };
}

const money = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SOURCE_LABEL: Record<string, string> = { payment: 'Payment', refund: 'Refund', expense: 'Expense', own: 'Entry' };

type EntryForm = CashEntryInput & { id?: string };
const emptyForm = (): EntryForm => ({ type: 'out', date: iso(new Date()), amount: 0, category: 'Other', name: '', note: '' });

export const CashBookPage: React.FC = () => {
  const { hasPermission, isClient } = useAuth();
  const canRead = hasPermission('crm.finance.read') && !isClient;
  const canWrite = hasPermission('crm.finance.write') && !isClient;
  const canDelete = hasPermission('crm.finance.delete') && !isClient;

  const [preset, setPreset] = useState<Preset>('month');
  const [range, setRange] = useState(rangeOf('month'));
  const [search, setSearch] = useState('');
  const [view, setView] = useState<CashBookView | null>(null);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [cats, setCats] = useState<CashCategories | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EntryForm | null>(null);
  const [contra, setContra] = useState<{ direction: 'deposit' | 'withdraw'; amount: number; date: string; note: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const [b, s, c] = await Promise.all([
        crmApi.getCashBook({ from: range.from, to: range.to, search: search.trim() }),
        crmApi.getCashSummary(),
        cats ? Promise.resolve({ data: cats }) : crmApi.getCashCategories(),
      ]);
      setView(b.data);
      setSummary(s.data);
      if (!cats) setCats(c.data);
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : 'Could not load the cash book');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, range.from, range.to, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(rangeOf(p));
  };

  const locked = summary?.lockedUpTo || '';
  const isLocked = (date: string) => Boolean(locked && date && date <= locked);

  const saveEntry = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const body: CashEntryInput = {
        type: form.type,
        date: form.date,
        amount: Number(form.amount),
        category: form.category,
        name: form.name?.trim() || '',
        note: form.note?.trim() || '',
      };
      if (form.id) await crmApi.updateCashEntry(form.id, body);
      else await crmApi.addCashEntry(body);
      notify.success(form.id ? 'Cash entry saved' : 'Cash entry added');
      setForm(null);
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : 'Could not save the cash entry');
    } finally {
      setSaving(false);
    }
  };

  const saveContra = async () => {
    if (!contra) return;
    setSaving(true);
    try {
      await crmApi.cashContra({ direction: contra.direction, amount: Number(contra.amount), date: contra.date, note: contra.note.trim() });
      notify.success(contra.direction === 'deposit' ? 'Bank deposit added' : 'Bank withdrawal added');
      setContra(null);
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (line: CashLine) => {
    if (!line.entry) return;
    if (!window.confirm(`Remove this cash entry (${line.type === 'in' ? 'in' : 'out'} ${money(line.amount)} on ${line.date})? It is kept in the audit history.`)) return;
    try {
      await crmApi.deleteCashEntry(line.entry.id);
      notify.success('Cash entry removed');
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : 'Could not remove the cash entry');
    }
  };

  const categoryOptions = useMemo(() => cats?.categories || ['Other'], [cats]);

  if (!canRead) {
    return <div className="rounded-xl border border-zinc-300 bg-white p-6 text-sm text-zinc-600">You don't have access to the cash book.</div>;
  }

  return (
    <div className="flex flex-col gap-5" data-tour="cashbook">
      <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Finance</p>
          <h1 className="m-0 text-2xl font-bold text-zinc-950">Cash Book</h1>
          <p className="mb-0 mt-1 text-sm text-zinc-500">Cash in hand. Cash payments, cash refunds and approved cash expenses appear by themselves.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => void load()} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
          </button>
          {canWrite ? (
            <>
              <button type="button" className={btn} onClick={() => setContra({ direction: 'deposit', amount: 0, date: iso(new Date()), note: '' })}>Deposit to bank</button>
              <button type="button" className={btn} onClick={() => setContra({ direction: 'withdraw', amount: 0, date: iso(new Date()), note: '' })}>Withdraw from bank</button>
              <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer" onClick={() => setForm(emptyForm())}>
                <AddIcon sx={{ fontSize: 15 }} /> Add entry
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-300 bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cash in hand</div>
          <div className="mt-1 text-xl font-bold text-zinc-950">{summary ? money(summary.inHand) : '—'}</div>
        </div>
        <div className="rounded-xl border border-zinc-300 bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Today</div>
          <div className="mt-1 text-sm font-semibold text-zinc-800">
            {summary ? <>In {money(summary.today.in)} · Out {money(summary.today.out)}</> : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-300 bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">This month</div>
          <div className="mt-1 text-sm font-semibold text-zinc-800">
            {summary ? <>In {money(summary.month.in)} · Out {money(summary.month.out)}</> : '—'}
          </div>
        </div>
      </div>

      {locked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Books are locked up to {locked}: entries on or before it can't be added, changed or removed (Settings → GST).
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-300 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex flex-wrap gap-1.5">
            {(['month', 'lastMonth', 'fy', 'all', 'custom'] as Preset[]).map((p) => (
              <button key={p} type="button" onClick={() => choosePreset(p)}
                className={`h-8 rounded-full border px-3 text-xs font-semibold cursor-pointer ${preset === p ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700'}`}>
                {{ month: 'This month', lastMonth: 'Last month', fy: 'This FY', all: 'All', custom: 'Custom' }[p]}
              </button>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="flex gap-2">
              <input className={inputClass} type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <input className={inputClass} type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
          ) : null}
          <div className="lg:ml-auto lg:w-72">
            <input className={inputClass} placeholder="Search name, note, category, amount" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="pb-2 pr-2">Date</th>
                <th className="pb-2 pr-2">Details</th>
                <th className="pb-2 pr-2">Category</th>
                <th className="pb-2 pr-2 text-right">In</th>
                <th className="pb-2 pr-2 text-right">Out</th>
                <th className="pb-2 pr-2 text-right">Balance</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td className="py-2 pr-2 text-xs text-zinc-500" colSpan={5}>Opening balance{range.from ? ` on ${range.from}` : ''}</td>
                <td className="py-2 pr-2 text-right font-semibold">{view ? money(view.opening) : '—'}</td>
                <td />
              </tr>
              {loading && !view ? (
                <tr><td colSpan={7} className="py-6 text-center text-zinc-500">Loading…</td></tr>
              ) : (view?.rows || []).length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-zinc-500">No cash movements in this period.</td></tr>
              ) : (
                (view?.rows || []).map((line) => (
                  <tr key={line.key} className="border-t border-zinc-100 align-top">
                    <td className="py-2 pr-2 whitespace-nowrap">{line.date}</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">{SOURCE_LABEL[line.source] || line.source}</span>
                        {line.link && line.link.kind === 'invoice' && line.link.id ? (
                          <Link to={`/invoices/${line.link.id}`} className="font-semibold text-zinc-900 no-underline hover:underline">{line.label || 'Invoice'}</Link>
                        ) : line.link && line.link.kind === 'expense' ? (
                          <Link to={`/expenses/${line.link.id}`} className="font-semibold text-zinc-900 no-underline hover:underline">{line.label || 'Expense'}</Link>
                        ) : (
                          <span className="font-semibold text-zinc-900">{line.name || line.label || '—'}</span>
                        )}
                      </div>
                      {line.name && line.source !== 'own' ? <div className="text-xs text-zinc-500">{line.name}</div> : null}
                      {line.note ? <div className="text-xs text-zinc-500">{line.note}</div> : null}
                      {line.entry?.refType ? <div className="text-[11px] text-zinc-400">Linked: {line.entry.refType} {line.entry.refId}</div> : null}
                    </td>
                    <td className="py-2 pr-2 text-xs">{line.category}</td>
                    <td className="py-2 pr-2 text-right text-emerald-700">{line.type === 'in' ? money(line.amount) : ''}</td>
                    <td className="py-2 pr-2 text-right text-red-700">{line.type === 'out' ? money(line.amount) : ''}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{money(line.balance)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {line.source === 'own' && line.entry && !isLocked(line.date) ? (
                        <>
                          {canWrite ? (
                            <button type="button" aria-label="Edit entry" className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                              onClick={() => setForm({ id: line.entry!.id, type: line.type, date: line.date, amount: line.amount, category: line.category, name: line.name, note: line.note })}>
                              <EditOutlinedIcon sx={{ fontSize: 15 }} />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button type="button" aria-label="Remove entry" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                              onClick={() => void removeEntry(line)}>
                              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-t-2 border-zinc-300">
                <td className="py-2 pr-2 text-xs font-semibold" colSpan={3}>Totals and closing balance</td>
                <td className="py-2 pr-2 text-right font-semibold text-emerald-700">{view ? money(view.totals.in) : ''}</td>
                <td className="py-2 pr-2 text-right font-semibold text-red-700">{view ? money(view.totals.out) : ''}</td>
                <td className="py-2 pr-2 text-right font-bold">{view ? money(view.closing) : '—'}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Cash entry">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-xl">
            <h2 className="m-0 text-base font-bold text-zinc-950">{form.id ? 'Edit cash entry' : 'Add cash entry'}</h2>
            <p className="mb-4 mt-1 text-xs text-zinc-500">For cash with no other record. Money from a client is better recorded on its invoice (Record payment).</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Money *</span>
                <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'in' | 'out' })}>
                  <option value="in">Money in</option>
                  <option value="out">Money out</option>
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Date *</span>
                <input className={inputClass} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label className="block">
                <span className={labelClass}>Amount *</span>
                <input className={inputClass} type="number" min={0.01} step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className={labelClass}>Category</span>
                <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="col-span-2 block">
                <span className={labelClass}>Person / party</span>
                <input className={inputClass} maxLength={120} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="col-span-2 block">
                <span className={labelClass}>Note</span>
                <input className={inputClass} maxLength={500} value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
            </div>
            {form.category === 'Customer advance' || form.category === 'Balance payment' ? (
              <p className="m-0 mt-3 text-[11px] font-semibold text-amber-700">If this money is for an invoice, use Record payment on that invoice instead, or it will be counted twice.</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={btn} disabled={saving} onClick={() => setForm(null)}>Cancel</button>
              <button type="button" disabled={saving} onClick={() => void saveEntry()} className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {contra ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Bank deposit or withdrawal">
          <div className="w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-5 shadow-xl">
            <h2 className="m-0 text-base font-bold text-zinc-950">{contra.direction === 'deposit' ? 'Cash deposited in the bank' : 'Cash withdrawn from the bank'}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Amount *</span>
                <input className={inputClass} type="number" min={0.01} step="0.01" value={contra.amount || ''} onChange={(e) => setContra({ ...contra, amount: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className={labelClass}>Date *</span>
                <input className={inputClass} type="date" value={contra.date} onChange={(e) => setContra({ ...contra, date: e.target.value })} />
              </label>
              <label className="col-span-2 block">
                <span className={labelClass}>Note</span>
                <input className={inputClass} maxLength={500} value={contra.note} onChange={(e) => setContra({ ...contra, note: e.target.value })} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={btn} disabled={saving} onClick={() => setContra(null)}>Cancel</button>
              <button type="button" disabled={saving} onClick={() => void saveContra()} className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CashBookPage;
