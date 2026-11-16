import { extensionDataApi } from '../services/extensionDataApi';
import { emitSettingsChanged } from './extensionFieldLogic';
import { errorMessage } from '../components/notifications';
import type { ExtensionFieldDef } from '../types/extensions';

/**
 * CRM 3.43.1: "+ Add" on a declared select whose options come from an extension settings list
 * (optionsFrom). The new name is kept on the field ONLY when the settings list really saved it:
 * the server refuses a list over 500 names and users without crm.settings.manage, and a value that
 * is not in the list is refused again when the record is saved ("<Field> must be one of the options").
 */

/** The CRM's limit for a settings list (crm-extension-settings.service.js MAX_LIST_ITEMS). */
export const SETTING_LIST_MAX = 500;
export const SETTINGS_MANAGE = 'crm.settings.manage';
/** Field types whose value must be one of the options (the server refuses anything else). */
export const OPTION_TYPES: ReadonlySet<string> = new Set(['select', 'searchable_select', 'radio']);

export type AddSettingOptionResult =
  | { ok: true; value: string; values: Record<string, unknown> }
  | { ok: false; message: string };

/** The settings list a field reads its options from (optionsFrom), or ''. */
export function settingKeyOf(field: ExtensionFieldDef): string {
  const from = field.optionsFrom as unknown;
  if (typeof from === 'string') return from.replace(/^settings\./, '');
  if (from && typeof from === 'object' && typeof (from as { setting?: unknown }).setting === 'string') {
    return (from as { setting: string }).setting;
  }
  return '';
}

/**
 * Saves `name` into the settings list `settingKey` and tells every open form.
 * A name already in the list (any letter case) is reused as it is written there.
 */
export async function addSettingOption(options: {
  extensionId: string;
  settingKey: string;
  name: string;
  label: string;
  settingsValues: Record<string, unknown> | null | undefined;
  canManageSettings: boolean;
}): Promise<AddSettingOptionResult> {
  const name = String(options.name || '').trim();
  const label = options.label || 'This field';
  if (!name) return { ok: false, message: `Type a name for ${label}.` };
  if (!options.settingKey) return { ok: false, message: `${label} offers only its own options. Choose one from the list.` };

  const current = Array.isArray(options.settingsValues?.[options.settingKey])
    ? (options.settingsValues![options.settingKey] as unknown[]).map((v) => String(v ?? '').trim()).filter(Boolean)
    : [];
  const existing = current.find((v) => v.toLowerCase() === name.toLowerCase());
  if (existing) return { ok: true, value: existing, values: options.settingsValues || {} };

  if (!options.canManageSettings) {
    return { ok: false, message: `"${name}" is not in the ${label} list. Choose one from the list, or ask an admin to add it in Settings.` };
  }
  if (current.length >= SETTING_LIST_MAX) {
    return {
      ok: false,
      message: `"${name}" was not added: the ${label} list already has ${SETTING_LIST_MAX} names. Remove unused names in Settings, or choose one from the list.`,
    };
  }

  try {
    const res = await extensionDataApi.setSettings({ [options.settingKey]: [...current, name] });
    const values = res && res.values && typeof res.values === 'object' ? res.values : {};
    const saved = Array.isArray(values[options.settingKey]) ? (values[options.settingKey] as unknown[]).map((v) => String(v ?? '').trim()) : [];
    const kept = saved.find((v) => v.toLowerCase() === name.toLowerCase());
    if (!kept) return { ok: false, message: `"${name}" could not be added to the ${label} list.` };
    emitSettingsChanged(options.extensionId, values);
    return { ok: true, value: kept, values };
  } catch (error) {
    return { ok: false, message: `"${name}" was not added to the ${label} list: ${errorMessage(error, 'the settings could not be saved.')}` };
  }
}
