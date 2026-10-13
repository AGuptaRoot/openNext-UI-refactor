/**
 * Customer Success Beacon onboarding — single page (Account Health + CSAT Wall + modal).
 * Tour-only; does not submit CSAT reviews or mutate CRM data.
 * Soft-skips missing targets (empty lists, RBAC-hidden controls).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestCustomerSuccessTourTab,
  requestCustomerSuccessTourModal,
  requestCustomerSuccessTourJump,
} from '../customerSuccessTourState.js';

const T = (id) => `[data-tour="${id}"]`;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function currentPath() {
  const hash = String(window.location.hash || '');
  return hash.replace(/^#/, '').split('?')[0] || '/';
}

async function ensurePath() {
  const path = currentPath();
  if (path === '/customer-success' || path.startsWith('/customer-success')) {
    await waitForSelector(T('cs-tour-landing'), 8000);
    return;
  }
  requestTourNavigate('/customer-success');
  await wait(400);
  await waitForSelector(T('cs-tour-landing'), 10000);
}

async function ensureAccountsTab() {
  await ensurePath();
  requestCustomerSuccessTourModal({ open: false });
  requestCustomerSuccessTourTab('accounts');
  await wait(300);
  await waitForSelector(T('cs-accounts-table'), 5000);
}

async function ensureReviewsTab() {
  await ensurePath();
  requestCustomerSuccessTourModal({ open: false });
  requestCustomerSuccessTourTab('reviews');
  await wait(350);
  await waitForSelector(T('cs-reviews-panel'), 5000);
}

async function ensureModalStep(step) {
  await ensurePath();
  requestCustomerSuccessTourModal({ open: true, step });
  await wait(350);
  await waitForSelector(T('cs-csat-modal'), 5000);
}

function jumpTo(stepId) {
  const jumpIdx = customerSuccessTourSteps.findIndex((s) => s.id === stepId);
  if (jumpIdx >= 0) requestCustomerSuccessTourJump({ stepIndex: jumpIdx });
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

export const customerSuccessTourSteps = [
  step({
    id: 'cs-welcome',
    target: T('cs-title'),
    title: 'Customer Success',
    content:
      'Track account health scores to prevent churn and capture CSAT feedback. Click Next to walk through KPIs, Account Health, CSAT Wall, and the review form.',
    skipBeacon: true,
    before: async () => {
      await ensureAccountsTab();
    },
  }),

  step({
    id: 'cs-header-actions',
    target: T('cs-header-actions'),
    title: 'List toolbar',
    content:
      'Export downloads account health as CSV or JSON. Submit CSAT Review opens the feedback wizard. Tour restarts this walkthrough.',
    before: async () => {
      await ensureAccountsTab();
    },
  }),

  step({
    id: 'cs-kpis',
    target: T('cs-kpis'),
    title: 'Portfolio KPIs',
    content:
      'Four cards: Healthy Accounts, At Risk, Critical Risk, and Average CSAT — spot retention risk and satisfaction at a glance.',
    before: async () => {
      await ensureAccountsTab();
    },
  }),

  step({
    id: 'cs-tabs',
    target: T('cs-tabs'),
    title: 'Account Health | CSAT Wall',
    content:
      'Account Health lists scored accounts with recommended actions. CSAT Wall shows rating breakdown and Wall of Love highlights.',
    before: async () => {
      await ensureAccountsTab();
    },
  }),

  step({
    id: 'cs-filters',
    target: T('cs-filters'),
    title: 'Search & health filter',
    content:
      'Search accounts by name. Filter by Healthy (75–100), At Risk (50–74), or Critical (< 50). Refresh reloads the portfolio.',
    before: async () => {
      await ensureAccountsTab();
    },
  }),

  step({
    id: 'cs-accounts-table',
    target: T('cs-accounts-table'),
    title: 'Account Health table',
    content:
      'Columns: Account, Health Score, Orders, Avg CSAT, Open Tickets, Overdue Invoices, and Recommended Action. Soft-skipped when empty.',
    before: async () => {
      await ensureAccountsTab();
      await wait(300);
    },
  }),

  step({
    id: 'cs-submit-btn',
    target: T('cs-submit-btn'),
    title: 'Submit CSAT Review',
    content:
      'Opens a 3-step wizard: choose account, rate stars, add category & comments. Next opens the form — we will not submit during the tour.',
    before: async () => {
      await ensureAccountsTab();
      await waitForSelector(T('cs-submit-btn'), 2500);
    },
  }),

  step({
    id: 'cs-modal-welcome',
    target: T('cs-csat-modal'),
    title: 'CSAT review wizard',
    content:
      'Three steps with a progress bar. Staff pick a client; clients review their own locked profile. Tour will not save feedback.',
    skipBeacon: true,
    before: async () => {
      await ensureModalStep(1);
      const modal = await waitForSelector(T('cs-csat-modal'), 4000);
      if (!modal) jumpTo('cs-reviews-welcome');
    },
  }),

  step({
    id: 'cs-modal-client',
    target: T('cs-modal-client'),
    title: '1. Select account',
    content:
      'Staff search and select a client. Clients see their locked profile card and cannot switch accounts.',
    before: async () => {
      await ensureModalStep(1);
      await waitForSelector(T('cs-modal-client'), 4000);
    },
  }),

  step({
    id: 'cs-modal-rating',
    target: T('cs-modal-rating'),
    title: '2. Star rating',
    content:
      'Rate 1–5 stars. Labels range from Terrible to Excellent. Continue advances only after a rating — the tour shows this step without requiring clicks.',
    before: async () => {
      await ensureModalStep(2);
      await waitForSelector(T('cs-modal-rating'), 4000);
    },
  }),

  step({
    id: 'cs-modal-details',
    target: T('cs-modal-details'),
    title: '3. Category & comments',
    content:
      'Pick a category (Product Quality, Delivery, Service, Pricing, General) and optional comments. Soft-skipped if the modal is blocked.',
    before: async () => {
      await ensureModalStep(3);
      await waitForSelector(T('cs-modal-details'), 4000);
    },
  }),

  step({
    id: 'cs-modal-actions',
    target: T('cs-modal-actions'),
    title: 'Back & Submit',
    content:
      'Back returns to the previous step. Submit Review saves CSAT — we skip saving on the tour and close the modal next.',
    before: async () => {
      await ensureModalStep(3);
      await waitForSelector(T('cs-modal-actions'), 4000);
    },
  }),

  step({
    id: 'cs-reviews-welcome',
    target: T('cs-reviews-panel'),
    title: 'CSAT Wall',
    content:
      'Satisfaction storytelling: rating distribution on the left and Wall of Love cards on the right.',
    skipBeacon: true,
    before: async () => {
      await ensureReviewsTab();
    },
  }),

  step({
    id: 'cs-rating-breakdown',
    target: T('cs-rating-breakdown'),
    title: 'Rating Breakdown',
    content:
      'Average CSAT and the 5★–1★ distribution bars for the current review set.',
    before: async () => {
      await ensureReviewsTab();
      await waitForSelector(T('cs-rating-breakdown'), 4000);
    },
  }),

  step({
    id: 'cs-wall-of-love',
    target: T('cs-wall-of-love'),
    title: 'Wall of Love',
    content:
      'Recent CSAT cards with stars, category, date, and quotes. Soft-skipped when there are no reviews yet.',
    before: async () => {
      await ensureReviewsTab();
      await waitForSelector(T('cs-wall-of-love'), 4000);
    },
  }),

  step({
    id: 'cs-finish',
    target: T('cs-tour-landing'),
    title: 'You are set',
    content:
      'You have seen health KPIs, the accounts table, the CSAT wizard, and the CSAT Wall. Click Finish when ready.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      requestCustomerSuccessTourModal({ open: false });
      await ensureAccountsTab();
    },
  }),
];
