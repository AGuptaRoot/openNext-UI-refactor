import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, MapPin } from 'lucide-react';

import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ActivityReminderRow } from '../../types/leads';
import { latenessLabel } from '../../utils/activityReminders';

/** Rows shown before the list collapses into a "+N more" line. */
const MAX_ROWS = 5;

/**
 * Dashboard alert for scheduled activities that were missed / goal not reached.
 * Alerts both sales representatives and administrators/managers.
 */
export const MissedActivityAlert: React.FC = () => {
  const { isClient, hasPermission, isAdmin, activeRole } = useAuth();
  const canSeeLeads = hasPermission('crm.leads.read');
  const isManagerOrAdmin = isAdmin || activeRole === 'sales-manager' || activeRole === 'crm-manager';

  const [rows, setRows] = useState<ActivityReminderRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isClient || !canSeeLeads) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await crmApi.getActivityReminders({
          scope: isManagerOrAdmin ? 'team' : 'mine',
        });
        if (cancelled) return;
        setRows(res.data?.missed || []);
      } catch {
        // The dashboard must still render when this call fails.
      }
    };

    void load();
    // Refresh on the same hourly beat as the reminder popup.
    const timer = window.setInterval(() => void load(), 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isClient, canSeeLeads, isManagerOrAdmin]);

  const shown = useMemo(() => (expanded ? rows : rows.slice(0, MAX_ROWS)), [rows, expanded]);

  if (!rows.length) return null;

  const unreachedGoalCount = rows.filter((r) => r.notReachedGoal || (r.hasGoal && !r.reachedGoalArea)).length;

  return (
    <section
      data-tour="dashboard-missed-activities"
      aria-label="Missed activities"
      className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
        <h2 className="m-0 text-sm font-bold text-red-900">
          {rows.length === 1
            ? '1 activity was missed'
            : `${rows.length} activities were missed`}
          {unreachedGoalCount > 0 ? (
            <span className="ml-2 text-xs font-semibold text-red-700">
              ({unreachedGoalCount} did not reach goal place)
            </span>
          ) : null}
        </h2>
        <span className="ml-auto text-[11px] font-semibold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
          {isManagerOrAdmin ? 'Admin Alert · Team Missed Activities' : 'Assigned to you'}
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((row) => {
          const hasGoalUnreached = Boolean(row.notReachedGoal || (row.hasGoal && !row.reachedGoalArea));
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-200 bg-white px-3 py-2"
            >
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                Missed
              </span>
              {hasGoalUnreached ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                  <MapPin className="h-3 w-3 text-red-600" />
                  Not Reached Goal Place
                </span>
              ) : null}
              <span className="text-xs font-bold text-zinc-950">{row.title}</span>
              <span className="text-xs text-zinc-600">{row.eventType}</span>
              {row.leadName ? <span className="text-xs text-zinc-600 font-medium">Lead: {row.leadName}</span> : null}
              {isManagerOrAdmin && row.assignedToLabel ? (
                <span className="text-xs text-zinc-500 font-medium">Rep: {row.assignedToLabel}</span>
              ) : null}
              <span className="text-xs font-semibold text-red-800">
                {latenessLabel(row.minutesLate || 0)}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <Link
                  to={`/activities/${row.id}`}
                  className="inline-flex h-7 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-800 no-underline hover:bg-zinc-50"
                >
                  View Activity
                </Link>
                {row.leadId ? (
                  <Link
                    to={`/leads/${row.leadId}?tab=activities`}
                    className="inline-flex h-7 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-800 no-underline hover:bg-zinc-50"
                  >
                    Open Lead
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length > MAX_ROWS ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 border-0 bg-transparent p-0 text-[11px] font-semibold text-red-800 underline cursor-pointer"
        >
          {expanded ? 'Show fewer' : `Show ${rows.length - MAX_ROWS} more`}
        </button>
      ) : null}
    </section>
  );
};
