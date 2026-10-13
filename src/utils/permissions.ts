import { CrmRole, UserContext } from '../types/dashboard';

/** Roles allowed to assign/reassign ticket agents (mirrors ticket.service assertCanAssignTicketAgent). */
const TICKET_ASSIGN_ROLES = new Set([
  'superadmin',
  'super-admin',
  'admin',
  '0',
  '1',
  '100',
  '103',
  'crm-manager',
  'crmmanager',
  'project-manager',
  'projectmanager',
  'tenant-admin',
  'tenantadmin',
]);

function normalizeRoleToken(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

export function collectRoleTokens(user: UserContext | null, activeRole?: CrmRole | null): string[] {
  if (!user) return [];
  const tokens = [
    user.tenantRole,
    user.role,
    ...(Array.isArray(user.roles) ? user.roles : []),
    activeRole,
  ]
    .map(normalizeRoleToken)
    .filter(Boolean);
  return [...new Set(tokens)];
}

export function userHasPermission(
  user: UserContext | null,
  permission: string
): boolean {
  if (!user) return false;
  const isPortalClient = Boolean(user.isClient || user.isClientUser);
  // Clients / portal users are view-only for projects & tasks (no create/edit/delete).
  // Feedback on completed work is handled via dedicated UI/API paths, not write permission.
  if (isPortalClient) {
    if (/^crm\.(projects|tasks|leads|contacts|clients|opportunities|orders|finance|quotes|marketing|samples|time|timeLogs)\.(write|delete)$/.test(permission)) {
      return false;
    }
    if (/^crm\.leads\.convert$/.test(permission)) return false;
    // Rule 3/4 — clients never see expense module permissions
    if (/^crm\.expenses\./.test(permission)) return false;
    // Never apply isAdmin bypass for portal users — use their assigned permission list only.
    const clientPerms = Array.isArray(user.permissions) ? user.permissions : [];
    if (clientPerms.includes('*')) return true;
    return clientPerms.includes(permission);
  }
  if (user.isAdmin) return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}

export function userCanAssignTickets(
  user: UserContext | null,
  options: { isClient?: boolean; activeRole?: CrmRole | null } = {}
): boolean {
  if (!user) return false;
  if (options.isClient || user.isClient || user.isClientUser) return false;
  if (user.isAdmin) return true;
  const roles = collectRoleTokens(user, options.activeRole);
  return roles.some((role) => TICKET_ASSIGN_ROLES.has(role));
}

/** Roles allowed to collect Razorpay on an invoice (in addition to the invoice's client). */
const INVOICE_RAZORPAY_STAFF_ROLES = new Set([
  'superadmin',
  'super-admin',
  'admin',
  '0',
  '1',
  '100',
  'owner',
  'tenant-admin',
  'tenantadmin',
  'crm-manager',
  'crmmanager',
  'sales-manager',
  'salesmanager',
  'finance-manager',
  'financemanager',
  'accountant',
  '105',
  '101',
  '2',
]);

/** Rule 14 — Client Razorpay: login required; any open invoice with balanceDue > 0. */
export function clientCanPayInvoice(status?: string, balanceDue?: number): boolean {
  const normalized = String(status || '').trim();
  const due = Number(balanceDue || 0);
  if (!(due > 0)) return false;
  return !['Draft', 'Cancelled', 'Written Off', 'Paid'].includes(normalized);
}

function isLinkedInvoiceClient(
  user: UserContext | null,
  invoice: { clientId?: string | null; customerEmail?: string | null; clientEmail?: string | null } | null
): boolean {
  if (!user || !invoice) return false;
  const userClientId = String(user.clientId || '').trim();
  const invoiceClientId = String(invoice.clientId || '').trim();
  if (userClientId && invoiceClientId && userClientId === invoiceClientId) return true;

  const userEmail = String(user.email || '').trim().toLowerCase();
  const invoiceEmail = String(invoice.customerEmail || invoice.clientEmail || '')
    .trim()
    .toLowerCase();
  return Boolean(userEmail && invoiceEmail && userEmail === invoiceEmail);
}

/**
 * Show "Pay with Razorpay" on invoice detail only for:
 * - the client this invoice was sent to (matched by clientId / email)
 * - super admin, CRM manager, sales manager, finance manager
 * Requires gateway configured + open balance + non-draft invoice.
 */
export function canShowInvoiceRazorpayPay(options: {
  user: UserContext | null;
  activeRole?: CrmRole | null;
  isClient?: boolean;
  invoice?: {
    clientId?: string | null;
    customerEmail?: string | null;
    clientEmail?: string | null;
    status?: string;
    balanceDue?: number;
    grandTotal?: number;
  } | null;
  razorpayConfigured?: boolean;
}): boolean {
  if (!options.razorpayConfigured) return false;
  const invoice = options.invoice;
  if (!invoice) return false;

  const balance = Number(
    invoice.balanceDue != null ? invoice.balanceDue : invoice.grandTotal || 0
  );
  if (!clientCanPayInvoice(invoice.status, balance)) return false;

  const isPortalClient = Boolean(
    options.isClient || options.user?.isClient || options.user?.isClientUser
  );
  if (isPortalClient) {
    return isLinkedInvoiceClient(options.user, invoice);
  }

  if (options.user?.isAdmin) return true;
  const roles = collectRoleTokens(options.user, options.activeRole);
  return roles.some((role) => INVOICE_RAZORPAY_STAFF_ROLES.has(role));
}

/**
 * Create tasks — allowed for staff with `crm.tasks.write`, including crm-employee
 * (backend scopes create to projects the employee is assigned to / member of).
 */
export function canCreateTasks(options: {
  hasTaskWrite: boolean;
  isClient?: boolean;
}): boolean {
  if (options.isClient || !options.hasTaskWrite) return false;
  return true;
}

/** True for Sales Representative persona (aliases included). */
export function isSalesRepresentativeRole(activeRole?: CrmRole | string | null): boolean {
  const role = normalizeRoleToken(activeRole);
  return (
    role === 'sales-representative' ||
    role === 'sales-rep' ||
    role === 'sales-agent' ||
    role === '102' ||
    role === '3'
  );
}

/**
 * Admin / CRM Manager / Sales Manager may assign opportunity ownership
 * to a sales representative on create.
 */
const OPPORTUNITY_OWNER_ASSIGN_ROLES = new Set([
  'superadmin',
  'super-admin',
  'admin',
  '0',
  '1',
  '100',
  'owner',
  'tenant-admin',
  'tenantadmin',
  'crm-manager',
  'crmmanager',
  'sales-manager',
  'salesmanager',
  '2',
  '101',
]);

export function canAssignOpportunityOwner(
  user: UserContext | null,
  options: { isClient?: boolean; activeRole?: CrmRole | null } = {}
): boolean {
  if (!user) return false;
  if (options.isClient || user.isClient || user.isClientUser) return false;
  if (user.isAdmin) return true;
  const roles = collectRoleTokens(user, options.activeRole);
  return roles.some((role) => OPPORTUNITY_OWNER_ASSIGN_ROLES.has(role));
}

/**
 * Admin / CRM Manager / Sales Manager may assign leads, activities, and deals
 * to other users. Sales Representatives may only assign to themselves.
 */
export function canAssignToOtherUsers(
  user: UserContext | null,
  options: { isClient?: boolean; activeRole?: CrmRole | null } = {}
): boolean {
  return canAssignOpportunityOwner(user, options);
}

/** Match assignable-user role/designation tokens to Sales Representative. */
export function isAssignableSalesRepresentative(user: {
  role?: string | null;
  designation?: string | null;
  cmsRole?: string | number | null;
}): boolean {
  const tokens = [user.role, user.designation, user.cmsRole]
    .flatMap((raw) => {
      const normalized = normalizeRoleToken(raw);
      if (!normalized) return [];
      // Numeric / alias CRM role codes from OpenNext CMS / memberships
      if (normalized === '102' || normalized === '3') return ['sales-representative'];
      if (normalized === '101' || normalized === '2') return ['sales-manager'];
      return [normalized];
    })
    .filter(Boolean);

  return tokens.some(
    (role) =>
      role === 'sales-representative' ||
      role === 'sales-rep' ||
      role === 'sales-agent' ||
      role === 'salesagent' ||
      role.includes('sales-rep') ||
      role.includes('sales-representative') ||
      role.includes('sales-agent') ||
      // Free-text designations / CMS role names: "Sales Representative", "Sales Exec"
      (role.includes('sales') &&
        !role.includes('sales-manager') &&
        !role.includes('salesmanager') &&
        !role.includes('unsales'))
  );
}

/** Friendly label for opportunity / lead assignee dropdowns. */
export function formatAssignableUserLabel(user: {
  id?: string;
  _id?: string;
  userId?: string;
  name?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  designation?: string | null;
}): string {
  const rawName = String(
    user.username || user.name || user.email || ''
  ).trim();
  // API often sends "username (designation)" — strip trailing paren junk for a clean base.
  const fromDisplay = String(user.displayName || '')
    .trim()
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  const base =
    rawName ||
    fromDisplay ||
    String(user.email || '').trim() ||
    String(user.id || user._id || user.userId || 'User').trim();

  const roleToken = normalizeRoleToken(user.role) || normalizeRoleToken(user.designation);
  const ROLE_LABELS: Record<string, string> = {
    'sales-representative': 'Sales Rep',
    'sales-rep': 'Sales Rep',
    'sales-agent': 'Sales Rep',
    '102': 'Sales Rep',
    'sales-manager': 'Sales Manager',
    'salesmanager': 'Sales Manager',
    '101': 'Sales Manager',
    '2': 'Sales Manager',
    'crm-manager': 'CRM Manager',
    'crm-employee': 'Team Member',
    'project-manager': 'Project Lead',
    'finance-manager': 'Finance',
  };
  const roleLabel =
    ROLE_LABELS[roleToken] ||
    (roleToken.includes('sales') ? 'Sales' : '');

  return roleLabel ? `${base} — ${roleLabel}` : base;
}

/** Create/edit quotations — Sales Rep uses crm.quotes.write; managers use crm.finance.write. */
export function canWriteQuotations(options: {
  hasQuoteWrite?: boolean;
  hasFinanceWrite?: boolean;
  isClient?: boolean;
}): boolean {
  if (options.isClient) return false;
  return Boolean(options.hasQuoteWrite || options.hasFinanceWrite);
}

/** Create/edit invoices & payments — requires full finance write (not quote-only). */
export function canWriteInvoicesAndPayments(options: {
  hasFinanceWrite: boolean;
  isClient?: boolean;
}): boolean {
  if (options.isClient || !options.hasFinanceWrite) return false;
  return true;
}

/** True for Employee / Team Member persona (role 104 aliases included). */
export function isEmployeeRole(activeRole?: CrmRole | string | null): boolean {
  const role = normalizeRoleToken(activeRole);
  return role === 'crm-employee' || role === 'employee' || role === 'freelancer' || role === '104';
}

/**
 * CRM Beacon / Module tours — Super Admin and CRM Manager only.
 * Other roles must not see Tour buttons or auto-start onboarding.
 */
const CRM_TOUR_ROLES = new Set([
  'superadmin',
  'super-admin',
  'admin',
  '0',
  '1',
  '100',
  'owner',
  'tenant-admin',
  'tenantadmin',
  'crm-manager',
  'crmmanager',
]);

export function canUseCrmTours(
  user: UserContext | null,
  activeRole?: CrmRole | string | null
): boolean {
  if (!user) return false;
  if (user.isClient || user.isClientUser) return false;
  if (user.isAdmin) return true;
  if ((user as { isSuperAdmin?: boolean }).isSuperAdmin) return true;
  if (normalizeRoleToken(activeRole) === 'crm-manager') return true;
  const roles = collectRoleTokens(user, activeRole as CrmRole | null);
  return roles.some((role) => CRM_TOUR_ROLES.has(role));
}

/**
 * Full task structure management (edit/delete/templates/recurring).
 * crm-employee may create + status/comments only — not full edit/delete.
 * `crm.tasks.write` stays on the role so status/comment/create APIs remain reachable.
 */
export function canFullyManageTasks(options: {
  hasTaskWrite: boolean;
  isClient?: boolean;
  activeRole?: CrmRole | string | null;
}): boolean {
  if (options.isClient || !options.hasTaskWrite) return false;
  return !isEmployeeRole(options.activeRole);
}
