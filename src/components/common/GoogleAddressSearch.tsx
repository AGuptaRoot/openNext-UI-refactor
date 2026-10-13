import React, { useEffect, useRef, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';

import {
  getGoogleMaps,
  loadGoogleMaps,
  resolveGoogleMapsApiKey,
  type GoogleAutocomplete,
  type GooglePlaceResult,
} from '../../utils/googleMapsLoader';

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

interface GoogleAddressSearchProps {
  onPlaceSelect: (place: GooglePlaceAddress) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Optional prefill of the search box (does not fire onPlaceSelect). */
  initialQuery?: string;
  apiKey?: string;
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

export function parseGooglePlace(place: GooglePlaceResult): GooglePlaceAddress | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  const lat = Number(loc.lat());
  const lng = Number(loc.lng());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const components = place.address_components || [];
  const city =
    componentByType(components, 'locality') ||
    componentByType(components, 'administrative_area_level_2') ||
    componentByType(components, 'sublocality') ||
    componentByType(components, 'postal_town') ||
    componentByType(components, 'sublocality_level_1');
  const state = componentByType(components, 'administrative_area_level_1');
  const country = componentByType(components, 'country');
  const postcode = componentByType(components, 'postal_code');
  const address =
    String(place.formatted_address || '').trim() ||
    [place.name, city, state, postcode, country].filter(Boolean).join(', ');

  return {
    address,
    city,
    state,
    country,
    postcode,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    placeId: String(place.place_id || ''),
    name: String(place.name || '').trim(),
  };
}

/**
 * Google Places Autocomplete search — pick an address to fill lead location fields.
 */
export const GoogleAddressSearch: React.FC<GoogleAddressSearchProps> = ({
  onPlaceSelect,
  placeholder = 'Search address on Google Maps…',
  disabled = false,
  className = '',
  initialQuery = '',
  apiKey,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const onSelectRef = useRef(onPlaceSelect);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  onSelectRef.current = onPlaceSelect;

  useEffect(() => {
    // Keep Places dropdown above MUI Dialog / sticky headers
    const styleId = 'opennext-crm-google-pac-zindex';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = '.pac-container{z-index:20000 !important;}';
      document.head.appendChild(style);
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    void resolveGoogleMapsApiKey(apiKey)
      .then((key) => {
        if (cancelled) return;
        if (!key) {
          setStatus('error');
          setError(
            'Google Maps API key is missing. Add it under Settings → Integrations → Google Maps.'
          );
          return;
        }
        return loadGoogleMaps(key).then(() => {
          if (cancelled || !inputRef.current) return;
          const google = getGoogleMaps();
          const Autocomplete = google?.maps?.places?.Autocomplete;
          if (!Autocomplete) {
            setStatus('error');
            setError('Google Places is unavailable.');
            return;
          }

          if (autocompleteRef.current && google?.maps?.event?.clearInstanceListeners) {
            google.maps.event.clearInstanceListeners(autocompleteRef.current);
          }

          const ac = new Autocomplete(inputRef.current, {
            fields: [
              'formatted_address',
              'geometry',
              'name',
              'place_id',
              'address_components',
            ],
          });
          autocompleteRef.current = ac;
          ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            const parsed = parseGooglePlace(place);
            if (!parsed) {
              setError('Could not read that place. Try another suggestion.');
              return;
            }
            setError(null);
            onSelectRef.current(parsed);
          });
          setStatus('ready');
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to load Google Maps');
      });

    return () => {
      cancelled = true;
      const google = getGoogleMaps();
      if (autocompleteRef.current && google?.maps?.event?.clearInstanceListeners) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    if (inputRef.current && initialQuery && !inputRef.current.value) {
      inputRef.current.value = initialQuery;
    }
  }, [initialQuery]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
        <MapIcon sx={{ fontSize: 14 }} />
        Find address (Google Maps)
      </label>
      <div className="relative">
        <SearchIcon
          sx={{ fontSize: 16 }}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled || status === 'loading' || status === 'error'}
          placeholder={
            status === 'loading'
              ? 'Loading Google Maps…'
              : status === 'error'
                ? 'Google Maps unavailable'
                : placeholder
          }
          autoComplete="off"
          className="w-full border border-zinc-300 rounded-lg py-2 pl-8 pr-2.5 bg-white text-xs text-zinc-900 outline-none focus:border-zinc-950 disabled:bg-zinc-50 disabled:text-zinc-400"
        />
      </div>
      {error ? (
        <p className="m-0 text-[11px] text-red-700">{error}</p>
      ) : (
        <p className="m-0 text-[11px] text-zinc-500">
          Type a place or address, then pick a Google suggestion. Address, city, state and map pin
          update automatically.
        </p>
      )}
    </div>
  );
};
