/** Shared formatting for the work report screens. */

/** YYYY-MM-DD of a date in the browser's own day. */
export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 2.5 → "2h 30m"; 0 → "0h". */
export function formatHours(value: number): string {
  const totalMinutes = Math.round((Number(value) || 0) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** 1 → "1 day", 3 → "3 days". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** First check-in to last check-out, or "Manual" when the time was typed in. */
export function formatSpan(first: string | null | undefined, last: string | null | undefined): string {
  if (!first && !last) return 'Manual';
  return `${formatClock(first)} – ${formatClock(last)}`;
}

export function formatClock(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
