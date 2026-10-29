import type { CalendarEventItem, DashboardData } from '../types/dashboard';

/** Calendar rows carry extra backend fields (kind, isMissed, createdAt, …). */
export type CalendarEventRow = CalendarEventItem & Record<string, unknown>;

/** How long before a scheduled activity the dashboard reminder appears. */
export const REMINDER_WINDOW_MINUTES = 60;

const DISMISS_KEY = 'crm_activity_reminders_dismissed_v1';
/** Separate store: snoozing the hourly popup must not clear the dashboard strip. */
const SNOOZE_KEY = 'crm_activity_reminders_snoozed_v1';
/** A snoozed activity comes back on the next hourly sweep. */
const SNOOZE_TTL_MS = 60 * 60 * 1000;
/** Dismissals older than this are pruned, so the store cannot grow forever. */
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Every calendar row the dashboard loaded, preferring the full list over the
 * truncated "upcoming" one so a reminder is never lost behind ten overdue rows.
 */
export function collectCalendarEvents(data: DashboardData): CalendarEventRow[] {
  const summary = data.calendarSummary;
  if (Array.isArray(summary?.allCalendarEvents) && summary.allCalendarEvents.length > 0) {
    return summary.allCalendarEvents as CalendarEventRow[];
  }
  const legacy = (data as DashboardData & { calendarEvents?: CalendarEventItem[] }).calendarEvents;
  if (Array.isArray(legacy) && legacy.length > 0) {
    return legacy as CalendarEventRow[];
  }
  return (summary?.upcomingCalendarEvents || []) as CalendarEventRow[];
}

export function parseCalendarEventDate(event: CalendarEventRow): Date | null {
  const raw = event.date || event.dueDate || (event as { timestamp?: string }).timestamp;
  if (!raw) return null;
  const parsed = new Date(String(raw));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface DueSoonActivity {
  key: string;
  title: string;
  type: string;
  entityName: string;
  entityId: string;
  at: Date;
  minutesUntil: number;
  assignedToLabel: string;
}

/** Stable key for a row, used for dismissal and as the React key. */
function rowKey(event: CalendarEventRow): string {
  const id = String(event.id || event._id || '').trim();
  if (id) return id;
  return `${String(event.title || '')}|${String(event.date || event.dueDate || '')}`;
}

/**
 * Scheduled activities that start inside the reminder window and are still open.
 *
 * Only `kind: 'scheduled'` rows qualify: a logged activity already happened, and
 * a follow-up is a separate record with its own card. Activities already past
 * their time are left out — those are Missed, which the lead list and the
 * schedule card already flag, and a reminder for them would be a nag, not a
 * heads-up.
 */
export function dueSoonActivities(
  events: CalendarEventRow[],
  now: Date = new Date(),
  windowMinutes: number = REMINDER_WINDOW_MINUTES
): DueSoonActivity[] {
  const from = now.getTime();
  const until = from + windowMinutes * 60 * 1000;

  return events
    .filter((event) => String(event.kind || '') === 'scheduled')
    .filter((event) => String(event.status || '') === 'Open')
    .filter((event) => !event.isMissed)
    .map((event) => {
      const at = parseCalendarEventDate(event);
      if (!at) return null;
      const time = at.getTime();
      if (time < from || time > until) return null;
      return {
        key: rowKey(event),
        title: String(event.title || 'Scheduled activity'),
        type: String(event.type || 'Activity'),
        entityName: String(event.entityName || ''),
        entityId: String(event.entityId || ''),
        at,
        minutesUntil: Math.max(0, Math.round((time - from) / 60000)),
        assignedToLabel: String(
          event.assignedToLabel || event.assignedToName || event.assignedTo || ''
        ),
      } satisfies DueSoonActivity;
    })
    .filter((row): row is DueSoonActivity => row !== null)
    .sort((left, right) => left.at.getTime() - right.at.getTime());
}

/** "in 25 min" / "now" — the countdown shown on the reminder row. */
export function countdownLabel(minutesUntil: number): string {
  if (minutesUntil <= 0) return 'now';
  if (minutesUntil < 60) return `in ${minutesUntil} min`;
  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;
  return minutes ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
}

/** "25 min late" / "2h 10m late" — how long a missed activity has been waiting. */
export function latenessLabel(minutesLate: number): string {
  const minutes = Math.max(1, Math.round(minutesLate));
  if (minutes < 60) return `${minutes} min late`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}h ${rest}m late` : `${hours}h late`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day late' : `${days} days late`;
}

type DismissMap = Record<string, number>;

function readDismissMap(): DismissMap {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    if (!parsed || typeof parsed !== 'object') return {};
    const cutoff = Date.now() - DISMISS_TTL_MS;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, at]) => Number(at) >= cutoff)
    );
  } catch {
    // Private windows and blocked site data throw; a reminder that shows again
    // is better than one that crashes the dashboard.
    return {};
  }
}

export function loadDismissedKeys(): Set<string> {
  return new Set(Object.keys(readDismissMap()));
}

function readMap(storageKey: string, ttlMs: number): DismissMap {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    if (!parsed || typeof parsed !== 'object') return {};
    const cutoff = Date.now() - ttlMs;
    return Object.fromEntries(Object.entries(parsed).filter(([, at]) => Number(at) >= cutoff));
  } catch {
    return {};
  }
}

/** Activities the user snoozed on the hourly popup within the last hour. */
export function loadSnoozedKeys(): Set<string> {
  return new Set(Object.keys(readMap(SNOOZE_KEY, SNOOZE_TTL_MS)));
}

/** Hide one activity's reminder for an hour. */
export function snoozeReminder(key: string): void {
  try {
    const next = readMap(SNOOZE_KEY, SNOOZE_TTL_MS);
    next[key] = Date.now();
    window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
  } catch {
    /* snoozing is a convenience, never a requirement */
  }
}

export function dismissReminder(key: string): void {
  try {
    const next = readDismissMap();
    next[key] = Date.now();
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  } catch {
    /* dismissal is a convenience, never a requirement */
  }
}
