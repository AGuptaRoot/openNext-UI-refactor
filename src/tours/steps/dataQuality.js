/**
 * Data Quality Beacon onboarding — single-page hygiene center.
 * Tour-only; does not change scan/export/rules APIs.
 * Soft-skips missing targets (empty queue, warning banner when absent).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestDataQualityTourView,
  requestDataQualityRulesModal,
  requestDataQualityExportMenu,
} from '../dataQualityTourState.js';

const T = (id) => `[data-tour="${id}"]`;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function currentPath() {
  const hash = String(window.location.hash || '');
  return hash.replace(/^#/, '').split('?')[0] || '/';
}

async function ensureLanding() {
  const path = currentPath();
  if (path === '/data-quality' || path.startsWith('/data-quality/')) {
    await waitForSelector(T('data-quality-tour-landing'), 8000);
    return;
  }
  requestTourNavigate('/data-quality');
  await wait(400);
  await waitForSelector(T('data-quality-tour-landing'), 10000);
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

export const dataQualityTourSteps = [
  step({
    id: 'data-quality-welcome',
    target: T('data-quality-title'),
    title: 'Data Quality & Duplicate Center',
    content:
      'Review possible duplicates and low-quality leads/customers. Nothing is merged or deleted automatically — you Review or Improve records yourself. Click Next to walk through every control.',
    skipBeacon: true,
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(false);
      requestDataQualityExportMenu(false);
      requestDataQualityTourView('duplicates');
    },
  }),

  step({
    id: 'data-quality-export-btn',
    target: T('data-quality-export-btn'),
    title: 'Export',
    content:
      'Downloads the current filtered queue for audits or cleanup lists. Opens a menu with CSV and JSON options.',
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(false);
      requestDataQualityExportMenu(false);
    },
  }),

  step({
    id: 'data-quality-export-csv',
    target: T('data-quality-export-csv'),
    title: 'Export as CSV',
    content:
      'Spreadsheet-friendly download of the current tab, record type, match/score filter, and search.',
    before: async () => {
      await ensureLanding();
      requestDataQualityExportMenu(true);
      await wait(250);
      await waitForSelector(T('data-quality-export-csv'), 3000);
    },
  }),

  step({
    id: 'data-quality-export-json',
    target: T('data-quality-export-json'),
    title: 'Export as JSON',
    content:
      'Same filtered queue as structured JSON — useful for scripts or external tools.',
    before: async () => {
      await ensureLanding();
      requestDataQualityExportMenu(true);
      await wait(200);
      await waitForSelector(T('data-quality-export-json'), 3000);
    },
  }),

  step({
    id: 'data-quality-display-scoring-btn',
    target: T('data-quality-display-scoring-btn'),
    title: 'Display Scoring',
    content:
      'Opens configurable field weights and rating thresholds used to calculate quality scores. We open this modal later in the tour.',
    before: async () => {
      await ensureLanding();
      requestDataQualityExportMenu(false);
      requestDataQualityRulesModal(false);
    },
  }),

  step({
    id: 'data-quality-refresh-btn',
    target: T('data-quality-refresh-btn'),
    title: 'Refresh scan',
    content:
      'Re-runs the tenant data-quality scan and reloads KPIs plus the review queue. Use after editing records or changing scoring rules.',
    before: async () => {
      await ensureLanding();
    },
  }),

  step({
    id: 'data-quality-tour-btn',
    target: T('data-quality-tour-btn'),
    title: 'Tour button',
    content:
      'Restart this guided walkthrough anytime. Also available from the tour control bar when a tour is paused.',
    before: async () => {
      await ensureLanding();
      await waitForSelector(T('data-quality-tour-btn'), 2000);
    },
  }),

  step({
    id: 'data-quality-warning-banner',
    target: T('data-quality-warning-banner'),
    title: 'Scan window warning',
    content:
      'On large tenants the scan may be truncated. This amber banner appears only when the scan window is limited — soft-skipped if absent.',
    before: async () => {
      await ensureLanding();
      await waitForSelector(T('data-quality-warning-banner'), 1500);
    },
  }),

  step({
    id: 'data-quality-kpi-duplicate-leads',
    target: T('data-quality-kpi-duplicate-leads'),
    title: 'Duplicate leads KPI',
    content:
      'Count of lead records flagged as possible duplicates (matching email, mobile, PAN, or similar company).',
    before: async () => {
      await ensureLanding();
    },
  }),

  step({
    id: 'data-quality-kpi-duplicate-customers',
    target: T('data-quality-kpi-duplicate-customers'),
    title: 'Duplicate customers KPI',
    content:
      'Same duplicate detection for customers/clients in your workspace.',
    before: async () => {
      await ensureLanding();
    },
  }),

  step({
    id: 'data-quality-kpi-low-quality',
    target: T('data-quality-kpi-low-quality'),
    title: 'Low-quality records KPI',
    content:
      'Combined count of leads and customers below the active quality score threshold.',
    before: async () => {
      await ensureLanding();
    },
  }),

  step({
    id: 'data-quality-kpi-averages',
    target: T('data-quality-kpi-averages'),
    title: 'Average quality scores',
    content:
      'Tenant-wide average quality scores for leads and customers based on your current field weights.',
    before: async () => {
      await ensureLanding();
    },
  }),

  step({
    id: 'data-quality-tab-duplicates',
    target: T('data-quality-tab-duplicates'),
    title: 'Possible duplicates tab',
    content:
      'First review queue — matching email / mobile / PAN / similar company. Click Next to see its filters and table.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('duplicates');
      await wait(250);
    },
  }),

  step({
    id: 'data-quality-record-type',
    target: T('data-quality-record-type'),
    title: 'Record type filter',
    content:
      'Switch between Leads and Customers. Applies to both the duplicates and low-quality queues.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('duplicates');
      await wait(250);
    },
  }),

  step({
    id: 'data-quality-match-type',
    target: T('data-quality-match-type'),
    title: 'Match type filter',
    content:
      'Duplicates only: All matches, Exact details (email/mobile/PAN), or Similar company name.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('duplicates');
      await wait(300);
      await waitForSelector(T('data-quality-match-type'), 3000);
    },
  }),

  step({
    id: 'data-quality-search',
    target: T('data-quality-search'),
    title: 'Search',
    content:
      'Filter the queue by name, company, email, or mobile. Search is debounced (~300ms) and resets pagination to page 1.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('duplicates');
      await wait(200);
    },
  }),

  step({
    id: 'data-quality-table-duplicates',
    target: T('data-quality-table'),
    title: 'Duplicates review table',
    content:
      'Columns: Record, Contact Info, Quality Score, Possible Matches, Signals (Same email/mobile/PAN/Similar company), and Actions.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('duplicates');
      await wait(300);
    },
  }),

  step({
    id: 'data-quality-row-review',
    target: T('data-quality-row-first'),
    title: 'Review action',
    content:
      'Click a row or Review to open the lead/customer detail and decide how to resolve the duplicate. Soft-skipped when the queue is empty.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('duplicates');
      await wait(300);
      await waitForSelector(T('data-quality-row-first'), 2500);
    },
  }),

  step({
    id: 'data-quality-tab-low-quality',
    target: T('data-quality-tab-low-quality'),
    title: 'Low quality tab',
    content:
      'Second queue — incomplete records below a score threshold. Match type is replaced by Maximum score.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('duplicates');
      await wait(200);
    },
  }),

  step({
    id: 'data-quality-max-score',
    target: T('data-quality-max-score'),
    title: 'Maximum score filter',
    content:
      'Low quality only: Below 50, 69 or below, or 79 or below. Narrows the incomplete-records queue.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('low-quality');
      await wait(350);
      await waitForSelector(T('data-quality-max-score'), 3000);
    },
  }),

  step({
    id: 'data-quality-table-low',
    target: T('data-quality-table'),
    title: 'Low-quality table & Improve',
    content:
      'Same columns; Signals show missing fields. Action is Improve — opens the record so you can fill gaps. Score badges: Excellent / Good / Needs attention / Incomplete.',
    before: async () => {
      await ensureLanding();
      requestDataQualityTourView('low-quality');
      await wait(300);
    },
  }),

  step({
    id: 'data-quality-pagination',
    target: T('data-quality-pagination'),
    title: 'Pagination',
    content:
      'Queues paginate at 20 records per page. Use the chevrons to move pages. Soft-skipped if there is only one page (or an empty queue).',
    before: async () => {
      await ensureLanding();
      await waitForSelector(T('data-quality-pagination'), 2500);
    },
  }),

  step({
    id: 'data-quality-open-rules',
    target: T('data-quality-display-scoring-btn'),
    title: 'Open Display Scoring',
    content:
      'Next opens the rules modal and walks through lead weights, client weights, thresholds, and Save / Cancel.',
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(false);
      await wait(200);
    },
  }),

  step({
    id: 'data-quality-rules-modal',
    target: T('data-quality-rules-modal'),
    title: 'Scoring rules modal',
    content:
      'Configure how quality scores are calculated. Changes apply after you Save (we will not save during the tour).',
    skipBeacon: true,
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(true);
      await wait(400);
      await waitForSelector(T('data-quality-rules-modal'), 5000);
    },
  }),

  step({
    id: 'data-quality-rules-lead-weights',
    target: T('data-quality-rules-lead-weights'),
    title: 'Lead field weights',
    content:
      'Point values for Full Name, Valid Email, Valid Mobile, Company, PAN, Address, Assigned Owner, and No Duplicates.',
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(true);
      await wait(300);
      await waitForSelector(T('data-quality-rules-lead-weights'), 4000);
    },
  }),

  step({
    id: 'data-quality-rules-client-weights',
    target: T('data-quality-rules-client-weights'),
    title: 'Client field weights',
    content:
      'Point values for Company Name, Email, Mobile, Website, Billing Address, Tax ID, Contact Added, and No Duplicates.',
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(true);
      await wait(200);
      await waitForSelector(T('data-quality-rules-client-weights'), 4000);
    },
  }),

  step({
    id: 'data-quality-rules-thresholds',
    target: T('data-quality-rules-thresholds'),
    title: 'Rating thresholds',
    content:
      'Excellent ≥, Good ≥, and Needs Attention ≥ (percent). Values must descend. Below Needs Attention is Incomplete.',
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(true);
      await wait(200);
      await waitForSelector(T('data-quality-rules-thresholds'), 4000);
    },
  }),

  step({
    id: 'data-quality-rules-footer',
    target: T('data-quality-rules-footer'),
    title: 'Cancel & Save Rules',
    content:
      'Cancel closes without saving. Save Rules & Weights persists changes and triggers a rescan. Tour skips saving.',
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(true);
      await wait(200);
      await waitForSelector(T('data-quality-rules-footer'), 4000);
    },
  }),

  step({
    id: 'data-quality-extras',
    target: T('data-quality-tour-landing'),
    title: 'Also worth knowing',
    content:
      'Read-only center — no auto-merge/delete. Lead detail pages show a quality score panel. Client create has a separate duplicate prompt. Clients cannot access this module. Discoverable in global search as “Data Quality Center”.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensureLanding();
      requestDataQualityRulesModal(false);
      requestDataQualityExportMenu(false);
      requestDataQualityTourView('duplicates');
    },
  }),

  step({
    id: 'data-quality-finish',
    target: T('data-quality-tour-landing'),
    title: 'You are set',
    content:
      'You have seen Export, Display Scoring, Refresh, KPIs, both tabs, filters, the review table, scoring rules, and Save/Cancel. Click Finish when you are ready.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensureLanding();
    },
  }),
];
