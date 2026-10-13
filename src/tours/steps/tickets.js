/**
 * Support Tickets Beacon onboarding — list → create → detail → Finish.
 * Tour-only; does not create/reply/resolve tickets.
 * Soft-skips missing targets (empty list, RBAC-hidden controls).
 * Detail phase: open first ticket once, then stay on detail (no list↔detail remount per step).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestTicketsTourView,
  requestTicketsTourArchive,
  requestTicketsTourTab,
  requestTicketsTourJump,
  firstTicketDetailPath,
} from '../ticketsTourState.js';

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
  if (prefix === '/tickets' && path === '/tickets') {
    await waitForSelector(T('tickets-tour-landing'), 8000);
    return;
  }
  if (prefix === '/tickets/create' && path.startsWith('/tickets/create')) {
    await waitForSelector(T('tickets-create-form'), 8000);
    return;
  }
  if (
    prefix.startsWith('/tickets/') &&
    prefix !== '/tickets/create' &&
    path.startsWith(prefix)
  ) {
    await waitForSelector(T('tickets-detail'), 8000);
    return;
  }

  requestTourNavigate(prefix);
  await wait(400);
  if (prefix === '/tickets') await waitForSelector(T('tickets-tour-landing'), 10000);
  else if (prefix === '/tickets/create') await waitForSelector(T('tickets-create-form'), 10000);
  else await waitForSelector(T('tickets-detail'), 10000);
}

async function ensureListTable() {
  const path = currentPath();
  const alreadyOnList = path === '/tickets';
  await ensurePath('/tickets');
  // Only reset list chrome when arriving from another route.
  if (!alreadyOnList) {
    requestTicketsTourArchive('active');
    requestTicketsTourView('table');
    await wait(350);
  }
  await waitForSelector(T('tickets-table'), 5000);
}

function jumpTo(stepId) {
  const jumpIdx = ticketsTourSteps.findIndex((s) => s.id === stepId);
  if (jumpIdx >= 0) requestTicketsTourJump({ stepIndex: jumpIdx });
}

function hasTicketRow() {
  return Boolean(document.querySelector(T('tickets-row-first')));
}

function isOnTicketDetailPath() {
  const path = currentPath();
  return (
    path.startsWith('/tickets/') &&
    !path.startsWith('/tickets/create') &&
    path !== '/tickets'
  );
}

function skipTicketDetailSteps() {
  jumpTo('tickets-finish');
}

async function ensureCreateOrSkip() {
  if (currentPath().startsWith('/tickets/create')) {
    const form = await waitForSelector(T('tickets-create-form'), 5000);
    return Boolean(form);
  }
  await ensureListTable();
  const btn = await waitForSelector(T('tickets-create-btn'), 2000);
  if (!btn) {
    jumpTo('tickets-open-detail');
    return false;
  }
  await ensurePath('/tickets/create');
  const form = await waitForSelector(T('tickets-create-form'), 5000);
  if (!form) {
    jumpTo('tickets-open-detail');
    return false;
  }
  return true;
}

/** Open first ticket once (list → detail). */
async function openFirstTicketOrSkip() {
  if (isOnTicketDetailPath()) {
    const detail = await waitForSelector(T('tickets-detail'), 10000);
    if (detail) {
      requestTicketsTourTab('conversation');
      return true;
    }
  }
  await ensureListTable();
  await waitForSelector(T('tickets-table'), 5000);
  const detailPath = firstTicketDetailPath();
  if (!detailPath || !hasTicketRow()) {
    skipTicketDetailSteps();
    return false;
  }
  requestTourNavigate(detailPath);
  await wait(500);
  requestTicketsTourTab('conversation');
  await wait(200);
  const detail = await waitForSelector(T('tickets-detail'), 10000);
  if (!detail) {
    skipTicketDetailSteps();
    return false;
  }
  return true;
}

/** Stay on detail — no list↔detail remount on every step. */
async function guardTicketDetail(beforeFn) {
  if (document.querySelector(T('tickets-detail'))) {
    if (beforeFn) await beforeFn();
    return true;
  }
  if (isOnTicketDetailPath()) {
    await waitForSelector(T('tickets-detail'), 10000);
    if (document.querySelector(T('tickets-detail'))) {
      if (beforeFn) await beforeFn();
      return true;
    }
  }
  const ok = await openFirstTicketOrSkip();
  if (ok && beforeFn) await beforeFn();
  return ok;
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

export const ticketsTourSteps = [
  step({
    id: 'tickets-welcome',
    target: T('tickets-title'),
    title: 'Support Tickets',
    content:
      'Track cases, SLA targets, assignments, and resolution. Click Next to walk through the list, create form, and a ticket detail page.',
    skipBeacon: true,
    before: async () => {
      await ensureListTable();
    },
  }),

  step({
    id: 'tickets-header-actions',
    target: T('tickets-header-actions'),
    title: 'List toolbar',
    content:
      'Refresh reloads the queue. Export downloads CSV or JSON. New Ticket opens the create form. Tour restarts this walkthrough.',
    before: async () => {
      await ensureListTable();
    },
  }),

  step({
    id: 'tickets-kpis',
    target: T('tickets-kpis'),
    title: 'Support KPIs',
    content:
      'Four cards: Total Cases, Open Complaints, SLA Breached, and Resolved & Closed — spot workload and SLA risk at a glance.',
    before: async () => {
      await ensureListTable();
    },
  }),

  step({
    id: 'tickets-view-tabs',
    target: T('tickets-view-tabs'),
    title: 'Table | Kanban',
    content:
      'Table is the searchable list with pagination. Kanban shows Open → Closed columns with drag-and-drop status changes for staff.',
    before: async () => {
      await ensureListTable();
    },
  }),

  step({
    id: 'tickets-archive-tabs',
    target: T('tickets-archive-tabs'),
    title: 'Active | Archived',
    content:
      'Active is the working queue. Archived holds soft-archived cases kept for history.',
    before: async () => {
      await ensureListTable();
      requestTicketsTourArchive('active');
      await wait(200);
    },
  }),

  step({
    id: 'tickets-status-pills',
    target: T('tickets-status-pills'),
    title: 'Status pills',
    content:
      'Filter by All, Open, In Progress, Pending Client, Resolved, or Closed without leaving the page.',
    before: async () => {
      await ensureListTable();
    },
  }),

  step({
    id: 'tickets-filters',
    target: T('tickets-filters'),
    title: 'Search & filters',
    content:
      'Search by ticket #, subject, or requester. Filter by Priority, Type, Group, and Channel. Attention Radar can deep-link escalations here.',
    before: async () => {
      await ensureListTable();
    },
  }),

  step({
    id: 'tickets-table',
    target: T('tickets-table'),
    title: 'Tickets table',
    content:
      'Columns: Ticket ID, Subject & Requester, Group & Channel, Type, Priority, SLA, Status, Assignee, Actions (Open). Soft-skipped when empty.',
    before: async () => {
      await ensureListTable();
      await wait(300);
      if (!hasTicketRow()) {
        jumpTo('tickets-create-btn');
      }
    },
  }),

  step({
    id: 'tickets-kanban',
    target: T('tickets-kanban'),
    title: 'Kanban board',
    content:
      'Five columns by status. Staff can drag cards or use quick → status buttons. Click a card to open detail. Soft-skipped for clients or if empty.',
    before: async () => {
      await ensurePath('/tickets');
      requestTicketsTourView('kanban');
      await wait(400);
      await waitForSelector(T('tickets-kanban'), 4000);
    },
  }),

  step({
    id: 'tickets-create-btn',
    target: T('tickets-create-btn'),
    title: 'New Ticket',
    content:
      'Starts a new support case. Next opens the create form. Soft-skipped without write permission.',
    before: async () => {
      await ensureListTable();
      await waitForSelector(T('tickets-create-btn'), 2500);
    },
  }),

  step({
    id: 'tickets-create-welcome',
    target: T('tickets-create-form'),
    title: 'Create Support Ticket',
    content:
      'Three sections: assignment, subject/details, and priority/channel/tags. We will not submit during the tour.',
    skipBeacon: true,
    before: async () => {
      await ensureCreateOrSkip();
    },
  }),

  step({
    id: 'tickets-create-assignment',
    target: T('tickets-create-assignment'),
    title: '1. Assignment & Category',
    content:
      'Assign Group *, optional Assigned Agent (staff), Project, and Ticket Type *. Staff can + Add Group / Type from settings.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('tickets-create-assignment'), 4000);
    },
  }),

  step({
    id: 'tickets-create-details',
    target: T('tickets-create-details'),
    title: '2. Subject & Description',
    content:
      'Ticket Subject * (short summary) and Detailed Description * (steps, logs, context).',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('tickets-create-details'), 4000);
    },
  }),

  step({
    id: 'tickets-create-priority',
    target: T('tickets-create-priority'),
    title: '3. Priority, Channel & Tags',
    content:
      'Priority * sets SLA hours, Channel * (Email, Phone, etc.), Tags, and the Estimated SLA preview. Soft-skipped if form blocked.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('tickets-create-priority'), 4000);
    },
  }),

  step({
    id: 'tickets-create-actions',
    target: T('tickets-create-actions'),
    title: 'Cancel & Create',
    content:
      'Cancel returns to the list. Create Support Ticket saves and opens the new ticket detail — we skip saving on the tour.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('tickets-create-actions'), 4000);
    },
  }),

  step({
    id: 'tickets-open-detail',
    target: T('tickets-detail'),
    title: 'Ticket detail',
    content:
      'Header shows ticket number, subject, status, priority, escalation, and SLA badges.',
    skipBeacon: true,
    before: async () => {
      if (!(await openFirstTicketOrSkip())) return;
    },
  }),

  step({
    id: 'tickets-detail-tabs',
    target: T('tickets-detail-tabs'),
    title: 'Detail tabs',
    content:
      'Conversation (day-to-day replies), Timeline (reassignment audit), and Watchers (staff only).',
    before: async () => {
      if (!(await guardTicketDetail())) return;
      await waitForSelector(T('tickets-detail-tabs'), 4000);
    },
  }),

  step({
    id: 'tickets-detail-conversation',
    target: T('tickets-detail-conversation'),
    title: 'Conversation & reply',
    content:
      'Message thread plus reply form: Public Reply or Internal Note (staff), canned responses, attachments, and Send.',
    before: async () => {
      if (
        !(await guardTicketDetail(async () => {
          requestTicketsTourTab('conversation');
          await wait(200);
        }))
      ) {
        return;
      }
      await waitForSelector(T('tickets-detail-conversation'), 4000);
    },
  }),

  step({
    id: 'tickets-detail-sidebar',
    target: T('tickets-detail-sidebar'),
    title: 'Details & Actions',
    content:
      'Sidebar shows requester, assignee, group, type, channel, project, created date. Staff Actions: Status, Assign, Escalate, Mark Resolved, Close, Archive. Soft-skipped when Actions are hidden for clients.',
    before: async () => {
      if (!(await guardTicketDetail())) return;
      await waitForSelector(T('tickets-detail-sidebar'), 4000);
    },
  }),

  step({
    id: 'tickets-finish',
    target: T('tickets-tour-landing'),
    title: 'You are set',
    content:
      'You have seen list KPIs & views, create fields, and detail conversation/actions. Click Finish when ready.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/tickets');
      requestTicketsTourView('table');
      requestTicketsTourArchive('active');
    },
  }),
];
