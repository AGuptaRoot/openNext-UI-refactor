import type { ActivityLocation } from '../types/leads';
import { reverseGeocode } from './reverseGeocode';

/**
 * Capture the sales rep's position for a lead activity.
 *
 * Always resolves — never rejects. When the browser has no geolocation, the
 * user denies it, or the fix times out, the reading comes back without
 * coordinates and with `unavailableReason` set, so the activity still saves and
 * the Activity Location report can tell "denied" apart from "never captured".
 */
export async function captureActivityLocation(
  options: { timeoutMs?: number; geocode?: boolean } = {}
): Promise<ActivityLocation> {
  const { timeoutMs = 10000, geocode = true } = options;

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: GeolocationPosition | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // Belt and braces: some browsers never invoke either callback when a
    // permission prompt is dismissed, which would hang the save.
    const timer = setTimeout(() => finish(null), timeoutMs + 1000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        finish(pos);
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });

  if (!position) {
    const unsupported = typeof navigator === 'undefined' || !navigator.geolocation;
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      address: '',
      capturedAt: new Date().toISOString(),
      unavailableReason: unsupported
        ? 'Geolocation not supported by this browser'
        : 'Location permission denied or unavailable',
    };
  }

  const latitude = Number(position.coords.latitude.toFixed(6));
  const longitude = Number(position.coords.longitude.toFixed(6));
  const accuracy = Number.isFinite(position.coords.accuracy)
    ? Math.round(position.coords.accuracy)
    : null;

  let address = '';
  if (geocode) {
    try {
      const result = await reverseGeocode(latitude, longitude);
      address = result.addressLine || result.displayName || '';
    } catch {
      // Coordinates are the useful part; a missing label is not worth failing.
    }
  }

  return {
    latitude,
    longitude,
    accuracy,
    address: address.slice(0, 400),
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
    unavailableReason: '',
  };
}

/** Google Maps link for a captured reading, or null when there are no coords. */
export function mapsLinkFor(location: ActivityLocation | null | undefined): string | null {
  if (!location || location.latitude == null || location.longitude == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

/** Short human label for a reading — address when known, else coordinates. */
export function describeLocation(location: ActivityLocation | null | undefined): string {
  if (!location) return 'Not captured';
  if (location.latitude == null || location.longitude == null) {
    return location.unavailableReason || 'Not captured';
  }
  if (location.address) return location.address;
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

/** Calculate straight-line distance in meters between two GPS coordinates using the Haversine formula. */
export function calculateDistanceMeters(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return null;
  }

  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/** Format distance in meters to a clean readable string (e.g. "32 m", "150 m", "1.25 km"). */
export function formatDistance(meters: number | null | undefined, fallback: string = 'N/A'): string {
  if (meters == null || !Number.isFinite(meters)) return fallback;
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
