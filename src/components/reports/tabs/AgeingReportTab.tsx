import React from 'react';
import { AlertTriangle, FileText, Receipt, Siren } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InvoiceAgeingReportData } from '../../../types/reports';
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

export interface AgeingReportTabProps {
  data: InvoiceAgeingReportData;
}

function bucketLabel(b: { bucket?: string; label?: string; key?: string }): string {
  return String(b.bucket || b.label || b.key || 'Unknown');
}

function bucketListPath(b: { bucket?: string; label?: string; key?: string }): string {
  const key = bucketLabel(b).toLowerCase();
  if (!key || key.includes('current') || key.includes('not overdue') || key.includes('not due') || key.includes('0–30') || key.includes('0-30')) {
    return '/invoices?status=Sent';
  }
  return '/invoices?status=Overdue';
}

export const AgeingReportTab: React.FC<AgeingReportTabProps> = ({ data }) => {
  const currency = data.defaultCurrency || getRuntimeDefaultCurrency();
  const buckets = data.buckets || [];
  const invoices = data.invoices || [];

  const totalUnpaid = Number(data.totalUnpaid ?? data.totalOutstanding ?? 0) || 0;
  const totalOverdue =
    Number(data.totalOverdue) ||
    buckets
      .filter((b) => {
        const key = bucketLabel(b).toLowerCase();
        return key && !key.includes('current') && !key.includes('not overdue') && !key.includes('not due');
      })
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const bucketMax = Math.max(...buckets.map((b) => Number(b.amount) || 0), 1);
  const critical90 =
    buckets.find((b) => {
      const key = bucketLabel(b).toLowerCase();
      return key.includes('90');
    })?.amount || 0;

  if (!buckets.length && !invoices.length && totalUnpaid === 0) {
    return (
      <div data-tour="report-tab-ageing">
        <ReportEmptyState message={data.message || 'No unpaid or overdue invoices found.'} />
      </div>
    );
  }

  return (
    <div data-tour="report-tab-ageing" className="flex flex-col gap-5">
      <div data-tour="report-ageing-kpis">
      <MetricGrid>
        <MetricCard
          label="Total Unpaid AR"
          value={formatMoney(totalUnpaid, currency)}
          icon={<Receipt className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Receivables"
          sub="All open invoices"
          to="/invoices?status=Sent"
        />
        <MetricCard
          label="Total Past Due"
          value={formatMoney(totalOverdue, currency)}
          icon={<Siren className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Overdue"
          sub="Past payment deadline"
          to="/invoices?status=Overdue"
        />
        <MetricCard
          label="Open Invoices"
          value={invoices.length}
          icon={<FileText className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Invoices"
          sub="Awaiting settlement"
          to="/invoices?status=Sent"
        />
        <MetricCard
          label="90+ Days Critical"
          value={formatMoney(Number(critical90) || 0, currency)}
          icon={<AlertTriangle className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Critical"
          sub="Severe default risk"
          to="/invoices?status=Overdue"
        />
      </MetricGrid>
      </div>

      {buckets.length > 0 && (
        <div data-tour="report-ageing-charts">
        <ChartCard
          tourId="report-ageing-buckets"
          title="Accounts receivable ageing brackets"
          subtitle="Exposure distribution across delinquency intervals"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
            <DonutChart
              items={buckets.map((b) => ({ label: bucketLabel(b), value: Number(b.amount) || 0 }))}
              title="Ageing buckets"
            />
            <div className="flex flex-col gap-1 pt-2">
              {buckets.map((b, i) => (
                <HorizontalBar
                  key={i}
                  label={`${bucketLabel(b)}${b.count ? ` (${b.count})` : ''}`}
                  value={Number(b.amount) || 0}
                  max={bucketMax}
                  to={bucketListPath(b)}
                />
              ))}
            </div>
          </div>
        </ChartCard>
        </div>
      )}

      {invoices.length > 0 && (
        <ChartCard tourId="report-ageing-ledger" title="Outstanding invoice ledger" subtitle="Invoice-level delinquency details">
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3 text-center">Days Overdue</th>
                  <th className="py-2.5 px-3 text-right">Bracket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.map((inv, i) => {
                  const days = Number(inv.daysOverdue) || 0;
                  const isOverdue = days > 0;
                  const isCritical = days > 60;
                  const balance = Number(inv.balance ?? inv.balanceDue) || 0;
                  const total = Number(inv.total ?? balance) || 0;
                  const invoiceId = String(inv.id || '').trim();
                  const invoiceNo = inv.invoiceNumber || inv.invoiceNo || '—';
                  return (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-950">
                        {invoiceId ? (
                          <Link
                            to={`/invoices/${encodeURIComponent(invoiceId)}`}
                            className="text-zinc-950 no-underline hover:underline"
                            title="Open invoice"
                          >
                            {invoiceNo}
                          </Link>
                        ) : (
                          invoiceNo
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-zinc-800">{inv.clientName}</td>
                      <td className="py-2.5 px-3 text-zinc-600">{formatDate(inv.dueDate)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-700">
                        {formatMoney(total, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-950">
                        {formatMoney(balance, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {isOverdue ? (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-bold ${
                              isCritical
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {days}d
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold text-[10.5px]">Current</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {inv.bucket || '—'}
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
