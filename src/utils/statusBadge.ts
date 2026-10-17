/**
 * Theme-aware status badge classes using CSS semantic tokens.
 * Works in both light and dark via :root / html.dark variables in index.css.
 */

export type StatusBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'solid';

const TONE_CLASS: Record<StatusBadgeTone, string> = {
  success: 'crm-badge crm-badge-success',
  warning: 'crm-badge crm-badge-warning',
  danger: 'crm-badge crm-badge-danger',
  info: 'crm-badge crm-badge-info',
  neutral: 'crm-badge crm-badge-neutral',
  solid: 'crm-badge crm-badge-solid',
};

/** Base chip classes for semantic status badges. */
export function statusBadgeClass(tone: StatusBadgeTone): string {
  return TONE_CLASS[tone] || TONE_CLASS.neutral;
}

/**
 * Map common CRM status/stage labels to a semantic tone.
 * Covers: Qualified, Won, Lost, Pending, Approved, Rejected, Active, Inactive, etc.
 */
export function statusToneFromLabel(label?: string | null): StatusBadgeTone {
  const s = String(label || '')
    .trim()
    .toLowerCase();

  if (
    s === 'won' ||
    s === 'qualified' ||
    s === 'approved' ||
    s === 'active' ||
    s === 'completed' ||
    s === 'satisfied' ||
    s === 'paid' ||
    s === 'accepted'
  ) {
    return 'success';
  }

  if (
    s === 'lost' ||
    s === 'rejected' ||
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'disqualified' ||
    s === 'junk' ||
    s === 'inactive' ||
    s === 'overdue' ||
    s === 'failed'
  ) {
    return 'danger';
  }

  if (
    s === 'pending' ||
    s === 'in review' ||
    s === 'review' ||
    s.includes('proposal') ||
    s === 'warm' ||
    s === 'on hold' ||
    s === 'draft'
  ) {
    return 'warning';
  }

  if (s === 'hot' || s === 'urgent' || s === 'critical') {
    return 'danger';
  }

  if (s === 'cold' || s === 'contacted' || s === 'new' || s === 'open') {
    return 'info';
  }

  if (s.includes('won')) return 'solid';
  if (s.includes('qualified')) return 'solid';

  return 'neutral';
}

export function statusBadgeFromLabel(label?: string | null): string {
  return statusBadgeClass(statusToneFromLabel(label));
}
