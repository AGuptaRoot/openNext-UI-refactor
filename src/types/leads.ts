import type { LeadCommercialRequirement } from '../utils/qualificationMatchScore';

export type {
  LeadCommercialRequirement,
  ProjectCommercialRequirement,
  ProductCommercialRequirement,
  QualificationMatchCatalog,
  QualificationScoreBreakdownItem,
} from '../utils/qualificationMatchScore';

export interface LeadItem {
  _id: string;
  tenantId?: string;
  /** Lead title (what the opportunity is about). Falls back to contact `name` in UI when empty. */
  title?: string;
  /** Denormalized contact person name. */
  name: string;
  contactName?: string;
  /** Linked PersonContact id (see /contacts). */
  contactId?: string;
  priority?: string;
  /** ISO date/time of the next planned follow-up. */
  nextFollowUp?: string | null;
  salutation?: string;
  jobTitle?: string;
  company: string;
  email: string;
  phone: string;
  gender?: string;
  pan?: string;
  stage: string;
  status: string;
  source?: string;
  leadType?: string;
  requestType?: string;
  /** Stable RequestType id for dynamic commercial forms. */
  requestTypeId?: string | null;
  value?: number;
  currency?: string;
  salesOwner?: string;
  assignedTo?: string;
  assignedUsername?: string;
  assignedToName?: string;
  assignedToPhoto?: string;
  tags?: string[];
  notes?: string;
  address?: string;
  /** Formatted address alias (same as address when returned by Places). */
  formattedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  placeId?: string;
  latitude?: number | null;
  longitude?: number | null;
  photoUrl?: string;
  visitingCardUrl?: string;
  avatarUrl?: string;
  convertedClientId?: string | null;
  convertedAt?: string | null;
  createdBy?: string;
  createdByUsername?: string;
  qualification?: LeadQualification;
  /** Commercial requirement captured on the lead (project vs product). */
  commercialRequirement?: LeadCommercialRequirement;
  ageing?: LeadAgeing;
  followUpSummary?: LeadFollowUpSummary;
  dataQuality?: {
    score: number;
    label: string;
    missing?: string[];
  };
  attachments?: LeadAttachment[];
  customFields?: Record<string, unknown>;
  /**
   * Plugin-extension JSON on the lead document (Mongo `plugin_openext_crm_suite_leads`).
   * Section-wise by extension id, e.g.
   * { "crm-travel": { "Travel-General-Information": { "Enquiry-Date": "…" }, "Travel-Information": { From, To, Destination } } }
   */
  extension?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface LeadQualification {
  status?: 'Not Started' | 'In Review' | 'Qualified' | 'Rejected' | string;
  rejectionReason?: string;
  industry?: string;
  customerType?: string;
  businessPotential?: 'High' | 'Medium' | 'Low' | 'Uncertain' | string;
  annualRequirement?: string;
  geographicCoverage?: string;
  expectedRevenue?: number | null;
  targetPrice?: string;
  paymentTerms?: string;
  technicalFeasibility?: 'Feasible' | 'High Feasibility' | 'Medium Feasibility' | 'Requires R&D' | 'Not Feasible' | string;
  sampleRequired?: boolean;
  qualityApproved?: boolean;
  contractRequired?: boolean;
  contractType?: string;
  qualificationNotes?: string;
  budget?: number | string;
  authority?: string;
  need?: string;
  timeline?: string;
  isQualified?: boolean;
}

export interface LeadAgeing {
  totalAgeDays: number;
  stageAgeDays: number;
  status: 'Fresh' | 'Active' | 'Attention' | 'Stale';
  isStale?: boolean;
  isNeedsAttention?: boolean;
  isFresh?: boolean;
  label?: string;
  totalLabel?: string;
}

export interface LeadFollowUpSummary {
  openCount: number;
  overdueCount: number;
  overdueDays: number;
  hasOverdue: boolean;
  status: 'none' | 'overdue' | 'due_today' | 'upcoming';
  nextDueDate?: string | null;
  nextDueTitle?: string;
}

export interface LeadEvent {
  _id: string;
  leadId?: string;
  eventType?: 'Call' | 'Meeting' | 'Follow up' | 'Email' | 'Note' | 'Other' | string;
  type?: string; // alias for eventType
  title: string;
  description?: string;
  eventDate?: string;
  date?: string; // alias for eventDate
  status?: 'Open' | 'Completed' | string;
  completed?: boolean;
  /** Assigned employee / sales user (never a client). */
  assignedTo?: string;
  assignedToName?: string;
  assignedToDesignation?: string;
  assignedToLabel?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface LeadFollowUp {
  _id: string;
  leadId: string;
  title: string;
  dueDate: string;
  status: 'Open' | 'Completed' | 'Cancelled' | string;
  notes?: string;
  assignedTo?: string;
  createdAt: string;
}

export interface LeadAttachment {
  _id: string;
  leadId: string;
  fileName: string;
  originalName?: string;
  fileSize: number;
  fileUrl: string;
  mimeType?: string;
  category?: 'document' | 'visiting-card' | 'photo' | string;
  storageProvider?: string;
  createdAt: string;
}

export interface LeadAuditEntry {
  _id: string;
  recordType?: string;
  recordId?: string;
  action: string;
  description?: string;
  username?: string;
  userId?: string;
  createdAt: string;
}

export interface SavedLeadFilter {
  id: string;
  name: string;
  isDefault?: boolean;
  isShared?: boolean;
  userName?: string;
  userId?: string;
  filters: {
    stage?: string;
    status?: string;
    source?: string;
    tag?: string;
    matchScore?: string;
    /** true | false — commercialRequirement.needsSampleRequest */
    needsSampleRequest?: string;
    search?: string;
  };
}

export interface AssignableUser {
  id: string;
  _id?: string;
  userId?: string;
  name: string;
  displayName?: string;
  username?: string;
  email?: string;
  designation?: string;
  role?: string;
  /** Raw OpenNext CMS role code/name before CRM normalization */
  cmsRole?: string | number;
  isClient?: boolean;
  isClientUser?: boolean;
  clientId?: string;
  avatarUrl?: string;
  initials?: string;
  bgColor?: string;
}

export interface LeadQueryParams {
  page?: number;
  limit?: number;
  view?: 'list' | 'kanban' | 'report';
  stage?: string;
  status?: string;
  source?: string;
  tag?: string;
  /** Qualification match band: unscored | strong | partial | weak | poor | scored */
  matchScore?: string;
  /** Filter by Commercial Requirement "Lead needs sample request" (true|false) */
  needsSampleRequest?: string;
  search?: string;
  sort?: string;
}

/** True when Commercial Requirement marked the lead as needing a sample request. */
export function leadNeedsSampleRequest(lead: {
  commercialRequirement?: { needsSampleRequest?: boolean } | null;
  qualification?: { sampleRequired?: boolean } | null;
}): boolean {
  return Boolean(
    lead?.commercialRequirement?.needsSampleRequest || lead?.qualification?.sampleRequired
  );
}

export interface LeadCreateInput {
  title?: string;
  /** Denormalized contact person name. */
  name: string;
  contactId?: string;
  priority?: string;
  nextFollowUp?: string | null;
  company: string;
  email: string;
  phone: string;
  salutation?: string;
  jobTitle?: string;
  gender?: string;
  pan?: string;
  stage: string;
  status?: string;
  source?: string;
  leadType?: string;
  requestType?: string;
  requestTypeId?: string | null;
  value?: number;
  currency?: string;
  /** Optional — empty string / undefined means the lead is unassigned. */
  assignedTo?: string;
  tags?: string[];
  notes?: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  photoUrl?: string;
  customFields?: Record<string, string | number | boolean>;
  /** Plugin-extension JSON stored with the lead (e.g. Travel from/to/destination). */
  extension?: Record<string, unknown>;
  /** Allow another lead with the same email / mobile / PAN (e.g. reuse existing contact). */
  allowExactDuplicate?: boolean;
  /** Allow similar company name when intentionally creating another lead. */
  allowSimilarCompany?: boolean;
  /** Explicitly confirmed creation when company differs but contact info matches. */
  confirmDifferentCompany?: boolean;
}

/** Structured fields returned from visiting-card OCR + Groq extraction. */
export interface LeadOcrExtractResult {
  companyName: string;
  address: string;
  city: string;
  state: string;
  contactName: string;
  email: string;
  phone: string;
  jobRole: string;
  /** Optional high-confidence guesses — empty when uncertain. */
  salutation?: string;
  gender?: string;
  leadType?: string;
  requestType?: string;
  requestTypeId?: string;
  guessMeta?: {
    salutationConfidence?: number;
    genderConfidence?: number;
    leadTypeConfidence?: number;
    requestTypeConfidence?: number;
  };
  rawOcrText?: string;
  model?: string;
  triedModels?: string[];
}

export interface LeadCustomFieldDef {
  _id?: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'date' | 'email' | 'url' | string;
  options?: string[];
  required?: boolean;
}

export interface LeadPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LeadImportPreviewRow {
  rowIndex: number;
  valid: boolean;
  errors: string[];
  warnings?: string[];
  duplicates?: string[];
  data?: Partial<LeadItem>;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  stage?: string;
  status?: string;
  source?: string;
}

export interface LeadImportPreviewResult {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
  rows: LeadImportPreviewRow[];
}

export interface LeadImportExecuteResult {
  totalRows?: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  createdIds?: string[];
  message?: string;
}
