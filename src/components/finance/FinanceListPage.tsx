import React, { useCallback, useEffect, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';

export interface FinanceListColumn<T> {
  label: string;
  value: (item: T) => React.ReactNode;
}

interface FinanceListPageProps<T extends { _id: string }> {
  title: string;
  eyebrow: string;
  description: string;
  createLabel: string;
  createPath: string;
  searchPlaceholder: string;
  load: (search: string) => Promise<T[]>;
  columns: FinanceListColumn<T>[];
}

export function FinanceListPage<T extends { _id: string }>({
  title,
  eyebrow,
  description,
  createLabel,
  createPath,
  searchPlaceholder,
  load,
  columns,
}: FinanceListPageProps<T>) {
  const navigate = useNavigate();
  const [items, setItems] = useState<T[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await load(search.trim()));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [load, search, title]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 250);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">{eyebrow}</p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0">{title}</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">{description}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer">
            <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
          </button>
          <button type="button" onClick={() => navigate(createPath)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer">
            <AddIcon sx={{ fontSize: 16 }} /> {createLabel}
          </button>
        </div>
      </header>

      <div className="bg-white border border-zinc-300 rounded-xl p-4">
        <label className="flex flex-col gap-1 max-w-xl">
          <span className="text-[11px] font-semibold uppercase text-zinc-500">Search</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} className="h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 bg-white" />
        </label>
      </div>

      {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{error}</div>}
      <div className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500 animate-pulse">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[760px]">
              <thead><tr className="bg-zinc-50 border-b border-zinc-200">{columns.map((column) => <th key={column.label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{column.label}</th>)}</tr></thead>
              <tbody>{items.map((item) => <tr key={item._id} className="border-b border-zinc-100 hover:bg-zinc-50">{columns.map((column) => <td key={column.label} className="px-4 py-3 text-xs text-zinc-700">{column.value(item)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function formatFinanceMoney(value: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString('en-IN')}`;
  }
}
