import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';

import { notify } from '@/components/notifications';
import { ApiError, crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type {
  AdvanceTableRow,
  AdvanceVoucher,
  GstAdvancesReport,
  GstCreditNotesReport,
  Gstr1Report,
  GstTableTotals,
  TcsRegister,
} from '../../types/gstReports';

/**
 * GST Reports (GST suite, Step 5; documentation/gst-planning/03).
 * Pick a financial year and a month or quarter. GSTR-1: summary per table, warnings, the blocked list, the
 * portal JSON (only when nothing is blocked) and one CSV per table. Also Table 11A / 11B (advances), the
 * credit notes and the TCS register. Read-only: everything comes from issued documents.
 */

const inputClass =
  'h-9 box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const btn =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer';
const primary =
  'inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer';
const th = 'px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500';
const td = 'px-3 py-2 text-sm text-zinc-800';
const tdNum = 'px-3 py-2 text-right text-sm tabular-nums text-zinc-800';
const money = (n: number | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
const MONTH_NO = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const QUARTERS = [
  { id: 'Q1', label: 'Q1 (Apr–Jun)' },
  { id: 'Q2', label: 'Q2 (Jul–Sep)' },
  { id: 'Q3', label: 'Q3 (Oct–Dec)' },
  { id: 'Q4', label: 'Q4 (Jan–Mar)' },
];

function fyStartOf(d = new Date()): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}
const fyLabel = (start: number) => `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();

/** The dates of a period of a financial year (month number or Q1..Q4). */
function periodRange(fyStart: number, period: string): { from: string; to: string; quarter: string } {
  const q = /^Q([1-4])$/.exec(period);
  if (q) {
    const [a, b] = ({ 1: [4, 6], 2: [7, 9], 3: [10, 12], 4: [1, 3] } as Record<string, number[]>)[q[1]];
    const y = q[1] === '4' ? fyStart + 1 : fyStart;
    return { from: `${y}-${pad(a)}-01`, to: `${y}-${pad(b)}-${pad(lastDay(y, b))}`, quarter: period };
  }
  const m = Number(period);
  const y = m >= 4 ? fyStart : fyStart + 1;
  const quarter = m >= 4 && m <= 6 ? 'Q1' : m >= 7 && m <= 9 ? 'Q2' : m >= 10 ? 'Q3' : 'Q4';
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}`, quarter };
}

type Tab = 'gstr1' | 'advances' | 'credit-notes' | 'tcs';
const TAB_LABEL: Record<Tab, string> = {
  gstr1: 'GSTR-1',
  advances: 'Advances (11A / 11B)',
  'credit-notes': 'Credit notes',
  tcs: 'TCS register',
};

export const GstReportsPage: React.FC = () => {
  const { hasPermission, isClient } = useAuth();
  const canRead = hasPermission('crm.finance.read') && !isClient;
  const now = new Date();
  const [fyStart, setFyStart] = useState(fyStartOf(now));
  const [mode, setMode] = useState<'month' | 'quarter'>('month');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [quarter, setQuarter] = useState(periodRange(fyStartOf(now), String(now.getMonth() + 1)).quarter);
  const [tab, setTab] = useState<Tab>('gstr1');

  const period = mode === 'quarter' ? quarter : month;
  const fy = fyLabel(fyStart);
  const range = useMemo(() => periodRange(fyStart, period), [fyStart, period]);
  const fyOptions = useMemo(() => Array.from({ length: 6 }, (_, i) => fyStartOf(now) - i), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!canRead) {
    return <div className="rounded-xl border border-zinc-300 bg-white p-6 text-sm text-zinc-600">You don't have access to GST reports.</div>;
  }
  return (
    <div className="flex flex-col gap-5" data-tour="gst-reports">
      <header className="border-b border-zinc-200 pb-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Finance</p>
        <h1 className="m-0 text-2xl font-bold text-zinc-950">GST Reports</h1>
        <p className="mb-0 mt-1 text-sm text-zinc-500">
          GSTR-1, advances, credit notes and TCS from your issued documents. Check every file with your CA before filing.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs font-semibold text-zinc-700">
            Financial year
            <select className={`${inputClass} mt-1`} value={fyStart} onChange={(e) => setFyStart(Number(e.target.value))}>
              {fyOptions.map((s) => <option key={s} value={s}>{fyLabel(s)}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs font-semibold text-zinc-700">
            Filing
            <select className={`${inputClass} mt-1`} value={mode} onChange={(e) => setMode(e.target.value as 'month' | 'quarter')}>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
            </select>
          </label>
          {mode === 'month' ? (
            <label className="flex flex-col text-xs font-semibold text-zinc-700">
              Month
              <select className={`${inputClass} mt-1`} value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((name, i) => <option key={name} value={String(MONTH_NO[i])}>{name}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex flex-col text-xs font-semibold text-zinc-700">
              Quarter
              <select className={`${inputClass} mt-1`} value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                {QUARTERS.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
              </select>
            </label>
          )}
          <span className="pb-2 text-xs text-zinc-500">{range.from} to {range.to}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold cursor-pointer ${tab === t ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700'}`}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </header>
      {tab === 'gstr1' ? <Gstr1Tab fy={fy} period={period} /> : null}
      {tab === 'advances' ? <AdvancesTab from={range.from} to={range.to} /> : null}
      {tab === 'credit-notes' ? <CreditNotesTab from={range.from} to={range.to} /> : null}
      {tab === 'tcs' ? <TcsTab fy={fy} quarter={range.quarter} /> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ helpers */

function useReport<T>(load: () => Promise<{ data: T }>, deps: unknown[]): { data: T | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(async () => {
    setLoading(true);
    try {
      setData((await load()).data);
    } catch (err) {
      setData(null);
      notify.error(errText(err, 'Could not load the report'));
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void run();
  }, [run]);
  return { data, loading, reload: () => void run() };
}

async function download(kind: 'gstr1-json' | 'gstr1-csv' | 'credit-notes' | 'tcs', params: Record<string, string>) {
  try {
    const name = await crmApi.downloadGstReport(kind, params);
    notify.success(`Downloaded ${name}`);
  } catch (err) {
    notify.error(errText(err, 'Could not download the file'));
  }
}

const Card: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, children, right }) => (
  <section className="rounded-xl border border-zinc-200 bg-white">
    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
      <h2 className="m-0 text-sm font-bold text-zinc-900">{title}</h2>
      {right}
    </div>
    <div className="overflow-x-auto">{children}</div>
  </section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="m-0 px-4 py-6 text-sm text-zinc-500">{text}</p>;

/* ------------------------------------------------------------------ GSTR-1 */

const TABLE_ROWS: Array<{ key: keyof Omit<NonNullable<Gstr1Report['summary']>, 'documents' | 'invoices' | 'creditNotes'>; label: string; csv: string[] }> = [
  { key: 'b2b', label: 'B2B (4A) — registered buyers', csv: ['b2b'] },
  { key: 'b2cl', label: 'B2C Large (5) — interstate, above the limit', csv: ['b2cl'] },
  { key: 'b2cs', label: 'B2C Small (7)', csv: ['b2cs'] },
  { key: 'cdnr', label: 'Credit notes, registered (9B CDNR)', csv: ['cdnr'] },
  { key: 'cdnur', label: 'Credit notes, unregistered (9B CDNUR)', csv: ['cdnur'] },
  { key: 'exp', label: 'Exports (6A)', csv: ['exp'] },
  { key: 'nil', label: 'Nil-rated / exempt / non-GST (8)', csv: [] },
  { key: 'at', label: 'Advances received (11A)', csv: ['at'] },
  { key: 'txpd', label: 'Advances adjusted (11B)', csv: ['txpd'] },
  { key: 'hsn', label: 'HSN / SAC summary (12)', csv: [] },
];

const Gstr1Tab: React.FC<{ fy: string; period: string }> = ({ fy, period }) => {
  const { data, loading, reload } = useReport<Gstr1Report>(() => crmApi.getGstr1Report({ fy, period }), [fy, period]);
  const csv = (table: string) => download('gstr1-csv', { fy, period, table });
  const hsnCsv = data?.hsnSplit ? ['hsn_b2b', 'hsn_b2c'] : ['hsn'];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={!data?.canDownload} onClick={() => download('gstr1-json', { fy, period })}
          title={data && !data.canDownload ? 'Fix the blocked items first' : ''}>
          <DownloadIcon sx={{ fontSize: 16 }} /> GSTR-1 JSON (portal)
        </button>
        <button type="button" className={btn} onClick={reload} disabled={loading}>
          <RefreshIcon sx={{ fontSize: 16 }} /> Refresh
        </button>
        {data?.filename ? <span className="text-xs text-zinc-500">{data.filename}</span> : null}
      </div>

      {loading && !data ? <p className="m-0 text-sm text-zinc-500">Loading…</p> : null}

      {data && data.blocked.length ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="m-0 mb-2 text-sm font-bold text-red-800">Blocked: the portal would refuse this file. Fix these first.</p>
          <ul className="m-0 list-disc pl-5 text-sm text-red-800">{data.blocked.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      ) : null}

      {data && data.warnings.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="m-0 mb-2 text-sm font-bold text-amber-900">Check these</p>
          <ul className="m-0 list-disc pl-5 text-sm text-amber-900">
            {data.warnings.map((w, i) => <li key={`${i}-${w.msg}`} className={w.type === 'error' ? 'font-semibold text-red-800' : ''}>{w.msg}</li>)}
          </ul>
        </div>
      ) : null}

      {data && data.ready && data.summary ? (
        <Card title={`Summary — ${data.period.label} (return period ${data.period.fp})`}>
          <table className="w-full border-collapse">
            <thead><tr className="bg-zinc-50"><th className={th}>Table</th><th className={`${th} text-right`}>Rows</th><th className={`${th} text-right`}>Taxable value</th><th className={`${th} text-right`}>Tax</th><th className={th}>CSV</th></tr></thead>
            <tbody>
              {TABLE_ROWS.map((row) => {
                const s: GstTableTotals = data.summary![row.key];
                const files = row.key === 'hsn' ? hsnCsv : row.csv;
                return (
                  <tr key={row.key} className="border-t border-zinc-100">
                    <td className={td}>{row.label}</td>
                    <td className={tdNum}>{s.count}</td>
                    <td className={tdNum}>{money(s.taxable)}</td>
                    <td className={tdNum}>{money(s.tax)}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {files.map((f) => (
                          <button key={f} type="button" className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-[11px] font-semibold text-zinc-700 cursor-pointer disabled:opacity-40"
                            disabled={!s.count} onClick={() => csv(f)}>{f}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-zinc-100">
                <td className={td}>Documents issued (13)</td>
                <td className={tdNum}>{data.summary.documents.total}</td>
                <td className={`${tdNum} text-zinc-500`} colSpan={2}>{data.summary.documents.cancelled} cancelled</td>
                <td className={td}>
                  <button type="button" className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-[11px] font-semibold text-zinc-700 cursor-pointer disabled:opacity-40"
                    disabled={!data.summary.documents.total} onClick={() => csv('docs')}>docs</button>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      ) : null}
      {data && data.ready && data.empty ? <Empty text="No issued GST documents or advances in this period." /> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ 11A / 11B */

const AdvanceRows: React.FC<{ rows: AdvanceTableRow[]; label: string }> = ({ rows, label }) => {
  const flat = rows.flatMap((r) => r.itms.map((it) => ({ ...it, pos: r.pos, sply: r.sply_ty })));
  if (!flat.length) return <Empty text={`No ${label} in this period.`} />;
  return (
    <table className="w-full border-collapse">
      <thead><tr className="bg-zinc-50"><th className={th}>Place of supply</th><th className={th}>Supply</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Gross advance</th><th className={`${th} text-right`}>IGST</th><th className={`${th} text-right`}>CGST</th><th className={`${th} text-right`}>SGST / UTGST</th></tr></thead>
      <tbody>
        {flat.map((r) => (
          <tr key={`${r.pos}-${r.sply}-${r.rt}`} className="border-t border-zinc-100">
            <td className={td}>{r.pos}</td><td className={td}>{r.sply}</td><td className={tdNum}>{r.rt}%</td>
            <td className={tdNum}>{money(r.ad_amt)}</td><td className={tdNum}>{money(r.iamt)}</td><td className={tdNum}>{money(r.camt)}</td><td className={tdNum}>{money(r.samt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const VoucherList: React.FC<{ list: AdvanceVoucher[] }> = ({ list }) => (
  list.length ? (
    <table className="w-full border-collapse">
      <thead><tr className="bg-zinc-50"><th className={th}>Voucher</th><th className={th}>Received</th><th className={th}>Place of supply</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Tax</th><th className={th}>Invoice</th><th className={th}>Adjusted on</th></tr></thead>
      <tbody>
        {list.map((v) => (
          <tr key={v.receiptNo} className="border-t border-zinc-100">
            <td className={td}>{v.receiptNo}</td><td className={td}>{v.receiptDate}</td><td className={td}>{v.placeOfSupply}</td>
            <td className={tdNum}>{money(v.amount)}</td><td className={tdNum}>{money(v.totalTax)}</td><td className={td}>{v.adjustedInvoiceNo || '—'}</td><td className={td}>{v.adjustedOn || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : null
);

const AdvancesTab: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const { data, loading } = useReport<GstAdvancesReport>(() => crmApi.getGstAdvances({ from, to }), [from, to]);
  if (loading && !data) return <p className="m-0 text-sm text-zinc-500">Loading…</p>;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-xs text-zinc-500">{data.note} New in this CRM: have your CA check these tables against the GST offline tool before the first filing.</p>
      <Card title="11A — advances received, not yet adjusted"><AdvanceRows rows={data.at} label="advances received" /><VoucherList list={data.received} /></Card>
      <Card title="11B — advances adjusted (received earlier)"><AdvanceRows rows={data.txpd} label="advances adjusted" /><VoucherList list={data.adjusted} /></Card>
    </div>
  );
};

/* ------------------------------------------------------------------ credit notes */

const CreditNotesTab: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const { data, loading } = useReport<GstCreditNotesReport>(() => crmApi.getGstCreditNotes({ from, to }), [from, to]);
  if (loading && !data) return <p className="m-0 text-sm text-zinc-500">Loading…</p>;
  if (!data) return null;
  if (!data.ready) return <Empty text="Save your GSTIN and state in Settings → GST first." />;
  return (
    <Card title={`Credit notes — ${data.totals.count} with GST, tax ${money(data.totals.tax)}`}
      right={<button type="button" className={btn} disabled={!data.notes.length} onClick={() => download('credit-notes', { from, to })}><DownloadIcon sx={{ fontSize: 16 }} /> CSV</button>}>
      {data.notes.length ? (
        <table className="w-full border-collapse">
          <thead><tr className="bg-zinc-50"><th className={th}>Note</th><th className={th}>Date</th><th className={th}>Client</th><th className={th}>Against</th><th className={th}>Status</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>Tax</th><th className={`${th} text-right`}>Total</th><th className={th}>GSTR-1</th></tr></thead>
          <tbody>
            {data.notes.map((n) => (
              <tr key={n.id} className="border-t border-zinc-100">
                <td className={td}>{n.creditNoteNumber}</td><td className={td}>{n.date}</td>
                <td className={td}>{n.clientName}{n.clientGstin ? <span className="block text-[11px] text-zinc-500">{n.clientGstin}</span> : null}</td>
                <td className={td}>{n.invoiceNumber || '—'}</td><td className={td}>{n.status}</td>
                <td className={tdNum}>{money(n.taxable)}</td><td className={tdNum}>{money(n.tax)}</td><td className={tdNum}>{money(n.total)}</td>
                <td className={td}>{n.table}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <Empty text="No credit notes in this period." />}
    </Card>
  );
};

/* ------------------------------------------------------------------ TCS register */

const TcsTab: React.FC<{ fy: string; quarter: string }> = ({ fy, quarter }) => {
  const [rule, setRule] = useState('');
  const { data, loading } = useReport<TcsRegister>(() => crmApi.getTcsRegister({ fy, quarter, rule }), [fy, quarter, rule]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs font-semibold text-zinc-700">
          TCS rule
          <select className={`${inputClass} mt-1`} value={rule} onChange={(e) => setRule(e.target.value)}>
            <option value="">All rules</option>
            {(data?.rules || []).map((r) => <option key={r.key} value={r.key}>{r.label}{r.enabled ? '' : ' (off)'}</option>)}
          </select>
        </label>
        <span className="pb-2 text-xs text-zinc-500">{fy} {quarter} · TCS is income tax collected on top of the invoice, not GST.</span>
        <button type="button" className={btn} disabled={!data?.rows.length} onClick={() => download('tcs', { fy, quarter, ...(rule ? { rule } : {}) })}>
          <DownloadIcon sx={{ fontSize: 16 }} /> CSV
        </button>
      </div>
      {loading && !data ? <p className="m-0 text-sm text-zinc-500">Loading…</p> : null}
      {data && data.warnings.length ? (
        <ul className="m-0 list-disc rounded-xl border border-amber-200 bg-amber-50 py-3 pl-8 pr-4 text-sm text-amber-900">{data.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      ) : null}
      {data ? (
        <Card title={`${data.totals.all.count} invoice(s) — TCS ${money(data.totals.all.amount)}`}>
          {data.rows.length ? (
            <table className="w-full border-collapse">
              <thead><tr className="bg-zinc-50"><th className={th}>Date</th><th className={th}>Invoice</th><th className={th}>Buyer</th><th className={th}>PAN</th><th className={th}>Rule</th><th className={`${th} text-right`}>Base</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>TCS</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100">
                    <td className={td}>{r.date}</td><td className={td}>{r.invoiceNumber}</td><td className={td}>{r.party}</td>
                    <td className={td}>{r.pan || <span className="text-red-700">No PAN</span>}</td>
                    <td className={td}>{r.rule}{r.section ? <span className="block text-[11px] text-zinc-500">{r.section}</span> : null}</td>
                    <td className={tdNum}>{money(r.base)}</td><td className={tdNum}>{r.rate}%</td><td className={tdNum}>{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty text="No invoices with TCS in this quarter." />}
          {data.totals.byRate.length ? (
            <table className="w-full border-collapse border-t border-zinc-200">
              <thead><tr className="bg-zinc-50"><th className={th}>Rate</th><th className={`${th} text-right`}>Invoices</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>TCS</th></tr></thead>
              <tbody>
                {data.totals.byRate.map((t) => (
                  <tr key={t.key} className="border-t border-zinc-100"><td className={td}>{t.key}</td><td className={tdNum}>{t.count}</td><td className={tdNum}>{money(t.taxable)}</td><td className={tdNum}>{money(t.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
};
