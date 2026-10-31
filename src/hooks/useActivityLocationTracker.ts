import { useEffect, useRef } from 'react';
import { crmApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { reverseGeocode } from '../utils/reverseGeocode';

export const ACTIVE_ACTIVITY_STORAGE_KEY = 'openext_crm_active_activity_id';
const TRACKING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function useActivityLocationTracker() {
  const { user, activeRole } = useAuth();
  const lastLoggedRef = useRef<number>(0);

  useEffect(() => {
    // Background tracking is strictly restricted to sales representatives only
    if (!user?.userId || activeRole !== 'sales-representative') return;

    const performLocationLog = async () => {
      let activeActivityId: string | null = null;
      try {
        activeActivityId = localStorage.getItem(ACTIVE_ACTIVITY_STORAGE_KEY);
      } catch {
        return;
      }
      if (!activeActivityId) return;

      // Ensure at least 60 seconds have elapsed between rapid re-triggers
      const now = Date.now();
      if (now - lastLoggedRef.current < 60000) return;
      lastLoggedRef.current = now;

      if (typeof navigator === 'undefined' || !navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const latitude = Number(position.coords.latitude.toFixed(6));
            const longitude = Number(position.coords.longitude.toFixed(6));
            const accuracy = Number.isFinite(position.coords.accuracy)
              ? Math.round(position.coords.accuracy)
              : null;

            let address = '';
            try {
              const geo = await reverseGeocode(latitude, longitude);
              address = (geo.addressLine || geo.displayName || '').slice(0, 400);
            } catch {
              // ignore geocode failure
            }

            if (activeActivityId) {
              await crmApi.logActivityLocation(activeActivityId, {
                latitude,
                longitude,
                accuracy,
                address,
              });
            }
          } catch (err) {
            console.warn('[ActivityLocationTracker] Failed to send location log', err);
          }
        },
        (err) => {
          console.warn('[ActivityLocationTracker] Geolocation error', err?.message || err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };

    // Initial check shortly after load if an active activity is present
    const initTimer = setTimeout(() => {
      void performLocationLog();
    }, 5000);

    // Setup 30-minute interval
    const interval = setInterval(() => {
      void performLocationLog();
    }, TRACKING_INTERVAL_MS);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [user?.userId, activeRole]);
}
