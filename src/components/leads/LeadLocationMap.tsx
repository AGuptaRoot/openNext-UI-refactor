import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import {
  parseGooglePlace,
  STREET_LEVEL_ZOOM,
  type GooglePlaceAddress,
} from '../../utils/googlePlaceAddress';
import {
  ensureGooglePacStyles,
  getGoogleMaps,
  hideGooglePacContainers,
  loadGoogleMaps,
  removeGooglePacContainers,
  resolveGoogleMapsApiKey,
  type GoogleAutocomplete,
  type GoogleCircle,
  type GoogleMap,
  type GoogleMarker,
  type GooglePlaceResult,
} from '../../utils/googleMapsLoader';

/** Great-circle distance in metres (Haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}

/**
 * If the target is outside `radiusM` of the origin, clamp it to the circle edge.
 */
export function clampLatLngToRadius(
  originLat: number,
  originLng: number,
  lat: number,
  lng: number,
  radiusM: number
): { lat: number; lng: number; clamped: boolean; distance: number } {
  const distance = distanceMeters(originLat, originLng, lat, lng);
  if (distance <= radiusM) {
    return { lat, lng, clamped: false, distance };
  }
  const ratio = radiusM / distance;
  return {
    lat: originLat + (lat - originLat) * ratio,
    lng: originLng + (lng - originLng) * ratio,
    clamped: true,
    distance: radiusM,
  };
}

interface LeadLocationMapProps {
  latitude: number | '' | null;
  longitude: number | '' | null;
  address?: string;
  readOnly?: boolean;
  /** Fired continuously while the pin moves (click / drag). */
  onChange?: (lat: number, lng: number) => void;
  /** Fired when the pin settles (click or drag end). */
  onSettle?: (lat: number, lng: number) => void;
  /**
   * When true, shows Google Places search bound to this map.
   * Selecting a place drops the pin and calls onPlaceSelect + onChange/onSettle.
   * Default: true
   */
  showSearch?: boolean;
  /** Disable the Places search input without remounting the map. */
  searchDisabled?: boolean;
  /** Fired when a Google Places suggestion is chosen (address fields). */
  onPlaceSelect?: (place: GooglePlaceAddress) => void;
  /** When set (after “Use my location”), pin adjustments limited to this radius. */
  anchorLatitude?: number | '' | null;
  anchorLongitude?: number | '' | null;
  maxRadiusMeters?: number;
  height?: string;
  apiKey?: string;
}

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

function bindMarkerDrag(
  marker: GoogleMarker,
  resolvePoint: (lat: number, lng: number) => { lat: number; lng: number; clamped: boolean },
  isDraggingRef: React.MutableRefObject<boolean>,
  onChangeRef: React.MutableRefObject<((lat: number, lng: number) => void) | undefined>,
  onSettleRef: React.MutableRefObject<((lat: number, lng: number) => void) | undefined>
) {
  marker.addListener('dragstart', () => {
    isDraggingRef.current = true;
  });
  marker.addListener('drag', () => {
    const pos = marker.getPosition();
    if (!pos) return;
    const resolved = resolvePoint(pos.lat(), pos.lng());
    if (resolved.clamped) {
      marker.setPosition({ lat: resolved.lat, lng: resolved.lng });
    }
    onChangeRef.current?.(resolved.lat, resolved.lng);
  });
  marker.addListener('dragend', () => {
    isDraggingRef.current = false;
    const pos = marker.getPosition();
    if (!pos) return;
    const resolved = resolvePoint(pos.lat(), pos.lng());
    marker.setPosition({ lat: resolved.lat, lng: resolved.lng });
    onChangeRef.current?.(resolved.lat, resolved.lng);
    onSettleRef.current?.(resolved.lat, resolved.lng);
  });
}

/**
 * Interactive Google Map for lead location with integrated Google Search,
 * autocomplete suggestions, instant marker placement, and live coordinates display.
 */
export const LeadLocationMap: React.FC<LeadLocationMapProps> = ({
  latitude,
  longitude,
  address,
  readOnly = false,
  onChange,
  onSettle,
  showSearch = true,
  searchDisabled = false,
  onPlaceSelect,
  anchorLatitude,
  anchorLongitude,
  maxRadiusMeters = 50,
  height = '240px',
  apiKey,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const circleRef = useRef<GoogleCircle | null>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const onChangeRef = useRef(onChange);
  const onSettleRef = useRef(onSettle);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const anchorRef = useRef<{ lat: number; lng: number } | null>(null);
  const maxRadiusRef = useRef(maxRadiusMeters);
  const isDraggingRef = useRef(false);
  const readOnlyRef = useRef(readOnly);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(address || '');
  const [searching, setSearching] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [candidates, setCandidates] = useState<GooglePlaceAddress[]>([]);
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const skipNextReverseRef = useRef(false);
  const didInitialAddressGeocodeRef = useRef(false);
  const reverseGeocodeCoordsRef = useRef<(lat: number, lng: number) => void>(() => {});
  const handleManualSearchRef = useRef<(queryOverride?: string) => void>(() => {});
  const onSettlePropRef = useRef(onSettle);
  onSettlePropRef.current = onSettle;

  onChangeRef.current = onChange;
  onPlaceSelectRef.current = onPlaceSelect;
  maxRadiusRef.current = maxRadiusMeters;
  readOnlyRef.current = readOnly;

  // Wrap settle: always notify parent, reverse-geocode unless a Places/search apply just ran.
  onSettleRef.current = (lat: number, lng: number) => {
    onSettlePropRef.current?.(lat, lng);
    if (skipNextReverseRef.current) {
      skipNextReverseRef.current = false;
      return;
    }
    reverseGeocodeCoordsRef.current(lat, lng);
  };

  const latNum = latitude !== '' && latitude != null ? Number(latitude) : NaN;
  const lngNum = longitude !== '' && longitude != null ? Number(longitude) : NaN;
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);

  const anchorLat =
    anchorLatitude !== '' && anchorLatitude != null ? Number(anchorLatitude) : NaN;
  const anchorLng =
    anchorLongitude !== '' && anchorLongitude != null ? Number(anchorLongitude) : NaN;
  const hasAnchor = Number.isFinite(anchorLat) && Number.isFinite(anchorLng);

  useEffect(() => {
    anchorRef.current = hasAnchor ? { lat: anchorLat, lng: anchorLng } : null;
  }, [hasAnchor, anchorLat, anchorLng]);

  // Sync initial address into search query input if present
  useEffect(() => {
    if (address && !searchQuery) {
      setSearchQuery(address);
      if (searchInputRef.current && !searchInputRef.current.value) {
        searchInputRef.current.value = address;
      }
    }
  }, [address, searchQuery]);

  const resolvePoint = useCallback((rawLat: number, rawLng: number) => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return {
        lat: Number(rawLat.toFixed(6)),
        lng: Number(rawLng.toFixed(6)),
        clamped: false,
      };
    }
    const result = clampLatLngToRadius(
      anchor.lat,
      anchor.lng,
      rawLat,
      rawLng,
      maxRadiusRef.current
    );
    return {
      lat: Number(result.lat.toFixed(6)),
      lng: Number(result.lng.toFixed(6)),
      clamped: result.clamped,
    };
  }, []);

  /**
   * Directly positions/updates marker, centers map, and triggers parent callbacks.
   */
  const applyPlace = useCallback(
    (parsed: GooglePlaceAddress, options?: { skipReverse?: boolean; zoom?: number }) => {
      setSearchError(null);
      setCandidates([]);
      const displayLabel = parsed.address || parsed.name;
      setSearchQuery(displayLabel);
      if (searchInputRef.current) {
        searchInputRef.current.value = displayLabel;
      }

      const map = mapRef.current;
      const google = getGoogleMaps();
      const zoom = options?.zoom ?? STREET_LEVEL_ZOOM;
      if (map && google?.maps?.Marker) {
        if (markerRef.current) {
          markerRef.current.setPosition({ lat: parsed.lat, lng: parsed.lng });
          markerRef.current.setDraggable(!readOnlyRef.current);
          markerRef.current.setTitle(displayLabel || 'Lead location');
        } else {
          const marker = new google.maps.Marker({
            position: { lat: parsed.lat, lng: parsed.lng },
            map,
            draggable: !readOnlyRef.current,
            title: displayLabel || 'Lead location',
          });
          bindMarkerDrag(marker, resolvePoint, isDraggingRef, onChangeRef, onSettleRef);
          markerRef.current = marker;
        }
        map.setCenter({ lat: parsed.lat, lng: parsed.lng });
        map.panTo({ lat: parsed.lat, lng: parsed.lng });
        map.setZoom(zoom);
      }

      if (options?.skipReverse) {
        skipNextReverseRef.current = true;
      }
      onPlaceSelectRef.current?.(parsed);
      onChangeRef.current?.(parsed.lat, parsed.lng);
      onSettleRef.current?.(parsed.lat, parsed.lng);
    },
    [resolvePoint]
  );

  const applyPlaceRef = useRef(applyPlace);
  applyPlaceRef.current = applyPlace;

  const reverseGeocodeCoords = useCallback((lat: number, lng: number) => {
    const google = getGoogleMaps();
    if (!google?.maps?.Geocoder) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results?.length) {
        setSearchError('Address not found for this map point.');
        return;
      }
      const parsed = parseGooglePlace(results[0]);
      if (!parsed) {
        setSearchError('Address not found for this map point.');
        return;
      }
      // Keep exact marker coordinates as source of truth.
      const synced: GooglePlaceAddress = {
        ...parsed,
        lat,
        lng,
      };
      setSearchError(null);
      setSearchQuery(synced.address || synced.name);
      if (searchInputRef.current) {
        searchInputRef.current.value = synced.address || synced.name;
      }
      onPlaceSelectRef.current?.(synced);
    });
  }, []);

  reverseGeocodeCoordsRef.current = reverseGeocodeCoords;

  // Manual fallback geocode when user submits custom search text
  const handleManualSearch = useCallback(
    (queryOverride?: string) => {
      const text = (queryOverride ?? searchInputRef.current?.value ?? searchQuery).trim();
      if (!text) return;
      const google = getGoogleMaps();
      if (!google?.maps?.Geocoder) {
        setSearchError('Google Geocoder is unavailable.');
        return;
      }
      setSearching(true);
      setSearchError(null);
      setCandidates([]);
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: text }, (results, status) => {
        setSearching(false);
        if (status !== 'OK' || !results?.length) {
          setSearchError(`No address found for "${text}".`);
          return;
        }
        const parsedList = results
          .map((r: GooglePlaceResult) => parseGooglePlace(r))
          .filter((p): p is GooglePlaceAddress => Boolean(p));
        if (!parsedList.length) {
          setSearchError(`No address found for "${text}".`);
          return;
        }
        if (parsedList.length === 1) {
          applyPlaceRef.current(parsedList[0], { skipReverse: true, zoom: STREET_LEVEL_ZOOM });
          return;
        }
        // Multiple matches — let the user choose instead of guessing.
        setCandidates(parsedList.slice(0, 6));
        setSearchError(null);
      });
    },
    [searchQuery]
  );
  handleManualSearchRef.current = handleManualSearch;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const pacContainer = document.querySelector('.pac-container');
      const hasActivePacItem =
        pacContainer &&
        (pacContainer.querySelector('.pac-item-selected') ||
          pacContainer.querySelector('.pac-item'));
      // If suggestions are open, let Google Autocomplete consume Enter.
      if (hasActivePacItem && (pacContainer as HTMLElement).style.display !== 'none') {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      handleManualSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchError(null);
    setCandidates([]);
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.focus();
    }
  };

  const handleCopyCoords = async () => {
    if (!hasCoords) return;
    const str = `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(str);
        setCopiedCoords(true);
        setTimeout(() => setCopiedCoords(false), 2000);
      }
    } catch {
      // fallback
    }
  };

  // Boot Google Map once (+ Places search bound to map when enabled)
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setReady(false);
    setSearchError(null);

    void (async () => {
      try {
        const key = await resolveGoogleMapsApiKey(apiKey);
        if (!key) {
          throw new Error(
            'Google Maps API key is missing. Add it under Settings → Integrations → Google Maps.'
          );
        }
        await loadGoogleMaps(key);
        if (cancelled || !mapContainerRef.current) return;

        const google = getGoogleMaps();
        const MapCtor = google?.maps?.Map;
        if (!MapCtor) {
          throw new Error('Google Maps Map unavailable');
        }

        const initLat =
          latitude !== '' && latitude != null && Number.isFinite(Number(latitude))
            ? Number(latitude)
            : NaN;
        const initLng =
          longitude !== '' && longitude != null && Number.isFinite(Number(longitude))
            ? Number(longitude)
            : NaN;
        const hasInit = Number.isFinite(initLat) && Number.isFinite(initLng);
        const center = hasInit ? { lat: initLat, lng: initLng } : DEFAULT_CENTER;
        const zoom = hasInit ? STREET_LEVEL_ZOOM : 5;

        const map = new MapCtor(mapContainerRef.current, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;

        map.addListener('click', (e) => {
          if (readOnlyRef.current) return;
          const ll = e.latLng;
          if (!ll) return;
          const resolved = resolvePoint(ll.lat(), ll.lng());
          onChangeRef.current?.(resolved.lat, resolved.lng);
          onSettleRef.current?.(resolved.lat, resolved.lng);
        });

        if (showSearch && !readOnly && searchInputRef.current) {
          const Autocomplete = google?.maps?.places?.Autocomplete;
          if (!Autocomplete) {
            setSearchError('Google Places is unavailable.');
          } else {
            // Omit restrictive types so Google returns all addresses, establishments, cities, and landmarks
            const ac = new Autocomplete(searchInputRef.current, {
              fields: [
                'formatted_address',
                'geometry',
                'name',
                'place_id',
                'address_components',
              ],
            });
            autocompleteRef.current = ac;
            // Bias suggestions to current Google Map bounds once available
            try {
              ac.bindTo('bounds', map);
            } catch {
              // ignore
            }

            ac.addListener('place_changed', () => {
              const place = ac.getPlace();
              const parsed = parseGooglePlace(place);
              hideGooglePacContainers();
              if (!parsed) {
                // Place selected without geometry — fall back to geocode by text
                const q =
                  String(place?.formatted_address || place?.name || searchInputRef.current?.value || '').trim();
                if (q) {
                  handleManualSearchRef.current(q);
                  return;
                }
                setSearchError('Could not read that place. Try another suggestion.');
                return;
              }
              applyPlaceRef.current(parsed, { skipReverse: true, zoom: STREET_LEVEL_ZOOM });
            });
          }
        }

        setReady(true);
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load Google Map');
      }
    })();

    return () => {
      cancelled = true;
      const google = getGoogleMaps();
      if (autocompleteRef.current && google?.maps?.event?.clearInstanceListeners) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        try {
          autocompleteRef.current.unbind('bounds');
        } catch {
          // ignore
        }
      }
      autocompleteRef.current = null;
      if (markerRef.current && google?.maps?.event?.clearInstanceListeners) {
        google.maps.event.clearInstanceListeners(markerRef.current);
      }
      if (mapRef.current && google?.maps?.event?.clearInstanceListeners) {
        google.maps.event.clearInstanceListeners(mapRef.current);
      }
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      mapRef.current = null;
      removeGooglePacContainers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once per apiKey/showSearch/readOnly
  }, [apiKey, showSearch, readOnly, resolvePoint]);

  // Sync marker when lat/lng change (Places search, GPS, click, clear)
  useEffect(() => {
    const map = mapRef.current;
    const google = getGoogleMaps();
    if (!ready || !map || !google?.maps?.Marker) return;

    if (hasCoords) {
      if (markerRef.current) {
        if (!isDraggingRef.current) {
          markerRef.current.setPosition({ lat: latNum, lng: lngNum });
        }
        markerRef.current.setDraggable(!readOnly);
        if (address) markerRef.current.setTitle(address);
      } else {
        const marker = new google.maps.Marker({
          position: { lat: latNum, lng: lngNum },
          map,
          draggable: !readOnly,
          title: address || 'Lead location',
        });
        bindMarkerDrag(marker, resolvePoint, isDraggingRef, onChangeRef, onSettleRef);
        markerRef.current = marker;
      }

      if (!isDraggingRef.current) {
        map.setCenter({ lat: latNum, lng: lngNum });
        map.panTo({ lat: latNum, lng: lngNum });
        const z = map.getZoom() || STREET_LEVEL_ZOOM;
        map.setZoom(Math.max(z, hasAnchor ? STREET_LEVEL_ZOOM : 16));
      }
    } else if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [ready, latNum, lngNum, address, hasCoords, readOnly, hasAnchor, resolvePoint]);

  // Existing lead: address only (no coords) → geocode once and populate coordinates
  useEffect(() => {
    if (!ready || readOnly || hasCoords || didInitialAddressGeocodeRef.current) return;
    const text = String(address || '').trim();
    if (!text) return;
    const google = getGoogleMaps();
    if (!google?.maps?.Geocoder) return;
    didInitialAddressGeocodeRef.current = true;
    setGeocodingAddress(true);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: text }, (results, status) => {
      setGeocodingAddress(false);
      if (status !== 'OK' || !results?.length) return;
      const parsed = parseGooglePlace(results[0]);
      if (!parsed) return;
      applyPlaceRef.current(parsed, { skipReverse: true, zoom: STREET_LEVEL_ZOOM });
    });
  }, [ready, readOnly, hasCoords, address]);

  // GPS adjustment circle
  useEffect(() => {
    const map = mapRef.current;
    const google = getGoogleMaps();
    if (!ready || !map || !google?.maps?.Circle) return;

    if (hasAnchor) {
      if (circleRef.current) {
        circleRef.current.setCenter({ lat: anchorLat, lng: anchorLng });
        circleRef.current.setRadius(maxRadiusMeters);
      } else {
        circleRef.current = new google.maps.Circle({
          center: { lat: anchorLat, lng: anchorLng },
          radius: maxRadiusMeters,
          map,
          strokeColor: '#18181b',
          strokeOpacity: 0.9,
          strokeWeight: 1.5,
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          clickable: false,
        });
      }
      map.panTo({ lat: anchorLat, lng: anchorLng });
      const z = map.getZoom() || 17;
      map.setZoom(Math.max(z, 17));
    } else if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
  }, [ready, hasAnchor, anchorLat, anchorLng, maxRadiusMeters]);

  // Shared Places dropdown styles (hide empty / orphaned overlays)
  useEffect(() => {
    if (!showSearch) return;
    ensureGooglePacStyles();
  }, [showSearch]);

  const hint = readOnly
    ? null
    : hasAnchor
      ? `Drag or click to fine-tune the pin within ${maxRadiusMeters} m of your current location. Latitude and longitude update live.`
      : showSearch
        ? 'Search Google Maps above or click anywhere on the map to place a pin. Coordinates update live.'
        : 'Click the Google Map to place a pin, or use “Use my location” then adjust within 50 m.';

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Google Search Map Input with suggestions and controls */}
      {showSearch && !readOnly ? (
        <div className="relative z-30 flex flex-col gap-1.5 overflow-visible">
          <div className="relative flex items-center overflow-visible">
            <SearchIcon
              sx={{ fontSize: 17 }}
              className="absolute left-3 text-zinc-400 pointer-events-none z-10"
            />
            <input
              ref={searchInputRef}
              type="text"
              disabled={!ready || Boolean(loadError) || searchDisabled || searching}
              defaultValue={address || ''}
              placeholder={
                loadError
                  ? 'Google Maps unavailable'
                  : !ready
                    ? 'Loading Google Maps…'
                    : 'Search address or place on Google Maps (e.g. Westfield Complex Surat)…'
              }
              autoComplete="off"
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCandidates([]);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                // Let Google re-show suggestions after a prior hide (display:none only).
                document.querySelectorAll<HTMLElement>('.pac-container').forEach((el) => {
                  el.style.removeProperty('display');
                });
              }}
              onBlur={() => {
                // Hide only — never remove .pac-container on blur (breaks suggestion clicks).
                window.setTimeout(() => hideGooglePacContainers(), 280);
              }}
              className="w-full border border-zinc-300 rounded-lg py-2 pl-9 pr-24 bg-white text-xs text-zinc-900 outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 disabled:bg-zinc-50 disabled:text-zinc-400 shadow-2xs placeholder:text-zinc-400"
            />
            <div className="absolute right-1.5 flex items-center gap-1 z-10">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                  title="Clear search"
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleManualSearch()}
                disabled={!ready || !searchQuery.trim() || searching}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Search this location on Google Maps"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
          </div>
          {candidates.length > 1 ? (
            <ul className="relative z-40 m-0 list-none rounded-lg border border-zinc-200 bg-white p-0 shadow-lg max-h-56 overflow-y-auto">
              {candidates.map((c, idx) => (
                <li key={`${c.placeId || c.address}-${idx}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      applyPlaceRef.current(c, { skipReverse: true, zoom: STREET_LEVEL_ZOOM })
                    }
                    className="w-full text-left px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-100 border-0 bg-transparent cursor-pointer border-b border-zinc-100 last:border-b-0"
                  >
                    <span className="font-medium text-zinc-900 block">{c.name || c.address}</span>
                    {c.name && c.address !== c.name ? (
                      <span className="text-[11px] text-zinc-500">{c.address}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {searchError ? (
            <p className="m-0 text-[11px] text-red-600 font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden /> {searchError}
            </p>
          ) : searching || geocodingAddress ? (
            <div className="text-[11px] text-zinc-500">Looking up address…</div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span>Type for Google suggestions, or press Enter / Search. Use ↑↓ + Enter in the dropdown.</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Google Map Viewport — keep below search/pac (z-index); overflow only on map tile */}
      <div
        ref={mapContainerRef}
        style={{ height }}
        className="w-full rounded-lg border border-zinc-200 overflow-hidden z-0 shadow-none bg-zinc-100 relative isolate"
      />

      {/* Selected Location Details Card: Address, Latitude, Longitude & Actions */}
      {hasCoords ? (
        <div className="rounded-lg border border-zinc-200/90 bg-gradient-to-br from-white to-zinc-50/60 p-3 shadow-xs text-xs flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                <PlaceOutlinedIcon sx={{ fontSize: 15 }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-zinc-900 text-xs">
                    Selected Location
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Marker Placed
                  </span>
                </div>
                <p className="mt-0.5 text-zinc-700 text-xs font-normal leading-relaxed break-words">
                  {address || searchQuery || 'Pin placed on map'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyCoords}
                title="Copy latitude and longitude"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors shadow-2xs"
              >
                {copiedCoords ? (
                  <>
                    <CheckIcon sx={{ fontSize: 13 }} className="text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <ContentCopyIcon sx={{ fontSize: 13 }} className="text-zinc-500" />
                    <span>Copy Coords</span>
                  </>
                )}
              </button>
              <a
                href={`https://www.google.com/maps?q=${latNum},${lngNum}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Google Maps"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors shadow-2xs"
              >
                <OpenInNewIcon sx={{ fontSize: 13 }} className="text-zinc-500" />
                <span>Maps</span>
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100/80 text-zinc-800 border border-zinc-200/60 font-mono text-xs">
              <span className="font-medium text-zinc-500 font-sans text-[11px]">Latitude:</span>
              <span className="font-semibold text-zinc-900">{latNum.toFixed(6)}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100/80 text-zinc-800 border border-zinc-200/60 font-mono text-xs">
              <span className="font-medium text-zinc-500 font-sans text-[11px]">Longitude:</span>
              <span className="font-semibold text-zinc-900">{lngNum.toFixed(6)}</span>
            </div>
            <span className="text-[11px] text-zinc-400 ml-auto hidden sm:inline">
              {readOnly ? 'Pin locked' : 'Click map or drag pin to adjust coordinates'}
            </span>
          </div>
        </div>
      ) : null}

      {/* Status / Errors / Hint */}
      {loadError ? (
        <span className="text-[11px] text-red-700 font-medium">{loadError}</span>
      ) : !ready ? (
        <span className="text-[11px] text-zinc-400 font-medium">Loading Google Map…</span>
      ) : hint && !hasCoords ? (
        <span className="text-[11px] text-zinc-400 font-medium">{hint}</span>
      ) : null}
    </div>
  );
};
