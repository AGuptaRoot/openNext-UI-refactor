import React from 'react';
import {
  Ban,
  CheckCircle2,
  FolderOpen,
  Link2,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { LeadConversionReportData } from '../../../types/reports';
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

export interface ConversionReportTabProps {
  data: LeadConversionReportData;
}

function withClient(path: string, clientId?: string): string {
  if (!clientId) return path;
  const joiner = path.includes('?') ? '&' : '?';
  return `${path}${joiner}clientId=${encodeURIComponent(clientId)}`;
}

export const ConversionReportTab: React.FC<ConversionReportTabProps> = ({ data }) => {
  const clientId = data.clientId;
  const byStage = data.byStage || [];
  const bySource = data.bySource || [];
  const conversionsByPeriod = data.conversionsByPeriod || [];
  const reps = data.reps || [];

  const totalLeads = Number(data.totalLeads ?? 0) || 0;
  const wonLeads = Number(data.wonLeads ?? 0) || 0;
  const lostLeads = Number(data.lostLeads ?? 0) || 0;
  const convertedLeads = Number(data.convertedLeads ?? 0) || 0;
  const conversionRate =
    data.conversionRate != null
      ? Number(data.conversionRate)
      : totalLeads > 0
        ? Math.round((convertedLeads / totalLeads) * 1000) / 10
        : 0;
  const winRate =
    data.winRate != null
      ? Number(data.winRate)
      : totalLeads > 0
        ? Math.round((wonLeads / totalLeads) * 1000) / 10
        : 0;

  const stageMax = Math.max(...byStage.map((r) => r.count), 1);
  const sourceMax = Math.max(...bySource.map((r) => r.count), 1);

  const hasData =
    totalLeads > 0 ||
    wonLeads > 0 ||
    lostLeads > 0 ||
    convertedLeads > 0 ||
    byStage.length > 0 ||
    conversionsByPeriod.length > 0;

  if (!hasData) {
    return (
      <div data-tour="report-tab-conversion">
        <ReportEmptyState message="No lead conversion data for this date range." />
      </div>
    );
  }

  return (
    <div data-tour="report-tab-conversion" className="flex flex-col gap-5">
      <div data-tour="report-conversion-kpis">
      <MetricGrid>
        <MetricCard
          label="Total leads"
          value={totalLeads}
          icon={<Users className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Volume"
          sub="In selected period"
          to={withClient('/leads', clientId)}
        />
        <MetricCard
          label="Won leads"
          value={wonLeads}
          icon={<Trophy className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Pipeline"
          sub={`Stage = Won · win rate ${winRate}%`}
          to={withClient('/leads?stage=Won', clientId)}
        />
        <MetricCard
          label="Converted to client"
          value={convertedLeads}
          icon={<CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Conversion"
          sub="Lead → Client completed"
          to={withClient('/leads?stage=Won', clientId)}
        />
        <MetricCard
          label="Conversion rate"
          value={`${conversionRate}%`}
          icon={<Target className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Rate"
          sub="Converted / total leads"
          to={withClient('/leads', clientId)}
        />
      </MetricGrid>

      <MetricGrid>
        <MetricCard
          label="Lost leads"
          value={lostLeads}
          icon={<Ban className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Closed-lost"
          sub="Stage = Lost"
          to={withClient('/leads?stage=Lost', clientId)}
        />
        <MetricCard
          label="Win rate"
          value={`${winRate}%`}
          icon={<TrendingUp className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Pipeline"
          sub="Won stage / total leads"
          to={withClient('/leads?stage=Won', clientId)}
        />
        <MetricCard
          label="Open / other"
          value={Math.max(0, totalLeads - wonLeads - lostLeads)}
          icon={<FolderOpen className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="In progress"
          sub="Not won or lost yet"
          to={withClient('/leads', clientId)}
        />
        <MetricCard
          label="Won vs converted"
          value={`${wonLeads} / ${convertedLeads}`}
          icon={<Link2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Compare"
          sub="Won stage vs client created"
          to={withClient('/leads?stage=Won', clientId)}
        />
      </MetricGrid>
      </div>

      <div data-tour="report-conversion-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {byStage.length > 0 && (
          <ChartCard tourId="report-conversion-by-stage" title="Leads by pipeline stage" subtitle="Click a stage to open filtered leads">
            <DonutChart
              items={byStage.map((s) => ({ label: s.stage, value: s.count }))}
              title="Stage funnel"
            />
            <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-1">
              {byStage.map((s, i) => (
                <HorizontalBar
                  key={i}
                  label={s.stage}
                  value={s.count}
                  max={stageMax}
                  to={withClient(`/leads?stage=${encodeURIComponent(s.stage)}`, clientId)}
                />
              ))}
            </div>
          </ChartCard>
        )}

        {bySource.length > 0 && (
          <ChartCard tourId="report-conversion-by-source" title="Leads by acquisition source" subtitle="Click a source to open filtered leads">
            <DonutChart
              items={bySource.map((s) => ({ label: s.source, value: s.count }))}
              title="Source channel"
            />
            <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-1">
              {bySource.map((s, i) => (
                <HorizontalBar
                  key={i}
                  label={s.source}
                  value={s.count}
                  max={sourceMax}
                  to={withClient(`/leads?source=${encodeURIComponent(s.source)}`, clientId)}
                />
              ))}
            </div>
          </ChartCard>
        )}
      </div>

      {conversionsByPeriod.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard tourId="report-conversion-trend" title="Conversions by month" subtitle="Leads converted to clients over time">
            <LineChart
              items={conversionsByPeriod.map((p) => ({ label: p.period, value: p.count }))}
              title="Conversion trend"
            />
          </ChartCard>
          <ChartCard tourId="report-conversion-volume" title="Monthly conversion volume" subtitle="Converted-to-client count">
            <VerticalBarChart
              items={conversionsByPeriod.map((p) => ({ label: p.period, value: p.count }))}
              title="Monthly conversions"
            />
          </ChartCard>
        </div>
      )}

      {reps.length > 0 && (
        <ChartCard tourId="report-conversion-reps" title="Rep performance" subtitle="Win rate by assignee">
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Rep</th>
                  <th className="py-2.5 px-3 text-right">Won</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reps.map((r, i) => (
                  <tr key={i} className="hover:bg-zinc-50">
                    <td className="py-2.5 px-3 font-semibold text-zinc-900">{r.name}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{r.won}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{r.total}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{r.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
};
