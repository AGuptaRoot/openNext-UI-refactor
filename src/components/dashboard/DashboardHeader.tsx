import React from 'react';
import { CircularProgress } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import { CrmRole, DashboardPeriod } from '../../types/dashboard';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { CrmRoleIcon } from '../icons/CrmRoleIcon';

interface DashboardHeaderProps {
  period: DashboardPeriod;
  onPeriodChange: (newPeriod: DashboardPeriod) => void;
  onCustomizeClick: () => void;
  onRefreshClick: () => void;
  isRefreshing: boolean;
}

const ROLE_LABELS: Record<CrmRole, { label: string }> = {
  'crm-manager': { label: 'CRM Manager' },
  'sales-manager': { label: 'Sales Manager' },
  'sales-representative': { label: 'Sales Representative' },
  'project-manager': { label: 'Project Lead' },
  'crm-employee': { label: 'Team Member' },
  'finance-manager': { label: 'Finance Lead' },
  client: { label: 'Client Portal' },
};

const PERIODS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
];

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  period,
  onPeriodChange,
  onCustomizeClick,
  onRefreshClick,
  isRefreshing,
}) => {
  const { user, activeRole } = useAuth();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const displayName = user?.username || user?.email?.split('@')[0] || 'Admin';
  const currentRoleObj = ROLE_LABELS[activeRole] || ROLE_LABELS['crm-employee'];

  return (
    <div
      data-tour="dashboard-header"
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-200"
    >
      <div data-tour="dashboard-title">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <h1 className="text-2xl sm:text-[26px] font-bold text-zinc-950 tracking-tight m-0">
            Dashboard
          </h1>

          <span
            data-tour="dashboard-role"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-zinc-100 text-zinc-900 border border-zinc-200 px-2.5 py-1 rounded-lg"
            title="CRM role from your CMS session (not switchable)"
          >
            <CrmRoleIcon role={activeRole} className="h-4 w-4 shrink-0 text-zinc-700" />{' '}
            {currentRoleObj.label}
          </span>
        </div>

        <p className="text-sm text-zinc-500 m-0">
          Welcome back, <strong className="text-zinc-950">{displayName}</strong>.{' '}
          {activeRole === 'project-manager'
            ? 'Here is your project delivery summary for today.'
            : 'Here is the operational summary for your business today.'}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div
          data-tour="dashboard-date"
          className="flex items-center gap-2 bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-900"
        >
          <CalendarTodayOutlinedIcon sx={{ fontSize: 13, color: '#71717a' }} />
          <span>{formattedDate}</span>
        </div>

        <div
          data-tour="dashboard-period-filter"
          className="bg-zinc-100 p-1 rounded-lg border border-zinc-200 flex items-center"
        >
          {PERIODS.map((p) => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onPeriodChange(p.value)}
                className={`text-xs font-medium px-2.5 sm:px-3 py-1 rounded-md border-none cursor-pointer transition-colors duration-150 ${
                  isActive
                    ? 'bg-zinc-950 text-white font-semibold'
                    : 'bg-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          data-tour="dashboard-customize-btn"
          onClick={onCustomizeClick}
          className="inline-flex items-center gap-1.5 h-[34px] px-3 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-900 rounded-lg cursor-pointer transition-all duration-150"
        >
          <TuneIcon sx={{ fontSize: 15 }} />
          <span>Customize</span>
        </button>

        <button
          type="button"
          data-tour="dashboard-refresh-btn"
          onClick={onRefreshClick}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 h-[34px] px-3 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-900 rounded-lg cursor-pointer transition-all duration-150 disabled:opacity-50"
        >
          {isRefreshing ? (
            <CircularProgress size={13} sx={{ color: '#09090b' }} />
          ) : (
            <RefreshIcon sx={{ fontSize: 15 }} />
          )}
          <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
        </button>

        <TourButton
          moduleId="dashboard"
          className="inline-flex items-center gap-1.5 h-[34px] px-3 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 border-0 rounded-lg cursor-pointer transition-all duration-150"
        />
      </div>
    </div>
  );
};
