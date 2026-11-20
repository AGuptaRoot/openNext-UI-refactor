import React from 'react';
import type { EmployeeWorkReport } from '../../types/workReports';
import { formatHours, plural } from './workReportFormat';

/**
 * CRM 3.60.0 — the one graph of the employee work report page: hours per day (monthly) or hours per
 * task (daily). Kept simple: one colour, no extra cards.
 */

/** Monthly: one bar per day. Click a day to open it. */
export const DayChart: React.FC<{ report: EmployeeWorkReport; today: string; onOpenDay: (date: string) => void }> = ({ report, today, onOpenDay }) => {
  const days = report.days;
  const max = Math.max(1, ...days.map((d) => d.hours));
  const top = Math.ceil(max);
  return (
    <section className="rounded-xl border border-zinc-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-sm font-bold text-zinc-950">Hours per day</h2>
        <span className="text-xs text-zinc-500">
          Peak {formatHours(max === 1 && !days.some((d) => d.hours) ? 0 : max)} · click a day to open it
        </span>
      </div>
      <div className="flex gap-2">
        <div className="flex h-44 flex-col justify-between pb-5 text-right text-[10px] tabular-nums text-zinc-400" aria-hidden="true">
          <span>{top}h</span>
          <span>{Math.round(top / 2)}h</span>
          <span>0h</span>
        </div>
        <div className="flex h-44 min-w-0 flex-1 items-end gap-[3px] border-b border-l border-zinc-200 pl-1">
          {days.map((d) => {
            const day = Number(d.date.slice(8, 10));
            const future = d.date > today;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!d.entries}
                onClick={() => onOpenDay(d.date)}
                title={`${d.date}: ${formatHours(d.hours)}${d.entries ? ` · ${plural(d.entries, 'entry', 'entries')}` : ''}`}
                className="group relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end border-0 bg-transparent p-0 disabled:cursor-default"
              >
                <span
                  className="w-full max-w-[18px] rounded-t bg-zinc-800 transition-opacity group-hover:opacity-70"
                  style={{ height: d.hours ? `${Math.max(2, (d.hours / top) * 100)}%` : 0 }}
                />
                <span
                  className={`absolute -bottom-5 text-[9px] tabular-nums ${future ? 'text-zinc-300' : 'text-zinc-500'}`}
                >
                  {day}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-6" />
    </section>
  );
};

export const TaskBars: React.FC<{ report: EmployeeWorkReport; title: string; limit: number }> = ({ report, title, limit }) => {
  const tasks = report.tasks.filter((t) => t.hours > 0).slice(0, limit);
  const max = Math.max(0.01, ...tasks.map((t) => t.hours));
  return (
    <section className="rounded-xl border border-zinc-300 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-sm font-bold text-zinc-950">{title}</h2>
        <span className="text-xs text-zinc-500">{plural(report.tasks.length, 'task')}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-zinc-500">No time logged in this period.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {tasks.map((t) => (
            <li key={t.taskId || t.title} className="grid grid-cols-[minmax(0,40%)_1fr_auto] items-center gap-3">
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-zinc-900" title={t.title}>{t.title}</span>
                {t.projectName && <span className="block truncate text-[11px] text-zinc-500">{t.projectName}</span>}
              </span>
              <span className="relative h-2.5 overflow-hidden rounded-full bg-zinc-100">
                <span className="absolute inset-y-0 left-0 rounded-full bg-zinc-800" style={{ width: `${(t.hours / max) * 100}%` }} />
              </span>
              <span className="w-16 text-right text-xs font-bold tabular-nums text-zinc-900">{formatHours(t.hours)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
