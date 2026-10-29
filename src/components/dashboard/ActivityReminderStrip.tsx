import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, X } from 'lucide-react';

import type { DashboardData } from '../../types/dashboard';
import {
  REMINDER_WINDOW_MINUTES,
  collectCalendarEvents,
  countdownLabel,
  dismissReminder,
  dueSoonActivities,
  loadDismissedKeys,
} from '../../utils/activityReminders';

interface ActivityReminderStripProps {
  data: DashboardData;
}

/** Re-check the clock often enough for the countdown to stay honest. */
const TICK_MS = 30_000;

/**
 * Reminder for scheduled activities about to start.
 *
 * Appears once an activity is inside the reminder window and disappears when it
 * starts — past that point it is the Missed badge's job, not a reminder's. Each
 * row can be dismissed, which is remembered in this browser for a day so the
 * strip does not nag after the rep has seen it.
 */
export const ActivityReminderStrip: React.FC<ActivityReminderStripProps> = ({ data }) => {
  const [now, setNow] = useState(() => new Date());
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissedKeys());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const events = useMemo(() => collectCalendarEvents(data), [data]);
  const rows = useMemo(
    () => dueSoonActivities(events, now).filter((row) => !dismissed.has(row.key)),
    [events, now, dismissed]
  );

  if (!rows.length) return null;

  const hide = (key: string) => {
    dismissReminder(key);
    setDismissed((current) => new Set(current).add(key));
  };

  return (
    <section
      data-tour="dashboard-activity-reminders"
      aria-label="Activities starting soon"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <AlarmClock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <h2 className="m-0 text-sm font-bold text-amber-900">
          {rows.length === 1
            ? 'An activity is starting soon'
            : `${rows.length} activities are starting soon`}
        </h2>
        <span className="ml-auto text-[11px] font-medium text-amber-700">
          next {REMINDER_WINDOW_MINUTES} minutes
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-white px-3 py-2"
          >
            <span className="text-xs font-bold text-zinc-950">{row.title}</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
              {row.type}
            </span>
            {row.entityName ? (
              <span className="text-xs text-zinc-600">{row.entityName}</span>
            ) : null}
            <span className="text-xs font-semibold text-amber-800">
              {countdownLabel(row.minutesUntil)} ·{' '}
              {row.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {row.assignedToLabel ? (
              <span className="text-[11px] text-zinc-500">{row.assignedToLabel}</span>
            ) : null}

            <span className="ml-auto flex items-center gap-1.5">
              {row.entityId ? (
                <Link
                  to={`/leads/${row.entityId}?tab=activities`}
                  className="inline-flex h-7 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-800 no-underline hover:bg-zinc-50"
                >
                  Open lead
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => hide(row.key)}
                aria-label={`Dismiss reminder for ${row.title}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-zinc-500 cursor-pointer hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
