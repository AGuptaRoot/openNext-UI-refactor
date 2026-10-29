import {
  requestLeadsView,
  requestTourNavigate,
  waitForSelector,
  requestLeadsTourJump,
} from '../leadsTourState.js';

const T = (id) => `[data-tour="${id}"]`;

function currentPath() {
  const hash = String(window.location.hash || '');
  return hash.replace(/^#/, '').split('?')[0] || '/';
}

async function ensurePath(pathPrefix) {
  const path = currentPath();
  if (pathPrefix === '/leads/create') {
    if (!path.startsWith('/leads/create')) {
      requestTourNavigate('/leads/create');
      await waitForSelector(T('leads-field-title'), 8000);
    }
    return;
  }
  if (pathPrefix === '/leads') {
    if (path !== '/leads') {
      requestTourNavigate('/leads');
      await waitForSelector(T('leads-create-btn'), 8000);
    }
    return;
  }
  if (pathPrefix === '/clients') {
    if (path !== '/clients' && !path.startsWith('/clients/')) {
      requestTourNavigate('/clients');
      await waitForSelector(T('clients-tour-landing'), 8000);
    }
  }
}

/** Reveal the (initially hidden) "Create contact" form on the Create Lead page. */
async function ensureContactForm() {
  await ensurePath('/leads/create');
  if (!document.querySelector(T('leads-field-email'))) {
    window.dispatchEvent(new CustomEvent('crm-leads-tour-open-contact-form'));
    await waitForSelector(T('leads-field-email'), 4000);
  }
}

async function ensureView(view) {
  await ensurePath('/leads');
  requestLeadsView(view);
  const map = {
    list: T('leads-table'),
    kanban: T('leads-kanban-board'),
    report: T('leads-report-root'),
  };
  // Prefer view chrome; table may be empty-state
  await waitForSelector(map[view] || T('leads-view-tabs'), 5000);
  if (view === 'list' && !document.querySelector(map.list)) {
    await waitForSelector(T('leads-view-tabs'), 2000);
  }
}

function hasAnyLeadRow() {
  return Boolean(
    document.querySelector('[data-tour="leads-row-new"]') ||
      document.querySelector('tr[data-lead-id]')
  );
}

function hasLeadTable() {
  return Boolean(document.querySelector('[data-tour="leads-table"]'));
}

function stepIndexById(id) {
  return leadsTourSteps.findIndex((s) => s.id === id);
}

/** No leads — end tour after listing steps (skip detail / stage / convert). */
function skipLeadDetailSteps() {
  requestLeadsTourJump({ finish: true });
}

/** Empty list — skip table + column steps; keep kanban / BI listing steps. */
function skipLeadTableSteps() {
  const kanbanIdx = stepIndexById('leads-kanban-board');
  if (kanbanIdx >= 0) requestLeadsTourJump({ stepIndex: kanbanIdx });
  else requestLeadsTourJump({ finish: true });
}

async function openFirstLeadForTour() {
  const path = currentPath();
  if (path.startsWith('/leads/') && !path.startsWith('/leads/create')) {
    const tabs = await waitForSelector(T('leads-detail-tabs'), 8000);
    return Boolean(tabs);
  }
  await ensureView('list');
  if (!hasAnyLeadRow()) return false;
  let row = document.querySelector(T('leads-row-new'));
  if (!row) row = document.querySelector('tr[data-lead-id]');
  const id = row?.getAttribute('data-lead-id');
  if (!id) return false;
  requestTourNavigate(`/leads/${id}`);
  const tabs = await waitForSelector(T('leads-detail-tabs'), 8000);
  return Boolean(tabs);
}

function requestLeadTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-leads-tour-tab', { detail: { tab } }));
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

async function guardLeadDetail(beforeFn) {
  if (document.querySelector(T('leads-detail-tabs'))) {
    if (beforeFn) await beforeFn();
    return true;
  }
  const path = currentPath();
  if (path.startsWith('/leads/') && !path.startsWith('/leads/create')) {
    await waitForSelector(T('leads-detail-tabs'), 8000);
    if (document.querySelector(T('leads-detail-tabs'))) {
      if (beforeFn) await beforeFn();
      return true;
    }
  }
  if (!currentPath().startsWith('/leads/')) {
    await ensureView('list');
  }
  const onDetail = Boolean(document.querySelector(T('leads-detail-tabs')));
  if (!onDetail && !hasAnyLeadRow()) {
    skipLeadDetailSteps();
    return false;
  }
  if (beforeFn) await beforeFn();
  return true;
}

/**
 * Leads Beacon onboarding — required create fields, list/kanban/BI,
 * New-lead detail tabs, stage→Won, Convert to Client → Clients list.
 */
export const leadsTourSteps = [
  // ——— Start ———
  step({
    id: 'leads-start-create',
    target: T('leads-create-btn'),
    title: 'Create New Lead',
    content:
      'Click Create lead to open the form and add a prospect. Use the beacon, then Next — or click the button yourself.',
    placement: 'bottom',
    before: async () => {
      await ensurePath('/leads');
      requestLeadsView('list');
      await waitForSelector(T('leads-create-btn'), 8000);
    },
  }),

  // ——— Create form: required + image + location only ———
  step({
    id: 'leads-form-intro',
    target: T('leads-create-form'),
    title: 'Create Lead form',
    content:
      'We will only cover required fields (marked *), plus photo upload and location. Optional fields can be filled later.',
    placement: 'center',
    before: async () => {
      await ensurePath('/leads/create');
      await waitForSelector(T('leads-create-form'), 8000);
    },
  }),
  step({
    id: 'leads-field-name',
    target: T('leads-field-title'),
    title: 'Lead Title *',
    content:
      'Required. A short name for this opportunity. Purpose: recognise the deal at a glance in lists and Kanban. Example: ERP rollout for Acme Pvt Ltd.',
    before: async () => {
      await ensurePath('/leads/create');
    },
  }),
  step({
    id: 'leads-field-company',
    target: T('leads-field-company'),
    title: 'Company Name *',
    content:
      'Required. The organisation behind the lead. Purpose: account tracking and reporting. Example: Acme Pvt Ltd — this becomes the Client company when you convert.',
  }),
  step({
    id: 'leads-field-email',
    target: T('leads-field-email'),
    title: 'Contact Email *',
    content:
      'Required for a new contact person. Primary email for outreach. Purpose: quotes, follow-ups, and duplicate checks. Example: priya@acme.com.',
    before: ensureContactForm,
  }),
  step({
    id: 'leads-field-phone',
    target: T('leads-field-phone'),
    title: 'Contact Mobile *',
    content:
      'Required for a new contact person. Best number to reach them. Purpose: calls and WhatsApp follow-ups. Example: +91 98765 43210.',
    before: ensureContactForm,
  }),
  step({
    id: 'leads-field-stage',
    target: T('leads-field-stage'),
    title: 'Pipeline Stage *',
    content:
      'Required. Where this deal sits in your sales funnel. Purpose: Kanban columns and BI. Example: start as New, then move to Contacted after the first call.',
  }),
  step({
    id: 'leads-field-source',
    target: T('leads-field-source'),
    title: 'Lead Source',
    content:
      'Required for tracking. Where the lead came from. Purpose: measure which channels work. Example: Website or Referral — appears in “Top Acquisition Sources”.',
  }),
  step({
    id: 'leads-field-value',
    target: T('leads-field-value'),
    title: 'Budget / Value',
    content:
      'Estimated deal budget in INR. Purpose: pipeline value and prioritisation. Example: 250000 for a mid-size project — rolls into Kanban and Funnel totals.',
  }),
  step({
    id: 'leads-field-photo',
    target: T('leads-field-photo'),
    title: 'Contact Photo',
    content:
      'Upload the contact person’s photo (or a visiting card image) so your team can recognise them quickly. It is stored with the contact and shown on the lead.',
    before: ensureContactForm,
  }),
  step({
    id: 'leads-field-location',
    target: T('leads-field-location'),
    title: 'Location',
    content:
      'Stores customer/lead location details for sales planning and regional analysis — city, address, and map coordinates when available.',
  }),
  step({
    id: 'leads-save',
    target: T('leads-save-btn'),
    title: 'Create Lead (Save)',
    content:
      'When required fields are filled, click Create Lead to save. For the tour, click Next to continue on the listing — you can save a real lead anytime.',
    placement: 'top',
  }),

  // ——— Listing / views ———
  step({
    id: 'leads-after-save',
    target: T('leads-view-tabs'),
    title: 'Leads listing',
    content:
      'Back on Leads. Next we cover List, Kanban, and Funnel & BI. Lead detail steps run only if at least one lead exists.',
    placement: 'bottom',
    before: async () => {
      await ensurePath('/leads');
      requestLeadsView('list');
      await waitForSelector(T('leads-view-tabs'), 8000);
    },
  }),
  step({
    id: 'leads-tab-list-intro',
    target: T('leads-tab-list'),
    title: 'List View',
    content: 'Table view for search, sort, bulk actions, and opening leads. Best for daily outbound work.',
    before: async () => {
      await ensureView('list');
    },
  }),
  step({
    id: 'leads-tab-kanban-intro',
    target: T('leads-tab-kanban'),
    title: 'Kanban Board',
    content: 'Visual pipeline by stage. Drag cards between columns to move deals forward.',
  }),
  step({
    id: 'leads-tab-report-intro',
    target: T('leads-tab-report'),
    title: 'Funnel & BI Report',
    content: 'Analytics for totals, won/lost, stage mix, owners, and sources.',
  }),
  step({
    id: 'leads-filters',
    target: T('leads-filters'),
    title: 'Search & filters',
    content: 'Filter by preset, stage, status, source, tag, and search text before you call or export.',
    before: async () => {
      await ensureView('list');
    },
  }),
  step({
    id: 'leads-table',
    target: T('leads-table'),
    title: 'Leads table',
    content: 'Each row is one lead. Click a name to open detail. Columns are sortable; checkboxes enable bulk stage changes.',
    before: async () => {
      await ensureView('list');
      if (!hasLeadTable() || !hasAnyLeadRow()) {
        skipLeadTableSteps();
      }
    },
  }),
  step({
    id: 'leads-col-name',
    target: T('leads-col-name'),
    title: 'Column: Lead Name',
    content: 'Prospect name — click to open. Sort A–Z to find someone quickly.',
    before: async () => {
      if (!hasLeadTable() || !hasAnyLeadRow()) skipLeadTableSteps();
    },
  }),
  step({
    id: 'leads-col-company',
    target: T('leads-col-company'),
    title: 'Column: Company',
    content: 'Organisation linked to the lead — avoid duplicate outreach to the same account.',
    before: async () => {
      if (!hasLeadTable() || !hasAnyLeadRow()) skipLeadTableSteps();
    },
  }),
  step({
    id: 'leads-col-contact',
    target: T('leads-col-contact'),
    title: 'Column: Contact',
    content: 'Email / contact info for quick follow-up.',
    before: async () => {
      if (!hasLeadTable() || !hasAnyLeadRow()) skipLeadTableSteps();
    },
  }),
  step({
    id: 'leads-col-stage',
    target: T('leads-col-stage'),
    title: 'Column: Stage + ageing',
    content: 'Pipeline stage plus ageing badges — red flags mean follow up now.',
    before: async () => {
      if (!hasLeadTable() || !hasAnyLeadRow()) skipLeadTableSteps();
    },
  }),
  step({
    id: 'leads-col-owner',
    target: T('leads-col-owner'),
    title: 'Column: Assigned Rep',
    content: 'Owner of the lead — managers use this to balance workload.',
    before: async () => {
      if (!hasLeadTable() || !hasAnyLeadRow()) skipLeadTableSteps();
    },
  }),
  step({
    id: 'leads-col-actions',
    target: T('leads-col-actions'),
    title: 'Column: Actions',
    content: 'Row actions such as view, convert (when Won), or delete if permitted.',
    before: async () => {
      if (!hasLeadTable() || !hasAnyLeadRow()) skipLeadTableSteps();
    },
  }),

  // ——— Kanban + BI (short) ———
  step({
    id: 'leads-kanban-board',
    target: T('leads-kanban-board'),
    title: 'Kanban board',
    content:
      'Columns = stages. Drag a card to another column to update stage automatically. Click a card to open detail.',
    before: async () => {
      await ensureView('kanban');
    },
  }),
  step({
    id: 'leads-report-kpis',
    target: T('leads-report-root'),
    title: 'Funnel & BI',
    content:
      'Scorecards (Total, Active, Won, Converted, Lost) plus stage, owner, and source charts for Sales Reps and Managers.',
    before: async () => {
      await ensureView('report');
    },
  }),

  // ——— Lead detail (only when lead records exist) ———
  step({
    id: 'leads-row-new',
    target: `${T('leads-row-new')}, tr[data-lead-id]`,
    title: 'Open a lead',
    content:
      'An available lead was found. Next opens its detail page so we can walk tabs, stage, and convert.',
    before: async () => {
      await ensureView('list');
      await waitForSelector(T('leads-view-tabs'), 3000);
      // Dynamic: no lead records → finish listing tour (no detail / convert steps)
      if (!hasAnyLeadRow()) {
        skipLeadDetailSteps();
        return;
      }
      await waitForSelector(`${T('leads-row-new')}, tr[data-lead-id]`, 2000);
    },
  }),
  step({
    id: 'leads-detail-intro',
    target: T('leads-detail-tabs'),
    title: 'Lead detail workspace',
    content:
      'Full lead record. Tabs below organise Details, Qualification, Activities, Notes, Follow-ups, and Audit History.',
    before: async () => {
      const ok = await openFirstLeadForTour();
      if (!ok) {
        skipLeadDetailSteps();
        return;
      }
      await waitForSelector(T('leads-detail-tabs'), 5000);
    },
  }),
  step({
    id: 'leads-tab-details',
    target: T('leads-tab-details'),
    title: 'Details tab',
    content:
      'Complete lead information — profile, company, contact, pipeline, tags, documents, and editable fields. Your source of truth for the prospect.',
    before: async () => {
      if (!(await guardLeadDetail(async () => {
        requestLeadTab('details');
        await waitForSelector(T('leads-tab-details'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'leads-tab-qualification',
    target: T('leads-tab-qualification'),
    title: 'Qualification tab',
    content:
      'Sales checklist to qualify the lead (budget, authority, need, timeline, etc.). Use it before investing more effort or converting.',
    before: async () => {
      if (!(await guardLeadDetail(async () => requestLeadTab('qualification')))) return;
    },
  }),
  step({
    id: 'leads-tab-activities',
    target: T('leads-tab-activities'),
    title: 'Activities tab',
    content:
      'Track calls, emails, meetings, and other interactions. Keeps the team aligned on what already happened with this lead.',
    before: async () => {
      if (!(await guardLeadDetail(async () => requestLeadTab('activities')))) return;
    },
  }),
  step({
    id: 'leads-tab-notes',
    target: T('leads-tab-notes'),
    title: 'Notes tab',
    content:
      'Store extra context — conversation notes, preferences, blockers — that does not fit structured fields.',
    before: async () => {
      if (!(await guardLeadDetail(async () => requestLeadTab('notes')))) return;
    },
  }),
  step({
    id: 'leads-tab-audit',
    target: T('leads-tab-audit'),
    title: 'Audit History tab',
    content:
      'Shows who changed what and when (stage moves, edits, conversions). Useful for managers and compliance.',
    before: async () => {
      if (!(await guardLeadDetail(async () => requestLeadTab('audit')))) return;
    },
  }),

  // ——— Stage → Won → Convert (only on an open lead) ———
  step({
    id: 'leads-stage-select',
    target: T('leads-stage-select'),
    title: 'Change stage',
    content:
      'Users can move leads through different sales stages based on progress.',
    before: async () => {
      if (!(await guardLeadDetail(async () => {
        requestLeadTab('details');
        await waitForSelector(T('leads-stage-select'), 3000);
      }))) return;
    },
  }),
  step({
    id: 'leads-stage-ask-won',
    target: T('leads-stage-select'),
    title: 'Try it: set stage to Won',
    content:
      'Can you change this lead stage to Won for showing the Convert Client button? Pick Won in the Stage dropdown, wait for the page to update, then click Next.',
    placement: 'bottom',
    before: async () => {
      if (!(await guardLeadDetail())) return;
    },
  }),
  step({
    id: 'leads-convert-btn',
    target: T('leads-convert-btn'),
    title: 'Convert to Client',
    content:
      'This button converts a successful lead into a client record. Click Convert to Client and confirm, then click Next.',
    placement: 'bottom',
    targetWaitTimeout: 15000,
    before: async () => {
      if (!document.querySelector(T('leads-detail-tabs'))) {
        skipLeadDetailSteps();
        return;
      }
      const btn = await waitForSelector(T('leads-convert-btn'), 15000);
      // Convert only when Won — otherwise end tour (do not pretend the button exists)
      if (!btn) {
        requestLeadsTourJump({ finish: true });
      }
    },
  }),
  step({
    id: 'leads-converted-clients',
    target: T('clients-tour-landing'),
    title: 'Lead converted to Client',
    content:
      'The lead has now been converted into a client. You are on the Client Listing page. Tour complete — click Finish.',
    placement: 'center',
    skipBeacon: true,
    before: async () => {
      requestTourNavigate('/clients');
      await waitForSelector(T('clients-tour-landing'), 10000);
    },
  }),
];
