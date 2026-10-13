/**
 * Quotations Beacon onboarding — list, create, detail, templates, archive → Invoices.
 * Tour-only; does not change quotation APIs or save/send/convert logic.
 * Soft-skips missing targets (empty list, RBAC-hidden buttons, status-gated actions).
 * Detail phase: open first quotation once, then stay on detail (no list↔detail remount per step).
 *
 * Note: There is NO “recurring quotations” feature. Recurring billing lives under
 * Invoices → Recurring Profiles (and Reports → Recurring Invoices). A tour step explains this.
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestQuotationsArchiveView,
  requestQuotationsTourJump,
  firstQuotationDetailPath,
} from '../quotationsTourState.js';

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
  if (prefix === '/quotations' && path === '/quotations') return;
  if (prefix === '/quotations/create' && path.startsWith('/quotations/create')) return;
  if (prefix === '/quotation-templates' && path.startsWith('/quotation-templates') && !path.includes('/create')) {
    return;
  }
  if (prefix === '/quotation-templates/create' && path.startsWith('/quotation-templates/create')) return;
  if (prefix.startsWith('/quotations/') && path.startsWith(prefix)) return;

  requestTourNavigate(prefix);
  await wait(400);
  if (prefix === '/quotations') await waitForSelector(T('quotations-tour-landing'), 10000);
  else if (prefix === '/quotations/create') await waitForSelector(T('quotations-create-form'), 10000);
  else if (prefix === '/quotation-templates') await waitForSelector(T('quotations-templates-landing'), 10000);
  else if (prefix === '/quotation-templates/create') await waitForSelector(T('quotations-template-create'), 10000);
  else await waitForSelector(T('quotations-detail'), 10000);
}

function hasQuotationRow() {
  return Boolean(document.querySelector(T('quotations-row-first')));
}

function isOnQuotationDetailPath() {
  const path = currentPath();
  return (
    path.startsWith('/quotations/') &&
    !path.startsWith('/quotations/create') &&
    path !== '/quotations'
  );
}

function skipQuotationDetailSteps() {
  const jumpIdx = quotationsTourSteps.findIndex((s) => s.id === 'quotations-templates-btn');
  if (jumpIdx >= 0) requestQuotationsTourJump({ stepIndex: jumpIdx });
}

/** Open first quotation once (list → detail). */
async function openFirstQuotationOrSkip() {
  if (isOnQuotationDetailPath()) {
    const detail = await waitForSelector(T('quotations-detail'), 10000);
    return Boolean(detail);
  }
  await ensurePath('/quotations');
  requestQuotationsArchiveView('active');
  await wait(400);
  await waitForSelector(T('quotations-table'), 5000);
  if (!hasQuotationRow()) {
    skipQuotationDetailSteps();
    return false;
  }
  const detailPath = firstQuotationDetailPath();
  if (!detailPath) {
    skipQuotationDetailSteps();
    return false;
  }
  requestTourNavigate(detailPath);
  await waitForSelector(T('quotations-detail'), 10000);
  return Boolean(document.querySelector(T('quotations-detail')));
}

/**
 * Stay on detail across steps — do NOT bounce list↔detail (that remounts the page).
 */
async function guardQuotationDetail() {
  if (document.querySelector(T('quotations-detail'))) return true;
  if (isOnQuotationDetailPath()) {
    await waitForSelector(T('quotations-detail'), 10000);
    if (document.querySelector(T('quotations-detail'))) return true;
  }
  return openFirstQuotationOrSkip();
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

export const quotationsTourSteps = [
  // ——— List ———
  step({
    id: 'quotations-welcome',
    target: T('quotations-title'),
    title: 'Quotations module',
    content:
      'Create price proposals, send them for client portal sign-off, revise accepted offers, and convert to invoices or sales orders. Click Next to walk through every feature.',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/quotations');
      requestQuotationsArchiveView('active');
    },
  }),

  step({
    id: 'quotations-kpis',
    target: T('quotations-kpis'),
    title: 'Pipeline KPIs',
    content:
      'Quick counts for Active/Archived quotes, Draft, Sent, Accepted, and Pipeline value. Use these to see funnel health at a glance.',
    before: async () => {
      await ensurePath('/quotations');
    },
  }),

  step({
    id: 'quotations-filters',
    target: T('quotations-filters'),
    title: 'Search & status filters',
    content:
      'Search by quotation number, recipient, or title. Filter by status (Draft, Sent, Accepted, Rejected, Expired, Converted).',
    before: async () => {
      await ensurePath('/quotations');
    },
  }),

  step({
    id: 'quotations-archive-toggle',
    target: T('quotations-archive-toggle'),
    title: 'Active vs Archived',
    content:
      'Toggle Active and Archived lists. Archived quotes stay for history but leave the active pipeline. We will open Archived next, then return to Active.',
    before: async () => {
      await ensurePath('/quotations');
      requestQuotationsArchiveView('active');
      await wait(200);
    },
  }),

  step({
    id: 'quotations-archived-view',
    target: T('quotations-table'),
    title: 'Archived quotations',
    content:
      'Archived view shows soft-archived proposals. From here you can Open or Restore a quote. Delete is only available for Draft quotes on the Active list.',
    before: async () => {
      await ensurePath('/quotations');
      requestQuotationsArchiveView('archived');
      await wait(500);
      await waitForSelector(T('quotations-table'), 4000);
    },
  }),

  step({
    id: 'quotations-header-actions',
    target: T('quotations-header-actions'),
    title: 'List toolbar',
    content:
      'Refresh reloads data. Export CSV downloads the current filtered list. Templates opens reusable proposal packages. Create Quotation starts a new draft.',
    before: async () => {
      await ensurePath('/quotations');
      requestQuotationsArchiveView('active');
      await wait(300);
    },
  }),

  step({
    id: 'quotations-table',
    target: T('quotations-table'),
    title: 'Quotations table',
    content:
      'Columns: Quotation (+ title), Recipient, Issued, Valid till, Total, Status, and Actions (Open, Archive/Restore, Delete for Draft). Click Open or the quote number to open detail.',
    before: async () => {
      await ensurePath('/quotations');
      requestQuotationsArchiveView('active');
      await wait(300);
      if (!hasQuotationRow()) {
        const jumpIdx = quotationsTourSteps.findIndex((s) => s.id === 'quotations-create-btn');
        if (jumpIdx >= 0) requestQuotationsTourJump({ stepIndex: jumpIdx });
      }
    },
  }),

  step({
    id: 'quotations-create-btn',
    target: T('quotations-create-btn'),
    title: 'Create Quotation',
    content: 'Click Create Quotation to open the full create form. Next walks through every field group.',
    before: async () => {
      await ensurePath('/quotations');
      await waitForSelector(T('quotations-create-btn'), 3000);
    },
  }),

  // ——— Create form ———
  step({
    id: 'quotations-create-welcome',
    target: T('quotations-create-form'),
    title: 'New Quotation form',
    content:
      'The quotation number is assigned on save. Use Load Template or Save as Template from the header. Fill Recipient, Commercial terms, Line items, then Create Quotation.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/quotations/create');
    },
  }),

  step({
    id: 'quotations-create-templates-tools',
    target: T('quotations-create-template-tools'),
    title: 'Load / Save as Template',
    content:
      'Load Template… fills this form from a saved package. Save as Template stores the current lines and terms for reuse (without creating a quote).',
    before: async () => {
      await ensurePath('/quotations/create');
    },
  }),

  step({
    id: 'quotations-create-recipient',
    target: T('quotations-create-recipient'),
    title: 'Recipient & pipeline',
    content:
      'Choose Lead contact or Client account, pick the Lead/Client*, optional Opportunity (loads that deal’s Proposed Products & Line Items into the quotation), Destination state* (for GST), and review Intra/Inter GST mode.',
    before: async () => {
      await ensurePath('/quotations/create');
    },
  }),

  step({
    id: 'quotations-create-commercial',
    target: T('quotations-create-commercial'),
    title: 'Commercial terms',
    content:
      'Set Issue date*, Valid till*, Currency*, Tax calculation, Title, Description, Discount, and Shipping. These drive totals and GST.',
    before: async () => {
      await ensurePath('/quotations/create');
    },
  }),

  step({
    id: 'quotations-create-lines',
    target: T('quotations-create-lines'),
    title: 'Line items & catalog',
    content:
      'Add products from the catalog picker or enter lines manually (qty, rate, tax, description). Each line rolls into Summary & totals.',
    before: async () => {
      await ensurePath('/quotations/create');
    },
  }),

  step({
    id: 'quotations-create-totals',
    target: T('quotations-create-totals'),
    title: 'Summary & totals',
    content:
      'Live preview of subtotal, discount, shipping, CGST/SGST or IGST, and grand total. Recipient notes appear on the PDF/portal.',
    before: async () => {
      await ensurePath('/quotations/create');
    },
  }),

  step({
    id: 'quotations-create-actions',
    target: T('quotations-create-actions'),
    title: 'Save actions',
    content:
      'Cancel returns to the list. Save Draft or Create Quotation submits the form (we skip saving during the tour). Next opens an existing quotation if you have one.',
    before: async () => {
      await ensurePath('/quotations/create');
    },
  }),

  // ——— Detail (if any) — open once, then stay ———
  step({
    id: 'quotations-detail',
    target: T('quotations-detail'),
    title: 'Quotation detail',
    content:
      'Status badges, revision number, and the full lifecycle toolbar live here. Sections below show details, GST totals, lines, notes, and revision history.',
    skipBeacon: true,
    before: async () => {
      if (!(await openFirstQuotationOrSkip())) return;
    },
  }),

  step({
    id: 'quotations-detail-actions',
    target: T('quotations-detail-actions'),
    title: 'Lifecycle buttons',
    content:
      'Send · Portal token · Accept · Reject · Revise · Convert to Invoice · Convert to Sales Order · Print · PDF · Archive/Restore. Availability depends on status and your permissions (e.g. convert-to-invoice needs finance write).',
    before: async () => {
      if (!(await guardQuotationDetail())) return;
    },
  }),

  step({
    id: 'quotations-detail-sections',
    target: T('quotations-detail-sections'),
    title: 'Detail sections',
    content:
      'Not a tab strip — scroll sections: Quotation details, Totals & GST, Line items, Recipient notes, Revision history. Accepted/Converted quotes cannot be edited directly — use Revise.',
    before: async () => {
      if (!(await guardQuotationDetail())) return;
    },
  }),

  // ——— Templates ———
  step({
    id: 'quotations-templates-btn',
    target: T('quotations-templates-btn'),
    title: 'Templates',
    content:
      'Reusable proposal packages for retainers and fixed-scope work. Next opens the Templates list and New Template form.',
    before: async () => {
      await ensurePath('/quotations');
      await waitForSelector(T('quotations-templates-btn'), 3000);
    },
  }),

  step({
    id: 'quotations-templates-list',
    target: T('quotations-templates-landing'),
    title: 'Quotation Templates list',
    content:
      'Search templates. Columns: Name, Category, Currency, Tax mode, Lines. Delete removes a template. New Template opens the create form.',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/quotation-templates');
    },
  }),

  step({
    id: 'quotations-templates-new',
    target: T('quotations-templates-new-btn'),
    title: 'New Template',
    content: 'Create a named template with category, currency, tax mode, and default line items.',
    before: async () => {
      await ensurePath('/quotation-templates');
    },
  }),

  step({
    id: 'quotations-template-create',
    target: T('quotations-template-create'),
    title: 'Create template form',
    content:
      'Fill template details and line items, then save. Templates appear in Load Template… on New Quotation. We skip saving during the tour.',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/quotation-templates/create');
    },
  }),

  // ——— Recurring clarification ———
  step({
    id: 'quotations-recurring-note',
    target: T('quotations-tour-landing'),
    title: 'About recurring quotations',
    content:
      'There is no Recurring Quotations feature in this module. Recurring billing is under Invoices → Recurring Profiles (auto-generate invoices on a schedule) and Reports → Recurring Invoices. Templates + revisions cover repeat proposals.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/quotations');
      requestQuotationsArchiveView('active');
    },
  }),

  // ——— Handoff ———
  step({
    id: 'quotations-to-invoices',
    target: T('quotations-tour-landing'),
    title: 'Next: Invoices',
    content:
      'You have seen list KPIs, filters, archive, create form fields, detail lifecycle buttons, templates, and where recurring billing lives. Click “Go to Invoices” to continue.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/quotations');
    },
  }),
];
