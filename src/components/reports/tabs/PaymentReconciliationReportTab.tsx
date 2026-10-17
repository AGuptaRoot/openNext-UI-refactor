import React from 'react';
import { CheckCircle2, CircleDollarSign, Hash, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PaymentReconciliationReportData } from '../../../types/reports';
import {
  MetricCard,
  MetricGrid,
  ChartCard,
  DonutChart,
  VerticalBarChart,
  formatMoney,
  formatDate,
  ReportEmptyState,
} from '../ReportCharts';

export interface PaymentReconciliationReportTabProps {
  data: PaymentReconciliationReportData;
}

export const PaymentReconciliationReportTab: React.FC<PaymentReconciliationReportTabProps> = ({ data }) => {
  const byMethod = data.byMethod || [];
  const payments = data.payments || [];

  const hasData =
    (data.totalPaymentsCount ?? 0) > 0 ||
    (data.grossAmount ?? 0) > 0 ||
    byMethod.length > 0 ||
    payments.length > 0;

  if (!hasData) {
    return (
      <div data-tour="report-tab-payments">
        <ReportEmptyState message="No payment transactions found for this date range." />
      </div>
    );
  }

  return (
    <div data-tour="report-tab-payments" className="flex flex-col gap-5">
      {/* 1. KPIs */}
      <div data-tour="report-payments-kpis">
      <MetricGrid>
        <MetricCard
          label="Total Payments"
          value={data.totalPaymentsCount ?? 0}
          icon={<Hash className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Volume"
          sub="Transactions logged"
          to="/payments"
        />
        <MetricCard
          label="Gross Inflow"
          value={formatMoney(data.grossAmount ?? 0)}
          icon={<CircleDollarSign className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Gross"
          sub="Total received"
          to="/payments?status=Completed"
        />
        <MetricCard
          label="Refunds Processed"
          value={formatMoney(data.totalRefunds ?? 0)}
          icon={<Undo2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Refunds"
          sub="Disbursed returns"
          to="/payments?status=Refunded"
        />
        <MetricCard
          label="Net Collected"
          value={formatMoney(data.netCollected ?? 0)}
          icon={<CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Net"
          sub="Gross - Refunds"
          to="/payments?status=Completed"
        />
      </MetricGrid>
      </div>

      {/* 2. By Payment Method Breakdown */}
      {byMethod.length > 0 && (
        <div data-tour="report-payments-charts">
        <ChartCard tourId="report-payments-methods" title="Collections by payment method" subtitle="Channel mix and net volume">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <DonutChart
              items={byMethod.map((m) => ({ label: m.method, value: m.count }))}
              title="Method counts"
            />
            <VerticalBarChart
              items={byMethod.map((m) => ({ label: m.method, value: m.net }))}
              title="Net amount by method"
            />
          </div>

          <div className="border border-zinc-200 rounded-xl overflow-hidden mt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Payment Mode</th>
                  <th className="py-2.5 px-3 text-center">Transactions</th>
                  <th className="py-2.5 px-3 text-right">Gross Collected</th>
                  <th className="py-2.5 px-3 text-right">Refunds</th>
                  <th className="py-2.5 px-3 text-right">Net Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {byMethod.map((m, i) => (
                  <tr key={i} className="hover:bg-zinc-50">
                    <td className="py-2.5 px-3 font-semibold text-zinc-950">
                      <Link
                        to={`/payments?method=${encodeURIComponent(m.method)}`}
                        className="text-zinc-950 no-underline hover:underline"
                        title={`Open ${m.method} payments`}
                      >
                        {m.method}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-zinc-700">{m.count}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-700">{formatMoney(m.gross)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-600">
                      {m.refunds > 0 ? formatMoney(m.refunds) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-950">
                      {formatMoney(m.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        </div>
      )}

      {/* 3. Transaction Level Reconciliation Table */}
      {payments.length > 0 && (
        <ChartCard tourId="report-payments-log" title="Transaction reconciliation log" subtitle="Payment-level audit and settlement status">
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Invoice</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3 text-right">Gross</th>
                  <th className="py-2.5 px-3 text-right">Refund</th>
                  <th className="py-2.5 px-3 text-right">Net</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map((p, i) => {
                  const status = String(p.status || '').toLowerCase();
                  const isPaid = status === 'completed' || status === 'paid';
                  const isRefunded = status === 'refunded';
                  const paymentId = String(p.id || '').trim();
                  return (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-950">
                        {paymentId ? (
                          <Link
                            to={`/payments/${encodeURIComponent(paymentId)}`}
                            className="text-zinc-950 no-underline hover:underline"
                            title="Open payment"
                          >
                            {p.receiptNumber}
                          </Link>
                        ) : (
                          p.receiptNumber
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600">{formatDate(p.paymentDate)}</td>
                      <td className="py-2.5 px-3 font-medium text-zinc-800">{p.clientName}</td>
                      <td className="py-2.5 px-3 font-mono text-zinc-600">{p.invoiceNumber || '—'}</td>
                      <td className="py-2.5 px-3 capitalize text-zinc-700">
                        <Link
                          to={`/payments?method=${encodeURIComponent(p.paymentMode)}`}
                          className="text-zinc-700 no-underline hover:underline capitalize"
                        >
                          {p.paymentMode}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-700">{formatMoney(p.amount, p.currency)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600">
                        {p.refundedAmount > 0 ? formatMoney(p.refundedAmount, p.currency) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-950">
                        {formatMoney(p.netAmount, p.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border capitalize ${
                            isPaid
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : isRefunded
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                          }`}
                        >
                          {p.status}
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
