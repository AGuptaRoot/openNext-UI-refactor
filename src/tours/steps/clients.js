/**
 * Clients Beacon onboarding — create form, listing, detail tabs/overview → Projects.
 * Tour-only; does not change client CRM APIs or save/delete logic.
 * Detail / profile steps are skipped when no clients exist.
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestClientDetailTab,
  requestClientsTourJump,
} from '../clientsTourState.js';

const T = (id) => `[data-tour="${id}"]`;

function currentPath() {
  const hash = String(window.location.hash || '');
  return hash.replace(/^#/, '').split('?')[0] || '/';
}

async function ensurePath(pathPrefix) {
  const path = currentPath();
  if (pathPrefix === '/clients/create') {
    if (!path.startsWith('/clients/create')) {
      requestTourNavigate('/clients/create');
      await waitForSelector(T('clients-create-form'), 8000);
    }
    return;
  }
  if (pathPrefix === '/clients') {
    if (path !== '/clients') {
      requestTourNavigate('/clients');
      await waitForSelector(T('clients-create-btn'), 8000);
    }
    return;
  }
  if (pathPrefix === '/projects') {
    if (path !== '/projects' && !path.startsWith('/projects/')) {
      requestTourNavigate('/projects');
      await waitForSelector(T('projects-tour-landing'), 8000);
    }
  }
}

function hasAnyClientRow() {
  return Boolean(
    document.querySelector('[data-tour="clients-row-first"]') ||
      document.querySelector('tr[data-client-id]')
  );
}

function hasClientTable() {
  return Boolean(document.querySelector('[data-tour="clients-table"]'));
}

function stepIndexById(id) {
  return clientsTourSteps.findIndex((s) => s.id === id);
}

/** No clients — end tour after listing steps (no profile / tabs / Projects redirect). */
function skipClientDetailSteps() {
  requestClientsTourJump({ finish: true });
}

/** Empty list — skip table columns; finish if no client records at all. */
function skipClientTableSteps() {
  if (!hasAnyClientRow()) {
    requestClientsTourJump({ finish: true });
    return;
  }
  const rowIdx = stepIndexById('clients-row-first');
  if (rowIdx >= 0) requestClientsTourJump({ stepIndex: rowIdx });
}

async function openFirstClient() {
  const path = currentPath();
  if (path.startsWith('/clients/') && !path.startsWith('/clients/create')) {
    const tabs = await waitForSelector(T('clients-detail-tabs'), 10000);
    return Boolean(tabs);
  }
  await ensurePath('/clients');
  if (!hasAnyClientRow()) return false;
  const row =
    document.querySelector(T('clients-row-first')) ||
    document.querySelector('tr[data-client-id]');
  const id = row?.getAttribute('data-client-id');
  if (!id) return false;
  requestTourNavigate(`/clients/${id}`);
  const tabs = await waitForSelector(T('clients-detail-tabs'), 10000);
  return Boolean(tabs);
}

async function guardClientDetail(beforeFn) {
  if (document.querySelector(T('clients-detail-tabs'))) {
    if (beforeFn) await beforeFn();
    return true;
  }
  const path = currentPath();
  if (path.startsWith('/clients/') && !path.startsWith('/clients/create')) {
    await waitForSelector(T('clients-detail-tabs'), 10000);
    if (document.querySelector(T('clients-detail-tabs'))) {
      if (beforeFn) await beforeFn();
      return true;
    }
  }
  await ensurePath('/clients');
  if (!hasAnyClientRow()) {
    skipClientDetailSteps();
    return false;
  }
  if (beforeFn) await beforeFn();
  return true;
}

function step(partial) {
  return {
    placement: 'auto',
    skipBeacon: false,
    beaconTrigger: 'click',
    targetWaitTimeout: 3500,
    ...partial,
  };
}

export const clientsTourSteps = [
  // ——— Start → Create ———
  step({
    id: 'clients-start-create',
    target: T('clients-create-btn'),
    title: 'Create New Client',
    content:
      'Click New Client to open the create form. Use the beacon, then Next — or click the button yourself.',
    placement: 'bottom',
    before: async () => {
      await ensurePath('/clients');
      await waitForSelector(T('clients-create-btn'), 8000);
    },
  }),

  // ——— Create form ———
  step({
    id: 'clients-form-intro',
    target: T('clients-create-form'),
    title: 'Create Client form',
    content:
      'Add a company account: profile, tags, addresses, and primary contact. Next covers the main sections.',
    placement: 'center',
    before: async () => {
      await ensurePath('/clients/create');
    },
  }),
  step({
    id: 'clients-section-import-lead',
    target: T('clients-section-import-lead'),
    title: 'Import from lead',
    content:
      'Optional. Pick an existing Won/converted lead to auto-fill company and contact fields — avoids retyping.',
    before: async () => {
      await ensurePath('/clients/create');
    },
  }),
  step({
    id: 'clients-section-company',
    target: T('clients-section-company'),
    title: 'Company profile',
    content:
      'Required company name plus logo, category, status, email, mobile, and website. This becomes the Client 360 header.',
  }),
  step({
    id: 'clients-field-name',
    target: T('clients-field-name'),
    title: 'Company name *',
    content:
      'Required. Legal / trading name shown in lists and invoices. Example: Acme Corporation.',
  }),
  step({
    id: 'clients-section-tags',
    target: T('clients-section-tags'),
    title: 'Client tags',
    content: 'Label accounts (VIP, Key Account…) for filters and reporting on the Clients listing.',
  }),
  step({
    id: 'clients-section-billing',
    target: T('clients-section-billing'),
    title: 'Primary billing address',
    content: 'Invoice address — street, city, state, country, ZIP. Used on quotes and invoices.',
  }),
  step({
    id: 'clients-section-shipping',
    target: T('clients-section-shipping'),
    title: 'Shipping address',
    content: 'Delivery address when different from billing. Can mirror billing when ship-to is the same.',
  }),
  step({
    id: 'clients-section-contact',
    target: T('clients-section-contact'),
    title: 'Primary contact',
    content:
      'Main person at the account — name, designation, email, mobile. Shows in the Primary Contact column on the list.',
  }),
  step({
    id: 'clients-save-btn',
    target: T('clients-save-btn'),
    title: 'Create Client (Save)',
    content:
      'When required fields are filled, click Create Client. For the tour, click Next to continue on the listing — you can save a real client anytime.',
    placement: 'top',
  }),

  // ——— Listing ———
  step({
    id: 'clients-listing-intro',
    target: T('clients-tour-landing'),
    title: 'Clients listing',
    content:
      'Back on Clients. Next: metrics, filters, import/export, then table columns. Client profile steps run only if at least one client exists.',
    placement: 'center',
    before: async () => {
      await ensurePath('/clients');
      await waitForSelector(T('clients-tour-landing'), 8000);
    },
  }),
  step({
    id: 'clients-kpis',
    target: T('clients-kpis'),
    title: 'Client metrics',
    content:
      'Scorecards: Total Clients, From Leads (converted), Active, and Inactive — quick health of your account book.',
    placement: 'bottom',
  }),
  step({
    id: 'clients-filters',
    target: T('clients-filters'),
    title: 'Search & filters',
    content:
      'Search by name/email/phone/contact. Filter Category, Tag, and Status. Reset clears all filters.',
  }),
  step({
    id: 'clients-export-btn',
    target: T('clients-export-btn'),
    title: 'Export',
    content: 'Download the current filtered list as CSV or JSON for reporting or backups.',
  }),
  step({
    id: 'clients-import-btn',
    target: T('clients-import-btn'),
    title: 'Import',
    content: 'Bulk-upload clients from CSV. Use when onboarding many accounts at once.',
  }),
  step({
    id: 'clients-table',
    target: T('clients-table'),
    title: 'Clients table',
    content: 'Each row is one account. Click the company name to open Client 360 detail.',
    before: async () => {
      await ensurePath('/clients');
      if (!hasClientTable() || !hasAnyClientRow()) skipClientTableSteps();
    },
  }),
  step({
    id: 'clients-col-company',
    target: T('clients-col-company'),
    title: 'Column: Company',
    content: 'Account name and address preview — primary identity of the client.',
    before: async () => {
      if (!hasClientTable() || !hasAnyClientRow()) skipClientTableSteps();
    },
  }),
  step({
    id: 'clients-col-category',
    target: T('clients-col-category'),
    title: 'Column: Category',
    content: 'Segment (Enterprise, SMB…). Helps sales and support prioritise accounts.',
    before: async () => {
      if (!hasClientTable() || !hasAnyClientRow()) skipClientTableSteps();
    },
  }),
  step({
    id: 'clients-col-status',
    target: T('clients-col-status'),
    title: 'Column: Status',
    content: 'Active vs Inactive — inactive accounts are usually paused for outreach/billing.',
    before: async () => {
      if (!hasClientTable() || !hasAnyClientRow()) skipClientTableSteps();
    },
  }),
  step({
    id: 'clients-col-contact',
    target: T('clients-col-primary-contact'),
    title: 'Column: Primary Contact',
    content: 'Main contact person for calls and emails.',
    before: async () => {
      if (!hasClientTable() || !hasAnyClientRow()) skipClientTableSteps();
    },
  }),
  step({
    id: 'clients-col-actions',
    target: T('clients-col-actions'),
    title: 'Column: Actions',
    content: 'View opens Client 360. Delete removes the account when permitted.',
    before: async () => {
      if (!hasClientTable() || !hasAnyClientRow()) skipClientTableSteps();
    },
  }),

  // ——— Open first client (only when client records exist) ———
  step({
    id: 'clients-row-first',
    target: `${T('clients-row-first')}, tr[data-client-id]`,
    title: 'Open a client',
    content:
      'An available client was found. Next opens its profile so we can walk header actions, Account summary, and tabs.',
    before: async () => {
      await ensurePath('/clients');
      await waitForSelector(T('clients-create-btn'), 3000);
      // Dynamic: no client records → finish listing tour (no profile / Projects redirect)
      if (!hasAnyClientRow()) {
        skipClientDetailSteps();
        return;
      }
      await waitForSelector(`${T('clients-row-first')}, tr[data-client-id]`, 2000);
    },
  }),

  // ——— Detail hero ———
  step({
    id: 'clients-detail-hero',
    target: T('clients-detail-hero'),
    title: 'Client profile',
    content:
      'Full Client 360 — avatar, status, category, tags, and contact chips. Header buttons manage the account.',
    before: async () => {
      const ok = await openFirstClient();
      if (!ok) {
        skipClientDetailSteps();
        return;
      }
      await waitForSelector(T('clients-detail-hero'), 5000);
    },
  }),
  step({
    id: 'clients-detail-back',
    target: T('clients-detail-back'),
    title: 'Back to Clients',
    content: 'Returns to the Clients listing without leaving the CRM.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-edit-overview-btn',
    target: T('clients-edit-overview-btn'),
    title: 'Edit overview',
    content: 'Jumps to the Overview editor so you can update company profile fields quickly.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-delete-btn',
    target: T('clients-delete-btn'),
    title: 'Delete',
    content: 'Permanently removes the client when you have delete permission. Confirm carefully.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),

  // ——— Account summary ———
  step({
    id: 'clients-account-summary',
    target: T('clients-account-summary'),
    title: 'Account summary',
    content:
      'Live KPIs for this account. Click a card to jump to Contacts, Projects, Tasks, Finance, or Time logs.',
    placement: 'bottom',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-summary-add-contact',
    target: T('clients-summary-add-contact'),
    title: 'Add contact',
    content: 'Shortcut to open the Contacts tab and start adding a person at this account.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-summary-view-projects',
    target: T('clients-summary-view-projects'),
    title: 'View projects',
    content: 'Opens the Projects tab for delivery work linked to this client.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-summary-view-tasks',
    target: T('clients-summary-view-tasks'),
    title: 'View tasks',
    content: 'Opens Tasks for open/overdue deliverables on this account.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-summary-refresh',
    target: T('clients-summary-refresh'),
    title: 'Refresh summary',
    content: 'Reloads Account summary KPIs from the server after activity elsewhere.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-summary-kpis',
    target: T('clients-summary-kpis'),
    title: 'Summary metrics',
    content:
      'Contacts, Projects (active/total), Open tasks, Unpaid invoices, Outstanding balance, and Hours this month.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),

  // ——— Tabs ———
  step({
    id: 'clients-detail-tabs',
    target: T('clients-detail-tabs'),
    title: 'Client tabs',
    content:
      'Navigate the full 360°: Overview, Contacts, Addresses, Notes, Timeline, Documents, Portal, Projects, Tasks, Time logs, Finance, Tickets, Health, Audit. Next walks each tab.',
    placement: 'bottom',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-tab-overview',
    target: T('clients-tab-overview'),
    title: 'Overview tab',
    content: 'Edit company profile, tags, addresses, and glance stats. Source of truth for the account card.',
    before: async () => {
      if (!(await guardClientDetail(async () => {
        requestClientDetailTab('overview');
        await waitForSelector(T('clients-tab-overview'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'clients-overview-glance',
    target: T('clients-overview-glance'),
    title: 'At a glance',
    content: 'Compact snapshot — contacts, projects, open tasks, tax ID, website.',
    before: async () => {
      if (!(await guardClientDetail(async () => {
        requestClientDetailTab('overview');
        await waitForSelector(T('clients-overview-glance'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'clients-overview-origin',
    target: T('clients-overview-origin'),
    title: 'Origin',
    content: 'Shows whether this client was converted from a lead or created manually.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-overview-quick-notes',
    target: T('clients-overview-quick-notes'),
    title: 'Quick notes',
    content: 'Pinned / recent notes without leaving Overview. View all opens the Notes tab.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-overview-company',
    target: T('clients-overview-company'),
    title: 'Company information',
    content:
      'Editable company fields — name, email, phone, website, avatar, tax ID, status, category.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-overview-tags',
    target: T('clients-overview-tags'),
    title: 'Tags',
    content: 'Toggle account tags used in listing filters and reporting.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-overview-billing',
    target: T('clients-overview-billing'),
    title: 'Billing address',
    content: 'Primary billing address used on finance documents.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),
  step({
    id: 'clients-overview-save',
    target: T('clients-overview-save'),
    title: 'Save changes',
    content: 'Persists Overview edits. Always save before switching tabs if you changed fields.',
    before: async () => {
      if (!(await guardClientDetail())) return;
    },
  }),

  step({
    id: 'clients-tab-contacts',
    target: T('clients-tab-contacts'),
    title: 'Contacts tab',
    content: 'Manage people at the account — add contacts, set primary, store emails and phones.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('contacts')))) return;
    },
  }),
  step({
    id: 'clients-tab-addresses',
    target: T('clients-tab-addresses'),
    title: 'Addresses tab',
    content: 'Billing, shipping, and branch addresses for delivery and invoicing.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('addresses')))) return;
    },
  }),
  step({
    id: 'clients-tab-notes',
    target: T('clients-tab-notes'),
    title: 'Notes tab',
    content: 'Pin, search, and store free-form notes about the relationship.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('notes')))) return;
    },
  }),
  step({
    id: 'clients-tab-timeline',
    target: T('clients-tab-timeline'),
    title: 'Timeline tab',
    content: 'Activity feed of events and interactions with this client.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('timeline')))) return;
    },
  }),
  step({
    id: 'clients-tab-documents',
    target: T('clients-tab-documents'),
    title: 'Documents tab',
    content: 'Upload and categorise contracts, proposals, and other files.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('documents')))) return;
    },
  }),
  step({
    id: 'clients-tab-portal',
    target: T('clients-tab-portal'),
    title: 'Portal tab',
    content: 'Client portal users — invite, activate, or suspend portal access.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('portal')))) return;
    },
  }),
  step({
    id: 'clients-tab-projects',
    target: T('clients-tab-projects'),
    title: 'Projects tab',
    content: 'Projects linked to this client (when you have projects permission).',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('projects')))) return;
    },
  }),
  step({
    id: 'clients-tab-tasks',
    target: T('clients-tab-tasks'),
    title: 'Tasks tab',
    content: 'Tasks and deliverables for this account.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('tasks')))) return;
    },
  }),
  step({
    id: 'clients-tab-time-logs',
    target: T('clients-tab-time-logs'),
    title: 'Time logs tab',
    content: 'Billable and non-billable hours logged against this client’s work.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('time-logs')))) return;
    },
  }),
  step({
    id: 'clients-tab-finance',
    target: T('clients-tab-finance'),
    title: 'Finance tab',
    content: 'Quotations, invoices, and payments for the account.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('finance')))) return;
    },
  }),
  step({
    id: 'clients-tab-tickets',
    target: T('clients-tab-tickets'),
    title: 'Tickets tab',
    content: 'Support tickets raised for this client.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('tickets')))) return;
    },
  }),
  step({
    id: 'clients-tab-health',
    target: T('clients-tab-health'),
    title: 'Health tab',
    content: 'Account health score plus open tickets, overdue invoices, and outstanding balance.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('health')))) return;
    },
  }),
  step({
    id: 'clients-tab-audit',
    target: T('clients-tab-audit'),
    title: 'Audit tab',
    content: 'Who changed what on this client record and when.',
    before: async () => {
      if (!(await guardClientDetail(async () => requestClientDetailTab('audit')))) return;
    },
  }),

  // ——— Finish → Projects (only after a real client profile walkthrough) ———
  step({
    id: 'clients-to-projects',
    target: T('projects-tour-landing'),
    title: 'Next: Projects',
    content:
      'Clients feed delivery work. You are on the Projects listing — manage project portfolios linked to client accounts. Tour complete — click Finish.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      // Do not run this redirect unless a client detail tour actually ran
      if (!document.querySelector(T('clients-detail-tabs')) && !hasAnyClientRow()) {
        requestClientsTourJump({ finish: true });
        return;
      }
      requestTourNavigate('/projects');
      await waitForSelector(T('projects-tour-landing'), 10000);
    },
  }),
];
