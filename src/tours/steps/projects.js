/**
 * Projects Beacon onboarding — create form, listing (export/dropped/archive/templates),
 * detail tabs → Tasks. Tour-only; does not change project CRM APIs or save/delete logic.
 * Detail / Tasks redirect skipped when no project records exist.
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestProjectsView,
  requestProjectDetailTab,
  requestProjectsTourJump,
  requestProjectsExportMenu,
  requestProjectsTemplatesOpen,
  requestProjectsTemplatesView,
  requestProjectsArchiveFilter,
} from '../projectsTourState.js';

const T = (id) => `[data-tour="${id}"]`;

function currentPath() {
  const hash = String(window.location.hash || '');
  return hash.replace(/^#/, '').split('?')[0] || '/';
}

async function ensurePath(pathPrefix) {
  const path = currentPath();
  if (pathPrefix === '/projects/create') {
    if (!path.startsWith('/projects/create') && !path.startsWith('/projects/new')) {
      requestTourNavigate('/projects/create');
      await waitForSelector(T('projects-create-form'), 8000);
    }
    return;
  }
  if (pathPrefix === '/projects/dropped') {
    if (path !== '/projects/dropped') {
      requestTourNavigate('/projects/dropped');
      await waitForSelector(T('projects-active-btn'), 8000);
    }
    return;
  }
  if (pathPrefix === '/projects') {
    // Exact active listing — leave dropped / detail / create
    if (path !== '/projects') {
      requestTourNavigate('/projects');
      await waitForSelector(T('projects-tour-landing'), 8000);
    }
    return;
  }
  if (pathPrefix === '/tasks') {
    if (path !== '/tasks' && !path.startsWith('/tasks/')) {
      requestTourNavigate('/tasks');
      await waitForSelector(T('tasks-tour-landing'), 8000);
    }
  }
}

async function ensureView(view) {
  await ensurePath('/projects');
  requestProjectsView(view);
  const map = {
    list: T('projects-table'),
    kanban: T('projects-kanban'),
  };
  await waitForSelector(map[view] || T('projects-view-tabs'), 5000);
  if (view === 'list' && !document.querySelector(map.list)) {
    await waitForSelector(T('projects-view-tabs'), 2000);
  }
}

function hasAnyProjectRow() {
  return Boolean(
    document.querySelector('[data-tour="projects-row-first"]') ||
      document.querySelector('tr[data-project-id]')
  );
}

function hasProjectTable() {
  return Boolean(document.querySelector('[data-tour="projects-table"]'));
}

function stepIndexById(id) {
  return projectsTourSteps.findIndex((s) => s.id === id);
}

/** No projects — end tour after listing (skip open-project / tabs / Tasks redirect). */
function skipProjectDetailSteps() {
  requestProjectsTourJump({ finish: true });
}

/** Empty list — skip table + column steps; keep Kanban listing tip when possible. */
function skipProjectTableSteps() {
  const kanbanIdx = stepIndexById('projects-kanban-board');
  if (kanbanIdx >= 0) requestProjectsTourJump({ stepIndex: kanbanIdx });
  else requestProjectsTourJump({ finish: true });
}

/** No Templates button (no write permission) — skip modal steps. */
function skipTemplateSteps() {
  const viewIdx = stepIndexById('projects-view-tabs');
  if (viewIdx >= 0) requestProjectsTourJump({ stepIndex: viewIdx });
  else requestProjectsTourJump({ finish: true });
}

async function openFirstProject() {
  await ensureView('list');
  if (!hasAnyProjectRow()) return false;
  const row =
    document.querySelector(T('projects-row-first')) ||
    document.querySelector('tr[data-project-id]');
  const id = row?.getAttribute('data-project-id');
  if (!id) return false;
  requestTourNavigate(`/projects/${id}`);
  const tabs = await waitForSelector(T('projects-detail-tabs'), 10000);
  return Boolean(tabs);
}

async function guardProjectDetail(beforeFn) {
  const onDetail = Boolean(document.querySelector(T('projects-detail-tabs')));
  if (!onDetail) {
    await ensurePath('/projects');
    if (!hasAnyProjectRow()) {
      skipProjectDetailSteps();
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

export const projectsTourSteps = [
  step({
    id: 'projects-start-create',
    target: T('projects-create-btn'),
    title: 'Create New Project',
    content:
      'Click New Project to open the create form. Use the beacon, then Next — or click the button yourself.',
    placement: 'bottom',
    before: async () => {
      await ensurePath('/projects');
      requestProjectsView('list');
      await waitForSelector(T('projects-create-btn'), 8000);
    },
  }),

  // ——— Create form ———
  step({
    id: 'projects-form-intro',
    target: T('projects-create-form'),
    title: 'Create Project form',
    content:
      'Set up delivery: client, overview, timeline/budget, custom fields, team, and scope. Next walks each section.',
    placement: 'center',
    before: async () => {
      await ensurePath('/projects/create');
    },
  }),
  step({
    id: 'projects-section-client',
    target: T('projects-section-client'),
    title: 'Client Information',
    content: 'Pick the Client * this delivery belongs to. The card shows account contact and status.',
    before: async () => {
      await ensurePath('/projects/create');
    },
  }),
  step({
    id: 'projects-section-overview',
    target: T('projects-section-overview'),
    title: 'Project Overview',
    content:
      'Name *, category, priority, tags, and status — the identity of the project across list and Kanban.',
  }),
  step({
    id: 'projects-section-timeline',
    target: T('projects-section-timeline'),
    title: 'Timeline, Budget & Tracking',
    content: 'Currency, budget, start date, deadline, and hours estimate for delivery planning.',
  }),
  step({
    id: 'projects-section-custom-fields',
    target: T('projects-section-custom-fields'),
    title: 'Custom Fields',
    content: 'Account-specific attributes and free-form key/value metadata for this project.',
  }),
  step({
    id: 'projects-section-team',
    target: T('projects-section-team'),
    title: 'Assign Team Members',
    content: 'Add employees who will work this project — rates and roles can be refined on the Members tab.',
  }),
  step({
    id: 'projects-section-scope',
    target: T('projects-section-scope'),
    title: 'Scope & Description',
    content: 'Describe deliverables and scope so the team knows what “done” looks like.',
  }),
  step({
    id: 'projects-save-btn',
    target: T('projects-save-btn'),
    title: 'Create Project (Save)',
    content:
      'When required fields are filled, save the project. For the tour, click Next to continue on the listing.',
    placement: 'top',
  }),

  // ——— Listing ———
  step({
    id: 'projects-listing-intro',
    target: T('projects-tour-landing'),
    title: 'Projects listing',
    content:
      'Back on Projects. Next: metrics, filters, Export, Dropped, Archive, Templates, then List/Kanban. Opening a particular project runs only if at least one project exists.',
    placement: 'center',
    before: async () => {
      requestProjectsTemplatesOpen(false);
      requestProjectsExportMenu(false);
      requestProjectsArchiveFilter('false');
      await ensurePath('/projects');
      await waitForSelector(T('projects-tour-landing'), 8000);
    },
  }),
  step({
    id: 'projects-kpis',
    target: T('projects-kpis'),
    title: 'Project metrics',
    content: 'Scorecards: Total, In Progress, Overdue, and Completed — delivery health at a glance.',
    placement: 'bottom',
    before: async () => {
      await ensurePath('/projects');
    },
  }),
  step({
    id: 'projects-filters',
    target: T('projects-filters'),
    title: 'Search & filters',
    content:
      'Search by name/client/tag. Filter Status, Priority, Category, Tag, and Archive. Reset clears filters. List | Kanban toggles views.',
    before: async () => {
      await ensurePath('/projects');
    },
  }),

  // ——— Export ———
  step({
    id: 'projects-export-btn',
    target: T('projects-export-btn'),
    title: 'Export',
    content: 'Download the current filtered list. Opens CSV and JSON options — next shows each format.',
    before: async () => {
      await ensurePath('/projects');
      requestProjectsExportMenu(false);
      await waitForSelector(T('projects-export-btn'), 5000);
    },
  }),
  step({
    id: 'projects-export-csv',
    target: T('projects-export-csv'),
    title: 'Export CSV',
    content: 'Spreadsheet-friendly download of the projects matching your current filters (active, archived, or dropped view).',
    before: async () => {
      await ensurePath('/projects');
      requestProjectsExportMenu(true);
      await waitForSelector(T('projects-export-csv'), 4000);
    },
  }),
  step({
    id: 'projects-export-json',
    target: T('projects-export-json'),
    title: 'Export JSON',
    content: 'Machine-readable export of the same filtered set — useful for backups or integrations.',
    before: async () => {
      await ensurePath('/projects');
      requestProjectsExportMenu(true);
      await waitForSelector(T('projects-export-json'), 4000);
    },
  }),

  // ——— Dropped projects page ———
  step({
    id: 'projects-dropped-btn',
    target: T('projects-dropped-btn'),
    title: 'Dropped Projects',
    content:
      'Opens the Dropped Projects page — deliveries removed from the active workspace that can be reactivated.',
    before: async () => {
      requestProjectsExportMenu(false);
      await ensurePath('/projects');
      await waitForSelector(T('projects-dropped-btn'), 5000);
    },
  }),
  step({
    id: 'projects-dropped-landing',
    target: T('projects-tour-landing'),
    title: 'Dropped Projects page',
    content:
      'This listing shows only dropped projects. Reactivate from the row actions when you are ready to resume delivery.',
    placement: 'center',
    before: async () => {
      await ensurePath('/projects/dropped');
      await waitForSelector(T('projects-active-btn'), 8000);
    },
  }),
  step({
    id: 'projects-dropped-kpis',
    target: T('projects-dropped-kpis'),
    title: 'Dropped metrics',
    content: 'Quick counts: how many projects are dropped and the budget loaded for this view.',
    placement: 'bottom',
    before: async () => {
      await ensurePath('/projects/dropped');
      await waitForSelector(T('projects-dropped-kpis'), 5000);
    },
  }),
  step({
    id: 'projects-active-btn',
    target: T('projects-active-btn'),
    title: 'Back to Active Projects',
    content: 'Returns to the active Projects listing. Next covers Archive.',
    before: async () => {
      await ensurePath('/projects/dropped');
      await waitForSelector(T('projects-active-btn'), 5000);
    },
  }),

  // ——— Archive (in-page archived list) ———
  step({
    id: 'projects-listing-archive-btn',
    target: T('projects-listing-archive-btn'),
    title: 'Archived Projects',
    content:
      'Toggles the archived projects view on this page. Archived projects are paused from active work until restored.',
    before: async () => {
      await ensurePath('/projects');
      requestProjectsArchiveFilter('false');
      await waitForSelector(T('projects-listing-archive-btn'), 5000);
    },
  }),
  step({
    id: 'projects-archive-view',
    target: T('projects-tour-landing'),
    title: 'Archived Projects view',
    content:
      'You are viewing archived projects. Restore from row actions, or use Show Active to return to the live list.',
    placement: 'center',
    before: async () => {
      await ensurePath('/projects');
      requestProjectsArchiveFilter('true');
      await waitForSelector(T('projects-listing-archive-btn'), 5000);
    },
  }),
  step({
    id: 'projects-filter-archive',
    target: T('projects-filter-archive'),
    title: 'Archive filter',
    content:
      'Also filter from here: Active Only, Archived Only, or All (Active & Archived). Reset clears filters.',
    before: async () => {
      await ensurePath('/projects');
      await waitForSelector(T('projects-filter-archive'), 5000);
    },
  }),

  // ——— Templates modal ———
  step({
    id: 'projects-templates-btn',
    target: T('projects-templates-btn'),
    title: 'Templates',
    content:
      'Open reusable project blueprints (when you have write permission). Next walks the Templates modal.',
    before: async () => {
      requestProjectsArchiveFilter('false');
      await ensurePath('/projects');
      requestProjectsTemplatesOpen(false);
      const btn = await waitForSelector(T('projects-templates-btn'), 3000);
      if (!btn) skipTemplateSteps();
    },
  }),
  step({
    id: 'projects-templates-modal',
    target: T('projects-templates-modal'),
    title: 'Templates modal',
    content:
      'Browse reusable Project Templates — search, use, edit, or delete blueprints. Next: create a new template.',
    placement: 'center',
    before: async () => {
      await ensurePath('/projects');
      if (!document.querySelector(T('projects-templates-btn'))) {
        skipTemplateSteps();
        return;
      }
      requestProjectsTemplatesOpen(true);
      await waitForSelector(T('projects-templates-modal'), 5000);
      requestProjectsTemplatesView('list');
      await waitForSelector(T('projects-templates-list'), 4000);
    },
  }),
  step({
    id: 'projects-templates-new-btn',
    target: T('projects-templates-new-btn'),
    title: 'New Template',
    content: 'Starts the Create Project Template form — define milestones, tasks, hours, and budget defaults.',
    before: async () => {
      requestProjectsTemplatesOpen(true);
      requestProjectsTemplatesView('list');
      const btn = await waitForSelector(T('projects-templates-new-btn'), 4000);
      if (!btn) skipTemplateSteps();
    },
  }),
  step({
    id: 'projects-templates-form',
    target: T('projects-templates-form'),
    title: 'Create Project Template',
    content:
      'Name the template, set category/priority/hours/budget, then add reusable milestones and tasks. Save creates the blueprint (tour does not save).',
    placement: 'center',
    before: async () => {
      requestProjectsTemplatesOpen(true);
      requestProjectsTemplatesView('form');
      await waitForSelector(T('projects-templates-form'), 5000);
    },
  }),
  step({
    id: 'projects-templates-list',
    target: T('projects-templates-list'),
    title: 'View templates',
    content:
      'Back on the template list. Each card shows milestones, tasks, and estimated hours. Use Template applies it when creating a project.',
    placement: 'center',
    before: async () => {
      requestProjectsTemplatesOpen(true);
      requestProjectsTemplatesView('list');
      await waitForSelector(T('projects-templates-list'), 5000);
    },
  }),
  step({
    id: 'projects-templates-use',
    target: `${T('projects-templates-use')}, ${T('projects-templates-new-btn')}`,
    title: 'Use or create a template',
    content:
      'Use Template spins up a new project from the blueprint. If none exist yet, use New Template to create the first one. Next closes the modal.',
    before: async () => {
      requestProjectsTemplatesOpen(true);
      requestProjectsTemplatesView('list');
      await waitForSelector(
        `${T('projects-templates-use')}, ${T('projects-templates-new-btn')}`,
        4000
      );
    },
  }),

  step({
    id: 'projects-view-tabs',
    target: T('projects-view-tabs'),
    title: 'List & Kanban',
    content: 'List is best for search and bulk actions. Kanban shows projects by status columns.',
    before: async () => {
      requestProjectsTemplatesOpen(false);
      requestProjectsExportMenu(false);
      requestProjectsArchiveFilter('false');
      await ensurePath('/projects');
      await waitForSelector(T('projects-view-tabs'), 5000);
    },
  }),
  step({
    id: 'projects-table',
    target: T('projects-table'),
    title: 'Projects table',
    content: 'Each row is one project. Click the name to open the delivery workspace.',
    before: async () => {
      await ensureView('list');
      if (!hasProjectTable() || !hasAnyProjectRow()) skipProjectTableSteps();
    },
  }),
  step({
    id: 'projects-col-project',
    target: T('projects-col-project'),
    title: 'Column: Project',
    content: 'Project name, category, deadline, and tags.',
    before: async () => {
      if (!hasProjectTable() || !hasAnyProjectRow()) skipProjectTableSteps();
    },
  }),
  step({
    id: 'projects-col-client',
    target: T('projects-col-client'),
    title: 'Column: Client',
    content: 'Account linked to this delivery.',
    before: async () => {
      if (!hasProjectTable() || !hasAnyProjectRow()) skipProjectTableSteps();
    },
  }),
  step({
    id: 'projects-col-status',
    target: T('projects-col-status'),
    title: 'Column: Status',
    content: 'Pipeline status used on Kanban columns.',
    before: async () => {
      if (!hasProjectTable() || !hasAnyProjectRow()) skipProjectTableSteps();
    },
  }),
  step({
    id: 'projects-col-actions',
    target: T('projects-col-actions'),
    title: 'Column: Actions',
    content: 'Open, edit, or manage the project when permitted.',
    before: async () => {
      if (!hasProjectTable() || !hasAnyProjectRow()) skipProjectTableSteps();
    },
  }),
  step({
    id: 'projects-kanban-board',
    target: T('projects-kanban'),
    title: 'Kanban board',
    content: 'Projects grouped by status. Drag or open a card to manage delivery.',
    before: async () => {
      await ensureView('kanban');
    },
  }),

  // ——— Detail (only when project records exist) ———
  step({
    id: 'projects-row-first',
    target: `${T('projects-row-first')}, tr[data-project-id]`,
    title: 'Open a project',
    content:
      'An available project was found. Next opens its workspace so we can walk header actions, Overview metrics, and tabs.',
    before: async () => {
      await ensureView('list');
      await waitForSelector(T('projects-create-btn'), 3000);
      // Dynamic: no project records → finish listing tour (no particular project / Tasks redirect)
      if (!hasAnyProjectRow()) {
        skipProjectDetailSteps();
        return;
      }
      await waitForSelector(`${T('projects-row-first')}, tr[data-project-id]`, 2000);
    },
  }),
  step({
    id: 'projects-detail-hero',
    target: T('projects-detail-hero'),
    title: 'Project profile',
    content: 'Header shows name, status, priority, client, budget, and team. Action buttons manage the project.',
    before: async () => {
      if (!hasAnyProjectRow() && !document.querySelector(T('projects-detail-tabs'))) {
        skipProjectDetailSteps();
        return;
      }
      const ok = await openFirstProject();
      if (!ok) {
        skipProjectDetailSteps();
        return;
      }
      await waitForSelector(T('projects-detail-hero'), 5000);
    },
  }),
  step({
    id: 'projects-detail-back',
    target: T('projects-detail-back'),
    title: 'Back to Projects',
    content: 'Returns to the Projects listing.',
    before: async () => {
      if (!(await guardProjectDetail())) return;
    },
  }),
  step({
    id: 'projects-edit-btn',
    target: T('projects-edit-btn'),
    title: 'Edit',
    content: 'Opens the edit form to update overview fields.',
    before: async () => {
      if (!(await guardProjectDetail())) return;
    },
  }),
  step({
    id: 'projects-archive-btn',
    target: T('projects-archive-btn'),
    title: 'Archive / Restore',
    content: 'Archive pauses new work on the project; Restore brings it back to the active workspace.',
    before: async () => {
      if (!(await guardProjectDetail())) return;
    },
  }),
  step({
    id: 'projects-drop-btn',
    target: T('projects-drop-btn'),
    title: 'Drop',
    content: 'Drops the project from the active list (with reason). Use Dropped Projects to reactivate later.',
    before: async () => {
      if (!(await guardProjectDetail())) return;
    },
  }),
  step({
    id: 'projects-detail-tabs',
    target: T('projects-detail-tabs'),
    title: 'Project tabs',
    content:
      'Overview, Members, Milestones, Tasks, Board, Gantt, Time, Expenses, Documents, Activity. Next walks each tab.',
    placement: 'bottom',
    before: async () => {
      if (!(await guardProjectDetail())) return;
    },
  }),
  step({
    id: 'projects-tab-overview',
    target: T('projects-tab-overview'),
    title: 'Overview tab',
    content: 'Delivery health: budget, earnings, expenses, profit, progress, hours, and task stats.',
    before: async () => {
      if (!(await guardProjectDetail(async () => {
        requestProjectDetailTab('overview');
        await waitForSelector(T('projects-tab-overview'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'projects-overview-kpis',
    target: T('projects-overview-kpis'),
    title: 'Overview metrics',
    content: 'KPI tiles for Budget, Earnings, Expenses, Profit, Progress, Hours, Tasks done, and Overdue.',
    before: async () => {
      if (!(await guardProjectDetail(async () => {
        requestProjectDetailTab('overview');
        await waitForSelector(T('projects-overview-kpis'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'projects-overview-progress',
    target: T('projects-overview-progress'),
    title: 'Progress bar',
    content: 'Overall completion percentage for this project’s deliverables.',
    before: async () => {
      if (!(await guardProjectDetail())) return;
    },
  }),
  step({
    id: 'projects-tab-members',
    target: T('projects-tab-members'),
    title: 'Members tab',
    content: 'Team roster and hourly rates for this project.',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('members')))) return;
    },
  }),
  step({
    id: 'projects-tab-milestones',
    target: T('projects-tab-milestones'),
    title: 'Milestones tab',
    content: 'Plan phased deliverables and billable milestones.',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('milestones')))) return;
    },
  }),
  step({
    id: 'projects-tab-tasks',
    target: T('projects-tab-tasks'),
    title: 'Tasks tab',
    content: 'List of project tasks with filters, assignees, and status.',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('tasks')))) return;
    },
  }),
  step({
    id: 'projects-tab-board',
    target: T('projects-tab-board'),
    title: 'Board tab',
    content: 'Kanban board of tasks by status for day-to-day execution.',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('board')))) return;
    },
  }),
  step({
    id: 'projects-tab-gantt',
    target: T('projects-tab-gantt'),
    title: 'Gantt tab',
    content: 'Timeline view of tasks and milestones for schedule planning.',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('gantt')))) return;
    },
  }),
  step({
    id: 'projects-tab-time',
    target: T('projects-tab-time'),
    title: 'Time tab',
    content: 'Time logs against this project for utilization and billing.',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('time')))) return;
    },
  }),
  step({
    id: 'projects-tab-expenses',
    target: T('projects-tab-expenses'),
    title: 'Expenses tab',
    content: 'Project costs and expenses (hidden for client portal users).',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('expenses')))) return;
    },
  }),
  step({
    id: 'projects-tab-documents',
    target: T('projects-tab-documents'),
    title: 'Documents tab',
    content: 'Upload and organise project files by category.',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('documents')))) return;
    },
  }),
  step({
    id: 'projects-tab-activity',
    target: T('projects-tab-activity'),
    title: 'Activity tab',
    content: 'Audit-style feed of what changed on this project.',
    before: async () => {
      if (!(await guardProjectDetail(async () => requestProjectDetailTab('activity')))) return;
    },
  }),

  // ——— Finish → Tasks (only after a real project detail walkthrough) ———
  step({
    id: 'projects-to-tasks',
    target: T('tasks-tour-landing'),
    title: 'Next: Tasks',
    content:
      'Projects break down into tasks. You are on the Tasks listing — plan and track deliverables. Tour complete — click Finish.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      // Never pretend a project was opened — skip Tasks redirect when no projects / no detail
      const onDetail = Boolean(document.querySelector(T('projects-detail-tabs')));
      if (!onDetail) {
        requestProjectsTourJump({ finish: true });
        return;
      }
      requestTourNavigate('/tasks');
      await waitForSelector(T('tasks-tour-landing'), 10000);
    },
  }),
];
