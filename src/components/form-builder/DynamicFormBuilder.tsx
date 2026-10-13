import React, { useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { SwapDropGrid } from '../dndkit';
import {
  REQUEST_FIELD_TYPE_OPTIONS,
  emptyRequestTypeField,
  makeLocalId,
  needsOptions,
  slugifyFieldKey,
  type RequestFieldType,
  type RequestTypeField,
  type RequestTypeOption,
} from '../../types/request-types';

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500';

export interface DynamicFormBuilderProps {
  fields: RequestTypeField[];
  onChange: (fields: RequestTypeField[]) => void;
  /** When true, show Qualification Match controls per field. */
  showMatchConfig?: boolean;
  disabled?: boolean;
}

function FieldEditor({
  field,
  onSave,
  onCancel,
  showMatchConfig,
}: {
  field: RequestTypeField;
  onSave: (field: RequestTypeField) => void;
  onCancel: () => void;
  showMatchConfig?: boolean;
}) {
  const [draft, setDraft] = useState<RequestTypeField>({ ...field, options: [...(field.options || [])] });
  const [optionDraft, setOptionDraft] = useState('');

  const addOption = () => {
    const label = optionDraft.trim();
    if (!label) return;
    if (draft.options.some((o) => o.value.toLowerCase() === label.toLowerCase())) return;
    const option: RequestTypeOption = { id: makeLocalId('opt'), label, value: label };
    setDraft({
      ...draft,
      options: [...draft.options, option],
      matchValues: draft.matchEnabled
        ? Array.from(new Set([...(draft.matchValues || []), label]))
        : draft.matchValues,
    });
    setOptionDraft('');
  };

  const moveOption = (from: number, to: number) => {
    if (to < 0 || to >= draft.options.length) return;
    const next = [...draft.options];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setDraft({ ...draft, options: next });
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-300 bg-zinc-50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Field label</span>
          <input
            className={inputClass}
            value={draft.label}
            onChange={(e) => {
              const label = e.target.value;
              const nextKey =
                !field.key || field.key === slugifyFieldKey(field.label)
                  ? slugifyFieldKey(label)
                  : draft.key;
              setDraft({ ...draft, label, key: nextKey });
            }}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Internal field key (stable)</span>
          <input
            className={`${inputClass} font-mono text-xs`}
            value={draft.key}
            onChange={(e) => setDraft({ ...draft, key: slugifyFieldKey(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Field type</span>
          <select
            className={inputClass}
            value={draft.type}
            onChange={(e) =>
              setDraft({
                ...draft,
                type: e.target.value as RequestFieldType,
                options: needsOptions(e.target.value as RequestFieldType) ? draft.options : [],
              })
            }
          >
            {REQUEST_FIELD_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-end gap-2 pb-1 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            checked={draft.required}
            onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
          />
          Required
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Placeholder</span>
          <input
            className={inputClass}
            value={draft.placeholder}
            onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Help text</span>
          <input
            className={inputClass}
            value={draft.helpText}
            onChange={(e) => setDraft({ ...draft, helpText: e.target.value })}
          />
        </label>
      </div>

      {(draft.type === 'number' || draft.key === 'budget') && (
        <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-blue-900">
              Amount Limits (Commercial Requirement Bounds)
            </span>
            {draft.key === 'budget' ? (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                Required Budget Field
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Minimum Amount</span>
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder="e.g. 10000 (No minimum if empty)"
                value={draft.minAmount ?? draft.matchNumberMin ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  setDraft({
                    ...draft,
                    minAmount: val,
                    matchNumberMin: val,
                  });
                }}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Maximum Amount</span>
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder="e.g. 500000 (No maximum if empty)"
                value={draft.maxAmount ?? draft.matchNumberMax ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  setDraft({
                    ...draft,
                    maxAmount: val,
                    matchNumberMax: val,
                  });
                }}
              />
            </label>
          </div>
          <p className="m-0 text-[11px] text-zinc-500">
            When users fill the Commercial Requirement form, they can only enter an amount between this minimum and maximum.
          </p>
        </div>
      )}

      {needsOptions(draft.type) && (
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-600">
            Options
          </div>
          <div className="mb-2 flex gap-2">
            <input
              className={inputClass}
              value={optionDraft}
              placeholder="Add option"
              onChange={(e) => setOptionDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOption();
                }
              }}
            />
            <button
              type="button"
              onClick={addOption}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white"
            >
              <AddIcon sx={{ fontSize: 14 }} /> Add
            </button>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {draft.options.map((opt, index) => (
              <li
                key={opt.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5"
              >
                <span className="flex-1 text-xs font-semibold text-zinc-800">{opt.label}</span>
                <button
                  type="button"
                  className="text-[10px] font-semibold text-zinc-500"
                  onClick={() => moveOption(index, index - 1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-[10px] font-semibold text-zinc-500"
                  onClick={() => moveOption(index, index + 1)}
                  disabled={index === draft.options.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      options: draft.options.filter((o) => o.id !== opt.id),
                      matchValues: (draft.matchValues || []).filter(
                        (v) => v.toLowerCase() !== opt.value.toLowerCase()
                      ),
                    })
                  }
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showMatchConfig && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
          <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-zinc-800">
            <input
              type="checkbox"
              checked={draft.matchEnabled}
              onChange={(e) => setDraft({ ...draft, matchEnabled: e.target.checked })}
            />
            Include in Qualification Match score
          </label>
          {draft.matchEnabled && draft.type === 'number' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={labelClass}>Supported min</span>
                <input
                  type="number"
                  className={inputClass}
                  value={draft.matchNumberMin ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      matchNumberMin: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Supported max</span>
                <input
                  type="number"
                  className={inputClass}
                  value={draft.matchNumberMax ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      matchNumberMax: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          ) : null}
          {draft.matchEnabled && draft.type !== 'number' && needsOptions(draft.type) ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.options.map((opt) => {
                const checked = (draft.matchValues || []).some(
                  (v) => v.toLowerCase() === opt.value.toLowerCase()
                );
                return (
                  <label
                    key={opt.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? (draft.matchValues || []).filter(
                              (v) => v.toLowerCase() !== opt.value.toLowerCase()
                            )
                          : [...(draft.matchValues || []), opt.value];
                        setDraft({ ...draft, matchValues: next });
                      }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (!draft.label.trim()) return;
            if (!draft.key.trim()) return;
            if (needsOptions(draft.type) && draft.options.length < 1) return;
            const minAmt = draft.minAmount ?? draft.matchNumberMin ?? null;
            const maxAmt = draft.maxAmount ?? draft.matchNumberMax ?? null;
            onSave({
              ...draft,
              label: draft.label.trim(),
              key: draft.key === 'budget' ? 'budget' : slugifyFieldKey(draft.key),
              type: draft.key === 'budget' ? 'number' : draft.type,
              required: draft.key === 'budget' ? true : draft.required,
              minAmount: minAmt,
              maxAmount: maxAmt,
              matchNumberMin: minAmt,
              matchNumberMax: maxAmt,
            });
          }}
          className="inline-flex h-9 items-center rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white"
        >
          Apply field
        </button>
      </div>
    </div>
  );
}

export const DynamicFormBuilder: React.FC<DynamicFormBuilderProps> = ({
  fields,
  onChange,
  showMatchConfig = true,
  disabled = false,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingField = useMemo(
    () => fields.find((f) => f.id === editingId) || null,
    [fields, editingId]
  );

  const swapFields = (from: number, to: number) => {
    const next = [...fields];
    const tmp = next[from];
    next[from] = next[to];
    next[to] = tmp;
    onChange(next);
  };

  const addField = () => {
    const field = emptyRequestTypeField({ label: `Field ${fields.length + 1}` });
    onChange([...fields, field]);
    setEditingId(field.id);
  };

  return (
    <div className="space-y-3" data-tour="dynamic-form-builder">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="m-0 text-sm font-bold text-zinc-950">Form fields</h4>
          <p className="mb-0 mt-0.5 text-[11px] text-zinc-500">
            Drag to reorder. Every request type form includes a mandatory Budget field.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={addField}
          className="inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          <AddIcon sx={{ fontSize: 16 }} /> Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500">
          No fields yet. Add text, number, select, radio, or multi-select fields.
        </p>
      ) : (
        <SwapDropGrid
          items={fields}
          onSwap={swapFields}
          label="Request type fields"
          className="flex flex-col gap-2"
          renderItem={(item, index, ctx) => (
            <div
              ref={ctx.setNodeRef}
              style={ctx.style}
              className={`rounded-xl border bg-white p-3 ${
                ctx.isOver ? 'border-slate-900 ring-2 ring-slate-900/15' : 'border-zinc-200'
              }`}
            >
              {editingId === item.id && editingField ? (
                <FieldEditor
                  field={editingField}
                  showMatchConfig={showMatchConfig}
                  onCancel={() => setEditingId(null)}
                  onSave={(next) => {
                    const keys = new Set(
                      fields.filter((f) => f.id !== next.id).map((f) => f.key.toLowerCase())
                    );
                    let key = next.key;
                    let n = 2;
                    while (keys.has(key.toLowerCase())) {
                      key = `${next.key}_${n}`;
                      n += 1;
                    }
                    onChange(fields.map((f) => (f.id === next.id ? { ...next, key } : f)));
                    setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      className="mt-0.5 inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 active:cursor-grabbing disabled:opacity-40"
                      {...ctx.attributes}
                      {...ctx.listeners}
                    >
                      <DragIndicatorIcon sx={{ fontSize: 18 }} />
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-950">
                          {index + 1}. {item.label}
                        </span>
                        {item.required ? (
                          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            Required
                          </span>
                        ) : null}
                        {item.key === 'budget' ? (
                          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            Required Budget
                          </span>
                        ) : null}
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                          {item.type}
                        </span>
                        {(item.minAmount != null || item.maxAmount != null || item.matchNumberMin != null || item.matchNumberMax != null) ? (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200 font-mono">
                            Range: ₹{(item.minAmount ?? item.matchNumberMin)?.toLocaleString() ?? '0'} – ₹{(item.maxAmount ?? item.matchNumberMax)?.toLocaleString() ?? '∞'}
                          </span>
                        ) : null}
                      </div>
                      <p className="mb-0 mt-0.5 font-mono text-[10px] text-zinc-400">key: {item.key}</p>
                      {item.helpText ? (
                        <p className="mb-0 mt-1 text-[11px] text-zinc-500">{item.helpText}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setEditingId(item.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-700 disabled:opacity-40"
                    >
                      <EditOutlinedIcon sx={{ fontSize: 14 }} /> Edit
                    </button>
                    {item.key === 'budget' ? (
                      <span
                        title="Budget is a mandatory field for every request type"
                        className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-[10px] font-medium text-zinc-400 select-none"
                      >
                        Mandatory
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(fields.filter((f) => f.id !== item.id))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-100 bg-white px-2 text-[11px] font-semibold text-red-600 disabled:opacity-40"
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
};
