/**
 * Dashboard Beacon onboarding — header controls, KPIs, Attention Radar, widgets.
 * Tour-only; does not change dashboard load/save/period logic.
 */

const T = (id) => `[data-tour="${id}"]`;

function step(partial) {
  return {
    placement: 'auto',
    skipBeacon: false,
    beaconTrigger: 'click',
    targetWaitTimeout: 6000,
    ...partial,
  };
}

export const dashboardTourSteps = [
  step({
    id: 'dashboard-welcome',
    target: T('dashboard-title'),
    title: 'CRM Dashboard',
    content:
      'Your operational home — role-based metrics, alerts, and shortcuts. Click the orange beacon, then Next to walk through each control.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-date',
    target: T('dashboard-date'),
    title: 'Today’s date',
    content:
      'Shows the current calendar date for context. Metrics below respect the Time Range Filter, not just “today”.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-period',
    target: T('dashboard-period-filter'),
    title: 'Time Range Filter',
    content:
      'Switch Today / Week / Month / Quarter / Year / All Time. KPIs, charts, and lists reload for the selected period so you can compare short-term vs trend performance.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-customize',
    target: T('dashboard-customize-btn'),
    title: 'Customize button',
    content:
      'Open Customize to show or hide dashboard sections (Attention Radar, KPIs, pipeline, tasks, and more). Save Layout to keep your preferred workspace.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-refresh',
    target: T('dashboard-refresh-btn'),
    title: 'Refresh button',
    content:
      'Reload live dashboard metrics from the server without changing filters. Use after updates in Leads, Tasks, or Invoices.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-attention',
    target: T('dashboard-attention-radar'),
    title: 'Attention Radar',
    content:
      'Escalation banner for overdue invoices, late tasks, blocked client work, and urgent tickets. When clear, it shows All Systems Operational. Action buttons jump to the related module.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-kpis',
    target: T('dashboard-kpis'),
    title: 'Executive KPI scorecards',
    content:
      'Top-line metrics for the selected period. Click a card to open the related module. Next we cover each metric briefly.',
    placement: 'top',
  }),
  step({
    id: 'dashboard-kpi-revenue',
    target: T('dashboard-kpi-revenue'),
    title: 'Revenue Collected',
    content:
      'Payments / settled invoice revenue in this period. Example use: check Month vs Quarter cash collected before a finance review.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-kpi-leads',
    target: T('dashboard-kpi-leads'),
    title: 'Inbound Leads',
    content:
      'Total leads plus new and converted counts. Example use: spot a spike in new inbound leads after a campaign.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-kpi-projects',
    target: T('dashboard-kpi-projects'),
    title: 'Active Projects',
    content:
      'Projects currently in delivery across client accounts. Example use: capacity check before committing to a new SOW.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-kpi-tasks',
    target: T('dashboard-kpi-tasks'),
    title: 'Open Deliverables',
    content:
      'Open task volume and due-today signal. Example use: start the day from items due today in your work queue.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-kpi-health',
    target: T('dashboard-kpi-health'),
    title: 'Delivery Health',
    content:
      'Risk view — overdue, due today, and client-blocked tasks. Action Needed means follow up before work stalls.',
    placement: 'bottom',
  }),
  step({
    id: 'dashboard-pipeline',
    target: T('dashboard-pipeline'),
    title: 'Sales Pipeline',
    content:
      'Pipeline value, weighted forecast, closed-won, and stage mix. Open Pipeline / Leads Board for full deal progression.',
    placement: 'top',
  }),
  step({
    id: 'dashboard-analytics',
    target: T('dashboard-analytics'),
    title: 'Performance Analytics',
    content:
      'Conversion rate, settled revenue, and billing health at a glance. Use View Full Report when you need deeper BI.',
    placement: 'top',
  }),
  step({
    id: 'dashboard-my-tasks',
    target: T('dashboard-my-tasks'),
    title: 'My Tasks Work Queue',
    content:
      'Your deliverables with All / Overdue / Today / Upcoming tabs. Triage overdue first, then today’s work.',
    placement: 'top',
  }),
  step({
    id: 'dashboard-calendar',
    target: T('dashboard-calendar'),
    title: 'Upcoming Schedule',
    content:
      'Meetings and calendar events. Open Full Calendar for the month planner; click an item to jump to the related lead or client.',
    placement: 'top',
  }),
  step({
    id: 'dashboard-watchlist',
    target: T('dashboard-watchlist'),
    title: 'Recent Invoices & Orders',
    content:
      'Finance watchlist — switch Invoices / Orders to chase unpaid balances and pending settlements.',
    placement: 'top',
  }),
  step({
    id: 'dashboard-timelogs',
    target: T('dashboard-timelogs'),
    title: 'Time Log Report',
    content:
      'Logged vs billable hours and accrued labor revenue for the period. Check utilization before timesheet close.',
    placement: 'top',
  }),
  step({
    id: 'dashboard-quick-actions',
    target: T('dashboard-quick-actions'),
    title: 'Quick Actions',
    content:
      'One-click shortcuts (New Lead, Client, Project, Invoice, and more) filtered by your permissions.',
    placement: 'left',
  }),
  step({
    id: 'dashboard-activity',
    target: T('dashboard-activity'),
    title: 'Recent Activity',
    content:
      'Latest audit-style events across the CRM. Open Full Audit Trail when you need the complete change history. Tour complete — click Finish.',
    placement: 'left',
  }),
];
