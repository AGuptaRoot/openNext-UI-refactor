import React, { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { extensionDataApi, type ExtensionSettingsResponse } from '../../services/extensionDataApi';
import { ExtensionFieldInput } from './ExtensionFieldInput';
import { ExtensionChipList } from './ExtensionChipList';
import { ExtensionMount } from './ExtensionMount';
import { getExtensionIcon } from './extensionIcons';
import { EXTENSION_SETTINGS_CHANGED, emitSettingsChanged, fieldWidthClass } from '../../utils/extensionFieldLogic';
import type { ExtensionFieldDef } from '../../types/extensions';
import { useNotifyMessage } from '@/components/notifications';

/**
 * Settings tab of the active extension (json/settings.json), for any extension:
 *   - header with the tab's eyebrow, title, description and a count per list
 *   - `list` settings as chip lists (same look as Settings → Leads)
 *   - other visible settings as a form
 *   - an optional extension UI (tab.slot) below, e.g. a form builder; it saves
 *     its own `json` settings through ctx.saveSettings
 * Saving here sends only the fields shown here, so it never overwrites what the
 * mounted UI saved.
 */
export const ExtensionSettingsTab: React.FC = () => {
  const { extension } = useActiveExtension();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsData, setSettingsData] = useState<ExtensionSettingsResponse | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  useNotifyMessage(message?.text, message?.kind ?? 'error', () => setMessage(null));
  const [dirty, setDirty] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await extensionDataApi.getSettings();
      setSettingsData(data);
      setValues(data.values || {});
      setDirty(false);
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: (err as Error)?.message || 'Failed to load extension settings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  // A mounted extension UI saved settings: keep our copy of its values current.
  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ extensionId: string; values: Record<string, unknown> }>).detail;
      if (detail && detail.extensionId === extension.id) setValues((prev) => ({ ...prev, ...detail.values }));
    };
    window.addEventListener(EXTENSION_SETTINGS_CHANGED, onChanged);
    return () => window.removeEventListener(EXTENSION_SETTINGS_CHANGED, onChanged);
  }, [extension.id]);

  const fields = useMemo(() => (settingsData?.fields || []) as ExtensionFieldDef[], [settingsData]);
  const listFields = fields.filter((f) => f.type === 'list' && !f.hidden);
  const formFields = fields.filter((f) => f.type !== 'list' && f.type !== 'json' && !f.hidden);
  const editableKeys = useMemo(() => new Set([...listFields, ...formFields].map((f) => f.key)), [listFields, formFields]);

  const change = (key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
    setMessage(null);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const patch: Record<string, unknown> = {};
      for (const key of editableKeys) patch[key] = values[key];
      const res = await extensionDataApi.setSettings(patch);
      setValues(res.values || {});
      setDirty(false);
      emitSettingsChanged(extension.id, res.values || {});
      setMessage({ kind: 'success', text: `${settingsData?.tab?.label || extension.name} settings saved.` });
    } catch (err: unknown) {
      const details = (err as { details?: unknown }).details;
      setMessage({
        kind: 'error',
        text: Array.isArray(details) && details.length ? details.map(String).join(' · ') : (err as Error)?.message || 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-center text-xs text-zinc-400">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        <span>Loading {extension.name} settings…</span>
      </div>
    );
  }

  const tab = settingsData?.tab;

  return (
    <div className="space-y-5">
      <form onSubmit={handleSave} className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 bg-[linear-gradient(135deg,#fafafa_0%,#ffffff_55%,#f4f4f5_100%)] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                  {getExtensionIcon(tab?.icon || 'sliders', { className: 'h-4 w-4 shrink-0', 'aria-hidden': true })}
                  <span>{tab?.eyebrow || extension.name}</span>
                </div>
                <h2 className="m-0 text-xl font-bold tracking-tight text-zinc-950">
                  {tab?.label || `${extension.name} settings`}
                </h2>
                {tab?.description && <p className="mb-0 mt-2 text-sm leading-relaxed text-zinc-500">{tab.description}</p>}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {listFields.map((field) => (
                  <div key={field.key} className="min-w-[88px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center">
                    <div className="text-lg font-bold text-zinc-950">
                      {Array.isArray(values[field.key]) ? (values[field.key] as unknown[]).length : 0}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{field.label}</div>
                  </div>
                ))}
                {editableKeys.size > 0 && (
                  <button
                    type="submit"
                    disabled={saving || !dirty}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" aria-hidden /> {saving ? 'Saving…' : 'Save changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {listFields.length > 0 && (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {listFields.map((field) => (
              <ExtensionChipList
                key={field.key}
                title={field.label}
                description={field.helpText}
                placeholder={field.placeholder}
                value={values[field.key]}
                disabled={saving}
                onChange={(val) => change(field.key, val)}
              />
            ))}
          </section>
        )}

        {formFields.length > 0 && (
          <section className="rounded-xl border border-zinc-300 bg-white p-5">
            <div className="grid grid-cols-12 gap-4">
              {formFields.map((field) => (
                <div key={field.key} className={fieldWidthClass({ ...field, width: field.width || 'half' })}>
                  <ExtensionFieldInput
                    field={field}
                    value={values[field.key] !== undefined ? values[field.key] : field.default}
                    onChange={(val) => change(field.key, val)}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </form>

      {tab?.slot && <ExtensionMount slot={tab.slot} />}
    </div>
  );
};
