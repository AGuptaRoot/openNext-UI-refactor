/**
 * Expenses Beacon onboarding — list, create, detail, recurring → Projects.
 * Tour-only; does not change expense APIs or save/submit/approve logic.
 * Soft-skips missing targets (empty list, RBAC-hidden buttons).
 * Detail phase: open first expense once, then stay on detail (no list↔detail remount per step).
 *
 * Also noted in-tour: categories are managed in Settings; billable expenses
 * can be imported into Invoices; Project detail has an Expenses tab.
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestExpensesArchiveView,
  requestExpensesTourTab,
  requestExpensesTourJump,
  firstExpenseDetailPath,
} from '../expensesTourState.js';

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
  if (prefix === '/expenses' && path === '/expenses') return;
  if (prefix === '/expenses/create' && path.startsWith('/expenses/create')) return;
  if (prefix.startsWith('/expenses/') && path.startsWith(prefix)) return;

  requestTourNavigate(prefix);
  await wait(400);
  if (prefix === '/expenses') await waitForSelector(T('expenses-tour-landing'), 10000);
  else if (prefix === '/expenses/create') await waitForSelector(T('expenses-create-form'), 10000);
  else await waitForSelector(T('expenses-detail'), 10000);
}

async function ensureExpensesTab() {
  await ensurePath('/expenses');
  requestExpensesTourTab('expenses');
  await wait(350);
  await waitForSelector(T('expenses-table'), 5000);
}

async function ensureRecurringTab() {
  await ensurePath('/expenses');
  requestExpensesTourTab('recurring');
  await wait(400);
  await waitForSelector(T('expenses-recurring-toolbar'), 5000);
}

function hasExpenseRow() {
  return Boolean(document.querySelector(T('expenses-row-first')));
}

function isOnExpenseDetailPath() {
  const path = currentPath();
  return (
    path.startsWith('/expenses/') &&
    !path.startsWith('/expenses/create') &&
    path !== '/expenses'
  );
}

function skipExpenseDetailSteps() {
  const jumpIdx = expensesTourSteps.findIndex((s) => s.id === 'expenses-recurring-tab');
  if (jumpIdx >= 0) requestExpensesTourJump({ stepIndex: jumpIdx });
}

async function openFirstExpenseOrSkip() {
  if (isOnExpenseDetailPath()) {
    const detail = await waitForSelector(T('expenses-detail'), 10000);
    return Boolean(detail);
  }
  await ensureExpensesTab();
  requestExpensesArchiveView('active');
  await wait(400);
  await waitForSelector(T('expenses-table'), 5000);
  if (!hasExpenseRow()) {
    skipExpenseDetailSteps();
    return false;
  }
  const detailPath = firstExpenseDetailPath();
  if (!detailPath) {
    skipExpenseDetailSteps();
    return false;
  }
  requestTourNavigate(detailPath);
  await waitForSelector(T('expenses-detail'), 10000);
  return Boolean(document.querySelector(T('expenses-detail')));
}

/** Stay on detail — no list↔detail remount on every step. */
async function guardExpenseDetail() {
  if (document.querySelector(T('expenses-detail'))) return true;
  if (isOnExpenseDetailPath()) {
    await waitForSelector(T('expenses-detail'), 10000);
    if (document.querySelector(T('expenses-detail'))) return true;
  }
  return openFirstExpenseOrSkip();
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

export const expensesTourSteps = [
  step({
    id: 'expenses-welcome',
    target: T('expenses-title'),
    title: 'Expenses module',
    content:
      'Capture claims, run approvals, mark billables, archive history, and automate recurring spend. Click Next to walk through every feature.',
    skipBeacon: true,
    before: async () => {
      await ensureExpensesTab();
      requestExpensesArchiveView('active');
    },
  }),

  step({
    id: 'expenses-main-tabs',
    target: T('expenses-main-tabs'),
    title: 'Expenses | Recurring Expenses',
    content:
      'Two main tabs: Expenses (one-off claims) and Recurring Expenses (schedules that auto-generate claims for rent, SaaS, utilities).',
    before: async () => {
      await ensureExpensesTab();
    },
  }),

  step({
    id: 'expenses-base-currency',
    target: T('expenses-base-currency'),
    title: 'Base-currency total',
    content:
      'Quick INR total for the current filtered page. Multi-currency claims are converted using each row’s exchange rate.',
    before: async () => {
      await ensureExpensesTab();
    },
  }),

  step({
    id: 'expenses-archive-toggle',
    target: T('expenses-archive-toggle'),
    title: 'Active vs Archived',
    content:
      'Active Expenses is the working list. Archived holds approved claims moved out of the pipeline (Restore brings them back). Next opens Archived briefly.',
    before: async () => {
      await ensureExpensesTab();
      requestExpensesArchiveView('active');
      await wait(200);
    },
  }),

  step({
    id: 'expenses-archived-view',
    target: T('expenses-table'),
    title: 'Archived expenses',
    content:
      'Only Approved expenses can be archived. From Archived you can Open or Restore. Delete is only for Drafts on the Active list.',
    before: async () => {
      await ensureExpensesTab();
      requestExpensesArchiveView('archived');
      await wait(500);
      await waitForSelector(T('expenses-table'), 4000);
    },
  }),

  step({
    id: 'expenses-create-btn',
    target: T('expenses-create-btn'),
    title: 'Create Expense',
    content: 'Starts a new claim. You can also open Create from a Project’s Expenses tab (pre-fills project).',
    before: async () => {
      await ensureExpensesTab();
      requestExpensesArchiveView('active');
      await wait(200);
    },
  }),

  step({
    id: 'expenses-filters',
    target: T('expenses-filters'),
    title: 'Search, filters & export',
    content:
      'Search by item, expense no, claimant, or vendor. Filter Status (Draft → Rejected) and Category. Reset clears filters. Refresh reloads. Export CSV/JSON downloads the filtered list.',
    before: async () => {
      await ensureExpensesTab();
      requestExpensesArchiveView('active');
    },
  }),

  step({
    id: 'expenses-table',
    target: T('expenses-table'),
    title: 'Expenses table & row actions',
    content:
      'Columns: Expense No, Item, Category, Date, Claimant, Vendor, Amount, Status, Billable, Actions. Row actions depend on status: Draft → Edit/Submit/Delete; Submitted → Approve/Reject (approvers); Approved → Archive; Rejected → Edit/Submit. “✓ Billed” means already pulled into an invoice.',
    before: async () => {
      await ensureExpensesTab();
      requestExpensesArchiveView('active');
      await wait(200);
      // Empty list — skip table highlight; continue at create form
      if (!hasExpenseRow()) {
        const jumpIdx = expensesTourSteps.findIndex((s) => s.id === 'expenses-create-welcome');
        if (jumpIdx >= 0) requestExpensesTourJump({ stepIndex: jumpIdx });
      }
    },
  }),

  // ——— Create ———
  step({
    id: 'expenses-create-welcome',
    target: T('expenses-create-form'),
    title: 'New Expense form',
    content:
      'Three sections: Item & Purchase, Allocation & Payment, Bill Receipt & Description. Save as Draft or Save & Submit for Approval. We skip saving during the tour.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/expenses/create');
    },
  }),

  step({
    id: 'expenses-create-item',
    target: T('expenses-create-item'),
    title: 'Item & Purchase Details',
    content:
      'Required: Item name*, Category*, Price*, Currency*, Exchange rate*, Purchase date*. Optional vendor and Billable checkbox (client-reimbursable / importable to invoices).',
    before: async () => {
      await ensurePath('/expenses/create');
    },
  }),

  step({
    id: 'expenses-create-allocation',
    target: T('expenses-create-allocation'),
    title: 'Allocation & Payment Source',
    content:
      'Assign Employee/claimant, optional Project and Client (job costing), and Payment mode (Cash, UPI, Card, etc.).',
    before: async () => {
      await ensurePath('/expenses/create');
    },
  }),

  step({
    id: 'expenses-create-receipt',
    target: T('expenses-create-receipt'),
    title: 'Bill Receipt & Description',
    content:
      'Upload a receipt (PDF/image/DOC, max 5 MB) for audit. Add business justification in Description.',
    before: async () => {
      await ensurePath('/expenses/create');
    },
  }),

  step({
    id: 'expenses-create-actions',
    target: T('expenses-create-actions'),
    title: 'Save actions',
    content:
      'Cancel returns to the list. Save as Draft keeps it editable. Save & Submit for Approval sends it to approvers (crm.expenses.approve).',
    before: async () => {
      await ensurePath('/expenses/create');
    },
  }),

  // ——— Detail — open once, then stay ———
  step({
    id: 'expenses-detail',
    target: T('expenses-detail'),
    title: 'Expense detail',
    content:
      'Status badges (and Archived / Billed). Overview shows purchase & allocation; Timeline shows Created → Submitted → Approved/Rejected plus receipt link.',
    skipBeacon: true,
    before: async () => {
      if (!(await openFirstExpenseOrSkip())) return;
    },
  }),

  step({
    id: 'expenses-detail-actions',
    target: T('expenses-detail-actions'),
    title: 'Detail lifecycle buttons',
    content:
      'Edit / Save (Draft/Rejected) · Submit · Approve / Reject · Archive (Approved) · Restore · Delete (Draft). Visibility depends on status and permissions.',
    before: async () => {
      if (!(await guardExpenseDetail())) return;
    },
  }),

  step({
    id: 'expenses-detail-sections',
    target: T('expenses-detail-sections'),
    title: 'Overview & Timeline',
    content:
      'Not a tab strip — two panels. Overview: item, amount, category, vendor, claimant, billable, project/client links. Timeline: workflow timestamps, Open attachment, and billed invoice link when applicable.',
    before: async () => {
      if (!(await guardExpenseDetail())) return;
    },
  }),

  // ——— Recurring ———
  step({
    id: 'expenses-recurring-tab',
    target: T('expenses-tab-recurring'),
    title: 'Recurring Expenses tab',
    content:
      'Automate repeated spend (rent, SaaS, retainers). Schedules generate expense claims on Next Run — separate from invoice Recurring Profiles.',
    before: async () => {
      await ensurePath('/expenses');
      requestExpensesTourTab('expenses');
      await wait(200);
    },
  }),

  step({
    id: 'expenses-recurring-explain',
    target: T('expenses-recurring-toolbar'),
    title: 'How recurring expenses work',
    content:
      'Create a schedule with frequency, end condition (never / cycles / date), amount, and optional project/billable. The system generates expense records on cadence. Run Due Now processes all due profiles; Run Now does one. Pause stops future runs; Logs show success/failure; Upcoming Forecast projects spend for 30–365 days.',
    skipBeacon: true,
    before: async () => {
      await ensureRecurringTab();
    },
  }),

  step({
    id: 'expenses-recurring-toolbar',
    target: T('expenses-recurring-toolbar'),
    title: 'Recurring toolbar',
    content:
      'New Schedule opens the create-profile form. Run Due Now generates all due claims. Upcoming Forecast opens the projection modal. Refresh reloads profiles.',
    before: async () => {
      await ensureRecurringTab();
    },
  }),

  step({
    id: 'expenses-recurring-table',
    target: T('expenses-recurring-table'),
    title: 'Recurring profiles table',
    content:
      'Columns: Profile, Item, Vendor, Category, Amount, Frequency, Next Run, Cycles, Status (Active/Paused/Completed). Actions: Run Now, Pause/Resume, Logs, Delete.',
    before: async () => {
      await ensureRecurringTab();
      await wait(200);
    },
  }),

  // ——— Missed features note + handoff ———
  step({
    id: 'expenses-extras',
    target: T('expenses-tour-landing'),
    title: 'Also worth knowing',
    content:
      'Categories are administered under Settings → Expense Classification. Billable expenses can be imported when creating Invoices. Project detail has an Expenses tab (+ Add Expense). Dashboard shows pending approval claims. Reports → Income/Expense can deep-link here with status/category filters.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensureExpensesTab();
      requestExpensesArchiveView('active');
    },
  }),

  step({
    id: 'expenses-to-projects',
    target: T('expenses-tour-landing'),
    title: 'Next: Projects',
    content:
      'You have seen list tabs, filters, create form, detail buttons, archive, and recurring schedules. Click “Go to Projects” to continue.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensureExpensesTab();
    },
  }),
];
