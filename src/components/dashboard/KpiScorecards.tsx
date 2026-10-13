import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import { DashboardData, CrmRole } from '../../types/dashboard';
import { useAuth } from '../../context/AuthContext';
import { dashboardListPath } from '../../utils/dashboardNavigation';

interface KpiScorecardsProps {
  data: DashboardData;
  onNavigateUnmigrated: (moduleName: string) => void;
}

type KpiId = 'revenue' | 'leads' | 'projects' | 'tasks' | 'health' | 'hours';

/** Role-tailored KPI strip — project managers never see lead / revenue sales metrics. */
const ROLE_KPIS: Record<CrmRole, KpiId[]> = {
  'crm-manager': ['revenue', 'leads', 'projects', 'tasks', 'health'],
  'sales-manager': ['revenue', 'leads', 'projects', 'tasks', 'health'],
  'sales-representative': ['leads', 'projects', 'tasks', 'health'],
  'project-manager': ['projects', 'tasks', 'health', 'hours'],
  'crm-employee': ['projects', 'tasks', 'health', 'hours'],
  'finance-manager': ['revenue', 'projects', 'tasks', 'health'],
  client: ['projects', 'tasks', 'health'],
};

function formatMoney(amount: number | undefined, currency = 'INR'): string {
  const num = Number(amount || 0);
  return `${currency} ${num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export const KpiScorecards: React.FC<KpiScorecardsProps> = ({
  data,
  onNavigateUnmigrated: _onNavigateUnmigrated,
}) => {
  void _onNavigateUnmigrated;
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const visibleKpis = useMemo(
    () => ROLE_KPIS[activeRole] || ROLE_KPIS['crm-manager'],
    [activeRole]
  );

  const currency = data.defaultCurrency || 'INR';
  const paymentsValue = data.totalPaymentsThisMonth || 0;
  const totalLeads = data.totalLeads || 0;
  const newLeads = data.newLeads || 0;
  const activeProjects = data.activeProjects ?? data.totalProjects ?? 0;
  const totalProjects = data.totalProjects ?? 0;
  const openTasks = data.openTasks ?? 0;
  const overdueTasks = data.overdueTasks ?? data.overdueTasksList?.length ?? 0;
  const blockedTasks = data.blockedAwaitingClientTasks?.length ?? 0;
  const loggedHours = Number(data.loggedHoursThisMonth || 0);
  const billableHours = Number(data.billableHoursThisMonth || 0);

  const todayYmd = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  })();

  const dueToday = (() => {
    const fromApi = Number((data as DashboardData & { dueTodayCount?: number }).dueTodayCount);
    if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
    const pool = [
      ...(data.overdueTasksList || []),
      ...(data.watchedTasksList || []),
      ...(data.blockedAwaitingClientTasks || []),
    ];
    const seen = new Set<string>();
    let count = 0;
    for (const task of pool) {
      const key = String(task._id || task.id || task.title || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      if (!task.dueDate) continue;
      const d = new Date(task.dueDate);
      if (Number.isNaN(d.getTime())) continue;
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      if (ymd === todayYmd) count += 1;
    }
    return count;
  })();

  const healthRisk = overdueTasks > 0 || blockedTasks > 0;
  const colClass =
    visibleKpis.length <= 4
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4';

  const go = (path: string) => navigate(path);

  const healthPath = () => {
    if (overdueTasks > 0) return dashboardListPath('tasksOverdue');
    if (blockedTasks > 0) return dashboardListPath('tasksBlockedClient');
    if (dueToday > 0) return dashboardListPath('tasksDueToday');
    return dashboardListPath('tasksOpen');
  };

  const cardClass =
    'bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl p-5 cursor-pointer flex flex-col justify-between transition-colors duration-150';

  return (
    <div data-tour="dashboard-kpis" className={colClass}>
      {visibleKpis.includes('revenue') && (
        <div
          data-tour="dashboard-kpi-revenue"
          role="link"
          tabIndex={0}
          onClick={() => go(dashboardListPath('invoicesPaid'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go(dashboardListPath('invoicesPaid'));
          }}
          className={cardClass}
          title="View paid invoices"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Revenue Collected
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center border border-zinc-200">
              <TrendingUpIcon sx={{ fontSize: 18 }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tracking-tight mb-1">
            {formatMoney(paymentsValue, currency)}
          </div>
          <p className="text-xs text-zinc-500 m-0">
            <strong className="text-zinc-950 font-semibold">{data.paidInvoices || 0} invoices</strong>{' '}
            settled this period
          </p>
        </div>
      )}

      {visibleKpis.includes('leads') && (
        <div
          data-tour="dashboard-kpi-leads"
          role="link"
          tabIndex={0}
          onClick={() => go(dashboardListPath('leads'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go(dashboardListPath('leads'));
          }}
          className={cardClass}
          title="View leads"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Inbound Leads
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center border border-zinc-200">
              <PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tracking-tight mb-1">
            {totalLeads}
          </div>
          <p className="text-xs text-zinc-500 m-0">
            <strong className="text-zinc-950 font-semibold">+{newLeads} new</strong> •{' '}
            <button
              type="button"
              className="font-semibold text-zinc-950 underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                go(dashboardListPath('leadsWon'));
              }}
            >
              {data.wonLeads || 0} converted
            </button>
          </p>
        </div>
      )}

      {visibleKpis.includes('projects') && (
        <div
          data-tour="dashboard-kpi-projects"
          role="link"
          tabIndex={0}
          onClick={() => go(dashboardListPath('projectsActive'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go(dashboardListPath('projectsActive'));
          }}
          className={cardClass}
          title="View in-progress projects"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Active Projects
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center border border-zinc-200">
              <FolderOutlinedIcon sx={{ fontSize: 18 }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tracking-tight mb-1">
            {activeProjects}
          </div>
          <p className="text-xs text-zinc-500 m-0">
            Across <strong className="text-zinc-950 font-semibold">{totalProjects}</strong> client
            accounts
          </p>
        </div>
      )}

      {visibleKpis.includes('tasks') && (
        <div
          data-tour="dashboard-kpi-tasks"
          role="link"
          tabIndex={0}
          onClick={() =>
            go(dueToday > 0 ? dashboardListPath('tasksDueToday') : dashboardListPath('tasksOpen'))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              go(dueToday > 0 ? dashboardListPath('tasksDueToday') : dashboardListPath('tasksOpen'));
            }
          }}
          className={cardClass}
          title="View open tasks"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Open Deliverables
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center border border-zinc-200">
              <AssignmentOutlinedIcon sx={{ fontSize: 18 }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tracking-tight mb-1">
            {openTasks}
          </div>
          <p className="text-xs text-zinc-500 m-0">
            {dueToday > 0 ? (
              <>
                <strong className="text-zinc-950 font-semibold">{dueToday} due today</strong>
                {' · '}active work queue
              </>
            ) : (
              <>
                <strong className="text-zinc-950 font-semibold">Active work queue</strong>
                {' · '}no items due today
              </>
            )}
          </p>
        </div>
      )}

      {visibleKpis.includes('hours') && (
        <div
          data-tour="dashboard-kpi-hours"
          role="link"
          tabIndex={0}
          onClick={() => go(dashboardListPath('timeLogs'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go(dashboardListPath('timeLogs'));
          }}
          className={cardClass}
          title="View time logs"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Hours Logged
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center border border-zinc-200">
              <AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tracking-tight mb-1">
            {loggedHours.toLocaleString('en-IN', { maximumFractionDigits: 1 })}h
          </div>
          <p className="text-xs text-zinc-500 m-0">
            <button
              type="button"
              className="font-semibold text-zinc-950 underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                go(dashboardListPath('timeLogsBillable'));
              }}
            >
              {billableHours.toLocaleString('en-IN', { maximumFractionDigits: 1 })}h billable
            </button>{' '}
            this period
          </p>
        </div>
      )}

      {visibleKpis.includes('health') && (
        <div
          data-tour="dashboard-kpi-health"
          role="link"
          tabIndex={0}
          onClick={() => go(healthPath())}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go(healthPath());
          }}
          className={cardClass}
          title="View delivery health list"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Delivery Health
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                healthRisk
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-zinc-100 text-zinc-950 border-zinc-200'
              }`}
            >
              {healthRisk ? (
                <PriorityHighOutlinedIcon sx={{ fontSize: 18 }} />
              ) : (
                <CheckCircleOutlinedIcon sx={{ fontSize: 18 }} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border border-zinc-200 ${
                healthRisk ? 'bg-zinc-100 text-red-600' : 'bg-zinc-100 text-emerald-600'
              }`}
            >
              {healthRisk ? 'Action Needed' : 'On Track'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(dashboardListPath('tasksOverdue'));
              }}
              className="flex items-center justify-between text-xs bg-transparent border-0 p-0 cursor-pointer text-left hover:opacity-80"
            >
              <span className={overdueTasks > 0 ? 'font-semibold text-red-600' : 'text-zinc-600'}>
                Overdue
              </span>
              <span
                className={`font-mono font-bold ${
                  overdueTasks > 0 ? 'text-red-600' : 'text-zinc-950'
                }`}
              >
                {overdueTasks}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(dashboardListPath('tasksDueToday'));
              }}
              className="flex w-full items-center justify-between border-t border-zinc-100 pt-1.5 text-xs bg-transparent border-x-0 border-b-0 cursor-pointer text-left hover:opacity-80"
            >
              <span className="text-zinc-600">Due today</span>
              <span className="font-mono font-bold text-zinc-950">{dueToday}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(dashboardListPath('tasksBlockedClient'));
              }}
              className="flex w-full items-center justify-between border-t border-zinc-100 pt-1.5 text-xs bg-transparent border-x-0 border-b-0 cursor-pointer text-left hover:opacity-80"
            >
              <span className="text-zinc-600">Blocked (client)</span>
              <span className="font-mono font-bold text-zinc-950">{blockedTasks}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
