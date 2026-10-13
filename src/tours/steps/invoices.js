/**
 * Invoices Beacon onboarding — list, create, detail, recurring, archive → Payments.
 * Tour-only; does not change invoice APIs or save/send/pay logic.
 * Soft-skips missing targets (empty list, RBAC-hidden buttons, status-gated actions).
 * Detail phase: open first invoice once, then stay on detail (no list↔detail remount per step).
 * Empty list skips the detail phase and continues at Recurring Profiles.
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestInvoicesArchiveView,
  requestInvoicesTourTab,
  requestInvoicesTourJump,
  firstInvoiceDetailPath,
} from '../invoicesTourState.js';

const T = (id) => `[data-tour="${id}"]`;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function currentPath() {
  const hash = String(window.location.hash || '');
  return hash.replace(/^#/, '').split('?')[0] || '/';
}

async function ensurePath(prefix) {
  const path = currentPath();
  if (prefix === '/invoices' && path === '/invoices') return;
  if (prefix === '/invoices/create' && path.startsWith('/invoices/create')) return;
  if (prefix === '/invoice-templates' && path.startsWith('/invoice-templates') && !path.includes('/create')) {
    return;
  }
  if (prefix.startsWith('/invoices/') && path.startsWith(prefix)) return;

  requestTourNavigate(prefix);
  await wait(400);
  if (prefix === '/invoices') await waitForSelector(T('invoices-tour-landing'), 10000);
  else if (prefix === '/invoices/create') await waitForSelector(T('invoices-create-form'), 10000);
  else if (prefix === '/invoice-templates') await waitForSelector(T('invoices-templates-landing'), 10000);
  else await waitForSelector(T('invoices-detail'), 10000);
}

async function ensureInvoicesTab() {
  await ensurePath('/invoices');
  requestInvoicesTourTab('invoices');
  await wait(350);
  await waitForSelector(T('invoices-table'), 5000);
}

async function ensureRecurringTab() {
  await ensurePath('/invoices');
  requestInvoicesTourTab('recurring');
  await wait(400);
  await waitForSelector(T('invoices-recurring-toolbar'), 5000);
}

function hasInvoiceRow() {
  return Boolean(document.querySelector(T('invoices-row-first')));
}

function isOnInvoiceDetailPath() {
  const path = currentPath();
  return (
    path.startsWith('/invoices/') &&
    !path.startsWith('/invoices/create') &&
    path !== '/invoices'
  );
}

function jumpPastInvoiceDetail() {
  const jumpIdx = invoicesTourSteps.findIndex((s) => s.id === 'invoices-recurring-tab');
  if (jumpIdx >= 0) requestInvoicesTourJump({ stepIndex: jumpIdx });
}

/** Empty list / no openable row — skip detail phase. */
function skipInvoiceDetailSteps() {
  jumpPastInvoiceDetail();
}

/** Open first invoice once (list → detail). */
async function openFirstInvoiceOrSkip() {
  if (isOnInvoiceDetailPath()) {
    const detail = await waitForSelector(T('invoices-detail'), 10000);
    return Boolean(detail);
  }
  await ensureInvoicesTab();
  requestInvoicesArchiveView('active');
  await wait(400);
  await waitForSelector(T('invoices-table'), 5000);
  if (!hasInvoiceRow()) {
    skipInvoiceDetailSteps();
    return false;
  }
  const detailPath = firstInvoiceDetailPath();
  if (!detailPath) {
    skipInvoiceDetailSteps();
    return false;
  }
  requestTourNavigate(detailPath);
  await waitForSelector(T('invoices-detail'), 10000);
  return Boolean(document.querySelector(T('invoices-detail')));
}

/**
 * Stay on detail across steps — do NOT bounce list↔detail (that remounts the page).
 * Opens first row only when not already on an invoice detail.
 */
async function guardInvoiceDetail() {
  if (document.querySelector(T('invoices-detail'))) return true;
  if (isOnInvoiceDetailPath()) {
    await waitForSelector(T('invoices-detail'), 10000);
    if (document.querySelector(T('invoices-detail'))) return true;
  }
  return openFirstInvoiceOrSkip();
}

function step(partial) {
  return {
    placement: 'auto',
    skipBeacon: false,
    beaconTrigger: 'click',
    targetWaitTimeout: 6000,
    ...partial,
  };
}

export const invoicesTourSteps = [
  // ——— List ———
  step({
    id: 'invoices-welcome',
    target: T('invoices-title'),
    title: 'Invoices module',
    content:
      'Manage tax invoices, collections, write-offs, templates, and recurring billing. Click Next to walk through every feature step by step.',
    skipBeacon: true,
    before: async () => {
      await ensureInvoicesTab();
      requestInvoicesArchiveView('active');
    },
  }),

  step({
    id: 'invoices-tabs',
    target: T('invoices-main-tabs'),
    title: 'Invoices | Recurring Profiles',
    content:
      'Two tabs: Invoices (one-off & generated invoices) and Recurring Profiles (schedules that auto-create invoices on a cadence).',
    before: async () => {
      await ensureInvoicesTab();
    },
  }),

  step({
    id: 'invoices-kpis',
    target: T('invoices-kpis'),
    title: 'Collection KPIs',
    content:
      'Quick stats: Total/Archived/Profiles, Outstanding balance, Overdue count, Collected (Paid), and how many invoices came from recurring schedules.',
    before: async () => {
      await ensureInvoicesTab();
    },
  }),

  step({
    id: 'invoices-filters',
    target: T('invoices-filters'),
    title: 'Search & status filters',
    content:
      'Search by invoice number, client, or project. Filter by status (Draft → Paid, Overdue, Written Off, Cancelled). Toggle From recurring only to see schedule-generated invoices.',
    before: async () => {
      await ensureInvoicesTab();
    },
  }),

  step({
    id: 'invoices-archive-toggle',
    target: T('invoices-archive-toggle'),
    title: 'Active vs Archived',
    content:
      'Toggle Active and Archived lists. Archived invoices stay for history but leave the active AR list. Next opens Archived, then returns to Active.',
    before: async () => {
      await ensureInvoicesTab();
      requestInvoicesArchiveView('active');
      await wait(200);
    },
  }),

  step({
    id: 'invoices-archived-view',
    target: T('invoices-table'),
    title: 'Archived invoices',
    content:
      'Archived view shows soft-archived invoices. Open or Restore from here. Cancel is for open invoices that should not be collected.',
    before: async () => {
      await ensureInvoicesTab();
      requestInvoicesArchiveView('archived');
      await wait(500);
      await waitForSelector(T('invoices-table'), 4000);
    },
  }),

  step({
    id: 'invoices-header-actions',
    target: T('invoices-header-actions'),
    title: 'List toolbar',
    content:
      'Refresh reloads data. Export CSV downloads the filtered list. Templates opens reusable invoice presets. Create Invoice starts a new draft.',
    before: async () => {
      await ensureInvoicesTab();
      requestInvoicesArchiveView('active');
      await wait(300);
    },
  }),

  step({
    id: 'invoices-table',
    target: T('invoices-table'),
    title: 'Invoices table columns',
    content:
      'Columns: Invoice (+ Recurring badge), Client, Issued, Due, Total, Balance, Status, Actions (Open, Archive/Restore, Cancel). Click the number or Open to view detail.',
    before: async () => {
      await ensureInvoicesTab();
      requestInvoicesArchiveView('active');
      await wait(300);
      // Empty list — skip table highlight; continue at Create Invoice
      if (!hasInvoiceRow()) {
        const jumpIdx = invoicesTourSteps.findIndex((s) => s.id === 'invoices-create-btn');
        if (jumpIdx >= 0) requestInvoicesTourJump({ stepIndex: jumpIdx });
      }
    },
  }),

  step({
    id: 'invoices-create-btn',
    target: T('invoices-create-btn'),
    title: 'Create Invoice',
    content: 'Click Create Invoice to open the full create form. Next walks through every field group.',
    before: async () => {
      await ensureInvoicesTab();
      await waitForSelector(T('invoices-create-btn'), 3000);
    },
  }),

  // ——— Create form ———
  step({
    id: 'invoices-create-welcome',
    target: T('invoices-create-form'),
    title: 'New Invoice form',
    content:
      'Use the import toolbar (Quotation / Sales Order / Expenses / Template), fill Invoice & client details, line items, optional Recurring, notes & reminders, then Save.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/invoices/create');
    },
  }),

  step({
    id: 'invoices-create-import',
    target: T('invoices-create-import'),
    title: 'Import & templates',
    content:
      'Import from Quotation, Sales Order, or Billable Expenses to prefill lines. Load Template / Save as Template for reusable packages.',
    before: async () => {
      await ensurePath('/invoices/create');
    },
  }),

  step({
    id: 'invoices-create-client',
    target: T('invoices-create-client'),
    title: 'Invoice & client details',
    content:
      'Required: Invoice number*, Issue/Due dates*, Currency*, Exchange rate, Tax calculation, Client*. Optional: Project, payment details, billing/shipping addresses.',
    before: async () => {
      await ensurePath('/invoices/create');
    },
  }),

  step({
    id: 'invoices-create-lines',
    target: T('invoices-create-lines'),
    title: 'Line items & catalog',
    content:
      'Pick products from the catalog or enter lines manually (qty, rate, tax). Lines feed Summary & totals.',
    before: async () => {
      await ensurePath('/invoices/create');
    },
  }),

  step({
    id: 'invoices-create-recurring',
    target: T('invoices-create-recurring'),
    title: 'Make this invoice recurring',
    content:
      'Check Recurring Invoice to also create a Recurring Profile (frequency, every N, cycles, next date). The first invoice is generated now; later cycles run from Recurring Profiles.',
    before: async () => {
      await ensurePath('/invoices/create');
    },
  }),

  step({
    id: 'invoices-create-notes',
    target: T('invoices-create-notes'),
    title: 'Notes, terms & reminders',
    content:
      'Client notes and terms appear on PDF/portal. Optional attachment and email reminder Timing / Count / Interval for overdue follow-ups.',
    before: async () => {
      await ensurePath('/invoices/create');
    },
  }),

  step({
    id: 'invoices-create-totals',
    target: T('invoices-create-totals'),
    title: 'Summary & totals',
    content:
      'Discount type/value, shipping, and live subtotal / tax / grand total. Save from the header (we skip saving during the tour).',
    before: async () => {
      await ensurePath('/invoices/create');
    },
  }),

  // ——— Detail (if any) — open once, then stay (no list remount per step) ———
  step({
    id: 'invoices-detail',
    target: T('invoices-detail'),
    title: 'Invoice detail',
    content:
      'Status, recurring badge, and the full toolbar live here. KPIs show Grand total, Amount paid, Credits, and Balance due.',
    skipBeacon: true,
    before: async () => {
      if (!(await openFirstInvoiceOrSkip())) return;
    },
  }),

  step({
    id: 'invoices-detail-actions',
    target: T('invoices-detail-actions'),
    title: 'Lifecycle buttons',
    content:
      'Send · Portal link · Print · PDF · Pay with Razorpay (when enabled) · Write off · Archive/Restore · Cancel. Availability depends on status and finance write permission.',
    before: async () => {
      if (!(await guardInvoiceDetail())) return;
    },
  }),

  step({
    id: 'invoices-detail-sections',
    target: T('invoices-detail-sections'),
    title: 'Detail sections',
    content:
      'Scroll sections: Invoice details, Totals, Line items, Payments (links to Payments module), Notes/Terms. Payments recorded here drive balance due.',
    before: async () => {
      if (!(await guardInvoiceDetail())) return;
    },
  }),

  // ——— Recurring Profiles ———
  step({
    id: 'invoices-recurring-tab',
    target: T('invoices-tab-recurring'),
    title: 'Recurring Profiles tab',
    content:
      'Schedules that auto-generate invoices on a cadence (weekly, monthly, quarterly, yearly, or custom days). This is where recurring billing lives — not under Quotations.',
    before: async () => {
      await ensurePath('/invoices');
      requestInvoicesTourTab('invoices');
      await wait(200);
    },
  }),

  step({
    id: 'invoices-recurring-explain',
    target: T('invoices-recurring-toolbar'),
    title: 'How recurring invoices work',
    content:
      'Create a profile with client, frequency, end condition (never / date / cycles), and line items. The system creates invoices on Next Run. Use Run Due Now for all due profiles, or Run Now on one row. Pause stops future cycles; Logs show execution history; Upcoming Forecast previews the next 7/30/90 days.',
    skipBeacon: true,
    before: async () => {
      await ensureRecurringTab();
    },
  }),

  step({
    id: 'invoices-recurring-toolbar',
    target: T('invoices-recurring-toolbar'),
    title: 'Recurring toolbar',
    content:
      'New Schedule opens the create-profile modal. Run Due Now generates all invoices whose next run is due. Upcoming Forecast shows planned runs. Search filters profiles.',
    before: async () => {
      await ensureRecurringTab();
    },
  }),

  step({
    id: 'invoices-recurring-table',
    target: T('invoices-recurring-table'),
    title: 'Recurring profiles table',
    content:
      'Columns: Profile, Client, Frequency, Next Run, Cycles, Status (Active/Paused/Completed). Actions: Run Now, Pause/Resume, Logs, Invoices (filter list by this profile), Delete.',
    before: async () => {
      await ensureRecurringTab();
      await wait(200);
    },
  }),

  // ——— Templates (brief) ———
  step({
    id: 'invoices-templates-btn',
    target: T('invoices-templates-btn'),
    title: 'Invoice Templates',
    content:
      'Reusable presets (retainers, milestones, AMC). Next opens the Templates list briefly, then we finish on the Invoices list.',
    before: async () => {
      await ensureInvoicesTab();
      await waitForSelector(T('invoices-templates-btn'), 3000);
    },
  }),

  step({
    id: 'invoices-templates-list',
    target: T('invoices-templates-landing'),
    title: 'Templates list',
    content:
      'Search templates. Columns: Name, Category, Currency, Terms, Lines. New Template creates a preset; Load Template on Create Invoice applies it.',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/invoice-templates');
    },
  }),

  // ——— Handoff ———
  step({
    id: 'invoices-to-payments',
    target: T('invoices-tour-landing'),
    title: 'Next: Payments',
    content:
      'You have seen list columns, create fields, detail buttons, archive, and Recurring Profiles. Click “Go to Payments” to continue with payment recording and refunds.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensureInvoicesTab();
      requestInvoicesArchiveView('active');
    },
  }),
];
