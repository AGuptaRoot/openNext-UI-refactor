import type { ExtensionFact, ExtensionValueConfirm } from './extensions';
import type { LeadCommercialRequirement } from '../utils/qualificationMatchScore';
import type { ClientPortalAccess } from './clients';

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
  stageUpdatedAt?: string | null;
  /** Missed scheduled-activity summary (list enrichment). */
  missedActivities?: LeadMissedActivities;
  status: string;
  source?: string;
  leadType?: string;
  requestType?: string;
  /** Stable RequestType id for dynamic commercial forms. */
  requestTypeId?: string | null;
  value?: number | null;
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
  isPortal?: boolean;
  portalEnabledAt?: string | null;
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
   * { "<extensionId>": { "<Section>": { "<Field>": value } } }
   */
  extension?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
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
  status?: 'Open' | 'Assigned' | 'Accepted' | 'Completed' | string;
  completed?: boolean;
  /** Assigned employee / sales user (never a client). */
  assignedTo?: string;
  assignedToName?: string;
  assignedToDesignation?: string;
  assignedToLabel?: string;
  createdBy?: string;
  createdAt?: string;
  /** "logged" = already done when recorded; "scheduled" = booked, completed later. */
  kind?: 'logged' | 'scheduled' | string;
  /** Where the row came from — a commercial-requirement row offers "Interested". */
  source?: 'manual' | 'commercial_requirement' | string;
  createdLocation?: ActivityLocation | null;
  acceptedLocation?: ActivityLocation | null;
  completedLocation?: ActivityLocation | null;
  startingLocation?: ActivityLocation | null;
  goalLocation?: ActivityLocation | null;
  reachedGoalArea?: boolean;
  reachedGoalAt?: string | null;
  latestUserLocation?: ActivityLocation | null;
  latestDistanceFromGoal?: number | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  acceptedByName?: string | null;
  completedAt?: string | null;
  completedBy?: string;
  completedByName?: string;
  createdByName?: string;
  /** Set once the row has been turned into an opportunity. */
  convertedOpportunityId?: string;
}

/** One timestamped note on a lead (Notes tab rows). */
export interface LeadNote {
  _id: string;
  leadId?: string;
  content: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Set once the note has been edited. */
  editedAt?: string | null;
}

/** Scheduled activities on a lead that passed their due time uncompleted. */
export interface LeadMissedActivities {
  count: number;
  hasMissed: boolean;
  oldestDueAt?: string | null;
  oldestTitle?: string;
  label?: string;
}

/** Browser geolocation reading stored against an activity. */
export interface ActivityLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  address?: string;
  capturedAt?: string | null;
  /** Why coordinates are missing (permission denied, unsupported, timeout). */
  unavailableReason?: string;
}

export interface ActivityLocationLog {
  _id?: string;
  tenantId?: string;
  activityId: string;
  leadId?: string;
  salesRepId: string;
  salesRepName?: string;
  activityType?: string;
  activityTitle?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string;
  distanceFromGoal?: number | null;
  reachedGoalArea?: boolean;
  loggedAt: string;
}

export type Activity = LeadEvent;

/** One item on the "Interested" → opportunity modal (name + description only). */
export interface OpportunityItemDraft {
  name: string;
  description: string;
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
  requestType?: string;
  tag?: string;
  /** Qualification match band: unscored | strong | partial | weak | poor | scored */
  matchScore?: string;
  /** Filter by Commercial Requirement "Lead needs sample request" (true|false) */
  needsSampleRequest?: string;
  search?: string;
  sort?: string;
  /** Sort direction sent as `order` (the server reads direction from here). */
  order?: 'asc' | 'desc';
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
  value?: number | null;
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
  /** Plugin-extension JSON stored with the lead, keyed by extension id. */
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
  requestType?: string;
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

/** One scheduled activity on the reminder feed. */
export interface ActivityReminderRow {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  eventType: string;
  eventDate: string;
  assignedTo: string;
  assignedToLabel: string;
  isMine: boolean;
  /** Only on `dueSoon` rows. */
  minutesUntil?: number;
  /** Only on `missed` rows. */
  minutesLate?: number;
  hasGoal?: boolean;
  reachedGoalArea?: boolean;
  notReachedGoal?: boolean;
  goalLocation?: ActivityLocation | null;
}

/**
 * Scheduled activities needing attention: missed ones and ones about to start.
 *
 * `scope` is what the server actually applied — a sales representative always
 * gets `mine`, even when the page asked for `team`.
 */
export interface ActivityReminderFeed {
  scope: 'mine' | 'team';
  windowMinutes: number;
  now: string;
  missed: ActivityReminderRow[];
  dueSoon: ActivityReminderRow[];
}

/** Portal credentials issued (or issuable) for a lead. */
export interface LeadPortalAccessState {
  access: ClientPortalAccess[];
  /** Why a new invite is refused right now; empty when it is allowed. */
  blockedReason: string;
  /** CRM 3.36.0: the lead's Contact already has its portal user (IsportalAssigned). */
  contactPortalAssigned?: boolean;
}

/** Tenant lead workflow rules (Settings → Qualification Match → Lead workflow). */
export interface LeadWorkflowRules {
  /** When Create Opportunity shows on a lead. */
  opportunityButton: 'qualified' | 'ready' | 'qualified_or_ready';
  /** Hide Commercial Requirement when the active extension has its own requirement tab. */
  hideReplacedCommercialRequirement: boolean;
  /** Move a lead to Qualified when the extension reports it ready. */
  autoQualifyReadyLeads: boolean;
  /** Leads offered (and accepted) for a new opportunity. */
  opportunityLeads: 'all' | 'qualified_or_ready';
  /** 'extension' = follow the active extension, 'always', 'never'. */
  quotationNeedsOpportunity?: 'extension' | 'always' | 'never';
}

/** GET /leads/:id/workflow */
export interface LeadWorkflowFacts {
  leadId: string;
  stage: string;
  qualified: boolean;
  /** The active extension can say whether a lead is ready. */
  hasReadiness: boolean;
  ready: boolean;
  readyReasons: string[];
  readySummary: string;
  hideCommercialRequirement: boolean;
  /** The lead was converted into a client: no new opportunity from it (older servers leave it out). */
  converted?: boolean;
  canCreateOpportunity: boolean;
  eligibleForOpportunity: boolean;
  rules: LeadWorkflowRules;
}

/** GET /lead-workflow/opportunity-leads */
/** A line suggested by the active extension (sales flow); prices are usually left for the agent. */
export interface SalesFlowDetail {
  label: string;
  value: string;
}

/** A column the extension adds to quotation lines (salesFlow.quotationLineFields). */
export interface SalesFlowLineField {
  key: string;
  label: string;
  type: 'select' | 'text';
  options?: string[];
  maxLength?: number;
  print?: boolean;
  /** Colour per select option. */
  tones?: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'>;
}

export interface SalesFlowSummaryItem {
  icon?: string;
  label: string;
  value: string;
}

export interface SalesFlowLine {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** What the quantity counts, e.g. "Rooms × Nights". */
  unit?: string;
  tax?: number;
  extra?: Record<string, string>;
  /** The extension's reference for the line (kept on the quotation line). */
  sourceRef?: string;
  /** false: the row starts unticked. */
  selected?: boolean;
  /** Read-only details shown with the line (e.g. the service's requirement); not saved. */
  details?: SalesFlowDetail[];
  /** Key of one of salesFlow.quotationLineGroups ('' or missing = ungrouped). */
  group?: string;
}

/** One row of the extension's checklist on a create page (prefill `checks`). */
export interface SalesFlowCheck {
  label: string;
  ok: boolean;
  hint?: string;
}

/** salesFlow.opportunityForm — the extension's layout of the Create Opportunity page. */
export interface SalesFlowOpportunityForm {
  title?: string;
  subtitle?: string;
  /** Allowed link types, in order of preference (already resolved through the lead-only setting). */
  linkTypes?: Array<'lead' | 'client'>;
  /** Declared opportunity fields stay disabled until a lead is chosen. */
  needsLead?: boolean;
  emptyText?: string;
  /** Present when the extension wants to hear about saved opportunities. */
  savedRoute?: string;
  /** The stage of a new opportunity is set by the CRM (stage labels as the pipeline names them). */
  startStage?: { stage: string; readyStage?: string; locked?: boolean };
}

/** GET /opportunities/start-stage — the stage a new opportunity for a lead opens in. */
export interface OpportunityStartStage {
  /** false without salesFlow.opportunityForm.startStage: the user picks the stage as usual. */
  locked: boolean;
  /** The stage the opportunity will open in. */
  stage?: string;
  probability?: number;
  /** The first stage, and the one used once the lead is ready ('' when none). */
  startStage?: string;
  readyStage?: string;
  ready?: boolean;
  reasons?: string[];
}

/** salesFlow.quotationForm — the extension's layout of the quotation create / edit page. */
export interface SalesFlowQuotationForm {
  emptyText?: string;
  savedRoute?: string;
  /** "Grand total ÷ N" line; N is a declared quotation field. Omitted when switched off. */
  totalPer?: { label: string; countField: string };
}

/** salesFlow.quotationLineGroups[] — a titled group of quotation lines with its own columns. */
export interface SalesFlowLineGroup {
  key: string;
  title: string;
  /** Keys of quotationLineFields shown for this group (missing = every line field). */
  fields?: string[];
  /** Card icon: flight, hotel, car, activity, document, shield, place, beach, event, group, package, service. */
  icon?: string;
}

/** POST /sales-flow/opportunity-saved and /sales-flow/quotation-saved */
export interface SalesFlowSavedResult {
  ok: boolean;
  skipped?: boolean;
  message?: string;
}

/** Read-only information the extension shows for a lead (e.g. its services and travellers). */
export interface SalesFlowPanel {
  title: string;
  empty?: string;
  note?: string;
  items: Array<{ title: string; subtitle?: string; badge?: string; details?: SalesFlowDetail[] }>;
}

/** GET /sales-flow — page layout switches of the active extension. */
export interface SalesFlowConfig {
  available: boolean;
  opportunityPrefill?: boolean;
  quotationPrefill?: boolean;
  /** The extension's panels replace the opportunity's product lines (products come from the extension). */
  hideOpportunityLines?: boolean;
  /** Quotation lines come only from the extension; the agent enters price and tax. */
  lockQuotationLines?: boolean;
  quotationLineFields?: SalesFlowLineField[];
  quotationPageTitle?: string;
  quotationPageSubtitle?: string;
  quotationSummaryTitle?: string;
  quotationLinesTitle?: string;
  quotationLinesSubtitle?: string;
  quotationAddLineLabel?: string;
  /** Effective "a new quotation needs an opportunity" rule (setting or extension). */
  requireOpportunityForQuotation?: boolean;
  extensionName?: string;
  opportunityForm?: SalesFlowOpportunityForm;
  quotationForm?: SalesFlowQuotationForm;
  quotationLineGroups?: SalesFlowLineGroup[];
  /** Lines come only from the extension's records: users change price and tax only. */
  fixedLines?: boolean;
  /** The quotation's text sections are not edited on the create page. */
  hideQuotationSections?: boolean;
  /** Where the source data is edited: a lead tab of the extension. */
  requirementLink?: { label: string; leadTab: string } | null;
  /** Page wording: lines, line, proposedLines, subtotal, commercialSummary. */
  terms?: Partial<Record<'lines' | 'line' | 'proposedLines' | 'subtotal' | 'commercialSummary', string>> | null;
  /** Services, not goods: no shipping charge or shipping wording. */
  hideShipping?: boolean;
  /** The opportunity's primary contact is fixed once it is created. */
  lockOpportunityContact?: boolean;
  /** Invoices are raised from an accepted quotation only (its lines and payments carried over). */
  invoiceFromQuotation?: boolean;
  /** No Recurring Profiles tab, filter, KPI or recurring option on the invoice pages. */
  hideRecurringInvoices?: boolean;
  /** CRM 3.28.0 switches (salesFlow): see the extension manifest reference. */
  lockOpportunityOnAccept?: boolean;
  lockConvertedLead?: boolean;
  completeOpportunitiesOnConversion?: boolean;
  clientQuotationStartsWithLead?: boolean;
  bookingAfterAdvance?: boolean;
  /** CRM 3.34.0: a Won (or converted) lead is read-only. */
  lockWonLead?: boolean;
  /** CRM 3.34.0: a quotation for a client goes through the extension (eligible clients, a picker, a start step). */
  clientQuotation?: {
    notEligibleText?: string;
    /** CRM 3.44.0: tag on a client that is not ready yet. */
    notEligibleLabel?: string;
    /** CRM 3.45.0: a client quotation is saved for the client and its enquiry, without an opportunity. */
    withoutOpportunity?: boolean;
    /** CRM 3.46.0: the client tab (clientDetail tab id) where new business for an existing client starts. */
    clientTab?: string;
    /** CRM 3.47.0: Lead create → "Add as Secondary Contact" may copy the lead form's values (checkbox text). */
    leadFormSync?: { label: string; help?: string } | null;
  } | null;
  /** CRM 3.32.0: the extension limits Issue Date / Valid Till (POST /sales-flow/quotation-dates). */
  quotationDates?: boolean;
  /** No Templates button on the invoice list. */
  hideInvoiceTemplates?: boolean;
  /** CRM 3.41.0: no quotation templates (list button, Load / Save as Template, template pages). */
  hideQuotationTemplates?: boolean;
  /** CRM 3.39.0: no Write off on invoices (the server refuses it too). */
  hideInvoiceWriteOff?: boolean;
}

/** A notice from the extension above a create page, with an optional link to one of its lead tabs. */
export interface SalesFlowNotice {
  tone: 'warning' | 'info';
  text: string;
  action?: { label: string; leadTab: string };
}

/** POST /sales-flow/opportunity-prefill — { available: false } without an extension that offers it. */
export interface OpportunityPrefill {
  available: boolean;
  reason?: string;
  message?: string;
  leadId?: string;
  title?: string;
  expectedCloseDate?: string;
  description?: string;
  /** Suggested Estimated Deal Value (null when the lead has none). */
  dealValue?: number | null;
  panels?: SalesFlowPanel[];
  lines?: SalesFlowLine[];
  values?: Record<string, unknown>;
  warnings?: string[];
  checks?: SalesFlowCheck[];
  notices?: SalesFlowNotice[];
  facts?: ExtensionFact[];
  valueConfirms?: ExtensionValueConfirm[];
}

/** POST /sales-flow/quotation-prefill */
/** What to choose before a client quotation (CRM 3.34.0, salesFlow.clientQuotation picker). */
export interface ClientQuotationPickerData {
  eligible: boolean;
  message?: string;
  title: string;
  intro?: string;
  submitLabel?: string;
  min: number;
  items: Array<{ id: string; label: string; detail?: string; checked?: boolean; disabled?: boolean; hint?: string }>;
  emptyText?: string;
  emptyLink?: { label: string; link: string };
}

/** Issue Date / Valid Till limits of a quotation (days "YYYY-MM-DD"; missing = no limit). */
export interface QuotationDateRules {
  today?: string;
  /** New quotations: the issue date cannot be earlier. */
  issueDateMin?: string;
  /** Valid Till cannot be later, e.g. a travel quotation's Travel Start Date. */
  validTillMax?: string;
  validTillMaxLabel?: string;
}

export interface QuotationPrefill {
  available: boolean;
  reason?: string;
  message?: string;
  leadId?: string;
  title?: string;
  description?: string;
  summary?: SalesFlowSummaryItem[];
  panels?: SalesFlowPanel[];
  lineOptions?: Array<{ name: string; unit?: string; tax?: number; group?: string }>;
  lineNote?: string;
  lines?: SalesFlowLine[];
  sections?: Array<{ key?: string; title: string; body: string }>;
  warnings?: string[];
  /** Declared quotation field values. */
  values?: Record<string, unknown>;
  /** Default "Valid till" (YYYY-MM-DD). */
  validTill?: string;
  /** Latest sensible "Valid till"; a later date asks for confirmation on save. */
  validTillMax?: string;
  checks?: SalesFlowCheck[];
  notices?: SalesFlowNotice[];
}

export interface OpportunityLeadOptions {
  leads: Array<LeadItem & { workflow?: { qualified: boolean; ready: boolean } }>;
  hidden: number;
  rule: 'all' | 'qualified_or_ready';
  hasReadiness: boolean;
}
