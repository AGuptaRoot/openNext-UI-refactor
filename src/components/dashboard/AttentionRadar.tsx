import React from 'react';
import { useNavigate } from 'react-router-dom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { DashboardData } from '../../types/dashboard';
import { useAuth } from '../../context/AuthContext';

interface AttentionRadarProps {
  data: DashboardData;
  /** @deprecated Prefer in-component navigation; kept for Dashboard compatibility */
  onNavigateUnmigrated?: (moduleName: string) => void;
}

/** Roles that should see finance overdue-invoice escalations on the radar. */
const FINANCE_ALERT_ROLES = new Set([
  'crm-manager',
  'sales-manager',
  'finance-manager',
]);

export const AttentionRadar: React.FC<AttentionRadarProps> = ({ data }) => {
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const showInvoiceAlerts = FINANCE_ALERT_ROLES.has(activeRole);

  const overdueInvoicesCount = showInvoiceAlerts
    ? data.overdueInvoices ||
      (data.unpaidInvoicesList || []).filter(
        (invoice) => invoice.isOverdue || invoice.status === 'Overdue'
      ).length ||
      0
    : 0;
  const overdueTasksCount = data.overdueTasks || (data.overdueTasksList || []).length || 0;
  const urgentTicketsCount =
    Number(
      (data.opportunitiesSummary as { ticketStats?: { urgentTickets?: number } } | null)?.ticketStats
        ?.urgentTickets
    ) ||
    (data.urgentTicketsList || []).length ||
    0;
  const blockedTasksCount = data.blockedAwaitingClientTasks?.length || 0;
  const pendingPortalApprovals = Number(data.pendingPortalApprovals) || 0;

  const hasAlerts =
    overdueInvoicesCount > 0 ||
    overdueTasksCount > 0 ||
    urgentTicketsCount > 0 ||
    blockedTasksCount > 0 ||
    pendingPortalApprovals > 0;

  if (!hasAlerts) {
    return (
      <div
        data-tour="dashboard-attention-radar"
        className="bg-white border border-zinc-300 rounded-xl px-5 py-3.5 flex items-center gap-3"
      >
        <CheckCircleOutlineIcon className="text-emerald-600" sx={{ fontSize: 22 }} />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-zinc-950 m-0 leading-tight">
            Attention Radar: All Systems Operational
          </h4>
          <p className="text-xs text-zinc-500 m-0 mt-0.5">
            {activeRole === 'project-manager' || activeRole === 'crm-employee'
              ? 'No overdue tasks, blocked deliverables, or critical tickets needing attention.'
              : 'No overdue invoices, blocked deliverables, or critical tickets requiring immediate escalation.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tour="dashboard-attention-radar"
      className="bg-white border border-zinc-950 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-950 text-white flex items-center justify-center flex-shrink-0">
          <WarningAmberIcon sx={{ fontSize: 20 }} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-zinc-950 m-0 leading-tight">
            Attention Radar: Operational Escalations Pending
          </h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-zinc-600">
            {overdueInvoicesCount > 0 && (
              <span>
                <strong className="text-red-600 font-bold">{overdueInvoicesCount}</strong> overdue
                invoice
                {overdueInvoicesCount > 1 ? 's' : ''}
              </span>
            )}
            {overdueTasksCount > 0 && (
              <span>
                <strong className="text-amber-600 font-bold">{overdueTasksCount}</strong> late task
                {overdueTasksCount > 1 ? 's' : ''}
              </span>
            )}
            {blockedTasksCount > 0 && (
              <span>
                <strong className="text-zinc-950 font-bold">{blockedTasksCount}</strong> task
                {blockedTasksCount > 1 ? 's' : ''} waiting on client
              </span>
            )}
            {pendingPortalApprovals > 0 && (
              <span>
                <strong className="text-blue-600 font-bold">{pendingPortalApprovals}</strong> portal
                request{pendingPortalApprovals > 1 ? 's' : ''} pending approval
              </span>
            )}
            {urgentTicketsCount > 0 && (
              <span>
                <strong className="text-red-600 font-bold">{urgentTicketsCount}</strong> urgent support
                ticket
                {urgentTicketsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {overdueInvoicesCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/invoices?status=Overdue')}
            className="h-8 px-3 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg border-none cursor-pointer transition-colors duration-150"
          >
            Review Invoices ({overdueInvoicesCount})
          </button>
        )}
        {overdueTasksCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/tasks?due=overdue')}
            className="h-8 px-3 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-900 rounded-lg cursor-pointer transition-all duration-150"
          >
            View Late Tasks ({overdueTasksCount})
          </button>
        )}
        {urgentTicketsCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/tickets?attention=escalations')}
            className="h-8 px-3 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-900 rounded-lg cursor-pointer transition-all duration-150"
          >
            Escalations ({urgentTicketsCount})
          </button>
        )}
        {pendingPortalApprovals > 0 && (
          <button
            type="button"
            onClick={() => navigate('/clients?tab=portal')}
            className="h-8 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg border-none cursor-pointer transition-colors duration-150"
          >
            Portal Approvals ({pendingPortalApprovals})
          </button>
        )}
      </div>
    </div>
  );
};
