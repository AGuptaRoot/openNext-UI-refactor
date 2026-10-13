import React from 'react';
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

export const CHART_GREYS = ['#09090b', '#27272a', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8'];

const tooltipStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid #e4e4e7',
  background: '#ffffff',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
};

const emptyState = (message: string) => (
  <div className="py-8 text-center text-xs text-zinc-400">{message}</div>
);

export function formatMoney(amount: number | undefined, currency = 'INR'): string {
  const num = Number(amount || 0);
  return `${currency} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  icon?: string;
  hint?: string;
  sub?: string;
  /** When set, the card becomes a drill-down link to a filtered module page. */
  to?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon = '📊',
  hint = 'Report',
  sub = 'Selected period',
  to,
}) => {
  const body = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="select-none text-sm text-zinc-400">{icon}</span>
      </div>
      <div className="my-1 font-mono text-2xl font-bold tracking-tight text-zinc-950">{value}</div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-zinc-100 pt-2 text-xs">
        <span className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-800">
          {hint}
        </span>
        <span className="truncate text-[11px] text-zinc-500">{sub}</span>
        {to ? (
          <span className="ml-auto shrink-0 text-[10px] font-semibold text-zinc-800 underline">
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
        className="flex flex-col justify-between rounded-xl border border-zinc-300 bg-white p-4 text-inherit no-underline shadow-none transition-colors hover:border-zinc-400 hover:bg-zinc-50"
        title={`Open filtered view: ${label}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-300 bg-white p-4 shadow-none">
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
      className="flex flex-col justify-between rounded-xl border border-zinc-300 bg-white p-5 shadow-none"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="m-0 text-sm font-bold tracking-tight text-zinc-950">{title}</h3>
          {subtitle && <p className="m-0 mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
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
  if (!items.length) return emptyState('No chart data for this period.');

  const data = items.map((item) => ({
    name: item.label || '—',
    value: Number(item.value) || 0,
  }));

  return (
    <div className="h-52 w-full" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={{ stroke: '#e4e4e7' }}
            tickLine={false}
            interval={0}
            angle={data.length > 6 ? -25 : 0}
            textAnchor={data.length > 6 ? 'end' : 'middle'}
            height={data.length > 6 ? 50 : 30}
          />
          <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ fill: '#f4f4f5' }}
            contentStyle={tooltipStyle}
            formatter={(value: number) => [value, 'Value']}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((_, index) => (
              <Cell key={`bar-${index}`} fill={CHART_GREYS[index % CHART_GREYS.length]} />
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
  if (!items.length) return emptyState('No trend data for this period.');

  const data = items.map((item) => ({
    name: item.label || '—',
    value: Number(item.value) || 0,
  }));

  return (
    <div className="h-52 w-full" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="reportLineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#09090b" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#09090b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={{ stroke: '#e4e4e7' }}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, 'Value']} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#09090b"
            strokeWidth={2.5}
            fill="url(#reportLineFill)"
            dot={{ r: 3, fill: '#09090b', strokeWidth: 0 }}
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
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((_, index) => (
                <Cell key={`slice-${index}`} fill={CHART_GREYS[index % CHART_GREYS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-base font-bold text-zinc-950">{total}</span>
          <span className="text-[10px] text-zinc-500">Total</span>
        </div>
      </div>

      <div className="flex min-w-0 max-w-full flex-1 flex-col gap-1.5 sm:max-w-[200px]">
        {data.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: CHART_GREYS[index % CHART_GREYS.length] }}
              />
              <span className="truncate text-[11px] text-zinc-600" title={item.name}>
                {item.name}
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold text-zinc-900">{item.value}</span>
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
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={{ stroke: '#e4e4e7' }}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            verticalAlign="top"
            height={28}
            wrapperStyle={{ fontSize: 12, color: '#52525b' }}
          />
          <Line
            type="monotone"
            dataKey={aLabel}
            stroke="#09090b"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#09090b', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey={bLabel}
            stroke="#a1a1aa"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 2.5, fill: '#a1a1aa', strokeWidth: 0 }}
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
  const data = [
    {
      name: label,
      value: Number(value) || 0,
    },
  ];

  const row = (
    <>
      <span className="w-28 truncate text-xs font-medium text-zinc-700" title={label}>
        {label}
      </span>
      <div className="h-6 min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, Math.max(max, 1)]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Bar dataKey="value" fill="#09090b" radius={[999, 999, 999, 999]} background={{ fill: '#f4f4f5' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <span className="w-12 text-right font-mono text-xs font-bold text-zinc-900">{value}</span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="flex items-center gap-3 rounded-md py-1 text-inherit no-underline hover:bg-zinc-50"
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
    className={`block rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center text-inherit no-underline transition-colors hover:border-zinc-400 hover:bg-white ${
      muted ? 'opacity-80' : ''
    }`}
    title={`Open ${label}`}
  >
    <span className="text-[11px] font-semibold uppercase text-zinc-500">{label}</span>
    <p
      className={`m-0 mt-0.5 font-mono text-lg font-bold ${
        muted ? 'text-zinc-500' : 'text-zinc-900'
      }`}
    >
      {value}
    </p>
    <span className="mt-1 inline-block text-[10px] font-semibold text-zinc-700 underline">
      View list
    </span>
  </Link>
);

export const ReportEmptyState: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-10 text-center shadow-none">
      <p className="m-0 text-xs text-zinc-500">{message}</p>
    </div>
  );
};
