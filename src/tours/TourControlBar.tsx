import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getLeadsTourProgress,
  markLeadsTourCompleted,
} from './leadsTourState.js';
import {
  getClientsTourProgress,
  markClientsTourCompleted,
} from './clientsTourState.js';
import {
  getProjectsTourProgress,
  markProjectsTourCompleted,
} from './projectsTourState.js';
import {
  getTasksTourProgress,
  markTasksTourCompleted,
} from './tasksTourState.js';
import {
  getTimeLogsTourProgress,
  markTimeLogsTourCompleted,
} from './timeLogsTourState.js';
import {
  getQuotationsTourProgress,
  markQuotationsTourCompleted,
} from './quotationsTourState.js';
import {
  getInvoicesTourProgress,
  markInvoicesTourCompleted,
} from './invoicesTourState.js';
import {
  getExpensesTourProgress,
  markExpensesTourCompleted,
} from './expensesTourState.js';
import {
  getDataQualityTourProgress,
  markDataQualityTourCompleted,
} from './dataQualityTourState.js';
import {
  getSalesOrdersTourProgress,
  markSalesOrdersTourCompleted,
} from './salesOrdersTourState.js';
import {
  getSamplesTourProgress,
  markSamplesTourCompleted,
} from './samplesTourState.js';
import {
  getOpportunitiesTourProgress,
  markOpportunitiesTourCompleted,
} from './opportunitiesTourState.js';
import {
  getTicketsTourProgress,
  markTicketsTourCompleted,
} from './ticketsTourState.js';
import {
  getCustomerSuccessTourProgress,
  markCustomerSuccessTourCompleted,
} from './customerSuccessTourState.js';
import {
  getMarketingTourProgress,
  markMarketingTourCompleted,
} from './marketingTourState.js';
import {
  getAuditTourProgress,
  markAuditTourCompleted,
} from './auditTourState.js';
import {
  getSettingsTourProgress,
  markSettingsTourCompleted,
} from './settingsTourState.js';
import {
  clearModuleTourProgress,
  getModuleTourProgress,
  markTourSeen,
} from './storage.js';

function isLeadsTourRoute(pathname: string) {
  return (
    pathname === '/leads' ||
    pathname.startsWith('/leads/') ||
    pathname === '/clients' ||
    pathname.startsWith('/clients/')
  );
}

function isClientsTourRoute(pathname: string) {
  return (
    pathname === '/clients' ||
    pathname.startsWith('/clients/') ||
    pathname === '/projects' ||
    pathname.startsWith('/projects/')
  );
}

function isProjectsTourRoute(pathname: string) {
  return (
    pathname === '/projects' ||
    pathname.startsWith('/projects/') ||
    pathname === '/tasks' ||
    pathname.startsWith('/tasks/')
  );
}

function isTasksTourRoute(pathname: string) {
  return (
    pathname === '/tasks' ||
    pathname.startsWith('/tasks/') ||
    pathname === '/time-logs' ||
    pathname.startsWith('/time-logs/')
  );
}

function isTimeLogsTourRoute(pathname: string) {
  return (
    pathname === '/time-logs' ||
    pathname.startsWith('/time-logs/') ||
    pathname === '/quotations' ||
    pathname.startsWith('/quotations/')
  );
}

function isQuotationsTourRoute(pathname: string) {
  return (
    pathname === '/quotations' ||
    pathname.startsWith('/quotations/') ||
    pathname === '/quotation-templates' ||
    pathname.startsWith('/quotation-templates/') ||
    pathname === '/invoices' ||
    pathname.startsWith('/invoices/')
  );
}

function isInvoicesTourRoute(pathname: string) {
  return (
    pathname === '/invoices' ||
    pathname.startsWith('/invoices/') ||
    pathname === '/invoice-templates' ||
    pathname.startsWith('/invoice-templates/') ||
    pathname === '/payments' ||
    pathname.startsWith('/payments/')
  );
}

function isExpensesTourRoute(pathname: string) {
  return (
    pathname === '/expenses' ||
    pathname.startsWith('/expenses/') ||
    pathname === '/projects' ||
    pathname.startsWith('/projects/')
  );
}

function isDataQualityTourRoute(pathname: string) {
  return pathname === '/data-quality' || pathname.startsWith('/data-quality/');
}

function isSalesOrdersTourRoute(pathname: string) {
  return (
    pathname === '/sales-orders' ||
    pathname.startsWith('/sales-orders/') ||
    pathname === '/invoices' ||
    pathname.startsWith('/invoices/')
  );
}

function isSamplesTourRoute(pathname: string) {
  return pathname === '/samples' || pathname.startsWith('/samples/');
}

function isOpportunitiesTourRoute(pathname: string) {
  return (
    pathname === '/opportunities' ||
    pathname.startsWith('/opportunities/') ||
    pathname === '/sales-orders' ||
    pathname.startsWith('/sales-orders/')
  );
}

function isTicketsTourRoute(pathname: string) {
  return pathname === '/tickets' || pathname.startsWith('/tickets/');
}

function isCustomerSuccessTourRoute(pathname: string) {
  return pathname === '/customer-success' || pathname.startsWith('/customer-success/');
}

function isMarketingTourRoute(pathname: string) {
  return pathname === '/marketing' || pathname.startsWith('/marketing/');
}

function isAuditTourRoute(pathname: string) {
  return pathname === '/audit' || pathname.startsWith('/audit/');
}

function isSettingsTourRoute(pathname: string) {
  return pathname === '/settings' || pathname.startsWith('/settings/');
}

type ActiveTour =
  | { kind: 'leads'; stepIndex: number; offRoute: boolean }
  | { kind: 'clients'; stepIndex: number; offRoute: boolean }
  | { kind: 'projects'; stepIndex: number; offRoute: boolean }
  | { kind: 'tasks'; stepIndex: number; offRoute: boolean }
  | { kind: 'time-logs'; stepIndex: number; offRoute: boolean }
  | { kind: 'quotations'; stepIndex: number; offRoute: boolean }
  | { kind: 'invoices'; stepIndex: number; offRoute: boolean }
  | { kind: 'expenses'; stepIndex: number; offRoute: boolean }
  | { kind: 'data-quality'; stepIndex: number; offRoute: boolean }
  | { kind: 'sales-orders'; stepIndex: number; offRoute: boolean }
  | { kind: 'samples'; stepIndex: number; offRoute: boolean }
  | { kind: 'opportunities'; stepIndex: number; offRoute: boolean }
  | { kind: 'tickets'; stepIndex: number; offRoute: boolean }
  | { kind: 'customer-success'; stepIndex: number; offRoute: boolean }
  | { kind: 'marketing'; stepIndex: number; offRoute: boolean }
  | { kind: 'audit'; stepIndex: number; offRoute: boolean }
  | { kind: 'settings'; stepIndex: number; offRoute: boolean }
  | { kind: 'module'; moduleId: string; offRoute: boolean };

function readActiveTour(pathname: string): ActiveTour | null {
  const leads = getLeadsTourProgress();
  if (leads?.active) {
    return {
      kind: 'leads',
      stepIndex: Number(leads.stepIndex) || 0,
      offRoute: !isLeadsTourRoute(pathname),
    };
  }
  const clients = getClientsTourProgress();
  if (clients?.active) {
    return {
      kind: 'clients',
      stepIndex: Number(clients.stepIndex) || 0,
      offRoute: !isClientsTourRoute(pathname),
    };
  }
  const projects = getProjectsTourProgress();
  if (projects?.active) {
    return {
      kind: 'projects',
      stepIndex: Number(projects.stepIndex) || 0,
      offRoute: !isProjectsTourRoute(pathname),
    };
  }
  const tasks = getTasksTourProgress();
  if (tasks?.active) {
    return {
      kind: 'tasks',
      stepIndex: Number(tasks.stepIndex) || 0,
      offRoute: !isTasksTourRoute(pathname),
    };
  }
  const timeLogs = getTimeLogsTourProgress();
  if (timeLogs?.active) {
    return {
      kind: 'time-logs',
      stepIndex: Number(timeLogs.stepIndex) || 0,
      offRoute: !isTimeLogsTourRoute(pathname),
    };
  }
  const quotations = getQuotationsTourProgress();
  if (quotations?.active) {
    return {
      kind: 'quotations',
      stepIndex: Number(quotations.stepIndex) || 0,
      offRoute: !isQuotationsTourRoute(pathname),
    };
  }
  const invoices = getInvoicesTourProgress();
  if (invoices?.active) {
    return {
      kind: 'invoices',
      stepIndex: Number(invoices.stepIndex) || 0,
      offRoute: !isInvoicesTourRoute(pathname),
    };
  }
  const expenses = getExpensesTourProgress();
  if (expenses?.active) {
    return {
      kind: 'expenses',
      stepIndex: Number(expenses.stepIndex) || 0,
      offRoute: !isExpensesTourRoute(pathname),
    };
  }
  const dataQuality = getDataQualityTourProgress();
  if (dataQuality?.active) {
    return {
      kind: 'data-quality',
      stepIndex: Number(dataQuality.stepIndex) || 0,
      offRoute: !isDataQualityTourRoute(pathname),
    };
  }
  const salesOrders = getSalesOrdersTourProgress();
  if (salesOrders?.active) {
    return {
      kind: 'sales-orders',
      stepIndex: Number(salesOrders.stepIndex) || 0,
      offRoute: !isSalesOrdersTourRoute(pathname),
    };
  }
  const samples = getSamplesTourProgress();
  if (samples?.active) {
    return {
      kind: 'samples',
      stepIndex: Number(samples.stepIndex) || 0,
      offRoute: !isSamplesTourRoute(pathname),
    };
  }
  const opportunities = getOpportunitiesTourProgress();
  if (opportunities?.active) {
    return {
      kind: 'opportunities',
      stepIndex: Number(opportunities.stepIndex) || 0,
      offRoute: !isOpportunitiesTourRoute(pathname),
    };
  }
  const tickets = getTicketsTourProgress();
  if (tickets?.active) {
    return {
      kind: 'tickets',
      stepIndex: Number(tickets.stepIndex) || 0,
      offRoute: !isTicketsTourRoute(pathname),
    };
  }
  const customerSuccess = getCustomerSuccessTourProgress();
  if (customerSuccess?.active) {
    return {
      kind: 'customer-success',
      stepIndex: Number(customerSuccess.stepIndex) || 0,
      offRoute: !isCustomerSuccessTourRoute(pathname),
    };
  }
  const marketing = getMarketingTourProgress();
  if (marketing?.active) {
    return {
      kind: 'marketing',
      stepIndex: Number(marketing.stepIndex) || 0,
      offRoute: !isMarketingTourRoute(pathname),
    };
  }
  const audit = getAuditTourProgress();
  if (audit?.active) {
    return {
      kind: 'audit',
      stepIndex: Number(audit.stepIndex) || 0,
      offRoute: !isAuditTourRoute(pathname),
    };
  }
  const settings = getSettingsTourProgress();
  if (settings?.active) {
    return {
      kind: 'settings',
      stepIndex: Number(settings.stepIndex) || 0,
      offRoute: !isSettingsTourRoute(pathname),
    };
  }
  const mod = getModuleTourProgress();
  if (mod?.active && mod.moduleId) {
    const onModule =
      pathname === `/${mod.moduleId}` || pathname.startsWith(`/${mod.moduleId}/`);
    return {
      kind: 'module',
      moduleId: String(mod.moduleId),
      offRoute: !onModule,
    };
  }
  return null;
}

/**
 * Top bar when a tour is mid-flight (navigate away or reload).
 * Tour-only UI — does not touch CRM APIs or business logic.
 */
export const TourControlBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tour, setTour] = useState<ActiveTour | null>(() =>
    readActiveTour(location.pathname)
  );

  const refresh = useCallback(() => {
    setTour(readActiveTour(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    refresh();
    const onState = () => refresh();
    window.addEventListener('crm-tour-state', onState);
    window.addEventListener('storage', onState);
    return () => {
      window.removeEventListener('crm-tour-state', onState);
      window.removeEventListener('storage', onState);
    };
  }, [refresh]);

  const skipTour = () => {
    if (tour?.kind === 'leads') {
      markLeadsTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-leads-tour-skip'));
    } else if (tour?.kind === 'clients') {
      markClientsTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-clients-tour-skip'));
    } else if (tour?.kind === 'projects') {
      markProjectsTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-projects-tour-skip'));
    } else if (tour?.kind === 'tasks') {
      markTasksTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-tasks-tour-skip'));
    } else if (tour?.kind === 'time-logs') {
      markTimeLogsTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-time-logs-tour-skip'));
    } else if (tour?.kind === 'quotations') {
      markQuotationsTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-quotations-tour-skip'));
    } else if (tour?.kind === 'invoices') {
      markInvoicesTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-invoices-tour-skip'));
    } else if (tour?.kind === 'expenses') {
      markExpensesTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-expenses-tour-skip'));
    } else if (tour?.kind === 'data-quality') {
      markDataQualityTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-data-quality-tour-skip'));
    } else if (tour?.kind === 'sales-orders') {
      markSalesOrdersTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-sales-orders-tour-skip'));
    } else if (tour?.kind === 'samples') {
      markSamplesTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-samples-tour-skip'));
    } else if (tour?.kind === 'opportunities') {
      markOpportunitiesTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-opportunities-tour-skip'));
    } else if (tour?.kind === 'tickets') {
      markTicketsTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-tickets-tour-skip'));
    } else if (tour?.kind === 'customer-success') {
      markCustomerSuccessTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-customer-success-tour-skip'));
    } else if (tour?.kind === 'marketing') {
      markMarketingTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-marketing-tour-skip'));
    } else if (tour?.kind === 'audit') {
      markAuditTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-audit-tour-skip'));
    } else if (tour?.kind === 'settings') {
      markSettingsTourCompleted();
      window.dispatchEvent(new CustomEvent('crm-settings-tour-skip'));
    } else if (tour?.kind === 'module') {
      markTourSeen(tour.moduleId);
      clearModuleTourProgress();
      window.dispatchEvent(
        new CustomEvent('crm-module-tour-skip', { detail: { moduleId: tour.moduleId } })
      );
    }
    refresh();
  };

  const continueTour = () => {
    if (tour?.kind === 'leads') {
      navigate('/leads');
      window.dispatchEvent(new CustomEvent('crm-leads-tour-resume'));
    } else if (tour?.kind === 'clients') {
      navigate('/clients');
      window.dispatchEvent(new CustomEvent('crm-clients-tour-resume'));
    } else if (tour?.kind === 'projects') {
      navigate('/projects');
      window.dispatchEvent(new CustomEvent('crm-projects-tour-resume'));
    } else if (tour?.kind === 'tasks') {
      navigate('/tasks');
      window.dispatchEvent(new CustomEvent('crm-tasks-tour-resume'));
    } else if (tour?.kind === 'time-logs') {
      navigate('/time-logs');
      window.dispatchEvent(new CustomEvent('crm-time-logs-tour-resume'));
    } else if (tour?.kind === 'quotations') {
      navigate('/quotations');
      window.dispatchEvent(new CustomEvent('crm-quotations-tour-resume'));
    } else if (tour?.kind === 'invoices') {
      navigate('/invoices');
      window.dispatchEvent(new CustomEvent('crm-invoices-tour-resume'));
    } else if (tour?.kind === 'expenses') {
      navigate('/expenses');
      window.dispatchEvent(new CustomEvent('crm-expenses-tour-resume'));
    } else if (tour?.kind === 'data-quality') {
      navigate('/data-quality');
      window.dispatchEvent(new CustomEvent('crm-data-quality-tour-resume'));
    } else if (tour?.kind === 'sales-orders') {
      navigate('/sales-orders');
      window.dispatchEvent(new CustomEvent('crm-sales-orders-tour-resume'));
    } else if (tour?.kind === 'samples') {
      navigate('/samples');
      window.dispatchEvent(new CustomEvent('crm-samples-tour-resume'));
    } else if (tour?.kind === 'opportunities') {
      navigate('/opportunities');
      window.dispatchEvent(new CustomEvent('crm-opportunities-tour-resume'));
    } else if (tour?.kind === 'tickets') {
      navigate('/tickets');
      window.dispatchEvent(new CustomEvent('crm-tickets-tour-resume'));
    } else if (tour?.kind === 'customer-success') {
      navigate('/customer-success');
      window.dispatchEvent(new CustomEvent('crm-customer-success-tour-resume'));
    } else if (tour?.kind === 'marketing') {
      navigate('/marketing');
      window.dispatchEvent(new CustomEvent('crm-marketing-tour-resume'));
    } else if (tour?.kind === 'audit') {
      navigate('/audit');
      window.dispatchEvent(new CustomEvent('crm-audit-tour-resume'));
    } else if (tour?.kind === 'settings') {
      navigate('/settings');
      window.dispatchEvent(new CustomEvent('crm-settings-tour-resume'));
    } else if (tour?.kind === 'module') {
      navigate(`/${tour.moduleId}`);
    }
  };

  if (!tour) return null;

  const label =
    tour.kind === 'leads'
      ? tour.offRoute
        ? 'Leads tour paused — you left the tour pages.'
        : `Leads tour in progress (step ${tour.stepIndex + 1}).`
      : tour.kind === 'clients'
        ? tour.offRoute
          ? 'Clients tour paused — you left the tour pages.'
          : `Clients tour in progress (step ${tour.stepIndex + 1}).`
        : tour.kind === 'projects'
          ? tour.offRoute
            ? 'Projects tour paused — you left the tour pages.'
            : `Projects tour in progress (step ${tour.stepIndex + 1}).`
          : tour.kind === 'tasks'
            ? tour.offRoute
              ? 'Tasks tour paused — you left the tour pages.'
              : `Tasks tour in progress (step ${tour.stepIndex + 1}).`
            : tour.kind === 'time-logs'
              ? tour.offRoute
                ? 'Time Logs tour paused — you left the tour pages.'
                : `Time Logs tour in progress (step ${tour.stepIndex + 1}).`
              : tour.kind === 'quotations'
                ? tour.offRoute
                  ? 'Quotations tour paused — you left the tour pages.'
                  : `Quotations tour in progress (step ${tour.stepIndex + 1}).`
                : tour.kind === 'invoices'
                  ? tour.offRoute
                    ? 'Invoices tour paused — you left the tour pages.'
                    : `Invoices tour in progress (step ${tour.stepIndex + 1}).`
                  : tour.kind === 'expenses'
                    ? tour.offRoute
                      ? 'Expenses tour paused — you left the tour pages.'
                      : `Expenses tour in progress (step ${tour.stepIndex + 1}).`
                    : tour.kind === 'data-quality'
                      ? tour.offRoute
                        ? 'Data Quality tour paused — you left the tour pages.'
                        : `Data Quality tour in progress (step ${tour.stepIndex + 1}).`
                      : tour.kind === 'sales-orders'
                        ? tour.offRoute
                          ? 'Sales Orders tour paused — you left the tour pages.'
                          : `Sales Orders tour in progress (step ${tour.stepIndex + 1}).`
                        : tour.kind === 'samples'
                          ? tour.offRoute
                            ? 'Sample Requests tour paused — you left the tour pages.'
                            : `Sample Requests tour in progress (step ${tour.stepIndex + 1}).`
                          : tour.kind === 'opportunities'
                            ? tour.offRoute
                              ? 'Opportunities tour paused — you left the tour pages.'
                              : `Opportunities tour in progress (step ${tour.stepIndex + 1}).`
                            : tour.kind === 'tickets'
                              ? tour.offRoute
                                ? 'Support Tickets tour paused — you left the tour pages.'
                                : `Support Tickets tour in progress (step ${tour.stepIndex + 1}).`
                              : tour.kind === 'customer-success'
                                ? tour.offRoute
                                  ? 'Customer Success tour paused — you left the tour pages.'
                                  : `Customer Success tour in progress (step ${tour.stepIndex + 1}).`
                                : tour.kind === 'marketing'
                                  ? tour.offRoute
                                    ? 'Marketing Automation tour paused — you left the tour pages.'
                                    : `Marketing Automation tour in progress (step ${tour.stepIndex + 1}).`
                                  : tour.kind === 'audit'
                                    ? tour.offRoute
                                      ? 'Audit History tour paused — you left the tour pages.'
                                      : `Audit History tour in progress (step ${tour.stepIndex + 1}).`
                                    : tour.kind === 'settings'
                                      ? tour.offRoute
                                        ? 'Settings tour paused — you left the tour pages.'
                                        : `Settings tour in progress (step ${tour.stepIndex + 1}).`
                                      : tour.kind === 'module'
                                        ? tour.offRoute
                                          ? `Tour paused (${tour.moduleId}) — you left this module.`
                                          : `Tour in progress (${tour.moduleId}).`
                                        : '';

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 flex flex-wrap items-center justify-between gap-2"
    >
      <p className="text-xs font-medium text-amber-950 m-0">{label}</p>
      <div className="flex items-center gap-2">
        {tour.offRoute && (
          <button
            type="button"
            onClick={continueTour}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 cursor-pointer hover:bg-zinc-50"
          >
            Continue tour
          </button>
        )}
        <button
          type="button"
          onClick={skipTour}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border-0 bg-zinc-950 text-white cursor-pointer hover:bg-zinc-800"
        >
          Skip tour
        </button>
      </div>
    </div>
  );
};
