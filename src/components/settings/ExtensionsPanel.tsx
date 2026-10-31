import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import {
  AlertTriangle,
  BadgeCheck,
  Blocks,
  Briefcase,
  CheckCircle2,
  CloudUpload,
  Cpu,
  Factory,
  FileArchive,
  FolderKanban,
  GraduationCap,
  Hammer,
  HeartHandshake,
  Info,
  Landmark,
  Layers,
  Lock,
  Package,
  Palette,
  Plane,
  Route,
  Ruler,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Store,
  Trash2,
  Truck,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { ApiError, crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import {
  CORE_MODULE_LABELS,
  type CrmExtensionAccent,
  type CrmExtensionDef,
  type CrmExtensionPackageBody,
  type CrmExtensionPackageValidation,
} from '../../types/extensions';

const cardClass = 'rounded-xl border border-zinc-300 bg-white p-5';

/** Registry icon name → lucide component. Mirrors ALLOWED_ICONS in api/crm-extensions.js. */
const EXTENSION_ICONS: Record<string, LucideIcon> = {
  package: Package,
  'folder-kanban': FolderKanban,
  blocks: Blocks,
  briefcase: Briefcase,
  wrench: Wrench,
  'graduation-cap': GraduationCap,
  'heart-handshake': HeartHandshake,
  store: Store,
  truck: Truck,
  stethoscope: Stethoscope,
  hammer: Hammer,
  sparkles: Sparkles,
  plane: Plane,
  layers: Layers,
  factory: Factory,
  'shopping-bag': ShoppingBag,
  landmark: Landmark,
  cpu: Cpu,
  palette: Palette,
};

const ACCENTS: Record<
  CrmExtensionAccent,
  { badge: string; ring: string; soft: string; text: string; button: string; chip: string }
> = {
  blue: {
    badge: 'bg-blue-600 text-white',
    ring: 'border-blue-300 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]',
    soft: 'bg-blue-50/60',
    text: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    chip: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  violet: {
    badge: 'bg-violet-600 text-white',
    ring: 'border-violet-300 shadow-[0_0_0_3px_rgba(124,58,237,0.08)]',
    soft: 'bg-violet-50/60',
    text: 'text-violet-700',
    button: 'bg-violet-600 hover:bg-violet-700 text-white',
    chip: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  emerald: {
    badge: 'bg-emerald-600 text-white',
    ring: 'border-emerald-300 shadow-[0_0_0_3px_rgba(5,150,105,0.08)]',
    soft: 'bg-emerald-50/60',
    text: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  amber: {
    badge: 'bg-amber-500 text-white',
    ring: 'border-amber-300 shadow-[0_0_0_3px_rgba(245,158,11,0.08)]',
    soft: 'bg-amber-50/60',
    text: 'text-amber-700',
    button: 'bg-amber-500 hover:bg-amber-600 text-white',
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  rose: {
    badge: 'bg-rose-600 text-white',
    ring: 'border-rose-300 shadow-[0_0_0_3px_rgba(225,29,72,0.08)]',
    soft: 'bg-rose-50/60',
    text: 'text-rose-700',
    button: 'bg-rose-600 hover:bg-rose-700 text-white',
    chip: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  slate: {
    badge: 'bg-zinc-800 text-white',
    ring: 'border-zinc-400 shadow-[0_0_0_3px_rgba(63,63,70,0.08)]',
    soft: 'bg-zinc-50',
    text: 'text-zinc-700',
    button: 'bg-zinc-900 hover:bg-zinc-800 text-white',
    chip: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  },
};

function accentFor(accent: string | undefined) {
  return ACCENTS[(accent || 'slate') as CrmExtensionAccent] || ACCENTS.slate;
}

function moduleLabel(id: string): string {
  return CORE_MODULE_LABELS[id] || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Read a File as base64 (no data-URL prefix) so it can travel as JSON. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read the file'));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

interface ExtensionsPanelProps {
  /** Fired after an enable/disable/install/uninstall succeeded so the shell can refresh `/me` and settings. */
  onChanged?: () => void;
}

export function ExtensionsPanel({ onChanged }: ExtensionsPanelProps) {
  const { confirm } = useDialog();
  const [extensions, setExtensions] = useState<CrmExtensionDef[]>([]);
  const [activeId, setActiveId] = useState<string>('product');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async (opts?: { clearMessage?: boolean }) => {
    setLoading(true);
    if (opts?.clearMessage !== false) setMessage(null);
    try {
      const res = await crmApi.listCrmExtensions();
      const list = Array.isArray(res.data?.extensions) ? res.data.extensions : [];
      setExtensions(list);
      setActiveId(String(res.data?.activeExtensionId || list.find((e) => e.isActive)?.id || 'product'));
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : 'Failed to load CRM extensions',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => extensions.find((ext) => ext.id === activeId) || null,
    [extensions, activeId]
  );
  const uploadedCount = useMemo(() => extensions.filter((e) => e.source === 'uploaded').length, [extensions]);

  const enable = async (ext: CrmExtensionDef) => {
    if (ext.isActive || busyId) return;
    const current = active;
    const ok = await confirm({
      title: `Enable ${ext.name}?`,
      message:
        `Only one extension can be active at a time${
          current ? `, so ${current.name} will be disabled` : ''
        }. ` +
        `New leads will use the "${ext.requestTypeName}" request type, the ${ext.pipelineName} becomes the active ` +
        `opportunity pipeline, and ${
          ext.hiddenModules.length
            ? `${ext.hiddenModules.map(moduleLabel).join(', ')} will be hidden`
            : 'every core module stays visible'
        }. Existing records are kept.`,
      confirmLabel: `Enable ${ext.name}`,
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setBusyId(ext.id);
    setMessage(null);
    try {
      const res = await crmApi.enableCrmExtension(ext.id);
      setMessage({ kind: 'success', text: res.message || `${ext.name} is now the active extension.` });
      await load({ clearMessage: false });
      onChanged?.();
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : `Failed to enable ${ext.name}`,
      });
    } finally {
      setBusyId('');
    }
  };

  const disable = async (ext: CrmExtensionDef) => {
    if (!ext.isActive || ext.isDefault || busyId) return;
    const fallback = extensions.find((e) => e.isDefault);
    const ok = await confirm({
      title: `Disable ${ext.name}?`,
      message: `${fallback?.name || 'The default extension'} becomes active again: its request type, pipeline and modules are restored. Existing ${ext.name} records are kept.`,
      confirmLabel: `Disable ${ext.name}`,
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setBusyId(ext.id);
    setMessage(null);
    try {
      const res = await crmApi.disableCrmExtension(ext.id);
      setMessage({
        kind: 'success',
        text: res.message || `${ext.name} disabled. ${fallback?.name || 'Default'} is active.`,
      });
      await load({ clearMessage: false });
      onChanged?.();
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : `Failed to disable ${ext.name}`,
      });
    } finally {
      setBusyId('');
    }
  };

  const uninstall = async (ext: CrmExtensionDef) => {
    if (!ext.canUninstall || busyId) return;
    const ok = await confirm({
      title: `Uninstall ${ext.name}?`,
      message: `The package v${ext.version} is removed from this workspace. Leads, deals and the "${ext.requestTypeName}" request type already created are kept; you can upload the package again later.`,
      confirmLabel: 'Uninstall',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setBusyId(ext.id);
    setMessage(null);
    try {
      const res = await crmApi.uninstallCrmExtension(ext.id);
      setMessage({ kind: 'success', text: res.message || `${ext.name} uninstalled.` });
      await load({ clearMessage: false });
      onChanged?.();
    } catch (reason) {
      setMessage({
        kind: 'error',
        text: reason instanceof Error ? reason.message : `Failed to uninstall ${ext.name}`,
      });
    } finally {
      setBusyId('');
    }
  };

  const handleInstalled = async (text: string) => {
    setUploadOpen(false);
    setMessage({ kind: 'success', text });
    await load({ clearMessage: false });
    onChanged?.();
  };

  return (
    <div className="space-y-5" data-tour="settings-extensions">
      {/* Header */}
      <section className={`${cardClass} space-y-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
              <Blocks className="h-[18px] w-[18px] shrink-0" aria-hidden />
              CRM Extensions
            </div>
            <h2 className="m-0 text-xl font-bold tracking-tight text-zinc-950">
              Workspace extensions
            </h2>
            <p className="mb-0 mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              An extension sets how this CRM works: which core modules appear in the sidebar, the
              request type every new lead receives, and the opportunity pipeline used for deals.
              Only one extension is active at a time; optional modules in{' '}
              <strong className="font-semibold text-zinc-700">Modules &amp; Features</strong> can be
              switched on alongside it.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || Boolean(busyId)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-50"
            >
              <RefreshIcon sx={{ fontSize: 16 }} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
            >
              <CloudUpload className="h-4 w-4" aria-hidden /> Upload extension
            </button>
          </div>
        </div>

        {message && (
          <div
            role="alert"
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              message.kind === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Active summary strip */}
        {active && (
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 sm:grid-cols-3">
            <SummaryTile
              icon={BadgeCheck}
              label="Active extension"
              value={active.name}
              hint={`v${active.version} · ${active.publisher}${active.source === 'uploaded' ? ' · uploaded' : ''}`}
            />
            <SummaryTile
              icon={Ruler}
              label="Fixed request type"
              value={active.requestTypeName}
              hint="Applied to every new lead"
            />
            <SummaryTile
              icon={Route}
              label="Opportunity pipeline"
              value={active.pipelineName}
              hint="Active for all deals"
            />
          </div>
        )}
      </section>

      {/* Card grid */}
      {loading && extensions.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {extensions.map((ext) => (
            <ExtensionCard
              key={ext.id}
              ext={ext}
              busy={busyId === ext.id}
              anyBusy={Boolean(busyId)}
              onEnable={() => void enable(ext)}
              onDisable={() => void disable(ext)}
              onUninstall={() => void uninstall(ext)}
            />
          ))}
          <UploadCard onClick={() => setUploadOpen(true)} uploadedCount={uploadedCount} />
        </div>
      )}

      <p className="m-0 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Switching extensions never deletes data. Records created under the other extension stay in
          the database and reappear when that extension is enabled again. CMS extension packages
          (for example crm-travel) are managed separately from Dashboard → Extensions.
        </span>
      </p>

      {uploadOpen && (
        <UploadExtensionDialog onClose={() => setUploadOpen(false)} onInstalled={handleInstalled} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-700 border border-zinc-200">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
        <div className="truncate text-sm font-semibold text-zinc-950">{value}</div>
        {hint && <div className="truncate text-[11px] text-zinc-500">{hint}</div>}
      </div>
    </div>
  );
}

function ExtensionCard({
  ext,
  busy,
  anyBusy,
  onEnable,
  onDisable,
  onUninstall,
}: {
  ext: CrmExtensionDef;
  busy: boolean;
  anyBusy: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onUninstall: () => void;
}) {
  const accent = accentFor(ext.accent);
  const Icon = EXTENSION_ICONS[ext.icon] || Blocks;
  const hidden = new Set(ext.hiddenModules);
  const disableLocked = ext.isDefault;
  const uploaded = ext.source === 'uploaded';

  return (
    <article
      className={`relative flex flex-col rounded-2xl border bg-white p-5 transition-all ${
        ext.isActive ? accent.ring : 'border-zinc-200 hover:border-zinc-300 hover:shadow-xs'
      }`}
      data-extension-id={ext.id}
    >
      {/* Top row: icon + badges */}
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${
            ext.isActive ? accent.badge : 'bg-zinc-100 text-zinc-600'
          }`}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {ext.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              <Lock className="h-3 w-3" aria-hidden /> Default
            </span>
          )}
          {uploaded && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
              <CloudUpload className="h-3 w-3" aria-hidden /> Uploaded
            </span>
          )}
          {ext.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> Enabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700">
              <XCircle className="h-3 w-3" aria-hidden /> Disabled
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mt-4">
        <h3 className="m-0 text-base font-bold tracking-tight text-zinc-950">{ext.name}</h3>
        {ext.tagline && (
          <p className={`m-0 mt-0.5 text-xs font-semibold ${ext.isActive ? accent.text : 'text-zinc-500'}`}>
            {ext.tagline}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-400">
          <span className="font-mono">v{ext.version}</span>
          <span aria-hidden>·</span>
          <span>{ext.publisher || 'Unknown publisher'}</span>
          <span aria-hidden>·</span>
          <span>{uploaded ? 'Uploaded package' : 'Built-in'}</span>
          {uploaded && ext.installedAt && (
            <>
              <span aria-hidden>·</span>
              <span>Installed {new Date(ext.installedAt).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>

      {ext.description && (
        <p className="mb-0 mt-3 text-xs leading-relaxed text-zinc-600">{ext.description}</p>
      )}

      {/* Highlights */}
      {ext.highlights.length > 0 && (
        <ul className="m-0 mt-3 list-none space-y-1 p-0">
          {ext.highlights.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-zinc-700">
              <Sparkles className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent.text}`} aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Request type + pipeline */}
      <div className={`mt-4 grid grid-cols-2 gap-2 rounded-xl p-3 ${ext.isActive ? accent.soft : 'bg-zinc-50'}`}>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Request type</div>
          <div className="truncate text-xs font-semibold text-zinc-900">{ext.requestTypeName}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Pipeline</div>
          <div className="truncate text-xs font-semibold text-zinc-900">{ext.pipelineName}</div>
        </div>
      </div>

      {/* Modules */}
      <div className="mt-4">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Core modules
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ext.visibleModules.map((id) => (
            <span
              key={id}
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                ext.isActive ? accent.chip : 'border-zinc-200 bg-white text-zinc-700'
              }`}
            >
              {moduleLabel(id)}
            </span>
          ))}
          {ext.hiddenModules.map((id) => (
            <span
              key={id}
              title="Hidden while this extension is active"
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-400 line-through"
            >
              {moduleLabel(id)}
            </span>
          ))}
        </div>
        {hidden.size > 0 && (
          <p className="mb-0 mt-1.5 text-[11px] text-zinc-400">
            Struck-through modules are hidden from the sidebar, routes and forms.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-xs">
          <button
            type="button"
            disabled={anyBusy || ext.isActive}
            onClick={onEnable}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer disabled:cursor-default ${
              ext.isActive
                ? `${accent.button} shadow-xs opacity-100`
                : 'bg-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50'
            }`}
          >
            {busy && !ext.isActive ? 'Enabling…' : 'Enable'}
          </button>
          <button
            type="button"
            disabled={anyBusy || !ext.isActive || disableLocked}
            onClick={onDisable}
            title={
              disableLocked
                ? 'The default extension stays enabled whenever no other extension is active.'
                : !ext.isActive
                  ? 'Already disabled'
                  : 'Disable and return to the default extension'
            }
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed ${
              !ext.isActive
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'bg-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-40'
            }`}
          >
            {disableLocked && ext.isActive && <Lock className="h-3 w-3" aria-hidden />}
            {busy && ext.isActive ? 'Disabling…' : 'Disable'}
          </button>
        </div>
        {uploaded && (
          <button
            type="button"
            disabled={anyBusy || !ext.canUninstall}
            onClick={onUninstall}
            title={ext.canUninstall ? 'Remove this uploaded package' : 'Disable the extension before uninstalling it'}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Uninstall
          </button>
        )}
      </div>
    </article>
  );
}

function UploadCard({ onClick, uploadedCount }: { onClick: () => void; uploadedCount: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/60 p-6 text-center transition-all hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-zinc-500 border border-zinc-200 shadow-xs transition-colors group-hover:border-blue-300 group-hover:text-blue-600">
        <CloudUpload className="h-6 w-6" aria-hidden />
      </span>
      <span className="text-sm font-bold text-zinc-900">Upload extension</span>
      <span className="max-w-[16rem] text-xs leading-relaxed text-zinc-500">
        Install a packaged CRM extension (.zip with <span className="font-mono">crm-extension.json</span>) to add
        another workspace mode.
      </span>
      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {uploadedCount ? `${uploadedCount} installed` : 'Validated before install'}
      </span>
    </button>
  );
}

type UploadStep = 'pick' | 'validating' | 'review' | 'installing';

/**
 * Upload dialog: pick a zip → validate on the server → review → install.
 * The extension is installed as Disabled; enabling is a separate, explicit step.
 */
function UploadExtensionDialog({
  onClose,
  onInstalled,
}: {
  onClose: () => void;
  onInstalled: (message: string) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<CrmExtensionPackageBody | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<UploadStep>('pick');
  const [result, setResult] = useState<CrmExtensionPackageValidation | null>(null);
  const [error, setError] = useState<string>('');

  const reset = () => {
    setFile(null);
    setPayload(null);
    setResult(null);
    setError('');
    setStep('pick');
  };

  const pick = async (list: FileList | null) => {
    const next = list && list.length ? list[0] : null;
    if (!next) return;
    setError('');
    setResult(null);
    if (!/\.zip$/i.test(next.name)) {
      setFile(next);
      setPayload(null);
      setError('Only .zip packages are accepted.');
      setStep('pick');
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setFile(next);
      setPayload(null);
      setError(`The package is ${formatBytes(next.size)}; the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      setStep('pick');
      return;
    }
    setFile(next);
    setStep('validating');
    try {
      const contentBase64 = await fileToBase64(next);
      const body: CrmExtensionPackageBody = { fileName: next.name, contentBase64 };
      setPayload(body);
      const res = await crmApi.validateCrmExtensionPackage(body);
      setResult(res.data);
      setStep('review');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Validation failed');
      setStep('pick');
    }
  };

  const install = async () => {
    if (!payload || !result?.ok) return;
    setStep('installing');
    setError('');
    try {
      const res = await crmApi.installCrmExtensionPackage(payload);
      const name = res.data?.name || result.definition?.name || 'Extension';
      const version = res.data?.version || result.definition?.version || '';
      const warnings = res.data?.warnings?.length ? ` Warnings: ${res.data.warnings.join(' ')}` : '';
      await onInstalled(
        `${res.message || `${name} v${version} installed`}. It is disabled until you enable it.${warnings}`
      );
    } catch (reason) {
      const details =
        reason instanceof ApiError && Array.isArray((reason as ApiError & { details?: string[] }).details)
          ? (reason as ApiError & { details?: string[] }).details || []
          : [];
      setError(
        [reason instanceof Error ? reason.message : 'Install failed', ...details].filter(Boolean).join(' · ')
      );
      setStep('review');
    }
  };

  const def = result?.definition || null;
  const DefIcon = def ? EXTENSION_ICONS[def.icon] || Blocks : Blocks;
  const busy = step === 'validating' || step === 'installing';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crm-ext-upload-title"
    >
      <div className="my-6 w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h3 id="crm-ext-upload-title" className="m-0 text-base font-bold text-zinc-950">
              Upload extension
            </h3>
            <p className="mb-0 mt-1 text-xs text-zinc-500">
              A package is a small zip with <span className="font-mono">crm-extension.json</span> (and an optional{' '}
              <span className="font-mono">request-type.json</span>). It is validated before anything is stored.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 cursor-pointer"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void pick(e.dataTransfer.files);
            }}
            onClick={() => !busy && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragging ? 'border-blue-500 bg-blue-50/60' : 'border-zinc-300 bg-zinc-50/60 hover:border-blue-400'
            } ${busy ? 'opacity-60' : ''}`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-blue-600 border border-zinc-200 shadow-xs">
              {file ? <FileArchive className="h-6 w-6" aria-hidden /> : <CloudUpload className="h-6 w-6" aria-hidden />}
            </span>
            {file ? (
              <>
                <span className="text-sm font-bold text-zinc-900">{file.name}</span>
                <span className="text-[11px] text-zinc-500">
                  {formatBytes(file.size)} · {step === 'validating' ? 'validating…' : 'click to choose a different package'}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-zinc-900">
                  Drag &amp; drop a <span className="font-mono">.zip</span> here, or click to browse
                </span>
                <span className="text-[11px] text-zinc-500">
                  Up to {formatBytes(MAX_UPLOAD_BYTES)} · JSON and Markdown files only
                </span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={(e) => {
                void pick(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {/* Validation result */}
          {result && !result.ok && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
                <XCircle className="h-4 w-4" aria-hidden /> Package rejected
              </div>
              <ul className="m-0 list-disc space-y-1 pl-5 text-xs text-red-700">
                {result.errors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {result.warnings.length > 0 && (
                <ul className="m-0 mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
                  {result.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result && result.ok && def && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Package is valid
                {result.replaces && (
                  <span className="ml-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    updates v{result.replaces}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentFor(def.accent).badge}`}>
                  <DefIcon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-zinc-950">
                    {def.name} <span className="font-mono text-[11px] font-medium text-zinc-500">v{def.version}</span>
                  </div>
                  {def.tagline && <div className="text-xs font-semibold text-zinc-600">{def.tagline}</div>}
                  <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
                    <Row label="Id" value={def.id} mono />
                    <Row label="Publisher" value={def.publisher} />
                    <Row label="Request type" value={`${def.requestTypeName} (${def.requestTypeKey})`} />
                    <Row label="Pipeline" value={`${def.pipelineName} · ${def.pipelineStages?.length || 0} stages`} />
                    <Row
                      label="Hides"
                      value={def.hiddenModules.length ? def.hiddenModules.map(moduleLabel).join(', ') : 'nothing'}
                    />
                    <Row
                      label="Won deal becomes"
                      value={
                        [def.conversions.salesOrder && 'Sales Order', def.conversions.invoice && 'Invoice']
                          .filter(Boolean)
                          .join(' / ') || 'no document action'
                      }
                    />
                    <Row
                      label="Form fields"
                      value={
                        def.requestTypeFields?.length
                          ? `${def.requestTypeFields.length} shipped in request-type.json`
                          : 'built-in form reused'
                      }
                    />
                    <Row label="Package" value={`${result.fileName} · ${formatBytes(result.fileSize)}`} />
                  </dl>
                  {result.warnings.length > 0 && (
                    <ul className="m-0 mt-2 list-disc space-y-1 pl-5 text-[11px] text-amber-700">
                      {result.warnings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {!result && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                What happens next
              </div>
              <ol className="m-0 list-decimal space-y-1 pl-4 text-xs text-zinc-600">
                <li>The zip is checked: safe paths, allowed file types, size.</li>
                <li>
                  <span className="font-mono">crm-extension.json</span> is validated: id, version, request type, pipeline
                  stages, hidden modules, conversions.
                </li>
                <li>The extension appears in the grid as <em>Disabled</em>. Enable it to switch the workspace.</li>
              </ol>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={reset}
            disabled={busy || !file}
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-40"
          >
            Choose another
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={step === 'installing'}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !result?.ok}
              onClick={() => void install()}
              title={result?.ok ? 'Install the validated package (installed as Disabled)' : 'Pick a valid package first'}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloudUpload className="h-4 w-4" aria-hidden />
              {step === 'installing' ? 'Installing…' : result?.replaces ? 'Install update' : 'Install'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="shrink-0 text-zinc-400">{label}:</dt>
      <dd className={`m-0 min-w-0 truncate text-zinc-800 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
