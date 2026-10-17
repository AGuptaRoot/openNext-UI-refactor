/**
 * Contacts Beacon onboarding — list → create → detail → Finish.
 * Tour-only; does not create/delete/link contacts.
 * Soft-skips missing targets (empty list, RBAC-hidden controls).
 */
import {
  requestTourNavigate,
  waitForSelector,
  requestContactsTourJump,
  firstContactDetailPath,
} from '../contactsTourState.js';

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
  if (prefix === '/contacts' && path === '/contacts') {
    await waitForSelector(T('contacts-tour-landing'), 8000);
    return;
  }
  if (prefix === '/contacts/create' && path.startsWith('/contacts/create')) {
    await waitForSelector(T('contacts-create-form'), 8000);
    return;
  }
  if (
    prefix.startsWith('/contacts/') &&
    prefix !== '/contacts/create' &&
    path.startsWith(prefix)
  ) {
    await waitForSelector(T('contacts-detail'), 8000);
    return;
  }

  requestTourNavigate(prefix);
  await wait(400);
  if (prefix === '/contacts') await waitForSelector(T('contacts-tour-landing'), 10000);
  else if (prefix === '/contacts/create') await waitForSelector(T('contacts-create-form'), 10000);
  else await waitForSelector(T('contacts-detail'), 10000);
}

async function ensureList() {
  await ensurePath('/contacts');
  await waitForSelector(T('contacts-table'), 5000);
}

function jumpTo(stepId) {
  const jumpIdx = contactsTourSteps.findIndex((s) => s.id === stepId);
  if (jumpIdx >= 0) requestContactsTourJump({ stepIndex: jumpIdx });
}

function hasContactRow() {
  return Boolean(document.querySelector(T('contacts-row-first')));
}

function isOnContactDetailPath() {
  const path = currentPath();
  return (
    path.startsWith('/contacts/') &&
    !path.startsWith('/contacts/create') &&
    path !== '/contacts'
  );
}

async function ensureCreateOrSkip() {
  if (currentPath().startsWith('/contacts/create')) {
    const form = await waitForSelector(T('contacts-create-form'), 5000);
    return Boolean(form);
  }
  await ensureList();
  const btn = await waitForSelector(T('contacts-create-btn'), 2000);
  if (!btn) {
    jumpTo('contacts-open-detail');
    return false;
  }
  await ensurePath('/contacts/create');
  const form = await waitForSelector(T('contacts-create-form'), 5000);
  if (!form) {
    jumpTo('contacts-open-detail');
    return false;
  }
  return true;
}

async function openFirstContactOrSkip() {
  if (isOnContactDetailPath()) {
    const detail = await waitForSelector(T('contacts-detail'), 10000);
    return Boolean(detail);
  }
  await ensureList();
  const detailPath = firstContactDetailPath();
  if (!detailPath || !hasContactRow()) {
    jumpTo('contacts-finish');
    return false;
  }
  requestTourNavigate(detailPath);
  await wait(500);
  const detail = await waitForSelector(T('contacts-detail'), 10000);
  if (!detail) {
    jumpTo('contacts-finish');
    return false;
  }
  return true;
}

async function guardContactDetail() {
  if (document.querySelector(T('contacts-detail'))) return true;
  if (isOnContactDetailPath()) {
    await waitForSelector(T('contacts-detail'), 10000);
    if (document.querySelector(T('contacts-detail'))) return true;
  }
  return openFirstContactOrSkip();
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

export const contactsTourSteps = [
  step({
    id: 'contacts-welcome',
    target: T('contacts-title'),
    title: 'Contacts directory',
    content:
      'People shared across leads and clients. Add a contact once, then reuse it instead of retyping details. Next walks the list, create form, and a contact profile.',
    skipBeacon: true,
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'contacts-header-actions',
    target: T('contacts-header-actions'),
    title: 'List toolbar',
    content:
      'Refresh reloads the directory. New Contact opens the create form. Tour restarts this walkthrough.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'contacts-filters',
    target: T('contacts-filters'),
    title: 'Search contacts',
    content:
      'Search by name, email, mobile, PAN, or job title. Reset clears the query. Soft-skipped if filters are hidden.',
    before: async () => {
      await ensureList();
    },
  }),

  step({
    id: 'contacts-table',
    target: T('contacts-table'),
    title: 'Contacts table',
    content:
      'Columns: Contact, Company, Job title, Email, Mobile, linked Leads & Clients, and Actions (View / Delete). Soft-skipped when empty.',
    before: async () => {
      await ensureList();
      await wait(250);
      if (!hasContactRow()) {
        jumpTo('contacts-create-btn');
      }
    },
  }),

  step({
    id: 'contacts-create-btn',
    target: T('contacts-create-btn'),
    title: 'New Contact',
    content:
      'Opens the create form. Soft-skipped without write permission — the tour then jumps to detail if a contact exists.',
    before: async () => {
      await ensureList();
      await waitForSelector(T('contacts-create-btn'), 2500);
    },
  }),

  step({
    id: 'contacts-create-welcome',
    target: T('contacts-create-form'),
    title: 'Create Contact',
    content:
      'Add a person once and reuse them on leads and clients. We will not submit during the tour.',
    skipBeacon: true,
    before: async () => {
      await ensureCreateOrSkip();
    },
  }),

  step({
    id: 'contacts-create-ocr',
    target: T('contacts-create-ocr'),
    title: 'Scan Visiting Card (OCR)',
    content:
      'Optional OCR can prefill name, company, email, and phone from a visiting card image. Soft-skipped if hidden.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('contacts-create-ocr'), 3000);
    },
  }),

  step({
    id: 'contacts-create-fields',
    target: T('contacts-create-fields'),
    title: 'Contact fields',
    content:
      'Photo, salutation, name, email, mobile, gender, PAN, company, and job title. Duplicate checks run when email / mobile / PAN blur.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('contacts-create-fields'), 4000);
    },
  }),

  step({
    id: 'contacts-create-actions',
    target: T('contacts-create-actions'),
    title: 'Cancel & Create',
    content:
      'Cancel returns to the list. Create Contact saves and opens the profile — we skip saving on the tour.',
    before: async () => {
      await ensureCreateOrSkip();
      await waitForSelector(T('contacts-create-actions'), 4000);
    },
  }),

  step({
    id: 'contacts-open-detail',
    target: T('contacts-detail'),
    title: 'Contact profile',
    content:
      'Header shows name, company, and reachability. Soft-skipped when the directory is empty.',
    skipBeacon: true,
    before: async () => {
      if (!(await openFirstContactOrSkip())) return;
    },
  }),

  step({
    id: 'contacts-detail-form',
    target: T('contacts-detail-form'),
    title: 'Edit contact',
    content:
      'Update the same fields as create, then Save. Linked leads and clients keep copied details if you delete the contact later.',
    before: async () => {
      if (!(await guardContactDetail())) return;
      await waitForSelector(T('contacts-detail-form'), 4000);
    },
  }),

  step({
    id: 'contacts-detail-links',
    target: T('contacts-detail-links'),
    title: 'Linked leads & clients',
    content:
      'See and open linked leads/clients, or link existing records. Soft-skipped when the links panel is hidden.',
    before: async () => {
      if (!(await guardContactDetail())) return;
      await waitForSelector(T('contacts-detail-links'), 4000);
    },
  }),

  step({
    id: 'contacts-finish',
    target: T('contacts-tour-landing'),
    title: 'You are set',
    content:
      'You have seen the directory, create form, and contact profile. Click Finish when ready.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      await ensurePath('/contacts');
    },
  }),
];
