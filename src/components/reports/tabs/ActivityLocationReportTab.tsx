import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MapPin,
  Users,
} from 'lucide-react';

import type {
  ActivityLocationPoint,
  ActivityLocationReport,
  ActivityLocationRow,
} from '../../../types/reports';
import { MetricCard, MetricGrid, ReportEmptyState } from '../ReportCharts';

export interface ActivityLocationReportTabProps {
  data: ActivityLocationReport;
}

function hasCoords(
  point: ActivityLocationPoint | null | undefined
): point is ActivityLocationPoint & { latitude: number; longitude: number } {
  return Boolean(point && point.latitude != null && point.longitude != null);
}

function pointLabel(point: ActivityLocationPoint | null | undefined): string {
  if (!point) return 'Not captured';
  if (!hasCoords(point)) return point.unavailableReason || 'Not captured';
  if (point.address) return point.address;
  return `${point.latitude?.toFixed(5)}, ${point.longitude?.toFixed(5)}`;
}

function embedUrl(point: ActivityLocationPoint): string {
  // Keyless embed: works without a Maps API key being configured.
  const q = `${point.latitude},${point.longitude}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

function externalUrl(point: ActivityLocationPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

/** One expandable map panel for a captured reading. */
const MapPanel: React.FC<{ title: string; point: ActivityLocationPoint }> = ({ title, point }) => (
  <div className="rounded-xl border border-zinc-200 bg-white p-3">
    <div className="mb-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </div>
        <div className="truncate text-xs font-medium text-zinc-900">{pointLabel(point)}</div>
        <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
          {point.latitude}, {point.longitude}
          {point.accuracy != null ? ` · ±${point.accuracy}m` : ''}
          {point.capturedAt ? ` · ${formatWhen(point.capturedAt)}` : ''}
        </div>
      </div>
      <a
        href={externalUrl(point)}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
      >
        Open in Maps
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      </a>
    </div>
    <iframe
      title={`${title} map`}
      src={embedUrl(point)}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="h-48 w-full rounded-lg border border-zinc-200"
    />
  </div>
);

/**
 * Activity Location report — which rep did what, on which lead, and where they
 * were. A row expands to show the map(s) for its captured coordinates.
 */
export const ActivityLocationReportTab: React.FC<ActivityLocationReportTabProps> = ({ data }) => {
  const rows = data.rows || [];
  const summary = data.summary || {
    total: 0,
    withLocation: 0,
    withoutLocation: 0,
    missed: 0,
    reps: 0,
    leads: 0,
  };

  const [expanded, setExpanded] = useState<string | null>(null);
  const [repFilter, setRepFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'logged' | 'scheduled'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [onlyLocated, setOnlyLocated] = useState(false);
  const [onlyMissed, setOnlyMissed] = useState(false);

  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    rows.forEach((row) => {
      if (row.activityType) types.add(row.activityType);
    });
    return Array.from(types).sort();
  }, [rows]);

  const repOptions = useMemo(() => {
    const names = new Map<string, string>();
    rows.forEach((row) => {
      if (row.salesRepId) names.set(row.salesRepId, row.salesRepName || row.salesRepId);
    });
    return Array.from(names.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (repFilter && row.salesRepId !== repFilter) return false;
        if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
        if (typeFilter && row.activityType !== typeFilter) return false;
        if (
          onlyLocated &&
          !row.hasCoordinates &&
          !hasCoords(row.goalLocation) &&
          !hasCoords(row.acceptedLocation) &&
          !hasCoords(row.startingLocation) &&
          !hasCoords(row.createdLocation) &&
          !hasCoords(row.completedLocation)
        )
          return false;
        if (onlyMissed && !row.isMissed) return false;
        return true;
      }),
    [rows, repFilter, kindFilter, typeFilter, onlyLocated, onlyMissed]
  );

  const toggle = (row: ActivityLocationRow) => {
    setExpanded((current) => (current === row.id ? null : row.id));
  };

  return (
    <div className="flex flex-col gap-5">
      <MetricGrid>
        <MetricCard
          label="Activities"
          value={String(summary.total)}
          hint="In the selected date range"
          icon={<CalendarClock className="h-4 w-4 shrink-0" aria-hidden />}
        />
        <MetricCard
          label="With location"
          value={String(summary.withLocation)}
          hint={`${summary.withoutLocation} without coordinates`}
          icon={<MapPin className="h-4 w-4 shrink-0" aria-hidden />}
        />
        <MetricCard
          label="Missed"
          value={String(summary.missed ?? 0)}
          hint="Scheduled, never completed in time"
          icon={<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />}
        />
        <MetricCard
          label="Sales reps"
          value={String(summary.reps)}
          hint="Recorded at least one activity"
          icon={<Users className="h-4 w-4 shrink-0" aria-hidden />}
        />
        <MetricCard
          label="Leads touched"
          value={String(summary.leads)}
          hint="Distinct leads in this range"
          icon={<ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
        />
      </MetricGrid>

      <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
        <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-900">
              Activity locations
            </h4>
            <p className="mb-0 mt-1 text-[11px] text-zinc-500">
              Expand a row to see where the rep was. Scheduled activities capture a second reading
              when they are completed.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              aria-label="Filter by sales representative"
              className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-[11px] text-zinc-900"
            >
              <option value="">All reps</option>
              {repOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as 'all' | 'logged' | 'scheduled')}
              aria-label="Filter by activity kind"
              className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-[11px] text-zinc-900"
            >
              <option value="all">All kinds</option>
              <option value="logged">Logged</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by activity type"
              className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-[11px] text-zinc-900"
            >
              <option value="">All activity types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={onlyLocated}
                onChange={(e) => setOnlyLocated(e.target.checked)}
              />
              With location only
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={onlyMissed}
                onChange={(e) => setOnlyMissed(e.target.checked)}
              />
              Missed only
            </label>
          </div>
        </div>

        {visibleRows.length === 0 ? (
          <ReportEmptyState message="No activities with the selected filters in this date range." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-zinc-200 text-zinc-500">
                <tr>
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-4 py-2.5 font-semibold">Sales rep</th>
                  <th className="px-4 py-2.5 font-semibold">Lead</th>
                  <th className="px-4 py-2.5 font-semibold">Activity</th>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {visibleRows.map((row) => {
                  const isOpen = expanded === row.id;
                  const starting = hasCoords(row.acceptedLocation)
                    ? row.acceptedLocation
                    : (hasCoords(row.startingLocation)
                        ? row.startingLocation
                        : (hasCoords(row.createdLocation)
                            ? row.createdLocation
                            : (row.acceptedLocation || row.startingLocation || row.createdLocation)));
                  const completed = row.completedLocation;
                  const goal = row.goalLocation;
                  const hasGoal = hasCoords(goal);
                  const hasStarting = hasCoords(starting);
                  const hasCompleted = hasCoords(completed);
                  const canExpand = hasGoal || hasStarting || hasCompleted;
                  return (
                    <React.Fragment key={row.id}>
                      <tr className="transition-colors hover:bg-zinc-50">
                        <td className="px-3 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggle(row)}
                            aria-expanded={isOpen}
                            aria-label={isOpen ? 'Hide map' : 'Show map'}
                            disabled={!canExpand}
                            className="rounded border-0 bg-transparent p-1 text-zinc-600 hover:bg-zinc-200 disabled:opacity-25"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="font-semibold text-zinc-900">
                            {row.salesRepName || 'Unassigned'}
                          </span>
                          {row.completedByName && row.completedByName !== row.salesRepName ? (
                            <span className="block text-[11px] text-zinc-500">
                              Completed by {row.completedByName}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {row.leadId ? (
                            <Link
                              to={`/leads/${row.leadId}?tab=activities`}
                              className="inline-flex items-center gap-1 font-semibold text-zinc-900 underline hover:text-zinc-700"
                            >
                              {row.leadName || 'Lead'}
                              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                            </Link>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                          {row.leadCompany ? (
                            <span className="block text-[11px] text-zinc-500">
                              {row.leadCompany}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Link
                            to={`/activities/${row.id}`}
                            className="font-semibold text-zinc-900 hover:text-blue-600 hover:underline inline-flex items-center gap-1"
                            title="View Activity Details & Trail"
                          >
                            <span>{row.activityTitle}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400" />
                          </Link>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                            <span>
                              {row.activityType}
                              {' · '}
                              {row.kind === 'scheduled' ? 'Scheduled' : 'Logged'}
                            </span>
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                (row.isMissed || row.displayStatus === 'Missed')
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : (row.displayStatus === 'Completed' || row.status === 'Completed')
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                              }`}
                              title={
                                row.isMissed
                                  ? 'Scheduled activity was not completed by its due time'
                                  : undefined
                              }
                            >
                              {(row.isMissed || row.displayStatus === 'Missed') ? 'Missed' : (row.displayStatus || row.status)}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-zinc-600">
                          <span className="block">{formatWhen(row.eventDate)}</span>
                          {row.completedAt ? (
                            <span className="block text-[11px] text-zinc-500">
                              Done {formatWhen(row.completedAt)}
                            </span>
                          ) : null}
                        </td>
                        <td className="max-w-[260px] px-4 py-3 align-top">
                          <div className="flex flex-col items-start gap-1">
                            {hasGoal ? (
                              <span
                                className="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                                title={`🎯 Goal: ${pointLabel(goal)}`}
                              >
                                <span aria-hidden>🎯</span>
                                <span className="truncate">Goal: {pointLabel(goal)}</span>
                              </span>
                            ) : null}
                            {hasStarting ? (
                              <span
                                className="inline-flex max-w-full items-start gap-1 text-[11px] text-zinc-700"
                                title={`📍 Start: ${pointLabel(starting)}`}
                              >
                                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" aria-hidden />
                                <span className="truncate">Start: {pointLabel(starting)}</span>
                              </span>
                            ) : null}
                            {hasCompleted ? (
                              <span
                                className="inline-flex max-w-full items-start gap-1 text-[11px] text-emerald-700"
                                title={`🏁 Done: ${pointLabel(completed)}`}
                              >
                                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                                <span className="truncate">Done: {pointLabel(completed)}</span>
                              </span>
                            ) : null}
                            {!hasGoal && !hasStarting && !hasCompleted ? (
                              <span className="text-[11px] italic text-zinc-400">
                                {pointLabel(starting || completed || goal)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isOpen && canExpand ? (
                        <tr className="bg-zinc-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {hasGoal ? (
                                <MapPanel title="Captured goal" point={row.goalLocation!} />
                              ) : null}
                              {hasStarting ? (
                                <MapPanel title="Rep starting location" point={starting!} />
                              ) : null}
                              {hasCompleted ? (
                                <MapPanel title="Captured on completion" point={completed!} />
                              ) : null}
                            </div>
                            {row.description ? (
                              <p className="mb-0 mt-3 text-[11px] text-zinc-600">
                                {row.description}
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
