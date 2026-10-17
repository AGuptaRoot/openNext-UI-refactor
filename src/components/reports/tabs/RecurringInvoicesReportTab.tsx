import React, { useMemo } from 'react';
import {
  Calendar,
  CircleDollarSign,
  FileText,
  Landmark,
  Pause,
  Receipt,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { RecurringInvoicesReportData } from '../../../types/reports';
import {
  MetricCard,
  MetricGrid,
  ChartCard,
  DonutChart,
  HorizontalBar,
  formatMoney,
  formatDate,
  ReportEmptyState,
} from '../ReportCharts';
import { getRuntimeDefaultCurrency } from '../../../utils/currency';

export interface RecurringInvoicesReportTabProps {
  data: RecurringInvoicesReportData;
}

export const RecurringInvoicesReportTab: React.FC<RecurringInvoicesReportTabProps> = ({ data }) => {
  const currency = data.defaultCurrency || getRuntimeDefaultCurrency();

  const metrics = useMemo(() => {
    const totalActive = Number(data.totalActive ?? data.activeProfiles ?? 0) || 0;
    const mrr = Number(data.monthlyRecurringRevenue ?? data.projectedMrr ?? 0) || 0;
    const arr =
      Number(data.annualRecurringRevenue ?? data.projectedArr ?? mrr * 12) || 0;
    const byFrequency = data.byFrequency || [];
    const upcomingRuns =
      (Array.isArray(data.upcomingRuns) && data.upcomingRuns.length
        ? data.upcomingRuns
        : (data.profiles || []).filter(
            (p) => String(p.status || '').toLowerCase() === 'active' && p.nextRunDate
          )) || [];
    const totalPaymentAmount =
      Number(
        data.totalPaymentAmount ??
          data.activeContractsValue ??
          upcomingRuns.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
      ) || 0;
    const totalBilledAmount = Number(data.totalGeneratedAmount ?? 0) || 0;
    const totalGeneratedInvoices = Number(data.totalGeneratedInvoices ?? 0) || 0;
    const upcomingPaymentTotal =
      Number(
        data.upcomingPaymentTotal ??
          upcomingRuns.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
      ) || 0;

    return {
      totalActive,
      mrr,
      arr,
      byFrequency,
      upcomingRuns,
      totalPaymentAmount,
      totalBilledAmount,
      totalGeneratedInvoices,
      upcomingPaymentTotal,
    };
  }, [data]);

  const {
    totalActive,
    mrr,
    arr,
    byFrequency,
    upcomingRuns,
    totalPaymentAmount,
    totalBilledAmount,
    totalGeneratedInvoices,
    upcomingPaymentTotal,
  } = metrics;
  const freqMax = Math.max(...byFrequency.map((f) => Number(f.count) || 0), 1);

  const hasData =
    totalActive > 0 ||
    mrr > 0 ||
    totalPaymentAmount > 0 ||
    totalBilledAmount > 0 ||
    byFrequency.length > 0 ||
    upcomingRuns.length > 0 ||
    (data.totalProfiles ?? 0) > 0;

  if (!hasData) {
    return (
      <div data-tour="report-tab-recurring">
        <ReportEmptyState
          message={data.message || 'No active recurring invoice profiles found.'}
        />
      </div>
    );
  }

  return (
    <div data-tour="report-tab-recurring" className="flex flex-col gap-5">
      <div data-tour="report-recurring-kpis">
      <MetricGrid>
        <MetricCard
          label="Active Contracts"
          value={totalActive}
          icon={<RefreshCw className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Profiles"
          sub={`${data.pausedProfiles ?? 0} paused · ${data.completedProfiles ?? 0} completed`}
          to="/invoices?tab=recurring"
        />
        <MetricCard
          label="Total Payment Amount"
          value={formatMoney(totalPaymentAmount, currency)}
          icon={<CircleDollarSign className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Per cycle"
          sub="Sum of active contract amounts"
          to="/invoices?tab=recurring"
        />
        <MetricCard
          label="Monthly MRR"
          value={formatMoney(mrr, currency)}
          icon={<Calendar className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Predictable"
          sub="Normalized monthly baseline"
          to="/invoices?tab=recurring"
        />
        <MetricCard
          label="Annualized ARR"
          value={formatMoney(arr, currency)}
          icon={<Landmark className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Run-rate"
          sub="ARR = MRR × 12"
          to="/invoices?tab=recurring"
        />
      </MetricGrid>

      <MetricGrid>
        <MetricCard
          label="Upcoming Schedules"
          value={upcomingRuns.length}
          icon={<Zap className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Pipeline"
          sub={formatMoney(upcomingPaymentTotal, currency) + ' next cycle'}
          to="/invoices?tab=recurring"
        />
        <MetricCard
          label="Invoices Generated"
          value={totalGeneratedInvoices}
          icon={<FileText className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="History"
          sub="Cycles completed so far"
          to="/invoices?tab=recurring"
        />
        <MetricCard
          label="Total Billed Amount"
          value={formatMoney(totalBilledAmount, currency)}
          icon={<Receipt className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="To date"
          sub="Generated invoice value"
          to="/invoices?tab=recurring"
        />
        <MetricCard
          label="Paused / Completed"
          value={`${data.pausedProfiles ?? 0} / ${data.completedProfiles ?? 0}`}
          icon={<Pause className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Status"
          sub="Non-active profiles"
          to="/invoices?tab=recurring"
        />
      </MetricGrid>
      </div>

      {byFrequency.length > 0 && (
        <div data-tour="report-recurring-charts">
        <ChartCard
          tourId="report-recurring-frequency"
          title="Contracts by billing frequency"
          subtitle="Recurring billing cycle distribution"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
            <DonutChart
              items={byFrequency.map((f) => ({
                label: f.frequency,
                value: Number(f.count) || 0,
              }))}
              title="Billing frequencies"
            />
            <div className="flex flex-col gap-1 pt-2">
              {byFrequency.map((f, i) => (
                <HorizontalBar
                  key={i}
                  label={f.frequency}
                  value={Number(f.count) || 0}
                  max={freqMax}
                  to="/invoices?tab=recurring"
                />
              ))}
            </div>
          </div>
        </ChartCard>
        </div>
      )}

      {upcomingRuns.length > 0 && (
        <ChartCard tourId="report-recurring-schedule" title="Upcoming auto-billing schedule" subtitle="Next scheduled invoice runs">
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Profile</th>
                  <th className="py-2.5 px-3">Next Run</th>
                  <th className="py-2.5 px-3">Frequency</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {upcomingRuns.map((r, i) => (
                  <tr key={String(r.id || `${r.clientName}-${i}`)} className="hover:bg-zinc-50">
                    <td className="py-2.5 px-3 font-semibold text-zinc-950">{r.clientName}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-600">
                      {r.invoiceNumber || r.profileName || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-zinc-800">
                      {formatDate(r.nextRunDate)}
                    </td>
                    <td className="py-2.5 px-3 capitalize text-zinc-600">{r.frequency}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-950">
                      {formatMoney(r.amount, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {r.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 border-t border-zinc-200">
                  <td colSpan={4} className="py-2.5 px-3 text-xs font-semibold text-zinc-700">
                    Total payment amount (upcoming cycle)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm font-bold text-zinc-950">
                    {formatMoney(upcomingPaymentTotal, currency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
};
