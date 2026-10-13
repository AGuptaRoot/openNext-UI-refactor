import React, { useCallback, useEffect, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { crmApi } from '../../services/api';
import { TourButton } from '../../ui/tour';
import type { AdminPagination, AuditEntry } from '../../types/admin';
import { displayUserLabel } from '../../utils/displayLabels';

const modules = [
  '',
  'lead',
  'client',
  'contact',
  'project',
  'milestone',
  'task',
  'time_log',
  'quotation',
  'invoice',
  'payment',
  'expense',
  'settings',
  'tenant_security',
];
const fieldClass = 'h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500';

function formatModule(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const AuditPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [recordType, setRecordType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const response = await crmApi.getAuditHistory({ page, limit: 25, recordType, search });
        setEntries(response.data || []);
        setPagination(
          response.pagination || {
            page,
            limit: 25,
            total: response.data?.length || 0,
            totalPages: 1,
          }
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Failed to load audit history');
      } finally {
        setLoading(false);
      }
    },
    [recordType, search]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div data-tour="audit-tour-landing" className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div data-tour="audit-title">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">
            Administration
          </p>
          <h1 className="m-0 text-2xl font-bold">Audit history</h1>
          <p className="mb-0 mt-1 text-sm text-zinc-500">
            Review immutable activity across CRM records and settings.
          </p>
        </div>
        <div data-tour="audit-header-actions" className="flex flex-wrap items-center gap-2">
          <TourButton moduleId="audit" />
        </div>
      </header>

      <section
        data-tour="audit-filters"
        className="rounded-xl border border-zinc-300 bg-white p-4 shadow-sm"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
          className="flex flex-col gap-3 md:flex-row"
        >
          <label data-tour="audit-search" className="relative min-w-0 flex-1">
            <SearchIcon sx={{ fontSize: 18 }} className="absolute left-3 top-3 text-zinc-400" />
            <input
              className={`${fieldClass} box-border w-full pl-9`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={120}
              placeholder="Search actor, action, record, or description…"
            />
          </label>
          <select
            data-tour="audit-record-type"
            className={fieldClass}
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
          >
            <option value="">All record types</option>
            {modules.filter(Boolean).map((module) => (
              <option key={module} value={module}>
                {formatModule(module)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => void load(pagination.page)}
            aria-label="Refresh audit history"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-zinc-600"
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </button>
        </form>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section
        data-tour="audit-table"
        className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {entries.map((entry) => {
                const actor = displayUserLabel(
                  entry.actorName || entry.username,
                  entry.username,
                  'System'
                );
                return (
                  <tr key={entry._id} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{actor}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold">
                        {formatModule(entry.module)}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize">{entry.action.replace(/_/g, ' ')}</td>
                    <td className="max-w-40 truncate px-4 py-3 text-xs text-zinc-500">—</td>
                    <td className="max-w-md px-4 py-3 text-zinc-600">{entry.description || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="p-10 text-center text-sm text-zinc-500">Loading audit history…</div>
        )}
        {!loading && !entries.length && (
          <div className="p-10 text-center">
            <p className="m-0 font-semibold">No audit entries found</p>
            <p className="mb-0 mt-1 text-sm text-zinc-500">Try widening your filters.</p>
          </div>
        )}
        <footer
          data-tour="audit-pagination"
          className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500"
        >
          <span>{pagination.total} entries</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => void load(pagination.page - 1)}
              className="rounded border border-zinc-200 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => void load(pagination.page + 1)}
              className="rounded border border-zinc-200 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
