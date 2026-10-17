import { getGoogleMapsApiKey, GOOGLE_MAPS_SCRIPT_ID } from '../config/googleMaps';
import { crmApi } from '../services/api';

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      Map: new (el: HTMLElement, opts?: Record<string, unknown>) => GoogleMap;
      Marker: new (opts?: Record<string, unknown>) => GoogleMarker;
      Circle: new (opts?: Record<string, unknown>) => GoogleCircle;
      LatLng: new (lat: number, lng: number) => GoogleLatLng;
      Geocoder: new () => GoogleGeocoder;
      event?: {
        clearInstanceListeners?: (instance: unknown) => void;
      };
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          opts?: Record<string, unknown>
        ) => GoogleAutocomplete;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
  };
  __opennextCrmGoogleMapsReady?: Promise<void>;
  __opennextCrmGoogleMapsResolve?: () => void;
  __opennextCrmGoogleMapsReject?: (err: Error) => void;
};

export type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

export type GoogleMap = {
  setCenter: (latLng: GoogleLatLng | { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
  panTo: (latLng: GoogleLatLng | { lat: number; lng: number }) => void;
  addListener: (event: string, handler: (e: GoogleMapMouseEvent) => void) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type GoogleMapMouseEvent = {
  latLng?: GoogleLatLng | null;
};

export type GoogleMarker = {
  setPosition: (latLng: GoogleLatLng | { lat: number; lng: number }) => void;
  getPosition: () => GoogleLatLng | null | undefined;
  setMap: (map: GoogleMap | null) => void;
  setDraggable: (draggable: boolean) => void;
  setTitle: (title: string) => void;
  addListener: (event: string, handler: () => void) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type GoogleCircle = {
  setCenter: (latLng: GoogleLatLng | { lat: number; lng: number }) => void;
  setRadius: (radius: number) => void;
  setMap: (map: GoogleMap | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type GoogleGeocoder = {
  geocode: (
    request: {
      location?: { lat: number; lng: number };
      address?: string;
      bounds?: unknown;
    },
    callback: (
      results: Array<GooglePlaceResult> | null,
      status: string
    ) => void
  ) => void;
};

export type GoogleAutocomplete = {
  addListener: (event: string, handler: () => void) => unknown;
  getPlace: () => GooglePlaceResult;
  bindTo: (key: string, target: GoogleMap) => void;
  unbind: (key: string) => void;
  setBounds?: (bounds: {
    east: number;
    west: number;
    north: number;
    south: number;
  }) => void;
};

export type GooglePlaceResult = {
  formatted_address?: string;
  name?: string;
  place_id?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
};

declare global {
  // eslint-disable-next-line no-var
  var __opennextCrmGoogleMapsCallback: (() => void) | undefined;
}

function mapsCoreReady(w: GoogleMapsWindow): boolean {
  return Boolean(w.google?.maps?.Map && w.google?.maps?.Marker);
}

function mapsPlacesReady(w: GoogleMapsWindow): boolean {
  return Boolean(mapsCoreReady(w) && w.google?.maps?.places?.Autocomplete);
}

/**
 * Resolve Maps API key: explicit → Settings Integrations → env.
 */
export async function resolveGoogleMapsApiKey(explicit?: string): Promise<string> {
  const fromProp = String(explicit || '').trim();
  if (fromProp) return fromProp;
  try {
    const res = await crmApi.getGoogleMapsClientKey();
    const fromSettings = String(res.data?.apiKey || '').trim();
    if (fromSettings) return fromSettings;
  } catch {
    // Fall through
  }
  return getGoogleMapsApiKey();
}

/**
 * Load Google Maps JavaScript API (core + places) once per page.
 */
export function loadGoogleMaps(apiKey?: string): Promise<void> {
  const key = String(apiKey || getGoogleMapsApiKey()).trim();
  if (!key) {
    return Promise.reject(new Error('Google Maps API key is not configured'));
  }

  const w = window as GoogleMapsWindow;
  if (mapsPlacesReady(w)) {
    return Promise.resolve();
  }

  if (w.__opennextCrmGoogleMapsReady) {
    return w.__opennextCrmGoogleMapsReady.then(() => {
      if (!mapsPlacesReady(w) && !mapsCoreReady(w)) {
        throw new Error('Google Maps failed to initialize');
      }
    });
  }

  w.__opennextCrmGoogleMapsReady = new Promise<void>((resolve, reject) => {
    w.__opennextCrmGoogleMapsResolve = resolve;
    w.__opennextCrmGoogleMapsReject = reject;

    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existing) {
      // Script tag present but maps not ready yet — wait for callback
      return;
    }

    globalThis.__opennextCrmGoogleMapsCallback = () => {
      if (mapsCoreReady(w)) {
        w.__opennextCrmGoogleMapsResolve?.();
      } else {
        w.__opennextCrmGoogleMapsReject?.(
          new Error('Google Maps loaded without Map/Marker')
        );
      }
    };

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(key)}` +
      `&libraries=places` +
      `&callback=__opennextCrmGoogleMapsCallback`;
    script.onerror = () => {
      w.__opennextCrmGoogleMapsReject?.(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });

  return w.__opennextCrmGoogleMapsReady;
}

/** @deprecated Use loadGoogleMaps — same loader (includes Places). */
export function loadGoogleMapsPlaces(apiKey?: string): Promise<void> {
  return loadGoogleMaps(apiKey);
}

export function getGoogleMaps(): GoogleMapsWindow['google'] {
  return (window as GoogleMapsWindow).google;
}

const PAC_STYLE_ID = 'opennext-crm-google-pac-styles';

/**
 * Shared Google Places Autocomplete dropdown styles.
 * Prevents orphaned `.pac-container` nodes from covering the whole CRM UI
 * (common in CMS iframes when the dropdown is left open after navigation).
 */
export function ensureGooglePacStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PAC_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PAC_STYLE_ID;
  style.textContent = `
    .pac-container {
      z-index: 2147483000 !important;
      position: absolute !important;
      box-sizing: border-box !important;
      font-family: inherit !important;
      border-radius: 8px !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      border: 1px solid #e4e4e7 !important;
      margin-top: 4px !important;
      padding: 4px 0 !important;
      max-width: min(560px, calc(100vw - 24px)) !important;
      max-height: 280px !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      background: #fff !important;
      pointer-events: auto !important;
    }
    /* Only truly empty nodes must be inert — do not hide while Google is filling .pac-item */
    .pac-container:empty {
      display: none !important;
      pointer-events: none !important;
    }
    .pac-item {
      padding: 8px 12px !important;
      cursor: pointer !important;
      font-size: 13px !important;
      line-height: 1.4 !important;
      border-top: 1px solid #f4f4f5 !important;
      pointer-events: auto !important;
    }
    .pac-item:first-child {
      border-top: none !important;
    }
    .pac-item:hover,
    .pac-item-selected {
      background-color: #f4f4f5 !important;
    }
    .pac-item-query {
      font-size: 13px !important;
      color: #18181b !important;
      font-weight: 500 !important;
    }
    .pac-matched {
      font-weight: 700 !important;
      color: #09090b !important;
    }
    .pac-icon {
      margin-top: 3px !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Hide Places dropdowns. Only set display — Google clears/toggles display
 * on the next keystroke. Do NOT set visibility/opacity (those stick and
 * break autocomplete until the node is recreated).
 */
export function hideGooglePacContainers(): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLElement>('.pac-container').forEach((el) => {
    el.style.display = 'none';
    el.style.removeProperty('visibility');
    el.style.removeProperty('opacity');
    el.style.removeProperty('pointer-events');
  });
}

/** Remove Places dropdown nodes from document.body (Google recreates on next search). */
export function removeGooglePacContainers(): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.pac-container').forEach((el) => {
    el.parentElement?.removeChild(el);
  });
}
