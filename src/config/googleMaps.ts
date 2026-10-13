/**
 * Google Maps / Places config for address search on lead forms.
 *
 * Priority for the API key:
 * 1. Settings → Integrations → Google Maps (encrypted; loaded via /client-key)
 * 2. VITE_GOOGLE_MAPS_API_KEY in .env (build-time fallback)
 *
 * Restrict keys in Google Cloud Console (HTTP referrers + Maps JS + Places APIs only).
 */
const ENV_KEY = String(
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_GOOGLE_MAPS_API_KEY || ''
).trim();

/** Build-time / env fallback only — prefer Settings → Integrations. */
export function getGoogleMapsApiKey(): string {
  return ENV_KEY;
}

export const GOOGLE_MAPS_SCRIPT_ID = 'opennext-crm-google-maps-js';
