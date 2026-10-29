import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ActivityReminderRow } from '../../types/leads';
import { latenessLabel } from '../../utils/activityReminders';

/** Rows shown before the list collapses into a "+N more" line. */
const MAX_ROWS = 5;

/**
 * Dashboard alert for scheduled activities that were never marked Completed.
 *
 * Everyone sees only the activities assigned to them, managers included: the
 * alert is a prompt to act, and a manager cannot complete somebody else's
 * visit. Team-wide misses belong in the reports, not in a personal alert. The
 * strip is absent — not empty — when there is nothing missed.
 */
export const MissedActivityAlert: React.FC = () => {
  const { isClient, hasPermission } = useAuth();
  const canSeeLeads = hasPermission('crm.leads.read');

  const [rows, setRows] = useState<ActivityReminderRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isClient || !canSeeLeads) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await crmApi.getActivityReminders({ scope: 'mine' });
        if (cancelled) return;
        setRows(res.data?.missed || []);
      } catch {
        // The dashboard must still render when this one call fails.
      }
    };

    void load();
    // Refresh on the same hourly beat as the reminder popup.
    const timer = window.setInterval(() => void load(), 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isClient, canSeeLeads]);

  const shown = useMemo(() => (expanded ? rows : rows.slice(0, MAX_ROWS)), [rows, expanded]);

  if (!rows.length) return null;

  return (
    <section
      data-tour="dashboard-missed-activities"
      aria-label="Missed activities"
      className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
        <h2 className="m-0 text-sm font-bold text-red-900">
          {rows.length === 1 ? '1 activity was missed' : `${rows.length} activities were missed`}
        </h2>
        <span className="ml-auto text-[11px] font-medium text-red-700">assigned to you</span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-200 bg-white px-3 py-2"
          >
            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
              Missed
            </span>
            <span className="text-xs font-bold text-zinc-950">{row.title}</span>
            <span className="text-xs text-zinc-600">{row.eventType}</span>
            {row.leadName ? <span className="text-xs text-zinc-600">{row.leadName}</span> : null}
            <span className="text-xs font-semibold text-red-800">
              {latenessLabel(row.minutesLate || 0)}
            </span>
            {row.leadId ? (
              <Link
                to={`/leads/${row.leadId}?tab=activities`}
                className="ml-auto inline-flex h-7 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-800 no-underline hover:bg-zinc-50"
              >
                Open lead
              </Link>
            ) : null}
          </li>
        ))}
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
