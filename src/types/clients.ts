export type ClientStatus = 'Active' | 'Inactive';

export interface ClientAddress {
  _id?: string;
  type?: 'billing' | 'shipping' | 'branch' | 'warehouse' | 'headquarters' | string;
  label?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  isDefault?: boolean;
  taxNumber?: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
}

export interface ClientContact {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
  companyId?: string;
  /** Directory PersonContact id when linked from Contacts module. */
  personContactId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientNote {
  _id: string;
  title?: string;
  body?: string;
  content?: string;
  pinned?: boolean;
  isPinned?: boolean;
  category?: string;
  color?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientEvent {
  _id: string;
  title: string;
  type?: string;
  eventType?: string;
  description?: string;
  dueAt?: string;
  eventDate?: string;
  completed?: boolean;
  status?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface ClientSourceLead {
  _id: string;
  name?: string;
  email?: string;
  company?: string;
}

export interface ClientCustomFieldDef {
  _id?: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | string;
  options?: string[];
  required?: boolean;
}

export type ClientDocumentKind = 'file' | 'link';

export interface ClientDocument {
  _id: string;
  name: string;
  url: string;
  /** Uploaded binary vs external URL link */
  kind?: ClientDocumentKind;
  storageProvider?: string;
  storageKey?: string;
  category?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  uploadedByName?: string;
  createdAt?: string;
}

export type ClientPortalStatus = 'Invited' | 'Active' | 'Suspended' | 'Revoked' | string;

export interface ClientPortalAccess {
  _id: string;
  name: string;
  email: string;
  username?: string;
  portalRole?: 'Standard' | 'Admin' | 'Viewer' | string;
  permissions?: string[];
  status: ClientPortalStatus;
  contactId?: string;
  invitedAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  suspendReason?: string;
  loginCredentials?: {
    username?: string;
    email?: string;
    password?: string;
    loginUrl?: string;
  };
}

export interface ClientTimelineEntry {
  _id: string;
  category?: string;
  type?: string;
  title: string;
  description?: string;
  actorName?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

export interface ClientRelatedProject {
  _id: string;
  name: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface ClientRelatedTask {
  _id: string;
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assigneeName?: string;
}

export interface ClientRelatedQuotation {
  _id: string;
  number?: string;
  title?: string;
  status?: string;
  total?: number;
  currency?: string;
  createdAt?: string;
}

export interface ClientRelatedInvoice {
  _id: string;
  number?: string;
  status?: string;
  total?: number;
  balanceDue?: number;
  currency?: string;
  dueDate?: string;
  createdAt?: string;
}

export interface ClientRelatedPayment {
  _id: string;
  number?: string;
  amount?: number;
  currency?: string;
  method?: string;
  status?: string;
  paidAt?: string;
}

export interface ClientRelatedTimeLog {
  _id: string;
  taskTitle?: string;
  hours?: number;
  date?: string;
  userName?: string;
}

export interface ClientRelatedContract {
  _id: string;
  title?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface ClientRelatedProduct {
  _id: string;
  name?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number;
}

export interface ClientHealthScore {
  healthScore: number;
  healthCategory?: 'Healthy' | 'At Risk' | 'Critical' | string;
  openTicketsCount?: number;
  overdueInvoicesCount?: number;
  lastActivityAt?: string;
  notes?: string;
}

export interface ClientDuplicateMatch {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  matchReason?: string;
}

export interface ClientDuplicateCheckResult {
  hasDuplicates: boolean;
  exact?: ClientDuplicateMatch[];
  similar?: ClientDuplicateMatch[];
}

export interface ClientImportPreviewRow {
  rowIndex: number;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  category?: string;
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  duplicates?: string[];
  data?: Record<string, unknown>;
}

export interface ClientImportPreviewResult {
  total: number;
  totalRows?: number;
  valid: number;
  validCount?: number;
  invalid: number;
  errorCount?: number;
  warningCount?: number;
  duplicateCount?: number;
  rows: ClientImportPreviewRow[];
}

export interface ClientImportExecuteResult {
  created: number;
  createdCount?: number;
  skipped: number;
  skippedCount?: number;
  failed: number;
  failedCount?: number;
  clientIds?: string[];
  message?: string;
}

export interface ClientItem {
  _id: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  state?: string;
  avatarUrl?: string;
  address?: string;
  avatarColor?: string;
  status?: ClientStatus | string;
  category?: string;
  tags?: string[];
  taxId?: string;
  customFields?: Record<string, string | number | boolean>;
  billingAddress?: ClientAddress;
  shippingAddress?: ClientAddress;
  addresses?: ClientAddress[];
  primaryContact?: ClientContact | null;
  contactCount?: number;
  city?: string;
  country?: string;
  leadId?: string;
  sourceLead?: ClientSourceLead | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientCreateInput {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  avatarUrl?: string;
  avatarColor?: string;
  status?: ClientStatus | string;
  category?: string;
  tags?: string[];
  taxId?: string;
  customFields?: Record<string, string | number | boolean>;
  billingAddress?: ClientAddress;
  shippingAddress?: ClientAddress;
  addresses?: ClientAddress[];
  allowSimilarCompany?: boolean;
  allowExactDuplicate?: boolean;
  leadId?: string;
  primaryContact?: {
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
    isPrimary?: boolean;
  };
}

export interface ClientQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  tag?: string;
  status?: string;
}

export interface ClientPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ClientListSummary {
  total?: number;
  fromLead?: number;
  totalClients: number;
  fromLeads: number;
  activeClients?: number;
  inactiveClients?: number;
}

export interface ClientDetailSummary {
  contactCount?: number;
  totalProjects?: number;
  activeProjects?: number;
  openTasks?: number;
  overdueTasks?: number;
  unpaidInvoices?: number;
  overdueInvoices?: number;
  totalQuotations?: number;
  outstandingBalance?: number;
  paymentsThisMonth?: number;
  loggedHoursThisMonth?: number;
  billableHoursThisMonth?: number;
  billableAmountThisMonth?: number;
  pendingExpenses?: number;
  approvedExpensesThisMonth?: number;
  defaultCurrency?: string;
  /** Normalized aliases used by React UI */
  contacts?: number;
  projects?: number;
  invoices?: number;
  quotations?: number;
  payments?: number;
  totalRevenue?: number;
}

export const DEFAULT_CLIENT_CATEGORIES = [
  'VIP',
  'Enterprise',
  'SMB',
  'Retainer',
  'Strategic',
  'Standard',
];

export const DEFAULT_CLIENT_TAGS = [
  'VIP',
  'Key Account',
  'Enterprise',
  'SMB',
  'Referral Partner',
  'High Value',
  'Monthly Retainer',
  'Prospect',
];

export const DEFAULT_CLIENT_STATUSES: ClientStatus[] = ['Active', 'Inactive'];

export const DEFAULT_CLIENT_CUSTOM_FIELDS: ClientCustomFieldDef[] = [
  { key: 'industry', label: 'Industry', type: 'text' },
  { key: 'employeeCount', label: 'Employee Count', type: 'number' },
  { key: 'preferredContact', label: 'Preferred Contact Method', type: 'select', options: ['Email', 'Phone', 'WhatsApp'] },
  { key: 'ndaSigned', label: 'NDA Signed', type: 'boolean' },
];

export const CLIENT_PORTAL_PERMISSIONS = [
  'invoices',
  'estimates',
  'contracts',
  'projects',
  'tasks',
  'documents',
  'tickets',
] as const;
