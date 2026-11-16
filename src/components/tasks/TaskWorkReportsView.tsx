import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNotifyMessage } from '@/components/notifications';
import { crmApi } from '../../services/api';
import type { WorkReportEmployees } from '../../types/workReports';
import { formatHours, localIsoDate, plural } from './workReportFormat';

/**
 * Tasks → Reports: every employee (CRM manager) or every member of the manager's projects
 * (project manager) with the chosen day's work and the month to date. A row opens the employee's report.
 */
export const TaskWorkReportsView: React.FC = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(() => localIsoDate(new Date()));
  const [search, setSearch] = useState('');
  const [data, setData] = useState<WorkReportEmployees | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useNotifyMessage(error, 'error');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await crmApi.getWorkReportEmployees(date);
      setData(res.data || null);
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : 'The work report could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const items = data?.items || [];
    return term ? items.filter((row) => row.name.toLowerCase().includes(term)) : items;
  }, [data, search]);

  const openReport = (userId: string) => navigate(`/tasks/reports/${encodeURIComponent(userId)}?date=${date}`);
  const isToday = date === localIsoDate(new Date());

  return (
    <section data-tour="tasks-reports" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Employees', value: data ? String(data.totals.employees) : '—' },
          { label: isToday ? 'Working today' : 'Worked that day', value: data ? String(data.totals.activeToday) : '—' },
          { label: isToday ? 'Hours today' : 'Hours that day', value: data ? formatHours(data.totals.hoursToday) : '—' },
          { label: data ? `Hours in ${data.monthLabel}` : 'Hours this month', value: data ? formatHours(data.totals.hoursMonth) : '—' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-300 bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Day</span>
          <input
            type="date"
            value={date}
            max={localIsoDate(new Date())}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
          />
        </label>
        <label className="relative flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Search employee</span>
          <span className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name"
              className="h-9 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-900"
            />
            <SearchIcon
              sx={{ fontSize: 16 }}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
          </span>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
        </button>
        {data?.scope === 'projects' && (
          <p className="m-0 basis-full text-xs text-zinc-500">
            Showing the people on your projects and the hours logged on those projects.
          </p>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500 animate-pulse">
          Loading work report…
        </div>
      ) : !error && rows.length === 0 ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center">
          <p className="m-0 mb-1 text-sm font-semibold text-zinc-900">No employees found</p>
          <p className="m-0 text-xs text-zinc-500">
            {search ? 'No one matches that name.' : 'People appear here once they are on a project or have a task assigned.'}
          </p>
        </div>
      ) : rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5 text-right">{isToday ? 'Today' : data?.date}</th>
                  <th className="px-4 py-2.5 text-right">Entries</th>
                  <th className="px-4 py-2.5 text-right">Tasks</th>
                  <th className="px-4 py-2.5 text-right">Pending approval</th>
                  <th className="px-4 py-2.5 text-right">{data?.monthLabel || 'Month'}</th>
                  <th className="px-4 py-2.5 text-right">Open tasks</th>
                  <th className="px-4 py-2.5" aria-label="Open report" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.userId}
                    onClick={() => openReport(row.userId)}
                    className="cursor-pointer border-b border-zinc-100 text-sm text-zinc-800 last:border-b-0 hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReport(row.userId);
                        }}
                        className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold text-zinc-950 hover:underline"
                      >
                        {row.name}
                      </button>
                      {row.today.running && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Timer running
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {row.today.entries ? formatHours(row.today.hours) : <span className="font-normal text-zinc-400">No time logged</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.today.entries}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.today.tasks}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.today.pendingHours ? formatHours(row.today.pendingHours) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatHours(row.month.hours)}
                      <span className="block text-[11px] text-zinc-500">{plural(row.month.daysWorked, 'day')}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.openTasks}</td>
                    <td className="px-2 py-3 text-right text-zinc-400">
                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default TaskWorkReportsView;
