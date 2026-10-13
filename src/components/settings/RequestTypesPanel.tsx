import { useCallback, useEffect, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { DynamicFormBuilder } from '../form-builder/DynamicFormBuilder';
import { crmApi } from '../../services/api';
import {
  emptyRequestTypeDraft,
  ensureBudgetField,
  slugifyFieldKey,
  type RequestType,
  type RequestTypeField,
} from '../../types/request-types';

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';
const cardClass = 'rounded-xl border border-zinc-300 bg-white p-5';

type EditorMode = 'create' | 'edit' | 'catalog' | null;

type Draft = {
  id?: string;
  name: string;
  description: string;
  isEnabled: boolean;
  minBudget: number | null;
  maxBudget: number | null;
  fields: RequestTypeField[];
};

export function RequestTypesPanel() {
  const [items, setItems] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [mode, setMode] = useState<EditorMode>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RequestType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await crmApi.listRequestTypes({ includeDisabled: true });
      const list = Array.isArray(res.data) ? res.data : [];
      setItems(list);
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to load request types',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    const empty = emptyRequestTypeDraft();
    setMode('create');
    setDraft({
      ...empty,
      fields: ensureBudgetField(empty.fields, empty.minBudget, empty.maxBudget),
    });
    setMessage(null);
  };

  const openEdit = (item: RequestType) => {
    setMode('edit');
    const fieldsWithBudget = ensureBudgetField(
      (item.fields || []).map((f) => ({ ...f, options: [...(f.options || [])] })),
      item.minBudget,
      item.maxBudget
    );
    const bField = fieldsWithBudget.find((f) => f.key === 'budget');
    const minBudget = item.minBudget ?? bField?.minAmount ?? bField?.matchNumberMin ?? null;
    const maxBudget = item.maxBudget ?? bField?.maxAmount ?? bField?.matchNumberMax ?? null;

    setDraft({
      id: item._id,
      name: item.name,
      description: item.description || '',
      isEnabled: item.isEnabled !== false,
      minBudget,
      maxBudget,
      fields: fieldsWithBudget,
    });
    setMessage(null);
  };

  const openCatalog = (item: RequestType) => {
    setMode('catalog');
    const fieldsWithBudget = ensureBudgetField(
      (item.fields || []).map((f) => ({ ...f, options: [...(f.options || [])] })),
      item.minBudget,
      item.maxBudget
    );
    const bField = fieldsWithBudget.find((f) => f.key === 'budget');
    const minBudget = item.minBudget ?? bField?.minAmount ?? bField?.matchNumberMin ?? null;
    const maxBudget = item.maxBudget ?? bField?.maxAmount ?? bField?.matchNumberMax ?? null;

    setDraft({
      id: item._id,
      name: item.name,
      description: item.description || '',
      isEnabled: item.isEnabled !== false,
      minBudget,
      maxBudget,
      fields: fieldsWithBudget,
    });
    setMessage(null);
  };

  const closeEditor = () => {
    setMode(null);
    setDraft(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setMessage({ kind: 'error', text: 'Request type name is required.' });
      return;
    }
    if (draft.minBudget != null && draft.maxBudget != null && draft.minBudget > draft.maxBudget) {
      setMessage({ kind: 'error', text: 'Minimum budget cannot be greater than maximum budget.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const finalFields = ensureBudgetField(draft.fields, draft.minBudget, draft.maxBudget);
      const payload = {
        name,
        key: slugifyFieldKey(name),
        description: draft.description.trim(),
        isEnabled: draft.isEnabled,
        minBudget: draft.minBudget,
        maxBudget: draft.maxBudget,
        fields: finalFields,
      };
      if (mode === 'create') {
        await crmApi.createRequestType(payload);
        setMessage({ kind: 'success', text: 'Request type created.' });
      } else if (draft.id) {
        await crmApi.updateRequestType(draft.id, payload);
        setMessage({ kind: 'success', text: 'Request type saved.' });
      }
      closeEditor();
      await load();
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to save request type',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (item: RequestType) => {
    setSaving(true);
    try {
      await crmApi.updateRequestType(item._id, { isEnabled: !item.isEnabled });
      setMessage({
        kind: 'success',
        text: `"${item.name}" ${item.isEnabled ? 'disabled' : 'enabled'}.`,
      });
      await load();
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to update status',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if ((deleteTarget.leadCount || 0) > 0) {
      setMessage({
        kind: 'error',
        text: `Cannot delete "${deleteTarget.name}" — ${deleteTarget.leadCount} lead(s) use it. Disable it instead.`,
      });
      setDeleteTarget(null);
      return;
    }
    setSaving(true);
    try {
      await crmApi.deleteRequestType(deleteTarget._id);
      setMessage({ kind: 'success', text: `Deleted "${deleteTarget.name}".` });
      setDeleteTarget(null);
      await load();
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to delete request type',
      });
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  if (mode && draft && (mode === 'create' || mode === 'edit' || mode === 'catalog')) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
        <div className="my-6 w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
            <div>
              <h3 className="m-0 text-base font-bold text-zinc-950">
                {mode === 'create'
                  ? 'New Request Type'
                  : mode === 'catalog'
                    ? `Qualification Match — ${draft.name}`
                    : `Edit Request Type — ${draft.name}`}
              </h3>
              <p className="mb-0 mt-1 text-xs text-zinc-500">
                {mode === 'catalog'
                  ? 'Configure which field values qualify as a match for scoring.'
                  : 'Build the dynamic commercial requirement form for this request type.'}
              </p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600"
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
          </div>

          <div className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4">
            {message && (
              <div
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  message.kind === 'success'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            {mode !== 'catalog' && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block md:col-span-1">
                  <span className={labelClass}>Name</span>
                  <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Custom Software"
                  />
                </label>
                <label className="inline-flex items-end gap-2 pb-1 text-xs font-semibold text-zinc-700">
                  <input
                    type="checkbox"
                    checked={draft.isEnabled}
                    onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })}
                  />
                  Enabled (available on new leads)
                </label>
                <label className="block md:col-span-2">
                  <span className={labelClass}>Description</span>
                  <input
                    className={inputClass}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Optional"
                  />
                </label>
              </div>
            )}

            {mode !== 'catalog' && (
              <div className="rounded-xl border border-blue-200/90 bg-gradient-to-br from-blue-50/40 to-indigo-50/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold font-mono">
                      ₹
                    </span>
                    <div>
                      <h4 className="m-0 text-xs font-bold text-zinc-950">
                        Budget Field (Number) — Required Form Field
                      </h4>
                      <p className="m-0 text-[11px] text-zinc-500">
                        Configure the allowed minimum and maximum commercial budget for this request type.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 border border-blue-200">
                    Mandatory Field
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="block">
                    <span className={labelClass}>Minimum Amount</span>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      placeholder="e.g. 10000 (No minimum if empty)"
                      value={draft.minBudget ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const nextFields = prev.fields.map((f) =>
                            f.key === 'budget'
                              ? { ...f, minAmount: val, matchNumberMin: val }
                              : f
                          );
                          return { ...prev, minBudget: val, fields: nextFields };
                        });
                      }}
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Users cannot enter an amount lower than this.
                    </span>
                  </label>

                  <label className="block">
                    <span className={labelClass}>Maximum Amount</span>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      placeholder="e.g. 500000 (No maximum if empty)"
                      value={draft.maxBudget ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const nextFields = prev.fields.map((f) =>
                            f.key === 'budget'
                              ? { ...f, maxAmount: val, matchNumberMax: val }
                              : f
                          );
                          return { ...prev, maxBudget: val, fields: nextFields };
                        });
                      }}
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Users cannot enter an amount higher than this.
                    </span>
                  </label>
                </div>

                {draft.minBudget != null && draft.maxBudget != null && draft.minBudget > draft.maxBudget ? (
                  <p className="m-0 text-[11px] font-semibold text-red-600">
                    ⚠ Minimum amount cannot be greater than maximum amount.
                  </p>
                ) : (draft.minBudget != null || draft.maxBudget != null) ? (
                  <div className="rounded-lg bg-white/80 border border-blue-200/60 px-3 py-1.5 text-[11px] text-zinc-700 flex items-center justify-between">
                    <span className="font-semibold text-blue-900">Commercial Requirement Allowed Range:</span>
                    <span className="font-mono font-bold text-zinc-900">
                      {draft.minBudget != null ? `₹${draft.minBudget.toLocaleString()}` : '₹0'} –{' '}
                      {draft.maxBudget != null ? `₹${draft.maxBudget.toLocaleString()}` : '∞'}
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            <DynamicFormBuilder
              fields={draft.fields}
              showMatchConfig
              onChange={(fields) => setDraft({ ...draft, fields })}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft()}
              className="inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              <SaveOutlinedIcon sx={{ fontSize: 16 }} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-tour="settings-request-types">
      <div className={`${cardClass} space-y-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
              <span>📐</span> Request Types
            </div>
            <h2 className="m-0 text-xl font-bold tracking-tight text-zinc-950">
              Dynamic Request Type Builder
            </h2>
            <p className="mb-0 mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Create request types with custom commercial forms. Only enabled types appear on new
              leads. Configure Qualification Match catalogs per request type.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || saving}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700"
            >
              <RefreshIcon sx={{ fontSize: 16 }} /> Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white"
            >
              <AddIcon sx={{ fontSize: 16 }} /> New Request Type
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              message.kind === 'success'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <p className="m-0 text-xs text-zinc-500">Loading request types…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Request Type</th>
                  <th className="px-4 py-3 font-semibold">Budget Range</th>
                  <th className="px-4 py-3 font-semibold">Fields</th>
                  <th className="px-4 py-3 font-semibold">Leads</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openCatalog(item)}
                        className="cursor-pointer border-0 bg-transparent p-0 text-left"
                      >
                        <div className="font-semibold text-zinc-950 hover:underline">{item.name}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                          key: {item.key}
                        </div>
                      </button>
                      {item.description ? (
                        <p className="mb-0 mt-1 text-xs text-zinc-500">{item.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(() => {
                        const bField = item.fields?.find((f) => f.key === 'budget');
                        const min = item.minBudget ?? bField?.minAmount ?? bField?.matchNumberMin;
                        const max = item.maxBudget ?? bField?.maxAmount ?? bField?.matchNumberMax;
                        if (min != null && max != null) {
                          return (
                            <span className="font-mono font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded px-2 py-0.5">
                              ₹{min.toLocaleString()} – ₹{max.toLocaleString()}
                            </span>
                          );
                        }
                        if (min != null) {
                          return (
                            <span className="font-mono font-medium text-blue-800 bg-blue-50 border border-blue-200/80 rounded px-2 py-0.5">
                              Min: ₹{min.toLocaleString()}
                            </span>
                          );
                        }
                        if (max != null) {
                          return (
                            <span className="font-mono font-medium text-blue-800 bg-blue-50 border border-blue-200/80 rounded px-2 py-0.5">
                              Max: ₹{max.toLocaleString()}
                            </span>
                          );
                        }
                        return <span className="text-zinc-400 italic">No limit set</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700">
                      {item.fieldCount ?? item.fields?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700">{item.leadCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.isEnabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {item.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openCatalog(item)}
                          className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700"
                        >
                          Match catalog
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void toggleEnabled(item)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700"
                        >
                          <PowerSettingsNewIcon sx={{ fontSize: 14 }} />
                          {item.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700"
                        >
                          <EditOutlinedIcon sx={{ fontSize: 14 }} /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            if ((item.leadCount || 0) > 0) {
                              setMessage({
                                kind: 'error',
                                text: `Cannot delete "${item.name}" — leads are using it. Disable instead.`,
                              });
                              return;
                            }
                            setDeleteTarget(item);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 text-[11px] font-semibold text-red-600"
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 14 }} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h4 className="m-0 text-sm font-bold text-zinc-950">Delete request type?</h4>
            <p className="mt-2 text-xs text-zinc-600">
              Delete <strong>{deleteTarget.name}</strong>? This cannot be undone. Types used by
              existing leads cannot be deleted — disable them instead.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmDelete()}
                className="inline-flex h-9 items-center rounded-lg border-0 bg-red-600 px-3 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
