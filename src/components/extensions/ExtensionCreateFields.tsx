import React, { useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { ExtensionFieldInput } from './ExtensionFieldInput';
import { useExtensionSettingsValues } from './useExtensionSettings';
import { addSettingOption, settingKeyOf, OPTION_TYPES, SETTINGS_MANAGE } from '../../utils/addSettingOption';
import { useAuth } from '../../context/AuthContext';
import { notify } from '@/components/notifications';
import {
  fieldWidthClass,
  localDay,
  missingRequiredFields,
  resolveFieldOptions,
  withFormulas,
} from '../../utils/extensionFieldLogic';
import { useDialog } from '../../context/DialogContext';
import type {
  ExtensionFact,
  ExtensionFieldDef,
  ExtensionFieldGroup,
  ExtensionNoticeTone,
  ExtensionRecordType,
  ExtensionValueConfirm,
} from '../../types/extensions';

const NOTICE_CLASS:Record<ExtensionNoticeTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  danger: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
};

/** The group's countCheck notice for the current values, or null (numbers match / unknown). */
export function countCheckNotice(
  group: ExtensionFieldGroup,
  values: Record<string, unknown>,
  facts: ExtensionFact[]
): { tone: ExtensionNoticeTone; text: string } | null {
  const check = group.countCheck;
  if (!check) return null;
  const fact = facts.find((f) => f.key === check.actualFact);
  const raw = values[check.expectedField];
  const expected = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
  if (!fact || !Number.isFinite(fact.value) || !Number.isFinite(expected)) return null;
  const actual = fact.value;
  const side = actual > expected ? check.over : actual < expected ? check.under : undefined;
  if (!side) return null;
  const text = side.text
    .replace(/\{actual\}/g, String(actual))
    .replace(/\{expected\}/g, String(expected))
    .replace(/\{diff\}/g, String(Math.abs(actual - expected)));
  return { tone: side.tone, text };
}

/**
 * The group's live checklist row (countCheck.checkLabel), or null when it has none or the fact is not known:
 * ticked when the number given matches the group's number field, else "{actual} of {expected}".
 */
export function countCheckRow(
  group: ExtensionFieldGroup,
  values: Record<string, unknown>,
  facts: ExtensionFact[]
): { label: string; ok: boolean; hint: string } | null {
  const check = group.countCheck;
  if (!check || !check.checkLabel) return null;
  const fact = facts.find((f) => f.key === check.actualFact);
  if (!fact || !Number.isFinite(fact.value)) return null;
  const raw = values[check.expectedField];
  const expected = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(expected)) {
    const field = group.fields.find((f) => f.key === check.expectedField);
    return { label: check.checkLabel, ok: false, hint: `${fact.value} — ${field?.label || check.expectedField} not set` };
  }
  const ok = fact.value === expected;
  return { label: check.checkLabel, ok, hint: ok ? '' : `${fact.value} of ${expected}` };
}

interface ExtensionCreateFieldsProps {
  record: ExtensionRecordType;
  requestTypeKey?: string;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  disabled?: boolean;
  /** Shown at the top of every card while the fields are disabled (e.g. "Select a lead first"). */
  disabledHint?: string;
  /**
   * 'numbered': each group is a numbered section card like the page's own sections
   * (numbers start at startIndex). Default: the plain cards used on every create page.
   */
  variant?: 'default' | 'numbered';
  startIndex?: number;
  /** Numbers to show with the groups (and compare in a group's countCheck), e.g. from a prefill. */
  facts?: ExtensionFact[];
  /** Questions asked before a field takes a value; cancel keeps the old value. */
  confirms?: ExtensionValueConfirm[];
  /** Symbol for currency fields (e.g. the record's currency); the input's default when not given. */
  currencySymbol?: string;
  /** Only these field groups (ids from json/fields.json); all applicable groups when not given. */
  groupIds?: string[];
}

/**
 * Declared extension fields on a create page (lead, client, opportunity, ticket, quotation).
 * Generic: options may come from the extension's settings (optionsFrom), formula
 * fields are calculated while typing, and each field uses its declared width.
 * The page saves the values right after the record is created.
 */
export const ExtensionCreateFields: React.FC<ExtensionCreateFieldsProps> = ({
  record,
  requestTypeKey,
  values,
  onChange,
  disabled = false,
  disabledHint,
  variant = 'default',
  startIndex = 1,
  facts = [],
  confirms = [],
  currencySymbol,
  groupIds,
}) => {
  const { extension, declarations } = useActiveExtension();
  const { confirm } = useDialog();
  const { hasPermission } = useAuth();

  const applicableGroups = useMemo<ExtensionFieldGroup[]>(() => {
    const allGroups = declarations.fields?.[record] || [];
    return allGroups.filter((g) => {
      if (groupIds && groupIds.length && !groupIds.includes(g.id)) return false;
      if (record === 'lead' && g.whenRequestTypeKey) {
        if (!requestTypeKey || g.whenRequestTypeKey !== requestTypeKey) return false;
      }
      // A section whose every field is hidden is not shown (its values may still be prefilled and saved).
      return g.fields.some((f) => !f.hidden);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declarations.fields, record, requestTypeKey, (groupIds || []).join('|')]);

  const allFields = useMemo<ExtensionFieldDef[]>(
    () => applicableGroups.flatMap((g) => g.fields),
    [applicableGroups]
  );
  const needsSettings = allFields.some((f) => f.optionsFrom);
  const settingsValues = useExtensionSettingsValues(needsSettings);

  // Seed declared defaults once so formulas and required checks see them.
  useEffect(() => {
    if (!allFields.length) return;
    const seeded = { ...values };
    let changed = false;
    for (const field of allFields) {
      if (seeded[field.key] === undefined && field.default !== undefined && !field.formula) {
        seeded[field.key] = field.default === 'today' ? localDay() : field.default;
        changed = true;
      }
    }
    if (changed) onChange(withFormulas(allFields, seeded));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFields]);

  if (!applicableGroups.length) return null;

  const applyChange = (key: string, val: unknown) => {
    onChange(withFormulas(allFields, { ...values, [key]: val }));
  };

  const handleFieldChange = (key: string, val: unknown) => {
    const before = values[key];
    const ask = confirms.find(
      (c) => c.field === key && String(val ?? '') === c.value && String(before ?? '') !== c.value
    );
    if (!ask) {
      applyChange(key, val);
      return;
    }
    void confirm({ title: ask.title || 'Please confirm', message: ask.message, confirmLabel: 'Continue', cancelLabel: 'Keep as it was' }).then(
      (ok) => {
        if (ok) applyChange(key, val);
      }
    );
  };

  // Facts and the countCheck notice shown at the top of a group.
  const groupFacts = (group: ExtensionFieldGroup) => {
    const shown = facts.filter((f) => f.group === group.id || (group.countCheck && f.key === group.countCheck.actualFact));
    const notice = disabled ? null : countCheckNotice(group, values, facts);
    if (!shown.length && !notice) return null;
    return (
      <div className="mb-4 flex flex-col gap-2" data-testid="extension-group-facts">
        {shown.length ? (
          <div className="flex flex-wrap gap-2">
            {shown.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {f.label}: <strong className="font-semibold text-zinc-950 dark:text-zinc-50">{f.value}</strong>
              </span>
            ))}
          </div>
        ) : null}
        {notice ? (
          <p role="status" data-tone={notice.tone} className={`m-0 rounded-lg border px-3 py-2 text-xs ${NOTICE_CLASS[notice.tone] || NOTICE_CLASS.info}`}>
            {notice.text}
          </p>
        ) : null}
      </div>
    );
  };

  // CRM 3.43.1: a typed name is kept only when it really joined the options list (see addSettingOption).
  const handleAddOptionForField = async (field: ExtensionFieldDef, newVal: string) => {
    const result = await addSettingOption({
      extensionId: extension.id,
      settingKey: settingKeyOf(field),
      name: newVal,
      label: field.label,
      settingsValues,
      canManageSettings: hasPermission(SETTINGS_MANAGE),
    });
    if (result.ok) {
      handleFieldChange(field.key, result.value);
      return;
    }
    if (!OPTION_TYPES.has(field.type)) {
      handleFieldChange(field.key, newVal); // free-text field: suggestions only
      return;
    }
    notify.error(result.message);
  };

  const renderFields = (group: ExtensionFieldGroup) => (
    <div className="grid grid-cols-12 gap-4">
      {group.fields
        .filter((field) => !field.hidden)
        .map((field) => (
          <div key={field.key} className={fieldWidthClass(field)}>
            <ExtensionFieldInput
              field={field.optionsFrom ? { ...field, options: resolveFieldOptions(field, settingsValues) } : field}
              value={values[field.key] !== undefined ? values[field.key] : field.formula ? null : field.default}
              onChange={(val) => handleFieldChange(field.key, val)}
              onAddOption={(newVal) => void handleAddOptionForField(field, newVal)}
              disabled={disabled}
              readOnly={Boolean(field.readOnly || field.formula)}
              currencySymbol={currencySymbol}
              values={values}
            />
          </div>
        ))}
    </div>
  );

  const hint =
    disabled && disabledHint ? (
      <p className="m-0 mb-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        {disabledHint}
      </p>
    ) : null;

  if (variant === 'numbered') {
    return (
      <>
        {applicableGroups.map((group, index) => {
          // Done: something entered and no required field left empty.
          const visible = group.fields.filter((f) => !f.hidden);
          const filled = visible.some((f) => {
            const v = values[f.key];
            return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);
          });
          const done = !disabled && filled && !missingRequiredFields([group], values).length;
          return (
            <section
              key={group.id}
              data-testid="extension-create-section"
              className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="p-5 pb-3 border-b border-zinc-100 flex items-center gap-3 dark:border-zinc-800">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    done
                      ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'border border-zinc-300 text-zinc-700 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {done ? <Check className="h-4 w-4 stroke-[2.5]" /> : startIndex + index}
                </div>
                <h2 className="text-[15px] font-semibold text-zinc-950 m-0 min-w-0 break-words dark:text-zinc-50">
                  {group.sectionLabel}
                </h2>
              </div>
              <div className="p-5">
                {hint}
                {groupFacts(group)}
                {renderFields(group)}
              </div>
            </section>
          );
        })}
      </>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      {applicableGroups.map((group) => (
        <section
          key={group.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <h3 className="m-0 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{group.sectionLabel}</h3>
          </div>
          {hint}
          {groupFacts(group)}
          {renderFields(group)}
        </section>
      ))}
    </div>
  );
};
