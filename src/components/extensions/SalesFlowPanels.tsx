import React, { useState } from 'react';
import type { SalesFlowDetail, SalesFlowPanel } from '../../types/leads';

/**
 * Read-only panels the active extension sends for a lead (sales flow), e.g. the lead's
 * services and travellers. Each item can be opened to show its details.
 */
export const SalesFlowPanels: React.FC<{ panels: SalesFlowPanel[]; loading?: boolean; placeholder?: string }> = ({
  panels,
  loading,
  placeholder,
}) => {
  if (loading) return <p className="m-0 text-xs text-zinc-500">Loading…</p>;
  if (!panels.length) return <p className="m-0 text-xs text-zinc-500">{placeholder || 'Nothing to show.'}</p>;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {panels.map((panel, index) => (
        <div key={`${panel.title}-${index}`} className="min-w-0" data-testid="sales-flow-panel">
          <h3 className="m-0 mb-2 text-[12.5px] font-semibold text-zinc-900">{panel.title}</h3>
          {panel.items.length ? (
            <ul className="m-0 p-0 list-none space-y-2">
              {panel.items.map((item, i) => (
                <PanelItem key={`${item.title}-${i}`} title={item.title} subtitle={item.subtitle} badge={item.badge} details={item.details} />
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-zinc-500">{panel.empty || 'Nothing here yet.'}</p>
          )}
        </div>
      ))}
    </div>
  );
};

const PanelItem: React.FC<{ title: string; subtitle?: string; badge?: string; details?: SalesFlowDetail[] }> = ({
  title,
  subtitle,
  badge,
  details = [],
}) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <button
        type="button"
        className="w-full flex items-start justify-between gap-2 bg-transparent border-0 p-0 text-left cursor-pointer disabled:cursor-default"
        onClick={() => setOpen((v) => !v)}
        disabled={!details.length}
        aria-expanded={details.length ? open : undefined}
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-zinc-900 break-words">{title}</span>
          {subtitle ? <span className="block text-[11.5px] text-zinc-500 break-words">{subtitle}</span> : null}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {badge ? <SalesFlowBadge text={badge} /> : null}
          {details.length ? <span className="text-[11px] text-zinc-400">{open ? '▲' : '▼'}</span> : null}
        </span>
      </button>
      {open && details.length ? <SalesFlowDetails details={details} /> : null}
    </li>
  );
};

export const SalesFlowDetails: React.FC<{ details: SalesFlowDetail[] }> = ({ details }) => (
  <dl className="m-0 mt-2 grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11.5px]">
    {details.map((d, i) => (
      <React.Fragment key={`${d.label}-${i}`}>
        <dt className="text-zinc-500 break-words">{d.label}</dt>
        <dd className="m-0 text-zinc-900 break-words whitespace-pre-line">{d.value}</dd>
      </React.Fragment>
    ))}
  </dl>
);

const WARN = /expir|missing|not started|draft|not added|</i;

export const SalesFlowBadge: React.FC<{ text: string }> = ({ text }) => {
  const tone = /^complete/i.test(text)
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : WARN.test(text)
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-zinc-50 text-zinc-600 border-zinc-200';
  return <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded border ${tone}`}>{text}</span>;
};
