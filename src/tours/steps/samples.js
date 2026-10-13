/**
 * Sample Requests Beacon onboarding — list + create form (no detail route).
 * Tour-only; does not approve/dispatch/save samples.
 * Soft-skips missing targets (empty list, RBAC-blocked create, pagination).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestSamplesTourJump,
} from '../samplesTourState.js';

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
  if (prefix === '/samples' && path === '/samples') {
    await waitForSelector(T('samples-tour-landing'), 8000);
    return;
  }
  if (prefix === '/samples/create' && path.startsWith('/samples/create')) {
    await waitForSelector(T('samples-create-form'), 8000);
    return;
  }

  requestTourNavigate(prefix);
  await wait(400);
  if (prefix === '/samples') await waitForSelector(T('samples-tour-landing'), 10000);
  else await waitForSelector(T('samples-create-form'), 10000);
}

async function ensureList() {
  await ensurePath('/samples');
  await wait(250);
  await waitForSelector(T('samples-table'), 5000);
}

function jumpTo(stepId) {
  const jumpIdx = samplesTourSteps.findIndex((s) => s.id === stepId);
  if (jumpIdx >= 0) requestSamplesTourJump({ stepIndex: jumpIdx });
}

async function ensureCreateOrSkip() {
  if (currentPath().startsWith('/samples/create')) {
    const form = await waitForSelector(T('samples-create-form'), 5000);
    return Boolean(form);
  }
  await ensureList();
  const btn = await waitForSelector(T('samples-create-btn'), 2000);
  if (!btn) {
    jumpTo('samples-finish');
    return false;
  }
  await ensurePath('/samples/create');
  const form = await waitForSelector(T('samples-create-form'), 5000);
  if (!form) {
    jumpTo('samples-finish');
    return false;
  }
  return true;
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

export const samplesTourSteps = [
  // ——— List ———
  step({
    id: 'samples-welcome',
    target: T('samples-title'),
    title: 'Sample Requests',
    content:
      'Manage the sampling lifecycle from request → approval → dispatch → delivery → customer review. Click Next to walk through the list, then the New Sample form.',
    skipBeacon: true,
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'samples-header-actions',
    target: T('samples-header-actions'),
    title: 'List toolbar',
    content:
      'Export downloads the filtered list as CSV or JSON. New Sample opens the create form. Tour restarts this walkthrough anytime.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'samples-filters',
    target: T('samples-filters'),
    title: 'Search & status filter',
    content:
      'Search by sample #, product, account, or AWB. Filter by status (Requested → Completed, Rejected, etc.). Reset clears filters; Refresh reloads the queue.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'samples-table',
    target: T('samples-table'),
    title: 'Table columns',
    content:
      'Columns: Sample (# + created date), Product & Qty, Urgency, Status, Prospect / Client, Courier & AWB, Client Review, Actions. There is no separate detail page — work from row actions.',
    before: async () => {
      await ensureList();
      await wait(300);
    },
  }),

  step({
    id: 'samples-row-actions',
    target: T('samples-row-actions-first'),
    title: 'Row actions by status',
    content:
      'Requested: Approve / Reject (approve permission). Approved or Preparing: Dispatch. Dispatched: mark Delivered. Delivered / Completed: Give Review or View Review. Soft-skipped when the list is empty.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('samples-row-actions-first'), 2500);
    },
  }),

  step({
    id: 'samples-pagination',
    target: T('samples-pagination'),
    title: 'Pagination',
    content:
      'Lists paginate at 20 samples per page. Soft-skipped when there is only one page (or an empty list).',
    before: async () => {
      await ensureList();
      await waitForSelector(T('samples-pagination'), 2500);
    },
  }),

  step({
    id: 'samples-create-btn',
    target: T('samples-create-btn'),
    title: 'New Sample',
    content:
      'Starts a new sample request. Next opens the form and explains every section. Soft-skipped without create access.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('samples-create-btn'), 2500);
    },
  }),

  // ——— Create ———
  step({
    id: 'samples-create-welcome',
    target: T('samples-create-form'),
    title: 'New Sample Request form',
    content:
      'Four sections on the left plus a live Request Overview sidebar. We will not submit during the tour — Cancel returns to the list.',
    skipBeacon: true,
    before: async () => {
      await ensureCreateOrSkip();
    },
  }),

  step({
    id: 'samples-create-recipient',
    target: T('samples-create-recipient'),
    title: '1. Target Recipient & Account',
    content:
      'Toggle Prospective Lead or Client Account, then pick the record. Contact and address preview appear; Copy Address to Shipping fills the delivery field.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('samples-create-recipient'), 4000);
    },
  }),

  step({
    id: 'samples-create-product',
    target: T('samples-create-product'),
    title: '2. Product & Sample Specifications',
    content:
      'Quick-fill presets, Product / Item Name *, Quantity * (± steppers), and Unit of Measure (pcs, kg, etc.).',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('samples-create-product'), 4000);
    },
  }),

  step({
    id: 'samples-create-urgency',
    target: T('samples-create-urgency'),
    title: '3. Dispatch Urgency & Priority SLA',
    content:
      'Choose Low, Normal, High, or Urgent. The selected SLA shows on the Request Overview badge.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('samples-create-urgency'), 4000);
    },
  }),

  step({
    id: 'samples-create-delivery',
    target: T('samples-create-delivery'),
    title: '4. Delivery Address & Instructions',
    content:
      'Shipping / Delivery Address (max 1000) and Technical Requirements & Notes (max 2000) for warehouse and lab guidance.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('samples-create-delivery'), 4000);
    },
  }),

  step({
    id: 'samples-create-overview',
    target: T('samples-create-overview'),
    title: 'Request Overview',
    content:
      'Live summary of recipient, sample item, quantity, destination, and urgency SLA as you fill the form.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('samples-create-overview'), 4000);
    },
  }),

  step({
    id: 'samples-create-checklist',
    target: T('samples-create-checklist'),
    title: 'Validation Checklist',
    content:
      'Green checks when linked record, product name, and quantity > 0 are valid. Red items must be fixed before Submit Request.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('samples-create-checklist'), 4000);
    },
  }),

  step({
    id: 'samples-create-next',
    target: T('samples-create-next'),
    title: 'What happens next?',
    content:
      'After submit: manager review & stock approval → warehouse dispatch with AWB → customer reviews quality & order intent from the list.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('samples-create-next'), 4000);
    },
  }),

  step({
    id: 'samples-create-actions',
    target: T('samples-create-actions'),
    title: 'Cancel & Submit',
    content:
      'Cancel returns to Sample Requests. Submit Request creates the record as Requested — we skip saving on the tour.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('samples-create-actions'), 4000);
    },
  }),

  step({
    id: 'samples-finish',
    target: T('samples-tour-landing'),
    title: 'You are set',
    content:
      'You have seen list filters & columns, row workflow actions, and every create-form field. Click Finish when ready.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/samples');
    },
  }),
];
