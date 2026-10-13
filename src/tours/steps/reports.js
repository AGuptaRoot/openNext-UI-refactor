/**
 * Reports Beacon onboarding — filters, export, and every tab’s components step-by-step.
 * Tour-only; does not change report APIs or RBAC.
 * Missing/hidden targets (empty data or role) are soft-skipped by Joyride.
 */

const T = (id) => `[data-tour="${id}"]`;

function requestReportTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-reports-tour-tab', { detail: { tab } }));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function ensureTab(tab, contentSelector) {
  requestReportTab(tab);
  await wait(400);
  const started = Date.now();
  while (Date.now() - started < 6000) {
    if (
      document.querySelector(contentSelector) ||
      document.querySelector(T(`reports-tab-${tab}`))
    ) {
      return;
    }
    await wait(80);
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

function tabStep(tabId, title, content) {
  return step({
    id: `reports-tab-${tabId}`,
    target: T(`reports-tab-${tabId}`),
    title,
    content,
    before: async () => {
      await ensureTab(tabId, T(`report-tab-${tabId === 'recurring-invoices' ? 'recurring' : tabId === 'payment-reconciliation' ? 'payments' : tabId === 'income-expense' ? 'income-expense' : tabId}`));
    },
  });
}

function componentStep(tab, targetId, title, content, rootAlias) {
  const root =
    rootAlias ||
    (tab === 'recurring-invoices'
      ? 'report-tab-recurring'
      : tab === 'payment-reconciliation'
        ? 'report-tab-payments'
        : tab === 'income-expense'
          ? 'report-tab-income-expense'
          : `report-tab-${tab}`);
  return step({
    id: targetId,
    target: T(targetId),
    title,
    content,
    before: async () => {
      await ensureTab(tab, T(root));
      await wait(200);
    },
  });
}

export const reportsTourSteps = [
  step({
    id: 'reports-welcome',
    target: T('reports-title'),
    title: 'CRM Reports',
    content:
      'Role-based analytics hub. Click the orange beacon, then Next — we cover filters, Export, and every report tab’s components step by step.',
    placement: 'bottom',
  }),
  step({
    id: 'reports-period',
    target: T('reports-period-filter'),
    title: 'Time Range Filter',
    content:
      'Quick presets: Today, Week, Month, Quarter, Year, All. Choosing a period sets From/To and refreshes the active tab for that window.',
    placement: 'bottom',
  }),
  step({
    id: 'reports-dates',
    target: T('reports-date-filter'),
    title: 'Date filter (From / To)',
    content:
      'Pick an exact date range when presets are not enough. Then click Apply to reload the active tab.',
    placement: 'bottom',
  }),
  step({
    id: 'reports-apply',
    target: T('reports-apply-btn'),
    title: 'Apply',
    content: 'Reloads the current report with the selected period/dates after you edit From/To manually.',
    placement: 'bottom',
  }),
  step({
    id: 'reports-export',
    target: T('reports-export-btn'),
    title: 'Export CSV',
    content:
      'Downloads the active report as CSV for the current filters (when your role allows export).',
    placement: 'bottom',
  }),
  step({
    id: 'reports-refresh',
    target: T('reports-refresh-btn'),
    title: 'Refresh',
    content: 'Clears cached tab data and fetches the latest numbers without changing filters.',
    placement: 'bottom',
  }),
  step({
    id: 'reports-tabs',
    target: T('reports-tabs'),
    title: 'Report tabs',
    content:
      'Tabs are filtered by your CRM role. Next we walk each available tab and every chart/table inside. Hidden tabs or empty widgets are skipped automatically.',
    placement: 'bottom',
  }),

  // ——— Sales Pipeline ———
  tabStep(
    'sales',
    'Sales Pipeline tab',
    'Funnel and cash metrics for the selected period — leads, conversion, quotations, and collections.'
  ),
  componentStep(
    'sales',
    'report-sales-kpis',
    'Sales KPIs',
    'Scorecards: Leads in range, Won leads, Conversion rate, and (if finance) Payments collected. Click a tile to open the related list.'
  ),
  componentStep(
    'sales',
    'report-sales-pipeline',
    'Pipeline funnel',
    'Donut + bars of leads by pipeline stage. Click a stage bar to open that stage in Leads.'
  ),
  componentStep(
    'sales',
    'report-sales-leads-month',
    'Leads by month',
    'Line and bar trend of lead volume acquired each month in the filter range.'
  ),
  componentStep(
    'sales',
    'report-sales-quotations',
    'Quotations',
    'Quotation status mix (Draft / Sent / Accepted / Rejected). Click a status tile to open filtered quotations.'
  ),
  componentStep(
    'sales',
    'report-sales-finance',
    'Finance summary',
    'Quick cash tiles: Payments In, Outstanding AR, and Overdue — jump to Payments or Invoices.'
  ),
  componentStep(
    'sales',
    'report-sales-top-clients',
    'Top clients by payments',
    'Highest-paying clients by collections in the period — useful for account prioritisation.'
  ),

  // ——— Lead Conversion ———
  tabStep(
    'conversion',
    'Lead Conversion tab',
    'Deep dive on win/loss/convert rates and source/stage mix for inbound leads.'
  ),
  componentStep(
    'conversion',
    'report-conversion-kpis',
    'Conversion KPIs',
    'Total, Won, Converted to client, Conversion rate, Lost, Win rate, Open pipeline, and Won vs converted comparison.'
  ),
  componentStep(
    'conversion',
    'report-conversion-by-stage',
    'Leads by pipeline stage',
    'Stage funnel chart. Click a stage to open filtered leads for that stage.'
  ),
  componentStep(
    'conversion',
    'report-conversion-by-source',
    'Leads by acquisition source',
    'Channel mix (Website, Referral…). Click a source to open leads filtered by that source.'
  ),
  componentStep(
    'conversion',
    'report-conversion-trend',
    'Conversions by month',
    'Line chart of leads that became clients over time — track conversion momentum.'
  ),
  componentStep(
    'conversion',
    'report-conversion-volume',
    'Monthly conversion volume',
    'Bar chart of converted-to-client counts per month for quick volume comparison.'
  ),
  componentStep(
    'conversion',
    'report-conversion-reps',
    'Rep performance',
    'Table of assignees with Won, Total, and Win rate — compare sales rep effectiveness.'
  ),

  // ——— Projects & Tasks ———
  tabStep(
    'projects',
    'Projects & Tasks tab',
    'Delivery portfolio: project counts, task completion, overdue risk, and progress.'
  ),
  componentStep(
    'projects',
    'report-projects-kpis',
    'Projects KPIs',
    'Total Projects, Deliverables, Completed tasks, and Overdue Tasks for the period.'
  ),
  componentStep(
    'projects',
    'report-projects-by-status',
    'Projects by status',
    'Donut + bars of projects by status (Active, Completed…). Click a status to open filtered projects.'
  ),
  componentStep(
    'projects',
    'report-projects-hours',
    'Labor hours by team member',
    'Workload distribution — who logged the most hours (requires time permission).'
  ),
  componentStep(
    'projects',
    'report-projects-overdue',
    'Overdue deliverables',
    'Red-flag table of past-due tasks with project, assignee, and due date. Open a row to work the task.'
  ),
  componentStep(
    'projects',
    'report-projects-portfolio',
    'Project portfolio progress',
    'Per-project completion: client, status, tasks done/total, progress bar, and hours when allowed.'
  ),

  // ——— Employees ———
  tabStep(
    'employees',
    'Employees tab',
    'Team delivery progress by assignee — completed vs total tasks and incomplete worklists.'
  ),
  componentStep(
    'employees',
    'report-employees-kpis',
    'Employees KPIs',
    'Headcount, assigned tasks, completed count, and average progress across the team.'
  ),
  componentStep(
    'employees',
    'report-employees-list',
    'Employee progress table',
    'Each row is an employee: role, tasks done/total, progress bar, and incomplete count. Use the arrow to expand incomplete tasks.'
  ),
  componentStep(
    'employees',
    'report-employees-expand',
    'Expand incomplete tasks',
    'Click the down/right arrow on a row with incomplete work to list those tasks. Open any task to jump to its detail page.'
  ),

  // ——— Time & Billable Hours ———
  tabStep(
    'time',
    'Time & Billable Hours tab',
    'Labor utilization — logged, billable, and non-billable hours for the period.'
  ),
  componentStep(
    'time',
    'report-time-kpis',
    'Time KPIs',
    'Total Hours, Billable Hours, Non-Billable, and Billable Ratio — utilization at a glance.'
  ),
  componentStep(
    'time',
    'report-time-by-project',
    'Hours by project',
    'Where labor went — donut and bars of hours allocated across projects/clients.'
  ),
  componentStep(
    'time',
    'report-time-trend',
    'Labor hours over time',
    'Monthly timesheet trend (line + bar) to spot busy vs quiet periods.'
  ),
  componentStep(
    'time',
    'report-time-team',
    'Team timesheet breakdown',
    'Per-person table: total hours, billable hours, and billable % for utilization coaching.'
  ),

  // ——— Income vs Expense ———
  tabStep(
    'income-expense',
    'Income vs Expense tab',
    'Cash-flow view: income, expenses, net profit, and margin for finance roles.'
  ),
  componentStep(
    'income-expense',
    'report-income-kpis',
    'Income / Expense KPIs',
    'Total Income, Operating Expenses, Net Operating Profit, and Profit Margin for the filter range.'
  ),
  componentStep(
    'income-expense',
    'report-income-cashflow',
    'Cash-flow trend',
    'Dual line: Income vs Expenses over time — see when costs outpace revenue.'
  ),
  componentStep(
    'income-expense',
    'report-income-expenses',
    'Expense distribution',
    'Outflow by category (donut + bars). Click a category to open filtered expenses.'
  ),
  componentStep(
    'income-expense',
    'report-income-statement',
    'Monthly cash flow statement',
    'Period table: Income, Expenses, and Net Profit — period-by-period reconciliation.'
  ),

  // ——— Invoice Ageing ———
  tabStep(
    'ageing',
    'Invoice Ageing tab',
    'Accounts receivable ageing — unpaid and overdue exposure by delinquency bucket.'
  ),
  componentStep(
    'ageing',
    'report-ageing-kpis',
    'Ageing KPIs',
    'Total Unpaid AR, Past Due, Open Invoices, and 90+ Days Critical — collection risk snapshot.'
  ),
  componentStep(
    'ageing',
    'report-ageing-buckets',
    'Ageing brackets',
    'Donut + bars across delinquency intervals (Current, 1–30, 31–60, 61–90, 90+). Focus chase on older buckets.'
  ),
  componentStep(
    'ageing',
    'report-ageing-ledger',
    'Outstanding invoice ledger',
    'Invoice-level rows: number, client, due date, total, balance, days overdue, and ageing bracket.'
  ),

  // ——— Recurring Invoices ———
  tabStep(
    'recurring-invoices',
    'Recurring Invoices tab',
    'Subscription / recurring contract health — active profiles, MRR/ARR, and upcoming runs.'
  ),
  componentStep(
    'recurring-invoices',
    'report-recurring-kpis',
    'Recurring KPIs',
    'Active Contracts, Payment Amount, MRR, ARR, upcoming schedules, and generated invoice totals.',
    'report-tab-recurring'
  ),
  componentStep(
    'recurring-invoices',
    'report-recurring-frequency',
    'Contracts by billing frequency',
    'How contracts bill (Monthly, Quarterly, Yearly…). Helps forecast cash cadence.',
    'report-tab-recurring'
  ),
  componentStep(
    'recurring-invoices',
    'report-recurring-schedule',
    'Upcoming auto-billing schedule',
    'Next scheduled invoice runs: client, profile, next run date, frequency, amount, and status.',
    'report-tab-recurring'
  ),

  // ——— Payment Reconciliation ———
  tabStep(
    'payment-reconciliation',
    'Payment Reconciliation tab',
    'Collections audit — payment volume, gross/net, refunds, and method mix.'
  ),
  componentStep(
    'payment-reconciliation',
    'report-payments-kpis',
    'Payment KPIs',
    'Total Payments, Gross Inflow, Refunds, and Net Collected for the selected period.',
    'report-tab-payments'
  ),
  componentStep(
    'payment-reconciliation',
    'report-payments-methods',
    'Collections by payment method',
    'Channel mix: counts and net amount by method (UPI, Card, Bank…) plus a method summary table.',
    'report-tab-payments'
  ),
  componentStep(
    'payment-reconciliation',
    'report-payments-log',
    'Transaction reconciliation log',
    'Payment-level audit: receipt #, date, client, invoice, mode, gross/refund/net, and status. Tour complete — click Finish.',
    'report-tab-payments'
  ),
];
