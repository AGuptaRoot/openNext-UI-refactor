import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { SwapDropGrid } from '../dndkit';
import { Briefcase, Lock } from 'lucide-react';
import { useNotifyMessage } from '@/components/notifications';
import { crmApi } from '../../services/api';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import {
  DEFAULT_STAGE_CATALOG,
  STAGE_TYPE_LABELS,
  OPPORTUNITY_STAGE_TYPES,
  isProtectedStageType,
  makeLocalStageId,
  validatePipelineStagesClient,
  type OpportunityPipeline,
  type OpportunityPipelineStage,
  type OpportunityStageType,
} from '../../types/opportunity-pipelines';

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';
const cardClass = 'rounded-xl border border-zinc-300 bg-white p-5';

type EditorMode = 'edit' | null;

type EditorState = {
  id?: string;
  name: string;
  description: string;
  quotationWorkflowEnabled: boolean;
  isEnabled: boolean;
  stages: OpportunityPipelineStage[];
};

function fromPipeline(pipeline: OpportunityPipeline): EditorState {
  return {
    id: pipeline._id,
    name: pipeline.name,
    description: pipeline.description || '',
    quotationWorkflowEnabled: pipeline.quotationWorkflowEnabled !== false,
    isEnabled: true,
    stages: (pipeline.stages || []).map((s, index) => ({
      id: s.id || makeLocalStageId(index),
      label: s.label,
      type: s.type,
      probability: Number(s.probability) || 50,
    })),
  };
}

export function OpportunityPipelinesPanel() {
  const { extension: activeExtension } = useActiveExtension();
  const [pipelines, setPipelines] = useState<OpportunityPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  useNotifyMessage(message?.text, message?.kind === 'success' ? 'success' : 'error', () => setMessage(null));
  const [mode, setMode] = useState<EditorMode>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [catalogMenuOpen, setCatalogMenuOpen] = useState(false);

  const load = useCallback(async (opts?: { clearMessage?: boolean }) => {
    setLoading(true);
    if (opts?.clearMessage !== false) setMessage(null);
    try {
      const res = await crmApi.listOpportunityPipelines();
      setPipelines(Array.isArray(res.data) ? res.data : []);
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to load pipelines',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayedPipelines = useMemo(() => {
    const matched = pipelines.filter((p) => p.pipelineKey === activeExtension.pipelineKey);
    if (matched.length > 0) return matched;
    const active = pipelines.filter((p) => p.isActive);
    if (active.length > 0) return active;
    return pipelines.slice(0, 1);
  }, [pipelines, activeExtension.pipelineKey]);

  const activeId = useMemo(
    () => displayedPipelines.find((p) => p.isActive)?._id || displayedPipelines[0]?._id || '',
    [displayedPipelines]
  );

  const openEdit = (pipeline: OpportunityPipeline) => {
    setMode('edit');
    setEditor(fromPipeline(pipeline));
    setCatalogMenuOpen(false);
    setMessage(null);
  };

  const closeEditor = () => {
    setMode(null);
    setEditor(null);
    setCatalogMenuOpen(false);
  };

  const updateStage = (index: number, patch: Partial<OpportunityPipelineStage>) => {
    if (!editor) return;
    setEditor({
      ...editor,
      stages: editor.stages.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)),
    });
  };

  const addStage = () => {
    if (!editor) return;
    setEditor({
      ...editor,
      stages: [
        ...editor.stages,
        {
          id: makeLocalStageId(editor.stages.length),
          label: `Stage ${editor.stages.length + 1}`,
          type: 'OPEN',
          probability: 50,
        },
      ],
    });
  };

  const removeStage = (index: number) => {
    if (!editor) return;
    const stage = editor.stages[index];
    if (isProtectedStageType(stage.type)) {
      setMessage({ kind: 'error', text: 'Won and Lost stages cannot be deleted.' });
      return;
    }
    if (editor.stages.length <= 5) {
      setMessage({ kind: 'error', text: 'A pipeline must keep at least 5 stages.' });
      return;
    }
    setEditor({
      ...editor,
      stages: editor.stages.filter((_, i) => i !== index),
    });
  };

  const swapStages = (fromIndex: number, toIndex: number) => {
    if (!editor) return;
    const next = [...editor.stages];
    const tmp = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = tmp;
    setEditor({ ...editor, stages: next });
  };

  const addDefaultStage = (catalogItem: (typeof DEFAULT_STAGE_CATALOG)[number]) => {
    if (!editor) return;
    const exists = editor.stages.some(
      (s) =>
        s.type === catalogItem.type ||
        s.label.trim().toLowerCase() === catalogItem.label.toLowerCase()
    );
    if (exists) {
      setMessage({
        kind: 'error',
        text: `"${catalogItem.label}" already exists in this pipeline.`,
      });
      setCatalogMenuOpen(false);
      return;
    }
    // Negotiation sits after Won; other defaults insert before Won/Lost.
    const wonIdx = editor.stages.findIndex((s) => s.type === 'WON');
    const lostIdx = editor.stages.findIndex((s) => s.type === 'LOST');
    const insertAt =
      catalogItem.type === 'NEGOTIATION'
        ? wonIdx >= 0
          ? wonIdx + 1
          : lostIdx >= 0
            ? lostIdx
            : editor.stages.length
        : wonIdx >= 0
          ? wonIdx
          : lostIdx >= 0
            ? lostIdx
            : editor.stages.length;
    const next = [...editor.stages];
    const stage: OpportunityPipelineStage = {
      id: makeLocalStageId(next.length),
      label: catalogItem.label,
      type: catalogItem.type,
      probability: catalogItem.probability,
    };
    next.splice(insertAt, 0, stage);
    setEditor({ ...editor, stages: next });
    setCatalogMenuOpen(false);
    setMessage({ kind: 'success', text: `Added "${catalogItem.label}".` });
  };

  const saveEditor = async (event?: React.FormEvent | React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      setMessage({ kind: 'error', text: 'Pipeline name is required.' });
      return;
    }
    const errors = validatePipelineStagesClient(editor.stages, {
      quotationWorkflowEnabled: editor.quotationWorkflowEnabled,
    });
    if (errors.length) {
      setMessage({ kind: 'error', text: errors[0] });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name,
        description: editor.description.trim(),
        quotationWorkflowEnabled: editor.quotationWorkflowEnabled,
        isEnabled: true,
        stages: editor.stages.map((s) => ({
          id: s.id,
          label: s.label.trim(),
          type: s.type,
          probability: s.probability,
        })),
      };
      if (editor.id) {
        const updated = await crmApi.updateOpportunityPipeline(editor.id, payload);
        if (updated.data?._id) {
          setPipelines((prev) =>
            prev.map((p) => (p._id === updated.data._id ? updated.data : p))
          );
        }
        setMessage({ kind: 'success', text: 'Pipeline updated.' });
      } else {
        setMessage({ kind: 'error', text: 'Nothing to save — open Edit first.' });
        return;
      }
      closeEditor();
      await load({ clearMessage: false });
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to save pipeline',
      });
    } finally {
      setSaving(false);
    }
  };

  const missingCatalog = useMemo(() => {
    if (!editor) return DEFAULT_STAGE_CATALOG;
    return DEFAULT_STAGE_CATALOG.filter(
      (item) =>
        !editor.stages.some(
          (s) =>
            s.type === item.type ||
            s.label.trim().toLowerCase() === item.label.toLowerCase()
        )
    );
  }, [editor]);

  if (mode && editor) {
    return (
      <div
        className="space-y-5"
        data-tour="settings-opportunity-pipeline-editor"
        // Settings page wraps tabs in a <form>. Stop Enter-in-input from
        // submitting parent settings save instead of creating the pipeline.
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag === 'TEXTAREA') return;
          // Never let Enter bubble; optionally save from single-line fields.
          e.preventDefault();
          e.stopPropagation();
          if (tag === 'INPUT' && !saving) {
            void saveEditor(e);
          }
        }}
      >
        <div className={`${cardClass} space-y-4`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="m-0 text-sm font-bold text-zinc-950">Edit Pipeline</h3>
              <p className="mb-0 mt-1 text-xs text-zinc-500">
                Minimum 5 stages. Won and Lost are required and cannot be removed. Rename labels
                freely — internal types power quotation and close workflows.
              </p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700"
            >
              <CloseIcon sx={{ fontSize: 16 }} /> Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Pipeline name</span>
              <input
                className={inputClass}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="e.g. Enterprise Sales"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Description</span>
              <input
                className={inputClass}
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={editor.quotationWorkflowEnabled}
                onChange={(e) =>
                  setEditor({ ...editor, quotationWorkflowEnabled: e.target.checked })
                }
              />
              CRM Quotation workflow (requires Quotation Sent + Negotiation types)
            </label>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
              {editor.stages.length} stage{editor.stages.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addStage}
              className="inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <AddIcon sx={{ fontSize: 16 }} /> Add stage
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCatalogMenuOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800"
              >
                <PlaylistAddIcon sx={{ fontSize: 16 }} /> Add Default Stage
              </button>
              {catalogMenuOpen && (
                <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                  {missingCatalog.length === 0 ? (
                    <p className="m-0 px-2 py-2 text-xs text-zinc-500">
                      All default stages are already in this pipeline.
                    </p>
                  ) : (
                    missingCatalog.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => addDefaultStage(item)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-zinc-50"
                      >
                        <span className="font-semibold text-zinc-800">{item.label}</span>
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                          {item.type}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <SwapDropGrid
            items={editor.stages}
            onSwap={swapStages}
            label="Pipeline stages"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            renderItem={(item, index, ctx) => (
              <div
                ref={ctx.setNodeRef}
                style={ctx.style}
                className={`flex flex-col rounded-2xl border bg-white p-3 shadow-sm ${
                  ctx.isOver ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-zinc-200'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 active:cursor-grabbing"
                      title="Drag to reorder"
                      {...ctx.attributes}
                      {...ctx.listeners}
                    >
                      <DragIndicatorIcon sx={{ fontSize: 18 }} />
                    </button>
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-zinc-950 px-2 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    {isProtectedStageType(item.type) && (
                      <LockOutlinedIcon sx={{ fontSize: 14 }} className="text-zinc-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isProtectedStageType(item.type) || editor.stages.length <= 5}
                    onClick={() => removeStage(index)}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-100 bg-white px-2 text-[11px] font-semibold text-red-600 disabled:opacity-40"
                    title={
                      isProtectedStageType(item.type)
                        ? 'Won / Lost cannot be deleted'
                        : 'Remove stage'
                    }
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </button>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Visible name
                  </span>
                  <input
                    className={inputClass}
                    value={item.label}
                    onChange={(e) => updateStage(index, { label: e.target.value })}
                  />
                </label>
                <label className="mt-2 block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Internal type
                  </span>
                  <select
                    className={inputClass}
                    value={item.type}
                    disabled={isProtectedStageType(item.type)}
                    onChange={(e) =>
                      updateStage(index, {
                        type: e.target.value as OpportunityStageType,
                        probability:
                          e.target.value === 'WON'
                            ? 100
                            : e.target.value === 'LOST'
                              ? 0
                              : item.probability,
                      })
                    }
                  >
                    {OPPORTUNITY_STAGE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {STAGE_TYPE_LABELS[type]} ({type})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-2 block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Win probability %
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputClass}
                    value={item.probability}
                    onChange={(e) =>
                      updateStage(index, {
                        probability: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                  />
                </label>
              </div>
            )}
          />

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
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
              onClick={(e) => void saveEditor(e)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              <SaveOutlinedIcon sx={{ fontSize: 16 }} />
              {saving ? 'Saving…' : 'Save pipeline'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-tour="settings-opportunity-pipelines">
      <div className={`${cardClass} space-y-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white">
              <Briefcase className="h-[18px] w-[18px] shrink-0" aria-hidden />
            </div>
            <div>
              <h3 className="m-0 text-sm font-bold text-zinc-950">Pipeline Management</h3>
              <p className="mb-0 mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
                Manage sales pipelines under Settings → Opportunity → Pipelines. Only one pipeline
                can be active. Activating another pipeline automatically deactivates the current
                one. The default pipeline cannot be deleted.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || saving}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700"
            >
              <RefreshIcon sx={{ fontSize: 16 }} /> Refresh
            </button>
          </div>
        </div>

        {(() => {
          const extPipeline = pipelines.find((p) => p.pipelineKey === activeExtension.pipelineKey);
          return (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-blue-900">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                The active extension <strong className="font-semibold">{activeExtension.name}</strong>{' '}
                sets{' '}
                <strong className="font-semibold">
                  {extPipeline?.name || 'its own pipeline'}
                </strong>{' '}
                as the deal pipeline. Enabling another extension in Settings → Extensions switches
                it automatically. Stages and probabilities remain editable below.
              </span>
            </div>
          );
        })()}

        {loading ? (
          <p className="m-0 text-xs text-zinc-500">Loading pipelines…</p>
        ) : displayedPipelines.length === 0 ? (
          <p className="m-0 text-xs text-zinc-500">No pipelines yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Pipeline</th>
                  <th className="px-4 py-3 font-semibold">Stages</th>
                  <th className="px-4 py-3 font-semibold">Opportunities</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedPipelines.map((pipeline) => (
                  <tr key={pipeline._id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">{pipeline.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                        {pipeline.isDefault && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600">
                            Default
                          </span>
                        )}
                        {pipeline.isActive && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                            <CheckCircleOutlineIcon sx={{ fontSize: 12 }} /> Active
                          </span>
                        )}
                        {pipeline.quotationWorkflowEnabled !== false && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                            Quotation workflow
                          </span>
                        )}
                      </div>
                      {pipeline.description ? (
                        <p className="mb-0 mt-1 text-xs text-zinc-500">{pipeline.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700">
                      {pipeline.stageCount ?? pipeline.stages?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700">
                      {pipeline.opportunityCount ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(pipeline)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700"
                        >
                          <EditOutlinedIcon sx={{ fontSize: 14 }} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeId ? (
          <p className="mb-0 text-[11px] text-zinc-500">
            Active pipeline stages sync to opportunity boards and forecasts automatically.
          </p>
        ) : null}
      </div>
    </div>
  );
}
