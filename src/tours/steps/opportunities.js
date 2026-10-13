/**
 * Opportunities Beacon onboarding — list + create form + detail → Sales Orders.
 * Tour-only; does not create/convert/delete deals.
 * Soft-skips missing targets (empty list, RBAC-hidden buttons, pagination).
 * Detail phase: open first deal once, then stay (no list↔detail remount per step).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestOpportunitiesTourStage,
  requestOpportunitiesTourJump,
  firstOpportunityDetailPath,
} from '../opportunitiesTourState.js';

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
  if (prefix === '/opportunities' && path === '/opportunities') {
    await waitForSelector(T('opportunities-tour-landing'), 8000);
    return;
  }
  if (prefix === '/opportunities/create' && path.startsWith('/opportunities/create')) {
    await waitForSelector(T('opportunities-create-form'), 8000);
    return;
  }
  if (
    prefix.startsWith('/opportunities/') &&
    prefix !== '/opportunities/create' &&
    path.startsWith(prefix)
  ) {
    await waitForSelector(T('opportunities-detail'), 8000);
    return;
  }

  requestTourNavigate(prefix);
  await wait(400);
  if (prefix === '/opportunities') {
    await waitForSelector(T('opportunities-tour-landing'), 10000);
  } else if (prefix === '/opportunities/create') {
    await waitForSelector(T('opportunities-create-form'), 10000);
  } else {
    await waitForSelector(T('opportunities-detail'), 10000);
  }
}

async function ensureList() {
  const path = currentPath();
  const alreadyOnList = path === '/opportunities';
  await ensurePath('/opportunities');
  // Only reset stage when arriving from another route — avoids list refetch every Next.
  if (!alreadyOnList) {
    requestOpportunitiesTourStage('');
    await wait(300);
  }
  await waitForSelector(T('opportunities-table'), 5000);
}

function jumpTo(stepId) {
  const jumpIdx = opportunitiesTourSteps.findIndex((s) => s.id === stepId);
  if (jumpIdx >= 0) requestOpportunitiesTourJump({ stepIndex: jumpIdx });
}

function hasOpportunityRow() {
  return Boolean(document.querySelector(T('opportunities-row-first')));
}

function isOnOpportunityDetailPath() {
  const path = currentPath();
  return (
    path.startsWith('/opportunities/') &&
    !path.startsWith('/opportunities/create') &&
    path !== '/opportunities'
  );
}

function skipOpportunityDetailSteps() {
  jumpTo('opportunities-finish');
}

async function ensureCreateOrSkip() {
  // Stay on create form across create steps — do not bounce via list (remounts page).
  if (currentPath().startsWith('/opportunities/create')) {
    const form = await waitForSelector(T('opportunities-create-form'), 5000);
    return Boolean(form);
  }
  await ensureList();
  const btn = await waitForSelector(T('opportunities-new-deal-btn'), 2000);
  if (!btn) {
    jumpTo('opportunities-open-detail');
    return false;
  }
  await ensurePath('/opportunities/create');
  const form = await waitForSelector(T('opportunities-create-form'), 5000);
  if (!form) {
    jumpTo('opportunities-open-detail');
    return false;
  }
  return true;
}

/** Open first deal once (list → detail). */
async function openFirstOpportunityOrSkip() {
  // Already on a deal detail — wait for it instead of remounting via list.
  if (isOnOpportunityDetailPath()) {
    const detail = await waitForSelector(T('opportunities-detail'), 10000);
    return Boolean(detail);
  }
  await ensureList();
  if (!hasOpportunityRow()) {
    skipOpportunityDetailSteps();
    return false;
  }
  const detailPath = firstOpportunityDetailPath();
  if (!detailPath) {
    skipOpportunityDetailSteps();
    return false;
  }
  requestTourNavigate(detailPath);
  await wait(500);
  const detail = await waitForSelector(T('opportunities-detail'), 10000);
  if (!detail) {
    skipOpportunityDetailSteps();
    return false;
  }
  return true;
}

/** Stay on detail — no list↔detail remount on every step. */
async function guardOpportunityDetail() {
  if (document.querySelector(T('opportunities-detail'))) return true;
  if (isOnOpportunityDetailPath()) {
    await waitForSelector(T('opportunities-detail'), 10000);
    if (document.querySelector(T('opportunities-detail'))) return true;
  }
  return openFirstOpportunityOrSkip();
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

export const opportunitiesTourSteps = [
  step({
    id: 'opportunities-welcome',
    target: T('opportunities-title'),
    title: 'Opportunities',
    content:
      'Track deals through the sales pipeline, watch weighted forecast KPIs, and convert Won deals to quotations or sales orders. Click Next to walk through the list, New Deal form, and deal detail.',
    skipBeacon: true,
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'opportunities-header-actions',
    target: T('opportunities-header-actions'),
    title: 'List toolbar',
    content:
      'Refresh reloads deals and KPIs. Export downloads CSV or JSON for the current filters. Quick Create opens a rapid modal; New Deal opens the full create workspace. Tour restarts this walkthrough.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'opportunities-kpis',
    target: T('opportunities-kpis'),
    title: 'Pipeline KPIs',
    content:
      'Five cards: Total Deals, Pipeline Value, Weighted Forecast, Won Revenue, and Win Rate %. Soft-skipped while summary is still loading.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('opportunities-kpis'), 4000);
    },
  }),

  step({
    id: 'opportunities-filters',
    target: T('opportunities-filters'),
    title: 'Search & stage pills',
    content:
      'Search by deal title, number, client, or owner. Stage pills filter All plus Discovery → Quotation Sent, Won, and Lost.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'opportunities-table',
    target: T('opportunities-table'),
    title: 'Deals table columns',
    content:
      'Columns: Deal (click title to open detail), Client, Stage, Value, Weighted Value, Probability, Shipping Charge, Close Date, Owner, Actions. Soft-skipped when empty.',
    before: async () => {
      await ensureList();
      await wait(300);
      if (!hasOpportunityRow()) {
        jumpTo('opportunities-new-deal-btn');
      }
    },
  }),

  step({
    id: 'opportunities-row-actions',
    target: T('opportunities-row-actions'),
    title: 'Row actions & conversions',
    content:
      'Open opens the deal detail. Change stage inline (Lost opens a reason modal). Won deals show Quote and Sales Order until generated — then a lock badge appears. Delete needs delete permission. Soft-skipped when the list is empty.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('opportunities-row-actions'), 2500);
    },
  }),

  step({
    id: 'opportunities-pagination',
    target: T('opportunities-pagination'),
    title: 'Pagination',
    content:
      'Lists paginate at 20 deals per page (Prev / Next). Soft-skipped when there is only one page.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('opportunities-pagination'), 2500);
    },
  }),

  step({
    id: 'opportunities-quick-create-btn',
    target: T('opportunities-quick-create-btn'),
    title: 'Quick Create',
    content:
      'Rapid deal entry modal with templates, client, stage, shipping, contacts, and line items. Use New Deal for the full workspace. Soft-skipped without write access.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('opportunities-quick-create-btn'), 2000);
    },
  }),

  step({
    id: 'opportunities-new-deal-btn',
    target: T('opportunities-new-deal-btn'),
    title: 'New Deal',
    content:
      'Opens the full New Opportunity Deal form. Next walks through every section. Soft-skipped without write access.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('opportunities-new-deal-btn'), 2500);
    },
  }),

  step({
    id: 'opportunities-create-welcome',
    target: T('opportunities-create-form'),
    title: 'New Opportunity Deal',
    content:
      'Full create workspace with four form sections and a live Pipeline Summary sidebar. We will not save during the tour.',
    skipBeacon: true,
    before: async () => {
      await ensureCreateOrSkip();
    },
  }),

  step({
    id: 'opportunities-section-overview',
    target: T('opportunities-section-overview'),
    title: '1. Deal Overview & Client',
    content:
      'Quick Deal Templates, Opportunity Deal Title *, Client Account *, optional Inbound Lead Link, Sales Owner, and Auto-fill Contact Info from the client.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('opportunities-section-overview'), 4000);
    },
  }),

  step({
    id: 'opportunities-section-stage',
    target: T('opportunities-section-stage'),
    title: '2. Pipeline Stage & Probability',
    content:
      'Pick a stage card (Discovery → Won/Lost), adjust Win Probability with the slider, set Expected Close Date. Lost requires a reason.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('opportunities-section-stage'), 4000);
    },
  }),

  step({
    id: 'opportunities-section-contact',
    target: T('opportunities-section-contact'),
    title: '3. Primary Contact',
    content:
      'Contact Name, Email Address, and Mobile / Phone for the deal contact person.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('opportunities-section-contact'), 4000);
    },
  }),

  step({
    id: 'opportunities-section-products',
    target: T('opportunities-section-products'),
    title: '4. Proposed Products & Shipping',
    content:
      'Proposed Products & Line Items (description, qty, unit price, tax %), Destination State for GST & shipping, and Shipping Charge (auto or manual override). These lines can later fill a Quotation when you select this deal.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('opportunities-section-products'), 4000);
    },
  }),

  step({
    id: 'opportunities-create-sidebar',
    target: T('opportunities-create-sidebar'),
    title: 'Pipeline Summary',
    content:
      'Live Account, title, Products Subtotal, Estimated GST, Shipping, Total Deal Value, Weighted Forecast, and validation checklist.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('opportunities-create-sidebar'), 4000);
    },
  }),

  step({
    id: 'opportunities-create-actions',
    target: T('opportunities-create-actions'),
    title: 'Cancel & Save',
    content:
      'Cancel returns to the list. Save Opportunity Deal validates and creates the deal — we skip saving on the tour. Next opens an existing deal detail if available.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('opportunities-create-actions'), 4000);
    },
  }),

  // ——— Detail — open once, then stay ———
  step({
    id: 'opportunities-open-detail',
    target: T('opportunities-detail'),
    title: 'Opportunity detail',
    content:
      'Full deal workspace: stage badge, lock status when Quote/SO already generated, KPIs, overview, contact, products, shipping, and generated documents.',
    skipBeacon: true,
    before: async () => {
      if (!(await openFirstOpportunityOrSkip())) return;
    },
  }),

  step({
    id: 'opportunities-detail-header',
    target: T('opportunities-detail-header'),
    title: 'Deal header',
    content:
      'Title, opportunity number, stage pill, and client summary. Back returns to the Opportunities list.',
    before: async () => {
      if (!(await guardOpportunityDetail())) return;
      await waitForSelector(T('opportunities-detail-header'), 4000);
    },
  }),

  step({
    id: 'opportunities-detail-actions',
    target: T('opportunities-detail-actions'),
    title: 'Detail actions',
    content:
      'Won deals can Convert to Quotation or Sales Order (once each). Open quotation / sales order links appear after generation. Delete needs delete permission.',
    before: async () => {
      if (!(await guardOpportunityDetail())) return;
      await waitForSelector(T('opportunities-detail-actions'), 4000);
    },
  }),

  step({
    id: 'opportunities-detail-kpis',
    target: T('opportunities-detail-kpis'),
    title: 'Deal value KPIs',
    content:
      'Deal value, Weighted forecast, Probability, and Shipping charge for this opportunity.',
    before: async () => {
      if (!(await guardOpportunityDetail())) return;
      await waitForSelector(T('opportunities-detail-kpis'), 4000);
    },
  }),

  step({
    id: 'opportunities-detail-overview',
    target: T('opportunities-detail-overview'),
    title: 'Deal overview',
    content:
      'Number, title, stage, client, linked lead, owner, close dates, currency, and lost reason when applicable.',
    before: async () => {
      if (!(await guardOpportunityDetail())) return;
      await waitForSelector(T('opportunities-detail-overview'), 4000);
    },
  }),

  step({
    id: 'opportunities-detail-contact',
    target: T('opportunities-detail-contact'),
    title: 'Primary contact',
    content: 'Contact person, email, and mobile captured on the deal.',
    before: async () => {
      if (!(await guardOpportunityDetail())) return;
      await waitForSelector(T('opportunities-detail-contact'), 4000);
    },
  }),

  step({
    id: 'opportunities-detail-products',
    target: T('opportunities-detail-products'),
    title: 'Proposed Products & Line Items',
    content:
      'Product/service lines with qty, unit price, tax %, and amount. When you select this opportunity on New Quotation, these lines are copied into quotation line items.',
    before: async () => {
      if (!(await guardOpportunityDetail())) return;
      await waitForSelector(T('opportunities-detail-products'), 4000);
    },
  }),

  step({
    id: 'opportunities-detail-shipping',
    target: T('opportunities-detail-shipping'),
    title: 'Shipping & financials',
    content:
      'Destination state, shipping charge, products subtotal, estimated GST, total deal value, and weighted forecast.',
    before: async () => {
      if (!(await guardOpportunityDetail())) return;
      await waitForSelector(T('opportunities-detail-shipping'), 4000);
    },
  }),

  step({
    id: 'opportunities-detail-conversions',
    target: T('opportunities-detail-conversions'),
    title: 'Generated documents',
    content:
      'Links to the quotation and sales order generated from this deal (when present), plus created/updated timestamps.',
    before: async () => {
      if (!(await guardOpportunityDetail())) return;
      await waitForSelector(T('opportunities-detail-conversions'), 4000);
    },
  }),

  step({
    id: 'opportunities-finish',
    target: T('opportunities-tour-landing'),
    title: 'Next: Sales Orders',
    content:
      'You have seen list KPIs, create form (including Proposed Products), and deal detail. Won deals convert via Quote / Sales Order. Continue to Sales Orders for fulfilment.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/opportunities');
      requestOpportunitiesTourStage('');
    },
  }),
];
