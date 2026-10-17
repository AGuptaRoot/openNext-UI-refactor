import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckSquare,
  ClipboardList,
  CreditCard,
  Eye,
  Phone,
  Receipt,
  Siren,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import {
  CrmRole,
  DashboardData,
  DashboardPeriod,
  SectionDefinition,
} from '../../types/dashboard';

import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { AttentionRadar } from '../../components/dashboard/AttentionRadar';
import { KpiScorecards } from '../../components/dashboard/KpiScorecards';
import { SalesPipelineCard } from '../../components/dashboard/SalesPipelineCard';
import { PerformanceAnalyticsCard } from '../../components/dashboard/PerformanceAnalyticsCard';
import { MyTasksCard } from '../../components/dashboard/MyTasksCard';
import { MyAssignedActivitiesCard } from '../../components/dashboard/MyAssignedActivitiesCard';
import { CalendarScheduleCard } from '../../components/dashboard/CalendarScheduleCard';
import { PriorityWatchlistCard } from '../../components/dashboard/PriorityWatchlistCard';
import { TimeLogReportCard } from '../../components/dashboard/TimeLogReportCard';
import { QuickActionsCard } from '../../components/dashboard/QuickActionsCard';
import { RecentActivityCard } from '../../components/dashboard/RecentActivityCard';
import { BlockedTasksCard } from '../../components/dashboard/BlockedTasksCard';
import { WatchedTasksCard } from '../../components/dashboard/WatchedTasksCard';
import { ExpensesApprovalsCard } from '../../components/dashboard/ExpensesApprovalsCard';
import { CustomizeWidgetsDialog } from '../../components/dashboard/CustomizeWidgetsDialog';
import { UnmigratedModal } from '../../components/UnmigratedModal';

const SECTION_DEFS: SectionDefinition[] = [
  {
    id: 'attention_radar',
    title: 'Attention Radar',
    category: 'Alerts',
    icon: <Siren className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'High-priority action alert banner for overdue invoices, late tasks, and urgent tickets.',
  },
  {
    id: 'kpi_scorecards',
    title: 'Executive KPI Scorecards & Task Alert',
    category: 'Overview',
    icon: <BarChart3 className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Role-based top metrics (projects/tasks for delivery roles; leads/revenue for sales).',
  },
  {
    id: 'sales_pipeline',
    title: 'Sales Pipeline & Conversion Funnel',
    category: 'Sales',
    icon: <TrendingUp className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: '5-stage deal progression funnel, weighted forecast, and closed won business.',
  },
  {
    id: 'performance_analytics',
    title: 'Performance Analytics',
    category: 'Sales',
    icon: <TrendingDown className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Revenue trend and deals/orders velocity minimal line chart.',
  },
  {
    id: 'my_tasks',
    title: 'My Tasks Work Queue',
    category: 'Projects',
    icon: <CheckSquare className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Filterable task list with due dates, priority tags, and status badges.',
  },
  {
    id: 'my_assigned_activities',
    title: 'My Assigned Lead Activities',
    category: 'Sales',
    icon: <Phone className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Lead activities assigned to you (calls, meetings, follow-ups).',
  },
  {
    id: 'calendar_schedule',
    title: 'Upcoming Schedule & Timeline',
    category: 'General',
    icon: <Calendar className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Scheduled client meetings, demo calls, follow-ups, and calendar planner.',
  },
  {
    id: 'priority_watchlist',
    title: 'Recent Invoices & Orders',
    category: 'Finance',
    icon: <Receipt className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Recent customer invoices, purchase orders, balances due, and settlement statuses.',
  },
  {
    id: 'time_log_report',
    title: 'Time Log Report',
    category: 'Projects',
    icon: <Timer className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Logged hours, billable time utilization, and team timesheets.',
  },
  {
    id: 'quick_actions',
    title: '1-Click Quick Actions',
    category: 'General',
    icon: <Zap className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Role-filtered shortcuts (e.g. project managers: project, task, time, ticket).',
  },
  {
    id: 'recent_activity',
    title: 'Recent Activity Stream',
    category: 'General',
    icon: <ClipboardList className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Immutable audit trail of recent team actions, edits, and status changes.',
  },
  {
    id: 'blocked_client_tasks',
    title: 'Tasks Blocked Awaiting Client Reply',
    category: 'Projects',
    icon: <AlertTriangle className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Deliverables on hold awaiting client feedback or sign-off.',
  },
  {
    id: 'watched_tasks',
    title: 'Watched Tasks & Deliverables',
    category: 'Projects',
    icon: <Eye className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Personalized watchlist of deliverables and milestones you are monitoring.',
  },
  {
    id: 'expenses_approvals',
    title: 'Expenses & Approvals Queue',
    category: 'Finance',
    icon: <CreditCard className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />,
    description: 'Pending expense claims, receipts, and reimbursement approval queue.',
  },
];

const DEFAULT_ROLE_SECTIONS: Record<CrmRole, string[]> = {
  'crm-manager': [
    'attention_radar',
    'kpi_scorecards',
    'sales_pipeline',
    'performance_analytics',
    'my_tasks',
    'my_assigned_activities',
    'calendar_schedule',
    'priority_watchlist',
    'time_log_report',
    'quick_actions',
    'recent_activity',
    'expenses_approvals',
  ],
  'sales-manager': [
    'attention_radar',
    'kpi_scorecards',
    'sales_pipeline',
    'performance_analytics',
    'my_tasks',
    'my_assigned_activities',
    'calendar_schedule',
    'priority_watchlist',
    'quick_actions',
    'recent_activity',
  ],
  'sales-representative': [
    'kpi_scorecards',
    'sales_pipeline',
    'my_tasks',
    'my_assigned_activities',
    'calendar_schedule',
    'quick_actions',
    'recent_activity',
  ],
  'project-manager': [
    'attention_radar',
    'kpi_scorecards',
    'my_tasks',
    'blocked_client_tasks',
    'watched_tasks',
    'calendar_schedule',
    'time_log_report',
    'quick_actions',
    'recent_activity',
  ],
  'crm-employee': [
    'my_tasks',
    'my_assigned_activities',
    'calendar_schedule',
    'time_log_report',
    'quick_actions',
    'recent_activity',
  ],
  'finance-manager': [
    'attention_radar',
    'kpi_scorecards',
    'priority_watchlist',
    'expenses_approvals',
    'time_log_report',
    'quick_actions',
    'recent_activity',
  ],
  client: [
    'kpi_scorecards',
    'my_tasks',
    'calendar_schedule',
    'priority_watchlist',
  ],
};

const STORAGE_PREFIX = 'opennext_crm_widgets_';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRole, isClient } = useAuth();

  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [unmigratedModal, setUnmigratedModal] = useState<{ open: boolean; moduleName: string }>({
    open: false,
    moduleName: '',
  });

  const allowedSections = React.useMemo(() => {
    const roleDefault = DEFAULT_ROLE_SECTIONS[activeRole] || DEFAULT_ROLE_SECTIONS['crm-manager'];
    if (isClient) {
      return roleDefault.filter((s) => !['sales_pipeline', 'performance_analytics', 'expenses_approvals', 'recent_activity'].includes(s));
    }
    return roleDefault;
  }, [activeRole, isClient]);

  const [enabledSections, setEnabledSections] = useState<string[]>(allowedSections);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${activeRole}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEnabledSections(parsed.filter((id) => allowedSections.includes(id)));
          return;
        }
      }
    } catch {}
    setEnabledSections(allowedSections);
  }, [activeRole, allowedSections]);

  const loadDashboard = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await crmApi.getDashboard({
          period,
          role: activeRole,
        });
        setData(res.data);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load dashboard metrics';
        setError(errorMsg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, activeRole]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSaveSections = (newSections: string[]) => {
    setEnabledSections(newSections);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${activeRole}`, JSON.stringify(newSections));
    } catch {}
    crmApi.saveDashboardWidgets({
      enabledWidgets: newSections,
      scope: 'user',
      role: activeRole,
    }).catch(() => {});
  };

  const handleNavigateUnmigrated = (moduleName: string) => {
    const migratedRoutes: Record<string, string> = {
      Leads: '/leads',
      Reports: '/reports',
      Dashboard: '/dashboard',
      Clients: '/clients',
      Opportunities: '/opportunities',
      Projects: '/projects',
      Tasks: '/tasks',
      'Time Logs': '/time-logs',
      Expenses: '/expenses',
      Quotations: '/quotations',
      Invoices: '/invoices',
      Payments: '/payments',
      'Sales Orders': '/sales-orders',
      Samples: '/samples',
      Tickets: '/tickets',
      'Support Tickets': '/tickets',
      'Customer Success': '/customer-success',
      Marketing: '/marketing',
      Settings: '/settings',
      Audit: '/audit',
      'Data Quality': '/data-quality',
      'Analytics AI': '/analytics-ai',
      Analytics: '/analytics-ai',
      Calendar: '/dashboard',
      'Audit History': '/audit',
    };
    const route = migratedRoutes[moduleName];
    if (route) {
      navigate(route);
      return;
    }
    setUnmigratedModal({ open: true, moduleName });
  };

  // Render Skeleton for Initial Loading using Tailwind
  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center pb-5 border-b border-zinc-200">
          <div>
            <div className="h-7 w-48 bg-zinc-200 rounded-lg mb-2" />
            <div className="h-4 w-72 bg-zinc-200 rounded" />
          </div>
          <div className="h-9 w-56 bg-zinc-200 rounded-lg" />
        </div>

        {/* KPI Scorecards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-zinc-200 rounded-xl" />
          ))}
        </div>

        {/* 2-Column Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 h-72 bg-zinc-200 rounded-xl" />
          <div className="lg:col-span-5 h-72 bg-zinc-200 rounded-xl" />
        </div>
      </div>
    );
  }

  // Render Error State
  if (error && !data) {
    return (
      <div className="py-24 text-center flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-red-600 flex items-center justify-center mb-4">
          <ErrorOutlineIcon sx={{ fontSize: 32 }} />
        </div>
        <h2 className="text-xl font-bold text-zinc-950 mb-1">
          Unable to Load Dashboard
        </h2>
        <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
          {error}
        </p>
        <button
          type="button"
          onClick={() => loadDashboard()}
          className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg border-none cursor-pointer transition-colors"
        >
          <RefreshIcon sx={{ fontSize: 16 }} />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  // Mock Fallback Data if backend returns partial/empty data during dev mode
  const currentData: DashboardData = data || {
    period,
    defaultCurrency: 'INR',
    totalLeads: 0,
    newLeads: 0,
    wonLeads: 0,
    totalClients: 0,
    activeProjects: 0,
    totalProjects: 0,
    openTasks: 0,
    overdueTasks: 0,
    overdueTasksList: [],
    blockedAwaitingClientTasks: [],
    watchedTasksList: [],
    watchedOpenTasks: 0,
    watchedOverdueTasks: 0,
    upcomingMilestones: [],
    unpaidInvoicesList: [],
    urgentTicketsList: [],
    opportunitiesSummary: null,
    customerHealthSummary: null,
    marketingSummary: null,
    recentAudit: [],
  };

  const showAttentionRadar = enabledSections.includes('attention_radar');
  const showKpis = enabledSections.includes('kpi_scorecards');
  const showBlockedTasks = enabledSections.includes('blocked_client_tasks');
  const showWatchedTasks = enabledSections.includes('watched_tasks');
  const showExpenses = enabledSections.includes('expenses_approvals');
  const showPipeline = enabledSections.includes('sales_pipeline');
  const showAnalytics = enabledSections.includes('performance_analytics');
  const showMyTasks = enabledSections.includes('my_tasks');
  const showMyAssignedActivities = enabledSections.includes('my_assigned_activities');
  const showCalendar = enabledSections.includes('calendar_schedule');
  const showWatchlist = enabledSections.includes('priority_watchlist');
  const showTimeLogs = enabledSections.includes('time_log_report');
  const showActions = enabledSections.includes('quick_actions');
  const showActivity = enabledSections.includes('recent_activity');

  return (
    <div data-tour="dashboard-root" className="flex flex-col gap-6">
      {/* 1. Header */}
      <DashboardHeader
        period={period}
        onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
        onCustomizeClick={() => setCustomizeOpen(true)}
        onRefreshClick={() => loadDashboard(true)}
        isRefreshing={refreshing}
      />

      {/* 2. Attention Radar Banner */}
      {showAttentionRadar && (
        <AttentionRadar
          data={currentData}
          onNavigateUnmigrated={handleNavigateUnmigrated}
        />
      )}

      {/* 3. KPI Scorecards */}
      {showKpis && (
        <KpiScorecards
          data={currentData}
          onNavigateUnmigrated={handleNavigateUnmigrated}
        />
      )}

      {/* 4. Special Scoped Sections */}
      {showBlockedTasks && (
        <BlockedTasksCard
          tasks={currentData.blockedAwaitingClientTasks || []}
          onNavigateUnmigrated={handleNavigateUnmigrated}
          onTasksChanged={() => loadDashboard(true)}
        />
      )}

      {showWatchedTasks && (
        <WatchedTasksCard
          tasks={currentData.watchedTasksList || []}
          openCount={currentData.watchedOpenTasks || 0}
          overdueCount={currentData.watchedOverdueTasks || 0}
          onNavigateUnmigrated={handleNavigateUnmigrated}
        />
      )}

      {showExpenses && (
        <ExpensesApprovalsCard
          data={currentData}
          onNavigateUnmigrated={handleNavigateUnmigrated}
        />
      )}

      {/* 5. Row 2: Sales Pipeline & Performance Analytics */}
      {(showPipeline || showAnalytics) && (
        <div className={`grid gap-5 items-stretch ${
          showPipeline && showAnalytics
            ? 'grid-cols-1 lg:grid-cols-12'
            : 'grid-cols-1'
        }`}>
          {showPipeline && (
            <div className={`flex flex-col ${showPipeline && showAnalytics ? 'lg:col-span-7' : ''}`}>
              <SalesPipelineCard
                data={currentData}
                onNavigateUnmigrated={handleNavigateUnmigrated}
              />
            </div>
          )}
          {showAnalytics && (
            <div className={`flex flex-col ${showPipeline && showAnalytics ? 'lg:col-span-5' : ''}`}>
              <PerformanceAnalyticsCard
                data={currentData}
                onNavigateUnmigrated={handleNavigateUnmigrated}
              />
            </div>
          )}
        </div>
      )}

      {/* 6. Row 3: My Tasks Work Queue & Upcoming Schedule */}
      {(showMyTasks || showCalendar) && (
        <div className={`grid gap-5 items-stretch ${
          showMyTasks && showCalendar
            ? 'grid-cols-1 lg:grid-cols-12'
            : 'grid-cols-1'
        }`}>
          {showMyTasks && (
            <div className={`flex flex-col ${showMyTasks && showCalendar ? 'lg:col-span-7' : ''}`}>
              <MyTasksCard
                data={currentData}
                onNavigateUnmigrated={handleNavigateUnmigrated}
              />
            </div>
          )}
          {showCalendar && (
            <div className={`flex flex-col ${showMyTasks && showCalendar ? 'lg:col-span-5' : ''}`}>
              <CalendarScheduleCard
                data={currentData}
                onNavigateUnmigrated={handleNavigateUnmigrated}
              />
            </div>
          )}
        </div>
      )}

      {showMyAssignedActivities && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 flex flex-col">
            <MyAssignedActivitiesCard data={currentData} />
          </div>
        </div>
      )}

      {/* 7. Row 4: Priority Watchlist, Time Log Report, Quick Actions & Activity */}
      {(showWatchlist || showTimeLogs || showActions || showActivity) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {showWatchlist && (
            <div className="lg:col-span-5 flex flex-col">
              <PriorityWatchlistCard
                data={currentData}
                onNavigateUnmigrated={handleNavigateUnmigrated}
              />
            </div>
          )}
          {showTimeLogs && (
            <div className="lg:col-span-4 flex flex-col">
              <TimeLogReportCard
                data={currentData}
                onNavigateUnmigrated={handleNavigateUnmigrated}
              />
            </div>
          )}
          {(showActions || showActivity) && (
            <div className="lg:col-span-3 flex flex-col gap-5">
              {showActions && (
                <QuickActionsCard
                  onNavigateUnmigrated={handleNavigateUnmigrated}
                />
              )}
              {showActivity && (
                <RecentActivityCard
                  auditList={currentData.recentAudit}
                  onNavigateUnmigrated={handleNavigateUnmigrated}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <CustomizeWidgetsDialog
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        sections={SECTION_DEFS}
        enabledSections={enabledSections}
        allowedSections={allowedSections}
        defaultSections={allowedSections}
        onSave={handleSaveSections}
      />

      <UnmigratedModal
        open={unmigratedModal.open}
        moduleName={unmigratedModal.moduleName}
        onClose={() => setUnmigratedModal({ open: false, moduleName: '' })}
      />
    </div>
  );
};

