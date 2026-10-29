import type { ReactNode } from 'react';

export type CrmRole =
  | 'crm-manager'
  | 'sales-manager'
  | 'sales-representative'
  | 'project-manager'
  | 'crm-employee'
  | 'finance-manager'
  | 'client';

export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

/**
 * Tenant feature switches the UI needs for every role.
 *
 * Settings is admin-only, so these ride along on `/me`: without them a sales
 * rep or a portal user would see no sign of a feature the tenant turned on.
 */
export interface CrmFeatureFlags {
  /** Settings → General → Enable Proforma & Advance Payment. */
  proformaAdvance: boolean;
  /** Only ever true while `proformaAdvance` is on. */
  quotationAutoAcceptOnPayment: boolean;
  defaultAdvancePercent: number;
}

export interface UserContext {
  /** Portal shape for a client-role login: a real account, a prospect, or neither. */
  portalKind?: 'client' | 'lead' | null;
  /** The lead behind a prospect portal login. */
  portalLeadId?: string | null;
  userId: string | null;
  username: string | null;
  email: string | null;
  role: string | number | null;
  roles: Array<string | number>;
  permissions: string[];
  isAdmin: boolean;
  tenant: Record<string, unknown> | null;
  tenantRole: string | null;
  isSalesAgentScoped: boolean;
  isEmployeeScoped: boolean;
  isClientUser: boolean;
  isClient: boolean;
  clientId: string | null;
  unlinkedClient: boolean;
  features?: CrmFeatureFlags;
}

export interface TaskItem {
  _id?: string;
  id?: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  projectName?: string;
  projectId?: string;
  assigneeName?: string;
  assignedTo?: string[];
  estimatedHours?: number;
  dependsOnTaskId?: string;
  dependsOnTitle?: string;
  isDependencyBlocked?: boolean;
  clientFeedbackStatus?: string;
}

export interface MilestoneItem {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  dueDate?: string;
  projectName?: string;
  projectId?: string;
  status?: string;
  cost?: number;
}

export interface InvoiceItem {
  _id?: string;
  id?: string;
  invoiceNumber: string;
  clientName?: string;
  companyName?: string;
  dueDate?: string;
  issueDate?: string;
  total: number;
  balanceDue: number;
  currency?: string;
  status: string;
  isOverdue?: boolean;
}

export interface TicketItem {
  _id?: string;
  id?: string;
  ticketNumber?: string;
  subject: string;
  priority: string;
  status: string;
  clientName?: string;
  createdAt?: string;
  slaDue?: string;
  isSlaBreached?: boolean;
}

export interface OpportunityStageSummary {
  stage: string;
  count: number;
  value: number;
}

export interface OpportunitiesSummary {
  totalOpportunities: number;
  totalPipelineValue: number;
  /** API alias used by some dashboard payloads */
  pipelineValue?: number;
  weightedForecastValue: number;
  /** API alias used by some dashboard payloads */
  weightedForecast?: number;
  wonValue: number;
  wonCount: number;
  byStage?: OpportunityStageSummary[];
  source?: 'opportunities' | 'leads' | string;
}

export interface CustomerHealthSummary {
  healthyCount: number;
  neutralCount: number;
  criticalCount: number;
  averageHealthScore: number;
}

export interface MarketingSummary {
  activeCampaigns: number;
  leadsGenerated: number;
  reEngagementRequests: number;
}

export interface CalendarEventItem {
  _id?: string;
  id?: string;
  title: string;
  date?: string;
  dueDate?: string;
  time?: string;
  type?: string;
  category?: string;
  clientName?: string;
  entityName?: string;
  entityType?: 'Lead' | 'Client' | string;
  entityId?: string;
  relativeDate?: string;
  status?: string;
  isToday?: boolean;
  isOverdue?: boolean;
  /** Lead activity assignee (shown for managers who see all schedule activities). */
  assignedTo?: string;
  assignedToName?: string;
  assignedToLabel?: string;
}

export interface CalendarSummary {
  scheduledEventsToday: number;
  scheduledEventsThisWeek: number;
  scheduledEventsThisMonth: number;
  overdueEventsCount: number;
  upcomingCalendarEvents: CalendarEventItem[];
  allCalendarEvents?: CalendarEventItem[];
}

/** Lead activities assigned to the current dashboard user. */
export interface AssignedLeadActivityItem {
  id: string;
  title: string;
  eventType?: string;
  eventDate?: string;
  status?: string;
  leadId?: string;
  leadName?: string;
  assignedTo?: string;
  isOverdue?: boolean;
  isToday?: boolean;
  description?: string;
}

export interface AuditItem {
  _id?: string;
  id?: string;
  userName?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  timestamp: string;
}

export interface DashboardData {
  period: string;
  dateRange?: {
    startDate: string | null;
    endDate: string | null;
  };
  widgetConfig?: {
    enabledWidgets: string[];
  };
  totalLeads: number;
  newLeads: number;
  wonLeads: number;
  totalClients: number;
  totalSalesOrders?: number;
  approvedSalesOrders?: number;
  totalProjects?: number;
  activeProjects?: number;
  openTasks?: number;
  overdueTasks?: number;
  overdueTasksList: TaskItem[];
  blockedAwaitingClientTasks: TaskItem[];
  watchedTasksList: TaskItem[];
  watchedOpenTasks: number;
  watchedOverdueTasks: number;
  upcomingMilestones: MilestoneItem[];
  unpaidInvoicesList: InvoiceItem[];
  urgentTicketsList: TicketItem[];
  opportunitiesSummary: OpportunitiesSummary | null;
  customerHealthSummary: CustomerHealthSummary | null;
  marketingSummary: MarketingSummary | null;
  calendarSummary?: CalendarSummary;
  myAssignedActivities?: AssignedLeadActivityItem[];
  loggedHoursThisMonth?: number;
  billableHoursThisMonth?: number;
  billableAmountThisMonth?: number;
  draftQuotations?: number;
  sentQuotations?: number;
  acceptedQuotations?: number;
  unpaidInvoices?: number;
  overdueInvoices?: number;
  paidInvoices?: number;
  totalPaymentsThisMonth?: number;
  pendingExpenseApprovals?: number;
  pendingPortalApprovals?: number;
  approvedExpensesThisMonth?: number;
  defaultCurrency: string;
  recentAudit: AuditItem[];
}

export interface SectionDefinition {
  id: string;
  title: string;
  category: 'Alerts' | 'Overview' | 'Sales' | 'Projects' | 'Finance' | 'Support' | 'General';
  icon: ReactNode;
  description: string;
}

export interface WidgetCatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredPermission: string | null;
  defaultEnabled: boolean;
}

export interface WidgetConfig {
  role: string;
  enabledWidgets: string[];
  availableWidgets: WidgetCatalogItem[];
  defaultWidgets: string[];
}
