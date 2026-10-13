import React, { useState, useEffect, useMemo, useCallback } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CircularProgress from '@mui/material/CircularProgress';

import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { crmApi } from '../../services/api';
import {
  ReportTabId,
  ReportPeriod,
  ReportRolePreset,
  ReportTabDefinition,
  ReportRolePermissions,
  SalesReportData,
  LeadConversionReportData,
  ProjectsReportData,
  TimeReportData,
  IncomeExpenseReportData,
  InvoiceAgeingReportData,
  RecurringInvoicesReportData,
  PaymentReconciliationReportData,
  EmployeesReportData,
} from '../../types/reports';

import { SalesReportTab } from '../../components/reports/tabs/SalesReportTab';
import { ConversionReportTab } from '../../components/reports/tabs/ConversionReportTab';
import { ProjectsReportTab } from '../../components/reports/tabs/ProjectsReportTab';
import { EmployeesReportTab } from '../../components/reports/tabs/EmployeesReportTab';
import { TimeReportTab } from '../../components/reports/tabs/TimeReportTab';
import { IncomeExpenseReportTab } from '../../components/reports/tabs/IncomeExpenseReportTab';
import { AgeingReportTab } from '../../components/reports/tabs/AgeingReportTab';
import { RecurringInvoicesReportTab } from '../../components/reports/tabs/RecurringInvoicesReportTab';
import { PaymentReconciliationReportTab } from '../../components/reports/tabs/PaymentReconciliationReportTab';

export const ALL_REPORT_TABS: ReportTabDefinition[] = [
  { id: 'sales', label: 'Sales Pipeline', exportKey: 'sales', requiredPerm: null },
  { id: 'conversion', label: 'Lead Conversion', exportKey: 'lead-conversion', requiredPerm: null },
  { id: 'projects', label: 'Projects & Tasks', exportKey: 'projects', requiredPerm: 'canProjects' },
  { id: 'employees', label: 'Employees', exportKey: 'employees', requiredPerm: 'canProjects' },
  { id: 'time', label: 'Time & Billable Hours', exportKey: 'time', requiredPerm: 'canTime' },
  { id: 'income-expense', label: 'Income vs Expense', exportKey: 'income-expense', requiredPerm: 'canFinanceOrExpenses' },
  { id: 'ageing', label: 'Invoice Ageing', exportKey: 'invoice-ageing', requiredPerm: 'canFinance' },
  { id: 'recurring-invoices', label: 'Recurring Invoices', exportKey: 'recurring-invoices', requiredPerm: 'canFinance' },
  { id: 'payment-reconciliation', label: 'Payment Reconciliation', exportKey: 'payment-reconciliation', requiredPerm: 'canFinance' },
];

export const ROLE_PRESETS: Record<string, ReportRolePreset> = {
  'crm-manager': {
    title: 'CRM Manager (Executive)',
    icon: '👑',
    subtitle: 'Executive reporting across sales pipeline, client projects, billable time, cash flow, and AR ageing.',
    allowedReports: [
      'sales',
      'conversion',
      'projects',
      'employees',
      'time',
      'income-expense',
      'ageing',
      'recurring-invoices',
      'payment-reconciliation',
    ],
  },
  'sales-manager': {
    title: 'Sales Manager',
    icon: '📈',
    subtitle: 'Sales pipeline progression, lead conversion funnel, quotation metrics, and recurring contracts.',
    allowedReports: ['sales', 'conversion', 'recurring-invoices'],
  },
  'sales-representative': {
    title: 'Sales Representative',
    icon: '🎯',
    subtitle: 'My deal pipeline progression, quotation status, and inbound lead conversion performance.',
    allowedReports: ['sales', 'conversion'],
  },
  'project-manager': {
    title: 'Project Lead',
    icon: '📁',
    subtitle: 'Project delivery milestones, task completion progress, overdue deliverables, and billable hours.',
    allowedReports: ['projects', 'employees', 'time'],
  },
  'crm-employee': {
    title: 'Team Member (Delivery)',
    icon: '💻',
    subtitle: 'Team deliverables, task execution progress, and personal logged labor hours.',
    allowedReports: ['projects', 'time'],
  },
  'finance-manager': {
    title: 'Finance Lead',
    icon: '💳',
    subtitle: 'Financial cash flow, accounts receivable ageing, invoice collections, and reconciliations.',
    allowedReports: [
      'income-expense',
      'ageing',
      'recurring-invoices',
      'payment-reconciliation',
      'sales',
      'time',
    ],
  },
  client: {
    title: 'Client (Customer Portal)',
    icon: '👤',
    subtitle: 'Client Portal: review active project deliverable milestones, task progress, and account statements.',
    allowedReports: ['projects', 'ageing'],
  },
};

export function getRolePermissions(roleKey: string): ReportRolePermissions {
  const norm = String(roleKey || '').toLowerCase();
  switch (norm) {
    case 'crm-manager':
      return {
        canFinance: true,
        canExpenses: true,
        canProjects: true,
        canTime: true,
        canExport: true,
        canClientFilter: true,
        isClient: false,
      };
    case 'sales-manager':
      return {
        canFinance: true,
        canExpenses: false,
        canProjects: false,
        canTime: false,
        canExport: true,
        canClientFilter: true,
        isClient: false,
      };
    case 'sales-representative':
      return {
        canFinance: false,
        canExpenses: false,
        canProjects: false,
        canTime: false,
        canExport: true,
        canClientFilter: false,
        isClient: false,
      };
    case 'project-manager':
      return {
        canFinance: false,
        canExpenses: false,
        canProjects: true,
        canTime: true,
        canExport: true,
        canClientFilter: true,
        isClient: false,
      };
    case 'crm-employee':
      return {
        canFinance: false,
        canExpenses: false,
        canProjects: true,
        canTime: true,
        canExport: false,
        canClientFilter: false,
        isClient: false,
      };
    case 'finance-manager':
      return {
        canFinance: true,
        canExpenses: true,
        canProjects: false,
        canTime: true,
        canExport: true,
        canClientFilter: true,
        isClient: false,
      };
    case 'client':
      return {
        canFinance: false,
        canExpenses: false,
        canProjects: true,
        canTime: false,
        canExport: false,
        canClientFilter: false,
        isClient: true,
      };
    default:
      return {
        canFinance: false,
        canExpenses: false,
        canProjects: true,
        canTime: true,
        canExport: false,
        canClientFilter: false,
        isClient: false,
      };
  }
}

export function formatRoleName(role: string): string {
  if (!role) return 'Team Member';
  return role
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const ReportsPage: React.FC = () => {
  const { user, activeRole } = useAuth();

  // Date state (defaults to 1st of current month to today)
  const initialDates = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: start.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  }, []);

  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);
  const [activePeriod, setActivePeriod] = useState<ReportPeriod | null>('month');

  // Active Tab
  const [activeTab, setActiveTab] = useState<ReportTabId>('sales');

  // Loading & Data Cache
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Cached data state for tabs
  const [tabData, setTabData] = useState<Record<string, unknown>>({});

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const currentPerms = useMemo(() => getRolePermissions(activeRole), [activeRole]);

  // Compute visible tabs based on RBAC permissions and role presets
  const visibleTabs = useMemo(() => {
    const preset = ROLE_PRESETS[activeRole] || ROLE_PRESETS['crm-employee'];
    const allowed = preset.allowedReports || [];

    return ALL_REPORT_TABS.filter((tab) => {
      if (!allowed.includes(tab.id)) return false;
      if (activeRole === 'client') return true;
      if (tab.requiredPerm === 'canProjects' && !currentPerms.canProjects) return false;
      if (tab.requiredPerm === 'canTime' && !currentPerms.canTime) return false;
      if (tab.requiredPerm === 'canFinance' && !currentPerms.canFinance) return false;
      if (tab.requiredPerm === 'canFinanceOrExpenses' && !currentPerms.canFinance && !currentPerms.canExpenses) {
        return false;
      }
      return true;
    });
  }, [activeRole, currentPerms]);

  // Ensure activeTab is always among visible tabs
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      if (visibleTabs.length > 0) {
        setActiveTab(visibleTabs[0].id);
      }
    }
  }, [visibleTabs, activeTab]);

  // Tour can switch report tabs without changing report APIs
  useEffect(() => {
    const onTourTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: ReportTabId }>).detail?.tab;
      if (!tab) return;
      if (visibleTabs.some((t) => t.id === tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('crm-reports-tour-tab', onTourTab as EventListener);
    return () => window.removeEventListener('crm-reports-tour-tab', onTourTab as EventListener);
  }, [visibleTabs]);

  // Handle Quick Date Period shortcuts
  const handleSetPeriod = (period: ReportPeriod) => {
    setActivePeriod(period);
    const now = new Date();
    let fromDate = new Date(now);
    const toDate = new Date(now);

    if (period === 'today') {
      fromDate = new Date(now);
    } else if (period === 'week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      fromDate.setDate(now.getDate() - diffToMonday);
    } else if (period === 'month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      fromDate = new Date(now.getFullYear(), qMonth, 1);
    } else if (period === 'year') {
      fromDate = new Date(now.getFullYear(), 0, 1);
    } else if (period === 'all') {
      fromDate = new Date(2020, 0, 1);
    }

    setDateFrom(fromDate.toISOString().slice(0, 10));
    setDateTo(toDate.toISOString().slice(0, 10));
    setTabData({}); // Invalidate tab cache on date change
  };

  // Build query params
  const queryParams = useMemo(() => {
    const params: { from?: string; to?: string; clientId?: string } = {
      from: dateFrom,
      to: dateTo,
    };
    // Client portal users remain scoped to their own account (no UI filter)
    if ((activeRole === 'client' || currentPerms.isClient) && user?.clientId) {
      params.clientId = user.clientId;
    }
    return params;
  }, [dateFrom, dateTo, activeRole, currentPerms.isClient, user?.clientId]);

  // Fetch report data for active tab
  const loadActiveTabData = useCallback(
    async (force = false) => {
      const cacheKey = `${activeTab}_${queryParams.from}_${queryParams.to}_${queryParams.clientId || ''}`;
      if (!force && tabData[cacheKey]) {
        return;
      }

      setLoading(true);
      try {
        let result: unknown = null;
        switch (activeTab) {
          case 'sales':
            result = (await crmApi.getSalesReport(queryParams)).data;
            break;
          case 'conversion':
            result = (await crmApi.getLeadConversionReport(queryParams)).data;
            break;
          case 'projects':
            result = (await crmApi.getProjectsReport(queryParams)).data;
            break;
          case 'employees':
            result = (await crmApi.getEmployeesReport(queryParams)).data;
            break;
          case 'time':
            result = (await crmApi.getTimeReport(queryParams)).data;
            break;
          case 'income-expense':
            result = (await crmApi.getIncomeExpenseReport(queryParams)).data;
            break;
          case 'ageing':
            result = (await crmApi.getInvoiceAgeingReport({ clientId: queryParams.clientId })).data;
            break;
          case 'recurring-invoices':
            result = (await crmApi.getRecurringInvoicesReport({ clientId: queryParams.clientId })).data;
            break;
          case 'payment-reconciliation':
            result = (await crmApi.getPaymentReconciliationReport(queryParams)).data;
            break;
        }

        setTabData((prev) => ({ ...prev, [cacheKey]: result }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load report data';
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    },
    [activeTab, queryParams, tabData]
  );

  // Trigger load when tab or params change
  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  // Handle Export CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const currentTabDef = ALL_REPORT_TABS.find((t) => t.id === activeTab);
      const exportKey = currentTabDef?.exportKey || activeTab;
      const filename = await crmApi.downloadReportCsv(exportKey, queryParams);
      showToast(`Downloaded ${filename}`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      showToast(msg, 'error');
    } finally {
      setExporting(false);
    }
  };

  const activeCacheKey = `${activeTab}_${queryParams.from}_${queryParams.to}_${queryParams.clientId || ''}`;
  const currentData = tabData[activeCacheKey];

  const currentRolePreset = ROLE_PRESETS[activeRole] || ROLE_PRESETS['crm-employee'];

  return (
    <div className="flex w-full flex-col gap-5 pb-12" data-tour="reports-root">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            toastMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-zinc-950 text-white border-zinc-950'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-inherit hover:opacity-75 p-0 bg-transparent border-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header (OpenNext CMS Style) */}
      <div
        data-tour="reports-header"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200"
      >
        <div data-tour="reports-title">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-2xl">{currentRolePreset.icon}</span>
            <h1 className="text-2xl font-bold text-zinc-950 tracking-tight m-0">Reports</h1>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-800">
              <span>{currentRolePreset.icon}</span>
              <span>{currentRolePreset.title || formatRoleName(activeRole)}</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-zinc-200 text-zinc-700 rounded border border-zinc-300">
                CRM role
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-500 m-0 mt-1 leading-relaxed">
            {currentRolePreset.subtitle}
          </p>
        </div>

        {/* Header Actions: Export & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentPerms.canExport && (
            <button
              type="button"
              data-tour="reports-export-btn"
              disabled={exporting}
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold border border-zinc-950 cursor-pointer transition-colors disabled:opacity-50"
            >
              <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />
              <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
            </button>
          )}

          <button
            type="button"
            data-tour="reports-refresh-btn"
            disabled={loading}
            onClick={() => {
              setTabData({});
              loadActiveTabData(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium cursor-pointer transition-colors shadow-none"
          >
            <RefreshIcon sx={{ fontSize: 16 }} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <TourButton
            moduleId="reports"
            title="Restart Reports onboarding tour"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold border-0 cursor-pointer"
          />
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <section
        data-tour="reports-filters"
        className="bg-white border border-zinc-300 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        {/* Quick Period Presets */}
        <div data-tour="reports-period-filter" className="flex items-center gap-2 flex-wrap">
          <span className="text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider">
            Period:
          </span>
          <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200">
            {(['today', 'week', 'month', 'quarter', 'year', 'all'] as ReportPeriod[]).map((p) => {
              const isActive = activePeriod === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSetPeriod(p)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer capitalize ${
                    isActive
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-950'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Inputs & Apply Action */}
        <div data-tour="reports-date-filter" className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label htmlFor="report-from" className="text-xs font-medium text-zinc-500">
              From:
            </label>
            <input
              type="date"
              id="report-from"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActivePeriod(null);
                setTabData({});
              }}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1 bg-white text-zinc-900 outline-none h-8"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="report-to" className="text-xs font-medium text-zinc-500">
              To:
            </label>
            <input
              type="date"
              id="report-to"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActivePeriod(null);
                setTabData({});
              }}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1 bg-white text-zinc-900 outline-none h-8"
            />
          </div>

          <button
            type="button"
            data-tour="reports-apply-btn"
            onClick={() => {
              setTabData({});
              loadActiveTabData(true);
            }}
            className="inline-flex items-center justify-center px-3.5 py-1 h-8 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 border border-zinc-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            Apply
          </button>
        </div>
      </section>

      {/* 3. Role-Filtered Report Tabs Bar */}
      <div
        data-tour="reports-tabs"
        className="flex gap-1.5 p-1.5 bg-zinc-100 border border-zinc-200 rounded-xl overflow-x-auto select-none"
      >
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              data-tour={`reports-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                isActive
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400 hover:text-zinc-950'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. Active Tab Content / Loading State */}
      {loading && !currentData ? (
        <div className="bg-white border border-zinc-300 rounded-xl p-16 text-center flex flex-col items-center justify-center gap-3">
          <CircularProgress size={28} sx={{ color: '#09090b' }} />
          <span className="text-xs font-medium text-zinc-500">Loading report intelligence…</span>
        </div>
      ) : (
        <div>
          {activeTab === 'sales' && (
            <SalesReportTab data={(currentData as SalesReportData) || {}} perms={currentPerms} />
          )}
          {activeTab === 'conversion' && (
            <ConversionReportTab data={(currentData as LeadConversionReportData) || {}} />
          )}
          {activeTab === 'projects' && (
            <ProjectsReportTab data={(currentData as ProjectsReportData) || {}} perms={currentPerms} />
          )}
          {activeTab === 'employees' && (
            <EmployeesReportTab data={(currentData as EmployeesReportData) || {}} />
          )}
          {activeTab === 'time' && <TimeReportTab data={(currentData as TimeReportData) || {}} />}
          {activeTab === 'income-expense' && (
            <IncomeExpenseReportTab data={(currentData as IncomeExpenseReportData) || {}} />
          )}
          {activeTab === 'ageing' && (
            <AgeingReportTab data={(currentData as InvoiceAgeingReportData) || {}} />
          )}
          {activeTab === 'recurring-invoices' && (
            <RecurringInvoicesReportTab data={(currentData as RecurringInvoicesReportData) || {}} />
          )}
          {activeTab === 'payment-reconciliation' && (
            <PaymentReconciliationReportTab
              data={(currentData as PaymentReconciliationReportData) || {}}
            />
          )}
        </div>
      )}
    </div>
  );
};
