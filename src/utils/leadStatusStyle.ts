/**
 * Shared Tailwind chip styling for lead status labels.
 * Hot / Warm / Cold are the default temperature statuses; the remaining
 * branches keep the existing lifecycle colours (Won, Lost, Contacted, …).
 */
export function getLeadStatusChipClass(status?: string): string {
  const s = String(status || '').trim().toLowerCase();

  if (s === 'hot') return 'bg-red-50 text-red-700 border-red-200';
  if (s === 'warm') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (s === 'cold') return 'bg-sky-50 text-sky-800 border-sky-200';

  if (s === 'won' || s === 'completed' || s === 'qualified') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (s === 'lost' || s === 'disqualified' || s === 'junk' || s === 'cancelled') {
    return 'bg-red-50 text-red-800 border-red-200';
  }
  if (s.includes('proposal') || s.includes('review') || s === 'pending') {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (s === 'contacted') {
    return 'bg-blue-50 text-blue-800 border-blue-200';
  }
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}
