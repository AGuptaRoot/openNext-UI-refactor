import React, { useMemo } from 'react';
import { IncomeExpenseReportData } from '../../../types/reports';
import {
  MetricCard,
  MetricGrid,
  ChartCard,
  DonutChart,
  DualLineChart,
  HorizontalBar,
  formatMoney,
  ReportEmptyState,
} from '../ReportCharts';

export interface IncomeExpenseReportTabProps {
  data: IncomeExpenseReportData;
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export const IncomeExpenseReportTab: React.FC<IncomeExpenseReportTabProps> = ({ data }) => {
  const currency = data.defaultCurrency || 'INR';

  const metrics = useMemo(() => {
    const income = Number(data.income ?? data.incomeTotal ?? 0) || 0;
    const expenses = Number(data.expenses ?? data.expenseTotal ?? 0) || 0;
    const netProfit = Number(data.netProfit ?? data.netTotal ?? income - expenses) || 0;
    const margin =
      data.margin != null && Number.isFinite(Number(data.margin))
        ? Number(data.margin)
        : income > 0
          ? round2((netProfit / income) * 100)
          : 0;

    const byPeriod = (data.byPeriod || []).map((row) => {
      const periodIncome = Number(row.income) || 0;
      const periodExpenses = Number(row.expenses) || 0;
      const profit = Number(row.profit ?? row.net ?? periodIncome - periodExpenses) || 0;
      return {
        period: row.period,
        income: periodIncome,
        expenses: periodExpenses,
        profit,
      };
    });

    const expensesByCategory = data.expensesByCategory || data.byCategory || [];

    return { income, expenses, netProfit, margin, byPeriod, expensesByCategory };
  }, [data]);

  const { income, expenses, netProfit, margin, byPeriod, expensesByCategory } = metrics;
  const categoryMax = Math.max(...expensesByCategory.map((c) => Number(c.amount) || 0), 1);

  const hasData =
    income > 0 ||
    expenses > 0 ||
    byPeriod.length > 0 ||
    expensesByCategory.length > 0;

  if (!hasData) {
    return (
      <div data-tour="report-tab-income-expense">
        <ReportEmptyState
          message={data.message || 'No income or expense entries found for this date range.'}
        />
      </div>
    );
  }

  const dualItems = byPeriod.map((p) => ({
    label: p.period,
    a: p.income,
    b: p.expenses,
  }));

  return (
    <div data-tour="report-tab-income-expense" className="flex flex-col gap-5">
      <div data-tour="report-income-kpis">
      <MetricGrid>
        <MetricCard
          label="Total Income"
          value={formatMoney(income, currency)}
          icon="📈"
          hint="Revenue"
          sub="Payments received"
          to="/payments?status=Completed"
        />
        <MetricCard
          label="Operating Expenses"
          value={formatMoney(expenses, currency)}
          icon="📉"
          hint="Outflow"
          sub="Approved expenses"
          to="/expenses?status=Approved"
        />
        <MetricCard
          label="Net Operating Profit"
          value={formatMoney(netProfit, currency)}
          icon="💰"
          hint="Net"
          sub="Income - Expenses"
          to="/payments"
        />
        <MetricCard
          label="Profit Margin"
          value={`${margin}%`}
          icon="⚖️"
          hint="Margin"
          sub="Profit / Income"
          to="/expenses?status=Approved"
        />
      </MetricGrid>
      </div>

      <div data-tour="report-income-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {byPeriod.length > 0 && (
          <ChartCard tourId="report-income-cashflow" title="Cash-flow trend" subtitle="Income vs expense comparison">
            <DualLineChart
              items={dualItems}
              aLabel="Income"
              bLabel="Expenses"
              title="Cash flow"
            />
          </ChartCard>
        )}

        {expensesByCategory.length > 0 && (
          <ChartCard tourId="report-income-expenses" title="Expense distribution" subtitle="Outflow by category">
            <DonutChart
              items={expensesByCategory.map((c) => ({
                label: c.category,
                value: Number(c.amount) || 0,
              }))}
              title="Expense categories"
            />
            <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-1">
              {expensesByCategory.map((c, i) => (
                <HorizontalBar
                  key={i}
                  label={c.category}
                  value={Number(c.amount) || 0}
                  max={categoryMax}
                  to={`/expenses?status=Approved&category=${encodeURIComponent(c.category)}`}
                />
              ))}
            </div>
          </ChartCard>
        )}
      </div>

      {byPeriod.length > 0 && (
        <ChartCard tourId="report-income-statement" title="Monthly cash flow statement" subtitle="Period revenue and cost reconciliation">
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3 text-right">Income</th>
                  <th className="py-2.5 px-3 text-right">Expenses</th>
                  <th className="py-2.5 px-3 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {byPeriod.map((p, i) => {
                  const isPositive = p.profit >= 0;
                  return (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="py-2.5 px-3 font-semibold text-zinc-950">{p.period}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                        {formatMoney(p.income, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-600">
                        {formatMoney(p.expenses, currency)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold ${
                          isPositive ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {formatMoney(p.profit, currency)}
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
