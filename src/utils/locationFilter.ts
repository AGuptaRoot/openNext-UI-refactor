/**
 * Location drill-down filter (state / district / city) shared by the Location Wise report and the
 * Leads / Clients list pages. The server matches each part ignoring case and extra spaces;
 * `*NotSet=1` / `locationNotSet=1` select records where that part is empty.
 */

export const LOCATION_FILTER_KEYS = [
  'state',
  'district',
  'city',
  'stateNotSet',
  'districtNotSet',
  'cityNotSet',
  'locationNotSet',
] as const;

export type LocationFilterKey = (typeof LOCATION_FILTER_KEYS)[number];
export type LocationFilter = Partial<Record<LocationFilterKey, string>>;

/** Read the location filter from URL search params (only keys with a value). */
export function readLocationFilter(params: URLSearchParams): LocationFilter {
  const out: LocationFilter = {};
  for (const key of LOCATION_FILTER_KEYS) {
    const value = (params.get(key) || '').trim();
    if (value) out[key] = value;
  }
  return out;
}

export function hasLocationFilter(filter: LocationFilter | null | undefined): boolean {
  return Boolean(filter && LOCATION_FILTER_KEYS.some((key) => filter[key]));
}

/** Copy the location filter into URL search params. */
export function writeLocationFilter(params: URLSearchParams, filter: LocationFilter | null | undefined): URLSearchParams {
  if (!filter) return params;
  for (const key of LOCATION_FILTER_KEYS) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  return params;
}

/** Same filter (order-insensitive)? Used to avoid needless state updates. */
export function sameLocationFilter(a: LocationFilter, b: LocationFilter): boolean {
  return LOCATION_FILTER_KEYS.every((key) => (a[key] || '') === (b[key] || ''));
}

/** Chip text: "Location: Surat" (the most specific part set), or "Location not set". */
export function locationFilterLabel(filter: LocationFilter): string {
  if (filter.locationNotSet) return 'Location not set';
  const name = filter.city || filter.district || filter.state;
  if (name) return `Location: ${name}`;
  if (filter.cityNotSet) return 'Location: City not set';
  if (filter.stateNotSet) return 'Location: State not set';
  return 'Location';
}
