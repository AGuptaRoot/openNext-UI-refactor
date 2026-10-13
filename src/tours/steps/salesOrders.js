/**
 * Sales Orders Beacon onboarding — list → create form → detail.
 * Tour-only; does not create/save/ship/cancel orders.
 * Soft-skips missing targets (RBAC-hidden create, empty list, status-gated actions).
 * Detail phase: open first order once, then stay on detail (no list↔detail remount per step).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestSalesOrdersTourTab,
  requestSalesOrdersTourJump,
  firstSalesOrderDetailPath,
} from '../salesOrdersTourState.js';

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
  if (prefix === '/sales-orders' && path === '/sales-orders') {
    await waitForSelector(T('sales-orders-tour-landing'), 8000);
    return;
  }
  if (prefix === '/sales-orders/create' && path.startsWith('/sales-orders/create')) {
    await waitForSelector(T('sales-orders-create-form'), 8000);
    return;
  }
  if (
    prefix.startsWith('/sales-orders/') &&
    prefix !== '/sales-orders/create' &&
    path.startsWith(prefix)
  ) {
    await waitForSelector(T('sales-orders-detail'), 8000);
    return;
  }

  requestTourNavigate(prefix);
  await wait(400);
  if (prefix === '/sales-orders') await waitForSelector(T('sales-orders-tour-landing'), 10000);
  else if (prefix === '/sales-orders/create')
    await waitForSelector(T('sales-orders-create-form'), 10000);
  else await waitForSelector(T('sales-orders-detail'), 10000);
}

async function ensureList() {
  const path = currentPath();
  const alreadyOnList = path === '/sales-orders';
  await ensurePath('/sales-orders');
  if (!alreadyOnList) {
    requestSalesOrdersTourTab('All Orders');
    await wait(300);
  }
  await waitForSelector(T('sales-orders-table'), 5000);
}

function jumpTo(stepId) {
  const jumpIdx = salesOrdersTourSteps.findIndex((s) => s.id === stepId);
  if (jumpIdx >= 0) requestSalesOrdersTourJump({ stepIndex: jumpIdx });
}

function hasSalesOrderRow() {
  return Boolean(document.querySelector(T('sales-orders-row-first')));
}

function isOnSalesOrderDetailPath() {
  const path = currentPath();
  return (
    path.startsWith('/sales-orders/') &&
    !path.startsWith('/sales-orders/create') &&
    path !== '/sales-orders'
  );
}

function skipSalesOrderDetailSteps() {
  jumpTo('sales-orders-finish');
}

async function ensureCreateOrSkip() {
  if (currentPath().startsWith('/sales-orders/create')) {
    const form = await waitForSelector(T('sales-orders-create-form'), 5000);
    return Boolean(form);
  }
  await ensureList();
  const btn = await waitForSelector(T('sales-orders-create-btn'), 2000);
  if (!btn) {
    jumpTo('sales-orders-open-detail');
    return false;
  }
  await ensurePath('/sales-orders/create');
  const form = await waitForSelector(T('sales-orders-create-form'), 5000);
  if (!form) {
    jumpTo('sales-orders-open-detail');
    return false;
  }
  return true;
}

/** Open first sales order once (list → detail). */
async function openFirstSalesOrderOrSkip() {
  if (isOnSalesOrderDetailPath()) {
    const detail = await waitForSelector(T('sales-orders-detail'), 10000);
    return Boolean(detail);
  }
  await ensureList();
  const detailPath = firstSalesOrderDetailPath();
  if (!detailPath || !hasSalesOrderRow()) {
    skipSalesOrderDetailSteps();
    return false;
  }
  requestTourNavigate(detailPath);
  await wait(500);
  const detail = await waitForSelector(T('sales-orders-detail'), 10000);
  if (!detail) {
    skipSalesOrderDetailSteps();
    return false;
  }
  return true;
}

/** Stay on detail — no list↔detail remount on every step. */
async function guardSalesOrderDetail() {
  if (document.querySelector(T('sales-orders-detail'))) return true;
  if (isOnSalesOrderDetailPath()) {
    await waitForSelector(T('sales-orders-detail'), 10000);
    if (document.querySelector(T('sales-orders-detail'))) return true;
  }
  return openFirstSalesOrderOrSkip();
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

export const salesOrdersTourSteps = [
  // ——— List ———
  step({
    id: 'sales-orders-welcome',
    target: T('sales-orders-title'),
    title: 'Sales Orders',
    content:
      'Track approved commitments through stock reservation, dispatch, delivery, RMA, and invoicing. Click Next to walk through the list, create form, and a sample order detail.',
    skipBeacon: true,
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'sales-orders-header-actions',
    target: T('sales-orders-header-actions'),
    title: 'List toolbar',
    content:
      'Refresh reloads the queue. Export CSV / Export JSON download the current tab + search filter. Create Sales Order opens the new-order form (write permission required). Tour restarts this walkthrough.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'sales-orders-kpis',
    target: T('sales-orders-kpis'),
    title: 'Order metrics',
    content:
      'Three cards: Total Orders (filtered count), Active / Dispatched (Processing, Partially Shipped, Shipped), and Completed Revenue (sum of Completed grand totals).',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'sales-orders-tabs',
    target: T('sales-orders-status-tabs'),
    title: 'Status tabs',
    content:
      'Triage by status: All Orders, Approved, Processing, Completed, Pending, On Hold, Cancelled. Each tab filters the table and resets to page 1.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'sales-orders-search',
    target: T('sales-orders-search'),
    title: 'Search',
    content:
      'Search by order number, client name, or notes. Debounced (~250ms) and combined with the active status tab.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'sales-orders-table',
    target: T('sales-orders-table'),
    title: 'Orders table columns',
    content:
      'Columns: Order #, Client, Issued, Delivery target, Delivery status, Total, Status, Actions. Click a row or Open to view detail. Delete appears only for Draft orders when you have delete permission.',
    before: async () => {
      await ensureList();
      await wait(300);
      if (!hasSalesOrderRow()) {
        jumpTo('sales-orders-create-btn');
      }
    },
  }),

  step({
    id: 'sales-orders-pagination',
    target: T('sales-orders-pagination'),
    title: 'Pagination',
    content:
      'Lists paginate at 20 orders per page. Soft-skipped when there is only one page (or an empty list).',
    before: async () => {
      await ensureList();
      await waitForSelector(T('sales-orders-pagination'), 2500);
    },
  }),

  step({
    id: 'sales-orders-create-btn',
    target: T('sales-orders-create-btn'),
    title: 'Create Sales Order',
    content:
      'Starts a new order. Next opens the create form and explains every section. Soft-skipped without write access.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('sales-orders-create-btn'), 2500);
    },
  }),

  // ——— Create ———
  step({
    id: 'sales-orders-create-welcome',
    target: T('sales-orders-create-form'),
    title: 'New Sales Order form',
    content:
      'Fill order & client details, addresses, catalogue / line items, financial summary, and notes. Header Save and footer Create Sales Order both submit. We will not save during the tour.',
    skipBeacon: true,
    before: async () => {
      await ensureCreateOrSkip();
    },
  }),

  step({
    id: 'sales-orders-create-order-client',
    target: T('sales-orders-create-order-client'),
    title: 'Order & client details',
    content:
      'Required: Order number, Client account, Generated by, Status, Destination state. Also: Project, Issue date, Target delivery, Tax mode (CGST+SGST vs IGST from company vs destination state). + New Source and + Add State open settings modals.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('sales-orders-create-order-client'), 4000);
    },
  }),

  step({
    id: 'sales-orders-create-addresses',
    target: T('sales-orders-create-addresses'),
    title: 'Address details',
    content:
      'Billing and shipping addresses auto-fill when you pick a client. Edit freely before save (max 1000 chars each).',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('sales-orders-create-addresses'), 4000);
    },
  }),

  step({
    id: 'sales-orders-create-catalog',
    target: T('sales-orders-create-catalog'),
    title: 'Product catalogue',
    content:
      'Pick a catalogue product to add a priced line, or use Add item for a blank row you fill manually.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('sales-orders-create-catalog'), 4000);
    },
  }),

  step({
    id: 'sales-orders-create-lines',
    target: T('sales-orders-create-lines'),
    title: 'Line items',
    content:
      'Columns: Description *, SKU, Qty *, Rate *, Tax %, Amount, delete. Use Add line for more rows. At least one valid line is required to create.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('sales-orders-create-lines'), 4000);
    },
  }),

  step({
    id: 'sales-orders-create-totals',
    target: T('sales-orders-create-totals'),
    title: 'Financial summary',
    content:
      'Discount type (Percent % / Amount ₹), discount value, shipping charge (auto from destination state; Reset to auto shipping if overridden). Live Subtotal, Discount, Tax, Shipping, Grand total. Free shipping may apply above the threshold.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('sales-orders-create-totals'), 4000);
    },
  }),

  step({
    id: 'sales-orders-create-actions',
    target: T('sales-orders-create-actions'),
    title: 'Notes & submit',
    content:
      'Optional notes (max 2000). Cancel returns to the list. Create Sales Order validates and saves — we skip saving on the tour. Next opens a sample order detail.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('sales-orders-create-actions'), 4000);
    },
  }),

  // ——— Detail — open once, then stay ———
  step({
    id: 'sales-orders-open-detail',
    target: T('sales-orders-detail'),
    title: 'Sales order detail',
    content:
      'Header shows order number, status, delivery status, client/project, issue & target dates, plus Grand total, Shipping, and linked Invoice when generated.',
    skipBeacon: true,
    before: async () => {
      if (!(await openFirstSalesOrderOrSkip())) return;
    },
  }),

  step({
    id: 'sales-orders-detail-actions',
    target: T('sales-orders-detail-actions'),
    title: 'Fulfilment actions',
    content:
      'Status- and permission-gated: Email order status, Email RMA status, Reserve stock, Add shipment, Request RMA, Generate / Open invoice, Cancel order, Delete (Draft only). Soft-skips buttons hidden for this order.',
    before: async () => {
      if (!(await guardSalesOrderDetail())) return;
      await waitForSelector(T('sales-orders-detail-actions'), 4000);
    },
  }),

  step({
    id: 'sales-orders-detail-order-info',
    target: T('sales-orders-detail-order-info'),
    title: 'Order details',
    content:
      'Generated by, Destination state, Stock reservation state, Billing / Shipping addresses, Notes, and Cancellation reason when cancelled.',
    before: async () => {
      if (!(await guardSalesOrderDetail())) return;
      await waitForSelector(T('sales-orders-detail-order-info'), 4000);
    },
  }),

  step({
    id: 'sales-orders-detail-lines',
    target: T('sales-orders-detail-lines'),
    title: 'Line items & totals',
    content:
      'Description, SKU, Qty, Shipped, Returned, Rate, Tax %, Amount — plus footer Subtotal, Discount, Tax, Grand total. Shipped / Returned drive remaining dispatch and RMA qty.',
    before: async () => {
      if (!(await guardSalesOrderDetail())) return;
      await waitForSelector(T('sales-orders-detail-lines'), 4000);
    },
  }),

  step({
    id: 'sales-orders-detail-shipments',
    target: T('sales-orders-detail-shipments'),
    title: 'Shipments',
    content:
      'Each package shows shipment #, courier, AWB, weight, status, POD, and line quantities. Confirm delivery opens a POD modal for undelivered packages. Empty until you Add shipment.',
    before: async () => {
      if (!(await guardSalesOrderDetail())) return;
      await waitForSelector(T('sales-orders-detail-shipments'), 4000);
    },
  }),

  step({
    id: 'sales-orders-detail-rma',
    target: T('sales-orders-detail-rma'),
    title: 'Returns / RMA',
    content:
      'RMA cards show type (Return & refund / Defect replacement), status workflow buttons, refund amount, reason, Email, and replacement order link when applicable.',
    before: async () => {
      if (!(await guardSalesOrderDetail())) return;
      await waitForSelector(T('sales-orders-detail-rma'), 4000);
    },
  }),

  step({
    id: 'sales-orders-detail-stock-audit',
    target: T('sales-orders-detail-stock-audit'),
    title: 'Stock audit',
    content:
      'Chronological log of reserve, dispatch, delivery, RMA, and inventory actions with actor and timestamp.',
    before: async () => {
      if (!(await guardSalesOrderDetail())) return;
      await waitForSelector(T('sales-orders-detail-stock-audit'), 4000);
    },
  }),

  step({
    id: 'sales-orders-finish',
    target: T('sales-orders-tour-landing'),
    title: 'Next: Invoices',
    content:
      'You have seen list metrics & tabs, create fields, and detail fulfilment (ship, RMA, invoice). Sales orders often become invoices via Generate invoice. Click Go to Invoices to continue there.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/sales-orders');
      requestSalesOrdersTourTab('All Orders');
    },
  }),
];
