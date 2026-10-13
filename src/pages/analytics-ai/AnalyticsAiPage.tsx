import React, { useCallback, useEffect, useState } from 'react';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { crmApi } from '../../services/api';
import type { AnalyticsSalesData } from '../../types/admin';

function money(value?: number) {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export const AnalyticsAiPage: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const initialFrom = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<AnalyticsSalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await crmApi.getAnalyticsAiSales({ from, to });
      setData(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const summary = data?.summary || data?.executiveSummary || {};
  const cards = [
    ['Pipeline value', money(summary.unweightedPipelineTotal)],
    ['Weighted pipeline', money(summary.weightedPipelineTotal)],
    ['Realized revenue', money(summary.totalRealizedRevenue)],
    ['Average deal', money(summary.averageDealSize)],
  ];
  const hasMetrics = Object.values(summary).some((value) => typeof value === 'number');

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end"><div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Intelligence</p><h1 className="m-0 flex items-center gap-2 text-2xl font-bold"><AutoAwesomeOutlinedIcon />Analytics AI</h1><p className="mb-0 mt-1 text-sm text-zinc-500">API-powered sales performance and revenue forecasting.</p></div><form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap gap-2"><input aria-label="From date" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm" /><input aria-label="To date" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm" /><button aria-label="Refresh analytics" className="inline-flex h-10 items-center gap-2 rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white"><RefreshIcon sx={{ fontSize: 17 }} />Refresh</button></form></header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-xl border border-zinc-300 bg-white p-5 shadow-sm"><p className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p><p className="mb-0 mt-2 text-2xl font-bold">{loading ? '…' : value}</p></div>)}</section>
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[['30-day forecast', data?.forecast?.forecast30d], ['60-day forecast', data?.forecast?.forecast60d], ['90-day forecast', data?.forecast?.forecast90d]].map(([label, value]) => <div key={label as string} className="rounded-xl border border-zinc-300 bg-white p-5 shadow-sm"><p className="m-0 text-sm font-semibold text-zinc-600">{label}</p><p className="mb-0 mt-3 text-xl font-bold">{loading ? 'Loading…' : money(value as number | undefined)}</p></div>)}
      </section>
      {!loading && !hasMetrics && <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center"><AutoAwesomeOutlinedIcon className="text-zinc-400" sx={{ fontSize: 32 }} /><h2 className="mb-1 mt-3 text-base">Analytics metrics are ready for API data</h2><p className="mx-auto mb-0 max-w-lg text-sm text-zinc-500">No metrics were returned for this period. Data will appear automatically when the Analytics AI endpoint has accessible CRM activity.</p></section>}
      {data?.forecast?.confidenceScore !== undefined && <p className="text-right text-xs text-zinc-500">Forecast confidence: {data.forecast.confidenceScore}%</p>}
    </div>
  );
};
