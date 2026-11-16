import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Database, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ExtensionFieldInput } from './ExtensionFieldInput';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { useDialog } from '../../context/DialogContext';
import { extensionDataApi } from '../../services/extensionDataApi';
import type {
  ExtensionFieldDef,
  ExtensionModelDef,
  ExtensionRecordType,
  ExtensionTabDef,
} from '../../types/extensions';

/**
 * Generic "records" tab for any CRM workspace extension (tabs.json kind "records").
 *
 * Lists rows of one of the extension's JSON models that are linked to the record
 * being viewed (client, lead, opportunity, ticket) and lets users with the
 * model's write permission add, edit and delete them. The form is built from
 * the model's declared fields; the link field is filled with the current record
 * id automatically and is not shown. Nothing here is specific to an extension.
 *
 * API: /x/<id>/_models/<Model> (contract §9). Deletes are soft on the server.
 */

type Row = Record<string, unknown> & { _id?: string };
type ModelField = ExtensionModelDef['fields'][number];

const READ_DEFAULT = 'crm.dashboard.view';
const WRITE_DEFAULT = 'crm.settings.manage';

/** Model fields include `json` and `ref`; render them with the closest declared input. */
function toInputField(field: ModelField): ExtensionFieldDef {
  const base = field as Partial<ExtensionFieldDef> & { key: string; label: string; required?: boolean };
  const rawType = String((field as { type?: string }).type || 'text');
  const type = rawType === 'ref' ? 'text' : rawType === 'json' ? 'textarea' : rawType;
  return {
    key: base.key,
    label: base.label || base.key,
    type: type as ExtensionFieldDef['type'],
    required: Boolean(base.required),
    placeholder: rawType === 'json' ? '{ }' : base.placeholder || '',
    helpText: rawType === 'json' ? 'JSON value' : base.helpText || '',
    options: Array.isArray(base.options) ? base.options : [],
    default: base.default,
    min: base.min,
    max: base.max,
    showInList: Boolean(base.showInList),
  };
}

function display(field: ModelField | undefined, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field?.type === 'json' || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (field?.type === 'currency' && typeof value === 'number') return value.toLocaleString();
  if ((field?.type === 'date' || /At$/.test(String(field?.key || ''))) && typeof value === 'string' && value.length > 10) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return String(value);
}

function emptyValues(fields: ExtensionFieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.default !== undefined && field.default !== null) {
      out[field.key] = field.default === 'today' ? new Date().toISOString().slice(0, 10) : field.default;
    } else if (field.type === 'checkbox') out[field.key] = false;
    else if (field.type === 'multiselect') out[field.key] = [];
    else out[field.key] = '';
  }
  return out;
}

interface Props {
  tab: ExtensionTabDef;
  record: ExtensionRecordType;
  recordId: string;
}

export const ExtensionRecordsTab: React.FC<Props> = ({ tab, record, recordId }) => {
  const { backend, canUse } = useActiveExtension();
  const { confirm } = useDialog();
  const modelDef = backend?.models?.find((m) => m.name === tab.model) || null;
  const linkField = tab.linkField || `${record}_id`;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const fieldsByKey = useMemo(
    () => new Map<string, ModelField>((modelDef?.fields || []).map((f) => [f.key, f])),
    [modelDef]
  );
  const formFields = useMemo(
    () => (modelDef?.fields || []).filter((f) => f.key !== linkField).map(toInputField),
    [modelDef, linkField]
  );
  const columns = tab.columns && tab.columns.length ? tab.columns : (modelDef?.fields || []).slice(0, 4).map((f) => f.key);
  const canWrite = Boolean(modelDef) && canUse(modelDef?.permissions?.write || WRITE_DEFAULT);
  const canRead = Boolean(modelDef) && canUse(modelDef?.permissions?.read || READ_DEFAULT);

  const load = useCallback(async () => {
    if (!backend?.apiBase || !modelDef || !recordId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await extensionDataApi.getModelRows(backend.apiBase, modelDef.name, {
        [linkField]: recordId,
        limit: 200,
      } as Record<string, string | number>);
      setRows((res.items || []) as Row[]);
      setTotal(Number(res.total || 0));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load records');
    } finally {
      setLoading(false);
    }
  }, [backend?.apiBase, modelDef, linkField, recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setFormErrors([]);
    setValues(emptyValues(formFields));
    setEditing('new');
  };

  const openEdit = (row: Row) => {
    setFormErrors([]);
    const next: Record<string, unknown> = {};
    for (const field of formFields) {
      const raw = row[field.key];
      next[field.key] =
        fieldsByKey.get(field.key)?.type === 'json' && raw !== undefined && raw !== null
          ? JSON.stringify(raw, null, 2)
          : raw ?? (field.type === 'checkbox' ? false : field.type === 'multiselect' ? [] : '');
    }
    setValues(next);
    setEditing(row);
  };

  /** Only send what the user can change; empty strings become null; JSON text is parsed. */
  const buildPayload = (): { payload: Record<string, unknown>; errors: string[] } => {
    const payload: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const field of formFields) {
      let value = values[field.key];
      if (fieldsByKey.get(field.key)?.type === 'json') {
        if (typeof value === 'string' && value.trim()) {
          try {
            value = JSON.parse(value);
          } catch {
            errors.push(`${field.label} is not valid JSON`);
            continue;
          }
        } else if (value === '') value = null;
      }
      if (value === '') value = null;
      if (field.required && (value === null || value === undefined || (Array.isArray(value) && !value.length))) {
        errors.push(`${field.label} is required`);
      }
      payload[field.key] = value;
    }
    if (editing === 'new') payload[linkField] = recordId;
    return { payload, errors };
  };

  const save = async () => {
    if (!backend?.apiBase || !modelDef || !editing) return;
    const { payload, errors } = buildPayload();
    if (errors.length) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    setFormErrors([]);
    try {
      if (editing === 'new') {
        await extensionDataApi.createModelRow(backend.apiBase, modelDef.name, payload);
      } else if (editing._id) {
        await extensionDataApi.updateModelRow(backend.apiBase, modelDef.name, String(editing._id), payload);
      }
      setEditing(null);
      await load();
    } catch (err) {
      const details = (err as { details?: unknown }).details;
      setFormErrors(
        Array.isArray(details) && details.length
          ? details.map(String)
          : [err instanceof Error ? err.message : 'Could not save']
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!backend?.apiBase || !modelDef || !row._id) return;
    const title = modelDef.titleField ? display(fieldsByKey.get(modelDef.titleField), row[modelDef.titleField]) : '';
    const ok = await confirm({
      title: `Delete ${modelDef.label || modelDef.name}${title && title !== '—' ? ` "${title}"` : ''}?`,
      message: 'It is removed from this list. The record is kept in the database and can be restored by an administrator.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    try {
      await extensionDataApi.deleteModelRow(backend.apiBase, modelDef.name, String(row._id));
      await load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not delete');
    }
  };

  const heading = tab.label || modelDef?.pluralLabel || tab.model || 'Records';

  if (!modelDef) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-6 text-center text-xs text-zinc-500">
        This tab refers to the model “{tab.model}”, which the active extension does not declare.
      </div>
    );
  }
  if (!canRead) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-6 text-center text-xs text-zinc-500">
        You do not have permission to view {modelDef.pluralLabel || modelDef.name}.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-600" aria-hidden />
          <h3 className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{heading}</h3>
          {!loading && !loadError && <span className="text-[11px] text-zinc-400">{total}</span>}
        </div>
        {canWrite && editing === null && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border-0 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add {modelDef.label || modelDef.name}
          </button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="m-0 text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {editing === 'new' ? `New ${modelDef.label || modelDef.name}` : `Edit ${modelDef.label || modelDef.name}`}
            </h4>
            <button
              type="button"
              onClick={() => setEditing(null)}
              aria-label="Close form"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-0 bg-transparent text-zinc-500 hover:bg-zinc-100 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {formFields.map((field) => (
              <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                <ExtensionFieldInput
                  field={field}
                  value={values[field.key]}
                  onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
          {formErrors.length > 0 && (
            <ul className="m-0 mt-3 list-disc space-y-0.5 pl-5 text-[11px] text-rose-700">
              {formErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={saving}
              className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex h-8 items-center rounded-lg border-0 bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {loadError ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{loadError}</span>
        </div>
      ) : loading ? (
        <div className="py-8 text-center text-xs text-zinc-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-400">
          No {(modelDef.pluralLabel || modelDef.name).toLowerCase()} yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase text-zinc-500 dark:border-zinc-800">
                {columns.map((key) => (
                  <th key={key} className="px-3 py-2.5">
                    {fieldsByKey.get(key)?.label || (key === 'createdAt' ? 'Created' : key === 'updatedAt' ? 'Updated' : key)}
                  </th>
                ))}
                {canWrite && <th className="w-20 px-3 py-2.5" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((row, index) => (
                <tr key={String(row._id || index)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  {columns.map((key) => (
                    <td key={key} className="px-3 py-2.5 text-zinc-800 dark:text-zinc-200">
                      {display(fieldsByKey.get(key) || ({ key } as ModelField), row[key])}
                    </td>
                  ))}
                  {canWrite && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          aria-label="Edit"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-0 bg-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(row)}
                          aria-label="Delete"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-0 bg-transparent text-zinc-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
