/**
 * Settings Beacon onboarding — every tab and its components.
 * Tour-only; does not save settings or mutate workspace users.
 * Soft-skips missing targets (RBAC / load failure).
 */
import {
  requestTourNavigate,
  requestSettingsTourTab,
  waitForSelector,
} from '../settingsTourState.js';

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
  if (path === '/settings' || path.startsWith('/settings')) {
    await waitForSelector(T('settings-tour-landing'), 8000);
    return;
  }
  requestTourNavigate('/settings');
  await wait(400);
  await waitForSelector(T('settings-tour-landing'), 10000);
}

async function ensureTab(tab, targetId) {
  await ensurePath();
  requestSettingsTourTab(tab);
  await wait(280);
  if (targetId) await waitForSelector(T(targetId), 6000);
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

export const settingsTourSteps = [
  step({
    id: 'settings-welcome',
    target: T('settings-title'),
    title: 'CRM Settings',
    content:
      'Configure company profile, logistics, finance, email, taxonomies, and workspace users. This walkthrough explains every tab and its components — nothing is saved until you click Save settings yourself.',
    skipBeacon: true,
    before: async () => {
      await ensureTab('general', 'settings-title');
    },
  }),

  step({
    id: 'settings-header-actions',
    target: T('settings-header-actions'),
    title: 'Status & toolbar',
    content:
      'The badge shows Unsaved changes vs All changes saved. Use Save settings in the sticky bar at the bottom when you are ready. Tour restarts this walkthrough anytime — it never auto-saves.',
    before: async () => {
      await ensureTab('general', 'settings-header-actions');
    },
  }),

  step({
    id: 'settings-tabs',
    target: T('settings-tabs'),
    title: 'Settings tabs',
    content:
      'Eight areas: General, Shipping, Finance, Email, Projects, Leads, Clients, and Users. Each tab loads its own editors; use Save settings when you are ready to persist.',
    before: async () => {
      await ensureTab('general', 'settings-tabs');
    },
  }),

  // ── General ──────────────────────────────────────────────
  step({
    id: 'settings-tab-general',
    target: T('settings-tab-general'),
    title: 'General tab',
    content:
      'Company identity used across quotes, invoices, tax mode (CGST/SGST vs IGST), and currency defaults.',
    before: async () => {
      await ensureTab('general', 'settings-tab-general');
    },
  }),

  step({
    id: 'settings-general-profile',
    target: T('settings-general-profile'),
    title: 'Company profile fields',
    content:
      'Registered Company Name and Origin State are required. Default Currency Select picks a preset (INR, USD…); Currency Code accepts a custom 3-letter ISO code. Standard Default Tax Rate (%) feeds billing and documents.',
    before: async () => {
      await ensureTab('general', 'settings-general-profile');
    },
  }),

  // ── Shipping ─────────────────────────────────────────────
  step({
    id: 'settings-tab-shipping',
    target: T('settings-tab-shipping'),
    title: 'Shipping tab',
    content:
      'State-wise freight fees and free-shipping threshold used on opportunities, sales orders, and quotations.',
    before: async () => {
      await ensureTab('shipping', 'settings-tab-shipping');
    },
  }),

  step({
    id: 'settings-shipping-actions',
    target: T('settings-shipping-actions'),
    title: 'Shipping actions',
    content:
      'Reset Standard Indian States loads the built-in matrix. Add State Rate appends a new row. Changes stay local until you Save settings.',
    before: async () => {
      await ensureTab('shipping', 'settings-shipping-actions');
    },
  }),

  step({
    id: 'settings-shipping-threshold',
    target: T('settings-shipping-threshold'),
    title: 'Free shipping threshold',
    content:
      'Orders at or above this amount (₹) can ship free. Opportunities and sales orders read this value when calculating freight.',
    before: async () => {
      await ensureTab('shipping', 'settings-shipping-threshold');
    },
  }),

  step({
    id: 'settings-shipping-rates',
    target: T('settings-shipping-rates'),
    title: 'State shipping rates',
    content:
      'Each row is a destination state name plus freight amount. Edit names/rates inline or Remove a row. These power destination-state shipping on commercial docs.',
    before: async () => {
      await ensureTab('shipping', 'settings-shipping-rates');
    },
  }),

  // ── Finance ──────────────────────────────────────────────
  step({
    id: 'settings-tab-finance',
    target: T('settings-tab-finance'),
    title: 'Finance tab',
    content:
      'Document number prefixes, quotation validity, default billable rate, and expense categories for Finance modules.',
    before: async () => {
      await ensureTab('finance', 'settings-tab-finance');
    },
  }),

  step({
    id: 'settings-finance-prefixes',
    target: T('settings-finance-prefixes'),
    title: 'Prefixes & rates',
    content:
      'Quotation, Sales Order, Invoice, Payment, Expense, and Client Tax ID prefixes stamp new documents. Quotation Validity (Days) and Default Billable Hourly Rate set finance defaults.',
    before: async () => {
      await ensureTab('finance', 'settings-finance-prefixes');
    },
  }),

  step({
    id: 'settings-finance-categories',
    target: T('settings-finance-categories'),
    title: 'Expense categories',
    content:
      'Expense categories as chips — add or remove like Lead Sources. Used when logging expenses for consistent reports.',
    before: async () => {
      await ensureTab('finance', 'settings-finance-categories');
    },
  }),

  // ── Email ────────────────────────────────────────────────
  step({
    id: 'settings-tab-email',
    target: T('settings-tab-email'),
    title: 'Email tab',
    content:
      'Outbound email plugin status, automatic client task reminders, and quotation/invoice email templates.',
    before: async () => {
      await ensureTab('email', 'settings-tab-email');
    },
  }),

  step({
    id: 'settings-email-status',
    target: T('settings-email-status'),
    title: 'Email plugin status',
    content:
      'Shows whether the email plugin is configured and when the last test was sent. Fix plugin/host mail settings if status is not ready.',
    before: async () => {
      await ensureTab('email', 'settings-email-status');
    },
  }),

  step({
    id: 'settings-email-reminders',
    target: T('settings-email-reminders'),
    title: 'Client reminder automation',
    content:
      'Enable Automatic Client Reminder Emailing, then pick a preset interval (12h–1 wk) or enter custom hours. Used for task client follow-ups.',
    before: async () => {
      await ensureTab('email', 'settings-email-reminders');
    },
  }),

  step({
    id: 'settings-email-templates',
    target: T('settings-email-templates'),
    title: 'Quotation & invoice subjects',
    content:
      'Default subject lines and body intros for quotation and invoice emails. Staff can still edit per send; these are the workspace defaults.',
    before: async () => {
      await ensureTab('email', 'settings-email-templates');
    },
  }),

  step({
    id: 'settings-email-test',
    target: T('settings-email-test'),
    title: 'Send test email',
    content:
      'Enter a test recipient and Send Test Email to verify delivery. The tour never triggers this — use it only when you intend to send.',
    before: async () => {
      await ensureTab('email', 'settings-email-test');
    },
  }),

  // ── Projects ─────────────────────────────────────────────
  step({
    id: 'settings-tab-projects',
    target: T('settings-tab-projects'),
    title: 'Projects tab',
    content:
      'Project priorities, categories, tags, and custom fields that power project forms and filters. Statuses live in their own Project Statuses tab.',
    before: async () => {
      await ensureTab('projects', 'settings-tab-projects');
    },
  }),

  step({
    id: 'settings-projects-lists',
    target: T('settings-projects-lists'),
    title: 'Project taxonomies',
    content:
      'Chip editors for Priorities, Categories, and Tags. Add values one-by-one (or bulk edit). These drive dropdowns and filters on Projects.',
    before: async () => {
      await ensureTab('projects', 'settings-projects-lists');
    },
  }),

  step({
    id: 'settings-projects-custom-fields',
    target: T('settings-projects-custom-fields'),
    title: 'Project custom fields',
    content:
      'Add typed fields (text, number, date, select, etc.) beyond standard project attributes. Fields appear on create/detail forms after you save settings.',
    before: async () => {
      await ensureTab('projects', 'settings-projects-custom-fields');
    },
  }),

  step({
    id: 'settings-tab-project-statuses',
    target: T('settings-tab-project-statuses'),
    title: 'Project Statuses tab',
    content:
      'Manage project lifecycle labels. System statuses (Not Started, In Progress, etc.) are locked; only custom statuses you create can be renamed or deleted.',
    before: async () => {
      await ensureTab('project-statuses', 'settings-tab-project-statuses');
    },
  }),

  step({
    id: 'settings-project-statuses',
    target: T('settings-project-statuses'),
    title: 'Locked vs custom statuses',
    content:
      'System statuses always stay. Add your own statuses below — rename or remove those anytime, then Save settings.',
    before: async () => {
      await ensureTab('project-statuses', 'settings-project-statuses');
    },
  }),

  // ── Leads ────────────────────────────────────────────────
  step({
    id: 'settings-tab-leads',
    target: T('settings-tab-leads'),
    title: 'Leads tab',
    content:
      'Lead intake & pipeline: sources, statuses, tags, Kanban stages, and lead custom fields used across Leads and reports.',
    before: async () => {
      await ensureTab('leads', 'settings-tab-leads');
    },
  }),

  step({
    id: 'settings-leads-hero',
    target: T('settings-leads-hero'),
    title: 'Lead configuration overview',
    content:
      'Counts of Sources, Statuses, Tags, and Pipeline Stages so you can see how rich the lead taxonomy already is.',
    before: async () => {
      await ensureTab('leads', 'settings-leads-hero');
    },
  }),

  step({
    id: 'settings-leads-chips',
    target: T('settings-leads-chips'),
    title: 'Sources, statuses & tags',
    content:
      'Chip editors: add items one-by-one or bulk paste. Sources = where prospects come from; Statuses = lifecycle labels; Tags = segmentation labels (Hot Lead, Inbound…).',
    before: async () => {
      await ensureTab('leads', 'settings-leads-chips');
    },
  }),

  step({
    id: 'settings-leads-pipeline',
    target: T('settings-leads-pipeline'),
    title: 'Sales pipeline stages',
    content:
      'Numbered step cards in a grid. Drag the handle onto another stage to swap their places. Rename inline or Add stage (blank name creates “New Stage”). Keep at least one stage.',
    before: async () => {
      await ensureTab('leads', 'settings-leads-pipeline');
    },
  }),

  step({
    id: 'settings-leads-custom-fields',
    target: T('settings-leads-custom-fields'),
    title: 'Lead custom fields',
    content:
      'Extra attributes on lead create/detail forms. Use the field builder to define key, label, and type — same pattern as Projects and Clients.',
    before: async () => {
      await ensureTab('leads', 'settings-leads-custom-fields');
    },
  }),

  // ── Clients ──────────────────────────────────────────────
  step({
    id: 'settings-tab-clients',
    target: T('settings-tab-clients'),
    title: 'Clients tab',
    content:
      'Client categories, tags, and custom fields used on client accounts and filters.',
    before: async () => {
      await ensureTab('clients', 'settings-tab-clients');
    },
  }),

  step({
    id: 'settings-clients-lists',
    target: T('settings-clients-lists'),
    title: 'Client categories & tags',
    content:
      'Chip editors for Client Categories and Client Tags — same add/remove pattern as Lead Sources. These feed client forms and list filters.',
    before: async () => {
      await ensureTab('clients', 'settings-clients-lists');
    },
  }),

  step({
    id: 'settings-clients-custom-fields',
    target: T('settings-clients-custom-fields'),
    title: 'Client custom fields',
    content:
      'Workspace-specific fields on client records (industry code, contract tier, etc.). Add fields here; they appear after Save settings.',
    before: async () => {
      await ensureTab('clients', 'settings-clients-custom-fields');
    },
  }),

  // ── Users ────────────────────────────────────────────────
  step({
    id: 'settings-tab-users',
    target: T('settings-tab-users'),
    title: 'Users tab',
    content:
      'Workspace users, job designations, system roles, and permission summaries. Designations appear on quotes, projects, and audit timelines.',
    before: async () => {
      await ensureTab('users', 'settings-tab-users');
    },
  }),

  step({
    id: 'settings-users-toolbar',
    target: T('settings-users-toolbar'),
    title: 'User filter & refresh',
    content:
      'Filter users by name/email and Refresh reloads the roster. Preset chips below suggest common designations (Sales Exec, Account Mgr…).',
    before: async () => {
      await ensureTab('users', 'settings-users-toolbar');
    },
  }),

  step({
    id: 'settings-users-table',
    target: T('settings-users-table'),
    title: 'Users table',
    content:
      'Per user: avatar/name, Job Designation (edit + Save), System Role badge, permission count/categories, and View to open Granted Permissions. The tour does not save designations.',
    before: async () => {
      await ensureTab('users', 'settings-users-table');
    },
  }),

  // ── Sticky save ──────────────────────────────────────────
  step({
    id: 'settings-sticky-save',
    target: T('settings-sticky-save'),
    title: 'Sticky save bar',
    content:
      'Always visible while scrolling — status text plus Save settings. Prefer reviewing each tab, then one intentional save. Finish ends the tour without writing changes.',
    before: async () => {
      await ensureTab('users', 'settings-sticky-save');
    },
  }),

  step({
    id: 'settings-finish',
    target: T('settings-title'),
    title: 'You are set',
    content:
      'You have walked every Settings tab. Configure master data before daily CRM work, save carefully, and reopen Tour anytime from the header.',
    skipBeacon: true,
    before: async () => {
      await ensureTab('general', 'settings-title');
    },
  }),
];
