/**
 * Runtime logic of declared extension fields, shared by every extension.
 * Mirrors openext-crm-suite/api/utils/extension-field-logic.util.js — the
 * server recomputes formulas and re-checks options on save, so this copy only
 * has to give the user the same answer while typing.
 */
import type { ExtensionFieldDef } from '../types/extensions';

type Option = { label: string; value: string };

const str = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today on this device's calendar, "YYYY-MM-DD" (date-only: never the UTC day, which can be a day off). */
export function localDay(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * The days a date field may take with the record's other values (minDate "today", minField, maxField),
 * for the picker's min / max. A stored past day is still shown as it is.
 */
export function dateBounds(field: ExtensionFieldDef, values: Record<string, unknown> | undefined): { min?: string; max?: string } {
  if (field.type !== 'date') return {};
  const day = (k?: string) => {
    const v = k && values ? str(values[k]).slice(0, 10) : '';
    return DAY_RE.test(v) ? v : '';
  };
  let min = field.minDate === 'today' ? localDay() : '';
  const after = day(field.minField);
  if (after && after > min) min = after;
  const max = day(field.maxField);
  return { ...(min ? { min } : {}), ...(max ? { max } : {}) };
}

/** Options of a field for the current extension settings values. */
export function resolveFieldOptions(field: ExtensionFieldDef, settingsValues: Record<string, unknown> | null): Option[] {
  const from = field.optionsFrom;
  if (!from) return field.options || [];
  const settingKey = typeof from === 'string' ? from.replace(/^settings\./, '') : from.setting;
  const source = settingsValues && settingKey ? settingsValues[settingKey] : undefined;
  const list = Array.isArray(source) ? source : [];
  const out: Option[] = [];
  const seen = new Set<string>();
  const isObj = typeof from === 'object' && from !== null;
  for (const item of list) {
    let value: string;
    let label: string;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>;
      if (isObj && from.enabledKey && obj[from.enabledKey] === false) continue;
      value = str(isObj && from.value ? obj[from.value] : obj.value);
      label = str(isObj && from.label ? obj[from.label] : obj.label) || value;
    } else {
      value = str(item);
      label = value;
    }
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ label, value });
  }
  return out.length ? out : field.options || [];
}

function parseDate(value: unknown): Date | null {
  const text = str(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
  const date = new Date(`${text.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function evaluateFormula(formula: NonNullable<ExtensionFieldDef['formula']>, values: Record<string, unknown>): unknown {
  if (formula.op === 'sum') {
    let total = 0;
    let any = false;
    for (const key of formula.of || []) {
      const raw = values[key];
      const n = Number(raw);
      if (raw !== '' && raw !== null && raw !== undefined && Number.isFinite(n)) {
        total += n;
        any = true;
      }
    }
    return any ? total : null;
  }
  if (formula.op === 'days_between') {
    const from = parseDate(values[formula.from || '']);
    const to = parseDate(values[formula.to || '']);
    if (!from || !to) return null;
    // A negative difference (end before start) is no answer; the inclusive day is added only after.
    const diff = Math.round((to.getTime() - from.getTime()) / 86400000);
    if (diff < 0) return null;
    return diff + (formula.inclusive ? 1 : 0);
  }
  if (formula.op === 'month_of') {
    const date = parseDate(values[(formula.of as unknown as string) || '']);
    if (!date) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return null;
}

/** Values with every formula field recomputed. */
export function withFormulas(fields: ExtensionFieldDef[], values: Record<string, unknown>): Record<string, unknown> {
  const next = { ...values };
  for (const field of fields) {
    if (field.formula) next[field.key] = evaluateFormula(field.formula, next);
  }
  return next;
}

/** Grid classes for the declared width (12-column grid). */
export function fieldWidthClass(field: Pick<ExtensionFieldDef, 'width' | 'type'>): string {
  const width = field.width || (field.type === 'textarea' ? 'full' : 'third');
  switch (width) {
    case 'quarter':
      return 'col-span-12 sm:col-span-6 lg:col-span-3';
    case 'half':
      return 'col-span-12 lg:col-span-6';
    case 'full':
      return 'col-span-12';
    default:
      return 'col-span-12 sm:col-span-6 lg:col-span-4';
  }
}

/** Window events so independent parts of a page stay in sync. */
export const EXTENSION_VALUES_CHANGED = 'crm:extension-values-changed';
export const EXTENSION_SETTINGS_CHANGED = 'crm:extension-settings-changed';

export function emitValuesChanged(record: string, recordId: string, values: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(EXTENSION_VALUES_CHANGED, { detail: { record, recordId, values } }));
}

export function emitSettingsChanged(extensionId: string, values: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(EXTENSION_SETTINGS_CHANGED, { detail: { extensionId, values } }));
}

/** Labels of required declared fields left empty (formula, read-only and hidden fields excluded). */
export function missingRequiredFields(
  groups: Array<{ whenRequestTypeKey?: string; fields: ExtensionFieldDef[] }>,
  values: Record<string, unknown>,
  requestTypeKey?: string
): string[] {
  const missing: string[] = [];
  for (const group of groups || []) {
    if (group.whenRequestTypeKey && group.whenRequestTypeKey !== requestTypeKey) continue;
    for (const field of group.fields || []) {
      if (!field.required || field.formula || field.readOnly || field.hidden) continue;
      const value = values[field.key] !== undefined ? values[field.key] : field.default;
      const empty =
        value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) ||
        (field.type === 'checkbox' && value !== true);
      if (empty) missing.push(field.label);
    }
  }
  return missing;
}

/**
 * Whether a prefill may replace the value a field holds now: it is empty, it is what the page filled in
 * itself last time (`autoValue`), or it is still the field's declared default (seeded when the form opened).
 */
export function canReplaceWithPrefill(
  current: unknown,
  autoValue: unknown,
  field: ExtensionFieldDef | undefined
): boolean {
  if (current === undefined || current === null || current === '' || (Array.isArray(current) && !current.length)) return true;
  if (current === autoValue) return true;
  if (!field || field.default === undefined || field.default === null) return false;
  const seeded = field.default === 'today' ? localDay() : field.default;
  return current === seeded;
}

/** The value a field goes back to when an automatic value is withdrawn: its declared default, else empty. */
export function emptyFieldValue(field: ExtensionFieldDef | undefined): unknown {
  if (field && field.default !== undefined && field.default !== null) {
    return field.default === 'today' ? localDay() : field.default;
  }
  if (!field) return '';
  if (field.type === 'multiselect') return [];
  if (field.type === 'checkbox') return false;
  if (field.type === 'number' || field.type === 'currency') return null;
  return '';
}

/**
 * The first declared value the server would refuse (same rules as its values check: numbers and their
 * min / max, select / radio / multi-select options, dates and their minDate / minField / maxField rules),
 * as "<Label> must …"; null when all are fine. Fields whose options come from settings are only checked
 * once `settingsValues` is known. `original`: the saved values — a past day already saved is not refused.
 */
export function invalidFieldValue(
  fields: ExtensionFieldDef[],
  values: Record<string, unknown>,
  settingsValues: Record<string, unknown> | null,
  original: Record<string, unknown> = {}
): string | null {
  for (const field of fields) {
    if (field.formula || !(field.key in values)) continue;
    const value = values[field.key];
    if (value === undefined || value === null || value === '') continue;
    const label = field.label || field.key;
    if (field.type === 'number' || field.type === 'currency') {
      const n = Number(value);
      if (!Number.isFinite(n)) return `${label} must be a number`;
      if (field.min !== undefined && field.min !== null && n < field.min) return `${label} must be at least ${field.min}`;
      if (field.max !== undefined && field.max !== null && n > field.max) return `${label} must be at most ${field.max}`;
      continue;
    }
    if (field.type === 'date') {
      const v = str(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return `${label} must be a valid date`;
      if (field.minDate === 'today' && v !== str(original[field.key]).slice(0, 10) && v < localDay()) return `${label} cannot be in the past.`;
      for (const [otherKey, word] of [[field.minField, 'before'], [field.maxField, 'after']] as const) {
        const other = otherKey ? str(values[otherKey]).slice(0, 10) : '';
        if (!otherKey || !DAY_RE.test(other)) continue;
        if (word === 'before' ? v < other : v > other) {
          const otherLabel = fields.find((f) => f.key === otherKey)?.label || otherKey;
          return `${label} cannot be ${word} ${otherLabel}.`;
        }
      }
      continue;
    }
    if (field.type !== 'select' && field.type !== 'radio' && field.type !== 'multiselect') continue;
    if (field.optionsFrom && !settingsValues) continue;
    const allowed = new Set(resolveFieldOptions(field, settingsValues).map((o) => o.value));
    if (field.type === 'multiselect') {
      const list = Array.isArray(value) ? value : [value];
      const bad = list.map(str).find((item) => item && !allowed.has(item));
      if (bad) return `${label} has an option that is not offered: "${bad}"`;
    } else if (!allowed.has(str(value))) {
      return `${label} must be one of the options`;
    }
  }
  return null;
}
