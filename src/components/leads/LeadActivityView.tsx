import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  MapPin,
  RefreshCw,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import type { ActivityLocationRow } from '../../types/reports';
import type { AssignableUser } from '../../types/leads';
import { calculateDistanceMeters } from '../../utils/captureActivityLocation';
import {
  activityDisplayStatus,
  activityStatusClass,
  isMissedActivity,
  type ActivityDisplayStatus,
} from '../../utils/activityStatus';
import { displayUserLabel } from '../../utils/displayLabels';

interface LeadActivityViewProps {
  assignableUsers?: AssignableUser[];
}

const GOAL_THRESHOLD_METERS = 200;

function formatDateTime(val?: string | null): string {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function cleanUserLabel(val?: string | null, fallback: string = 'Unassigned'): string {
  if (!val) return fallback;
  const s = String(val).trim();
  if (/^[0-9a-fA-F]{24}$/.test(s) || /^[0-9a-fA-F]{32}$/.test(s)) {
    return fallback;
  }
  return s;
}

export const LeadActivityView: React.FC<LeadActivityViewProps> = ({ assignableUsers = [] }) => {
  const { user, activeRole, isAdmin } = useAuth();

  const isSalesRep = activeRole === 'sales-representative';
  const isManagerOrAdmin = isAdmin || activeRole === 'crm-manager' || activeRole === 'sales-manager';

  const currentUserId = String(user?.userId || '').trim();
  const currentUsername = String(user?.username || '').trim();

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [repFilter, setRepFilter] = useState<string>(() => (isSalesRep ? currentUserId : ''));
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination States
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, repFilter, searchQuery]);

  // Data States
  const [activities, setActivities] = useState<ActivityLocationRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Query parameters for wide activity scope
      const params: Record<string, string | number> = {
        limit: 1000,
        // Wide range covering past and future scheduled activities
        from: '2020-01-01',
        to: '2099-12-31',
      };

      if (isSalesRep) {
        params.rep = currentUserId;
      } else if (repFilter) {
        params.rep = repFilter;
      }

      const res = await crmApi.getActivityLocationReport(params);
      const rows = res.data?.rows || [];
      setActivities(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch lead activities';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isSalesRep, currentUserId, repFilter]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  // Client-side filtering
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // 1. Role Scoping for Sales Representative
      if (isSalesRep) {
        const matchesRep =
          (act.salesRepId && (act.salesRepId === currentUserId || act.salesRepId === currentUsername)) ||
          (act.salesRepName && (act.salesRepName === currentUsername || act.salesRepName === currentUserId));
        if (!matchesRep) return false;
      } else if (repFilter) {
        const matchesSelectedRep =
          act.salesRepId === repFilter ||
          act.salesRepName === repFilter ||
          (act as any).assignedTo === repFilter;
        if (!matchesSelectedRep) return false;
      }

      // 2. Status Filter
      const now = Date.now();
      const isMissed = Boolean(isMissedActivity(act, now) || act.isMissed);
      const computedDisplayStatus: ActivityDisplayStatus = isMissed
        ? 'Missed'
        : activityDisplayStatus(
            { kind: act.kind, status: act.status, eventDate: act.eventDate || undefined },
            now
          );

      if (statusFilter !== 'all') {
        if (statusFilter === 'Missed' && !isMissed) return false;
        if (statusFilter !== 'Missed' && computedDisplayStatus.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (act.activityTitle || '').toLowerCase().includes(q);
        const typeMatch = (act.activityType || '').toLowerCase().includes(q);
        const leadMatch = (act.leadName || '').toLowerCase().includes(q);
        const compMatch = (act.leadCompany || '').toLowerCase().includes(q);
        const repMatch = (act.salesRepName || '').toLowerCase().includes(q);

        if (!titleMatch && !typeMatch && !leadMatch && !compMatch && !repMatch) {
          return false;
        }
      }

      return true;
    });
  }, [activities, isSalesRep, currentUserId, currentUsername, repFilter, statusFilter, searchQuery]);

  // Pagination slicing
  const totalItems = filteredActivities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, page, pageSize]);

  // Activities that missed scheduled time and did not reach goal area (Alert requirement)
  const unreachedGoalActivities = useMemo(() => {
    const now = Date.now();
    return activities.filter((act) => {
      const isMissed = Boolean(isMissedActivity(act, now) || act.isMissed);
      const hasGoal = Boolean(act.goalLocation && (act.goalLocation.latitude != null || act.goalLocation.address));
      const goalReached = Boolean((act as any).reachedGoalArea);
      return isMissed && hasGoal && !goalReached;
    });
  }, [activities]);

  // Compute Goal Reached Status for an item
  const getGoalStatus = (act: ActivityLocationRow) => {
    const hasGoal = Boolean(
      act.goalLocation &&
      act.goalLocation.latitude != null &&
      act.goalLocation.longitude != null &&
      !Number.isNaN(Number(act.goalLocation.latitude))
    );

    if (!hasGoal) {
      return { hasGoal: false, status: 'none', label: 'No Goal Set' };
    }

    let isReached = Boolean((act as any).reachedGoalArea);

    if (!isReached && act.goalLocation) {
      const gLat = act.goalLocation.latitude!;
      const gLng = act.goalLocation.longitude!;

      if (act.completedLocation?.latitude != null && act.completedLocation?.longitude != null) {
        const d = calculateDistanceMeters(
          act.completedLocation.latitude,
          act.completedLocation.longitude,
          gLat,
          gLng
        );
        if (d != null && d <= GOAL_THRESHOLD_METERS) isReached = true;
      }

      if (!isReached && act.acceptedLocation?.latitude != null && act.acceptedLocation?.longitude != null) {
        const d = calculateDistanceMeters(
          act.acceptedLocation.latitude,
          act.acceptedLocation.longitude,
          gLat,
          gLng
        );
        if (d != null && d <= GOAL_THRESHOLD_METERS) isReached = true;
      }

      if (!isReached && act.startingLocation?.latitude != null && act.startingLocation?.longitude != null) {
        const d = calculateDistanceMeters(
          act.startingLocation.latitude,
          act.startingLocation.longitude,
          gLat,
          gLng
        );
        if (d != null && d <= GOAL_THRESHOLD_METERS) isReached = true;
      }
    }

    if (isReached) {
      return { hasGoal: true, status: 'reached', label: 'Reached Goal Area' };
    }

    const isDoneOrMissed = act.status === 'Completed' || act.isMissed || isMissedActivity(act);
    if (isDoneOrMissed) {
      return { hasGoal: true, status: 'not-reached', label: 'Not Reached Goal Area' };
    }

    return { hasGoal: true, status: 'pending', label: 'Pending' };
  };

  return (
    <div className="space-y-4">
      {/* Universal Filter Toolbar */}
      <div className="bg-white border border-zinc-300 rounded-xl p-3.5 flex flex-row flex-wrap items-end justify-start gap-3 w-full box-border">
        {/* Status Dropdown */}
        <div className="flex flex-col items-start gap-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 outline-none min-w-[130px] h-9 cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="Missed">Missed</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Assigned">Assigned</option>
            <option value="Accepted">Accepted</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {/* Rep Filter (Available for Admin & Managers) */}
        {isManagerOrAdmin && (
          <div className="flex flex-col items-start gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Sales Representative
            </label>
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 outline-none min-w-[160px] h-9 cursor-pointer"
            >
              <option value="">All representatives</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {displayUserLabel(u, u.id, u.displayName || u.name)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Flexible Search Input */}
        <div className="flex flex-col items-start gap-1 flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Search
          </label>
          <div className="relative w-full flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, type, lead, or rep…"
              className="w-full text-xs border border-zinc-300 rounded-lg pl-3 pr-7 py-1.5 bg-white text-zinc-900 outline-none focus:border-zinc-950 h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-zinc-400 hover:text-zinc-700 bg-transparent border-none cursor-pointer p-0 text-xs"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Reset & Refresh Buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              if (!isSalesRep) setRepFilter('');
              setSearchQuery('');
            }}
            title="Clear filters"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 h-9 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-colors whitespace-nowrap"
          >
            <X className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={() => void fetchActivities()}
            disabled={loading}
            title="Refresh activities"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 h-9 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Missed Activity & Goal Place Not Reached Alert (User & Admin) */}
      {unreachedGoalActivities.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm flex flex-wrap items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-[200px]">
            <h4 className="text-xs font-bold text-red-900 m-0">
              {isSalesRep
                ? `Attention: You have ${unreachedGoalActivities.length} missed ${
                    unreachedGoalActivities.length === 1 ? 'activity' : 'activities'
                  } where the goal place was not reached!`
                : `Admin Alert: ${unreachedGoalActivities.length} ${
                    unreachedGoalActivities.length === 1 ? 'activity' : 'activities'
                  } missed across representatives with goal place not reached!`}
            </h4>
            <p className="text-[11px] text-red-700 m-0 mt-0.5">
              Sales representatives must reach within 50 meters of the activity goal location.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('Missed')}
            className="text-xs font-semibold px-2.5 py-1 bg-white border border-red-200 text-red-800 rounded-lg hover:bg-red-50 shrink-0 cursor-pointer transition-colors"
          >
            Filter Missed ({unreachedGoalActivities.length})
          </button>
        </div>
      )}

      {/* Main Table Content */}
      <div className="bg-white border border-zinc-300 rounded-xl overflow-hidden shadow-none">
        {loading ? (
          <div className="p-16 text-center text-xs text-zinc-500 animate-pulse flex flex-col items-center justify-center">
            <RefreshCw className="h-6 w-6 text-zinc-400 animate-spin mb-2" />
            <span>Loading sales representative activities…</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-xs text-rose-600 bg-rose-50/50">
            <p className="font-semibold mb-2">{error}</p>
            <button
              onClick={() => void fetchActivities()}
              className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-16 text-center text-zinc-500">
            <CalendarCheck2 className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-900 mb-1">No activities found</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {isSalesRep
                ? 'No activities have been assigned to you or recorded for your leads yet.'
                : 'No activities match the current filter selection.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-200">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Activity Title & Type
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Associated Lead
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Scheduled Date & Time
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Sales Representative
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Goal Location & Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedActivities.map((act) => {
                  const now = Date.now();
                  const isMissed = Boolean(isMissedActivity(act, now) || act.isMissed);
                  const displayStatusVal: ActivityDisplayStatus = isMissed
                    ? 'Missed'
                    : activityDisplayStatus(
                        { kind: act.kind, status: act.status, eventDate: act.eventDate || undefined },
                        now
                      );
                  const goalInfo = getGoalStatus(act);

                  return (
                    <tr key={act.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* 1. Activity Title & Type */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-zinc-900 text-xs line-clamp-1">
                            {act.activityTitle || 'Untitled Activity'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                              {act.activityType || 'Activity'}
                            </span>
                            {act.kind === 'scheduled' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Scheduled
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Associated Lead */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col gap-1">
                          {act.leadId ? (
                            <Link
                              to={`/leads/${act.leadId}?tab=activities`}
                              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-xs flex items-center gap-1"
                              title="View Lead Activity tab"
                            >
                              <span>{act.leadName || 'Unnamed Lead'}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                            </Link>
                          ) : (
                            <span className="font-semibold text-zinc-700 text-xs">
                              {act.leadName || '—'}
                            </span>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                            {act.leadCompany && <span>{act.leadCompany}</span>}
                            {act.leadStage && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                                {act.leadStage}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Scheduled / Event Date & Time */}
                      <td className="px-4 py-3.5 align-middle text-xs text-zinc-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <span>{formatDateTime(act.eventDate || act.createdAt)}</span>
                        </div>
                      </td>

                      {/* 4. Sales Representative */}
                      <td className="px-4 py-3.5 align-middle text-xs">
                        <div className="flex items-center gap-1.5 text-zinc-800 font-medium">
                          <div className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 flex items-center justify-center shrink-0 text-[10px]">
                            <User className="h-3 w-3 text-zinc-500" />
                          </div>
                          <span className="truncate max-w-[150px]">
                            {cleanUserLabel(act.salesRepName, 'Unassigned')}
                          </span>
                        </div>
                      </td>

                      {/* 5. Status Badge */}
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${activityStatusClass(
                            displayStatusVal
                          )}`}
                        >
                          {displayStatusVal}
                        </span>
                      </td>

                      {/* 6. Goal Location & Reached Status Chip */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col gap-1 max-w-[220px]">
                          {goalInfo.hasGoal ? (
                            <>
                              <div>
                                {goalInfo.status === 'reached' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                                    Reached Goal Area
                                  </span>
                                )}
                                {goalInfo.status === 'not-reached' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <XCircle className="h-3 w-3 shrink-0 text-rose-600" />
                                    Not Reached Goal Area
                                  </span>
                                )}
                                {goalInfo.status === 'pending' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <Clock className="h-3 w-3 shrink-0 text-amber-600" />
                                    Pending
                                  </span>
                                )}
                              </div>
                              {act.goalLocation?.address ? (
                                <span
                                  className="text-[11px] text-zinc-500 flex items-center gap-1 truncate"
                                  title={act.goalLocation.address}
                                >
                                  <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                                  <span className="truncate">{act.goalLocation.address}</span>
                                </span>
                              ) : (
                                act.goalLocation && (
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    {act.goalLocation.latitude?.toFixed(4)}, {act.goalLocation.longitude?.toFixed(4)}
                                  </span>
                                )
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">No Goal Set</span>
                          )}
                        </div>
                      </td>

                      {/* 7. Action Button */}
                      <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                        <Link
                          to={`/activities/${act.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 text-xs font-semibold transition-colors shadow-none no-underline cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-zinc-500" />
                          <span>View Activity</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredActivities.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-zinc-50/70 border-t border-zinc-200 text-xs text-zinc-600">
              <div>
                Showing <strong className="text-zinc-950">{(page - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-zinc-950">{Math.min(page * pageSize, totalItems)}</strong> of{' '}
                <strong className="text-zinc-950">{totalItems}</strong> activities
              </div>

              <div className="flex items-center gap-3">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 bg-white text-zinc-800 outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                {/* Page Navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 cursor-pointer transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="px-2 text-xs font-semibold text-zinc-700">
                      Page {page} of {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 cursor-pointer transition-colors"
                      title="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
};
