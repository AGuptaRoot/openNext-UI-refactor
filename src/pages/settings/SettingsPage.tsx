import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
import { SettingsTabIcon } from '../../components/icons/SettingsTabIcon';
import { ExtensionIframe } from '../../components/extensions/ExtensionIframe';
import { useExtensions } from '../../hooks/useExtensions';
import {
  Megaphone,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sliders,
  CalendarClock,
  Compass,
  FolderKanban,
  FolderOpen,
  Pin,
  Puzzle,
  Radar,
  Receipt,
  Ruler,
  Route,
  Search,
  Tag,
  Target,
  Truck,
  Zap,
  Pencil,
  Check,
  ExternalLink,
  MapPin,
  Navigation,
  Plane,
  Luggage,
  HeartHandshake,
  Blocks,
} from 'lucide-react';
import { ExtensionsPanel } from '../../components/settings/ExtensionsPanel';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { CRM_UI_VERSION } from '../../buildInfo';

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

function toItemString(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const obj = item as { label?: string; optionKey?: string; name?: string; value?: string };
    return String(obj.label || obj.name || obj.value || obj.optionKey || '').trim();
  }
  return String(item ?? '').trim();
}

function ChipListEditor({
  title,
  description,
  icon,
  accent,
  value,
  placeholder,
  onChange,
  fixedValues = [],
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  value: string[];
  placeholder?: string;
  onChange: (value: string[]) => void;
  fixedValues?: string[];
}) {
  const [draft, setDraft] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const stringValues = useMemo(() => {
    return (Array.isArray(value) ? value : []).map(toItemString).filter(Boolean);
  }, [value]);

  const addItem = () => {
    const next = draft.trim();
    if (!next) return;
    if (stringValues.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...stringValues, next]);
    setDraft('');
  };

  const removeItem = (index: number) => {
    const item = stringValues[index];
    if (fixedValues.some((f) => f.toLowerCase() === item.toLowerCase())) {
      return;
    }
    onChange(stringValues.filter((_, i) => i !== index));
  };

  return (
    <div className={`${cardClass} flex h-full flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="m-0 text-sm font-bold text-zinc-950">{title}</h3>
            <p className="mb-0 mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
          {stringValues.length}
        </span>
      </div>

      <div className="min-h-[72px] rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
        {stringValues.length === 0 ? (
          <p className="m-0 text-center text-xs text-zinc-400 py-4">No values yet — add the first one below.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stringValues.map((item, index) => {
              const isFixed = fixedValues.some((f) => f.toLowerCase() === item.toLowerCase());
              return (
                <span
                  key={`${item}-${index}`}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-3 text-xs font-semibold ${
                    isFixed
                      ? 'border-zinc-300 bg-zinc-100 pr-2.5 text-zinc-800'
                      : 'border-zinc-200 bg-white pr-1.5 text-zinc-800'
                  }`}
                >
                  <span className="truncate">{item}</span>
                  {isFixed ? (
                    <span
                      title="Fixed system activity type (cannot be removed)"
                      className="inline-flex text-[11px] text-zinc-400 select-none"
                    >
                      🔒
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border-0 bg-zinc-100 text-zinc-500 hover:bg-zinc-900 hover:text-white cursor-pointer"
                      aria-label={`Remove ${item}`}
                    >
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </button>
                  )}
                </span>
              );
            })}
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
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white cursor-pointer"
          >
            <AddIcon sx={{ fontSize: 16 }} /> Add
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowBulk((open) => !open)}
          className="self-start border-0 bg-transparent p-0 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer"
        >
          {showBulk ? 'Hide bulk edit' : 'Bulk edit (one per line)'}
        </button>
        {showBulk ? (
          <textarea
            className={`${inputClass} h-24 resize-y py-2`}
            value={listToLines(stringValues)}
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
                <Pin className="h-4 w-4 shrink-0" aria-hidden />
                <span>Project lifecycle</span>
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
                <Pencil className="h-[18px] w-[18px] shrink-0 text-zinc-700" aria-hidden />
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white">
            <Route className="h-[18px] w-[18px] shrink-0" aria-hidden />
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
        subtitle: 'Company details, office address & UoMs',
        keywords: 'company name tax gst state address office branch unit of measure uom pcs kg litre',
      },
      {
        id: 'modules',
        label: 'Modules & Features',
        subtitle: 'Toggle optional CRM modules on or off',
        keywords: 'modules optional features toggle expense marketing customer success data quality activate disable sidebar route',
      },
      {
        id: 'extensions',
        label: 'Extensions',
        subtitle: 'Product Sales or Project Delivery workspace',
        keywords: 'extensions product project plugin workspace mode request type pipeline upload enable disable sales orders projects tasks',
      },
      {
        id: 'shipping',
        label: 'Shipping & Logistics',
        subtitle: 'Origin state & regional freight tariffs',
        keywords: 'shipping origin state freight weight rate courier logistics tier delivery',
      },
      {
        id: 'finance',
        label: 'Finance & Banking',
        subtitle: 'Currencies, banking accounts & terms',
        keywords: 'finance currency inr usd bank account bank name ifsc iban account number payment terms',
      },
      {
        id: 'email',
        label: 'Email & SMTP',
        subtitle: 'Relay server & transactional routing',
        keywords: 'email smtp host port tls authentication sender from test email relay notification',
      },
      {
        id: 'integrations',
        label: 'Integrations & AI',
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
        subtitle: 'Lead sources, categories & tags',
        keywords: 'leads sources categories tags stages custom fields qualification capture',
      },
      {
        id: 'qualification-match',
        label: 'Qualification Match',
        subtitle: 'Commercial request types & budget bounds',
        keywords: 'qualification match request types budget min max budget commercial requirements dynamic forms',
      },
      {
        id: 'opportunities',
        label: 'Opportunity Pipelines',
        subtitle: 'Sales pipelines & conversion stages',
        keywords: 'opportunity deal pipeline stages kanban win probability stages revenue forecast',
      },
      {
        id: 'clients',
        label: 'Clients & Accounts',
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
        subtitle: 'Project categories & priority ratings',
        keywords: 'projects categories custom fields priorities billing delivery collaboration',
      },
      {
        id: 'project-statuses',
        label: 'Project Statuses',
        subtitle: 'Custom delivery lifecycle stages',
        keywords: 'project statuses stages workflow planning in-progress on-hold completed cancelled',
      },
      {
        id: 'users',
        label: 'Users & Designations',
        subtitle: 'Workspace team roles & permissions',
        keywords: 'users designations roles permissions rbac team members designations access security',
      },
    ],
  },
];

export const SettingsPage: React.FC = () => {
  const { hasPermission, loading: authLoading, refreshAuth } = useAuth();
  const canManageSettings = useMemo(() => hasPermission('crm.settings.manage'), [hasPermission]);
  const { settingsTabs } = useExtensions();
  /*
   * The active CRM extension (Settings → Extensions) decides which settings
   * tabs make sense: Product Sales has no Projects/Tasks/Time Logs, so the
   * project tabs go; Project Delivery has no Sales Orders or shipments, so
   * Shipping & Logistics goes.
   */
  const { extension: activeExtension, showProjects, showSalesOrders } = useActiveExtension();
  const hiddenSettingsTabs = useMemo(() => {
    const hidden = new Set<string>();
    if (!showProjects) {
      hidden.add('projects');
      hidden.add('project-statuses');
    }
    if (!showSalesOrders) hidden.add('shipping');
    return hidden;
  }, [showProjects, showSalesOrders]);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsTabId | null;
  const knownCoreTabs =
    SETTINGS_TABS.some((tab) => tab.id === tabParam) && !hiddenSettingsTabs.has(String(tabParam));
  const knownExtTab = settingsTabs.some(
    (tab) => tab.tabId === tabParam || (tab.key === 'travel' && tabParam === 'travel')
  );
  const activeTab: SettingsTabId =
    tabParam && (knownCoreTabs || knownExtTab || tabParam === 'travel' || String(tabParam).includes('travel'))
      ? (tabParam as SettingsTabId)
      : 'general';

  const isTravelTab =
    activeTab === 'travel' ||
    (typeof activeTab === 'string' && (activeTab.includes('crm-travel') || activeTab.includes('travel')));

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

  // Travel Tab: Locations (From / To / Destination)
  const [travelLocations, setTravelLocations] = useState<{
    from: string[];
    to: string[];
    destination: string[];
  }>({
    from: [],
    to: [],
    destination: [],
  });
  const [savingTravelLocations, setSavingTravelLocations] = useState(false);
  const [travelLocationsDirty, setTravelLocationsDirty] = useState(false);

  // Travel Tab: Service Requirements
  const [travelServices, setTravelServices] = useState<string[]>([]);
  const [savingTravelServices, setSavingTravelServices] = useState(false);
  const [savingQualifyPrompt, setSavingQualifyPrompt] = useState(false);
  const [travelServicesDirty, setTravelServicesDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    crmApi.getTravelLocations().then((res) => {
      if (cancelled) return;
      if (res.data) {
        setTravelLocations({
          from: Array.isArray(res.data.from) ? res.data.from.map(toItemString).filter(Boolean) : [],
          to: Array.isArray(res.data.to) ? res.data.to.map(toItemString).filter(Boolean) : [],
          destination: Array.isArray(res.data.destination) ? res.data.destination.map(toItemString).filter(Boolean) : [],
        });
      }
    });
    crmApi.getTravelServices().then((res) => {
      if (cancelled) return;
      if (res.data && Array.isArray(res.data)) {
        setTravelServices(res.data.map(toItemString).filter(Boolean));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateTravelLocations = (key: 'from' | 'to' | 'destination', values: string[]) => {
    setTravelLocations((prev) => ({ ...prev, [key]: values }));
    setTravelLocationsDirty(true);
    setDirty(true);
  };

  /**
   * The Qualification Match tab hides the global Save bar (its panels save
   * themselves), so this one checkbox carries its own save.
   */
  const handleSaveQualifyPrompt = async () => {
    if (!settings) return;
    setSavingQualifyPrompt(true);
    try {
      await crmApi.updateSettings({
        qualification_prompt_on_requirement_save:
          settings.qualification_prompt_on_requirement_save,
      });
      setMessage({ kind: 'success', text: 'Qualification stage prompt saved' });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to save the qualification stage prompt',
      });
    } finally {
      setSavingQualifyPrompt(false);
    }
  };

  const handleSaveTravelLocations = async () => {
    setSavingTravelLocations(true);
    try {
      await crmApi.saveTravelLocations(travelLocations);
      setTravelLocationsDirty(false);
      setMessage({ kind: 'success', text: 'Travel locations saved successfully' });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to save travel locations',
      });
    } finally {
      setSavingTravelLocations(false);
    }
  };

  const updateTravelServices = (values: string[]) => {
    setTravelServices(values);
    setTravelServicesDirty(true);
    setDirty(true);
  };

  const handleSaveTravelServices = async () => {
    setSavingTravelServices(true);
    try {
      await crmApi.saveTravelServices(travelServices);
      setTravelServicesDirty(false);
      setMessage({ kind: 'success', text: 'Travel service requirements saved successfully' });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to save travel service requirements',
      });
    } finally {
      setSavingTravelServices(false);
    }
  };

  const filteredTabGroups = useMemo(() => {
    const query = tabFilter.trim().toLowerCase();
    const extensionGroup =
      settingsTabs.length > 0
        ? {
            groupId: 'extensions',
            title: 'Extensions',
            tabs: settingsTabs.map((tab) => {
              const isThisTravel =
                tab.key === 'travel' ||
                tab.extensionId === 'crm-travel' ||
                /travel/i.test(tab.tabId);
              const label = isThisTravel ? 'Travel' : tab.label.replace(/^ext__[^_]+__/, '');
              return {
                id: tab.tabId as SettingsTabId,
                label,
                subtitle: isThisTravel ? 'Locations (To/From/Destination) & options' : `From ${tab.extensionId}`,
                keywords: `extension add-on ${tab.extensionId} ${tab.label} ${tab.key} travel locations to from destination`,
              };
            }),
          }
        : null;

    const allGroups = extensionGroup
      ? [...SETTINGS_TAB_GROUPS, extensionGroup]
      : SETTINGS_TAB_GROUPS;

    // Drop the tabs the active CRM extension has no use for, then empty groups.
    const base = allGroups
      .map((group) => ({
        ...group,
        tabs: group.tabs.filter((t) => !hiddenSettingsTabs.has(String(t.id))),
      }))
      .filter((group) => group.tabs.length > 0);

    if (!query) return base;
    return base
      .map((group) => ({
        ...group,
        tabs: group.tabs.filter(
          (t) =>
            t.label.toLowerCase().includes(query) ||
            t.subtitle.toLowerCase().includes(query) ||
            t.keywords.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.tabs.length > 0);
  }, [tabFilter, settingsTabs, hiddenSettingsTabs]);

  const filteredTabsCount = useMemo(() => {
    return filteredTabGroups.reduce((acc, g) => acc + g.tabs.length, 0);
  }, [filteredTabGroups]);

  const currentTabMeta = useMemo(() => {
    for (const group of SETTINGS_TAB_GROUPS) {
      const found = group.tabs.find((t) => t.id === activeTab);
      if (found) return found;
    }
    const extTab = settingsTabs.find(
      (t) =>
        t.tabId === activeTab ||
        (activeTab === 'travel' && (t.key === 'travel' || t.extensionId === 'crm-travel'))
    );
    if (extTab || isTravelTab) {
      return {
        id: (extTab?.tabId || activeTab) as SettingsTabId,
        label: isTravelTab ? 'Travel' : (extTab?.label || String(activeTab)).replace(/^ext__[^_]+__/, ''),
        subtitle: isTravelTab
          ? 'Configure Travel locations (From, To, Destination) and booking options'
          : `Settings owned by extension ${extTab?.extensionId || 'extension'}`,
        keywords: '',
      };
    }
    const fallback = SETTINGS_TABS.find((t) => t.id === activeTab);
    return fallback
      ? {
          id: fallback.id,
          label: fallback.label,
          subtitle: 'Settings & Preferences',
          keywords: '',
        }
      : null;
  }, [activeTab, settingsTabs, isTravelTab]);

  const currentGroupTitle = useMemo(() => {
    for (const group of filteredTabGroups) {
      if (group.tabs.some((t) => t.id === activeTab)) return group.title;
    }
    if (String(activeTab).startsWith('ext__') || activeTab === 'travel') return 'Extensions';
    return 'Configuration';
  }, [activeTab, filteredTabGroups]);

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
    if (authLoading) return;
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
  }, [authLoading, canManageSettings]);

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

    if (activeTab === 'modules') {
      const raw = settings.enabled_modules || {};
      payload.enabled_modules = {
        expenses: Boolean(raw.expenses),
        marketing: Boolean(raw.marketing),
        customer_success: Boolean(raw.customer_success || raw.customerSuccess),
        data_quality: Boolean(raw.data_quality || raw.dataQuality),
      };
    } else if (activeTab === 'general') {
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
      payload.proforma_advance_enabled = Boolean(settings.proforma_advance_enabled);
      payload.quotation_auto_accept_on_payment = Boolean(settings.quotation_auto_accept_on_payment);
      payload.auto_convert_proforma_on_delivery = Boolean(settings.auto_convert_proforma_on_delivery);
      payload.proforma_prefix = String(settings.proforma_prefix || 'PI-').trim();
      payload.default_advance_percent = Number(settings.default_advance_percent) || 30;
      payload.sample_units_of_measure = (settings.sample_units_of_measure || [])
        .map((u) => String(u || '').trim())
        .filter(Boolean);
      payload.courier_carriers = (settings.courier_carriers || [])
        .map((c) => String(c || '').trim())
        .filter(Boolean);
      payload.proforma_advance_enabled = Boolean(settings.proforma_advance_enabled);
      payload.quotation_auto_accept_on_payment = Boolean(settings.quotation_auto_accept_on_payment);
      payload.proforma_prefix = (settings.proforma_prefix || 'PI-').trim();
      payload.default_advance_percent = Math.max(1, Math.min(100, Number(settings.default_advance_percent) || 30));
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
        'activity_types',
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
      payload.activity_types = settings.activity_types;
      payload.lead_custom_fields = settings.lead_custom_fields;
    } else if (activeTab === 'clients') {
      payload.client_categories = settings.client_categories;
    } else if (isTravelTab) {
      await Promise.all([handleSaveTravelLocations(), handleSaveTravelServices()]);
      return;
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
      try {
        await refreshAuth?.();
      } catch {
        /* non-blocking */
      }
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
    activeTab === 'opportunities' ||
    activeTab === 'qualification-match' ||
    activeTab === 'extensions';

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
          {/* Which CRM extension shapes this workspace — and which UI build is loaded. */}
          <button
            type="button"
            onClick={() => setTab('extensions')}
            title={`Active extension · UI build ${CRM_UI_VERSION}. Click to manage extensions.`}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 cursor-pointer hover:bg-blue-100"
          >
            <Blocks className="h-3.5 w-3.5" aria-hidden />
            {activeExtension.name}
            <span className="font-mono text-[10px] font-medium text-blue-500">v{CRM_UI_VERSION}</span>
          </button>
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
                  <SettingsTabIcon tabId={activeTab} className="h-[18px] w-[18px] shrink-0 text-white" />
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
                                <SettingsTabIcon tabId={tab.id} className="h-4 w-4 shrink-0" />
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
                <SettingsTabIcon tabId={activeTab} className="h-[18px] w-[18px] shrink-0 text-white" />
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

      {activeTab === 'extensions' && (
        <ExtensionsPanel
          onChanged={() => {
            void refreshAuth();
            void load();
          }}
        />
      )}

      {activeTab === 'modules' && (() => {
        const isExpEnabled = Boolean(settings.enabled_modules?.expenses);
        const isMktEnabled = Boolean(settings.enabled_modules?.marketing);
        const isCsEnabled = Boolean(
          settings.enabled_modules?.customer_success || settings.enabled_modules?.customerSuccess
        );
        const isDqEnabled = Boolean(settings.enabled_modules?.data_quality || settings.enabled_modules?.dataQuality);

        const setMod = (k: 'expenses' | 'marketing' | 'customer_success' | 'data_quality', val: boolean) => {
          setSettings((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              enabled_modules: {
                ...(prev.enabled_modules || {}),
                [k]: val,
                ...(k === 'data_quality' ? { dataQuality: val } : {}),
                ...(k === 'customer_success' ? { customerSuccess: val } : {}),
              },
            };
          });
          setDirty(true);
        };

        return (
          <section className={cardClass}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-zinc-100 pb-4 mb-6">
              <div>
                <h2 className="mt-0 text-base font-bold text-zinc-950 flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-blue-600" />
                  <span>Optional Modules & System Features</span>
                </h2>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed max-w-2xl">
                  Enable or disable optional CRM modules for your workspace. Optional modules are disabled by default. When a module is turned off, its navigation link is automatically hidden from the sidebar menu, and its URL route is secured so unauthorized or disabled access is blocked.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Live Dynamic Sync
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* 1. Expenses Module */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isExpEnabled
                  ? 'border-blue-300 bg-blue-50/20 shadow-xs'
                  : 'border-zinc-200 bg-zinc-50/60'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isExpEnabled
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-zinc-200 text-zinc-500'
                    }`}>
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-950 m-0">Expense Management & Approvals</h3>
                        {isExpEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-200 text-zinc-700 border border-zinc-300">
                            <XCircle className="h-3 w-3" /> Disabled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 leading-relaxed mb-0">
                        Record employee travel expenses, multi-level management approvals, billable client costs, and expense claims.
                      </p>
                      <div className="mt-2 text-[11px] text-zinc-400 font-mono">
                        Route: <span className="font-semibold text-zinc-600">/expenses</span> &middot; Sidebar: <span className="font-semibold text-zinc-600">Expenses</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-xl border border-zinc-200 bg-white shadow-xs shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setMod('expenses', true)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isExpEnabled
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-transparent'
                      }`}
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => setMod('expenses', false)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !isExpEnabled
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-transparent'
                      }`}
                    >
                      Disable
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Marketing Automation */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isMktEnabled
                  ? 'border-purple-300 bg-purple-50/20 shadow-xs'
                  : 'border-zinc-200 bg-zinc-50/60'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isMktEnabled
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-zinc-200 text-zinc-500'
                    }`}>
                      <Megaphone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-950 m-0">Marketing Automation</h3>
                        {isMktEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-200 text-zinc-700 border border-zinc-300">
                            <XCircle className="h-3 w-3" /> Disabled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 leading-relaxed mb-0">
                        Email marketing campaigns, audience segments, outbound broadcasts, and lead nurture workflows.
                      </p>
                      <div className="mt-2 text-[11px] text-zinc-400 font-mono">
                        Route: <span className="font-semibold text-zinc-600">/marketing</span> &middot; Sidebar: <span className="font-semibold text-zinc-600">Marketing</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-xl border border-zinc-200 bg-white shadow-xs shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setMod('marketing', true)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isMktEnabled
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-transparent'
                      }`}
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => setMod('marketing', false)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !isMktEnabled
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-transparent'
                      }`}
                    >
                      Disable
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Customer Success */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isCsEnabled
                  ? 'border-rose-300 bg-rose-50/20 shadow-xs'
                  : 'border-zinc-200 bg-zinc-50/60'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isCsEnabled
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-zinc-200 text-zinc-500'
                    }`}>
                      <HeartHandshake className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-950 m-0">Customer Success</h3>
                        {isCsEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-200 text-zinc-700 border border-zinc-300">
                            <XCircle className="h-3 w-3" /> Disabled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 leading-relaxed mb-0">
                        Client health scores, churn-risk warnings, satisfaction reviews and renewal follow-ups.
                      </p>
                      <div className="mt-2 text-[11px] text-zinc-400 font-mono">
                        Route: <span className="font-semibold text-zinc-600">/customer-success</span> &middot; Sidebar: <span className="font-semibold text-zinc-600">Customer Success</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-xl border border-zinc-200 bg-white shadow-xs shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setMod('customer_success', true)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isCsEnabled
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-transparent'
                      }`}
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => setMod('customer_success', false)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !isCsEnabled
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-transparent'
                      }`}
                    >
                      Disable
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Data Quality & Deduplication */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isDqEnabled
                  ? 'border-emerald-300 bg-emerald-50/20 shadow-xs'
                  : 'border-zinc-200 bg-zinc-50/60'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isDqEnabled
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-zinc-200 text-zinc-500'
                    }`}>
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-950 m-0">Data Quality &amp; Hygiene</h3>
                        {isDqEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-200 text-zinc-700 border border-zinc-300">
                            <XCircle className="h-3 w-3" /> Disabled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 leading-relaxed mb-0">
                        Automated lead and client record completeness scoring, field validation hygiene, and duplicate detection.
                      </p>
                      <div className="mt-2 text-[11px] text-zinc-400 font-mono">
                        Route: <span className="font-semibold text-zinc-600">/data-quality</span> &middot; Sidebar: <span className="font-semibold text-zinc-600">Data Quality</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-xl border border-zinc-200 bg-white shadow-xs shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setMod('data_quality', true)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isDqEnabled
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-transparent'
                      }`}
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => setMod('data_quality', false)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !isDqEnabled
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 bg-transparent'
                      }`}
                    >
                      Disable
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {activeTab === 'general' && (
        <section data-tour="settings-general-profile" className={cardClass}>
          <h2 className="mt-0 text-base font-bold text-zinc-950">General & Company Profile</h2>

          {/*
            Proforma & advance payment — one switch for the whole feature, off
            by default. Turning it off hides the quotation payment options and
            blocks new proformas, and keeps everything already recorded.
          */}
          <section className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <span className="block text-sm font-semibold text-zinc-950">
                  Enable Proforma &amp; Advance Payment
                </span>
                <span className="mt-0.5 block text-xs text-zinc-600">
                  Lets a quotation be paid in full or as an advance. A proforma invoice is raised
                  for the payment, it is recorded in Payments, and it later converts into a tax
                  invoice for the full value with the advance carried across. Existing proformas
                  and payments are never deleted when this is switched off.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 rounded-lg border border-zinc-200 bg-white p-1">
                <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  settings.proforma_advance_enabled ? 'bg-blue-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}>
                  <input
                    type="radio"
                    name="proforma_advance_enabled"
                    className="sr-only"
                    checked={Boolean(settings.proforma_advance_enabled)}
                    onChange={() => update('proforma_advance_enabled', true)}
                  />
                  <span>ON</span>
                </label>
                <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  !settings.proforma_advance_enabled ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}>
                  <input
                    type="radio"
                    name="proforma_advance_enabled"
                    className="sr-only"
                    checked={!settings.proforma_advance_enabled}
                    onChange={() => update('proforma_advance_enabled', false)}
                  />
                  <span>OFF</span>
                </label>
              </div>
            </div>

            {settings.proforma_advance_enabled ? (
              <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-3">
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-zinc-950">
                      Auto-accept quotation on successful payment
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-600">
                      A successful payment also accepts the quotation, which marks the opportunity
                      Won and locks the deal. Leave this off to take the money and accept the
                      quotation as a separate, deliberate step.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                    <label className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      settings.quotation_auto_accept_on_payment ? 'bg-blue-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                    }`}>
                      <input
                        type="radio"
                        name="quotation_auto_accept_on_payment"
                        className="sr-only"
                        checked={Boolean(settings.quotation_auto_accept_on_payment)}
                        onChange={() => update('quotation_auto_accept_on_payment', true)}
                      />
                      <span>ON</span>
                    </label>
                    <label className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      !settings.quotation_auto_accept_on_payment ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                    }`}>
                      <input
                        type="radio"
                        name="quotation_auto_accept_on_payment"
                        className="sr-only"
                        checked={!settings.quotation_auto_accept_on_payment}
                        onChange={() => update('quotation_auto_accept_on_payment', false)}
                      />
                      <span>OFF</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-3">
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-zinc-950">
                      Auto convert Proforma to Tax Invoice when Sales Order is marked Delivered
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-600">
                      When all shipments on the sales order are delivered, automatically convert the eligible proforma into a final tax invoice and carry advance payments across. Leave this off to convert manually.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                    <label className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      settings.auto_convert_proforma_on_delivery ? 'bg-blue-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                    }`}>
                      <input
                        type="radio"
                        name="auto_convert_proforma_on_delivery"
                        className="sr-only"
                        checked={Boolean(settings.auto_convert_proforma_on_delivery)}
                        onChange={() => update('auto_convert_proforma_on_delivery', true)}
                      />
                      <span>ON</span>
                    </label>
                    <label className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      !settings.auto_convert_proforma_on_delivery ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                    }`}>
                      <input
                        type="radio"
                        name="auto_convert_proforma_on_delivery"
                        className="sr-only"
                        checked={!settings.auto_convert_proforma_on_delivery}
                        onChange={() => update('auto_convert_proforma_on_delivery', false)}
                      />
                      <span>OFF</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label>
                    <span className={labelClass}>Proforma Number Prefix</span>
                    <input
                      className={inputClass}
                      maxLength={12}
                      value={settings.proforma_prefix}
                      onChange={(e) => update('proforma_prefix', e.target.value)}
                      placeholder="PI-"
                    />
                    <span className="mt-1 block text-[11px] text-zinc-500">
                      Its own series, so a proforma never uses a tax-invoice number.
                    </span>
                  </label>
                  <label>
                    <span className={labelClass}>Default Advance %</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className={inputClass}
                      value={settings.default_advance_percent}
                      onChange={(e) => update('default_advance_percent', Number(e.target.value) || 0)}
                    />
                    <span className="mt-1 block text-[11px] text-zinc-500">
                      Suggested on a quotation; staff can override it per quotation.
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              <p className="m-0 mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
                While this is off, quotations follow the normal approval flow only: Draft → Sent →
                Accepted → Opportunity Won → Sales Order. A payment never accepts a quotation.
              </p>
            )}
          </section>
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
                icon={<Ruler className="h-[18px] w-[18px] shrink-0" aria-hidden />}
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
                icon={<Truck className="h-[18px] w-[18px] shrink-0" aria-hidden />}
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
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-4 w-4 shrink-0" aria-hidden />
                  Reset Standard Indian States
                </span>
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
                  // Sales Orders exist only under the Product Sales extension.
                  ...(showSalesOrders ? [['sales_order_prefix', 'Sales Order Prefix']] : []),
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
              {/* Billable hours belong to Time Logs, a Project Delivery module. */}
              {showProjects && (
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
              )}
            </div>
          </section>
          <div data-tour="settings-finance-categories">
            <ChipListEditor
              title="Expense Classification Categories"
              description="Labels used when logging expenses so reports stay consistent."
              icon={<Receipt className="h-[18px] w-[18px] shrink-0" aria-hidden />}
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
            {/* Task reminders belong to Tasks, a Project Delivery module. */}
            {showProjects && (
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
            )}
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
                  <Zap key="prio" className="h-[18px] w-[18px] shrink-0" aria-hidden />,
                  'e.g. High',
                ],
                [
                  'project_categories',
                  'Project Categories',
                  'Group projects by type — Internal, Client Delivery, R&D…',
                  <FolderKanban key="cat" className="h-[18px] w-[18px] shrink-0" aria-hidden />,
                  'e.g. Client Delivery',
                ],
                [
                  'project_tags',
                  'Project Tags',
                  'Quick labels for segmentation and reporting.',
                  <Tag key="tag" className="h-[18px] w-[18px] shrink-0" aria-hidden />,
                  'e.g. Retainer',
                ],
              ] as Array<[keyof CrmSettings, string, string, React.ReactNode, string]>
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
                    <Target className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Lead intake & pipeline</span>
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
                    { label: 'Activities', count: settings.activity_types.length },
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
              icon={<Radar className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-zinc-100"
              value={settings.lead_sources}
              placeholder="e.g. Referral"
              onChange={(value) => update('lead_sources', value)}
            />
            <ChipListEditor
              title="Lead Statuses"
              description="Temperature + lifecycle labels — Hot, Warm, Cold, New, Contacted…"
              icon={<Pin className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-zinc-100"
              value={settings.lead_statuses}
              placeholder="e.g. Hot"
              onChange={(value) => update('lead_statuses', value)}
            />
            <ChipListEditor
              title="Lead Types"
              description="Classify leads as Organizational or Individual."
              icon={<Compass className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-zinc-100"
              value={settings.lead_types}
              placeholder="e.g. Organizational"
              onChange={(value) => update('lead_types', value)}
            />
            <ChipListEditor
              title="Lead Priorities"
              description="Urgency levels shown on lead forms — Low, Medium, High, Urgent…"
              icon={<Zap className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-zinc-100"
              value={settings.lead_priorities}
              placeholder="e.g. Critical"
              onChange={(value) => update('lead_priorities', value)}
            />
            <ChipListEditor
              title="Lead Tags"
              description="Quick labels for segmentation — Hot Lead, Inbound, Enterprise…"
              icon={<Tag className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-zinc-100"
              value={settings.lead_tags}
              placeholder="e.g. Hot Lead"
              onChange={(value) => update('lead_tags', value)}
            />
            <ChipListEditor
              title="Activity Types"
              description="Interaction types on the lead Activities tab — Call, Meeting, Follow up, WhatsApp…"
              icon={<CalendarClock className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-zinc-100"
              value={settings.activity_types}
              placeholder="e.g. Site Visit"
              fixedValues={['Call', 'Meeting', 'Follow up', 'WhatsApp']}
              onChange={(value) => update('activity_types', value)}
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                <Puzzle className="h-[18px] w-[18px] shrink-0 text-zinc-700" aria-hidden />
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
          <section className={cardClass} data-tour="settings-qualify-prompt">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="m-0 text-base font-bold text-zinc-950">
                  Stage prompt after a commercial requirement save
                </h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">
                  Saving a lead's commercial requirement already moves it to Contacted. Turn this
                  on to also be asked whether the lead should go to Qualified — the rep answers
                  Yes or No on the lead page, so the stage never changes on its own.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-semibold text-zinc-800">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={settings.qualification_prompt_on_requirement_save}
                    onChange={(e) =>
                      update('qualification_prompt_on_requirement_save', e.target.checked)
                    }
                  />
                  <span>
                    Ask to convert the lead stage to Qualified after saving the commercial
                    requirement
                  </span>
                </label>
              </div>
              <button
                type="button"
                onClick={handleSaveQualifyPrompt}
                disabled={savingQualifyPrompt}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-none cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{savingQualifyPrompt ? 'Saving…' : 'Save prompt setting'}</span>
              </button>
            </div>
          </section>

          <RequestTypesPanel />
          <div className={`${cardClass} text-xs text-zinc-500`}>
            Tip: open a Request Type and use <strong className="text-zinc-800">Match catalog</strong>{' '}
            (or Edit → field match checkboxes) to choose which values qualify. Disabled request
            types stay available on existing leads but cannot be selected for new ones. Request type
            saves apply immediately and do not require the main Settings Save button.
          </div>
        </div>
      )}

      {isTravelTab && (
        <div className="space-y-6" data-tour="settings-travel-tab">
          <section className={cardClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Plane className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="m-0 text-base font-bold text-zinc-950">Travel Locations & Routing</h2>
                  <p className="mb-0 mt-1 text-xs text-zinc-500">
                    Configure origin ('From'), arrival ('To'), and holiday tour ('Destination') options.
                    These options populate dropdown selectors on Lead Travel forms and Travel requirement modules.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/travel-requirement"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 no-underline transition-colors shadow-none"
                >
                  <span>Travel requirement module</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                </Link>
                <button
                  type="button"
                  onClick={handleSaveTravelLocations}
                  disabled={savingTravelLocations}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-none cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {savingTravelLocations
                      ? 'Saving…'
                      : travelLocationsDirty
                        ? 'Save Locations *'
                        : 'Save Locations'}
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section
            data-tour="settings-travel-locations-chips"
            className="grid grid-cols-1 gap-5 xl:grid-cols-3"
          >
            <ChipListEditor
              title="From Locations"
              description="Departure cities & pickup points (e.g. Mumbai, Delhi, Bengaluru, Chennai…)"
              icon={<Compass className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-blue-50 text-blue-600"
              value={travelLocations.from}
              placeholder="e.g. Mumbai"
              onChange={(value) => updateTravelLocations('from', value)}
            />
            <ChipListEditor
              title="To Locations"
              description="Arrival cities & transit hubs (e.g. Goa, Dubai, Bangkok, London…)"
              icon={<Navigation className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-emerald-50 text-emerald-600"
              value={travelLocations.to}
              placeholder="e.g. Goa"
              onChange={(value) => updateTravelLocations('to', value)}
            />
            <ChipListEditor
              title="Destination Options"
              description="Tour circuits & popular travel destinations (e.g. Kerala, Kashmir, Maldives…)"
              icon={<MapPin className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-purple-50 text-purple-600"
              value={travelLocations.destination}
              placeholder="e.g. Kerala"
              onChange={(value) => updateTravelLocations('destination', value)}
            />
          </section>

          {/* Travel Service Requirements Section */}
          <section className={cardClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Luggage className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="m-0 text-base font-bold text-zinc-950">Travel Service Requirements</h2>
                  <p className="mb-0 mt-1 text-xs text-zinc-500">
                    Configure available travel services (e.g. Hotel, Air Ticket / Flight, Bus Ticket, Cab / Transport, Tour Package, Visa Assistance, Cruise).
                    These service options display as checkboxes in the Travel Requirement module page and on lead detail forms.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveTravelServices}
                  disabled={savingTravelServices}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-none cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {savingTravelServices
                      ? 'Saving…'
                      : travelServicesDirty
                        ? 'Save Services *'
                        : 'Save Services'}
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section
            data-tour="settings-travel-services-chips"
            className="grid grid-cols-1 gap-5"
          >
            <ChipListEditor
              title="Service Requirements"
              description="Services that clients or leads can request (e.g. Hotel, Air Ticket / Flight, Bus Ticket, Cab / Transport, Tour Package, Visa Assistance, Cruise…)"
              icon={<Luggage className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-purple-50 text-purple-600"
              value={travelServices}
              placeholder="e.g. Travel Insurance"
              onChange={(value) => updateTravelServices(value)}
            />
          </section>

          <div className={`${cardClass} text-xs text-zinc-500`}>
            Tip: Locations and Service Requirements configured here directly sync to{' '}
            <code className="text-zinc-800 font-mono">/travel/settings/locations</code> and{' '}
            <code className="text-zinc-800 font-mono">/travel/settings/services</code> and populate dropdown selectors
            and service checkboxes across the CRM and the{' '}
            <Link to="/travel-requirement" className="font-semibold text-zinc-900 underline">
              Travel requirement
            </Link>{' '}
            module.
          </div>
        </div>
      )}

      {settingsTabs.map((tab) => {
        const isThisTravel =
          tab.key === 'travel' || tab.extensionId === 'crm-travel' || /travel/i.test(tab.tabId);
        if (isThisTravel) return null;
        return (
          activeTab === tab.tabId && (
            <div key={tab.tabId} className="space-y-4" data-tour={`settings-ext-${tab.key}`}>
              <div className={`${cardClass} text-xs text-zinc-500`}>
                Settings owned by extension{' '}
                <strong className="text-zinc-800">{tab.extensionId}</strong>. CRM only hosts this
                slot while the extension is enabled.
              </div>
              <ExtensionIframe title={tab.label} src={tab.url} minHeight="44rem" />
            </div>
          )
        );
      })}

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
              icon={<FolderOpen className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              accent="bg-zinc-100"
              value={settings.client_categories}
              placeholder="e.g. Enterprise"
              onChange={(value) => update('client_categories', value)}
            />
            <ChipListEditor
              title="Client Tags"
              description="Quick labels for segmentation and filters on Clients."
              icon={<Tag className="h-[18px] w-[18px] shrink-0" aria-hidden />}
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
                          <span className="inline-flex items-center gap-1">
                            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            View
                          </span>
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
