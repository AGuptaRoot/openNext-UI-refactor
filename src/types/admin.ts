export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'boolean'
  | 'url'
  | 'email';

export interface AdminCustomField {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export interface CrmSettings {
  company_name: string;
  company_state: string;
  office_address?: string;
  office_addresses?: string[];
  sample_units_of_measure?: string[];
  /** Courier / carrier names available when dispatching sample requests. */
  courier_carriers?: string[];
  /** Optional tracking number / AWB presets suggested on sample dispatch. */
  tracking_number_options?: string[];
  default_currency: string;
  tax_rate: number;
  free_shipping_threshold: number;
  state_shipping_rates?: Record<string, number>;
  sales_order_generated_by_sources?: string[];
  quotation_prefix: string;
  sales_order_prefix?: string;
  invoice_prefix: string;
  payment_prefix: string;
  expense_prefix: string;
  client_tax_id_prefix: string;
  quotation_valid_days: number;
  default_hourly_rate: number;
  quotation_sequence?: number;
  sales_order_sequence?: number;
  invoice_sequence?: number;
  payment_sequence?: number;
  expense_sequence?: number;
  client_tax_id_sequence?: number;
  expense_categories: string[];
  task_client_reminder_auto_enabled: boolean;
  task_client_reminder_hours: number;
  quotation_email_subject?: string;
  invoice_email_subject?: string;
  quotation_email_intro?: string;
  invoice_email_intro?: string;
  lead_sources: string[];
  lead_statuses: string[];
  lead_types: string[];
  lead_priorities: string[];
  lead_tags: string[];
  pipeline_stages: string[];
  opportunity_stages: string[];
  opportunity_stage_probabilities: Record<string, number>;
  client_categories: string[];
  client_tags: string[];
  project_statuses: string[];
  project_priorities: string[];
  project_categories: string[];
  project_tags: string[];
  lead_custom_fields: AdminCustomField[];
  client_custom_fields: AdminCustomField[];
  project_custom_fields: AdminCustomField[];
  /** Admin catalogs used to score Commercial Requirement on leads. */
  qualification_match: {
    projectSoftwareTypes: string[];
    projectTechnologies: string[];
    projectUserBands: string[];
    projectIntegrations: string[];
    productCategories: string[];
    productSpecifications: string[];
    productCertifications: string[];
  };
}

export type SettingsTabId =
  | 'general'
  | 'shipping'
  | 'finance'
  | 'email'
  | 'integrations'
  | 'projects'
  | 'project-statuses'
  | 'leads'
  | 'qualification-match'
  | 'opportunities'
  | 'clients'
  | 'users'
  | (string & {});

export interface SettingsEmailStatus {
  configured: boolean;
  pluginAvailable: boolean;
  lastTestAt?: string | null;
  message: string;
}

/** Groq OCR integration — API never returns the raw key. */
export interface GroqIntegrationStatus {
  configured: boolean;
  hint: string;
  model: string;
  source: 'settings' | 'env' | 'none';
  message: string;
}

/** Google Maps / Places — status never returns the raw key (use client-key endpoint). */
export interface GoogleMapsIntegrationStatus {
  configured: boolean;
  hint: string;
  source: 'settings' | 'env' | 'none';
  message: string;
}

export interface GoogleMapsClientKey {
  apiKey: string;
  source: 'settings' | 'env' | 'none';
}

export interface SettingsWorkspaceUser {
  id: string;
  name: string;
  username?: string;
  email?: string;
  designation?: string;
  role: string;
  permissions: string[];
  permissionCategories: string[];
  isCurrentUser?: boolean;
  initials?: string;
  bgColor?: string;
}

export interface SettingsAuditHint {
  updatedKeys: string[];
  updatedAt: string;
}

export const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'finance', label: 'Finance' },
  { id: 'email', label: 'Email' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'projects', label: 'Projects' },
  { id: 'project-statuses', label: 'Project Statuses' },
  { id: 'leads', label: 'Leads' },
  { id: 'qualification-match', label: 'Qualification Match' },
  { id: 'opportunities', label: 'Opportunity' },
  { id: 'clients', label: 'Clients' },
  { id: 'users', label: 'Users' },
];

export const SETTINGS_CURRENCIES = [
  { code: 'INR', label: 'INR (₹)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'AED', label: 'AED (د.إ)' },
  { code: 'CAD', label: 'CAD (CA$)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'SGD', label: 'SGD (S$)' },
  { code: 'JPY', label: 'JPY (¥)' },
  { code: 'SAR', label: 'SAR (﷼)' },
  { code: 'CHF', label: 'CHF' },
] as const;

export const REMINDER_HOUR_PRESETS = [
  { hours: 12, label: '12h' },
  { hours: 24, label: '24h (1 Day)' },
  { hours: 48, label: '48h (2 Days)' },
  { hours: 72, label: '72h (3 Days)' },
  { hours: 168, label: '168h (1 Wk)' },
] as const;

export const DESIGNATION_PRESETS = [
  'Sales Exec',
  'Account Mgr',
  'Lead Eng',
  'Project Mgr',
  'Finance Officer',
] as const;

export const STANDARD_STATE_SHIPPING_RATES: Record<string, number> = {
  Maharashtra: 100,
  Gujarat: 150,
  Karnataka: 150,
  Delhi: 200,
  'Tamil Nadu': 200,
  'Uttar Pradesh': 200,
  'West Bengal': 250,
  Rajasthan: 200,
  Assam: 350,
  Goa: 200,
  Kerala: 200,
  Telangana: 180,
  'Andhra Pradesh': 180,
  'Madhya Pradesh': 200,
  Punjab: 200,
  Haryana: 180,
  Bihar: 250,
  Odisha: 250,
  Other: 300,
};

export const CUSTOM_FIELD_TYPES: Array<{ value: CustomFieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'boolean', label: 'Checkbox / Boolean' },
  { value: 'url', label: 'URL / Link' },
  { value: 'email', label: 'Email' },
];

export function slugifyCustomFieldKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function normalizeCustomFields(fields?: AdminCustomField[] | null): AdminCustomField[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field) => ({
      key: slugifyCustomFieldKey(field.key || field.label || ''),
      label: String(field.label || '').trim(),
      type: (CUSTOM_FIELD_TYPES.some((item) => item.value === field.type)
        ? field.type
        : 'text') as CustomFieldType,
      options: Array.isArray(field.options)
        ? field.options.map((item) => String(item).trim()).filter(Boolean)
        : [],
      required: Boolean(field.required),
    }))
    .filter((field) => field.key && field.label);
}

export function linesToList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listToLines(value: string[] | undefined): string {
  return (value || []).join('\n');
}

export interface AuditEntry {
  _id: string;
  userId?: string;
  username?: string;
  actorName?: string;
  action: string;
  module: string;
  recordId: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditQuery {
  page?: number;
  limit?: number;
  recordType?: string;
  search?: string;
}

export interface DataQualityCheck {
  key: string;
  label: string;
  weight: number;
  complete: boolean;
}

export interface DataQualityIssue {
  _id?: string;
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  pan?: string;
  dataQuality: {
    score: number;
    label: string;
    missing: string[];
    checks: DataQualityCheck[];
  };
  matches: Array<{
    id: string;
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    reasons: string[];
    companySimilarity?: number;
  }>;
}

export interface DataQualitySummary {
  leads: { duplicates: number; lowQuality: number; averageScore: number };
  clients: { duplicates: number; lowQuality: number; averageScore: number };
}

export interface DataQualityQuery {
  page?: number;
  limit?: number;
  view?: 'duplicates' | 'low-quality';
  recordType?: 'lead' | 'client';
  matchType?: 'all' | 'exact' | 'similar';
  maxScore?: number;
  search?: string;
}

export interface DataQualityRules {
  leadWeights: Record<string, number>;
  clientWeights: Record<string, number>;
  thresholds: {
    excellent: number;
    good: number;
    needsAttention: number;
  };
}

export interface AnalyticsSalesData {
  summary?: {
    totalLeads?: number;
    unweightedPipelineTotal?: number;
    weightedPipelineTotal?: number;
    totalRealizedRevenue?: number;
    totalBookedOrdersRevenue?: number;
    averageDealSize?: number;
  };
  executiveSummary?: Record<string, number>;
  forecast?: {
    forecast30d?: number;
    forecast60d?: number;
    forecast90d?: number;
    confidenceScore?: number;
  };
}
