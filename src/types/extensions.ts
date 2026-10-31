/**
 * CRM-owned extensions (Settings → Extensions).
 *
 * These are the workspace modes of Root CRM — Product Sales, Project Delivery —
 * managed by the CRM itself. They are separate from the OpenNext CMS extension
 * packages (Dashboard → Extensions, e.g. crm-travel), which the CMS manages.
 *
 * Exactly one CRM extension is active per tenant. It fixes the lead Request
 * Type, the opportunity pipeline and which core modules the sidebar shows.
 */

export type CrmExtensionId = 'product' | 'project' | (string & {});

export type CrmExtensionAccent = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';

/** The part of the registry every role receives on `/me`. */
export interface ActiveExtensionInfo {
  id: CrmExtensionId;
  name: string;
  requestTypeKey: string;
  requestTypeName: string;
  pipelineKey: string;
  /** Sidebar route ids of core modules hidden while this extension is active. */
  hiddenModules: string[];
  /** Which documents a won opportunity can be converted into. */
  conversions: {
    salesOrder: boolean;
    invoice: boolean;
  };
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
  /** Version currently installed under the same id, when this upload would replace it. */
  replaces?: string | null;
}

export interface CrmExtensionInstallResult extends CrmExtensionDef {
  warnings?: string[];
  replacedVersion?: string | null;
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
  return {
    id: (String(source.id || DEFAULT_ACTIVE_EXTENSION.id) as CrmExtensionId),
    name: String(source.name || DEFAULT_ACTIVE_EXTENSION.name),
    requestTypeKey: String(source.requestTypeKey || DEFAULT_ACTIVE_EXTENSION.requestTypeKey),
    requestTypeName: String(source.requestTypeName || DEFAULT_ACTIVE_EXTENSION.requestTypeName),
    pipelineKey: String(source.pipelineKey || DEFAULT_ACTIVE_EXTENSION.pipelineKey),
    hiddenModules: hidden,
    conversions: {
      salesOrder: Boolean(conversions.salesOrder),
      invoice: Boolean(conversions.invoice),
    },
  };
}
