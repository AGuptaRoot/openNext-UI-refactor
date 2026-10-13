import React, { useCallback, useEffect, useState } from 'react';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

import { ApiError, crmApi } from '../../services/api';
import type { GroqIntegrationStatus } from '../../types/admin';

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';

const DEFAULT_MODEL = 'auto';

/** Vision models for visiting-card photo analysis (image sent directly to Groq). */
const GROQ_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'auto', label: 'Auto (Llama 4 Scout → Maverick → Qwen)' },
  { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (vision)' },
  { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick (vision)' },
  { value: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (vision)' },
];

export const GroqIntegrationPanel: React.FC = () => {
  const [status, setStatus] = useState<GroqIntegrationStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await crmApi.getGroqIntegration();
      const data = res.data;
      setStatus(data);
      setModel(data?.model || DEFAULT_MODEL);
      setApiKey('');
      setShowKey(false);
    } catch (err: unknown) {
      const text = err instanceof ApiError ? err.message : 'Failed to load Groq integration';
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
      const payload: { apiKey?: string; model?: string } = {
        model: model.trim() || DEFAULT_MODEL,
      };
      const trimmedKey = apiKey.trim();
      if (trimmedKey) {
        if (trimmedKey.includes('*')) {
          setMessage({
            kind: 'error',
            text: 'Paste the full Groq API key — do not use a masked placeholder.',
          });
          setSaving(false);
          return;
        }
        payload.apiKey = trimmedKey;
      } else if (!status?.configured || status.source === 'env') {
        // Allow saving model-only when env-backed, or when already configured in settings.
        if (!status?.configured) {
          setMessage({ kind: 'error', text: 'Enter a Groq API key (starts with gsk_).' });
          setSaving(false);
          return;
        }
      }

      const res = await crmApi.updateGroqIntegration(payload);
      setStatus(res.data);
      setApiKey('');
      setShowKey(false);
      setModel(res.data?.model || DEFAULT_MODEL);
      if (!res.data?.configured) {
        setMessage({
          kind: 'error',
          text:
            res.data?.message ||
            'Key did not verify as configured. Paste the full gsk_ key and Save again.',
        });
      } else {
        setMessage({
          kind: 'ok',
          text: trimmedKey
            ? 'Groq API key saved encrypted and verified. It will never be shown again in full.'
            : 'Groq settings updated.',
        });
      }
    } catch (err: unknown) {
      const text = err instanceof ApiError ? err.message : 'Failed to save Groq key';
      setMessage({ kind: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async () => {
    if (!window.confirm('Remove the stored Groq API key from this workspace?')) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await crmApi.updateGroqIntegration({ clearKey: true });
      setStatus(res.data);
      setApiKey('');
      setMessage({ kind: 'ok', text: 'Stored Groq API key removed.' });
    } catch (err: unknown) {
      const text = err instanceof ApiError ? err.message : 'Failed to remove Groq key';
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
          <h2 className="m-0 text-lg font-bold tracking-tight text-zinc-950">Groq AI (OCR extract)</h2>
          <p className="mb-0 mt-1.5 text-sm leading-relaxed text-zinc-500">
            Used to turn visiting-card OCR text into structured lead fields. The key is encrypted
            with AES-256-GCM on the server and is never returned to the browser after save.
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
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status</div>
              <div
                className={`mt-0.5 text-sm font-semibold ${
                  status?.configured ? 'text-emerald-700' : 'text-zinc-700'
                }`}
              >
                {status?.configured ? 'Configured' : 'Not set'}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Source</div>
              <div className="mt-0.5 text-sm font-semibold text-zinc-800">{sourceLabel}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Key hint</div>
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
                ? 'Replace Groq API key'
                : 'Groq API key *'}
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
                    : 'gsk_… paste from console.groq.com'
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
              Stored encrypted. After save, only a masked hint (e.g. gsk_••••ab12) is shown.
            </span>
          </label>

          <label className="block max-w-xl">
            <span className={labelClass}>OCR model</span>
            <select
              className={`${inputClass} font-mono`}
              value={
                GROQ_MODEL_OPTIONS.some((o) => o.value === model) ? model : DEFAULT_MODEL
              }
              onChange={(e) => setModel(e.target.value)}
              disabled={saving}
            >
              {GROQ_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-zinc-400">
              Visiting-card scan sends the photo directly to a vision model (Llama 4 Scout / Maverick
              or Qwen). Choose <strong>Auto</strong> to try them in order.
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
              {saving ? 'Saving…' : 'Save Groq settings'}
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
