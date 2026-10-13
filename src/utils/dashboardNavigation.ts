/**
 * Dashboard metric → filtered listing routes.
 * Keep query keys in sync with list pages (Tasks / Projects / Invoices / etc.).
 */
export const DASHBOARD_LIST_PATHS = {
  invoicesPaid: '/invoices?status=Paid',
  invoicesOverdue: '/invoices?status=Overdue',
  invoicesUnpaid: '/invoices?status=Sent',
  leads: '/leads',
  leadsWon: '/leads?stage=Won',
  projectsActive: '/projects?status=In%20Progress',
  projectsAllActive: '/projects',
  tasksOpen: '/tasks?due=open',
  tasksOverdue: '/tasks?due=overdue',
  tasksDueToday: '/tasks?due=today',
  tasksWatching: '/tasks?watching=true',
  tasksBlockedClient: '/tasks?clientFeedbackStatus=Awaiting%20Reply',
  timeLogs: '/time-logs',
  timeLogsBillable: '/time-logs?billable=billable',
  expensesPending: '/expenses?status=Submitted',
  expensesApproved: '/expenses?status=Approved',
  opportunities: '/opportunities',
  opportunitiesWon: '/opportunities?stage=Won',
  quotations: '/quotations',
  payments: '/payments?status=Completed',
  ticketsEscalations: '/tickets?attention=escalations',
  salesOrders: '/sales-orders',
  audit: '/audit',
} as const;

export type DashboardListKey = keyof typeof DASHBOARD_LIST_PATHS;

export function dashboardListPath(key: DashboardListKey): string {
  return DASHBOARD_LIST_PATHS[key];
}

/** Build opportunity stage filter path. */
export function opportunitiesStagePath(stage: string): string {
  const value = String(stage || '').trim();
  if (!value) return DASHBOARD_LIST_PATHS.opportunities;
  return `/opportunities?stage=${encodeURIComponent(value)}`;
}

/** Build leads stage filter path. */
export function leadsStagePath(stage: string): string {
  const value = String(stage || '').trim();
  if (!value) return DASHBOARD_LIST_PATHS.leads;
  return `/leads?stage=${encodeURIComponent(value)}`;
}
