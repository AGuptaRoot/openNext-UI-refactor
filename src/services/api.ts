import { DashboardData, DashboardPeriod, UserContext, WidgetConfig } from '../types/dashboard';
import {
  LeadItem,
  LeadQueryParams,
  LeadCreateInput,
  LeadPaginationMeta,
  SavedLeadFilter,
  AssignableUser,
  LeadEvent,
  LeadFollowUp,
  LeadAttachment,
  LeadAuditEntry,
  LeadQualification,
  LeadCustomFieldDef,
  LeadImportPreviewResult,
  LeadImportExecuteResult,
  LeadOcrExtractResult,
} from '../types/leads';
import { parseCsvString } from '../utils/csvParser';
import { pickImportField, LEAD_IMPORT_ALIASES, CLIENT_IMPORT_ALIASES } from '../utils/importFields';
import { displayUserLabel } from '../utils/displayLabels';
import {
  INITIAL_MOCK_LEADS,
  INITIAL_MOCK_USERS,
  INITIAL_SAVED_FILTERS,
  PIPELINE_STAGES,
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_TAGS,
  LEAD_TYPES,
  LEAD_PRIORITIES,
  mergeLeadStatusesWithBuiltins,
} from './mockLeadData';
import type {
  PersonContact,
  PersonContactInput,
  PersonContactQueryParams,
  PersonContactPaginationMeta,
  PersonContactDuplicateQuery,
  PersonContactDuplicateResult,
  CompanyDiscrepancyResult,
  ContactCompanyLeadsResult,
} from '../types/contacts';
import { triggerFileDownload } from '../utils/fileDownload';
import { getRuntimeDefaultCurrency } from '../utils/currency';
import {
  applyListPaginationParams,
  fallbackPagination,
  paginateLocalItems,
  type ListPaginationMeta,
} from '../utils/listPagination';
import {
  SalesReportData,
  LeadConversionReportData,
  ProjectsReportData,
  ProjectItemReport,
  OverdueTaskItem,
  TimeReportData,
  IncomeExpenseReportData,
  InvoiceAgeingReportData,
  AgeingBucket,
  AgeingInvoiceItem,
  RecurringInvoicesReportData,
  CreditNotesReportData,
  PaymentReconciliationReportData,
  EmployeesReportData,
  EmployeeProgressRow,
  EmployeeIncompleteTask,
  ReportQueryParams,
  ClientOption,
} from '../types/reports';
import {
  ClientItem,
  ClientCreateInput,
  ClientQueryParams,
  ClientPaginationMeta,
  ClientListSummary,
  ClientDetailSummary,
  ClientContact,
  ClientNote,
  ClientEvent,
  ClientAddress,
  ClientCustomFieldDef,
  ClientDocument,
  ClientPortalAccess,
  ClientTimelineEntry,
  ClientRelatedProject,
  ClientRelatedTask,
  ClientRelatedQuotation,
  ClientRelatedInvoice,
  ClientRelatedPayment,
  ClientRelatedTimeLog,
  ClientRelatedContract,
  ClientRelatedProduct,
  ClientHealthScore,
  ClientDuplicateCheckResult,
  ClientImportPreviewResult,
  ClientImportExecuteResult,
  DEFAULT_CLIENT_CATEGORIES,
  DEFAULT_CLIENT_TAGS,
  DEFAULT_CLIENT_STATUSES,
} from '../types/clients';
import {
  OpportunityItem,
  OpportunityCreateInput,
  OpportunityQueryParams,
  OpportunitySummary,
  OpportunityPaginationMeta,
  computeOpportunityFinancials,
  stageProbability,
  DEFAULT_OPPORTUNITY_STAGE_NAMES,
  DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES,
} from '../types/opportunities';
import type {
  OpportunityPipeline,
  OpportunityPipelineInput,
} from '../types/opportunity-pipelines';
import { DEFAULT_STAGE_CATALOG } from '../types/opportunity-pipelines';
import type { RequestType, RequestTypeInput } from '../types/request-types';
import type {
  QuotationCreateInput,
  QuotationExportParams,
  QuotationItem,
  QuotationQueryParams,
  QuotationRevisionInput,
  QuotationTemplateCreateInput,
  QuotationTemplateItem,
} from '../types/quotations';
import { COMPANY_STATE_DEFAULT } from '../types/quotations';
import { INITIAL_MOCK_QUOTATION_TEMPLATES } from './mockQuotationTemplateData';
import type {
  InvoiceCreateInput,
  InvoiceExportParams,
  InvoiceItem,
  InvoicePaymentRecord,
  InvoicePaginationMeta,
  InvoiceQueryParams,
  InvoiceWriteOffInput,
  RazorpayStatusData,
  RazorpayOrderData,
  RazorpayConfirmInput,
  RecurringInvoiceCreateInput,
  RecurringInvoiceItem,
  RecurringInvoiceQueryParams,
  RecurringInvoiceUpcomingReport,
} from '../types/invoices';
import type { FinancePdfOcrExtractResult } from '../types/financePdfOcr';
import type {
  InvoiceTemplateCreateInput,
  InvoiceTemplateItem,
  InvoiceTemplateQueryParams,
} from '../types/invoiceTemplates';
import type {
  PaymentCreateInput,
  PaymentExportParams,
  PaymentItem,
  PaymentQueryParams,
  RefundListItem,
  RefundRejectInput,
  RefundRequestInput,
} from '../types/payments';
import type {
  SalesOrderCreateInput,
  SalesOrderDeliveryConfirmInput,
  SalesOrderDeliveryStatus,
  SalesOrderItem,
  SalesOrderQueryParams,
  SalesOrderReturnInput,
  SalesOrderShipmentInput,
  SalesOrderStatus,
} from '../types/salesOrders';
import { remainingShipQty } from '../types/salesOrders';
import {
  ProjectItem,
  ProjectCreateInput,
  ProjectQueryParams,
  ProjectPaginationMeta,
  ProjectOverview,
  ProjectMember,
  ProjectMilestone,
  ProjectTaskSummary,
  ProjectDocument,
  ProjectTemplate,
  ProjectActivityEntry,
  ProjectTimeLog,
  ProjectExpense,
  type DeliverySettings,
  DEFAULT_PROJECT_STATUSES,
  DEFAULT_PROJECT_PRIORITIES,
  mergeProjectStatusesWithBuiltins,
  computeProjectProgress,
} from '../types/projects';
import {
  INITIAL_MOCK_CLIENTS,
  INITIAL_MOCK_CONTACTS,
  INITIAL_MOCK_NOTES,
  INITIAL_MOCK_EVENTS,
  INITIAL_MOCK_ADDRESSES,
  INITIAL_MOCK_DOCUMENTS,
  INITIAL_MOCK_PORTAL,
  INITIAL_MOCK_PROJECTS,
  INITIAL_MOCK_TASKS,
  INITIAL_MOCK_QUOTATIONS,
  INITIAL_MOCK_INVOICES,
  INITIAL_MOCK_PAYMENTS,
  INITIAL_MOCK_CUSTOM_FIELD_DEFS,
} from './mockClientData';
import { INITIAL_MOCK_OPPORTUNITIES } from './mockOpportunityData';
import { INITIAL_MOCK_QUOTATIONS as INITIAL_FINANCE_QUOTATIONS } from './mockQuotationData';
import { INITIAL_MOCK_INVOICES as INITIAL_FINANCE_INVOICES } from './mockInvoiceData';
import { INITIAL_MOCK_INVOICE_TEMPLATES } from './mockInvoiceTemplateData';
import { calculateFinanceTotals } from '../utils/financeTotals';
import {
  DEFAULT_QUALIFICATION_MATCH_CATALOG,
  emptyCommercialRequirement,
  computeQualificationMatchScore,
  type LeadCommercialRequirement,
} from '../utils/qualificationMatchScore';
import { INITIAL_MOCK_PAYMENTS as INITIAL_FINANCE_PAYMENTS } from './mockPaymentData';
import { INITIAL_MOCK_SALES_ORDERS } from './mockSalesOrderData';
import {
  INITIAL_MOCK_PROJECTS as INITIAL_SEED_PROJECTS,
  INITIAL_MOCK_PROJECT_MEMBERS,
  INITIAL_MOCK_PROJECT_MILESTONES,
  INITIAL_MOCK_PROJECT_TASKS,
  INITIAL_MOCK_PROJECT_DOCUMENTS,
  INITIAL_MOCK_PROJECT_ACTIVITY,
  INITIAL_MOCK_PROJECT_TIME_LOGS,
  INITIAL_MOCK_PROJECT_EXPENSES,
  INITIAL_MOCK_PROJECT_TEMPLATES,
  INITIAL_PROJECT_CATEGORIES,
  INITIAL_PROJECT_TAGS,
  INITIAL_PROJECT_LABELS,
} from './mockProjectData';
import {
  TaskComment,
  TaskCreateInput,
  TaskItem,
  TaskQueryParams,
  TaskSubtask,
  TaskTemplate,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../types/tasks';
import {
  TimeLogCheckInInput,
  TimeLogCheckOutInput,
  TimeLogCreateInput,
  TimeLogExportParams,
  TimeLogItem,
  TimeLogQueryParams,
  WeeklyTimesheet,
  computeBillableAmount,
  normalizeApprovalStatus,
  resolveTimeLogHours,
  resolveTimeLogBillableAmount,
} from '../types/timeLogs';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  ExpenseCreateInput,
  ExpenseItem,
  ExpenseQueryParams,
  ExpenseStatus,
  RecurringExecutionLog,
  RecurringExpenseCreateInput,
  RecurringExpenseFrequency,
  RecurringExpenseItem,
  RecurringExpenseQueryParams,
  RecurringExpenseStatus,
  RecurringForecastReport,
} from '../types/expenses';
import {
  INITIAL_MOCK_TASKS as INITIAL_WAVE_TASKS,
  INITIAL_MOCK_TASK_TEMPLATES,
  INITIAL_MOCK_TASK_SUBTASKS,
  INITIAL_MOCK_TASK_COMMENTS,
} from './mockTaskData';
import { INITIAL_MOCK_TIME_LOGS as INITIAL_WAVE_TIME_LOGS } from './mockTimeLogData';
import {
  INITIAL_MOCK_EXPENSES as INITIAL_WAVE_EXPENSES,
  INITIAL_MOCK_RECURRING_EXPENSES as INITIAL_WAVE_RECURRING_EXPENSES,
} from './mockExpenseData';
import {
  SampleApproveInput,
  SampleCreateInput,
  SampleDispatchInput,
  SampleFeedbackInput,
  SampleItem,
  SampleQueryParams,
  nextSampleNumber,
  normalizeSample,
} from '../types/samples';
import {
  CannedResponse,
  TicketCreateInput,
  TicketEscalateInput,
  TicketItem,
  TicketMessage,
  TicketMessageInput,
  TicketQueryParams,
  TicketReassignInput,
  TicketResolveInput,
  computeSlaDueDate,
  evaluateSla,
  slaHoursForPriority,
} from '../types/tickets';
import {
  AccountHealthRecord,
  CustomerFeedbackCreateInput,
  CustomerFeedbackItem,
  CustomerSuccessAccountQuery,
  CustomerSuccessSummary,
  FeedbackRatingSummary,
  buildAccountHealth,
  normalizeAccountHealthRecord,
  normalizeFeedbackRatingSummary,
} from '../types/customerSuccess';
import {
  CampaignStats,
  MarketingAnalytics,
  MarketingAudienceRecipient,
  MarketingAudienceStats,
  MarketingCampaign,
  MarketingCampaignCreateInput,
  MarketingCampaignQuery,
  MarketingEligibleLead,
  MarketingExecuteResult,
  MarketingSendTestInput,
  PipelineReEntryEvent,
  ReEngageLeadInput,
  ReEngagementRequest,
  conversionRate,
  normalizeCampaign,
  renderMarketingTemplate,
} from '../types/marketing';
import type {
  AdminPagination,
  AnalyticsSalesData,
  AuditEntry,
  AuditQuery,
  CrmSettings,
  DataQualityIssue,
  DataQualityQuery,
  DataQualityRules,
  DataQualitySummary,
  SettingsEmailStatus,
  SettingsWorkspaceUser,
  GroqIntegrationStatus,
  GoogleMapsIntegrationStatus,
  GoogleMapsClientKey,
} from '../types/admin';
import { STANDARD_STATE_SHIPPING_RATES, normalizeCustomFields } from '../types/admin';

const PLUGIN_ID = 'openext-crm-suite';
const API_BASE = `/api/plugins/${PLUGIN_ID}`;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  details?: unknown[];
  pagination?: LeadPaginationMeta;
  /** Pagination metadata returned by the PersonContact list endpoint. */
  meta?: PersonContactPaginationMeta;
  /** Machine-readable error code (e.g. CONTACT_DUPLICATE). */
  code?: string;
  /** Matching records returned with a 409 duplicate error. */
  duplicates?: unknown[];
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown[];
  /** Populated on 409 CONTACT_DUPLICATE responses. */
  duplicates?: unknown[];
  /** Extra payload from API errors (e.g. existing salesOrderId on 409). */
  data?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown[],
    duplicates?: unknown[],
    data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.duplicates = duplicates;
    this.data = data;
  }
}

/**
 * Opt-in standalone/demo mode for local UI without a live CMS API.
 * Live deployments must leave `VITE_CRM_USE_MOCK` unset/false so real
 * 400/403/500 errors surface instead of silent localStorage "success".
 */
export function isCrmMockModeEnabled(): boolean {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
    if (String(env?.VITE_CRM_USE_MOCK ?? '').toLowerCase() === 'true') return true;
  } catch {
    // ignore
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage?.getItem('opennext_crm_use_mock') === 'true') {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Call at the start of mock catch fallbacks.
 * When mock mode is off (default), rethrows so the UI shows the real failure.
 */
export function rethrowUnlessMockFallback(error: unknown): void {
  if (isCrmMockModeEnabled()) return;
  if (error instanceof Error) throw error;
  throw new ApiError(String(error || 'Request failed'), 500);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    data: null as unknown as T,
    error: `HTTP ${response.status}: Failed to parse JSON response`,
  }));

  if (!response.ok || !payload.success) {
    const details = Array.isArray(payload.details)
      ? payload.details.map((d) => String(d || '').trim()).filter(Boolean)
      : [];
    const base = payload.error || payload.message || `Request failed with status ${response.status}`;
    const errorMsg = details.length ? `${base}: ${details.join('; ')}` : base;
    throw new ApiError(
      errorMsg,
      response.status,
      typeof payload.code === 'string' ? payload.code : undefined,
      payload.details,
      Array.isArray(payload.duplicates) ? payload.duplicates : undefined,
      payload.data
    );
  }

  return payload;
}

/** Payload returned by CRM list export endpoints (raw CSV/JSON file body). */
type ExportFilePayload = {
  format: string;
  content: string;
  filename: string;
  mimeType: string;
  count?: number;
};

/**
 * Export endpoints stream a file (text/csv or application/json attachment),
 * not the usual `{ success, data }` JSON envelope. Never use `request()` for them.
 */
async function requestExportFile(
  path: string,
  fallbackBaseName: string,
  formatHint: 'csv' | 'json' = 'csv'
): Promise<ApiResponse<ExportFilePayload>> {
  const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json, text/csv, text/plain, */*' },
  });

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();

  if (!response.ok) {
    let message = `Export failed (${response.status})`;
    try {
      const payload = JSON.parse(text) as { error?: string; message?: string };
      message = payload?.error || payload?.message || message;
    } catch {
      // keep default
    }
    throw new ApiError(message, response.status);
  }

  // Rare: some hosts wrap export in a JSON API envelope
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const data =
        parsed.data && typeof parsed.data === 'object'
          ? (parsed.data as Record<string, unknown>)
          : parsed;
      if (typeof data.content === 'string') {
        const format = String(data.format || formatHint).toLowerCase();
        return {
          success: true,
          data: {
            format,
            content: data.content,
            filename: String(
              data.filename || `${fallbackBaseName}.${format === 'json' ? 'json' : 'csv'}`
            ),
            mimeType: String(
              data.mimeType ||
                (format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8')
            ),
            count: typeof data.count === 'number' ? data.count : undefined,
          },
        };
      }
    } catch {
      // treat body as raw file content
    }
  }

  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i);
  const headerName = filenameMatch?.[1]
    ? decodeURIComponent(filenameMatch[1].replace(/"/g, '').trim())
    : '';
  const isJson =
    formatHint === 'json' ||
    contentType.includes('application/json') ||
    headerName.toLowerCase().endsWith('.json');
  const format = isJson ? 'json' : 'csv';
  const filename =
    headerName || `${fallbackBaseName}_${new Date().toISOString().slice(0, 10)}.${format}`;

  return {
    success: true,
    data: {
      format,
      content: text,
      filename,
      mimeType: isJson
        ? 'application/json; charset=utf-8'
        : contentType.includes('csv')
          ? contentType
          : 'text/csv; charset=utf-8',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE LOCAL PERSISTENCE FOR STANDALONE/DEV MODE
// ─────────────────────────────────────────────────────────────────────────────
const LEADS_STORE_KEY = 'opennext_mock_leads_v1';
const FILTERS_STORE_KEY = 'opennext_mock_filters_v1';
const CLIENTS_STORE_KEY = 'opennext_mock_clients_v1';
const CLIENT_CONTACTS_KEY = 'opennext_mock_client_contacts_v1';
const CLIENT_NOTES_KEY = 'opennext_mock_client_notes_v1';
const CLIENT_EVENTS_KEY = 'opennext_mock_client_events_v1';
const CLIENT_ADDRESSES_KEY = 'opennext_mock_client_addresses_v1';
const CLIENT_DOCUMENTS_KEY = 'opennext_mock_client_documents_v1';
const CLIENT_PORTAL_KEY = 'opennext_mock_client_portal_v1';
const CLIENT_CATEGORIES_KEY = 'opennext_mock_client_categories_v1';
const CLIENT_TAGS_KEY = 'opennext_mock_client_tags_v1';
const CLIENT_CUSTOM_FIELDS_KEY = 'opennext_mock_client_custom_fields_v1';
const OPPORTUNITIES_STORE_KEY = 'opennext_mock_opportunities_v2';
const QUOTATIONS_STORE_KEY = 'opennext_mock_quotations_v3';
const QUOTATION_TEMPLATES_STORE_KEY = 'opennext_mock_quotation_templates_v1';
const INVOICES_STORE_KEY = 'opennext_mock_invoices_v3';
const INVOICE_TEMPLATES_STORE_KEY = 'opennext_mock_invoice_templates_v1';
const PAYMENTS_STORE_KEY = 'opennext_mock_payments_v3';
const SALES_ORDERS_STORE_KEY = 'opennext_mock_sales_orders_v3';
const PROJECTS_STORE_KEY = 'opennext_mock_projects_v1';
const PROJECT_MEMBERS_KEY = 'opennext_mock_project_members_v1';
const PROJECT_MILESTONES_KEY = 'opennext_mock_project_milestones_v1';
const PROJECT_TASKS_KEY = 'opennext_mock_project_tasks_v1';
const PROJECT_DOCUMENTS_KEY = 'opennext_mock_project_documents_v1';
const PROJECT_ACTIVITY_KEY = 'opennext_mock_project_activity_v1';
const PROJECT_TIME_LOGS_KEY = 'opennext_mock_project_time_logs_v2';
const PROJECT_EXPENSES_KEY = 'opennext_mock_project_expenses_v1';
const PROJECT_TEMPLATES_KEY = 'opennext_mock_project_templates_v1';
const PROJECT_CATEGORIES_KEY = 'opennext_mock_project_categories_v1';
const PROJECT_TAGS_KEY = 'opennext_mock_project_tags_v1';
const PROJECT_LABELS_KEY = 'opennext_mock_project_labels_v1';
const PROJECT_CUSTOM_FIELDS_KEY = 'opennext_mock_project_custom_fields_v1';
const TASKS_STORE_KEY = 'opennext_mock_tasks_v2';
const TASK_TEMPLATES_STORE_KEY = 'opennext_mock_task_templates_v1';
const TASK_SUBTASKS_KEY = 'opennext_mock_task_subtasks_v1';
const TASK_COMMENTS_KEY = 'opennext_mock_task_comments_v1';
const TIME_LOGS_STORE_KEY = 'opennext_mock_time_logs_v2';
const EXPENSES_STORE_KEY = 'opennext_mock_expenses_v3';
const RECURRING_EXPENSES_STORE_KEY = 'opennext_mock_recurring_expenses_v1';
const SAMPLES_STORE_KEY = 'opennext_mock_samples_v2';
const TICKETS_STORE_KEY = 'opennext_mock_tickets_v3';
const CANNED_RESPONSES_STORE_KEY = 'opennext_mock_canned_responses_v1';
const CUSTOMER_FEEDBACK_STORE_KEY = 'opennext_mock_customer_feedback_v2';
const MARKETING_STORE_KEY = 'opennext_mock_marketing_v2';
const REENGAGEMENT_STORE_KEY = 'opennext_mock_reengagement_v1';
const MARKETING_ACTIVITY_STORE_KEY = 'opennext_mock_marketing_activity_v1';

const INITIAL_WAVE_SAMPLES: SampleItem[] = [
  normalizeSample({
    _id: 'sample-1',
    sampleNumber: 'SMP-2026-0001',
    linkType: 'client',
    clientId: 'client_1',
    linkedName: 'Acme Corporation',
    recipientName: 'Rahul Mehta',
    productName: '100% Organic Cotton Swatch Kit',
    quantity: 2,
    unit: 'swatches',
    urgency: 'Normal',
    status: 'Requested',
    deliveryAddress: '12 MG Road, Bengaluru, Karnataka',
    notes: 'Need olive and charcoal shades',
    createdAt: '2026-09-07T09:00:00Z',
  }),
  normalizeSample({
    _id: 'sample-2',
    sampleNumber: 'SMP-2026-0002',
    linkType: 'lead',
    leadId: 'lead_101',
    linkedName: 'Acme Cloud Innovations',
    recipientName: 'Vikram Malhotra',
    productName: 'Custom Printed Box Packaging Prototype',
    quantity: 2,
    unit: 'pcs',
    urgency: 'High',
    status: 'Approved',
    stockLocation: 'Warehouse A / Rack 4 / Bin 12',
    approvedAt: '2026-09-08T08:00:00Z',
    createdAt: '2026-09-07T14:00:00Z',
  }),
  normalizeSample({
    _id: 'sample-3',
    sampleNumber: 'SMP-2026-0003',
    linkType: 'client',
    clientId: 'client_2',
    linkedName: 'Stark Industries',
    recipientName: 'Finance Desk',
    productName: 'Precision Machined Alloy Component Sample',
    quantity: 1,
    unit: 'pcs',
    urgency: 'Urgent',
    status: 'Dispatched',
    courierName: 'DHL Express',
    trackingNumber: 'DHL-8472910382',
    dispatchDate: '2026-09-08',
    estimatedDeliveryDate: '2026-09-11',
    stockLocation: 'Warehouse B / Rack 1',
    approvedAt: '2026-09-08T06:00:00Z',
    createdAt: '2026-09-06T10:00:00Z',
  }),
  normalizeSample({
    _id: 'sample-4',
    sampleNumber: 'SMP-2026-0004',
    linkType: 'client',
    clientId: 'client_3',
    linkedName: 'Wayne Enterprises',
    recipientName: 'Procurement',
    productName: 'Sample Formulation Grade A (Vial)',
    quantity: 1,
    unit: 'liters',
    urgency: 'Normal',
    status: 'Delivered',
    courierName: 'BlueDart',
    trackingNumber: 'BD-99887766',
    dispatchDate: '2026-09-04',
    estimatedDeliveryDate: '2026-09-06',
    deliveredAt: '2026-09-06T15:30:00Z',
    createdAt: '2026-09-02T09:00:00Z',
  }),
  normalizeSample({
    _id: 'sample-5',
    sampleNumber: 'SMP-2026-0005',
    linkType: 'lead',
    leadId: 'lead_106',
    linkedName: 'Titan Manufacturing Corp',
    recipientName: 'Deepak Joshi',
    productName: 'Polyester Yarn / Fabric Sample Roll',
    quantity: 5,
    unit: 'meters',
    urgency: 'Low',
    status: 'Completed',
    courierName: 'FedEx',
    trackingNumber: 'FDX-112233',
    dispatchDate: '2026-08-20',
    deliveredAt: '2026-08-23T11:00:00Z',
    feedback: {
      rating: 4,
      comments: 'Good hand-feel. Slightly revise GSM for bulk.',
      interestedInOrder: true,
      requiresImprovement: true,
      routedDepartment: 'R&D / Technical',
      improvementNotes: 'Increase GSM by 5%.',
      feedbackDate: '2026-08-25T10:00:00Z',
      routedTaskId: 'task_sample_improve_1',
    },
    createdAt: '2026-08-18T09:00:00Z',
  }),
];
const INITIAL_WAVE_TICKETS: TicketItem[] = [
  {
    _id: 'ticket-1',
    ticketNumber: 'TCK-2026-0001',
    requesterType: 'Client',
    requesterName: 'Acme Ops',
    requesterCompany: 'Acme Corporation',
    clientId: 'client_1',
    assignGroup: 'Technical',
    assignedTo: 'user-1',
    assignedToName: 'Aarav Sharma',
    projectId: 'proj_1',
    projectName: 'Acme Portal Redesign',
    type: 'Incident',
    subject: 'Unable to access staging',
    description: 'The staging sign-in page returns an error after SSO redirect.',
    priority: 'High',
    channelName: 'Email',
    tags: ['staging', 'Bug'],
    status: 'Open',
    slaHours: 24,
    slaDueDate: computeSlaDueDate('2026-09-08T08:30:00Z', 24),
    slaBreached: false,
    escalationLevel: 'Standard',
    watchers: ['user-2'],
    messages: [
      {
        _id: 'msg-1',
        senderName: 'Acme Ops',
        senderRole: 'Client',
        message: 'We cannot log into staging since this morning.',
        isInternal: false,
        createdAt: '2026-09-08T08:35:00Z',
      },
    ],
    reassignmentHistory: [],
    isArchived: false,
    createdAt: '2026-09-08T08:30:00Z',
  },
  {
    _id: 'ticket-2',
    ticketNumber: 'TCK-2026-0002',
    requesterType: 'Client',
    requesterName: 'Stark Finance',
    requesterCompany: 'Stark Industries',
    clientId: 'client_2',
    assignGroup: 'Billing',
    assignedTo: 'user-2',
    assignedToName: 'Priya Sharma',
    type: 'Question',
    subject: 'Invoice tax clarification',
    description: 'Please clarify CGST/SGST vs IGST on INV-0042.',
    priority: 'Medium',
    channelName: 'Phone',
    tags: ['invoice', 'Billing'],
    status: 'In Progress',
    slaHours: 48,
    slaDueDate: computeSlaDueDate('2026-09-07T11:00:00Z', 48),
    slaBreached: false,
    firstResponseAt: '2026-09-07T12:00:00Z',
    escalationLevel: 'Standard',
    watchers: [],
    messages: [
      {
        _id: 'msg-2',
        senderName: 'Priya Sharma',
        senderRole: 'Agent',
        message: 'Checking tax mode against shipping state.',
        isInternal: true,
        createdAt: '2026-09-07T12:00:00Z',
      },
      {
        _id: 'msg-3',
        senderName: 'Priya Sharma',
        senderRole: 'Agent',
        message: 'We applied IGST because destination was inter-state.',
        isInternal: false,
        createdAt: '2026-09-07T12:15:00Z',
      },
    ],
    reassignmentHistory: [],
    isArchived: false,
    createdAt: '2026-09-07T11:00:00Z',
  },
  {
    _id: 'ticket-3',
    ticketNumber: 'TCK-2026-0003',
    requesterType: 'Employee',
    requesterName: 'Rahul Mehta',
    assignGroup: 'Technical',
    type: 'Bug',
    subject: 'Webhook retries exhausting queue',
    description: 'Payment webhooks retry loop after 500 from gateway.',
    priority: 'Urgent',
    channelName: 'Slack',
    tags: ['Critical', 'Billing'],
    status: 'Pending Client',
    slaHours: 4,
    slaDueDate: computeSlaDueDate(new Date(Date.now() - 5 * 3600 * 1000).toISOString(), 4),
    slaBreached: true,
    escalationLevel: 'Level 2',
    assignedTo: 'user-1',
    assignedToName: 'Aarav Sharma',
    watchers: ['user-3'],
    messages: [],
    reassignmentHistory: [
      {
        fromUser: 'Unassigned',
        toUser: 'user-1',
        toUserName: 'Aarav Sharma',
        reallocatedBy: 'Support Lead',
        reason: 'Urgent production incident',
        reassignedAt: '2026-09-09T06:00:00Z',
      },
    ],
    isArchived: false,
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    _id: 'ticket-4',
    ticketNumber: 'TCK-2026-0004',
    requesterType: 'Client',
    requesterName: 'Wayne IT',
    requesterCompany: 'Wayne Enterprises',
    clientId: 'client_3',
    assignGroup: 'Customer Success',
    type: 'Service Request',
    subject: 'Need onboarding checklist',
    description: 'Please share the V2 onboarding checklist PDF.',
    priority: 'Low',
    channelName: 'Portal',
    tags: ['Onboarding', 'V2'],
    status: 'Resolved',
    slaHours: 72,
    slaDueDate: computeSlaDueDate('2026-09-01T09:00:00Z', 72),
    slaBreached: false,
    resolvedAt: '2026-09-02T14:00:00Z',
    resolutionNotes: 'Shared checklist and scheduled kickoff call.',
    satisfactionRating: 5,
    escalationLevel: 'Standard',
    assignedTo: 'user-2',
    assignedToName: 'Priya Sharma',
    messages: [],
    reassignmentHistory: [],
    isArchived: false,
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    _id: 'ticket-5',
    ticketNumber: 'TCK-2026-0005',
    requesterType: 'Client',
    requesterName: 'Globex Support',
    requesterCompany: 'Globex Corp',
    clientId: 'client_5',
    assignGroup: 'Installation',
    type: 'Complaint',
    subject: 'Installer failed on Windows 11',
    description: 'Silent install exits with code 1603.',
    priority: 'High',
    channelName: 'Email',
    tags: ['Installation'],
    status: 'Closed',
    slaHours: 24,
    slaDueDate: computeSlaDueDate('2026-08-20T10:00:00Z', 24),
    resolvedAt: '2026-08-21T08:00:00Z',
    resolutionNotes: 'Provided patched MSI.',
    satisfactionRating: 4,
    escalationLevel: 'Standard',
    isArchived: true,
    messages: [],
    reassignmentHistory: [],
    createdAt: '2026-08-20T10:00:00Z',
  },
];

const INITIAL_CANNED_RESPONSES: CannedResponse[] = [
  {
    _id: 'canned-1',
    title: 'Acknowledge receipt',
    body: 'Thanks for reaching out. We have received your request and a support engineer will respond shortly.',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    _id: 'canned-2',
    title: 'Request logs',
    body: 'Could you please share relevant screenshots or log files so we can investigate further?',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    _id: 'canned-3',
    title: 'Resolved follow-up',
    body: 'We believe this issue is resolved. Please confirm and rate your support experience so we can close the ticket.',
    createdAt: '2026-08-01T00:00:00Z',
  },
];
const INITIAL_WAVE_FEEDBACK: CustomerFeedbackItem[] = [
  {
    _id: 'feedback-1',
    clientId: 'client_1',
    clientName: 'Acme Corporation',
    clientEmail: 'billing@acmecorp.com',
    rating: 5,
    category: 'Customer Service',
    comments: 'Fast and clear support. The team resolved our staging issue within SLA.',
    submittedAt: '2026-09-06T10:00:00Z',
  },
  {
    _id: 'feedback-2',
    clientId: 'client_2',
    clientName: 'Stark Industries',
    clientEmail: 'finance@stark.com',
    rating: 4,
    category: 'Product Quality',
    comments: 'Great quality overall. Packaging could be tighter for fragile kits.',
    submittedAt: '2026-09-05T13:00:00Z',
  },
  {
    _id: 'feedback-3',
    clientId: 'client_1',
    clientName: 'Acme Corporation',
    clientEmail: 'billing@acmecorp.com',
    rating: 5,
    category: 'Delivery Speed',
    comments: 'Shipment arrived ahead of schedule. Excellent coordination.',
    submittedAt: '2026-08-28T09:00:00Z',
  },
  {
    _id: 'feedback-4',
    clientId: 'client_3',
    clientName: 'Wayne Enterprises',
    clientEmail: 'contact@wayne.com',
    rating: 3,
    category: 'Pricing',
    comments: 'Service is solid but renewal quote felt high versus market.',
    submittedAt: '2026-08-20T15:00:00Z',
  },
  {
    _id: 'feedback-5',
    clientId: 'client_5',
    clientName: 'Globex Corp',
    clientEmail: 'support@globex.org',
    rating: 2,
    category: 'Customer Service',
    comments: 'Installer ticket took too long and breached SLA twice.',
    submittedAt: '2026-09-01T11:00:00Z',
  },
  {
    _id: 'feedback-6',
    clientId: 'client_2',
    clientName: 'Stark Industries',
    clientEmail: 'finance@stark.com',
    rating: 5,
    category: 'General',
    comments: 'Outstanding partnership this quarter.',
    submittedAt: '2026-07-15T10:00:00Z',
  },
];
const INITIAL_WAVE_CAMPAIGNS: MarketingCampaign[] = [
  normalizeCampaign({
    _id: 'campaign-1',
    name: 'Q3 Lost Lead WinBack Drip',
    type: 'Lost Lead Re-engagement',
    targetAudience: 'Lost Leads',
    subject: 'Special offer for {{company}} — Hi {{name}}',
    content:
      'Hi {{name}},\n\nWe noticed {{company}} went quiet. Ready to restart?\n\n{{cta_button}}\n\n— Root CRM Team',
    status: 'Active',
    executedAt: '2026-09-08T14:30:00Z',
    stats: {
      sent: 42,
      opened: 18,
      clicked: 9,
      reEngagedLeads: 3,
      revenueGenerated: 450000,
    },
    createdAt: '2026-09-01T09:00:00Z',
  }),
  normalizeCampaign({
    _id: 'campaign-2',
    name: '30-Day Inactive Client Nurture',
    type: 'Repeat Business Nurture',
    targetAudience: 'Dormant Clients (>90 days)',
    subject: 'Checking in from Root CRM: update for {{company}}',
    content:
      'Hi {{name}}, it has been a while since your last order with us. Here is a special restart offer for {{company}}.\n\nReply or click below to reconnect.\n{{cta_button}}',
    status: 'Draft',
    stats: { sent: 0, opened: 0, clicked: 0, reEngagedLeads: 0, revenueGenerated: 0 },
    createdAt: '2026-09-04T09:00:00Z',
  }),
  normalizeCampaign({
    _id: 'campaign-3',
    name: 'September Product Update',
    type: 'Promotional Announcement',
    targetAudience: 'All Contacts',
    subject: 'What is new this month for {{company}}',
    content: 'Explore the latest product updates tailored for {{name}} at {{company}}.',
    status: 'Completed',
    executedAt: '2026-09-05T11:00:00Z',
    stats: {
      sent: 120,
      opened: 64,
      clicked: 22,
      reEngagedLeads: 5,
      revenueGenerated: 275000,
    },
    createdAt: '2026-09-02T08:00:00Z',
  }),
  normalizeCampaign({
    _id: 'campaign-4',
    name: 'Unqualified Lead Warm-Up Series',
    type: 'Email Drip',
    targetAudience: 'Unqualified Leads',
    subject: 'A better fit for {{company}}?',
    content: 'Hi {{name}}, still exploring options? Here is a short guide for {{company}}.\n{{cta_link}}',
    status: 'Paused',
    executedAt: '2026-08-20T10:00:00Z',
    stats: {
      sent: 28,
      opened: 10,
      clicked: 4,
      reEngagedLeads: 1,
      revenueGenerated: 50000,
    },
    createdAt: '2026-08-15T09:00:00Z',
  }),
];

const INITIAL_REENGAGEMENT_REQUESTS: ReEngagementRequest[] = [
  {
    _id: 'reeng-1',
    campaignId: 'campaign-1',
    campaignName: 'Q3 Lost Lead WinBack Drip',
    leadId: 'lead_106',
    leadName: 'Deepak Joshi',
    leadCompany: 'Titan Manufacturing Corp',
    leadEmail: 'd.joshi@titanmfg.co.in',
    expectedRevenue: 350000,
    actionType: 'Email CTA Button Click',
    notes: 'Clicked CTA from win-back drip',
    status: 'Pending',
    previousStage: 'Lost',
    createdAt: '2026-09-08T16:00:00Z',
  },
];

const INITIAL_MARKETING_ACTIVITY: PipelineReEntryEvent[] = [
  {
    _id: 'mkt-act-1',
    leadId: 'lead_106',
    leadName: 'Deepak Joshi',
    leadCompany: 'Titan Manufacturing Corp',
    campaignId: 'campaign-1',
    campaignName: 'Q3 Lost Lead WinBack Drip',
    previousStage: 'Lost',
    newStage: 'Contacted',
    actionType: 'Client Re-contacted & Ready',
    expectedRevenue: 350000,
    createdAt: '2026-09-07T12:00:00Z',
  },
];
const ADMIN_SETTINGS_KEY = 'opennext_mock_admin_settings_v2';
const SETTINGS_USER_DESIGNATIONS_KEY = 'opennext_mock_settings_user_designations_v1';
const SETTINGS_EMAIL_STATUS_KEY = 'opennext_mock_settings_email_status_v1';
const DATA_QUALITY_RULES_KEY = 'opennext_mock_data_quality_rules_v1';

export const DEFAULT_TRAVEL_LOCATIONS = {
  from: [
    'Mumbai',
    'Delhi',
    'Bengaluru',
    'Hyderabad',
    'Ahmedabad',
    'Chennai',
    'Kolkata',
    'Pune',
    'Jaipur',
    'Kochi',
    'Chandigarh',
    'Lucknow',
  ],
  to: [
    'Goa',
    'Dubai',
    'Bangkok',
    'Singapore',
    'Manali',
    'Shimla',
    'Kashmir',
    'Kerala',
    'Jaipur',
    'Maldives',
    'Bali',
    'London',
  ],
  destination: [
    'Goa Beach Holiday',
    'Dubai City & Desert',
    'Himachal Tour',
    'Kerala Backwaters',
    'Golden Triangle (Delhi-Agra-Jaipur)',
    'Kashmir Paradise',
    'Thailand Experience',
    'Singapore Discovery',
    'Maldives Resort Stay',
    'Bali Tropical Gateway',
  ],
};

export const DEFAULT_TRAVEL_SERVICES: string[] = [
  'Hotel',
  'Air Ticket / Flight',
  'Bus Ticket',
  'Cab / Transport',
  'Tour Package',
  'Visa Assistance',
  'Cruise',
];

const DEFAULT_ADMIN_SETTINGS: CrmSettings = {
  company_name: 'Root CRM',
  company_state: 'Maharashtra',
  office_address: 'Plot 42, Tech Park, Andheri East, Mumbai, Maharashtra - 400069',
  office_addresses: ['Plot 42, Tech Park, Andheri East, Mumbai, Maharashtra - 400069'],
  sample_units_of_measure: ['pcs', 'kg', 'litre', 'meter', 'box', 'packet', 'roll', 'set', 'swatch', 'gram'],
  courier_carriers: [
    'BlueDart Express',
    'Delhivery Logistics',
    'Shiprocket Direct',
    'FedEx Express',
    'DTDC Courier',
    'Professional Courier',
    'Custom Courier',
  ],
  tracking_number_options: [],
  default_currency: getRuntimeDefaultCurrency(),
  tax_rate: 18,
  free_shipping_threshold: 5000,
  state_shipping_rates: { ...STANDARD_STATE_SHIPPING_RATES },
  sales_order_generated_by_sources: [
    'Root CRM',
    'Direct Sales',
    'E-Commerce Store',
    'POS Terminal',
    'Client Portal',
  ],
  quotation_prefix: 'QUO-',
  sales_order_prefix: 'SO-',
  invoice_prefix: 'INV-',
  payment_prefix: 'PAY-',
  expense_prefix: 'EXP-',
  client_tax_id_prefix: 'TAX-',
  quotation_valid_days: 30,
  default_hourly_rate: 0,
  quotation_sequence: 0,
  sales_order_sequence: 0,
  invoice_sequence: 0,
  payment_sequence: 0,
  expense_sequence: 0,
  client_tax_id_sequence: 0,
  expense_categories: [...DEFAULT_EXPENSE_CATEGORIES],
  task_client_reminder_auto_enabled: false,
  task_client_reminder_hours: 24,
  quotation_email_subject: 'Quotation {{docNo}} from {{companyName}}',
  invoice_email_subject: 'Invoice {{docNo}} from {{companyName}}',
  quotation_email_intro: 'Please review the quotation details below.',
  invoice_email_intro: 'Please find your invoice details below.',
  lead_sources: [...LEAD_SOURCES],
  lead_statuses: [...LEAD_STATUSES],
  lead_types: [...LEAD_TYPES],
  lead_priorities: [...LEAD_PRIORITIES],
  lead_tags: [...LEAD_TAGS],
  pipeline_stages: [...PIPELINE_STAGES],
  opportunity_stages: [...DEFAULT_OPPORTUNITY_STAGE_NAMES],
  opportunity_stage_probabilities: { ...DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES },
  client_categories: [...DEFAULT_CLIENT_CATEGORIES],
  client_tags: [...DEFAULT_CLIENT_TAGS],
  project_statuses: [...DEFAULT_PROJECT_STATUSES],
  project_priorities: [...DEFAULT_PROJECT_PRIORITIES],
  project_categories: [...INITIAL_PROJECT_CATEGORIES],
  project_tags: [...INITIAL_PROJECT_TAGS],
  lead_custom_fields: [],
  client_custom_fields: INITIAL_MOCK_CUSTOM_FIELD_DEFS.map((field) => ({
    key: field.key,
    label: field.label,
    type: (['text', 'number', 'date', 'select', 'textarea', 'boolean', 'url', 'email'].includes(field.type)
      ? field.type
      : 'text') as CrmSettings['client_custom_fields'][number]['type'],
    options: field.options,
    required: field.required,
  })),
  project_custom_fields: [],
  qualification_match: { ...DEFAULT_QUALIFICATION_MATCH_CATALOG },
  travel_locations: { ...DEFAULT_TRAVEL_LOCATIONS },
  travel_services: [...DEFAULT_TRAVEL_SERVICES],
};

function normalizeCrmSettings(raw?: Partial<CrmSettings> | null): CrmSettings {
  const merged: CrmSettings = {
    ...DEFAULT_ADMIN_SETTINGS,
    ...(raw || {}),
    company_name:
      String(raw?.company_name ?? '').trim() || DEFAULT_ADMIN_SETTINGS.company_name,
    company_state:
      String(raw?.company_state ?? '').trim() || DEFAULT_ADMIN_SETTINGS.company_state,
    office_address:
      raw?.office_address !== undefined
        ? String(raw.office_address).trim()
        : DEFAULT_ADMIN_SETTINGS.office_address || '',
    office_addresses:
      Array.isArray(raw?.office_addresses)
        ? raw.office_addresses.map((a) => String(a || '').trim()).filter(Boolean)
        : DEFAULT_ADMIN_SETTINGS.office_addresses || [],
    sample_units_of_measure:
      raw?.sample_units_of_measure?.length
        ? raw.sample_units_of_measure.map((u) => String(u || '').trim()).filter(Boolean)
        : DEFAULT_ADMIN_SETTINGS.sample_units_of_measure || [],
    courier_carriers:
      raw?.courier_carriers?.length
        ? raw.courier_carriers.map((c) => String(c || '').trim()).filter(Boolean)
        : DEFAULT_ADMIN_SETTINGS.courier_carriers || [],
    tracking_number_options: Array.isArray(raw?.tracking_number_options)
      ? raw.tracking_number_options.map((t) => String(t || '').trim()).filter(Boolean)
      : DEFAULT_ADMIN_SETTINGS.tracking_number_options || [],
    default_currency:
      String(raw?.default_currency ?? '').trim().toUpperCase() ||
      getRuntimeDefaultCurrency(),
    state_shipping_rates:
      raw?.state_shipping_rates && Object.keys(raw.state_shipping_rates).length
        ? { ...raw.state_shipping_rates }
        : { ...STANDARD_STATE_SHIPPING_RATES },
    sales_order_generated_by_sources:
      raw?.sales_order_generated_by_sources?.length
        ? raw.sales_order_generated_by_sources
        : DEFAULT_ADMIN_SETTINGS.sales_order_generated_by_sources,
    expense_categories: raw?.expense_categories?.length
      ? raw.expense_categories
      : DEFAULT_ADMIN_SETTINGS.expense_categories,
    lead_sources: raw?.lead_sources?.length ? raw.lead_sources : DEFAULT_ADMIN_SETTINGS.lead_sources,
    lead_statuses: mergeLeadStatusesWithBuiltins(
      raw?.lead_statuses?.length ? raw.lead_statuses : DEFAULT_ADMIN_SETTINGS.lead_statuses
    ),
    lead_types: raw?.lead_types?.length ? raw.lead_types : DEFAULT_ADMIN_SETTINGS.lead_types,
    lead_priorities: raw?.lead_priorities?.length
      ? raw.lead_priorities
      : DEFAULT_ADMIN_SETTINGS.lead_priorities,
    lead_tags: raw?.lead_tags?.length ? raw.lead_tags : DEFAULT_ADMIN_SETTINGS.lead_tags,
    pipeline_stages: raw?.pipeline_stages?.length
      ? raw.pipeline_stages
      : DEFAULT_ADMIN_SETTINGS.pipeline_stages,
    opportunity_stages: (() => {
      const source = raw?.opportunity_stages?.length
        ? raw.opportunity_stages
        : DEFAULT_ADMIN_SETTINGS.opportunity_stages;
      const seen = new Set<string>();
      const names: string[] = [];
      for (const stage of source) {
        let name = String(stage || '').trim();
        if (/^contract reviews?$/i.test(name)) name = 'Quotation Sent';
        if (!name || seen.has(name)) continue;
        seen.add(name);
        names.push(name);
      }
      return names.length ? names : [...DEFAULT_ADMIN_SETTINGS.opportunity_stages];
    })(),
    opportunity_stage_probabilities: (() => {
      const merged = {
        ...DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES,
        ...(raw?.opportunity_stage_probabilities &&
        typeof raw.opportunity_stage_probabilities === 'object'
          ? raw.opportunity_stage_probabilities
          : {}),
      } as Record<string, number>;
      if (
        merged['Quotation Sent'] === undefined &&
        Number.isFinite(Number(merged['Contract Review']))
      ) {
        merged['Quotation Sent'] = Number(merged['Contract Review']);
      }
      delete merged['Contract Review'];
      return merged;
    })(),
    client_categories: raw?.client_categories?.length
      ? raw.client_categories
      : DEFAULT_ADMIN_SETTINGS.client_categories,
    client_tags: raw?.client_tags?.length ? raw.client_tags : DEFAULT_ADMIN_SETTINGS.client_tags,
    project_statuses: mergeProjectStatusesWithBuiltins(
      raw?.project_statuses?.length ? raw.project_statuses : DEFAULT_ADMIN_SETTINGS.project_statuses
    ),
    project_priorities: raw?.project_priorities?.length
      ? raw.project_priorities
      : DEFAULT_ADMIN_SETTINGS.project_priorities,
    project_categories: raw?.project_categories?.length
      ? raw.project_categories
      : DEFAULT_ADMIN_SETTINGS.project_categories,
    project_tags: raw?.project_tags?.length ? raw.project_tags : DEFAULT_ADMIN_SETTINGS.project_tags,
    lead_custom_fields: normalizeCustomFields(
      raw?.lead_custom_fields ?? DEFAULT_ADMIN_SETTINGS.lead_custom_fields
    ),
    client_custom_fields: normalizeCustomFields(
      raw?.client_custom_fields ?? DEFAULT_ADMIN_SETTINGS.client_custom_fields
    ),
    project_custom_fields: normalizeCustomFields(
      raw?.project_custom_fields ?? DEFAULT_ADMIN_SETTINGS.project_custom_fields
    ),
    qualification_match: {
      projectSoftwareTypes:
        raw?.qualification_match?.projectSoftwareTypes?.length
          ? raw.qualification_match.projectSoftwareTypes
          : DEFAULT_ADMIN_SETTINGS.qualification_match.projectSoftwareTypes,
      projectTechnologies:
        raw?.qualification_match?.projectTechnologies?.length
          ? raw.qualification_match.projectTechnologies
          : DEFAULT_ADMIN_SETTINGS.qualification_match.projectTechnologies,
      projectUserBands:
        raw?.qualification_match?.projectUserBands?.length
          ? raw.qualification_match.projectUserBands
          : DEFAULT_ADMIN_SETTINGS.qualification_match.projectUserBands,
      projectIntegrations:
        raw?.qualification_match?.projectIntegrations?.length
          ? raw.qualification_match.projectIntegrations
          : DEFAULT_ADMIN_SETTINGS.qualification_match.projectIntegrations,
      productCategories:
        raw?.qualification_match?.productCategories?.length
          ? raw.qualification_match.productCategories
          : DEFAULT_ADMIN_SETTINGS.qualification_match.productCategories,
      productSpecifications:
        raw?.qualification_match?.productSpecifications?.length
          ? raw.qualification_match.productSpecifications
          : DEFAULT_ADMIN_SETTINGS.qualification_match.productSpecifications,
      productCertifications:
        raw?.qualification_match?.productCertifications?.length
          ? raw.qualification_match.productCertifications
          : DEFAULT_ADMIN_SETTINGS.qualification_match.productCertifications,
    },
    travel_locations: {
      from: Array.isArray(raw?.travel_locations?.from)
        ? raw.travel_locations.from
        : DEFAULT_TRAVEL_LOCATIONS.from,
      to: Array.isArray(raw?.travel_locations?.to)
        ? raw.travel_locations.to
        : DEFAULT_TRAVEL_LOCATIONS.to,
      destination: Array.isArray(raw?.travel_locations?.destination)
        ? raw.travel_locations.destination
        : DEFAULT_TRAVEL_LOCATIONS.destination,
    },
    travel_services: Array.isArray(raw?.travel_services)
      ? raw.travel_services
      : DEFAULT_TRAVEL_SERVICES,
  };
  return merged;
}

function getLocalCrmSettings(): CrmSettings {
  return normalizeCrmSettings(readLocalAdminValue(ADMIN_SETTINGS_KEY, DEFAULT_ADMIN_SETTINGS));
}

function saveLocalCrmSettings(settings: CrmSettings) {
  saveLocalAdminValue(ADMIN_SETTINGS_KEY, normalizeCrmSettings(settings));
}

function getLocalUserDesignations(): Record<string, string> {
  return readLocalAdminValue<Record<string, string>>(SETTINGS_USER_DESIGNATIONS_KEY, {});
}

function saveLocalUserDesignations(map: Record<string, string>) {
  saveLocalAdminValue(SETTINGS_USER_DESIGNATIONS_KEY, map);
}

function buildWorkspaceUsers(): SettingsWorkspaceUser[] {
  const designations = getLocalUserDesignations();
  const roleMap: Record<string, { role: string; permissions: string[]; categories: string[] }> = {
    usr_1: {
      role: 'CRM Manager',
      permissions: [
        'crm.settings.manage',
        'crm.leads.write',
        'crm.clients.write',
        'crm.marketing.write',
        'crm.projects.write',
      ],
      categories: ['Settings', 'Leads', 'Clients', 'Marketing', 'Projects'],
    },
    usr_2: {
      role: 'Sales Manager',
      permissions: ['crm.leads.write', 'crm.clients.write', 'crm.opportunities.write', 'crm.marketing.read'],
      categories: ['Leads', 'Clients', 'Opportunities', 'Marketing'],
    },
    usr_3: {
      role: 'Sales Representative',
      permissions: ['crm.leads.read', 'crm.leads.write', 'crm.clients.read'],
      categories: ['Leads', 'Clients'],
    },
    usr_4: {
      role: 'Editor',
      permissions: ['crm.leads.read', 'crm.clients.read', 'crm.projects.read'],
      categories: ['Leads', 'Clients', 'Projects'],
    },
  };
  return INITIAL_MOCK_USERS.map((user, index) => {
    const meta = roleMap[user.id] || {
      role: 'CRM Employee',
      permissions: ['crm.leads.read'],
      categories: ['Leads'],
    };
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      designation: designations[user.id] || user.designation || '',
      role: meta.role,
      permissions: meta.permissions,
      permissionCategories: meta.categories,
      isCurrentUser: index === 0,
      initials: user.initials,
      bgColor: user.bgColor,
    };
  });
}

const SETTINGS_PERMISSION_CATEGORY_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  clients: 'Clients',
  dataQuality: 'Data Quality',
  projects: 'Projects',
  tasks: 'Tasks',
  time: 'Time Logs',
  expenses: 'Expenses',
  finance: 'Finance',
  contracts: 'Contracts',
  samples: 'Samples',
  opportunities: 'Opportunities',
  orders: 'Orders',
  tickets: 'Tickets',
  customerSuccess: 'Customer Success',
  marketing: 'Marketing',
  analytics: 'Analytics',
  ai: 'AI',
  audit: 'Audit',
  reports: 'Reports',
  settings: 'Settings',
  users: 'Users',
  quotes: 'Quotations',
};

function extractSettingsMembersList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.members)) return record.members;
    if (Array.isArray(record.data)) return record.data;
    if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.items)) return nested.items;
      if (Array.isArray(nested.members)) return nested.members;
    }
  }
  return [];
}

function normalizeSettingsRoleKey(role?: string, cmsRole?: number | string): string {
  const raw = String(role || '').trim().toLowerCase();
  // Never treat Mongo ObjectIds as role keys
  if (/^[a-f0-9]{24}$/i.test(raw)) {
    const cms = String(cmsRole ?? '').toLowerCase();
    if (cms.includes('client') || cms.includes('customer') || cms.includes('portal')) return 'client';
    return 'crm-employee';
  }
  if (cmsRole === 0 || cmsRole === '0' || raw === 'superadmin') return 'crm-manager';
  if (cmsRole === 1 || cmsRole === '1' || raw === 'admin' || raw === 'tenant_admin') return 'crm-manager';
  if (raw === 'sales-rep' || raw === 'sales_rep' || raw === 'sales_agent') return 'sales-representative';
  if (raw === 'accountant') return 'finance-manager';
  if (
    raw === 'client' ||
    raw.includes('client') ||
    raw.includes('customer') ||
    raw.includes('portal')
  ) {
    return 'client';
  }
  if (cmsRole === 2 || cmsRole === '2') return 'sales-manager';
  if (cmsRole === 3 || cmsRole === '3') return 'sales-representative';
  return raw || 'sales-representative';
}

/** Human-readable CRM role names (matches api/roles.js `name`, not the role id/slug). */
const SETTINGS_ROLE_DISPLAY_NAMES: Record<string, string> = {
  'crm-manager': 'CRM Manager',
  'sales-manager': 'Sales Manager',
  'sales-representative': 'Sales Representative',
  'project-manager': 'Project Lead',
  'crm-employee': 'Team Member',
  'finance-manager': 'Finance Lead',
  client: 'Client / Customer Portal',
};

function isRawRoleIdentifier(value: string): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^\d+$/.test(v)) return true;
  if (/^[a-f0-9]{24}$/i.test(v)) return true; // Mongo ObjectId
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true;
  // Plugin role slug/id (e.g. "client") — never show as the label
  if (SETTINGS_ROLE_DISPLAY_NAMES[v.toLowerCase()]) return true;
  return false;
}

function titleCaseRoleToken(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveSettingsRoleDisplayName(member: Record<string, unknown>): string {
  const roleKeyRaw = String(member.role || '').trim();
  const cmsRole = member.cmsRole as number | string | undefined;
  const normalizedKey = normalizeSettingsRoleKey(roleKeyRaw, cmsRole);

  const knownLabel =
    SETTINGS_ROLE_DISPLAY_NAMES[normalizedKey] ||
    SETTINGS_ROLE_DISPLAY_NAMES[roleKeyRaw.toLowerCase()] ||
    (String(roleKeyRaw).toLowerCase().includes('client')
      ? SETTINGS_ROLE_DISPLAY_NAMES.client
      : undefined);

  // Always use known CRM display name for plugin roles (fixes "client" id / ObjectId)
  if (knownLabel) return knownLabel;

  const candidates = [
    member.roleLabel,
    member.cmsRoleName,
    member.roleName,
    member.roleDisplayName,
    member.role,
  ];
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text && !isRawRoleIdentifier(text)) return text;
  }

  if (roleKeyRaw && !isRawRoleIdentifier(roleKeyRaw)) return titleCaseRoleToken(roleKeyRaw);
  return 'Member';
}

function categoriesFromPermissions(permissions: string[]): string[] {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const permission of permissions) {
    const segment = String(permission || '').split('.')[1] || '';
    if (!segment) continue;
    const label =
      SETTINGS_PERMISSION_CATEGORY_LABELS[segment] ||
      segment.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    if (!seen.has(label)) {
      seen.add(label);
      categories.push(label);
    }
  }
  return categories;
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.trim().slice(0, 2) || 'U').toUpperCase();
}

function resolveMemberPermissions(
  member: Record<string, unknown>,
  rolePermissions: Record<string, string[]> = {}
): string[] {
  if (Array.isArray(member.permissions)) {
    return member.permissions.map(String);
  }
  const cmsRole = member.cmsRole as number | string | undefined;
  const roleKey = normalizeSettingsRoleKey(String(member.role || ''), cmsRole);
  if (
    cmsRole === 0 ||
    cmsRole === 1 ||
    cmsRole === '0' ||
    cmsRole === '1' ||
    roleKey === 'crm-manager' ||
    roleKey === 'tenant_admin'
  ) {
    const fromManager = rolePermissions['crm-manager'];
    if (Array.isArray(fromManager) && fromManager.length) return fromManager.map(String);
  }
  const matched =
    rolePermissions[roleKey] ||
    rolePermissions[String(member.role || '')] ||
    [];
  return Array.isArray(matched) ? matched.map(String) : [];
}

function normalizeSettingsWorkspaceUser(
  raw: unknown,
  options: {
    rolePermissions?: Record<string, string[]>;
    currentUserId?: string;
  } = {}
): SettingsWorkspaceUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const member = raw as Record<string, unknown>;
  const userId = String(member.userId || member.id || member._id || '').trim();
  if (!userId) return null;
  const username = String(member.username || member.displayName || member.email || userId);
  const name = String(member.name || member.displayName || username);
  const roleLabel = resolveSettingsRoleDisplayName(member);
  const permissions = resolveMemberPermissions(member, options.rolePermissions);
  const categories = Array.isArray(member.permissionCategories)
    ? member.permissionCategories.map(String)
    : categoriesFromPermissions(permissions);
  return {
    id: userId,
    name,
    username,
    email: member.email ? String(member.email) : undefined,
    designation: String(member.designation || ''),
    role: roleLabel,
    permissions,
    permissionCategories: categories,
    isCurrentUser: Boolean(
      member.isCurrentUser ||
        (options.currentUserId && String(options.currentUserId) === userId)
    ),
    initials: String(member.initials || avatarInitials(name)),
    bgColor: member.bgColor ? String(member.bgColor) : '#2563eb',
  };
}

const DEFAULT_DATA_QUALITY_RULES: DataQualityRules = {
  leadWeights: { name: 10, email: 15, phone: 15, company: 15, pan: 15, address: 10, owner: 10, duplicates: 10 },
  clientWeights: { name: 15, email: 15, phone: 15, website: 10, address: 15, taxId: 10, contact: 10, duplicates: 10 },
  thresholds: { excellent: 85, good: 70, needsAttention: 50 },
};

function readLocalAdminValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch {}
  return fallback;
}

function saveLocalAdminValue(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function getLocalStringList(key: string, fallback: string[]): string[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  try {
    localStorage.setItem(key, JSON.stringify(fallback));
  } catch {}
  return [...fallback];
}

function saveLocalStringList(key: string, items: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

function getLocalCustomFieldDefs(): ClientCustomFieldDef[] {
  try {
    const saved = localStorage.getItem(CLIENT_CUSTOM_FIELDS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  try {
    localStorage.setItem(CLIENT_CUSTOM_FIELDS_KEY, JSON.stringify(INITIAL_MOCK_CUSTOM_FIELD_DEFS));
  } catch {}
  return [...INITIAL_MOCK_CUSTOM_FIELD_DEFS];
}

function saveLocalCustomFieldDefs(defs: ClientCustomFieldDef[]) {
  try {
    localStorage.setItem(CLIENT_CUSTOM_FIELDS_KEY, JSON.stringify(defs));
  } catch {}
}

function getLocalLeads(): LeadItem[] {
  try {
    const saved = localStorage.getItem(LEADS_STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  saveLocalLeads(INITIAL_MOCK_LEADS);
  return INITIAL_MOCK_LEADS;
}

function saveLocalLeads(leads: LeadItem[]) {
  try {
    localStorage.setItem(LEADS_STORE_KEY, JSON.stringify(leads));
  } catch {}
}

const CONTACTS_STORE_KEY = 'opennext_mock_person_contacts_v1';

function getLocalContacts(): PersonContact[] {
  try {
    const saved = localStorage.getItem(CONTACTS_STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalContacts(contacts: PersonContact[]) {
  try {
    localStorage.setItem(CONTACTS_STORE_KEY, JSON.stringify(contacts));
  } catch {}
}

function normalizeContactPhone(phone?: string): string {
  return String(phone || '').replace(/[^\d+]/g, '').trim();
}

function contactPhoneLast10(phone?: string): string {
  const digits = normalizeContactPhone(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function findLocalContactDuplicates(
  query: PersonContactDuplicateQuery,
  contacts: PersonContact[] = getLocalContacts()
): PersonContact[] {
  const email = String(query.email || '').trim().toLowerCase();
  const phone = normalizeContactPhone(query.phone);
  const phoneKey = contactPhoneLast10(query.phone);
  const pan = String(query.pan || '').trim().toUpperCase();
  if (!email && !phone && !pan) return [];
  return contacts.filter((c) => {
    if (query.excludeId && c._id === query.excludeId) return false;
    if (email && String(c.email || '').toLowerCase() === email) return true;
    if (phoneKey && contactPhoneLast10(c.phone) === phoneKey) return true;
    if (phone && normalizeContactPhone(c.phone) === phone) return true;
    if (pan && String(c.pan || '').toUpperCase() === pan) return true;
    return false;
  });
}

function getLocalFilters(): SavedLeadFilter[] {
  try {
    const saved = localStorage.getItem(FILTERS_STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_SAVED_FILTERS;
}

function saveLocalFilters(filters: SavedLeadFilter[]) {
  try {
    localStorage.setItem(FILTERS_STORE_KEY, JSON.stringify(filters));
  } catch {}
}

function getLocalClients(): ClientItem[] {
  try {
    const saved = localStorage.getItem(CLIENTS_STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  saveLocalClients(INITIAL_MOCK_CLIENTS);
  return [...INITIAL_MOCK_CLIENTS];
}

function saveLocalClients(clients: ClientItem[]) {
  try {
    localStorage.setItem(CLIENTS_STORE_KEY, JSON.stringify(clients));
  } catch {}
}

function getLocalClientMap<T>(key: string, fallback: Record<string, T[]>): Record<string, T[]> {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  try {
    localStorage.setItem(key, JSON.stringify(fallback));
  } catch {}
  return { ...fallback };
}

function saveLocalClientMap<T>(key: string, map: Record<string, T[]>) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}

function resolveClientDocumentKind(raw: Record<string, unknown> = {}): 'file' | 'link' {
  const provider = String(raw.storageProvider || '').toLowerCase();
  if (provider === 'url' || provider === 'external') return 'link';
  const mime = String(raw.mimeType || '').toLowerCase();
  if (mime === 'text/uri-list') return 'link';
  const url = String(raw.url || raw.fileUrl || '');
  const hasStorageKey = Boolean(String(raw.storageKey || '').trim());
  // External http(s) with no stored binary → link (covers older records saved as local)
  if (/^https?:\/\//i.test(url) && !hasStorageKey) return 'link';
  if (provider === 's3' || provider === 'local') return 'file';
  return hasStorageKey ? 'file' : 'link';
}

function normalizeClientDocument(
  raw: Record<string, unknown> = {},
  opts: {
    forceKind?: 'file' | 'link';
    fallbackName?: string;
    fallbackMime?: string;
    fallbackSize?: number;
    fallbackCategory?: string;
    fallbackDescription?: string;
  } = {}
): ClientDocument {
  const kind = opts.forceKind || resolveClientDocumentKind(raw);
  return {
    _id: String(raw._id || ''),
    name: String(raw.name || raw.originalName || raw.fileName || opts.fallbackName || 'Document'),
    url: String(raw.url || raw.fileUrl || ''),
    kind,
    storageProvider: String(raw.storageProvider || (kind === 'link' ? 'url' : '')),
    storageKey: String(raw.storageKey || ''),
    category: String(raw.category || opts.fallbackCategory || 'General'),
    description: String(raw.description || opts.fallbackDescription || ''),
    mimeType: String(raw.mimeType || opts.fallbackMime || '') || undefined,
    size: Number(raw.fileSize ?? raw.size ?? opts.fallbackSize ?? 0) || 0,
    uploadedByName: raw.uploadedByName ? String(raw.uploadedByName) : undefined,
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
  };
}

function getLocalOpportunitiesRaw(): OpportunityItem[] {
  try {
    const saved = localStorage.getItem(OPPORTUNITIES_STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  saveLocalOpportunities(INITIAL_MOCK_OPPORTUNITIES);
  return [...INITIAL_MOCK_OPPORTUNITIES];
}

function getLocalOpportunities(): OpportunityItem[] {
  return getLocalOpportunitiesRaw().filter((item) => !item.isDeleted);
}

/** Maps live API + local mock summary shapes onto OpportunitySummary KPI fields. */
function normalizeOpportunitySummary(
  raw?: (Partial<OpportunitySummary> & Record<string, unknown>) | null
): OpportunitySummary {
  const source = raw || {};
  const totalDeals = Number(
    source.totalDeals ?? source.totalOpportunities ?? source.total ?? 0
  );
  const pipelineValue = Number(
    source.pipelineValue ?? source.totalPipelineRevenue ?? 0
  );
  const weightedForecast = Number(
    source.weightedForecast ?? source.totalWeightedForecast ?? 0
  );
  const wonRevenue = Number(source.wonRevenue ?? 0);
  const winRate = Number(source.winRate ?? 0);
  return {
    totalDeals: Number.isFinite(totalDeals) ? totalDeals : 0,
    pipelineValue: Number.isFinite(pipelineValue) ? pipelineValue : 0,
    weightedForecast: Number.isFinite(weightedForecast) ? weightedForecast : 0,
    wonRevenue: Number.isFinite(wonRevenue) ? wonRevenue : 0,
    winRate: Number.isFinite(winRate) ? winRate : 0,
    openDeals: source.openDeals != null ? Number(source.openDeals) : undefined,
    wonDeals: source.wonDeals != null ? Number(source.wonDeals) : undefined,
    lostDeals: source.lostDeals != null ? Number(source.lostDeals) : undefined,
  };
}

function saveLocalOpportunities(items: OpportunityItem[]) {
  try {
    localStorage.setItem(OPPORTUNITIES_STORE_KEY, JSON.stringify(items));
  } catch {}
}

function getLocalFinanceList<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
    localStorage.setItem(key, JSON.stringify(fallback));
  } catch {}
  return [...fallback];
}

function saveLocalFinanceList<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

function getLocalSamples(): SampleItem[] {
  return getLocalFinanceList(SAMPLES_STORE_KEY, INITIAL_WAVE_SAMPLES)
    .map((item) => normalizeSample(item as Partial<SampleItem> & Record<string, unknown>))
    .filter((item) => !item.isDeleted);
}

function saveLocalSamples(items: SampleItem[]) {
  saveLocalFinanceList(
    SAMPLES_STORE_KEY,
    items.map((item) => normalizeSample(item as Partial<SampleItem> & Record<string, unknown>))
  );
}

function filterLocalSamples(params: SampleQueryParams = {}): SampleItem[] {
  let items = getLocalSamples();
  if (params.status) items = items.filter((item) => item.status === params.status);
  if (params.leadId) items = items.filter((item) => item.leadId === params.leadId);
  if (params.clientId) items = items.filter((item) => item.clientId === params.clientId);
  if (params.opportunityId) {
    items = items.filter((item) => item.opportunityId === params.opportunityId);
  }
  if (params.search) {
    const term = params.search.toLowerCase();
    items = items.filter((item) =>
      [item.sampleNumber, item.productName, item.linkedName, item.trackingNumber, item.courierName]
        .some((value) => String(value || '').toLowerCase().includes(term))
    );
  }
  return items;
}

function resolveSampleLinkedName(body: SampleCreateInput): string {
  if (body.linkType === 'opportunity' || body.opportunityId) {
    const opp = getLocalOpportunities().find((item) => item._id === body.opportunityId);
    return opp
      ? `${opp.opportunityNumber || 'OPP'} · ${opp.title}`
      : body.recipientName || body.opportunityId || 'Opportunity';
  }
  if (body.linkType === 'lead') {
    const lead = getLocalLeads().find((item) => item._id === body.leadId);
    return lead ? `${lead.company} (${lead.name})` : body.recipientName || body.leadId || 'Lead';
  }
  const client = getLocalClients().find((item) => item._id === body.clientId);
  return client?.name || body.recipientName || body.clientId || 'Client';
}

function updateLocalSample(
  id: string,
  updater: (current: SampleItem) => SampleItem
): SampleItem {
  const items = getLocalFinanceList(SAMPLES_STORE_KEY, INITIAL_WAVE_SAMPLES).map((item) =>
    normalizeSample(item as Partial<SampleItem> & Record<string, unknown>)
  );
  const index = items.findIndex((item) => item._id === id && !item.isDeleted);
  if (index < 0) throw new ApiError('Sample request not found', 404);
  const updated = normalizeSample({
    ...updater(items[index]),
    updatedAt: new Date().toISOString(),
  });
  items[index] = updated;
  saveLocalSamples(items);
  return updated;
}

function getLocalTickets(): TicketItem[] {
  return getLocalFinanceList(TICKETS_STORE_KEY, INITIAL_WAVE_TICKETS).map(normalizeTicket);
}

function saveLocalTickets(items: TicketItem[]) {
  saveLocalFinanceList(TICKETS_STORE_KEY, items);
}

function normalizeClientNote(raw: Partial<ClientNote> | Record<string, unknown> | null | undefined = {}): ClientNote {
  const source = (raw || {}) as Record<string, unknown>;
  const body = String(source.body || source.content || '').trim();
  const pinned = Boolean(source.pinned ?? source.isPinned);
  return {
    _id: String(source._id || `note_${Date.now()}`),
    title: String(source.title || 'Untitled note'),
    body,
    content: body,
    pinned,
    isPinned: pinned,
    category: source.category ? String(source.category) : undefined,
    color: source.color ? String(source.color) : undefined,
    createdByName: source.createdByName ? String(source.createdByName) : undefined,
    createdAt: source.createdAt ? String(source.createdAt) : undefined,
    updatedAt: source.updatedAt ? String(source.updatedAt) : undefined,
  };
}

function normalizeClientEvent(raw: Partial<ClientEvent> | Record<string, unknown> | null | undefined = {}): ClientEvent {
  const source = (raw || {}) as Record<string, unknown>;
  const type = String(source.type || source.eventType || 'Other');
  const dueAt = String(source.dueAt || source.eventDate || '');
  const status = String(source.status || (source.completed ? 'Completed' : 'Open'));
  return {
    _id: String(source._id || `event_${Date.now()}`),
    title: String(source.title || 'Event'),
    type,
    eventType: type,
    description: source.description ? String(source.description) : undefined,
    dueAt: dueAt || undefined,
    eventDate: dueAt || undefined,
    completed: status === 'Completed' || Boolean(source.completed),
    status,
    completedAt: source.completedAt ? String(source.completedAt) : undefined,
    createdAt: source.createdAt ? String(source.createdAt) : undefined,
  };
}

function normalizeTicket(raw: Partial<TicketItem> & { _id?: string }): TicketItem {
  const createdAt = raw.createdAt || new Date().toISOString();
  const slaHours = Number(raw.slaHours || slaHoursForPriority(raw.priority || 'Medium'));
  const slaDueDate = raw.slaDueDate || computeSlaDueDate(createdAt, slaHours);
  const status = raw.status || 'Open';
  const evaluated = evaluateSla({
    slaDueDate,
    slaBreached: raw.slaBreached,
    status,
    resolvedAt: raw.resolvedAt,
  });
  return {
    ...raw,
    _id: raw._id || `ticket-${Date.now()}`,
    ticketNumber: raw.ticketNumber || 'TCK-0000',
    assignGroup: raw.assignGroup || 'Technical',
    channelName: raw.channelName || 'Email',
    tags: raw.tags || [],
    subject: raw.subject || '',
    description: raw.description || '',
    type: raw.type || 'Service Request',
    priority: raw.priority || 'Medium',
    status,
    slaHours,
    slaDueDate,
    slaBreached: evaluated.breached,
    messages: raw.messages || [],
    reassignmentHistory: raw.reassignmentHistory || [],
    watchers: raw.watchers || [],
    escalationLevel: raw.escalationLevel || 'Standard',
    isArchived: Boolean(raw.isArchived),
    isDeleted: Boolean(raw.isDeleted),
    createdAt,
  };
}

function nextTicketNumber(list: TicketItem[]): string {
  const year = new Date().getFullYear();
  const max = list.reduce((highest, item) => {
    const match = String(item.ticketNumber || '').match(/(\d+)$/);
    const num = match ? Number(match[1]) : 0;
    return Number.isFinite(num) ? Math.max(highest, num) : highest;
  }, 0);
  return `TCK-${year}-${String(max + 1).padStart(4, '0')}`;
}

function filterTicketsList(items: TicketItem[], params: TicketQueryParams): TicketItem[] {
  let filtered = items.filter((item) => !item.isDeleted);
  const archived =
    params.isArchived === true || params.isArchived === 'true' || params.isArchived === '1';
  filtered = filtered.filter((item) => Boolean(item.isArchived) === archived);
  if (params.status) filtered = filtered.filter((item) => item.status === params.status);
  if (params.priority) {
    const priorities = String(params.priority)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (priorities.length) {
      filtered = filtered.filter((item) => priorities.includes(String(item.priority || '')));
    }
  }
  if (String(params.attention || '').toLowerCase() === 'escalations') {
    filtered = filtered.filter(
      (item) =>
        !['Resolved', 'Closed'].includes(String(item.status || '')) &&
        ['Urgent', 'High'].includes(String(item.priority || ''))
    );
  }
  if (params.type) filtered = filtered.filter((item) => item.type === params.type);
  if (params.assignGroup) filtered = filtered.filter((item) => item.assignGroup === params.assignGroup);
  if (params.channelName) filtered = filtered.filter((item) => item.channelName === params.channelName);
  if (params.clientId) filtered = filtered.filter((item) => item.clientId === params.clientId);
  if (params.ids) {
    const idSet = new Set(
      String(params.ids)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    );
    filtered = filtered.filter((item) => idSet.has(item._id));
  }
  if (params.from) {
    filtered = filtered.filter((item) => (item.createdAt || '') >= params.from!);
  }
  if (params.to) {
    filtered = filtered.filter((item) => (item.createdAt || '').slice(0, 10) <= params.to!);
  }
  if (params.search) {
    const term = params.search.toLowerCase();
    filtered = filtered.filter((item) =>
      [
        item.ticketNumber,
        item.subject,
        item.requesterName,
        item.requesterCompany,
        item.projectName,
        item.assignedToName,
      ].some((value) => value?.toLowerCase().includes(term))
    );
  }
  return filtered.map(normalizeTicket);
}

function computeLocalAccountHealthRecords(): AccountHealthRecord[] {
  const clients = getLocalClients();
  const feedback = getLocalFinanceList(CUSTOMER_FEEDBACK_STORE_KEY, INITIAL_WAVE_FEEDBACK);
  const orders = getLocalSalesOrders().filter((order) => order.status !== 'Cancelled');
  const tickets = getLocalTickets();
  const invoices = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return clients.map((client) => {
    const clientFeedback = feedback.filter((item) => item.clientId === client._id);
    const clientOrders = orders.filter((order) => order.clientId === client._id);
    const lastOrderAt = clientOrders
      .map((order) => order.issueDate || order.createdAt || '')
      .filter(Boolean)
      .sort()
      .reverse()[0];
    const clientTickets = tickets.filter((ticket) => ticket.clientId === client._id);
    const openTickets = clientTickets.filter((ticket) =>
      ['Open', 'In Progress', 'Pending Client'].includes(String(ticket.status))
    ).length;
    const breachedTickets = clientTickets.filter((ticket) => {
      if (ticket.slaBreached) return true;
      if (!ticket.slaDueDate) return false;
      if (['Resolved', 'Closed'].includes(String(ticket.status))) return false;
      return new Date(ticket.slaDueDate).getTime() < Date.now();
    }).length;
    const overdueInvoices = invoices.filter((invoice) => {
      if (invoice.clientId !== client._id) return false;
      if (['Paid', 'Cancelled', 'Written Off'].includes(String(invoice.status))) return false;
      if (!invoice.dueDate) return false;
      const due = new Date(invoice.dueDate);
      due.setHours(0, 0, 0, 0);
      const balance = Number(invoice.balanceDue ?? invoice.grandTotal ?? 0);
      return due.getTime() < today.getTime() && balance > 0;
    }).length;

    return buildAccountHealth({
      clientId: client._id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone || client.mobile,
      category: client.category,
      status: String(client.status || ''),
      ratings: clientFeedback.map((item) => Number(item.rating)),
      orderCount: clientOrders.length,
      lastOrderAt: lastOrderAt || null,
      openTickets,
      breachedTickets,
      overdueInvoices,
    });
  });
}

function getLocalSalesOrders(): SalesOrderItem[] {
  return getLocalFinanceList(SALES_ORDERS_STORE_KEY, INITIAL_MOCK_SALES_ORDERS).map(normalizeSalesOrder);
}

function getLocalMarketingCampaigns(): MarketingCampaign[] {
  return getLocalFinanceList(MARKETING_STORE_KEY, INITIAL_WAVE_CAMPAIGNS)
    .map(normalizeCampaign)
    .filter((item) => !item.isDeleted);
}

function saveLocalMarketingCampaigns(items: MarketingCampaign[]) {
  saveLocalFinanceList(MARKETING_STORE_KEY, items.map(normalizeCampaign));
}

function getLocalReEngagementRequests(): ReEngagementRequest[] {
  return getLocalFinanceList(REENGAGEMENT_STORE_KEY, INITIAL_REENGAGEMENT_REQUESTS);
}

function saveLocalReEngagementRequests(items: ReEngagementRequest[]) {
  saveLocalFinanceList(REENGAGEMENT_STORE_KEY, items);
}

function getLocalMarketingActivity(): PipelineReEntryEvent[] {
  return getLocalFinanceList(MARKETING_ACTIVITY_STORE_KEY, INITIAL_MARKETING_ACTIVITY);
}

function saveLocalMarketingActivity(items: PipelineReEntryEvent[]) {
  saveLocalFinanceList(MARKETING_ACTIVITY_STORE_KEY, items);
}

function leadExpectedRevenue(lead: LeadItem): number {
  const value =
    Number(lead.value) ||
    Number(lead.qualification?.expectedRevenue) ||
    Number(lead.qualification?.budget) ||
    50000;
  return Number.isFinite(value) && value > 0 ? value : 50000;
}

function isLostLead(lead: LeadItem): boolean {
  return (
    lead.stage === 'Lost' ||
    lead.status === 'Lost' ||
    lead.qualification?.status === 'Rejected'
  );
}

function isUnqualifiedLead(lead: LeadItem): boolean {
  return (
    lead.stage === 'Unqualified' ||
    lead.status === 'Unqualified' ||
    lead.qualification?.status === 'Rejected'
  );
}

function resolveMarketingAudience(segment: string): MarketingAudienceRecipient[] {
  const leads = getLocalLeads().filter((lead) => Boolean(lead.email?.trim()));
  const clients = getLocalClients().filter((client) => Boolean(client.email?.trim()));
  const orders = getLocalSalesOrders().filter((order) => order.status !== 'Cancelled');
  const cutoff = Date.now() - 90 * 86400000;

  const mapLead = (lead: LeadItem): MarketingAudienceRecipient => ({
    id: lead._id,
    kind: 'lead',
    name: lead.name || lead.contactName || 'Valued Customer',
    company: lead.company || '',
    email: lead.email,
    phone: lead.phone,
    stage: lead.stage,
    expectedRevenue: leadExpectedRevenue(lead),
  });

  const mapClient = (client: ClientItem): MarketingAudienceRecipient => ({
    id: client._id,
    kind: 'client',
    name: client.contactPerson || client.primaryContact?.name || client.name,
    company: client.name,
    email: client.email || '',
    phone: client.phone || client.mobile,
  });

  if (segment === 'Lost Leads') {
    return leads.filter(isLostLead).map(mapLead);
  }
  if (segment === 'Unqualified Leads') {
    return leads.filter(isUnqualifiedLead).map(mapLead);
  }
  if (segment === 'Dormant Clients (>90 days)') {
    return clients
      .filter((client) => {
        const recent = orders.some((order) => {
          if (order.clientId !== client._id) return false;
          const stamp = order.issueDate || order.createdAt || '';
          return stamp ? new Date(stamp).getTime() >= cutoff : false;
        });
        return !recent;
      })
      .map(mapClient);
  }

  const byEmail = new Map<string, MarketingAudienceRecipient>();
  [...leads.map(mapLead), ...clients.map(mapClient)].forEach((recipient) => {
    const key = recipient.email.toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, recipient);
  });
  return Array.from(byEmail.values());
}

function computeLocalAudienceStats(): MarketingAudienceStats {
  const leads = getLocalLeads();
  const lostLeads = leads.filter(isLostLead).length;
  const unqualifiedLeads = leads.filter(isUnqualifiedLead).length;
  const dormantClients = resolveMarketingAudience('Dormant Clients (>90 days)').length;
  const totalContacts = resolveMarketingAudience('All Contacts').length;
  return { lostLeads, unqualifiedLeads, dormantClients, totalContacts };
}

function filterMarketingCampaigns(
  items: MarketingCampaign[],
  params: MarketingCampaignQuery = {}
): MarketingCampaign[] {
  let filtered = items.filter((item) => !item.isDeleted);
  if (params.status) filtered = filtered.filter((item) => item.status === params.status);
  if (params.type) filtered = filtered.filter((item) => item.type === params.type);
  if (params.search) {
    const term = params.search.toLowerCase();
    filtered = filtered.filter((item) =>
      [item.name, item.subject, item.emailSubject, item.targetAudience, item.targetSegment]
        .some((value) => String(value || '').toLowerCase().includes(term))
    );
  }
  return filtered;
}

function computeLocalMarketingAnalytics(): MarketingAnalytics {
  const campaigns = getLocalMarketingCampaigns();
  const audience = computeLocalAudienceStats();
  const totalSent = campaigns.reduce((sum, item) => sum + Number(item.stats?.sent || 0), 0);
  const totalReEngaged = campaigns.reduce(
    (sum, item) => sum + Number(item.stats?.reEngagedLeads || 0),
    0
  );
  const attributedRevenue = campaigns.reduce(
    (sum, item) => sum + Number(item.stats?.revenueGenerated || 0),
    0
  );
  const rate = conversionRate(totalSent, totalReEngaged);
  const avgDeal = totalReEngaged ? Math.round(attributedRevenue / totalReEngaged) : 0;

  const segmentKeys = [
    'Lost Leads',
    'Unqualified Leads',
    'Dormant Clients (>90 days)',
    'All Contacts',
  ];
  const bySegment = segmentKeys.map((key) => {
    const rows = campaigns.filter(
      (item) => (item.targetAudience || item.targetSegment) === key
    );
    const sent = rows.reduce((sum, item) => sum + Number(item.stats?.sent || 0), 0);
    const reEngaged = rows.reduce(
      (sum, item) => sum + Number(item.stats?.reEngagedLeads || 0),
      0
    );
    const revenue = rows.reduce(
      (sum, item) => sum + Number(item.stats?.revenueGenerated || 0),
      0
    );
    return {
      key,
      label: key,
      sent,
      reEngaged,
      conversionRate: conversionRate(sent, reEngaged),
      revenue,
    };
  });

  const typeKeys = [
    'Lost Lead Re-engagement',
    'Repeat Business Nurture',
    'Email Drip',
    'Promotional Announcement',
  ];
  const byType = typeKeys.map((key) => {
    const rows = campaigns.filter((item) => item.type === key);
    const sent = rows.reduce((sum, item) => sum + Number(item.stats?.sent || 0), 0);
    const reEngaged = rows.reduce(
      (sum, item) => sum + Number(item.stats?.reEngagedLeads || 0),
      0
    );
    const revenue = rows.reduce(
      (sum, item) => sum + Number(item.stats?.revenueGenerated || 0),
      0
    );
    return {
      key,
      label: key,
      campaigns: rows.length,
      sent,
      reEngaged,
      conversionRate: conversionRate(sent, reEngaged),
      revenue,
    };
  });

  const leaderboard = [...campaigns]
    .sort(
      (a, b) =>
        Number(b.stats?.revenueGenerated || 0) - Number(a.stats?.revenueGenerated || 0) ||
        Number(b.stats?.reEngagedLeads || 0) - Number(a.stats?.reEngagedLeads || 0)
    )
    .slice(0, 10)
    .map((item, index) => {
      const sent = Number(item.stats?.sent || 0);
      const reEngaged = Number(item.stats?.reEngagedLeads || 0);
      return {
        rank: index + 1,
        campaignId: item._id,
        name: item.name,
        targetAudience: item.targetAudience || item.targetSegment,
        type: String(item.type),
        sent,
        reEngaged,
        conversionRate: conversionRate(sent, reEngaged),
        revenue: Number(item.stats?.revenueGenerated || 0),
      };
    });

  return {
    totalSent,
    totalReEngaged,
    conversionRate: rate,
    attributedRevenue,
    avgDeal,
    funnel: {
      audienceBase: audience.totalContacts,
      dispatched: totalSent,
      reEngaged: totalReEngaged,
      revenue: attributedRevenue,
    },
    bySegment,
    byType,
    leaderboard,
  };
}

function applyLeadWinBack(input: {
  leadId: string;
  targetStage: string;
  actionType: string;
  notes?: string;
  campaign: MarketingCampaign;
}): { lead: LeadItem; revenue: number; previousStage: string } {
  const leads = getLocalLeads();
  const index = leads.findIndex((item) => item._id === input.leadId);
  if (index < 0) throw new ApiError('Lead not found', 404);
  const lead = leads[index];
  const previousStage = lead.stage;
  const revenue = leadExpectedRevenue(lead);
  const nextQualificationStatus =
    input.targetStage === 'Qualified' ? 'Qualified' : 'In Review';
  const noteLine = `Pipeline Win-Back via ${input.campaign.name} (${input.actionType})${
    input.notes?.trim() ? `: ${input.notes.trim()}` : ''
  }`;
  const updated: LeadItem = {
    ...lead,
    stage: input.targetStage,
    status: input.targetStage === 'Qualified' ? 'Qualified' : 'Active',
    qualification: {
      ...(lead.qualification || {}),
      status: nextQualificationStatus,
      qualificationNotes: [lead.qualification?.qualificationNotes, noteLine]
        .filter(Boolean)
        .join('\n'),
    },
    updatedAt: new Date().toISOString(),
  };
  leads[index] = updated;
  saveLocalLeads(leads);
  return { lead: updated, revenue, previousStage };
}

function bumpCampaignWinBack(campaignId: string, revenue: number): MarketingCampaign {
  const items = getLocalFinanceList(MARKETING_STORE_KEY, INITIAL_WAVE_CAMPAIGNS).map(normalizeCampaign);
  const index = items.findIndex((item) => item._id === campaignId);
  if (index < 0) throw new ApiError('Campaign not found', 404);
  const current = items[index];
  const stats: CampaignStats = {
    ...(current.stats || { sent: 0, opened: 0, clicked: 0, reEngagedLeads: 0, revenueGenerated: 0 }),
    reEngagedLeads: Number(current.stats?.reEngagedLeads || 0) + 1,
    revenueGenerated: Number(current.stats?.revenueGenerated || 0) + revenue,
  };
  const updated = normalizeCampaign({
    ...current,
    stats,
    updatedAt: new Date().toISOString(),
  });
  items[index] = updated;
  saveLocalMarketingCampaigns(items);
  return updated;
}

function saveLocalSalesOrders(items: SalesOrderItem[]) {
  saveLocalFinanceList(SALES_ORDERS_STORE_KEY, items);
}

function nextSalesOrderNumber(list: SalesOrderItem[]): string {
  const year = new Date().getFullYear();
  const max = list.reduce((highest, item) => {
    const match = String(item.orderNumber || '').match(/(\d+)$/);
    const num = match ? Number(match[1]) : 0;
    return Number.isFinite(num) ? Math.max(highest, num) : highest;
  }, 0);
  return `SO-${year}-${String(max + 1).padStart(4, '0')}`;
}

function normalizeSalesOrder(raw: Partial<SalesOrderItem> & { _id?: string }): SalesOrderItem {
  const lineItems = (raw.lineItems || []).map((line) => ({
    ...line,
    qty: Number(line.qty) || 0,
    rate: Number(line.rate) || 0,
    tax: Number(line.tax ?? 18),
    amount: Number(line.amount ?? Number(line.qty || 0) * Number(line.rate || 0)),
    shippedQty: Number(line.shippedQty || 0),
    returnedQty: Number(line.returnedQty || 0),
  }));
  const discountType =
    raw.discountType === 'fixed' || raw.discountType === 'amount' ? 'amount' : raw.discountType || 'percent';
  const discountValue = Number(raw.discountValue ?? raw.discount ?? 0);
  const totals = calculateFinanceTotals({
    lines: lineItems,
    discountType,
    discountValue,
    shippingCharge: Number(raw.shippingCharge || 0),
  });
  return {
    ...raw,
    _id: raw._id || `sales_order_${Date.now()}`,
    orderNumber: raw.orderNumber || 'SO-0000',
    clientId: raw.clientId || '',
    clientName: raw.clientName || '',
    generatedBy: raw.generatedBy || 'Root CRM',
    status: (raw.status as SalesOrderStatus) || 'Approved',
    issueDate: raw.issueDate || new Date().toISOString().slice(0, 10),
    shippingState: raw.shippingState || 'Maharashtra',
    currency: raw.currency || getRuntimeDefaultCurrency(),
    lineItems,
    discountType,
    discountValue,
    discount: discountValue,
    discountTotal: totals.discount,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    shippingCharge: totals.shippingCharge,
    grandTotal: totals.grandTotal,
    deliveryStatus: (raw.deliveryStatus as SalesOrderDeliveryStatus) || 'Pending Allocation',
    shipments: raw.shipments || [],
    returns: raw.returns || [],
    stockReserved: Boolean(raw.stockReserved),
    inventoryDeducted: Boolean(raw.inventoryDeducted),
    stockAudit: raw.stockAudit || [],
    isDeleted: Boolean(raw.isDeleted),
  };
}

function recomputeSalesOrderFulfillment(order: SalesOrderItem): SalesOrderItem {
  const lineItems = order.lineItems || [];
  const totalQty = lineItems.reduce((sum, line) => sum + Number(line.qty || 0), 0);
  const shippedQty = lineItems.reduce((sum, line) => sum + Number(line.shippedQty || 0), 0);
  const shipments = order.shipments || [];
  const allDelivered =
    shipments.length > 0 &&
    shipments.every((shipment) => shipment.deliveryStatus === 'Delivered') &&
    shippedQty >= totalQty &&
    totalQty > 0;

  let deliveryStatus: SalesOrderDeliveryStatus = order.deliveryStatus || 'Pending Allocation';
  let status = order.status;

  if (allDelivered) {
    deliveryStatus = 'Delivered';
    status = 'Completed';
  } else if (shippedQty <= 0) {
    deliveryStatus = order.stockReserved ? 'Allocated' : 'Pending Allocation';
  } else if (shippedQty < totalQty) {
    deliveryStatus = 'Partially Dispatched';
    if (!['Cancelled', 'Returned', 'Completed'].includes(status)) status = 'Partially Shipped';
  } else {
    deliveryStatus = 'Dispatched';
    if (!['Cancelled', 'Returned', 'Completed'].includes(status)) status = 'Processing';
  }

  return {
    ...order,
    status,
    deliveryStatus,
    deliveredAt: allDelivered ? order.deliveredAt || new Date().toISOString() : order.deliveredAt,
  };
}

function hasDispatchedPackages(order: SalesOrderItem): boolean {
  return (order.shipments || []).some((shipment) =>
    ['Dispatched', 'In-Transit', 'Delivered'].includes(shipment.deliveryStatus)
  );
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeInvoiceRecord(raw: InvoiceItem): InvoiceItem {
  const item = { ...raw };
  const totals = calculateFinanceTotals({
    lines: item.lineItems || [],
    discountType: item.discountType,
    discountValue:
      item.discountValue ??
      (item.discountType === 'amount' ? item.discountAmount : item.discountPercent) ??
      0,
    taxCalculation: item.taxCalculation,
    shippingCharge: item.shippingCharge,
    amountPaid: item.amountPaid,
    creditAmount: item.creditAmount,
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = item.dueDate ? new Date(`${String(item.dueDate).slice(0, 10)}T12:00:00`) : null;
  let status = item.status || 'Draft';
  const balanceDue =
    item.balanceDue != null
      ? Number(item.balanceDue)
      : totals.balanceDue;
  if (
    !['Paid', 'Written Off', 'Cancelled', 'Draft'].includes(status) &&
    balanceDue > 0 &&
    due &&
    due.getTime() < today.getTime()
  ) {
    status = 'Overdue';
  } else if (
    !['Written Off', 'Cancelled'].includes(status) &&
    totals.amountPaid > 0 &&
    balanceDue > 0
  ) {
    status = 'Partially Paid';
  } else if (!['Written Off', 'Cancelled'].includes(status) && balanceDue <= 0 && totals.grandTotal > 0) {
    status = 'Paid';
  }
  return {
    ...item,
    subtotal: item.subtotal ?? totals.subtotal,
    taxTotal: item.taxTotal ?? totals.taxTotal,
    grandTotal: item.grandTotal ?? totals.grandTotal,
    amountPaid: item.amountPaid ?? 0,
    creditAmount: item.creditAmount ?? 0,
    balanceDue,
    status,
    isArchived: Boolean(item.isArchived),
    isRecurring: Boolean(item.isRecurring || item.recurringProfileId),
  };
}

function mutateLocalInvoice(
  id: string,
  updater: (item: InvoiceItem) => InvoiceItem
): ApiResponse<InvoiceItem> {
  const items = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES);
  const index = items.findIndex((entry) => entry._id === id);
  if (index < 0) throw new ApiError('Invoice not found', 404);
  items[index] = normalizeInvoiceRecord({
    ...updater(items[index]),
    updatedAt: new Date().toISOString(),
  });
  saveLocalFinanceList(INVOICES_STORE_KEY, items);
  return { success: true, data: items[index] };
}

function getLocalInvoiceOrThrow(id: string): InvoiceItem {
  const item = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES).find(
    (entry) => entry._id === id
  );
  if (!item) throw new ApiError('Invoice not found', 404);
  return normalizeInvoiceRecord(item);
}

function syncLocalInvoicePaymentDelta(invoiceId: string, deltaPaid: number): void {
  if (!invoiceId || !deltaPaid) return;
  const items = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES);
  const index = items.findIndex((entry) => entry._id === invoiceId);
  if (index < 0) return;
  const current = items[index];
  const amountPaid = Math.max(0, Number(current.amountPaid || 0) + deltaPaid);
  const grandTotal = Number(current.grandTotal || 0);
  const creditAmount = Number(current.creditAmount || 0);
  const balanceDue = Math.max(0, grandTotal - amountPaid - creditAmount);
  let status = current.status;
  if (!['Written Off', 'Cancelled'].includes(status)) {
    if (balanceDue <= 0 && grandTotal > 0) status = 'Paid';
    else if (amountPaid > 0 && balanceDue > 0) status = 'Partially Paid';
    else if (status === 'Paid' || status === 'Partially Paid') status = 'Sent';
  }
  items[index] = normalizeInvoiceRecord({
    ...current,
    amountPaid,
    balanceDue,
    status,
    updatedAt: new Date().toISOString(),
  });
  saveLocalFinanceList(INVOICES_STORE_KEY, items);
}

function applyLocalPaymentAllocations(
  allocations: Array<{ invoiceId: string; amount: number }>,
  direction: 1 | -1
): void {
  for (const alloc of allocations) {
    if (!alloc.invoiceId || !(Number(alloc.amount) > 0)) continue;
    syncLocalInvoicePaymentDelta(alloc.invoiceId, direction * Number(alloc.amount));
  }
}

function normalizePaymentRecord(raw: PaymentItem): PaymentItem {
  const refunds = Array.isArray(raw.refunds) ? raw.refunds : [];
  const refundedAmount =
    raw.refundedAmount != null
      ? Number(raw.refundedAmount)
      : refunds
          .filter((item) => ['Approved', 'Processed'].includes(String(item.status)))
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  let status = raw.status || 'Completed';
  if (refundedAmount >= Number(raw.amount || 0) && Number(raw.amount || 0) > 0) status = 'Refunded';
  else if (refundedAmount > 0) status = 'Partially Refunded';
  const pending = refunds.some((item) => item.status === 'Pending Approval');
  const invoiceNo = String(raw.invoiceNo || raw.invoiceNumber || '').trim();
  const salesOrderNo = String(raw.salesOrderNo || '').trim();
  const gateway = String(raw.paymentGateway || '').trim();
  const displayMode =
    String(raw.displayMode || '').trim() ||
    (gateway.toLowerCase() === 'razorpay' || String(raw.mode || '').toLowerCase() === 'razorpay'
      ? 'Razorpay'
      : gateway || raw.mode || 'Other');
  return {
    ...raw,
    paymentNumber: raw.paymentNumber || raw.paymentNo || raw.receiptNumber,
    invoiceNo: invoiceNo || undefined,
    invoiceNumber: invoiceNo || undefined,
    salesOrderNo: salesOrderNo || undefined,
    displayMode,
    refunds,
    refundedAmount,
    refundStatus: pending
      ? 'Pending Approval'
      : refundedAmount >= Number(raw.amount || 0) && Number(raw.amount || 0) > 0
        ? 'Processed'
        : refundedAmount > 0
          ? 'Approved'
          : raw.refundStatus || 'None',
    status,
  };
}

function resolvePaymentAllocations(body: PaymentCreateInput): Array<{ invoiceId: string; amount: number; invoiceNumber?: string }> {
  if (Array.isArray(body.allocations) && body.allocations.length) {
    return body.allocations
      .filter((row) => row.invoiceId && Number(row.amount) > 0)
      .map((row) => ({
        invoiceId: row.invoiceId,
        amount: Number(row.amount),
        invoiceNumber: row.invoiceNumber,
      }));
  }
  if (body.invoiceId) {
    return [{ invoiceId: body.invoiceId, amount: Number(body.amount), invoiceNumber: undefined }];
  }
  // FIFO auto-allocate against open client invoices
  const invoices = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES)
    .map(normalizeInvoiceRecord)
    .filter(
      (invoice) =>
        invoice.clientId === body.clientId &&
        !invoice.isArchived &&
        !['Paid', 'Cancelled', 'Written Off'].includes(String(invoice.status)) &&
        Number(invoice.balanceDue ?? invoice.grandTotal) > 0
    )
    .sort((a, b) => String(a.dueDate || a.issueDate).localeCompare(String(b.dueDate || b.issueDate)));
  let remaining = Number(body.amount) || 0;
  const rows: Array<{ invoiceId: string; amount: number; invoiceNumber?: string }> = [];
  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const due = Number(invoice.balanceDue ?? invoice.grandTotal) || 0;
    const take = Math.min(remaining, due);
    if (take > 0) {
      rows.push({ invoiceId: invoice._id, amount: Number(take.toFixed(2)), invoiceNumber: invoice.invoiceNo });
      remaining = Number((remaining - take).toFixed(2));
    }
  }
  return rows;
}

function getLocalProjects(): ProjectItem[] {
  try {
    const saved = localStorage.getItem(PROJECTS_STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  saveLocalProjects(INITIAL_SEED_PROJECTS);
  return [...INITIAL_SEED_PROJECTS];
}

function saveLocalProjects(items: ProjectItem[]) {
  try {
    localStorage.setItem(PROJECTS_STORE_KEY, JSON.stringify(items));
  } catch {}
}

function getLocalProjectMap<T>(key: string, fallback: Record<string, T[]>): Record<string, T[]> {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  try {
    localStorage.setItem(key, JSON.stringify(fallback));
  } catch {}
  return { ...fallback };
}

function saveLocalProjectMap<T>(key: string, map: Record<string, T[]>) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}

function getLocalProjectList<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  try {
    localStorage.setItem(key, JSON.stringify(fallback));
  } catch {}
  return [...fallback];
}

function saveLocalProjectList<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

function getLocalExpenses(): ExpenseItem[] {
  return getLocalProjectList(EXPENSES_STORE_KEY, INITIAL_WAVE_EXPENSES).map(normalizeExpenseItem);
}

function saveLocalExpenses(items: ExpenseItem[]) {
  saveLocalProjectList(EXPENSES_STORE_KEY, items);
}

function getLocalRecurringExpenses(): RecurringExpenseItem[] {
  return getLocalProjectList(RECURRING_EXPENSES_STORE_KEY, INITIAL_WAVE_RECURRING_EXPENSES);
}

function saveLocalRecurringExpenses(items: RecurringExpenseItem[]) {
  saveLocalProjectList(RECURRING_EXPENSES_STORE_KEY, items);
}

function nextExpenseNo(list: ExpenseItem[]): string {
  const max = list.reduce((highest, item) => {
    const match = String(item.expenseNo || '').match(/(\d+)/);
    const num = match ? Number(match[1]) : 0;
    return Number.isFinite(num) ? Math.max(highest, num) : highest;
  }, 0);
  return `EXP-${String(max + 1).padStart(4, '0')}`;
}

function normalizeExpenseItem(raw: Partial<ExpenseItem> & { _id?: string }): ExpenseItem {
  const price = Number(raw.price ?? raw.amount ?? 0);
  const purchaseDate = raw.purchaseDate || raw.expenseDate || new Date().toISOString().slice(0, 10);
  const status = (raw.status as ExpenseStatus) || 'Draft';
  return {
    _id: raw._id || `expense_${Date.now()}`,
    expenseNo: raw.expenseNo || 'EXP-0000',
    title: raw.title || raw.itemName || '',
    itemName: raw.itemName || raw.title || '',
    amount: Number(raw.amount ?? price),
    price,
    currency: raw.currency || getRuntimeDefaultCurrency(),
    exchangeRate: Number(raw.exchangeRate ?? 1) || 1,
    expenseDate: raw.expenseDate || purchaseDate,
    purchaseDate,
    category: raw.category || 'Other',
    employeeId: raw.employeeId || '',
    employeeName: raw.employeeName || '',
    purchasedFrom: raw.purchasedFrom || '',
    bankAccount: raw.bankAccount || '',
    clientId: raw.clientId || '',
    clientName: raw.clientName || '',
    projectId: raw.projectId || '',
    projectName: raw.projectName || '',
    paymentMode: raw.paymentMode || 'Bank Transfer',
    receiptUrl: raw.receiptUrl || raw.billUrl || raw.bill || '',
    bill: raw.bill || raw.billUrl || raw.receiptUrl || '',
    billUrl: raw.billUrl || raw.bill || raw.receiptUrl || '',
    notes: raw.notes || '',
    description: raw.description || raw.notes || '',
    status,
    submittedAt: raw.submittedAt ?? null,
    approvedBy: raw.approvedBy || '',
    approvedAt: raw.approvedAt ?? null,
    rejectedBy: raw.rejectedBy || '',
    rejectedAt: raw.rejectedAt ?? null,
    rejectionReason: raw.rejectionReason || '',
    isBillable: Boolean(raw.isBillable),
    isBilled: Boolean(raw.isBilled),
    billedInvoiceId: raw.billedInvoiceId ?? null,
    billedInvoiceNo: raw.billedInvoiceNo || '',
    billedAt: raw.billedAt ?? null,
    recurringProfileId: raw.recurringProfileId ?? null,
    recurringCycle: raw.recurringCycle ?? null,
    isArchived: Boolean(raw.isArchived),
    archivedAt: raw.archivedAt ?? null,
    archivedBy: raw.archivedBy ?? null,
    isDeleted: Boolean(raw.isDeleted),
    deletedAt: raw.deletedAt ?? null,
    createdBy: raw.createdBy || 'system',
    updatedBy: raw.updatedBy || 'system',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function filterExpensesList(items: ExpenseItem[], params: ExpenseQueryParams): ExpenseItem[] {
  let filtered = items.filter((item) => !item.isDeleted);
  const archived =
    params.isArchived === true ||
    params.isArchived === 'true' ||
    params.isArchived === '1';
  filtered = filtered.filter((item) => Boolean(item.isArchived) === archived);
  if (params.projectId) filtered = filtered.filter((item) => item.projectId === params.projectId);
  if (params.clientId) filtered = filtered.filter((item) => item.clientId === params.clientId);
  if (params.employeeId) filtered = filtered.filter((item) => item.employeeId === params.employeeId);
  if (params.category) filtered = filtered.filter((item) => item.category === params.category);
  if (params.status) filtered = filtered.filter((item) => item.status === params.status);
  if (params.isBillable === true || params.isBillable === 'true') {
    filtered = filtered.filter((item) => item.isBillable);
  }
  if (params.isBilled === true || params.isBilled === 'true') {
    filtered = filtered.filter((item) => item.isBilled);
  }
  if (params.isBilled === false || params.isBilled === 'false') {
    filtered = filtered.filter((item) => !item.isBilled);
  }
  if (params.from) filtered = filtered.filter((item) => (item.expenseDate || item.purchaseDate) >= params.from!);
  if (params.to) filtered = filtered.filter((item) => (item.expenseDate || item.purchaseDate) <= params.to!);
  if (params.search) {
    const term = params.search.toLowerCase();
    filtered = filtered.filter((item) =>
      [
        item.itemName,
        item.title,
        item.expenseNo,
        item.purchasedFrom,
        item.employeeName,
        item.projectName,
        item.clientName,
        item.description,
      ].some((value) => value?.toLowerCase().includes(term))
    );
  }
  const sortBy = params.sortBy || 'expenseDate';
  const dir = params.sortDir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    const pick = (item: ExpenseItem) => {
      if (sortBy === 'price' || sortBy === 'amount') return String(item.price);
      if (sortBy === 'itemName') return item.itemName || '';
      if (sortBy === 'status') return item.status || '';
      if (sortBy === 'category') return item.category || '';
      if (sortBy === 'expenseNo') return item.expenseNo || '';
      return item.expenseDate || item.purchaseDate || '';
    };
    const left = pick(a);
    const right = pick(b);
    return left < right ? -1 * dir : left > right ? 1 * dir : 0;
  });
  return filtered;
}

function advanceRecurringDate(
  fromDate: string,
  frequency: RecurringExpenseFrequency,
  customDays = 30
): string {
  const date = new Date(`${fromDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fromDate;
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'half_yearly':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'custom':
      date.setDate(date.getDate() + Math.max(1, Number(customDays) || 30));
      break;
    case 'monthly':
    default:
      date.setMonth(date.getMonth() + 1);
      break;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createExpenseFromRecurring(profile: RecurringExpenseItem): ExpenseItem {
  const list = getLocalExpenses();
  const cycle = (profile.cyclesCompleted || 0) + 1;
  const price = Number(profile.price || profile.amount || 0);
  const runDate = profile.nextRunDate || new Date().toISOString().slice(0, 10);
  const created = normalizeExpenseItem({
    _id: `expense_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    expenseNo: nextExpenseNo(list),
    itemName: profile.itemName,
    title: profile.itemName,
    price,
    amount: price,
    currency: profile.currency || getRuntimeDefaultCurrency(),
    exchangeRate: Number(profile.exchangeRate || 1),
    purchaseDate: runDate,
    expenseDate: runDate,
    category: profile.category || 'Other',
    purchasedFrom: profile.vendorName || '',
    employeeId: profile.employeeId || '',
    employeeName: profile.employeeName || '',
    projectId: profile.projectId || '',
    projectName: profile.projectName || '',
    clientId: profile.clientId || '',
    clientName: profile.clientName || '',
    paymentMode: profile.paymentMode || 'Bank Transfer',
    bankAccount: profile.bankAccount || '',
    description: profile.description || '',
    notes: profile.notes || '',
    isBillable: Boolean(profile.isBillable),
    status: profile.autoSubmit === false ? 'Draft' : 'Submitted',
    submittedAt: profile.autoSubmit === false ? null : new Date().toISOString(),
    recurringProfileId: profile._id,
    recurringCycle: cycle,
    createdAt: new Date().toISOString(),
  });
  list.unshift(created);
  saveLocalExpenses(list);
  return created;
}

function pushProjectActivity(
  projectId: string,
  action: string,
  message: string,
  userName = 'System'
) {
  const map = getLocalProjectMap(PROJECT_ACTIVITY_KEY, INITIAL_MOCK_PROJECT_ACTIVITY);
  const entry: ProjectActivityEntry = {
    _id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    action,
    message,
    userName,
    createdAt: new Date().toISOString(),
  };
  map[projectId] = [entry, ...(map[projectId] || [])];
  saveLocalProjectMap(PROJECT_ACTIVITY_KEY, map);
}

function normalizeTaskSubtask(raw: Partial<TaskSubtask> & Record<string, unknown>): TaskSubtask {
  const done = Boolean(
    raw.done !== undefined ? raw.done : raw.isCompleted !== undefined ? raw.isCompleted : false
  );
  return {
    _id: String(raw._id || ''),
    taskId: String(raw.taskId || ''),
    title: String(raw.title || ''),
    done,
    isCompleted: done,
    currentDate: (raw.currentDate as string | null | undefined) ?? null,
    dueDate: (raw.dueDate as string | null | undefined) ?? (raw.currentDate as string | null | undefined) ?? null,
    assignedTo: raw.assignedTo ? String(raw.assignedTo) : '',
    assigneeName: raw.assigneeName ? String(raw.assigneeName) : undefined,
    description: raw.description ? String(raw.description) : '',
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

function toApiSubtaskPayload(body: {
  title?: string;
  currentDate?: string | null;
  dueDate?: string | null;
  assignedTo?: string;
  description?: string;
  done?: boolean;
  isCompleted?: boolean;
}) {
  const payload: Record<string, unknown> = { ...body };
  if (body.isCompleted === undefined && body.done !== undefined) {
    payload.isCompleted = body.done;
  }
  if (body.currentDate === undefined && body.dueDate !== undefined) {
    payload.currentDate = body.dueDate;
  }
  delete payload.done;
  return payload;
}

function normalizeProjectOverview(
  raw: unknown,
  fallbackHoursEstimate = 0,
  currency = getRuntimeDefaultCurrency()
): ProjectOverview {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const statistics =
    data.statistics && typeof data.statistics === 'object'
      ? (data.statistics as Record<string, unknown>)
      : {};
  const progressObj =
    data.progress && typeof data.progress === 'object'
      ? (data.progress as Record<string, unknown>)
      : null;
  const hoursObj =
    data.hoursLogged && typeof data.hoursLogged === 'object'
      ? (data.hoursLogged as Record<string, unknown>)
      : null;
  const breakdown =
    data.taskBreakdown && typeof data.taskBreakdown === 'object'
      ? (data.taskBreakdown as Record<string, number>)
      : {};
  const existingStats =
    data.taskStats && typeof data.taskStats === 'object'
      ? (data.taskStats as Record<string, unknown>)
      : null;

  const completedFromBreakdown = Number(breakdown.Completed || 0) || 0;
  const inProgressFromBreakdown = Number(breakdown['In Progress'] || 0) || 0;
  const totalFromBreakdown = Object.values(breakdown).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );

  const total =
    Number(existingStats?.total ?? progressObj?.totalTasks ?? totalFromBreakdown) || 0;
  const completed =
    Number(
      existingStats?.completed ?? progressObj?.completedTasks ?? completedFromBreakdown
    ) || 0;
  const inProgress = Number(existingStats?.inProgress ?? inProgressFromBreakdown) || 0;
  const overdue = Number(existingStats?.overdue ?? 0) || 0;

  const progressValue = progressObj
    ? Number(progressObj.percentage) || 0
    : Number(data.progress) || 0;

  const hoursLoggedValue = hoursObj
    ? Number(hoursObj.totalHours ?? hoursObj.total) || 0
    : Number(data.hoursLogged) || 0;

  const project =
    data.project && typeof data.project === 'object'
      ? (data.project as Record<string, unknown>)
      : {};

  return {
    budget: Number(statistics.budget ?? data.budget ?? project.budget) || 0,
    earnings: Number(statistics.earnings ?? data.earnings) || 0,
    expenses: Number(statistics.expenses ?? data.expenses) || 0,
    profit: Number(statistics.profit ?? data.profit) || 0,
    progress: progressValue,
    hoursLogged: hoursLoggedValue,
    hoursEstimate:
      Number(data.hoursEstimate ?? project.hoursEstimate ?? fallbackHoursEstimate) || 0,
    currency: String(data.currency || project.currency || currency || getRuntimeDefaultCurrency()),
    taskStats: {
      total,
      completed,
      inProgress,
      overdue,
    },
    taskBreakdown: Object.keys(breakdown).length ? breakdown : undefined,
    blockedAwaitingClientTasks: Array.isArray(data.blockedAwaitingClientTasks)
      ? (data.blockedAwaitingClientTasks as ProjectOverview['blockedAwaitingClientTasks'])
      : undefined,
    hoursByUser: (() => {
      if (Array.isArray(data.hoursByUser)) {
        return data.hoursByUser as ProjectOverview['hoursByUser'];
      }
      if (hoursObj?.byUser && typeof hoursObj.byUser === 'object') {
        return Object.entries(hoursObj.byUser as Record<string, number>).map(
          ([userName, hours]) => ({ userName, hours: Number(hours) || 0 })
        );
      }
      return undefined;
    })(),
  };
}

function refreshProjectTaskCounts(projectId: string) {
  const tasksMap = getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS);
  const tasks = tasksMap[projectId] || [];
  const projects = getLocalProjects();
  const idx = projects.findIndex((p) => p._id === projectId);
  if (idx < 0) return;
  const completed = tasks.filter((t) => t.status === 'Completed').length;
  const hoursLogged = getUnifiedTimeLogs()
    .filter((t) => t.projectId === projectId && t.status !== 'Running')
    .reduce((s, t) => s + (t.hours || 0), 0);
  projects[idx] = {
    ...projects[idx],
    taskCount: tasks.length,
    completedTaskCount: completed,
    progress: computeProjectProgress(projects[idx], tasks, hoursLogged),
    updatedAt: new Date().toISOString(),
  };
  saveLocalProjects(projects);
}

/** Accept `proj-1` / `proj_1` aliases so deep links always resolve. */
function resolveProjectId(id: string): string {
  const projects = getLocalProjects();
  if (projects.some((p) => p._id === id)) return id;
  const alt = id.includes('-') ? id.replace(/-/g, '_') : id.replace(/_/g, '-');
  if (projects.some((p) => p._id === alt)) return alt;
  return id;
}

function projectTaskToItem(task: ProjectTaskSummary): TaskItem {
  const project = getLocalProjects().find((p) => p._id === task.projectId);
  return {
    ...task,
    projectName: project?.name,
    assignedTo: task.assigneeId,
    priority: task.priority || 'Medium',
  };
}

function getUnifiedTasks(): TaskItem[] {
  const wave = getLocalProjectList(TASKS_STORE_KEY, INITIAL_WAVE_TASKS);
  const map = getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS);
  const byId = new Map<string, TaskItem>();
  for (const task of wave) byId.set(task._id, task);
  for (const tasks of Object.values(map)) {
    for (const task of tasks) {
      if (!byId.has(task._id)) byId.set(task._id, projectTaskToItem(task));
    }
  }
  return Array.from(byId.values());
}

function dispatchTaskReminderMock(taskId: string): {
  sent: boolean;
  message: string;
  task: TaskItem;
} {
  const list = getLocalProjectList(TASKS_STORE_KEY, INITIAL_WAVE_TASKS);
  let task = list.find((item) => item._id === taskId);
  const map = getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS);

  if (!task) {
    for (const pid of Object.keys(map)) {
      const found = map[pid].find((item) => item._id === taskId);
      if (found) {
        task = projectTaskToItem(found);
        break;
      }
    }
  }

  if (!task) {
    throw new ApiError('Task not found', 404);
  }

  const project = getLocalProjects().find((p) => p._id === task?.projectId);
  let clientEmail = task.clientNotifiedEmail || '';
  if (project?.clientId) {
    const clients = getLocalClients();
    const cl = clients.find((c) => c._id === project.clientId);
    clientEmail = cl?.email || cl?.primaryContact?.email || clientEmail;
  }
  if (!clientEmail && project?.clientName) {
    clientEmail = `${project.clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;
  }
  if (!clientEmail) {
    clientEmail = 'client@example.com';
  }

  const now = new Date().toISOString();
  task.clientNotifiedAt = now;
  task.clientNotifiedEmail = clientEmail;
  task.lastReminderSentAt = now;
  task.reminderCount = (task.reminderCount || 0) + 1;
  task.updatedAt = now;

  // Persist in TASKS_STORE_KEY
  const tIdx = list.findIndex((t) => t._id === taskId);
  if (tIdx >= 0) {
    list[tIdx] = { ...list[tIdx], ...task };
  } else {
    list.unshift(task);
  }
  saveLocalProjectList(TASKS_STORE_KEY, list);

  // Persist in PROJECT_TASKS_KEY
  if (task.projectId && map[task.projectId]) {
    map[task.projectId] = map[task.projectId].map((item) =>
      item._id === taskId
        ? {
            ...item,
            clientNotifiedAt: now,
            clientNotifiedEmail: clientEmail,
            lastReminderSentAt: now,
            reminderCount: (item.reminderCount || 0) + 1,
            updatedAt: now,
          }
        : item
    );
    saveLocalProjectMap(PROJECT_TASKS_KEY, map);
  }

  // Add system comment to task discussion
  const commentsMap = getLocalProjectMap(TASK_COMMENTS_KEY, INITIAL_MOCK_TASK_COMMENTS);
  commentsMap[taskId] = [
    {
      _id: `comment_${Date.now()}`,
      taskId,
      userName: 'System',
      body: `**Reminder email sent to client** (${clientEmail}) on ${new Date(now).toLocaleString()}`,
      createdAt: now,
    },
    ...(commentsMap[taskId] || []),
  ];
  saveLocalProjectMap(TASK_COMMENTS_KEY, commentsMap);

  if (task.projectId) {
    pushProjectActivity(
      task.projectId,
      'task_reminder_sent',
      `Reminder email notification sent to client (${clientEmail}) for task: "${task.title}"`
    );
  }

  const message = `Reminder email successfully sent to client (${clientEmail})`;
  return {
    sent: true,
    message,
    task,
  };
}

function toTimeLogItemFromProject(tl: ProjectTimeLog): TimeLogItem {
  const project = getLocalProjects().find((p) => p._id === tl.projectId);
  return {
    _id: tl._id,
    projectId: tl.projectId,
    projectName: project?.name,
    taskId: tl.taskId || '',
    taskTitle: tl.taskTitle,
    userId: tl.userId,
    userName: tl.userName,
    workDate: tl.workDate || tl.date || tl.createdAt || '',
    date: tl.workDate || tl.date || tl.createdAt || '',
    hours: tl.hours,
    isBillable: tl.isBillable ?? (tl.billable !== false),
    billable: tl.billable,
    description: tl.description || tl.note,
    note: tl.description || tl.note,
    status: 'Completed',
    approvalStatus: 'Approved',
    createdAt: tl.createdAt,
  };
}

function getUnifiedTimeLogs(): TimeLogItem[] {
  const wave = getLocalProjectList(TIME_LOGS_STORE_KEY, INITIAL_WAVE_TIME_LOGS);
  const projectLogs = getLocalProjectList(
    PROJECT_TIME_LOGS_KEY,
    INITIAL_MOCK_PROJECT_TIME_LOGS
  ).map(toTimeLogItemFromProject);
  const byId = new Map<string, TimeLogItem>();
  for (const item of projectLogs) byId.set(item._id, item);
  for (const item of wave) byId.set(item._id, item);
  return Array.from(byId.values()).sort((a, b) =>
    String(b.workDate || b.createdAt || '').localeCompare(String(a.workDate || a.createdAt || ''))
  );
}

function syncTimeLogToProjectStore(item: TimeLogItem) {
  if (!item.projectId || item.status === 'Running') return;
  const list = getLocalProjectList(PROJECT_TIME_LOGS_KEY, INITIAL_MOCK_PROJECT_TIME_LOGS);
  const idx = list.findIndex((row) => row._id === item._id);
  const row: ProjectTimeLog = {
    _id: item._id,
    projectId: item.projectId,
    taskId: item.taskId,
    taskTitle: item.taskTitle,
    userId: item.userId,
    userName: item.userName,
    hours: item.hours,
    note: item.description || item.note,
    date: item.workDate || item.date || new Date().toISOString().slice(0, 10),
    billable: item.isBillable ?? item.billable ?? true,
    createdAt: item.createdAt || new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = row;
  else list.unshift(row);
  saveLocalProjectList(PROJECT_TIME_LOGS_KEY, list);
}

function saveUnifiedTimeLog(item: TimeLogItem) {
  const list = getLocalProjectList(TIME_LOGS_STORE_KEY, INITIAL_WAVE_TIME_LOGS);
  const idx = list.findIndex((row) => row._id === item._id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  saveLocalProjectList(TIME_LOGS_STORE_KEY, list);
  syncTimeLogToProjectStore(item);
}

function filterLocalProjects(params: ProjectQueryParams): ProjectItem[] {
  let items = getLocalProjects();
  const wantDropped = params.isDropped === true || params.dropped === true || params.view === 'dropped';
  if (wantDropped) {
    items = items.filter((p) => p.isDropped);
  } else if (params.isDropped === false || params.dropped === false) {
    items = items.filter((p) => !p.isDropped);
  } else if (params.view !== 'all') {
    items = items.filter((p) => !p.isDropped);
  }
  const archVal = String(params.isArchived ?? params.archived ?? '').toLowerCase();
  if (archVal === 'true' || params.isArchived === true || params.archived === true) {
    items = items.filter((p) => Boolean(p.isArchived));
  } else if (archVal === 'false' || params.isArchived === false || params.archived === false) {
    items = items.filter((p) => !p.isArchived);
  } else if (archVal === 'all') {
    // Show both active & archived
  } else if (!wantDropped) {
    // Default: active only
    items = items.filter((p) => !p.isArchived);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)) ||
        p.ownerName?.toLowerCase().includes(q)
    );
  }
  if (params.status) items = items.filter((p) => p.status === params.status);
  if (params.priority) items = items.filter((p) => p.priority === params.priority);
  if (params.category) items = items.filter((p) => p.category === params.category);
  if (params.label) items = items.filter((p) => p.label === params.label);
  if (params.tag) items = items.filter((p) => p.tags?.includes(params.tag!));
  if (params.clientId) items = items.filter((p) => p.clientId === params.clientId);
  return items;
}

function computeLocalDataQuality(params: DataQualityQuery = {}): ApiResponse<DataQualityIssue[]> & { summary?: DataQualitySummary; pagination?: AdminPagination } {
  const rules = readLocalAdminValue<DataQualityRules>(DATA_QUALITY_RULES_KEY, DEFAULT_DATA_QUALITY_RULES);
  const leads = getLocalLeads();
  const clients = getLocalClients();

  const present = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

  function qualityLabel(score: number) {
    if (score >= rules.thresholds.excellent) return 'Excellent';
    if (score >= rules.thresholds.good) return 'Good';
    if (score >= rules.thresholds.needsAttention) return 'Needs attention';
    return 'Incomplete';
  }

  // Find duplicates among leads
  const leadMatches = new Map<string, Array<{ id: string; name?: string; company?: string; email?: string; phone?: string; reasons: string[]; companySimilarity?: number }>>();
  for (let i = 0; i < leads.length; i++) {
    for (let j = i + 1; j < leads.length; j++) {
      const a = leads[i];
      const b = leads[j];
      const reasons: string[] = [];
      if (a.email && b.email && a.email.toLowerCase().trim() === b.email.toLowerCase().trim()) reasons.push('email');
      const pA = (a.phone || '').replace(/\D/g, '');
      const pB = (b.phone || '').replace(/\D/g, '');
      if (pA && pB && pA.length >= 7 && pA === pB) reasons.push('mobile');
      if (a.pan && b.pan && a.pan.toUpperCase().trim() === b.pan.toUpperCase().trim()) reasons.push('pan');
      const cA = (a.company || '').toLowerCase().trim();
      const cB = (b.company || '').toLowerCase().trim();
      if (cA && cB && (cA === cB || (cA.length >= 4 && cB.length >= 4 && (cA.includes(cB) || cB.includes(cA))))) reasons.push('company');

      if (reasons.length) {
        if (!leadMatches.has(a._id)) leadMatches.set(a._id, []);
        if (!leadMatches.has(b._id)) leadMatches.set(b._id, []);
        leadMatches.get(a._id)!.push({ id: b._id, name: b.name, company: b.company, email: b.email, phone: b.phone, reasons });
        leadMatches.get(b._id)!.push({ id: a._id, name: a.name, company: a.company, email: a.email, phone: a.phone, reasons });
      }
    }
  }

  // Find duplicates among clients
  const clientMatches = new Map<string, Array<{ id: string; name?: string; company?: string; email?: string; phone?: string; reasons: string[]; companySimilarity?: number }>>();
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const a = clients[i];
      const b = clients[j];
      const reasons: string[] = [];
      if (a.email && b.email && a.email.toLowerCase().trim() === b.email.toLowerCase().trim()) reasons.push('email');
      const pA = (a.phone || a.mobile || '').replace(/\D/g, '');
      const pB = (b.phone || b.mobile || '').replace(/\D/g, '');
      if (pA && pB && pA.length >= 7 && pA === pB) reasons.push('mobile');
      if (a.taxId && b.taxId && a.taxId.toUpperCase().trim() === b.taxId.toUpperCase().trim()) reasons.push('pan');
      const cA = (a.name || a.companyName || '').toLowerCase().trim();
      const cB = (b.name || b.companyName || '').toLowerCase().trim();
      if (cA && cB && (cA === cB || (cA.length >= 4 && cB.length >= 4 && (cA.includes(cB) || cB.includes(cA))))) reasons.push('company');

      if (reasons.length) {
        if (!clientMatches.has(a._id)) clientMatches.set(a._id, []);
        if (!clientMatches.has(b._id)) clientMatches.set(b._id, []);
        clientMatches.get(a._id)!.push({ id: b._id, name: b.name, company: b.companyName || b.name, email: b.email, phone: b.phone, reasons });
        clientMatches.get(b._id)!.push({ id: a._id, name: a.name, company: a.companyName || a.name, email: a.email, phone: a.phone, reasons });
      }
    }
  }

  // Score leads
  const scoredLeads: DataQualityIssue[] = leads.map((l) => {
    const matches = leadMatches.get(l._id) || [];
    const checks = [
      { key: 'name', label: 'Full name', weight: rules.leadWeights.name ?? 10, complete: present(l.name) },
      { key: 'email', label: 'Valid email', weight: rules.leadWeights.email ?? 15, complete: present(l.email) },
      { key: 'phone', label: 'Valid mobile number', weight: rules.leadWeights.phone ?? 15, complete: present(l.phone) },
      { key: 'company', label: 'Company name', weight: rules.leadWeights.company ?? 15, complete: present(l.company) },
      { key: 'pan', label: 'PAN number', weight: rules.leadWeights.pan ?? 15, complete: present(l.pan) },
      { key: 'address', label: 'Address', weight: rules.leadWeights.address ?? 10, complete: present(l.address) },
      { key: 'owner', label: 'Assigned owner', weight: rules.leadWeights.owner ?? 10, complete: present(l.assignedTo) },
      { key: 'duplicates', label: 'No possible duplicate', weight: rules.leadWeights.duplicates ?? 10, complete: matches.length === 0 },
    ];
    const score = checks.reduce((sum, c) => sum + (c.complete ? c.weight : 0), 0);
    return {
      id: l._id,
      _id: l._id,
      name: l.name,
      company: l.company,
      email: l.email,
      phone: l.phone,
      pan: l.pan,
      matches,
      dataQuality: {
        score,
        label: qualityLabel(score),
        missing: checks.filter((c) => !c.complete).map((c) => c.label),
        checks,
      },
    };
  });

  // Score clients
  const scoredClients: DataQualityIssue[] = clients.map((c) => {
    const matches = clientMatches.get(c._id) || [];
    const addr = c.billingAddress;
    const addressComplete = !!(addr && addr.city && addr.state);
    const checks = [
      { key: 'name', label: 'Company name', weight: rules.clientWeights.name ?? 15, complete: present(c.name) },
      { key: 'email', label: 'Company email', weight: rules.clientWeights.email ?? 15, complete: present(c.email) },
      { key: 'phone', label: 'Company mobile number', weight: rules.clientWeights.phone ?? 15, complete: present(c.phone || c.mobile) },
      { key: 'website', label: 'Website', weight: rules.clientWeights.website ?? 10, complete: present(c.website) },
      { key: 'address', label: 'Complete billing address', weight: rules.clientWeights.address ?? 15, complete: addressComplete },
      { key: 'taxId', label: 'Tax ID', weight: rules.clientWeights.taxId ?? 10, complete: present(c.taxId) },
      { key: 'contact', label: 'At least one contact', weight: rules.clientWeights.contact ?? 10, complete: !!c.primaryContact || (c.contactCount || 0) > 0 },
      { key: 'duplicates', label: 'No possible duplicate', weight: rules.clientWeights.duplicates ?? 10, complete: matches.length === 0 },
    ];
    const score = checks.reduce((sum, ch) => sum + (ch.complete ? ch.weight : 0), 0);
    return {
      id: c._id,
      _id: c._id,
      name: c.name,
      company: c.companyName || c.name,
      email: c.email,
      phone: c.phone || c.mobile,
      website: c.website,
      matches,
      dataQuality: {
        score,
        label: qualityLabel(score),
        missing: checks.filter((ch) => !ch.complete).map((ch) => ch.label),
        checks,
      },
    };
  });

  // Summary
  const leadDupCount = scoredLeads.filter((l) => l.matches.length > 0).length;
  const leadLowCount = scoredLeads.filter((l) => l.dataQuality.score <= 69).length;
  const leadAvg = scoredLeads.length ? Math.round(scoredLeads.reduce((s, l) => s + l.dataQuality.score, 0) / scoredLeads.length) : 0;

  const clientDupCount = scoredClients.filter((c) => c.matches.length > 0).length;
  const clientLowCount = scoredClients.filter((c) => c.dataQuality.score <= 69).length;
  const clientAvg = scoredClients.length ? Math.round(scoredClients.reduce((s, c) => s + c.dataQuality.score, 0) / scoredClients.length) : 0;

  const summary: DataQualitySummary = {
    leads: { duplicates: leadDupCount, lowQuality: leadLowCount, averageScore: leadAvg },
    clients: { duplicates: clientDupCount, lowQuality: clientLowCount, averageScore: clientAvg },
  };

  // Filter based on query
  let items = params.recordType === 'client' ? scoredClients : scoredLeads;
  if (params.view === 'duplicates') {
    items = items.filter((item) => {
      if (!item.matches.length) return false;
      if (params.matchType === 'exact') {
        return item.matches.some((m) => m.reasons.some((r) => r === 'email' || r === 'mobile' || r === 'pan'));
      }
      if (params.matchType === 'similar') {
        return item.matches.some((m) => m.reasons.includes('company'));
      }
      return true;
    });
  } else {
    const maxScore = params.maxScore !== undefined ? Number(params.maxScore) : 69;
    items = items.filter((item) => item.dataQuality.score <= maxScore);
  }

  if (params.search) {
    const term = params.search.toLowerCase().trim();
    items = items.filter((item) =>
      [item.name, item.company, item.email, item.phone].some((v) => v?.toLowerCase().includes(term))
    );
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || 20);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return {
    success: true,
    data,
    summary,
    pagination: { page, limit, total, totalPages },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM API CLIENT
// ─────────────────────────────────────────────────────────────────────────────

function normalizeQuotationRecord(raw: QuotationItem): QuotationItem {
  const item = { ...raw };
  const totals = calculateFinanceTotals({
    lines: item.lineItems || [],
    discountType: item.discountType,
    discountValue:
      item.discountValue ??
      (item.discountType === 'amount' ? item.discountAmount : item.discountPercent) ??
      0,
    taxCalculation: item.taxCalculation,
    shippingCharge: item.shippingCharge,
  });
  const shippingState = String(item.shippingState || '');
  const gstMode: 'intra' | 'inter' =
    shippingState && shippingState.toLowerCase() === COMPANY_STATE_DEFAULT.toLowerCase()
      ? 'intra'
      : 'inter';
  const taxTotal = item.taxTotal ?? totals.taxTotal;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = String(item.validTill || item.expiryDate || '').slice(0, 10);
  let status = item.status || 'Draft';
  if (
    !['Accepted', 'Rejected', 'Converted'].includes(String(status)) &&
    expiry &&
    new Date(`${expiry}T12:00:00`).getTime() < today.getTime()
  ) {
    status = 'Expired';
  }
  return {
    ...item,
    quotationNumber: item.quotationNumber || item.quotationNo || item.number,
    validTill: item.validTill || item.expiryDate || '',
    expiryDate: item.expiryDate || item.validTill,
    subtotal: item.subtotal ?? totals.subtotal,
    taxTotal,
    grandTotal: item.grandTotal ?? totals.grandTotal,
    gstMode: item.gstMode || gstMode,
    cgst: gstMode === 'intra' ? Number(((taxTotal || 0) / 2).toFixed(2)) : 0,
    sgst: gstMode === 'intra' ? Number(((taxTotal || 0) / 2).toFixed(2)) : 0,
    igst: gstMode === 'inter' ? Number(taxTotal || 0) : 0,
    status,
    isArchived: Boolean(item.isArchived),
    isLatestVersion: item.isLatestVersion !== false,
  };
}

function mutateLocalQuotation(
  id: string,
  updater: (item: QuotationItem) => QuotationItem
): ApiResponse<QuotationItem> {
  const items = getLocalFinanceList(QUOTATIONS_STORE_KEY, INITIAL_FINANCE_QUOTATIONS);
  const index = items.findIndex((entry) => entry._id === id);
  if (index < 0) throw new ApiError('Quotation not found', 404);
  items[index] = normalizeQuotationRecord({
    ...updater(items[index]),
    updatedAt: new Date().toISOString(),
  });
  saveLocalFinanceList(QUOTATIONS_STORE_KEY, items);
  return { success: true, data: items[index] };
}

function getLocalQuotationOrThrow(id: string): QuotationItem {
  const item = getLocalFinanceList(QUOTATIONS_STORE_KEY, INITIAL_FINANCE_QUOTATIONS).find(
    (entry) => entry._id === id
  );
  if (!item) throw new ApiError('Quotation not found', 404);
  return normalizeQuotationRecord(item);
}

export const crmApi = {
  getMe: async (): Promise<ApiResponse<UserContext>> => {
    return request<UserContext>('/me', { method: 'GET' });
  },

  getDashboard: async (params: {
    period?: DashboardPeriod | string;
    from?: string;
    to?: string;
    role?: string;
  } = {}): Promise<ApiResponse<DashboardData>> => {
    const query = new URLSearchParams();
    if (params.period) query.set('period', String(params.period));
    if (params.from) query.set('from', String(params.from));
    if (params.to) query.set('to', String(params.to));
    if (params.role) query.set('role', String(params.role));
    const qs = query.toString();
    return request<DashboardData>(qs ? `/dashboard?${qs}` : '/dashboard', { method: 'GET' });
  },

  getDashboardWidgets: async (): Promise<ApiResponse<WidgetConfig>> => {
    return request<WidgetConfig>('/dashboard/widgets', { method: 'GET' });
  },

  saveDashboardWidgets: async (body: {
    enabledWidgets: string[];
    scope?: 'user' | 'role';
    role?: string;
  }): Promise<ApiResponse<{ success: boolean; settingKey: string; enabledWidgets: string[] }>> => {
    return request('/dashboard/widgets', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  getHealth: async (): Promise<ApiResponse<{ status: string; plugin: string; version: string; phase: number }>> => {
    return request('/health', { method: 'GET' });
  },

  /** Registered extensions + generic UI host slots for any extension. */
  getExtensionsUi: async (): Promise<ApiResponse<Record<string, unknown>>> => {
    return request('/extensions/ui', { method: 'GET' });
  },

  listExtensions: async (): Promise<ApiResponse<Array<{ extensionId: string; version?: string }>>> => {
    return request('/extensions', { method: 'GET' });
  },

  /** Cache ui/host-slots.json for an enabled extension (request-type seeding + server summary). */
  syncExtensionHostSlots: async (
    extensionId: string,
    slots: Record<string, unknown>
  ): Promise<ApiResponse<{ extensionId: string }>> => {
    return request(`/extensions/${encodeURIComponent(extensionId)}/host-slots`, {
      method: 'POST',
      body: JSON.stringify(slots || {}),
    });
  },

  // ─── LEADS MODULE APIS ────────────────────────────────────────────────────
  getLeads: async (params: LeadQueryParams = {}): Promise<ApiResponse<LeadItem[]>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.view) query.set('view', params.view);
    if (params.stage) query.set('stage', params.stage);
    if (params.status) query.set('status', params.status);
    if (params.source) query.set('source', params.source);
    if (params.tag) query.set('tag', params.tag);
    if (params.matchScore) query.set('matchScore', params.matchScore);
    if (params.needsSampleRequest) query.set('needsSampleRequest', params.needsSampleRequest);
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);
    const qs = query.toString();

    try {
      return await request<LeadItem[]>(qs ? `/leads?${qs}` : '/leads', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      // Standalone Fallback / Mock
      let items = [...getLocalLeads()];

      if (params.stage) {
        items = items.filter((l) => (l.stage || '').toLowerCase() === params.stage?.toLowerCase());
      }
      if (params.status) {
        items = items.filter((l) => (l.status || '').toLowerCase() === params.status?.toLowerCase());
      }
      if (params.source) {
        items = items.filter((l) => (l.source || '').toLowerCase() === params.source?.toLowerCase());
      }
      if (params.tag) {
        items = items.filter((l) => (l.tags || []).some((t) => t.toLowerCase() === params.tag?.toLowerCase()));
      }
      if (params.matchScore) {
        const band = params.matchScore.toLowerCase();
        items = items.filter((l) => {
          const score = l.commercialRequirement?.score;
          const n = score == null || Number.isNaN(Number(score)) ? null : Number(score);
          if (band === 'unscored') return n == null;
          if (band === 'scored') return n != null;
          if (band === 'strong') return n != null && n >= 80;
          if (band === 'partial') return n != null && n >= 55 && n < 80;
          if (band === 'weak') return n != null && n >= 30 && n < 55;
          if (band === 'poor') return n != null && n >= 0 && n < 30;
          return true;
        });
      }
      if (params.needsSampleRequest) {
        const flag = params.needsSampleRequest.toLowerCase();
        const wants = flag === 'true' || flag === '1' || flag === 'yes';
        const doesnt = flag === 'false' || flag === '0' || flag === 'no';
        items = items.filter((l) => {
          const needs = Boolean(
            l.commercialRequirement?.needsSampleRequest || l.qualification?.sampleRequired
          );
          if (wants) return needs;
          if (doesnt) return !needs;
          return true;
        });
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.company.toLowerCase().includes(q) ||
            l.email.toLowerCase().includes(q) ||
            l.phone.toLowerCase().includes(q) ||
            (l.tags && l.tags.some((t) => t.toLowerCase().includes(q))) ||
            (l.notes && l.notes.toLowerCase().includes(q))
        );
      }

      const total = items.length;
      const page = params.page || 1;
      const limit = params.limit || (params.view === 'list' ? 10 : 100);
      const start = (page - 1) * limit;
      const paged = params.view === 'list' ? items.slice(start, start + limit) : items;

      return {
        success: true,
        data: paged,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }
  },

  getLead: async (id: string): Promise<ApiResponse<LeadItem>> => {
    try {
      return await request<LeadItem>(`/leads/${id}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const lead = items.find((l) => l._id === id);
      if (!lead) throw new ApiError('Lead not found', 404);
      return { success: true, data: lead };
    }
  },

  createLead: async (input: LeadCreateInput): Promise<ApiResponse<LeadItem>> => {
    try {
      return await request<LeadItem>('/leads', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const user = INITIAL_MOCK_USERS.find((u) => u.id === input.assignedTo);
      const newLead: LeadItem = {
        ...input,
        _id: `lead_${Date.now()}`,
        status: input.status || 'New',
        value: input.value || 0,
        currency: input.currency || getRuntimeDefaultCurrency(),
        customFields: input.customFields || {},
        extension: input.extension && typeof input.extension === 'object' ? input.extension : {},
        assignedUsername: user?.username || 'admin',
        assignedToName: user?.displayName || user?.name || 'Unassigned',
        tags: input.tags || [],
        ageing: {
          totalAgeDays: 0,
          stageAgeDays: 0,
          status: 'Fresh',
          label: '0d in stage',
          totalLabel: '0d total',
        },
        followUpSummary: {
          openCount: 0,
          overdueCount: 0,
          overdueDays: 0,
          hasOverdue: false,
          status: 'none',
        },
        dataQuality: {
          score: 80,
          label: 'Good',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      items.unshift(newLead);
      saveLocalLeads(items);
      return { success: true, data: newLead, message: 'Lead created successfully' };
    }
  },

  updateLead: async (id: string, updates: Partial<LeadItem>): Promise<ApiResponse<LeadItem>> => {
    try {
      return await request<LeadItem>(`/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const index = items.findIndex((l) => l._id === id);
      if (index === -1) throw new ApiError('Lead not found', 404);

      const existing = items[index];
      const updated: LeadItem = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      if (updates.extension && typeof updates.extension === 'object') {
        updated.extension = {
          ...(existing.extension && typeof existing.extension === 'object' ? existing.extension : {}),
          ...updates.extension,
        };
      }
      if (updates.assignedTo) {
        const user = INITIAL_MOCK_USERS.find((u) => u.id === updates.assignedTo);
        if (user) {
          updated.assignedUsername = user.username;
          updated.assignedToName = user.displayName || user.name;
        }
      }
      items[index] = updated;
      saveLocalLeads(items);
      return { success: true, data: updated, message: 'Lead updated successfully' };
    }
  },

  deleteLead: async (id: string): Promise<ApiResponse<{ deleted: boolean; id: string }>> => {
    try {
      return await request<{ deleted: boolean; id: string }>(`/leads/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const filtered = items.filter((l) => l._id !== id);
      saveLocalLeads(filtered);
      return { success: true, data: { deleted: true, id }, message: 'Lead deleted successfully' };
    }
  },

  changeLeadStage: async (id: string, stage: string): Promise<ApiResponse<LeadItem>> => {
    try {
      return await request<LeadItem>(`/leads/${id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const index = items.findIndex((l) => l._id === id);
      if (index === -1) throw new ApiError('Lead not found', 404);

      const existing = items[index];
      existing.stage = stage;
      existing.status = stage;
      existing.ageing = {
        totalAgeDays: existing.ageing?.totalAgeDays || 0,
        stageAgeDays: 0,
        status: 'Fresh',
        label: '0d in stage',
        totalLabel: `${existing.ageing?.totalAgeDays || 0}d total`,
      };
      existing.updatedAt = new Date().toISOString();
      items[index] = existing;
      saveLocalLeads(items);
      return { success: true, data: existing, message: 'Stage updated successfully' };
    }
  },

  convertLead: async (id: string): Promise<ApiResponse<{ lead: LeadItem; clientId: string }>> => {
    try {
      return await request<{ lead: LeadItem; clientId: string }>(`/leads/${id}/convert`, {
        method: 'POST',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const index = items.findIndex((l) => l._id === id);
      if (index === -1) throw new ApiError('Lead not found', 404);

      const existing = items[index];
      const clientId = `client_${Date.now()}`;
      existing.stage = 'Won';
      existing.status = 'Won';
      existing.convertedClientId = clientId;
      existing.convertedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      items[index] = existing;
      saveLocalLeads(items);
      return {
        success: true,
        data: { lead: existing, clientId },
        message: 'Lead converted to client successfully',
      };
    }
  },

  bulkAssignLeads: async (
    leadIds: string[],
    assignedTo: string
  ): Promise<ApiResponse<{ updatedCount: number }>> => {
    try {
      return await request<{ updatedCount: number }>('/leads/bulk/assign', {
        method: 'POST',
        body: JSON.stringify({ leadIds, assignedTo }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const user = INITIAL_MOCK_USERS.find((u) => u.id === assignedTo);
      let count = 0;
      for (const item of items) {
        if (leadIds.includes(item._id)) {
          item.assignedTo = assignedTo;
          if (user) {
            item.assignedUsername = user.username;
            item.assignedToName = user.displayName || user.name;
          }
          item.updatedAt = new Date().toISOString();
          count++;
        }
      }
      saveLocalLeads(items);
      return { success: true, data: { updatedCount: count }, message: `Assigned ${count} leads` };
    }
  },

  bulkChangeLeadStage: async (
    leadIds: string[],
    stage: string
  ): Promise<ApiResponse<{ updatedCount: number }>> => {
    try {
      return await request<{ updatedCount: number }>('/leads/bulk/stage', {
        method: 'POST',
        body: JSON.stringify({ leadIds, stage }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      let count = 0;
      for (const item of items) {
        if (leadIds.includes(item._id)) {
          item.stage = stage;
          item.status = stage;
          item.ageing = {
            totalAgeDays: item.ageing?.totalAgeDays || 0,
            stageAgeDays: 0,
            status: 'Fresh',
            label: '0d in stage',
            totalLabel: `${item.ageing?.totalAgeDays || 0}d total`,
          };
          item.updatedAt = new Date().toISOString();
          count++;
        }
      }
      saveLocalLeads(items);
      return { success: true, data: { updatedCount: count }, message: `Moved ${count} leads to ${stage}` };
    }
  },

  downloadLeadsExport: async (params: {
    stage?: string;
    status?: string;
    source?: string;
    tag?: string;
    matchScore?: string;
    needsSampleRequest?: string;
    search?: string;
    format?: 'csv' | 'json';
    from?: string;
    to?: string;
  } = {}): Promise<{
    filename: string;
    content: string;
    format: string;
    directUrl?: string;
    recordCount: number;
  }> => {
    const query = new URLSearchParams();
    if (params.stage) query.set('stage', params.stage);
    if (params.status) query.set('status', params.status);
    if (params.source) query.set('source', params.source);
    if (params.tag) query.set('tag', params.tag);
    if (params.matchScore) query.set('matchScore', params.matchScore);
    if (params.needsSampleRequest) query.set('needsSampleRequest', params.needsSampleRequest);
    if (params.search) query.set('search', params.search);
    if (params.format) query.set('format', params.format);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    const formatExt = params.format === 'json' ? 'json' : 'csv';
    const path = `/leads/export?${query.toString()}`;
    const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;

    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.error || payload?.message || `Export failed (${response.status})`;
        const error = new ApiError(message, response.status);
        throw error;
      }

      const text = await response.text();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const filename =
        filenameMatch?.[1] ||
        `leads_export_${new Date().toISOString().split('T')[0]}.${formatExt}`;

      try {
        triggerFileDownload({
          filename,
          content: text,
          format: formatExt,
          directUrl: url,
        });
      } catch (downloadErr) {
        console.warn('[downloadLeadsExport] Automated download trigger notice:', downloadErr);
      }

      let count = 0;
      if (formatExt === 'json') {
        try {
          const parsed = JSON.parse(text);
          count = Array.isArray(parsed) ? parsed.length : 0;
        } catch {}
      } else {
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        count = Math.max(0, lines.length - 1);
      }

      return {
        filename,
        content: text,
        format: formatExt,
        directUrl: url,
        recordCount: count,
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      // Offline / Mock Data Fallback: filter local leads according to export params
      const allLeads = getLocalLeads();
      const filtered = allLeads.filter((lead) => {
        if (params.stage && (lead.stage || '').toLowerCase() !== params.stage.toLowerCase()) return false;
        if (params.status && (lead.status || '').toLowerCase() !== params.status.toLowerCase()) return false;
        if (params.source && (lead.source || '').toLowerCase() !== params.source.toLowerCase()) return false;
        if (params.tag && !(lead.tags || []).some((t) => t.toLowerCase() === params.tag?.toLowerCase())) return false;
        if (params.matchScore) {
          const band = params.matchScore.toLowerCase();
          const score = lead.commercialRequirement?.score;
          const n = score == null || Number.isNaN(Number(score)) ? null : Number(score);
          if (band === 'unscored' && n != null) return false;
          if (band === 'scored' && n == null) return false;
          if (band === 'strong' && !(n != null && n >= 80)) return false;
          if (band === 'partial' && !(n != null && n >= 55 && n < 80)) return false;
          if (band === 'weak' && !(n != null && n >= 30 && n < 55)) return false;
          if (band === 'poor' && !(n != null && n >= 0 && n < 30)) return false;
        }
        if (params.needsSampleRequest) {
          const flag = params.needsSampleRequest.toLowerCase();
          const wants = flag === 'true' || flag === '1' || flag === 'yes';
          const doesnt = flag === 'false' || flag === '0' || flag === 'no';
          const needs = Boolean(
            lead.commercialRequirement?.needsSampleRequest || lead.qualification?.sampleRequired
          );
          if (wants && !needs) return false;
          if (doesnt && needs) return false;
        }
        if (params.search) {
          const term = params.search.toLowerCase();
          const match =
            (lead.name || '').toLowerCase().includes(term) ||
            (lead.email || '').toLowerCase().includes(term) ||
            (lead.company || '').toLowerCase().includes(term) ||
            (lead.phone || '').toLowerCase().includes(term) ||
            (lead.tags || []).some((t) => t.toLowerCase().includes(term));
          if (!match) return false;
        }
        return true;
      });

      const nowStr = new Date().toISOString().split('T')[0];
      const filename = `leads_export_${nowStr}.${formatExt}`;

      let content = '';
      if (formatExt === 'json') {
        content = JSON.stringify(filtered, null, 2);
      } else {
        const baseHeaders = [
          'ID',
          'Name',
          'Salutation',
          'Job Title',
          'Gender',
          'Lead Type',
          'Request Type',
          'Email',
          'Phone',
          'Company',
          'PAN',
          'Stage',
          'Status',
          'Source',
          'Tags',
          'Assigned To (Name)',
          'Assigned To (Email)',
          'Expected Revenue',
          'Qualification Status',
          'Industry',
          'Customer Type',
          'Business Potential',
          'Annual Requirement',
          'Notes',
          'Address',
          'Created At',
          'Updated At',
        ];

        const escapeCsv = (val: unknown) => {
          if (val === null || val === undefined) return '""';
          const s = String(val).replace(/"/g, '""');
          return `"${s}"`;
        };

        const rows = [baseHeaders.map(escapeCsv).join(',')];
        for (const lead of filtered) {
          const row = [
            lead._id || '',
            lead.name || '',
            lead.salutation || '',
            lead.jobTitle || '',
            lead.gender || '',
            lead.leadType || '',
            lead.requestType || '',
            lead.email || '',
            lead.phone || '',
            lead.company || '',
            lead.pan || '',
            lead.stage || '',
            lead.status || '',
            lead.source || '',
            Array.isArray(lead.tags) ? lead.tags.join('; ') : '',
            lead.assignedToName || lead.assignedTo || '',
            lead.assignedUsername || '',
            lead.value ?? '',
            lead.qualification?.status || '',
            lead.qualification?.industry || '',
            lead.qualification?.customerType || '',
            lead.qualification?.businessPotential || '',
            lead.qualification?.annualRequirement || '',
            lead.notes || '',
            lead.address || '',
            lead.createdAt ? new Date(lead.createdAt).toISOString() : '',
            lead.updatedAt ? new Date(lead.updatedAt).toISOString() : '',
          ];
          rows.push(row.map(escapeCsv).join(','));
        }
        content = rows.join('\n');
      }

      try {
        triggerFileDownload({
          filename,
          content,
          format: formatExt,
        });
      } catch (err) {
        console.warn('[downloadLeadsExport] Automated download trigger notice:', err);
      }

      return {
        filename,
        content,
        format: formatExt,
        recordCount: filtered.length,
      };
    }
  },

  previewLeadImport: async (body: {
    rows?: Array<Record<string, unknown>>;
    options?: Record<string, unknown>;
    content?: string;
  }): Promise<ApiResponse<LeadImportPreviewResult>> => {
    try {
      return await request<LeadImportPreviewResult>('/leads/import/preview', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let rows: Array<Record<string, unknown>> = body.rows || [];
      if (!rows.length && body.content) {
        rows = parseCsvString(body.content);
      }
      const existingLeads = getLocalLeads();
      const previewRows = rows.map((row, index) => {
        const name = pickImportField(row, [...LEAD_IMPORT_ALIASES.name]);
        const company = pickImportField(row, [...LEAD_IMPORT_ALIASES.company]);
        const email = pickImportField(row, [...LEAD_IMPORT_ALIASES.email]).toLowerCase();
        const phone = pickImportField(row, [...LEAD_IMPORT_ALIASES.phone]);
        const stage =
          pickImportField(row, [...LEAD_IMPORT_ALIASES.stage]) ||
          String(body.options?.defaultStage || 'New').trim();
        const source =
          pickImportField(row, [...LEAD_IMPORT_ALIASES.source]) ||
          String(body.options?.defaultSource || 'Website').trim();
        const status =
          pickImportField(row, [...LEAD_IMPORT_ALIASES.status]) ||
          String(body.options?.defaultStatus || 'New').trim();

        const errors: string[] = [];
        const warnings: string[] = [];
        const duplicates: string[] = [];

        if (!name) errors.push('Name is required');
        if (!company) errors.push('Company name is required');
        if (!email) {
          errors.push('Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push('Invalid email address format');
        }
        if (!phone) errors.push('Phone is required');

        if (email && existingLeads.some((l) => (l.email || '').toLowerCase() === email)) {
          warnings.push(`Lead with email "${email}" already exists in database`);
          duplicates.push('email');
        }

        const valid = errors.length === 0;

        return {
          rowIndex: index + 1,
          name,
          company,
          email,
          phone,
          stage,
          source,
          status,
          valid,
          errors,
          warnings,
          duplicates,
          data: {
            name,
            company,
            email,
            phone,
            stage,
            source,
            status,
            value: Number(pickImportField(row, [...LEAD_IMPORT_ALIASES.value]) || 0) || 0,
            city: pickImportField(row, [...LEAD_IMPORT_ALIASES.city]),
            state: pickImportField(row, [...LEAD_IMPORT_ALIASES.state]),
            country: pickImportField(row, [...LEAD_IMPORT_ALIASES.country]),
            pan: pickImportField(row, [...LEAD_IMPORT_ALIASES.pan]),
            notes: pickImportField(row, [...LEAD_IMPORT_ALIASES.notes]),
          },
        };
      });

      const validCount = previewRows.filter((r) => r.valid).length;
      const errorCount = previewRows.filter((r) => !r.valid).length;
      const warningCount = previewRows.filter((r) => (r.warnings?.length || 0) > 0).length;
      const duplicateCount = previewRows.filter((r) => (r.duplicates?.length || 0) > 0).length;

      return {
        success: true,
        data: {
          totalRows: previewRows.length,
          validCount,
          warningCount,
          errorCount,
          duplicateCount,
          rows: previewRows,
        },
      };
    }
  },

  executeLeadImport: async (body: {
    rows?: Array<Record<string, unknown>>;
    options?: Record<string, unknown>;
    content?: string;
  }): Promise<ApiResponse<LeadImportExecuteResult>> => {
    try {
      return await request<LeadImportExecuteResult>('/leads/import', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch {
      const preview = await crmApi.previewLeadImport(body);
      const rows = preview.data?.rows || [];
      const skipDuplicates = body.options?.skipDuplicates !== false;
      let createdCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const createdIds: string[] = [];

      for (const row of rows) {
        if (!row.valid) {
          failedCount++;
          continue;
        }
        if (skipDuplicates && (row.duplicates?.length || 0) > 0) {
          skippedCount++;
          continue;
        }
        try {
          const raw = (row.data || {}) as Record<string, any>;
          const address = [raw.address, raw.city, raw.state, raw.country].filter(Boolean).join(', ');
          const res = await crmApi.createLead({
            name: row.name || 'Imported Lead',
            company: row.company || 'Unknown Co',
            email: row.email || '',
            phone: row.phone || '',
            stage: row.stage || 'New',
            status: row.status || 'New',
            source: row.source || 'Website',
            assignedTo: 'dev-admin',
            value: Number(raw.value || 0),
            address: address || undefined,
            pan: raw.pan ? String(raw.pan) : undefined,
            notes: raw.notes ? String(raw.notes) : undefined,
          });
          createdIds.push(res.data._id);
          createdCount++;
        } catch (error) {
          rethrowUnlessMockFallback(error);
          failedCount++;
        }
      }

      return {
        success: true,
        data: {
          totalRows: rows.length,
          createdCount,
          skippedCount,
          failedCount,
          createdIds,
          message: `Successfully imported ${createdCount} leads (${skippedCount} duplicates skipped).`,
        },
      };
    }
  },

  /**
   * Visiting-card IMAGE → structured lead/contact fields (Groq vision on server).
   * Prefer `imageDataUrl` (data:image/...;base64,...). No client OCR.
   */
  extractLeadFromOcr: async (body: {
    imageDataUrl?: string;
    ocrText?: string;
  }): Promise<ApiResponse<LeadOcrExtractResult>> => {
    return request<LeadOcrExtractResult>('/leads/ocr/extract', {
      method: 'POST',
      body: JSON.stringify({
        imageDataUrl: body.imageDataUrl,
        ocrText: body.ocrText,
      }),
    });
  },

  getLeadSources: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/sources', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: LEAD_SOURCES };
    }
  },

  getLeadStatuses: async (): Promise<ApiResponse<string[]>> => {
    try {
      const response = await request<string[]>('/leads/statuses', { method: 'GET' });
      return { ...response, data: mergeLeadStatusesWithBuiltins(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: mergeLeadStatusesWithBuiltins(LEAD_STATUSES) };
    }
  },

  getLeadTags: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/tags', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: LEAD_TAGS };
    }
  },

  getLeadCustomFields: async (): Promise<ApiResponse<LeadCustomFieldDef[]>> => {
    try {
      return await request<LeadCustomFieldDef[]>('/leads/custom-fields', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      try {
        const raw = localStorage.getItem('opennext_mock_lead_custom_fields_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return { success: true, data: parsed };
        }
      } catch {}
      return { success: true, data: [] };
    }
  },

  addLeadCustomField: async (
    body: Partial<LeadCustomFieldDef>
  ): Promise<ApiResponse<LeadCustomFieldDef>> => {
    try {
      return await request<LeadCustomFieldDef>('/leads/custom-fields', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const key =
        body.key?.trim() ||
        (body.label || 'field')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '') ||
        `field_${Date.now()}`;
      const def: LeadCustomFieldDef = {
        _id: `lcf_${Date.now()}`,
        key,
        label: body.label || key,
        type: body.type || 'text',
        options: body.options,
        required: !!body.required,
      };
      let list: LeadCustomFieldDef[] = [];
      try {
        const raw = localStorage.getItem('opennext_mock_lead_custom_fields_v1');
        if (raw) list = JSON.parse(raw);
      } catch {}
      list.push(def);
      try {
        localStorage.setItem('opennext_mock_lead_custom_fields_v1', JSON.stringify(list));
      } catch {}
      return { success: true, data: def, message: 'Custom field added' };
    }
  },

  getPipeline: async (): Promise<ApiResponse<{ pipeline_stages: string[] }>> => {
    try {
      return await request<{ pipeline_stages: string[] }>('/settings/pipeline', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: { pipeline_stages: PIPELINE_STAGES } };
    }
  },

  getAssignableUsers: async (): Promise<ApiResponse<AssignableUser[]>> => {
    try {
      return await request<AssignableUser[]>('/users/assignable', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: INITIAL_MOCK_USERS };
    }
  },

  getSavedLeadFilters: async (): Promise<ApiResponse<SavedLeadFilter[]>> => {
    try {
      return await request<SavedLeadFilter[]>('/leads/saved-filters', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: getLocalFilters() };
    }
  },

  createSavedLeadFilter: async (body: {
    name: string;
    filters: Record<string, string>;
    isDefault?: boolean;
    isShared?: boolean;
  }): Promise<ApiResponse<SavedLeadFilter>> => {
    try {
      return await request<SavedLeadFilter>('/leads/saved-filters', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const filters = getLocalFilters();
      const newFilter: SavedLeadFilter = {
        id: `filter_${Date.now()}`,
        name: body.name,
        isDefault: body.isDefault || false,
        isShared: body.isShared || false,
        filters: body.filters,
      };
      filters.push(newFilter);
      saveLocalFilters(filters);
      return { success: true, data: newFilter };
    }
  },

  deleteSavedLeadFilter: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/leads/saved-filters/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const filters = getLocalFilters().filter((f) => f.id !== id);
      saveLocalFilters(filters);
      return { success: true, data: { deleted: true } };
    }
  },

  updateSavedLeadFilter: async (
    id: string,
    body: Partial<SavedLeadFilter>
  ): Promise<ApiResponse<SavedLeadFilter>> => {
    try {
      return await request<SavedLeadFilter>(`/leads/saved-filters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const filters = getLocalFilters();
      const target = filters.find((f) => f.id === id);
      if (target) {
        if (body.isDefault) {
          filters.forEach((f) => {
            f.isDefault = false;
          });
        }
        Object.assign(target, body);
        saveLocalFilters(filters);
      }
      return { success: true, data: target || ({} as SavedLeadFilter) };
    }
  },

  checkLeadDuplicates: async (params: {
    email?: string;
    phone?: string;
    company?: string;
    excludeId?: string;
  }): Promise<ApiResponse<{ hasDuplicate: boolean; matches: LeadItem[] }>> => {
    try {
      return await request<{ hasDuplicate: boolean; matches: LeadItem[] }>('/leads/duplicate-check', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const matches = items.filter((l) => {
        if (params.excludeId && l._id === params.excludeId) return false;
        if (params.email && l.email?.toLowerCase() === params.email.toLowerCase()) return true;
        if (params.phone && l.phone?.replace(/\D/g, '') === params.phone.replace(/\D/g, '')) return true;
        return false;
      });
      return {
        success: true,
        data: {
          hasDuplicate: matches.length > 0,
          matches,
        },
      };
    }
  },

  addLeadSource: async (source: string): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/sources', {
        method: 'POST',
        body: JSON.stringify({ source }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!LEAD_SOURCES.includes(source)) LEAD_SOURCES.push(source);
      return { success: true, data: LEAD_SOURCES };
    }
  },

  addLeadStatus: async (status: string): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/statuses', {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!LEAD_STATUSES.includes(status)) LEAD_STATUSES.push(status);
      return { success: true, data: LEAD_STATUSES };
    }
  },

  // ─── LEAD TYPES / PRIORITIES ──────────────────────────────────────────────
  getLeadTypes: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/types', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: getLocalStringList('opennext_mock_lead_types_v1', LEAD_TYPES) };
    }
  },

  addLeadType: async (name: string): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/types', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const current = getLocalStringList('opennext_mock_lead_types_v1', LEAD_TYPES);
      const next = current.some((t) => t.toLowerCase() === name.toLowerCase())
        ? current
        : [...current, name];
      saveLocalAdminValue('opennext_mock_lead_types_v1', next);
      return { success: true, data: next };
    }
  },

  getLeadPriorities: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/priorities', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalStringList('opennext_mock_lead_priorities_v1', LEAD_PRIORITIES),
      };
    }
  },

  addLeadPriority: async (name: string): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/priorities', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const current = getLocalStringList('opennext_mock_lead_priorities_v1', LEAD_PRIORITIES);
      const next = current.some((t) => t.toLowerCase() === name.toLowerCase())
        ? current
        : [...current, name];
      saveLocalAdminValue('opennext_mock_lead_priorities_v1', next);
      return { success: true, data: next };
    }
  },

  // ─── PERSON CONTACTS (standalone contact directory used by Leads) ─────────
  listContacts: async (
    params: PersonContactQueryParams = {}
  ): Promise<ApiResponse<PersonContact[]>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.leadId?.trim()) query.set('leadId', params.leadId.trim());
    if (params.clientId?.trim()) query.set('clientId', params.clientId.trim());
    const qs = query.toString();
    try {
      const res = await request<PersonContact[]>(qs ? `/contacts?${qs}` : '/contacts', {
        method: 'GET',
      });
      return { ...res, meta: res.meta ?? res.pagination };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalContacts();
      const q = params.search?.trim().toLowerCase();
      if (q) {
        items = items.filter((c) =>
          [c.name, c.email, c.phone, c.pan, c.jobTitle].some((v) =>
            String(v || '').toLowerCase().includes(q)
          )
        );
      }
      const leadId = params.leadId?.trim();
      const clientId = params.clientId?.trim();
      if (leadId || clientId) {
        items = items.filter((c) => {
          const linkedLeads = Array.isArray(c.leadIds) ? c.leadIds.map(String) : [];
          const linkedClients = Array.isArray(c.clientIds) ? c.clientIds.map(String) : [];
          if (leadId && linkedLeads.includes(leadId)) return true;
          if (clientId && linkedClients.includes(clientId)) return true;
          return false;
        });
      }
      const page = params.page || 1;
      const limit = params.limit || 20;
      const total = items.length;
      return {
        success: true,
        data: items.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      };
    }
  },

  getContact: async (id: string): Promise<ApiResponse<PersonContact>> => {
    try {
      return await request<PersonContact>(`/contacts/${encodeURIComponent(id)}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const hit = getLocalContacts().find((c) => c._id === id);
      if (!hit) throw new ApiError('Contact not found', 404);
      return { success: true, data: hit };
    }
  },

  createContact: async (input: PersonContactInput): Promise<ApiResponse<PersonContact>> => {
    try {
      return await request<PersonContact>('/contacts', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const contacts = getLocalContacts();
      if (!input.name?.trim()) throw new ApiError('Contact name is required', 400);
      if (!input.allowDuplicate) {
        const dupes = findLocalContactDuplicates(input, contacts);
        if (dupes.length) {
          throw new ApiError(
            'This contact is duplicate — you can reuse an existing contact',
            409,
            'CONTACT_DUPLICATE',
            undefined,
            dupes
          );
        }
      }
      const now = new Date().toISOString();
      const created: PersonContact = {
        _id: `contact_${Date.now()}`,
        salutation: input.salutation || '',
        name: input.name.trim(),
        photoUrl: input.photoUrl || '',
        email: String(input.email || '').trim().toLowerCase(),
        phone: normalizeContactPhone(input.phone),
        gender: input.gender || '',
        pan: String(input.pan || '').trim().toUpperCase(),
        jobTitle: input.jobTitle || '',
        leadIds: [],
        leadsCount: 0,
        clientIds: [],
        clientsCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      saveLocalContacts([created, ...contacts]);
      return { success: true, data: created, message: 'Contact created' };
    }
  },

  updateContact: async (
    id: string,
    input: Partial<PersonContactInput>
  ): Promise<ApiResponse<PersonContact>> => {
    try {
      return await request<PersonContact>(`/contacts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const contacts = getLocalContacts();
      const index = contacts.findIndex((c) => c._id === id);
      if (index === -1) throw new ApiError('Contact not found', 404);
      const { allowDuplicate, ...fields } = input;
      const merged: PersonContact = {
        ...contacts[index],
        ...fields,
        email: String((fields.email ?? contacts[index].email) || '').trim().toLowerCase(),
        phone: normalizeContactPhone(fields.phone ?? contacts[index].phone),
        pan: String((fields.pan ?? contacts[index].pan) || '').trim().toUpperCase(),
        updatedAt: new Date().toISOString(),
      };
      if (!allowDuplicate) {
        const dupes = findLocalContactDuplicates({ ...merged, excludeId: id }, contacts);
        if (dupes.length) {
          throw new ApiError(
            'This contact is duplicate — you can reuse an existing contact',
            409,
            'CONTACT_DUPLICATE',
            undefined,
            dupes
          );
        }
      }
      contacts[index] = merged;
      saveLocalContacts(contacts);
      return { success: true, data: merged, message: 'Contact updated' };
    }
  },

  deleteContact: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/contacts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      saveLocalContacts(getLocalContacts().filter((c) => c._id !== id));
      return { success: true, data: { deleted: true }, message: 'Contact deleted' };
    }
  },

  checkContactDuplicates: async (
    params: PersonContactDuplicateQuery
  ): Promise<ApiResponse<PersonContactDuplicateResult>> => {
    const query = new URLSearchParams();
    if (params.email?.trim()) query.set('email', params.email.trim());
    if (params.phone?.trim()) query.set('phone', params.phone.trim());
    if (params.pan?.trim()) query.set('pan', params.pan.trim().toUpperCase());
    if (params.excludeId) query.set('excludeId', params.excludeId);
    const qs = query.toString();
    if (!query.has('email') && !query.has('phone') && !query.has('pan')) {
      return { success: true, data: { duplicates: [], isDuplicate: false } };
    }
    try {
      return await request<PersonContactDuplicateResult>(`/contacts/duplicates?${qs}`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const duplicates = findLocalContactDuplicates(params);
      return { success: true, data: { duplicates, isDuplicate: duplicates.length > 0 } };
    }
  },

  checkCompanyDiscrepancy: async (params: {
    name?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    excludeId?: string;
    entityType?: 'contact' | 'lead';
  }): Promise<ApiResponse<CompanyDiscrepancyResult>> => {
    const query = new URLSearchParams();
    if (params.name?.trim()) query.set('name', params.name.trim());
    if (params.email?.trim()) query.set('email', params.email.trim());
    if (params.phone?.trim()) query.set('phone', params.phone.trim());
    if (params.companyName?.trim()) query.set('companyName', params.companyName.trim());
    if (params.excludeId) query.set('excludeId', params.excludeId);
    if (params.entityType) query.set('entityType', params.entityType);
    const qs = query.toString();
    try {
      return await request<CompanyDiscrepancyResult>(`/contacts/check-discrepancy?${qs}`, {
        method: 'GET',
      });
    } catch {
      return { success: true, data: { hasDiscrepancy: false, discrepancy: null } };
    }
  },

  linkContactLead: async (contactId: string, leadId: string): Promise<ApiResponse<PersonContact>> => {
    return await request<PersonContact>(`/contacts/${contactId}/link-lead`, {
      method: 'POST',
      body: JSON.stringify({ leadId }),
    });
  },

  unlinkContactLead: async (contactId: string, leadId: string): Promise<ApiResponse<PersonContact>> => {
    return await request<PersonContact>(`/contacts/${contactId}/unlink-lead`, {
      method: 'POST',
      body: JSON.stringify({ leadId }),
    });
  },

  linkContactClient: async (contactId: string, clientId: string): Promise<ApiResponse<PersonContact>> => {
    return await request<PersonContact>(`/contacts/${contactId}/link-client`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
  },

  unlinkContactClient: async (contactId: string, clientId: string): Promise<ApiResponse<PersonContact>> => {
    return await request<PersonContact>(`/contacts/${contactId}/unlink-client`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
  },

  getContactCompanyLeads: async (contactId: string): Promise<ApiResponse<ContactCompanyLeadsResult>> => {
    return await request<ContactCompanyLeadsResult>(`/contacts/${contactId}/company-leads`, {
      method: 'GET',
    });
  },

  addLeadTag: async (tag: string): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/leads/tags', {
        method: 'POST',
        body: JSON.stringify({ tag }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!LEAD_TAGS.includes(tag)) LEAD_TAGS.push(tag);
      return { success: true, data: LEAD_TAGS };
    }
  },

  getLeadStorageStatus: async (): Promise<
    ApiResponse<{
      storageMode: string;
      s3Configured?: boolean;
      source?: string | null;
      message?: string;
    }>
  > => {
    try {
      return await request('/settings/storage');
    } catch (error) {
      rethrowUnlessMockFallback(error);
      try {
        return await request('/leads/storage/status');
      } catch (inner) {
        rethrowUnlessMockFallback(inner);
        return { success: true, data: { storageMode: 'local' } };
      }
    }
  },

  /**
   * Upload image/document/attachment via CRM → s3-media-plugin (preferred) or local disk.
   * Returns a durable public URL to persist on the CRM record.
   */
  uploadMedia: async (
    file: File,
    options: { folder?: string; entityId?: string } = {}
  ): Promise<
    ApiResponse<{
      url: string;
      fileUrl: string;
      storageKey: string;
      provider: string;
      source?: string;
      fileName: string;
      originalName: string;
      mimeType: string;
      fileSize: number;
    }>
  > => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (options.folder) formData.append('folder', options.folder);
      if (options.entityId) formData.append('entityId', options.entityId);
      const res = await fetch(`${API_BASE}/media/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({ success: false, error: 'Upload failed' }));
      if (!res.ok || !payload.success) {
        throw new ApiError(
          payload.error || payload.message || 'Upload failed',
          res.status || 500
        );
      }
      return payload;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const objectUrl = URL.createObjectURL(file);
      return {
        success: true,
        data: {
          url: objectUrl,
          fileUrl: objectUrl,
          storageKey: objectUrl,
          provider: 'local',
          source: 'mock',
          fileName: file.name,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        },
      };
    }
  },

  updateLeadQualification: async (
    id: string,
    qualification: Partial<LeadQualification> | Record<string, unknown>
  ): Promise<ApiResponse<LeadItem>> => {
    try {
      return await request<LeadItem>(`/leads/${id}/qualification`, {
        method: 'PUT',
        body: JSON.stringify(qualification),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const index = items.findIndex((l) => l._id === id);
      if (index === -1) throw new ApiError('Lead not found', 404);
      items[index].qualification = {
        ...items[index].qualification,
        ...(qualification as Record<string, unknown>),
      };
      saveLocalLeads(items);
      return { success: true, data: items[index] };
    }
  },

  updateLeadCommercialRequirement: async (
    id: string,
    commercial: LeadCommercialRequirement | Record<string, unknown>
  ): Promise<ApiResponse<LeadItem>> => {
    try {
      return await request<LeadItem>(`/leads/${id}/commercial-requirement`, {
        method: 'PUT',
        body: JSON.stringify(commercial),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalLeads();
      const index = items.findIndex((l) => l._id === id);
      if (index === -1) throw new ApiError('Lead not found', 404);
      const settings = getLocalCrmSettings();
      const current = items[index].commercialRequirement || emptyCommercialRequirement();
      const merged = {
        ...emptyCommercialRequirement(),
        ...current,
        ...(commercial as LeadCommercialRequirement),
        project: {
          ...emptyCommercialRequirement().project,
          ...(current.project || {}),
          ...((commercial as LeadCommercialRequirement).project || {}),
        },
        product: {
          ...emptyCommercialRequirement().product,
          ...(current.product || {}),
          ...((commercial as LeadCommercialRequirement).product || {}),
        },
      };
      const { score, breakdown } = computeQualificationMatchScore(
        merged,
        settings.qualification_match
      );
      const needsSampleRequest = Boolean(
        (commercial as LeadCommercialRequirement).needsSampleRequest ??
          merged.needsSampleRequest
      );
      items[index].commercialRequirement = {
        ...merged,
        needsSampleRequest,
        score,
        scoreBreakdown: breakdown,
        scoredAt: new Date().toISOString(),
      };
      items[index].qualification = {
        ...(items[index].qualification || {}),
        sampleRequired: needsSampleRequest,
      };
      saveLocalLeads(items);
      return { success: true, data: items[index] };
    }
  },

  getLeadEvents: async (id: string): Promise<ApiResponse<LeadEvent[]>> => {
    try {
      return await request<LeadEvent[]>(`/leads/${id}/events`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: [
          {
            _id: `ev_${id}_1`,
            leadId: id,
            title: 'Initial Discovery Discussion',
            eventType: 'Meeting',
            eventDate: new Date(Date.now() - 86400000 * 2).toISOString(),
            status: 'Completed',
            description: 'Discussed cloud migration scope and evaluated requirements with client CTO.',
            createdBy: 'Priya Patel',
          },
          {
            _id: `ev_${id}_2`,
            leadId: id,
            title: 'Follow up on preliminary quotation',
            eventType: 'Call',
            eventDate: new Date(Date.now() - 86400000 * 4).toISOString(),
            status: 'Completed',
            description: 'Phone review of pricing milestones.',
            createdBy: 'Rajesh Sharma',
          },
        ],
      };
    }
  },

  createLeadEvent: async (id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>> => {
    try {
      return await request(`/leads/${id}/events`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const newEv = {
        _id: `ev_${Date.now()}`,
        leadId: id,
        ...body,
        status: 'Open',
        createdAt: new Date().toISOString(),
      };
      return { success: true, data: newEv };
    }
  },

  updateLeadEvent: async (
    id: string,
    eventId: string,
    body: Record<string, unknown>
  ): Promise<ApiResponse<LeadEvent>> => {
    try {
      return await request<LeadEvent>(`/leads/${id}/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: { _id: eventId, leadId: id, title: '', ...body } as LeadEvent,
      };
    }
  },

  completeLeadEvent: async (id: string, eventId: string): Promise<ApiResponse<{ completed: boolean }>> => {
    try {
      return await request(`/leads/${id}/events/${eventId}/complete`, { method: 'POST' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: { completed: true } };
    }
  },

  deleteLeadEvent: async (id: string, eventId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request(`/leads/${id}/events/${eventId}`, { method: 'DELETE' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: { deleted: true } };
    }
  },

  getLeadFollowUps: async (id: string): Promise<ApiResponse<LeadFollowUp[]>> => {
    try {
      return await request<LeadFollowUp[]>(`/leads/${id}/follow-ups`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: [
          {
            _id: `fu_${id}_1`,
            leadId: id,
            title: 'Follow-up on proposal sign-off',
            dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
            status: 'Open',
            notes: 'Check in with director regarding final procurement approval.',
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
  },

  createLeadFollowUp: async (id: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>> => {
    try {
      return await request(`/leads/${id}/follow-ups`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const newFu = {
        _id: `fu_${Date.now()}`,
        leadId: id,
        ...body,
        status: 'Open',
        createdAt: new Date().toISOString(),
      };
      return { success: true, data: newFu };
    }
  },

  completeLeadFollowUp: async (id: string, followUpId: string): Promise<ApiResponse<{ completed: boolean }>> => {
    try {
      return await request(`/leads/${id}/follow-ups/${followUpId}/complete`, { method: 'POST' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: { completed: true } };
    }
  },

  deleteLeadFollowUp: async (id: string, followUpId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request(`/leads/${id}/follow-ups/${followUpId}`, { method: 'DELETE' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: { deleted: true } };
    }
  },

  getLeadAttachments: async (id: string): Promise<ApiResponse<LeadAttachment[]>> => {
    try {
      return await request<LeadAttachment[]>(`/leads/${id}/attachments`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: [
          {
            _id: `doc_${id}_1`,
            leadId: id,
            fileName: 'Cloud_Migration_Proposal.pdf',
            originalName: 'Cloud_Migration_Proposal.pdf',
            fileSize: 1024 * 340,
            fileUrl: '#',
            mimeType: 'application/pdf',
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
  },

  uploadLeadAttachment: async (id: string, file: File, meta?: { category?: string }): Promise<ApiResponse<any>> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document', file);
      if (meta?.category) {
        formData.append('category', meta.category);
      }
      const res = await fetch(`${API_BASE}/leads/${encodeURIComponent(id)}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({ success: false, error: 'Upload failed' }));
      if (!res.ok || !payload.success) {
        throw new ApiError(payload.error || payload.message || 'Document upload failed', res.status || 500);
      }
      return payload;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          _id: `doc_${Date.now()}`,
          leadId: id,
          fileName: file.name,
          originalName: file.name,
          fileSize: file.size,
          fileUrl: URL.createObjectURL(file),
          mimeType: file.type,
          category: meta?.category || 'document',
          createdAt: new Date().toISOString(),
        },
      };
    }
  },

  deleteLeadAttachment: async (id: string, attachmentId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request(`/leads/${id}/attachments/${attachmentId}`, { method: 'DELETE' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: { deleted: true } };
    }
  },

  uploadLeadPhoto: async (id: string, file: File): Promise<ApiResponse<{ photoUrl: string; provider?: string }>> => {
    try {
      const formData = new FormData();
      // Backend accepts either field; send both for OpenNext multipart parsers.
      formData.append('file', file);
      formData.append('photo', file);
      const res = await fetch(`${API_BASE}/leads/${encodeURIComponent(id)}/photo`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({
        success: false,
        error: 'Photo upload failed',
      }));
      if (!res.ok || !payload.success) {
        throw new ApiError(
          payload.error || payload.message || 'Photo upload failed',
          res.status || 500
        );
      }
      if (!payload.data?.photoUrl) {
        throw new ApiError('Upload succeeded but no photoUrl was returned', 500);
      }
      return payload;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          photoUrl: URL.createObjectURL(file),
          provider: 'mock',
        },
      };
    }
  },

  getAuditByRecord: async (recordType: string, recordId: string): Promise<ApiResponse<LeadAuditEntry[]>> => {
    try {
      return await request<LeadAuditEntry[]>(`/audit?recordType=${recordType}&recordId=${recordId}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: [
          {
            _id: 'audit_1',
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            username: 'admin',
            action: 'UPDATE_STAGE',
            description: 'Stage updated to Proposal Sent',
          },
          {
            _id: 'audit_2',
            createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
            username: 'sales_rep',
            action: 'CREATE_LEAD',
            description: 'Inbound lead profile created',
          },
        ],
      };
    }
  },

  // ─── CLIENTS MODULE ENDPOINTS ─────────────────────────────────────────────
  listClients: async (
    params: ClientQueryParams = {}
  ): Promise<ApiResponse<ClientItem[]> & { pagination?: ClientPaginationMeta }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit || 20));
    if (params.search) query.set('search', params.search);
    if (params.category) query.set('category', params.category);
    if (params.tag) query.set('tag', params.tag);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    try {
      return await request<ClientItem[]>(qs ? `/clients?${qs}` : '/clients', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalClients();
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q) ||
            c.primaryContact?.name?.toLowerCase().includes(q)
        );
      }
      if (params.category) items = items.filter((c) => c.category === params.category);
      if (params.tag) items = items.filter((c) => (c.tags || []).includes(params.tag!));
      if (params.status) items = items.filter((c) => c.status === params.status);
      const page = params.page || 1;
      const limit = params.limit || 20;
      const total = items.length;
      const start = (page - 1) * limit;
      return {
        success: true,
        data: items.slice(start, start + limit),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      };
    }
  },

  getClientsListSummary: async (): Promise<ApiResponse<ClientListSummary>> => {
    const normalize = (raw: Partial<ClientListSummary> & Record<string, unknown>): ClientListSummary => {
      const totalClients = Number(raw.totalClients ?? raw.total ?? 0) || 0;
      const fromLeads = Number(raw.fromLeads ?? raw.fromLead ?? 0) || 0;
      return {
        total: totalClients,
        fromLead: fromLeads,
        totalClients,
        fromLeads,
        activeClients:
          raw.activeClients !== undefined ? Number(raw.activeClients) || 0 : undefined,
        inactiveClients:
          raw.inactiveClients !== undefined ? Number(raw.inactiveClients) || 0 : undefined,
      };
    };

    try {
      const res = await request<Partial<ClientListSummary> & Record<string, unknown>>(
        '/clients/summary',
        { method: 'GET' }
      );
      const normalized = normalize(res.data || {});

      // Backend list summary only returns total + fromLead; enrich Active/Inactive from list.
      if (normalized.activeClients === undefined || normalized.inactiveClients === undefined) {
        try {
          const listRes = await crmApi.listClients({ limit: 500 });
          const items = listRes.data || [];
          normalized.activeClients = items.filter(
            (c) => String(c.status || 'Active').toLowerCase() !== 'inactive'
          ).length;
          normalized.inactiveClients = items.filter(
            (c) => String(c.status || '').toLowerCase() === 'inactive'
          ).length;
        } catch (error) {
          rethrowUnlessMockFallback(error);
          // Keep core totals even if enrichment fails.
        }
      }

      return { success: true, data: normalized, message: res.message };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalClients();
      return {
        success: true,
        data: normalize({
          totalClients: items.length,
          fromLeads: items.filter((c) => !!c.leadId || !!c.sourceLead).length,
          activeClients: items.filter(
            (c) => String(c.status || 'Active').toLowerCase() !== 'inactive'
          ).length,
          inactiveClients: items.filter(
            (c) => String(c.status || '').toLowerCase() === 'inactive'
          ).length,
        }),
      };
    }
  },

  getClientCategories: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/clients/categories', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: getLocalStringList(CLIENT_CATEGORIES_KEY, DEFAULT_CLIENT_CATEGORIES) };
    }
  },

  createClientCategory: async (category: string): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/clients/categories', {
        method: 'POST',
        body: JSON.stringify({ category }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalStringList(CLIENT_CATEGORIES_KEY, DEFAULT_CLIENT_CATEGORIES);
      const name = category.trim();
      if (name && !list.includes(name)) {
        list.push(name);
        saveLocalStringList(CLIENT_CATEGORIES_KEY, list);
      }
      return { success: true, data: list, message: 'Category created' };
    }
  },

  getClientTags: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/clients/tags', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: getLocalStringList(CLIENT_TAGS_KEY, DEFAULT_CLIENT_TAGS) };
    }
  },

  createClientTag: async (name: string | { name: string }): Promise<ApiResponse<string[]>> => {
    const tagName = typeof name === 'string' ? name : name.name;
    try {
      return await request<string[]>('/clients/tags', {
        method: 'POST',
        body: JSON.stringify(typeof name === 'string' ? { name } : name),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalStringList(CLIENT_TAGS_KEY, DEFAULT_CLIENT_TAGS);
      const trimmed = (tagName || '').trim();
      if (trimmed && !list.includes(trimmed)) {
        list.push(trimmed);
        saveLocalStringList(CLIENT_TAGS_KEY, list);
      }
      return { success: true, data: list, message: 'Tag created' };
    }
  },

  addClientTag: async (name: string | { name: string }): Promise<ApiResponse<string[]>> => {
    return crmApi.createClientTag(name);
  },

  getClientCustomFields: async (): Promise<ApiResponse<ClientCustomFieldDef[]>> => {
    try {
      return await request<ClientCustomFieldDef[]>('/clients/custom-fields', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: getLocalCustomFieldDefs() };
    }
  },

  addClientCustomField: async (
    body: Partial<ClientCustomFieldDef>
  ): Promise<ApiResponse<ClientCustomFieldDef>> => {
    try {
      return await request<ClientCustomFieldDef>('/clients/custom-fields', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const defs = getLocalCustomFieldDefs();
      const key =
        body.key?.trim() ||
        (body.label || 'field')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '') ||
        `field_${Date.now()}`;
      const def: ClientCustomFieldDef = {
        _id: `cf_${Date.now()}`,
        key,
        label: body.label || key,
        type: body.type || 'text',
        options: body.options,
        required: !!body.required,
      };
      defs.push(def);
      saveLocalCustomFieldDefs(defs);
      return { success: true, data: def, message: 'Custom field added' };
    }
  },

  getClientStatuses: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/clients/statuses', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: [...DEFAULT_CLIENT_STATUSES] };
    }
  },

  getClient: async (id: string): Promise<ApiResponse<ClientItem>> => {
    try {
      return await request<ClientItem>(`/clients/${encodeURIComponent(id)}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const found = getLocalClients().find((c) => c._id === id);
      if (!found) throw new ApiError('Client not found', 404);
      return { success: true, data: found };
    }
  },

  getClientSummary: async (id: string): Promise<ApiResponse<ClientDetailSummary>> => {
    const normalize = (raw: Partial<ClientDetailSummary> & Record<string, unknown>): ClientDetailSummary => {
      const contactCount = Number(raw.contactCount ?? raw.contacts ?? 0) || 0;
      const totalProjects = Number(raw.totalProjects ?? raw.projects ?? 0) || 0;
      const unpaidInvoices = Number(raw.unpaidInvoices ?? raw.invoices ?? 0) || 0;
      const totalQuotations = Number(raw.totalQuotations ?? raw.quotations ?? 0) || 0;
      const outstandingBalance = Number(raw.outstandingBalance ?? 0) || 0;
      return {
        ...raw,
        contactCount,
        totalProjects,
        activeProjects: Number(raw.activeProjects ?? 0) || 0,
        openTasks: Number(raw.openTasks ?? 0) || 0,
        overdueTasks: Number(raw.overdueTasks ?? 0) || 0,
        unpaidInvoices,
        overdueInvoices: Number(raw.overdueInvoices ?? 0) || 0,
        totalQuotations,
        outstandingBalance,
        paymentsThisMonth: Number(raw.paymentsThisMonth ?? raw.payments ?? 0) || 0,
        defaultCurrency: String(raw.defaultCurrency || getRuntimeDefaultCurrency()),
        contacts: contactCount,
        projects: totalProjects,
        invoices: unpaidInvoices,
        quotations: totalQuotations,
        payments: Number(raw.paymentsThisMonth ?? raw.payments ?? 0) || 0,
        totalRevenue: Number(raw.totalRevenue ?? 0) || 0,
      };
    };

    try {
      const res = await request<Partial<ClientDetailSummary> & Record<string, unknown>>(
        `/clients/${encodeURIComponent(id)}/summary`,
        { method: 'GET' }
      );
      return { success: true, data: normalize(res.data || {}), message: res.message };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const contacts = getLocalClientMap(CLIENT_CONTACTS_KEY, INITIAL_MOCK_CONTACTS)[id] || [];
      return {
        success: true,
        data: normalize({
          contactCount: contacts.length,
          totalProjects: 2,
          activeProjects: 1,
          openTasks: 3,
          unpaidInvoices: 1,
          totalQuotations: 2,
          outstandingBalance: 180000,
          paymentsThisMonth: 3,
          totalRevenue: 1250000,
        }),
      };
    }
  },

  createClient: async (body: ClientCreateInput): Promise<ApiResponse<ClientItem>> => {
    try {
      return await request<ClientItem>('/clients', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const clients = getLocalClients();
      const id = `client_${Date.now()}`;
      const primary = body.primaryContact
        ? {
            _id: `contact_${Date.now()}`,
            name: body.primaryContact.name,
            email: body.primaryContact.email,
            phone: body.primaryContact.phone,
            designation: body.primaryContact.designation,
            isPrimary: true,
            companyId: id,
          }
        : null;
      const created: ClientItem = {
        _id: id,
        name: body.name,
        email: body.email,
        phone: body.phone,
        website: body.website,
        avatarUrl: body.avatarUrl,
        avatarColor: body.avatarColor,
        status: body.status || 'Active',
        category: body.category,
        tags: body.tags || [],
        taxId: body.taxId,
        customFields: body.customFields,
        billingAddress: body.billingAddress,
        shippingAddress: body.shippingAddress,
        city: body.billingAddress?.city,
        country: body.billingAddress?.country || 'India',
        leadId: body.leadId,
        sourceLead: body.leadId
          ? { _id: body.leadId, name: body.name, email: body.email, company: body.name }
          : null,
        primaryContact: primary,
        contactCount: primary ? 1 : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      clients.unshift(created);
      saveLocalClients(clients);
      if (primary) {
        const map = getLocalClientMap(CLIENT_CONTACTS_KEY, INITIAL_MOCK_CONTACTS);
        map[id] = [primary];
        saveLocalClientMap(CLIENT_CONTACTS_KEY, map);
      }
      if (body.billingAddress || body.shippingAddress) {
        const addrMap = getLocalClientMap(CLIENT_ADDRESSES_KEY, INITIAL_MOCK_ADDRESSES);
        const addresses: ClientAddress[] = [];
        if (body.billingAddress) {
          addresses.push({
            ...body.billingAddress,
            _id: `addr_${Date.now()}_billing`,
            type: 'billing',
            isDefault: true,
          });
        }
        if (body.shippingAddress) {
          addresses.push({
            ...body.shippingAddress,
            _id: `addr_${Date.now()}_shipping`,
            type: 'shipping',
            isDefault: true,
          });
        }
        addrMap[id] = addresses;
        saveLocalClientMap(CLIENT_ADDRESSES_KEY, addrMap);
      }
      return { success: true, data: created, message: 'Client created successfully' };
    }
  },

  updateClient: async (id: string, body: Partial<ClientCreateInput>): Promise<ApiResponse<ClientItem>> => {
    try {
      return await request<ClientItem>(`/clients/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const clients = getLocalClients();
      const idx = clients.findIndex((c) => c._id === id);
      if (idx < 0) throw new ApiError('Client not found', 404);
      const { primaryContact: _pc, ...rest } = body;
      const updated: ClientItem = {
        ...clients[idx],
        ...rest,
        city: body.billingAddress?.city ?? clients[idx].city,
        country: body.billingAddress?.country ?? clients[idx].country,
        updatedAt: new Date().toISOString(),
      };
      clients[idx] = updated;
      saveLocalClients(clients);
      return { success: true, data: updated, message: 'Client updated successfully' };
    }
  },

  deleteClient: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/clients/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const clients = getLocalClients().filter((c) => c._id !== id);
      saveLocalClients(clients);
      return { success: true, data: { deleted: true }, message: 'Client deleted' };
    }
  },

  downloadClientsExport: async (
    params: ClientQueryParams & { format?: 'csv' | 'json' } = {}
  ): Promise<string> => {
    const format = params.format || 'csv';
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.category) query.set('category', params.category);
    if (params.tag) query.set('tag', params.tag);
    if (params.status) query.set('status', params.status);
    query.set('format', format);
    try {
      const response = await fetch(`${API_BASE}/clients/export?${query.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const filename =
        response.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1] ||
        `clients_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      triggerFileDownload({ filename, content: blob, format });
      return filename;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = (await crmApi.listClients({ ...params, limit: 500 })).data || [];
      if (format === 'json') {
        const content = JSON.stringify(items, null, 2);
        const filename = `clients_export_${new Date().toISOString().slice(0, 10)}.json`;
        triggerFileDownload({ filename, content, format: 'json' });
        return filename;
      }
      const header = 'Name,Email,Phone,Status,Category,Tags,City,Country,Primary Contact\r\n';
      const rows = items
        .map((c) =>
          [
            c.name,
            c.email || '',
            c.phone || '',
            c.status || '',
            c.category || '',
            (c.tags || []).join('; '),
            c.city || '',
            c.country || '',
            c.primaryContact?.name || '',
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\r\n');
      const filename = `clients_export_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerFileDownload({ filename, content: header + rows, format: 'csv' });
      return filename;
    }
  },

  getClientContacts: async (id: string): Promise<ApiResponse<ClientContact[]>> => {
    try {
      return await request<ClientContact[]>(`/clients/${encodeURIComponent(id)}/contacts`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_CONTACTS_KEY, INITIAL_MOCK_CONTACTS);
      return { success: true, data: map[id] || [] };
    }
  },

  addClientContact: async (
    id: string,
    body: Partial<ClientContact>
  ): Promise<ApiResponse<ClientContact>> => {
    try {
      return await request<ClientContact>(`/clients/${encodeURIComponent(id)}/contacts`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_CONTACTS_KEY, INITIAL_MOCK_CONTACTS);
      let list = map[id] || [];
      if (body.isPrimary) {
        list = list.map((c) => ({ ...c, isPrimary: false }));
      }
      const contact: ClientContact = {
        _id: `contact_${Date.now()}`,
        name: body.name || 'Contact',
        email: body.email,
        phone: body.phone,
        designation: body.designation,
        isPrimary: !!body.isPrimary || list.length === 0,
        companyId: id,
        personContactId: body.personContactId ? String(body.personContactId) : null,
        createdAt: new Date().toISOString(),
      };
      map[id] = [...list, contact];
      saveLocalClientMap(CLIENT_CONTACTS_KEY, map);
      if (contact.personContactId) {
        const people = getLocalContacts();
        const pIdx = people.findIndex((p) => p._id === contact.personContactId);
        if (pIdx >= 0) {
          const linked = new Set([...(people[pIdx].clientIds || []).map(String), id]);
          people[pIdx] = {
            ...people[pIdx],
            clientIds: [...linked],
            clientsCount: linked.size,
            updatedAt: new Date().toISOString(),
          };
          saveLocalContacts(people);
        }
      }
      const clients = getLocalClients();
      const idx = clients.findIndex((c) => c._id === id);
      if (idx >= 0) {
        clients[idx] = {
          ...clients[idx],
          contactCount: map[id].length,
          primaryContact: contact.isPrimary ? contact : clients[idx].primaryContact,
          updatedAt: new Date().toISOString(),
        };
        saveLocalClients(clients);
      }
      return { success: true, data: contact };
    }
  },

  updateClientContact: async (
    clientId: string,
    contactId: string,
    body: Partial<ClientContact>
  ): Promise<ApiResponse<ClientContact>> => {
    try {
      return await request<ClientContact>(
        `/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_CONTACTS_KEY, INITIAL_MOCK_CONTACTS);
      let list = map[clientId] || [];
      const idx = list.findIndex((c) => c._id === contactId);
      if (idx < 0) throw new ApiError('Contact not found', 404);
      if (body.isPrimary) {
        list = list.map((c) => ({ ...c, isPrimary: false }));
      }
      const prevPersonId = list[idx].personContactId
        ? String(list[idx].personContactId)
        : null;
      const nextPersonId =
        body.personContactId !== undefined
          ? body.personContactId
            ? String(body.personContactId)
            : null
          : prevPersonId;
      const updated: ClientContact = {
        ...list[idx],
        ...body,
        _id: contactId,
        personContactId: nextPersonId,
        updatedAt: new Date().toISOString(),
      };
      list[idx] = updated;
      map[clientId] = list;
      saveLocalClientMap(CLIENT_CONTACTS_KEY, map);
      if (prevPersonId !== nextPersonId || nextPersonId) {
        const people = getLocalContacts();
        if (prevPersonId && prevPersonId !== nextPersonId) {
          const oldIdx = people.findIndex((p) => p._id === prevPersonId);
          if (oldIdx >= 0) {
            const nextIds = (people[oldIdx].clientIds || [])
              .map(String)
              .filter((cid) => cid !== clientId);
            people[oldIdx] = {
              ...people[oldIdx],
              clientIds: nextIds,
              clientsCount: nextIds.length,
              updatedAt: new Date().toISOString(),
            };
          }
        }
        if (nextPersonId) {
          const pIdx = people.findIndex((p) => p._id === nextPersonId);
          if (pIdx >= 0) {
            const linked = new Set([...(people[pIdx].clientIds || []).map(String), clientId]);
            people[pIdx] = {
              ...people[pIdx],
              clientIds: [...linked],
              clientsCount: linked.size,
              updatedAt: new Date().toISOString(),
            };
          }
        }
        saveLocalContacts(people);
      }
      const clients = getLocalClients();
      const cIdx = clients.findIndex((c) => c._id === clientId);
      if (cIdx >= 0 && updated.isPrimary) {
        clients[cIdx] = { ...clients[cIdx], primaryContact: updated, updatedAt: new Date().toISOString() };
        saveLocalClients(clients);
      }
      return { success: true, data: updated, message: 'Contact updated' };
    }
  },

  deleteClientContact: async (
    clientId: string,
    contactId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_CONTACTS_KEY, INITIAL_MOCK_CONTACTS);
      const removed = (map[clientId] || []).find((c) => c._id === contactId);
      map[clientId] = (map[clientId] || []).filter((c) => c._id !== contactId);
      saveLocalClientMap(CLIENT_CONTACTS_KEY, map);
      if (removed?.personContactId) {
        const people = getLocalContacts();
        const pIdx = people.findIndex((p) => p._id === removed.personContactId);
        if (pIdx >= 0) {
          const nextIds = (people[pIdx].clientIds || [])
            .map(String)
            .filter((cid) => cid !== clientId);
          people[pIdx] = {
            ...people[pIdx],
            clientIds: nextIds,
            clientsCount: nextIds.length,
            updatedAt: new Date().toISOString(),
          };
          saveLocalContacts(people);
        }
      }
      return { success: true, data: { deleted: true } };
    }
  },

  getClientAddresses: async (id: string): Promise<ApiResponse<ClientAddress[]>> => {
    try {
      return await request<ClientAddress[]>(`/clients/${encodeURIComponent(id)}/addresses`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_ADDRESSES_KEY, INITIAL_MOCK_ADDRESSES);
      if (map[id]?.length) return { success: true, data: map[id] };
      const client = getLocalClients().find((c) => c._id === id);
      const addresses: ClientAddress[] = [];
      if (client?.billingAddress) {
        addresses.push({
          ...client.billingAddress,
          type: 'billing',
          isDefault: true,
          _id: `addr_${id}_billing`,
        });
      }
      if (client?.shippingAddress) {
        addresses.push({
          ...client.shippingAddress,
          type: 'shipping',
          isDefault: true,
          _id: `addr_${id}_shipping`,
        });
      }
      return { success: true, data: addresses };
    }
  },

  addClientAddress: async (
    id: string,
    body: Partial<ClientAddress>
  ): Promise<ApiResponse<ClientAddress>> => {
    try {
      return await request<ClientAddress>(`/clients/${encodeURIComponent(id)}/addresses`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_ADDRESSES_KEY, INITIAL_MOCK_ADDRESSES);
      let list = map[id] || [];
      const type = body.type || 'branch';
      if (body.isDefault) {
        list = list.map((a) => (a.type === type ? { ...a, isDefault: false } : a));
      }
      const address: ClientAddress = {
        ...body,
        _id: `addr_${Date.now()}`,
        type,
        isDefault: body.isDefault ?? list.filter((a) => a.type === type).length === 0,
      };
      map[id] = [...list, address];
      saveLocalClientMap(CLIENT_ADDRESSES_KEY, map);
      return { success: true, data: address, message: 'Address added' };
    }
  },

  updateClientAddress: async (
    clientId: string,
    addressId: string,
    body: Partial<ClientAddress>
  ): Promise<ApiResponse<ClientAddress>> => {
    try {
      return await request<ClientAddress>(
        `/clients/${encodeURIComponent(clientId)}/addresses/${encodeURIComponent(addressId)}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_ADDRESSES_KEY, INITIAL_MOCK_ADDRESSES);
      const list = map[clientId] || [];
      const idx = list.findIndex((a) => a._id === addressId);
      if (idx < 0) throw new ApiError('Address not found', 404);
      const updated = { ...list[idx], ...body, _id: addressId };
      list[idx] = updated;
      map[clientId] = list;
      saveLocalClientMap(CLIENT_ADDRESSES_KEY, map);
      return { success: true, data: updated, message: 'Address updated' };
    }
  },

  deleteClientAddress: async (
    clientId: string,
    addressId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/clients/${encodeURIComponent(clientId)}/addresses/${encodeURIComponent(addressId)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_ADDRESSES_KEY, INITIAL_MOCK_ADDRESSES);
      map[clientId] = (map[clientId] || []).filter((a) => a._id !== addressId);
      saveLocalClientMap(CLIENT_ADDRESSES_KEY, map);
      return { success: true, data: { deleted: true } };
    }
  },

  setClientDefaultAddress: async (
    clientId: string,
    addressId: string,
    type?: string
  ): Promise<ApiResponse<ClientAddress>> => {
    try {
      return await request<ClientAddress>(
        `/clients/${encodeURIComponent(clientId)}/addresses/${encodeURIComponent(addressId)}/default`,
        { method: 'POST', body: JSON.stringify({ type }) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_ADDRESSES_KEY, INITIAL_MOCK_ADDRESSES);
      const list = map[clientId] || [];
      const target = list.find((a) => a._id === addressId);
      if (!target) throw new ApiError('Address not found', 404);
      const addrType = type || target.type;
      map[clientId] = list.map((a) => ({
        ...a,
        isDefault: a._id === addressId ? true : a.type === addrType ? false : a.isDefault,
      }));
      saveLocalClientMap(CLIENT_ADDRESSES_KEY, map);
      const updated = map[clientId].find((a) => a._id === addressId)!;
      return { success: true, data: updated, message: 'Default address set' };
    }
  },

  getClientNotes: async (id: string): Promise<ApiResponse<ClientNote[]>> => {
    try {
      const response = await request<ClientNote[]>(`/clients/${encodeURIComponent(id)}/notes`, {
        method: 'GET',
      });
      return {
        ...response,
        data: (response.data || []).map((item) => normalizeClientNote(item)),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_NOTES_KEY, INITIAL_MOCK_NOTES);
      return { success: true, data: (map[id] || []).map((item) => normalizeClientNote(item)) };
    }
  },

  createClientNote: async (
    id: string,
    body: { body?: string; content?: string; title?: string; pinned?: boolean }
  ): Promise<ApiResponse<ClientNote>> => {
    const content = String(body.content || body.body || '').trim();
    const payload = {
      title: String(body.title || '').trim() || 'Untitled note',
      content,
      body: content,
      isPinned: Boolean(body.pinned),
      pinned: Boolean(body.pinned),
    };
    try {
      const response = await request<ClientNote>(`/clients/${encodeURIComponent(id)}/notes`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { ...response, data: normalizeClientNote(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_NOTES_KEY, INITIAL_MOCK_NOTES);
      const note = normalizeClientNote({
        _id: `note_${Date.now()}`,
        title: payload.title,
        body: content,
        pinned: !!body.pinned,
        createdByName: 'You',
        createdAt: new Date().toISOString(),
      });
      map[id] = [note, ...(map[id] || [])];
      saveLocalClientMap(CLIENT_NOTES_KEY, map);
      return { success: true, data: note };
    }
  },

  updateClientNote: async (
    clientId: string,
    noteId: string,
    body: Partial<ClientNote>
  ): Promise<ApiResponse<ClientNote>> => {
    const content =
      body.content !== undefined || body.body !== undefined
        ? String(body.content || body.body || '').trim()
        : undefined;
    const payload: Record<string, unknown> = {};
    if (body.title !== undefined) payload.title = String(body.title || '').trim() || 'Untitled note';
    if (content !== undefined) {
      payload.content = content;
      payload.body = content;
    }
    if (body.pinned !== undefined || body.isPinned !== undefined) {
      payload.isPinned = Boolean(body.pinned ?? body.isPinned);
      payload.pinned = Boolean(body.pinned ?? body.isPinned);
    }
    try {
      const response = await request<ClientNote>(
        `/clients/${encodeURIComponent(clientId)}/notes/${encodeURIComponent(noteId)}`,
        { method: 'PUT', body: JSON.stringify(payload) }
      );
      return { ...response, data: normalizeClientNote(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_NOTES_KEY, INITIAL_MOCK_NOTES);
      map[clientId] = (map[clientId] || []).map((n) =>
        n._id === noteId
          ? normalizeClientNote({
              ...n,
              ...body,
              body: content !== undefined ? content : n.body,
              content: content !== undefined ? content : n.content,
            })
          : n
      );
      saveLocalClientMap(CLIENT_NOTES_KEY, map);
      const updated = map[clientId].find((n) => n._id === noteId)!;
      return { success: true, data: updated };
    }
  },

  togglePinClientNote: async (
    clientId: string,
    noteId: string
  ): Promise<ApiResponse<ClientNote>> => {
    try {
      const response = await request<ClientNote>(
        `/clients/${encodeURIComponent(clientId)}/notes/${encodeURIComponent(noteId)}/pin`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      return { ...response, data: normalizeClientNote(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_NOTES_KEY, INITIAL_MOCK_NOTES);
      const list = map[clientId] || [];
      const idx = list.findIndex((n) => n._id === noteId);
      if (idx < 0) throw new ApiError('Note not found', 404);
      const updated = normalizeClientNote({
        ...list[idx],
        pinned: !list[idx].pinned,
        updatedAt: new Date().toISOString(),
      });
      list[idx] = updated;
      map[clientId] = list;
      saveLocalClientMap(CLIENT_NOTES_KEY, map);
      return { success: true, data: updated };
    }
  },

  deleteClientNote: async (
    clientId: string,
    noteId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/clients/${encodeURIComponent(clientId)}/notes/${encodeURIComponent(noteId)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_NOTES_KEY, INITIAL_MOCK_NOTES);
      map[clientId] = (map[clientId] || []).filter((n) => n._id !== noteId);
      saveLocalClientMap(CLIENT_NOTES_KEY, map);
      return { success: true, data: { deleted: true } };
    }
  },

  getClientEvents: async (id: string): Promise<ApiResponse<ClientEvent[]>> => {
    try {
      const response = await request<ClientEvent[]>(`/clients/${encodeURIComponent(id)}/events`, {
        method: 'GET',
      });
      return {
        ...response,
        data: (response.data || []).map((item) => normalizeClientEvent(item)),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_EVENTS_KEY, INITIAL_MOCK_EVENTS);
      return {
        success: true,
        data: (map[id] || []).map((item) => normalizeClientEvent(item)),
      };
    }
  },

  createClientEvent: async (
    id: string,
    body: Partial<ClientEvent>
  ): Promise<ApiResponse<ClientEvent>> => {
    const eventType = String(body.eventType || body.type || 'Other');
    const eventDate = body.eventDate || body.dueAt || new Date().toISOString();
    const payload = {
      title: String(body.title || '').trim(),
      eventType: eventType === 'Task' ? 'Follow-up' : eventType,
      type: eventType,
      eventDate,
      dueAt: eventDate,
      description: body.description || '',
      status: body.status || 'Open',
    };
    try {
      const response = await request<ClientEvent>(`/clients/${encodeURIComponent(id)}/events`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return {
        ...response,
        data: normalizeClientEvent(response.data),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_EVENTS_KEY, INITIAL_MOCK_EVENTS);
      const event = normalizeClientEvent({
        _id: `event_${Date.now()}`,
        title: payload.title || 'Event',
        type: eventType,
        description: body.description,
        dueAt: eventDate,
        completed: false,
        createdAt: new Date().toISOString(),
      });
      map[id] = [event, ...(map[id] || [])];
      saveLocalClientMap(CLIENT_EVENTS_KEY, map);
      return { success: true, data: event };
    }
  },

  updateClientEvent: async (
    clientId: string,
    eventId: string,
    body: Partial<ClientEvent>
  ): Promise<ApiResponse<ClientEvent>> => {
    try {
      return await request<ClientEvent>(
        `/clients/${encodeURIComponent(clientId)}/events/${encodeURIComponent(eventId)}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_EVENTS_KEY, INITIAL_MOCK_EVENTS);
      const list = map[clientId] || [];
      const idx = list.findIndex((e) => e._id === eventId);
      if (idx < 0) throw new ApiError('Event not found', 404);
      const updated = { ...list[idx], ...body, _id: eventId };
      list[idx] = updated;
      map[clientId] = list;
      saveLocalClientMap(CLIENT_EVENTS_KEY, map);
      return { success: true, data: updated };
    }
  },

  completeClientEvent: async (
    clientId: string,
    eventId: string
  ): Promise<ApiResponse<ClientEvent>> => {
    try {
      return await request<ClientEvent>(
        `/clients/${encodeURIComponent(clientId)}/events/${encodeURIComponent(eventId)}/complete`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_EVENTS_KEY, INITIAL_MOCK_EVENTS);
      const list = map[clientId] || [];
      const idx = list.findIndex((e) => e._id === eventId);
      if (idx < 0) throw new ApiError('Event not found', 404);
      const updated = {
        ...list[idx],
        completed: true,
        completedAt: new Date().toISOString(),
      };
      list[idx] = updated;
      map[clientId] = list;
      saveLocalClientMap(CLIENT_EVENTS_KEY, map);
      return { success: true, data: updated };
    }
  },

  deleteClientEvent: async (
    clientId: string,
    eventId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/clients/${encodeURIComponent(clientId)}/events/${encodeURIComponent(eventId)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_EVENTS_KEY, INITIAL_MOCK_EVENTS);
      map[clientId] = (map[clientId] || []).filter((e) => e._id !== eventId);
      saveLocalClientMap(CLIENT_EVENTS_KEY, map);
      return { success: true, data: { deleted: true } };
    }
  },

  getClientTimeline: async (
    id: string,
    params: { category?: string; limit?: number } = {}
  ): Promise<ApiResponse<ClientTimelineEntry[]>> => {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    try {
      return await request<ClientTimelineEntry[]>(
        qs
          ? `/clients/${encodeURIComponent(id)}/timeline?${qs}`
          : `/clients/${encodeURIComponent(id)}/timeline`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const events = getLocalClientMap(CLIENT_EVENTS_KEY, INITIAL_MOCK_EVENTS)[id] || [];
      const notes = getLocalClientMap(CLIENT_NOTES_KEY, INITIAL_MOCK_NOTES)[id] || [];
      const entries: ClientTimelineEntry[] = [
        ...events.map((e) => ({
          _id: `tl_event_${e._id}`,
          category: 'event',
          type: e.type,
          title: e.title,
          description: e.description,
          createdAt: e.createdAt || new Date().toISOString(),
          meta: { completed: e.completed, dueAt: e.dueAt, eventId: e._id },
        })),
        ...notes.map((n) => ({
          _id: `tl_note_${n._id}`,
          category: 'note',
          type: 'Note',
          title: n.title || 'Note',
          description: n.body,
          actorName: n.createdByName,
          createdAt: n.createdAt || new Date().toISOString(),
          meta: { noteId: n._id, pinned: n.pinned },
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const limited = params.limit ? entries.slice(0, params.limit) : entries;
      return { success: true, data: limited };
    }
  },

  checkClientDuplicates: async (body: {
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<ApiResponse<ClientDuplicateCheckResult>> => {
    try {
      return await request<ClientDuplicateCheckResult>('/clients/duplicate-check', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const clients = getLocalClients();
      const name = (body.name || '').trim().toLowerCase();
      const email = (body.email || '').trim().toLowerCase();
      const phone = (body.phone || '').replace(/\s+/g, '');
      const exact = clients
        .filter(
          (c) =>
            (email && c.email?.toLowerCase() === email) ||
            (phone && (c.phone || '').replace(/\s+/g, '') === phone) ||
            (name && c.name.toLowerCase() === name)
        )
        .map((c) => ({
          _id: c._id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          matchReason:
            email && c.email?.toLowerCase() === email
              ? 'Exact email'
              : phone && (c.phone || '').replace(/\s+/g, '') === phone
                ? 'Exact phone'
                : 'Exact name',
        }));
      const similar = clients
        .filter(
          (c) =>
            name &&
            c.name.toLowerCase() !== name &&
            (c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()))
        )
        .map((c) => ({
          _id: c._id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          matchReason: 'Similar name',
        }));
      return {
        success: true,
        data: {
          hasDuplicates: exact.length > 0 || similar.length > 0,
          exact,
          similar,
        },
      };
    }
  },

  previewClientImport: async (body: {
    format?: 'csv' | 'json';
    content?: string;
    rows?: Array<Record<string, unknown>>;
    options?: Record<string, unknown>;
  }): Promise<ApiResponse<ClientImportPreviewResult>> => {
    try {
      return await request<ClientImportPreviewResult>('/clients/import/preview', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let rows: Array<Record<string, unknown>> = body.rows || [];
      if (!rows.length && body.content) {
        const text = body.content.trim();
        if (text.startsWith('[') || text.startsWith('{')) {
          try {
            const parsed = JSON.parse(text);
            rows = Array.isArray(parsed) ? parsed : [parsed];
          } catch (error) {
            rethrowUnlessMockFallback(error);
            rows = [];
          }
        } else {
          rows = parseCsvString(text);
        }
      }
      const existingClients = getLocalClients();
      const defaultCategory = String(body.options?.defaultCategory || '').trim();
      const defaultStatus = String(body.options?.defaultStatus || 'Active').trim();

      const previewRows = rows.map((row, index) => {
        const name = pickImportField(row, [...CLIENT_IMPORT_ALIASES.name]);
        const email = pickImportField(row, [...CLIENT_IMPORT_ALIASES.email]).toLowerCase();
        const phone = pickImportField(row, [...CLIENT_IMPORT_ALIASES.phone]);
        const status =
          pickImportField(row, [...CLIENT_IMPORT_ALIASES.status]) || defaultStatus;
        const category =
          pickImportField(row, [...CLIENT_IMPORT_ALIASES.category]) || defaultCategory;

        const errors: string[] = [];
        const warnings: string[] = [];
        const duplicates: string[] = [];

        if (!name) errors.push('Company / Client Name is required');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push('Invalid email address format');
        }

        if (email && existingClients.some((c) => (c.email || '').toLowerCase() === email)) {
          warnings.push(`Client with email "${email}" already exists in database`);
          duplicates.push('email');
        }
        if (name && existingClients.some((c) => (c.name || '').toLowerCase() === name.toLowerCase())) {
          warnings.push(`Client with company name "${name}" already exists`);
          duplicates.push('name');
        }

        const valid = errors.length === 0;

        return {
          rowIndex: index + 1,
          name,
          company: name,
          email: email || undefined,
          phone: phone || undefined,
          status,
          category: category || undefined,
          valid,
          errors,
          warnings,
          duplicates,
          data: {
            ...row,
            name,
            email,
            phone,
            status,
            category,
          },
        };
      });

      const validCount = previewRows.filter((r) => r.valid).length;
      const errorCount = previewRows.filter((r) => !r.valid).length;
      const warningCount = previewRows.filter((r) => (r.warnings?.length || 0) > 0).length;
      const duplicateCount = previewRows.filter((r) => (r.duplicates?.length || 0) > 0).length;

      return {
        success: true,
        data: {
          total: previewRows.length,
          totalRows: previewRows.length,
          valid: validCount,
          validCount,
          invalid: errorCount,
          errorCount,
          warningCount,
          duplicateCount,
          rows: previewRows,
        },
      };
    }
  },

  executeClientImport: async (body: {
    format?: 'csv' | 'json';
    content?: string;
    rows?: Array<Record<string, unknown>>;
    options?: Record<string, unknown>;
  }): Promise<ApiResponse<ClientImportExecuteResult>> => {
    try {
      return await request<ClientImportExecuteResult>('/clients/import', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const preview = await crmApi.previewClientImport(body);
      const rows = preview.data?.rows || [];
      const skipDuplicates = body.options?.skipDuplicates !== false;
      let createdCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const clientIds: string[] = [];

      for (const row of rows) {
        if (!row.valid) {
          failedCount++;
          continue;
        }
        if (skipDuplicates && (row.duplicates?.length || 0) > 0) {
          skippedCount++;
          continue;
        }
        try {
          const created = await crmApi.createClient({
            name: row.name || 'Imported Client',
            email: row.email,
            phone: row.phone,
            status: row.status || 'Active',
            category: row.category,
          });
          clientIds.push(created.data._id);
          createdCount++;
        } catch (error) {
          rethrowUnlessMockFallback(error);
          failedCount++;
        }
      }

      return {
        success: true,
        data: {
          created: createdCount,
          createdCount,
          skipped: skippedCount,
          skippedCount,
          failed: failedCount,
          failedCount,
          clientIds,
          message: `Imported ${createdCount} clients (${skippedCount} duplicates skipped)`,
        },
        message: `Imported ${createdCount} clients`,
      };
    }
  },

  getClientQuotations: async (id: string): Promise<ApiResponse<ClientRelatedQuotation[]>> => {
    try {
      return await request<ClientRelatedQuotation[]>(
        `/clients/${encodeURIComponent(id)}/quotations`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: INITIAL_MOCK_QUOTATIONS[id] || [] };
    }
  },

  getClientInvoices: async (id: string): Promise<ApiResponse<ClientRelatedInvoice[]>> => {
    try {
      return await request<ClientRelatedInvoice[]>(`/clients/${encodeURIComponent(id)}/invoices`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: INITIAL_MOCK_INVOICES[id] || [] };
    }
  },

  getClientPayments: async (id: string): Promise<ApiResponse<ClientRelatedPayment[]>> => {
    try {
      return await request<ClientRelatedPayment[]>(`/clients/${encodeURIComponent(id)}/payments`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: INITIAL_MOCK_PAYMENTS[id] || [] };
    }
  },

  getClientProjects: async (id: string): Promise<ApiResponse<ClientRelatedProject[]>> => {
    try {
      return await request<ClientRelatedProject[]>(`/clients/${encodeURIComponent(id)}/projects`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: INITIAL_MOCK_PROJECTS[id] || [] };
    }
  },

  getClientTasks: async (id: string): Promise<ApiResponse<ClientRelatedTask[]>> => {
    try {
      return await request<ClientRelatedTask[]>(`/clients/${encodeURIComponent(id)}/tasks`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: INITIAL_MOCK_TASKS[id] || [] };
    }
  },

  getClientTimeLogs: async (id: string): Promise<ApiResponse<ClientRelatedTimeLog[]>> => {
    try {
      return await request<ClientRelatedTimeLog[]>(`/clients/${encodeURIComponent(id)}/time-logs`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data:
          id === 'client_1'
            ? [
                {
                  _id: 'tl_1',
                  taskTitle: 'Architecture review',
                  hours: 4,
                  date: '2026-08-20',
                  userName: 'Dev Lead',
                },
              ]
            : [],
      };
    }
  },

  getClientContracts: async (id: string): Promise<ApiResponse<ClientRelatedContract[]>> => {
    try {
      return await request<ClientRelatedContract[]>(
        `/clients/${encodeURIComponent(id)}/contracts`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data:
          id === 'client_1'
            ? [
                {
                  _id: 'ctr_1',
                  title: 'Annual Retainer 2026',
                  status: 'Active',
                  startDate: '2026-01-01',
                  endDate: '2026-12-31',
                },
              ]
            : [],
      };
    }
  },

  getClientProducts: async (id: string): Promise<ApiResponse<ClientRelatedProduct[]>> => {
    try {
      return await request<ClientRelatedProduct[]>(`/clients/${encodeURIComponent(id)}/products`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data:
          id === 'client_1'
            ? [{ _id: 'prod_1', name: 'Managed Support', sku: 'SUP-01', quantity: 1, unitPrice: 50000 }]
            : [],
      };
    }
  },

  getClientDocuments: async (
    id: string,
    category = ''
  ): Promise<ApiResponse<ClientDocument[]>> => {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    try {
      const res = await request<any[]>(
        `/clients/${encodeURIComponent(id)}/documents${query}`,
        { method: 'GET' }
      );
      const rows = Array.isArray(res.data) ? res.data : [];
      return {
        ...res,
        data: rows.map((raw) => normalizeClientDocument(raw)),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_DOCUMENTS_KEY, INITIAL_MOCK_DOCUMENTS);
      let docs = map[id] || [];
      if (category) docs = docs.filter((d) => d.category === category);
      return { success: true, data: docs };
    }
  },

  createClientDocument: async (
    id: string,
    body: Partial<ClientDocument>
  ): Promise<ApiResponse<ClientDocument>> => {
    try {
      const res = await request<any>(`/clients/${encodeURIComponent(id)}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          name: body.name,
          fileName: body.name,
          url: body.url,
          fileUrl: body.url,
          category: body.category || 'General',
          description: body.description || '',
        }),
      });
      return {
        ...res,
        data: normalizeClientDocument(res.data || body, { forceKind: 'link' }),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_DOCUMENTS_KEY, INITIAL_MOCK_DOCUMENTS);
      const doc: ClientDocument = {
        _id: `doc_${Date.now()}`,
        name: body.name || 'Document',
        url: body.url || '#',
        kind: 'link',
        storageProvider: 'url',
        category: body.category || 'General',
        description: body.description,
        uploadedByName: 'You',
        createdAt: new Date().toISOString(),
      };
      map[id] = [doc, ...(map[id] || [])];
      saveLocalClientMap(CLIENT_DOCUMENTS_KEY, map);
      return { success: true, data: doc, message: 'Document link added' };
    }
  },

  uploadClientDocument: async (
    id: string,
    file: File,
    meta: { category?: string; description?: string } = {}
  ): Promise<ApiResponse<ClientDocument>> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document', file);
      if (meta.category) formData.append('category', meta.category);
      if (meta.description) formData.append('description', meta.description);
      const res = await fetch(`${API_BASE}/clients/${encodeURIComponent(id)}/documents/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({ success: false, error: 'Upload failed' }));
      if (!res.ok || !payload.success) {
        throw new ApiError(payload.error || payload.message || 'Document upload failed', res.status || 500);
      }
      return {
        ...payload,
        data: normalizeClientDocument(payload.data || {}, {
          forceKind: 'file',
          fallbackName: file.name,
          fallbackMime: file.type,
          fallbackSize: file.size,
          fallbackCategory: meta.category,
          fallbackDescription: meta.description,
        }),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const objectUrl = URL.createObjectURL(file);
      return {
        success: true,
        data: {
          _id: `doc_${Date.now()}`,
          name: file.name,
          url: objectUrl,
          kind: 'file',
          storageProvider: 'local',
          category: meta.category || 'General',
          description: meta.description || '',
          mimeType: file.type,
          size: file.size,
          uploadedByName: 'You',
          createdAt: new Date().toISOString(),
        },
      };
    }
  },

  deleteClientDocument: async (
    clientId: string,
    docId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(docId)}`,
        { method: 'DELETE' }
      );
    } catch {
      const map = getLocalClientMap(CLIENT_DOCUMENTS_KEY, INITIAL_MOCK_DOCUMENTS);
      map[clientId] = (map[clientId] || []).filter((d) => d._id !== docId);
      saveLocalClientMap(CLIENT_DOCUMENTS_KEY, map);
      return { success: true, data: { deleted: true } };
    }
  },

  /** Authenticated plugin download URL (avoids raw /upload or s3-media 404s). */
  getClientDocumentDownloadUrl: (clientId: string, docId: string): string =>
    `${API_BASE}/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(docId)}/download`,

  downloadClientDocument: async (
    clientId: string,
    docId: string,
    fileName = 'document'
  ): Promise<void> => {
    const { downloadAttachment } = await import('../components/common/AttachmentPreviewModal');
    const url = `${API_BASE}/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(docId)}/download`;
    await downloadAttachment(url, fileName);
  },

  getClientPortalAccess: async (id: string): Promise<ApiResponse<ClientPortalAccess[]>> => {
    try {
      return await request<ClientPortalAccess[]>(
        `/clients/${encodeURIComponent(id)}/portal-access`,
        { method: 'GET' }
      );
    } catch {
      const map = getLocalClientMap(CLIENT_PORTAL_KEY, INITIAL_MOCK_PORTAL);
      return { success: true, data: map[id] || [] };
    }
  },

  inviteClientPortalContact: async (
    id: string,
    body: Partial<ClientPortalAccess> & { password?: string }
  ): Promise<ApiResponse<ClientPortalAccess>> => {
    try {
      return await request<ClientPortalAccess>(
        `/clients/${encodeURIComponent(id)}/portal-access/invite`,
        { method: 'POST', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_PORTAL_KEY, INITIAL_MOCK_PORTAL);
      const access: ClientPortalAccess = {
        _id: `portal_${Date.now()}`,
        name: body.name || 'Portal User',
        email: body.email || '',
        username: body.username,
        portalRole: body.portalRole || 'Standard',
        permissions: body.permissions || ['invoices', 'documents'],
        status: 'Invited',
        contactId: body.contactId,
        invitedAt: new Date().toISOString(),
      };
      map[id] = [access, ...(map[id] || [])];
      saveLocalClientMap(CLIENT_PORTAL_KEY, map);
      return { success: true, data: access, message: 'Invitation sent' };
    }
  },

  resendClientPortalInvitation: async (
    clientId: string,
    accessId: string
  ): Promise<ApiResponse<ClientPortalAccess>> => {
    try {
      return await request<ClientPortalAccess>(
        `/clients/${encodeURIComponent(clientId)}/portal-access/${encodeURIComponent(accessId)}/resend`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_PORTAL_KEY, INITIAL_MOCK_PORTAL);
      const list = map[clientId] || [];
      const idx = list.findIndex((a) => a._id === accessId);
      if (idx < 0) throw new ApiError('Portal access not found', 404);
      list[idx] = { ...list[idx], status: 'Invited', invitedAt: new Date().toISOString() };
      map[clientId] = list;
      saveLocalClientMap(CLIENT_PORTAL_KEY, map);
      return { success: true, data: list[idx], message: 'Invitation resent' };
    }
  },

  activateClientPortalUser: async (
    clientId: string,
    accessId: string
  ): Promise<ApiResponse<ClientPortalAccess>> => {
    try {
      return await request<ClientPortalAccess>(
        `/clients/${encodeURIComponent(clientId)}/portal-access/${encodeURIComponent(accessId)}/activate`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_PORTAL_KEY, INITIAL_MOCK_PORTAL);
      const list = map[clientId] || [];
      const idx = list.findIndex((a) => a._id === accessId);
      if (idx < 0) throw new ApiError('Portal access not found', 404);
      list[idx] = {
        ...list[idx],
        status: 'Active',
        activatedAt: new Date().toISOString(),
      };
      map[clientId] = list;
      saveLocalClientMap(CLIENT_PORTAL_KEY, map);
      return { success: true, data: list[idx] };
    }
  },

  suspendClientPortalUser: async (
    clientId: string,
    accessId: string,
    reason = ''
  ): Promise<ApiResponse<ClientPortalAccess>> => {
    try {
      return await request<ClientPortalAccess>(
        `/clients/${encodeURIComponent(clientId)}/portal-access/${encodeURIComponent(accessId)}/suspend`,
        { method: 'POST', body: JSON.stringify({ reason }) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_PORTAL_KEY, INITIAL_MOCK_PORTAL);
      const list = map[clientId] || [];
      const idx = list.findIndex((a) => a._id === accessId);
      if (idx < 0) throw new ApiError('Portal access not found', 404);
      list[idx] = { ...list[idx], status: 'Suspended', suspendReason: reason };
      map[clientId] = list;
      saveLocalClientMap(CLIENT_PORTAL_KEY, map);
      return { success: true, data: list[idx] };
    }
  },

  reinstateClientPortalUser: async (
    clientId: string,
    accessId: string
  ): Promise<ApiResponse<ClientPortalAccess>> => {
    try {
      return await request<ClientPortalAccess>(
        `/clients/${encodeURIComponent(clientId)}/portal-access/${encodeURIComponent(accessId)}/reinstate`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_PORTAL_KEY, INITIAL_MOCK_PORTAL);
      const list = map[clientId] || [];
      const idx = list.findIndex((a) => a._id === accessId);
      if (idx < 0) throw new ApiError('Portal access not found', 404);
      list[idx] = { ...list[idx], status: 'Active', suspendReason: undefined };
      map[clientId] = list;
      saveLocalClientMap(CLIENT_PORTAL_KEY, map);
      return { success: true, data: list[idx] };
    }
  },

  updateClientPortalPermissions: async (
    clientId: string,
    accessId: string,
    body: { portalRole?: string; permissions?: string[] }
  ): Promise<ApiResponse<ClientPortalAccess>> => {
    try {
      return await request<ClientPortalAccess>(
        `/clients/${encodeURIComponent(clientId)}/portal-access/${encodeURIComponent(accessId)}/permissions`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_PORTAL_KEY, INITIAL_MOCK_PORTAL);
      const list = map[clientId] || [];
      const idx = list.findIndex((a) => a._id === accessId);
      if (idx < 0) throw new ApiError('Portal access not found', 404);
      list[idx] = {
        ...list[idx],
        portalRole: body.portalRole || list[idx].portalRole,
        permissions: body.permissions || list[idx].permissions,
      };
      map[clientId] = list;
      saveLocalClientMap(CLIENT_PORTAL_KEY, map);
      return { success: true, data: list[idx] };
    }
  },

  revokeClientPortalAccess: async (
    clientId: string,
    accessId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/clients/${encodeURIComponent(clientId)}/portal-access/${encodeURIComponent(accessId)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalClientMap(CLIENT_PORTAL_KEY, INITIAL_MOCK_PORTAL);
      map[clientId] = (map[clientId] || []).filter((a) => a._id !== accessId);
      saveLocalClientMap(CLIENT_PORTAL_KEY, map);
      return { success: true, data: { deleted: true } };
    }
  },

  getClientHealthScore: async (clientId: string): Promise<ApiResponse<ClientHealthScore>> => {
    try {
      return await request<ClientHealthScore>(
        `/customer-success/accounts/${encodeURIComponent(clientId)}`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const account = computeLocalAccountHealthRecords().find((item) => item.clientId === clientId);
      if (!account) {
        return {
          success: true,
          data: {
            healthScore: 75,
            healthCategory: 'Healthy',
            openTicketsCount: 0,
            overdueInvoicesCount: 0,
            lastActivityAt: new Date().toISOString(),
            notes: 'No account signals found for this client.',
          },
        };
      }
      return {
        success: true,
        data: {
          healthScore: account.healthScore,
          healthCategory: account.healthCategory,
          openTicketsCount: account.factors.openTickets,
          overdueInvoicesCount: account.factors.overdueInvoices,
          lastActivityAt: account.lastActivityAt || undefined,
          notes: account.recommendedAction,
        },
      };
    }
  },

  // ─── FINANCE MODULE ENDPOINTS ─────────────────────────────────────────────
  listQuotations: async (
    params: QuotationQueryParams = {}
  ): Promise<ApiResponse<QuotationItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit') return;
      if (value != null && value !== '') query.set(key, String(value));
    });
    try {
      const response = await request<QuotationItem[]>(`/quotations?${query}`, { method: 'GET' });
      return {
        ...response,
        data: (response.data || []).map(normalizeQuotationRecord),
        pagination: fallbackPagination(page, limit, response.data?.length || 0, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalFinanceList(QUOTATIONS_STORE_KEY, INITIAL_FINANCE_QUOTATIONS)
        .map(normalizeQuotationRecord)
        .filter((item) => item.isLatestVersion !== false);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.quotationNumber, item.quotationNo, item.number, item.title, item.recipientName]
            .some((value) => value?.toLowerCase().includes(term))
        );
      }
      if (params.status) items = items.filter((item) => item.status === params.status);
      if (params.clientId) items = items.filter((item) => item.clientId === params.clientId);
      if (params.leadId) items = items.filter((item) => item.leadId === params.leadId);
      if (params.opportunityId) items = items.filter((item) => item.opportunityId === params.opportunityId);
      const archived = params.archived === true || params.archived === 'true';
      if (archived) items = items.filter((item) => item.isArchived);
      else items = items.filter((item) => !item.isArchived);
      const paged = paginateLocalItems(items, page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  /** Quotations linked to a specific lead (Proposal tab). */
  getLeadQuotations: async (leadId: string): Promise<ApiResponse<QuotationItem[]>> => {
    const id = String(leadId || '').trim();
    if (!id) return { success: true, data: [] };
    try {
      const response = await request<QuotationItem[]>(`/leads/${encodeURIComponent(id)}/quotations`, {
        method: 'GET',
      });
      return {
        ...response,
        data: (response.data || []).map(normalizeQuotationRecord),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      try {
        const fallback = await crmApi.listQuotations({ leadId: id, limit: 100 });
        return { success: true, data: fallback.data || [] };
      } catch {
        return { success: true, data: [] };
      }
    }
  },

  getQuotation: async (id: string): Promise<ApiResponse<QuotationItem>> => {
    try {
      const response = await request<QuotationItem>(`/quotations/${encodeURIComponent(id)}`, { method: 'GET' });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: getLocalQuotationOrThrow(id) };
    }
  },

  createQuotation: async (body: QuotationCreateInput): Promise<ApiResponse<QuotationItem>> => {
    const payload = {
      ...body,
      expiryDate: body.validTill,
      discountPercent: body.discountType === 'percent' ? body.discountValue || 0 : 0,
      discountAmount: body.discountType === 'amount' ? body.discountValue || 0 : 0,
    };
    try {
      const response = await request<QuotationItem>('/quotations', { method: 'POST', body: JSON.stringify(payload) });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if ((!body.clientId && !body.leadId) || !body.lineItems.length) {
        throw new ApiError('Recipient and at least one line item are required', 400);
      }
      const opportunityId = String(body.opportunityId || '').trim();
      if (opportunityId) {
        const opps = getLocalOpportunitiesRaw();
        const opp = opps.find((o) => o._id === opportunityId && !o.isDeleted);
        if (!opp) throw new ApiError('Opportunity not found', 404);
        if (opp.acceptedQuotationId) {
          throw new ApiError(
            'A quotation has already been accepted for this opportunity. New quotations cannot be created.',
            409
          );
        }
        const stage = String(opp.stage || '').toLowerCase();
        if (stage === 'won' || stage === 'lost') {
          throw new ApiError('Quotations cannot be created for Won or Lost opportunities', 409);
        }
      }
      const items = getLocalFinanceList(QUOTATIONS_STORE_KEY, INITIAL_FINANCE_QUOTATIONS);
      const totals = calculateFinanceTotals({
        lines: body.lineItems,
        discountType: body.discountType,
        discountValue: body.discountValue,
        taxCalculation: body.taxCalculation,
        shippingCharge: body.shippingCharge,
      });
      const created = normalizeQuotationRecord({
        ...body,
        _id: `quotation_${Date.now()}`,
        quotationNumber: `QT-${new Date().getFullYear()}-${String(items.length + 101).padStart(3, '0')}`,
        expiryDate: body.validTill,
        discountPercent: body.discountType === 'percent' ? body.discountValue : 0,
        discountAmount: body.discountType === 'amount' ? body.discountValue : 0,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        status: 'Draft',
        isArchived: false,
        isLatestVersion: true,
        createdAt: new Date().toISOString(),
      });
      items.unshift(created);
      saveLocalFinanceList(QUOTATIONS_STORE_KEY, items);
      if (opportunityId) {
        const opps = getLocalOpportunitiesRaw();
        const idx = opps.findIndex((o) => o._id === opportunityId && !o.isDeleted);
        if (idx >= 0) {
          const probability = DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES.Negotiation ?? 85;
          const expectedRevenue = Number(opps[idx].expectedRevenue || opps[idx].value || 0);
          opps[idx] = {
            ...opps[idx],
            stage: 'Negotiation',
            probability,
            weightedRevenue: Math.round(expectedRevenue * (probability / 100) * 100) / 100,
            generatedQuotationId: created._id,
            generatedQuotationNo: created.quotationNo || created.quotationNumber || created.number,
            closedAt: null,
            lostReason: null,
            updatedAt: new Date().toISOString(),
          };
          saveLocalOpportunities(opps);
        }
      }
      return { success: true, data: created, message: 'Quotation created' };
    }
  },

  updateQuotation: async (id: string, body: Partial<QuotationCreateInput>): Promise<ApiResponse<QuotationItem>> => {
    const payload = {
      ...body,
      ...(body.validTill !== undefined ? { expiryDate: body.validTill } : {}),
      ...(body.discountType === 'percent' ? { discountPercent: body.discountValue || 0, discountAmount: 0 } : {}),
      ...(body.discountType === 'amount' ? { discountAmount: body.discountValue || 0, discountPercent: 0 } : {}),
    };
    try {
      const response = await request<QuotationItem>(`/quotations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return mutateLocalQuotation(id, (current) => {
        if (['Accepted', 'Converted'].includes(String(current.status))) {
          throw new ApiError('Accepted/converted quotations are locked. Create a revision instead.', 400);
        }
        const merged = { ...current, ...body };
        if (body.lineItems) {
          const totals = calculateFinanceTotals({
            lines: merged.lineItems,
            discountType: merged.discountType,
            discountValue: merged.discountValue,
            taxCalculation: merged.taxCalculation,
            shippingCharge: merged.shippingCharge,
          });
          merged.subtotal = totals.subtotal;
          merged.taxTotal = totals.taxTotal;
          merged.grandTotal = totals.grandTotal;
        }
        return merged;
      });
    }
  },

  deleteQuotation: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/quotations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(QUOTATIONS_STORE_KEY, INITIAL_FINANCE_QUOTATIONS);
      const current = items.find((entry) => entry._id === id);
      if (current && !['Draft', 'Rejected', 'Expired'].includes(String(current.status))) {
        throw new ApiError('Only draft/rejected/expired quotations can be deleted', 400);
      }
      saveLocalFinanceList(
        QUOTATIONS_STORE_KEY,
        items.filter((entry) => entry._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  sendQuotation: async (id: string): Promise<ApiResponse<QuotationItem>> => {
    try {
      const response = await request<QuotationItem>(`/quotations/${encodeURIComponent(id)}/send`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const result = await mutateLocalQuotation(id, (item) => ({
        ...item,
        status: item.status === 'Draft' || item.status === 'Expired' ? 'Sent' : item.status,
        sentAt: new Date().toISOString(),
        portalToken: item.portalToken || `quo_portal_${id}_${Date.now()}`,
        portalUrl: item.portalUrl || `#/quotations/public/${item.portalToken || `quo_portal_${id}`}`,
      }));
      const quote = result.data;
      const opportunityId = String(quote?.opportunityId || '').trim();
      if (opportunityId) {
        const items = getLocalOpportunitiesRaw();
        const idx = items.findIndex((o) => o._id === opportunityId && !o.isDeleted);
        if (idx >= 0) {
          const current = String(items[idx].stage || '').trim();
          const lower = current.toLowerCase();
          if (lower !== 'won' && lower !== 'lost' && lower !== 'quotation sent') {
            const probability = DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES['Quotation Sent'] ?? 95;
            const expectedRevenue = Number(items[idx].expectedRevenue || items[idx].value || 0);
            items[idx] = {
              ...items[idx],
              stage: 'Quotation Sent',
              probability,
              weightedRevenue: Math.round(expectedRevenue * (probability / 100) * 100) / 100,
              closedAt: null,
              lostReason: null,
              updatedAt: new Date().toISOString(),
            };
            saveLocalOpportunities(items);
          }
        }
      }
      return result;
    }
  },

  acceptQuotation: async (
    id: string,
    body: { name?: string; email?: string; comments?: string } = {}
  ): Promise<ApiResponse<QuotationItem>> => {
    try {
      const response = await request<QuotationItem>(`/quotations/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const result = await mutateLocalQuotation(id, (item) => ({
        ...item,
        status: 'Accepted',
        acceptedAt: new Date().toISOString(),
        acceptedByName: body.name,
        acceptedByEmail: body.email,
      }));
      const quote = result.data;
      const opportunityId = String(quote?.opportunityId || '').trim();
      if (opportunityId) {
        const items = getLocalOpportunitiesRaw();
        const idx = items.findIndex((o) => o._id === opportunityId && !o.isDeleted);
        if (idx >= 0) {
          const current = String(items[idx].stage || '').trim().toLowerCase();
          if (items[idx].acceptedQuotationId && items[idx].acceptedQuotationId !== quote._id) {
            throw new ApiError(
              'Only one quotation can be accepted per opportunity.',
              409
            );
          }
          if (current !== 'lost') {
            const probability = DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES.Won ?? 100;
            const expectedRevenue = Number(items[idx].expectedRevenue || items[idx].value || 0);
            items[idx] = {
              ...items[idx],
              stage: 'Won',
              probability,
              weightedRevenue: Math.round(expectedRevenue * (probability / 100) * 100) / 100,
              closedAt: new Date().toISOString(),
              lostReason: null,
              acceptedQuotationId: quote._id,
              acceptedQuotationNo: quote.quotationNo || quote.quotationNumber || quote.number,
              generatedQuotationId: quote._id,
              updatedAt: new Date().toISOString(),
            };
            saveLocalOpportunities(items);
          }
        }
      }
      return result;
    }
  },

  rejectQuotation: async (id: string, body: { reason: string }): Promise<ApiResponse<QuotationItem>> => {
    try {
      const response = await request<QuotationItem>(`/quotations/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.reason?.trim()) throw new ApiError('Rejection reason is required', 400);
      const result = await mutateLocalQuotation(id, (item) => ({
        ...item,
        status: 'Rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: body.reason.trim(),
      }));
      const quote = result.data;
      const opportunityId = String(quote?.opportunityId || '').trim();
      if (opportunityId) {
        const items = getLocalOpportunitiesRaw();
        const idx = items.findIndex((o) => o._id === opportunityId && !o.isDeleted);
        if (idx >= 0 && !items[idx].acceptedQuotationId) {
          const current = String(items[idx].stage || '').trim().toLowerCase();
          if (current !== 'won' && current !== 'lost') {
            const probability = DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES.Negotiation ?? 85;
            const expectedRevenue = Number(items[idx].expectedRevenue || items[idx].value || 0);
            items[idx] = {
              ...items[idx],
              stage: 'Negotiation',
              probability,
              weightedRevenue: Math.round(expectedRevenue * (probability / 100) * 100) / 100,
              closedAt: null,
              lostReason: null,
              updatedAt: new Date().toISOString(),
            };
            saveLocalOpportunities(items);
          }
        }
      }
      return result;
    }
  },

  reviseQuotation: async (
    id: string,
    body: QuotationRevisionInput
  ): Promise<ApiResponse<QuotationItem>> => {
    try {
      const response = await request<QuotationItem>(`/quotations/${encodeURIComponent(id)}/revise`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.reason?.trim()) throw new ApiError('Revision reason is required', 400);
      const parent = getLocalQuotationOrThrow(id);
      const items = getLocalFinanceList(QUOTATIONS_STORE_KEY, INITIAL_FINANCE_QUOTATIONS);
      const parentIndex = items.findIndex((entry) => entry._id === id);
      if (parentIndex >= 0) {
        items[parentIndex] = { ...items[parentIndex], isLatestVersion: false };
      }
      const revNo = Number(parent.revisionNumber || 0) + 1;
      const baseNo = String(parent.quotationNumber || 'QT').replace(/-R\d+$/, '');
      const lineItems = body.lineItems || parent.lineItems;
      const totals = calculateFinanceTotals({
        lines: lineItems,
        discountType: body.discountType || parent.discountType,
        discountValue: body.discountValue ?? parent.discountValue,
        taxCalculation: parent.taxCalculation,
        shippingCharge: body.shippingCharge ?? parent.shippingCharge,
      });
      const created = normalizeQuotationRecord({
        ...parent,
        _id: `quotation_${Date.now()}`,
        quotationNumber: `${baseNo}-R${revNo}`,
        status: 'Draft',
        revisionOf: parent.revisionOf || parent._id,
        revisionNumber: revNo,
        revisionReason: body.reason.trim(),
        validTill: body.validTill || parent.validTill,
        expiryDate: body.validTill || parent.validTill,
        lineItems,
        discountType: body.discountType || parent.discountType,
        discountValue: body.discountValue ?? parent.discountValue,
        shippingCharge: body.shippingCharge ?? parent.shippingCharge,
        recipientNotes: body.recipientNotes ?? parent.recipientNotes,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        isLatestVersion: true,
        isArchived: false,
        portalToken: undefined,
        convertedInvoiceId: undefined,
        convertedSalesOrderId: undefined,
        acceptedAt: undefined,
        createdAt: new Date().toISOString(),
      });
      items.unshift(created);
      saveLocalFinanceList(QUOTATIONS_STORE_KEY, items);
      return { success: true, data: created };
    }
  },

  listQuotationRevisions: async (id: string): Promise<ApiResponse<QuotationItem[]>> => {
    try {
      return await request(`/quotations/${encodeURIComponent(id)}/revisions`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const current = getLocalQuotationOrThrow(id);
      const rootId = current.revisionOf || current._id;
      const items = getLocalFinanceList(QUOTATIONS_STORE_KEY, INITIAL_FINANCE_QUOTATIONS)
        .map(normalizeQuotationRecord)
        .filter((item) => item._id === rootId || item.revisionOf === rootId || item._id === id);
      return { success: true, data: items };
    }
  },

  archiveQuotation: async (id: string): Promise<ApiResponse<QuotationItem>> => {
    try {
      const response = await request<QuotationItem>(`/quotations/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return mutateLocalQuotation(id, (item) => ({ ...item, isArchived: true }));
    }
  },

  restoreQuotation: async (id: string): Promise<ApiResponse<QuotationItem>> => {
    try {
      const response = await request<QuotationItem>(`/quotations/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return { ...response, data: normalizeQuotationRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return mutateLocalQuotation(id, (item) => ({ ...item, isArchived: false }));
    }
  },

  generateQuotationPortalToken: async (
    id: string
  ): Promise<ApiResponse<{ portalToken: string; portalUrl?: string }>> => {
    try {
      return await request(`/quotations/${encodeURIComponent(id)}/portal-token`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const token = `quo_portal_${id}_${Date.now()}`;
      await mutateLocalQuotation(id, (item) => ({
        ...item,
        portalToken: token,
        portalUrl: `#/quotations/public/${token}`,
        status: item.status === 'Draft' ? 'Sent' : item.status,
      }));
      return { success: true, data: { portalToken: token, portalUrl: `#/quotations/public/${token}` } };
    }
  },

  convertQuotationToInvoice: async (id: string): Promise<ApiResponse<InvoiceItem>> => {
    try {
      const response = await request<InvoiceItem>(
        `/quotations/${encodeURIComponent(id)}/convert-to-invoice`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      return response;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const quote = getLocalQuotationOrThrow(id);
      if (quote.convertedInvoiceId) throw new ApiError('Quotation already converted to an invoice', 400);
      if (quote.status !== 'Accepted' && quote.status !== 'Sent') {
        throw new ApiError('Only sent/accepted quotations can be converted', 400);
      }
      if (!quote.clientId) throw new ApiError('Quotation must be linked to a client before invoicing', 400);
      const invoice = await crmApi.createInvoice({
        invoiceNo: `INV-FROM-${quote.quotationNumber || id}`,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        currency: quote.currency,
        exchangeRate: 1,
        taxCalculation: quote.taxCalculation,
        clientId: quote.clientId,
        quotationId: quote._id,
        lineItems: quote.lineItems,
        notes: quote.recipientNotes,
        discountType: quote.discountType,
        discountValue: quote.discountValue,
        shippingCharge: quote.shippingCharge,
      });
      mutateLocalQuotation(id, (item) => ({
        ...item,
        status: 'Converted',
        convertedInvoiceId: invoice.data._id,
      }));
      return invoice;
    }
  },

  convertQuotationToSalesOrder: async (id: string): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request(`/quotations/${encodeURIComponent(id)}/convert-to-sales-order`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const quote = getLocalQuotationOrThrow(id);
      if (quote.convertedSalesOrderId) throw new ApiError('Quotation already converted to a sales order', 400);
      if (!quote.clientId) throw new ApiError('Quotation must be linked to a client', 400);
      const order = await crmApi.createSalesOrder({
        orderNumber: `SO-FROM-${quote.quotationNumber || id}`,
        clientId: quote.clientId,
        quotationId: id,
        generatedBy: 'Quotation Conversion',
        status: 'Approved',
        issueDate: new Date().toISOString().slice(0, 10),
        shippingState: quote.shippingState || 'Maharashtra',
        billingAddress: (quote as { billingAddress?: string }).billingAddress,
        shippingAddress: (quote as { shippingAddress?: string }).shippingAddress,
        lineItems: (quote.lineItems || []).map((line) => ({
          description: line.name,
          sku: line.description,
          qty: line.qty,
          rate: line.rate,
          tax: line.tax,
        })),
        discountType: quote.discountType === 'amount' ? 'amount' : 'percent',
        discountValue: quote.discountValue || 0,
        shippingCharge: quote.shippingCharge || 0,
        notes: quote.recipientNotes,
      });
      mutateLocalQuotation(id, (item) => ({
        ...item,
        status: 'Converted',
        convertedSalesOrderId: order.data._id,
      }));
      return order;
    }
  },

  getQuotationPrintHtml: async (id: string): Promise<ApiResponse<{ html: string }>> => {
    try {
      const url = `${API_BASE}/quotations/${encodeURIComponent(id)}/print`;
      const response = await fetch(url, { credentials: 'include' });
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let message = `Failed to load print view (HTTP ${response.status})`;
        if (contentType.includes('application/json')) {
          try {
            const body = (await response.json()) as { error?: string; message?: string };
            message = body.error || body.message || message;
          } catch (error) {
            rethrowUnlessMockFallback(error);
            // ignore
          }
        }
        throw new ApiError(message, response.status);
      }

      if (contentType.includes('text/html') || contentType.includes('text/plain') || !contentType.includes('json')) {
        const html = await response.text();
        if (!html.trim()) throw new ApiError('Print view returned empty content', 500);
        return { success: true, data: { html } };
      }

      const payload = (await response.json()) as ApiResponse<{ html: string }>;
      if (!payload.success || !payload.data?.html) {
        throw new ApiError(payload.error || payload.message || 'Failed to load print view', response.status);
      }
      return payload;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const quote = getLocalQuotationOrThrow(id);
      const lines = (quote.lineItems || [])
        .map(
          (line) =>
            `<tr><td>${escapeHtml(line.name)}</td><td>${line.qty}</td><td>${line.rate}</td><td>${line.tax}%</td><td>${(line.qty * line.rate).toFixed(2)}</td></tr>`
        )
        .join('');
      return {
        success: true,
        data: {
          html: `<!doctype html><html><head><title>${escapeHtml(quote.quotationNumber || '')}</title>
            <style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style></head><body>
            <h1>Quotation ${escapeHtml(quote.quotationNumber || '')}</h1>
            <p><strong>${escapeHtml(quote.title || '')}</strong></p>
            <p>To: ${escapeHtml(quote.recipientName || '')}</p>
            <p>Valid till: ${escapeHtml(quote.validTill || '')}</p>
            <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>
            <p><strong>Grand Total:</strong> ${quote.currency} ${Number(quote.grandTotal || 0).toFixed(2)}</p>
            </body></html>`,
        },
      };
    }
  },

  downloadQuotationPdf: async (id: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE}/quotations/${encodeURIComponent(id)}/pdf`, {
      credentials: 'include',
    });
    if (!response.ok) {
      let message = `Failed to download PDF (HTTP ${response.status})`;
      try {
        const body = (await response.json()) as { error?: string; message?: string };
        message = body.error || body.message || message;
      } catch {
        // non-JSON error body
      }
      throw new ApiError(message, response.status);
    }
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const buffer = await response.arrayBuffer();
    if (contentType.includes('pdf') || (buffer.byteLength > 4 && new TextDecoder().decode(buffer.slice(0, 5)) === '%PDF-')) {
      return new Blob([buffer], { type: 'application/pdf' });
    }
    throw new ApiError('Quotation PDF endpoint did not return a PDF document', 502);
  },

  exportQuotations: async (
    params: QuotationExportParams = {}
  ): Promise<ApiResponse<{ format: string; content: string; filename: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value != null && value !== '' && query.set(key, String(value)));
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/quotations/export${query.size ? `?${query}` : ''}`,
        'quotations_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = await crmApi.listQuotations(params);
      const rows = list.data || [];
      const format = params.format || 'csv';
      if (format === 'json') {
        return {
          success: true,
          data: {
            format: 'json',
            content: JSON.stringify(rows, null, 2),
            filename: `quotations-export-${Date.now()}.json`,
          },
        };
      }
      const header = 'Quotation No,Recipient,Title,Issue Date,Valid Till,Status,Currency,Grand Total';
      const body = rows
        .map((item) =>
          [
            item.quotationNumber || '',
            item.recipientName || '',
            item.title || '',
            item.issueDate,
            item.validTill,
            item.status,
            item.currency,
            item.grandTotal,
          ]
            .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');
      return {
        success: true,
        data: {
          format: 'csv',
          content: `${header}\n${body}`,
          filename: `quotations-export-${Date.now()}.csv`,
        },
      };
    }
  },

  listQuotationTemplates: async (
    params: { search?: string } = {}
  ): Promise<ApiResponse<QuotationTemplateItem[]>> => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    try {
      return await request(`/quotations/templates${query.size ? `?${query}` : ''}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalFinanceList(QUOTATION_TEMPLATES_STORE_KEY, INITIAL_MOCK_QUOTATION_TEMPLATES);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.name, item.category, item.description].some((value) => value?.toLowerCase().includes(term))
        );
      }
      return { success: true, data: items };
    }
  },

  getQuotationTemplate: async (id: string): Promise<ApiResponse<QuotationTemplateItem>> => {
    try {
      return await request(`/quotations/templates/${encodeURIComponent(id)}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const item = getLocalFinanceList(QUOTATION_TEMPLATES_STORE_KEY, INITIAL_MOCK_QUOTATION_TEMPLATES).find(
        (entry) => entry._id === id
      );
      if (!item) throw new ApiError('Quotation template not found', 404);
      return { success: true, data: item };
    }
  },

  createQuotationTemplate: async (
    body: QuotationTemplateCreateInput
  ): Promise<ApiResponse<QuotationTemplateItem>> => {
    try {
      return await request('/quotations/templates', { method: 'POST', body: JSON.stringify(body) });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.name?.trim() || !body.lineItems?.length) {
        throw new ApiError('Template name and line items are required', 400);
      }
      const items = getLocalFinanceList(QUOTATION_TEMPLATES_STORE_KEY, INITIAL_MOCK_QUOTATION_TEMPLATES);
      const created: QuotationTemplateItem = {
        ...body,
        _id: `quotpl_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      items.unshift(created);
      saveLocalFinanceList(QUOTATION_TEMPLATES_STORE_KEY, items);
      return { success: true, data: created };
    }
  },

  deleteQuotationTemplate: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request(`/quotations/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(QUOTATION_TEMPLATES_STORE_KEY, INITIAL_MOCK_QUOTATION_TEMPLATES);
      saveLocalFinanceList(
        QUOTATION_TEMPLATES_STORE_KEY,
        items.filter((entry) => entry._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  saveQuotationAsTemplate: async (
    id: string,
    body: { name: string; category?: string } = { name: '' }
  ): Promise<ApiResponse<QuotationTemplateItem>> => {
    try {
      return await request(`/quotations/${encodeURIComponent(id)}/save-as-template`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const quote = getLocalQuotationOrThrow(id);
      return crmApi.createQuotationTemplate({
        name: body.name || `${quote.quotationNumber} Template`,
        category: body.category || 'General',
        description: quote.description,
        currency: quote.currency,
        taxCalculation: quote.taxCalculation,
        shippingCharge: quote.shippingCharge,
        recipientNotes: quote.recipientNotes,
        lineItems: quote.lineItems,
        discountType: quote.discountType,
        discountValue: quote.discountValue,
      });
    }
  },

  listInvoices: async (
    params: InvoiceQueryParams = {}
  ): Promise<ApiResponse<InvoiceItem[]> & { pagination?: InvoicePaginationMeta }> => {
    const query = new URLSearchParams();
    const page = params.page || 1;
    const limit = params.limit || 20;
    query.set('page', String(page));
    query.set('limit', String(limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.ids) query.set('ids', params.ids);
    if (params.clientId) query.set('clientId', params.clientId);
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.recurringProfileId) query.set('recurringProfileId', params.recurringProfileId);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);
    if (params.isRecurring === true || params.isRecurring === 'true') {
      query.set('isRecurring', 'true');
    }
    const archived =
      params.isArchived !== undefined && params.isArchived !== null
        ? params.isArchived
        : params.archived;
    if (archived !== undefined && archived !== null) {
      query.set('isArchived', String(archived));
      query.set('archived', String(archived));
    }
    try {
      const response = await request<InvoiceItem[]>(`/invoices?${query}`, { method: 'GET' });
      return {
        ...response,
        data: (response.data || []).map(normalizeInvoiceRecord),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES).map(normalizeInvoiceRecord);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.invoiceNo, item.clientName, item.projectName].some((value) => value?.toLowerCase().includes(term))
        );
      }
      if (params.status === 'Overdue') {
        const now = Date.now();
        items = items.filter((item) => {
          const due = item.dueDate ? new Date(item.dueDate).getTime() : NaN;
          const balance = Number(item.balanceDue ?? 0);
          return (
            Number.isFinite(due) &&
            due < now &&
            balance > 0 &&
            !['Cancelled', 'Paid', 'Draft', 'Written Off'].includes(String(item.status || ''))
          );
        });
      } else if (params.status) {
        items = items.filter((item) => item.status === params.status);
      }
      if (params.ids) {
        const idSet = new Set(
          String(params.ids)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        );
        items = items.filter((item) => idSet.has(item._id));
      }
      if (params.clientId) items = items.filter((item) => item.clientId === params.clientId);
      if (params.projectId) items = items.filter((item) => item.projectId === params.projectId);
      if (params.recurringProfileId) {
        items = items.filter((item) => item.recurringProfileId === params.recurringProfileId);
      }
      const archivedFlag =
        params.isArchived !== undefined && params.isArchived !== null
          ? params.isArchived
          : params.archived;
      const archivedOnly = archivedFlag === true || archivedFlag === 'true';
      const activeOnly = archivedFlag === false || archivedFlag === 'false' || archivedFlag == null;
      if (archivedOnly) items = items.filter((item) => item.isArchived);
      else if (activeOnly) items = items.filter((item) => !item.isArchived);
      if (params.isRecurring === true || params.isRecurring === 'true') {
        items = items.filter((item) => Boolean(item.isRecurring || item.recurringProfileId));
      }
      const total = items.length;
      const start = (page - 1) * limit;
      return {
        success: true,
        data: items.slice(start, start + limit),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      };
    }
  },

  getInvoice: async (id: string): Promise<ApiResponse<InvoiceItem>> => {
    try {
      const response = await request<InvoiceItem>(`/invoices/${encodeURIComponent(id)}`, { method: 'GET' });
      return { ...response, data: normalizeInvoiceRecord(response.data) };
    } catch {
      const item = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES).find((entry) => entry._id === id);
      if (!item) throw new ApiError('Invoice not found', 404);
      return { success: true, data: normalizeInvoiceRecord(item) };
    }
  },

  getNextInvoiceNumber: async (): Promise<ApiResponse<{ invoiceNo: string }>> => {
    try {
      const response = await request<{ invoiceNo?: string; nextNumber?: string }>('/invoices/next-number', { method: 'GET' });
      return {
        ...response,
        data: { invoiceNo: response.data.invoiceNo || response.data.nextNumber || '' },
      };
    } catch {
      const count = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES).length;
      return { success: true, data: { invoiceNo: `INV-${new Date().getFullYear()}-${String(count + 90).padStart(3, '0')}` } };
    }
  },

  /** AI extract invoice fields from PDF page images (client converts PDF → JPEGs). */
  extractInvoiceFromPdf: async (body: {
    imageDataUrls: string[];
  }): Promise<ApiResponse<FinancePdfOcrExtractResult>> => {
    return request<FinancePdfOcrExtractResult>('/invoices/ocr/extract', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** AI extract quotation fields from PDF page images. */
  extractQuotationFromPdf: async (body: {
    imageDataUrls: string[];
  }): Promise<ApiResponse<FinancePdfOcrExtractResult>> => {
    return request<FinancePdfOcrExtractResult>('/quotations/ocr/extract', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  createInvoice: async (body: InvoiceCreateInput): Promise<ApiResponse<InvoiceItem>> => {
    const payload = {
      ...body,
      discountPercent: body.discountType === 'percent' ? body.discountValue || 0 : 0,
      discountAmount: body.discountType === 'amount' ? body.discountValue || 0 : 0,
    };
    try {
      const response = await request<InvoiceItem>('/invoices', { method: 'POST', body: JSON.stringify(payload) });
      return { ...response, data: normalizeInvoiceRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.clientId || !body.invoiceNo || !body.lineItems.length) {
        throw new ApiError('Invoice number, client, and line items are required', 400);
      }
      const items = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES);
      const totals = calculateFinanceTotals({
        lines: body.lineItems,
        discountType: body.discountType,
        discountValue: body.discountValue,
        taxCalculation: body.taxCalculation,
        shippingCharge: body.shippingCharge,
      });
      const created = normalizeInvoiceRecord({
        ...body,
        _id: `invoice_${Date.now()}`,
        discountPercent: body.discountType === 'percent' ? body.discountValue : 0,
        discountAmount: body.discountType === 'amount' ? body.discountValue : 0,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        amountPaid: 0,
        creditAmount: 0,
        balanceDue: totals.grandTotal,
        status: 'Draft',
        isArchived: false,
        createdAt: new Date().toISOString(),
      });
      items.unshift(created);
      saveLocalFinanceList(INVOICES_STORE_KEY, items);
      return { success: true, data: created, message: 'Invoice created' };
    }
  },

  updateInvoice: async (id: string, body: Partial<InvoiceCreateInput>): Promise<ApiResponse<InvoiceItem>> => {
    const payload = {
      ...body,
      ...(body.discountType === 'percent' ? { discountPercent: body.discountValue || 0, discountAmount: 0 } : {}),
      ...(body.discountType === 'amount' ? { discountAmount: body.discountValue || 0, discountPercent: 0 } : {}),
    };
    try {
      const response = await request<InvoiceItem>(`/invoices/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return { ...response, data: normalizeInvoiceRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES);
      const index = items.findIndex((entry) => entry._id === id);
      if (index < 0) throw new ApiError('Invoice not found', 404);
      const merged = { ...items[index], ...body, updatedAt: new Date().toISOString() };
      if (body.lineItems) {
        const totals = calculateFinanceTotals({
          lines: merged.lineItems,
          discountType: merged.discountType,
          discountValue: merged.discountValue,
          taxCalculation: merged.taxCalculation,
          shippingCharge: merged.shippingCharge,
          amountPaid: merged.amountPaid,
          creditAmount: merged.creditAmount,
        });
        merged.subtotal = totals.subtotal;
        merged.taxTotal = totals.taxTotal;
        merged.grandTotal = totals.grandTotal;
        merged.balanceDue = totals.balanceDue;
      }
      items[index] = normalizeInvoiceRecord(merged);
      saveLocalFinanceList(INVOICES_STORE_KEY, items);
      return { success: true, data: items[index] };
    }
  },

  deleteInvoice: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/invoices/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      const items = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES);
      saveLocalFinanceList(
        INVOICES_STORE_KEY,
        items.filter((entry) => entry._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  sendInvoice: async (
    id: string,
    body: { email?: string; message?: string } = {}
  ): Promise<ApiResponse<InvoiceItem>> => {
    try {
      const response = await request<InvoiceItem>(`/invoices/${encodeURIComponent(id)}/send`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeInvoiceRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return mutateLocalInvoice(id, (item) => ({
        ...item,
        status: item.status === 'Draft' ? 'Sent' : item.status,
        sentAt: new Date().toISOString(),
        payToken: item.payToken || `pay_${id}_${Date.now()}`,
      }));
    }
  },

  generateInvoicePayToken: async (id: string): Promise<ApiResponse<{ payToken: string; portalUrl?: string }>> => {
    try {
      return await request<{ payToken: string; portalUrl?: string }>(
        `/invoices/${encodeURIComponent(id)}/pay-token`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const token = `pay_${id}_${Date.now()}`;
      await mutateLocalInvoice(id, (item) => ({
        ...item,
        payToken: token,
        portalUrl: `#/invoices/public/${token}`,
        status: item.status === 'Draft' ? 'Sent' : item.status,
      }));
      return { success: true, data: { payToken: token, portalUrl: `#/invoices/public/${token}` } };
    }
  },

  writeOffInvoice: async (id: string, body: InvoiceWriteOffInput): Promise<ApiResponse<InvoiceItem>> => {
    try {
      const response = await request<InvoiceItem>(`/invoices/${encodeURIComponent(id)}/write-off`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeInvoiceRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.reason?.trim()) throw new ApiError('Write-off reason is required', 400);
      return mutateLocalInvoice(id, (item) => ({
        ...item,
        status: 'Written Off',
        writtenOffReason: body.reason.trim(),
        writtenOffAt: new Date().toISOString(),
        balanceDue: 0,
      }));
    }
  },

  archiveInvoice: async (id: string): Promise<ApiResponse<InvoiceItem>> => {
    try {
      const response = await request<InvoiceItem>(`/invoices/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return { ...response, data: normalizeInvoiceRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return mutateLocalInvoice(id, (item) => ({ ...item, isArchived: true }));
    }
  },

  restoreInvoice: async (id: string): Promise<ApiResponse<InvoiceItem>> => {
    try {
      const response = await request<InvoiceItem>(`/invoices/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return { ...response, data: normalizeInvoiceRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return mutateLocalInvoice(id, (item) => ({ ...item, isArchived: false }));
    }
  },

  cancelInvoice: async (id: string): Promise<ApiResponse<InvoiceItem>> => {
    try {
      const response = await request<InvoiceItem>(`/invoices/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return { ...response, data: normalizeInvoiceRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return mutateLocalInvoice(id, (item) => ({
        ...item,
        status: 'Cancelled',
        cancelledAt: new Date().toISOString(),
        balanceDue: 0,
      }));
    }
  },

  listInvoicePayments: async (id: string): Promise<ApiResponse<InvoicePaymentRecord[]>> => {
    try {
      return await request<InvoicePaymentRecord[]>(`/invoices/${encodeURIComponent(id)}/payments`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const payments = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS)
        .filter((payment) => payment.invoiceId === id)
        .map((payment) => ({
          _id: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          paymentDate: payment.paymentDate,
          mode: payment.mode,
          transactionId: payment.transactionId,
          paymentGateway: payment.paymentGateway,
          status: payment.status,
          remark: payment.remark,
        }));
      return { success: true, data: payments };
    }
  },

  getRazorpayStatus: async (): Promise<ApiResponse<RazorpayStatusData>> => {
    try {
      return await request<RazorpayStatusData>('/invoices/razorpay/status', { method: 'GET' });
    } catch {
      return {
        success: true,
        data: {
          configured: true,
          available: true,
          keyId: 'rzp_test_mockKeyId123',
          businessName: 'Root CRM',
          currency: getRuntimeDefaultCurrency(),
        },
      };
    }
  },

  createInvoiceRazorpayOrder: async (
    id: string,
    body: { amount?: number; currency?: string } = {}
  ): Promise<ApiResponse<RazorpayOrderData>> => {
    try {
      return await request<RazorpayOrderData>(`/invoices/${encodeURIComponent(id)}/razorpay/order`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const invoice = getLocalInvoiceOrThrow(id);
      const cur = String(body.currency || invoice.currency || getRuntimeDefaultCurrency()).toUpperCase();
      const multiplier = ['JPY', 'KRW'].includes(cur) ? 1 : 100;
      const payAmount = body.amount != null ? Number(body.amount) : Number(invoice.balanceDue ?? invoice.grandTotal);
      const amountPaise = Math.round(payAmount * multiplier);
      const orderId = `order_${Date.now()}`;
      return {
        success: true,
        data: {
          order: {
            id: orderId,
            entity: 'order',
            amount: amountPaise,
            amount_paid: 0,
            amount_due: amountPaise,
            currency: cur,
            receipt: invoice.invoiceNo,
            status: 'created',
          },
          keyId: 'rzp_test_mockKeyId123',
          amount: amountPaise,
          amountDue: payAmount,
          currency: cur,
          businessName: 'Root CRM',
          invoice: {
            id: invoice._id,
            invoiceNo: invoice.invoiceNo,
            balanceDue: invoice.balanceDue,
            currency: invoice.currency,
          },
        },
      };
    }
  },

  confirmInvoiceRazorpayPayment: async (
    id: string,
    body: RazorpayConfirmInput
  ): Promise<ApiResponse<{ invoice: InvoiceItem; message?: string }>> => {
    try {
      const response = await request<any>(`/invoices/${encodeURIComponent(id)}/razorpay/confirm`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return {
        success: true,
        message: response.message || 'Razorpay payment confirmed successfully',
        data: {
          invoice: normalizeInvoiceRecord(response.data?.invoice || response.data),
          message: response.message,
        },
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const invoice = getLocalInvoiceOrThrow(id);
      // NOTE: Intentionally do NOT save any Payment Record into PAYMENTS_STORE_KEY as requested
      const payAmount = Number(invoice.balanceDue ?? invoice.grandTotal);
      const paid = Number(invoice.amountPaid || 0) + payAmount;
      const balance = Math.max(
        0,
        Number(invoice.grandTotal || 0) - paid - Number(invoice.creditAmount || 0)
      );
      const updated = await mutateLocalInvoice(id, (item) => ({
        ...item,
        amountPaid: paid,
        balanceDue: balance,
        status: balance <= 0 ? 'Paid' : 'Partially Paid',
      }));
      return {
        success: true,
        message: 'Payment verified successfully via Razorpay. Invoice updated.',
        data: {
          invoice: updated.data,
          message: 'Payment verified successfully via Razorpay. Invoice updated.',
        },
      };
    }
  },

  createPublicInvoiceRazorpayOrder: async (
    token: string,
    body: { amount?: number; currency?: string } = {}
  ): Promise<ApiResponse<RazorpayOrderData>> => {
    try {
      return await request<RazorpayOrderData>(`/invoices/public/${encodeURIComponent(token)}/razorpay/order`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES);
      const invoice = items.find((i) => i.payToken === token);
      if (!invoice) throw new ApiError('Invoice not found', 404);
      return crmApi.createInvoiceRazorpayOrder(invoice._id, body);
    }
  },

  confirmPublicInvoiceRazorpayPayment: async (
    token: string,
    body: RazorpayConfirmInput
  ): Promise<ApiResponse<{ invoice: InvoiceItem; message?: string }>> => {
    try {
      return await request<any>(`/invoices/public/${encodeURIComponent(token)}/razorpay/confirm`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES);
      const invoice = items.find((i) => i.payToken === token);
      if (!invoice) throw new ApiError('Invoice not found', 404);
      return crmApi.confirmInvoiceRazorpayPayment(invoice._id, body);
    }
  },

  recordInvoicePayment: async (
    id: string,
    body: { amount: number; mode?: string; paymentDate?: string; transactionId?: string; remark?: string }
  ): Promise<ApiResponse<InvoiceItem>> => {
    const amount = Number(body.amount);
    if (!(amount > 0)) throw new ApiError('Payment amount must be greater than zero', 400);
    try {
      await request(`/payments`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: id,
          amount,
          mode: body.mode || 'Bank Transfer',
          paymentDate: body.paymentDate || new Date().toISOString().slice(0, 10),
          transactionId: body.transactionId,
          remark: body.remark,
        }),
      });
      const refreshed = await request<InvoiceItem>(`/invoices/${encodeURIComponent(id)}`, { method: 'GET' });
      return { ...refreshed, data: normalizeInvoiceRecord(refreshed.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const invoice = getLocalInvoiceOrThrow(id);
      const payments = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS);
      payments.unshift({
        _id: `payment_${Date.now()}`,
        paymentNumber: `PAY-${new Date().getFullYear()}-${String(payments.length + 115).padStart(3, '0')}`,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        projectId: invoice.projectId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNo,
        amount,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate || 1,
        paymentDate: body.paymentDate || new Date().toISOString().slice(0, 10),
        mode: (body.mode as 'Bank Transfer') || 'Bank Transfer',
        allocations: [{ invoiceId: invoice._id, amount }],
        transactionId: body.transactionId,
        remark: body.remark,
        status: 'Completed',
        createdAt: new Date().toISOString(),
      });
      saveLocalFinanceList(PAYMENTS_STORE_KEY, payments);
      const paid = Number(invoice.amountPaid || 0) + amount;
      const balance = Math.max(
        0,
        Number(invoice.grandTotal || 0) - paid - Number(invoice.creditAmount || 0)
      );
      return mutateLocalInvoice(id, (item) => ({
        ...item,
        amountPaid: paid,
        balanceDue: balance,
        status: balance <= 0 ? 'Paid' : 'Partially Paid',
      }));
    }
  },

  getInvoicePrintHtml: async (id: string): Promise<ApiResponse<{ html: string }>> => {
    try {
      const url = `${API_BASE}/invoices/${encodeURIComponent(id)}/print`;
      const response = await fetch(url, { credentials: 'include' });
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let message = `Failed to load print view (HTTP ${response.status})`;
        if (contentType.includes('application/json')) {
          try {
            const body = (await response.json()) as { error?: string; message?: string };
            message = body.error || body.message || message;
          } catch (error) {
            rethrowUnlessMockFallback(error);
            // ignore parse errors
          }
        }
        throw new ApiError(message, response.status);
      }

      // Backend sends raw HTML (text/html), not JSON.
      if (contentType.includes('text/html') || contentType.includes('text/plain') || !contentType.includes('json')) {
        const html = await response.text();
        if (!html.trim()) throw new ApiError('Print view returned empty content', 500);
        return { success: true, data: { html } };
      }

      const payload = (await response.json()) as ApiResponse<{ html: string }>;
      if (!payload.success || !payload.data?.html) {
        throw new ApiError(payload.error || payload.message || 'Failed to load print view', response.status);
      }
      return payload;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const invoice = getLocalInvoiceOrThrow(id);
      const lines = (invoice.lineItems || [])
        .map(
          (line) =>
            `<tr><td>${escapeHtml(line.name)}</td><td>${line.qty}</td><td>${line.rate}</td><td>${line.tax}%</td><td>${(line.qty * line.rate).toFixed(2)}</td></tr>`
        )
        .join('');
      return {
        success: true,
        data: {
          html: `<!doctype html><html><head><title>${escapeHtml(invoice.invoiceNo)}</title>
            <style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left}</style>
            </head><body>
            <h1>Invoice ${escapeHtml(invoice.invoiceNo)}</h1>
            <p><strong>Client:</strong> ${escapeHtml(invoice.clientName || '—')}</p>
            <p><strong>Issue:</strong> ${escapeHtml(invoice.issueDate)} · <strong>Due:</strong> ${escapeHtml(invoice.dueDate)}</p>
            <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>
            <p><strong>Grand Total:</strong> ${invoice.currency} ${Number(invoice.grandTotal || 0).toFixed(2)}</p>
            <p><strong>Balance Due:</strong> ${invoice.currency} ${Number(invoice.balanceDue ?? invoice.grandTotal).toFixed(2)}</p>
            </body></html>`,
        },
      };
    }
  },

  downloadInvoicePdf: async (id: string): Promise<Blob> => {
    const url = `${API_BASE}/invoices/${encodeURIComponent(id)}/pdf`;
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        let message = `Failed to download PDF (HTTP ${response.status})`;
        try {
          const body = (await response.json()) as { error?: string; message?: string };
          message = body.error || body.message || message;
        } catch (error) {
          rethrowUnlessMockFallback(error);
          // response was not JSON
        }
        throw new ApiError(message, response.status);
      }
      return await response.blob();
    } catch (error) {
      rethrowUnlessMockFallback(error);
      // Offline / unreachable API — generate a simple local HTML fallback
      const invoice = getLocalInvoiceOrThrow(id);
      const lines = (invoice.lineItems || [])
        .map(
          (line) =>
            `<tr><td>${escapeHtml(line.name)}</td><td>${line.qty}</td><td>${line.rate}</td><td>${line.tax}%</td><td>${(line.qty * line.rate).toFixed(2)}</td></tr>`
        )
        .join('');
      const html = `<!doctype html><html><head><title>${escapeHtml(invoice.invoiceNo)}</title></head><body>
        <h1>Invoice ${escapeHtml(invoice.invoiceNo)}</h1>
        <p>${escapeHtml(invoice.clientName || '—')}</p>
        <p>Total: ${invoice.currency} ${Number(invoice.grandTotal || 0).toFixed(2)}</p>
        <table>${lines}</table>
      </body></html>`;
      return new Blob([html], { type: 'text/html' });
    }
  },

  exportInvoices: async (
    params: InvoiceExportParams = {}
  ): Promise<ApiResponse<{ format: string; content: string; filename: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value != null && value !== '' && query.set(key, String(value)));
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/invoices/export${query.size ? `?${query}` : ''}`,
        'invoices_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let rows = getLocalFinanceList(INVOICES_STORE_KEY, INITIAL_FINANCE_INVOICES).map(normalizeInvoiceRecord);
      if (params.search) {
        const term = params.search.toLowerCase();
        rows = rows.filter((item) =>
          [item.invoiceNo, item.clientName].some((value) => value?.toLowerCase().includes(term))
        );
      }
      if (params.status) rows = rows.filter((item) => item.status === params.status);
      const archived = params.archived === true || params.archived === 'true';
      if (archived) rows = rows.filter((item) => item.isArchived);
      else rows = rows.filter((item) => !item.isArchived);
      const format = params.format || 'csv';
      if (format === 'json') {
        return {
          success: true,
          data: {
            format: 'json',
            content: JSON.stringify(rows, null, 2),
            filename: `invoices-export-${Date.now()}.json`,
          },
        };
      }
      const header = 'Invoice No,Client,Issue Date,Due Date,Status,Currency,Grand Total,Amount Paid,Balance Due';
      const body = rows
        .map((item) =>
          [
            item.invoiceNo,
            item.clientName || item.clientId,
            item.issueDate,
            item.dueDate,
            item.status,
            item.currency,
            item.grandTotal,
            item.amountPaid || 0,
            item.balanceDue ?? item.grandTotal,
          ]
            .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');
      return {
        success: true,
        data: {
          format: 'csv',
          content: `${header}\n${body}`,
          filename: `invoices-export-${Date.now()}.csv`,
        },
      };
    }
  },

  listRecurringInvoices: async (
    params: RecurringInvoiceQueryParams = {}
  ): Promise<ApiResponse<RecurringInvoiceItem[]>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      return await request<RecurringInvoiceItem[]>(
        query.size ? `/recurring-invoices?${query}` : '/recurring-invoices',
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: [] };
    }
  },

  getRecurringInvoice: async (id: string): Promise<ApiResponse<RecurringInvoiceItem>> => {
    return request<RecurringInvoiceItem>(`/recurring-invoices/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  },

  createRecurringInvoice: async (
    body: RecurringInvoiceCreateInput
  ): Promise<ApiResponse<RecurringInvoiceItem>> => {
    return request<RecurringInvoiceItem>('/recurring-invoices', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateRecurringInvoice: async (
    id: string,
    body: Partial<RecurringInvoiceCreateInput>
  ): Promise<ApiResponse<RecurringInvoiceItem>> => {
    return request<RecurringInvoiceItem>(`/recurring-invoices/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  deleteRecurringInvoice: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    return request<{ deleted: boolean }>(`/recurring-invoices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  toggleRecurringInvoiceStatus: async (
    id: string,
    status?: 'Active' | 'Paused'
  ): Promise<ApiResponse<RecurringInvoiceItem>> => {
    return request<RecurringInvoiceItem>(
      `/recurring-invoices/${encodeURIComponent(id)}/toggle-status`,
      { method: 'POST', body: JSON.stringify(status ? { status } : {}) }
    );
  },

  runRecurringInvoiceNow: async (
    id: string
  ): Promise<ApiResponse<{ invoice?: InvoiceItem; profile?: RecurringInvoiceItem } & RecurringInvoiceItem>> => {
    return request(`/recurring-invoices/${encodeURIComponent(id)}/run-now`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  runDueRecurringInvoices: async (): Promise<ApiResponse<{ generated: number; message?: string }>> => {
    return request<{ generated: number; message?: string }>('/recurring-invoices/run-due', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  getUpcomingRecurringInvoicesReport: async (
    params: { daysAhead?: number } = {}
  ): Promise<ApiResponse<RecurringInvoiceUpcomingReport>> => {
    const query = new URLSearchParams();
    if (params.daysAhead) query.set('daysAhead', String(params.daysAhead));
    return request<RecurringInvoiceUpcomingReport>(
      query.size
        ? `/recurring-invoices/upcoming-report?${query}`
        : '/recurring-invoices/upcoming-report',
      { method: 'GET' }
    );
  },

  listInvoiceTemplates: async (
    params: InvoiceTemplateQueryParams = {}
  ): Promise<ApiResponse<InvoiceTemplateItem[]>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value != null && value !== '' && query.set(key, String(value)));
    try {
      return await request<InvoiceTemplateItem[]>(
        `/invoice-templates${query.size ? `?${query}` : ''}`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalFinanceList(INVOICE_TEMPLATES_STORE_KEY, INITIAL_MOCK_INVOICE_TEMPLATES);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.name, item.category, item.description].some((value) => value?.toLowerCase().includes(term))
        );
      }
      if (params.category) items = items.filter((item) => item.category === params.category);
      return { success: true, data: items };
    }
  },

  getInvoiceTemplate: async (id: string): Promise<ApiResponse<InvoiceTemplateItem>> => {
    try {
      return await request<InvoiceTemplateItem>(`/invoice-templates/${encodeURIComponent(id)}`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const item = getLocalFinanceList(INVOICE_TEMPLATES_STORE_KEY, INITIAL_MOCK_INVOICE_TEMPLATES).find(
        (entry) => entry._id === id
      );
      if (!item) throw new ApiError('Invoice template not found', 404);
      return { success: true, data: item };
    }
  },

  createInvoiceTemplate: async (
    body: InvoiceTemplateCreateInput
  ): Promise<ApiResponse<InvoiceTemplateItem>> => {
    try {
      return await request<InvoiceTemplateItem>('/invoice-templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.name?.trim() || !body.lineItems?.length) {
        throw new ApiError('Template name and line items are required', 400);
      }
      const items = getLocalFinanceList(INVOICE_TEMPLATES_STORE_KEY, INITIAL_MOCK_INVOICE_TEMPLATES);
      const created: InvoiceTemplateItem = {
        ...body,
        _id: `invtpl_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      if (created.isDefault) {
        items.forEach((item) => {
          item.isDefault = false;
        });
      }
      items.unshift(created);
      saveLocalFinanceList(INVOICE_TEMPLATES_STORE_KEY, items);
      return { success: true, data: created, message: 'Template created' };
    }
  },

  updateInvoiceTemplate: async (
    id: string,
    body: Partial<InvoiceTemplateCreateInput>
  ): Promise<ApiResponse<InvoiceTemplateItem>> => {
    try {
      return await request<InvoiceTemplateItem>(`/invoice-templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(INVOICE_TEMPLATES_STORE_KEY, INITIAL_MOCK_INVOICE_TEMPLATES);
      const index = items.findIndex((entry) => entry._id === id);
      if (index < 0) throw new ApiError('Invoice template not found', 404);
      if (body.isDefault) {
        items.forEach((item) => {
          item.isDefault = false;
        });
      }
      items[index] = { ...items[index], ...body, updatedAt: new Date().toISOString() };
      saveLocalFinanceList(INVOICE_TEMPLATES_STORE_KEY, items);
      return { success: true, data: items[index] };
    }
  },

  deleteInvoiceTemplate: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/invoice-templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(INVOICE_TEMPLATES_STORE_KEY, INITIAL_MOCK_INVOICE_TEMPLATES);
      saveLocalFinanceList(
        INVOICE_TEMPLATES_STORE_KEY,
        items.filter((entry) => entry._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  saveInvoiceAsTemplate: async (
    id: string,
    body: { name: string; category?: string } = { name: '' }
  ): Promise<ApiResponse<InvoiceTemplateItem>> => {
    try {
      return await request<InvoiceTemplateItem>(`/invoices/${encodeURIComponent(id)}/save-as-template`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const invoice = getLocalInvoiceOrThrow(id);
      return crmApi.createInvoiceTemplate({
        name: body.name || `${invoice.invoiceNo} Template`,
        category: body.category || 'General',
        description: `Saved from ${invoice.invoiceNo}`,
        currency: invoice.currency,
        paymentTermsDays: 30,
        taxCalculation: invoice.taxCalculation,
        shippingCharge: invoice.shippingCharge || 0,
        recipientNotes: invoice.notes || '',
        terms: invoice.terms || '',
        paymentDetails: invoice.paymentDetails || '',
        isDefault: false,
        discountType: invoice.discountType,
        discountValue: invoice.discountValue,
        lineItems: invoice.lineItems,
      });
    }
  },

  listUnbilledBillableExpenses: async (params: {
    clientId?: string;
    projectId?: string;
  } = {}): Promise<ApiResponse<ExpenseItem[]>> => {
    const query = new URLSearchParams();
    if (params.clientId) query.set('clientId', params.clientId);
    if (params.projectId) query.set('projectId', params.projectId);
    try {
      return await request<ExpenseItem[]>(
        `/expenses/unbilled-billable${query.size ? `?${query}` : ''}`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const data = getLocalExpenses().filter(
        (item) =>
          !item.isDeleted &&
          !item.isArchived &&
          Boolean(item.isBillable) &&
          !item.isBilled &&
          item.status === 'Approved' &&
          (!params.clientId || item.clientId === params.clientId) &&
          (!params.projectId || item.projectId === params.projectId)
      );
      return { success: true, data };
    }
  },

  markExpensesBilled: async (body: {
    expenseIds: string[];
    invoiceId: string;
    invoiceNo?: string;
  }): Promise<ApiResponse<{ updated: number }>> => {
    try {
      return await request<{ updated: number }>('/expenses/mark-billed', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalExpenses();
      let updated = 0;
      const now = new Date().toISOString();
      body.expenseIds.forEach((id) => {
        const index = list.findIndex((item) => item._id === id);
        if (index < 0) return;
        if (list[index].isBilled) return;
        list[index] = {
          ...list[index],
          isBilled: true,
          billedInvoiceId: body.invoiceId,
          billedInvoiceNo: body.invoiceNo || '',
          billedAt: now,
          updatedAt: now,
        };
        updated += 1;
      });
      saveLocalExpenses(list);
      return { success: true, data: { updated } };
    }
  },

  listCatalogProducts: async (
    params: { search?: string; page?: number; limit?: number } = {}
  ): Promise<ApiResponse<Array<{ _id: string; name: string; description?: string; unitPrice: number; taxRate: number }>>> => {
    const query = new URLSearchParams();
    applyListPaginationParams(query, params, 100);
    if (params.search) query.set('search', params.search);
    try {
      return await request(`/products?${query}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: [
          {
            _id: 'prod_1',
            name: 'Full-Stack Web Development',
            description: 'Milestone-based delivery',
            unitPrice: 150000,
            taxRate: 18,
          },
          {
            _id: 'prod_2',
            name: 'Monthly Retainer',
            description: 'Ongoing support hours',
            unitPrice: 75000,
            taxRate: 18,
          },
          {
            _id: 'prod_3',
            name: 'Consulting Day',
            description: 'On-site / remote consulting',
            unitPrice: 25000,
            taxRate: 18,
          },
        ].filter((item) =>
          !params.search
            ? true
            : [item.name, item.description].some((value) =>
                value?.toLowerCase().includes(params.search!.toLowerCase())
              )
        ),
      };
    }
  },

  listPayments: async (
    params: PaymentQueryParams = {}
  ): Promise<ApiResponse<PaymentItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit') return;
      if (value != null && value !== '') query.set(key, String(value));
    });
    try {
      const response = await request<PaymentItem[]>(`/payments?${query}`, { method: 'GET' });
      return {
        ...response,
        data: (response.data || []).map(normalizePaymentRecord),
        pagination: fallbackPagination(page, limit, response.data?.length || 0, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS).map(normalizePaymentRecord);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.paymentNumber, item.paymentNo, item.receiptNumber, item.clientName, item.transactionId, item.invoiceNumber]
            .some((value) => value?.toLowerCase().includes(term))
        );
      }
      if (params.status) items = items.filter((item) => item.status === params.status);
      if (params.mode) {
        const wanted = String(params.mode).toLowerCase();
        items = items.filter(
          (item) =>
            String(item.mode || '').toLowerCase() === wanted ||
            String((item as { paymentMode?: string }).paymentMode || '').toLowerCase() === wanted
        );
      }
      if (params.clientId) items = items.filter((item) => item.clientId === params.clientId);
      if (params.invoiceId) {
        items = items.filter(
          (item) =>
            item.invoiceId === params.invoiceId ||
            item.allocations?.some((alloc) => alloc.invoiceId === params.invoiceId)
        );
      }
      const paged = paginateLocalItems(items, page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  getPayment: async (id: string): Promise<ApiResponse<PaymentItem>> => {
    try {
      const response = await request<PaymentItem>(`/payments/${encodeURIComponent(id)}`, { method: 'GET' });
      return { ...response, data: normalizePaymentRecord(response.data) };
    } catch {
      const item = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS).find((entry) => entry._id === id);
      if (!item) throw new ApiError('Payment not found', 404);
      return { success: true, data: normalizePaymentRecord(item) };
    }
  },

  createPayment: async (body: PaymentCreateInput): Promise<ApiResponse<PaymentItem>> => {
    const payload = { ...body, receipt: body.receiptUrl };
    try {
      const response = await request<any>('/payments', { method: 'POST', body: JSON.stringify(payload) });
      const raw = response.data;
      // Multi-invoice create may return { split: true, payments: [...] }
      if (raw && raw.split && Array.isArray(raw.payments) && raw.payments.length) {
        return {
          ...response,
          data: normalizePaymentRecord(raw.payments[0]),
          message: response.message || `Recorded ${raw.payments.length} payment allocations`,
        };
      }
      return { ...response, data: normalizePaymentRecord(raw) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.clientId || body.amount <= 0) throw new ApiError('Client and a positive amount are required', 400);
      const allocations = resolvePaymentAllocations(body);
      const allocatedTotal = allocations.reduce((sum, row) => sum + row.amount, 0);
      if (allocatedTotal > Number(body.amount) + 0.0001) {
        throw new ApiError('Total allocation cannot exceed the payment amount', 400);
      }
      const items = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS);
      const created = normalizePaymentRecord({
        ...body,
        _id: `payment_${Date.now()}`,
        paymentNumber: `PAY-${new Date().getFullYear()}-${String(items.length + 115).padStart(3, '0')}`,
        receiptNumber: `RCP-${new Date().getFullYear()}-${String(items.length + 115).padStart(3, '0')}`,
        invoiceId: allocations[0]?.invoiceId || body.invoiceId,
        invoiceNumber: allocations[0]?.invoiceNumber,
        allocations,
        receipt: body.receiptUrl,
        status: 'Completed',
        refundStatus: 'None',
        refundedAmount: 0,
        refunds: [],
        createdAt: new Date().toISOString(),
      });
      applyLocalPaymentAllocations(allocations, 1);
      items.unshift(created);
      saveLocalFinanceList(PAYMENTS_STORE_KEY, items);
      return { success: true, data: created, message: 'Payment recorded' };
    }
  },

  updatePayment: async (
    id: string,
    body: Partial<PaymentCreateInput> & { status?: string }
  ): Promise<ApiResponse<PaymentItem>> => {
    try {
      const response = await request<PaymentItem>(`/payments/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizePaymentRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS);
      const index = items.findIndex((entry) => entry._id === id);
      if (index < 0) throw new ApiError('Payment not found', 404);
      const previous = normalizePaymentRecord(items[index]);
      if (body.amount != null && Number(body.amount) !== Number(previous.amount)) {
        const delta = Number(body.amount) - Number(previous.amount);
        const targets =
          previous.allocations?.length
            ? previous.allocations
            : previous.invoiceId
              ? [{ invoiceId: previous.invoiceId, amount: previous.amount }]
              : [];
        if (targets.length === 1) {
          syncLocalInvoicePaymentDelta(targets[0].invoiceId, delta);
        } else if (targets.length > 1 && delta !== 0) {
          // Proportional adjust across allocations
          const total = targets.reduce((sum, row) => sum + Number(row.amount || 0), 0) || 1;
          for (const row of targets) {
            const share = (Number(row.amount || 0) / total) * delta;
            syncLocalInvoicePaymentDelta(row.invoiceId, share);
          }
        }
      }
      items[index] = normalizePaymentRecord({
        ...previous,
        ...body,
        receipt: body.receiptUrl ?? previous.receipt,
        updatedAt: new Date().toISOString(),
      });
      saveLocalFinanceList(PAYMENTS_STORE_KEY, items);
      return { success: true, data: items[index] };
    }
  },

  deletePayment: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/payments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS);
      const current = items.find((entry) => entry._id === id);
      if (!current) throw new ApiError('Payment not found', 404);
      const payment = normalizePaymentRecord(current);
      const net =
        Number(payment.amount || 0) - Number(payment.refundedAmount || 0);
      const targets =
        payment.allocations?.length
          ? payment.allocations
          : payment.invoiceId
            ? [{ invoiceId: payment.invoiceId, amount: net }]
            : [];
      if (targets.length) {
        const total = targets.reduce((sum, row) => sum + Number(row.amount || 0), 0) || 1;
        for (const row of targets) {
          const share = (Number(row.amount || 0) / total) * net;
          syncLocalInvoicePaymentDelta(row.invoiceId, -share);
        }
      }
      saveLocalFinanceList(
        PAYMENTS_STORE_KEY,
        items.filter((entry) => entry._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  exportPayments: async (
    params: PaymentExportParams = {}
  ): Promise<ApiResponse<{ format: string; content: string; filename: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value != null && value !== '' && query.set(key, String(value)));
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/payments/export${query.size ? `?${query}` : ''}`,
        'payments_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = await crmApi.listPayments(params);
      const rows = list.data || [];
      const format = params.format || 'csv';
      if (format === 'json') {
        return {
          success: true,
          data: {
            format: 'json',
            content: JSON.stringify(rows, null, 2),
            filename: `payments-export-${Date.now()}.json`,
          },
        };
      }
      const header =
        'Payment Number,Receipt Number,Invoice Number,Client Name,Amount,Currency,Mode,Transaction ID,Payment Date,Status,Notes';
      const body = rows
        .map((item) =>
          [
            item.paymentNumber || item.paymentNo || '',
            item.receiptNumber || '',
            item.invoiceNumber || '',
            item.clientName || item.clientId,
            item.amount,
            item.currency,
            item.mode,
            item.transactionId || '',
            item.paymentDate,
            item.status,
            item.remark || '',
          ]
            .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');
      return {
        success: true,
        data: {
          format: 'csv',
          content: `${header}\n${body}`,
          filename: `payments-export-${Date.now()}.csv`,
        },
      };
    }
  },

  listPaymentRefunds: async (params: {
    status?: string;
    search?: string;
  } = {}): Promise<ApiResponse<RefundListItem[]>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value != null && value !== '' && query.set(key, String(value)));
    try {
      return await request<RefundListItem[]>(
        `/payments/refunds${query.size ? `?${query}` : ''}`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const payments = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS).map(normalizePaymentRecord);
      let rows: RefundListItem[] = [];
      for (const payment of payments) {
        for (const refund of payment.refunds || []) {
          rows.push({
            ...refund,
            paymentId: payment._id,
            paymentNumber: payment.paymentNumber,
            clientId: payment.clientId,
            clientName: payment.clientName,
            paymentAmount: payment.amount,
            currency: payment.currency,
          });
        }
      }
      if (params.status) rows = rows.filter((row) => row.status === params.status);
      if (params.search) {
        const term = params.search.toLowerCase();
        rows = rows.filter((row) =>
          [row.paymentNumber, row.clientName, row.reason, row.transactionId].some((value) =>
            value?.toLowerCase().includes(term)
          )
        );
      }
      return { success: true, data: rows };
    }
  },

  getPaymentRefunds: async (id: string): Promise<ApiResponse<NonNullable<PaymentItem['refunds']>>> => {
    try {
      return await request(`/payments/${encodeURIComponent(id)}/refunds`, { method: 'GET' });
    } catch {
      const item = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS).find((entry) => entry._id === id);
      if (!item) throw new ApiError('Payment not found', 404);
      return { success: true, data: normalizePaymentRecord(item).refunds || [] };
    }
  },

  requestPaymentRefund: async (
    id: string,
    body: RefundRequestInput
  ): Promise<ApiResponse<PaymentItem>> => {
    try {
      const response = await request<PaymentItem>(`/payments/${encodeURIComponent(id)}/refunds`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizePaymentRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!(Number(body.amount) > 0) || !body.reason?.trim() || !body.mode) {
        throw new ApiError('Refund amount, mode, and reason are required', 400);
      }
      const items = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS);
      const index = items.findIndex((entry) => entry._id === id);
      if (index < 0) throw new ApiError('Payment not found', 404);
      const payment = normalizePaymentRecord(items[index]);
      const maxRefundable = Number(payment.amount) - Number(payment.refundedAmount || 0);
      if (Number(body.amount) > maxRefundable + 0.0001) {
        throw new ApiError('Refund amount exceeds refundable balance', 400);
      }
      const refund = {
        _id: `refund_${Date.now()}`,
        amount: Number(body.amount),
        mode: body.mode,
        transactionId: body.transactionId,
        reason: body.reason.trim(),
        status: body.autoApprove ? 'Approved' : 'Pending Approval',
        requestedAt: new Date().toISOString(),
        approvedAt: body.autoApprove ? new Date().toISOString() : undefined,
      };
      const refunds = [...(payment.refunds || []), refund];
      if (body.autoApprove) {
        const targets =
          payment.allocations?.length
            ? payment.allocations
            : payment.invoiceId
              ? [{ invoiceId: payment.invoiceId, amount: payment.amount }]
              : [];
        const total = targets.reduce((sum, row) => sum + Number(row.amount || 0), 0) || 1;
        for (const row of targets) {
          const share = (Number(row.amount || 0) / total) * Number(body.amount);
          syncLocalInvoicePaymentDelta(row.invoiceId, -share);
        }
      }
      items[index] = normalizePaymentRecord({
        ...payment,
        refunds,
        refundedAmount: body.autoApprove
          ? Number(payment.refundedAmount || 0) + Number(body.amount)
          : payment.refundedAmount || 0,
        updatedAt: new Date().toISOString(),
      });
      saveLocalFinanceList(PAYMENTS_STORE_KEY, items);
      return { success: true, data: items[index] };
    }
  },

  approvePaymentRefund: async (id: string, refundId: string): Promise<ApiResponse<PaymentItem>> => {
    try {
      const response = await request<PaymentItem>(
        `/payments/${encodeURIComponent(id)}/refunds/${encodeURIComponent(refundId)}/approve`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      return { ...response, data: normalizePaymentRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS);
      const index = items.findIndex((entry) => entry._id === id);
      if (index < 0) throw new ApiError('Payment not found', 404);
      const payment = normalizePaymentRecord(items[index]);
      const refunds = [...(payment.refunds || [])];
      const refundIndex = refunds.findIndex((entry) => entry._id === refundId);
      if (refundIndex < 0) throw new ApiError('Refund not found', 404);
      if (refunds[refundIndex].status !== 'Pending Approval') {
        throw new ApiError('Only pending refunds can be approved', 400);
      }
      refunds[refundIndex] = {
        ...refunds[refundIndex],
        status: 'Approved',
        approvedAt: new Date().toISOString(),
      };
      const amount = Number(refunds[refundIndex].amount || 0);
      const targets =
        payment.allocations?.length
          ? payment.allocations
          : payment.invoiceId
            ? [{ invoiceId: payment.invoiceId, amount: payment.amount }]
            : [];
      const total = targets.reduce((sum, row) => sum + Number(row.amount || 0), 0) || 1;
      for (const row of targets) {
        const share = (Number(row.amount || 0) / total) * amount;
        syncLocalInvoicePaymentDelta(row.invoiceId, -share);
      }
      items[index] = normalizePaymentRecord({
        ...payment,
        refunds,
        refundedAmount: Number(payment.refundedAmount || 0) + amount,
        updatedAt: new Date().toISOString(),
      });
      saveLocalFinanceList(PAYMENTS_STORE_KEY, items);
      return { success: true, data: items[index] };
    }
  },

  rejectPaymentRefund: async (
    id: string,
    refundId: string,
    body: RefundRejectInput
  ): Promise<ApiResponse<PaymentItem>> => {
    try {
      const response = await request<PaymentItem>(
        `/payments/${encodeURIComponent(id)}/refunds/${encodeURIComponent(refundId)}/reject`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      return { ...response, data: normalizePaymentRecord(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.reason?.trim()) throw new ApiError('Rejection reason is required', 400);
      const items = getLocalFinanceList(PAYMENTS_STORE_KEY, INITIAL_FINANCE_PAYMENTS);
      const index = items.findIndex((entry) => entry._id === id);
      if (index < 0) throw new ApiError('Payment not found', 404);
      const payment = normalizePaymentRecord(items[index]);
      const refunds = [...(payment.refunds || [])];
      const refundIndex = refunds.findIndex((entry) => entry._id === refundId);
      if (refundIndex < 0) throw new ApiError('Refund not found', 404);
      refunds[refundIndex] = {
        ...refunds[refundIndex],
        status: 'Rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: body.reason.trim(),
      };
      items[index] = normalizePaymentRecord({
        ...payment,
        refunds,
        updatedAt: new Date().toISOString(),
      });
      saveLocalFinanceList(PAYMENTS_STORE_KEY, items);
      return { success: true, data: items[index] };
    }
  },

  listSalesOrders: async (
    params: SalesOrderQueryParams = {}
  ): Promise<ApiResponse<SalesOrderItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit') return;
      if (value != null && value !== '') query.set(key, String(value));
    });
    try {
      const response = await request<SalesOrderItem[]>(`/sales-orders?${query}`, { method: 'GET' });
      return {
        ...response,
        pagination: fallbackPagination(page, limit, response.data?.length || 0, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalSalesOrders().filter((item) => !item.isDeleted);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.orderNumber, item.clientName, item.notes, item.trackingNumber].some((value) =>
            value?.toLowerCase().includes(term)
          )
        );
      }
      if (params.status) {
        if (params.status === 'Processing') {
          items = items.filter((item) =>
            ['Processing', 'Partially Shipped', 'Shipped'].includes(item.status)
          );
        } else {
          items = items.filter((item) => item.status === params.status);
        }
      }
      if (params.deliveryStatus) {
        items = items.filter((item) => item.deliveryStatus === params.deliveryStatus);
      }
      if (params.clientId) items = items.filter((item) => item.clientId === params.clientId);
      const paged = paginateLocalItems(items, page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  getSalesOrder: async (id: string): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>(`/sales-orders/${encodeURIComponent(id)}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const item = getLocalSalesOrders().find((entry) => entry._id === id && !entry.isDeleted);
      if (!item) throw new ApiError('Sales order not found', 404);
      const opportunityId = String(item.opportunityId || '').trim();
      if (!opportunityId) return { success: true, data: item };
      const opp = getLocalOpportunities().find((entry) => entry._id === opportunityId && !entry.isDeleted);
      return {
        success: true,
        data: {
          ...item,
          opportunityTitle: opp?.title || item.opportunityTitle || null,
          opportunityStage: opp?.stage || item.opportunityStage || null,
          opportunityStageType: opp?.stageType || item.opportunityStageType || null,
          opportunityExpectedRevenue:
            opp?.expectedRevenue != null
              ? Number(opp.expectedRevenue)
              : item.opportunityExpectedRevenue ?? null,
          opportunityCurrency: opp?.currency || item.opportunityCurrency || null,
        },
      };
    }
  },

  createSalesOrder: async (body: SalesOrderCreateInput): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>('/sales-orders', { method: 'POST', body: JSON.stringify(body) });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.clientId || !(body.lineItems || []).length) {
        throw new ApiError('Client and line items are required', 400);
      }
      if (!body.generatedBy?.trim()) throw new ApiError('Generated by source is required', 400);
      if (!body.shippingState?.trim()) throw new ApiError('Destination shipping state is required', 400);
      const items = getLocalSalesOrders();
      const client = getLocalClients().find((entry) => entry._id === body.clientId);
      const project = body.projectId
        ? getLocalProjects().find((entry) => entry._id === body.projectId)
        : undefined;
      const discountType = body.discountType === 'amount' ? 'amount' : 'percent';
      const discountValue = Number(body.discountValue ?? body.discount ?? 0);
      const lineItems = body.lineItems.map((line) => ({
        ...line,
        description: line.description.trim(),
        qty: Number(line.qty),
        rate: Number(line.rate),
        tax: Number(line.tax ?? 18),
        amount: Number(line.qty) * Number(line.rate),
        shippedQty: 0,
        returnedQty: 0,
      }));
      if (lineItems.some((line) => !line.description || !(line.qty > 0) || line.rate < 0)) {
        throw new ApiError('Each line item needs description, qty > 0, and non-negative rate', 400);
      }
      const created = normalizeSalesOrder({
        ...body,
        _id: `sales_order_${Date.now()}`,
        orderNumber: body.orderNumber?.trim() || nextSalesOrderNumber(items),
        clientName: client?.name || body.clientId,
        projectName: project?.name,
        discountType,
        discountValue,
        lineItems,
        deliveryStatus: 'Pending Allocation',
        shipments: [],
        returns: [],
        stockAudit: [],
        createdAt: new Date().toISOString(),
      });
      items.unshift(created);
      saveLocalSalesOrders(items);
      return { success: true, data: created, message: 'Sales order created' };
    }
  },

  updateSalesOrderStatus: async (
    id: string,
    body: { status: SalesOrderStatus }
  ): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>(`/sales-orders/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      items[index] = {
        ...items[index],
        status: body.status,
        updatedAt: new Date().toISOString(),
      };
      saveLocalSalesOrders(items);
      return { success: true, data: items[index] };
    }
  },

  deleteSalesOrder: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/sales-orders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      if (items[index].status !== 'Draft') {
        throw new ApiError('Only draft sales orders can be deleted', 400);
      }
      items[index] = { ...items[index], isDeleted: true, updatedAt: new Date().toISOString() };
      saveLocalSalesOrders(items);
      return { success: true, data: { deleted: true } };
    }
  },

  reserveSalesOrderStock: async (id: string): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>(`/sales-orders/${encodeURIComponent(id)}/reserve-stock`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      const order = items[index];
      if (['Cancelled', 'Completed'].includes(order.status)) {
        throw new ApiError('Cannot reserve stock for this order status', 400);
      }
      const now = new Date().toISOString();
      items[index] = recomputeSalesOrderFulfillment({
        ...order,
        stockReserved: true,
        stockReservedAt: now,
        deliveryStatus: order.deliveryStatus === 'Pending Allocation' ? 'Allocated' : order.deliveryStatus,
        stockAudit: [
          {
            action: 'reserve',
            performedAt: now,
            performedBy: 'Warehouse',
            performedByName: 'Warehouse',
            details: `Reserved ${order.lineItems.reduce((sum, line) => sum + line.qty, 0)} units`,
          },
          ...(order.stockAudit || []),
        ],
        updatedAt: now,
      });
      saveLocalSalesOrders(items);
      return { success: true, data: items[index] };
    }
  },

  notifySalesOrderCustomer: async (
    id: string,
    body: { focus?: 'order' | 'rma'; returnId?: string } = {}
  ): Promise<ApiResponse<{ sent: boolean; email?: string; subject?: string; reason?: string }>> => {
    return request(`/sales-orders/${encodeURIComponent(id)}/notify-customer`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  addSalesOrderShipment: async (
    id: string,
    body: SalesOrderShipmentInput
  ): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>(`/sales-orders/${encodeURIComponent(id)}/shipments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.courierName?.trim() || !body.trackingNumber?.trim()) {
        throw new ApiError('Courier and tracking number are required', 400);
      }
      if (!body.items?.length) throw new ApiError('Select at least one item to ship', 400);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      const order = items[index];
      if (['Cancelled', 'Draft'].includes(order.status)) {
        throw new ApiError('Cannot dispatch shipments for this order status', 400);
      }
      const lineItems = [...(order.lineItems || [])];
      const shippedItems = body.items.map((entry) => {
        const line = lineItems[entry.lineItemIndex];
        if (!line) throw new ApiError('Invalid line item selection', 400);
        const remaining = remainingShipQty(line);
        const qty = Number(entry.qty);
        if (!(qty > 0) || qty > remaining) {
          throw new ApiError(`Invalid ship qty for ${line.description}`, 400);
        }
        line.shippedQty = Number(line.shippedQty || 0) + qty;
        return {
          lineItemIndex: entry.lineItemIndex,
          description: line.description,
          qty,
          productId: line.productId || null,
        };
      });
      const now = new Date().toISOString();
      const shipmentNumber = `SHP-${(order.shipments || []).length + 1}`;
      const shipment = {
        _id: `ship_${Date.now()}`,
        shipmentNumber,
        courierName: body.courierName.trim(),
        trackingNumber: body.trackingNumber.trim(),
        shippingState: order.shippingState,
        weightKg: Number(body.weightKg || 1),
        shippedItems,
        dispatchedAt: now,
        deliveredAt: null,
        deliveryStatus: 'Dispatched' as const,
        notes: body.notes || '',
        createdBy: 'system',
      };
      let next: SalesOrderItem = {
        ...order,
        lineItems,
        shipments: [...(order.shipments || []), shipment],
        courierName: body.courierName.trim(),
        trackingNumber: body.trackingNumber.trim(),
        dispatchedAt: order.dispatchedAt || now,
        inventoryDeducted: true,
        inventoryDeductedAt: order.inventoryDeductedAt || now,
        stockAudit: order.inventoryDeducted
          ? order.stockAudit || []
          : [
              {
                action: 'deduct',
                performedAt: now,
                performedBy: 'Warehouse',
                details: `Inventory deducted on ${shipmentNumber}`,
              },
              ...(order.stockAudit || []),
            ],
        updatedAt: now,
      };
      next = recomputeSalesOrderFulfillment(next);
      items[index] = next;
      saveLocalSalesOrders(items);
      return { success: true, data: items[index] };
    }
  },

  confirmSalesOrderDelivery: async (
    id: string,
    body: SalesOrderDeliveryConfirmInput
  ): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>(`/sales-orders/${encodeURIComponent(id)}/delivery-confirm`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.proofOfDelivery?.trim()) throw new ApiError('Proof of delivery is required', 400);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      const order = items[index];
      const shipments = [...(order.shipments || [])];
      const shipIndex = shipments.findIndex((shipment) => shipment._id === body.shipmentId);
      if (shipIndex < 0) throw new ApiError('Shipment not found', 404);
      const now = new Date().toISOString();
      shipments[shipIndex] = {
        ...shipments[shipIndex],
        deliveryStatus: 'Delivered',
        deliveredAt: now,
        proofOfDelivery: body.proofOfDelivery.trim(),
      };
      let next: SalesOrderItem = {
        ...order,
        shipments,
        proofOfDelivery: body.proofOfDelivery.trim(),
        updatedAt: now,
      };
      next = recomputeSalesOrderFulfillment(next);
      items[index] = next;
      saveLocalSalesOrders(items);
      return { success: true, data: items[index] };
    }
  },

  createSalesOrderReturn: async (
    id: string,
    body: SalesOrderReturnInput
  ): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>(`/sales-orders/${encodeURIComponent(id)}/returns`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.reason?.trim() || !body.reasonCategory?.trim()) {
        throw new ApiError('RMA reason and category are required', 400);
      }
      if (!body.returnedItems?.length) throw new ApiError('Select at least one returned item', 400);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      const order = items[index];
      const lineItems = [...(order.lineItems || [])];
      const returnedItems = body.returnedItems.map((entry) => {
        const qty = Number(entry.qty);
        if (!(qty > 0)) throw new ApiError('Return qty must be greater than zero', 400);
        const match =
          lineItems.find(
            (line) =>
              (entry.productId && line.productId && String(line.productId) === String(entry.productId)) ||
              String(line.description || '').trim() === String(entry.description || '').trim()
          ) || null;
        if (match) {
          const remaining = Math.max(0, Number(match.shippedQty || 0) - Number(match.returnedQty || 0));
          if (qty > remaining) {
            throw new ApiError(`Invalid return qty for ${match.description}`, 400);
          }
          match.returnedQty = Number(match.returnedQty || 0) + qty;
        }
        return {
          description: String(entry.description || '').trim(),
          qty,
          unitRate: Number(entry.unitRate ?? match?.rate ?? 0),
          reason: entry.reason || body.reasonCategory,
          productId: entry.productId || match?.productId || null,
        };
      });
      const rmaCount = (order.returns || []).length + 1;
      const rma = {
        _id: `rma_${Date.now()}`,
        rmaNumber: `${order.orderNumber}-RMA${rmaCount}`,
        type: body.type || 'Return',
        status: 'Requested' as const,
        returnedItems,
        reason: body.reason.trim(),
        reasonCategory: body.reasonCategory,
        refundAmount: Number(body.refundAmount || 0),
        replacementOrderId: null,
        requestedAt: new Date().toISOString(),
        resolvedAt: null,
        notes: body.notes || '',
        createdBy: 'system',
      };
      items[index] = {
        ...order,
        lineItems,
        returns: [...(order.returns || []), rma],
        status: order.status === 'Completed' ? 'Returned' : order.status,
        updatedAt: new Date().toISOString(),
      };
      saveLocalSalesOrders(items);
      return { success: true, data: items[index] };
    }
  },

  updateSalesOrderReturnStatus: async (
    id: string,
    returnId: string,
    body: { status: string }
  ): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>(
        `/sales-orders/${encodeURIComponent(id)}/returns/${encodeURIComponent(returnId)}`,
        { method: 'PATCH', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      const order = items[index];
      const returns = [...(order.returns || [])];
      const rmaIndex = returns.findIndex((entry) => entry._id === returnId);
      if (rmaIndex < 0) throw new ApiError('RMA not found', 404);
      const rma = { ...returns[rmaIndex], status: body.status as typeof returns[number]['status'] };
      if (['Refunded', 'Replaced', 'Rejected'].includes(body.status)) {
        rma.resolvedAt = new Date().toISOString();
      }
      if (body.status === 'Replaced' && !rma.replacementOrderId) {
        const replacementLines = (rma.returnedItems || []).map((item) => ({
          description: `Replacement: ${item.description}`,
          qty: item.qty,
          rate: 0,
          tax: 0,
          amount: 0,
          shippedQty: 0,
          returnedQty: 0,
        }));
        const replacement = normalizeSalesOrder({
          _id: `sales_order_repl_${Date.now()}`,
          orderNumber: nextSalesOrderNumber(items),
          clientId: order.clientId,
          clientName: order.clientName,
          generatedBy: 'RMA Replacement',
          status: 'Approved',
          issueDate: new Date().toISOString().slice(0, 10),
          shippingState: order.shippingState,
          billingAddress: order.billingAddress,
          shippingAddress: order.shippingAddress,
          lineItems: replacementLines,
          discountType: 'percent',
          discountValue: 0,
          shippingCharge: 0,
          notes: `Replacement for ${rma.rmaNumber}`,
          deliveryStatus: 'Pending Allocation',
          createdAt: new Date().toISOString(),
        });
        items.unshift(replacement);
        rma.replacementOrderId = replacement._id;
      }
      returns[rmaIndex] = rma;
      items[index] = { ...order, returns, updatedAt: new Date().toISOString() };
      saveLocalSalesOrders(items);
      return { success: true, data: items.find((item) => item._id === id)! };
    }
  },

  cancelSalesOrder: async (
    id: string,
    body: { reason: string }
  ): Promise<ApiResponse<SalesOrderItem>> => {
    try {
      return await request<SalesOrderItem>(`/sales-orders/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.reason?.trim()) throw new ApiError('Cancellation reason is required', 400);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      const order = items[index];
      if (hasDispatchedPackages(order)) {
        throw new ApiError(
          'Cannot cancel Sales Order because packages have already been dispatched or delivered. Please initiate an RMA Return instead.',
          400
        );
      }
      const now = new Date().toISOString();
      items[index] = {
        ...order,
        status: 'Cancelled',
        cancellationReason: body.reason.trim(),
        stockReserved: false,
        stockAudit: order.stockReserved
          ? [
              {
                action: 'release',
                performedAt: now,
                performedBy: 'Warehouse',
                details: 'Stock released on cancellation',
              },
              ...(order.stockAudit || []),
            ]
          : order.stockAudit || [],
        updatedAt: now,
      };
      saveLocalSalesOrders(items);
      return { success: true, data: items[index] };
    }
  },

  generateInvoiceFromSalesOrder: async (
    id: string,
    body: { sendEmail?: boolean; clientEmail?: string; emailMessage?: string } = {}
  ): Promise<ApiResponse<InvoiceItem>> => {
    try {
      return await request<InvoiceItem>(`/sales-orders/${encodeURIComponent(id)}/generate-invoice`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalSalesOrders();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Sales order not found', 404);
      const order = items[index];
      if (order.convertedInvoiceId) {
        const existing = await crmApi.getInvoice(order.convertedInvoiceId);
        if (body.sendEmail) {
          try {
            await crmApi.sendInvoice(order.convertedInvoiceId, {
              email: body.clientEmail,
              message: body.emailMessage,
            });
            existing.data.status = 'Sent';
          } catch {
            // ignore mock email dispatch error
          }
        }
        return existing;
      }
      const due = order.deliveryTargetDate
        ? order.deliveryTargetDate
        : (() => {
            const date = new Date();
            date.setDate(date.getDate() + 15);
            return date.toISOString().slice(0, 10);
          })();
      const nextNo = await crmApi.getNextInvoiceNumber();
      const invoice = await crmApi.createInvoice({
        invoiceNo: nextNo.data.invoiceNo,
        clientId: order.clientId,
        projectId: order.projectId || undefined,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: due,
        currency: order.currency || getRuntimeDefaultCurrency(),
        exchangeRate: 1,
        taxCalculation: 'after_discount',
        billingAddress: order.billingAddress,
        shippingAddress: order.shippingAddress,
        lineItems: (order.lineItems || []).map((line) => ({
          name: line.description,
          description: line.sku || '',
          qty: line.qty,
          rate: line.rate,
          tax: line.tax || 0,
        })),
        discountType: order.discountType === 'amount' ? 'amount' : 'percent',
        discountValue: order.discountValue ?? order.discount ?? 0,
        shippingCharge: order.shippingCharge || 0,
        notes: `Generated from ${order.orderNumber}`,
        salesOrderId: order._id,
        salesOrderNo: order.orderNumber,
      });

      if (body.sendEmail && invoice.data._id) {
        try {
          await crmApi.sendInvoice(invoice.data._id, {
            email: body.clientEmail,
            message: body.emailMessage,
          });
          invoice.data.status = 'Sent';
        } catch {
          // ignore mock email dispatch error
        }
      }

      items[index] = {
        ...order,
        convertedInvoiceId: invoice.data._id,
        convertedInvoiceNo: invoice.data.invoiceNo,
        invoiceStatus: invoice.data.status,
        updatedAt: new Date().toISOString(),
      };
      saveLocalSalesOrders(items);
      return invoice;
    }
  },

  exportSalesOrders: async (
    params: SalesOrderQueryParams & { format?: 'csv' | 'json' } = {}
  ): Promise<ApiResponse<{ content: string; filename: string; mimeType: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/sales-orders/export${query.size ? `?${query}` : ''}`,
        'sales_orders_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const listResponse = await crmApi.listSalesOrders(params);
      const items = listResponse.data || [];
      if (params.format === 'json') {
        return {
          success: true,
          data: {
            content: JSON.stringify(items, null, 2),
            filename: `sales-orders-${Date.now()}.json`,
            mimeType: 'application/json',
          },
        };
      }
      const header = [
        'ID',
        'Order Number',
        'Client / Customer Name',
        'Status',
        'Fulfillment / Delivery Status',
        'Order Date',
        'Expected Delivery Date',
        'Subtotal',
        'Tax Total',
        'Total Amount',
        'Payment Terms',
        'Reference Quotation',
        'Created At',
      ];
      const rows = items.map((item) =>
        [
          item._id,
          item.orderNumber,
          item.clientName || item.clientId,
          item.status,
          item.deliveryStatus || '',
          item.issueDate,
          item.deliveryTargetDate || '',
          item.subtotal ?? '',
          item.taxTotal ?? '',
          item.grandTotal,
          '',
          item.quotationId || '',
          item.createdAt || '',
        ]
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );
      return {
        success: true,
        data: {
          content: [header.join(','), ...rows].join('\n'),
          filename: `sales-orders-${Date.now()}.csv`,
          mimeType: 'text/csv',
        },
      };
    }
  },

  // ─── OPPORTUNITIES MODULE ENDPOINTS ───────────────────────────────────────
  listOpportunities: async (
    params: OpportunityQueryParams = {}
  ): Promise<ApiResponse<OpportunityItem[]> & { pagination?: OpportunityPaginationMeta }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit || 20));
    if (params.stage) query.set('stage', params.stage);
    if (params.clientId) query.set('clientId', params.clientId);
    if (params.leadId) query.set('leadId', params.leadId);
    if (params.salesOwner) query.set('salesOwner', params.salesOwner);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    try {
      return await request<OpportunityItem[]>(qs ? `/opportunities?${qs}` : '/opportunities', {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalOpportunities();
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            o.opportunityNumber?.toLowerCase().includes(q) ||
            o.clientName?.toLowerCase().includes(q) ||
            o.salesOwner?.toLowerCase().includes(q) ||
            o.salesOwnerName?.toLowerCase().includes(q)
        );
      }
      if (params.stage) items = items.filter((o) => o.stage === params.stage);
      if (params.clientId) items = items.filter((o) => o.clientId === params.clientId);
      if (params.leadId) items = items.filter((o) => String(o.leadId || '') === String(params.leadId));
      const page = params.page || 1;
      const limit = params.limit || 20;
      const total = items.length;
      const start = (page - 1) * limit;
      return {
        success: true,
        data: items.slice(start, start + limit),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      };
    }
  },

  getOpportunitySummary: async (): Promise<ApiResponse<OpportunitySummary>> => {
    try {
      const response = await request<
        OpportunitySummary & {
          totalOpportunities?: number;
          totalPipelineRevenue?: number;
          totalWeightedForecast?: number;
        }
      >('/opportunities/summary', { method: 'GET' });
      return {
        ...response,
        data: normalizeOpportunitySummary(
          (response.data || response) as Partial<OpportunitySummary> & Record<string, unknown>
        ),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalOpportunities();
      const open = items.filter((o) => o.stage !== 'Won' && o.stage !== 'Lost');
      const won = items.filter((o) => o.stage === 'Won');
      const lost = items.filter((o) => o.stage === 'Lost');
      const closed = won.length + lost.length;
      const revenue = (o: OpportunityItem) => o.expectedRevenue ?? o.value ?? 0;
      const pipelineValue = open.reduce((s, o) => s + revenue(o), 0);
      const weightedForecast = open.reduce((s, o) => {
        if (o.weightedRevenue != null) return s + Number(o.weightedRevenue);
        return s + (revenue(o) * (o.probability || 0)) / 100;
      }, 0);
      return {
        success: true,
        data: normalizeOpportunitySummary({
          totalDeals: items.length,
          pipelineValue,
          weightedForecast,
          wonRevenue: won.reduce((s, o) => s + revenue(o), 0),
          winRate: closed > 0 ? Math.round((won.length / closed) * 1000) / 10 : 0,
          openDeals: open.length,
          wonDeals: won.length,
          lostDeals: lost.length,
        }),
      };
    }
  },

  getOpportunity: async (id: string): Promise<ApiResponse<OpportunityItem>> => {
    try {
      return await request<OpportunityItem>(`/opportunities/${encodeURIComponent(id)}`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const found = getLocalOpportunities().find((o) => o._id === id);
      if (!found) throw new ApiError('Opportunity not found', 404);
      return { success: true, data: found };
    }
  },

  createOpportunity: async (
    body: OpportunityCreateInput
  ): Promise<ApiResponse<OpportunityItem>> => {
    try {
      return await request<OpportunityItem>('/opportunities', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.clientId && !body.leadId) {
        throw new ApiError('Select a client account or an inbound lead', 400);
      }
      if (!body.title?.trim()) throw new ApiError('Opportunity title is required', 400);
      if (!body.shippingState?.trim()) throw new ApiError('Destination shipping state is required', 400);
      if (!body.products?.length) {
        throw new ApiError('Add at least one product line item', 400);
      }
      if (body.stage === 'Lost' && !body.lostReason?.trim()) {
        throw new ApiError('Lost reason is required when stage is Lost', 400);
      }
      const items = getLocalOpportunitiesRaw();
      const active = items.filter((item) => !item.isDeleted);
      const stage = body.stage || 'Discovery';
      const probability = body.probability ?? stageProbability(stage);
      const products = (body.products || []).map((line) => ({
        ...line,
        productName: line.productName.trim(),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        tax: Number(line.tax ?? 18),
        amount: Number(line.quantity) * Number(line.unitPrice),
      }));
      const financials = computeOpportunityFinancials(
        products,
        Number(body.shippingCharge || 0),
        probability
      );
      const year = new Date().getFullYear();
      const maxNum = active.reduce((highest, item) => {
        const match = String(item.opportunityNumber || '').match(/(\d+)$/);
        const num = match ? Number(match[1]) : 0;
        return Number.isFinite(num) ? Math.max(highest, num) : highest;
      }, 0);
      const created: OpportunityItem = {
        _id: `opp_${Date.now()}`,
        opportunityNumber: `OPP-${year}-${String(maxNum + 1).padStart(4, '0')}`,
        title: body.title.trim(),
        clientId: body.clientId || '',
        clientName: body.clientName,
        leadId: body.leadId || null,
        contactId: body.contactId || null,
        contactPerson: body.contactPerson,
        contactEmail: body.contactEmail,
        contactMobile: body.contactMobile,
        products,
        stage,
        expectedRevenue: financials.expectedRevenue,
        value: financials.expectedRevenue,
        currency: body.currency || getRuntimeDefaultCurrency(),
        probability,
        weightedRevenue: financials.weightedRevenue,
        shippingState: body.shippingState,
        shippingCharge: Number(body.shippingCharge || 0),
        expectedCloseDate: body.expectedCloseDate || null,
        salesOwner: body.salesOwner,
        salesOwnerName: body.salesOwner,
        lostReason: body.stage === 'Lost' ? body.lostReason || null : null,
        closedAt: stage === 'Won' || stage === 'Lost' ? new Date().toISOString() : null,
        description: body.description,
        source: body.source,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      items.unshift(created);
      saveLocalOpportunities(items);
      return { success: true, data: created, message: 'Opportunity created' };
    }
  },

  changeOpportunityStage: async (
    id: string,
    body: { stage: string; probability?: number; lostReason?: string }
  ): Promise<ApiResponse<OpportunityItem>> => {
    try {
      return await request<OpportunityItem>(`/opportunities/${encodeURIComponent(id)}/stage`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalOpportunitiesRaw();
      const idx = items.findIndex((o) => o._id === id && !o.isDeleted);
      if (idx < 0) throw new ApiError('Opportunity not found', 404);
      if (items[idx].acceptedQuotationId || items[idx].generatedSalesOrderId) {
        throw new ApiError('Stage is locked after accepted quotation / sales order', 400);
      }
      if (body.stage === 'Lost' && !body.lostReason?.trim()) {
        throw new ApiError('Lost reason is required when marking as Lost', 400);
      }
      const probability = body.probability ?? stageProbability(body.stage);
      const revenue = items[idx].expectedRevenue ?? items[idx].value ?? 0;
      items[idx] = {
        ...items[idx],
        stage: body.stage,
        probability,
        weightedRevenue: Math.round((revenue * probability) / 100),
        lostReason: body.stage === 'Lost' ? body.lostReason || null : null,
        closedAt: body.stage === 'Won' || body.stage === 'Lost' ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
      saveLocalOpportunities(items);
      return { success: true, data: items[idx] };
    }
  },

  assignOpportunityOwner: async (
    id: string,
    body: { salesOwner: string }
  ): Promise<ApiResponse<OpportunityItem>> => {
    try {
      return await request<OpportunityItem>(
        `/opportunities/${encodeURIComponent(id)}/assign-owner`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const salesOwner = String(body.salesOwner || '').trim();
      if (!salesOwner) throw new ApiError('Sales owner is required', 400);
      const items = getLocalOpportunitiesRaw();
      const idx = items.findIndex((o) => o._id === id && !o.isDeleted);
      if (idx < 0) throw new ApiError('Opportunity not found', 404);
      items[idx] = {
        ...items[idx],
        salesOwner,
        salesOwnerName: salesOwner,
        updatedAt: new Date().toISOString(),
      };
      saveLocalOpportunities(items);
      return { success: true, data: items[idx], message: 'Opportunity assigned' };
    }
  },

  convertOpportunityToQuotation: async (
    id: string
  ): Promise<ApiResponse<{ quotationId: string; opportunity: OpportunityItem }>> => {
    try {
      return await request<{ quotationId: string; opportunity: OpportunityItem }>(
        `/opportunities/${encodeURIComponent(id)}/convert-quotation`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalOpportunitiesRaw();
      const idx = items.findIndex((o) => o._id === id && !o.isDeleted);
      if (idx < 0) throw new ApiError('Opportunity not found', 404);
      const opportunity = items[idx];
      const stage = String(opportunity.stage || '').toLowerCase();
      if (opportunity.acceptedQuotationId) {
        throw new ApiError(
          'A quotation has already been accepted for this opportunity. New quotations cannot be created.',
          409
        );
      }
      if (stage === 'won' || stage === 'lost') {
        throw new ApiError('Quotations cannot be created for Won or Lost opportunities', 409);
      }
      if (!opportunity.clientId && !opportunity.leadId) {
        throw new ApiError('Opportunity must be linked to a client or lead', 400);
      }
      const products = opportunity.products || [];
      const issueDate = new Date().toISOString().slice(0, 10);
      const valid = new Date();
      valid.setDate(valid.getDate() + 30);
      const quotation = await crmApi.createQuotation({
        recipientType: opportunity.clientId ? 'client' : 'lead',
        clientId: opportunity.clientId || undefined,
        leadId: opportunity.leadId || undefined,
        opportunityId: opportunity._id,
        shippingState: opportunity.shippingState || 'Maharashtra',
        issueDate,
        validTill: valid.toISOString().slice(0, 10),
        currency: opportunity.currency || getRuntimeDefaultCurrency(),
        taxCalculation: 'after_discount',
        title: opportunity.title,
        lineItems: (products.length
          ? products
          : [
              {
                productName: opportunity.title,
                quantity: 1,
                unitPrice: Number(opportunity.expectedRevenue || opportunity.value || 0),
                tax: 18,
                amount: Number(opportunity.expectedRevenue || opportunity.value || 0),
              },
            ]
        ).map((line) => ({
          name: line.productName,
          qty: line.quantity,
          rate: line.unitPrice,
          tax: line.tax,
        })),
        discountType: 'percent',
        discountValue: 0,
        shippingCharge: opportunity.shippingCharge || 0,
        recipientNotes: `Created from ${opportunity.opportunityNumber || opportunity.title}`,
      });
      const probability = DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES.Negotiation ?? 85;
      const expectedRevenue = Number(opportunity.expectedRevenue || opportunity.value || 0);
      items[idx] = {
        ...opportunity,
        stage: 'Negotiation',
        probability,
        weightedRevenue: Math.round(expectedRevenue * (probability / 100) * 100) / 100,
        generatedQuotationId: quotation.data._id,
        generatedQuotationNo:
          quotation.data.quotationNo || quotation.data.quotationNumber || quotation.data.number,
        closedAt: null,
        lostReason: null,
        updatedAt: new Date().toISOString(),
      };
      saveLocalOpportunities(items);
      return {
        success: true,
        data: { quotationId: quotation.data._id, opportunity: items[idx] },
        message: 'Quotation generated from opportunity',
      };
    }
  },

  convertOpportunityToSalesOrder: async (
    id: string
  ): Promise<ApiResponse<{ salesOrderId: string; opportunity?: OpportunityItem }>> => {
    try {
      const res = await request<{ salesOrderId: string; order?: { _id?: string }; opportunity?: OpportunityItem }>(
        `/sales-orders/from-opportunity/${encodeURIComponent(id)}`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      const salesOrderId = res.data?.salesOrderId || res.data?.order?._id || '';
      return {
        ...res,
        data: {
          salesOrderId,
          opportunity: res.data?.opportunity,
        },
        message: res.message || 'This opportunity converted',
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalOpportunitiesRaw();
      const idx = items.findIndex((o) => o._id === id && !o.isDeleted);
      if (idx < 0) throw new ApiError('Opportunity not found', 404);
      const opportunity = items[idx];
      const stageType = String(opportunity.stageType || '').trim().toUpperCase();
      const isWon =
        stageType === 'WON' || String(opportunity.stage || '').trim().toLowerCase() === 'won';
      if (!isWon) {
        throw new ApiError('Only Won opportunities can be converted to sales orders', 400);
      }
      if (opportunity.generatedSalesOrderId) {
        throw new ApiError(
          'A Sales Order already exists for this Opportunity.',
          409,
          'SALES_ORDER_EXISTS',
          undefined,
          undefined,
          { salesOrderId: opportunity.generatedSalesOrderId }
        );
      }
      if (!opportunity.clientId) throw new ApiError('Opportunity must be linked to a client', 400);
      const products = opportunity.products || [];
      if (!products.length) throw new ApiError('Opportunity has no product line items', 400);
      const order = await crmApi.createSalesOrder({
        clientId: opportunity.clientId,
        opportunityId: opportunity._id,
        generatedBy: 'Won Opportunity Conversion',
        status: 'Approved',
        issueDate: new Date().toISOString().slice(0, 10),
        shippingState: opportunity.shippingState || 'Maharashtra',
        billingAddress: '',
        shippingAddress: '',
        lineItems: products.map((line) => ({
          description: line.productName,
          qty: line.quantity,
          rate: line.unitPrice,
          tax: line.tax,
        })),
        discountType: 'percent',
        discountValue: 0,
        shippingCharge: opportunity.shippingCharge || 0,
        notes: `Converted from ${opportunity.opportunityNumber || opportunity.title}`,
      });
      items[idx] = {
        ...opportunity,
        generatedSalesOrderId: order.data._id,
        generatedSalesOrderNo: order.data.orderNumber,
        updatedAt: new Date().toISOString(),
      };
      saveLocalOpportunities(items);
      return {
        success: true,
        data: { salesOrderId: order.data._id, opportunity: items[idx] },
        message: 'This opportunity converted',
      };
    }
  },

  downloadOpportunitiesExport: async (
    params: OpportunityQueryParams & { format?: 'csv' | 'json' | 'xlsx' } = {}
  ): Promise<string> => {
    const format = params.format === 'json' ? 'json' : 'csv';
    const query = new URLSearchParams();
    if (params.stage) query.set('stage', params.stage);
    if (params.search) query.set('search', params.search);
    if (params.clientId) query.set('clientId', params.clientId);
    query.set('format', format);
    try {
      const response = await fetch(`${API_BASE}/opportunities/export?${query.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const filename =
        response.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1] ||
        `opportunities_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      triggerFileDownload({ filename, content: blob, format });
      return filename;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = (await crmApi.listOpportunities({ ...params, limit: 500 })).data || [];
      if (format === 'json') {
        const filename = `opportunities_export_${new Date().toISOString().slice(0, 10)}.json`;
        triggerFileDownload({
          filename,
          content: JSON.stringify(items, null, 2),
          format: 'json',
        });
        return filename;
      }
      const header =
        'Opportunity Number,Title,Client,Contact,Stage,Amount,Probability,Weighted Value,Expected Close Date,Sales Owner\r\n';
      const rows = items
        .map((o) =>
          [
            o.opportunityNumber || '',
            o.title,
            o.clientName || '',
            o.contactPerson || '',
            o.stage,
            o.expectedRevenue ?? o.value ?? 0,
            o.probability ?? 0,
            o.weightedRevenue ?? 0,
            o.expectedCloseDate || '',
            o.salesOwner || o.salesOwnerName || '',
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\r\n');
      const filename = `opportunities_export_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerFileDownload({ filename, content: header + rows, format: 'csv' });
      return filename;
    }
  },

  deleteOpportunity: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/opportunities/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalOpportunitiesRaw();
      const idx = items.findIndex((o) => o._id === id && !o.isDeleted);
      if (idx < 0) throw new ApiError('Opportunity not found', 404);
      items[idx] = {
        ...items[idx],
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveLocalOpportunities(items);
      return { success: true, data: { deleted: true } };
    }
  },

  // ─── PROJECTS MODULE ENDPOINTS ────────────────────────────────────────────
  listProjects: async (
    params: ProjectQueryParams = {}
  ): Promise<ApiResponse<ProjectItem[]> & { pagination?: ProjectPaginationMeta }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit || 20));
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.category) query.set('category', params.category);
    if (params.label) query.set('label', params.label);
    if (params.tag) query.set('tag', params.tag);
    if (params.clientId) query.set('clientId', params.clientId);
    if (params.search) query.set('search', params.search);
    if (params.isDropped !== undefined) query.set('isDropped', String(params.isDropped));
    if (params.dropped !== undefined) query.set('dropped', String(params.dropped));
    if (params.view) query.set('view', params.view);
    if (params.isArchived !== undefined) query.set('isArchived', String(params.isArchived));
    const qs = query.toString();
    try {
      return await request<ProjectItem[]>(qs ? `/projects?${qs}` : '/projects', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = filterLocalProjects(params);
      const page = params.page || 1;
      const limit = params.limit || 20;
      const total = items.length;
      const start = (page - 1) * limit;
      return {
        success: true,
        data: items.slice(start, start + limit),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      };
    }
  },

  getProject: async (id: string): Promise<ApiResponse<ProjectItem>> => {
    try {
      return await request<ProjectItem>(`/projects/${encodeURIComponent(id)}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const resolved = resolveProjectId(id);
      const found = getLocalProjects().find((p) => p._id === resolved);
      if (!found) throw new ApiError('Project not found', 404);
      return { success: true, data: found };
    }
  },

  getProjectOverview: async (id: string): Promise<ApiResponse<ProjectOverview>> => {
    try {
      const response = await request<unknown>(
        `/projects/${encodeURIComponent(id)}/overview`,
        { method: 'GET' }
      );
      return {
        success: true,
        data: normalizeProjectOverview(response.data),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const resolved = resolveProjectId(id);
      const project = getLocalProjects().find((p) => p._id === resolved);
      if (!project) throw new ApiError('Project not found', 404);
      const tasks =
        getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS)[resolved] || [];
      const hoursLogged = getUnifiedTimeLogs()
        .filter((t) => t.projectId === resolved && t.status !== 'Running')
        .reduce((s, t) => s + (t.hours || 0), 0);
      const expenses = getLocalProjectList(PROJECT_EXPENSES_KEY, INITIAL_MOCK_PROJECT_EXPENSES)
        .filter((e) => e.projectId === resolved)
        .reduce((s, e) => s + (e.amount || 0), 0);
      const budget = Number(project.budget) || 0;
      const earnings = Math.round(budget * 0.85);
      const progress = computeProjectProgress(project, tasks, hoursLogged);
      const today = new Date().toISOString().slice(0, 10);
      return {
        success: true,
        data: normalizeProjectOverview({
          budget,
          earnings,
          expenses,
          profit: earnings - expenses,
          progress,
          hoursLogged,
          hoursEstimate: Number(project.hoursEstimate) || 0,
          currency: project.currency || getRuntimeDefaultCurrency(),
          taskStats: {
            total: tasks.length,
            completed: tasks.filter((t) => t.status === 'Completed').length,
            inProgress: tasks.filter((t) => t.status === 'In Progress').length,
            overdue: tasks.filter(
              (t) => t.dueDate && t.dueDate < today && t.status !== 'Completed'
            ).length,
          },
        }),
      };
    }
  },

  getProjectActivity: async (
    id: string,
    params: { page?: number; limit?: number; action?: string; search?: string } = {}
  ): Promise<ApiResponse<ProjectActivityEntry[]>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.action) query.set('action', params.action);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    try {
      return await request<ProjectActivityEntry[]>(
        qs
          ? `/projects/${encodeURIComponent(id)}/activity?${qs}`
          : `/projects/${encodeURIComponent(id)}/activity`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items =
        getLocalProjectMap(PROJECT_ACTIVITY_KEY, INITIAL_MOCK_PROJECT_ACTIVITY)[id] || [];
      if (params.action) items = items.filter((a) => a.action === params.action);
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter((a) => a.message.toLowerCase().includes(q));
      }
      return { success: true, data: items };
    }
  },

  createProject: async (body: ProjectCreateInput): Promise<ApiResponse<ProjectItem>> => {
    try {
      return await request<ProjectItem>('/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.name?.trim()) throw new ApiError('Project name is required', 400);
      if (!body.clientId) throw new ApiError('Client is required', 400);
      const items = getLocalProjects();
      const created: ProjectItem = {
        _id: `proj_${Date.now()}`,
        name: body.name.trim(),
        description: body.description || '',
        clientId: body.clientId,
        clientName: body.clientName,
        category: body.category || '',
        label: body.label || body.tags?.[0] || '',
        tags: body.tags || [],
        priority: body.priority || 'Medium',
        status: body.status || 'Not Started',
        budget: Number(body.budget) || 0,
        currency: body.currency || getRuntimeDefaultCurrency(),
        hoursEstimate: Number(body.hoursEstimate) || 0,
        progressCalculationMethod: body.progressCalculationMethod || 'tasks',
        startDate: body.startDate || null,
        deadline: body.deadline || null,
        assignedTo: body.assignedTo || [],
        customFields: body.customFields || {},
        isArchived: false,
        isDropped: false,
        progress: 0,
        taskCount: 0,
        completedTaskCount: 0,
        ownerName: 'Admin User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      items.unshift(created);
      saveLocalProjects(items);
      pushProjectActivity(created._id, 'created', `Project “${created.name}” created`);
      return { success: true, data: created, message: 'Project created' };
    }
  },

  updateProject: async (
    id: string,
    body: Partial<ProjectCreateInput> & { progress?: number; status?: string }
  ): Promise<ApiResponse<ProjectItem>> => {
    try {
      return await request<ProjectItem>(`/projects/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalProjects();
      const idx = items.findIndex((p) => p._id === id);
      if (idx < 0) throw new ApiError('Project not found', 404);
      const prevStatus = items[idx].status;
      items[idx] = {
        ...items[idx],
        ...body,
        name: body.name?.trim() || items[idx].name,
        tags: body.tags ?? items[idx].tags,
        assignedTo: body.assignedTo ?? items[idx].assignedTo,
        customFields: body.customFields ?? items[idx].customFields,
        liveUrl:
          body.liveUrl !== undefined
            ? body.liveUrl || ''
            : items[idx].liveUrl,
        updatedAt: new Date().toISOString(),
      };
      saveLocalProjects(items);
      if (body.status && body.status !== prevStatus) {
        pushProjectActivity(id, 'status_change', `Status moved to ${body.status}`);
      } else {
        pushProjectActivity(id, 'updated', 'Project details updated');
      }
      return { success: true, data: items[idx], message: 'Project updated' };
    }
  },

  deleteProject: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    // Old CRM UI "Delete" = drop/deactivate (not hard delete).
    try {
      await request<{ deleted: boolean }>(`/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return { success: true, data: { deleted: true } };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      await crmApi.dropProject(id);
      return { success: true, data: { deleted: true } };
    }
  },

  dropProject: async (
    id: string,
    body: { reason?: string } = {}
  ): Promise<ApiResponse<ProjectItem>> => {
    try {
      return await request<ProjectItem>(`/projects/${encodeURIComponent(id)}/drop`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalProjects();
      const idx = items.findIndex((p) => p._id === id);
      if (idx < 0) throw new ApiError('Project not found', 404);
      items[idx] = {
        ...items[idx],
        isDropped: true,
        droppedReason: body.reason || null,
        previousStatus: items[idx].status,
        status: 'Dropped',
        updatedAt: new Date().toISOString(),
      };
      saveLocalProjects(items);
      pushProjectActivity(
        id,
        'dropped',
        `Project dropped${body.reason ? `: ${body.reason}` : ''}`
      );
      return { success: true, data: items[idx] };
    }
  },

  reactivateProject: async (id: string): Promise<ApiResponse<ProjectItem>> => {
    try {
      return await request<ProjectItem>(`/projects/${encodeURIComponent(id)}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalProjects();
      const idx = items.findIndex((p) => p._id === id);
      if (idx < 0) throw new ApiError('Project not found', 404);
      items[idx] = {
        ...items[idx],
        isDropped: false,
        droppedReason: null,
        status: items[idx].previousStatus || 'In Progress',
        previousStatus: null,
        updatedAt: new Date().toISOString(),
      };
      saveLocalProjects(items);
      pushProjectActivity(id, 'reactivated', 'Project reactivated');
      return { success: true, data: items[idx] };
    }
  },

  archiveProject: async (id: string): Promise<ApiResponse<ProjectItem>> => {
    try {
      return await request<ProjectItem>(`/projects/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalProjects();
      const idx = items.findIndex((p) => p._id === id);
      if (idx < 0) throw new ApiError('Project not found', 404);
      items[idx] = { ...items[idx], isArchived: true, updatedAt: new Date().toISOString() };
      saveLocalProjects(items);
      pushProjectActivity(id, 'archived', 'Project archived');
      return { success: true, data: items[idx] };
    }
  },

  restoreProject: async (id: string): Promise<ApiResponse<ProjectItem>> => {
    try {
      return await request<ProjectItem>(`/projects/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalProjects();
      const idx = items.findIndex((p) => p._id === id);
      if (idx < 0) throw new ApiError('Project not found', 404);
      items[idx] = { ...items[idx], isArchived: false, updatedAt: new Date().toISOString() };
      saveLocalProjects(items);
      pushProjectActivity(id, 'restored', 'Project restored from archive');
      return { success: true, data: items[idx] };
    }
  },

  downloadProjectsExport: async (
    params: ProjectQueryParams & { format?: 'csv' | 'json' | 'xlsx' } = {}
  ): Promise<string> => {
    const format = params.format === 'json' ? 'json' : 'csv';
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.category) query.set('category', params.category);
    if (params.tag) query.set('tag', params.tag);
    if (params.search) query.set('search', params.search);
    if (params.isDropped !== undefined) query.set('isDropped', String(params.isDropped));
    if (params.isArchived !== undefined) query.set('isArchived', String(params.isArchived));
    query.set('format', format);
    try {
      const response = await fetch(`${API_BASE}/projects/export?${query.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const filename =
        response.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1] ||
        `projects_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      triggerFileDownload({ filename, content: blob, format });
      return filename;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = (await crmApi.listProjects({ ...params, limit: 500 })).data || [];
      if (format === 'json') {
        const filename = `projects_export_${new Date().toISOString().slice(0, 10)}.json`;
        triggerFileDownload({
          filename,
          content: JSON.stringify(items, null, 2),
          format: 'json',
        });
        return filename;
      }
      const header =
        'Name,Client,Category,Priority,Status,Budget,Currency,Progress,Deadline,Owner,Tags\r\n';
      const rows = items
        .map((p) =>
          [
            p.name,
            p.clientName || '',
            p.category || '',
            p.priority,
            p.status,
            p.budget ?? 0,
            p.currency || getRuntimeDefaultCurrency(),
            p.progress ?? 0,
            p.deadline || '',
            p.ownerName || '',
            (p.tags || []).join('; '),
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\r\n');
      const filename = `projects_export_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerFileDownload({ filename, content: header + rows, format: 'csv' });
      return filename;
    }
  },

  getProjectCategories: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/projects/categories', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalStringList(PROJECT_CATEGORIES_KEY, INITIAL_PROJECT_CATEGORIES),
      };
    }
  },

  createProjectCategory: async (name: string): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/projects/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalStringList(PROJECT_CATEGORIES_KEY, INITIAL_PROJECT_CATEGORIES);
      const trimmed = name.trim();
      if (trimmed && !list.includes(trimmed)) list.push(trimmed);
      saveLocalStringList(PROJECT_CATEGORIES_KEY, list);
      return { success: true, data: list };
    }
  },

  getProjectLabels: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/projects/labels', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalStringList(PROJECT_LABELS_KEY, INITIAL_PROJECT_LABELS),
      };
    }
  },

  getProjectTags: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/projects/tags', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalStringList(PROJECT_TAGS_KEY, INITIAL_PROJECT_TAGS),
      };
    }
  },

  addProjectTag: async (name: string): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/projects/tags', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalStringList(PROJECT_TAGS_KEY, INITIAL_PROJECT_TAGS);
      const trimmed = name.trim();
      if (trimmed && !list.includes(trimmed)) list.push(trimmed);
      saveLocalStringList(PROJECT_TAGS_KEY, list);
      return { success: true, data: list };
    }
  },

  getProjectStatuses: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/projects/statuses', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: [...DEFAULT_PROJECT_STATUSES] };
    }
  },

  getProjectPriorities: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/projects/priorities', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: [...DEFAULT_PROJECT_PRIORITIES] };
    }
  },

  getProjectCustomFields: async (): Promise<
    ApiResponse<{ key: string; label: string; type?: string }[]>
  > => {
    try {
      return await request('/projects/custom-fields', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalProjectList(PROJECT_CUSTOM_FIELDS_KEY, [
          { key: 'ContractRef', label: 'Contract Ref', type: 'text' },
          { key: 'Region', label: 'Region', type: 'text' },
        ]),
      };
    }
  },

  addProjectCustomField: async (body: {
    key: string;
    label: string;
    type?: string;
  }): Promise<ApiResponse<{ key: string; label: string; type?: string }[]>> => {
    try {
      return await request('/projects/custom-fields', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(PROJECT_CUSTOM_FIELDS_KEY, [
        { key: 'ContractRef', label: 'Contract Ref', type: 'text' },
        { key: 'Region', label: 'Region', type: 'text' },
      ]);
      if (!list.find((f) => f.key === body.key)) {
        list.push({ key: body.key, label: body.label, type: body.type || 'text' });
      }
      saveLocalProjectList(PROJECT_CUSTOM_FIELDS_KEY, list);
      return { success: true, data: list };
    }
  },

  getProjectTemplates: async (): Promise<ApiResponse<ProjectTemplate[]>> => {
    try {
      return await request<ProjectTemplate[]>('/projects/templates', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalProjectList(PROJECT_TEMPLATES_KEY, INITIAL_MOCK_PROJECT_TEMPLATES),
      };
    }
  },

  createProjectTemplate: async (
    body: Partial<ProjectTemplate>
  ): Promise<ApiResponse<ProjectTemplate>> => {
    try {
      return await request<ProjectTemplate>('/projects/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.name?.trim()) throw new ApiError('Template name is required', 400);
      const list = getLocalProjectList(PROJECT_TEMPLATES_KEY, INITIAL_MOCK_PROJECT_TEMPLATES);
      const created: ProjectTemplate = {
        _id: `tpl_${Date.now()}`,
        name: body.name.trim(),
        description: body.description || '',
        category: body.category || '',
        priority: body.priority || 'Medium',
        hoursEstimate: Number(body.hoursEstimate) || 0,
        budget: Number(body.budget) || 0,
        currency: body.currency || getRuntimeDefaultCurrency(),
        milestones: body.milestones || [],
        tasks: body.tasks || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.unshift(created);
      saveLocalProjectList(PROJECT_TEMPLATES_KEY, list);
      return { success: true, data: created };
    }
  },

  getProjectTemplate: async (id: string): Promise<ApiResponse<ProjectTemplate>> => {
    try {
      return await request<ProjectTemplate>(`/projects/templates/${encodeURIComponent(id)}`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const found = getLocalProjectList(
        PROJECT_TEMPLATES_KEY,
        INITIAL_MOCK_PROJECT_TEMPLATES
      ).find((t) => t._id === id);
      if (!found) throw new ApiError('Template not found', 404);
      return { success: true, data: found };
    }
  },

  updateProjectTemplate: async (
    id: string,
    body: Partial<ProjectTemplate>
  ): Promise<ApiResponse<ProjectTemplate>> => {
    try {
      return await request<ProjectTemplate>(`/projects/templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(PROJECT_TEMPLATES_KEY, INITIAL_MOCK_PROJECT_TEMPLATES);
      const idx = list.findIndex((t) => t._id === id);
      if (idx < 0) throw new ApiError('Template not found', 404);
      list[idx] = { ...list[idx], ...body, updatedAt: new Date().toISOString() };
      saveLocalProjectList(PROJECT_TEMPLATES_KEY, list);
      return { success: true, data: list[idx] };
    }
  },

  getDeliverySettings: async (): Promise<ApiResponse<DeliverySettings>> => {
    try {
      return await request<DeliverySettings>('/settings/delivery', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const settings = getLocalCrmSettings();
      return {
        success: true,
        data: {
          project_statuses: [...settings.project_statuses],
          project_priorities: [...settings.project_priorities],
          project_categories: [...settings.project_categories],
          project_tags: [...settings.project_tags],
          project_custom_fields: [...settings.project_custom_fields],
          task_statuses: ['To Do', 'In Progress', 'Review', 'Completed', 'On Hold'],
          task_priorities: [...settings.project_priorities],
          task_client_reminder_hours: settings.task_client_reminder_hours,
          delivery_guidelines:
            'Assign an owner, set a realistic deadline, track progress by tasks or time, and keep the client informed on milestone completion.',
        },
      };
    }
  },

  sendTaskReminderEmail: async (
    taskId: string
  ): Promise<ApiResponse<{ sent: boolean; message?: string; task?: TaskItem }>> => {
    try {
      return await request<{ sent: boolean; message?: string; task?: TaskItem }>(
        `/tasks/${encodeURIComponent(taskId)}/send-reminder`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const result = dispatchTaskReminderMock(taskId);
      return {
        success: true,
        data: { sent: true, message: result.message, task: result.task },
        message: result.message,
      };
    }
  },

  deleteProjectTemplate: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/projects/templates/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      saveLocalProjectList(
        PROJECT_TEMPLATES_KEY,
        getLocalProjectList(PROJECT_TEMPLATES_KEY, INITIAL_MOCK_PROJECT_TEMPLATES).filter(
          (t) => t._id !== id
        )
      );
      return { success: true, data: { deleted: true } };
    }
  },

  createProjectFromTemplate: async (
    templateId: string,
    body: Partial<ProjectCreateInput> & { clientId: string } & Record<string, unknown>
  ): Promise<ApiResponse<ProjectItem>> => {
    try {
      return await request<ProjectItem>(
        `/projects/templates/${encodeURIComponent(templateId)}/instantiate`,
        { method: 'POST', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const templates = getLocalProjectList(
        PROJECT_TEMPLATES_KEY,
        INITIAL_MOCK_PROJECT_TEMPLATES
      );
      const tpl = templates.find((t) => t._id === templateId);
      if (!tpl) throw new ApiError('Template not found', 404);
      if (!body.clientId) throw new ApiError('Client is required', 400);
      const createdRes = await crmApi.createProject({
        name: body.name || tpl.name,
        clientId: body.clientId,
        clientName: body.clientName,
        category: body.category || tpl.category,
        priority: body.priority || tpl.priority,
        hoursEstimate: body.hoursEstimate ?? tpl.hoursEstimate,
        budget: body.budget ?? tpl.budget,
        currency: body.currency || tpl.currency,
        description: body.description || tpl.description,
        status: body.status || 'Not Started',
        tags: body.tags || tpl.tags || [],
        label: body.label || tpl.label,
        progressCalculationMethod: (body.progressCalculationMethod ||
          tpl.progressCalculationMethod ||
          'tasks') as ProjectItem['progressCalculationMethod'],
        startDate: body.startDate || null,
        deadline: body.deadline || null,
        assignedTo: body.assignedTo || [],
        customFields: body.customFields || {},
      });
      const project = createdRes.data;
      const milestonesMap = getLocalProjectMap(
        PROJECT_MILESTONES_KEY,
        INITIAL_MOCK_PROJECT_MILESTONES
      );
      const tasksMap = getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS);
      const rawStart = body.startDate ? new Date(body.startDate) : new Date();
      const start = isNaN(rawStart.getTime()) ? new Date() : rawStart;
      const milestoneIds: string[] = [];
      milestonesMap[project._id] = (tpl.milestones || []).map((m, i) => {
        const title = typeof m === 'string' ? m : m.name;
        const dueOffset =
          typeof m === 'string' ? (i + 1) * 14 : Number(m.dueDayOffset ?? (i + 1) * 14);
        const mid = `ms_${Date.now()}_${i}`;
        milestoneIds.push(mid);
        return {
          _id: mid,
          projectId: project._id,
          title,
          status: 'Pending',
          order: i,
          dueDate: new Date(start.getTime() + dueOffset * 86400000).toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
      const newTasks: ProjectTaskSummary[] = (tpl.tasks || []).map((t, i) => {
        const day = Number(t.dayOffset) || 0;
        const due = Number(t.dueDayOffset) || day + 7;
        const mi = t.milestoneIndex;
        return {
          _id: `task_${Date.now()}_${i}`,
          projectId: project._id,
          title: t.title,
          status: 'To Do',
          priority: t.priority || 'Medium',
          startDate: new Date(start.getTime() + day * 86400000).toISOString().slice(0, 10),
          dueDate: new Date(start.getTime() + due * 86400000).toISOString().slice(0, 10),
          milestoneId:
            mi != null && milestoneIds[mi] != null ? milestoneIds[mi] : null,
          hoursEstimate: t.hoursEstimate || 0,
          hoursLogged: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
      tasksMap[project._id] = newTasks;
      const globalTaskList = getLocalProjectList(TASKS_STORE_KEY, INITIAL_WAVE_TASKS);
      globalTaskList.unshift(...(newTasks as unknown as TaskItem[]));
      saveLocalProjectList(TASKS_STORE_KEY, globalTaskList);
      saveLocalProjectMap(PROJECT_MILESTONES_KEY, milestonesMap);
      saveLocalProjectMap(PROJECT_TASKS_KEY, tasksMap);
      refreshProjectTaskCounts(project._id);
      return { success: true, data: (await crmApi.getProject(project._id)).data };
    }
  },

  getProjectTasks: async (
    id: string,
    params: { status?: string; milestoneId?: string; search?: string; limit?: number } = {}
  ): Promise<ApiResponse<ProjectTaskSummary[]>> => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.milestoneId) query.set('milestoneId', params.milestoneId);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(Math.min(Number(params.limit) || 100, 100)));
    else query.set('limit', '100');
    const qs = query.toString();
    try {
      return await request<ProjectTaskSummary[]>(
        `/projects/${encodeURIComponent(id)}/tasks?${qs}`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const resolved = resolveProjectId(id);
      let items =
        getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS)[resolved] || [];
      if (params.status) items = items.filter((t) => t.status === params.status);
      if (params.milestoneId)
        items = items.filter((t) => t.milestoneId === params.milestoneId);
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter((t) => t.title.toLowerCase().includes(q));
      }
      if (params.limit && params.limit > 0) items = items.slice(0, params.limit);
      return { success: true, data: items };
    }
  },

  listTasks: async (
    params: TaskQueryParams = {}
  ): Promise<ApiResponse<TaskItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit') return;
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      const response = await request<TaskItem[]>(`/tasks?${query}`, { method: 'GET' });
      return {
        ...response,
        data: response.data || [],
        pagination: fallbackPagination(page, limit, response.data?.length || 0, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getUnifiedTasks();
      const milestonesMap = getLocalProjectMap(PROJECT_MILESTONES_KEY, INITIAL_MOCK_PROJECT_MILESTONES);
      const subtasksMap = getLocalProjectMap(TASK_SUBTASKS_KEY, INITIAL_MOCK_TASK_SUBTASKS);
      const projects = getLocalProjects();

      // Enrich tasks
      items = items.map((t) => {
        const proj = projects.find((p) => p._id === t.projectId);
        const pMilestones = milestonesMap[t.projectId] || [];
        const ms = pMilestones.find((m) => m._id === t.milestoneId);
        const subtasks = subtasksMap[t._id] || [];
        const depTask = t.dependsOnTaskId ? items.find((dt) => dt._id === t.dependsOnTaskId) : null;
        return {
          ...t,
          projectName: t.projectName || proj?.name,
          clientName: proj?.clientName || 'Internal',
          milestoneTitle: t.milestoneTitle || ms?.title,
          assignedUsername: t.assignedUsername || t.assigneeName || (t.assignedTo ? 'Admin User' : undefined),
          subtaskCount: subtasks.length,
          subtasksCompletedCount: subtasks.filter((st) => st.done).length,
          followerCount: (t.followers || []).length,
          dependsOnTaskTitle: depTask?.title,
          dependsOnTaskStatus: depTask?.status,
          isDependencyBlocked: depTask ? depTask.status !== 'Completed' : false,
          clientFeedbackStatus: t.clientFeedbackStatus || 'Pending Review',
        };
      });

      if (params.projectId) {
        const projectId = resolveProjectId(params.projectId);
        items = items.filter((item) => item.projectId === projectId);
      }
      if (params.milestoneId) {
        if (params.milestoneId === 'none') {
          items = items.filter((item) => !item.milestoneId);
        } else {
          items = items.filter((item) => item.milestoneId === params.milestoneId);
        }
      }
      const overdueRequested =
        params.overdue === true ||
        params.overdue === 'true' ||
        String(params.due || '').toLowerCase() === 'overdue';
      const dueToken = String(params.due || '').toLowerCase();
      if (overdueRequested) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const cutoff = startOfToday.getTime();
        items = items.filter((item) => {
          const due = item.dueDate ? new Date(item.dueDate).getTime() : NaN;
          return (
            Number.isFinite(due) &&
            due < cutoff &&
            item.status !== 'Completed' &&
            item.status !== 'Cancelled'
          );
        });
      } else if (dueToken === 'today') {
        const now = new Date();
        const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        items = items.filter((item) => {
          if (item.status === 'Completed' || item.status === 'Cancelled' || !item.dueDate) return false;
          const d = new Date(item.dueDate);
          if (Number.isNaN(d.getTime())) return false;
          const itemYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return itemYmd === ymd;
        });
      } else if (dueToken === 'open') {
        items = items.filter(
          (item) => item.status !== 'Completed' && item.status !== 'Cancelled'
        );
      }
      if (params.status) {
        const statusLower = String(params.status).toLowerCase();
        if (statusLower === 'open' || statusLower === 'active') {
          items = items.filter((item) => item.status !== 'Completed');
        } else {
          items = items.filter((item) => item.status === params.status);
        }
      }
      if (params.priority) items = items.filter((item) => item.priority === params.priority);
      if (params.ids) {
        const idSet = new Set(
          String(params.ids)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        );
        items = items.filter((item) => idSet.has(item._id));
      }
      if (params.clientFeedbackStatus) items = items.filter((item) => item.clientFeedbackStatus === params.clientFeedbackStatus);
      if (params.isRecurring !== undefined && params.isRecurring !== '') {
        const boolVal = String(params.isRecurring) === 'true';
        items = items.filter((item) => Boolean(item.isRecurring) === boolVal);
      }
      if (params.watching !== undefined && params.watching !== '') {
        const boolVal = String(params.watching) === 'true';
        if (boolVal) {
          items = items.filter((item) => (item.followers && item.followers.length > 0));
        }
      }
      if (params.isArchived !== undefined && params.isArchived !== '' && params.isArchived !== 'all') {
        const boolVal = String(params.isArchived) === 'true';
        items = items.filter((item) => Boolean(item.isArchived) === boolVal);
      } else if (params.isArchived === undefined || params.isArchived === '') {
        items = items.filter((item) => !item.isArchived);
      }
      if (params.assignedTo) items = items.filter((item) => item.assignedTo === params.assignedTo);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.title, item.description, item.projectName, item.assigneeName, item.assignedUsername].some((value) =>
            value?.toLowerCase().includes(term)
          )
        );
      }
      const paged = paginateLocalItems(items, page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  getTask: async (id: string): Promise<ApiResponse<TaskItem>> => {
    try {
      return await request<TaskItem>(`/tasks/${encodeURIComponent(id)}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const all = getUnifiedTasks();
      const item = all.find((task) => task._id === id);
      if (!item) throw new ApiError('Task not found', 404);
      const milestonesMap = getLocalProjectMap(PROJECT_MILESTONES_KEY, INITIAL_MOCK_PROJECT_MILESTONES);
      const subtasksMap = getLocalProjectMap(TASK_SUBTASKS_KEY, INITIAL_MOCK_TASK_SUBTASKS);
      const projects = getLocalProjects();
      const proj = projects.find((p) => p._id === item.projectId);
      const pMilestones = milestonesMap[item.projectId] || [];
      const ms = pMilestones.find((m) => m._id === item.milestoneId);
      const subtasks = subtasksMap[item._id] || [];
      const depTask = item.dependsOnTaskId ? all.find((dt) => dt._id === item.dependsOnTaskId) : null;
      const enriched: TaskItem = {
        ...item,
        projectName: item.projectName || proj?.name,
        clientName: proj?.clientName || 'Internal',
        milestoneTitle: item.milestoneTitle || ms?.title,
        assignedUsername: item.assignedUsername || item.assigneeName || (item.assignedTo ? 'Admin User' : undefined),
        subtaskCount: subtasks.length,
        subtasksCompletedCount: subtasks.filter((st) => st.done).length,
        followerCount: (item.followers || []).length,
        dependsOnTaskTitle: depTask?.title,
        dependsOnTaskStatus: depTask?.status,
        isDependencyBlocked: depTask ? depTask.status !== 'Completed' : false,
        clientFeedbackStatus: item.clientFeedbackStatus || 'Pending Review',
      };
      return { success: true, data: enriched };
    }
  },

  createTask: async (
    body: TaskCreateInput & Partial<ProjectTaskSummary>
  ): Promise<ApiResponse<TaskItem>> => {
    try {
      return await request<TaskItem>('/tasks', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.title?.trim()) throw new ApiError('Task title is required', 400);
      if (!body.projectId) throw new ApiError('projectId is required', 400);
      const list = getLocalProjectList(TASKS_STORE_KEY, INITIAL_WAVE_TASKS);
      const project = getLocalProjects().find((item) => item._id === body.projectId);
      const created: TaskItem = {
        _id: `task_${Date.now()}`,
        ...body,
        projectId: body.projectId,
        projectName: project?.name,
        title: body.title.trim(),
        status: body.status || 'To Do',
        priority: body.priority || 'Medium',
        dueDate: body.dueDate || null,
        startDate: body.startDate || null,
        assignedTo: body.assignedTo || body.assigneeId,
        assigneeName: body.assigneeName,
        milestoneId: body.milestoneId || null,
        dependsOnTaskId: body.dependsOnTaskId || null,
        templateId: body.templateId || null,
        notifyClientOnCompletion: Boolean(body.notifyClientOnCompletion),
        clientNotifiedAt: body.clientNotifiedAt || null,
        clientNotifiedEmail: body.clientNotifiedEmail || null,
        lastReminderSentAt: body.lastReminderSentAt || null,
        reminderCount: body.reminderCount || 0,
        isRecurring: Boolean(body.isRecurring),
        recurringEvery: Number(body.recurringEvery || body.every || 1),
        recurringInterval: body.recurringInterval || body.interval || 'month',
        recurringTotalCycles: Number(body.recurringTotalCycles !== undefined ? body.recurringTotalCycles : (body.cycles || 0)),
        recurringCyclesCompleted: 0,
        recurringNextDate: body.recurringNextDate || body.nextDate || null,
        clientSatisfied: body.clientSatisfied ?? null,
        clientFeedbackStatus: body.clientFeedbackStatus || 'Pending Review',
        clientFeedbackNotes: body.clientFeedbackNotes || '',
        followers: body.followers || [],
        description: body.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (created.status === 'Completed' && created.notifyClientOnCompletion) {
        let clientEmail = '';
        if (project?.clientId) {
          const clients = getLocalClients();
          const cl = clients.find((c) => c._id === project.clientId);
          clientEmail = cl?.email || cl?.primaryContact?.email || '';
        }
        if (!clientEmail && project?.clientName) {
          clientEmail = `${project.clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;
        }
        if (!clientEmail) {
          clientEmail = 'client@example.com';
        }
        const now = new Date().toISOString();
        created.clientNotifiedAt = now;
        created.clientNotifiedEmail = clientEmail;

        const commentsMap = getLocalProjectMap(TASK_COMMENTS_KEY, INITIAL_MOCK_TASK_COMMENTS);
        commentsMap[created._id] = [
          {
            _id: `comment_${Date.now()}`,
            taskId: created._id,
            userName: 'System',
            body: `**Completion notification email sent to client** (${clientEmail}) on ${new Date(now).toLocaleString()}`,
            createdAt: now,
          },
          ...(commentsMap[created._id] || []),
        ];
        saveLocalProjectMap(TASK_COMMENTS_KEY, commentsMap);

        pushProjectActivity(
          body.projectId,
          'task_completion_notified',
          `Completion email notification sent to client (${clientEmail}) for task: "${created.title}"`
        );
      }

      list.unshift(created);
      saveLocalProjectList(TASKS_STORE_KEY, list);
      const map = getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS);
      map[body.projectId] = [created, ...(map[body.projectId] || [])];
      saveLocalProjectMap(PROJECT_TASKS_KEY, map);

      if (Array.isArray(body.subtasks) && body.subtasks.length > 0) {
        const subtasksMap = getLocalProjectMap(TASK_SUBTASKS_KEY, INITIAL_MOCK_TASK_SUBTASKS);
        subtasksMap[created._id] = body.subtasks.map((st, i) => ({
          _id: `st_${Date.now()}_${i}`,
          taskId: created._id,
          title: st.title.trim(),
          description: st.description || '',
          done: false,
          isCompleted: false,
          currentDate: st.currentDate || null,
          assignedTo: st.assignedTo || created.assignedTo,
          createdAt: new Date().toISOString(),
        }));
        saveLocalProjectMap(TASK_SUBTASKS_KEY, subtasksMap);
      }

      refreshProjectTaskCounts(body.projectId);
      pushProjectActivity(body.projectId, 'task_created', `Created task “${created.title}”`);
      const createMsg = created.clientNotifiedAt
        ? `Task created & completion email notification sent to client (${created.clientNotifiedEmail || 'client'})`
        : 'Task created';
      return { success: true, data: created, message: createMsg };
    }
  },

  updateTask: async (
    id: string,
    body: Partial<TaskCreateInput & ProjectTaskSummary>
  ): Promise<ApiResponse<TaskItem>> => {
    try {
      return await request<TaskItem>(`/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(TASKS_STORE_KEY, INITIAL_WAVE_TASKS);
      const index = list.findIndex((item) => item._id === id);
      const map = getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS);

      let existing = index >= 0 ? list[index] : null;
      let existingProjectId = existing?.projectId || '';
      if (!existing) {
        for (const pid of Object.keys(map)) {
          const found = map[pid].find((item) => item._id === id);
          if (found) {
            existing = projectTaskToItem(found);
            existingProjectId = pid;
            break;
          }
        }
      }

      if (!existing && index < 0) throw new ApiError('Task not found', 404);

      const wasCompleted = existing?.status === 'Completed';
      const isNowCompleted = body.status === 'Completed';
      const willBeCompleted = isNowCompleted || (body.status === undefined && wasCompleted);
      const notifyFlag =
        body.notifyClientOnCompletion !== undefined
          ? body.notifyClientOnCompletion
          : existing?.notifyClientOnCompletion;
      const shouldNotify =
        notifyFlag &&
        ((isNowCompleted && !wasCompleted) ||
          (willBeCompleted && body.notifyClientOnCompletion === true && !existing?.clientNotifiedAt));

      let clientEmail = existing?.clientNotifiedEmail || '';
      let completionEmailSent = false;
      if (shouldNotify) {
        const projectId = body.projectId || existing?.projectId || existingProjectId;
        const project = getLocalProjects().find((p) => p._id === projectId);
        if (project?.clientId) {
          const clients = getLocalClients();
          const cl = clients.find((c) => c._id === project.clientId);
          clientEmail = cl?.email || cl?.primaryContact?.email || '';
        }
        if (!clientEmail && project?.clientName) {
          clientEmail = `${project.clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;
        }
        if (!clientEmail) {
          clientEmail = 'client@example.com';
        }
        const now = new Date().toISOString();
        body.clientNotifiedAt = now;
        body.clientNotifiedEmail = clientEmail;
        completionEmailSent = true;

        const commentsMap = getLocalProjectMap(TASK_COMMENTS_KEY, INITIAL_MOCK_TASK_COMMENTS);
        commentsMap[id] = [
          {
            _id: `comment_${Date.now()}`,
            taskId: id,
            userName: 'System',
            body: `**Completion notification email sent to client** (${clientEmail}) on ${new Date(now).toLocaleString()}`,
            createdAt: now,
          },
          ...(commentsMap[id] || []),
        ];
        saveLocalProjectMap(TASK_COMMENTS_KEY, commentsMap);

        if (projectId) {
          pushProjectActivity(
            projectId,
            'task_completion_notified',
            `Completion email notification sent to client (${clientEmail}) for task: "${existing?.title || body.title || 'Task'}"`
          );
        }
      }

      if (index >= 0) {
        list[index] = { ...list[index], ...body, updatedAt: new Date().toISOString() };
        saveLocalProjectList(TASKS_STORE_KEY, list);
      }
      for (const projectId of Object.keys(map)) {
        const projectIndex = map[projectId].findIndex((item) => item._id === id);
        if (projectIndex < 0) continue;
        map[projectId][projectIndex] = {
          ...map[projectId][projectIndex],
          ...body,
          updatedAt: new Date().toISOString(),
        };
        saveLocalProjectMap(PROJECT_TASKS_KEY, map);
        refreshProjectTaskCounts(projectId);
      }

      const updatedTask = index >= 0 ? list[index] : existing ? { ...existing, ...body } : null;
      const message = completionEmailSent
        ? `Task updated & completion email notification sent to client (${clientEmail})`
        : 'Task updated';
      return { success: true, data: updatedTask as TaskItem, message };
    }
  },

  deleteTask: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(TASKS_STORE_KEY, INITIAL_WAVE_TASKS);
      saveLocalProjectList(TASKS_STORE_KEY, list.filter((item) => item._id !== id));
      const map = getLocalProjectMap(PROJECT_TASKS_KEY, INITIAL_MOCK_PROJECT_TASKS);
      Object.keys(map).forEach((projectId) => {
        const before = map[projectId].length;
        map[projectId] = map[projectId].filter((item) => item._id !== id);
        if (map[projectId].length !== before) refreshProjectTaskCounts(projectId);
      });
      saveLocalProjectMap(PROJECT_TASKS_KEY, map);
      return { success: true, data: { deleted: true } };
    }
  },

  getTaskTemplates: async (): Promise<ApiResponse<TaskTemplate[]>> => {
    try {
      return await request<TaskTemplate[]>('/tasks/templates', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalProjectList(TASK_TEMPLATES_STORE_KEY, INITIAL_MOCK_TASK_TEMPLATES),
      };
    }
  },

  getTaskTemplate: async (id: string): Promise<ApiResponse<TaskTemplate>> => {
    try {
      return await request<TaskTemplate>(`/tasks/templates/${encodeURIComponent(id)}`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(TASK_TEMPLATES_STORE_KEY, INITIAL_MOCK_TASK_TEMPLATES);
      const found = list.find((t) => t._id === id);
      if (!found) throw new ApiError('Task template not found', 404);
      return { success: true, data: found };
    }
  },

  createTaskTemplate: async (body: Partial<TaskTemplate>): Promise<ApiResponse<TaskTemplate>> => {
    try {
      return await request<TaskTemplate>('/tasks/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.title?.trim() && !body.name?.trim()) {
        throw new ApiError('Template title is required', 400);
      }
      const title = (body.title || body.name || '').trim();
      const list = getLocalProjectList(TASK_TEMPLATES_STORE_KEY, INITIAL_MOCK_TASK_TEMPLATES);
      const created: TaskTemplate = {
        _id: `tpl_${Date.now()}`,
        name: title,
        title: title,
        category: body.category?.trim() || 'General',
        priority: body.priority || 'Medium',
        hoursEstimate: Number(body.hoursEstimate) || 0,
        tags: Array.isArray(body.tags) ? body.tags : [],
        description: body.description?.trim() || '',
        subtasks: Array.isArray(body.subtasks)
          ? body.subtasks.map((st) => ({
              title: st.title.trim(),
              description: st.description?.trim() || '',
            }))
          : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.unshift(created);
      saveLocalProjectList(TASK_TEMPLATES_STORE_KEY, list);
      return { success: true, data: created };
    }
  },

  updateTaskTemplate: async (
    id: string,
    body: Partial<TaskTemplate>
  ): Promise<ApiResponse<TaskTemplate>> => {
    try {
      return await request<TaskTemplate>(`/tasks/templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(TASK_TEMPLATES_STORE_KEY, INITIAL_MOCK_TASK_TEMPLATES);
      const idx = list.findIndex((t) => t._id === id);
      if (idx < 0) throw new ApiError('Task template not found', 404);
      const updated: TaskTemplate = {
        ...list[idx],
        ...body,
        name: body.title || body.name || list[idx].name,
        title: body.title || body.name || list[idx].title,
        updatedAt: new Date().toISOString(),
      };
      list[idx] = updated;
      saveLocalProjectList(TASK_TEMPLATES_STORE_KEY, list);
      return { success: true, data: updated };
    }
  },

  deleteTaskTemplate: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/tasks/templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(TASK_TEMPLATES_STORE_KEY, INITIAL_MOCK_TASK_TEMPLATES);
      saveLocalProjectList(
        TASK_TEMPLATES_STORE_KEY,
        list.filter((t) => t._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  instantiateTaskTemplate: async (
    templateId: string,
    payload: {
      projectId: string;
      milestoneId?: string;
      assignedTo?: string;
      dueDate?: string;
      title?: string;
    }
  ): Promise<ApiResponse<TaskItem>> => {
    try {
      return await request<TaskItem>(
        `/tasks/templates/${encodeURIComponent(templateId)}/instantiate`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(TASK_TEMPLATES_STORE_KEY, INITIAL_MOCK_TASK_TEMPLATES);
      const tpl = list.find((t) => t._id === templateId);
      if (!tpl) throw new ApiError('Task template not found', 404);
      if (!payload.projectId) throw new ApiError('Project is required', 400);

      const created = await crmApi.createTask({
        projectId: payload.projectId,
        milestoneId: payload.milestoneId || null,
        title: payload.title?.trim() || tpl.title || tpl.name,
        description: tpl.description || '',
        priority: tpl.priority || 'Medium',
        status: 'To Do',
        assignedTo: payload.assignedTo || '',
        dueDate: payload.dueDate || null,
        templateId: tpl._id,
        subtasks: (tpl.subtasks || []).map((st) => ({
          title: st.title,
          description: st.description || '',
        })),
      });
      return created;
    }
  },

  saveTaskAsTemplate: async (
    taskId: string,
    payload?: { title?: string; category?: string }
  ): Promise<ApiResponse<TaskTemplate>> => {
    try {
      return await request<TaskTemplate>(
        `/tasks/${encodeURIComponent(taskId)}/save-as-template`,
        {
          method: 'POST',
          body: JSON.stringify(payload || {}),
        }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const taskRes = await crmApi.getTask(taskId);
      const task = taskRes.data;
      const subRes = await crmApi.getTaskSubtasks(taskId);
      const subtasks = subRes.data || [];

      const tplTitle = payload?.title?.trim() || `${task.title} (Template)`;
      return await crmApi.createTaskTemplate({
        title: tplTitle,
        name: tplTitle,
        category: payload?.category?.trim() || 'General',
        priority: task.priority,
        description: task.description || '',
        subtasks: subtasks.map((st) => ({
          title: st.title,
          description: st.description || '',
        })),
      });
    }
  },

  sendTaskReminder: async (
    taskId: string
  ): Promise<ApiResponse<{ message: string; task?: TaskItem }>> => {
    try {
      return await request<{ message: string; task?: TaskItem }>(
        `/tasks/${encodeURIComponent(taskId)}/send-reminder`,
        {
          method: 'POST',
        }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const result = dispatchTaskReminderMock(taskId);
      return {
        success: true,
        data: { message: result.message, task: result.task },
        message: result.message,
      };
    }
  },

  processRecurringTasks: async (): Promise<
    ApiResponse<{ processed: number; generated: number; message: string }>
  > => {
    try {
      return await request<{ processed: number; generated: number; message: string }>(
        '/tasks/recurring/process',
        { method: 'POST' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const allTasks = getLocalProjectList(TASKS_STORE_KEY, INITIAL_WAVE_TASKS);
      const now = new Date();
      let generated = 0;

      for (const t of allTasks) {
        if (!t.isRecurring || !t.recurringNextDate) continue;
        const nextDate = new Date(t.recurringNextDate);
        if (nextDate <= now) {
          if (
            t.recurringTotalCycles &&
            t.recurringTotalCycles > 0 &&
            (t.recurringCyclesCompleted || 0) >= t.recurringTotalCycles
          ) {
            continue;
          }

          const interval = t.recurringInterval || t.interval || 'month';
          const every = Number(t.recurringEvery || t.every || 1);
          const advancedDate = new Date(nextDate);
          if (interval === 'day') advancedDate.setDate(advancedDate.getDate() + every);
          else if (interval === 'week') advancedDate.setDate(advancedDate.getDate() + every * 7);
          else if (interval === 'month') advancedDate.setMonth(advancedDate.getMonth() + every);
          else if (interval === 'quarter') advancedDate.setMonth(advancedDate.getMonth() + every * 3);
          else if (interval === 'year') advancedDate.setFullYear(advancedDate.getFullYear() + every);

          t.recurringCyclesCompleted = (t.recurringCyclesCompleted || 0) + 1;
          t.recurringNextDate = advancedDate.toISOString().slice(0, 10);

          const subtasksMap = getLocalProjectMap(TASK_SUBTASKS_KEY, INITIAL_MOCK_TASK_SUBTASKS);
          const originalSubtasks = subtasksMap[t._id] || [];

          await crmApi.createTask({
            projectId: t.projectId,
            milestoneId: t.milestoneId || null,
            title: `${t.title} (Cycle ${t.recurringCyclesCompleted})`,
            description: t.description,
            priority: t.priority,
            status: 'To Do',
            assignedTo: t.assignedTo,
            dueDate: advancedDate.toISOString().slice(0, 10),
            subtasks: originalSubtasks.map((st) => ({
              title: st.title,
              description: st.description || '',
            })),
          });
          generated++;
        }
      }

      saveLocalProjectList(TASKS_STORE_KEY, allTasks);
      return {
        success: true,
        data: {
          processed: allTasks.filter((t) => t.isRecurring).length,
          generated,
          message:
            generated > 0
              ? `Generated ${generated} recurring task instance(s)`
              : 'All recurring task schedules are up to date.',
        },
      };
    }
  },

  listTaskStatuses: async (): Promise<ApiResponse<string[]>> => {
    return { success: true, data: [...TASK_STATUSES] };
  },

  listTaskPriorities: async (): Promise<ApiResponse<string[]>> => {
    return { success: true, data: [...TASK_PRIORITIES] };
  },

  getProjectMembers: async (id: string): Promise<ApiResponse<ProjectMember[]>> => {
    try {
      return await request<ProjectMember[]>(`/projects/${encodeURIComponent(id)}/members`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalProjectMap(PROJECT_MEMBERS_KEY, INITIAL_MOCK_PROJECT_MEMBERS)[id] || [],
      };
    }
  },

  addProjectMember: async (
    id: string,
    payload: { userId: string; hourlyRate?: number; userName?: string; email?: string; role?: string }
  ): Promise<ApiResponse<ProjectMember>> => {
    try {
      return await request<ProjectMember>(`/projects/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!payload.userId) throw new ApiError('userId is required', 400);
      const map = getLocalProjectMap(PROJECT_MEMBERS_KEY, INITIAL_MOCK_PROJECT_MEMBERS);
      const list = map[id] || [];
      if (list.some((m) => m.userId === payload.userId)) {
        throw new ApiError('Member already on project', 400);
      }
      const member: ProjectMember = {
        userId: payload.userId,
        userName: payload.userName || payload.userId,
        email: payload.email,
        role: payload.role || 'Member',
        hourlyRate: Number(payload.hourlyRate) || 0,
        addedAt: new Date().toISOString(),
      };
      map[id] = [...list, member];
      saveLocalProjectMap(PROJECT_MEMBERS_KEY, map);
      pushProjectActivity(id, 'member_added', `Added ${member.userName} to the project`);
      return { success: true, data: member };
    }
  },

  updateProjectMember: async (
    projectId: string,
    userId: string,
    body: { hourlyRate?: number; role?: string }
  ): Promise<ApiResponse<ProjectMember>> => {
    try {
      return await request<ProjectMember>(
        `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(PROJECT_MEMBERS_KEY, INITIAL_MOCK_PROJECT_MEMBERS);
      const list = map[projectId] || [];
      const idx = list.findIndex((m) => m.userId === userId);
      if (idx < 0) throw new ApiError('Member not found', 404);
      list[idx] = { ...list[idx], ...body };
      map[projectId] = list;
      saveLocalProjectMap(PROJECT_MEMBERS_KEY, map);
      return { success: true, data: list[idx] };
    }
  },

  removeProjectMember: async (
    projectId: string,
    userId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(PROJECT_MEMBERS_KEY, INITIAL_MOCK_PROJECT_MEMBERS);
      map[projectId] = (map[projectId] || []).filter((m) => m.userId !== userId);
      saveLocalProjectMap(PROJECT_MEMBERS_KEY, map);
      pushProjectActivity(projectId, 'member_removed', `Removed member ${userId}`);
      return { success: true, data: { deleted: true } };
    }
  },

  getProjectMilestones: async (projectId: string): Promise<ApiResponse<ProjectMilestone[]>> => {
    try {
      return await request<ProjectMilestone[]>(
        `/projects/${encodeURIComponent(projectId)}/milestones`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data:
          getLocalProjectMap(PROJECT_MILESTONES_KEY, INITIAL_MOCK_PROJECT_MILESTONES)[
            projectId
          ] || [],
      };
    }
  },

  createProjectMilestone: async (
    projectId: string,
    body: {
      title: string;
      description?: string;
      summary?: string;
      dueDate?: string;
      startDate?: string | null;
      endDate?: string | null;
      status?: string;
      cost?: number;
      addCostToBudget?: boolean;
    }
  ): Promise<ApiResponse<ProjectMilestone>> => {
    try {
      return await request<ProjectMilestone>(
        `/projects/${encodeURIComponent(projectId)}/milestones`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: body.title,
            summary: body.summary || body.description || '',
            description: body.description || body.summary || '',
            dueDate: body.dueDate || body.endDate || undefined,
            startDate: body.startDate || undefined,
            endDate: body.endDate || body.dueDate || undefined,
            status: body.status || 'Pending',
            cost: body.cost,
            addCostToBudget: body.addCostToBudget,
            projectId,
          }),
        }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.title?.trim()) throw new ApiError('Milestone title is required', 400);
      const map = getLocalProjectMap(PROJECT_MILESTONES_KEY, INITIAL_MOCK_PROJECT_MILESTONES);
      const list = map[projectId] || [];
      const created: ProjectMilestone = {
        _id: `ms_${Date.now()}`,
        projectId,
        title: body.title.trim(),
        description: body.description || body.summary || '',
        summary: body.summary || body.description || '',
        dueDate: body.dueDate || body.endDate || null,
        startDate: body.startDate || null,
        endDate: body.endDate || body.dueDate || null,
        status: body.status || 'Pending',
        cost: Number(body.cost) || 0,
        addCostToBudget: Boolean(body.addCostToBudget),
        order: list.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      map[projectId] = [...list, created];
      saveLocalProjectMap(PROJECT_MILESTONES_KEY, map);
      pushProjectActivity(projectId, 'milestone_created', `Created milestone “${created.title}”`);
      return { success: true, data: created };
    }
  },

  updateMilestone: async (
    id: string,
    body: Partial<ProjectMilestone>
  ): Promise<ApiResponse<ProjectMilestone>> => {
    try {
      return await request<ProjectMilestone>(`/milestones/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(PROJECT_MILESTONES_KEY, INITIAL_MOCK_PROJECT_MILESTONES);
      for (const projectId of Object.keys(map)) {
        const idx = (map[projectId] || []).findIndex((m) => m._id === id);
        if (idx < 0) continue;
        map[projectId][idx] = {
          ...map[projectId][idx],
          ...body,
          updatedAt: new Date().toISOString(),
        };
        saveLocalProjectMap(PROJECT_MILESTONES_KEY, map);
        return { success: true, data: map[projectId][idx] };
      }
      throw new ApiError('Milestone not found', 404);
    }
  },

  deleteMilestone: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/milestones/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(PROJECT_MILESTONES_KEY, INITIAL_MOCK_PROJECT_MILESTONES);
      for (const projectId of Object.keys(map)) {
        const before = map[projectId]?.length || 0;
        map[projectId] = (map[projectId] || []).filter((m) => m._id !== id);
        if (map[projectId].length !== before) {
          saveLocalProjectMap(PROJECT_MILESTONES_KEY, map);
          return { success: true, data: { deleted: true } };
        }
      }
      return { success: true, data: { deleted: true } };
    }
  },

  getProjectDocuments: async (
    id: string,
    params: { category?: string; milestoneId?: string; taskId?: string } = {}
  ): Promise<ApiResponse<ProjectDocument[]>> => {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.milestoneId) query.set('milestoneId', params.milestoneId);
    if (params.taskId) query.set('taskId', params.taskId);
    const qs = query.toString();
    const normalize = (raw: Record<string, unknown>, projectId = id): ProjectDocument => ({
      _id: String(raw._id || ''),
      projectId: String(raw.projectId || projectId),
      name: String(raw.name || raw.originalName || raw.fileName || 'Document'),
      url: String(raw.url || raw.fileUrl || ''),
      category: String(raw.category || 'General'),
      description: raw.description ? String(raw.description) : undefined,
      mimeType: raw.mimeType ? String(raw.mimeType) : undefined,
      size: Number(raw.fileSize || raw.size || 0) || undefined,
      milestoneId: (raw.milestoneId as string | null | undefined) ?? null,
      taskId: (raw.taskId as string | null | undefined) ?? null,
      uploadedBy: raw.uploadedBy ? String(raw.uploadedBy) : undefined,
      uploadedByName: raw.uploadedByName ? String(raw.uploadedByName) : undefined,
      storageProvider: raw.storageProvider ? String(raw.storageProvider) : undefined,
      createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    });
    try {
      const response = await request<Record<string, unknown>[]>(
        qs
          ? `/projects/${encodeURIComponent(id)}/documents?${qs}`
          : `/projects/${encodeURIComponent(id)}/documents`,
        { method: 'GET' }
      );
      return {
        ...response,
        data: (response.data || []).map((row) => normalize(row, id)),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items =
        getLocalProjectMap(PROJECT_DOCUMENTS_KEY, INITIAL_MOCK_PROJECT_DOCUMENTS)[id] || [];
      if (params.category) items = items.filter((d) => d.category === params.category);
      return { success: true, data: items.map((row) => normalize(row as unknown as Record<string, unknown>, id)) };
    }
  },

  createProjectDocument: async (
    id: string,
    body: {
      name: string;
      url: string;
      category?: string;
      description?: string;
      milestoneId?: string | null;
      taskId?: string | null;
    }
  ): Promise<ApiResponse<ProjectDocument>> => {
    const payload = {
      name: body.name,
      fileName: body.name,
      originalName: body.name,
      url: body.url,
      fileUrl: body.url,
      category: body.category || 'General',
      description: body.description || '',
      milestoneId: body.milestoneId || null,
      taskId: body.taskId || null,
      storageProvider: 'url',
    };
    try {
      const response = await request<Record<string, unknown>>(
        `/projects/${encodeURIComponent(id)}/documents`,
        { method: 'POST', body: JSON.stringify(payload) }
      );
      const raw = (response.data || {}) as Record<string, unknown>;
      return {
        ...response,
        data: {
          _id: String(raw._id || ''),
          projectId: id,
          name: String(raw.name || raw.originalName || raw.fileName || body.name),
          url: String(raw.url || raw.fileUrl || body.url),
          category: String(raw.category || body.category || 'General'),
          description: String(raw.description || body.description || ''),
          milestoneId: (raw.milestoneId as string | null | undefined) ?? body.milestoneId ?? null,
          taskId: (raw.taskId as string | null | undefined) ?? body.taskId ?? null,
          uploadedBy: raw.uploadedBy ? String(raw.uploadedBy) : undefined,
          storageProvider: raw.storageProvider ? String(raw.storageProvider) : 'external',
          createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
        },
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.name?.trim() || !body.url?.trim()) {
        throw new ApiError('Document name and URL are required', 400);
      }
      const map = getLocalProjectMap(PROJECT_DOCUMENTS_KEY, INITIAL_MOCK_PROJECT_DOCUMENTS);
      const created: ProjectDocument = {
        _id: `doc_${Date.now()}`,
        projectId: id,
        name: body.name.trim(),
        url: body.url.trim(),
        category: body.category || 'General',
        description: body.description || '',
        milestoneId: body.milestoneId || null,
        taskId: body.taskId || null,
        uploadedBy: 'Admin User',
        storageProvider: 'external',
        createdAt: new Date().toISOString(),
      };
      map[id] = [created, ...(map[id] || [])];
      saveLocalProjectMap(PROJECT_DOCUMENTS_KEY, map);
      pushProjectActivity(id, 'document_added', `Added document “${created.name}”`);
      return { success: true, data: created };
    }
  },

  uploadProjectDocument: async (
    id: string,
    file: File,
    meta: {
      category?: string;
      description?: string;
      milestoneId?: string | null;
      taskId?: string | null;
    } = {}
  ): Promise<ApiResponse<ProjectDocument>> => {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('document', file);
      if (meta.category) form.append('category', meta.category);
      if (meta.description) form.append('description', meta.description);
      if (meta.milestoneId) form.append('milestoneId', meta.milestoneId);
      if (meta.taskId) form.append('taskId', meta.taskId);
      const url = `${API_BASE}/projects/${encodeURIComponent(id)}/documents/upload`;
      const response = await fetch(url, { method: 'POST', credentials: 'include', body: form });
      const payload = await response.json().catch(() => ({ success: false }));
      if (!response.ok || !payload.success) {
        throw new ApiError(payload.error || payload.message || 'Upload failed', response.status || 500);
      }
      const raw = (payload.data || {}) as Record<string, unknown>;
      const normalized: ProjectDocument = {
        _id: String(raw._id || ''),
        projectId: id,
        name: String(raw.name || raw.originalName || raw.fileName || file.name),
        url: String(raw.url || raw.fileUrl || ''),
        category: String(raw.category || meta.category || 'General'),
        description: String(raw.description || meta.description || ''),
        mimeType: String(raw.mimeType || file.type || ''),
        size: Number(raw.fileSize || raw.size || file.size) || undefined,
        milestoneId: (raw.milestoneId as string | null | undefined) ?? meta.milestoneId ?? null,
        taskId: (raw.taskId as string | null | undefined) ?? meta.taskId ?? null,
        uploadedBy: raw.uploadedBy ? String(raw.uploadedBy) : undefined,
        uploadedByName: raw.uploadedByName ? String(raw.uploadedByName) : undefined,
        storageProvider: String(raw.storageProvider || 's3'),
        createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
      };
      return { ...payload, data: normalized };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const objectUrl = URL.createObjectURL(file);
      return crmApi.createProjectDocument(id, {
        name: file.name,
        url: objectUrl,
        category: meta.category || 'General',
        description: meta.description,
        milestoneId: meta.milestoneId,
        taskId: meta.taskId,
      });
    }
  },

  deleteProjectDocument: async (
    projectId: string,
    documentId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(PROJECT_DOCUMENTS_KEY, INITIAL_MOCK_PROJECT_DOCUMENTS);
      map[projectId] = (map[projectId] || []).filter((d) => d._id !== documentId);
      saveLocalProjectMap(PROJECT_DOCUMENTS_KEY, map);
      return { success: true, data: { deleted: true } };
    }
  },

  getTimeLogs: async (
    params: {
      page?: number;
      limit?: number;
      projectId?: string;
      taskId?: string;
      status?: string;
      search?: string;
    } = {}
  ): Promise<ApiResponse<ProjectTimeLog[]>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.taskId) query.set('taskId', params.taskId);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    try {
      const res = await request<ProjectTimeLog[]>(qs ? `/time-logs?${qs}` : '/time-logs', {
        method: 'GET',
      });
      if (res.data && Array.isArray(res.data)) {
        res.data = res.data.map((item) => {
          const rawNote = item.description || item.note || '';
          const rawDate = item.workDate || item.date || item.createdAt || '';
          const isBill = item.isBillable !== undefined ? Boolean(item.isBillable) : (item.billable !== undefined ? Boolean(item.billable) : true);
          return {
            ...item,
            note: rawNote,
            description: rawNote,
            date: rawDate,
            workDate: rawDate,
            billable: isBill,
            isBillable: isBill,
          };
        });
      }
      return res;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getUnifiedTimeLogs();
      if (params.projectId) {
        const projectId = resolveProjectId(params.projectId);
        items = items.filter((t) => t.projectId === projectId);
      }
      if (params.taskId) items = items.filter((t) => t.taskId === params.taskId);
      if (params.status) items = items.filter((t) => t.status === params.status);
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (t) =>
            t.note?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.taskTitle?.toLowerCase().includes(q) ||
            t.userName?.toLowerCase().includes(q)
        );
      }
      return {
        success: true,
        data: items.map((item) => {
          const rawNote = item.description || item.note || '';
          const rawDate = item.workDate || item.date || item.createdAt || '';
          const isBill = item.isBillable ?? item.billable ?? true;
          return {
            _id: item._id,
            projectId: item.projectId || '',
            taskId: item.taskId,
            taskTitle: item.taskTitle,
            userId: item.userId,
            userName: item.userName,
            hours: item.hours,
            hourlyRate: item.hourlyRate,
            note: rawNote,
            description: rawNote,
            date: rawDate,
            workDate: rawDate,
            billable: isBill,
            isBillable: isBill,
            createdAt: item.createdAt,
          };
        }),
      };
    }
  },

  createTimeLog: async (
    body: Partial<TimeLogCreateInput & ProjectTimeLog> & {
      projectId: string;
      hours: number;
      date?: string;
      workDate?: string;
      taskTitle?: string;
    }
  ): Promise<ApiResponse<ProjectTimeLog>> => {
    const rawNote = (body.description || body.note || '').trim();
    const rawDate = body.workDate || body.date || new Date().toISOString().slice(0, 10);
    const isBill = body.isBillable !== undefined ? Boolean(body.isBillable) : (body.billable !== undefined ? Boolean(body.billable) : true);

    const payload = {
      ...body,
      note: rawNote,
      description: rawNote,
      date: rawDate,
      workDate: rawDate,
      billable: isBill,
      isBillable: isBill,
    };

    try {
      return await request<ProjectTimeLog>('/time-logs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.projectId) throw new ApiError('projectId is required', 400);
      if (!(Number(body.hours) > 0)) throw new ApiError('hours must be greater than 0', 400);
      const projectId = resolveProjectId(body.projectId);
      const workDate = body.workDate || body.date;
      if (!workDate) throw new ApiError('workDate is required', 400);
      const project = getLocalProjects().find((p) => p._id === projectId);
      const task = body.taskId
        ? getUnifiedTasks().find((t) => t._id === body.taskId)
        : undefined;
      const rate = Number(body.hourlyRate) || 0;
      const isBillable = body.isBillable ?? body.billable ?? true;
      const hours = Number(body.hours);
      const created: TimeLogItem = {
        _id: `tl_${Date.now()}`,
        projectId,
        projectName: project?.name,
        taskId: body.taskId || '',
        taskTitle: body.taskTitle || task?.title,
        userId: body.userId || 'dev-admin',
        userName: body.userName || 'Admin User',
        hours,
        hourlyRate: rate,
        workDate,
        date: workDate,
        isBillable,
        billable: isBillable,
        billableAmount: computeBillableAmount(hours, rate, isBillable),
        description: body.description || body.note || '',
        note: body.description || body.note || '',
        status: 'Completed',
        entryType: body.entryType || 'manual',
        approvalStatus: 'Draft',
        isLocked: false,
        createdAt: new Date().toISOString(),
      };
      saveUnifiedTimeLog(created);
      refreshProjectTaskCounts(projectId);
      pushProjectActivity(
        projectId,
        'time_logged',
        `Logged ${created.hours}h${created.note ? ` — ${created.note}` : ''}`
      );
      return {
        success: true,
        data: {
          _id: created._id,
          projectId,
          taskId: created.taskId,
          taskTitle: created.taskTitle,
          userId: created.userId,
          userName: created.userName,
          hours: created.hours,
          note: created.note,
          date: workDate,
          billable: created.isBillable,
          createdAt: created.createdAt,
        },
      };
    }
  },

  listTimeLogs: async (
    params: TimeLogQueryParams = {}
  ): Promise<ApiResponse<TimeLogItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit' || key === 'isBillable') return;
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    // Old CRM API expects `billable`, not `isBillable`.
    if (params.isBillable !== undefined && String(params.isBillable) !== '') {
      query.set('billable', String(params.isBillable));
    }
    // Also send sort/order aliases used by shared pagination util.
    if (params.sortBy) query.set('sort', String(params.sortBy));
    if (params.sortDir) query.set('order', String(params.sortDir));
    try {
      const response = await request<TimeLogItem[]>(`/time-logs?${query}`, {
        method: 'GET',
      });
      return {
        ...response,
        data: (response.data || []).map((item) => ({
          ...item,
          approvalStatus: normalizeApprovalStatus(item.approvalStatus),
          entryType: item.entryType || (item.checkInAt || item.checkInTime || item.status === 'Running' ? 'timer' : 'manual'),
          userName:
            item.userName ||
            item.memberUsername ||
            item.username ||
            item.assignedUsername ||
            item.taskAssignedUsername,
          userId: item.userId || item.createdBy,
          hours: resolveTimeLogHours(item),
          billableAmount: resolveTimeLogBillableAmount(item),
          checkInAt: item.checkInAt || item.checkInTime,
          checkOutAt: item.checkOutAt || item.checkOutTime,
        })),
        pagination: fallbackPagination(page, limit, response.data?.length || 0, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getUnifiedTimeLogs().map((item) => ({
        ...item,
        approvalStatus: normalizeApprovalStatus(item.approvalStatus),
        entryType: item.entryType || (item.checkInAt || item.status === 'Running' ? 'timer' : 'manual'),
        billableAmount:
          item.billableAmount ??
          computeBillableAmount(
            Number(item.hours || 0),
            Number(item.hourlyRate || 0),
            Boolean(item.isBillable ?? item.billable)
          ),
      }));
      if (params.projectId) {
        const projectId = resolveProjectId(params.projectId);
        items = items.filter((item) => item.projectId === projectId);
      }
      if (params.userId) {
        const wanted = String(params.userId);
        items = items.filter(
          (item) =>
            String(item.userId || '') === wanted ||
            String(item.createdBy || '') === wanted
        );
      }
      if (params.taskId) items = items.filter((item) => item.taskId === params.taskId);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.description, item.note, item.taskTitle, item.projectName, item.userName].some(
            (value) => value?.toLowerCase().includes(term)
          )
        );
      }
      if (params.approvalStatus) {
        const wanted = normalizeApprovalStatus(params.approvalStatus);
        items = items.filter((item) => normalizeApprovalStatus(item.approvalStatus) === wanted);
      }
      if (params.entryType) items = items.filter((item) => item.entryType === params.entryType);
      if (params.isLocked === true || params.isLocked === 'true') {
        items = items.filter((item) => item.isLocked);
      } else if (params.isLocked === false || params.isLocked === 'false') {
        items = items.filter((item) => !item.isLocked);
      }
      if (params.isBillable === true || params.isBillable === 'true') {
        items = items.filter((item) => item.isBillable ?? item.billable);
      } else if (params.isBillable === false || params.isBillable === 'false') {
        items = items.filter((item) => !(item.isBillable ?? item.billable));
      }
      const sortBy = params.sortBy || 'workDate';
      const dir = params.sortDir === 'asc' ? 1 : -1;
      items.sort((a, b) => {
        const av =
          sortBy === 'hours'
            ? Number(a.hours || 0)
            : sortBy === 'taskTitle'
              ? String(a.taskTitle || '')
              : String(a.workDate || a.date || '');
        const bv =
          sortBy === 'hours'
            ? Number(b.hours || 0)
            : sortBy === 'taskTitle'
              ? String(b.taskTitle || '')
              : String(b.workDate || b.date || '');
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
      const paged = paginateLocalItems(items, page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  checkIn: async (body: TimeLogCheckInInput): Promise<ApiResponse<TimeLogItem>> => {
    try {
      return await request<TimeLogItem>('/time-logs/check-in', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.taskId) throw new ApiError('taskId is required', 400);
      const list = getUnifiedTimeLogs();
      if (list.some((item) => item.status === 'Running')) {
        throw new ApiError('A timer is already running', 400);
      }
      const task = getUnifiedTasks().find((item) => item._id === body.taskId);
      const projectId = resolveProjectId(body.projectId || task?.projectId || '');
      const project = getLocalProjects().find((p) => p._id === projectId);
      const created: TimeLogItem = {
        _id: `time_${Date.now()}`,
        taskId: body.taskId,
        taskTitle: task?.title,
        projectId: projectId || undefined,
        projectName: project?.name || task?.projectName,
        workDate: body.workDate || new Date().toISOString().slice(0, 10),
        date: body.workDate || new Date().toISOString().slice(0, 10),
        hours: 0,
        hourlyRate: body.hourlyRate,
        isBillable: body.isBillable !== false,
        description: body.description,
        entryType: 'timer',
        checkInAt: new Date().toISOString(),
        checkInTime: new Date().toISOString(),
        status: 'Running',
        approvalStatus: 'Draft',
        isLocked: false,
        userId: 'dev-admin',
        userName: 'Admin User',
        createdAt: new Date().toISOString(),
      };
      saveUnifiedTimeLog(created);
      return { success: true, data: created };
    }
  },

  checkOut: async (body: TimeLogCheckOutInput = {}): Promise<ApiResponse<TimeLogItem>> => {
    try {
      return await request<TimeLogItem>('/time-logs/check-out', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const finish = (current: TimeLogItem): TimeLogItem => {
        const startedAt = current.checkInAt || current.checkInTime;
        const started = startedAt ? new Date(startedAt).getTime() : Date.now();
        const hours = Math.max(0.01, Math.round(((Date.now() - started) / 3600000) * 100) / 100);
        const rate = Number(current.hourlyRate) || 0;
        const isBillable = current.isBillable !== false;
        const note = body.description || body.note || current.description || current.note || '';
        return {
          ...current,
          hours,
          checkOutAt: new Date().toISOString(),
          checkOutTime: new Date().toISOString(),
          status: 'Completed',
          entryType: 'timer',
          approvalStatus: 'Draft',
          description: note,
          note,
          billableAmount: computeBillableAmount(hours, rate, isBillable),
          updatedAt: new Date().toISOString(),
        };
      };
      const list = getLocalProjectList(TIME_LOGS_STORE_KEY, INITIAL_WAVE_TIME_LOGS);
      const idx = list.findIndex((item) =>
        body.timeLogId || body.id
          ? item._id === (body.timeLogId || body.id)
          : item.status === 'Running'
      );
      if (idx < 0) {
        const unified = getUnifiedTimeLogs().find((item) =>
          body.timeLogId || body.id
            ? item._id === (body.timeLogId || body.id)
            : item.status === 'Running'
        );
        if (!unified) throw new ApiError('No running timer found', 404);
        const updated = finish(unified);
        saveUnifiedTimeLog(updated);
        if (updated.projectId) refreshProjectTaskCounts(updated.projectId);
        return { success: true, data: updated };
      }
      const updated = finish(list[idx] as TimeLogItem);
      saveUnifiedTimeLog(updated);
      if (updated.projectId) refreshProjectTaskCounts(updated.projectId);
      return { success: true, data: updated };
    }
  },

  getActiveCheckIn: async (): Promise<ApiResponse<TimeLogItem | null>> => {
    try {
      return await request<TimeLogItem | null>('/time-logs/active', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getUnifiedTimeLogs();
      const running = list.find((item) => item.status === 'Running') || null;
      return { success: true, data: running };
    }
  },

  updateTimeLog: async (
    id: string,
    body: Partial<TimeLogCreateInput> & { approvalStatus?: string }
  ): Promise<ApiResponse<TimeLogItem>> => {
    try {
      return await request<TimeLogItem>(`/time-logs/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const current = getUnifiedTimeLogs().find((item) => item._id === id);
      if (!current) throw new ApiError('Time log not found', 404);
      if (current.isLocked) throw new ApiError('Locked time logs cannot be edited', 400);
      const hours = body.hours ?? current.hours;
      const rate = body.hourlyRate ?? current.hourlyRate ?? 0;
      const isBillable = body.isBillable ?? current.isBillable;
      const updated: TimeLogItem = {
        ...current,
        ...body,
        isBillable,
        billable: isBillable,
        hours,
        hourlyRate: rate,
        billableAmount: computeBillableAmount(Number(hours), Number(rate), Boolean(isBillable)),
        workDate: body.workDate || current.workDate,
        date: body.workDate || current.date,
        updatedAt: new Date().toISOString(),
      };
      saveUnifiedTimeLog(updated);
      return { success: true, data: updated };
    }
  },

  deleteTimeLog: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/time-logs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const current = getUnifiedTimeLogs().find((item) => item._id === id);
      if (current?.isLocked) throw new ApiError('Locked time logs cannot be deleted', 400);
      const wave = getLocalProjectList(TIME_LOGS_STORE_KEY, INITIAL_WAVE_TIME_LOGS);
      saveLocalProjectList(
        TIME_LOGS_STORE_KEY,
        wave.filter((item) => item._id !== id)
      );
      const projectLogs = getLocalProjectList(
        PROJECT_TIME_LOGS_KEY,
        INITIAL_MOCK_PROJECT_TIME_LOGS
      );
      saveLocalProjectList(
        PROJECT_TIME_LOGS_KEY,
        projectLogs.filter((item) => item._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  submitTimeLog: async (id: string): Promise<ApiResponse<TimeLogItem>> => {
    try {
      return await request<TimeLogItem>(`/time-logs/${encodeURIComponent(id)}/submit`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return crmApi.updateTimeLog(id, { approvalStatus: 'Pending' } as Partial<TimeLogCreateInput>);
    }
  },

  approveTimeLog: async (id: string): Promise<ApiResponse<TimeLogItem>> => {
    try {
      return await request<TimeLogItem>(`/time-logs/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return crmApi.updateTimeLog(id, { approvalStatus: 'Approved' } as Partial<TimeLogCreateInput>);
    }
  },

  rejectTimeLog: async (
    id: string,
    body: { reason?: string } = {}
  ): Promise<ApiResponse<TimeLogItem>> => {
    try {
      return await request<TimeLogItem>(`/time-logs/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const current = getUnifiedTimeLogs().find((item) => item._id === id);
      if (!current) throw new ApiError('Time log not found', 404);
      if (!body.reason?.trim()) throw new ApiError('Rejection reason is required', 400);
      const updated: TimeLogItem = {
        ...current,
        approvalStatus: 'Rejected',
        rejectionReason: body.reason.trim(),
        updatedAt: new Date().toISOString(),
      };
      saveUnifiedTimeLog(updated);
      return { success: true, data: updated };
    }
  },

  bulkApproveTimeLogs: async (
    ids: string[]
  ): Promise<ApiResponse<{ approved: number }>> => {
    try {
      return await request<{ approved: number }>('/time-logs/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let approved = 0;
      for (const id of ids) {
        try {
          await crmApi.approveTimeLog(id);
          approved += 1;
        } catch (error) {
          rethrowUnlessMockFallback(error);
          /* skip */
        }
      }
      return { success: true, data: { approved } };
    }
  },

  lockTimeLogs: async (
    body: { ids: string[]; invoiceId?: string }
  ): Promise<ApiResponse<{ locked: number }>> => {
    try {
      return await request('/time-logs/lock', { method: 'POST', body: JSON.stringify(body) });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let locked = 0;
      for (const id of body.ids || []) {
        const current = getUnifiedTimeLogs().find((item) => item._id === id);
        if (!current) continue;
        saveUnifiedTimeLog({
          ...current,
          isLocked: true,
          invoiceId: body.invoiceId,
          updatedAt: new Date().toISOString(),
        });
        locked += 1;
      }
      return { success: true, data: { locked } };
    }
  },

  unlockTimeLogs: async (
    body: { ids: string[] }
  ): Promise<ApiResponse<{ unlocked: number }>> => {
    try {
      return await request('/time-logs/unlock', { method: 'POST', body: JSON.stringify(body) });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let unlocked = 0;
      for (const id of body.ids || []) {
        const current = getUnifiedTimeLogs().find((item) => item._id === id);
        if (!current) continue;
        saveUnifiedTimeLog({
          ...current,
          isLocked: false,
          invoiceId: undefined,
          updatedAt: new Date().toISOString(),
        });
        unlocked += 1;
      }
      return { success: true, data: { unlocked } };
    }
  },

  exportTimeLogs: async (
    params: TimeLogExportParams = {}
  ): Promise<ApiResponse<{ format: string; content: string; filename: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/time-logs/export${query.size ? `?${query}` : ''}`,
        'time_logs_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = await crmApi.listTimeLogs(params);
      const rows = list.data || [];
      const format = params.format || 'csv';
      if (format === 'json') {
        return {
          success: true,
          data: {
            format: 'json',
            content: JSON.stringify(rows, null, 2),
            filename: `time-logs-export-${Date.now()}.json`,
          },
        };
      }
      const header =
        'ID,Task ID,Task Title,Project ID,Project Name,User ID,Username,Hours,Billable,Hourly Rate,Billable Amount,Approval Status,Entry Type,Locked,Work Date,Check-In Time,Check-Out Time,Description,Created At';
      const body = rows
        .map((item) =>
          [
            item._id,
            item.taskId,
            item.taskTitle || '',
            item.projectId || '',
            item.projectName || '',
            item.userId || '',
            item.userName || '',
            item.hours,
            item.isBillable ? 'Yes' : 'No',
            item.hourlyRate || 0,
            item.billableAmount || 0,
            normalizeApprovalStatus(item.approvalStatus),
            item.entryType || 'manual',
            item.isLocked ? 'Yes' : 'No',
            item.workDate || item.date || '',
            item.checkInAt || item.checkInTime || '',
            item.checkOutAt || item.checkOutTime || '',
            item.description || item.note || '',
            item.createdAt || '',
          ]
            .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');
      return {
        success: true,
        data: {
          format: 'csv',
          content: `${header}\n${body}`,
          filename: `time-logs-export-${Date.now()}.csv`,
        },
      };
    }
  },

  getWeeklyTimesheet: async (params: {
    weekStart?: string;
    projectId?: string;
  } = {}): Promise<ApiResponse<WeeklyTimesheet>> => {
    const formatLocalDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const parseLocalDate = (iso: string): Date => {
      const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    };
    const mondayOfLocal = (from = new Date()): Date => {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d;
    };
    const normalizeWeeklyTimesheet = (raw: unknown): WeeklyTimesheet => {
      const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const rawDays = Array.isArray(data.days) ? data.days : [];
      const dayIsos: string[] = rawDays.map((day) => {
        if (typeof day === 'string') return day.slice(0, 10);
        if (day && typeof day === 'object') {
          const obj = day as Record<string, unknown>;
          const value = String(obj.date || obj.dateString || obj.iso || '');
          if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
        }
        return '';
      });
      const filledDays =
        dayIsos.filter(Boolean).length === 7
          ? dayIsos
          : (() => {
              const start = data.weekStart
                ? parseLocalDate(String(data.weekStart))
                : mondayOfLocal();
              return Array.from({ length: 7 }, (_, i) => {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                return formatLocalDate(d);
              });
            })();

      const totalsObj =
        data.totals && typeof data.totals === 'object'
          ? (data.totals as Record<string, unknown>)
          : {};
      const rawDayTotals = Array.isArray(totalsObj.dayTotals)
        ? (totalsObj.dayTotals as number[])
        : Array.isArray(data.dayTotals)
          ? (data.dayTotals as number[])
          : null;

      const dayTotals: Record<string, number> = Object.fromEntries(
        filledDays.map((day, i) => [
          day,
          Number(
            rawDayTotals
              ? rawDayTotals[i]
              : data.dayTotals && typeof data.dayTotals === 'object'
                ? (data.dayTotals as Record<string, number>)[day]
                : 0
          ) || 0,
        ])
      );

      const rawRows = Array.isArray(data.rows) ? data.rows : [];
      const rows = rawRows.map((rowRaw) => {
        const row = (rowRaw && typeof rowRaw === 'object' ? rowRaw : {}) as Record<
          string,
          unknown
        >;
        const hoursList = Array.isArray(row.dayHours)
          ? (row.dayHours as number[])
          : Array.isArray(row.days)
            ? (row.days as number[])
            : null;
        const daysMap: Record<string, number> = Object.fromEntries(
          filledDays.map((day) => [day, 0])
        );
        if (hoursList) {
          filledDays.forEach((day, i) => {
            daysMap[day] = Number(hoursList[i]) || 0;
          });
        } else if (row.days && typeof row.days === 'object' && !Array.isArray(row.days)) {
          Object.entries(row.days as Record<string, number>).forEach(([key, value]) => {
            if (key in daysMap) daysMap[key] = Number(value) || 0;
          });
        }
        const total =
          Number(row.totalHours ?? row.total) ||
          Object.values(daysMap).reduce((sum, value) => sum + value, 0);
        return {
          taskId: String(row.taskId || ''),
          taskTitle: String(row.taskTitle || row.taskId || 'Untitled Task'),
          projectId: row.projectId ? String(row.projectId) : undefined,
          projectName: row.projectName ? String(row.projectName) : undefined,
          days: daysMap,
          total,
        };
      });

      const grandTotal =
        Number(totalsObj.grandTotalHours ?? data.grandTotal) ||
        rows.reduce((sum, row) => sum + row.total, 0);

      return {
        weekStart: String(data.weekStart || filledDays[0] || ''),
        weekEnd: String(data.weekEnd || filledDays[6] || ''),
        days: filledDays,
        rows,
        dayTotals,
        grandTotal,
      };
    };

    try {
      const query = new URLSearchParams();
      if (params.weekStart) query.set('weekStart', params.weekStart);
      if (params.projectId) query.set('projectId', params.projectId);
      const response = await request<unknown>(
        `/time-logs/timesheet/weekly${query.size ? `?${query}` : ''}`,
        { method: 'GET' }
      );
      return { success: true, data: normalizeWeeklyTimesheet(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const start = params.weekStart
        ? mondayOfLocal(parseLocalDate(params.weekStart))
        : mondayOfLocal();
      const days: string[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return formatLocalDate(d);
      });
      let logs = getUnifiedTimeLogs().filter((item) => item.status !== 'Running');
      if (params.projectId) {
        const projectId = resolveProjectId(params.projectId);
        logs = logs.filter((item) => item.projectId === projectId);
      }
      logs = logs.filter((item) => {
        const workDate = String(item.workDate || item.date || '').slice(0, 10);
        return days.includes(workDate);
      });
      const rowMap = new Map<string, WeeklyTimesheet['rows'][number]>();
      const dayTotals: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
      for (const log of logs) {
        const workDate = String(log.workDate || log.date || '').slice(0, 10);
        const key = `${log.taskId || 'none'}|${log.projectId || ''}`;
        if (!rowMap.has(key)) {
          rowMap.set(key, {
            taskId: log.taskId || '',
            taskTitle: log.taskTitle || log.taskId || 'Untitled Task',
            projectId: log.projectId,
            projectName: log.projectName,
            days: Object.fromEntries(days.map((d) => [d, 0])),
            total: 0,
          });
        }
        const row = rowMap.get(key)!;
        const hours = Number(log.hours) || 0;
        row.days[workDate] = (row.days[workDate] || 0) + hours;
        row.total += hours;
        dayTotals[workDate] = (dayTotals[workDate] || 0) + hours;
      }
      return {
        success: true,
        data: normalizeWeeklyTimesheet({
          weekStart: days[0],
          weekEnd: days[6],
          days,
          rows: Array.from(rowMap.values()),
          dayTotals,
          grandTotal: Object.values(dayTotals).reduce((s, n) => s + n, 0),
        }),
      };
    }
  },

  getTaskSubtasks: async (taskId: string): Promise<ApiResponse<TaskSubtask[]>> => {
    try {
      const response = await request<TaskSubtask[]>(`/tasks/${encodeURIComponent(taskId)}/subtasks`, {
        method: 'GET',
      });
      return {
        ...response,
        data: (response.data || []).map((row) => normalizeTaskSubtask(row as TaskSubtask & Record<string, unknown>)),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(TASK_SUBTASKS_KEY, INITIAL_MOCK_TASK_SUBTASKS);
      return {
        success: true,
        data: (map[taskId] || []).map((row) => normalizeTaskSubtask(row as TaskSubtask & Record<string, unknown>)),
      };
    }
  },

  createTaskSubtask: async (
    taskId: string,
    body: {
      title: string;
      currentDate?: string | null;
      dueDate?: string | null;
      assignedTo?: string;
      description?: string;
      done?: boolean;
      isCompleted?: boolean;
    }
  ): Promise<ApiResponse<TaskSubtask>> => {
    try {
      const response = await request<TaskSubtask>(`/tasks/${encodeURIComponent(taskId)}/subtasks`, {
        method: 'POST',
        body: JSON.stringify(toApiSubtaskPayload(body)),
      });
      return {
        ...response,
        data: normalizeTaskSubtask(response.data as TaskSubtask & Record<string, unknown>),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.title?.trim()) throw new ApiError('Subtask title is required', 400);
      const map = getLocalProjectMap(TASK_SUBTASKS_KEY, INITIAL_MOCK_TASK_SUBTASKS);
      const isDone = Boolean(body.done || body.isCompleted);
      const created: TaskSubtask = {
        _id: `st_${Date.now()}`,
        taskId,
        title: body.title.trim(),
        done: isDone,
        isCompleted: isDone,
        currentDate: body.currentDate || body.dueDate || null,
        dueDate: body.dueDate || body.currentDate || null,
        assignedTo: body.assignedTo || '',
        description: body.description?.trim() || '',
        createdAt: new Date().toISOString(),
      };
      map[taskId] = [...(map[taskId] || []), created];
      saveLocalProjectMap(TASK_SUBTASKS_KEY, map);
      return { success: true, data: created };
    }
  },

  updateTaskSubtask: async (
    taskId: string,
    subtaskId: string,
    body: {
      title?: string;
      currentDate?: string | null;
      dueDate?: string | null;
      assignedTo?: string;
      description?: string;
      done?: boolean;
      isCompleted?: boolean;
    }
  ): Promise<ApiResponse<TaskSubtask>> => {
    try {
      const response = await request<TaskSubtask>(
        `/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`,
        { method: 'PUT', body: JSON.stringify(toApiSubtaskPayload(body)) }
      );
      return {
        ...response,
        data: normalizeTaskSubtask(response.data as TaskSubtask & Record<string, unknown>),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(TASK_SUBTASKS_KEY, INITIAL_MOCK_TASK_SUBTASKS);
      const list = map[taskId] || [];
      const idx = list.findIndex((s) => s._id === subtaskId);
      if (idx < 0) throw new ApiError('Subtask not found', 404);
      const doneVal =
        body.done !== undefined
          ? body.done
          : body.isCompleted !== undefined
          ? body.isCompleted
          : list[idx].done;
      list[idx] = {
        ...list[idx],
        ...body,
        done: doneVal,
        isCompleted: doneVal,
        updatedAt: new Date().toISOString(),
      };
      map[taskId] = list;
      saveLocalProjectMap(TASK_SUBTASKS_KEY, map);
      return { success: true, data: normalizeTaskSubtask(list[idx] as TaskSubtask & Record<string, unknown>) };
    }
  },

  deleteTaskSubtask: async (
    taskId: string,
    subtaskId: string
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(TASK_SUBTASKS_KEY, INITIAL_MOCK_TASK_SUBTASKS);
      map[taskId] = (map[taskId] || []).filter((s) => s._id !== subtaskId);
      saveLocalProjectMap(TASK_SUBTASKS_KEY, map);
      return { success: true, data: { deleted: true } };
    }
  },

  getTaskComments: async (taskId: string): Promise<ApiResponse<TaskComment[]>> => {
    try {
      return await request<TaskComment[]>(`/tasks/${encodeURIComponent(taskId)}/comments`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const map = getLocalProjectMap(TASK_COMMENTS_KEY, INITIAL_MOCK_TASK_COMMENTS);
      return { success: true, data: map[taskId] || [] };
    }
  },

  createTaskComment: async (
    taskId: string,
    body: { body: string; userName?: string }
  ): Promise<ApiResponse<TaskComment>> => {
    try {
      return await request<TaskComment>(`/tasks/${encodeURIComponent(taskId)}/comments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.body?.trim()) throw new ApiError('Comment is required', 400);
      const map = getLocalProjectMap(TASK_COMMENTS_KEY, INITIAL_MOCK_TASK_COMMENTS);
      const created: TaskComment = {
        _id: `cmt_${Date.now()}`,
        taskId,
        userName: body.userName || 'Admin User',
        body: body.body.trim(),
        createdAt: new Date().toISOString(),
      };
      map[taskId] = [...(map[taskId] || []), created];
      saveLocalProjectMap(TASK_COMMENTS_KEY, map);
      return { success: true, data: created };
    }
  },

  getExpenses: async (
    params: {
      page?: number;
      limit?: number;
      projectId?: string;
      clientId?: string;
      status?: string;
      category?: string;
      search?: string;
    } = {}
  ): Promise<ApiResponse<ProjectExpense[]>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.clientId) query.set('clientId', params.clientId);
    if (params.status) query.set('status', params.status);
    if (params.category) query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    try {
      return await request<ProjectExpense[]>(qs ? `/expenses?${qs}` : '/expenses', {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalProjectList(PROJECT_EXPENSES_KEY, INITIAL_MOCK_PROJECT_EXPENSES);
      if (params.projectId) items = items.filter((e) => e.projectId === params.projectId);
      if (params.status) items = items.filter((e) => e.status === params.status);
      if (params.category) items = items.filter((e) => e.category === params.category);
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (e) =>
            e.title.toLowerCase().includes(q) || e.note?.toLowerCase().includes(q)
        );
      }
      return { success: true, data: items };
    }
  },

  listExpenses: async (
    params: ExpenseQueryParams = {}
  ): Promise<ApiResponse<ExpenseItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit') return;
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      const response = await request<ExpenseItem[]>(`/expenses?${query}`, {
        method: 'GET',
      });
      return {
        ...response,
        pagination: fallbackPagination(page, limit, response.data?.length || 0, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const paged = paginateLocalItems(filterExpensesList(getLocalExpenses(), params), page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  getExpense: async (id: string): Promise<ApiResponse<ExpenseItem>> => {
    try {
      return await request<ExpenseItem>(`/expenses/${encodeURIComponent(id)}`, { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const item = getLocalExpenses().find((expense) => expense._id === id && !expense.isDeleted);
      if (!item) throw new ApiError('Expense not found', 404);
      return { success: true, data: item };
    }
  },

  createExpense: async (body: ExpenseCreateInput): Promise<ApiResponse<ExpenseItem>> => {
    try {
      return await request<ExpenseItem>('/expenses', { method: 'POST', body: JSON.stringify(body) });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.itemName?.trim() || !body.category || !(Number(body.price) > 0)) {
        throw new ApiError('Item name, category, and a valid price are required', 400);
      }
      if (!(Number(body.exchangeRate) >= 0.0001)) {
        throw new ApiError('Exchange rate must be at least 0.0001', 400);
      }
      const list = getLocalExpenses();
      const project = getLocalProjects().find((item) => item._id === body.projectId);
      const employeeName = body.employeeName || '';
      const submitNow = Boolean(body.submit) || body.status === 'Submitted';
      const purchaseDate = body.purchaseDate || body.expenseDate || new Date().toISOString().slice(0, 10);
      const price = Number(body.price);
      const created = normalizeExpenseItem({
        _id: `expense_${Date.now()}`,
        expenseNo: nextExpenseNo(list),
        itemName: body.itemName.trim(),
        title: body.itemName.trim(),
        category: body.category,
        price,
        amount: Number(body.amount ?? price),
        currency: body.currency || getRuntimeDefaultCurrency(),
        exchangeRate: Number(body.exchangeRate) || 1,
        purchaseDate,
        expenseDate: body.expenseDate || purchaseDate,
        purchasedFrom: body.purchasedFrom || '',
        isBillable: Boolean(body.isBillable),
        employeeId: body.employeeId || '',
        employeeName,
        projectId: body.projectId || '',
        projectName: project?.name || '',
        clientId: body.clientId || project?.clientId || '',
        paymentMode: body.paymentMode || 'Bank Transfer',
        bankAccount: body.bankAccount || '',
        billUrl: body.billUrl || body.bill || body.receiptUrl || '',
        bill: body.bill || body.billUrl || body.receiptUrl || '',
        receiptUrl: body.receiptUrl || body.billUrl || body.bill || '',
        description: body.description || body.notes || '',
        notes: body.notes || body.description || '',
        status: submitNow ? 'Submitted' : 'Draft',
        submittedAt: submitNow ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
      });
      list.unshift(created);
      saveLocalExpenses(list);
      if (created.projectId) {
        const projectExpenses = getLocalProjectList(
          PROJECT_EXPENSES_KEY,
          INITIAL_MOCK_PROJECT_EXPENSES
        );
        projectExpenses.unshift({
          _id: created._id,
          projectId: created.projectId,
          title: created.itemName,
          amount: created.price,
          currency: created.currency,
          category: created.category,
          status: created.status,
          date: created.purchaseDate,
          note: created.description,
          createdAt: created.createdAt,
        });
        saveLocalProjectList(PROJECT_EXPENSES_KEY, projectExpenses);
      }
      return { success: true, data: created };
    }
  },

  createProjectExpense: async (body: {
    projectId: string;
    title: string;
    amount: number;
    category?: string;
    date?: string;
    note?: string;
    currency?: string;
  }): Promise<ApiResponse<ProjectExpense>> => {
    try {
      return await request<ProjectExpense>('/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.projectId || !body.title?.trim() || !(Number(body.amount) > 0)) {
        throw new ApiError('Project, title, and amount are required', 400);
      }
      const projectId = resolveProjectId(body.projectId);
      const created: ProjectExpense = {
        _id: `exp_${Date.now()}`,
        projectId,
        title: body.title.trim(),
        amount: Number(body.amount),
        currency: body.currency || getRuntimeDefaultCurrency(),
        category: body.category || 'General',
        status: 'Draft',
        date: body.date || new Date().toISOString().slice(0, 10),
        note: body.note,
        createdAt: new Date().toISOString(),
      };
      const list = getLocalProjectList(PROJECT_EXPENSES_KEY, INITIAL_MOCK_PROJECT_EXPENSES);
      list.unshift(created);
      saveLocalProjectList(PROJECT_EXPENSES_KEY, list);
      pushProjectActivity(projectId, 'expense_added', `Added expense “${created.title}”`);
      return { success: true, data: created };
    }
  },

  updateProjectExpense: async (
    id: string,
    body: Partial<ProjectExpense>
  ): Promise<ApiResponse<ProjectExpense>> => {
    try {
      return await request<ProjectExpense>(`/expenses/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(PROJECT_EXPENSES_KEY, INITIAL_MOCK_PROJECT_EXPENSES);
      const idx = list.findIndex((e) => e._id === id);
      if (idx < 0) throw new ApiError('Expense not found', 404);
      list[idx] = { ...list[idx], ...body };
      saveLocalProjectList(PROJECT_EXPENSES_KEY, list);
      return { success: true, data: list[idx] };
    }
  },

  submitProjectExpense: async (id: string): Promise<ApiResponse<ProjectExpense>> => {
    try {
      return await request<ProjectExpense>(`/expenses/${encodeURIComponent(id)}/submit`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return crmApi.updateProjectExpense(id, { status: 'Submitted' });
    }
  },

  approveProjectExpense: async (id: string): Promise<ApiResponse<ProjectExpense>> => {
    try {
      return await request<ProjectExpense>(`/expenses/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return crmApi.updateProjectExpense(id, { status: 'Approved' });
    }
  },

  rejectProjectExpense: async (id: string): Promise<ApiResponse<ProjectExpense>> => {
    try {
      return await request<ProjectExpense>(`/expenses/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return crmApi.updateProjectExpense(id, { status: 'Rejected' });
    }
  },

  deleteProjectExpense: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/expenses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalProjectList(PROJECT_EXPENSES_KEY, INITIAL_MOCK_PROJECT_EXPENSES);
      saveLocalProjectList(
        PROJECT_EXPENSES_KEY,
        list.filter((e) => e._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  updateExpense: async (
    id: string,
    body: Partial<ExpenseCreateInput>
  ): Promise<ApiResponse<ExpenseItem>> => {
    try {
      return await request<ExpenseItem>(`/expenses/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Expense not found', 404);
      const current = list[index];
      if (!['Draft', 'Rejected'].includes(current.status)) {
        throw new ApiError('Only draft or rejected expenses can be edited', 400);
      }
      if (current.isBilled) throw new ApiError('Billed expenses cannot be edited', 400);
      const project = getLocalProjects().find((item) => item._id === (body.projectId || current.projectId));
      const price = Number(body.price ?? current.price);
      const purchaseDate = body.purchaseDate || current.purchaseDate;
      list[index] = normalizeExpenseItem({
        ...current,
        ...body,
        price,
        amount: Number(body.amount ?? price),
        itemName: (body.itemName || current.itemName).trim(),
        title: (body.itemName || current.title || current.itemName).trim(),
        purchaseDate,
        expenseDate: body.expenseDate || purchaseDate,
        projectName: project?.name || current.projectName,
        billUrl: body.billUrl || body.bill || body.receiptUrl || current.billUrl,
        bill: body.bill || body.billUrl || body.receiptUrl || current.bill,
        receiptUrl: body.receiptUrl || body.billUrl || body.bill || current.receiptUrl,
        updatedAt: new Date().toISOString(),
      });
      saveLocalExpenses(list);
      return { success: true, data: list[index] };
    }
  },

  deleteExpense: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/expenses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Expense not found', 404);
      if (list[index].status !== 'Draft') {
        throw new ApiError('Only draft expenses can be deleted', 400);
      }
      list[index] = {
        ...list[index],
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveLocalExpenses(list);
      return { success: true, data: { deleted: true } };
    }
  },

  submitExpense: async (id: string): Promise<ApiResponse<ExpenseItem>> => {
    try {
      return await request<ExpenseItem>(`/expenses/${encodeURIComponent(id)}/submit`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Expense not found', 404);
      if (!['Draft', 'Rejected'].includes(list[index].status)) {
        throw new ApiError('Only draft or rejected expenses can be submitted', 400);
      }
      list[index] = {
        ...list[index],
        status: 'Submitted',
        submittedAt: new Date().toISOString(),
        rejectionReason: '',
        rejectedAt: null,
        rejectedBy: '',
        updatedAt: new Date().toISOString(),
      };
      saveLocalExpenses(list);
      return { success: true, data: list[index] };
    }
  },

  approveExpense: async (id: string): Promise<ApiResponse<ExpenseItem>> => {
    try {
      return await request<ExpenseItem>(`/expenses/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Expense not found', 404);
      if (list[index].status !== 'Submitted') {
        throw new ApiError('Only submitted expenses can be approved', 400);
      }
      list[index] = {
        ...list[index],
        status: 'Approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'Finance Manager',
        rejectionReason: '',
        updatedAt: new Date().toISOString(),
      };
      saveLocalExpenses(list);
      return { success: true, data: list[index] };
    }
  },

  rejectExpense: async (
    id: string,
    body: { reason: string } = { reason: '' }
  ): Promise<ApiResponse<ExpenseItem>> => {
    try {
      return await request<ExpenseItem>(`/expenses/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.reason?.trim()) throw new ApiError('Rejection reason is required', 400);
      if (body.reason.trim().length > 500) {
        throw new ApiError('Rejection reason must be 500 characters or fewer', 400);
      }
      const list = getLocalExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Expense not found', 404);
      if (list[index].status !== 'Submitted') {
        throw new ApiError('Only submitted expenses can be rejected', 400);
      }
      list[index] = {
        ...list[index],
        status: 'Rejected',
        rejectionReason: body.reason.trim(),
        rejectedAt: new Date().toISOString(),
        rejectedBy: 'Finance Manager',
        updatedAt: new Date().toISOString(),
      };
      saveLocalExpenses(list);
      return { success: true, data: list[index] };
    }
  },

  archiveExpense: async (id: string): Promise<ApiResponse<ExpenseItem>> => {
    try {
      return await request<ExpenseItem>(`/expenses/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Expense not found', 404);
      list[index] = {
        ...list[index],
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: 'system',
        updatedAt: new Date().toISOString(),
      };
      saveLocalExpenses(list);
      return { success: true, data: list[index] };
    }
  },

  restoreExpense: async (id: string): Promise<ApiResponse<ExpenseItem>> => {
    try {
      return await request<ExpenseItem>(`/expenses/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Expense not found', 404);
      list[index] = {
        ...list[index],
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date().toISOString(),
      };
      saveLocalExpenses(list);
      return { success: true, data: list[index] };
    }
  },

  exportExpenses: async (
    params: ExpenseQueryParams & { format?: 'csv' | 'json' } = {}
  ): Promise<ApiResponse<{ content: string; filename: string; mimeType: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/expenses/export${query.size ? `?${query}` : ''}`,
        'expenses_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = filterExpensesList(getLocalExpenses(), params);
      if (params.format === 'json') {
        return {
          success: true,
          data: {
            content: JSON.stringify(items, null, 2),
            filename: `expenses-${Date.now()}.json`,
            mimeType: 'application/json',
          },
        };
      }
      const header = [
        'ID',
        'Expense Number',
        'Title / Item',
        'Category',
        'Amount',
        'Currency',
        'Expense Date',
        'Client',
        'Project',
        'Claimant / Employee',
        'Status',
        'Payment Mode',
        'Vendor / Purchased From',
        'Bank Account',
        'Notes',
        'Created At',
      ];
      const rows = items.map((item) =>
        [
          item._id,
          item.expenseNo,
          item.itemName || item.title || '',
          item.category,
          item.price,
          item.currency,
          item.expenseDate || item.purchaseDate,
          item.clientName || item.clientId || '',
          item.projectName || item.projectId || '',
          item.employeeName || item.employeeId || '',
          item.status,
          item.paymentMode || '',
          item.purchasedFrom || '',
          item.bankAccount || '',
          (item.notes || item.description || '').replace(/"/g, '""'),
          item.createdAt || '',
        ]
          .map((value) => `"${String(value ?? '')}"`)
          .join(',')
      );
      return {
        success: true,
        data: {
          content: [header.join(','), ...rows].join('\n'),
          filename: `expenses-${Date.now()}.csv`,
          mimeType: 'text/csv',
        },
      };
    }
  },

  getExpenseCategories: async (): Promise<ApiResponse<string[]>> => {
    try {
      return await request<string[]>('/expenses/categories', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: [...DEFAULT_EXPENSE_CATEGORIES] };
    }
  },

  listRecurringExpenses: async (
    params: RecurringExpenseQueryParams = {}
  ): Promise<ApiResponse<RecurringExpenseItem[]>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      return await request<RecurringExpenseItem[]>(
        query.size ? `/recurring-expenses?${query}` : '/recurring-expenses',
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalRecurringExpenses().filter((item) => !item.isDeleted);
      if (params.status) items = items.filter((item) => item.status === params.status);
      if (params.category) items = items.filter((item) => item.category === params.category);
      if (params.search) {
        const term = params.search.toLowerCase();
        items = items.filter((item) =>
          [item.profileName, item.itemName, item.vendorName, item.category].some((value) =>
            value?.toLowerCase().includes(term)
          )
        );
      }
      return { success: true, data: items };
    }
  },

  createRecurringExpense: async (
    body: RecurringExpenseCreateInput
  ): Promise<ApiResponse<RecurringExpenseItem>> => {
    try {
      return await request<RecurringExpenseItem>('/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.profileName?.trim() || !body.itemName?.trim() || !body.category || !(Number(body.price) > 0)) {
        throw new ApiError('Profile name, item name, category, and price are required', 400);
      }
      if (!body.startDate) throw new ApiError('Start date is required', 400);
      if (body.frequency === 'custom' && (!(Number(body.customIntervalDays) >= 1) || Number(body.customIntervalDays) > 365)) {
        throw new ApiError('Custom interval must be between 1 and 365 days', 400);
      }
      if (body.endCondition === 'after_cycles' && !(Number(body.totalCycles) >= 1)) {
        throw new ApiError('Total cycles must be at least 1', 400);
      }
      if (body.endCondition === 'on_date' && !body.endDate) {
        throw new ApiError('End date is required for on_date end condition', 400);
      }
      const list = getLocalRecurringExpenses();
      const project = getLocalProjects().find((item) => item._id === body.projectId);
      const price = Number(body.price);
      const created: RecurringExpenseItem = {
        _id: `rec_exp_${Date.now()}`,
        profileName: body.profileName.trim(),
        vendorName: body.vendorName || '',
        itemName: body.itemName.trim(),
        category: body.category,
        amount: Number(body.amount ?? price),
        price,
        currency: body.currency || getRuntimeDefaultCurrency(),
        exchangeRate: Number(body.exchangeRate || 1),
        frequency: body.frequency || 'monthly',
        customIntervalDays: Number(body.customIntervalDays || 30),
        startDate: body.startDate,
        nextRunDate: body.startDate,
        lastRunDate: null,
        endCondition: body.endCondition || 'never',
        endDate: body.endDate || null,
        totalCycles: body.totalCycles ?? null,
        cyclesCompleted: 0,
        status: 'Active',
        employeeId: body.employeeId || '',
        employeeName: body.employeeName || '',
        projectId: body.projectId || '',
        projectName: project?.name || '',
        clientId: body.clientId || project?.clientId || '',
        paymentMode: body.paymentMode || 'Bank Transfer',
        bankAccount: body.bankAccount || '',
        isBillable: Boolean(body.isBillable),
        autoSubmit: body.autoSubmit !== false,
        description: body.description || '',
        notes: body.notes || '',
        executionLogs: [],
        createdAt: new Date().toISOString(),
      };
      list.unshift(created);
      saveLocalRecurringExpenses(list);
      return { success: true, data: created };
    }
  },

  getRecurringExpense: async (id: string): Promise<ApiResponse<RecurringExpenseItem>> => {
    try {
      return await request<RecurringExpenseItem>(`/recurring-expenses/${encodeURIComponent(id)}`, {
        method: 'GET',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const item = getLocalRecurringExpenses().find((entry) => entry._id === id && !entry.isDeleted);
      if (!item) throw new ApiError('Recurring expense not found', 404);
      return { success: true, data: item };
    }
  },

  updateRecurringExpense: async (
    id: string,
    body: Partial<RecurringExpenseCreateInput>
  ): Promise<ApiResponse<RecurringExpenseItem>> => {
    try {
      return await request<RecurringExpenseItem>(`/recurring-expenses/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalRecurringExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Recurring expense not found', 404);
      const current = list[index];
      const price = Number(body.price ?? current.price);
      list[index] = {
        ...current,
        ...body,
        price,
        amount: Number(body.amount ?? price),
        profileName: (body.profileName || current.profileName).trim(),
        itemName: (body.itemName || current.itemName).trim(),
        updatedAt: new Date().toISOString(),
      };
      saveLocalRecurringExpenses(list);
      return { success: true, data: list[index] };
    }
  },

  deleteRecurringExpense: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/recurring-expenses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalRecurringExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Recurring expense not found', 404);
      list[index] = { ...list[index], isDeleted: true, updatedAt: new Date().toISOString() };
      saveLocalRecurringExpenses(list);
      return { success: true, data: { deleted: true } };
    }
  },

  toggleRecurringExpenseStatus: async (
    id: string
  ): Promise<ApiResponse<RecurringExpenseItem>> => {
    try {
      return await request<RecurringExpenseItem>(
        `/recurring-expenses/${encodeURIComponent(id)}/toggle-status`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalRecurringExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Recurring expense not found', 404);
      const current = list[index];
      if (current.status === 'Completed') {
        throw new ApiError('Completed schedules cannot be toggled', 400);
      }
      list[index] = {
        ...current,
        status: current.status === 'Active' ? 'Paused' : 'Active',
        updatedAt: new Date().toISOString(),
      };
      saveLocalRecurringExpenses(list);
      return { success: true, data: list[index] };
    }
  },

  runRecurringExpenseNow: async (id: string): Promise<ApiResponse<{ expense: ExpenseItem; profile: RecurringExpenseItem }>> => {
    try {
      return await request<{ expense: ExpenseItem; profile: RecurringExpenseItem }>(
        `/recurring-expenses/${encodeURIComponent(id)}/run-now`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalRecurringExpenses();
      const index = list.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Recurring expense not found', 404);
      const profile = list[index];
      if (profile.status !== 'Active') throw new ApiError('Only active schedules can be run', 400);
      try {
        const expense = createExpenseFromRecurring(profile);
        const nextCycles = (profile.cyclesCompleted || 0) + 1;
        let status: RecurringExpenseStatus = profile.status;
        if (profile.endCondition === 'after_cycles' && profile.totalCycles && nextCycles >= profile.totalCycles) {
          status = 'Completed';
        }
        const nextRunDate = advanceRecurringDate(
          profile.nextRunDate || profile.startDate,
          profile.frequency,
          profile.customIntervalDays
        );
        if (profile.endCondition === 'on_date' && profile.endDate && nextRunDate > profile.endDate) {
          status = 'Completed';
        }
        const log: RecurringExecutionLog = {
          runId: `run_${Date.now()}`,
          runDate: new Date().toISOString(),
          expenseId: expense._id,
          expenseNo: expense.expenseNo,
          status: 'Success',
        };
        list[index] = {
          ...profile,
          cyclesCompleted: nextCycles,
          lastRunDate: profile.nextRunDate || new Date().toISOString().slice(0, 10),
          nextRunDate,
          status,
          executionLogs: [log, ...(profile.executionLogs || [])].slice(0, 50),
          updatedAt: new Date().toISOString(),
        };
        saveLocalRecurringExpenses(list);
        return { success: true, data: { expense, profile: list[index] } };
      } catch (reason) {
        rethrowUnlessMockFallback(reason);
        const message = reason instanceof Error ? reason.message : 'Run failed';
        const failLog: RecurringExecutionLog = {
          runId: `run_${Date.now()}`,
          runDate: new Date().toISOString(),
          status: 'Failed',
          error: message,
        };
        list[index] = {
          ...profile,
          executionLogs: [
            failLog,
            ...(profile.executionLogs || []),
          ].slice(0, 50),
          updatedAt: new Date().toISOString(),
        };
        saveLocalRecurringExpenses(list);
        throw new ApiError(message, 400);
      }
    }
  },

  runDueRecurringExpenses: async (): Promise<ApiResponse<{ generated: number; message: string }>> => {
    try {
      return await request<{ generated: number; message: string }>('/recurring-expenses/run-due', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const today = new Date().toISOString().slice(0, 10);
      const list = getLocalRecurringExpenses();
      let generated = 0;
      for (let index = 0; index < list.length; index += 1) {
        const profile = list[index];
        if (profile.isDeleted || profile.status !== 'Active') continue;
        if ((profile.nextRunDate || '') > today) continue;
        try {
          const expense = createExpenseFromRecurring(profile);
          generated += 1;
          const nextCycles = (profile.cyclesCompleted || 0) + 1;
          let status: RecurringExpenseStatus = profile.status;
          if (profile.endCondition === 'after_cycles' && profile.totalCycles && nextCycles >= profile.totalCycles) {
            status = 'Completed';
          }
          const nextRunDate = advanceRecurringDate(
            profile.nextRunDate || profile.startDate,
            profile.frequency,
            profile.customIntervalDays
          );
          if (profile.endCondition === 'on_date' && profile.endDate && nextRunDate > profile.endDate) {
            status = 'Completed';
          }
          const successLog: RecurringExecutionLog = {
            runId: `run_${Date.now()}_${index}`,
            runDate: new Date().toISOString(),
            expenseId: expense._id,
            expenseNo: expense.expenseNo,
            status: 'Success',
          };
          list[index] = {
            ...profile,
            cyclesCompleted: nextCycles,
            lastRunDate: profile.nextRunDate,
            nextRunDate,
            status,
            executionLogs: [
              successLog,
              ...(profile.executionLogs || []),
            ].slice(0, 50),
            updatedAt: new Date().toISOString(),
          };
        } catch (reason) {
          rethrowUnlessMockFallback(reason);
          const failLog: RecurringExecutionLog = {
            runId: `run_${Date.now()}_${index}`,
            runDate: new Date().toISOString(),
            status: 'Failed',
            error: reason instanceof Error ? reason.message : 'Run failed',
          };
          list[index] = {
            ...profile,
            executionLogs: [
              failLog,
              ...(profile.executionLogs || []),
            ].slice(0, 50),
          };
        }
      }
      saveLocalRecurringExpenses(list);
      return {
        success: true,
        data: {
          generated,
          message:
            generated > 0
              ? `Generated ${generated} recurring expense instance(s)`
              : 'All recurring expense schedules are up to date.',
        },
      };
    }
  },

  getRecurringExpenseForecast: async (
    params: { days?: number } = {}
  ): Promise<ApiResponse<RecurringForecastReport>> => {
    const days = Number(params.days || 90);
    const query = new URLSearchParams();
    query.set('days', String(days));
    try {
      return await request<RecurringForecastReport>(
        `/recurring-expenses/upcoming-report?${query}`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const horizonDays = [30, 60, 90, 180, 365].includes(days) ? days : 90;
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + horizonDays);
      const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      const today = new Date().toISOString().slice(0, 10);
      const active = getLocalRecurringExpenses().filter(
        (item) => !item.isDeleted && item.status === 'Active'
      );
      const entries: RecurringForecastReport['entries'] = [];
      active.forEach((profile) => {
        let cursor = profile.nextRunDate || profile.startDate;
        let cycle = (profile.cyclesCompleted || 0) + 1;
        let guard = 0;
        while (cursor <= endKey && cursor >= today && guard < 400) {
          if (profile.endCondition === 'on_date' && profile.endDate && cursor > profile.endDate) break;
          if (profile.endCondition === 'after_cycles' && profile.totalCycles && cycle > profile.totalCycles) break;
          entries.push({
            date: cursor,
            profileId: profile._id,
            profileName: profile.profileName,
            vendorName: profile.vendorName,
            category: profile.category,
            frequency: profile.frequency,
            cycleNumber: cycle,
            amount: Number(profile.price || profile.amount || 0),
            currency: profile.currency || getRuntimeDefaultCurrency(),
          });
          cursor = advanceRecurringDate(cursor, profile.frequency, profile.customIntervalDays);
          cycle += 1;
          guard += 1;
        }
      });
      entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const totalProjected = entries.reduce(
        (sum, entry) => sum + entry.amount * (active.find((p) => p._id === entry.profileId)?.exchangeRate || 1),
        0
      );
      return {
        success: true,
        data: {
          horizonDays,
          totalProjected,
          scheduledGenerations: entries.length,
          activeProfiles: active.length,
          entries,
        },
      };
    }
  },

  // ─── REPORTS MODULE ENDPOINTS ─────────────────────────────────────────────
  getClients: async (params: { limit?: number; search?: string } = {}): Promise<ApiResponse<ClientOption[]>> => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    const normalize = (row: Record<string, unknown>): ClientOption => ({
      _id: String(row._id || ''),
      name: String(row.name || row.companyName || 'Client'),
      email: row.email ? String(row.email) : undefined,
      avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
      avatarColor: row.avatarColor ? String(row.avatarColor) : undefined,
      companyName: row.companyName ? String(row.companyName) : undefined,
      phone: row.phone ? String(row.phone) : undefined,
      mobile: row.mobile ? String(row.mobile) : undefined,
    });
    try {
      const response = await request<Record<string, unknown>[]>(
        qs ? `/clients?${qs}` : '/clients',
        { method: 'GET' }
      );
      return {
        ...response,
        data: (response.data || []).map(normalize).filter((row) => row._id),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: [
          { _id: 'client_1', name: 'Acme Corporation', email: 'billing@acmecorp.com', avatarColor: '#0f766e' },
          { _id: 'client_2', name: 'Stark Industries', email: 'finance@stark.com', avatarColor: '#1d4ed8' },
          { _id: 'client_3', name: 'Wayne Enterprises', email: 'contact@wayne.com', avatarColor: '#334155' },
          { _id: 'client_4', name: 'Cyberdyne Systems', email: 'info@cyberdyne.io', avatarColor: '#be123c' },
          { _id: 'client_5', name: 'Globex Corp', email: 'support@globex.org', avatarColor: '#b45309' },
        ],
      };
    }
  },

  getSalesReport: async (params: ReportQueryParams = {}): Promise<ApiResponse<SalesReportData>> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();
    try {
      return await request<SalesReportData>(qs ? `/reports/sales?${qs}` : '/reports/sales', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          range: { from: params.from || '2026-09-01', to: params.to || '2026-09-30' },
          defaultCurrency: 'INR',
          totalLeads: 48,
          wonLeads: 18,
          conversionRate: 37.5,
          pipeline: [
            { stage: 'New', count: 12 },
            { stage: 'Contacted', count: 10 },
            { stage: 'Qualified', count: 8 },
            { stage: 'Proposal Sent', count: 6 },
            { stage: 'Won', count: 18 },
            { stage: 'Lost', count: 4 },
          ],
          leadsByPeriod: [
            { period: 'May 2026', count: 24 },
            { period: 'Jun 2026', count: 32 },
            { period: 'Jul 2026', count: 41 },
            { period: 'Aug 2026', count: 38 },
            { period: 'Sep 2026', count: 48 },
          ],
          quotations: { draft: 5, sent: 12, accepted: 18, rejected: 3 },
          paymentsTotal: 1285000,
          outstanding: { unpaid: 420000, overdue: 165000, unpaidCount: 8 },
          topClients: [
            { name: 'Acme Corporation', amount: 450000 },
            { name: 'Stark Industries', amount: 380000 },
            { name: 'Wayne Enterprises', amount: 265000 },
            { name: 'Cyberdyne Systems', amount: 190000 },
          ],
        },
      };
    }
  },

  getLeadConversionReport: async (params: ReportQueryParams = {}): Promise<ApiResponse<LeadConversionReportData>> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();
    try {
      return await request<LeadConversionReportData>(
        qs ? `/reports/lead-conversion?${qs}` : '/reports/lead-conversion',
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          range: { from: params.from || '2026-09-01', to: params.to || '2026-09-30' },
          totalLeads: 58,
          wonLeads: 21,
          lostLeads: 7,
          convertedLeads: 19,
          conversionRate: 36.2,
          byStage: [
            { stage: 'New', count: 14 },
            { stage: 'Contacted', count: 11 },
            { stage: 'Qualified', count: 9 },
            { stage: 'Proposal Sent', count: 7 },
            { stage: 'Won', count: 21 },
            { stage: 'Lost', count: 7 },
          ],
          bySource: [
            { source: 'Website', count: 22 },
            { source: 'Referral', count: 14 },
            { source: 'LinkedIn', count: 11 },
            { source: 'Cold Call', count: 7 },
            { source: 'Organic Search', count: 4 },
          ],
          conversionsByPeriod: [
            { period: 'May 2026', count: 11 },
            { period: 'Jun 2026', count: 14 },
            { period: 'Jul 2026', count: 18 },
            { period: 'Aug 2026', count: 16 },
            { period: 'Sep 2026', count: 21 },
          ],
          reps: [
            { name: 'Rahul Sharma', won: 9, total: 18, rate: 50.0 },
            { name: 'Priya Patel', won: 7, total: 16, rate: 43.8 },
            { name: 'Ananya Roy', won: 5, total: 14, rate: 35.7 },
            { name: 'Vikram Mehta', won: 3, total: 10, rate: 30.0 },
          ],
        },
      };
    }
  },

  getProjectsReport: async (params: ReportQueryParams = {}): Promise<ApiResponse<ProjectsReportData>> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();

    const normalize = (raw: ProjectsReportData & Record<string, unknown>): ProjectsReportData => {
      const projects = (Array.isArray(raw.projects) ? raw.projects : []).map((p) => {
        const row = p as ProjectItemReport & Record<string, unknown>;
        const totalTasks = Number(row.totalTasks ?? row.tasksTotal ?? 0) || 0;
        const completedTasks = Number(row.completedTasks ?? row.tasksCompleted ?? 0) || 0;
        const progress =
          Number(row.progress ?? row.completionPct ?? (totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0)) ||
          0;
        return {
          ...row,
          id: String(row.id || ''),
          name: String(row.name || 'Untitled project'),
          clientName: row.clientName != null ? String(row.clientName) : undefined,
          status: String(row.status || '—'),
          totalTasks,
          completedTasks,
          progress: Math.round(progress),
          overdueTasks: Number(row.overdueTasks ?? 0) || 0,
          loggedHours:
            row.loggedHours !== undefined || row.hoursLogged !== undefined
              ? Number(row.loggedHours ?? row.hoursLogged) || 0
              : undefined,
          tasksTotal: totalTasks,
          tasksCompleted: completedTasks,
          completionPct: Math.round(progress),
          hoursLogged:
            row.hoursLogged !== undefined || row.loggedHours !== undefined
              ? Number(row.hoursLogged ?? row.loggedHours) || 0
              : undefined,
        };
      });

      const hoursByAssignee = (Array.isArray(raw.hoursByAssignee) ? raw.hoursByAssignee : []).map((h) => {
        const row = h as { name?: string; username?: string; userId?: string; hours?: number };
        return {
          name: String(row.name || row.username || 'Team member'),
          userId: row.userId ? String(row.userId) : undefined,
          hours: Number(row.hours) || 0,
        };
      });

      const overdueTasks = (Array.isArray(raw.overdueTasks) ? raw.overdueTasks : []).map((t) => {
        const row = t as OverdueTaskItem & Record<string, unknown>;
        const assignedToName =
          row.assignedToName != null && String(row.assignedToName).trim()
            ? String(row.assignedToName)
            : undefined;
        const assignedRaw =
          row.assignedTo == null || row.assignedTo === ''
            ? undefined
            : typeof row.assignedTo === 'string'
              ? row.assignedTo
              : String(row.assignedTo);
        return {
          id: String(row.id || ''),
          title: String(row.title || 'Untitled task'),
          projectId: String(row.projectId || ''),
          projectName: String(row.projectName || '—'),
          assignedTo: assignedToName || assignedRaw,
          assignedToName: assignedToName || assignedRaw,
          dueDate: row.dueDate ? String(row.dueDate) : undefined,
        };
      });

      return {
        ...raw,
        byStatus: Array.isArray(raw.byStatus) ? raw.byStatus : [],
        projects,
        overdueTasks,
        hoursByAssignee,
      };
    };

    try {
      const res = await request<ProjectsReportData & Record<string, unknown>>(
        qs ? `/reports/projects?${qs}` : '/reports/projects',
        { method: 'GET' }
      );
      return { success: true, data: normalize(res.data || {}), message: res.message };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: normalize({
          range: { from: params.from || '2026-09-01', to: params.to || '2026-09-30' },
          byStatus: [
            { status: 'In Progress', count: 6 },
            { status: 'Completed', count: 11 },
            { status: 'Planning', count: 3 },
            { status: 'On Hold', count: 2 },
          ],
          projects: [
            {
              id: 'p1',
              name: 'ERP Cloud Migration',
              clientName: 'Acme Corporation',
              status: 'In Progress',
              totalTasks: 24,
              completedTasks: 18,
              progress: 75,
              overdueTasks: 1,
              loggedHours: 142,
            },
            {
              id: 'p2',
              name: 'Mobile App Redesign',
              clientName: 'Stark Industries',
              status: 'In Progress',
              totalTasks: 32,
              completedTasks: 22,
              progress: 68,
              overdueTasks: 0,
              loggedHours: 198,
            },
            {
              id: 'p3',
              name: 'Security Audit & Compliance',
              clientName: 'Wayne Enterprises',
              status: 'Completed',
              totalTasks: 16,
              completedTasks: 16,
              progress: 100,
              overdueTasks: 0,
              loggedHours: 95,
            },
            {
              id: 'p4',
              name: 'AI Integration Pipeline',
              clientName: 'Cyberdyne Systems',
              status: 'Planning',
              totalTasks: 12,
              completedTasks: 2,
              progress: 16,
              overdueTasks: 1,
              loggedHours: 34,
            },
          ],
          overdueTasks: [
            {
              id: 't1',
              title: 'OAuth Provider Integration',
              projectId: 'p1',
              projectName: 'ERP Cloud Migration',
              assignedTo: 'Rahul Sharma',
              dueDate: '2026-09-02',
            },
            {
              id: 't2',
              title: 'Data Schema Migration Script',
              projectId: 'p4',
              projectName: 'AI Integration Pipeline',
              assignedTo: 'Vikram Mehta',
              dueDate: '2026-09-05',
            },
          ],
          hoursByAssignee: [
            { name: 'Rahul Sharma', hours: 145 },
            { name: 'Priya Patel', hours: 162 },
            { name: 'Ananya Roy', hours: 118 },
            { name: 'Vikram Mehta', hours: 84 },
          ],
        }),
      };
    }
  },

  /**
   * Employee task progress — aggregates assignable staff + assigned tasks
   * via existing `/users/assignable` and `/tasks` (no dedicated /reports/employees route yet).
   */
  getEmployeesReport: async (params: ReportQueryParams = {}): Promise<ApiResponse<EmployeesReportData>> => {
    const buildFromLocal = async (): Promise<EmployeesReportData> => {
      const usersRes = await crmApi.getAssignableUsers();
      const users = (usersRes.data || []).filter(
        (u) => !u.isClient && !u.isClientUser && !String(u.role || '').toLowerCase().includes('client')
      );

      const allTasks: TaskItem[] = [];
      let page = 1;
      const limit = 100;
      const maxPages = 25;
      while (page <= maxPages) {
        const res = await crmApi.listTasks({ page, limit, isArchived: false });
        const chunk = res.data || [];
        allTasks.push(...chunk);
        const totalPages = Number(res.pagination?.totalPages) || 1;
        if (page >= totalPages || chunk.length < limit) break;
        page += 1;
      }

      const today = new Date().toISOString().slice(0, 10);
      const byUser = new Map<string, TaskItem[]>();
      for (const task of allTasks) {
        const assigneeId = String(task.assignedTo || '').trim();
        if (!assigneeId) continue;
        const list = byUser.get(assigneeId) || [];
        list.push(task);
        byUser.set(assigneeId, list);
      }

      const resolveUserId = (u: AssignableUser) =>
        String(u.id || u._id || u.userId || '').trim();

      const employees: EmployeeProgressRow[] = users
        .map((u) => {
          const userId = resolveUserId(u);
          const tasks = byUser.get(userId) || [];
          const altIds = [u.id, u._id, u.userId].map((x) => String(x || '').trim()).filter(Boolean);
          const merged = [...tasks];
          for (const alt of altIds) {
            if (alt === userId) continue;
            const extra = byUser.get(alt);
            if (extra) merged.push(...extra);
          }
          const seen = new Set<string>();
          const unique = merged.filter((t) => {
            if (seen.has(t._id)) return false;
            seen.add(t._id);
            return true;
          });

          const completedTasks = unique.filter((t) => t.status === 'Completed').length;
          const totalTasks = unique.length;
          const incomplete = unique.filter((t) => t.status !== 'Completed');
          const incompleteTaskList: EmployeeIncompleteTask[] = incomplete.map((t) => {
            const due = t.dueDate ? String(t.dueDate).slice(0, 10) : null;
            return {
              id: t._id,
              title: t.title || 'Untitled task',
              status: String(t.status || 'To Do'),
              priority: t.priority,
              projectId: t.projectId,
              projectName: t.projectName,
              dueDate: due,
              isOverdue: Boolean(due && due < today && t.status !== 'Completed'),
            };
          });

          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          return {
            userId,
            name: displayUserLabel(u.displayName || u.name, u.username, u.email || 'Team member'),
            email: u.email,
            role: u.role || u.designation,
            totalTasks,
            completedTasks,
            incompleteTasks: incomplete.length,
            progress,
            incompleteTaskList,
          };
        })
        .sort((a, b) => {
          if (b.totalTasks !== a.totalTasks) return b.totalTasks - a.totalTasks;
          return a.name.localeCompare(b.name);
        });

      for (const [assigneeId, tasks] of byUser.entries()) {
        if (employees.some((e) => e.userId === assigneeId)) continue;
        const sample = tasks[0];
        const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
        const incomplete = tasks.filter((t) => t.status !== 'Completed');
        employees.push({
          userId: assigneeId,
          name: displayUserLabel(
            sample?.assigneeName || sample?.assignedUsername,
            assigneeId,
            'Team member'
          ),
          totalTasks: tasks.length,
          completedTasks,
          incompleteTasks: incomplete.length,
          progress: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
          incompleteTaskList: incomplete.map((t) => {
            const due = t.dueDate ? String(t.dueDate).slice(0, 10) : null;
            return {
              id: t._id,
              title: t.title || 'Untitled task',
              status: String(t.status || 'To Do'),
              priority: t.priority,
              projectId: t.projectId,
              projectName: t.projectName,
              dueDate: due,
              isOverdue: Boolean(due && due < today && t.status !== 'Completed'),
            };
          }),
        });
      }

      employees.sort((a, b) => {
        if (b.totalTasks !== a.totalTasks) return b.totalTasks - a.totalTasks;
        return a.name.localeCompare(b.name);
      });

      const totalTasks = employees.reduce((s, e) => s + e.totalTasks, 0);
      const completedTasks = employees.reduce((s, e) => s + e.completedTasks, 0);
      const withWork = employees.filter((e) => e.totalTasks > 0);
      const avgProgress =
        withWork.length > 0
          ? Math.round(withWork.reduce((s, e) => s + e.progress, 0) / withWork.length)
          : 0;

      return {
        range: { from: params.from || '', to: params.to || '' },
        employees,
        totalEmployees: employees.length,
        totalTasks,
        completedTasks,
        avgProgress,
        message:
          employees.length === 0
            ? 'No employees with assignable CRM roles found.'
            : undefined,
      };
    };

    try {
      const data = await buildFromLocal();
      return { success: true, data };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          range: { from: params.from || '', to: params.to || '' },
          employees: [],
          totalEmployees: 0,
          totalTasks: 0,
          completedTasks: 0,
          avgProgress: 0,
          message: 'Unable to load employee task progress.',
        },
      };
    }
  },

  getTimeReport: async (params: ReportQueryParams = {}): Promise<ApiResponse<TimeReportData>> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();

    const normalize = (raw: TimeReportData & Record<string, unknown>): TimeReportData => {
      const byProject = (Array.isArray(raw.byProject) ? raw.byProject : []).map((p) => {
        const row = p as { name?: string; projectName?: string; hours?: number };
        return {
          name: String(row.name || row.projectName || 'Project'),
          hours: Number(row.hours) || 0,
        };
      });

      const byUser = (Array.isArray(raw.byUser) ? raw.byUser : []).map((u) => {
        const row = u as {
          name?: string;
          username?: string;
          userId?: string;
          hours?: number;
          billableHours?: number;
        };
        return {
          name: String(row.name || row.username || 'Team member'),
          hours: Number(row.hours) || 0,
          billableHours: Number(row.billableHours) || 0,
        };
      });

      const byPeriod = (Array.isArray(raw.byPeriod) ? raw.byPeriod : []).map((p) => {
        const row = p as { period?: string; hours?: number };
        return {
          period: String(row.period || '—'),
          hours: Number(row.hours) || 0,
        };
      });

      const totalHours = Number(raw.totalHours) || 0;
      const billableHours = Number(raw.billableHours) || 0;
      const nonBillableHours =
        raw.nonBillableHours !== undefined
          ? Number(raw.nonBillableHours) || 0
          : Math.max(0, totalHours - billableHours);
      const billablePercent =
        raw.billablePercent !== undefined
          ? Number(raw.billablePercent) || 0
          : totalHours > 0
            ? Math.round((billableHours / totalHours) * 1000) / 10
            : 0;

      return {
        ...raw,
        totalHours,
        billableHours,
        nonBillableHours,
        billablePercent,
        byProject,
        byUser,
        byPeriod,
      };
    };

    try {
      const res = await request<TimeReportData & Record<string, unknown>>(
        qs ? `/reports/time?${qs}` : '/reports/time',
        { method: 'GET' }
      );
      return { success: true, data: normalize(res.data || {}), message: res.message };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: normalize({
          range: { from: params.from || '2026-09-01', to: params.to || '2026-09-30' },
          totalHours: 509,
          billableHours: 422,
          nonBillableHours: 87,
          billablePercent: 82.9,
          byProject: [
            { name: 'ERP Cloud Migration', hours: 142 },
            { name: 'Mobile App Redesign', hours: 198 },
            { name: 'Security Audit', hours: 95 },
            { name: 'AI Integration', hours: 74 },
          ],
          byUser: [
            { name: 'Priya Patel', hours: 162, billableHours: 145 },
            { name: 'Rahul Sharma', hours: 145, billableHours: 128 },
            { name: 'Ananya Roy', hours: 118, billableHours: 94 },
            { name: 'Vikram Mehta', hours: 84, billableHours: 55 },
          ],
          byPeriod: [
            { period: 'May 2026', hours: 380 },
            { period: 'Jun 2026', hours: 420 },
            { period: 'Jul 2026', hours: 490 },
            { period: 'Aug 2026', hours: 465 },
            { period: 'Sep 2026', hours: 509 },
          ],
        }),
      };
    }
  },

  getIncomeExpenseReport: async (
    params: ReportQueryParams = {}
  ): Promise<ApiResponse<IncomeExpenseReportData>> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();
    try {
      return await request<IncomeExpenseReportData>(
        qs ? `/reports/income-expense?${qs}` : '/reports/income-expense',
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          range: { from: params.from || '2026-09-01', to: params.to || '2026-09-30' },
          income: 1480000,
          expenses: 620000,
          netProfit: 860000,
          margin: 58.1,
          byPeriod: [
            { period: 'May 2026', income: 1150000, expenses: 540000, profit: 610000 },
            { period: 'Jun 2026', income: 1280000, expenses: 580000, profit: 700000 },
            { period: 'Jul 2026', income: 1420000, expenses: 610000, profit: 810000 },
            { period: 'Aug 2026', income: 1390000, expenses: 590000, profit: 800000 },
            { period: 'Sep 2026', income: 1480000, expenses: 620000, profit: 860000 },
          ],
          expensesByCategory: [
            { category: 'Infrastructure & Cloud', amount: 210000 },
            { category: 'Software Licenses', amount: 145000 },
            { category: 'Freelance & Subcontractors', amount: 160000 },
            { category: 'Office & Admin', amount: 65000 },
            { category: 'Travel & Meetings', amount: 40000 },
          ],
        },
      };
    }
  },

  getInvoiceAgeingReport: async (params: { clientId?: string } = {}): Promise<ApiResponse<InvoiceAgeingReportData>> => {
    const query = new URLSearchParams();
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();

    const normalize = (raw: InvoiceAgeingReportData & Record<string, unknown>): InvoiceAgeingReportData => {
      const buckets: AgeingBucket[] = (Array.isArray(raw.buckets) ? raw.buckets : []).map((b) => {
        const row = b as AgeingBucket & Record<string, unknown>;
        const label = String(row.bucket || row.label || row.key || 'Unknown');
        return {
          key: row.key != null ? String(row.key) : undefined,
          label: row.label != null ? String(row.label) : label,
          bucket: label,
          count: Number(row.count) || 0,
          amount: Number(row.amount) || 0,
        };
      });

      const invoices: AgeingInvoiceItem[] = (Array.isArray(raw.invoices) ? raw.invoices : []).map((inv) => {
        const row = inv as AgeingInvoiceItem & Record<string, unknown>;
        const balance = Number(row.balance ?? row.balanceDue ?? 0) || 0;
        const bucketLabel = String(row.bucket || '');
        const matched = buckets.find(
          (b) => b.key === bucketLabel || b.bucket === bucketLabel || b.label === bucketLabel
        );
        return {
          id: row.id != null ? String(row.id) : row._id != null ? String(row._id) : undefined,
          invoiceNumber: String(row.invoiceNumber || row.invoiceNo || '—'),
          invoiceNo: row.invoiceNo != null ? String(row.invoiceNo) : undefined,
          clientName: String(row.clientName || '—'),
          issueDate: row.issueDate ? String(row.issueDate) : undefined,
          dueDate: row.dueDate ? String(row.dueDate) : undefined,
          total: Number(row.total ?? balance) || 0,
          balance,
          balanceDue: balance,
          daysOverdue: Number(row.daysOverdue) || 0,
          bucket: matched?.bucket || bucketLabel || '—',
          status: row.status != null ? String(row.status) : undefined,
        };
      });

      const totalUnpaid =
        Number(raw.totalUnpaid ?? raw.totalOutstanding ?? 0) ||
        buckets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

      const totalOverdue =
        Number(raw.totalOverdue) ||
        buckets
          .filter((b) => {
            const key = String(b.key || b.bucket || '').toLowerCase();
            return key && key !== 'current' && !key.includes('not overdue') && !key.includes('not due');
          })
          .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

      return {
        ...raw,
        defaultCurrency: String(raw.defaultCurrency || getRuntimeDefaultCurrency()),
        buckets,
        invoices,
        totalUnpaid,
        totalOverdue,
        totalOutstanding: Number(raw.totalOutstanding ?? totalUnpaid) || totalUnpaid,
      };
    };

    try {
      const res = await request<InvoiceAgeingReportData & Record<string, unknown>>(
        qs ? `/reports/invoice-ageing?${qs}` : '/reports/invoice-ageing',
        { method: 'GET' }
      );
      return { success: true, data: normalize(res.data || {}), message: res.message };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: normalize({
          totalUnpaid: 585000,
          totalOverdue: 265000,
          buckets: [
            { bucket: 'Current (Not Due)', count: 4, amount: 320000 },
            { bucket: '1-30 Days', count: 3, amount: 145000 },
            { bucket: '31-60 Days', count: 2, amount: 75000 },
            { bucket: '61-90 Days', count: 1, amount: 30000 },
            { bucket: '90+ Days Critical', count: 1, amount: 15000 },
          ],
          invoices: [
            {
              invoiceNumber: 'INV-2026-089',
              clientName: 'Acme Corporation',
              issueDate: '2026-08-15',
              dueDate: '2026-09-15',
              total: 180000,
              balance: 180000,
              daysOverdue: 0,
              bucket: 'Current',
            },
            {
              invoiceNumber: 'INV-2026-074',
              clientName: 'Stark Industries',
              issueDate: '2026-08-01',
              dueDate: '2026-08-31',
              total: 145000,
              balance: 145000,
              daysOverdue: 9,
              bucket: '1-30 Days',
            },
            {
              invoiceNumber: 'INV-2026-061',
              clientName: 'Wayne Enterprises',
              issueDate: '2026-07-15',
              dueDate: '2026-08-14',
              total: 120000,
              balance: 75000,
              daysOverdue: 26,
              bucket: '1-30 Days',
            },
            {
              invoiceNumber: 'INV-2026-045',
              clientName: 'Cyberdyne Systems',
              issueDate: '2026-06-20',
              dueDate: '2026-07-20',
              total: 85000,
              balance: 45000,
              daysOverdue: 51,
              bucket: '31-60 Days',
            },
            {
              invoiceNumber: 'INV-2026-022',
              clientName: 'Globex Corp',
              issueDate: '2026-05-10',
              dueDate: '2026-06-10',
              total: 15000,
              balance: 15000,
              daysOverdue: 91,
              bucket: '90+ Days',
            },
          ],
        }),
      };
    }
  },

  getRecurringInvoicesReport: async (
    params: { clientId?: string } = {}
  ): Promise<ApiResponse<RecurringInvoicesReportData>> => {
    const query = new URLSearchParams();
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();
    try {
      return await request<RecurringInvoicesReportData>(
        qs ? `/reports/recurring-invoices?${qs}` : '/reports/recurring-invoices',
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          totalActive: 8,
          monthlyRecurringRevenue: 345000,
          annualRecurringRevenue: 4140000,
          byFrequency: [
            { frequency: 'Monthly', count: 5, amount: 220000 },
            { frequency: 'Quarterly', count: 2, amount: 95000 },
            { frequency: 'Annual', count: 1, amount: 30000 },
          ],
          upcomingRuns: [
            {
              clientName: 'Acme Corporation',
              invoiceNumber: 'REC-001',
              nextRunDate: '2026-09-15',
              amount: 75000,
              frequency: 'Monthly',
              status: 'Active',
            },
            {
              clientName: 'Stark Industries',
              invoiceNumber: 'REC-002',
              nextRunDate: '2026-09-20',
              amount: 65000,
              frequency: 'Monthly',
              status: 'Active',
            },
            {
              clientName: 'Wayne Enterprises',
              invoiceNumber: 'REC-003',
              nextRunDate: '2026-10-01',
              amount: 120000,
              frequency: 'Quarterly',
              status: 'Active',
            },
          ],
        },
      };
    }
  },

  getCreditNotesReport: async (
    params: ReportQueryParams = {}
  ): Promise<ApiResponse<CreditNotesReportData>> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();
    try {
      return await request<CreditNotesReportData>(
        qs ? `/reports/credit-notes?${qs}` : '/reports/credit-notes',
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          range: { from: params.from || '2026-09-01', to: params.to || '2026-09-30' },
          totalIssued: 85000,
          totalApplied: 52000,
          totalRefunded: 18000,
          availableBalance: 15000,
          notes: [
            {
              creditNoteNumber: 'CN-2026-008',
              clientName: 'Acme Corporation',
              invoiceNumber: 'INV-2026-055',
              issueDate: '2026-08-20',
              amount: 35000,
              remainingAmount: 0,
              status: 'Applied',
            },
            {
              creditNoteNumber: 'CN-2026-007',
              clientName: 'Stark Industries',
              invoiceNumber: 'INV-2026-042',
              issueDate: '2026-08-12',
              amount: 25000,
              remainingAmount: 10000,
              status: 'Partially Applied',
            },
            {
              creditNoteNumber: 'CN-2026-006',
              clientName: 'Globex Corp',
              invoiceNumber: 'INV-2026-031',
              issueDate: '2026-07-28',
              amount: 18000,
              remainingAmount: 0,
              status: 'Refunded',
            },
            {
              creditNoteNumber: 'CN-2026-005',
              clientName: 'Cyberdyne Systems',
              invoiceNumber: 'INV-2026-019',
              issueDate: '2026-07-10',
              amount: 7000,
              remainingAmount: 5000,
              status: 'Active',
            },
          ],
        },
      };
    }
  },

  getPaymentReconciliationReport: async (
    params: ReportQueryParams = {}
  ): Promise<ApiResponse<PaymentReconciliationReportData>> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.clientId) query.set('clientId', params.clientId);
    const qs = query.toString();
    try {
      return await request<PaymentReconciliationReportData>(
        qs ? `/reports/payment-reconciliation?${qs}` : '/reports/payment-reconciliation',
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: {
          range: { from: params.from || '2026-09-01', to: params.to || '2026-09-30' },
          totalPaymentsCount: 64,
          grossAmount: 1680000,
          totalRefunds: 42000,
          netCollected: 1638000,
          byMethod: [
            { method: 'Bank Transfer / NEFT', count: 32, gross: 980000, refunds: 15000, net: 965000 },
            { method: 'Credit Card / Stripe', count: 18, gross: 420000, refunds: 18000, net: 402000 },
            { method: 'UPI / Razorpay', count: 10, gross: 210000, refunds: 9000, net: 201000 },
            { method: 'Cheque', count: 4, gross: 70000, refunds: 0, net: 70000 },
          ],
          payments: [
            {
              receiptNumber: 'RCP-2026-114',
              paymentDate: '2026-09-08',
              clientName: 'Acme Corporation',
              invoiceNumber: 'INV-2026-081',
              paymentMode: 'Bank Transfer',
              amount: 125000,
              refundedAmount: 0,
              netAmount: 125000,
              status: 'Completed',
              currency: getRuntimeDefaultCurrency(),
            },
            {
              receiptNumber: 'RCP-2026-113',
              paymentDate: '2026-09-06',
              clientName: 'Stark Industries',
              invoiceNumber: 'INV-2026-079',
              paymentMode: 'Credit Card',
              amount: 85000,
              refundedAmount: 0,
              netAmount: 85000,
              status: 'Completed',
              currency: getRuntimeDefaultCurrency(),
            },
            {
              receiptNumber: 'RCP-2026-112',
              paymentDate: '2026-09-03',
              clientName: 'Globex Corp',
              invoiceNumber: 'INV-2026-070',
              paymentMode: 'Razorpay',
              amount: 35000,
              refundedAmount: 12000,
              netAmount: 23000,
              status: 'Refunded',
              currency: getRuntimeDefaultCurrency(),
            },
            {
              receiptNumber: 'RCP-2026-111',
              paymentDate: '2026-08-30',
              clientName: 'Wayne Enterprises',
              invoiceNumber: 'INV-2026-068',
              paymentMode: 'Bank Transfer',
              amount: 210000,
              refundedAmount: 0,
              netAmount: 210000,
              status: 'Completed',
              currency: getRuntimeDefaultCurrency(),
            },
          ],
        },
      };
    }
  },

  downloadReportCsv: async (
    report: string,
    params: ReportQueryParams = {}
  ): Promise<string> => {
    const query = new URLSearchParams();
    query.set('report', report);
    query.set('type', 'csv');
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.clientId) query.set('clientId', params.clientId);

    const path = `/reports/export?${query.toString()}`;
    const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;

    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const text = await response.text();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const filename = filenameMatch?.[1] || `${report}_report.csv`;

      triggerFileDownload({
        filename,
        content: text,
        format: 'csv',
        directUrl: url,
      });
      return filename;
    } catch (error) {
      rethrowUnlessMockFallback(error);
      // Fallback mock CSV generator for offline / dev preview
      const filename = `${report}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      let csvContent = 'Metric,Value\r\n';
      if (report === 'sales') {
        csvContent = 'Stage,Count\r\nNew,12\r\nContacted,10\r\nQualified,8\r\nProposal Sent,6\r\nWon,18\r\nLost,4\r\n';
      } else if (report === 'lead-conversion') {
        csvContent = 'Sales Rep,Won,Total Assigned,Win Rate (%)\r\nRahul Sharma,9,18,50.0%\r\nPriya Patel,7,16,43.8%\r\nAnanya Roy,5,14,35.7%\r\nVikram Mehta,3,10,30.0%\r\n';
      } else if (report === 'projects') {
        csvContent = 'Project,Client,Status,Progress (%),Logged Hours\r\nERP Cloud Migration,Acme Corporation,In Progress,75%,142h\r\nMobile App Redesign,Stark Industries,In Progress,68%,198h\r\nSecurity Audit,Wayne Enterprises,Completed,100%,95h\r\n';
      } else if (report === 'time') {
        csvContent = 'Team Member,Total Hours,Billable Hours,Utilization (%)\r\nPriya Patel,162,145,89.5%\r\nRahul Sharma,145,128,88.3%\r\nAnanya Roy,118,94,79.7%\r\nVikram Mehta,84,55,65.5%\r\n';
      } else if (report === 'income-expense') {
        csvContent = 'Period,Income,Expenses,Net Operating Profit\r\nMay 2026,1150000,540000,610000\r\nJun 2026,1280000,580000,700000\r\nJul 2026,1420000,610000,810000\r\nAug 2026,1390000,590000,800000\r\nSep 2026,1480000,620000,860000\r\n';
      } else if (report === 'invoice-ageing') {
        csvContent = 'Invoice #,Client,Due Date,Total,Balance Due,Days Overdue,Bracket\r\nINV-2026-089,Acme Corporation,2026-09-15,180000,180000,0,Current\r\nINV-2026-074,Stark Industries,2026-08-31,145000,145000,9,1-30 Days\r\nINV-2026-061,Wayne Enterprises,2026-08-14,120000,75000,26,1-30 Days\r\nINV-2026-045,Cyberdyne Systems,2026-07-20,85000,45000,51,31-60 Days\r\n';
      } else if (report === 'recurring-invoices') {
        csvContent = 'Client,Profile #,Next Run Date,Amount,Frequency,Status\r\nAcme Corporation,REC-001,2026-09-15,75000,Monthly,Active\r\nStark Industries,REC-002,2026-09-20,65000,Monthly,Active\r\nWayne Enterprises,REC-003,2026-10-01,120000,Quarterly,Active\r\n';
      } else if (report === 'credit-notes') {
        csvContent = 'Credit Note #,Client,Linked Invoice,Issue Date,Original Value,Remaining Balance,Status\r\nCN-2026-008,Acme Corporation,INV-2026-055,2026-08-20,35000,0,Applied\r\nCN-2026-007,Stark Industries,INV-2026-042,2026-08-12,25000,10000,Partially Applied\r\n';
      } else if (report === 'payment-reconciliation') {
        csvContent = 'Receipt #,Date,Client,Invoice #,Payment Mode,Gross,Refund,Net,Status\r\nRCP-2026-114,2026-09-08,Acme Corporation,INV-2026-081,Bank Transfer,125000,0,125000,Completed\r\nRCP-2026-113,2026-09-06,Stark Industries,INV-2026-079,Credit Card,85000,0,85000,Completed\r\n';
      }

      triggerFileDownload({
        filename,
        content: csvContent,
        format: 'csv',
      });
      return filename;
    }
  },

  // ─── WAVE 4 ADMIN APIS ───────────────────────────────────────────────────
  getSettings: async (): Promise<ApiResponse<CrmSettings>> => {
    try {
      const response = await request<CrmSettings>('/settings', { method: 'GET' });
      return { ...response, data: normalizeCrmSettings(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: getLocalCrmSettings(), message: 'Settings loaded' };
    }
  },

  updateSettings: async (body: Partial<CrmSettings>): Promise<ApiResponse<CrmSettings>> => {
    try {
      const response = await request<CrmSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      // Prefer request body for keys we just saved (e.g. default_currency), then API map.
      return {
        ...response,
        data: normalizeCrmSettings({ ...(response.data || {}), ...body }),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const current = getLocalCrmSettings();
      const updated = normalizeCrmSettings({ ...current, ...body });
      // company_name / company_state are filled by normalizeCrmSettings when blank
      if (!/^[A-Z]{3}$/.test(updated.default_currency.trim().toUpperCase())) {
        throw new ApiError('Currency must be a three-letter ISO code', 400);
      }
      if (updated.tax_rate < 0 || updated.tax_rate > 100) {
        throw new ApiError('Tax rate must be between 0 and 100', 400);
      }
      if (updated.task_client_reminder_hours < 1 || updated.task_client_reminder_hours > 720) {
        throw new ApiError('Reminder hours must be between 1 and 720', 400);
      }
      const prefixKeys: Array<keyof CrmSettings> = [
        'quotation_prefix',
        'invoice_prefix',
        'payment_prefix',
        'expense_prefix',
        'client_tax_id_prefix',
      ];
      for (const key of prefixKeys) {
        const value = String(updated[key] || '').trim();
        if (!value || value.length > 20) throw new ApiError(`${String(key)} is required (max 20 chars)`, 400);
      }
      updated.default_currency = updated.default_currency.trim().toUpperCase();
      saveLocalCrmSettings(updated);
      return { success: true, data: updated, message: 'Settings saved locally' };
    }
  },

  getPipelineSettings: async (): Promise<ApiResponse<{ pipeline_stages: string[] }>> => {
    try {
      return await request<{ pipeline_stages: string[] }>('/settings/pipeline', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: { pipeline_stages: getLocalCrmSettings().pipeline_stages } };
    }
  },

  getOpportunityPipelineSettings: async (): Promise<
    ApiResponse<{
      opportunity_stages: string[];
      opportunity_stage_probabilities: Record<string, number>;
    }>
  > => {
    try {
      return await request<{
        opportunity_stages: string[];
        opportunity_stage_probabilities: Record<string, number>;
      }>('/settings/opportunity-pipeline', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const local = getLocalCrmSettings();
      return {
        success: true,
        data: {
          opportunity_stages: local.opportunity_stages,
          opportunity_stage_probabilities: local.opportunity_stage_probabilities,
        },
      };
    }
  },

  listOpportunityPipelines: async (): Promise<ApiResponse<OpportunityPipeline[]>> => {
    try {
      return await request<OpportunityPipeline[]>('/opportunity-pipelines', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      throw error;
    }
  },

  getActiveOpportunityPipeline: async (): Promise<
    ApiResponse<OpportunityPipeline> & { catalog?: typeof DEFAULT_STAGE_CATALOG }
  > => {
    try {
      return await request<OpportunityPipeline>('/opportunity-pipelines/active', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      throw error;
    }
  },

  getOpportunityPipelineCatalog: async (): Promise<
    ApiResponse<(typeof DEFAULT_STAGE_CATALOG)[number][]>
  > => {
    try {
      return await request<(typeof DEFAULT_STAGE_CATALOG)[number][]>(
        '/opportunity-pipelines/catalog',
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: [...DEFAULT_STAGE_CATALOG], message: 'Default stage catalog' };
    }
  },

  getOpportunityPipeline: async (id: string): Promise<ApiResponse<OpportunityPipeline>> => {
    return request<OpportunityPipeline>(`/opportunity-pipelines/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  },

  createOpportunityPipeline: async (
    body: OpportunityPipelineInput
  ): Promise<ApiResponse<OpportunityPipeline>> => {
    return request<OpportunityPipeline>('/opportunity-pipelines', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateOpportunityPipeline: async (
    id: string,
    body: Partial<OpportunityPipelineInput> & { isEnabled?: boolean }
  ): Promise<ApiResponse<OpportunityPipeline>> => {
    return request<OpportunityPipeline>(`/opportunity-pipelines/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  activateOpportunityPipeline: async (id: string): Promise<ApiResponse<OpportunityPipeline>> => {
    return request<OpportunityPipeline>(
      `/opportunity-pipelines/${encodeURIComponent(id)}/activate`,
      { method: 'POST' }
    );
  },

  deleteOpportunityPipeline: async (
    id: string
  ): Promise<ApiResponse<{ deleted: boolean; id: string }>> => {
    return request<{ deleted: boolean; id: string }>(
      `/opportunity-pipelines/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
  },

  listRequestTypes: async (
    params: { includeDisabled?: boolean; enabledOnly?: boolean } = {}
  ): Promise<ApiResponse<RequestType[]>> => {
    const query = new URLSearchParams();
    if (params.enabledOnly) query.set('enabledOnly', 'true');
    else if (params.includeDisabled === false) query.set('includeDisabled', 'false');
    const qs = query.toString();
    return request<RequestType[]>(qs ? `/request-types?${qs}` : '/request-types', {
      method: 'GET',
    });
  },

  getRequestType: async (id: string): Promise<ApiResponse<RequestType>> => {
    return request<RequestType>(`/request-types/${encodeURIComponent(id)}`, { method: 'GET' });
  },

  createRequestType: async (body: RequestTypeInput): Promise<ApiResponse<RequestType>> => {
    return request<RequestType>('/request-types', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateRequestType: async (
    id: string,
    body: Partial<RequestTypeInput> & { isEnabled?: boolean }
  ): Promise<ApiResponse<RequestType>> => {
    return request<RequestType>(`/request-types/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  deleteRequestType: async (
    id: string
  ): Promise<ApiResponse<{ deleted: boolean; id: string }>> => {
    return request<{ deleted: boolean; id: string }>(
      `/request-types/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
  },

  /** Promote a lead-specific option into the Request Type global field catalog. */
  addRequestTypeFieldOption: async (
    requestTypeId: string,
    fieldKey: string,
    body: { label: string; value?: string; addToMatchCatalog?: boolean }
  ): Promise<ApiResponse<RequestType>> => {
    return request<RequestType>(
      `/request-types/${encodeURIComponent(requestTypeId)}/fields/${encodeURIComponent(fieldKey)}/options`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  },

  updatePipelineSettings: async (
    body: { pipeline_stages: string[] }
  ): Promise<ApiResponse<{ pipeline_stages: string[] }>> => {
    try {
      return await request<{ pipeline_stages: string[] }>('/settings/pipeline', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.pipeline_stages?.length) throw new ApiError('At least one pipeline stage is required', 400);
      const updated = normalizeCrmSettings({
        ...getLocalCrmSettings(),
        pipeline_stages: body.pipeline_stages,
      });
      saveLocalCrmSettings(updated);
      return { success: true, data: { pipeline_stages: updated.pipeline_stages } };
    }
  },

  getGroqIntegration: async (): Promise<ApiResponse<GroqIntegrationStatus>> => {
    return request<GroqIntegrationStatus>('/settings/integrations/groq', { method: 'GET' });
  },

  updateGroqIntegration: async (body: {
    apiKey?: string;
    model?: string;
    clearKey?: boolean;
  }): Promise<ApiResponse<GroqIntegrationStatus>> => {
    return request<GroqIntegrationStatus>('/settings/integrations/groq', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  getGoogleMapsIntegration: async (): Promise<ApiResponse<GoogleMapsIntegrationStatus>> => {
    return request<GoogleMapsIntegrationStatus>('/settings/integrations/google-maps', {
      method: 'GET',
    });
  },

  updateGoogleMapsIntegration: async (body: {
    apiKey?: string;
    clearKey?: boolean;
  }): Promise<ApiResponse<GoogleMapsIntegrationStatus>> => {
    return request<GoogleMapsIntegrationStatus>('/settings/integrations/google-maps', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  /** Decrypted Maps key for Places Autocomplete (authenticated staff). */
  getGoogleMapsClientKey: async (): Promise<ApiResponse<GoogleMapsClientKey>> => {
    return request<GoogleMapsClientKey>('/settings/integrations/google-maps/client-key', {
      method: 'GET',
    });
  },

  getSettingsEmailStatus: async (): Promise<ApiResponse<SettingsEmailStatus>> => {
    try {
      return await request<SettingsEmailStatus>('/settings/email-status', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const saved = readLocalAdminValue<SettingsEmailStatus>(SETTINGS_EMAIL_STATUS_KEY, {
        configured: true,
        pluginAvailable: true,
        lastTestAt: null,
        message: 'Email plugin ready (local mock).',
      });
      return { success: true, data: saved };
    }
  },

  sendSettingsTestEmail: async (
    body: { to: string }
  ): Promise<ApiResponse<{ sent: boolean; to: string }>> => {
    try {
      return await request<{ sent: boolean; to: string }>('/settings/test-email', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to || '')) {
        throw new ApiError('Valid recipient email is required', 400);
      }
      const status: SettingsEmailStatus = {
        configured: true,
        pluginAvailable: true,
        lastTestAt: new Date().toISOString(),
        message: `Test email queued for ${body.to}`,
      };
      saveLocalAdminValue(SETTINGS_EMAIL_STATUS_KEY, status);
      return {
        success: true,
        data: { sent: true, to: body.to },
        message: `Test email queued for ${body.to}`,
      };
    }
  },

  getTravelLocations: async (): Promise<
    ApiResponse<{ from: string[]; to: string[]; destination: string[] }>
  > => {
    const normalizeLocationList = (items: unknown, fallback: string[]): string[] => {
      if (!Array.isArray(items)) return fallback;
      const res = items
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const row = item as { label?: string; optionKey?: string; name?: string; value?: string };
            return String(row.label || row.name || row.value || row.optionKey || '').trim();
          }
          return '';
        })
        .filter(Boolean);
      return res.length ? res : fallback;
    };

    try {
      const res = await request<{ from?: unknown; to?: unknown; destination?: unknown }>(
        '/travel/settings/locations',
        { method: 'GET' }
      );
      if (res.data) {
        return {
          success: true,
          data: {
            from: normalizeLocationList(res.data.from, DEFAULT_TRAVEL_LOCATIONS.from),
            to: normalizeLocationList(res.data.to, DEFAULT_TRAVEL_LOCATIONS.to),
            destination: normalizeLocationList(res.data.destination, DEFAULT_TRAVEL_LOCATIONS.destination),
          },
        };
      }
    } catch {
      // fallback
    }
    const saved = readLocalAdminValue<{ from: unknown; to: unknown; destination: unknown }>(
      'opennext_travel_locations_v1',
      DEFAULT_TRAVEL_LOCATIONS
    );
    return {
      success: true,
      data: {
        from: normalizeLocationList(saved.from, DEFAULT_TRAVEL_LOCATIONS.from),
        to: normalizeLocationList(saved.to, DEFAULT_TRAVEL_LOCATIONS.to),
        destination: normalizeLocationList(saved.destination, DEFAULT_TRAVEL_LOCATIONS.destination),
      },
    };
  },

  saveTravelLocations: async (body: {
    from: string[];
    to: string[];
    destination: string[];
  }): Promise<ApiResponse<{ from: string[]; to: string[]; destination: string[] }>> => {
    const normalizeLocationList = (items: unknown): string[] => {
      if (!Array.isArray(items)) return [];
      return items
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const row = item as { label?: string; optionKey?: string; name?: string; value?: string };
            return String(row.label || row.name || row.value || row.optionKey || '').trim();
          }
          return '';
        })
        .filter(Boolean);
    };

    const cleanBody = {
      from: normalizeLocationList(body.from),
      to: normalizeLocationList(body.to),
      destination: normalizeLocationList(body.destination),
    };
    saveLocalAdminValue('opennext_travel_locations_v1', cleanBody);
    try {
      const res = await request<{ from?: unknown; to?: unknown; destination?: unknown }>(
        '/travel/settings/locations',
        {
          method: 'PUT',
          body: JSON.stringify(cleanBody),
        }
      );
      if (res.data) {
        return {
          success: true,
          data: {
            from: normalizeLocationList(res.data.from),
            to: normalizeLocationList(res.data.to),
            destination: normalizeLocationList(res.data.destination),
          },
        };
      }
    } catch {
      // fallback
    }
    return { success: true, data: cleanBody, message: 'Travel locations saved' };
  },

  getTravelServices: async (): Promise<ApiResponse<string[]>> => {
    const normalizeServiceList = (items: unknown, fallback: string[]): string[] => {
      if (!Array.isArray(items)) return fallback;
      const res = items
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const row = item as { label?: string; name?: string; serviceKey?: string; serviceId?: string; id?: string };
            return String(row.label || row.name || row.serviceKey || row.serviceId || row.id || '').trim();
          }
          return '';
        })
        .filter(Boolean);
      return res.length ? res : fallback;
    };

    try {
      const res = await request<unknown>('/travel/settings/services', { method: 'GET' });
      if (res.data) {
        return {
          success: true,
          data: normalizeServiceList(res.data, DEFAULT_TRAVEL_SERVICES),
        };
      }
    } catch {
      // fallback
    }
    const saved = readLocalAdminValue<unknown>('opennext_travel_services_v1', DEFAULT_TRAVEL_SERVICES);
    return {
      success: true,
      data: normalizeServiceList(saved, DEFAULT_TRAVEL_SERVICES),
    };
  },

  saveTravelServices: async (services: string[]): Promise<ApiResponse<string[]>> => {
    const normalizeServiceList = (items: unknown): string[] => {
      if (!Array.isArray(items)) return [];
      return items
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const row = item as { label?: string; name?: string; serviceKey?: string; serviceId?: string; id?: string };
            return String(row.label || row.name || row.serviceKey || row.serviceId || row.id || '').trim();
          }
          return '';
        })
        .filter(Boolean);
    };

    const cleanList = normalizeServiceList(services);
    saveLocalAdminValue('opennext_travel_services_v1', cleanList);
    try {
      const res = await request<unknown>('/travel/settings/services', {
        method: 'PUT',
        body: JSON.stringify({ services: cleanList }),
      });
      if (res.data) {
        return {
          success: true,
          data: normalizeServiceList(res.data),
          message: 'Travel service requirements saved',
        };
      }
    } catch {
      // fallback
    }
    return { success: true, data: cleanList, message: 'Travel service requirements saved' };
  },

  getTravelRequirementFields: async (options?: { all?: boolean }): Promise<
    ApiResponse<
      Array<{
        fieldId: string;
        fieldKey: string;
        name: string;
        type: string;
        serviceIds: string[];
        options: string[];
        required?: boolean;
        placeholder?: string;
        helpText?: string;
        displayOrder?: number;
        enabled?: boolean;
      }>
    >
  > => {
    try {
      const q = options?.all ? '?all=1' : '';
      const res = await request<any>(`/travel/requirement-fields${q}`, { method: 'GET' });
      if (res && res.data) {
        return { success: true, data: Array.isArray(res.data) ? res.data : [] };
      }
    } catch {
      // fallback
    }
    const local = readLocalAdminValue<any[]>('opennext_travel_req_fields_v1', []);
    return { success: true, data: Array.isArray(local) ? local : [] };
  },

  createTravelRequirementField: async (body: {
    name: string;
    type: string;
    serviceIds: string[];
    options?: string[];
    required?: boolean;
    placeholder?: string;
    helpText?: string;
  }): Promise<ApiResponse<any>> => {
    try {
      const res = await request<any>('/travel/requirement-fields', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res && res.data) return res;
    } catch {
      // fallback
    }
    const current = readLocalAdminValue<any[]>('opennext_travel_req_fields_v1', []);
    const newField = {
      fieldId: `trf_${Date.now()}`,
      fieldKey: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      ...body,
      enabled: true,
      displayOrder: current.length * 10,
    };
    current.push(newField);
    saveLocalAdminValue('opennext_travel_req_fields_v1', current);
    return { success: true, data: newField, message: 'Field created successfully' };
  },

  updateTravelRequirementField: async (
    fieldId: string,
    body: {
      name?: string;
      type?: string;
      serviceIds?: string[];
      options?: string[];
      required?: boolean;
      placeholder?: string;
      helpText?: string;
      displayOrder?: number;
      enabled?: boolean;
    }
  ): Promise<ApiResponse<any>> => {
    try {
      const res = await request<any>(`/travel/requirement-fields/${encodeURIComponent(fieldId)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (res && res.data) {
        const current = readLocalAdminValue<any[]>('opennext_travel_req_fields_v1', []);
        const idx = current.findIndex((f: any) => f.fieldId === fieldId);
        if (idx >= 0) {
          current[idx] = { ...current[idx], ...res.data };
          saveLocalAdminValue('opennext_travel_req_fields_v1', current);
        }
        return res;
      }
    } catch {
      // fallback
    }
    const current = readLocalAdminValue<any[]>('opennext_travel_req_fields_v1', []);
    const idx = current.findIndex((f: any) => f.fieldId === fieldId);
    let updatedItem = { fieldId, ...body };
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...body };
      updatedItem = current[idx];
      saveLocalAdminValue('opennext_travel_req_fields_v1', current);
    }
    return { success: true, data: updatedItem, message: 'Field updated successfully' };
  },

  deleteTravelRequirementField: async (fieldId: string): Promise<ApiResponse<any>> => {
    try {
      const res = await request<any>(`/travel/requirement-fields/${encodeURIComponent(fieldId)}`, {
        method: 'DELETE',
      });
      if (res && res.data) return res;
    } catch {
      // fallback
    }
    const current = readLocalAdminValue<any[]>('opennext_travel_req_fields_v1', []);
    const filtered = current.filter((f: any) => f.fieldId !== fieldId);
    saveLocalAdminValue('opennext_travel_req_fields_v1', filtered);
    return { success: true, data: { deleted: true } };
  },

  getLeadTravelRequirements: async (leadId: string): Promise<ApiResponse<{ lead?: any; sections?: any[] }>> => {
    try {
      const res = await request<any>(`/travel/leads/${encodeURIComponent(leadId)}/requirements`, { method: 'GET' });
      if (res && res.data) return res;
    } catch {
      // fallback
    }
    return { success: true, data: { lead: null, sections: [] } };
  },

  saveLeadTravelServiceRequirement: async (leadId: string, serviceId: string, values: Record<string, unknown>): Promise<ApiResponse<any>> => {
    try {
      const res = await request<any>(`/travel/leads/${encodeURIComponent(leadId)}/requirements/${encodeURIComponent(serviceId)}`, {
        method: 'POST',
        body: JSON.stringify({ values }),
      });
      if (res && res.data) return res;
    } catch {
      // fallback
    }
    return { success: true, data: { leadId, serviceId, values } };
  },

  listSettingsWorkspaceUsers: async (): Promise<ApiResponse<SettingsWorkspaceUser[]>> => {
    try {
      const [membersRes, matrixRes, contextRes] = await Promise.all([
        request<unknown>('/tenant/members?limit=100', { method: 'GET' }),
        request<{
          rolePermissions?: Record<string, string[]>;
          groups?: Array<{ category: string; permissions?: Array<{ key: string }> }>;
        }>('/tenant/role-permissions', { method: 'GET' }).catch(() => ({
          success: true as const,
          data: { rolePermissions: {}, groups: [] },
        })),
        request<{ userId?: string }>('/tenant/context', { method: 'GET' }).catch(() => ({
          success: true as const,
          data: { userId: undefined },
        })),
      ]);

      const rolePermissions = matrixRes.data?.rolePermissions || {};
      const currentUserId = contextRes.data?.userId;
      const users = extractSettingsMembersList(membersRes.data)
        .map((item) =>
          normalizeSettingsWorkspaceUser(item, { rolePermissions, currentUserId })
        )
        .filter((item): item is SettingsWorkspaceUser => Boolean(item));

      return {
        success: true,
        data: users,
        message: membersRes.message || 'Tenant members loaded',
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: buildWorkspaceUsers() };
    }
  },

  updateSettingsUserDesignation: async (
    userId: string,
    body: { designation: string }
  ): Promise<ApiResponse<SettingsWorkspaceUser>> => {
    try {
      const response = await request<unknown>(`/tenant/members/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const normalized =
        normalizeSettingsWorkspaceUser(response.data, {}) ||
        normalizeSettingsWorkspaceUser(
          {
            userId,
            id: userId,
            designation: body.designation,
            username: userId,
            role: 'Member',
          },
          {}
        );
      if (!normalized) throw new ApiError('Failed to update designation', 500);
      return {
        success: true,
        data: {
          ...normalized,
          designation: body.designation?.trim() || normalized.designation || '',
        },
        message: response.message || 'Designation saved',
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const designation = body.designation?.trim() || '';
      if (designation.length > 120) throw new ApiError('Designation max 120 characters', 400);
      const map = getLocalUserDesignations();
      map[userId] = designation;
      saveLocalUserDesignations(map);
      const user = buildWorkspaceUsers().find((item) => item.id === userId);
      if (!user) throw new ApiError('User not found', 404);
      return { success: true, data: user, message: 'Designation saved' };
    }
  },

  getAuditHistory: async (
    params: AuditQuery = {}
  ): Promise<ApiResponse<AuditEntry[]> & { pagination?: AdminPagination }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.recordType) query.set('module', params.recordType);
    if (params.search) query.set('search', params.search);
    try {
      return await request<AuditEntry[]>(query.size ? `/audit?${query}` : '/audit', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const now = Date.now();
      const entries: AuditEntry[] = [
        { _id: 'audit-1', username: 'Admin User', action: 'updated', module: 'settings', recordId: 'crm-settings', description: 'Updated company and finance settings', createdAt: new Date(now - 18 * 60 * 1000).toISOString() },
        { _id: 'audit-2', username: 'Priya Patel', action: 'created', module: 'lead', recordId: 'lead-1042', description: 'Created lead Northstar Digital', createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
        { _id: 'audit-3', username: 'Rahul Sharma', action: 'updated', module: 'project', recordId: 'project-208', description: 'Changed project status to In Progress', createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString() },
      ];
      const term = params.search?.trim().toLowerCase();
      const filtered = entries.filter((entry) =>
        (!params.recordType || entry.module === params.recordType) &&
        (!term || [entry.action, entry.module, entry.recordId, entry.description, entry.username].some((value) => value?.toLowerCase().includes(term)))
      );
      return { success: true, data: filtered, pagination: { page: 1, limit: params.limit || 25, total: filtered.length, totalPages: 1 } };
    }
  },

  getDataQuality: async (
    params: DataQualityQuery = {}
  ): Promise<ApiResponse<DataQualityIssue[]> & { summary?: DataQualitySummary; pagination?: AdminPagination }> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      return await request<DataQualityIssue[]>(query.size ? `/data-quality?${query}` : '/data-quality', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return computeLocalDataQuality(params);
    }
  },

  downloadDataQualityExport: async (
    params: DataQualityQuery & { format?: 'csv' | 'json' } = {}
  ): Promise<{ filename: string; content: string; format: string; directUrl?: string; recordCount?: number }> => {
    const format = params.format || 'csv';
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      const res = await fetch(`${API_BASE}/data-quality/export?${query.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const content = await blob.text();
      const disposition = res.headers.get('content-disposition');
      const match = disposition?.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `data_quality_${params.recordType || 'lead'}_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      triggerFileDownload({ filename, content, format });
      return { filename, content, format, recordCount: content.split('\n').length - 1 };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const dqResult = computeLocalDataQuality({ ...params, limit: 1000 });
      const items = dqResult.data || [];
      const filename = `data_quality_${params.recordType || 'lead'}_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      let content = '';
      if (format === 'json') {
        content = JSON.stringify(items, null, 2);
      } else {
        const escapeCsv = (str: unknown) => `"${String(str ?? '').replace(/"/g, '""')}"`;
        const headers = ['ID', 'Name', 'Company', 'Email', 'Phone', 'Quality Score', 'Status', 'Possible Matches', 'Match Reasons', 'Missing Fields'];
        const rows = [headers.join(',')];
        for (const it of items) {
          const reasons = it.matches.flatMap((m) => m.reasons).join('; ');
          const missing = it.dataQuality.missing.join('; ');
          rows.push([
            escapeCsv(it.id),
            escapeCsv(it.name),
            escapeCsv(it.company),
            escapeCsv(it.email),
            escapeCsv(it.phone),
            escapeCsv(it.dataQuality.score),
            escapeCsv(it.dataQuality.label),
            escapeCsv(it.matches.length),
            escapeCsv(reasons),
            escapeCsv(missing),
          ].join(','));
        }
        content = rows.join('\r\n');
      }
      triggerFileDownload({ filename, content, format });
      return { filename, content, format, recordCount: items.length };
    }
  },

  getDataQualityRules: async (): Promise<ApiResponse<DataQualityRules>> => {
    try {
      return await request<DataQualityRules>('/data-quality/rules', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: readLocalAdminValue(DATA_QUALITY_RULES_KEY, DEFAULT_DATA_QUALITY_RULES) };
    }
  },

  updateDataQualityRules: async (body: DataQualityRules): Promise<ApiResponse<DataQualityRules>> => {
    try {
      return await request<DataQualityRules>('/data-quality/rules', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      saveLocalAdminValue(DATA_QUALITY_RULES_KEY, body);
      return { success: true, data: body, message: 'Rules saved locally' };
    }
  },

  getAnalyticsAiSales: async (params: { from?: string; to?: string } = {}): Promise<ApiResponse<AnalyticsSalesData>> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    try {
      return await request<AnalyticsSalesData>(query.size ? `/analytics-ai/sales?${query}` : '/analytics-ai/sales', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: { summary: {}, forecast: {} }, message: 'Analytics will load when the API is available' };
    }
  },

  listSamples: async (
    params: SampleQueryParams = {}
  ): Promise<ApiResponse<SampleItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit') return;
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      const response = await request<SampleItem[]>(`/samples?${query}`, { method: 'GET' });
      const payload = response as unknown as { data?: SampleItem[]; items?: SampleItem[] };
      const raw = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.items)
          ? payload.items
          : [];
      return {
        ...response,
        data: raw.map((item) => normalizeSample(item as never)),
        pagination: fallbackPagination(page, limit, raw.length, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const paged = paginateLocalItems(filterLocalSamples(params), page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  getSample: async (id: string): Promise<ApiResponse<SampleItem>> => {
    try {
      const response = await request<SampleItem>(`/samples/${encodeURIComponent(id)}`, { method: 'GET' });
      return { ...response, data: normalizeSample(response.data as never) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const item = getLocalSamples().find((s) => s._id === id || s.sampleNumber === id);
      if (!item) throw new ApiError('Sample request not found', 404);
      return { success: true, data: item };
    }
  },

  createSample: async (body: SampleCreateInput): Promise<ApiResponse<SampleItem>> => {
    try {
      const response = await request<SampleItem>('/samples', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeSample(response.data as never) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.productName.trim() || body.quantity < 1) {
        throw new ApiError('Product name and a valid quantity are required', 400);
      }
      const linkedId =
        body.linkType === 'lead'
          ? body.leadId
          : body.linkType === 'opportunity'
            ? body.opportunityId
            : body.clientId;
      if (!linkedId) throw new ApiError(`A ${body.linkType} is required`, 400);
      const items = getLocalSamples();
      const created = normalizeSample({
        ...body,
        _id: `sample-${Date.now()}`,
        sampleNumber: nextSampleNumber(items),
        linkedName: resolveSampleLinkedName(body),
        status: 'Requested',
        createdAt: new Date().toISOString(),
      });
      saveLocalSamples([created, ...items]);
      return { success: true, data: created, message: 'Sample request created locally' };
    }
  },

  approveSample: async (
    id: string,
    body: SampleApproveInput
  ): Promise<ApiResponse<SampleItem>> => {
    try {
      const response = await request<SampleItem>(`/samples/${encodeURIComponent(id)}/approve`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeSample(response.data as never) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (body.action === 'reject' && !body.rejectionReason?.trim()) {
        throw new ApiError('Rejection reason is required', 400);
      }
      const updated = updateLocalSample(id, (current) => {
        if (current.status !== 'Requested') {
          throw new ApiError('Only requested samples can be approved or rejected', 400);
        }
        if (body.action === 'reject') {
          return {
            ...current,
            status: 'Rejected',
            rejectionReason: body.rejectionReason?.trim() || '',
            approvedAt: new Date().toISOString(),
            approvedBy: 'local-manager',
          };
        }
        return {
          ...current,
          status: 'Approved',
          stockLocation: body.stockLocation?.trim() || current.stockLocation || '',
          rejectionReason: null,
          approvedAt: new Date().toISOString(),
          approvedBy: 'local-manager',
        };
      });
      return {
        success: true,
        data: updated,
        message: `Sample request ${updated.status.toLowerCase()} successfully`,
      };
    }
  },

  updateSampleStockAddress: async (
    id: string,
    stockLocation: string
  ): Promise<ApiResponse<SampleItem>> => {
    try {
      const response = await request<SampleItem>(`/samples/${encodeURIComponent(id)}/stock-address`, {
        method: 'PUT',
        body: JSON.stringify({ stockLocation }),
      });
      return { ...response, data: normalizeSample(response.data as never) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const updated = updateLocalSample(id, (current) => ({
        ...current,
        stockLocation: stockLocation.trim(),
      }));
      return {
        success: true,
        data: updated,
        message: 'Stock address updated successfully',
      };
    }
  },

  dispatchSample: async (
    id: string,
    body: SampleDispatchInput
  ): Promise<ApiResponse<SampleItem>> => {
    try {
      const response = await request<SampleItem>(`/samples/${encodeURIComponent(id)}/dispatch`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeSample(response.data as never) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.courierName?.trim() || !body.trackingNumber?.trim()) {
        throw new ApiError('Courier name and tracking number are required', 400);
      }
      const updated = updateLocalSample(id, (current) => {
        if (!['Approved', 'Preparing'].includes(String(current.status))) {
          throw new ApiError('Only approved or preparing samples can be dispatched', 400);
        }
        return {
          ...current,
          status: 'Dispatched',
          courierName: body.courierName.trim(),
          trackingNumber: body.trackingNumber.trim(),
          dispatchDate: body.dispatchDate || new Date().toISOString().slice(0, 10),
          estimatedDeliveryDate: body.estimatedDeliveryDate || null,
        };
      });
      return { success: true, data: updated, message: 'Sample dispatched and tracking updated' };
    }
  },

  deliverSample: async (id: string): Promise<ApiResponse<SampleItem>> => {
    try {
      const response = await request<SampleItem>(`/samples/${encodeURIComponent(id)}/deliver`, {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      return { ...response, data: normalizeSample(response.data as never) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const updated = updateLocalSample(id, (current) => {
        if (current.status !== 'Dispatched') {
          throw new ApiError('Only dispatched samples can be marked delivered', 400);
        }
        return {
          ...current,
          status: 'Delivered',
          deliveredAt: new Date().toISOString(),
        };
      });
      return { success: true, data: updated, message: 'Sample marked as delivered' };
    }
  },

  submitSampleFeedback: async (
    id: string,
    body: SampleFeedbackInput
  ): Promise<ApiResponse<SampleItem>> => {
    try {
      const response = await request<SampleItem>(`/samples/${encodeURIComponent(id)}/feedback`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { ...response, data: normalizeSample(response.data as never) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.rating || body.rating < 1 || body.rating > 5) {
        throw new ApiError('Rating (1-5) is required', 400);
      }
      if (body.requiresImprovement && !body.routedDepartment) {
        throw new ApiError('Select a department for improvement routing', 400);
      }
      const updated = updateLocalSample(id, (current) => {
        if (current.status !== 'Delivered' && current.status !== 'Completed') {
          throw new ApiError('Feedback is only allowed after delivery', 400);
        }
        const routedTaskId =
          body.requiresImprovement
            ? `task_sample_${Date.now()}`
            : current.feedback?.routedTaskId || null;
        return {
          ...current,
          status: 'Completed',
          feedback: {
            rating: body.rating,
            comments: body.comments?.trim() || '',
            interestedInOrder: body.interestedInOrder ?? null,
            requiresImprovement: Boolean(body.requiresImprovement),
            routedDepartment: body.requiresImprovement
              ? body.routedDepartment || 'None'
              : 'None',
            improvementNotes: body.improvementNotes?.trim() || '',
            routedTaskId,
            feedbackDate: new Date().toISOString(),
            submittedBy: 'local-user',
          },
        };
      });
      return {
        success: true,
        data: updated,
        message: 'Customer feedback recorded successfully',
      };
    }
  },

  exportSamples: async (
    params: SampleQueryParams & { format?: 'csv' | 'json' } = {}
  ): Promise<ApiResponse<{ content: string; filename: string; mimeType: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/samples/export${query.size ? `?${query}` : ''}`,
        'samples_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = filterLocalSamples(params);
      if (params.format === 'json') {
        return {
          success: true,
          data: {
            content: JSON.stringify(items, null, 2),
            filename: `samples-${Date.now()}.json`,
            mimeType: 'application/json',
          },
        };
      }
      const header = [
        'Sample Number',
        'Product',
        'Qty',
        'Unit',
        'Urgency',
        'Status',
        'Link Type',
        'Prospect / Client',
        'Courier',
        'AWB',
        'Rating',
        'Interested In Order',
        'Created At',
      ];
      const rows = items.map((item) =>
        [
          item.sampleNumber,
          item.productName,
          item.quantity,
          item.unit,
          item.urgency,
          item.status,
          item.linkType,
          item.linkedName,
          item.courierName || '',
          item.trackingNumber || '',
          item.feedback?.rating ?? '',
          item.feedback?.interestedInOrder == null
            ? ''
            : item.feedback.interestedInOrder
              ? 'Yes'
              : 'No',
          item.createdAt || '',
        ]
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );
      return {
        success: true,
        data: {
          content: [header.join(','), ...rows].join('\n'),
          filename: `samples-${Date.now()}.csv`,
          mimeType: 'text/csv',
        },
      };
    }
  },

  listTickets: async (
    params: TicketQueryParams = {}
  ): Promise<ApiResponse<TicketItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit') return;
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      const response = await request<TicketItem[]>(`/tickets?${query}`, {
        method: 'GET',
      });
      const items = response.data || (response as unknown as { items?: TicketItem[] }).items || [];
      return {
        ...response,
        data: items.map(normalizeTicket),
        pagination: fallbackPagination(page, limit, items.length, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const paged = paginateLocalItems(filterTicketsList(getLocalTickets(), params), page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  getTicket: async (id: string): Promise<ApiResponse<TicketItem>> => {
    try {
      const response = await request<TicketItem>(`/tickets/${encodeURIComponent(id)}`, { method: 'GET' });
      return { ...response, data: normalizeTicket(response.data) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const item = getLocalTickets().find((ticket) => ticket._id === id && !ticket.isDeleted);
      if (!item) throw new ApiError('Ticket not found', 404);
      return { success: true, data: item };
    }
  },

  createTicket: async (body: TicketCreateInput): Promise<ApiResponse<TicketItem>> => {
    const payload = { ...body, type: body.ticketType, channelName: body.channel };
    try {
      return await request<TicketItem>('/tickets', { method: 'POST', body: JSON.stringify(payload) });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (
        !body.assignGroup ||
        !body.ticketType ||
        !body.subject.trim() ||
        !body.description.trim() ||
        !body.priority ||
        !body.channel
      ) {
        throw new ApiError('Complete all required ticket fields', 400);
      }
      const items = getLocalTickets();
      const project = body.projectId
        ? getLocalProjects().find((entry) => entry._id === body.projectId)
        : undefined;
      const slaHours = slaHoursForPriority(body.priority, body.slaHours);
      const createdAt = new Date().toISOString();
      const created = normalizeTicket({
        _id: `ticket-${Date.now()}`,
        ticketNumber: nextTicketNumber(items),
        requesterType: body.requesterType || 'Employee',
        requesterName: body.requesterName || 'Support Staff',
        requesterCompany: body.requesterCompany || '',
        clientId: body.clientId || '',
        assignGroup: body.assignGroup,
        assignedTo: body.assignedTo || null,
        projectId: body.projectId || null,
        projectName: project?.name,
        type: body.ticketType,
        subject: body.subject.trim(),
        description: body.description.trim(),
        priority: body.priority,
        channelName: body.channel,
        tags: body.tags || [],
        status: 'Open',
        slaHours,
        slaDueDate: computeSlaDueDate(createdAt, slaHours),
        messages: [],
        reassignmentHistory: [],
        watchers: [],
        escalationLevel: 'Standard',
        isArchived: false,
        createdAt,
      });
      items.unshift(created);
      saveLocalTickets(items);
      return { success: true, data: created, message: 'Ticket created' };
    }
  },

  updateTicketStatus: async (
    id: string,
    body: { status: string }
  ): Promise<ApiResponse<TicketItem>> => {
    try {
      return await request<TicketItem>(`/tickets/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      items[index] = normalizeTicket({
        ...items[index],
        status: body.status,
        updatedAt: new Date().toISOString(),
      });
      saveLocalTickets(items);
      return { success: true, data: items[index] };
    }
  },

  addTicketReply: async (
    id: string,
    messageOrBody: string | TicketMessageInput
  ): Promise<ApiResponse<TicketMessage>> => {
    const body: TicketMessageInput =
      typeof messageOrBody === 'string'
        ? { message: messageOrBody, isInternal: false }
        : messageOrBody;
    try {
      return await request<TicketMessage>(`/tickets/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.message?.trim()) throw new ApiError('Reply is required', 400);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      const ticket = items[index];
      const created: TicketMessage = {
        _id: `message-${Date.now()}`,
        senderName: body.isInternal ? 'Support Agent' : 'Support Agent',
        senderRole: 'Agent',
        message: body.message.trim(),
        isInternal: Boolean(body.isInternal),
        attachments: body.attachmentUrl
          ? [{ url: body.attachmentUrl, name: 'attachment' }]
          : [],
        createdAt: new Date().toISOString(),
      };
      const nextStatus =
        ticket.status === 'Open' && !body.isInternal
          ? 'In Progress'
          : ticket.status === 'Pending Client' && !body.isInternal
            ? 'In Progress'
            : ticket.status;
      items[index] = normalizeTicket({
        ...ticket,
        status: nextStatus,
        firstResponseAt: ticket.firstResponseAt || created.createdAt,
        messages: [...(ticket.messages || []), created],
        updatedAt: new Date().toISOString(),
      });
      saveLocalTickets(items);
      return { success: true, data: created, message: 'Reply added' };
    }
  },

  resolveTicket: async (
    id: string,
    notesOrBody: string | TicketResolveInput
  ): Promise<ApiResponse<TicketItem>> => {
    const body: TicketResolveInput =
      typeof notesOrBody === 'string'
        ? { resolutionNotes: notesOrBody, satisfactionRating: 5 }
        : notesOrBody;
    try {
      return await request<TicketItem>(`/tickets/${encodeURIComponent(id)}/resolve`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.resolutionNotes?.trim()) throw new ApiError('Resolution notes are required', 400);
      const rating = Number(body.satisfactionRating);
      if (!(rating >= 1 && rating <= 5)) throw new ApiError('CSAT rating must be between 1 and 5', 400);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      const now = new Date().toISOString();
      items[index] = normalizeTicket({
        ...items[index],
        status: 'Resolved',
        resolutionNotes: body.resolutionNotes.trim(),
        satisfactionRating: rating,
        resolvedAt: now,
        updatedAt: now,
      });
      saveLocalTickets(items);
      return { success: true, data: items[index], message: 'Ticket resolved' };
    }
  },

  reassignTicket: async (
    id: string,
    body: TicketReassignInput
  ): Promise<ApiResponse<TicketItem>> => {
    try {
      return await request<TicketItem>(`/tickets/${encodeURIComponent(id)}/reassign`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.assignedTo) throw new ApiError('Target agent is required', 400);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      const ticket = items[index];
      if (ticket.assignedTo && !body.reason?.trim()) {
        throw new ApiError('Handoff reason is required when reassigning', 400);
      }
      const entry = {
        fromUser: ticket.assignedToName || ticket.assignedTo || 'Unassigned',
        toUser: body.assignedTo,
        toUserName: body.assignedToName || body.assignedTo,
        reallocatedBy: 'Support Lead',
        reason: body.reason || 'Initial assignment',
        reassignedAt: new Date().toISOString(),
      };
      items[index] = normalizeTicket({
        ...ticket,
        assignedTo: body.assignedTo,
        assignedToName: body.assignedToName || body.assignedTo,
        reassignmentHistory: [entry, ...(ticket.reassignmentHistory || [])],
        updatedAt: new Date().toISOString(),
      });
      saveLocalTickets(items);
      return { success: true, data: items[index] };
    }
  },

  escalateTicket: async (
    id: string,
    body: TicketEscalateInput
  ): Promise<ApiResponse<TicketItem>> => {
    try {
      return await request<TicketItem>(`/tickets/${encodeURIComponent(id)}/escalate`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.level) throw new ApiError('Escalation level is required', 400);
      if (!body.reason?.trim()) throw new ApiError('Escalation reason is required', 400);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      const ticket = items[index];
      const slaHours = 4;
      const now = new Date().toISOString();
      items[index] = normalizeTicket({
        ...ticket,
        escalationLevel: body.level,
        priority: 'Urgent',
        slaHours,
        slaDueDate: computeSlaDueDate(now, slaHours),
        assignedTo: body.assignedTo || ticket.assignedTo,
        assignedToName: body.assignedToName || ticket.assignedToName,
        reassignmentHistory: [
          {
            fromUser: ticket.assignedToName || ticket.assignedTo || 'Unassigned',
            toUser: body.assignedTo || ticket.assignedTo || 'Escalation Queue',
            toUserName: body.assignedToName || ticket.assignedToName || body.level,
            reallocatedBy: 'Escalation',
            reason: body.reason.trim(),
            reassignedAt: now,
          },
          ...(ticket.reassignmentHistory || []),
        ],
        updatedAt: now,
      });
      saveLocalTickets(items);
      return { success: true, data: items[index] };
    }
  },

  addTicketWatcher: async (
    id: string,
    body: { userId: string; userName?: string }
  ): Promise<ApiResponse<TicketItem>> => {
    try {
      return await request<TicketItem>(`/tickets/${encodeURIComponent(id)}/watchers`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.userId) throw new ApiError('Watcher user is required', 400);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      const watchers = Array.from(new Set([...(items[index].watchers || []), body.userId]));
      const watcherNames = Array.from(
        new Set([...(items[index].watcherNames || []), body.userName || body.userId])
      );
      items[index] = normalizeTicket({
        ...items[index],
        watchers,
        watcherNames,
        updatedAt: new Date().toISOString(),
      });
      saveLocalTickets(items);
      return { success: true, data: items[index] };
    }
  },

  removeTicketWatcher: async (
    id: string,
    body: { userId: string }
  ): Promise<ApiResponse<TicketItem>> => {
    try {
      return await request<TicketItem>(`/tickets/${encodeURIComponent(id)}/watchers`, {
        method: 'DELETE',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      items[index] = normalizeTicket({
        ...items[index],
        watchers: (items[index].watchers || []).filter((watcher) => watcher !== body.userId),
        updatedAt: new Date().toISOString(),
      });
      saveLocalTickets(items);
      return { success: true, data: items[index] };
    }
  },

  archiveTicket: async (id: string): Promise<ApiResponse<TicketItem>> => {
    try {
      return await request<TicketItem>(`/tickets/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      items[index] = normalizeTicket({
        ...items[index],
        isArchived: true,
        updatedAt: new Date().toISOString(),
      });
      saveLocalTickets(items);
      return { success: true, data: items[index] };
    }
  },

  restoreTicket: async (id: string): Promise<ApiResponse<TicketItem>> => {
    try {
      return await request<TicketItem>(`/tickets/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      items[index] = normalizeTicket({
        ...items[index],
        isArchived: false,
        updatedAt: new Date().toISOString(),
      });
      saveLocalTickets(items);
      return { success: true, data: items[index] };
    }
  },

  deleteTicket: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/tickets/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalTickets();
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Ticket not found', 404);
      items[index] = { ...items[index], isDeleted: true, updatedAt: new Date().toISOString() };
      saveLocalTickets(items);
      return { success: true, data: { deleted: true } };
    }
  },

  listCannedResponses: async (): Promise<ApiResponse<CannedResponse[]>> => {
    try {
      return await request<CannedResponse[]>('/tickets/canned-responses', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: getLocalFinanceList(CANNED_RESPONSES_STORE_KEY, INITIAL_CANNED_RESPONSES),
      };
    }
  },

  createCannedResponse: async (body: {
    title: string;
    body: string;
  }): Promise<ApiResponse<CannedResponse>> => {
    try {
      return await request<CannedResponse>('/tickets/canned-responses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.title?.trim() || !body.body?.trim()) {
        throw new ApiError('Title and body are required', 400);
      }
      const list = getLocalFinanceList(CANNED_RESPONSES_STORE_KEY, INITIAL_CANNED_RESPONSES);
      const created: CannedResponse = {
        _id: `canned-${Date.now()}`,
        title: body.title.trim(),
        body: body.body.trim(),
        createdAt: new Date().toISOString(),
      };
      list.unshift(created);
      saveLocalFinanceList(CANNED_RESPONSES_STORE_KEY, list);
      return { success: true, data: created };
    }
  },

  deleteCannedResponse: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(
        `/tickets/canned-responses/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const list = getLocalFinanceList(CANNED_RESPONSES_STORE_KEY, INITIAL_CANNED_RESPONSES);
      saveLocalFinanceList(
        CANNED_RESPONSES_STORE_KEY,
        list.filter((item) => item._id !== id)
      );
      return { success: true, data: { deleted: true } };
    }
  },

  exportTickets: async (
    params: TicketQueryParams & { format?: 'csv' | 'json' } = {}
  ): Promise<ApiResponse<{ content: string; filename: string; mimeType: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/tickets/export${query.size ? `?${query}` : ''}`,
        'tickets_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = filterTicketsList(getLocalTickets(), params);
      if (params.format === 'json') {
        return {
          success: true,
          data: {
            content: JSON.stringify(items, null, 2),
            filename: `tickets-${Date.now()}.json`,
            mimeType: 'application/json',
          },
        };
      }
      const header = [
        'Ticket Number',
        'Subject',
        'Status',
        'Priority',
        'Type',
        'Assign Group',
        'Channel',
        'Assignee',
        'Requester',
        'Company',
        'SLA Hours',
        'SLA Due',
        'SLA Breached',
        'Created At',
      ];
      const rows = items.map((item) =>
        [
          item.ticketNumber,
          item.subject,
          item.status,
          item.priority,
          item.type,
          item.assignGroup,
          item.channelName,
          item.assignedToName || '',
          item.requesterName || '',
          item.requesterCompany || '',
          item.slaHours,
          item.slaDueDate,
          item.slaBreached ? 'Yes' : 'No',
          item.createdAt || '',
        ]
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );
      return {
        success: true,
        data: {
          content: [header.join(','), ...rows].join('\n'),
          filename: `tickets-${Date.now()}.csv`,
          mimeType: 'text/csv',
        },
      };
    }
  },

  getCustomerSuccessSummary: async (): Promise<ApiResponse<CustomerSuccessSummary>> => {
    try {
      return await request<CustomerSuccessSummary>('/customer-success/summary', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const accounts = computeLocalAccountHealthRecords();
      const feedback = getLocalFinanceList(CUSTOMER_FEEDBACK_STORE_KEY, INITIAL_WAVE_FEEDBACK);
      const healthyCount = accounts.filter((item) => item.healthCategory === 'Healthy').length;
      const atRiskCount = accounts.filter((item) => item.healthCategory === 'At Risk').length;
      const criticalCount = accounts.filter((item) => item.healthCategory === 'Critical').length;
      const avgCsat = feedback.length
        ? Math.round((feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / feedback.length) * 10) / 10
        : 0;
      return {
        success: true,
        data: {
          totalAccounts: accounts.length,
          healthyCount,
          atRiskCount,
          criticalCount,
          healthyPercent: accounts.length ? Math.round((healthyCount / accounts.length) * 100) : 0,
          avgCsat,
          totalFeedbacks: feedback.length,
        },
      };
    }
  },

  listCustomerSuccessAccounts: async (
    params: CustomerSuccessAccountQuery = {}
  ): Promise<ApiResponse<AccountHealthRecord[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    if (params.search) query.set('search', params.search);
    // Live backend filters by `category`; local mock uses healthCategory.
    if (params.healthCategory) {
      query.set('category', params.healthCategory);
      query.set('healthCategory', params.healthCategory);
    }
    try {
      const response = await request<AccountHealthRecord[] | { items?: unknown[] }>(
        `/customer-success/accounts?${query}`,
        { method: 'GET' }
      );
      const payload = response as unknown as { data?: unknown; items?: unknown[]; pagination?: ListPaginationMeta };
      const rawItems = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.items)
          ? payload.items
          : [];
      const accounts = rawItems
        .map((item) => normalizeAccountHealthRecord((item || {}) as Record<string, unknown>))
        .filter((item) => item.clientId);
      return {
        success: true,
        data: accounts,
        message: response.message,
        pagination: fallbackPagination(page, limit, accounts.length, payload.pagination || response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let accounts = computeLocalAccountHealthRecords();
      if (params.healthCategory) {
        accounts = accounts.filter((item) => item.healthCategory === params.healthCategory);
      }
      if (params.search) {
        const term = params.search.toLowerCase();
        accounts = accounts.filter((item) =>
          [item.clientName, item.clientEmail, item.clientPhone, item.category].some((value) =>
            String(value || '').toLowerCase().includes(term)
          )
        );
      }
      accounts = [...accounts].sort((a, b) => a.healthScore - b.healthScore);
      const paged = paginateLocalItems(accounts, page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  getFeedbackRatingSummary: async (): Promise<ApiResponse<FeedbackRatingSummary>> => {
    try {
      const response = await request<Record<string, unknown>>('/tickets/feedback/summary', {
        method: 'GET',
      });
      return {
        success: true,
        data: normalizeFeedbackRatingSummary(
          (response.data || {}) as unknown as Record<string, unknown>
        ),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const feedback = getLocalFinanceList(CUSTOMER_FEEDBACK_STORE_KEY, INITIAL_WAVE_FEEDBACK);
      const total = feedback.length;
      const avgCsat = total
        ? Math.round(
            (feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total) * 10
          ) / 10
        : 0;
      const distribution = [5, 4, 3, 2, 1].map((stars) => {
        const count = feedback.filter((item) => Number(item.rating) === stars).length;
        return {
          stars,
          count,
          percent: total ? Math.round((count / total) * 100) : 0,
        };
      });
      return { success: true, data: { total, avgCsat, distribution } };
    }
  },

  listCustomerFeedback: async (
    params: { page?: number; limit?: number } = {}
  ): Promise<ApiResponse<CustomerFeedbackItem[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params, 50);
    try {
      const response = await request<CustomerFeedbackItem[]>(`/tickets/feedback/reviews?${query}`, {
        method: 'GET',
      });
      const payload = response as unknown as {
        data?: CustomerFeedbackItem[];
        items?: CustomerFeedbackItem[];
        pagination?: ListPaginationMeta;
      };
      const items = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.items)
          ? payload.items
          : [];
      return {
        ...response,
        data: items,
        pagination: fallbackPagination(page, limit, items.length, payload.pagination || response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = [...getLocalFinanceList(CUSTOMER_FEEDBACK_STORE_KEY, INITIAL_WAVE_FEEDBACK)].sort((a, b) =>
        String(b.submittedAt || b.createdAt || '').localeCompare(
          String(a.submittedAt || a.createdAt || '')
        )
      );
      const paged = paginateLocalItems(items, page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  createCustomerFeedback: async (body: CustomerFeedbackCreateInput): Promise<ApiResponse<CustomerFeedbackItem>> => {
    try {
      return await request<CustomerFeedbackItem>('/tickets/feedback/reviews', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.clientId || body.rating < 1 || body.rating > 5) {
        throw new ApiError('Client and rating (1-5) are required', 400);
      }
      if (!body.category?.trim()) throw new ApiError('Category is required', 400);
      const client = getLocalClients().find((item) => item._id === body.clientId);
      if (!client) throw new ApiError('Client not found', 404);
      const items = getLocalFinanceList(CUSTOMER_FEEDBACK_STORE_KEY, INITIAL_WAVE_FEEDBACK);
      const taskIds = Array.isArray(body.taskIds)
        ? body.taskIds.map((id) => String(id || '').trim()).filter(Boolean)
        : body.taskId
          ? [String(body.taskId).trim()]
          : [];
      const taskName = String(
        body.taskName ||
          (Array.isArray(body.taskNames) ? body.taskNames.filter(Boolean).join(', ') : '') ||
          ''
      ).trim();
      const created: CustomerFeedbackItem = {
        ...body,
        _id: `feedback-${Date.now()}`,
        clientName: client.name,
        clientEmail: client.email,
        taskId: taskIds[0] || body.taskId || null,
        taskIds,
        taskName,
        comments: body.comments?.trim() || '',
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      saveLocalFinanceList(CUSTOMER_FEEDBACK_STORE_KEY, [created, ...items]);
      return { success: true, data: created, message: 'Feedback saved locally' };
    }
  },

  exportCustomerSuccess: async (
    params: CustomerSuccessAccountQuery & { format?: 'csv' | 'json' } = {}
  ): Promise<ApiResponse<{ content: string; filename: string; mimeType: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/customer-success/export${query.size ? `?${query}` : ''}`,
        'customer_success_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let accounts = computeLocalAccountHealthRecords();
      if (params.healthCategory) {
        accounts = accounts.filter((item) => item.healthCategory === params.healthCategory);
      }
      if (params.search) {
        const term = params.search.toLowerCase();
        accounts = accounts.filter((item) =>
          [item.clientName, item.clientEmail, item.clientPhone, item.category].some((value) =>
            String(value || '').toLowerCase().includes(term)
          )
        );
      }
      if (params.format === 'json') {
        return {
          success: true,
          data: {
            content: JSON.stringify(accounts, null, 2),
            filename: `customer-success-${Date.now()}.json`,
            mimeType: 'application/json',
          },
        };
      }
      const header = [
        'Account',
        'Email',
        'Phone',
        'Category',
        'Health Score',
        'Health Category',
        'Avg CSAT',
        'Feedback Count',
        'Repeat Orders',
        'Open Tickets',
        'SLA Breaches',
        'Overdue Invoices',
        'Recommended Action',
        'Last Activity',
      ];
      const rows = accounts.map((item) =>
        [
          item.clientName,
          item.clientEmail || '',
          item.clientPhone || '',
          item.category || '',
          item.healthScore,
          item.healthCategory,
          item.factors.avgCsat ?? '',
          item.factors.feedbackCount,
          item.factors.orderCount,
          item.factors.openTickets,
          item.factors.breachedTickets,
          item.factors.overdueInvoices,
          item.recommendedAction,
          item.lastActivityAt || '',
        ]
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );
      return {
        success: true,
        data: {
          content: [header.join(','), ...rows].join('\n'),
          filename: `customer-success-${Date.now()}.csv`,
          mimeType: 'text/csv',
        },
      };
    }
  },

  listMarketingCampaigns: async (
    params: MarketingCampaignQuery = {}
  ): Promise<ApiResponse<MarketingCampaign[]> & { pagination?: ListPaginationMeta }> => {
    const query = new URLSearchParams();
    const { page, limit } = applyListPaginationParams(query, params);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'page' || key === 'limit') return;
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    try {
      const response = await request<MarketingCampaign[]>(`/marketing/campaigns?${query}`, {
        method: 'GET',
      });
      return {
        ...response,
        data: (response.data || []).map(normalizeCampaign),
        pagination: fallbackPagination(page, limit, response.data?.length || 0, response.pagination),
      };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const paged = paginateLocalItems(filterMarketingCampaigns(getLocalMarketingCampaigns(), params), page, limit);
      return { success: true, data: paged.data, pagination: paged.pagination };
    }
  },

  createMarketingCampaign: async (
    body: MarketingCampaignCreateInput
  ): Promise<ApiResponse<MarketingCampaign>> => {
    const payload = {
      name: body.name,
      type: body.type,
      targetAudience: body.targetSegment,
      subject: body.emailSubject,
      content: body.emailContent,
      status: body.initialStatus || 'Draft',
    };
    try {
      const response = await request<MarketingCampaign>('/marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { ...response, data: normalizeCampaign({ ...response.data, ...body }) };
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (
        !body.name.trim() ||
        !body.type ||
        !body.targetSegment ||
        !body.emailSubject.trim() ||
        !body.emailContent.trim()
      ) {
        throw new ApiError('Complete all required campaign fields', 400);
      }
      if (body.name.trim().length > 200) throw new ApiError('Campaign name max 200 characters', 400);
      if (body.emailSubject.trim().length > 250) throw new ApiError('Subject max 250 characters', 400);
      if (body.emailContent.trim().length > 10000) {
        throw new ApiError('Content max 10,000 characters', 400);
      }
      const items = getLocalFinanceList(MARKETING_STORE_KEY, INITIAL_WAVE_CAMPAIGNS).map(
        normalizeCampaign
      );
      const created = normalizeCampaign({
        ...body,
        _id: `campaign-${Date.now()}`,
        targetAudience: body.targetSegment,
        subject: body.emailSubject,
        content: body.emailContent,
        status: body.initialStatus || 'Draft',
        stats: { sent: 0, opened: 0, clicked: 0, reEngagedLeads: 0, revenueGenerated: 0 },
        createdAt: new Date().toISOString(),
      });
      saveLocalMarketingCampaigns([created, ...items]);
      return { success: true, data: created, message: 'Campaign created locally' };
    }
  },

  updateMarketingCampaign: async (
    id: string,
    body: Partial<MarketingCampaignCreateInput> & { status?: string }
  ): Promise<ApiResponse<MarketingCampaign>> => {
    try {
      return await request<MarketingCampaign>(`/marketing/campaigns/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: body.name,
          type: body.type,
          targetAudience: body.targetSegment,
          subject: body.emailSubject,
          content: body.emailContent,
          status: body.status || body.initialStatus,
        }),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(MARKETING_STORE_KEY, INITIAL_WAVE_CAMPAIGNS).map(
        normalizeCampaign
      );
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Campaign not found', 404);
      const current = items[index];
      const updated = normalizeCampaign({
        ...current,
        name: body.name ?? current.name,
        type: body.type ?? current.type,
        targetSegment: body.targetSegment ?? current.targetSegment,
        targetAudience: body.targetSegment ?? current.targetAudience,
        emailSubject: body.emailSubject ?? current.emailSubject,
        subject: body.emailSubject ?? current.subject,
        emailContent: body.emailContent ?? current.emailContent,
        content: body.emailContent ?? current.content,
        status: body.status || body.initialStatus || current.status,
        updatedAt: new Date().toISOString(),
      });
      items[index] = updated;
      saveLocalMarketingCampaigns(items);
      return { success: true, data: updated };
    }
  },

  deleteMarketingCampaign: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      return await request<{ deleted: boolean }>(`/marketing/campaigns/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(MARKETING_STORE_KEY, INITIAL_WAVE_CAMPAIGNS).map(
        normalizeCampaign
      );
      const index = items.findIndex((item) => item._id === id);
      if (index < 0) throw new ApiError('Campaign not found', 404);
      items[index] = {
        ...items[index],
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        status: items[index].status,
      };
      saveLocalMarketingCampaigns(items);
      return { success: true, data: { deleted: true } };
    }
  },

  getMarketingAudienceStats: async (): Promise<ApiResponse<MarketingAudienceStats>> => {
    try {
      return await request<MarketingAudienceStats>('/marketing/audience-stats', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: computeLocalAudienceStats() };
    }
  },

  executeMarketingCampaign: async (id: string): Promise<ApiResponse<MarketingExecuteResult>> => {
    try {
      return await request<MarketingExecuteResult>(
        `/marketing/campaigns/${encodeURIComponent(id)}/execute`,
        { method: 'POST' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalFinanceList(MARKETING_STORE_KEY, INITIAL_WAVE_CAMPAIGNS).map(
        normalizeCampaign
      );
      const index = items.findIndex((item) => item._id === id && !item.isDeleted);
      if (index < 0) throw new ApiError('Campaign not found', 404);
      const campaign = items[index];
      const recipients = resolveMarketingAudience(
        campaign.targetAudience || campaign.targetSegment
      ).slice(0, 500);
      const sentCount = recipients.length;
      const updated = normalizeCampaign({
        ...campaign,
        status: 'Active',
        executedAt: new Date().toISOString(),
        stats: {
          ...(campaign.stats || {
            sent: 0,
            opened: 0,
            clicked: 0,
            reEngagedLeads: 0,
            revenueGenerated: 0,
          }),
          sent: Number(campaign.stats?.sent || 0) + sentCount,
        },
        updatedAt: new Date().toISOString(),
      });
      items[index] = updated;
      saveLocalMarketingCampaigns(items);
      return {
        success: true,
        data: {
          success: true,
          sentCount,
          totalRecipients: sentCount,
          message: `Dispatched campaign "${campaign.name}" to ${sentCount} recipient(s).`,
        },
        message: 'Campaign drip dispatched successfully!',
      };
    }
  },

  sendMarketingTestEmail: async (
    id: string,
    body: MarketingSendTestInput
  ): Promise<ApiResponse<{ sent: boolean; previewSubject: string; previewHtml: string }>> => {
    try {
      return await request(`/marketing/campaigns/${encodeURIComponent(id)}/send-test`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || '')) {
        throw new ApiError('Valid recipient email is required', 400);
      }
      const campaign = getLocalMarketingCampaigns().find((item) => item._id === id);
      if (!campaign) throw new ApiError('Campaign not found', 404);
      const sample = {
        name: 'Sample Contact',
        company: 'Demo Company Ltd',
        email: body.email,
        phone: '+91 90000 00000',
        ctaUrl: `#/marketing?simulate=${campaign._id}`,
      };
      const previewSubject = `[TEST] ${renderMarketingTemplate(campaign.subject || campaign.emailSubject, sample)}`;
      const previewHtml = `<div style="background:#fef3c7;padding:12px;border-radius:8px;margin-bottom:16px;font-weight:600;">This is a test preview email</div>${renderMarketingTemplate(
        campaign.content || campaign.emailContent,
        sample
      )}`;
      return {
        success: true,
        data: { sent: true, previewSubject, previewHtml },
        message: `Test email queued for ${body.email}`,
      };
    }
  },

  listMarketingEligibleLeads: async (): Promise<ApiResponse<MarketingEligibleLead[]>> => {
    try {
      return await request<MarketingEligibleLead[]>('/marketing/eligible-leads', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const leads = getLocalLeads()
        .filter((lead) => isLostLead(lead) || isUnqualifiedLead(lead))
        .map((lead) => ({
          _id: lead._id,
          name: lead.name,
          company: lead.company,
          email: lead.email,
          stage: lead.stage,
          status: lead.status,
          expectedRevenue: leadExpectedRevenue(lead),
        }));
      return { success: true, data: leads };
    }
  },

  reEngageMarketingLead: async (
    body: ReEngageLeadInput
  ): Promise<ApiResponse<{ lead: LeadItem; campaign: MarketingCampaign; event: PipelineReEntryEvent }>> => {
    try {
      return await request('/marketing/re-engage', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      if (!body.campaignId || !body.leadId || !body.targetStage || !body.actionType) {
        throw new ApiError('Campaign, lead, target stage, and action type are required', 400);
      }
      const campaign = getLocalMarketingCampaigns().find((item) => item._id === body.campaignId);
      if (!campaign) throw new ApiError('Campaign not found', 404);
      const { lead, revenue, previousStage } = applyLeadWinBack({
        leadId: body.leadId,
        targetStage: body.targetStage,
        actionType: body.actionType,
        notes: body.notes,
        campaign,
      });
      const updatedCampaign = bumpCampaignWinBack(campaign._id, revenue);
      const event: PipelineReEntryEvent = {
        _id: `mkt-act-${Date.now()}`,
        leadId: lead._id,
        leadName: lead.name,
        leadCompany: lead.company,
        campaignId: campaign._id,
        campaignName: campaign.name,
        previousStage,
        newStage: body.targetStage,
        actionType: body.actionType,
        expectedRevenue: revenue,
        createdAt: new Date().toISOString(),
      };
      saveLocalMarketingActivity([event, ...getLocalMarketingActivity()]);
      return { success: true, data: { lead, campaign: updatedCampaign, event }, message: 'Lead re-activated' };
    }
  },

  listReEngagementRequests: async (
    params: { status?: string } = {}
  ): Promise<ApiResponse<ReEngagementRequest[]>> => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    try {
      return await request<ReEngagementRequest[]>(
        `/marketing/requests${query.size ? `?${query}` : ''}`,
        { method: 'GET' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      let items = getLocalReEngagementRequests();
      if (params.status) items = items.filter((item) => item.status === params.status);
      return {
        success: true,
        data: [...items].sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        ),
      };
    }
  },

  approveReEngagementRequest: async (
    id: string
  ): Promise<ApiResponse<ReEngagementRequest>> => {
    try {
      return await request<ReEngagementRequest>(
        `/marketing/requests/${encodeURIComponent(id)}/approve`,
        { method: 'POST' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalReEngagementRequests();
      const index = items.findIndex((item) => item._id === id);
      if (index < 0) throw new ApiError('Request not found', 404);
      const requestItem = items[index];
      if (requestItem.status !== 'Pending') throw new ApiError('Request already reviewed', 400);
      const campaign = getLocalMarketingCampaigns().find((item) => item._id === requestItem.campaignId);
      if (!campaign) throw new ApiError('Campaign not found', 404);
      const { lead, revenue, previousStage } = applyLeadWinBack({
        leadId: requestItem.leadId,
        targetStage: 'Contacted',
        actionType: requestItem.actionType || 'Email CTA Button Click',
        notes: requestItem.notes,
        campaign,
      });
      bumpCampaignWinBack(campaign._id, revenue);
      const event: PipelineReEntryEvent = {
        _id: `mkt-act-${Date.now()}`,
        leadId: lead._id,
        leadName: lead.name,
        leadCompany: lead.company,
        campaignId: campaign._id,
        campaignName: campaign.name,
        previousStage,
        newStage: 'Contacted',
        actionType: requestItem.actionType,
        expectedRevenue: revenue,
        createdAt: new Date().toISOString(),
      };
      saveLocalMarketingActivity([event, ...getLocalMarketingActivity()]);
      const updated: ReEngagementRequest = {
        ...requestItem,
        status: 'Approved',
        reviewedBy: 'local-manager',
        reviewedAt: new Date().toISOString(),
        newStage: 'Contacted',
        previousStage,
        createdTaskId: `followup-${Date.now()}`,
        updatedAt: new Date().toISOString(),
      };
      items[index] = updated;
      saveLocalReEngagementRequests(items);
      return { success: true, data: updated, message: 'Re-engagement approved' };
    }
  },

  rejectReEngagementRequest: async (
    id: string,
    body: { reason?: string } = {}
  ): Promise<ApiResponse<ReEngagementRequest>> => {
    try {
      return await request<ReEngagementRequest>(
        `/marketing/requests/${encodeURIComponent(id)}/reject`,
        { method: 'POST', body: JSON.stringify(body) }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const items = getLocalReEngagementRequests();
      const index = items.findIndex((item) => item._id === id);
      if (index < 0) throw new ApiError('Request not found', 404);
      const requestItem = items[index];
      if (requestItem.status !== 'Pending') throw new ApiError('Request already reviewed', 400);
      const updated: ReEngagementRequest = {
        ...requestItem,
        status: 'Rejected',
        rejectionReason: body.reason?.trim() || 'Not interested / wrong contact',
        reviewedBy: 'local-manager',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      items[index] = updated;
      saveLocalReEngagementRequests(items);
      return { success: true, data: updated, message: 'Re-engagement rejected' };
    }
  },

  simulateMarketingReEngage: async (
    id: string
  ): Promise<ApiResponse<ReEngagementRequest>> => {
    try {
      return await request<ReEngagementRequest>(
        `/marketing/campaigns/${encodeURIComponent(id)}/simulate-reengage`,
        { method: 'POST' }
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const campaign = getLocalMarketingCampaigns().find((item) => item._id === id);
      if (!campaign) throw new ApiError('Campaign not found', 404);
      const eligible = getLocalLeads().find((lead) => isLostLead(lead) || isUnqualifiedLead(lead));
      if (!eligible) throw new ApiError('No eligible leads to simulate', 400);
      const existing = getLocalReEngagementRequests().find(
        (item) =>
          item.campaignId === id &&
          item.leadId === eligible._id &&
          item.status === 'Pending'
      );
      if (existing) return { success: true, data: existing, message: 'Pending request already exists' };
      const created: ReEngagementRequest = {
        _id: `reeng-${Date.now()}`,
        campaignId: campaign._id,
        campaignName: campaign.name,
        leadId: eligible._id,
        leadName: eligible.name,
        leadCompany: eligible.company,
        leadEmail: eligible.email,
        expectedRevenue: leadExpectedRevenue(eligible),
        actionType: 'Email CTA Button Click',
        notes: 'Simulated CTA click',
        status: 'Pending',
        previousStage: eligible.stage,
        createdAt: new Date().toISOString(),
      };
      saveLocalReEngagementRequests([created, ...getLocalReEngagementRequests()]);
      const items = getLocalFinanceList(MARKETING_STORE_KEY, INITIAL_WAVE_CAMPAIGNS).map(
        normalizeCampaign
      );
      const cIndex = items.findIndex((item) => item._id === id);
      if (cIndex >= 0) {
        items[cIndex] = normalizeCampaign({
          ...items[cIndex],
          stats: {
            ...(items[cIndex].stats || {
              sent: 0,
              opened: 0,
              clicked: 0,
              reEngagedLeads: 0,
              revenueGenerated: 0,
            }),
            clicked: Number(items[cIndex].stats?.clicked || 0) + 1,
          },
        });
        saveLocalMarketingCampaigns(items);
      }
      return { success: true, data: created, message: 'CTA click simulated' };
    }
  },

  getMarketingAnalytics: async (): Promise<ApiResponse<MarketingAnalytics>> => {
    try {
      return await request<MarketingAnalytics>('/marketing/analytics', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return { success: true, data: computeLocalMarketingAnalytics() };
    }
  },

  listMarketingActivity: async (): Promise<ApiResponse<PipelineReEntryEvent[]>> => {
    try {
      return await request<PipelineReEntryEvent[]>('/marketing/activity', { method: 'GET' });
    } catch (error) {
      rethrowUnlessMockFallback(error);
      return {
        success: true,
        data: [...getLocalMarketingActivity()].sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        ),
      };
    }
  },

  exportMarketing: async (
    params: MarketingCampaignQuery & { format?: 'csv' | 'json' } = {}
  ): Promise<ApiResponse<{ content: string; filename: string; mimeType: string }>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const format = (params.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
    try {
      return await requestExportFile(
        `/marketing/export${query.size ? `?${query}` : ''}`,
        'marketing_export',
        format
      );
    } catch (error) {
      rethrowUnlessMockFallback(error);
      const campaigns = filterMarketingCampaigns(getLocalMarketingCampaigns(), params);
      if (params.format === 'json') {
        return {
          success: true,
          data: {
            content: JSON.stringify(campaigns, null, 2),
            filename: `marketing-${Date.now()}.json`,
            mimeType: 'application/json',
          },
        };
      }
      const header = [
        'Name',
        'Type',
        'Target Audience',
        'Status',
        'Subject',
        'Sent',
        'Opened',
        'Clicked',
        'Won-Back',
        'Revenue',
        'Executed At',
        'Created At',
      ];
      const rows = campaigns.map((item) =>
        [
          item.name,
          item.type,
          item.targetAudience || item.targetSegment,
          item.status,
          item.subject || item.emailSubject,
          item.stats?.sent ?? 0,
          item.stats?.opened ?? 0,
          item.stats?.clicked ?? 0,
          item.stats?.reEngagedLeads ?? 0,
          item.stats?.revenueGenerated ?? 0,
          item.executedAt || '',
          item.createdAt || '',
        ]
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );
      return {
        success: true,
        data: {
          content: [header.join(','), ...rows].join('\n'),
          filename: `marketing-${Date.now()}.csv`,
          mimeType: 'text/csv',
        },
      };
    }
  },
};
