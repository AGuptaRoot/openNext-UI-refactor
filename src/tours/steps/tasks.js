/**
 * Tasks Beacon onboarding — create form, listing, detail tabs → Time Logs.
 * Tour-only; does not change task CRM APIs or save/delete/timer logic.
 * Detail / Time Logs redirect skipped when no task records exist (finish after listing).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestTasksView,
  requestTaskDetailTab,
  requestTasksTourJump,
  requestTasksExportMenu,
  requestTasksTemplatesOpen,
  requestTasksRecurringOpen,
} from '../tasksTourState.js';

const T = (id) => `[data-tour="${id}"]`;

function currentPath() {
  const hash = String(window.location.hash || '');
  return hash.replace(/^#/, '').split('?')[0] || '/';
}

async function ensurePath(pathPrefix) {
  const path = currentPath();
  if (pathPrefix === '/tasks/create') {
    if (!path.startsWith('/tasks/create')) {
      requestTourNavigate('/tasks/create');
      await waitForSelector(T('tasks-create-form'), 8000);
    }
    return;
  }
  if (pathPrefix === '/tasks') {
    if (path !== '/tasks') {
      requestTourNavigate('/tasks');
      await waitForSelector(T('tasks-tour-landing'), 8000);
    }
    return;
  }
  if (pathPrefix === '/time-logs') {
    if (path !== '/time-logs' && !path.startsWith('/time-logs/')) {
      requestTourNavigate('/time-logs');
      await waitForSelector(T('time-logs-tour-landing'), 8000);
    }
  }
}

async function ensureView(view) {
  await ensurePath('/tasks');
  requestTasksView(view);
  const map = {
    list: T('tasks-table'),
    kanban: T('tasks-kanban'),
  };
  await waitForSelector(map[view] || T('tasks-view-tabs'), 5000);
  if (view === 'list' && !document.querySelector(map.list)) {
    await waitForSelector(T('tasks-view-tabs'), 2000);
  }
}

function hasAnyTaskRow() {
  return Boolean(
    document.querySelector('[data-tour="tasks-row-first"]') ||
      document.querySelector('tr[data-task-id]') ||
      document.querySelector('[data-tour="tasks-kanban-card-first"]')
  );
}

function hasTaskTable() {
  return Boolean(document.querySelector('[data-tour="tasks-table"]'));
}

function stepIndexById(id) {
  return tasksTourSteps.findIndex((s) => s.id === id);
}

function skipTaskDetailSteps() {
  requestTasksTourJump({ finish: true });
}

function skipTaskTableSteps() {
  const kanbanIdx = stepIndexById('tasks-kanban-board');
  if (kanbanIdx >= 0) requestTasksTourJump({ stepIndex: kanbanIdx });
  else requestTasksTourJump({ finish: true });
}

function skipToViewTabs() {
  const idx = stepIndexById('tasks-view-tabs');
  if (idx >= 0) requestTasksTourJump({ stepIndex: idx });
}

async function openFirstTask() {
  await ensureView('list');
  if (!hasAnyTaskRow()) return false;
  const row =
    document.querySelector(T('tasks-row-first')) ||
    document.querySelector('tr[data-task-id]');
  const id = row?.getAttribute('data-task-id');
  if (!id) return false;
  requestTourNavigate(`/tasks/${id}`);
  const tabs = await waitForSelector(T('tasks-detail-tabs'), 10000);
  return Boolean(tabs);
}

async function guardTaskDetail(beforeFn) {
  const onDetail = Boolean(document.querySelector(T('tasks-detail-tabs')));
  if (!onDetail) {
    await ensurePath('/tasks');
    if (!hasAnyTaskRow()) {
      skipTaskDetailSteps();
      return false;
    }
  }
  if (beforeFn) await beforeFn();
  return true;
}

function step(partial) {
  return {
    placement: 'auto',
    skipBeacon: false,
    beaconTrigger: 'click',
    targetWaitTimeout: 3500,
    ...partial,
  };
}

export const tasksTourSteps = [
  step({
    id: 'tasks-start-create',
    target: T('tasks-create-btn'),
    title: 'Create New Task',
    content:
      'Click Add Task to open the create form. Use the beacon, then Next — or click the button yourself.',
    placement: 'bottom',
    before: async () => {
      requestTasksTemplatesOpen(false);
      requestTasksRecurringOpen(false);
      requestTasksExportMenu(false);
      await ensurePath('/tasks');
      requestTasksView('list');
      await waitForSelector(T('tasks-create-btn'), 8000);
    },
  }),

  // ——— Create form ———
  step({
    id: 'tasks-form-intro',
    target: T('tasks-create-form'),
    title: 'Create Task form',
    content:
      'Build a task from template or blank: project link, core fields, recurrence, client review, watchers, and description.',
    placement: 'center',
    before: async () => {
      await ensurePath('/tasks/create');
    },
  }),
  step({
    id: 'tasks-section-template',
    target: T('tasks-section-template'),
    title: 'Task template',
    content: 'Prefill title, description, priority, and checklist items from a reusable task template.',
    before: async () => {
      await ensurePath('/tasks/create');
    },
  }),
  step({
    id: 'tasks-section-project',
    target: T('tasks-section-project'),
    title: 'Project & dependency',
    content: 'Link Project *, optional Milestone, and Depends on Task so delivery order stays clear.',
    before: async () => {
      await ensurePath('/tasks/create');
    },
  }),
  step({
    id: 'tasks-section-core',
    target: T('tasks-section-core'),
    title: 'Core task fields',
    content: 'Title *, Status, Priority, Assigned To, and Due Date — the essentials for list and Kanban.',
  }),
  step({
    id: 'tasks-section-notify',
    target: T('tasks-section-notify'),
    title: 'Client notification',
    content: 'Optionally notify the client when this task is marked completed.',
  }),
  step({
    id: 'tasks-section-recurring',
    target: T('tasks-section-recurring'),
    title: 'Recurring schedule',
    content: 'Turn on recurrence for repeating work — interval and cycle count.',
  }),
  step({
    id: 'tasks-section-client',
    target: T('tasks-section-client'),
    title: 'Client review fields',
    content: 'Client Status, Satisfied flag, and feedback notes for client-facing review workflows.',
  }),
  step({
    id: 'tasks-section-watchers',
    target: T('tasks-section-watchers'),
    title: 'Watchers',
    content: 'Add followers who get updates without being the primary assignee.',
  }),
  step({
    id: 'tasks-section-description',
    target: T('tasks-section-description'),
    title: 'Description & criteria',
    content: 'Describe the work and acceptance criteria so the team knows when it is done.',
  }),
  step({
    id: 'tasks-save-btn',
    target: T('tasks-save-btn'),
    title: 'Add Task (Save)',
    content: 'Save when required fields are filled. For the tour, click Next to continue on the listing.',
    placement: 'top',
  }),

  // ——— Listing ———
  step({
    id: 'tasks-listing-intro',
    target: T('tasks-tour-landing'),
    title: 'Tasks listing',
    content:
      'Back on Tasks. Next: metrics, filters, Export, Templates, Recurring, List/Kanban. Opening a particular task runs only if at least one task exists. Finale goes to Time Logs.',
    placement: 'center',
    before: async () => {
      requestTasksTemplatesOpen(false);
      requestTasksRecurringOpen(false);
      requestTasksExportMenu(false);
      await ensurePath('/tasks');
      await waitForSelector(T('tasks-tour-landing'), 8000);
    },
  }),
  step({
    id: 'tasks-kpis',
    target: T('tasks-kpis'),
    title: 'Task metrics',
    content: 'Scorecards: Total, In Progress, Completed, and Overdue — delivery health at a glance.',
    placement: 'bottom',
    before: async () => {
      await ensurePath('/tasks');
    },
  }),
  step({
    id: 'tasks-filters',
    target: T('tasks-filters'),
    title: 'Search & filters',
    content:
      'Filter by Project, Milestone, Status, Due, Client Status, Recurrence, Watching, Archive, and search. Refresh reloads the list.',
    before: async () => {
      await ensurePath('/tasks');
    },
  }),
  step({
    id: 'tasks-export-btn',
    target: T('tasks-export-btn'),
    title: 'Export',
    content: 'Download the current filtered tasks as CSV or JSON.',
    before: async () => {
      await ensurePath('/tasks');
      requestTasksExportMenu(false);
      await waitForSelector(T('tasks-export-btn'), 5000);
    },
  }),
  step({
    id: 'tasks-export-csv',
    target: T('tasks-export-csv'),
    title: 'Export CSV',
    content: 'Spreadsheet-friendly export of matching tasks.',
    before: async () => {
      await ensurePath('/tasks');
      requestTasksExportMenu(true);
      await waitForSelector(T('tasks-export-csv'), 4000);
    },
  }),
  step({
    id: 'tasks-export-json',
    target: T('tasks-export-json'),
    title: 'Export JSON',
    content: 'Machine-readable export for backups or integrations.',
    before: async () => {
      await ensurePath('/tasks');
      requestTasksExportMenu(true);
      await waitForSelector(T('tasks-export-json'), 4000);
    },
  }),
  step({
    id: 'tasks-templates-btn',
    target: T('tasks-templates-btn'),
    title: 'Templates',
    content: 'Manage reusable task blueprints (when you can fully manage tasks).',
    before: async () => {
      requestTasksExportMenu(false);
      await ensurePath('/tasks');
      const btn = await waitForSelector(T('tasks-templates-btn'), 2500);
      if (!btn) skipToViewTabs();
    },
  }),
  step({
    id: 'tasks-recurring-btn',
    target: T('tasks-recurring-btn'),
    title: 'Recurring',
    content: 'Review and manage automated recurring task schedules.',
    before: async () => {
      await ensurePath('/tasks');
      const btn = await waitForSelector(T('tasks-recurring-btn'), 2500);
      if (!btn) skipToViewTabs();
    },
  }),
  step({
    id: 'tasks-view-tabs',
    target: T('tasks-view-tabs'),
    title: 'List & Kanban',
    content: 'List is best for search and bulk actions. Kanban shows tasks by status columns with drag-and-drop.',
    before: async () => {
      requestTasksExportMenu(false);
      requestTasksTemplatesOpen(false);
      requestTasksRecurringOpen(false);
      await ensurePath('/tasks');
      await waitForSelector(T('tasks-view-tabs'), 5000);
    },
  }),
  step({
    id: 'tasks-table',
    target: T('tasks-table'),
    title: 'Tasks table',
    content: 'Each row is one task. Click the title to open the task workspace.',
    before: async () => {
      await ensureView('list');
      if (!hasTaskTable() || !hasAnyTaskRow()) skipTaskTableSteps();
    },
  }),
  step({
    id: 'tasks-col-title',
    target: T('tasks-col-title'),
    title: 'Column: Task',
    content: 'Title, badges (priority, recurring, archive), and client review chips.',
    before: async () => {
      if (!hasTaskTable() || !hasAnyTaskRow()) skipTaskTableSteps();
    },
  }),
  step({
    id: 'tasks-col-status',
    target: T('tasks-col-status'),
    title: 'Column: Status',
    content: 'Pipeline status used on Kanban columns.',
    before: async () => {
      if (!hasTaskTable() || !hasAnyTaskRow()) skipTaskTableSteps();
    },
  }),
  step({
    id: 'tasks-col-actions',
    target: T('tasks-col-actions'),
    title: 'Column: Actions',
    content: 'Open, remind, edit, archive, or delete when permitted.',
    before: async () => {
      if (!hasTaskTable() || !hasAnyTaskRow()) skipTaskTableSteps();
    },
  }),
  step({
    id: 'tasks-kanban-board',
    target: T('tasks-kanban'),
    title: 'Kanban board',
    content: 'Tasks grouped by status. Drag cards to update status, or open a card for full detail.',
    before: async () => {
      await ensureView('kanban');
    },
  }),

  // ——— Detail (only when task records exist) ———
  step({
    id: 'tasks-row-first',
    target: `${T('tasks-row-first')}, tr[data-task-id]`,
    title: 'Open a task',
    content:
      'An available task was found. Next opens its workspace so we can walk header actions, tabs, and sidebar.',
    before: async () => {
      await ensureView('list');
      await waitForSelector(T('tasks-create-btn'), 3000);
      if (!hasAnyTaskRow()) {
        skipTaskDetailSteps();
        return;
      }
      await waitForSelector(`${T('tasks-row-first')}, tr[data-task-id]`, 2000);
    },
  }),
  step({
    id: 'tasks-detail-hero',
    target: T('tasks-detail-hero'),
    title: 'Task profile',
    content: 'Header shows title, status, priority, project context, and action buttons.',
    before: async () => {
      if (!hasAnyTaskRow() && !document.querySelector(T('tasks-detail-tabs'))) {
        skipTaskDetailSteps();
        return;
      }
      const ok = await openFirstTask();
      if (!ok) {
        skipTaskDetailSteps();
        return;
      }
      await waitForSelector(T('tasks-detail-hero'), 5000);
    },
  }),
  step({
    id: 'tasks-detail-back',
    target: T('tasks-detail-back'),
    title: 'Back to Tasks',
    content: 'Returns to the Tasks listing.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-status-select',
    target: T('tasks-status-select'),
    title: 'Status',
    content: 'Change task status here without opening Edit.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-timer-btn',
    target: T('tasks-timer-btn'),
    title: 'Start / Stop Timer',
    content: 'Starts a live check-in timer (also shown in the navbar). Stop logs the session.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-detail-template-btn',
    target: T('tasks-detail-template-btn'),
    title: 'Save as Template',
    content: 'Create a reusable template from this task’s fields and checklist.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
      const el = await waitForSelector(T('tasks-detail-template-btn'), 2000);
      if (!el) {
        /* soft-skip via TARGET_NOT_FOUND */
      }
    },
  }),
  step({
    id: 'tasks-send-review-btn',
    target: T('tasks-send-review-btn'),
    title: 'Client review email',
    content: 'Send or resend a client review / reminder email for this task.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-edit-btn',
    target: T('tasks-edit-btn'),
    title: 'Edit',
    content: 'Opens the edit modal to update title, assignee, due date, and more.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-archive-btn',
    target: T('tasks-archive-btn'),
    title: 'Archive / Restore',
    content: 'Archive pauses the task from the active list; Restore brings it back.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-delete-btn',
    target: T('tasks-delete-btn'),
    title: 'Delete',
    content: 'Permanently deletes the task when you have delete permission (tour does not delete).',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-detail-kpis',
    target: T('tasks-detail-kpis'),
    title: 'Task metrics',
    content: 'Checklist progress, labor time logged, billable cost, and client satisfaction.',
    placement: 'bottom',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-detail-tabs',
    target: T('tasks-detail-tabs'),
    title: 'Task tabs',
    content:
      'Overview, Subtasks, Time, Discussion, Emails, History. Next walks each tab.',
    placement: 'bottom',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-tab-overview',
    target: T('tasks-tab-overview'),
    title: 'Overview tab',
    content: 'Description, recurrence, dependencies, and Client Review & Satisfaction settings.',
    before: async () => {
      if (!(await guardTaskDetail(async () => {
        requestTaskDetailTab('overview');
        await waitForSelector(T('tasks-tab-overview'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'tasks-overview-body',
    target: T('tasks-overview-body'),
    title: 'Overview content',
    content: 'Read the description, manage client review status, and save client settings.',
    before: async () => {
      if (!(await guardTaskDetail(async () => {
        requestTaskDetailTab('overview');
        await waitForSelector(T('tasks-overview-body'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'tasks-tab-subtasks',
    target: T('tasks-tab-subtasks'),
    title: 'Subtasks tab',
    content: 'Checklist items with assignees — track granular progress toward completion.',
    before: async () => {
      if (!(await guardTaskDetail(async () => requestTaskDetailTab('subtasks')))) return;
    },
  }),
  step({
    id: 'tasks-tab-time',
    target: T('tasks-tab-time'),
    title: 'Time tab',
    content: 'Live timer, manual time entry, and logged sessions for this task.',
    before: async () => {
      if (!(await guardTaskDetail(async () => requestTaskDetailTab('time')))) return;
    },
  }),
  step({
    id: 'tasks-time-panel',
    target: T('tasks-time-panel'),
    title: 'Time tracking',
    content: 'Start/stop live timer or add manual hours with date, rate, billable flag, and note.',
    before: async () => {
      if (!(await guardTaskDetail(async () => {
        requestTaskDetailTab('time');
        await waitForSelector(T('tasks-time-panel'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'tasks-tab-discussion',
    target: T('tasks-tab-discussion'),
    title: 'Discussion tab',
    content: 'Post comments and follow the conversation timeline on this task.',
    before: async () => {
      if (!(await guardTaskDetail(async () => requestTaskDetailTab('discussion')))) return;
    },
  }),
  step({
    id: 'tasks-tab-emails',
    target: T('tasks-tab-emails'),
    title: 'Emails tab',
    content: 'Client email schedule, send reminder now, and email history for this task.',
    before: async () => {
      if (!(await guardTaskDetail(async () => requestTaskDetailTab('emails')))) return;
    },
  }),
  step({
    id: 'tasks-tab-history',
    target: T('tasks-tab-history'),
    title: 'History tab',
    content: 'Audit-style feed of what changed on this task.',
    before: async () => {
      if (!(await guardTaskDetail(async () => requestTaskDetailTab('history')))) return;
    },
  }),
  step({
    id: 'tasks-sidebar-project',
    target: T('tasks-sidebar-project'),
    title: 'Project context',
    content: 'See the parent project and jump to the project workspace when linked.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-sidebar-watchers',
    target: T('tasks-sidebar-watchers'),
    title: 'Watchers & followers',
    content: 'Watch the task yourself or add/remove followers from the sidebar.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),
  step({
    id: 'tasks-sidebar-quick-actions',
    target: T('tasks-sidebar-quick-actions'),
    title: 'Quick actions',
    content: 'Shortcuts: Timer, Save as Template, Review Email, Add Subtask, Post Comment, Edit Task.',
    before: async () => {
      if (!(await guardTaskDetail())) return;
    },
  }),

  // ——— Finish → Time Logs (only after a real task detail walkthrough) ———
  step({
    id: 'tasks-to-time-logs',
    target: T('time-logs-tour-landing'),
    title: 'Next: Time Logs',
    content:
      'Task time feeds the Time Logs module. You are on Time Logs — click Finish, then the Time Logs tour will walk through Check In, Manual Entry, Weekly view, and more.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      const onDetail = Boolean(document.querySelector(T('tasks-detail-tabs')));
      if (!onDetail) {
        requestTasksTourJump({ finish: true });
        return;
      }
      requestTourNavigate('/time-logs');
      await waitForSelector(T('time-logs-tour-landing'), 10000);
    },
  }),
];
