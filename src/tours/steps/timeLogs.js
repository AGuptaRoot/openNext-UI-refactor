/**
 * Time Logs Beacon onboarding — every feature, Check In, Manual Entry → Quotations.
 * Tour-only; does not change time-log APIs or save/check-in business logic.
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestTimeLogsView,
  requestTimeLogsModal,
} from '../timeLogsTourState.js';

const T = (id) => `[data-tour="${id}"]`;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function currentPath() {
  const hash = String(window.location.hash || '');
  return hash.replace(/^#/, '').split('?')[0] || '/';
}

async function ensureTimeLogsPath() {
  const path = currentPath();
  if (path !== '/time-logs' && !path.startsWith('/time-logs/')) {
    requestTourNavigate('/time-logs');
    await waitForSelector(T('time-logs-tour-landing'), 10000);
  }
}

async function ensureView(view) {
  await ensureTimeLogsPath();
  requestTimeLogsView(view);
  await wait(350);
  if (view === 'list') {
    await waitForSelector(T('time-logs-filters'), 5000);
    if (!document.querySelector(T('time-logs-filters'))) {
      await waitForSelector(T('time-logs-list'), 3000);
    }
  } else {
    await waitForSelector(T('time-logs-weekly'), 5000);
  }
}

async function ensureModal(mode) {
  await ensureTimeLogsPath();
  requestTimeLogsModal(mode);
  await wait(300);
  if (mode === 'manual') {
    await waitForSelector(T('time-logs-manual-modal'), 6000);
  } else if (mode === 'check-in') {
    await waitForSelector(T('time-logs-checkin-modal'), 6000);
  } else {
    await wait(200);
  }
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

export const timeLogsTourSteps = [
  // ——— Welcome ———
  step({
    id: 'timeLogs-welcome',
    target: T('time-logs-title'),
    title: 'Time Logs workspace',
    content:
      'Track billable hours here: live Check In / Check Out timers, Manual Time Entry, List vs Weekly timesheet, filters, approvals, and CSV export. Click Next to walk through each feature.',
    skipBeacon: true,
    before: async () => {
      await ensureTimeLogsPath();
      requestTimeLogsModal(null);
      await ensureView('list');
    },
  }),

  // ——— Views ———
  step({
    id: 'timeLogs-view-tabs',
    target: T('time-logs-view-tabs'),
    title: 'List & Weekly views',
    content:
      'Switch between List (individual entries) and Weekly (timesheet grid by day). Both share the same logs — pick the layout that fits your review.',
    before: async () => {
      await ensureView('list');
      requestTimeLogsModal(null);
    },
  }),

  // ——— Toolbar actions ———
  step({
    id: 'timeLogs-checkin-btn',
    target: T('time-logs-checkin-btn'),
    title: 'Check In button',
    content:
      'Start a live timer on a task. While a timer runs, this button becomes Check Out so you can stop and save hours. Next we open the Check In form.',
    before: async () => {
      await ensureView('list');
      requestTimeLogsModal(null);
      await waitForSelector(T('time-logs-checkin-btn'), 4000);
    },
  }),

  step({
    id: 'timeLogs-checkin-modal',
    target: T('time-logs-checkin-modal'),
    title: 'Check In / Start Timer',
    content:
      'This is the Check In dialog. Choose the Task you are working on, add an optional work note, then click Start Timer. The page banner will show a live elapsed clock until you Check Out.',
    placement: 'left',
    skipBeacon: true,
    before: async () => {
      await ensureModal('check-in');
    },
  }),

  step({
    id: 'timeLogs-checkin-task',
    target: T('time-logs-checkin-task'),
    title: 'Select a task',
    content:
      'Pick the task (and project) for this session. Check In creates a Running timer entry linked to that task — you cannot start two timers at once.',
    before: async () => {
      await ensureModal('check-in');
    },
  }),

  step({
    id: 'timeLogs-checkin-note',
    target: T('time-logs-checkin-note'),
    title: 'Optional work note',
    content:
      'Add a short note about what you are starting (optional). You can refine description when you Check Out.',
    before: async () => {
      await ensureModal('check-in');
    },
  }),

  step({
    id: 'timeLogs-checkin-submit',
    target: T('time-logs-checkin-submit'),
    title: 'Start Timer',
    content:
      'Click Start Timer to begin. For this tour we will not start a real timer — use Next, then we close this dialog and show Manual Entry.',
    before: async () => {
      await ensureModal('check-in');
    },
  }),

  // ——— Manual entry ———
  step({
    id: 'timeLogs-manual-btn',
    target: T('time-logs-manual-btn'),
    title: 'Manual Time Entry',
    content:
      'Log hours after the fact without a live timer. Use this for meetings, offline work, or correcting duration. Next opens the Manual Entry form step by step.',
    before: async () => {
      requestTimeLogsModal(null);
      await ensureView('list');
      await waitForSelector(T('time-logs-manual-btn'), 4000);
    },
  }),

  step({
    id: 'timeLogs-manual-modal',
    target: T('time-logs-manual-modal'),
    title: 'Create a manual time log',
    content:
      'Fill Task, Work date, Hours & Minutes (or use duration presets), Hourly rate, Billable flag, and Description — then Save. The new row appears in List / Weekly immediately.',
    placement: 'left',
    skipBeacon: true,
    before: async () => {
      await ensureModal('manual');
    },
  }),

  step({
    id: 'timeLogs-manual-task',
    target: T('time-logs-manual-task'),
    title: '1) Choose task',
    content: 'Select the task this time belongs to. The list shows task title and project.',
    before: async () => {
      await ensureModal('manual');
    },
  }),

  step({
    id: 'timeLogs-manual-date',
    target: T('time-logs-manual-date'),
    title: '2) Work date',
    content: 'Set the calendar day the work was done. Defaults to today.',
    before: async () => {
      await ensureModal('manual');
    },
  }),

  step({
    id: 'timeLogs-manual-duration',
    target: T('time-logs-manual-duration'),
    title: '3) Hours & minutes',
    content:
      'Enter hours and minutes (or click a preset like 30m / 1h). The green badge shows the normalized total used for billing.',
    before: async () => {
      await ensureModal('manual');
    },
  }),

  step({
    id: 'timeLogs-manual-presets',
    target: T('time-logs-manual-presets'),
    title: 'Duration presets',
    content: 'Quick-add common durations so you do not type every time.',
    before: async () => {
      await ensureModal('manual');
    },
  }),

  step({
    id: 'timeLogs-manual-rate',
    target: T('time-logs-manual-rate'),
    title: '4) Rate & billable',
    content:
      'Set hourly rate and whether the entry is Billable. Billable hours feed invoices and utilization reports.',
    before: async () => {
      await ensureModal('manual');
    },
  }),

  step({
    id: 'timeLogs-manual-description',
    target: T('time-logs-manual-description'),
    title: '5) Description',
    content: 'Describe the work performed — useful for client invoices and manager review.',
    before: async () => {
      await ensureModal('manual');
    },
  }),

  step({
    id: 'timeLogs-manual-save',
    target: T('time-logs-manual-save'),
    title: '6) Save',
    content:
      'Click Save to create the log (we skip saving during the tour). Use Cancel to close without creating. Next we return to the main workspace features.',
    before: async () => {
      await ensureModal('manual');
    },
  }),

  // ——— Running timer banner ———
  step({
    id: 'timeLogs-timer-banner',
    target: T('time-logs-timer-banner'),
    title: 'Running timer banner',
    content:
      'When a Check In is active, this banner shows elapsed time, task, and quick Check Out / View timer. If you do not see it, no timer is running — that is fine; continue with Next.',
    before: async () => {
      requestTimeLogsModal(null);
      await ensureView('list');
      await wait(200);
    },
  }),

  // ——— Filters & list ———
  step({
    id: 'timeLogs-filters',
    target: T('time-logs-filters'),
    title: 'Filters & sort',
    content:
      'Filter by Search, Project, Approval (Draft / Pending / Approved / Rejected), Method (Timer vs Manual), Locked, and Billable. Sort by date, task, or hours. Reset clears filters; Refresh reloads.',
    before: async () => {
      requestTimeLogsModal(null);
      await ensureView('list');
    },
  }),

  step({
    id: 'timeLogs-list',
    target: T('time-logs-list'),
    title: 'Time log list',
    content:
      'Each row shows member, task, project, method (Timer/Manual), duration, billable amount, approval status, and actions (approve / reject / delete when allowed). Locked rows cannot be edited.',
    before: async () => {
      await ensureView('list');
    },
  }),

  step({
    id: 'timeLogs-export',
    target: T('time-logs-export-btn'),
    title: 'Export CSV',
    content:
      'Download filtered time logs as CSV for payroll or billing. Export respects your current filters.',
    before: async () => {
      await ensureView('list');
      requestTimeLogsModal(null);
    },
  }),

  // ——— Weekly ———
  step({
    id: 'timeLogs-weekly-tab',
    target: T('time-logs-view-weekly'),
    title: 'Open Weekly timesheet',
    content: 'Switch to Weekly for a day-by-day grid across your team’s tasks.',
    before: async () => {
      requestTimeLogsModal(null);
      await ensureView('list');
    },
  }),

  step({
    id: 'timeLogs-weekly',
    target: T('time-logs-weekly'),
    title: 'Weekly timesheet grid',
    content:
      'Navigate Prev / This / Next week, filter by project, and review hours per day. Click empty cells to open Manual Entry for that task and date. Managers can Bulk Approve the week when permitted.',
    before: async () => {
      await ensureView('weekly');
    },
  }),

  step({
    id: 'timeLogs-weekly-nav',
    target: T('time-logs-weekly-nav'),
    title: 'Week navigation',
    content: 'Move between weeks or jump to This Week. The badge shows the week date range and total hours.',
    before: async () => {
      await ensureView('weekly');
    },
  }),

  // ——— Handoff ———
  step({
    id: 'timeLogs-to-quotations',
    target: T('time-logs-tour-landing'),
    title: 'Next: Quotations',
    content:
      'You have seen Time Logs — Check In, Manual Entry, List, Weekly, filters, and export. Click “Go to Quotations” to open the Quotations module and continue onboarding there.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      requestTimeLogsModal(null);
      await ensureView('list');
    },
  }),
];
