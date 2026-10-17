import React from 'react';
import { CircleDollarSign, TrendingUp, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SalesReportData, ReportRolePermissions } from '../../../types/reports';
import {
  MetricCard,
  MetricGrid,
  ChartCard,
  DonutChart,
  LineChart,
  VerticalBarChart,
  HorizontalBar,
  ReportLinkTile,
  formatMoney,
  ReportEmptyState,
} from '../ReportCharts';
import { getRuntimeDefaultCurrency } from '../../../utils/currency';

export interface SalesReportTabProps {
  data: SalesReportData;
  perms: ReportRolePermissions;
}

function withClient(path: string, clientId?: string): string {
  if (!clientId) return path;
  const joiner = path.includes('?') ? '&' : '?';
  return `${path}${joiner}clientId=${encodeURIComponent(clientId)}`;
}

export const SalesReportTab: React.FC<SalesReportTabProps> = ({ data, perms }) => {
  const currency = data.defaultCurrency || getRuntimeDefaultCurrency();
  const clientId = data.clientId;
  const pipeline = data.pipeline || [];
  const leadsByPeriod = data.leadsByPeriod || [];
  const topClients = data.topClients || [];
  const pipelineMax = Math.max(...pipeline.map((r) => r.count), 1);

  const hasCore = (data.totalLeads ?? 0) > 0 || pipeline.length > 0 || leadsByPeriod.length > 0;
  const hasFinance =
    perms.canFinance &&
    (Boolean(data.quotations) ||
      (data.paymentsTotal ?? 0) > 0 ||
      (data.outstanding?.unpaid ?? 0) > 0 ||
      (data.outstanding?.overdue ?? 0) > 0 ||
      topClients.length > 0);

  if (!hasCore && !hasFinance) {
    return (
      <div data-tour="report-tab-sales">
        <ReportEmptyState message="No sales pipeline data for this date range." />
      </div>
    );
  }

  const q = data.quotations;
  const qRows = q
    ? [
        { label: 'Draft', count: q.draft ?? 0, to: withClient('/quotations?status=Draft', clientId) },
        { label: 'Sent', count: q.sent ?? 0, to: withClient('/quotations?status=Sent', clientId) },
        {
          label: 'Accepted',
          count: q.accepted ?? 0,
          to: withClient('/quotations?status=Accepted', clientId),
        },
        {
          label: 'Rejected',
          count: q.rejected ?? 0,
          to: withClient('/quotations?status=Rejected', clientId),
        },
      ]
    : [];

  return (
    <div data-tour="report-tab-sales" className="flex flex-col gap-5">
      <div data-tour="report-sales-kpis">
      <MetricGrid>
        <MetricCard
          label="Leads in range"
          value={data.totalLeads ?? 0}
          icon={<Users className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Pipeline"
          sub="Selected period"
          to={withClient('/leads', clientId)}
        />
        <MetricCard
          label="Won leads"
          value={data.wonLeads ?? 0}
          icon={<Trophy className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Closed"
          sub="Won stage"
          to={withClient('/leads?stage=Won', clientId)}
        />
        <MetricCard
          label="Conversion rate"
          value={`${data.conversionRate ?? 0}%`}
          icon={<TrendingUp className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Rate"
          sub="Won / total"
          to={withClient('/leads', clientId)}
        />
        {perms.canFinance && (
          <MetricCard
            label="Payments collected"
            value={formatMoney(data.paymentsTotal ?? 0, currency)}
            icon={<CircleDollarSign className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
            hint="Inflow"
            sub="Cash collected"
            to={withClient('/payments?status=Completed', clientId)}
          />
        )}
      </MetricGrid>
      </div>

      {(pipeline.length > 0 || leadsByPeriod.length > 0) && (
        <div data-tour="report-sales-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pipeline.length > 0 && (
            <ChartCard tourId="report-sales-pipeline" title="Pipeline funnel" subtitle="Leads distribution by stage — click a stage to open">
              <DonutChart
                items={pipeline.map((p) => ({ label: p.stage, value: p.count }))}
                title="Pipeline stages"
              />
              <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-1">
                {pipeline.map((r, i) => (
                  <HorizontalBar
                    key={i}
                    label={r.stage}
                    value={r.count}
                    max={pipelineMax}
                    to={withClient(`/leads?stage=${encodeURIComponent(r.stage)}`, clientId)}
                  />
                ))}
              </div>
            </ChartCard>
          )}

          {leadsByPeriod.length > 0 && (
            <ChartCard tourId="report-sales-leads-month" title="Leads by month" subtitle="Volume acquisition trend">
              <LineChart
                items={leadsByPeriod.map((p) => ({ label: p.period, value: p.count }))}
                title="Leads trend"
              />
              <div className="mt-3">
                <VerticalBarChart
                  items={leadsByPeriod.map((p) => ({ label: p.period, value: p.count }))}
                  title="Monthly leads"
                />
              </div>
            </ChartCard>
          )}
        </div>
      )}

      {perms.canFinance && q && (
        <ChartCard
          tourId="report-sales-quotations"
          title="Quotations"
          subtitle="Click a status (e.g. Sent) to open the filtered quotations list"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <DonutChart
              items={qRows.map((r) => ({ label: r.label, value: r.count }))}
              title="Quotations by status"
            />
            <VerticalBarChart
              items={qRows.map((r) => ({ label: r.label, value: r.count }))}
              title="Quotation counts"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-100">
            {qRows.map((row) => (
              <ReportLinkTile
                key={row.label}
                label={row.label}
                value={row.count}
                to={row.to}
                muted={row.label === 'Rejected'}
              />
            ))}
          </div>
        </ChartCard>
      )}

      {perms.canFinance && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard tourId="report-sales-finance" title="Finance summary" subtitle={`Default currency: ${currency}`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ReportLinkTile
                label="Payments In"
                value={formatMoney(data.paymentsTotal ?? 0, currency)}
                to={withClient('/payments?status=Completed', clientId)}
              />
              <ReportLinkTile
                label="Outstanding"
                value={formatMoney(data.outstanding?.unpaid ?? 0, currency)}
                to={withClient('/invoices?status=Sent', clientId)}
              />
              <ReportLinkTile
                label="Overdue"
                value={formatMoney(data.outstanding?.overdue ?? 0, currency)}
                to={withClient('/invoices?status=Overdue', clientId)}
              />
            </div>
          </ChartCard>

          {topClients.length > 0 && (
            <ChartCard tourId="report-sales-top-clients" title="Top clients by payments" subtitle="Click a client to open filtered payments">
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3 text-right">Collections</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {topClients.map((c, i) => {
                      const cid = String(c.clientId || c.id || '').trim();
                      const to = cid
                        ? withClient(`/payments?status=Completed&clientId=${encodeURIComponent(cid)}`, undefined)
                        : withClient('/payments?status=Completed', clientId);
                      return (
                        <tr key={i} className="hover:bg-zinc-50">
                          <td className="py-2.5 px-3 font-semibold text-zinc-900">
                            <Link to={to} className="text-zinc-900 no-underline hover:underline" title="Open payments for client">
                              {c.name}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-950">
                            <Link to={to} className="text-zinc-950 no-underline hover:underline">
                              {formatMoney(c.amount, currency)}
                            </Link>
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
      )}
    </div>
  );
};
