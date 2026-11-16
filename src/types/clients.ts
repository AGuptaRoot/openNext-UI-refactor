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

/** CRM 3.46.0 — an existing Client whose company name matches the one typed on Lead create. */
export interface ClientCompanyMatch {
  id: string;
  name: string;
  /** CRM 3.48.0: 'contact' = the contact already belongs to this client; 'company' = same company name. */
  reason?: 'contact' | 'company';
  /** The user can open this client (sales-agent scope). */
  canOpen: boolean;
  /** The user may add a contact to this client. */
  canAddContact: boolean;
  /** Shown only when canOpen. */
  primaryContactName?: string;
}

/** CRM 3.46.0 — result of "Add as Secondary Contact". */
export interface SecondaryContactResult {
  client: { id: string; name: string };
  contact: ClientContact;
  personContactId: string;
  /** The person was already one of the client's contacts (nothing new was added). */
  alreadyLinked: boolean;
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
  /** Same value as `_id` — the API returns both. */
  id?: string;
  name?: string;
  email?: string;
  company?: string;
  stage?: string | null;
  /** Request Type display name on the source lead. */
  requestType?: string;
  requestTypeId?: string | null;
}

/** Resolved request type of a client's source lead. */
export interface ClientRequestType {
  key: string;
  name: string;
  id: string;
}

/**
 * Read-through view of a client's extension context.
 * `extension` is the source lead's bag (never copied onto the client);
 * `clientExtension` holds data older extension versions kept on the client.
 */
export interface ClientExtensionData {
  clientId: string;
  leadId: string | null;
  leadName: string;
  requestType: ClientRequestType;
  extension: Record<string, unknown>;
  clientExtension: Record<string, unknown>;
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

export type ClientPortalStatus = 'Pending_Approval' | 'Invited' | 'Active' | 'Rejected' | 'Suspended' | 'Revoked' | string;

export interface ClientPortalAccess {
  _id: string;
  name: string;
  email: string;
  username?: string;
  portalRole?: 'Standard' | 'Admin' | 'Viewer' | string;
  permissions?: string[];
  status: ClientPortalStatus;
  contactId?: string;
  phone?: string;
  invitedAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  suspendReason?: string;
  requestedBy?: string;
  requestedByName?: string;
  requestedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  accountName?: string;
  isLead?: boolean;
  clientId?: string;
  leadId?: string;
  emailSent?: boolean;
  emailError?: string;
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
  quotationNo?: string;
  grandTotal?: number;
  title?: string;
  status?: string;
  total?: number;
  currency?: string;
  createdAt?: string;
}

export interface ClientRelatedInvoice {
  _id: string;
  number?: string;
  invoiceNo?: string;
  grandTotal?: number;
  documentType?: string;
  /** From verified payments (CRM 3.28.0): Unpaid / Partially Paid / Paid. */
  paymentStatus?: 'Unpaid' | 'Partially Paid' | 'Paid';
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
  paymentNo?: string;
  mode?: string;
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
