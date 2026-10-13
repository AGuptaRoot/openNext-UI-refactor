/**
 * Audit History Beacon onboarding — filters → table → pagination → Finish.
 * Tour-only; does not mutate CRM data (audit is read-only).
 * Soft-skips missing targets (empty list).
 */
import {
  requestTourNavigate,
  waitForSelector,
} from '../auditTourState.js';

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
  if (path === '/audit' || path.startsWith('/audit')) {
    await waitForSelector(T('audit-tour-landing'), 8000);
    return;
  }
  requestTourNavigate('/audit');
  await wait(400);
  await waitForSelector(T('audit-tour-landing'), 10000);
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

export const auditTourSteps = [
  step({
    id: 'audit-welcome',
    target: T('audit-title'),
    title: 'Audit History',
    content:
      'Review immutable activity across CRM records and settings. Click Next to walk through filters, the activity table, and pagination.',
    skipBeacon: true,
    before: async () => {
      await ensurePath();
    },
  }),

  step({
    id: 'audit-header-actions',
    target: T('audit-header-actions'),
    title: 'Toolbar',
    content:
      'Tour restarts this walkthrough anytime. Audit entries are read-only — there is no create or edit here.',
    before: async () => {
      await ensurePath();
    },
  }),

  step({
    id: 'audit-filters',
    target: T('audit-filters'),
    title: 'Search & filters',
    content:
      'Search by actor, action, record, or description. Filter by record type (Lead, Client, Project, Invoice, Settings, and more). Apply filters runs the query; Refresh reloads the current page.',
    before: async () => {
      await ensurePath();
      await waitForSelector(T('audit-filters'), 4000);
    },
  }),

  step({
    id: 'audit-search',
    target: T('audit-search'),
    title: 'Search box',
    content:
      'Type keywords then click Apply filters (or press Enter) to narrow the audit log.',
    before: async () => {
      await ensurePath();
      await waitForSelector(T('audit-search'), 4000);
    },
  }),

  step({
    id: 'audit-record-type',
    target: T('audit-record-type'),
    title: 'Record type',
    content:
      'Limit results to a module — e.g. lead, client, task, quotation, invoice, payment, expense, or settings.',
    before: async () => {
      await ensurePath();
      await waitForSelector(T('audit-record-type'), 4000);
    },
  }),

  step({
    id: 'audit-table',
    target: T('audit-table'),
    title: 'Activity table',
    content:
      'Columns: Time, Actor, Type (module), Action, Record, and Details. Soft-skipped when no entries match.',
    before: async () => {
      await ensurePath();
      await wait(300);
      await waitForSelector(T('audit-table'), 5000);
    },
  }),

  step({
    id: 'audit-pagination',
    target: T('audit-pagination'),
    title: 'Pagination',
    content:
      'Entry count, Previous / Next controls, and current page. Use these to page through large audit histories.',
    before: async () => {
      await ensurePath();
      await waitForSelector(T('audit-pagination'), 4000);
    },
  }),

  step({
    id: 'audit-finish',
    target: T('audit-tour-landing'),
    title: 'You are set',
    content:
      'You can search and filter immutable CRM activity here. Click Finish when ready.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath();
    },
  }),
];
