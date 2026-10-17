import type { GooglePlaceResult } from './googleMapsLoader';

export interface GooglePlaceAddress {
  address: string;
  city: string;
  state: string;
  country: string;
  postcode: string;
  lat: number;
  lng: number;
  placeId: string;
  name: string;
}

function componentByType(
  components: GooglePlaceResult['address_components'],
  type: string,
  useShort = false
): string {
  const match = (components || []).find((c) => c.types?.includes(type));
  if (!match) return '';
  return String(useShort ? match.short_name : match.long_name || '').trim();
}

/** Extract city/state/country/postal from Google address_components (never by splitting formatted address). */
export function extractAddressComponents(
  components: GooglePlaceResult['address_components']
): Pick<GooglePlaceAddress, 'city' | 'state' | 'country' | 'postcode'> {
  const city =
    componentByType(components, 'locality') ||
    componentByType(components, 'postal_town') ||
    componentByType(components, 'administrative_area_level_2') ||
    componentByType(components, 'sublocality_level_1') ||
    componentByType(components, 'sublocality');
  const state = componentByType(components, 'administrative_area_level_1');
  const country = componentByType(components, 'country');
  const postcode = componentByType(components, 'postal_code');
  return { city, state, country, postcode };
}

export function parseGooglePlace(place: GooglePlaceResult): GooglePlaceAddress | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  const rawLat = typeof loc.lat === 'function' ? loc.lat() : Number((loc as unknown as { lat: number }).lat);
  const rawLng = typeof loc.lng === 'function' ? loc.lng() : Number((loc as unknown as { lng: number }).lng);
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const parts = extractAddressComponents(place.address_components);
  const address =
    String(place.formatted_address || '').trim() ||
    [place.name, parts.city, parts.state, parts.postcode, parts.country].filter(Boolean).join(', ');

  return {
    address,
    city: parts.city,
    state: parts.state,
    country: parts.country,
    postcode: parts.postcode,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    placeId: String(place.place_id || ''),
    name: String(place.name || '').trim(),
  };
}

export const STREET_LEVEL_ZOOM = 18;
