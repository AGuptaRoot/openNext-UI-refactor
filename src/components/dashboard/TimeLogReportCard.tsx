import React from 'react';
import { useNavigate } from 'react-router-dom';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { DashboardData } from '../../types/dashboard';
import { dashboardListPath } from '../../utils/dashboardNavigation';
import { formatCrmMoney, getRuntimeDefaultCurrency } from '../../utils/currency';

interface TimeLogReportCardProps {
  data: DashboardData;
  onNavigateUnmigrated: (moduleName: string) => void;
}

export const TimeLogReportCard: React.FC<TimeLogReportCardProps> = ({
  data,
  onNavigateUnmigrated: _onNavigateUnmigrated,
}) => {
  void _onNavigateUnmigrated;
  const navigate = useNavigate();
  const currency = data.defaultCurrency || getRuntimeDefaultCurrency();
  const logged = data.loggedHoursThisMonth || 0;
  const billable = data.billableHoursThisMonth || 0;
  const billableAmount = data.billableAmountThisMonth || 0;
  const billableRatio = logged > 0 ? Math.min(100, Math.round((billable / logged) * 100)) : 0;

  return (
    <div
      data-tour="dashboard-timelogs"
      className="bg-white border border-zinc-300 rounded-xl p-6 flex-1 flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-zinc-950 m-0 leading-tight">
              Time Log Report
            </h3>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              Team utilization and billable labor revenue.
            </p>
          </div>
          <AccessTimeOutlinedIcon className="text-zinc-950" sx={{ fontSize: 22 }} />
        </div>

        {/* Primary Stats Box */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-lg mb-5">
          <div>
            <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
              Logged Hours
            </span>
            <div className="text-xl font-bold font-mono text-zinc-950">
              {logged.toFixed(1)}h
            </div>
            <span className="text-[11px] text-zinc-400">
              {billable.toFixed(1)}h billable
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
              Accrued Revenue
            </span>
            <div className="text-xl font-bold font-mono text-zinc-950">
              {formatCrmMoney(billableAmount, currency)}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">
              Billable labor value
            </span>
          </div>
        </div>

        {/* Utilization Ratio */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-zinc-600">
              Billable Utilization Ratio
            </span>
            <span className="text-xs font-bold text-zinc-950">
              {billableRatio}%
            </span>
          </div>
          {/* Tailwind Progress Bar */}
          <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-950 rounded-full transition-all duration-300"
              style={{ width: `${billableRatio}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-6 border-t border-zinc-200">
        <span className="text-xs text-zinc-500">
          Timesheets update in real-time
        </span>
        <button
          type="button"
          onClick={() => navigate(dashboardListPath('timeLogs'))}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
        >
          <span>View Timesheets</span>
          <ArrowForwardIcon sx={{ fontSize: 13 }} />
        </button>
      </div>
    </div>
  );
};
