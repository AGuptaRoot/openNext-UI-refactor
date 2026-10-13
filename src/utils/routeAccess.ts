/**
 * Central UI route RBAC — mirrors GlobalSearch / sidebar visibility and API permission keys.
 * Used by RequirePermission so typing a URL cannot open modules the user cannot access.
 */

export interface RouteAccessRule {
  /** User needs at least one of these permissions. */
  anyOf: string[];
  /** When true, client portal users are blocked even if they hold the permission. */
  denyClient?: boolean;
  /** Block specific CRM roles even if they hold the permission (e.g. employee vs create task). */
  denyRoles?: string[];
  /** Friendly module label for the access-denied screen. */
  label: string;
}

/** Exact path overrides (checked before prefix rules). */
const EXACT_RULES: Record<string, RouteAccessRule> = {
  '/reports': { anyOf: ['crm.reports.read'], denyClient: true, label: 'Reports' },
  '/analytics-ai': {
    anyOf: ['crm.analytics.read', 'crm.ai.read', 'crm.reports.read'],
    denyClient: true,
    label: 'Analytics AI',
  },
  '/settings': { anyOf: ['crm.settings.manage'], denyClient: true, label: 'Settings' },
  '/security': { anyOf: ['crm.settings.manage'], denyClient: true, label: 'Settings' },
  '/audit': { anyOf: ['crm.audit.read'], denyClient: true, label: 'Audit' },
  '/data-quality': { anyOf: ['crm.dataQuality.read'], denyClient: true, label: 'Data Quality' },
  '/marketing': { anyOf: ['crm.marketing.read'], denyClient: true, label: 'Marketing' },
  '/customer-success': {
    anyOf: ['crm.customerSuccess.read'],
    label: 'Customer Success',
  },
  '/time-logs': {
    anyOf: ['crm.time.read', 'crm.timeLogs.read'],
    denyClient: true,
    label: 'Time Logs',
  },

  '/leads/create': { anyOf: ['crm.leads.write'], denyClient: true, label: 'Create Lead' },
  '/contacts/create': {
    anyOf: ['crm.contacts.write', 'crm.leads.write'],
    denyClient: true,
    label: 'Create Contact',
  },
  '/clients/create': { anyOf: ['crm.clients.write'], denyClient: true, label: 'Create Client' },
  '/opportunities/create': {
    anyOf: ['crm.opportunities.write', 'crm.leads.write'],
    denyClient: true,
    label: 'Create Opportunity',
  },
  '/projects/create': { anyOf: ['crm.projects.write'], denyClient: true, label: 'Create Project' },
  '/tasks/create': {
    anyOf: ['crm.tasks.write'],
    denyClient: true,
    label: 'Create Task',
  },
  '/dashboard': {
    anyOf: ['crm.dashboard.view'],
    denyClient: true,
    label: 'Dashboard',
  },
  '/expenses/create': {
    anyOf: ['crm.expenses.write'],
    denyClient: true,
    denyRoles: ['crm-employee', 'employee', 'freelancer', '104'],
    label: 'Create Expense',
  },
  '/quotations/create': {
    anyOf: ['crm.quotes.write', 'crm.finance.write'],
    denyClient: true,
    label: 'Create Quotation',
  },
  '/quotation-templates': {
    anyOf: ['crm.finance.read'],
    denyClient: true,
    label: 'Quotation Templates',
  },
  '/quotation-templates/create': {
    anyOf: ['crm.finance.write'],
    denyClient: true,
    label: 'Create Quotation Template',
  },
  '/invoices/create': { anyOf: ['crm.finance.write'], denyClient: true, label: 'Create Invoice' },
  '/invoice-templates': {
    anyOf: ['crm.finance.read'],
    denyClient: true,
    label: 'Invoice Templates',
  },
  '/invoice-templates/create': {
    anyOf: ['crm.finance.write'],
    denyClient: true,
    label: 'Create Invoice Template',
  },
  '/payments/create': { anyOf: ['crm.finance.write'], denyClient: true, label: 'Record Payment' },
  '/sales-orders/create': { anyOf: ['crm.orders.write'], denyClient: true, label: 'Create Sales Order' },
  '/samples/create': { anyOf: ['crm.samples.write'], denyClient: true, label: 'Create Sample' },
  '/tickets/create': { anyOf: ['crm.tickets.write'], label: 'Create Ticket' },
};

/** Module prefixes — longest match wins. */
const PREFIX_RULES: Array<{ prefix: string; rule: RouteAccessRule }> = [
  { prefix: '/projects', rule: { anyOf: ['crm.projects.read'], label: 'Projects' } },
  { prefix: '/tasks', rule: { anyOf: ['crm.tasks.read'], label: 'Tasks' } },
  { prefix: '/leads', rule: { anyOf: ['crm.leads.read'], denyClient: true, label: 'Leads' } },
  {
    prefix: '/contacts',
    rule: { anyOf: ['crm.contacts.read', 'crm.leads.read'], denyClient: true, label: 'Contacts' },
  },
  { prefix: '/clients', rule: { anyOf: ['crm.clients.read'], denyClient: true, label: 'Clients' } },
  {
    prefix: '/opportunities',
    rule: { anyOf: ['crm.opportunities.read', 'crm.leads.read'], denyClient: true, label: 'Opportunities' },
  },
  { prefix: '/expenses', rule: { anyOf: ['crm.expenses.read'], denyClient: true, denyRoles: ['crm-employee', 'employee', 'freelancer', '104'], label: 'Expenses' } },
  { prefix: '/quotations', rule: { anyOf: ['crm.finance.read'], label: 'Quotations' } },
  { prefix: '/invoices', rule: { anyOf: ['crm.finance.read'], label: 'Invoices' } },
  { prefix: '/payments', rule: { anyOf: ['crm.finance.read'], label: 'Payments' } },
  {
    prefix: '/sales-orders',
    rule: { anyOf: ['crm.orders.read'], label: 'Sales Orders' },
  },
  { prefix: '/samples', rule: { anyOf: ['crm.samples.read'], label: 'Samples' } },
  { prefix: '/tickets', rule: { anyOf: ['crm.tickets.read'], label: 'Tickets' } },
];

const PROJECT_EDIT_RE = /^\/projects\/[^/]+\/edit$/;

export function normalizeRoutePath(pathname: string): string {
  const clean = String(pathname || '')
    .replace(/^#/, '')
    .split('?')[0]
    .replace(/\/+$/, '');
  return clean || '/';
}

export function getRouteAccessRule(pathname: string): RouteAccessRule | null {
  const path = normalizeRoutePath(pathname);

  if (PROJECT_EDIT_RE.test(path)) {
    return { anyOf: ['crm.projects.write'], denyClient: true, label: 'Edit Project' };
  }

  if (EXACT_RULES[path]) return EXACT_RULES[path];

  const sorted = [...PREFIX_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, rule } of sorted) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return rule;
  }

  return null;
}

export function evaluateRouteAccess(
  pathname: string,
  opts: {
    hasAnyPermission: (...permissions: string[]) => boolean;
    isClient: boolean;
    activeRole?: string | null;
  }
): { allowed: boolean; rule: RouteAccessRule | null } {
  const rule = getRouteAccessRule(pathname);
  if (!rule) return { allowed: true, rule: null };
  if (rule.denyClient && opts.isClient) return { allowed: false, rule };
  const role = String(opts.activeRole || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (rule.denyRoles?.length && role && rule.denyRoles.map((r) => r.toLowerCase()).includes(role)) {
    return { allowed: false, rule };
  }
  const allowed = opts.hasAnyPermission(...rule.anyOf);
  return { allowed, rule };
}
