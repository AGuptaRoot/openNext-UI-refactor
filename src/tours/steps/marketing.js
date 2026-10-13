/**
 * Marketing Automation Beacon onboarding — Campaigns → Create modal → Analytics → Finish.
 * Tour-only; does not create/run/delete campaigns or send test emails.
 * Soft-skips missing targets (empty lists, empty approval queue).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestMarketingTourTab,
  requestMarketingTourCreateModal,
  requestMarketingTourJump,
} from '../marketingTourState.js';

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
  if (path === '/marketing' || path.startsWith('/marketing')) {
    await waitForSelector(T('mkt-tour-landing'), 8000);
    return;
  }
  requestTourNavigate('/marketing');
  await wait(400);
  await waitForSelector(T('mkt-tour-landing'), 10000);
}

async function ensureCampaignsTab() {
  await ensurePath();
  requestMarketingTourCreateModal({ open: false });
  requestMarketingTourTab('campaigns');
  await wait(300);
  await waitForSelector(T('mkt-campaigns-table'), 5000);
}

async function ensureAnalyticsTab() {
  await ensurePath();
  requestMarketingTourCreateModal({ open: false });
  requestMarketingTourTab('analytics');
  await wait(350);
  await waitForSelector(T('mkt-analytics-panel'), 5000);
}

async function ensureCreateModal() {
  await ensurePath();
  requestMarketingTourCreateModal({ open: true });
  await wait(350);
  await waitForSelector(T('mkt-create-modal'), 5000);
}

function jumpTo(stepId) {
  const jumpIdx = marketingTourSteps.findIndex((s) => s.id === stepId);
  if (jumpIdx >= 0) requestMarketingTourJump({ stepIndex: jumpIdx });
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

export const marketingTourSteps = [
  step({
    id: 'mkt-welcome',
    target: T('mkt-title'),
    title: 'Marketing Automation',
    content:
      'Run drip campaigns, win-back workflows, and closed-loop ROI attribution. Click Next to walk through audiences, campaigns, create form, and analytics.',
    skipBeacon: true,
    before: async () => {
      await ensureCampaignsTab();
    },
  }),

  step({
    id: 'mkt-header-actions',
    target: T('mkt-header-actions'),
    title: 'List toolbar',
    content:
      'Export downloads campaign data as CSV or JSON. Create Campaign opens the drip builder. Tour restarts this walkthrough.',
    before: async () => {
      await ensureCampaignsTab();
    },
  }),

  step({
    id: 'mkt-audience-kpis',
    target: T('mkt-audience-kpis'),
    title: 'Audience segments',
    content:
      'Four pools: Lost Leads, Unqualified Leads, Dormant Clients (>90d), and All Contacts — the audiences campaigns can target.',
    before: async () => {
      await ensureCampaignsTab();
    },
  }),

  step({
    id: 'mkt-tabs',
    target: T('mkt-tabs'),
    title: 'Campaigns | Analytics',
    content:
      'Campaigns & Drips manages drip lists, approvals, and run actions. Analytics & ROI shows funnel, segment performance, and leaderboard.',
    before: async () => {
      await ensureCampaignsTab();
    },
  }),

  step({
    id: 'mkt-filters',
    target: T('mkt-filters'),
    title: 'Search & filters',
    content:
      'Search by campaign name or subject. Filter by Status (Draft, Active, Paused, Completed) and Type. Refresh reloads the list.',
    before: async () => {
      await ensureCampaignsTab();
    },
  }),

  step({
    id: 'mkt-approval-queue',
    target: T('mkt-approval-queue'),
    title: 'Re-engagement approvals',
    content:
      'When leads click win-back CTAs, managers approve or reject re-entry to the pipeline here. Soft-skipped when the queue is empty.',
    before: async () => {
      await ensureCampaignsTab();
      await waitForSelector(T('mkt-approval-queue'), 2000);
    },
  }),

  step({
    id: 'mkt-campaigns-table',
    target: T('mkt-campaigns-table'),
    title: 'Campaigns table',
    content:
      'Columns: Campaign & Subject, Channel Type, Target Segment, Status, Sent / Won-Back, and Actions (Win-Back, Test, Run, Delete). Soft-skipped when empty.',
    before: async () => {
      await ensureCampaignsTab();
      await wait(300);
    },
  }),

  step({
    id: 'mkt-activity-log',
    target: T('mkt-activity-log'),
    title: 'Pipeline re-entry log',
    content:
      'Recent stage moves from win-back campaigns (previous → new stage, revenue, timestamp). Soft-skipped when empty.',
    before: async () => {
      await ensureCampaignsTab();
      await waitForSelector(T('mkt-activity-log'), 4000);
    },
  }),

  step({
    id: 'mkt-create-btn',
    target: T('mkt-create-btn'),
    title: 'Create Campaign',
    content:
      'Opens the drip builder. Next shows the form — we will not save or run a campaign during the tour.',
    before: async () => {
      await ensureCampaignsTab();
      await waitForSelector(T('mkt-create-btn'), 2500);
    },
  }),

  step({
    id: 'mkt-create-modal',
    target: T('mkt-create-modal'),
    title: 'Create Marketing Campaign',
    content:
      'Define name, type, target segment, email subject/content (merge tags supported), and Draft or Active status. Tour will not submit.',
    skipBeacon: true,
    before: async () => {
      await ensureCreateModal();
      const modal = await waitForSelector(T('mkt-create-modal'), 4000);
      if (!modal) jumpTo('mkt-analytics-welcome');
    },
  }),

  step({
    id: 'mkt-create-form',
    target: T('mkt-create-form'),
    title: 'Campaign fields',
    content:
      'Required: Name, Type (Lost Lead Re-engagement, Repeat Business, Email Drip, Promotional), Segment, Subject, and Content. Soft-skipped if modal blocked.',
    before: async () => {
      await ensureCreateModal();
      await waitForSelector(T('mkt-create-form'), 4000);
    },
  }),

  step({
    id: 'mkt-create-actions',
    target: T('mkt-create-actions'),
    title: 'Cancel & Save',
    content:
      'Cancel closes without saving. Save Campaign creates a Draft or Active drip — we skip saving on the tour.',
    before: async () => {
      await ensureCreateModal();
      await waitForSelector(T('mkt-create-actions'), 4000);
    },
  }),

  step({
    id: 'mkt-analytics-welcome',
    target: T('mkt-analytics-panel'),
    title: 'Analytics & ROI',
    content:
      'Closed-loop attribution: dispatched emails, won-back contacts, conversion rate, and attributed revenue.',
    skipBeacon: true,
    before: async () => {
      await ensureAnalyticsTab();
    },
  }),

  step({
    id: 'mkt-analytics-kpis',
    target: T('mkt-analytics-kpis'),
    title: 'ROI scorecards',
    content:
      'Five cards: Dispatched Emails, Won-Back Contacts, Win-Back Rate, Attributed Revenue, and Avg Deal / Won-Back.',
    before: async () => {
      await ensureAnalyticsTab();
      await waitForSelector(T('mkt-analytics-kpis'), 4000);
    },
  }),

  step({
    id: 'mkt-funnel',
    target: T('mkt-funnel'),
    title: 'Conversion funnel',
    content:
      'Four steps: CRM Audience Base → Emails Dispatched → Won-Back Leads → Pipeline Revenue.',
    before: async () => {
      await ensureAnalyticsTab();
      await waitForSelector(T('mkt-funnel'), 4000);
    },
  }),

  step({
    id: 'mkt-performance',
    target: T('mkt-performance'),
    title: 'Segment & type performance',
    content:
      'Break down sent, won-back, conversion %, and revenue by audience segment and by campaign type.',
    before: async () => {
      await ensureAnalyticsTab();
      await waitForSelector(T('mkt-performance'), 4000);
    },
  }),

  step({
    id: 'mkt-leaderboard',
    target: T('mkt-leaderboard'),
    title: 'ROI leaderboard',
    content:
      'Top campaigns ranked by attributed revenue with sent, won-back, and conversion metrics.',
    before: async () => {
      await ensureAnalyticsTab();
      await waitForSelector(T('mkt-leaderboard'), 4000);
    },
  }),

  step({
    id: 'mkt-finish',
    target: T('mkt-tour-landing'),
    title: 'You are set',
    content:
      'You have seen audiences, campaign management, the create form, and ROI analytics. Click Finish when ready.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      requestMarketingTourCreateModal({ open: false });
      await ensureCampaignsTab();
    },
  }),
];
