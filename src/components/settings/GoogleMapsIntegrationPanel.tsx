import React, { useCallback, useEffect, useState } from 'react';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';

import { ApiError, crmApi } from '../../services/api';
import type { GoogleMapsIntegrationStatus } from '../../types/admin';

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';

export const GoogleMapsIntegrationPanel: React.FC = () => {
  const [status, setStatus] = useState<GoogleMapsIntegrationStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await crmApi.getGoogleMapsIntegration();
      setStatus(res.data);
      setApiKey('');
      setShowKey(false);
    } catch (err: unknown) {
      const text =
        err instanceof ApiError ? err.message : 'Failed to load Google Maps integration';
      setMessage({ kind: 'error', text });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) {
        if (!status?.configured || status.source === 'env') {
          setMessage({
            kind: 'error',
            text: 'Enter a Google Maps API key (starts with AIza).',
          });
          setSaving(false);
          return;
        }
        setMessage({
          kind: 'ok',
          text: 'No new key entered — current workspace key is unchanged.',
        });
        setSaving(false);
        return;
      }
      if (trimmedKey.includes('*')) {
        setMessage({
          kind: 'error',
          text: 'Paste the full Google Maps API key — do not use a masked placeholder.',
        });
        setSaving(false);
        return;
      }
      if (!/^AIza[0-9A-Za-z_-]+$/.test(trimmedKey)) {
        setMessage({
          kind: 'error',
          text: 'Google Maps API key should start with AIza.',
        });
        setSaving(false);
        return;
      }

      const res = await crmApi.updateGoogleMapsIntegration({ apiKey: trimmedKey });
      setStatus(res.data);
      setApiKey('');
      setShowKey(false);
      if (!res.data?.configured) {
        setMessage({
          kind: 'error',
          text:
            res.data?.message ||
            'Key did not verify as configured. Paste the full AIza key and Save again.',
        });
      } else {
        setMessage({
          kind: 'ok',
          text: 'Google Maps API key saved encrypted. Address search on lead create will use it.',
        });
      }
    } catch (err: unknown) {
      const text = err instanceof ApiError ? err.message : 'Failed to save Google Maps key';
      setMessage({ kind: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async () => {
    if (!window.confirm('Remove the stored Google Maps API key from this workspace?')) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await crmApi.updateGoogleMapsIntegration({ clearKey: true });
      setStatus(res.data);
      setApiKey('');
      setMessage({ kind: 'ok', text: 'Stored Google Maps API key removed.' });
    } catch (err: unknown) {
      const text = err instanceof ApiError ? err.message : 'Failed to remove Google Maps key';
      setMessage({ kind: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel =
    status?.source === 'settings'
      ? 'Workspace (encrypted)'
      : status?.source === 'env'
        ? 'Server environment'
        : 'Not configured';

  return (
    <section className="rounded-xl border border-zinc-300 bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
            <LockOutlinedIcon sx={{ fontSize: 13 }} />
            Encrypted at rest
          </div>
          <h2 className="m-0 flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-950">
            <MapOutlinedIcon sx={{ fontSize: 22 }} />
            Google Maps (Address search)
          </h2>
          <p className="mb-0 mt-1.5 text-sm leading-relaxed text-zinc-500">
            Used for Google Places address autocomplete on lead creation. The key is encrypted with
            AES-256-GCM on the server. After save, Settings only shows a masked hint. Lead forms
            load the key securely for Places Autocomplete (Maps JavaScript API + Places API must be
            enabled; restrict the key by HTTP referrer).
          </p>
        </div>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
        >
          <RefreshIcon sx={{ fontSize: 15 }} />
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="m-0 text-sm text-zinc-500">Loading integration status…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Status
              </div>
              <div
                className={`mt-0.5 text-sm font-semibold ${
                  status?.configured ? 'text-emerald-700' : 'text-zinc-700'
                }`}
              >
                {status?.configured ? 'Configured' : 'Not set'}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Source
              </div>
              <div className="mt-0.5 text-sm font-semibold text-zinc-800">{sourceLabel}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Key hint
              </div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-800">
                {status?.hint || '—'}
              </div>
            </div>
          </div>

          {status?.message ? (
            <p className="m-0 text-xs text-zinc-500">{status.message}</p>
          ) : null}

          <label className="block">
            <span className={labelClass}>
              {status?.configured && status.source === 'settings'
                ? 'Replace Google Maps API key'
                : 'Google Maps API key *'}
            </span>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                className={`${inputClass} pr-10 font-mono`}
                placeholder={
                  status?.configured
                    ? 'Leave blank to keep the current key'
                    : 'AIza… paste from Google Cloud Console'
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={saving}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 cursor-pointer border-0 bg-transparent"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? (
                  <VisibilityOffOutlinedIcon sx={{ fontSize: 16 }} />
                ) : (
                  <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                )}
              </button>
            </div>
            <span className="mt-1 block text-[11px] text-zinc-400">
              Enable <strong>Maps JavaScript API</strong> and <strong>Places API</strong> for this
              key. Restrict by HTTP referrer to your CRM domain.
            </span>
          </label>

          {message ? (
            <div
              role="alert"
              className={`rounded-lg border px-3 py-2.5 text-xs font-semibold ${
                message.kind === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              <SaveOutlinedIcon sx={{ fontSize: 15 }} />
              {saving ? 'Saving…' : 'Save Google Maps settings'}
            </button>
            {status?.source === 'settings' ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void clearKey()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                Remove key
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
};
