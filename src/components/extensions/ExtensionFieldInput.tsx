import React, { useId } from 'react';
import type { ExtensionFieldDef } from '../../types/extensions';
import { SearchableSelect } from '../common/SearchableSelect';
import { dateBounds } from '../../utils/extensionFieldLogic';

interface ExtensionFieldInputProps {
  field: ExtensionFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onAddOption?: (newVal: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Symbol shown in currency fields (e.g. the record's currency); ₹ when not given. */
  currencySymbol?: string;
  /** The record's values, for date rules against other fields (minField / maxField). */
  values?: Record<string, unknown>;
}

const inputCls =
  'w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:bg-zinc-50 dark:disabled:bg-zinc-950 transition-colors';

const labelCls = 'block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5';

export const ExtensionFieldInput: React.FC<ExtensionFieldInputProps> = ({
  field,
  value,
  onChange,
  onAddOption,
  disabled = false,
  readOnly = false,
  currencySymbol,
  values,
}) => {
  const isInteractive = !disabled && !readOnly;
  // Unique per rendered field so the label points at its own input (the same key may appear twice on a page).
  const inputId = `ext-field-${useId().replace(/:/g, '')}`;
  const labelId = `${inputId}-label`;

  const renderInput = () => {
    if (field.searchable && field.type !== 'select') {
      if (!isInteractive) {
        return (
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={true}
            id={inputId}
            className={inputCls}
          >
            <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}`}</option>
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label || opt.value}
              </option>
            ))}
            {typeof value === 'string' && value && !(field.options || []).some((opt) => opt.value === value) && (
              <option value={value}>{value}</option>
            )}
          </select>
        );
      }
      return (
        <SearchableSelect
          options={field.options || []}
          value={typeof value === 'string' ? value : ''}
          onChange={(val) => onChange(val)}
          onAddOption={onAddOption}
          placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`}
          disabled={disabled}
          readOnly={readOnly}
          required={field.required}
          id={inputId}
        />
      );
    }

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            id={inputId}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isInteractive}
            readOnly={readOnly}
            placeholder={field.placeholder || undefined}
            rows={3}
            className={inputCls}
          />
        );

      case 'number':
      case 'currency':
        return (
          <div className="relative">
            {field.type === 'currency' && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 select-none">
                {currencySymbol || '₹'}
              </span>
            )}
            <input
              id={inputId}
              type="number"
              value={value !== undefined && value !== null ? String(value) : ''}
              onChange={(e) => {
                const val = e.target.value;
                onChange(val === '' ? null : Number(val));
              }}
              disabled={!isInteractive}
              readOnly={readOnly}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder || undefined}
              className={`${inputCls} ${field.type === 'currency' ? 'pl-7' : ''}`}
            />
          </div>
        );

      case 'date': {
        // Days the field may take (minDate / minField / maxField); the server checks the same rules.
        const bounds = isInteractive ? dateBounds(field, values) : {};
        return (
          <input
            id={inputId}
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isInteractive}
            readOnly={readOnly}
            min={bounds.min}
            max={bounds.max}
            className={inputCls}
          />
        );
      }

      case 'checkbox':
        return (
          <label className="inline-flex items-center gap-2 cursor-pointer pt-1 select-none">
            <input
              id={inputId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={!isInteractive}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
            />
            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
              {field.placeholder || field.label}
            </span>
          </label>
        );

      case 'searchable_select':
      case 'select':
        if (!isInteractive) {
          return (
            <select
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={true}
              id={inputId}
              className={inputCls}
            >
              <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}`}</option>
              {(field.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label || opt.value}
                </option>
              ))}
              {/* A stored value that is no longer offered (e.g. removed in Settings) stays visible. */}
              {typeof value === 'string' && value && !(field.options || []).some((opt) => opt.value === value) && (
                <option value={value}>{value}</option>
              )}
            </select>
          );
        }
        return (
          <SearchableSelect
            options={field.options || []}
            value={typeof value === 'string' ? value : ''}
            onChange={(val) => onChange(val)}
            onAddOption={onAddOption}
            placeholder={field.placeholder || `Type or select ${field.label.toLowerCase()}`}
            disabled={disabled}
            readOnly={readOnly}
            required={field.required}
            id={inputId}
          />
        );

      case 'radio':
        return (
          <div className="flex flex-wrap gap-4 pt-1" role="radiogroup" aria-labelledby={labelId}>
            {(field.options || []).map((opt) => (
              <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name={`ext_field_${field.key}`}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={!isInteractive}
                  className="h-3.5 w-3.5 border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{opt.label || opt.value}</span>
              </label>
            ))}
          </div>
        );

      case 'multiselect': {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        const toggleOption = (optVal: string) => {
          if (!isInteractive) return;
          if (selected.includes(optVal)) {
            onChange(selected.filter((v) => v !== optVal));
          } else {
            onChange([...selected, optVal]);
          }
        };

        return (
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-labelledby={labelId}>
            {(field.options || []).map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  disabled={!isInteractive}
                  aria-pressed={isChecked}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    isChecked
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isChecked ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                  {opt.label || opt.value}
                </button>
              );
            })}
          </div>
        );
      }

      case 'user':
      case 'text':
      default:
        return (
          <input
            id={inputId}
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isInteractive}
            readOnly={readOnly}
            placeholder={field.placeholder || undefined}
            className={inputCls}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      {field.type !== 'checkbox' && (
        // Radio and multi-select options are groups (labelled by id); every other input is linked by htmlFor.
        <label
          id={labelId}
          className={labelCls}
          htmlFor={field.type === 'radio' || field.type === 'multiselect' ? undefined : inputId}
        >
          {field.label}
          {field.required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      {renderInput()}
      {field.helpText && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
          {field.helpText}
        </p>
      )}
    </div>
  );
};
