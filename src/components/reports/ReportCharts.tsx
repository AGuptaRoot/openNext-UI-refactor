import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import { getChartThemeColors } from '../../theme/cssVars';
import {
  formatCrmMoney,
  getRuntimeDefaultCurrency,
  normalizeCurrencyCode,
} from '../../utils/currency';

/** Theme-aware chart palette (reads CSS vars; updates when CMS theme toggles). */
export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    const c = getChartThemeColors();
    return {
      theme,
      greys: c.series,
      series: c.series,
      grid: c.grid,
      tick: c.tick,
      axis: c.axis,
      cursor: c.cursor,
      tooltipStyle: {
        borderRadius: 8,
        border: `1px solid ${c.tooltipBorder}`,
        background: c.tooltipBg,
        color: c.tooltipFg,
        fontSize: 12,
        boxShadow: theme === 'dark' ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.08)',
      } as React.CSSProperties,
      legendColor: c.mutedForeground,
      card: c.card,
      foreground: c.foreground,
      mutedForeground: c.mutedForeground,
      sliceStroke: c.card,
    };
  }, [theme]);
}

/** @deprecated Prefer useChartTheme().series — kept for callers that import CHART_GREYS. */
export const CHART_GREYS = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)',
];

const emptyState = (message: string) => (
  <div className="py-8 text-center text-xs text-muted-foreground">{message}</div>
);

export function formatMoney(amount: number | undefined, currency?: string): string {
  const code = normalizeCurrencyCode(currency, getRuntimeDefaultCurrency());
  const num = Number(amount || 0);
  try {
    return `${code} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return formatCrmMoney(amount, code);
  }
}

export function formatDate(value: string | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
  sub?: string;
  /** When set, the card becomes a drill-down link to a filtered module page. */
  to?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon = <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />,
  hint = 'Report',
  sub = 'Selected period',
  to,
}) => {
  const body = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="flex shrink-0 items-center text-muted-foreground">{icon}</span>
      </div>
      <div className="my-1 font-mono text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs">
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
          {hint}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{sub}</span>
        {to ? (
          <span className="ml-auto shrink-0 text-[10px] font-semibold text-foreground underline">
            Open
          </span>
        ) : null}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 text-inherit no-underline shadow-none transition-colors hover:border-muted-foreground hover:bg-muted"
        title={`Open filtered view: ${label}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-none">
      {body}
    </div>
  );
};

export const MetricGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
};

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Optional Beacon tour target id (data-tour). */
  tourId?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, children, action, tourId }) => {
  return (
    <div
      {...(tourId ? { 'data-tour': tourId } : {})}
      className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-none"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="m-0 text-sm font-bold tracking-tight text-foreground">{title}</h3>
          {subtitle && <p className="m-0 mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
};

export interface VerticalBarItem {
  label: string;
  value: number;
}

export const VerticalBarChart: React.FC<{ items: VerticalBarItem[]; title?: string }> = ({
  items,
  title = 'Bar chart',
}) => {
  const chart = useChartTheme();
  if (!items.length) return emptyState('No chart data for this period.');

  const data = items.map((item) => ({
    name: item.label || '—',
    value: Number(item.value) || 0,
  }));

  return (
    <div className="h-52 w-full" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: chart.tick, fontSize: 11 }}
            axisLine={{ stroke: chart.axis }}
            tickLine={false}
            interval={0}
            angle={data.length > 6 ? -25 : 0}
            textAnchor={data.length > 6 ? 'end' : 'middle'}
            height={data.length > 6 ? 50 : 30}
          />
          <YAxis tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ fill: chart.cursor }}
            contentStyle={chart.tooltipStyle}
            formatter={(value: number) => [value, 'Value']}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((_, index) => (
              <Cell key={`bar-${index}`} fill={chart.series[index % chart.series.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export interface LineChartItem {
  label: string;
  value: number;
}

export const LineChart: React.FC<{ items: LineChartItem[]; title?: string }> = ({
  items,
  title = 'Line chart',
}) => {
  const chart = useChartTheme();
  if (!items.length) return emptyState('No trend data for this period.');

  const data = items.map((item) => ({
    name: item.label || '—',
    value: Number(item.value) || 0,
  }));
  const stroke = chart.series[0];
  const fillId = `reportLineFill-${chart.theme}`;

  return (
    <div className="h-52 w-full" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: chart.tick, fontSize: 11 }}
            axisLine={{ stroke: chart.axis }}
            tickLine={false}
          />
          <YAxis tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={chart.tooltipStyle} formatter={(value: number) => [value, 'Value']} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export interface DonutItem {
  label: string;
  value: number;
}

export const DonutChart: React.FC<{ items: DonutItem[]; title?: string }> = ({
  items,
  title = 'Donut chart',
}) => {
  const chart = useChartTheme();
  const filtered = items.filter((item) => Number(item.value) > 0);
  if (!filtered.length) return emptyState('No distribution data.');

  const data = filtered.map((item) => ({
    name: item.label || '—',
    value: Number(item.value) || 0,
  }));
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col items-center justify-between gap-5 py-2 sm:flex-row" role="img" aria-label={title}>
      <div className="relative h-40 w-40 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={62}
              paddingAngle={1.5}
              stroke={chart.sliceStroke}
              strokeWidth={2}
            >
              {data.map((_, index) => (
                <Cell key={`slice-${index}`} fill={chart.series[index % chart.series.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chart.tooltipStyle} formatter={(value: number, name: string) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-base font-bold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>
      </div>

      <div className="flex min-w-0 max-w-full flex-1 flex-col gap-1.5 sm:max-w-[200px]">
        {data.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: chart.series[index % chart.series.length] }}
              />
              <span className="truncate text-[11px] text-muted-foreground" title={item.name}>
                {item.name}
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface DualLineItem {
  label: string;
  a: number;
  b: number;
}

export const DualLineChart: React.FC<{
  items: DualLineItem[];
  aLabel?: string;
  bLabel?: string;
  title?: string;
}> = ({ items, aLabel = 'Income', bLabel = 'Expenses', title = 'Income vs Expenses' }) => {
  const chart = useChartTheme();
  if (!items.length) return emptyState('No cash-flow trend data.');

  const data = items.map((item) => ({
    name: item.label || '—',
    [aLabel]: Number(item.a) || 0,
    [bLabel]: Number(item.b) || 0,
  }));

  return (
    <div className="h-56 w-full" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: chart.tick, fontSize: 11 }}
            axisLine={{ stroke: chart.axis }}
            tickLine={false}
          />
          <YAxis tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
          <Tooltip contentStyle={chart.tooltipStyle} />
          <Legend
            verticalAlign="top"
            height={28}
            wrapperStyle={{ fontSize: 12, color: chart.legendColor }}
          />
          <Line
            type="monotone"
            dataKey={aLabel}
            stroke={chart.series[0]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: chart.series[0], strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey={bLabel}
            stroke={chart.series[1]}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 2.5, fill: chart.series[1], strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const HorizontalBar: React.FC<{
  label: string;
  value: number;
  max: number;
  to?: string;
}> = ({ label, value, max, to }) => {
  const chart = useChartTheme();
  const data = [
    {
      name: label,
      value: Number(value) || 0,
    },
  ];

  const row = (
    <>
      <span className="w-28 truncate text-xs font-medium text-foreground" title={label}>
        {label}
      </span>
      <div className="h-6 min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, Math.max(max, 1)]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Bar
              dataKey="value"
              fill={chart.series[0]}
              radius={[999, 999, 999, 999]}
              background={{ fill: chart.cursor }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <span className="w-12 text-right font-mono text-xs font-bold text-foreground">{value}</span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="flex items-center gap-3 rounded-md py-1 text-inherit no-underline hover:bg-muted"
        title={`Open filtered view: ${label}`}
      >
        {row}
      </Link>
    );
  }

  return <div className="flex items-center gap-3 py-1">{row}</div>;
};

/** Clickable KPI tile used for status buckets (e.g. Quotations Sent). */
export const ReportLinkTile: React.FC<{
  label: string;
  value: string | number;
  to: string;
  muted?: boolean;
}> = ({ label, value, to, muted }) => (
  <Link
    to={to}
    className={`block rounded-lg border border-border bg-muted p-3 text-center text-inherit no-underline transition-colors hover:border-muted-foreground hover:bg-card ${
      muted ? 'opacity-80' : ''
    }`}
    title={`Open ${label}`}
  >
    <span className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</span>
    <p
      className={`m-0 mt-0.5 font-mono text-lg font-bold ${
        muted ? 'text-muted-foreground' : 'text-foreground'
      }`}
    >
      {value}
    </p>
    <span className="mt-1 inline-block text-[10px] font-semibold text-foreground underline">
      View list
    </span>
  </Link>
);

export const ReportEmptyState: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center shadow-none">
      <p className="m-0 text-xs text-muted-foreground">{message}</p>
    </div>
  );
};
