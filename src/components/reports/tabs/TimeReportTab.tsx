import React from 'react';
import { Link } from 'react-router-dom';
import { TimeReportData } from '../../../types/reports';
import { displayUserLabel } from '../../../utils/displayLabels';
import {
  MetricCard,
  MetricGrid,
  ChartCard,
  DonutChart,
  LineChart,
  VerticalBarChart,
  HorizontalBar,
  ReportEmptyState,
} from '../ReportCharts';

export interface TimeReportTabProps {
  data: TimeReportData;
}

export const TimeReportTab: React.FC<TimeReportTabProps> = ({ data }) => {
  const byProject = data.byProject || [];
  const byUser = data.byUser || [];
  const byPeriod = data.byPeriod || [];

  const projectMax = Math.max(...byProject.map((p) => p.hours), 1);

  const hasData =
    (data.totalHours ?? 0) > 0 ||
    byProject.length > 0 ||
    byUser.length > 0 ||
    byPeriod.length > 0;

  if (!hasData) {
    return (
      <div data-tour="report-tab-time">
        <ReportEmptyState message="No labor time logs found for this date range." />
      </div>
    );
  }

  return (
    <div data-tour="report-tab-time" className="flex flex-col gap-5">
      {/* 1. KPIs */}
      <div data-tour="report-time-kpis">
      <MetricGrid>
        <MetricCard
          label="Total Hours Logged"
          value={`${data.totalHours ?? 0}h`}
          icon="⏰"
          hint="Labor"
          sub="All logged work"
          to="/time-logs"
        />
        <MetricCard
          label="Billable Hours"
          value={`${data.billableHours ?? 0}h`}
          icon="💳"
          hint="Invoiced"
          sub="Client-chargeable"
          to="/time-logs?billable=billable"
        />
        <MetricCard
          label="Non-Billable"
          value={`${data.nonBillableHours ?? 0}h`}
          icon="💼"
          hint="Internal"
          sub="Admin & overhead"
          to="/time-logs?billable=non"
        />
        <MetricCard
          label="Billable Ratio"
          value={`${data.billablePercent ?? 0}%`}
          icon="📊"
          hint="Efficiency"
          sub="Billable / Total"
          to="/time-logs"
        />
      </MetricGrid>
      </div>

      {/* 2. Charts */}
      <div data-tour="report-time-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {byProject.length > 0 && (
          <ChartCard tourId="report-time-by-project" title="Hours by project" subtitle="Labor allocation across clients">
            <DonutChart
              items={byProject.map((p) => ({ label: p.name, value: Math.round(p.hours) }))}
              title="Project hours"
            />
            <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-1">
              {byProject.map((p, i) => (
                <HorizontalBar
                  key={i}
                  label={p.name}
                  value={p.hours}
                  max={projectMax}
                  to={
                    p.projectId
                      ? `/time-logs?projectId=${encodeURIComponent(p.projectId)}`
                      : '/time-logs'
                  }
                />
              ))}
            </div>
          </ChartCard>
        )}

        {byPeriod.length > 0 && (
          <ChartCard tourId="report-time-trend" title="Labor hours over time" subtitle="Monthly timesheet trend">
            <LineChart
              items={byPeriod.map((p) => ({ label: p.period, value: p.hours }))}
              title="Monthly hours trend"
            />
            <div className="mt-3">
              <VerticalBarChart
                items={byPeriod.map((p) => ({ label: p.period, value: p.hours }))}
                title="Monthly hours bar"
              />
            </div>
          </ChartCard>
        )}
      </div>

      {/* 3. Team Member Breakdown Table */}
      {byUser.length > 0 && (
        <ChartCard tourId="report-time-team" title="Team timesheet breakdown" subtitle="Individual labor and utilization">
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Team Member</th>
                  <th className="py-2.5 px-3 text-center">Total Hours</th>
                  <th className="py-2.5 px-3 text-center">Billable Hours</th>
                  <th className="py-2.5 px-3 text-right">Billable %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {byUser.map((u, i) => {
                  const billableRatio = u.hours > 0 ? Math.round((u.billableHours / u.hours) * 100) : 0;
                  const userPath = u.userId
                    ? `/time-logs?userId=${encodeURIComponent(u.userId)}`
                    : '/time-logs';
                  return (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="py-2.5 px-3 font-semibold text-zinc-950">
                        <Link to={userPath} className="text-zinc-950 no-underline hover:underline">
                          {displayUserLabel(u.name, undefined, 'Team member')}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-900">
                        <Link to={userPath} className="text-zinc-900 no-underline hover:underline">
                          {u.hours}h
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-zinc-600">
                        <Link
                          to={`${userPath}${userPath.includes('?') ? '&' : '?'}billable=billable`}
                          className="text-zinc-600 no-underline hover:underline"
                        >
                          {u.billableHours}h
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-100 text-zinc-900 border border-zinc-200">
                          {billableRatio}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
};
