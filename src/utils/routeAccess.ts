/**
 * Central UI route RBAC — mirrors GlobalSearch / sidebar visibility and API permission keys.
 * Used by RequirePermission so typing a URL cannot open modules the user cannot access.
 */

import type { CrmFeatureFlags } from '../types/dashboard';

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
  // A client portal user reaches this page with crm.samples.request, which is
  // why denyClient is off here: the form itself drops everything that is not
  // theirs to decide, and the server scopes the request to their own deal.
  '/samples/create': {
    anyOf: ['crm.samples.write', 'crm.samples.request'],
    label: 'Create Sample',
  },
  '/tickets/create': { anyOf: ['crm.tickets.write'], label: 'Create Ticket' },
};

/** Module prefixes — longest match wins. */
const PREFIX_RULES: Array<{ prefix: string; rule: RouteAccessRule }> = [
  { prefix: '/projects', rule: { anyOf: ['crm.projects.read'], label: 'Projects' } },
  { prefix: '/tasks', rule: { anyOf: ['crm.tasks.read'], label: 'Tasks' } },
  { prefix: '/activities', rule: { anyOf: ['crm.leads.read', 'crm.activities.read', 'crm.dashboard.view'], denyClient: true, label: 'Activity Details' } },
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
  {
    prefix: '/travel',
    rule: {
      anyOf: ['crm.leads.read', 'crm.dashboard.view'],
      denyClient: true,
      label: 'Travel',
    },
  },
  {
    prefix: '/add-ons',
    rule: {
      anyOf: ['crm.leads.read', 'crm.dashboard.view'],
      denyClient: true,
      label: 'Travel',
    },
  },
  { prefix: '/tickets', rule: { anyOf: ['crm.tickets.read'], label: 'Tickets' } },
];

const PROJECT_EDIT_RE = /^\/projects\/[^/]+\/edit$/;

/** Labels for the core modules a CRM extension can hide. */
const EXTENSION_MODULE_LABELS: Record<string, string> = {
  projects: 'Projects',
  tasks: 'Tasks',
  'time-logs': 'Time Logs',
  'sales-orders': 'Sales Orders',
};

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
    features?: CrmFeatureFlags;
  }
): { allowed: boolean; rule: RouteAccessRule | null } {
  const path = normalizeRoutePath(pathname);

  // Check optional module toggles: block route when module is disabled (or not explicitly enabled)
  const modules = opts.features?.modules;
  if (!modules?.expenses && (path === '/expenses' || path.startsWith('/expenses/'))) {
    return { allowed: false, rule: { anyOf: [], label: 'Expenses (Module Disabled)' } };
  }
  if (!modules?.marketing && (path === '/marketing' || path.startsWith('/marketing/'))) {
    return { allowed: false, rule: { anyOf: [], label: 'Marketing Automation (Module Disabled)' } };
  }
  if (!modules?.customerSuccess && (path === '/customer-success' || path.startsWith('/customer-success/'))) {
    return { allowed: false, rule: { anyOf: [], label: 'Customer Success (Module Disabled)' } };
  }
  if (!modules?.dataQuality && (path === '/data-quality' || path.startsWith('/data-quality/'))) {
    return { allowed: false, rule: { anyOf: [], label: 'Data Quality (Module Disabled)' } };
  }

  /*
   * Core modules hidden by the active CRM extension (Settings → Extensions):
   * Product Sales hides Projects/Tasks/Time Logs, Project Delivery hides
   * Sales Orders. Typing the URL must not reopen them.
   */
  const hiddenByExtension = opts.features?.activeExtension?.hiddenModules || [];
  for (const routeId of hiddenByExtension) {
    const prefix = `/${routeId}`;
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      const label = EXTENSION_MODULE_LABELS[routeId] || routeId;
      return {
        allowed: false,
        rule: {
          anyOf: [],
          label: `${label} (Not in Active Extension)`,
        },
      };
    }
  }

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
