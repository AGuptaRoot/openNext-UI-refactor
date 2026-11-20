import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';

import { notify } from '@/components/notifications';
import { ApiError, crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  GST_PORTAL_RATES,
  type GstExtensionInfo,
  type GstServiceTax,
  type GstSettings,
  type GstTcsRule,
  type GstinCheck,
} from '../../types/gst';

/**
 * Settings → GST (GST suite, CRM 3.53.0; documentation/gst-planning/05 §6).
 * The seller's GST identity (state and PAN come from the GSTIN), UPI id, LUT, the service tax list,
 * TCS rules and the books lock date. Generic: defaults come only from the enabled extension.
 */

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';
const sectionClass = 'rounded-xl border border-zinc-300 bg-white p-5';
const hintClass = 'm-0 mt-1 text-[11px] text-zinc-500';

const EMPTY: GstSettings = {
  exists: false,
  legalName: '',
  tradeName: '',
  gstin: '',
  stateCode: '',
  stateName: '',
  pan: '',
  compositionScheme: false,
  email: '',
  phone: '',
  address: { line1: '', line2: '', city: '', pincode: '' },
  upiId: '',
  lut: { number: '', fy: '' },
  serviceTaxes: [],
  tcsRules: [],
  lockedUpTo: '',
  defaultTerms: '',
};

/** The financial year of a date, as the GST portal writes it ('2026-27'). Same rule as gst-core lut.fyOf. */
function fyOf(date: Date): string {
  const y = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

function fyOptions(today = new Date()): string[] {
  const cur = Number(fyOf(today).slice(0, 4));
  return [cur + 1, cur, cur - 1, cur - 2].map((y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`);
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-4">
    <h2 className="m-0 text-base font-bold tracking-tight text-zinc-950">{title}</h2>
    {subtitle ? <p className="mb-0 mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
  </div>
);

export const GstSettingsPanel: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('crm.settings.manage');

  const [form, setForm] = useState<GstSettings>(EMPTY);
  const [extension, setExtension] = useState<GstExtensionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [gstinCheck, setGstinCheck] = useState<GstinCheck | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      const res = await crmApi.getGstSettings();
      setForm({ ...EMPTY, ...res.data.settings });
      setExtension(res.data.extension);
      setGstinCheck(null);
      setDirty(false);
    } catch (err) {
      notify.error(errorText(err, 'Could not load GST settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof GstSettings>(key: K, value: GstSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const checkGstin = async () => {
    const value = form.gstin.trim();
    if (!value) {
      setGstinCheck(null);
      return;
    }
    try {
      const res = await crmApi.validateGstin(value);
      setGstinCheck(res.data);
    } catch (err) {
      setGstinCheck({ ok: false, message: errorText(err, 'Could not check the GSTIN') });
    }
  };

  const setService = (index: number, patch: Partial<GstServiceTax>) => {
    setForm((f) => ({ ...f, serviceTaxes: f.serviceTaxes.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
    setDirty(true);
  };
  const addService = () => {
    setForm((f) => ({
      ...f,
      serviceTaxes: [...f.serviceTaxes, { serviceType: '', label: '', sac: '', taxPercent: 18, note: '', source: '' }],
    }));
    setDirty(true);
  };
  const removeService = (index: number) => {
    setForm((f) => ({ ...f, serviceTaxes: f.serviceTaxes.filter((_, i) => i !== index) }));
    setDirty(true);
  };

  const setRule = (index: number, patch: Partial<GstTcsRule>) => {
    setForm((f) => ({ ...f, tcsRules: f.tcsRules.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setErrors([]);
    setWarnings([]);
    try {
      const { exists: _exists, stateCode: _sc, stateName: _sn, pan: _pan, updatedAt: _u, ...body } = form;
      const res = await crmApi.saveGstSettings(body);
      setForm({ ...EMPTY, ...res.data.settings });
      setWarnings(res.data.warnings || []);
      setDirty(false);
      setGstinCheck(null);
      notify.success('GST settings saved');
    } catch (err) {
      const details = err instanceof ApiError && Array.isArray(err.details) ? err.details.map(String) : [];
      setErrors(details.length ? details : [errorText(err, 'Could not save GST settings')]);
    } finally {
      setSaving(false);
    }
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await crmApi.seedGstServices();
      setForm({ ...EMPTY, ...res.data.settings });
      setDirty(false);
      if (res.data.addedServices || res.data.addedTcsRules) notify.success(res.data.message);
      else notify.info(res.data.message);
    } catch (err) {
      notify.error(errorText(err, 'Could not load the defaults'));
    } finally {
      setSeeding(false);
    }
  };

  const lutYears = useMemo(() => fyOptions(), []);
  const currentFy = useMemo(() => fyOf(new Date()), []);
  const hasExtensionDefaults = Boolean(extension && (extension.services > 0 || extension.tcsRules > 0));
  const shownState = gstinCheck?.ok ? gstinCheck.state : form.stateName;
  const shownPan = gstinCheck?.ok ? gstinCheck.pan : form.pan;

  if (loading) {
    return <p className="m-0 text-sm text-zinc-500">Loading GST settings…</p>;
  }

  return (
    <div className="space-y-5" data-tour="settings-gst">
      {!canEdit ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          You can view these settings. Only users who manage CRM settings can change them.
        </div>
      ) : null}

      {!form.exists ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          GST is not set up yet. Enter your GSTIN and legal name, then save. GST invoices can't be issued until then.
        </div>
      ) : null}

      {errors.length ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="m-0 font-semibold">Please fix these:</p>
          <ul className="mb-0 mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ul className="m-0 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 1. Business */}
      <section className={sectionClass}>
        <SectionTitle title="Your GST registration" subtitle="State and PAN are read from the GSTIN, so they always match it." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Legal name *</span>
            <input className={inputClass} disabled={!canEdit} value={form.legalName} maxLength={200}
              onChange={(e) => update('legalName', e.target.value)} placeholder="As on the GST certificate" />
          </label>
          <label className="block">
            <span className={labelClass}>Trade name</span>
            <input className={inputClass} disabled={!canEdit} value={form.tradeName} maxLength={200}
              onChange={(e) => update('tradeName', e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>GSTIN *</span>
            <input className={`${inputClass} font-mono uppercase`} disabled={!canEdit} value={form.gstin} maxLength={15}
              onChange={(e) => { update('gstin', e.target.value.toUpperCase().replace(/\s+/g, '')); setGstinCheck(null); }}
              onBlur={() => void checkGstin()} placeholder="15 characters" />
            {gstinCheck && !gstinCheck.ok ? <p className="m-0 mt-1 text-[11px] font-semibold text-red-600">{gstinCheck.message}</p> : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">State</div>
              <div className="mt-0.5 text-sm font-semibold text-zinc-800">{shownState || '—'}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">PAN</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-800">{shownPan || '—'}</div>
            </div>
          </div>
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-zinc-800">
          <input type="checkbox" className="mt-0.5" disabled={!canEdit} checked={form.compositionScheme}
            onChange={(e) => update('compositionScheme', e.target.checked)} />
          <span>
            <span className="font-semibold">Composition scheme</span>
            <span className="block text-xs text-zinc-500">
              A composition dealer issues a bill of supply and charges no GST. Every service rate must then be 0%.
            </span>
          </span>
        </label>
      </section>

      {/* 2. Contact and address */}
      <section className={sectionClass}>
        <SectionTitle title="Contact and address" subtitle="Printed on GST invoices." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Email</span>
            <input className={inputClass} disabled={!canEdit} type="email" value={form.email} maxLength={120}
              onChange={(e) => update('email', e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Phone</span>
            <input className={inputClass} disabled={!canEdit} value={form.phone} maxLength={20}
              onChange={(e) => update('phone', e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>Address line 1</span>
            <input className={inputClass} disabled={!canEdit} value={form.address.line1} maxLength={200}
              onChange={(e) => update('address', { ...form.address, line1: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>Address line 2</span>
            <input className={inputClass} disabled={!canEdit} value={form.address.line2} maxLength={200}
              onChange={(e) => update('address', { ...form.address, line2: e.target.value })} />
          </label>
          <label className="block">
            <span className={labelClass}>City</span>
            <input className={inputClass} disabled={!canEdit} value={form.address.city} maxLength={80}
              onChange={(e) => update('address', { ...form.address, city: e.target.value })} />
          </label>
          <label className="block">
            <span className={labelClass}>PIN code</span>
            <input className={inputClass} disabled={!canEdit} value={form.address.pincode} maxLength={10}
              onChange={(e) => update('address', { ...form.address, pincode: e.target.value })} />
          </label>
        </div>
      </section>

      {/* 3. UPI and LUT */}
      <section className={sectionClass}>
        <SectionTitle title="UPI and LUT" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>UPI id</span>
            <input className={inputClass} disabled={!canEdit} value={form.upiId} maxLength={100} placeholder="name@bank"
              onChange={(e) => update('upiId', e.target.value.trim())} />
            <p className={hintClass}>Bank accounts stay in Finance &amp; Banking.</p>
          </label>
          <label className="block">
            <span className={labelClass}>LUT number (ARN)</span>
            <input className={`${inputClass} font-mono uppercase`} disabled={!canEdit} value={form.lut.number} maxLength={20}
              onChange={(e) => update('lut', { ...form.lut, number: e.target.value.toUpperCase() })} />
            <p className={hintClass}>Only for exports or SEZ clients without paying IGST.</p>
          </label>
          <label className="block">
            <span className={labelClass}>LUT financial year</span>
            <select className={inputClass} disabled={!canEdit} value={form.lut.fy}
              onChange={(e) => update('lut', { ...form.lut, fy: e.target.value })}>
              <option value="">—</option>
              {[...new Set([...lutYears, ...(form.lut.fy ? [form.lut.fy] : [])])].map((fy) => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
            {form.lut.number && form.lut.fy && form.lut.fy !== currentFy ? (
              <p className="m-0 mt-1 text-[11px] font-semibold text-amber-700">
                This LUT is not for the current year ({currentFy}).
              </p>
            ) : null}
          </label>
        </div>
      </section>

      {/* 4. Services */}
      <section className={sectionClass}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle title="Services and GST rates" subtitle="The SAC code and rate of each kind of service you sell." />
          <div className="flex flex-wrap gap-2">
            {canEdit && hasExtensionDefaults ? (
              <button type="button" disabled={seeding || dirty || !form.exists} onClick={() => void seed()}
                title={!form.exists ? 'Save your GSTIN first' : dirty ? 'Save your changes first' : `Load the defaults of ${extension?.extensionName}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer">
                <CloudDownloadOutlinedIcon sx={{ fontSize: 15 }} />
                Load defaults from {extension?.extensionName}
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" onClick={addService}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                <AddIcon sx={{ fontSize: 15 }} />
                Add service
              </button>
            ) : null}
          </div>
        </div>
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Rates are defaults — confirm each with your CA.
        </div>
        {form.serviceTaxes.length === 0 ? (
          <p className="m-0 text-sm text-zinc-500">No services yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-2">Key</th>
                  <th className="pb-2 pr-2">Name</th>
                  <th className="pb-2 pr-2">SAC</th>
                  <th className="pb-2 pr-2">Rate</th>
                  <th className="pb-2 pr-2">Note</th>
                  <th className="pb-2 pr-2">From</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {form.serviceTaxes.map((s, i) => (
                  <tr key={i} className="border-t border-zinc-100 align-top">
                    <td className="py-2 pr-2">
                      <input className={`${inputClass} font-mono`} disabled={!canEdit} value={s.serviceType} maxLength={41}
                        placeholder="e.g. consulting"
                        onChange={(e) => setService(i, { serviceType: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input className={inputClass} disabled={!canEdit} value={s.label} maxLength={60}
                        onChange={(e) => setService(i, { label: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input className={`${inputClass} w-28 font-mono`} disabled={!canEdit} value={s.sac} maxLength={8} inputMode="numeric"
                        onChange={(e) => setService(i, { sac: e.target.value.replace(/\D/g, '') })} />
                    </td>
                    <td className="py-2 pr-2">
                      <select className={`${inputClass} w-24`} disabled={!canEdit} value={String(s.taxPercent)}
                        onChange={(e) => setService(i, { taxPercent: Number(e.target.value) })}>
                        {GST_PORTAL_RATES.map((r) => (
                          <option key={r} value={String(r)}>{r}%</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input className={inputClass} disabled={!canEdit} value={s.note} maxLength={200}
                        placeholder="e.g. Confirmed by CA on …"
                        onChange={(e) => setService(i, { note: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2 text-xs text-zinc-500">{s.source || 'You'}</td>
                    <td className="py-2 text-right">
                      {canEdit ? (
                        <button type="button" onClick={() => removeService(i)} aria-label="Remove service"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer">
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. TCS rules (only when an extension declared some) */}
      {form.tcsRules.length ? (
        <section className={sectionClass}>
          <SectionTitle title="TCS rules" subtitle="Off until your CA confirms the slabs. A rule can't be switched on without slabs." />
          <div className="space-y-4">
            {form.tcsRules.map((r, i) => (
              <div key={r.key} className="rounded-lg border border-zinc-200 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{r.label || r.key}</div>
                    <div className="text-[11px] text-zinc-500">
                      {r.source ? `From ${r.source}` : 'Added by you'} · key <span className="font-mono">{r.key}</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                    <input type="checkbox" disabled={!canEdit} checked={r.enabled} onChange={(e) => setRule(i, { enabled: e.target.checked })} />
                    Switched on
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className={labelClass}>Section (as printed)</span>
                    <input className={inputClass} disabled={!canEdit} value={r.sectionLabel} maxLength={40}
                      onChange={(e) => setRule(i, { sectionLabel: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Rate without PAN (%)</span>
                    <input className={inputClass} disabled={!canEdit} type="number" min={0} max={100} step="0.01"
                      value={r.noPanRate ?? ''}
                      onChange={(e) => setRule(i, { noPanRate: e.target.value === '' ? null : Number(e.target.value) })} />
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm text-zinc-800">
                    <input type="checkbox" disabled={!canEdit} checked={r.needsPan} onChange={(e) => setRule(i, { needsPan: e.target.checked })} />
                    Needs the client's PAN
                  </label>
                </div>
                <div className="mt-3">
                  <span className={labelClass}>Slabs (per PAN per financial year)</span>
                  {r.slabs.map((slab, j) => (
                    <div key={j} className="mb-2 flex items-center gap-2">
                      <span className="w-14 text-xs text-zinc-500">Up to ₹</span>
                      <input className={`${inputClass} w-40`} disabled={!canEdit} type="number" min={1} placeholder="No limit"
                        value={slab.upTo ?? ''}
                        onChange={(e) => setRule(i, { slabs: r.slabs.map((x, k) => (k === j ? { ...x, upTo: e.target.value === '' ? null : Number(e.target.value) } : x)) })} />
                      <input className={`${inputClass} w-24`} disabled={!canEdit} type="number" min={0} max={100} step="0.01"
                        value={slab.rate}
                        onChange={(e) => setRule(i, { slabs: r.slabs.map((x, k) => (k === j ? { ...x, rate: Number(e.target.value) } : x)) })} />
                      <span className="text-xs text-zinc-500">%</span>
                      {canEdit ? (
                        <button type="button" aria-label="Remove slab"
                          onClick={() => setRule(i, { slabs: r.slabs.filter((_, k) => k !== j) })}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer">
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {canEdit && r.slabs.length < 10 ? (
                    <button type="button" onClick={() => setRule(i, { slabs: [...r.slabs, { upTo: null, rate: 0 }] })}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                      <AddIcon sx={{ fontSize: 14 }} />
                      Add slab
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6. Books lock */}
      <section className={sectionClass}>
        <SectionTitle title="Books locked up to" subtitle="GST documents and cash entries on or before this date can't be added, changed or deleted." />
        <div className="max-w-xs">
          <input className={inputClass} disabled={!canEdit} type="date" value={form.lockedUpTo}
            onChange={(e) => update('lockedUpTo', e.target.value)} />
          <p className={hintClass}>Usually the last day of a month whose GST return is filed. Leave empty for no lock.</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" disabled={saving || seeding} onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer">
          <RefreshIcon sx={{ fontSize: 15 }} />
          {dirty ? 'Discard changes' : 'Refresh'}
        </button>
        {canEdit ? (
          <button type="button" disabled={saving || !dirty} onClick={() => void save()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
            <SaveOutlinedIcon sx={{ fontSize: 15 }} />
            {saving ? 'Saving…' : 'Save GST settings'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default GstSettingsPanel;
