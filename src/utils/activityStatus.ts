import type { LeadEvent } from '../types/leads';

export type ActivityDisplayStatus = 'Missed' | 'Completed' | 'Assigned' | 'Accepted' | 'Scheduled' | 'Open';

/**
 * A scheduled activity that was never completed by the time it was due.
 *
 * Mirrors `api/utils/lead-event.constants.js` — keep the two in step. A
 * *logged* activity is recorded as already done, so it can never be missed,
 * and activities created before kinds existed carry no `kind` and are left
 * alone rather than retroactively marked missed.
 */
export function isMissedActivity(
  event: Pick<LeadEvent, 'kind' | 'status' | 'eventDate' | 'date'> | null | undefined,
  now: number = Date.now()
): boolean {
  if (!event) return false;
  if (String(event.kind || 'logged') !== 'scheduled') return false;
  const status = String(event.status || '');
  if (status === 'Completed') return false;
  const raw = event.eventDate || event.date;
  const due = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(due)) return false;
  return due < now;
}

export function activityDisplayStatus(
  event: Pick<LeadEvent, 'kind' | 'status' | 'eventDate' | 'date'> | null | undefined,
  now: number = Date.now()
): ActivityDisplayStatus {
  if (isMissedActivity(event, now)) return 'Missed';
  const status = String(event?.status || '');
  if (status === 'Completed') return 'Completed';
  if (status === 'Accepted') return 'Accepted';
  if (status === 'Assigned') return 'Assigned';
  return String(event?.kind || 'logged') === 'scheduled' ? 'Scheduled' : 'Open';
}

/** Tailwind badge classes for an activity status. */
export function activityStatusClass(status: ActivityDisplayStatus | string): string {
  switch (status) {
    case 'Missed':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'Completed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Accepted':
      return 'bg-teal-50 text-teal-800 border-teal-200';
    case 'Assigned':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Scheduled':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    default:
      return 'bg-blue-50 text-blue-800 border-blue-200';
  }
}
