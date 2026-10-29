/**
 * Document date formatting: `27-10-2026`, or `27-10-2026 & 14-30` when the
 * value carries a real time of day.
 *
 * Quotation and invoice dates are usually stored as a plain date (midnight
 * UTC). Printing `& 00-00` next to those would be noise, and reading them in
 * the browser's timezone can slide the day across the date line, so a
 * date-only value is read back in UTC and shown without a clock.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

/** True when the stored instant is exactly midnight UTC — i.e. a date, not a moment. */
function isDateOnly(value: Date): boolean {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}

export function parseDocumentDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `27-10-2026` or `27-10-2026 & 14-30`; `fallback` when there is no date. */
export function formatDocumentDate(value: unknown, fallback = '—'): string {
  const parsed = parseDocumentDate(value);
  if (!parsed) return fallback;

  if (isDateOnly(parsed)) {
    return `${pad(parsed.getUTCDate())}-${pad(parsed.getUTCMonth() + 1)}-${parsed.getUTCFullYear()}`;
  }

  const date = `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
  return `${date} & ${pad(parsed.getHours())}-${pad(parsed.getMinutes())}`;
}

/** Date part only, for tight columns: `27-10-2026`. */
export function formatDocumentDateShort(value: unknown, fallback = '—'): string {
  const parsed = parseDocumentDate(value);
  if (!parsed) return fallback;
  return isDateOnly(parsed)
    ? `${pad(parsed.getUTCDate())}-${pad(parsed.getUTCMonth() + 1)}-${parsed.getUTCFullYear()}`
    : `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
}
