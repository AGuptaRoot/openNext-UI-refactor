import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import { crmApi } from '../../services/api';
import {
  CUSTOM_FIELD_TYPES,
  DESIGNATION_PRESETS,
  REMINDER_HOUR_PRESETS,
  SETTINGS_CURRENCIES,
  SETTINGS_TABS,
  STANDARD_STATE_SHIPPING_RATES,
  listToLines,
  linesToList,
  slugifyCustomFieldKey,
  type AdminCustomField,
  type CrmSettings,
  type CustomFieldType,
  type SettingsEmailStatus,
  type SettingsTabId,
  type SettingsWorkspaceUser,
} from '../../types/admin';
import {
  BUILTIN_PROJECT_STATUSES,
  isBuiltinProjectStatus,
  mergeProjectStatusesWithBuiltins,
} from '../../types/projects';
import { mergeLeadStatusesWithBuiltins } from '../../services/mockLeadData';
import { useAuth } from '../../context/AuthContext';
import {
  CRM_SETTINGS_CURRENCY_CHANGED,
  getCurrencySymbol,
  setRuntimeDefaultCurrency,
} from '../../utils/currency';
import { TourButton } from '../../ui/tour/TourButton';
import { SwapDropGrid } from '../../components/dndkit';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { OpportunityPipelinesPanel } from '../../components/settings/OpportunityPipelinesPanel';
import { RequestTypesPanel } from '../../components/settings/RequestTypesPanel';
import { GroqIntegrationPanel } from '../../components/settings/GroqIntegrationPanel';
import { GoogleMapsIntegrationPanel } from '../../components/settings/GoogleMapsIntegrationPanel';
import { INDIAN_STATES } from '../../types/opportunities';

const inputClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';
const cardClass = 'rounded-xl border border-zinc-300 bg-white p-5';
const monoClass = `${inputClass} font-mono`;

/** Never show role slugs / ObjectIds in the Users table. */
const WORKSPACE_ROLE_LABELS: Record<string, string> = {
  'crm-manager': 'CRM Manager',
  'sales-manager': 'Sales Manager',
  'sales-representative': 'Sales Representative',
  'project-manager': 'Project Lead',
  'crm-employee': 'Team Member',
  'finance-manager': 'Finance Lead',
  client: 'Client / Customer Portal',
};

function formatWorkspaceRoleLabel(role?: string): string {
  const raw = String(role || '').trim();
  if (!raw) return 'Member';
  const lower = raw.toLowerCase();
  if (WORKSPACE_ROLE_LABELS[lower]) return WORKSPACE_ROLE_LABELS[lower];
  if (lower === 'support-agent' || lower === 'user-agent') return 'Team Member';
  if (lower.includes('client') || lower.includes('customer') || lower.includes('portal')) {
    return WORKSPACE_ROLE_LABELS.client;
  }
  // Hide Mongo ObjectIds / numeric CMS role values
  if (/^[a-f0-9]{24}$/i.test(raw) || /^\d+$/.test(raw)) return 'Member';
  return raw;
}

function ChipListEditor({
  title,
  description,
  icon,
  accent,
  value,
  placeholder,
  onChange,
}: {
  title: string;
  description: string;
  icon: string;
  accent: string;
  value: string[];
  placeholder?: string;
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const addItem = () => {
    const next = draft.trim();
    if (!next) return;
    if (value.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, next]);
    setDraft('');
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={`${cardClass} flex h-full flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${accent}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="m-0 text-sm font-bold text-zinc-950">{title}</h3>
            <p className="mb-0 mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
          {value.length}
        </span>
      </div>

      <div className="min-h-[72px] rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
        {value.length === 0 ? (
          <p className="m-0 text-center text-xs text-zinc-400 py-4">No values yet — add the first one below.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {value.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white py-1 pl-3 pr-1.5 text-xs font-semibold text-zinc-800"
              >
                <span className="truncate">{item}</span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border-0 bg-zinc-100 text-zinc-500 hover:bg-zinc-900 hover:text-white"
                  aria-label={`Remove ${item}`}
                >
                  <CloseIcon sx={{ fontSize: 12 }} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={draft}
            placeholder={placeholder || 'Add value…'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <button
            type="button"
            onClick={addItem}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white"
          >
            <AddIcon sx={{ fontSize: 16 }} /> Add
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowBulk((open) => !open)}
          className="self-start border-0 bg-transparent p-0 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900"
        >
          {showBulk ? 'Hide bulk edit' : 'Bulk edit (one per line)'}
        </button>
        {showBulk ? (
          <textarea
            className={`${inputClass} h-24 resize-y py-2`}
            value={listToLines(value)}
            onChange={(event) => onChange(linesToList(event.target.value))}
            placeholder="One value per line"
          />
        ) : null}
      </div>
    </div>
  );
}

function ProjectStatusesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const statuses = useMemo(() => mergeProjectStatusesWithBuiltins(value), [value]);
  const customStatuses = useMemo(
    () => statuses.filter((status) => !isBuiltinProjectStatus(status)),
    [statuses]
  );

  const commitList = (next: string[]) => {
    onChange(mergeProjectStatusesWithBuiltins(next));
  };

  const addItem = () => {
    const next = draft.trim();
    if (!next) return;
    if (statuses.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    commitList([...statuses, next]);
    setDraft('');
  };

  const removeCustom = (index: number) => {
    const item = statuses[index];
    if (!item || isBuiltinProjectStatus(item)) return;
    commitList(statuses.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditDraft('');
    }
  };

  const startEdit = (index: number) => {
    const item = statuses[index];
    if (!item || isBuiltinProjectStatus(item)) return;
    setEditingIndex(index);
    setEditDraft(item);
  };

  const saveEdit = () => {
    if (editingIndex == null) return;
    const current = statuses[editingIndex];
    if (!current || isBuiltinProjectStatus(current)) {
      setEditingIndex(null);
      setEditDraft('');
      return;
    }
    const nextName = editDraft.trim();
    if (!nextName) return;
    if (
      statuses.some(
        (item, i) => i !== editingIndex && item.toLowerCase() === nextName.toLowerCase()
      )
    ) {
      return;
    }
    if (isBuiltinProjectStatus(nextName)) return;
    const next = statuses.map((item, i) => (i === editingIndex ? nextName : item));
    commitList(next);
    setEditingIndex(null);
    setEditDraft('');
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 bg-[linear-gradient(135deg,#fafafa_0%,#ffffff_55%,#f4f4f5_100%)] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                <span>📌</span> Project lifecycle
              </div>
              <h2 className="m-0 text-xl font-bold tracking-tight text-zinc-950">
                Project statuses
              </h2>
              <p className="mb-0 mt-2 text-sm leading-relaxed text-zinc-500">
                System statuses stay locked. Add custom statuses here when you need them — for
                example add <strong>Live</strong> only if you want go-live URL capture and client
                email. Live does not appear on projects until you add it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-[96px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center">
                <div className="text-lg font-bold text-zinc-950">{BUILTIN_PROJECT_STATUSES.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  System
                </div>
              </div>
              <div className="min-w-[96px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center">
                <div className="text-lg font-bold text-zinc-950">{customStatuses.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Custom
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={`${cardClass} flex flex-col gap-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg">
                <LockOutlinedIcon sx={{ fontSize: 18 }} />
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold text-zinc-950">System statuses</h3>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-zinc-500">
                  Built into the CRM. These cannot be edited or deleted.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
              {BUILTIN_PROJECT_STATUSES.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            {BUILTIN_PROJECT_STATUSES.map((item) => (
              <span
                key={item}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white py-1.5 pl-3 pr-2.5 text-xs font-semibold text-zinc-700"
                title="System status — locked"
              >
                <LockOutlinedIcon sx={{ fontSize: 12 }} className="text-zinc-400" />
                <span className="truncate">{item}</span>
              </span>
            ))}
          </div>
        </section>

        <section className={`${cardClass} flex h-full flex-col gap-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg">
                ✏️
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold text-zinc-950">Custom statuses</h3>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-zinc-500">
                  Create your own labels. Rename or remove them anytime.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
              {customStatuses.length}
            </span>
          </div>

          <div className="min-h-[72px] rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            {customStatuses.length === 0 ? (
              <p className="m-0 py-4 text-center text-xs text-zinc-400">
                No custom statuses yet — add one below.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {statuses.map((item, index) => {
                  if (isBuiltinProjectStatus(item)) return null;
                  const isEditing = editingIndex === index;
                  return (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5"
                    >
                      {isEditing ? (
                        <>
                          <input
                            className={`${inputClass} h-8 flex-1`}
                            value={editDraft}
                            autoFocus
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveEdit();
                              }
                              if (e.key === 'Escape') {
                                setEditingIndex(null);
                                setEditDraft('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="inline-flex h-8 items-center rounded-lg border-0 bg-zinc-950 px-2.5 text-[11px] font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(null);
                              setEditDraft('');
                            }}
                            className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-600"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-800">
                            {item}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEdit(index)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border-0 bg-zinc-100 text-zinc-500 hover:bg-zinc-900 hover:text-white"
                            aria-label={`Rename ${item}`}
                            title="Rename"
                          >
                            <EditOutlinedIcon sx={{ fontSize: 14 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCustom(index)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border-0 bg-zinc-100 text-zinc-500 hover:bg-red-600 hover:text-white"
                            aria-label={`Remove ${item}`}
                            title="Delete"
                          >
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto flex gap-2">
            <input
              className={inputClass}
              value={draft}
              placeholder="e.g. Awaiting Client, Dropped…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <button
              type="button"
              onClick={addItem}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white"
            >
              <AddIcon sx={{ fontSize: 16 }} /> Add
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function uniqueStageLabel(base: string, existing: string[]) {
  const trimmed = base.trim() || 'New Stage';
  const lower = (label: string) => label.toLowerCase();
  if (!existing.some((item) => lower(item) === lower(trimmed))) return trimmed;
  let i = 2;
  let candidate = `${trimmed} ${i}`;
  while (existing.some((item) => lower(item) === lower(candidate))) {
    i += 1;
    candidate = `${trimmed} ${i}`;
  }
  return candidate;
}

function PipelineStagesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [stageIds, setStageIds] = useState<string[]>(() =>
    value.map((_, index) => `pipeline-stage-${index}-${Date.now()}`)
  );

  useEffect(() => {
    setStageIds((prev) => {
      if (prev.length === value.length) return prev;
      if (value.length > prev.length) {
        const next = [...prev];
        while (next.length < value.length) {
          next.push(`pipeline-stage-${next.length}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
        }
        return next;
      }
      return prev.slice(0, value.length);
    });
  }, [value.length]);

  const items = useMemo(
    () =>
      value.map((label, index) => ({
        id: stageIds[index] || `pipeline-stage-${index}`,
        label,
      })),
    [value, stageIds]
  );

  const addStage = () => {
    const nextLabel = uniqueStageLabel(draft || 'New Stage', value);
    const nextId = `pipeline-stage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setStageIds((prev) => [...prev, nextId]);
    onChange([...value, nextLabel]);
    setDraft('');
  };

  const removeStage = (index: number) => {
    if (value.length <= 1) return;
    setStageIds((prev) => prev.filter((_, i) => i !== index));
    onChange(value.filter((_, i) => i !== index));
  };

  const renameStage = (index: number, nextLabel: string) => {
    onChange(value.map((item, i) => (i === index ? nextLabel : item)));
  };

  const swapStages = (fromIndex: number, toIndex: number) => {
    const nextLabels = [...value];
    const nextIds = [...stageIds];
    const tmpLabel = nextLabels[fromIndex];
    nextLabels[fromIndex] = nextLabels[toIndex];
    nextLabels[toIndex] = tmpLabel;
    const tmpId = nextIds[fromIndex];
    nextIds[fromIndex] = nextIds[toIndex];
    nextIds[toIndex] = tmpId;
    setStageIds(nextIds);
    onChange(nextLabels);
  };

  return (
    <div className={`${cardClass} space-y-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-base text-white">
            🛤️
          </div>
          <div>
            <h3 className="m-0 text-sm font-bold text-zinc-950">Sales Pipeline Stages</h3>
            <p className="mb-0 mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
              Numbered steps left → right on Kanban and reports. Drag a stage onto another to swap
              their places. Keep at least one stage.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
          {value.length} stage{value.length === 1 ? '' : 's'}
        </span>
      </div>

      <SwapDropGrid
        items={items}
        onSwap={swapStages}
        label="Sales pipeline stages"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        renderItem={(item, index, ctx) => (
          <div
            ref={ctx.setNodeRef}
            style={ctx.style}
            role="listitem"
            className={`flex flex-col rounded-2xl border bg-white p-3 shadow-sm transition-shadow ${
              ctx.isOver
                ? 'border-slate-900 ring-2 ring-slate-900/20'
                : 'border-zinc-200'
            } ${ctx.isDragging ? 'shadow-md' : ''}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 active:cursor-grabbing"
                  title="Drag to swap with another stage"
                  aria-label={`Drag step ${index + 1}`}
                  {...ctx.attributes}
                  {...ctx.listeners}
                >
                  <DragIndicatorIcon sx={{ fontSize: 18 }} />
                </button>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-zinc-950 px-2 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Step {index + 1}
                </span>
              </div>
              <button
                type="button"
                disabled={value.length <= 1}
                onClick={() => removeStage(index)}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-100 bg-white px-2 text-[11px] font-semibold text-red-600 disabled:opacity-40"
                title="Remove stage"
              >
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </button>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Stage name
              </span>
              <input
                className={inputClass}
                value={item.label}
                onChange={(e) => renameStage(index, e.target.value)}
                placeholder={`Stage ${index + 1}`}
              />
            </label>
            {index < value.length - 1 ? (
              <p className="mb-0 mt-2 text-[10px] font-medium text-zinc-400">
                Next → Step {index + 2}
              </p>
            ) : (
              <p className="mb-0 mt-2 text-[10px] font-medium text-zinc-400">Final step</p>
            )}
          </div>
        )}
        renderOverlay={(item, index) => (
          <div className="w-64 rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-zinc-950 px-2 text-[11px] font-bold text-white">
                {index + 1}
              </span>
              <span className="text-xs font-semibold text-zinc-700">Step {index + 1}</span>
            </div>
            <div className="truncate text-sm font-semibold text-zinc-950">{item.label || 'Untitled'}</div>
            <p className="mb-0 mt-1 text-[10px] text-zinc-500">Drop on another stage to swap</p>
          </div>
        )}
      />

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className={labelClass}>New stage name (optional)</span>
          <input
            className={inputClass}
            value={draft}
            placeholder="e.g. Negotiation — leave blank for New Stage"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                addStage();
              }
            }}
          />
        </label>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addStage();
          }}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800"
        >
          <AddIcon sx={{ fontSize: 16 }} /> Add stage
        </button>
      </div>
    </div>
  );
}


function CustomFieldBuilder({
  title,
  value,
  onChange,
}: {
  title: string;
  value: AdminCustomField[];
  onChange: (value: AdminCustomField[]) => void;
}) {
  const updateField = (index: number, patch: Partial<AdminCustomField>) => {
    onChange(value.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const addField = () => {
    onChange([
      ...value,
      {
        key: `custom_field_${value.length + 1}`,
        label: 'New Field',
        type: 'text',
        options: [],
        required: false,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-sm font-bold text-zinc-950">{title}</h3>
          <p className="mb-0 mt-1 text-xs text-zinc-500">
            {value.length} configured field{value.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={addField}
          className="inline-flex h-8 items-center gap-1 rounded-lg border-0 bg-slate-950 px-3 text-xs font-semibold text-white"
        >
          <AddIcon sx={{ fontSize: 16 }} /> Add Field
        </button>
      </div>
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
          No custom fields configured.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((field, index) => (
            <div key={`${field.key}-${index}`} className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
                <label className="block">
                  <span className={labelClass}>Field Key</span>
                  <input
                    className={monoClass}
                    value={field.key}
                    onChange={(event) =>
                      updateField(index, { key: slugifyCustomFieldKey(event.target.value) })
                    }
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Field Label</span>
                  <input
                    className={inputClass}
                    value={field.label}
                    onChange={(event) => {
                      const label = event.target.value;
                      const patch: Partial<AdminCustomField> = { label };
                      if (!field.key || field.key.startsWith('custom_field_')) {
                        patch.key = slugifyCustomFieldKey(label);
                      }
                      updateField(index, patch);
                    }}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Type</span>
                  <select
                    className={inputClass}
                    value={field.type}
                    onChange={(event) =>
                      updateField(index, { type: event.target.value as CustomFieldType })
                    }
                  >
                    {CUSTOM_FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block xl:col-span-2">
                  <span className={labelClass}>Options (select)</span>
                  <input
                    className={inputClass}
                    disabled={field.type !== 'select'}
                    placeholder="AWS, GCP, Azure"
                    value={(field.options || []).join(', ')}
                    onChange={(event) =>
                      updateField(index, {
                        options: event.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <div className="flex items-end justify-between gap-2">
                  <label className="flex h-9 items-center gap-2 text-xs font-semibold text-zinc-700">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(event) => updateField(index, { required: event.target.checked })}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove ${field.label}`}
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700"
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SettingsTabMeta {
  id: SettingsTabId;
  label: string;
  icon: string;
  subtitle: string;
  keywords: string;
}

interface SettingsTabGroup {
  groupId: string;
  title: string;
  tabs: SettingsTabMeta[];
}

const SETTINGS_TAB_GROUPS: SettingsTabGroup[] = [
  {
    groupId: 'core',
    title: 'General & Organization',
    tabs: [
      {
        id: 'general',
        label: 'General Profile',
        icon: '🏢',
        subtitle: 'Company details, office address & UoMs',
        keywords: 'company name tax gst state address office branch unit of measure uom pcs kg litre',
      },
      {
        id: 'shipping',
        label: 'Shipping & Logistics',
        icon: '🚚',
        subtitle: 'Origin state & regional freight tariffs',
        keywords: 'shipping origin state freight weight rate courier logistics tier delivery',
      },
      {
        id: 'finance',
        label: 'Finance & Banking',
        icon: '💰',
        subtitle: 'Currencies, banking accounts & terms',
        keywords: 'finance currency inr usd bank account bank name ifsc iban account number payment terms',
      },
      {
        id: 'email',
        label: 'Email & SMTP',
        icon: '✉️',
        subtitle: 'Relay server & transactional routing',
        keywords: 'email smtp host port tls authentication sender from test email relay notification',
      },
      {
        id: 'integrations',
        label: 'Integrations & AI',
        icon: '🔌',
        subtitle: 'Groq OCR LLM & Google Maps Places API',
        keywords: 'integrations groq ocr ai google maps places api key autocomplete vision model',
      },
    ],
  },
  {
    groupId: 'crm',
    title: 'Sales & Pipelines',
    tabs: [
      {
        id: 'leads',
        label: 'Leads & Funnels',
        icon: '🎯',
        subtitle: 'Lead sources, categories & tags',
        keywords: 'leads sources categories tags stages custom fields qualification capture',
      },
      {
        id: 'qualification-match',
        label: 'Qualification Match',
        icon: '📐',
        subtitle: 'Commercial request types & budget bounds',
        keywords: 'qualification match request types budget min max budget commercial requirements dynamic forms',
      },
      {
        id: 'opportunities',
        label: 'Opportunity Pipelines',
        icon: '💼',
        subtitle: 'Sales pipelines & conversion stages',
        keywords: 'opportunity deal pipeline stages kanban win probability stages revenue forecast',
      },
      {
        id: 'clients',
        label: 'Clients & Accounts',
        icon: '👥',
        subtitle: 'Client categories, tags & attributes',
        keywords: 'clients accounts categories tags custom fields customer company directory',
      },
    ],
  },
  {
    groupId: 'operations',
    title: 'Projects & Workspace',
    tabs: [
      {
        id: 'projects',
        label: 'Projects & Delivery',
        icon: '📁',
        subtitle: 'Project categories & priority ratings',
        keywords: 'projects categories custom fields priorities billing delivery collaboration',
      },
      {
        id: 'project-statuses',
        label: 'Project Statuses',
        icon: '📌',
        subtitle: 'Custom delivery lifecycle stages',
        keywords: 'project statuses stages workflow planning in-progress on-hold completed cancelled',
      },
      {
        id: 'users',
        label: 'Users & Designations',
        icon: '🛡️',
        subtitle: 'Workspace team roles & permissions',
        keywords: 'users designations roles permissions rbac team members designations access security',
      },
    ],
  },
];

export const SettingsPage: React.FC = () => {
  const { hasPermission, loading: authLoading } = useAuth();
  const canManageSettings = hasPermission('crm.settings.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsTabId | null;
  const activeTab: SettingsTabId = SETTINGS_TABS.some((tab) => tab.id === tabParam)
    ? (tabParam as SettingsTabId)
    : 'general';

  const [tabFilter, setTabFilter] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [users, setUsers] = useState<SettingsWorkspaceUser[]>([]);
  const [emailStatus, setEmailStatus] = useState<SettingsEmailStatus | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [currencySelect, setCurrencySelect] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState('');
  const [permsUser, setPermsUser] = useState<SettingsWorkspaceUser | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const filteredTabGroups = useMemo(() => {
    const query = tabFilter.trim().toLowerCase();
    if (!query) return SETTINGS_TAB_GROUPS;
    return SETTINGS_TAB_GROUPS.map((group) => ({
      ...group,
      tabs: group.tabs.filter(
        (t) =>
          t.label.toLowerCase().includes(query) ||
          t.subtitle.toLowerCase().includes(query) ||
          t.keywords.toLowerCase().includes(query)
      ),
    })).filter((group) => group.tabs.length > 0);
  }, [tabFilter]);

  const filteredTabsCount = useMemo(() => {
    return filteredTabGroups.reduce((acc, g) => acc + g.tabs.length, 0);
  }, [filteredTabGroups]);

  const currentTabMeta = useMemo(() => {
    for (const group of SETTINGS_TAB_GROUPS) {
      const found = group.tabs.find((t) => t.id === activeTab);
      if (found) return found;
    }
    const fallback = SETTINGS_TABS.find((t) => t.id === activeTab);
    return fallback
      ? {
          id: fallback.id,
          label: fallback.label,
          icon: fallback.icon,
          subtitle: 'Settings & Preferences',
          keywords: '',
        }
      : null;
  }, [activeTab]);

  const currentGroupTitle = useMemo(() => {
    for (const group of SETTINGS_TAB_GROUPS) {
      if (group.tabs.some((t) => t.id === activeTab)) return group.title;
    }
    return 'Configuration';
  }, [activeTab]);

  const setTab = useCallback(
    (tab: SettingsTabId) => {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    const onTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: SettingsTabId }>).detail?.tab;
      if (tab && SETTINGS_TABS.some((item) => item.id === tab)) setTab(tab);
    };
    window.addEventListener('crm-settings-tour-tab', onTab as EventListener);
    return () => window.removeEventListener('crm-settings-tour-tab', onTab as EventListener);
  }, [setTab]);

  const load = useCallback(async () => {
    if (!canManageSettings) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const [settingsRes, usersRes, emailRes] = await Promise.all([
        crmApi.getSettings(),
        crmApi.listSettingsWorkspaceUsers(),
        crmApi.getSettingsEmailStatus(),
      ]);
      const data = settingsRes.data;
      setSettings(data);
      const known = SETTINGS_CURRENCIES.some((item) => item.code === data.default_currency);
      setCurrencySelect(known ? data.default_currency : 'CUSTOM');
      if (data?.default_currency) {
        setRuntimeDefaultCurrency(data.default_currency);
      }
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setEmailStatus(emailRes.data);
      setDirty(false);
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  }, [canManageSettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof CrmSettings>(key: K, value: CrmSettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setDirty(true);
  };

  const shippingRows = useMemo(
    () => Object.entries(settings?.state_shipping_rates || {}),
    [settings?.state_shipping_rates]
  );

  const filteredUsers = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    const term = userSearch.trim().toLowerCase();
    if (!term) return list;
    return list.filter((user) =>
      [user.name, user.username, user.email, user.role, user.designation]
        .some((value) => String(value || '').toLowerCase().includes(term))
    );
  }, [users, userSearch]);

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!settings) return;
    setMessage(null);

    const payload: Partial<CrmSettings> = {};

    if (activeTab === 'general') {
      const companyName = settings.company_name.trim();
      const companyState = settings.company_state.trim();
      // Prefer the Select value when not CUSTOM so USD/EUR is never lost on save.
      const currency = String(
        currencySelect && currencySelect !== 'CUSTOM'
          ? currencySelect
          : settings.default_currency || ''
      )
        .trim()
        .toUpperCase();
      if (!companyName) {
        return setMessage({ kind: 'error', text: 'Company name is required.' });
      }
      if (!companyState) {
        return setMessage({ kind: 'error', text: 'Company state is required.' });
      }
      if (!/^[A-Z]{3}$/.test(currency || 'INR')) {
        return setMessage({ kind: 'error', text: 'Currency must be a three-letter code.' });
      }
      if (settings.tax_rate < 0 || settings.tax_rate > 100) {
        return setMessage({ kind: 'error', text: 'Tax rate must be between 0 and 100.' });
      }
      payload.company_name = companyName;
      payload.company_state = companyState;
      payload.office_address = (settings.office_address || '').trim();
      payload.office_addresses = (settings.office_addresses || [])
        .map((a) => String(a || '').trim())
        .filter(Boolean);
      // Currency + tax live on General tab UI — must persist here (not only Finance).
      payload.default_currency = currency || 'INR';
      payload.tax_rate = Number(settings.tax_rate);
      payload.sample_units_of_measure = (settings.sample_units_of_measure || [])
        .map((u) => String(u || '').trim())
        .filter(Boolean);
      payload.courier_carriers = (settings.courier_carriers || [])
        .map((c) => String(c || '').trim())
        .filter(Boolean);
      payload.tracking_number_options = (settings.tracking_number_options || [])
        .map((t) => String(t || '').trim())
        .filter(Boolean);
    } else if (activeTab === 'shipping') {
      payload.state_shipping_rates = settings.state_shipping_rates || {};
      payload.free_shipping_threshold = Number(settings.free_shipping_threshold) || 0;
    } else if (activeTab === 'finance') {
      if (!settings.expense_categories?.length) {
        return setMessage({ kind: 'error', text: 'Expense categories cannot be empty.' });
      }
      payload.default_hourly_rate = Number(settings.default_hourly_rate) || 0;
      payload.quotation_valid_days = Number(settings.quotation_valid_days) || 30;
      payload.quotation_prefix = settings.quotation_prefix || 'QUO-';
      payload.sales_order_prefix = settings.sales_order_prefix || 'SO-';
      payload.invoice_prefix = settings.invoice_prefix || 'INV-';
      payload.payment_prefix = settings.payment_prefix || 'PAY-';
      payload.expense_prefix = settings.expense_prefix || 'EXP-';
      payload.client_tax_id_prefix = settings.client_tax_id_prefix || 'TAX-';
      payload.expense_categories = settings.expense_categories;
      payload.sales_order_generated_by_sources = settings.sales_order_generated_by_sources;
    } else if (activeTab === 'email') {
      payload.task_client_reminder_auto_enabled = Boolean(settings.task_client_reminder_auto_enabled);
      payload.task_client_reminder_hours = Number(settings.task_client_reminder_hours) || 24;
      payload.quotation_email_subject = settings.quotation_email_subject || '';
      payload.invoice_email_subject = settings.invoice_email_subject || '';
      payload.quotation_email_intro = settings.quotation_email_intro || '';
      payload.invoice_email_intro = settings.invoice_email_intro || '';
    } else if (activeTab === 'projects') {
      if (!settings.project_priorities?.length || !settings.project_categories?.length) {
        return setMessage({ kind: 'error', text: 'Project priorities and categories cannot be empty.' });
      }
      payload.project_priorities = settings.project_priorities;
      payload.project_categories = settings.project_categories;
      payload.project_tags = settings.project_tags;
      payload.project_custom_fields = settings.project_custom_fields;
    } else if (activeTab === 'project-statuses') {
      payload.project_statuses = mergeProjectStatusesWithBuiltins(settings.project_statuses);
    } else if (activeTab === 'leads') {
      const requiredLeadLists: Array<keyof CrmSettings> = [
        'lead_sources',
        'lead_statuses',
        'lead_types',
        'lead_priorities',
        'pipeline_stages',
      ];
      if (requiredLeadLists.some((key) => !(settings[key] as string[])?.length)) {
        return setMessage({ kind: 'error', text: 'Required lead option lists cannot be empty.' });
      }
      payload.pipeline_stages = settings.pipeline_stages;
      payload.lead_sources = settings.lead_sources;
      payload.lead_statuses = mergeLeadStatusesWithBuiltins(settings.lead_statuses);
      payload.lead_types = settings.lead_types;
      payload.lead_priorities = settings.lead_priorities;
      payload.lead_tags = settings.lead_tags;
      payload.lead_custom_fields = settings.lead_custom_fields;
    } else if (activeTab === 'clients') {
      payload.client_categories = settings.client_categories;
    } else {
      payload.company_name = settings.company_name;
      payload.company_state = settings.company_state;
    }

    setSaving(true);
    try {
      await crmApi.updateSettings(payload);
      // Re-load from API so UI reflects what was actually persisted (not stale INR).
      const refreshed = await crmApi.getSettings();
      const data = refreshed.data;
      setSettings(data);
      if (data?.default_currency) {
        const code = String(data.default_currency).trim().toUpperCase();
        const known = SETTINGS_CURRENCIES.some((item) => item.code === code);
        setCurrencySelect(known ? code : 'CUSTOM');
        setRuntimeDefaultCurrency(code);
        window.dispatchEvent(
          new CustomEvent(CRM_SETTINGS_CURRENCY_CHANGED, {
            detail: {
              default_currency: code,
              defaultCurrencyCode: code,
              defaultCurrencySymbol: getCurrencySymbol(code),
            },
          })
        );
      } else if (payload.default_currency) {
        const code = String(payload.default_currency).trim().toUpperCase();
        setRuntimeDefaultCurrency(code);
        window.dispatchEvent(
          new CustomEvent(CRM_SETTINGS_CURRENCY_CHANGED, {
            detail: {
              default_currency: code,
              defaultCurrencyCode: code,
              defaultCurrencySymbol: getCurrencySymbol(code),
            },
          })
        );
      }
      setDirty(false);
      setMessage({ kind: 'success', text: refreshed.message || 'Settings saved successfully.' });
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) return setMessage({ kind: 'error', text: 'Enter a test recipient email.' });
    setSaving(true);
    try {
      const response = await crmApi.sendSettingsTestEmail({ to: testEmail.trim() });
      setMessage({ kind: 'success', text: response.message || 'Test email queued.' });
      const status = await crmApi.getSettingsEmailStatus();
      setEmailStatus(status.data);
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to send test email',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveDesignation = async (userId: string, designation: string) => {
    setBusyUserId(userId);
    try {
      const response = await crmApi.updateSettingsUserDesignation(userId, { designation });
      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                ...response.data,
                id: user.id,
                permissions: Array.isArray(response.data?.permissions)
                  ? response.data.permissions
                  : user.permissions,
                permissionCategories: Array.isArray(response.data?.permissionCategories)
                  ? response.data.permissionCategories
                  : user.permissionCategories,
                designation: response.data?.designation ?? designation,
              }
            : user
        )
      );
      setMessage({ kind: 'success', text: response.message || 'Designation saved.' });
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to save designation',
      });
    } finally {
      setBusyUserId('');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="rounded-xl border border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
        Loading settings…
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div
        data-tour="settings-tour-landing"
        className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        You do not have permission to manage CRM settings (`crm.settings.manage`).
      </div>
    );
  }

  if (!settings) {
    return (
      <div
        data-tour="settings-tour-landing"
        className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        Settings could not be loaded.
      </div>
    );
  }

  // Not a <form>: nested panels (Pipelines, Request Types) have their own
  // saves. A wrapping form steals Enter/submit and never creates the pipeline.
  const hideGlobalSave =
    activeTab === 'opportunities' || activeTab === 'qualification-match';

  return (
    <div
      data-tour="settings-tour-landing"
      className="relative w-full space-y-5 pb-24"
    >
      <header className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end">
        <div data-tour="settings-title">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">
            Administration
          </p>
          <h1 className="m-0 text-2xl font-bold text-zinc-950">CRM Settings</h1>
          <p className="mb-0 mt-1 text-sm text-zinc-500">
            Configure company profile, logistics, finance, email, taxonomies, and workspace users.
          </p>
        </div>
        <div data-tour="settings-header-actions" className="flex flex-wrap items-center gap-2">
          <TourButton moduleId="settings" />
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              dirty
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
        </div>
      </header>

      {message && (
        <div
          role="alert"
          className={`rounded-lg border p-3 text-sm ${
            message.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left: Vertical Navigation Sidebar */}
        <aside
          data-tour="settings-tabs"
          className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-4 z-20 space-y-3"
        >
          {/* Mobile Collapsible Header Bar (visible on < lg screens) */}
          <div className="block lg:hidden rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-xs">
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-base text-white">
                  {currentTabMeta?.icon || '⚙️'}
                </span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Active Section ({currentGroupTitle})
                  </span>
                  <span className="block truncate text-sm font-bold text-zinc-900">
                    {currentTabMeta?.label || activeTab}
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                {mobileNavOpen ? 'Close Menu' : 'Switch Section'}
                <KeyboardArrowDownIcon
                  sx={{ fontSize: 18 }}
                  className={`transition-transform duration-200 ${mobileNavOpen ? 'rotate-180' : ''}`}
                />
              </span>
            </button>
          </div>

          {/* Full Vertical Navigation Card */}
          <div
            className={`${
              mobileNavOpen ? 'block' : 'hidden'
            } lg:block rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-xs space-y-3`}
          >
            {/* Header & Filter Search */}
            <div className="space-y-2 pb-2 border-b border-zinc-100">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Navigation
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                  {filteredTabsCount} / {SETTINGS_TABS.length} tabs
                </span>
              </div>
              <div className="relative">
                <SearchIcon
                  sx={{ fontSize: 16 }}
                  className="absolute left-2.5 top-2.5 text-zinc-400"
                />
                <input
                  type="text"
                  placeholder="Filter settings..."
                  value={tabFilter}
                  onChange={(e) => setTabFilter(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50/70 pl-8 pr-7 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 focus:bg-white transition-colors"
                />
                {tabFilter && (
                  <button
                    type="button"
                    onClick={() => setTabFilter('')}
                    className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    title="Clear filter"
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </button>
                )}
              </div>
            </div>

            {/* Grouped Vertical Tabs */}
            <nav className="space-y-3.5 max-h-[calc(100vh-230px)] overflow-y-auto pr-0.5">
              {filteredTabGroups.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400">
                  No settings match &ldquo;{tabFilter}&rdquo;.
                </div>
              ) : (
                filteredTabGroups.map((group) => (
                  <div key={group.groupId} className="space-y-1">
                    <div className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {group.title}
                    </div>
                    <div className="space-y-0.5">
                      {group.tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            data-tour={`settings-tab-${tab.id}`}
                            onClick={() => {
                              setTab(tab.id);
                              setMobileNavOpen(false);
                            }}
                            className={`group relative flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all cursor-pointer ${
                              isActive
                                ? 'bg-zinc-950 text-white shadow-xs'
                                : 'bg-transparent text-zinc-700 hover:bg-zinc-100/90 hover:text-zinc-950'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm transition-colors ${
                                  isActive
                                    ? 'bg-white/15 text-white'
                                    : 'bg-zinc-100 text-zinc-700 group-hover:bg-zinc-200/80 group-hover:text-zinc-950'
                                }`}
                              >
                                {tab.icon}
                              </span>
                              <div className="min-w-0">
                                <span
                                  className={`block truncate text-xs font-semibold ${
                                    isActive ? 'text-white' : 'text-zinc-900'
                                  }`}
                                >
                                  {tab.label}
                                </span>
                                <span
                                  className={`block truncate text-[10px] ${
                                    isActive
                                      ? 'text-zinc-300'
                                      : 'text-zinc-400 group-hover:text-zinc-500'
                                  }`}
                                >
                                  {tab.subtitle}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 transition-transform ${
                                isActive
                                  ? 'text-white opacity-100 translate-x-0'
                                  : 'text-zinc-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5'
                              }`}
                            >
                              <ChevronRightIcon sx={{ fontSize: 16 }} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </nav>

            {/* Footer status / quick save */}
            <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 px-1">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    dirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                {dirty ? 'Unsaved changes' : 'All synced'}
              </span>
              {!hideGlobalSave && dirty && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="text-xs font-semibold text-zinc-950 hover:underline cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save now'}
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Right: Active Settings Section Content */}
        <main className="flex-1 min-w-0 w-full space-y-5">
          {/* Active Tab Hero / Context Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-xl text-white shadow-xs">
                {currentTabMeta?.icon || '⚙️'}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  <span>Settings</span>
                  <span>/</span>
                  <span className="text-zinc-600">{currentGroupTitle}</span>
                </div>
                <h2 className="m-0 text-base font-bold text-zinc-950 truncate">
                  {currentTabMeta?.label || activeTab}
                </h2>
                <p className="m-0 text-xs text-zinc-500 truncate">
                  {currentTabMeta?.subtitle || 'Configure settings and preferences'}
                </p>
              </div>
            </div>
            {!hideGlobalSave && (
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border-0 bg-zinc-950 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                >
                  <SaveOutlinedIcon sx={{ fontSize: 16 }} />
                  {saving ? 'Saving…' : 'Save Section'}
                </button>
              </div>
            )}
          </div>

      {activeTab === 'general' && (
        <section data-tour="settings-general-profile" className={cardClass}>
          <h2 className="mt-0 text-base font-bold text-zinc-950">General & Company Profile</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label>
              <span className={labelClass}>Registered Company Name *</span>
              <input
                className={inputClass}
                maxLength={120}
                value={settings.company_name}
                onChange={(e) => update('company_name', e.target.value)}
                required
              />
            </label>
            <label>
              <span className={labelClass}>Company Origin State *</span>
              <select
                className={inputClass}
                value={settings.company_state}
                onChange={(e) => update('company_state', e.target.value)}
                required
              >
                <option value="">Select Origin State…</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
                {settings.company_state && !INDIAN_STATES.includes(settings.company_state) && (
                  <option value={settings.company_state}>{settings.company_state}</option>
                )}
              </select>
            </label>
            <label className="sm:col-span-2 lg:col-span-3">
              <span className={labelClass}>Office Address (Headquarters / Primary Dispatch Location)</span>
              <textarea
                rows={3}
                className="w-full box-border rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                maxLength={500}
                placeholder="Enter company registered office address (e.g. Plot 42, Tech Park, Andheri East, Mumbai, Maharashtra - 400069)…"
                value={settings.office_address || ''}
                onChange={(e) => update('office_address', e.target.value)}
              />
              <span className="mt-1 block text-[11px] text-zinc-500">
                This office address is written here to be easily selected as the stock and dispatch address across CRM modules (such as sample requests).
              </span>
            </label>
            <div className="sm:col-span-2 lg:col-span-3 border-t border-zinc-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className={labelClass}>Additional Office / Branch Locations</span>
                  <span className="text-[11px] text-zinc-500 block">
                    Add branch offices or regional dispatch centers so team members can pick them when approving sample requests.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const current = settings.office_addresses || [];
                    update('office_addresses', [...current, '']);
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  <AddIcon sx={{ fontSize: 16 }} /> Add Branch Office
                </button>
              </div>

              {(settings.office_addresses || []).length > 0 && (
                <div className="space-y-2 mt-2">
                  {(settings.office_addresses || []).map((addr, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className={inputClass}
                        placeholder={`Branch Office #${idx + 1} address…`}
                        value={addr}
                        onChange={(e) => {
                          const next = [...(settings.office_addresses || [])];
                          next[idx] = e.target.value;
                          update('office_addresses', next);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (settings.office_addresses || []).filter((_, i) => i !== idx);
                          update('office_addresses', next);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                        title="Remove branch location"
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label>
              <span className={labelClass}>Default Currency Select</span>
              <select
                className={inputClass}
                value={currencySelect}
                onChange={(e) => {
                  const value = e.target.value;
                  setCurrencySelect(value);
                  if (value !== 'CUSTOM') update('default_currency', value);
                }}
              >
                {SETTINGS_CURRENCIES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Default Currency Code *</span>
              <input
                className={monoClass}
                maxLength={3}
                value={settings.default_currency}
                onChange={(e) => {
                  setCurrencySelect('CUSTOM');
                  update('default_currency', e.target.value.toUpperCase());
                }}
                required
              />
            </label>
            <label>
              <span className={labelClass}>Standard Default Tax Rate (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                className={inputClass}
                value={settings.tax_rate}
                onChange={(e) => update('tax_rate', Number(e.target.value))}
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-3 border-t border-zinc-100 pt-4 mt-2">
              <ChipListEditor
                icon="📏"
                title="Sample Request - Units of Measure (UoM)"
                description="Configure units of measure available when adding sample products (e.g. pcs, kg, litre, meter, box, packet). These will be available in the sample request creation form."
                value={settings.sample_units_of_measure || ['pcs', 'kg', 'litre', 'meter', 'box', 'packet', 'roll', 'set', 'swatch', 'gram']}
                onChange={(next: string[]) => update('sample_units_of_measure', next)}
                placeholder="Add new unit (e.g. carton, pair, drum)…"
                accent="bg-emerald-50 text-emerald-800"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 border-t border-zinc-100 pt-4 mt-2">
              <ChipListEditor
                icon="🚚"
                title="Courier / Carrier Options"
                description="Configure courier and carrier names available when dispatching sample requests (e.g. BlueDart Express, Delhivery, FedEx)."
                value={
                  settings.courier_carriers || [
                    'BlueDart Express',
                    'Delhivery Logistics',
                    'Shiprocket Direct',
                    'FedEx Express',
                    'DTDC Courier',
                    'Professional Courier',
                    'Custom Courier',
                  ]
                }
                onChange={(next: string[]) => update('courier_carriers', next)}
                placeholder="Add courier / carrier name…"
                accent="bg-sky-50 text-sky-800"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 border-t border-zinc-100 pt-4 mt-2">
              <ChipListEditor
                icon="🔢"
                title="Tracking Number Options"
                description="Optional AWB / tracking number presets suggested when dispatching sample requests. Users can still enter a custom tracking number."
                value={settings.tracking_number_options || []}
                onChange={(next: string[]) => update('tracking_number_options', next)}
                placeholder="Add tracking number preset / prefix…"
                accent="bg-amber-50 text-amber-800"
              />
            </div>
          </div>
        </section>
      )}

      {activeTab === 'shipping' && (
        <section className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="mt-0 text-base font-bold text-zinc-950">Shipping & Delivery Matrix</h2>
              <p className="mb-0 mt-1 text-xs text-zinc-500">
                State-wise freight fees and free shipping threshold.
              </p>
            </div>
            <div data-tour="settings-shipping-actions" className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  update('state_shipping_rates', { ...STANDARD_STATE_SHIPPING_RATES });
                }}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700"
              >
                ⚡ Reset Standard Indian States
              </button>
              <button
                type="button"
                onClick={() => {
                  const rates = { ...(settings.state_shipping_rates || {}) };
                  let name = 'New State';
                  let i = 1;
                  while (rates[name]) {
                    name = `New State ${i++}`;
                  }
                  rates[name] = 100;
                  update('state_shipping_rates', rates);
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-slate-950 px-3 text-xs font-semibold text-white"
              >
                <AddIcon sx={{ fontSize: 16 }} /> Add State Rate
              </button>
            </div>
          </div>
          <div data-tour="settings-shipping-threshold" className="mt-4 max-w-sm">
            <label>
              <span className={labelClass}>
                Free Shipping Threshold Amount ({getCurrencySymbol(settings.default_currency)})
              </span>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={settings.free_shipping_threshold}
                onChange={(e) => update('free_shipping_threshold', Number(e.target.value))}
              />
            </label>
          </div>
          <div data-tour="settings-shipping-rates" className="mt-4 space-y-2">
            {shippingRows.map(([state, rate]) => (
              <div key={state} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto]">
                <input
                  className={inputClass}
                  value={state}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    const rates = { ...(settings.state_shipping_rates || {}) };
                    const currentRate = rates[state];
                    delete rates[state];
                    rates[nextName || 'Untitled'] = currentRate;
                    update('state_shipping_rates', rates);
                  }}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={inputClass}
                  value={rate}
                  onChange={(e) => {
                    const rates = { ...(settings.state_shipping_rates || {}) };
                    rates[state] = Number(e.target.value);
                    update('state_shipping_rates', rates);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const rates = { ...(settings.state_shipping_rates || {}) };
                    delete rates[state];
                    update('state_shipping_rates', rates);
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'finance' && (
        <div className="space-y-5">
          <section data-tour="settings-finance-prefixes" className={cardClass}>
            <h2 className="mt-0 text-base font-bold text-zinc-950">
              Finance, Billing & Document Prefixes
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {(
                [
                  ['quotation_prefix', 'Quotation Prefix *'],
                  ['sales_order_prefix', 'Sales Order Prefix'],
                  ['invoice_prefix', 'Invoice Prefix *'],
                  ['payment_prefix', 'Payment Receipt Prefix *'],
                  ['expense_prefix', 'Expense Voucher Prefix *'],
                  ['client_tax_id_prefix', 'Client Tax ID Prefix *'],
                ] as Array<[keyof CrmSettings, string]>
              ).map(([key, label]) => (
                <label key={key}>
                  <span className={labelClass}>{label}</span>
                  <input
                    maxLength={20}
                    className={monoClass}
                    value={String(settings[key] ?? '')}
                    onChange={(e) => update(key, e.target.value as never)}
                    required={key !== 'sales_order_prefix'}
                  />
                </label>
              ))}
              <label>
                <span className={labelClass}>Quotation Validity (Days)</span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className={inputClass}
                  value={settings.quotation_valid_days}
                  onChange={(e) => update('quotation_valid_days', Number(e.target.value))}
                />
              </label>
              <label>
                <span className={labelClass}>Default Billable Hourly Rate</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={inputClass}
                  value={settings.default_hourly_rate}
                  onChange={(e) => update('default_hourly_rate', Number(e.target.value))}
                />
              </label>
            </div>
          </section>
          <div data-tour="settings-finance-categories">
            <ChipListEditor
              title="Expense Classification Categories"
              description="Labels used when logging expenses so reports stay consistent."
              icon="🧾"
              accent="bg-zinc-100"
              value={settings.expense_categories}
              placeholder="e.g. Travel"
              onChange={(value) => update('expense_categories', value)}
            />
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <section className={cardClass}>
          <h2 className="mt-0 text-base font-bold text-zinc-950">
            Email Dispatcher & Automated Client Reminders
          </h2>
          <div
            data-tour="settings-email-status"
            className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
          >
            {emailStatus?.message || 'Email plugin status unknown.'}
            {emailStatus?.lastTestAt
              ? ` · Last test ${new Date(emailStatus.lastTestAt).toLocaleString()}`
              : ''}
          </div>
          <div className="mt-4 space-y-4">
            <div data-tour="settings-email-reminders" className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={settings.task_client_reminder_auto_enabled}
                  onChange={(e) => update('task_client_reminder_auto_enabled', e.target.checked)}
                />
                Enable Automatic Client Reminder Emailing
              </label>
              <div>
                <span className={labelClass}>Reminder Interval (Hours) *</span>
                <div className="mb-2 flex flex-wrap gap-2">
                  {REMINDER_HOUR_PRESETS.map((preset) => (
                    <button
                      key={preset.hours}
                      type="button"
                      onClick={() => update('task_client_reminder_hours', preset.hours)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        settings.task_client_reminder_hours === preset.hours
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-zinc-200 bg-white text-zinc-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={720}
                  className={`${inputClass} max-w-xs`}
                  value={settings.task_client_reminder_hours}
                  onChange={(e) => update('task_client_reminder_hours', Number(e.target.value))}
                />
              </div>
            </div>
            <div
              data-tour="settings-email-templates"
              className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            >
              <label>
                <span className={labelClass}>Quotation Email Subject</span>
                <input
                  maxLength={200}
                  className={inputClass}
                  value={settings.quotation_email_subject || ''}
                  onChange={(e) => update('quotation_email_subject', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Invoice Email Subject</span>
                <input
                  maxLength={200}
                  className={inputClass}
                  value={settings.invoice_email_subject || ''}
                  onChange={(e) => update('invoice_email_subject', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Quotation Email Body Intro</span>
                <textarea
                  maxLength={2000}
                  rows={3}
                  className={`${inputClass} h-auto py-2`}
                  value={settings.quotation_email_intro || ''}
                  onChange={(e) => update('quotation_email_intro', e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>Invoice Email Body Intro</span>
                <textarea
                  maxLength={2000}
                  rows={3}
                  className={`${inputClass} h-auto py-2`}
                  value={settings.invoice_email_intro || ''}
                  onChange={(e) => update('invoice_email_intro', e.target.value)}
                />
              </label>
            </div>
            <div
              data-tour="settings-email-test"
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <label className="flex-1">
                <span className={labelClass}>Test Recipient Email</span>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="admin@company.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void sendTest()}
                className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send Test Email
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-5" data-tour="settings-integrations">
          <GroqIntegrationPanel />
          <GoogleMapsIntegrationPanel />
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-5">
          <section
            data-tour="settings-projects-lists"
            className="grid grid-cols-1 gap-5 lg:grid-cols-2"
          >
            {(
              [
                [
                  'project_priorities',
                  'Project Priorities',
                  'Priority levels used across projects and related task views.',
                  '⚡',
                  'e.g. High',
                ],
                [
                  'project_categories',
                  'Project Categories',
                  'Group projects by type — Internal, Client Delivery, R&D…',
                  '📁',
                  'e.g. Client Delivery',
                ],
                [
                  'project_tags',
                  'Project Tags',
                  'Quick labels for segmentation and reporting.',
                  '🏷️',
                  'e.g. Retainer',
                ],
              ] as Array<[keyof CrmSettings, string, string, string, string]>
            ).map(([key, title, description, icon, placeholder]) => (
              <ChipListEditor
                key={key}
                title={title}
                description={description}
                icon={icon}
                accent="bg-zinc-100"
                value={settings[key] as string[]}
                placeholder={placeholder}
                onChange={(value) => update(key, value as never)}
              />
            ))}
          </section>
          <section data-tour="settings-projects-custom-fields" className={cardClass}>
            <CustomFieldBuilder
              title="Project Custom Fields"
              value={settings.project_custom_fields}
              onChange={(value) => update('project_custom_fields', value)}
            />
          </section>
        </div>
      )}

      {activeTab === 'project-statuses' && (
        <div data-tour="settings-project-statuses">
          <ProjectStatusesEditor
            value={settings.project_statuses}
            onChange={(value) => update('project_statuses', mergeProjectStatusesWithBuiltins(value))}
          />
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-5">
          <section
            data-tour="settings-leads-hero"
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
          >
            <div className="border-b border-zinc-100 bg-[linear-gradient(135deg,#fafafa_0%,#ffffff_55%,#f4f4f5_100%)] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                    <span>🎯</span> Lead intake & pipeline
                  </div>
                  <h2 className="m-0 text-xl font-bold tracking-tight text-zinc-950">
                    Configure how leads are captured and progressed
                  </h2>
                  <p className="mb-0 mt-2 text-sm leading-relaxed text-zinc-500">
                    Sources, statuses, tags, and pipeline stages power lead forms, Kanban, filters,
                    and conversion reports across the CRM.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: 'Sources', count: settings.lead_sources.length },
                    { label: 'Statuses', count: settings.lead_statuses.length },
                    { label: 'Types', count: settings.lead_types.length },
                    { label: 'Priorities', count: settings.lead_priorities.length },
                    { label: 'Tags', count: settings.lead_tags.length },
                    { label: 'Stages', count: settings.pipeline_stages.length },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="min-w-[88px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center"
                    >
                      <div className="text-lg font-bold text-zinc-950">{stat.count}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            data-tour="settings-leads-chips"
            className="grid grid-cols-1 gap-4 xl:grid-cols-3"
          >
            <ChipListEditor
              title="Lead Sources"
              description="Where prospects come from — Website, Referral, Ads, Trade Show…"
              icon="📡"
              accent="bg-zinc-100"
              value={settings.lead_sources}
              placeholder="e.g. Referral"
              onChange={(value) => update('lead_sources', value)}
            />
            <ChipListEditor
              title="Lead Statuses"
              description="Temperature + lifecycle labels — Hot, Warm, Cold, New, Contacted…"
              icon="📌"
              accent="bg-zinc-100"
              value={settings.lead_statuses}
              placeholder="e.g. Hot"
              onChange={(value) => update('lead_statuses', value)}
            />
            <ChipListEditor
              title="Lead Types"
              description="Classify leads as Organizational or Individual."
              icon="🧭"
              accent="bg-zinc-100"
              value={settings.lead_types}
              placeholder="e.g. Organizational"
              onChange={(value) => update('lead_types', value)}
            />
            <ChipListEditor
              title="Lead Priorities"
              description="Urgency levels shown on lead forms — Low, Medium, High, Urgent…"
              icon="⚡"
              accent="bg-zinc-100"
              value={settings.lead_priorities}
              placeholder="e.g. Critical"
              onChange={(value) => update('lead_priorities', value)}
            />
            <ChipListEditor
              title="Lead Tags"
              description="Quick labels for segmentation — Hot Lead, Inbound, Enterprise…"
              icon="🏷️"
              accent="bg-zinc-100"
              value={settings.lead_tags}
              placeholder="e.g. Hot Lead"
              onChange={(value) => update('lead_tags', value)}
            />
          </section>

          <div data-tour="settings-leads-pipeline">
            <PipelineStagesEditor
              value={settings.pipeline_stages}
              onChange={(value) => update('pipeline_stages', value)}
            />
          </div>

          <section data-tour="settings-leads-custom-fields" className={cardClass}>
            <div className="mb-4 flex items-start gap-3 border-b border-zinc-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-base">
                🧩
              </div>
              <div>
                <h3 className="m-0 text-sm font-bold text-zinc-950">Lead Custom Fields</h3>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-zinc-500">
                  Extra attributes on lead create/detail forms beyond the standard CRM fields.
                </p>
              </div>
            </div>
            <CustomFieldBuilder
              title="Configured fields"
              value={settings.lead_custom_fields}
              onChange={(value) => update('lead_custom_fields', value)}
            />
          </section>
        </div>
      )}

      {activeTab === 'qualification-match' && (
        <div className="space-y-5" data-tour="settings-qualification-match-tab">
          <RequestTypesPanel />
          <div className={`${cardClass} text-xs text-zinc-500`}>
            Tip: open a Request Type and use <strong className="text-zinc-800">Match catalog</strong>{' '}
            (or Edit → field match checkboxes) to choose which values qualify. Disabled request
            types stay available on existing leads but cannot be selected for new ones. Request type
            saves apply immediately and do not require the main Settings Save button.
          </div>
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="space-y-5" data-tour="settings-opportunities-tab">
          <OpportunityPipelinesPanel />
          <div className={`${cardClass} text-xs text-zinc-500`}>
            Tip: rename stage <strong className="text-zinc-800">labels</strong> freely — keep the
            correct <strong className="text-zinc-800">internal type</strong> (WON, LOST,
            QUOTATION_SENT, NEGOTIATION, …) so quotation and close workflows keep working. Pipeline
            saves here apply immediately and do not require the main Settings Save button.
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="space-y-5">
          <section
            data-tour="settings-clients-lists"
            className="grid grid-cols-1 gap-5 lg:grid-cols-2"
          >
            <ChipListEditor
              title="Client Categories"
              description="Classify accounts — Enterprise, SMB, Partner…"
              icon="📂"
              accent="bg-zinc-100"
              value={settings.client_categories}
              placeholder="e.g. Enterprise"
              onChange={(value) => update('client_categories', value)}
            />
            <ChipListEditor
              title="Client Tags"
              description="Quick labels for segmentation and filters on Clients."
              icon="🏷️"
              accent="bg-zinc-100"
              value={settings.client_tags}
              placeholder="e.g. VIP"
              onChange={(value) => update('client_tags', value)}
            />
          </section>
          <section data-tour="settings-clients-custom-fields" className={cardClass}>
            <CustomFieldBuilder
              title="Client Custom Fields"
              value={settings.client_custom_fields}
              onChange={(value) => update('client_custom_fields', value)}
            />
          </section>
        </div>
      )}

      {activeTab === 'users' && (
        <section className={cardClass}>
          <div
            data-tour="settings-users-toolbar"
            className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
          >
            <div>
              <h2 className="mt-0 text-base font-bold text-zinc-950">
                Workspace Users & Job Designations
              </h2>
              <p className="mb-0 mt-1 text-xs text-zinc-500">
                Assign titles used on quotes, projects, and audit timelines.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className={`${inputClass} sm:w-56`}
                placeholder="Filter users…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700"
              >
                <RefreshIcon sx={{ fontSize: 16 }} /> Refresh
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {DESIGNATION_PRESETS.map((preset) => (
              <span
                key={preset}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600"
              >
                + {preset}
              </span>
            ))}
          </div>
          <div data-tour="settings-users-table" className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Workspace User</th>
                  <th className="px-3 py-2 font-semibold">Job Designation</th>
                  <th className="px-3 py-2 font-semibold">System Role</th>
                  <th className="px-3 py-2 font-semibold">Permissions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-t border-zinc-100 align-top">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: user.bgColor || '#0f172a' }}
                        >
                          {user.initials || user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900">
                            {user.name}
                            {user.isCurrentUser ? (
                              <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                You
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {user.username}
                            {user.email ? ` · ${user.email}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 min-w-[240px]">
                      <div className="flex gap-2">
                        <input
                          maxLength={120}
                          className={inputClass}
                          value={user.designation || ''}
                          list={`designation-presets-${user.id}`}
                          onChange={(e) =>
                            setUsers((current) =>
                              current.map((item) =>
                                item.id === user.id
                                  ? { ...item, designation: e.target.value }
                                  : item
                              )
                            )
                          }
                        />
                        <datalist id={`designation-presets-${user.id}`}>
                          {DESIGNATION_PRESETS.map((preset) => (
                            <option key={preset} value={preset} />
                          ))}
                        </datalist>
                        <button
                          type="button"
                          disabled={busyUserId === user.id}
                          onClick={() => void saveDesignation(user.id, user.designation || '')}
                          className="h-9 shrink-0 rounded-lg border-0 bg-slate-950 px-3 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyUserId === user.id ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {DESIGNATION_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setUsers((current) =>
                                current.map((item) =>
                                  item.id === user.id ? { ...item, designation: preset } : item
                                )
                              )
                            }
                            className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                        {formatWorkspaceRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {(Array.isArray(user.permissions) ? user.permissions : []).length} perms
                        </span>
                        {(Array.isArray(user.permissionCategories)
                          ? user.permissionCategories
                          : []
                        )
                          .slice(0, 3)
                          .map((category) => (
                          <span
                            key={category}
                            className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-600"
                          >
                            {category}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPermsUser(user)}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700"
                        >
                          🔍 View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!hideGlobalSave && (
        <div
          data-tour="settings-sticky-save"
          className="sticky bottom-4 z-30 rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-lg backdrop-blur"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-zinc-500">
              {message?.kind === 'success'
                ? message.text
                : dirty
                  ? 'You have unsaved configuration changes.'
                  : 'Settings are up to date.'}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <SaveOutlinedIcon sx={{ fontSize: 18 }} />
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      )}
        </main>
      </div>

      {permsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-lg font-semibold text-zinc-950">Granted Permissions</h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">
                  {permsUser.name} · {formatWorkspaceRoleLabel(permsUser.role)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPermsUser(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-5">
              {(Array.isArray(permsUser.permissions) ? permsUser.permissions : []).length === 0 ? (
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  No permissions assigned for this role.
                </div>
              ) : (
                (Array.isArray(permsUser.permissions) ? permsUser.permissions : []).map(
                  (permission) => (
                    <div
                      key={permission}
                      className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700"
                    >
                      {permission}
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
