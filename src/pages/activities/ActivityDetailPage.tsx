import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Flag,
  Lock,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Target,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import type { LeadEvent, ActivityLocation, ActivityLocationLog, LeadItem } from '../../types/crm';
import {
  captureActivityLocation,
  mapsLinkFor,
  describeLocation,
  calculateDistanceMeters,
  formatDistance,
} from '../../utils/captureActivityLocation';
import { reverseGeocode } from '../../utils/reverseGeocode';
import { activityDisplayStatus, activityStatusClass, isMissedActivity } from '../../utils/activityStatus';
import { ACTIVE_ACTIVITY_STORAGE_KEY } from '../../hooks/useActivityLocationTracker';

const GOAL_THRESHOLD_METERS = 200; // Geofence threshold in meters for goal area detection

function formatDateTime(val?: string | null): string {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function formatTimeOnly(val?: string | null): string {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function cleanUserLabel(val?: string | null, fallback: string = '—'): string {
  if (!val) return fallback;
  const s = String(val).trim();
  // Strip 24-character hexadecimal MongoDB ObjectIds so raw database keys are never exposed in UI
  if (/^[0-9a-fA-F]{24}$/.test(s) || /^[0-9a-fA-F]{32}$/.test(s)) {
    return fallback;
  }
  return s;
}

function hasCoords(loc?: ActivityLocation | null): loc is ActivityLocation & { latitude: number; longitude: number } {
  return Boolean(loc && loc.latitude != null && loc.longitude != null);
}

function embedMapUrl(lat: number, lng: number): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=15&output=embed`;
}

/**
 * Interactive Leaflet trail map component that dynamically loads Leaflet CSS & JS from CDN.
 */
const LocationTrailMap: React.FC<{
  logs: ActivityLocationLog[];
  goalLocation?: ActivityLocation | null;
  startingLocation?: ActivityLocation | null;
  completedLocation?: ActivityLocation | null;
}> = ({ logs, goalLocation, startingLocation, completedLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function initLeaflet() {
      try {
        if (typeof window === 'undefined') return;

        // Ensure Leaflet CSS
        if (!document.getElementById('leaflet-cdn-css')) {
          const cssLink = document.createElement('link');
          cssLink.id = 'leaflet-cdn-css';
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(cssLink);
        }

        // Ensure Leaflet JS
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let L = (window as any).L;
        if (!L) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.id = 'leaflet-cdn-js';
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Leaflet script failed to load'));
            document.body.appendChild(script);
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          L = (window as any).L;
        }

        if (isCancelled || !L || !mapContainerRef.current) return;

        // Tear down previous map instance if re-rendering
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        // Determine center point
        const pointsWithCoords: Array<{ lat: number; lng: number; label: string; kind: string }> = [];

        if (hasCoords(startingLocation)) {
          pointsWithCoords.push({
            lat: startingLocation.latitude,
            lng: startingLocation.longitude,
            label: 'Starting Location',
            kind: 'start',
          });
        }

        logs.forEach((log, idx) => {
          if (log.latitude != null && log.longitude != null) {
            pointsWithCoords.push({
              lat: log.latitude,
              lng: log.longitude,
              label: `Log #${idx + 1} (${new Date(log.loggedAt).toLocaleTimeString()})`,
              kind: 'trail',
            });
          }
        });

        if (hasCoords(completedLocation)) {
          pointsWithCoords.push({
            lat: completedLocation.latitude,
            lng: completedLocation.longitude,
            label: 'Completion Location',
            kind: 'finish',
          });
        }

        if (hasCoords(goalLocation)) {
          pointsWithCoords.push({
            lat: goalLocation.latitude,
            lng: goalLocation.longitude,
            label: `Goal: ${goalLocation.address || 'Target Location'}`,
            kind: 'goal',
          });
        }

        const centerLat = pointsWithCoords.length > 0 ? pointsWithCoords[0].lat : 28.6139;
        const centerLng = pointsWithCoords.length > 0 ? pointsWithCoords[0].lng : 77.209;

        const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], 14);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Draw 200m geofence area around goal location
        if (hasCoords(goalLocation)) {
          L.circle([goalLocation.latitude, goalLocation.longitude], {
            radius: GOAL_THRESHOLD_METERS,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.14,
            weight: 2,
            dashArray: '6, 6',
          }).addTo(map);
        }

        // Plot polyline for the breadcrumb trail (start -> periodic logs -> finish)
        const trailPoints: [number, number][] = [];
        if (hasCoords(startingLocation)) {
          trailPoints.push([startingLocation.latitude, startingLocation.longitude]);
        }
        logs.forEach((log) => {
          if (log.latitude != null && log.longitude != null) {
            trailPoints.push([log.latitude, log.longitude]);
          }
        });
        if (hasCoords(completedLocation)) {
          trailPoints.push([completedLocation.latitude, completedLocation.longitude]);
        }

        if (trailPoints.length > 1) {
          L.polyline(trailPoints, {
            color: '#2563eb',
            weight: 4,
            opacity: 0.85,
            dashArray: '8, 8',
          }).addTo(map);
        }

        // Add markers
        pointsWithCoords.forEach((pt) => {
          const marker = L.marker([pt.lat, pt.lng]).addTo(map);
          if (pt.kind === 'goal') {
            marker.bindPopup(
              `<b>🎯 Target Goal Destination</b><br/>${pt.label}<br/>Lat: ${pt.lat.toFixed(5)}, Lng: ${pt.lng.toFixed(5)}<br/><span style="color:#059669;font-weight:600;">${GOAL_THRESHOLD_METERS}m Goal Perimeter</span>`
            );
          } else {
            marker.bindPopup(`<b>${pt.label}</b><br/>Lat: ${pt.lat.toFixed(5)}, Lng: ${pt.lng.toFixed(5)}`);
          }
        });

        // Fit bounds
        if (pointsWithCoords.length > 1) {
          const bounds = L.latLngBounds(pointsWithCoords.map((p) => [p.lat, p.lng]));
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (err) {
        console.warn('Could not initialize Leaflet map, using fallback', err);
        setLoadError(true);
      }
    }

    void initLeaflet();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [logs, goalLocation, startingLocation, completedLocation]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#e9edf4] bg-slate-50 shadow-sm">
      <div
        ref={mapContainerRef}
        className="w-full h-[400px]"
        style={{ minHeight: '360px' }}
      />
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 p-6 text-center">
          <Compass className="h-10 w-10 text-blue-600 mb-2" />
          <h5 className="text-sm font-bold text-zinc-900 mb-1">Interactive Trail Visualizer</h5>
          <p className="text-xs text-zinc-600 max-w-md mb-3">
            Recorded {logs.length} periodic location point(s) during this activity visit.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {logs.map((log, idx) => (
              <a
                key={idx}
                href={`https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              >
                Point #{idx + 1} ({new Date(log.loggedAt).toLocaleTimeString()})
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ActivityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, activeRole } = useAuth();

  const [activity, setActivity] = useState<LeadEvent | null>(null);
  const [associatedLead, setAssociatedLead] = useState<LeadItem | null>(null);
  const [locationLogs, setLocationLogs] = useState<ActivityLocationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Action busy states
  const [accepting, setAccepting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);

  // Goal Location Modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalAddress, setGoalAddress] = useState('');
  const [goalLat, setGoalLat] = useState('');
  const [goalLng, setGoalLng] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [detectingGoalLoc, setDetectingGoalLoc] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const actRes = await crmApi.getActivity(id);
      const act = actRes.data;
      setActivity(act);

      if (act?.leadId) {
        try {
          const leadRes = await crmApi.getLead(act.leadId);
          setAssociatedLead(leadRes.data || null);
        } catch {
          // Lead might be non-critical
        }
      }

      try {
        const logsRes = await crmApi.getActivityLocationLogs(id);
        const sortedLogs = (logsRes.data || []).slice().sort((a, b) => {
          return new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime();
        });
        setLocationLogs(sortedLogs);
      } catch {
        setLocationLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  // Authorization Check (RBAC)
  const currentUserId = String(user?.userId || '').trim();
  const currentUsername = String(user?.username || '').trim();

  const isAssignedRep = Boolean(
    activity &&
      ((activity.assignedTo && (activity.assignedTo === currentUserId || activity.assignedTo === currentUsername)) ||
        (activity.assignedToName &&
          (activity.assignedToName === currentUsername || activity.assignedToName === currentUserId)))
  );

  const isCreator = Boolean(
    activity &&
      activity.createdBy &&
      (activity.createdBy === currentUserId || activity.createdBy === currentUsername)
  );

  const isSalesManager = activeRole === 'sales-manager' || activeRole === 'crm-manager';

  const isAuthorized = isAdmin || isSalesManager || isAssignedRep || isCreator;

  // Actions
  const handleAcceptActivity = async () => {
    if (!activity || !activity.leadId || !id) return;
    setAccepting(true);
    try {
      const acceptedLocation = await captureActivityLocation();
      await crmApi.acceptLeadEvent(activity.leadId, id, {
        acceptedLocation,
        location: acceptedLocation,
      });
      if (activeRole === 'sales-representative') {
        try {
          localStorage.setItem(ACTIVE_ACTIVITY_STORAGE_KEY, id);
        } catch {}
      }
      await loadData();
      showToast(
        activeRole === 'sales-representative'
          ? 'Activity accepted! Periodic location tracking is now active.'
          : 'Activity accepted successfully.'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to accept activity', 'error');
    } finally {
      setAccepting(false);
    }
  };

  const handleCompleteActivity = async () => {
    if (!activity || !activity.leadId || !id) return;
    setCompleting(true);
    try {
      const completedLocation = await captureActivityLocation();
      await crmApi.completeLeadEvent(activity.leadId, id, { completedLocation });
      try {
        if (localStorage.getItem(ACTIVE_ACTIVITY_STORAGE_KEY) === id) {
          localStorage.removeItem(ACTIVE_ACTIVITY_STORAGE_KEY);
        }
      } catch {}
      await loadData();
      showToast(
        completedLocation.unavailableReason
          ? 'Activity completed (location unavailable)'
          : 'Activity completed! Finish coordinates recorded.'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to complete activity', 'error');
    } finally {
      setCompleting(false);
    }
  };

  // Immediate GPS Capture & Verification against Goal
  const handleCheckCurrentLocationNow = async () => {
    if (!id) return;
    setCheckingLocation(true);
    try {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      let capturedData: { latitude: number; longitude: number; accuracy: number | null; address: string } | null = null;

      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const latitude = Number(pos.coords.latitude.toFixed(6));
              const longitude = Number(pos.coords.longitude.toFixed(6));
              const accuracy = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null;
              let address = '';
              try {
                const geo = await reverseGeocode(latitude, longitude);
                address = (geo.addressLine || geo.displayName || '').slice(0, 400);
              } catch {}

              capturedData = { latitude, longitude, accuracy, address };

              await crmApi.logActivityLocation(id, { latitude, longitude, accuracy, address });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          (err) => reject(new Error(err?.message || 'Location permission denied')),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });

      // Synchronize with target goal if set
      if (activity && hasCoords(activity.goalLocation) && capturedData) {
        const { latitude, longitude, accuracy, address } = capturedData;
        const dist = calculateDistanceMeters(latitude, longitude, activity.goalLocation.latitude, activity.goalLocation.longitude);
        const isReached = dist != null && dist <= GOAL_THRESHOLD_METERS;

        if (activity.leadId) {
          try {
            await crmApi.updateLeadEvent(activity.leadId, id, {
              latestUserLocation: { latitude, longitude, accuracy, address, capturedAt: new Date().toISOString() },
              latestDistanceFromGoal: dist,
              reachedGoalArea: Boolean(activity.reachedGoalArea || isReached),
              reachedGoalAt: (activity.reachedGoalArea || isReached) ? (activity.reachedGoalAt || new Date().toISOString()) : null,
            });
          } catch {
            // background sync failure non-blocking
          }
        }

        await loadData();

        if (isReached) {
          showToast(`📍 Reached Goal Area! You are ${dist} m from the target destination.`, 'success');
        } else {
          showToast(`📍 Current location logged: ${formatDistance(dist)} from target goal.`, 'success');
        }
      } else {
        await loadData();
        showToast('📍 Current location logged successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not verify current location', 'error');
    } finally {
      setCheckingLocation(false);
    }
  };

  const openGoalModal = () => {
    if (activity?.goalLocation) {
      setGoalAddress(activity.goalLocation.address || '');
      setGoalLat(activity.goalLocation.latitude != null ? String(activity.goalLocation.latitude) : '');
      setGoalLng(activity.goalLocation.longitude != null ? String(activity.goalLocation.longitude) : '');
    } else {
      setGoalAddress('');
      setGoalLat('');
      setGoalLng('');
    }
    setIsGoalModalOpen(true);
  };

  const handleDetectGoalFromCurrentGps = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setDetectingGoalLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setGoalLat(String(lat));
          setGoalLng(String(lng));
          try {
            const geo = await reverseGeocode(lat, lng);
            const addr = (geo.addressLine || geo.displayName || '').slice(0, 400);
            if (addr) setGoalAddress(addr);
          } catch {}
          showToast('Coordinates captured from your GPS device!');
        } finally {
          setDetectingGoalLoc(false);
        }
      },
      (err) => {
        setDetectingGoalLoc(false);
        showToast(err?.message || 'Could not access GPS location', 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSaveGoalLocation = async () => {
    if (!activity || !activity.leadId || !id) return;
    const lat = parseFloat(goalLat);
    const lng = parseFloat(goalLng);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      showToast('Please enter a valid latitude (-90 to 90)', 'error');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      showToast('Please enter a valid longitude (-180 to 180)', 'error');
      return;
    }

    setSavingGoal(true);
    try {
      const goalLocation: ActivityLocation = {
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        address: goalAddress.trim(),
        capturedAt: new Date().toISOString(),
      };

      await crmApi.updateLeadEvent(activity.leadId, id, { goalLocation });
      await loadData();
      setIsGoalModalOpen(false);
      showToast('Goal location updated successfully!');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save goal location', 'error');
    } finally {
      setSavingGoal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading activity details…</p>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-[#e9edf4] rounded-2xl shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Activity Not Found</h3>
        <p className="text-sm text-slate-500 mb-6">{error || 'This activity could not be found or has been removed.'}</p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>
    );
  }

  // 403 Forbidden Access Restricted screen
  if (!isAuthorized) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <Lock className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Access Restricted (403)</h3>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          You do not have permission to view this activity. Only the assigned sales representative, creator, sales
          managers, or administrators can access activity records and location logs.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <Link
            to="/leads"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm no-underline"
          >
            Go to Leads
          </Link>
        </div>
      </div>
    );
  }

  const displayStatus = activityDisplayStatus(activity);
  const isMissed = Boolean(isMissedActivity(activity) || (activity as any)?.isMissed || (activity as any)?.locationReport?.isMissed || displayStatus === 'Missed');
  const startingLocation: ActivityLocation | null = hasCoords(activity.acceptedLocation)
    ? activity.acceptedLocation
    : (hasCoords(activity.createdLocation)
        ? activity.createdLocation
        : (hasCoords(activity.startingLocation)
            ? activity.startingLocation
            : (locationLogs.length > 0 && hasCoords(locationLogs[0] as any)
                ? {
                    latitude: locationLogs[0].latitude!,
                    longitude: locationLogs[0].longitude!,
                    accuracy: locationLogs[0].accuracy,
                    address: locationLogs[0].address || '',
                    capturedAt: locationLogs[0].loggedAt,
                  }
                : (activity.acceptedLocation || activity.createdLocation || activity.startingLocation || null))));
  const isPendingAcceptance = activity.status === 'Assigned' || (activity.status === 'Open' && activity.assignedTo);
  const canAccept = isPendingAcceptance && (isAssignedRep || isAdmin || isSalesManager);
  const canComplete = activity.status !== 'Completed' && (isAssignedRep || isAdmin || isSalesManager);
  const isCurrentlyTracking =
    activeRole === 'sales-representative' &&
    typeof window !== 'undefined' &&
    localStorage.getItem(ACTIVE_ACTIVITY_STORAGE_KEY) === activity._id;

  // Compute Latest User Location
  const latestLog = locationLogs.length > 0 ? locationLogs[locationLogs.length - 1] : null;

  let latestUserLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    address?: string;
    timestamp: string | null;
  } | null = null;

  if (latestLog && latestLog.latitude != null && latestLog.longitude != null) {
    latestUserLocation = {
      latitude: latestLog.latitude,
      longitude: latestLog.longitude,
      accuracy: latestLog.accuracy,
      address: latestLog.address,
      timestamp: latestLog.loggedAt,
    };
  } else if (hasCoords(activity.completedLocation)) {
    latestUserLocation = {
      latitude: activity.completedLocation.latitude,
      longitude: activity.completedLocation.longitude,
      accuracy: activity.completedLocation.accuracy,
      address: activity.completedLocation.address,
      timestamp: activity.completedAt || activity.completedLocation.capturedAt || null,
    };
  } else if (hasCoords(activity.acceptedLocation)) {
    latestUserLocation = {
      latitude: activity.acceptedLocation.latitude,
      longitude: activity.acceptedLocation.longitude,
      accuracy: activity.acceptedLocation.accuracy,
      address: activity.acceptedLocation.address,
      timestamp: activity.acceptedAt || activity.acceptedLocation.capturedAt || null,
    };
  } else if (hasCoords(activity.createdLocation)) {
    latestUserLocation = {
      latitude: activity.createdLocation.latitude,
      longitude: activity.createdLocation.longitude,
      accuracy: activity.createdLocation.accuracy,
      address: activity.createdLocation.address,
      timestamp: activity.createdAt || activity.createdLocation.capturedAt || null,
    };
  }

  // Distance from Goal
  const calculatedDistance =
    hasCoords(activity.goalLocation) && latestUserLocation
      ? calculateDistanceMeters(
          latestUserLocation.latitude,
          latestUserLocation.longitude,
          activity.goalLocation.latitude,
          activity.goalLocation.longitude
        )
      : null;

  const distanceFromGoal = calculatedDistance != null ? calculatedDistance : (activity.latestDistanceFromGoal != null ? activity.latestDistanceFromGoal : null);

  // Check Reached Goal Area & Reached At timestamp
  let reachedAtTimestamp: string | null = activity.reachedGoalAt || null;

  if (!reachedAtTimestamp && hasCoords(activity.goalLocation)) {
    const goalLat = activity.goalLocation.latitude;
    const goalLng = activity.goalLocation.longitude;

    if (hasCoords(startingLocation)) {
      const d = calculateDistanceMeters(startingLocation.latitude, startingLocation.longitude, goalLat, goalLng);
      if (d != null && d <= GOAL_THRESHOLD_METERS) {
        reachedAtTimestamp = activity.acceptedAt || startingLocation.capturedAt || activity.createdAt || null;
      }
    }

    if (!reachedAtTimestamp) {
      for (const log of locationLogs) {
        if (log.latitude != null && log.longitude != null) {
          const d = calculateDistanceMeters(log.latitude, log.longitude, goalLat, goalLng);
          if (d != null && d <= GOAL_THRESHOLD_METERS) {
            reachedAtTimestamp = log.loggedAt;
            break;
          }
        }
      }
    }

    if (!reachedAtTimestamp && hasCoords(activity.completedLocation)) {
      const d = calculateDistanceMeters(activity.completedLocation.latitude, activity.completedLocation.longitude, goalLat, goalLng);
      if (d != null && d <= GOAL_THRESHOLD_METERS) {
        reachedAtTimestamp = activity.completedAt || activity.completedLocation.capturedAt || null;
      }
    }
  }

  const reachedGoalArea = Boolean(
    activity.reachedGoalArea ||
    reachedAtTimestamp ||
    (distanceFromGoal !== null && distanceFromGoal <= GOAL_THRESHOLD_METERS)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold transition-all ${
            toastMsg.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toastMsg.type === 'error' ? <ShieldAlert className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#e9edf4] shadow-sm">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate(-1)}
            className="mt-1 p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {activity.eventType || activity.type || 'Activity'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${activityStatusClass(
                  isMissed ? 'Missed' : displayStatus
                )}`}
              >
                {isMissed ? 'Missed' : displayStatus}
              </span>
              {isMissed && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Time Over · Missed Deadline
                </span>
              )}
              {activity.kind === 'scheduled' && (
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Scheduled
                </span>
              )}
              {isCurrentlyTracking && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Active 30m Tracking Loop
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight m-0">
              {activity.title}
            </h1>

            {activity.leadId && (
              <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
                <span>Associated Lead:</span>
                <Link
                  to={`/leads/${activity.leadId}?tab=activities`}
                  className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {associatedLead?.title || associatedLead?.name || associatedLead?.company || 'View Lead Profile'}
                </Link>
                {associatedLead?.company && <span className="text-slate-400">({associatedLead.company})</span>}
              </div>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canAccept && (
            <button
              onClick={handleAcceptActivity}
              disabled={accepting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Accept activity without capturing initial GPS"
            >
              <CheckCircle2 className="h-4 w-4" />
              {accepting ? 'Accepting…' : 'Accept Activity'}
            </button>
          )}

          {canComplete && (
            <button
              onClick={handleCompleteActivity}
              disabled={completing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Mark activity completed and capture current finish GPS coordinates"
            >
              <Flag className="h-4 w-4" />
              {completing ? 'Completing…' : 'Complete Activity'}
            </button>
          )}

          <button
            onClick={handleCheckCurrentLocationNow}
            disabled={checkingLocation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            title="Immediately capture GPS and check against target destination"
          >
            <Navigation className={`h-4 w-4 text-blue-600 ${checkingLocation ? 'animate-spin' : ''}`} />
            {checkingLocation ? 'Checking Location…' : '📍 Check Current Location Now'}
          </button>
        </div>
      </div>

      {/* ACTIVITY GOAL LOCATION REPORT - Hero Telemetry Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight m-0">
                ACTIVITY GOAL LOCATION REPORT
              </h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Real-time distance tracking, goal verification, and GPS proximity analysis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCheckCurrentLocationNow}
              disabled={checkingLocation}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Check current GPS location and verify against target goal"
            >
              <Navigation className={`h-4 w-4 ${checkingLocation ? 'animate-spin' : ''}`} />
              {checkingLocation ? 'Checking Location…' : '📍 Check Current Location Now'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Goal Location */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-blue-600" />
                  Goal Location
                </span>
                {hasCoords(activity.goalLocation) ? (
                  <button
                    onClick={openGoalModal}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                ) : null}
              </div>

              {hasCoords(activity.goalLocation) ? (
                <div>
                  <div
                    className="text-sm font-bold text-slate-900 mb-1 line-clamp-2"
                    title={activity.goalLocation.address || 'Target Location'}
                  >
                    {activity.goalLocation.address || 'Target Location'}
                  </div>
                  <div className="font-mono text-xs text-slate-600 flex items-center gap-1.5">
                    <span>
                      Lat: {activity.goalLocation.latitude.toFixed(5)}, Lng:{' '}
                      {activity.goalLocation.longitude.toFixed(5)}
                    </span>
                    {mapsLinkFor(activity.goalLocation) && (
                      <a
                        href={mapsLinkFor(activity.goalLocation)!}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                        title="Open in Google Maps"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  <p className="text-xs text-slate-500 italic mb-3">No Goal Location Set</p>
                  <button
                    onClick={openGoalModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Goal Location
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] text-slate-400">
              Geofence threshold: {GOAL_THRESHOLD_METERS} m
            </div>
          </div>

          {/* 2. Latest User Location */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  Latest User Location
                </span>
                {latestUserLocation && mapsLinkFor(latestUserLocation) && (
                  <a
                    href={mapsLinkFor(latestUserLocation)!}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 underline inline-flex items-center gap-0.5"
                  >
                    Open Map
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {latestUserLocation ? (
                <div>
                  <div
                    className="text-sm font-bold text-slate-900 mb-1 line-clamp-2"
                    title={latestUserLocation.address || 'GPS Fix captured'}
                  >
                    {latestUserLocation.address || 'Address not captured'}
                  </div>
                  <div className="font-mono text-xs text-slate-600">
                    Lat: {latestUserLocation.latitude.toFixed(5)}, Lng: {latestUserLocation.longitude.toFixed(5)}
                    {latestUserLocation.accuracy != null ? ` (±${latestUserLocation.accuracy}m)` : ''}
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  <p className="text-xs text-slate-500 italic mb-1">Awaiting location log</p>
                  <p className="text-[11px] text-slate-400">
                    Click &ldquo;Check Current Location Now&rdquo; to capture GPS.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-400 shrink-0" />
              {latestUserLocation?.timestamp
                ? `Logged at ${formatTimeOnly(latestUserLocation.timestamp)}`
                : 'Awaiting location log'}
            </div>
          </div>

          {/* 3. Distance from Goal */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-indigo-600" />
                Distance from Goal
              </span>

              <div className="my-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {distanceFromGoal != null ? formatDistance(distanceFromGoal) : 'N/A'}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-1.5">
              {distanceFromGoal != null ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Straight-line distance
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  {!hasCoords(activity.goalLocation) ? 'Requires goal coordinates' : 'Requires user coordinates'}
                </span>
              )}
            </div>
          </div>

          {/* 4. Reached Goal Area & Reached At */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Goal Verification Status
              </span>

              <div className="space-y-2 my-1">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Reached Goal Area:</span>
                  {!hasCoords(activity.goalLocation) ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      No Goal Set
                    </span>
                  ) : reachedGoalArea ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#dcfce7] text-[#15803d] border border-emerald-300 shadow-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Yes · Reached Goal Area
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fef3c7] text-[#b45309] border border-amber-300 shadow-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      No · Not Reached Goal Area
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Schedule & Deadline:</span>
                  {isMissed ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#fee2e2] text-[#b91c1c] border border-red-300 shadow-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Time Over · Missed Deadline
                    </span>
                  ) : (activity.status === 'Completed' || displayStatus === 'Completed') ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#dcfce7] text-[#15803d] border border-emerald-300 shadow-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
                      <Clock className="h-3.5 w-3.5" />
                      On Schedule
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <div>
                <span className="font-semibold text-slate-700">Scheduled: </span>
                <span>{formatDateTime(activity.eventDate || activity.date)}</span>
                {isMissed && (
                  <span className="ml-1 text-rose-600 font-bold"> (Overdue)</span>
                )}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Reached At: </span>
                {reachedAtTimestamp ? (
                  <span className="font-semibold text-emerald-700">{formatDateTime(reachedAtTimestamp)}</span>
                ) : (
                  <span className="text-slate-400 italic">Not reached yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid Card */}
      <div className="bg-white p-6 rounded-2xl border border-[#e9edf4] shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-4 border-b border-slate-100 pb-3">
          Activity Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Activity Type
            </span>
            <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-blue-600" />
              {activity.eventType || activity.type || 'Call'}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Assigned Representative
            </span>
            <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-500" />
              {activity.assignedToName || activity.assignedToLabel || cleanUserLabel(activity.assignedTo, 'Unassigned')}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Scheduled / Occurred At
            </span>
            <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-500" />
              {formatDateTime(activity.eventDate || activity.date)}
            </span>
            {isMissed && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-1">
                <AlertTriangle className="h-3 w-3" />
                Time Over (Deadline Missed)
              </span>
            )}
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Created By & Date
            </span>
            <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-500" />
              {activity.createdByName || cleanUserLabel(activity.createdBy, 'System')} ({formatDateTime(activity.createdAt)})
            </span>
          </div>
        </div>

        {/* Acceptance & Completion Details */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
              Acceptance Details
            </span>
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-semibold text-slate-700">Accepted At:</span>{' '}
                {activity.acceptedAt ? formatDateTime(activity.acceptedAt) : activity.status === 'Accepted' || activity.status === 'Completed' ? 'Accepted' : 'Not yet accepted'}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Accepted By:</span>{' '}
                {activity.acceptedByName || activity.assignedToName || cleanUserLabel(activity.acceptedBy, (activity.status === 'Accepted' || activity.status === 'Completed') ? 'Assigned Representative' : '—')}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Flag className="h-4 w-4 text-emerald-600" />
              Completion Details
            </span>
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-semibold text-slate-700">Completed At:</span>{' '}
                {activity.completedAt ? formatDateTime(activity.completedAt) : activity.status === 'Completed' ? 'Completed' : 'Pending completion'}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Completed By:</span>{' '}
                {activity.completedByName || activity.assignedToName || cleanUserLabel(activity.completedBy, activity.status === 'Completed' ? 'Assigned Representative' : '—')}
              </div>
            </div>
          </div>
        </div>

        {/* Description / Notes */}
        {activity.description && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Description & Notes
            </span>
            <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed whitespace-pre-wrap">
              {activity.description}
            </p>
          </div>
        )}
      </div>

      {/* Maps & Key Location Pins Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
          Location Points & Destination
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Goal Location Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#e9edf4] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  🎯 Target Goal Destination
                </span>
                {mapsLinkFor(activity.goalLocation) && (
                  <a
                    href={mapsLinkFor(activity.goalLocation) as string}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline"
                  >
                    Open Map
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-900 mb-1">
                {describeLocation(activity.goalLocation)}
              </p>
              {hasCoords(activity.goalLocation) && (
                <p className="text-[11px] font-mono text-slate-500 mb-3">
                  Lat: {activity.goalLocation.latitude.toFixed(5)}, Lng: {activity.goalLocation.longitude.toFixed(5)}
                </p>
              )}
            </div>

            {hasCoords(activity.goalLocation) ? (
              <iframe
                title="Goal Location Map"
                src={embedMapUrl(activity.goalLocation.latitude, activity.goalLocation.longitude)}
                className="w-full h-44 rounded-xl border border-slate-200 mt-2"
                loading="lazy"
              />
            ) : (
              <div className="h-44 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-4 text-center mt-2">
                <Target className="h-6 w-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500 mb-2">No destination goal pinned for this activity</span>
                <button
                  onClick={openGoalModal}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Set Goal Location
                </button>
              </div>
            )}
          </div>

          {/* Starting / Accepted Location Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#e9edf4] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                  📍 Starting Point
                </span>
                {mapsLinkFor(startingLocation) && (
                  <a
                    href={mapsLinkFor(startingLocation) as string}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-800 underline"
                  >
                    Open Map
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-900 mb-1">
                {describeLocation(startingLocation)}
              </p>
              {hasCoords(startingLocation) && (
                <p className="text-[11px] font-mono text-slate-500 mb-3">
                  Lat: {startingLocation.latitude.toFixed(5)}, Lng: {startingLocation.longitude.toFixed(5)}
                </p>
              )}
            </div>

            {hasCoords(startingLocation) ? (
              <iframe
                title="Starting Location Map"
                src={embedMapUrl(startingLocation.latitude, startingLocation.longitude)}
                className="w-full h-44 rounded-xl border border-slate-200 mt-2"
                loading="lazy"
              />
            ) : (
              <div className="h-44 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-4 text-center mt-2">
                <MapPin className="h-6 w-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">
                  {activity.acceptedLocation?.unavailableReason ||
                    activity.createdLocation?.unavailableReason ||
                    activity.startingLocation?.unavailableReason ||
                    'Accepted without initial location'}
                </span>
              </div>
            )}
          </div>

          {/* Completion Location Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#e9edf4] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  🏁 Completion Location
                </span>
                {mapsLinkFor(activity.completedLocation) && (
                  <a
                    href={mapsLinkFor(activity.completedLocation) as string}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 underline"
                  >
                    Open Map
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-900 mb-1">
                {describeLocation(activity.completedLocation)}
              </p>
              {hasCoords(activity.completedLocation) && (
                <p className="text-[11px] font-mono text-slate-500 mb-3">
                  Lat: {activity.completedLocation.latitude.toFixed(5)}, Lng: {activity.completedLocation.longitude.toFixed(5)}
                </p>
              )}
            </div>

            {hasCoords(activity.completedLocation) ? (
              <iframe
                title="Completion Location Map"
                src={embedMapUrl(activity.completedLocation.latitude, activity.completedLocation.longitude)}
                className="w-full h-44 rounded-xl border border-slate-200 mt-2"
                loading="lazy"
              />
            ) : (
              <div className="h-44 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-4 text-center mt-2">
                <Flag className="h-6 w-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">
                  {activity.status === 'Completed' ? 'Location was not recorded' : 'Awaits activity completion'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 30-Minute Breadcrumb Trail Map Section */}
      <div className="bg-white p-6 rounded-2xl border border-[#e9edf4] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 m-0">
              30-Minute Location Trail Map
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-0">
              Interactive breadcrumb route tracking the sales representative's position recorded every 30 minutes since acceptance.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
            {locationLogs.length} breadcrumb point(s) recorded
          </span>
        </div>

        <LocationTrailMap
          logs={locationLogs}
          goalLocation={activity.goalLocation}
          startingLocation={startingLocation}
          completedLocation={activity.completedLocation}
        />
      </div>

      {/* Periodic Location Logs Table */}
      <div className="bg-white rounded-2xl border border-[#e9edf4] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 m-0">
              Periodic Location Logs
            </h4>
            <p className="text-[11px] text-slate-500 m-0 mt-0.5">
              Full chronological log of geolocation fixes transmitted while this activity is in progress.
            </p>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {locationLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No periodic location logs have been captured yet for this activity. Logs are transmitted automatically
            every 30 minutes once accepted, or when you click "📍 Check Current Location Now".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/50 text-slate-500">
                <tr>
                  <th className="py-2.5 px-4 font-semibold w-12 text-center">#</th>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Coordinates</th>
                  <th className="py-2.5 px-4 font-semibold">Accuracy</th>
                  <th className="py-2.5 px-4 font-semibold">Address / Fix Location</th>
                  <th className="py-2.5 px-4 font-semibold">Distance from Goal</th>
                  <th className="py-2.5 px-4 font-semibold">Goal Status</th>
                  <th className="py-2.5 px-4 font-semibold">Sales Rep</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Map Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locationLogs.map((log, index) => {
                  const mapLink = `https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`;
                  const logDist =
                    log.distanceFromGoal != null
                      ? log.distanceFromGoal
                      : hasCoords(activity.goalLocation) && log.latitude != null && log.longitude != null
                      ? calculateDistanceMeters(
                          log.latitude,
                          log.longitude,
                          activity.goalLocation.latitude,
                          activity.goalLocation.longitude
                        )
                      : null;
                  const isReached =
                    log.reachedGoalArea != null
                      ? log.reachedGoalArea
                      : logDist != null && logDist <= GOAL_THRESHOLD_METERS;

                  return (
                    <tr key={log._id || index} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-blue-600">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {formatDateTime(log.loggedAt)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800 whitespace-nowrap">
                        {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {log.accuracy != null ? `±${log.accuracy} m` : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={log.address || '—'}>
                        {log.address || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {logDist != null ? (
                          <span className="font-semibold text-slate-800 font-mono text-xs">
                            {formatDistance(logDist)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {hasCoords(activity.goalLocation) && logDist != null ? (
                          isReached ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#dcfce7] text-[#15803d] border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Reached
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fef3c7] text-[#b45309] border border-amber-200">
                              Not Reached
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {cleanUserLabel(log.salesRepName || activity.assignedToName, 'Assigned Rep')}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold underline text-[11px]"
                        >
                          View Map
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Set / Edit Goal Location Modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Target className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 m-0">Set Target Goal Location</h3>
              </div>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address / Target Destination Label
                </label>
                <input
                  type="text"
                  value={goalAddress}
                  onChange={(e) => setGoalAddress(e.target.value)}
                  placeholder="e.g. DLF Cyber City, Tower B, Gurugram"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={goalLat}
                    onChange={(e) => setGoalLat(e.target.value)}
                    placeholder="e.g. 28.49502"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={goalLng}
                    onChange={(e) => setGoalLng(e.target.value)}
                    placeholder="e.g. 77.08954"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleDetectGoalFromCurrentGps}
                disabled={detectingGoalLoc}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Navigation className={`h-3.5 w-3.5 text-blue-600 ${detectingGoalLoc ? 'animate-spin' : ''}`} />
                {detectingGoalLoc ? 'Detecting GPS…' : '📍 Use My Current Location as Goal'}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGoalLocation}
                disabled={savingGoal}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {savingGoal ? 'Saving…' : 'Save Goal Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityDetailPage;