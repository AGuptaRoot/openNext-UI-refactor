import React, { useCallback, useEffect, useState } from 'react';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';

import { useNotifyMessage } from '@/components/notifications';
import { ApiError, crmApi } from '../../services/api';
import type { FcmIntegrationStatus } from '../../types/admin';

const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';

/**
 * CRM 3.59.0 — Settings → Integrations → Push notifications (Firebase Cloud Messaging).
 * The admin pastes the Firebase service account JSON; the server keeps it encrypted and only shows a hint.
 * "Send test push" checks the key with Firebase and sends a test to the admin's own registered phones.
 */
export const FcmIntegrationPanel: React.FC = () => {
  const [status, setStatus] = useState<FcmIntegrationStatus | null>(null);
  const [json, setJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  useNotifyMessage(message?.text, message?.kind === 'ok' ? 'success' : 'error', () => setMessage(null));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await crmApi.getFcmIntegration();
      setStatus(res.data);
      setJson('');
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to load push settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const value = json.trim();
    if (!value) {
      setMessage({ kind: 'error', text: 'Paste the service account JSON first.' });
      return;
    }
    setSaving(true);
    try {
      const res = await crmApi.updateFcmIntegration({ serviceAccount: value });
      setStatus(res.data);
      setJson('');
      setMessage({ kind: 'ok', text: 'Firebase key saved encrypted. It will never be shown again in full.' });
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to save the Firebase key' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setSaving(true);
    setConfirmRemove(false);
    try {
      const res = await crmApi.updateFcmIntegration({ clearKey: true });
      setStatus(res.data);
      setMessage({ kind: 'ok', text: 'Firebase key removed. Push notifications are off.' });
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to remove the Firebase key' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setSaving(true);
    try {
      const res = await crmApi.sendTestPush();
      setMessage({ kind: 'ok', text: res.data?.message || 'Test sent.' });
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Test push failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-300 bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
            <LockOutlinedIcon sx={{ fontSize: 13 }} />
            Encrypted at rest
          </div>
          <h2 className="m-0 text-lg font-bold tracking-tight text-zinc-950">Push notifications (Firebase)</h2>
          <p className="mb-0 mt-1.5 text-sm leading-relaxed text-zinc-500">
            Sends CRM alerts (lead assigned, follow-ups, quotation accepted, payment received, portal approvals and the
            active extension&apos;s alerts) to the mobile app. Paste the service account JSON from Firebase → Project
            settings → Service accounts → Generate new private key. It is encrypted on the server and never shown again.
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
        <p className="m-0 text-sm text-zinc-500">Loading push settings…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status</div>
              <div className={`mt-0.5 text-sm font-semibold ${status?.configured ? 'text-emerald-700' : 'text-zinc-700'}`}>
                {status?.configured ? 'On' : 'Not set'}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Firebase project</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-800">{status?.projectId || '—'}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Key hint</div>
              <div className="mt-0.5 truncate font-mono text-sm font-semibold text-zinc-800" title={status?.hint || ''}>
                {status?.hint || '—'}
              </div>
            </div>
          </div>

          {status?.message ? <p className="m-0 text-xs text-zinc-500">{status.message}</p> : null}

          <label className="block">
            <span className={labelClass}>{status?.configured ? 'Replace service account JSON' : 'Service account JSON *'}</span>
            <textarea
              autoComplete="off"
              spellCheck={false}
              rows={5}
              className="w-full box-border rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400"
              placeholder={'{ "type": "service_account", "project_id": "…", "private_key": "…", "client_email": "…" }'}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              disabled={saving}
            />
            <span className="mt-1 block text-[11px] text-zinc-400">
              Only project_id, client_email and private_key are kept, encrypted. Never share this file in chat or email.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={saving || !json.trim()}
              onClick={() => void save()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              <SaveOutlinedIcon sx={{ fontSize: 15 }} />
              {saving ? 'Saving…' : 'Save Firebase key'}
            </button>
            {status?.configured ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void test()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                <NotificationsActiveOutlinedIcon sx={{ fontSize: 15 }} />
                Send test push
              </button>
            ) : null}
            {status?.configured ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                {confirmRemove ? 'Click again to remove' : 'Remove key'}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
};

export default FcmIntegrationPanel;
