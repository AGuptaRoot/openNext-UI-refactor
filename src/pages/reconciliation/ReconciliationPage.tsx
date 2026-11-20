import React, { useCallback, useEffect, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { notify } from '@/components/notifications';
import { ApiError, crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { bankRowsFromCsv } from '../../utils/bankCsv';
import type { BankLine, BankLinesResponse, BankRow, BankSuggestion, GatewayFeeSummary } from '../../types/reconciliation';

/**
 * Bank Reconciliation (GST suite, CRM 3.53.0; documentation/gst-planning/04).
 * Bank matching: import a statement CSV (read here, never uploaded as a file), see each line with the
 * records it could be (why), confirm, search by hand, ignore or undo.
 * Razorpay fees: per month, the fee and GST on fee of each payment, for checking Razorpay's GST invoice.
 */

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const btn =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer';
const primary =
  'inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer';
const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const ReconciliationPage: React.FC = () => {
  const { hasPermission, isClient } = useAuth();
  const canRead = hasPermission('crm.finance.read') && !isClient;
  const canWrite = hasPermission('crm.finance.write') && !isClient;
  const [tab, setTab] = useState<'bank' | 'fees'>('bank');

  if (!canRead) {
    return <div className="rounded-xl border border-zinc-300 bg-white p-6 text-sm text-zinc-600">You don't have access to bank reconciliation.</div>;
  }
  return (
    <div className="flex flex-col gap-5" data-tour="reconciliation">
      <header className="border-b border-zinc-200 pb-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Finance</p>
        <h1 className="m-0 text-2xl font-bold text-zinc-950">Bank Reconciliation</h1>
        <p className="mb-0 mt-1 text-sm text-zinc-500">Match your bank statement to payments, invoices and Razorpay settlements; check Razorpay fees.</p>
        <div className="mt-4 flex gap-1.5">
          {(['bank', 'fees'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold cursor-pointer ${tab === t ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700'}`}>
              {t === 'bank' ? 'Bank matching' : 'Razorpay fees'}
            </button>
          ))}
        </div>
      </header>
      {tab === 'bank' ? <BankMatching canWrite={canWrite} /> : <GatewayFees canWrite={canWrite} />}
    </div>
  );
};

/* ------------------------------------------------------------------ bank matching */

const BankMatching: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const [status, setStatus] = useState<'open' | 'matched' | 'ignored'>('open');
  const [data, setData] = useState<BankLinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [account, setAccount] = useState('');
  const [preview, setPreview] = useState<{ fileName: string; rows: BankRow[] } | null>(null);
  const [picking, setPicking] = useState<{ line: BankLine; search: string; results: BankSuggestion[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await crmApi.getBankLines({ status })).data);
    } catch (err) {
      notify.error(errText(err, 'Could not load the bank lines'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const readFile = async (file: File) => {
    if (!/\.csv$/i.test(file.name)) {
      notify.error('Choose a CSV file. In your bank or Excel, use "Save as / Download as CSV".');
      return;
    }
    const text = await file.text();
    const parsed = bankRowsFromCsv(text);
    if (parsed.problem) {
      notify.error(parsed.problem);
      return;
    }
    setPreview({ fileName: file.name, rows: parsed.rows });
  };

  const doImport = async () => {
    if (!preview) return;
    if (!account.trim()) {
      notify.error('Enter the bank account this statement is from (e.g. HDFC current).');
      return;
    }
    setBusy('import');
    try {
      const res = await crmApi.importBankStatement({ account: account.trim(), fileName: preview.fileName, rows: preview.rows });
      notify.success(`Imported ${res.data.added} new line(s)${res.data.skippedAsDuplicate ? `, ${res.data.skippedAsDuplicate} already imported` : ''}.`);
      setPreview(null);
      setStatus('open');
      await load();
    } catch (err) {
      notify.error(errText(err, 'Could not import the statement'));
    } finally {
      setBusy('');
    }
  };

  const act = async (key: string, run: () => Promise<unknown>, okText: string) => {
    setBusy(key);
    try {
      await run();
      notify.success(okText);
      setPicking(null);
      await load();
    } catch (err) {
      notify.error(errText(err, 'That did not work'));
    } finally {
      setBusy('');
    }
  };

  const search = async (line: BankLine, text: string) => {
    try {
      const res = await crmApi.pickBankEntries(line.statementId, line.id, text);
      setPicking({ line, search: text, results: res.data || [] });
    } catch (err) {
      notify.error(errText(err, 'Search failed'));
    }
  };

  const confirmText = (s: BankSuggestion) => (s.record ? `Recorded a bank payment on ${s.label}` : `Matched to ${s.label}`);

  return (
    <div className="flex flex-col gap-5">
      {canWrite ? (
        <section className="rounded-xl border border-zinc-300 bg-white p-4">
          <h2 className="m-0 text-base font-bold text-zinc-950">Import a bank statement</h2>
          <p className="mb-3 mt-1 text-xs text-zinc-500">CSV with a header row: Date, Narration / Description, Ref / UTR, Withdrawal (Debit), Deposit (Credit), Balance. The file is read here and not uploaded; a statement imported twice adds nothing twice.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block sm:w-64">
              <span className="mb-1 block text-xs font-semibold text-zinc-700">Bank account <span className="text-red-600">*</span></span>
              <input className={inputClass} value={account} maxLength={120} placeholder="e.g. HDFC current" list="crm-bank-accounts" required onChange={(e) => setAccount(e.target.value)} />
              <datalist id="crm-bank-accounts">
                {(data?.accounts || []).filter(Boolean).map((a) => <option key={a} value={a} />)}
              </datalist>
            </label>
            <label className={btn}>
              <UploadFileIcon sx={{ fontSize: 15 }} /> Choose CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} />
            </label>
            {preview ? (
              <>
                <span className="text-xs text-zinc-600">{preview.fileName}: {preview.rows.length} line(s) read</span>
                <button type="button" className={primary} disabled={busy === 'import' || !preview.rows.length || !account.trim()} onClick={() => void doImport()}>
                  {busy === 'import' ? 'Importing…' : 'Import'}
                </button>
                <button type="button" className={btn} onClick={() => setPreview(null)}>Cancel</button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-300 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['open', 'matched', 'ignored'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold cursor-pointer ${status === s ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700'}`}>
              {s === 'open' ? 'To match' : s === 'matched' ? 'Matched' : 'Ignored'} {data ? `(${data.counts[s]})` : ''}
            </button>
          ))}
          <button type="button" className={`${btn} ml-auto`} onClick={() => void load()} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {loading && !data ? <p className="m-0 text-sm text-zinc-500">Loading…</p> : null}
          {data && !data.lines.length ? <p className="m-0 text-sm text-zinc-500">Nothing here.</p> : null}
          {(data?.lines || []).map((line) => (
            <div key={`${line.statementId}:${line.id}`} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-500">{line.date}{line.account ? ` · ${line.account}` : ''}{line.reference ? ` · Ref ${line.reference}` : ''}</div>
                  <div className="break-words text-sm font-semibold text-zinc-900">{line.description || '—'}</div>
                </div>
                <div className={`shrink-0 text-sm font-bold ${line.credit > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {line.credit > 0 ? `+ ${money(line.credit)}` : `− ${money(line.debit)}`}
                </div>
              </div>

              {line.status === 'open' ? (
                <div className="mt-2 flex flex-col gap-2">
                  {line.suggestions.length ? line.suggestions.map((s) => (
                    <div key={s.key} className="flex flex-col gap-2 rounded-md bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-xs">
                        <div className="font-semibold text-zinc-900">{s.label} · {money(s.amount)} · {s.date}</div>
                        {s.why?.length ? <div className="text-zinc-500">{s.why.join(' · ')}</div> : null}
                        {s.record ? <div className="text-amber-700">Confirming records a bank payment on it.</div> : null}
                      </div>
                      {canWrite ? (
                        <button type="button" className={primary} disabled={Boolean(busy)}
                          onClick={() => void act(line.id, () => crmApi.matchBankLine(line.statementId, line.id, s.key), confirmText(s))}>
                          Confirm
                        </button>
                      ) : null}
                    </div>
                  )) : <p className="m-0 text-xs text-zinc-500">No suggestion. Search by hand, or ignore it (bank charges, own transfers).</p>}
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btn} onClick={() => void search(line, '')}>Search</button>
                      <button type="button" className={btn} disabled={Boolean(busy)}
                        onClick={() => void act(line.id, () => crmApi.ignoreBankLine(line.statementId, line.id), 'Line ignored')}>
                        Ignore
                      </button>
                    </div>
                  ) : null}
                  {picking && picking.line.id === line.id && picking.line.statementId === line.statementId ? (
                    <div className="rounded-md border border-zinc-200 p-2">
                      <input className={inputClass} placeholder="Invoice no., client or amount" value={picking.search}
                        onChange={(e) => void search(line, e.target.value)} />
                      <div className="mt-2 flex flex-col gap-1">
                        {picking.results.length ? picking.results.map((s) => (
                          <button key={s.key} type="button" disabled={Boolean(busy)}
                            className="flex justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-50 cursor-pointer"
                            onClick={() => void act(line.id, () => crmApi.matchBankLine(line.statementId, line.id, s.key), confirmText(s))}>
                            <span>{s.label} · {s.date}{s.record ? ' (records a payment)' : ''}</span>
                            <strong>{money(s.amount)}</strong>
                          </button>
                        )) : <span className="text-xs text-zinc-500">Nothing found.</span>}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-600">
                    {line.status === 'ignored' ? 'Ignored' : <>Matched: <strong>{line.match?.label || line.match?.key}</strong>{line.match?.recorded ? ' (payment recorded)' : ''}</>}
                  </span>
                  {canWrite ? (
                    <button type="button" className={btn} disabled={Boolean(busy)}
                      onClick={() => {
                        if (line.match?.recorded && !window.confirm('Undoing this match deletes the bank payment it recorded. Continue?')) return;
                        void act(line.id, () => crmApi.unmatchBankLine(line.statementId, line.id), 'Undone');
                      }}>
                      Undo
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ Razorpay fees */

const GatewayFees: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<GatewayFeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await crmApi.getGatewayFees(month)).data);
    } catch (err) {
      notify.error(errText(err, 'Could not load Razorpay fees'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await crmApi.refreshGatewayFees();
      notify.success(`Checked ${res.data.checked}: ${res.data.feesFilled} fee(s) and ${res.data.settlementsFilled} settlement(s) filled.`);
      await load();
    } catch (err) {
      notify.error(errText(err, 'Could not read fees from Razorpay'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-300 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-700">Month</span>
          <input className={inputClass} type="month" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} />
        </label>
        {canWrite ? (
          <button type="button" className={btn} disabled={refreshing} onClick={() => void refresh()}>
            <RefreshIcon sx={{ fontSize: 15 }} /> {refreshing ? 'Reading Razorpay…' : 'Refresh fees from Razorpay'}
          </button>
        ) : null}
      </div>
      {loading && !data ? <p className="mt-4 text-sm text-zinc-500">Loading…</p> : null}
      {data ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Payments', String(data.payments)],
              ['Received', money(data.gross)],
              ['Razorpay fee', money(data.fee)],
              ['GST on fee', money(data.gstOnFee)],
              ['Net to bank', money(data.net)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
                <div className="mt-0.5 text-sm font-semibold text-zinc-900">{value}</div>
              </div>
            ))}
          </div>
          {data.pending ? <p className="m-0 mt-3 text-xs font-semibold text-amber-700">{data.pending} payment(s) still wait for their fee: press "Refresh fees from Razorpay" after a day or two.</p> : null}
          <p className="m-0 mt-2 text-xs text-zinc-500">{data.note}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-2">Paid on</th>
                  <th className="pb-2 pr-2">Payment</th>
                  <th className="pb-2 pr-2 text-right">Received</th>
                  <th className="pb-2 pr-2 text-right">Fee</th>
                  <th className="pb-2 pr-2 text-right">GST on fee</th>
                  <th className="pb-2 pr-2 text-right">Net</th>
                  <th className="pb-2">Settlement</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length ? data.rows.map((r) => (
                  <tr key={r.paymentId} className="border-t border-zinc-100">
                    <td className="py-2 pr-2">{r.paidOn}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{r.paymentId}{r.method ? ` · ${r.method}` : ''}</td>
                    <td className="py-2 pr-2 text-right">{money(r.gross)}</td>
                    <td className="py-2 pr-2 text-right">{money(r.fee)}</td>
                    <td className="py-2 pr-2 text-right">{money(r.gstOnFee)}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{money(r.net)}</td>
                    <td className="py-2 text-xs">{r.settlementId ? `${r.settlementId} · ${r.settledOn}${r.bankMatched ? ' · in bank ✓' : ''}` : 'Not settled yet'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="py-6 text-center text-zinc-500">No Razorpay payments this month.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default ReconciliationPage;
