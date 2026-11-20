import React, { useEffect, useState } from 'react';

import { notify } from '@/components/notifications';
import { ApiError, crmApi } from '../../services/api';
import type { ClientItem } from '../../types/clients';
import type { GstinCheck } from '../../types/gst';

/**
 * Client → Overview → GST (GST suite, CRM 3.53.0; documentation/gst-planning/05 §4).
 * B2B or B2C is decided by whether a GSTIN is filled. The server checks the checksum, fills an empty
 * billing state from the GSTIN, takes the PAN from it, and warns when the state does not match.
 */

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';

interface Props {
  client: ClientItem;
  canEdit: boolean;
  onSaved: (client: ClientItem) => void;
}

function isForeign(country?: string): boolean {
  const c = String(country || '').trim().toLowerCase();
  return Boolean(c) && c !== 'india' && c !== 'in' && c !== 'bharat';
}

export const ClientGstCard: React.FC<Props> = ({ client, canEdit, onSaved }) => {
  const gst: NonNullable<ClientItem['gst']> = client.gst || { gstin: '', pan: '', isSEZ: false, isDeemedExport: false };
  const [editing, setEditing] = useState(false);
  const [gstin, setGstin] = useState(gst.gstin);
  const [isSEZ, setIsSEZ] = useState(gst.isSEZ);
  const [isDeemedExport, setIsDeemedExport] = useState(gst.isDeemedExport);
  const [check, setCheck] = useState<GstinCheck | null>(null);
  // CRM 3.54.0: PAN typed for a client without a GSTIN ('' = unchanged unless "remove" is ticked).
  const [panInput, setPanInput] = useState('');
  const [removePan, setRemovePan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (editing) return;
    setGstin(gst.gstin);
    setIsSEZ(gst.isSEZ);
    setIsDeemedExport(gst.isDeemedExport);
  }, [editing, gst.gstin, gst.isSEZ, gst.isDeemedExport]);

  const runCheck = async () => {
    if (!gstin.trim()) {
      setCheck(null);
      return;
    }
    try {
      setCheck((await crmApi.validateGstin(gstin.trim())).data);
    } catch (err) {
      setCheck({ ok: false, message: err instanceof ApiError ? err.message : 'Could not check the GSTIN' });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const typedPan = panInput.trim().toUpperCase();
      const panPart = gstin.trim() ? {} : typedPan ? { pan: typedPan } : removePan ? { pan: '' } : {};
      const res = await crmApi.updateClient(client._id, { gst: { gstin: gstin.trim(), isSEZ, isDeemedExport, ...panPart } });
      setPanInput('');
      setRemovePan(false);
      onSaved(res.data);
      setWarnings(res.data.gstWarnings || []);
      setEditing(false);
      setCheck(null);
      notify.success('GST details saved');
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : 'Could not save the GST details');
    } finally {
      setSaving(false);
    }
  };

  const foreign = isForeign(client.billingAddress?.country);
  const registered = Boolean(gst.gstin);

  return (
    <div data-tour="clients-overview-gst" className="rounded-xl border border-zinc-300 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-500">GST</h3>
        {canEdit && !editing ? (
          <button type="button" onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer">
            Edit
          </button>
        ) : null}
      </div>

      {!editing ? (
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Type</dt>
            <dd className="m-0 font-semibold text-zinc-900">
              {foreign ? 'Foreign client (export)' : registered ? 'Registered (B2B)' : 'Unregistered (B2C)'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">GSTIN</dt>
            <dd className="m-0 font-mono font-semibold text-zinc-900">{gst.gstin || '—'}</dd>
          </div>
          {gst.pan || gst.panLast4 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">PAN</dt>
              <dd className="m-0 font-mono font-semibold text-zinc-900" title={gst.panSource === 'typed' ? 'Stored encrypted' : 'From the GSTIN'}>
                {gst.pan || `XXXXXX${gst.panLast4}`}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">State</dt>
            <dd className="m-0 font-semibold text-zinc-900">{client.billingAddress?.state || '—'}</dd>
          </div>
          {gst.isSEZ || gst.isDeemedExport ? (
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Special</dt>
              <dd className="m-0 font-semibold text-zinc-900">
                {[gst.isSEZ ? 'SEZ' : '', gst.isDeemedExport ? 'Deemed export' : ''].filter(Boolean).join(', ')}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-zinc-700">GSTIN (leave empty if not registered)</span>
            <input className={`${inputClass} font-mono uppercase`} value={gstin} maxLength={15}
              onChange={(e) => { setGstin(e.target.value.toUpperCase().replace(/\s+/g, '')); setCheck(null); }}
              onBlur={() => void runCheck()} />
          </label>
          {check ? (
            check.ok ? (
              <p className="m-0 text-[11px] text-emerald-700">
                Valid · {check.state} · PAN {check.pan}
                {client.billingAddress?.state && check.state && client.billingAddress.state.trim().toLowerCase() !== check.state.toLowerCase()
                  ? <span className="block font-semibold text-amber-700">The billing state says {client.billingAddress.state}. Check it.</span>
                  : null}
              </p>
            ) : (
              <p className="m-0 text-[11px] font-semibold text-red-600">{check.message}</p>
            )
          ) : null}
          {!gstin.trim() ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-zinc-700">
                PAN (no GSTIN; needed for GST / TCS reports){gst.panSource === 'typed' && gst.panLast4 ? ` · saved: XXXXXX${gst.panLast4}` : ''}
              </span>
              <input className={`${inputClass} font-mono uppercase`} value={panInput} maxLength={10} placeholder={gst.panSource === 'typed' && gst.panLast4 ? 'Type a new PAN to replace it' : 'ABCDE1234F'}
                onChange={(e) => { setPanInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setRemovePan(false); }} />
              <span className="mt-1 block text-[10px] text-zinc-500">Stored encrypted; shown only as the last 4 characters.</span>
              {panInput && !/^[A-Z]{5}\d{4}[A-Z]$/.test(panInput) ? (
                <span className="mt-1 block text-[11px] font-semibold text-red-600">PAN must be 5 letters, 4 digits, 1 letter.</span>
              ) : null}
              {gst.panSource === 'typed' && gst.panLast4 && !panInput ? (
                <label className="mt-1 flex items-center gap-2 text-[11px] text-zinc-700">
                  <input type="checkbox" checked={removePan} onChange={(e) => setRemovePan(e.target.checked)} /> Remove the saved PAN
                </label>
              ) : null}
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-zinc-800">
            <input type="checkbox" checked={isSEZ} onChange={(e) => setIsSEZ(e.target.checked)} />
            SEZ unit or developer (always IGST)
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-800">
            <input type="checkbox" checked={isDeemedExport} onChange={(e) => setIsDeemedExport(e.target.checked)} />
            Deemed export
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => { setEditing(false); setCheck(null); }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer">
              Cancel
            </button>
            <button type="button" disabled={saving || (check !== null && !check.ok) || (Boolean(panInput) && !/^[A-Z]{5}\d{4}[A-Z]$/.test(panInput))} onClick={() => void save()}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {warnings.length ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          {warnings.map((w) => (
            <p key={w} className="m-0">{w}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ClientGstCard;
