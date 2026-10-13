import React, { useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import {
  isSelectableFieldType,
  type DynamicFieldValues,
  type LeadCustomFieldOptions,
  type RequestTypeField,
  type RequestTypeOption,
} from '../../types/request-types';
import { AddLeadFieldOptionModal } from './AddLeadFieldOptionModal';

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:bg-zinc-50';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';

export interface DynamicFormRendererProps {
  fields: RequestTypeField[];
  values: DynamicFieldValues;
  onChange: (values: DynamicFieldValues) => void;
  disabled?: boolean;
  /** Lead-specific options keyed by field.key (shown only on this lead). */
  leadCustomOptions?: LeadCustomFieldOptions;
  /** Enable + Add New for select / multi-select / radio fields. */
  allowLeadCustomOptions?: boolean;
  /** Admin can promote new option into the Request Type global catalog. */
  canPromoteGlobal?: boolean;
  onAddLeadOption?: (payload: {
    fieldKey: string;
    label: string;
    value: string;
    addToGlobalCatalog: boolean;
  }) => Promise<void> | void;
  /** Request Type top-level budget bounds */
  minBudget?: number | null;
  maxBudget?: number | null;
}

function toggleMulti(list: string[], value: string): string[] {
  const key = value.toLowerCase();
  if (list.some((v) => v.toLowerCase() === key)) {
    return list.filter((v) => v.toLowerCase() !== key);
  }
  return [...list, value];
}

function mergeFieldOptions(
  field: RequestTypeField,
  leadCustomOptions?: LeadCustomFieldOptions,
  currentValue?: string | number | string[] | null
): Array<RequestTypeOption & { leadSpecific?: boolean }> {
  const global = Array.isArray(field.options) ? field.options : [];
  const leadList = leadCustomOptions?.[field.key] || [];
  const merged: Array<RequestTypeOption & { leadSpecific?: boolean }> = global.map((o) => ({
    ...o,
    leadSpecific: false,
  }));
  for (const item of leadList) {
    const value = String(item.value || item.label || '').trim();
    const label = String(item.label || item.value || '').trim() || value;
    if (!value) continue;
    if (merged.some((o) => o.value.toLowerCase() === value.toLowerCase())) continue;
    merged.push({
      id: `lead_opt_${field.key}_${value}`,
      label,
      value,
      leadSpecific: true,
    });
  }
  // Keep currently selected values visible even if they only exist as lead-scoped options
  // that were not yet merged, or were saved before catalog refresh.
  const selected = Array.isArray(currentValue)
    ? currentValue.map(String)
    : currentValue != null && currentValue !== ''
      ? [String(currentValue)]
      : [];
  for (const raw of selected) {
    const value = raw.trim();
    if (!value) continue;
    if (merged.some((o) => o.value.toLowerCase() === value.toLowerCase())) continue;
    merged.push({
      id: `selected_opt_${field.key}_${value}`,
      label: value,
      value,
      leadSpecific: true,
    });
  }
  return merged;
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  fields,
  values,
  onChange,
  disabled = false,
  leadCustomOptions,
  allowLeadCustomOptions = false,
  canPromoteGlobal = false,
  onAddLeadOption,
  minBudget,
  maxBudget,
}) => {
  const [addForField, setAddForField] = useState<RequestTypeField | null>(null);

  const setValue = (key: string, value: string | number | string[] | null) => {
    onChange({ ...values, [key]: value });
  };

  const optionsByKey = useMemo(() => {
    const map: Record<string, Array<RequestTypeOption & { leadSpecific?: boolean }>> = {};
    for (const field of fields) {
      if (!isSelectableFieldType(field.type)) continue;
      map[field.key] = mergeFieldOptions(field, leadCustomOptions, values[field.key]);
    }
    return map;
  }, [fields, leadCustomOptions, values]);

  if (!fields.length) {
    return (
      <p className="m-0 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500">
        This request type has no form fields configured yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-tour="dynamic-form-renderer">
      {fields.map((field) => {
        const value = values[field.key];
        const selectable = isSelectableFieldType(field.type);
        const options = optionsByKey[field.key] || field.options || [];
        const showAddNew = allowLeadCustomOptions && selectable && !disabled && onAddLeadOption;

        const isBudget = field.key === 'budget' || field.label.trim().toLowerCase() === 'budget';
        const effMin = field.minAmount ?? field.matchNumberMin ?? (isBudget ? minBudget : null);
        const effMax = field.maxAmount ?? field.matchNumberMax ?? (isBudget ? maxBudget : null);
        const numVal = value == null || value === '' ? null : Number(value);
        const isBelowMin = effMin != null && numVal != null && numVal < effMin;
        const isAboveMax = effMax != null && numVal != null && numVal > effMax;
        const hasRangeError = isBelowMin || isAboveMax;

        return (
          <div
            key={field.id || field.key}
            className={field.type === 'multiselect' || field.type === 'radio' ? 'md:col-span-2' : ''}
          >
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={labelClass + ' mb-0'}>
                  {field.label}
                  {field.required ? <span className="text-red-600"> *</span> : null}
                </span>
                {field.type === 'number' && (effMin != null || effMax != null) ? (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200/80 font-mono">
                    {effMin != null && effMax != null
                      ? `Allowed: ₹${effMin.toLocaleString()} – ₹${effMax.toLocaleString()}`
                      : effMin != null
                        ? `Min: ₹${effMin.toLocaleString()}`
                        : effMax != null
                          ? `Max: ₹${effMax.toLocaleString()}`
                          : ''}
                  </span>
                ) : null}
              </div>
              {showAddNew ? (
                <button
                  type="button"
                  onClick={() => setAddForField(field)}
                  className="inline-flex h-7 items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                >
                  <AddIcon sx={{ fontSize: 14 }} /> Add New
                </button>
              ) : null}
            </div>

            <label className="block">
              {field.type === 'text' && (
                <input
                  className={inputClass}
                  disabled={disabled}
                  placeholder={field.placeholder}
                  value={typeof value === 'string' ? value : value == null ? '' : String(value)}
                  onChange={(e) => setValue(field.key, e.target.value)}
                />
              )}

              {field.type === 'number' && (
                <div className="space-y-1">
                  <input
                    type="number"
                    min={effMin != null ? effMin : undefined}
                    max={effMax != null ? effMax : undefined}
                    className={`${inputClass} ${
                      hasRangeError
                        ? 'border-red-500 bg-red-50/20 text-red-950 focus:border-red-600 focus:ring-1 focus:ring-red-600'
                        : ''
                    }`}
                    disabled={disabled}
                    placeholder={
                      field.placeholder ||
                      (effMin != null && effMax != null
                        ? `Enter amount between ₹${effMin.toLocaleString()} and ₹${effMax.toLocaleString()}`
                        : effMin != null
                          ? `Enter amount (min ₹${effMin.toLocaleString()})`
                          : effMax != null
                            ? `Enter amount (max ₹${effMax.toLocaleString()})`
                            : 'Enter number')
                    }
                    value={value == null || value === '' ? '' : Number(value)}
                    onChange={(e) =>
                      setValue(field.key, e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                  {hasRangeError && (
                    <p className="m-0 text-[11px] font-semibold text-red-600 flex items-center gap-1">
                      <span>⚠</span>
                      {isBelowMin
                        ? `Amount must be at least ₹${effMin!.toLocaleString()}. Current: ₹${numVal!.toLocaleString()}`
                        : `Amount cannot exceed ₹${effMax!.toLocaleString()}. Current: ₹${numVal!.toLocaleString()}`}
                    </p>
                  )}
                  {(effMin != null || effMax != null) && !hasRangeError && (
                    <p className="m-0 text-[10px] text-zinc-500">
                      Amount must be between{' '}
                      {effMin != null ? `₹${effMin.toLocaleString()}` : '₹0'} and{' '}
                      {effMax != null ? `₹${effMax.toLocaleString()}` : 'unlimited'}.
                    </p>
                  )}
                </div>
              )}

              {field.type === 'select' && (
                <select
                  className={inputClass}
                  disabled={disabled}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                >
                  <option value="">{field.placeholder || 'Select…'}</option>
                  {options.map((opt) => (
                    <option key={opt.id} value={opt.value}>
                      {opt.label}
                      {opt.leadSpecific ? ' (this lead)' : ''}
                    </option>
                  ))}
                </select>
              )}

              {field.type === 'radio' && (
                <div className="flex flex-wrap gap-3">
                  {options.map((opt) => (
                    <label
                      key={opt.id}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700"
                    >
                      <input
                        type="radio"
                        name={`dyn_${field.key}`}
                        disabled={disabled}
                        checked={String(value || '') === opt.value}
                        onChange={() => setValue(field.key, opt.value)}
                      />
                      {opt.label}
                      {opt.leadSpecific ? (
                        <span className="rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">
                          lead
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'multiselect' && (
                <div className="flex flex-wrap gap-2">
                  {options.map((opt) => {
                    const selected = Array.isArray(value)
                      ? value.some((v) => String(v).toLowerCase() === opt.value.toLowerCase())
                      : false;
                    return (
                      <label
                        key={opt.id}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          selected
                            ? 'border-zinc-950 bg-zinc-950 text-white'
                            : opt.leadSpecific
                              ? 'border-amber-200 bg-amber-50 text-amber-900'
                              : 'border-zinc-200 bg-white text-zinc-700'
                        } ${disabled ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          disabled={disabled}
                          checked={selected}
                          onChange={() =>
                            setValue(
                              field.key,
                              toggleMulti(Array.isArray(value) ? value.map(String) : [], opt.value)
                            )
                          }
                        />
                        {opt.label}
                        {opt.leadSpecific && !selected ? (
                          <span className="text-[9px] uppercase opacity-80">lead</span>
                        ) : null}
                      </label>
                    );
                  })}
                  {!options.length ? (
                    <span className="text-[11px] text-zinc-500">
                      No options yet — use + Add New to create one for this lead.
                    </span>
                  ) : null}
                </div>
              )}
            </label>
            {field.helpText ? (
              <p className="mb-0 mt-1 text-[11px] text-zinc-500">{field.helpText}</p>
            ) : null}
          </div>
        );
      })}

      <AddLeadFieldOptionModal
        open={Boolean(addForField)}
        fieldLabel={addForField?.label || 'Field'}
        canPromoteGlobal={canPromoteGlobal}
        onClose={() => setAddForField(null)}
        onSave={async ({ label, value, addToGlobalCatalog }) => {
          if (!addForField || !onAddLeadOption) return;
          await onAddLeadOption({
            fieldKey: addForField.key,
            label,
            value,
            addToGlobalCatalog,
          });
        }}
      />
    </div>
  );
};
