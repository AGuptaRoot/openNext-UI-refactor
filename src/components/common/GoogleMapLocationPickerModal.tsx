import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, X, Check, AlertCircle } from 'lucide-react';
import { loadGoogleMaps, getGoogleMaps } from '../../utils/googleMapsLoader';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address?: string;
}

interface GoogleMapLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: LocationCoordinates) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  title?: string;
}

export const GoogleMapLocationPickerModal: React.FC<GoogleMapLocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialLat,
  initialLng,
  title = 'Pin Location on Map',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [latitude, setLatitude] = useState<number>(initialLat || 28.6139);
  const [longitude, setLongitude] = useState<number>(initialLng || 77.2090);
  const [address, setAddress] = useState('');
  const [locatingCurrent, setLocatingCurrent] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingMap(true);
    setLoadError('');

    const seedLat = initialLat != null ? initialLat : 28.6139;
    const seedLng = initialLng != null ? initialLng : 77.2090;
    setLatitude(seedLat);
    setLongitude(seedLng);

    let active = true;

    // Load Google Maps (supports keyless / demo mode)
    loadGoogleMaps(undefined, true)
      .then(() => {
        if (!active) return;
        const g = getGoogleMaps();
        if (!g?.maps || !mapContainerRef.current) {
          throw new Error('Google Maps not available');
        }

        const center = new g.maps.LatLng(seedLat, seedLng);
        const map = new g.maps.Map(mapContainerRef.current, {
          center,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapInstanceRef.current = map;

        const marker = new g.maps.Marker({
          position: center,
          map,
          draggable: true,
          title: 'Drag me to adjust location',
        });
        markerRef.current = marker;

        const updateCoords = (lat: number, lng: number) => {
          const roundLat = Number(lat.toFixed(6));
          const roundLng = Number(lng.toFixed(6));
          setLatitude(roundLat);
          setLongitude(roundLng);

          // Reverse geocode if geocoder is present
          if (g.maps?.Geocoder) {
            const geocoder = new g.maps.Geocoder();
            geocoder.geocode({ location: { lat: roundLat, lng: roundLng } }, (results: any, status: string) => {
              if (status === 'OK' && results?.[0]?.formatted_address) {
                setAddress(results[0].formatted_address);
              }
            });
          }
        };

        // Marker drag listener
        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (pos) {
            updateCoords(pos.lat(), pos.lng());
          }
        });

        // Map click listener to move marker
        map.addListener('click', (e: any) => {
          if (e.latLng) {
            marker.setPosition(e.latLng);
            updateCoords(e.latLng.lat(), e.latLng.lng());
          }
        });

        setLoadingMap(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoadingMap(false);
        setLoadError(err?.message || 'Google Maps demo API could not be loaded');
      });

    return () => {
      active = false;
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [isOpen, initialLat, initialLng]);

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingCurrent(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingCurrent(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);

        const g = getGoogleMaps();
        if (mapInstanceRef.current && markerRef.current && g?.maps) {
          const newPos = new g.maps.LatLng(lat, lng);
          mapInstanceRef.current.panTo(newPos);
          mapInstanceRef.current.setZoom(16);
          markerRef.current.setPosition(newPos);
        }
      },
      (err) => {
        setLocatingCurrent(false);
        alert(err?.message || 'Unable to retrieve your current location.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirm = () => {
    onSelect({
      latitude,
      longitude,
      address: address.trim() || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="m-0 text-sm font-bold text-zinc-950">{title}</h3>
              <p className="m-0 text-[11px] text-zinc-500">
                Click on the map or drag the pin to capture exact Latitude & Longitude.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 border-none bg-transparent cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map Container Area */}
        <div className="relative w-full h-80 sm:h-96 bg-zinc-100">
          {loadingMap && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-50 z-10">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-zinc-500 font-medium">Initializing Google Map…</span>
            </div>
          )}

          {loadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-zinc-50">
              <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-xs font-semibold text-zinc-800 m-0">Interactive map unavailable</p>
              <p className="text-[11px] text-zinc-500 mt-1 mb-4 max-w-md">
                {loadError}. You can still manually enter the coordinates below.
              </p>
              <div className="flex gap-3 max-w-xs w-full">
                <input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(Number(e.target.value))}
                  placeholder="Latitude"
                  className="flex-1 h-8 px-2 text-xs border border-zinc-300 rounded font-mono"
                />
                <input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(Number(e.target.value))}
                  placeholder="Longitude"
                  className="flex-1 h-8 px-2 text-xs border border-zinc-300 rounded font-mono"
                />
              </div>
            </div>
          ) : (
            <div ref={mapContainerRef} className="w-full h-full" />
          )}

          {/* Quick Floating Action: Detect Current Location */}
          {!loadError && (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locatingCurrent}
              className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-zinc-800 text-xs font-semibold rounded-lg shadow-md border border-zinc-200 cursor-pointer transition-all hover:shadow-lg disabled:opacity-60"
            >
              <Navigation className={`w-3.5 h-3.5 text-blue-600 ${locatingCurrent ? 'animate-pulse' : ''}`} />
              {locatingCurrent ? 'Locating…' : 'My Location'}
            </button>
          )}
        </div>

        {/* Selected Coordinates Bar */}
        <div className="px-5 py-3 bg-zinc-50 border-t border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-zinc-600">Selected Coordinates:</span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="bg-white border border-zinc-200 rounded px-2 py-0.5 font-bold text-zinc-900">
                Lat: {latitude.toFixed(6)}
              </span>
              <span className="bg-white border border-zinc-200 rounded px-2 py-0.5 font-bold text-zinc-900">
                Lng: {longitude.toFixed(6)}
              </span>
            </div>
          </div>
          {address ? (
            <div className="text-[11px] text-zinc-500 truncate max-w-sm" title={address}>
              📍 {address}
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-zinc-300 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="h-9 px-4 rounded-lg border-0 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};
