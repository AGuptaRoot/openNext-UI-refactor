export type ReportTabId =
  | 'sales'
  | 'conversion'
  | 'activity-location'
  | 'projects'
  | 'employees'
  | 'time'
  | 'income-expense'
  | 'ageing'
  | 'recurring-invoices'
  | 'payment-reconciliation';

export type ReportPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface ReportRolePermissions {
  canFinance: boolean;
  canExpenses: boolean;
  canProjects: boolean;
  canTime: boolean;
  canExport: boolean;
  canClientFilter: boolean;
  isClient: boolean;
}

export interface ReportRolePreset {
  title: string;
  subtitle: string;
  allowedReports: ReportTabId[];
}

export interface ReportTabDefinition {
  id: ReportTabId;
  label: string;
  exportKey: string;
  requiredPerm: 'canProjects' | 'canTime' | 'canFinance' | 'canFinanceOrExpenses' | null;
}

export interface ReportQueryParams {
  from?: string;
  to?: string;
  clientId?: string;
}

export interface ClientOption {
  _id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  avatarColor?: string;
  companyName?: string;
  phone?: string;
  mobile?: string;
}

// 1. Sales Report
export interface SalesReportData {
  range?: { from: string; to: string };
  clientId?: string;
  defaultCurrency?: string;
  pipeline?: Array<{ stage: string; count: number }>;
  totalLeads?: number;
  wonLeads?: number;
  conversionRate?: number;
  leadsByPeriod?: Array<{ period: string; count: number }>;
  quotations?: {
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
  };
  paymentsTotal?: number;
  outstanding?: {
    unpaid: number;
    overdue: number;
    unpaidCount: number;
  };
  topClients?: Array<{ name: string; amount: number; clientId?: string; id?: string }>;
  unlinkedClient?: boolean;
  message?: string;
}

// 2. Lead Conversion Report
export interface LeadConversionReportData {
  range?: { from: string; to: string };
  clientId?: string;
  totalLeads?: number;
  wonLeads?: number;
  lostLeads?: number;
  convertedLeads?: number;
  /** Converted-to-client / total leads */
  conversionRate?: number;
  /** Won stage / total leads */
  winRate?: number;
  byStage?: Array<{ stage: string; count: number }>;
  bySource?: Array<{ source: string; count: number }>;
  conversionsByPeriod?: Array<{ period: string; count: number }>;
  reps?: Array<{
    name: string;
    won: number;
    total: number;
    rate: number;
  }>;
  unlinkedClient?: boolean;
  message?: string;
}

// 3. Projects Report
export interface ProjectItemReport {
  id: string;
  name: string;
  clientName?: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  progress: number;
  overdueTasks: number;
  loggedHours?: number;
  /** Backend aliases from `/reports/projects` */
  tasksTotal?: number;
  tasksCompleted?: number;
  completionPct?: number;
  hoursLogged?: number;
  billableAmount?: number;
  deadline?: string;
  deadlineStatus?: string;
}

export interface OverdueTaskItem {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: string;
}

export interface ProjectsReportData {
  range?: { from: string; to: string };
  byStatus?: Array<{ status: string; count: number }>;
  projects?: ProjectItemReport[];
  overdueTasks?: OverdueTaskItem[];
  hoursByAssignee?: Array<{ name: string; hours: number; userId?: string }>;
  unlinkedClient?: boolean;
  message?: string;
}

// 4. Time Report
export interface TimeReportData {
  range?: { from: string; to: string };
  totalHours?: number;
  billableHours?: number;
  nonBillableHours?: number;
  billablePercent?: number;
  byProject?: Array<{ name: string; hours: number; projectId?: string; projectName?: string }>;
  byUser?: Array<{ name: string; hours: number; billableHours: number; userId?: string }>;
  byPeriod?: Array<{ period: string; hours: number }>;
  unlinkedClient?: boolean;
  message?: string;
}

// 5. Income vs Expense Report
export interface IncomeExpenseReportData {
  range?: { from: string; to: string };
  clientId?: string;
  defaultCurrency?: string;
  /** Preferred UI fields */
  income?: number;
  expenses?: number;
  netProfit?: number;
  margin?: number;
  /** Backend aliases from `/reports/income-expense` */
  incomeTotal?: number;
  expenseTotal?: number;
  netTotal?: number;
  byPeriod?: Array<{
    period: string;
    income: number;
    expenses: number;
    profit?: number;
    net?: number;
  }>;
  expensesByCategory?: Array<{ category: string; amount: number }>;
  byCategory?: Array<{ category: string; amount: number }>;
  unlinkedClient?: boolean;
  message?: string;
}

// 6. Invoice Ageing Report
export interface AgeingBucket {
  bucket: string;
  count: number;
  amount: number;
  /** Backend aliases from `/reports/invoice-ageing` */
  key?: string;
  label?: string;
}

export interface AgeingInvoiceItem {
  id?: string;
  invoiceNumber: string;
  clientName: string;
  issueDate?: string;
  dueDate?: string;
  total: number;
  balance: number;
  daysOverdue: number;
  bucket: string;
  /** Backend aliases */
  invoiceNo?: string;
  balanceDue?: number;
  status?: string;
}

export interface InvoiceAgeingReportData {
  range?: { from: string; to: string };
  defaultCurrency?: string;
  buckets?: AgeingBucket[];
  totalOverdue?: number;
  totalUnpaid?: number;
  /** Backend field — outstanding AR total */
  totalOutstanding?: number;
  invoices?: AgeingInvoiceItem[];
  unlinkedClient?: boolean;
  message?: string;
}

// 7. Recurring Invoices Report
export interface RecurringUpcomingRun {
  clientName: string;
  invoiceNumber?: string;
  profileName?: string;
  nextRunDate?: string;
  amount: number;
  frequency: string;
  status: string;
  id?: string;
}

export interface RecurringInvoicesReportData {
  /** Preferred UI fields */
  totalActive?: number;
  monthlyRecurringRevenue?: number;
  annualRecurringRevenue?: number;
  upcomingRuns?: RecurringUpcomingRun[];
  upcomingPaymentTotal?: number;
  /** Sum of per-cycle amounts on Active profiles */
  totalPaymentAmount?: number;
  activeContractsValue?: number;
  /** Backend aliases from `/reports/recurring-invoices` */
  activeProfiles?: number;
  pausedProfiles?: number;
  completedProfiles?: number;
  totalProfiles?: number;
  projectedMrr?: number;
  projectedArr?: number;
  totalGeneratedInvoices?: number;
  totalGeneratedAmount?: number;
  profiles?: RecurringUpcomingRun[];
  byFrequency?: Array<{ frequency: string; count: number; amount?: number }>;
  defaultCurrency?: string;
  unlinkedClient?: boolean;
  message?: string;
}

// 8. Credit Notes Report
export interface CreditNoteItemReport {
  creditNoteNumber: string;
  clientName: string;
  invoiceNumber?: string;
  issueDate: string;
  amount: number;
  remainingAmount: number;
  status: string;
}

export interface CreditNotesReportData {
  range?: { from: string; to: string };
  totalIssued?: number;
  totalApplied?: number;
  totalRefunded?: number;
  availableBalance?: number;
  notes?: CreditNoteItemReport[];
  unlinkedClient?: boolean;
  message?: string;
}

// 9. Payment Reconciliation Report
export interface PaymentMethodSummary {
  method: string;
  count: number;
  gross: number;
  refunds: number;
  net: number;
}

export interface ReconciliationPaymentItem {
  id?: string;
  receiptNumber: string;
  paymentDate: string;
  clientName: string;
  invoiceNumber?: string;
  paymentMode: string;
  amount: number;
  refundedAmount: number;
  netAmount: number;
  status: string;
  currency?: string;
}

export interface PaymentReconciliationReportData {
  range?: { from: string; to: string };
  totalPaymentsCount?: number;
  grossAmount?: number;
  totalRefunds?: number;
  netCollected?: number;
  byMethod?: PaymentMethodSummary[];
  payments?: ReconciliationPaymentItem[];
  unlinkedClient?: boolean;
  message?: string;
}

// 10. Employees Progress Report
export interface EmployeeIncompleteTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  projectId?: string;
  projectName?: string;
  dueDate?: string | null;
  isOverdue?: boolean;
}

export interface EmployeeProgressRow {
  userId: string;
  name: string;
  email?: string;
  role?: string;
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  progress: number;
  incompleteTaskList: EmployeeIncompleteTask[];
}

export interface EmployeesReportData {
  range?: { from: string; to: string };
  employees?: EmployeeProgressRow[];
  totalEmployees?: number;
  totalTasks?: number;
  completedTasks?: number;
  avgProgress?: number;
  message?: string;
}

/** One row of the Activity Location report (admin / manager view). */
export interface ActivityLocationPoint {
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  address?: string;
  capturedAt?: string | null;
  unavailableReason?: string;
}

export interface ActivityLocationRow {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  leadStage: string;
  salesRepId: string;
  salesRepName: string;
  createdByName: string;
  completedByName: string;
  activityTitle: string;
  activityType: string;
  kind: 'logged' | 'scheduled' | string;
  status: string;
  description: string;
  eventDate: string | null;
  createdAt: string | null;
  completedAt: string | null;
  createdLocation: ActivityLocationPoint | null;
  acceptedLocation?: ActivityLocationPoint | null;
  startingLocation?: ActivityLocationPoint | null;
  completedLocation: ActivityLocationPoint | null;
  goalLocation?: ActivityLocationPoint | null;
  hasCoordinates: boolean;
  /** Scheduled activity that was never completed by its due time. */
  isMissed?: boolean;
  /** Missed / Completed / Scheduled / Open. */
  displayStatus?: string;
}

export interface ActivityLocationReport {
  rows: ActivityLocationRow[];
  summary: {
    total: number;
    withLocation: number;
    withoutLocation: number;
    missed?: number;
    reps: number;
    leads: number;
  };
  range?: { from: string; to: string };
}

/* --------------------------- extension Reports page (json/reports.json, CRM 3.29.0) */

export interface ExtensionReportFilterOption {
  value: string;
  label: string;
}

export interface ExtensionReportFilter {
  key: string;
  label: string;
  type: 'daterange' | 'select';
  default?: string;
  options?: ExtensionReportFilterOption[];
}

export interface ExtensionReportSectionDef {
  id: string;
  kind: 'kpis' | 'funnel' | 'groups' | 'table' | 'chart' | 'list' | 'steps' | 'progress';
  title: string;
  subtitle?: string;
  width: 'full' | 'half';
  export?: boolean;
  periods?: ExtensionReportFilterOption[];
  /** Tab the section is shown under (CRM 3.30.0); none = above the tabs. */
  tab?: string;
}

export interface ExtensionReportDefinition {
  available: boolean;
  extensionId?: string;
  title: string;
  subtitle?: string;
  keepCoreTabs: string[];
  filters: ExtensionReportFilter[];
  /** Header buttons (e.g. "+ New Travel Lead"). */
  actions?: Array<{ label: string; link: string }>;
  tabs?: Array<{ id: string; label: string }>;
  sections: ExtensionReportSectionDef[];
}

export interface ExtensionReportItem {
  key: string;
  label: string;
  value: number;
  count?: number;
  format?: 'number' | 'money' | 'percent' | 'days' | 'text';
  currency?: string;
  hint?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  link?: string;
}

export interface ExtensionReportSectionData {
  kind: ExtensionReportSectionDef['kind'];
  error?: string;
  note?: string;
  currency?: string;
  items?: ExtensionReportItem[];
  /** "View all" under a section; text when there is nothing. */
  more?: { label: string; link: string };
  empty?: string;
  /** progress: current of total. */
  current?: number;
  format?: string;
  label?: string;
  stages?: Array<{ key: string; label: string; count: number; conversion: number | null; dropOff: number | null; link?: string }>;
  columns?: Array<{ key: string; label: string; type: string }>;
  rows?: Array<Record<string, unknown> & { _link?: string; _tone?: string }>;
  total?: number;
  type?: 'bar' | 'line';
  /** A table's graph: one point per row (CRM 3.30.0). */
  chart?: { type: 'bar' | 'line' | 'pie'; labelKey: string; series: Array<{ key: string; label: string; format?: string }> };
  series?: Array<{ key: string; label: string; format?: string }>;
  points?: Array<{ label: string; values: Record<string, number> }>;
}

/** A row of a "list" section (dashboard): a short title, one detail line, a badge or an action. */
export interface ExtensionDashboardListItem {
  key: string;
  title?: string;
  detail?: string;
  meta?: string;
  badge?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  actionLabel?: string;
  link?: string;
}
