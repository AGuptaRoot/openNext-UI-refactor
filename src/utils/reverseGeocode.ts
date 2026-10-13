import { loadGoogleMaps, resolveGoogleMapsApiKey, getGoogleMaps } from './googleMapsLoader';

export interface ReverseGeocodeResult {
  displayName: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postcode: string;
  /** Where the result came from */
  source: 'google' | 'osm';
}

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  county?: string;
  state_district?: string;
  state?: string;
  region?: string;
  postcode?: string;
  country?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

function pickCity(addr: NominatimAddress): string {
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.suburb ||
    addr.city_district ||
    addr.county ||
    ''
  ).trim();
}

function pickState(addr: NominatimAddress): string {
  return (addr.state || addr.state_district || addr.region || '').trim();
}

function buildAddressLine(addr: NominatimAddress, displayName: string): string {
  const line = [
    addr.road || addr.pedestrian,
    addr.neighbourhood || addr.suburb,
    pickCity(addr),
    pickState(addr),
    addr.postcode,
    addr.country,
  ]
    .filter(Boolean)
    .join(', ');
  return line || displayName;
}

function componentByType(
  components: Array<{ long_name: string; short_name: string; types: string[] }> | undefined,
  type: string
): string {
  const match = (components || []).find((c) => c.types?.includes(type));
  return String(match?.long_name || '').trim();
}

/**
 * Reverse-geocode via Google Geocoder (requires Maps JS loaded).
 */
async function reverseGeocodeGoogle(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  const google = getGoogleMaps();
  const Geocoder = google?.maps?.Geocoder as
    | (new () => {
        geocode: (
          req: { location: { lat: number; lng: number } },
          cb: (
            results: Array<{
              formatted_address?: string;
              address_components?: Array<{
                long_name: string;
                short_name: string;
                types: string[];
              }>;
            }> | null,
            status: string
          ) => void
        ) => void;
      })
    | undefined;

  if (!Geocoder) return null;

  return new Promise((resolve) => {
    const geocoder = new Geocoder();
    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
      if (status !== 'OK' || !results?.length) {
        resolve(null);
        return;
      }
      const top = results[0];
      const components = top.address_components || [];
      const city =
        componentByType(components, 'locality') ||
        componentByType(components, 'administrative_area_level_2') ||
        componentByType(components, 'sublocality') ||
        componentByType(components, 'postal_town');
      const state = componentByType(components, 'administrative_area_level_1');
      const country = componentByType(components, 'country');
      const postcode = componentByType(components, 'postal_code');
      const displayName = String(top.formatted_address || '').trim();
      if (!displayName && !city && !state) {
        resolve(null);
        return;
      }
      resolve({
        displayName,
        addressLine: displayName,
        city,
        state,
        country,
        postcode,
        source: 'google',
      });
    });
  });
}

async function ensureGoogleMapsLoaded(): Promise<boolean> {
  try {
    const key = await resolveGoogleMapsApiKey();
    if (!key) return false;
    await loadGoogleMaps(key);
    return Boolean(getGoogleMaps()?.maps?.Geocoder);
  } catch {
    return false;
  }
}

async function reverseGeocodeOsmOnly(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=jsonv2&addressdetails=1&zoom=18` +
    `&lat=${encodeURIComponent(String(latitude))}` +
    `&lon=${encodeURIComponent(String(longitude))}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Location lookup failed (${response.status})`);
  }

  const data = (await response.json()) as NominatimResponse;
  const addr = data.address || {};
  const displayName = String(data.display_name || '').trim();
  const city = pickCity(addr);
  const state = pickState(addr);

  return {
    displayName,
    addressLine: buildAddressLine(addr, displayName),
    city,
    state,
    country: String(addr.country || '').trim(),
    postcode: String(addr.postcode || '').trim(),
    source: 'osm',
  };
}

/**
 * Reverse-geocode lat/lng → address, city, state.
 * Prefers Google Maps Geocoder (loads Maps JS if needed); falls back to OpenStreetMap.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Invalid coordinates for reverse geocoding');
  }

  // 1) Ensure Google Maps is available, then Geocode
  try {
    await ensureGoogleMapsLoaded();
    const googleResult = await reverseGeocodeGoogle(lat, lon);
    if (googleResult) return googleResult;
  } catch {
    // Fall through to OSM
  }

  // 2) OSM Nominatim fallback
  return reverseGeocodeOsmOnly(lat, lon);
}

/**
 * @deprecated Use `reverseGeocode` — same behavior (Google first, OSM fallback).
 */
export async function reverseGeocodeOsm(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  return reverseGeocode(latitude, longitude);
}
