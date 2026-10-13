import { analyticsAiTourSteps } from './steps/analyticsAi.js';

/**
 * Tours run on these modules (first visit).
 * Dedicated Beacon tours: dashboard, leads, clients, projects, tasks, reports, time-logs, quotations, invoices, expenses, data-quality, sales-orders, samples, opportunities, tickets, customer-success, marketing, audit, settings.
 * Still excluded from ModuleTour: payments.
 */
export const tourRegistry = {
  // dashboard: handled by DashboardTour (Beacon workflow)
  // leads: handled by dedicated LeadsTour (Beacon workflow) — not ModuleTour
  // clients: handled by dedicated ClientsTour (Beacon workflow) — not ModuleTour
  // projects: handled by dedicated ProjectsTour (Beacon workflow) — not ModuleTour
  // tasks: handled by dedicated TasksTour (Beacon workflow) — not ModuleTour
  // reports: handled by ReportsTour (Beacon workflow)
  // time-logs: handled by TimeLogsTour (Beacon workflow) — not ModuleTour
  // quotations: handled by QuotationsTour (Beacon workflow) — not ModuleTour
  // invoices: handled by InvoicesTour (Beacon workflow) — not ModuleTour
  // expenses: handled by ExpensesTour (Beacon workflow) — not ModuleTour
  // data-quality: handled by DataQualityTour (Beacon workflow) — not ModuleTour
  // sales-orders: handled by SalesOrdersTour (Beacon workflow) — not ModuleTour
  // samples: handled by SamplesTour (Beacon workflow) — not ModuleTour
  // opportunities: handled by OpportunitiesTour (Beacon workflow) — not ModuleTour
  // tickets: handled by TicketsTour (Beacon workflow) — not ModuleTour
  // customer-success: handled by CustomerSuccessTour (Beacon workflow) — not ModuleTour
  // marketing: handled by MarketingTour (Beacon workflow) — not ModuleTour
  // audit: handled by AuditTour (Beacon workflow) — not ModuleTour
  // settings: handled by SettingsTour (Beacon workflow) — not ModuleTour
  'analytics-ai': analyticsAiTourSteps,
};

export function getTourSteps(moduleId) {
  if (!moduleId) return null;
  return tourRegistry[moduleId] || null;
}

export function resolveModuleIdFromPath(pathname) {
  const segment = String(pathname || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)[0];
  if (!segment) return null;
  return segment;
}
