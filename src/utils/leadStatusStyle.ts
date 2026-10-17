import { statusBadgeClass, statusToneFromLabel } from './statusBadge';

/**
 * Shared theme-aware chip styling for lead status labels.
 * Uses CSS semantic tokens (success / warning / danger / info / neutral).
 */
export function getLeadStatusChipClass(status?: string): string {
  const s = String(status || '').trim().toLowerCase();

  if (s === 'hot') return statusBadgeClass('danger');
  if (s === 'warm') return statusBadgeClass('warning');
  if (s === 'cold') return statusBadgeClass('info');

  if (s === 'won' || s === 'completed' || s === 'qualified') {
    return statusBadgeClass('success');
  }
  if (s === 'lost' || s === 'disqualified' || s === 'junk' || s === 'cancelled') {
    return statusBadgeClass('danger');
  }
  if (s.includes('proposal') || s.includes('review') || s === 'pending') {
    return statusBadgeClass('warning');
  }
  if (s === 'contacted') {
    return statusBadgeClass('info');
  }

  return statusBadgeClass(statusToneFromLabel(status));
}

/** Pipeline stage badges (Qualified / Won / Lost / …) — theme-aware. */
export function getLeadStageBadgeClass(stage?: string): string {
  const s = String(stage || '').toLowerCase();
  if (s.includes('won')) return statusBadgeClass('solid');
  if (s.includes('lost') || s.includes('disqualified')) return statusBadgeClass('danger');
  if (s.includes('proposal')) return statusBadgeClass('warning');
  if (s.includes('qualified')) return statusBadgeClass('solid');
  if (s.includes('contacted')) return statusBadgeClass('info');
  return statusBadgeClass('neutral');
}
