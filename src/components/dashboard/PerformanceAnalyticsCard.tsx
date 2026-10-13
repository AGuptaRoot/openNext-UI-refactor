import React from 'react';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { DashboardData } from '../../types/dashboard';

interface PerformanceAnalyticsCardProps {
  data: DashboardData;
  onNavigateUnmigrated: (moduleName: string) => void;
}

function formatMoney(amount: number | undefined, currency = 'INR'): string {
  const num = Number(amount || 0);
  return `${currency} ${num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export const PerformanceAnalyticsCard: React.FC<PerformanceAnalyticsCardProps> = ({
  data,
  onNavigateUnmigrated,
}) => {
  const currency = data.defaultCurrency || 'INR';
  const totalLeads = data.totalLeads || 0;
  const wonLeads = data.wonLeads || 0;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const paidInvoices = data.paidInvoices || 0;
  const unpaidInvoices = data.unpaidInvoices || 0;
  const totalPayments = data.totalPaymentsThisMonth || 0;

  return (
    <div
      data-tour="dashboard-analytics"
      className="bg-white border border-zinc-300 rounded-xl p-6 flex-1 flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-zinc-950 m-0 leading-tight">
              Performance Analytics
            </h3>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              Conversion efficiency, billing velocity, and client retention.
            </p>
          </div>
          <AssessmentOutlinedIcon className="text-zinc-950" sx={{ fontSize: 22 }} />
        </div>

        {/* Primary Metric: Lead-to-Win Conversion */}
        <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-200 rounded-lg mb-5">
          <div>
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Lead-to-Win Conversion
            </span>
            <div className="text-3xl font-bold text-zinc-950 tracking-tight my-1">
              {conversionRate}%
            </div>
            <p className="text-xs text-zinc-500 m-0">
              <strong className="text-zinc-950 font-semibold">{wonLeads} won</strong> from {totalLeads} total prospects
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Total Revenue
            </span>
            <div className="text-lg font-bold text-zinc-950 font-mono my-0.5">
              {formatMoney(totalPayments, currency)}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">
              Settled this period
            </span>
          </div>
        </div>

        {/* Breakdown Items */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-600">Invoices Settled</span>
            <span className="font-semibold text-zinc-950">
              {paidInvoices} paid <span className="text-zinc-400 font-normal">({unpaidInvoices} open)</span>
            </span>
          </div>
          <div className="h-[1px] bg-zinc-200" />

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-600">Active Client Accounts</span>
            <span className="font-semibold text-zinc-950">
              {data.totalClients || 0} clients
            </span>
          </div>
          <div className="h-[1px] bg-zinc-200" />

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-600">Billable Hours Logged</span>
            <span className="font-semibold font-mono text-zinc-950">
              {(data.billableHoursThisMonth || 0).toFixed(1)} hrs
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-6 border-t border-zinc-200">
        <span className="text-xs text-zinc-500">
          Revenue efficiency index is optimal
        </span>
        <button
          type="button"
          onClick={() => onNavigateUnmigrated('Reports')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
        >
          <span>View Full Report</span>
          <ArrowForwardIcon sx={{ fontSize: 13 }} />
        </button>
      </div>
    </div>
  );
};
