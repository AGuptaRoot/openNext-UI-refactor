/** Joyride steps — Analytics AI (first visit) */
export const analyticsAiTourSteps = [
  {
    id: 'analyticsAi-create',
    target: '[data-tour="crm-main"]',
    placement: 'center',
    skipBeacon: true,
    title: 'How to start a new analysis',
    content:
      'There is no create form. Set From date and To date, then click Refresh to load KPIs and forecasts for that range. Adjust dates again anytime to run a new analysis window.',
  },
  {
    id: 'analyticsAi-features',
    target: '[data-tour="crm-main"]',
    placement: 'center',
    title: 'How to see all features',
    content:
      'Single Analytics AI page: date range filters, Refresh, KPI cards (Pipeline value, Weighted pipeline, Realized revenue, Average deal), and forecast blocks for 30 / 60 / 90 days with confidence %.',
  },
  {
    id: 'analyticsAi-use',
    target: '[data-tour="crm-main"]',
    placement: 'center',
    title: 'How to use this feature',
    content:
      'Pick a reporting period, Refresh, then compare pipeline vs realized revenue. Use weighted pipeline for forecast planning. Re-run after major deal stage changes for updated AI-assisted outlook.',
  },
  {
    id: 'analyticsAi-tabs',
    target: '[data-tour="crm-main"]',
    placement: 'center',
    title: 'How many tabs / views here',
    content:
      'No classic tabs — one analytics canvas. Forecast views: 30-day | 60-day | 90-day (with confidence). KPI strip is the primary analytics use case for leadership reviews.',
  },
];
