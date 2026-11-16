/**
 * CRM-owned extensions (Settings → Extensions).
 *
 * These are the workspace modes of Root CRM — Product Sales, Project Delivery —
 * managed by the CRM itself. They are separate from the OpenNext CMS extension
 * packages (Dashboard → Extensions), which the CMS manages.
 *
 * Exactly one CRM extension is active per tenant. It fixes the lead Request
 * Type, the opportunity pipeline and which core modules the sidebar shows.
 */

export type CrmExtensionId = 'product' | 'project' | (string & {});

export type CrmExtensionAccent = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';

/* ------------------------------------------------------------------------
 * Full-package declarations (manifestVersion 2).
 * Shared contract: documentation/crm-upload-plan/00-CONTRACTS.md
 * ---------------------------------------------------------------------- */

export type ExtensionFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'searchable_select'
  | 'radio'
  | 'multiselect'
  | 'user'
  /** settings.json only */
  | 'list'
  | 'json';

export type ExtensionRecordType = 'lead' | 'client' | 'opportunity' | 'ticket' | 'quotation';

export interface ExtensionFieldDef {
  key: string;
  label: string;
  type: ExtensionFieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: Array<{ label: string; value: string }>;
  default?: unknown;
  min?: number;
  max?: number;
  /** Date fields (CRM 3.32.0): not in the past when set or changed. */
  minDate?: 'today';
  /** Date fields (CRM 3.32.0): not before / not after another date field of the same record. */
  minField?: string;
  maxField?: string;
  showInList: boolean;
  /** Layout hint in a 12-column grid: quarter / third (default) / half / full. */
  width?: 'quarter' | 'third' | 'half' | 'full';
  readOnly?: boolean;
  hidden?: boolean;
  /** Team-only value: the server never sends it to client (portal) users. */
  internal?: boolean;
  /** Options taken from one of the extension's settings (a list, or a json list of objects). */
  optionsFrom?:
    | { setting: string; value?: string; label?: string; enabledKey?: string }
    | string
    | null;
  /** Render as searchable select combobox. */
  searchable?: boolean;
  /** Calculated read-only value. */
  formula?: {
    op: 'sum' | 'days_between' | 'month_of';
    of?: string[] | string;
    from?: string;
    to?: string;
    inclusive?: boolean;
  } | null;
}

export interface ExtensionFieldGroup {
  id: string;
  record: ExtensionRecordType;
  sectionLabel: string;
  /** Lead groups only: show the group only for leads of this request type ('' = always). */
  whenRequestTypeKey: string;
  fields: ExtensionFieldDef[];
  /**
   * Notice comparing a number the page is given (a prefill fact) with a number field of the group.
   * Texts may use {actual}, {expected} and {diff}; nothing shows when they match.
   */
  countCheck?: {
    actualFact: string;
    expectedField: string;
    /** Optional live checklist row on the create page, ticked when the numbers match. */
    checkLabel?: string;
    over?: { tone: ExtensionNoticeTone; text: string };
    under?: { tone: ExtensionNoticeTone; text: string };
  };
}

export type ExtensionNoticeTone = 'info' | 'warning' | 'danger' | 'success';

/** A number shown with a field group (prefill `facts`), e.g. how many records exist. */
export interface ExtensionFact {
  key: string;
  label: string;
  value: number;
  /** Group id it belongs to ('' = only used by countCheck). */
  group: string;
}

/** Asked before a field takes a value (prefill `valueConfirms`); cancel keeps the old value. */
export interface ExtensionValueConfirm {
  field: string;
  value: string;
  title: string;
  message: string;
}

export type ExtensionTabPage = 'leadDetail' | 'clientDetail' | 'opportunityDetail' | 'ticketDetail' | 'contactDetail' | 'quotationDetail' | 'dashboard';

/** A button the active extension adds to a core detail page (json/actions.json). */
export interface ExtensionActionDef {
  id: string;
  page: 'leadDetail' | 'opportunityDetail' | 'quotationDetail' | 'contactDetail' | 'invoiceDetail';
  label: string;
  icon: string;
  kind: 'route' | 'mount';
  slot: string;
  permission: string;
  when: Partial<Record<'status' | 'stage' | 'stageType', string[]>>;
  confirm: string;
}

export interface ExtensionTabDef {
  id: string;
  label: string;
  kind: 'fields' | 'records' | 'readonly' | 'mount';
  order: number;
  permission: string;
  /** kind = fields: id of a field group of this page's record type. */
  fields?: string;
  /** kind = records */
  model?: string;
  columns?: string[];
  linkField?: string;
  /** kind = readonly: dotted path such as "lead.extension.services". */
  source?: string;
  /** kind = mount: slot passed to ui/mount.js as ctx.slot. */
  slot?: string;
  /** CRM 3.33.0: GET route of the extension (one ":param" = the record id) answering { count } for the label. */
  countRoute?: string;
  /** dashboard widgets only */
  width?: 'full' | 'half' | 'third';
}

export interface ExtensionPageDef {
  id: string;
  label: string;
  icon: string;
  kind: 'mount';
  slot: string;
  permission: string;
  order: number;
  /** Shown under the page title. */
  description?: string;
  showInQuickActions: boolean;
  /** false: reached only by link (e.g. a detail page), not listed in the sidebar. */
  showInSidebar?: boolean;
  /** Who the page is for: 'staff', 'portal' (client logins) or 'all' (default). */
  audience?: 'all' | 'staff' | 'portal';
}

export interface ExtensionModelDef {
  name: string;
  label: string;
  pluralLabel: string;
  titleField: string;
  permissions: { read: string; write: string };
  fields: Array<ExtensionFieldDef | { key: string; label: string; type: 'json' | 'ref'; ref?: string; required: boolean }>;
}

export interface ActiveExtensionDeclarations {
  fields: Partial<Record<ExtensionRecordType, ExtensionFieldGroup[]>>;
  tabs: Partial<Record<ExtensionTabPage, ExtensionTabDef[]>>;
  navigation: { pages: ExtensionPageDef[] };
  actions: ExtensionActionDef[];
  settingsTab: { label: string; icon: string; description: string; fieldCount: number; eyebrow?: string; slot?: string } | null;
}

export interface ActiveExtensionUi {
  entry: string;
  styles: string;
  /** Relative to the plugin API base, e.g. "/x-assets/services/2.0.0". */
  assetBase: string;
}

export interface ActiveExtensionBackend {
  /** Relative to the plugin API base, e.g. "/x/services". */
  apiBase: string;
  models: ExtensionModelDef[];
  requiresTrust: boolean;
  trust: 'n/a' | 'pending' | 'approved' | 'revoked';
  status: 'n/a' | 'unloaded' | 'loaded' | 'failed';
}

export const EMPTY_DECLARATIONS: ActiveExtensionDeclarations = {
  fields: {},
  tabs: {},
  navigation: { pages: [] },
  actions: [],
  settingsTab: null,
};

/** The part of the registry every role receives on `/me`. */
export interface ActiveExtensionInfo {
  id: CrmExtensionId;
  name: string;
  requestTypeKey: string;
  requestTypeName: string;
  pipelineKey: string;
  /** Sidebar route ids of core modules hidden while this extension is active. */
  hiddenModules: string[];
  /** CRM 3.43.0: core Settings tab ids this extension leaves out (e.g. "users"). */
  hiddenSettingsTabs?: string[];
  /** Which documents a won opportunity can be converted into. */
  conversions: {
    salesOrder: boolean;
    invoice: boolean;
  };
  /* manifestVersion 2 — always present after normalizeActiveExtension() */
  version?: string;
  source?: 'builtin' | 'uploaded';
  manifestVersion?: number;
  declarations?: ActiveExtensionDeclarations;
  ui?: ActiveExtensionUi | null;
  permissionsDefined?: Array<{ key: string; label: string; grantedWith?: string }>;
  backend?: ActiveExtensionBackend | null;
}

/** Full registry entry shown on the Settings → Extensions cards (admin). */
export interface CrmExtensionDef extends ActiveExtensionInfo {
  tagline: string;
  description: string;
  /** Lucide icon name declared by the registry (e.g. `package`, `folder-kanban`). */
  icon: string;
  accent: CrmExtensionAccent;
  version: string;
  publisher: string;
  isDefault: boolean;
  isInternal: boolean;
  /** `builtin` ships with the plugin; `uploaded` came through Settings → Extensions → Upload. */
  source: 'builtin' | 'uploaded';
  isActive: boolean;
  /** Only an inactive uploaded package can be removed. */
  canUninstall: boolean;
  pipelineName: string;
  visibleModules: string[];
  highlights: string[];
  installedAt?: string | null;
  updatedAt?: string | null;
  hasReadme?: boolean;
  hasChangelog?: boolean;
  /** 1 = declarative mode package, 2 = full package (json/ ui/ api/). */
  manifestVersion?: number;
  capabilities?: string[];
  /** True when the package ships backend code that needs admin approval. */
  requiresTrust?: boolean;
  trust?: CrmExtensionTrust;
  backendStatus?: 'n/a' | 'unloaded' | 'loaded' | 'failed';
  backendError?: string;
  checksum?: string;
  approvedAt?: string | null;
  /** False when an uploaded extension's folder in the plugin is missing or damaged. */
  filesAvailable?: boolean;
  approvedBy?: string | null;
  definedPermissions?: Array<{ key: string; label: string; description?: string }>;
  hasUi?: boolean;
  hasBackend?: boolean;
  summary?: CrmExtensionPackageSummary | null;
}

export type CrmExtensionTrust = 'n/a' | 'pending' | 'approved' | 'revoked';

/** Counts shown on the upload review screen and the card details. */
export interface CrmExtensionPackageSummary {
  manifestVersion: number;
  capabilities: string[];
  requiresTrust: boolean;
  files: number;
  uiFiles: number;
  apiFiles: number;
  fields: number;
  tabs: number;
  catalogValues: number;
  settingsFields: number;
  pages: number;
  routes: number;
  models: number;
  definedPermissions: number;
  allowedHosts: string[];
}

export interface CrmExtensionPackageFile {
  path: string;
  area: 'root' | 'json' | 'ui' | 'api';
  size: number;
  sha256: string;
  contentType: string;
}

export interface CrmExtensionsResponse {
  activeExtensionId: CrmExtensionId;
  extensions: CrmExtensionDef[];
}

export interface CrmExtensionToggleResult extends CrmExtensionDef {
  previousExtensionId?: CrmExtensionId | null;
  pipelineId?: string | null;
}

/** What `POST /crm-extensions/validate` returns for an uploaded zip. */
export interface CrmExtensionPackageValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Normalised registry entry when `ok`; null otherwise. */
  definition: (Omit<CrmExtensionDef, 'isActive' | 'source' | 'canUninstall' | 'visibleModules'> & {
    requestTypeFields?: unknown[] | null;
    pipelineStages?: Array<{ id: string; label: string; type: string; probability: number }>;
  }) | null;
  fileName: string;
  fileSize: number;
  checksum: string;
  readme?: string;
  changelog?: string;
  /** Version currently installed under the same id, when this upload would replace it. */
  replaces?: string | null;
  summary?: CrmExtensionPackageSummary | null;
  requiresTrust?: boolean;
  files?: CrmExtensionPackageFile[];
}

export interface CrmExtensionInstallResult extends CrmExtensionDef {
  warnings?: string[];
  replacedVersion?: string | null;
  storedFiles?: number;
}

/** Body for validate/install: the zip as base64 so it travels as plain JSON. */
export interface CrmExtensionPackageBody {
  fileName: string;
  contentBase64: string;
}

/**
 * Request type keys owned by CRM extensions. Only the active extension's key
 * is selectable; the others stay stored for leads that already reference them.
 */
export const CRM_EXTENSION_REQUEST_TYPE_KEYS = new Set(['product', 'project_software']);

/** True when a request type belongs to a CRM extension other than the active one. */
export function isInactiveExtensionRequestType(
  key: string | null | undefined,
  activeRequestTypeKey: string
): boolean {
  const k = String(key || '')
    .trim()
    .toLowerCase();
  return CRM_EXTENSION_REQUEST_TYPE_KEYS.has(k) && k !== activeRequestTypeKey;
}

export const DEFAULT_ACTIVE_EXTENSION: ActiveExtensionInfo = {
  id: 'product',
  name: 'Product Sales',
  requestTypeKey: 'product',
  requestTypeName: 'Product',
  pipelineKey: 'product_pipeline',
  hiddenModules: ['projects', 'tasks', 'time-logs'],
  conversions: { salesOrder: true, invoice: false },
};

/** Human labels for sidebar route ids, used on the extension cards. */
export const CORE_MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  reports: 'Reports',
  leads: 'Leads',
  contacts: 'Contacts',
  clients: 'Clients',
  opportunities: 'Opportunities',
  samples: 'Sample Requests',
  quotations: 'Quotations',
  'sales-orders': 'Sales Orders',
  invoices: 'Invoices',
  payments: 'Payments',
  projects: 'Projects',
  tasks: 'Tasks',
  'time-logs': 'Time Logs',
  tickets: 'Support Tickets',
  audit: 'Audit History',
  settings: 'Settings',
};

export function normalizeActiveExtension(raw: unknown): ActiveExtensionInfo {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ACTIVE_EXTENSION };
  const source = raw as Partial<ActiveExtensionInfo>;
  const hidden = Array.isArray(source.hiddenModules)
    ? source.hiddenModules.map((id) => String(id || '').trim()).filter(Boolean)
    : [...DEFAULT_ACTIVE_EXTENSION.hiddenModules];
  const conversions = source.conversions && typeof source.conversions === 'object'
    ? source.conversions
    : DEFAULT_ACTIVE_EXTENSION.conversions;
  const decl = source.declarations && typeof source.declarations === 'object' ? source.declarations : null;
  return {
    id: (String(source.id || DEFAULT_ACTIVE_EXTENSION.id) as CrmExtensionId),
    name: String(source.name || DEFAULT_ACTIVE_EXTENSION.name),
    requestTypeKey: String(source.requestTypeKey || DEFAULT_ACTIVE_EXTENSION.requestTypeKey),
    requestTypeName: String(source.requestTypeName || DEFAULT_ACTIVE_EXTENSION.requestTypeName),
    pipelineKey: String(source.pipelineKey || DEFAULT_ACTIVE_EXTENSION.pipelineKey),
    hiddenModules: hidden,
    hiddenSettingsTabs: Array.isArray(source.hiddenSettingsTabs)
      ? source.hiddenSettingsTabs.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean)
      : [],
    conversions: {
      salesOrder: Boolean(conversions.salesOrder),
      invoice: Boolean(conversions.invoice),
    },
    version: String(source.version || '1.0.0'),
    source: source.source === 'uploaded' ? 'uploaded' : 'builtin',
    manifestVersion: Number(source.manifestVersion || 1),
    declarations: {
      fields: decl?.fields && typeof decl.fields === 'object' ? decl.fields : {},
      tabs: decl?.tabs && typeof decl.tabs === 'object' ? decl.tabs : {},
      navigation: decl?.navigation && Array.isArray(decl.navigation.pages) ? decl.navigation : { pages: [] },
      actions: Array.isArray(decl?.actions) ? decl.actions : [],
      settingsTab: decl?.settingsTab || null,
    },
    ui: source.ui && source.ui.entry ? source.ui : null,
    permissionsDefined: Array.isArray(source.permissionsDefined) ? source.permissionsDefined : [],
    backend: source.backend && source.backend.apiBase ? source.backend : null,
  };
}
