import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import { crmApi } from '../../services/api';
import { formatCrmMoney } from '../../utils/currency';
import type {
  ExtensionDashboardListItem,
  ExtensionReportDefinition,
  ExtensionReportItem,
  ExtensionReportSectionData,
  ExtensionReportSectionDef,
} from '../../types/reports';
import { useNotifyMessage } from '@/components/notifications';

/**
 * The active extension's Dashboard (json/dashboard.json, CRM 3.31.0): a quick overview drawn from a few
 * simple section kinds — compact KPI cards, short action lists, steps, a progress bar and problem counts.
 * The extension supplies the data (through the CRM, permission-checked); nothing here knows the industry.
 */

const TONE_DOT: Record<string, string> = {
  neutral: 'bg-zinc-300',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
};
const TONE_BADGE: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
};

/** ₹8.4L / ₹3,450 — short money for an overview. */
function shortMoney(value: number, currency?: string): string {
  const n = Number(value) || 0;
  if ((currency || 'INR') === 'INR') {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
  }
  return formatCrmMoney(n, currency || undefined, { maximumFractionDigits: 0 });
}

const show = (i: ExtensionReportItem) => (i.format === 'money' ? shortMoney(i.value, i.currency) : i.format === 'percent' ? `${i.value}%` : Number(i.value).toLocaleString());

const box = 'rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60';

export const ExtensionDashboard: React.FC<{ definition: ExtensionReportDefinition }> = ({ definition }) => {
  const scopeFilter = definition.filters.find((f) => f.type === 'select');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(definition.filters.filter((f) => f.type === 'select' && f.default).map((f) => [f.key, String(f.default)]))
  );
  const [sections, setSections] = useState<Record<string, ExtensionReportSectionData> | null>(null);
  const [error, setError] = useState('');
  useNotifyMessage(error, 'error', () => setError(''));
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError('');
    try {
      const res = await crmApi.getExtensionDashboardData({ filters: values, params: {} });
      if (mine === seq.current) setSections(res.data?.sections || {});
    } catch (err) {
      if (mine === seq.current) setError(err instanceof Error ? err.message : 'The dashboard could not be loaded');
    }
  }, [values]);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map(definition.sections.map((s) => [s.id, s])), [definition.sections]);

  /* ------------------------------------------------------------ kinds */

  const kpis = (d: ExtensionReportSectionData) => (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(d.items || []).map((i) => {
        const inner = (
          <>
            <div className="text-xs font-medium text-muted-foreground">{i.label}</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">{show(i)}</div>
            {i.hint ? (
              <div className={`mt-1 text-xs ${i.tone === 'warning' || i.tone === 'danger' ? 'text-amber-700' : 'text-muted-foreground'}`}>{i.hint}</div>
            ) : null}
          </>
        );
        return i.link ? (
          <Link key={i.key} to={i.link} className={`${box} block text-inherit no-underline transition hover:ring-foreground/30`}>{inner}</Link>
        ) : (
          <div key={i.key} className={box}>{inner}</div>
        );
      })}
    </div>
  );

  const list = (d: ExtensionReportSectionData) => {
    const rows = (d.items || []) as unknown as ExtensionDashboardListItem[];
    if (!rows.length) return <p className="m-0 py-3 text-sm text-muted-foreground">{d.empty || 'Nothing to show.'}</p>;
    return (
      <ul className="m-0 flex list-none flex-col divide-y divide-border/60 p-0">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 py-3">
            <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[r.tone || 'neutral']}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{r.title}</div>
              {r.detail || r.meta ? (
                <div className="truncate text-xs text-muted-foreground">{[r.detail, r.meta].filter(Boolean).join(' · ')}</div>
              ) : null}
            </div>
            {r.badge ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[r.tone || 'neutral']}`}>{r.badge}</span> : null}
            {r.link ? (
              <Link to={r.link} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-foreground no-underline ring-1 ring-border hover:bg-muted">
                {r.actionLabel || 'Open'}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    );
  };

  const steps = (d: ExtensionReportSectionData) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(d.stages || []).map((s, i) => {
        const inner = (
          <>
            <div className="text-2xl font-bold text-foreground">{s.count.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </>
        );
        return (
          <div key={s.key} className="relative">
            {s.link ? (
              <Link to={s.link} className="block rounded-xl bg-muted/50 p-3 text-inherit no-underline hover:bg-muted">{inner}</Link>
            ) : (
              <div className="rounded-xl bg-muted/50 p-3">{inner}</div>
            )}
            {i < (d.stages || []).length - 1 ? <span className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-muted-foreground sm:block" aria-hidden>→</span> : null}
          </div>
        );
      })}
    </div>
  );

  const progress = (d: ExtensionReportSectionData) => {
    const pct = d.total ? Math.min(100, Math.round(((d.current || 0) / d.total) * 100)) : 0;
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {(d.items || []).map((i) => (
            <div key={i.key}>
              <div className="text-xs text-muted-foreground">{i.label}</div>
              <div className={`text-xl font-bold ${i.tone === 'warning' ? 'text-amber-700' : i.tone === 'success' ? 'text-emerald-700' : 'text-foreground'}`}>{show(i)}</div>
            </div>
          ))}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        {d.label ? <div className="text-xs text-muted-foreground">{d.label}</div> : null}
      </div>
    );
  };

  const counts = (d: ExtensionReportSectionData) => {
    const items = d.items || [];
    if (!items.length) return <p className="m-0 py-2 text-sm text-emerald-700">{d.empty || 'All clear.'}</p>;
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((i) => {
          const inner = (
            <>
              <div className={`text-2xl font-bold ${i.tone === 'danger' ? 'text-red-700' : i.tone === 'warning' ? 'text-amber-700' : 'text-foreground'}`}>{(i.count ?? i.value).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{i.label}</div>
            </>
          );
          return i.link ? (
            <Link key={i.key} to={i.link} className="rounded-xl bg-muted/50 p-3 text-inherit no-underline hover:bg-muted">{inner}</Link>
          ) : (
            <div key={i.key} className="rounded-xl bg-muted/50 p-3">{inner}</div>
          );
        })}
      </div>
    );
  };

  const section = (s: ExtensionReportSectionDef) => {
    const d = sections ? sections[s.id] : null;
    if (sections && !d) return null; // not allowed for this user
    const content = !d ? (
      <div className="flex justify-center py-4"><CircularProgress size={18} /></div>
    ) : d.error ? (
      <p className="m-0 text-xs text-red-700">{d.error}</p>
    ) : s.kind === 'kpis' ? (
      kpis(d)
    ) : s.kind === 'list' ? (
      list(d)
    ) : s.kind === 'steps' ? (
      steps(d)
    ) : s.kind === 'progress' ? (
      progress(d)
    ) : s.kind === 'groups' ? (
      counts(d)
    ) : null;
    if (s.kind === 'kpis' && !s.title) return <div key={s.id} className="lg:col-span-2">{content}</div>;
    return (
      <section key={s.id} className={`${box} ${s.width === 'half' ? '' : 'lg:col-span-2'}`} data-testid={`dashboard-section-${s.id}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="m-0 text-base font-semibold text-foreground">{s.title}</h2>
          {d && d.more ? (
            <Link to={d.more.link} className="text-xs font-semibold text-foreground no-underline hover:underline">{d.more.label}</Link>
          ) : null}
        </div>
        {content}
      </section>
    );
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-12" data-tour="dashboard-root">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-tight text-foreground">{definition.title}</h1>
          {definition.subtitle ? <p className="m-0 mt-1 text-sm text-muted-foreground">{definition.subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scopeFilter && scopeFilter.options && scopeFilter.options.length <= 3 ? (
            <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label={scopeFilter.label}>
              {scopeFilter.options.map((o) => {
                const on = (values[scopeFilter.key] || '') === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setValues((v) => ({ ...v, [scopeFilter.key]: o.value }))}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {(definition.actions || []).map((a) => (
            <Link key={a.link} to={a.link} className="inline-flex h-9 items-center rounded-lg bg-foreground px-3.5 text-xs font-semibold text-background no-underline hover:opacity-90">
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {definition.sections.map((s) => section(byId.get(s.id) || s))}
      </div>
    </div>
  );
};
