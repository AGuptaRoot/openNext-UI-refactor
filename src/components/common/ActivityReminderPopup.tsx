import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, BellRing, X } from 'lucide-react';

import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ActivityReminderRow } from '../../types/leads';
import {
  REMINDER_WINDOW_MINUTES,
  countdownLabel,
  latenessLabel,
  loadSnoozedKeys,
  snoozeReminder,
} from '../../utils/activityReminders';

/** How often the reminder comes back while the user stays signed in. */
const POLL_MS = 60 * 60 * 1000;

/**
 * Hourly reminder for the activities assigned to the signed-in user.
 *
 * Shows once when the CRM is opened and again every hour, listing scheduled
 * activities that are about to start or were missed. Snoozing a row hides that
 * one activity for an hour; the next sweep brings it back if it is still open,
 * so nothing quietly disappears before it is marked Completed.
 *
 * Deliberately client-side: the reminder follows the person who is logged in,
 * and leaves no state behind on the server.
 */
export const ActivityReminderPopup: React.FC = () => {
  const { isClient, hasPermission, isAdmin, activeRole } = useAuth();
  const canSeeLeads = hasPermission('crm.leads.read');
  const isManagerOrAdmin = isAdmin || activeRole === 'sales-manager' || activeRole === 'crm-manager';

  const [rows, setRows] = useState<ActivityReminderRow[]>([]);
  const [missedCount, setMissedCount] = useState(0);
  const [unreachedCount, setUnreachedCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [snoozed, setSnoozed] = useState<Set<string>>(() => loadSnoozedKeys());

  const sweep = useCallback(async () => {
    try {
      const res = await crmApi.getActivityReminders({
        scope: isManagerOrAdmin ? 'team' : 'mine',
        windowMinutes: REMINDER_WINDOW_MINUTES,
      });
      const feed = res.data;
      const fresh = loadSnoozedKeys();
      const all = [...(feed?.missed || []), ...(feed?.dueSoon || [])].filter(
        (row) => !fresh.has(row.id)
      );
      setSnoozed(fresh);
      const missedList = feed?.missed || [];
      setMissedCount(missedList.length);
      setUnreachedCount(
        missedList.filter((r) => r.notReachedGoal || (r.hasGoal && !r.reachedGoalArea)).length
      );
      setRows(all);
      setOpen(all.length > 0);
    } catch {
      // A reminder that fails to load must never interrupt the app.
    }
  }, [isManagerOrAdmin]);

  useEffect(() => {
    if (isClient || !canSeeLeads) return undefined;
    void sweep();
    const timer = window.setInterval(() => void sweep(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [isClient, canSeeLeads, sweep]);

  const visible = useMemo(() => rows.filter((row) => !snoozed.has(row.id)), [rows, snoozed]);

  if (isClient || !canSeeLeads || !open || !visible.length) return null;

  const snooze = (id: string) => {
    snoozeReminder(id);
    setSnoozed((current) => new Set(current).add(id));
  };

  return (
    <aside
      aria-label="Activity reminders"
      className="fixed bottom-4 right-4 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-zinc-300 bg-white shadow-xl"
    >
      <header className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
        <BellRing className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
        <h2 className="m-0 text-xs font-bold text-zinc-950">
          {visible.length === 1 ? '1 activity needs you' : `${visible.length} activities need you`}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close reminders"
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-zinc-500 cursor-pointer hover:bg-zinc-100 hover:text-zinc-900"
        >
          <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      </header>

      {missedCount > 0 ? (
        <p className="m-0 border-b border-red-200 bg-red-50 px-4 py-2 text-[11px] font-semibold text-red-900">
          {unreachedCount > 0
            ? `${unreachedCount} missed activity with goal place not reached!`
            : missedCount === 1
            ? '1 activity was missed — mark it Completed or reschedule it.'
            : `${missedCount} activities were missed — mark them Completed or reschedule them.`}
        </p>
      ) : null}

      <ul className="m-0 flex max-h-80 list-none flex-col gap-2 overflow-y-auto p-3">
        {visible.map((row) => {
          const late = typeof row.minutesLate === 'number';
          const unreachedGoal = Boolean(row.notReachedGoal || (row.hasGoal && !row.reachedGoalArea));
          return (
            <li
              key={row.id}
              className={`rounded-lg border px-3 py-2 ${
                late ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlarmClock
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${late ? 'text-red-600' : 'text-zinc-500'}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-xs font-bold text-zinc-950">{row.title}</p>
                  <p className="m-0 mt-0.5 text-[11px] text-zinc-600">
                    {row.eventType}
                    {row.leadName ? ` · ${row.leadName}` : ''}
                  </p>
                  {isManagerOrAdmin && row.assignedToLabel ? (
                    <p className="m-0 mt-0.5 text-[10px] text-zinc-500 font-medium">
                      Rep: {row.assignedToLabel}
                    </p>
                  ) : null}
                  <p
                    className={`m-0 mt-0.5 text-[11px] font-semibold ${
                      late ? 'text-red-700' : 'text-blue-700'
                    }`}
                  >
                    {late
                      ? `Missed · ${latenessLabel(row.minutesLate || 0)}`
                      : countdownLabel(row.minutesUntil || 0)}
                  </p>
                  {unreachedGoal ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded bg-red-100 border border-red-200 px-1.5 py-0.5 text-[9px] font-bold text-red-800">
                      Goal Place Not Reached
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => snooze(row.id)}
                  title="Hide this reminder for an hour"
                  className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700 cursor-pointer hover:bg-zinc-50"
                >
                  Snooze
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <Link
                  to={`/activities/${row.id}`}
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-semibold text-blue-700 no-underline hover:underline"
                >
                  View Activity
                </Link>
                {row.leadId ? (
                  <Link
                    to={`/leads/${row.leadId}?tab=activities`}
                    onClick={() => setOpen(false)}
                    className="text-[11px] font-semibold text-blue-700 no-underline hover:underline"
                  >
                    Open lead →
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};
