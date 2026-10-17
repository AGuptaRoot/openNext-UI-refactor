import React, { useEffect, useRef, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';

import {
  ensureGooglePacStyles,
  getGoogleMaps,
  hideGooglePacContainers,
  loadGoogleMaps,
  resolveGoogleMapsApiKey,
  type GoogleAutocomplete,
} from '../../utils/googleMapsLoader';
import {
  parseGooglePlace,
  type GooglePlaceAddress,
} from '../../utils/googlePlaceAddress';

export type { GooglePlaceAddress };
export { parseGooglePlace } from '../../utils/googlePlaceAddress';

interface GoogleAddressSearchProps {
  onPlaceSelect: (place: GooglePlaceAddress) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Optional prefill of the search box (does not fire onPlaceSelect). */
  initialQuery?: string;
  apiKey?: string;
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
    ensureGooglePacStyles();

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
            hideGooglePacContainers();
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
      hideGooglePacContainers();
    };
  }, [apiKey]);

  useEffect(() => {
    if (!inputRef.current || !initialQuery) return;
    if (!inputRef.current.value) {
      inputRef.current.value = initialQuery;
    }
  }, [initialQuery]);

  return (
    <div className={`relative z-20 overflow-visible ${className}`.trim()}>
      <div className="relative flex items-center">
        <SearchIcon
          sx={{ fontSize: 16 }}
          className="absolute left-2.5 text-zinc-400 pointer-events-none"
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
          onBlur={() => {
            // Delay so a pac-item mousedown/click can finish; only hide, do not remove.
            window.setTimeout(() => hideGooglePacContainers(), 350);
          }}
          className="w-full border border-zinc-300 rounded-lg py-2 pl-8 pr-2.5 bg-white text-xs text-zinc-900 outline-none focus:border-zinc-950 disabled:bg-zinc-50 disabled:text-zinc-400"
        />
        <MapIcon
          sx={{ fontSize: 15 }}
          className="absolute right-2.5 text-zinc-300 pointer-events-none"
        />
      </div>
      {error ? <p className="mb-0 mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
};
