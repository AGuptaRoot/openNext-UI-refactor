import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNotifyMessage } from '@/components/notifications';
import { crmApi } from '../../services/api';
import { triggerFileDownload } from '../../utils/fileDownload';
import { formatCrmMoney } from '../../utils/currency';
import { ChartCard, MetricCard, useChartTheme } from './ReportCharts';
import type {
  ExtensionReportDefinition,
  ExtensionReportItem,
  ExtensionReportSectionData,
  ExtensionReportSectionDef,
} from '../../types/reports';

/**
 * The active extension's Reports page (json/reports.json, CRM 3.29.0). Industry-neutral: the extension
 * declares the filters and sections; the data comes from its routes through the CRM (permission-checked,
 * filtered, drill-down links checked), and this page only draws the standard section kinds.
 */

const PRESETS: Array<{ value: string; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function presetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = iso(now);
  if (preset === 'all') return { from: '', to: '' };
  if (preset === 'last_30_days') return { from: iso(new Date(now.getTime() - 29 * 86400000)), to };
  if (preset === 'this_quarter') return { from: iso(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to };
  if (preset === 'this_year') return { from: iso(new Date(now.getFullYear(), 0, 1)), to };
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
}

const TONE: Record<string, string> = {
  neutral: 'border-border',
  success: 'border-emerald-300',
  warning: 'border-amber-300',
  danger: 'border-red-300',
  info: 'border-sky-300',
};
const TONE_TEXT: Record<string, string> = {
  neutral: 'text-foreground',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  info: 'text-sky-700',
};

function formatValue(value: number | null | undefined, format?: string, currency?: string): string {
  if (value === null || value === undefined) return '—';
  if (format === 'money') return formatCrmMoney(value, currency || undefined, { maximumFractionDigits: 0 });
  if (format === 'percent') return `${value}%`;
  if (format === 'days') return `${value} d`;
  return Number(value).toLocaleString();
}

const card = 'rounded-xl border border-border bg-card p-5 shadow-none';

export const ExtensionReportsDashboard: React.FC<{
  definition: ExtensionReportDefinition;
  /** Core report tabs the extension keeps (keepCoreTabs): opens them. */
  onOpenCoreReports?: () => void;
}> = ({ definition, onOpenCoreReports }) => {
  const navigate = useNavigate();
  const chart = useChartTheme();
  const rangeFilter = definition.filters.find((f) => f.type === 'daterange');
  const defaultPreset = rangeFilter?.default || 'this_month';
  const [preset, setPreset] = useState(defaultPreset);
  const [range, setRange] = useState(() => presetRange(defaultPreset));
  const [values, setValues] = useState<Record<string, string>>({});
  const [params, setParams] = useState<Record<string, string>>({});
  const [sections, setSections] = useState<Record<string, ExtensionReportSectionData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useNotifyMessage(error, 'error', () => setError(''));
  const [exporting, setExporting] = useState('');
  const seq = useRef(0);
  // Tabs (reports.json tabs): sections without a tab stay above them.
  const tabs = definition.tabs || [];
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');

  // Names for "user" columns: the options of a users filter (the CRM filled them).
  const userNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of definition.filters) for (const o of f.options || []) map.set(o.value, o.label);
    return map;
  }, [definition.filters]);

  const body = useCallback(
    (only?: string[]) => ({
      filters: { from: range.from, to: range.to, ...values },
      params,
      ...(only ? { sections: only } : {}),
    }),
    [range, values, params]
  );

  const load = useCallback(
    async (only?: string[]) => {
      const mine = ++seq.current;
      setLoading(true);
      setError('');
      try {
        const res = await crmApi.getExtensionReportData(body(only));
        if (mine !== seq.current) return;
        setSections((prev) => ({ ...(only ? prev : {}), ...(res.data?.sections || {}) }));
      } catch (err) {
        if (mine === seq.current) setError(err instanceof Error ? err.message : 'The reports could not be loaded');
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [body]
  );

  // Filters change → every section reloads (a period change reloads only its section, below).
  const filterKey = JSON.stringify([range, values]);
  useEffect(() => {
    void load();
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPeriod = (sectionId: string, value: string) => {
    setParams((p) => ({ ...p, [sectionId]: value }));
  };
  const paramKey = JSON.stringify(params);
  const firstParams = useRef(true);
  useEffect(() => {
    if (firstParams.current) {
      firstParams.current = false;
      return;
    }
    const changed = Object.keys(params);
    if (changed.length) void load(changed);
  }, [paramKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setPreset(defaultPreset);
    setRange(presetRange(defaultPreset));
    setValues({});
  };
  const filtersOn = preset !== defaultPreset || Object.values(values).some(Boolean);

  const exportSection = async (section: ExtensionReportSectionDef) => {
    setExporting(section.id);
    try {
      const res = await crmApi.exportExtensionReport({ sectionId: section.id, ...body() });
      if (res.data?.csv !== undefined) triggerFileDownload({ filename: res.data.fileName || `${section.id}.csv`, content: res.data.csv, format: 'csv' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting('');
    }
  };

  const open = (link?: string) => {
    if (link) navigate(link);
  };

  /* ------------------------------------------------------------ section kinds */

  const items = (list: ExtensionReportItem[] | undefined, currency?: string) =>
    list && list.length ? (
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((i) => (
          <MetricCard
            key={i.key}
            label={i.label}
            value={formatValue(i.value, i.format, i.currency || currency)}
            hint={i.count !== undefined && i.format === 'money' ? `${i.count} records` : i.format === 'money' ? 'Value' : 'Count'}
            sub={i.hint || 'Selected filters'}
            to={i.link}
          />
        ))}
      </div>
    ) : null;

  const renderFunnel = (d: ExtensionReportSectionData) => {
    const stages = d.stages || [];
    const top = Math.max(1, stages[0]?.count || 0);
    return (
      <div className="flex flex-col gap-2" data-testid="report-funnel">
        {stages.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={!s.link}
            onClick={() => open(s.link)}
            className={`grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left ${s.link ? 'cursor-pointer hover:bg-muted' : 'cursor-default'}`}
          >
            <span className="text-xs font-semibold text-foreground">{s.label}</span>
            <span className="h-3 rounded bg-muted">
              <span className="block h-3 rounded bg-foreground/70" style={{ width: `${Math.max(2, Math.round((s.count / top) * 100))}%` }} />
            </span>
            <span className="flex items-center gap-3 font-mono text-xs">
              <span className="w-12 text-right font-bold text-foreground">{s.count.toLocaleString()}</span>
              <span className="w-24 text-right text-muted-foreground">{s.conversion === null || s.conversion === undefined ? '—' : `${s.conversion}% conv.`}</span>
              <span className="w-20 text-right text-red-700">{s.dropOff === null || s.dropOff === undefined ? '' : `−${s.dropOff}%`}</span>
            </span>
          </button>
        ))}
      </div>
    );
  };

  const renderGroups = (d: ExtensionReportSectionData) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {(d.items || []).map((i) => {
        const inner = (
          <>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{i.label}</div>
            <div className={`mt-1 font-mono text-xl font-bold ${TONE_TEXT[i.tone || 'neutral']}`}>{(i.count ?? i.value).toLocaleString()}</div>
            {i.format === 'money' ? <div className="text-xs font-semibold text-foreground">{formatValue(i.value, 'money', i.currency || d.currency)}</div> : null}
            {i.hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{i.hint}</div> : null}
          </>
        );
        const cls = `rounded-lg border bg-card p-3 text-inherit no-underline ${TONE[i.tone || 'neutral']}`;
        return i.link ? (
          <Link key={i.key} to={i.link} className={`${cls} hover:bg-muted`}>{inner}</Link>
        ) : (
          <div key={i.key} className={cls}>{inner}</div>
        );
      })}
    </div>
  );

  /** The graph of a table (data.chart): one point per row. */
  const tableChart = (d: ExtensionReportSectionData) => {
    const c = d.chart;
    const rows = d.rows || [];
    if (!c || !rows.length) return null;
    const fmtOf = (key?: string) => c.series.find((s) => s.key === key)?.format;
    const points = rows.map((r) => ({ label: String(r[c.labelKey] ?? ''), ...Object.fromEntries(c.series.map((s) => [s.key, Number(r[s.key]) || 0])) }));
    const tip = (v: number, _n: string, entry: { dataKey?: string | number }) => formatValue(Number(v), fmtOf(String(entry?.dataKey || '')), d.currency);
    if (c.type === 'pie') {
      const s = c.series[0];
      return (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={chart.tooltipStyle} formatter={(v: number) => formatValue(Number(v), s.format, d.currency)} />
              <Legend wrapperStyle={{ fontSize: 11, color: chart.legendColor }} />
              <Pie data={points} dataKey={s.key} nameKey="label" innerRadius={50} outerRadius={90} stroke={chart.sliceStroke}>
                {points.map((_p, i) => <Cell key={i} fill={chart.series[i % chart.series.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    const Chart = c.type === 'line' ? LineChart : BarChart;
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: chart.tick, fontSize: 11 }} axisLine={{ stroke: chart.axis }} tickLine={false} interval={0} />
            <YAxis tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={chart.tooltipStyle} formatter={tip} />
            <Legend wrapperStyle={{ fontSize: 11, color: chart.legendColor }} />
            {c.series.map((s, i) =>
              c.type === 'line' ? (
                <Line key={s.key} dataKey={s.key} name={s.label} stroke={chart.series[i % chart.series.length]} strokeWidth={2} dot={false} />
              ) : (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={chart.series[i % chart.series.length]} radius={[3, 3, 0, 0]} />
              )
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderTable = (d: ExtensionReportSectionData) => {
    const columns = d.columns || [];
    const rows = d.rows || [];
    if (!rows.length) return <div className="py-6 text-center text-xs text-muted-foreground">Nothing for these filters.</div>;
    const cell = (type: string, v: unknown) => {
      if (type === 'flags') {
        const list = Array.isArray(v) ? (v as string[]) : [];
        return list.length ? (
          <span className="flex flex-wrap gap-1">
            {list.map((f) => (
              <span key={f} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{f}</span>
            ))}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-emerald-700">Ready</span>
        );
      }
      if (type === 'money') return formatValue(v as number, 'money', d.currency);
      if (type === 'percent') return formatValue(v as number, 'percent');
      if (type === 'days') return formatValue(v as number, 'days');
      if (type === 'number') return formatValue(v as number);
      if (type === 'date') return v ? new Date(String(v)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      if (type === 'user') return userNames.get(String(v)) || String(v || '—');
      if (type === 'status') return v ? <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{String(v)}</span> : '—';
      return String(v ?? '') || '—';
    };
    return (
      <div className="flex flex-col gap-4">
      {items(d.items, d.currency)}
      {tableChart(d)}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th key={c.key} className={`px-2 py-2 text-[11px] font-semibold uppercase text-muted-foreground ${['number', 'money', 'percent', 'days'].includes(c.type) ? 'text-right' : ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={idx}
                onClick={() => open(r._link)}
                className={`border-b border-border/60 ${r._link ? 'cursor-pointer hover:bg-muted' : ''} ${r._tone === 'warning' ? 'bg-amber-50/40' : r._tone === 'danger' ? 'bg-red-50/40' : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-2 py-2 text-foreground ${['number', 'money', 'percent', 'days'].includes(c.type) ? 'text-right font-mono' : ''}`}>{cell(c.type, r[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {d.total && d.total > rows.length ? <p className="m-0 mt-2 text-[11px] text-muted-foreground">Showing {rows.length} of {d.total}.</p> : null}
      </div>
      </div>
    );
  };

  const renderChart = (d: ExtensionReportSectionData) => {
    const series = d.series || [];
    const points = (d.points || []).map((p) => ({ label: p.label, ...p.values }));
    const money = series.some((s) => s.format === 'money');
    const fmt = (v: number, key?: string) => formatValue(v, series.find((s) => s.key === key)?.format, d.currency);
    const Chart = d.type === 'line' ? LineChart : BarChart;
    return (
      <div className="flex flex-col gap-4">
        {items(d.items, d.currency)}
        {points.length ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Chart data={points} margin={{ top: 8, right: 8, left: money ? 24 : 0, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: chart.tick, fontSize: 11 }} axisLine={{ stroke: chart.axis }} tickLine={false} />
                <YAxis tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chart.tooltipStyle} formatter={(v: number, _n: string, entry: { dataKey?: string | number }) => fmt(Number(v), String(entry?.dataKey || ''))} />
                <Legend wrapperStyle={{ fontSize: 11, color: chart.legendColor }} />
                {series.map((s, i) =>
                  d.type === 'line' ? (
                    <Line key={s.key} dataKey={s.key} name={s.label} stroke={chart.series[i % chart.series.length]} strokeWidth={2} dot={false} />
                  ) : (
                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={chart.series[i % chart.series.length]} radius={[3, 3, 0, 0]} />
                  )
                )}
              </Chart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">No data for these filters.</div>
        )}
        {d.note ? <p className="m-0 text-[11px] text-muted-foreground">{d.note}</p> : null}
      </div>
    );
  };

  const renderSection = (s: ExtensionReportSectionDef) => {
    const d = sections[s.id];
    const content = !d ? (
      <div className="flex justify-center py-6"><CircularProgress size={18} /></div>
    ) : d.error ? (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{d.error}</div>
    ) : s.kind === 'kpis' ? (
      items(d.items, d.currency)
    ) : s.kind === 'funnel' ? (
      renderFunnel(d)
    ) : s.kind === 'groups' ? (
      renderGroups(d)
    ) : s.kind === 'table' ? (
      renderTable(d)
    ) : (
      renderChart(d)
    );
    const action = (
      <div className="flex items-center gap-2">
        {s.periods && s.periods.length ? (
          <select
            aria-label={`${s.title} period`}
            value={params[s.id] || s.periods[1]?.value || s.periods[0].value}
            onChange={(e) => setPeriod(s.id, e.target.value)}
            className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
          >
            {s.periods.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        ) : null}
        {s.export ? (
          <button
            type="button"
            disabled={exporting === s.id || !d || Boolean(d.error)}
            onClick={() => void exportSection(s)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold disabled:opacity-50"
          >
            <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} /> {exporting === s.id ? 'Exporting…' : 'CSV'}
          </button>
        ) : null}
      </div>
    );
    // Untitled KPI rows stand alone; everything else is a card.
    if (s.kind === 'kpis' && !s.title) return <div key={s.id} className="lg:col-span-2">{content}</div>;
    return (
      <div key={s.id} className={s.width === 'half' ? '' : 'lg:col-span-2'} data-testid={`report-section-${s.id}`}>
        <ChartCard title={s.title} subtitle={s.subtitle} action={action}>{content}</ChartCard>
      </div>
    );
  };

  const selects = definition.filters.filter((f) => f.type === 'select');
  return (
    <div className="flex w-full flex-col gap-5 pb-12" data-tour="reports-root">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-tight text-foreground">{definition.title}</h1>
          {definition.subtitle ? <p className="m-0 mt-1 text-xs text-muted-foreground">{definition.subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenCoreReports ? (
            <button type="button" onClick={onOpenCoreReports} className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold">
              Finance reports
            </button>
          ) : null}
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs font-semibold disabled:opacity-50">
            <RefreshIcon sx={{ fontSize: 16 }} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className={`${card} flex flex-wrap items-end gap-3`} data-testid="report-filters">
        {rangeFilter ? (
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
            {rangeFilter.label}
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                if (e.target.value !== 'custom') setRange(presetRange(e.target.value));
              }}
              className="h-9 rounded-lg border border-border bg-card px-2 text-xs text-foreground"
            >
              {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        ) : null}
        {rangeFilter && preset === 'custom' ? (
          <>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
              From
              <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-9 rounded-lg border border-border bg-card px-2 text-xs" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
              To
              <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-9 rounded-lg border border-border bg-card px-2 text-xs" />
            </label>
          </>
        ) : null}
        {selects.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
            {f.label}
            <select
              value={values[f.key] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="h-9 max-w-[180px] rounded-lg border border-border bg-card px-2 text-xs text-foreground"
            >
              <option value="">All</option>
              {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        ))}
        <button type="button" disabled={!filtersOn} onClick={reset} className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold disabled:opacity-40">
          Reset Filters
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{definition.sections.filter((s) => !s.tab || !tabs.length).map(renderSection)}</div>

      {tabs.length ? (
        <>
          <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" data-testid="report-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === activeTab}
                onClick={() => setActiveTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold ${t.id === activeTab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{definition.sections.filter((s) => s.tab === activeTab).map(renderSection)}</div>
        </>
      ) : null}
    </div>
  );
};
