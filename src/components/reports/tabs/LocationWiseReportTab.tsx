import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, MapPin, Percent, Users } from 'lucide-react';
import CircularProgress from '@mui/material/CircularProgress';

import { crmApi } from '../../../services/api';
import type { AssignableUser } from '../../../types/leads';
import type { LocationWiseQuery, LocationWiseReport, LocationWiseRow } from '../../../types/reports';
import { MetricCard, MetricGrid, ReportEmptyState } from '../ReportCharts';

export interface LocationWiseReportTabProps {
  /** Starting date range (the page's current range). */
  initialFrom?: string;
  initialTo?: string;
  /** Whether this user may pick a sales person (sales reps only ever see their own records). */
  canPickSalesPerson: boolean;
}

type Filters = Required<Pick<LocationWiseQuery, 'from' | 'to' | 'state' | 'district' | 'city' | 'assignedTo' | 'source'>>;

const selectClass = 'h-8 min-w-[140px] rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 outline-none';
const inputClass = 'h-8 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 outline-none';

function formatRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '—' : `${rate.toFixed(1)}%`;
}

/** Query string for a drill-down into the Leads / Clients list (lists do not filter by date). */
function drillQuery(row: LocationWiseRow, filters: Filters): string {
  const qs = new URLSearchParams();
  Object.entries(row.filter || {}).forEach(([key, value]) => {
    if (value) qs.set(key, String(value));
  });
  if (filters.source) qs.set('source', filters.source);
  if (filters.assignedTo) qs.set('assignedTo', filters.assignedTo);
  return qs.toString();
}

/**
 * Location Wise Leads & Clients: State → District → City with leads, clients, converted leads and the
 * conversion rate. All counting is done on the server; this tab only shows the grouped rows.
 */
export const LocationWiseReportTab: React.FC<LocationWiseReportTabProps> = ({ initialFrom = '', initialTo = '', canPickSalesPerson }) => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({
    from: initialFrom,
    to: initialTo,
    state: '',
    district: '',
    city: '',
    assignedTo: '',
    source: '',
  });
  const [data, setData] = useState<LocationWiseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const seq = useRef(0);

  const canPick = canPickSalesPerson && data?.meta?.canFilterSalesPerson !== false;

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const res = await crmApi.getLocationWiseReport(filters);
      if (mine === seq.current) setData(res.data || null);
    } catch (err: unknown) {
      if (mine === seq.current) setError(err instanceof Error ? err.message : 'Failed to load the location report');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canPickSalesPerson) return;
    let alive = true;
    crmApi
      .getAssignableUsers()
      .then((res) => {
        if (alive) setUsers(res.data || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [canPickSalesPerson]);

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // A narrower location belongs to the wider one; changing the wider one clears it.
      if (key === 'state') {
        next.district = '';
        next.city = '';
      }
      if (key === 'district') next.city = '';
      return next;
    });
  };

  const resetFilters = () =>
    setFilters({ from: initialFrom, to: initialTo, state: '', district: '', city: '', assignedTo: '', source: '' });

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** Visible rows in display order, with their depth. */
  const visibleRows = useMemo(() => {
    const out: Array<{ row: LocationWiseRow; depth: number }> = [];
    const walk = (rows: LocationWiseRow[], depth: number) => {
      for (const row of rows) {
        out.push({ row, depth });
        if (row.children?.length && expanded.has(row.key)) walk(row.children, depth + 1);
      }
    };
    walk(data?.rows || [], 0);
    return out;
  }, [data, expanded]);

  const options = data?.options || { states: [], districts: [], cities: [], leadSources: [] };
  const summary = data?.summary;

  const numberLink = (value: number, path: '/leads' | '/clients', row: LocationWiseRow, label: string) =>
    value > 0 ? (
      <button
        type="button"
        onClick={() => navigate(`${path}?${drillQuery(row, filters)}`)}
        title={`Open ${label} for ${row.name}`}
        className="cursor-pointer border-0 bg-transparent p-0 font-mono text-xs font-semibold text-blue-700 underline-offset-2 hover:underline"
      >
        {value}
      </button>
    ) : (
      <span className="font-mono text-xs text-zinc-400">0</span>
    );

  return (
    <div data-tour="report-tab-location-wise" className="flex flex-col gap-5">
      {/* Filters */}
      <section className="flex w-full flex-row flex-wrap items-end gap-3 rounded-xl border border-zinc-300 bg-white p-3.5">
        <label className="inline-flex flex-col items-start gap-1 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">State</span>
          <select className={selectClass} value={filters.state} onChange={(e) => setFilter('state', e.target.value)}>
            <option value="">All states</option>
            {options.states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex flex-col items-start gap-1 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">District</span>
          <select className={selectClass} value={filters.district} onChange={(e) => setFilter('district', e.target.value)}>
            <option value="">All districts</option>
            {options.districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex flex-col items-start gap-1 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">City</span>
          <select className={selectClass} value={filters.city} onChange={(e) => setFilter('city', e.target.value)}>
            <option value="">All cities</option>
            {options.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex flex-col items-start gap-1 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Date from</span>
          <input type="date" className={inputClass} value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="inline-flex flex-col items-start gap-1 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Date to</span>
          <input type="date" className={inputClass} value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        </label>
        {canPick ? (
          <label className="inline-flex flex-col items-start gap-1 text-left">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Sales person</span>
            <select className={selectClass} value={filters.assignedTo} onChange={(e) => setFilter('assignedTo', e.target.value)}>
              <option value="">All sales people</option>
              {users.map((u) => {
                const id = u.id || u._id || u.userId || '';
                return id ? (
                  <option key={id} value={id}>
                    {u.displayName || u.name || u.username || id}
                  </option>
                ) : null;
              })}
            </select>
          </label>
        ) : null}
        <label className="inline-flex flex-col items-start gap-1 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Lead source</span>
          <select className={selectClass} value={filters.source} onChange={(e) => setFilter('source', e.target.value)}>
            <option value="">All sources</option>
            {options.leadSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={resetFilters}
            className="h-8 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-8 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </section>

      {error ? <ReportEmptyState message={error} /> : null}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white p-12">
          <CircularProgress size={22} />
          <span className="text-xs text-zinc-500">Loading location report…</span>
        </div>
      ) : null}

      {data && summary ? (
        <>
          <MetricGrid>
            <MetricCard
              label="Total Leads"
              value={summary.totalLeads}
              icon={<Users className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
              hint="Leads"
              sub={`${summary.convertedLeads} converted`}
            />
            <MetricCard
              label="Total Clients"
              value={summary.totalClients}
              icon={<Building2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
              hint="Clients"
              sub="By billing address"
            />
            <MetricCard
              label="Top Location"
              value={summary.topLocation ? summary.topLocation.name : '—'}
              icon={<MapPin className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
              hint="Most leads"
              sub={summary.topLocation ? `${summary.topLocation.leads} leads` : 'No leads yet'}
            />
            <MetricCard
              label="Best Conversion Location"
              value={summary.bestConversion ? summary.bestConversion.name : '—'}
              icon={<Percent className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
              hint="Conversion"
              sub={
                summary.bestConversion
                  ? `${formatRate(summary.bestConversion.rate)} of ${summary.bestConversion.leads} leads`
                  : `Needs ${data.meta?.bestConversionMinLeads ?? 5}+ leads in a location`
              }
            />
          </MetricGrid>

          {data.rows.length === 0 ? (
            <ReportEmptyState message="No leads or clients match these filters." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2.5">Location</th>
                    <th className="px-3 py-2.5 text-right">Leads</th>
                    <th className="px-3 py-2.5 text-right">Clients</th>
                    <th className="px-3 py-2.5 text-right">Converted Leads</th>
                    <th className="px-3 py-2.5 text-right">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(({ row, depth }) => {
                    const hasChildren = Boolean(row.children?.length);
                    const isOpen = expanded.has(row.key);
                    return (
                      <tr key={row.key} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggle(row.key)}
                                aria-expanded={isOpen}
                                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${row.name}`}
                                className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-zinc-500 hover:bg-zinc-200"
                              >
                                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            ) : (
                              <span className="inline-block h-5 w-5" />
                            )}
                            <span className={depth === 0 ? 'font-semibold text-zinc-900' : 'text-zinc-800'}>{row.name}</span>
                            <span className="ml-1 text-[10px] uppercase tracking-wider text-zinc-400">
                              {row.key === 'not-set' ? '' : row.level}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{numberLink(row.leads, '/leads', row, 'leads')}</td>
                        <td className="px-3 py-2 text-right">{numberLink(row.clients, '/clients', row, 'clients')}</td>
                        <td className="px-3 py-2 text-right">{numberLink(row.converted, '/leads', row, 'leads')}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatRate(row.rate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="m-0 text-[11px] text-zinc-500">
            Leads and converted leads use the lead&apos;s own location and created date; clients use the billing
            address and the client&apos;s created date. The Leads and Clients lists open with the location, lead source and
            sales person filters (they do not filter by date).
          </p>
        </>
      ) : null}
    </div>
  );
};
