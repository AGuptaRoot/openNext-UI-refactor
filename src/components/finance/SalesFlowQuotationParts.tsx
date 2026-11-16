import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BedDouble,
  Calendar,
  Car,
  Check,
  FileText,
  Info,
  Layers,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Plane,
  Plus,
  ShieldCheck,
  Ticket,
  TreePalm,
  User,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { EditableLine } from './FinanceFormElements';
import { financeFieldClass, financeTextAreaClass } from './FinanceFormElements';
import { SalesFlowDetails } from '../extensions/SalesFlowPanels';
import type {
  SalesFlowNotice,
  SalesFlowCheck,
  SalesFlowDetail,
  SalesFlowLineField,
  SalesFlowLineGroup,
  SalesFlowPanel,
  SalesFlowSummaryItem,
} from '../../types/leads';

/**
 * Quotation page parts used when the active extension supplies the lines (sales flow,
 * manifest salesFlow.lockQuotationLines): the summary row, a read-only list card and the lines table.
 */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  place: MapPin,
  beach: TreePalm,
  event: Calendar,
  flight: Plane,
  group: Users,
};

/**
 * The trip / deal at a glance (the extension's summary items) in one compact card, with an optional link
 * to where those details are edited — they are not repeated on every service.
 */
export const SalesFlowSummaryStrip: React.FC<{
  title: string;
  items: SalesFlowSummaryItem[];
  emptyText?: string;
  editHref?: string;
  editLabel?: string;
  /** Show each value's label above it (e.g. Lead, Opportunity, Booking number). */
  showLabels?: boolean;
}> = ({ title, items, emptyText, editHref, editLabel = 'Edit details', showLabels = false }) => (
  <section className="bg-white border border-zinc-300 rounded-xl px-5 py-4" data-testid="quotation-sales-summary">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-zinc-950 m-0">{title}</h2>
      {editHref && items.length ? (
        <Link to={editHref} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 no-underline hover:text-zinc-950" data-testid="quotation-summary-edit">
          {editLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
    {!items.length && emptyText ? (
      <p className="m-0 mt-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">{emptyText}</p>
    ) : null}
    {items.length ? (
      <dl className="m-0 mt-2 flex flex-wrap gap-x-6 gap-y-2">
        {items.map((item, i) => {
          const Icon = ICONS[item.icon || ''] || Info;
          return (
            <div key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
              <div className="min-w-0">
                <dt className={showLabels ? 'text-[11px] text-zinc-500' : 'sr-only'}>{item.label}</dt>
                <dd className="m-0 text-[13px] font-semibold text-zinc-900 break-words" title={item.label}>
                  {item.value}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    ) : null}
  </section>
);

/** Lead tab link of the extension (lead page `?tab=decl_<id>`). */
export function leadTabHref(leadId: string, leadTab: string): string {
  return `/leads/${encodeURIComponent(leadId)}?tab=${encodeURIComponent(`decl_${leadTab}`)}`;
}

/** The extension's notices for this record (e.g. incomplete traveller details), each with its action. */
export const SalesFlowNotices: React.FC<{ notices: SalesFlowNotice[]; leadId?: string }> = ({ notices, leadId }) => {
  if (!notices.length) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="sales-flow-notices">
      {notices.map((n, i) => (
        <div
          key={`${n.text}-${i}`}
          role={n.tone === 'warning' ? 'alert' : 'status'}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[13px] ${
            n.tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900'
          }`}
        >
          <span className="min-w-0 flex-1 break-words">{n.text}</span>
          {n.action && leadId ? (
            <Link
              to={leadTabHref(leadId, n.action.leadTab)}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 no-underline hover:bg-amber-100"
            >
              {n.action.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
};

/** A read-only list (e.g. travellers' names) with an optional footnote. */
export const SalesFlowListCard: React.FC<{ panel: SalesFlowPanel }> = ({ panel }) => (
  <section className="bg-white border border-zinc-300 rounded-xl p-5" data-testid="quotation-sales-list">
    <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-3">{panel.title}</h2>
    {panel.items.length ? (
      <ul className="m-0 p-0 list-none rounded-lg border border-zinc-200 divide-y divide-zinc-200">
        {panel.items.map((item, i) => (
          <li key={`${item.title}-${i}`} className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-zinc-900">
            <User className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="min-w-0 break-words">{item.title}</span>
            {item.subtitle ? <span className="text-xs text-zinc-500">{item.subtitle}</span> : null}
          </li>
        ))}
      </ul>
    ) : (
      <p className="m-0 text-xs text-zinc-500">{panel.empty || 'Nothing here yet.'}</p>
    )}
    {panel.note ? (
      <p className="m-0 mt-3 flex items-center gap-2 text-xs text-zinc-500">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {panel.note}
      </p>
    ) : null}
  </section>
);

/** The extension's checks for this quotation plus the page's own (right column). */
export const SalesFlowChecklist: React.FC<{ title?: string; checks: SalesFlowCheck[] }> = ({ title = 'Checklist', checks }) => {
  const done = checks.filter((c) => c.ok).length;
  return (
    <section className="bg-white border border-zinc-300 rounded-xl p-5" data-testid="quotation-sales-checks">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-zinc-950 m-0">{title}</h2>
        <span className="text-xs font-medium text-zinc-500">
          {done}/{checks.length}
        </span>
      </div>
      <ul className="list-none p-0 m-0 flex flex-col gap-2 text-xs">
        {checks.map((check, i) => (
          <li key={`${check.label}-${i}`} className="flex items-start gap-2">
            <span
              className={`mt-px w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                check.ok ? 'bg-zinc-950 text-white' : 'border border-dashed border-zinc-400 text-transparent'
              }`}
            >
              <Check className="h-2.5 w-2.5 stroke-[2.5]" />
            </span>
            <span className="min-w-0">
              <span className={`block break-words ${check.ok ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>{check.label}</span>
              {check.hint ? <span className="block text-[11px] text-zinc-500 break-words">{check.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Per line: selected, what the quantity counts, the extension's column values, added by hand. */
export interface SalesFlowLineMeta {
  selected: boolean;
  unit: string;
  extra: Record<string, string>;
  manual?: boolean;
  /** The extension's reference for the line (sent back unchanged). */
  sourceRef?: string;
  /** Key of the extension's line group (salesFlow.quotationLineGroups); '' = ungrouped. */
  group?: string;
}

/** Colours for select values, by the tone the extension gives each option (quotationLineFields[].tones). */
const TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-zinc-50 text-zinc-700 border-zinc-200',
};

/** Card icons a line group may declare (salesFlow.quotationLineGroups[].icon). */
const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: BedDouble,
  car: Car,
  activity: Ticket,
  document: FileText,
  shield: ShieldCheck,
  place: MapPin,
  beach: TreePalm,
  event: Calendar,
  group: Users,
  package: Package,
  service: Layers,
};

interface LinesTableProps {
  title: string;
  subtitle: string;
  addLabel: string;
  lines: EditableLine[];
  setLines: React.Dispatch<React.SetStateAction<EditableLine[]>>;
  meta: Record<string, SalesFlowLineMeta>;
  setMeta: React.Dispatch<React.SetStateAction<Record<string, SalesFlowLineMeta>>>;
  details: Record<string, SalesFlowDetail[]>;
  fields: SalesFlowLineField[];
  lineOptions: Array<{ name: string; unit?: string; tax?: number; group?: string }>;
  note?: string;
  currency: string;
  loading?: boolean;
  newLine: () => EditableLine;
  /** salesFlow.quotationLineGroups: lines are shown per group, each with its own fields. Empty = one list. */
  groups?: SalesFlowLineGroup[];
  /** Nothing to price yet (no lead / opportunity): adding lines is off. */
  disabled?: boolean;
  /** Message for an empty list (replaces the default one). */
  emptyText?: string;
  /** salesFlow.fixedLines: no adding or removing; only rate and tax change; the rest is read-only. */
  fixed?: boolean;
  /** Where the source data is edited (e.g. the lead's Travel Requirement tab). */
  requirement?: { href: string; label: string } | null;
}

/** What a line still needs before it is complete: a name, a quantity and a price. */
function missingOf(line: EditableLine): string[] {
  const missing: string[] = [];
  if (!line.name.trim()) missing.push('Service');
  if (!(line.qty > 0)) missing.push('Quantity');
  if (!(line.rate > 0)) missing.push('Rate');
  return missing;
}

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toLocaleString('en-IN')}`;
  }
};

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/**
 * "<qty> <unit>" with the number once (CRM 3.40.2): a unit that already starts with the same quantity
 * (e.g. "1 Service" for 1, saved by an older extension) is not repeated — "1 1 Service" read as "11".
 */
export function qtyWithUnit(qty: number, unit?: string): string {
  const q = fmtQty(qty);
  let u = String(unit || '').trim();
  const lead = u.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (lead && Number(lead[1]) === Number(qty)) u = lead[2];
  return u ? `${q} ${u}` : q;
}

/**
 * The quotation's service lines when the active extension supplies them: one clean card per line,
 * read-only by default (status, key values, the extension's status fields), one card open at a time,
 * editing in a side drawer with the field controls the extension declares.
 */
export const SalesFlowLinesTable: React.FC<LinesTableProps> = ({
  title,
  subtitle,
  addLabel,
  lines,
  setLines,
  meta,
  setMeta,
  details,
  fields,
  lineOptions,
  note,
  currency,
  loading,
  newLine,
  groups = [],
  disabled = false,
  emptyText,
  fixed = false,
  requirement = null,
}) => {
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; isNew: boolean } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const shown = lines.filter((l) => l.name.trim() || meta[l.key]?.manual);

  const metaOf = (key: string): SalesFlowLineMeta => meta[key] || { selected: true, unit: '', extra: {} };
  const groupOf = (key?: string) => groups.find((g) => g.key === key);
  const fieldsFor = (line: EditableLine): SalesFlowLineField[] => {
    const g = groupOf(metaOf(line.key).group);
    if (!g || !Array.isArray(g.fields) || !g.fields.length) return fields;
    return g.fields.map((k) => fields.find((f) => f.key === k)).filter((f): f is SalesFlowLineField => Boolean(f));
  };

  // One card open at a time; the first line opens by itself.
  const firstKey = shown[0]?.key || null;
  const openKey = expanded === null ? firstKey : expanded;

  const addLine = (option: { name: string; unit?: string; tax?: number; group?: string } | null, trigger?: HTMLElement | null) => {
    const line = { ...newLine(), name: option?.name || '', tax: option?.tax ?? 18, qty: 1, rate: 0 };
    setLines((prev) => [...prev.filter((l) => l.name.trim() || meta[l.key]?.manual), line]);
    setMeta((prev) => ({
      ...prev,
      [line.key]: { selected: true, unit: option?.unit || '', extra: {}, manual: true, group: option?.group || '' },
    }));
    setAdding(false);
    setExpanded(line.key);
    returnFocus.current = trigger || null;
    setEditing({ key: line.key, isNew: true });
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setMenuFor(null);
  };

  const toggleSelected = (key: string) => {
    setMeta((prev) => {
      const base = prev[key] || { selected: true, unit: '', extra: {} };
      return { ...prev, [key]: { ...base, selected: !base.selected } };
    });
    setMenuFor(null);
  };

  const openEditor = (key: string, trigger: HTMLElement | null) => {
    returnFocus.current = trigger;
    setMenuFor(null);
    setExpanded(key);
    setEditing({ key, isNew: false });
  };

  const closeEditor = () => {
    setEditing(null);
    const el = returnFocus.current;
    returnFocus.current = null;
    if (el && typeof el.focus === 'function') window.setTimeout(() => el.focus(), 0);
  };

  /** Lines by group, in the declared order; lines without a known group go last under "Other". */
  const buckets = (() => {
    if (!groups.length) return [{ key: '_all', title: '', icon: '', lines: shown }];
    const known = new Set(groups.map((g) => g.key));
    const list = groups.map((g) => ({ key: g.key, title: g.title, icon: g.icon || '', lines: [] as EditableLine[] }));
    const other = { key: '', title: 'Other', icon: 'service', lines: [] as EditableLine[] };
    for (const line of shown) {
      const key = metaOf(line.key).group || '';
      const bucket = key && known.has(key) ? list.find((b) => b.key === key) : undefined;
      (bucket || other).lines.push(line);
    }
    return [...list, other].filter((b) => b.lines.length);
  })();

  /** "#2" when the same service appears more than once. */
  const numberOf = (line: EditableLine): string => {
    const same = shown.filter((l) => l.name.trim().toLowerCase() === line.name.trim().toLowerCase());
    return same.length > 1 ? `#${same.indexOf(line) + 1}` : '';
  };

  const emptyMessage = emptyText || 'No completed requirement on this lead yet. Complete one, or add a service by hand.';
  const editingLine = editing ? lines.find((l) => l.key === editing.key) || null : null;

  const renderCard = (line: EditableLine, groupIcon: string) => {
    const m = metaOf(line.key);
    const d = details[line.key] || [];
    const lineFields = fieldsFor(line);
    const statusFields = lineFields.filter((f) => f.type === 'select' && f.tones);
    const infoFields = lineFields.filter((f) => !(f.type === 'select' && f.tones) && (m.extra[f.key] || '').trim());
    const missing = missingOf(line);
    const isOpen = openKey === line.key;
    const Icon = GROUP_ICONS[groupIcon] || Layers;
    const num = numberOf(line);
    const amount = line.qty * line.rate * (1 + (Number(line.tax) || 0) / 100);
    const summary = [
      line.description ? line.description.split(/\s+·\s+|\n/)[0] : '',
      line.qty > 0 ? qtyWithUnit(line.qty, m.unit) : '',
      line.rate > 0 ? money(amount, currency) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const panelId = `sfl-${line.key}`;

    return (
      <li
        key={line.key}
        className={`rounded-xl border border-zinc-200 bg-white ${m.selected ? '' : 'opacity-60'}`}
        data-testid="quotation-line-card"
        data-status={!m.selected ? 'excluded' : missing.length ? 'draft' : 'complete'}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600" aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setExpanded(isOpen ? '' : line.key)}
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[13.5px] font-semibold text-zinc-950 break-words">
                {line.name || 'New service'}
                {num ? <span className="ml-1 font-medium text-zinc-500">{num}</span> : null}
              </span>
              {!m.selected ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600">Not included</span>
              ) : missing.length ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                  Draft · {missing.length} field{missing.length === 1 ? '' : 's'} remaining
                </span>
              ) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">Complete</span>
              )}
            </span>
            {summary ? <span className="mt-0.5 block truncate text-xs text-zinc-500">{summary}</span> : null}
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 cursor-pointer"
              onClick={(e) => openEditor(line.key, e.currentTarget)}
              aria-label={`${missing.length && m.selected ? 'Continue' : 'Edit'} ${line.name || 'service'}`}
            >
              <Pencil className="h-3.5 w-3.5" /> {missing.length && m.selected ? 'Continue' : 'Edit'}
            </button>
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                aria-label={`More actions for ${line.name || 'service'}`}
                aria-haspopup="menu"
                aria-expanded={menuFor === line.key}
                onClick={() => setMenuFor(menuFor === line.key ? null : line.key)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuFor === line.key ? (
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg" role="menu">
                  <button type="button" role="menuitem" className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-[13px] text-zinc-900 hover:bg-zinc-50" onClick={() => toggleSelected(line.key)}>
                    {m.selected ? 'Leave out of quotation' : 'Include in quotation'}
                  </button>
                  {m.manual && !fixed ? (
                    <button type="button" role="menuitem" className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-[13px] text-red-700 hover:bg-red-50" onClick={() => removeLine(line.key)}>
                      Remove service
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isOpen ? (
          <div id={panelId} className="border-t border-zinc-100 px-4 py-3">
            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] lg:grid-cols-3">
              <div>
                <dt className="text-[11px] text-zinc-500">Quantity</dt>
                <dd className="m-0 font-medium text-zinc-900">{line.qty > 0 ? qtyWithUnit(line.qty, m.unit) : <span className="text-amber-700">Missing</span>}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">Rate</dt>
                <dd className="m-0 font-medium text-zinc-900">
                  {line.rate > 0 ? money(line.rate, currency) : <span className="text-amber-700">Missing</span>}
                  <span className="ml-1.5 text-[11px] font-normal text-zinc-500">Tax {line.tax}%</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-zinc-500">Amount (incl. tax)</dt>
                <dd className="m-0 font-semibold text-zinc-950">{money(amount, currency)}</dd>
              </div>
              {infoFields.map((f) => (
                <div key={f.key}>
                  <dt className="text-[11px] text-zinc-500">{f.label}</dt>
                  <dd className="m-0 font-medium text-zinc-900 break-words">{m.extra[f.key]}</dd>
                </div>
              ))}
              {line.description ? (
                <div className="col-span-2 lg:col-span-3">
                  <dt className="text-[11px] text-zinc-500">Details</dt>
                  <dd className="m-0 text-zinc-800 break-words whitespace-pre-line">{line.description}</dd>
                </div>
              ) : null}
            </dl>

            {statusFields.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3" data-testid="quotation-line-status">
                {statusFields.map((f) => {
                  const value = m.extra[f.key] || '';
                  const tone = TONE_CLASS[(f.tones && f.tones[value]) || 'neutral'] || TONE_CLASS.neutral;
                  return (
                    <span key={f.key} className="inline-flex items-center gap-2 text-xs">
                      <span className="font-semibold text-zinc-600">{f.label}</span>
                      {value ? (
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{value}</span>
                      ) : (
                        <span className="text-zinc-400">Not set</span>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : null}

            {fixed && requirement ? (
              <p className="m-0 mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
                Route, dates and class come from the requirement.{' '}
                <Link to={requirement.href} className="font-semibold text-zinc-800">
                  {requirement.label}
                </Link>
              </p>
            ) : null}
            {d.length ? (
              <details className="mt-3 border-t border-zinc-100 pt-2">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-600">Requirement</summary>
                <SalesFlowDetails details={d} />
              </details>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  const total = shown
    .filter((l) => metaOf(l.key).selected)
    .reduce((n, l) => n + l.qty * l.rate * (1 + (Number(l.tax) || 0) / 100), 0);
  const drafts = shown.filter((l) => metaOf(l.key).selected && missingOf(l).length).length;

  return (
    <section data-tour="quotations-create-lines" className="bg-white border border-zinc-300 rounded-xl p-5" data-testid="quotation-locked-lines">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-sm font-semibold text-zinc-950">{title}</h2>
          <p className="m-0 text-xs text-zinc-500">{subtitle}</p>
          {shown.length ? (
            <p className="m-0 mt-1 text-xs text-zinc-600" data-testid="quotation-lines-total">
              {shown.length} service{shown.length === 1 ? '' : 's'} · {money(total, currency)} incl. tax
              {drafts ? <span className="text-amber-700"> · {drafts} to complete</span> : null}
            </p>
          ) : null}
        </div>
        {fixed ? (
          requirement ? (
            <Link
              to={requirement.href}
              className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-900 no-underline hover:bg-zinc-50"
              data-testid="quotation-requirement-link"
            >
              <Pencil className="h-3.5 w-3.5" /> {requirement.label}
            </Link>
          ) : null
        ) : (
        <div className="relative">
          <button
            type="button"
            className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            onClick={() => setAdding((v) => !v)}
            aria-expanded={adding}
            aria-haspopup="menu"
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </button>
          {adding && !disabled ? (
            <div className="absolute right-0 z-20 mt-1 w-64 max-h-72 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg py-1" role="menu">
              {lineOptions.map((o, i) => (
                <button
                  key={`${o.name}-${i}`}
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-3 py-2 text-[13px] text-zinc-900 bg-transparent border-0 hover:bg-zinc-50 cursor-pointer"
                  onClick={(e) => addLine(o, e.currentTarget.closest('section')?.querySelector('[aria-haspopup="menu"]') as HTMLElement | null)}
                >
                  {o.name}
                  {o.unit ? <span className="text-xs text-zinc-500"> · {o.unit}</span> : null}
                  {groupOf(o.group)?.title ? <span className="block text-[11px] text-zinc-500">{groupOf(o.group)?.title}</span> : null}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-2 text-[13px] font-semibold text-zinc-900 bg-transparent border-0 border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                onClick={() => addLine(null)}
              >
                Custom service…
              </button>
            </div>
          ) : null}
        </div>
        )}
      </div>

      {loading || !shown.length ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-xs text-zinc-500" data-testid="quotation-lines-empty">
          {loading ? 'Loading…' : emptyMessage}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {buckets.map((bucket) => (
            <div key={bucket.key || '_other'} data-testid="quotation-line-group" data-group={bucket.key}>
              {bucket.title ? (
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{bucket.title}</h3>
                  <span className="text-[11px] text-zinc-500">
                    {bucket.lines.length} service{bucket.lines.length === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}
              <ul className="m-0 flex list-none flex-col gap-2 p-0">{bucket.lines.map((line) => renderCard(line, bucket.icon))}</ul>
            </div>
          ))}
        </div>
      )}
      {note ? (
        <p className="m-0 mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {note}
        </p>
      ) : null}

      {editing && editingLine ? (
        <LineEditDrawer
          line={editingLine}
          meta={metaOf(editingLine.key)}
          fields={fieldsFor(editingLine)}
          currency={currency}
          isNew={editing.isNew}
          fixed={fixed}
          requirement={requirement}
          onCancel={() => {
            if (editing.isNew) setLines((prev) => prev.filter((l) => l.key !== editing.key));
            closeEditor();
          }}
          onSave={(patch, metaPatch) => {
            setLines((prev) => prev.map((l) => (l.key === editing.key ? { ...l, ...patch } : l)));
            setMeta((prev) => {
              const base = prev[editing.key] || { selected: true, unit: '', extra: {} };
              return { ...prev, [editing.key]: { ...base, ...metaPatch } };
            });
            closeEditor();
          }}
        />
      ) : null}
    </section>
  );
};

/* ------------------------------------------------------------------ drawer */

interface DrawerProps {
  line: EditableLine;
  meta: SalesFlowLineMeta;
  fields: SalesFlowLineField[];
  currency: string;
  isNew: boolean;
  /** Only rate and tax change; the service, quantity and the extension's columns are shown read-only. */
  fixed?: boolean;
  requirement?: { href: string; label: string } | null;
  onCancel: () => void;
  onSave: (patch: Partial<EditableLine>, meta: Partial<SalesFlowLineMeta>) => void;
}

/** Edits one service line in a right-side drawer (full width on phones); nothing changes until Save. */
const LineEditDrawer: React.FC<DrawerProps> = ({ line, meta, fields, currency, isNew, fixed = false, requirement = null, onCancel, onSave }) => {
  const [name, setName] = useState(line.name);
  const [description, setDescription] = useState(line.description);
  const [qty, setQty] = useState(line.qty ? String(line.qty) : '');
  const [rate, setRate] = useState(line.rate ? String(line.rate) : '');
  const [tax, setTax] = useState(String(line.tax ?? 0));
  const [unit, setUnit] = useState(meta.unit);
  const [selected, setSelected] = useState(meta.selected);
  const [extra, setExtra] = useState<Record<string, string>>({ ...meta.extra });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panel = useRef<HTMLDivElement | null>(null);
  const titleId = `sfl-drawer-${line.key}`;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      // Keep the keyboard inside the drawer.
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button, input, select, textarea')).filter((el) => !el.hasAttribute('disabled'));
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const save = () => {
    const next: Record<string, string> = {};
    const q = fixed ? line.qty : Number(qty);
    const r = rate === '' ? 0 : Number(rate);
    const t = tax === '' ? 0 : Number(tax);
    if (!fixed && meta.manual && !name.trim()) next.name = 'Enter the service name';
    if (!(q > 0)) next.qty = 'Enter a quantity above 0';
    if (!Number.isFinite(r) || r < 0) next.rate = 'Enter a rate of 0 or more';
    if (!Number.isFinite(t) || t < 0 || t > 100) next.tax = 'Tax must be between 0 and 100%';
    setErrors(next);
    if (Object.keys(next).length) {
      const firstBad = panel.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      firstBad?.focus();
      return;
    }
    if (fixed) {
      onSave({ rate: r, tax: t }, { selected });
      return;
    }
    onSave(
      { name: meta.manual ? name.trim() : line.name, description: meta.manual ? description : line.description, qty: q, rate: r, tax: t },
      { unit: meta.manual ? unit.trim() : meta.unit, selected, extra }
    );
  };

  const field = (id: string, label: string, control: React.ReactNode, error?: string, hint?: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-zinc-700">{label}</label>
      {control}
      {error ? <p id={`${id}-err`} className="m-0 text-[11px] font-semibold text-red-700">{error}</p> : hint ? <p className="m-0 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="quotation-line-drawer">
      <div className="absolute inset-0 bg-zinc-950/40" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-[440px] flex-col bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="m-0 text-base font-semibold text-zinc-950 break-words">
              {isNew ? 'Add service' : `Edit ${line.name || 'service'}`}
            </h2>
            <p className="m-0 mt-0.5 text-xs text-zinc-500">Changes apply to this quotation when you save it.</p>
          </div>
          <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-zinc-500 hover:bg-zinc-100 cursor-pointer" aria-label="Close" onClick={onCancel}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            {fixed ? (
              <div className="rounded-lg bg-zinc-50 px-3 py-3" data-testid="quotation-line-readonly">
                <p className="m-0 text-sm font-semibold text-zinc-950 break-words">{line.name}</p>
                {line.description ? <p className="m-0 mt-0.5 text-xs text-zinc-600 break-words whitespace-pre-line">{line.description}</p> : null}
                <dl className="m-0 mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-zinc-500">Quantity</dt>
                    <dd className="m-0 font-medium text-zinc-900">{qtyWithUnit(line.qty, meta.unit)}</dd>
                  </div>
                  {fields
                    .filter((f) => (meta.extra[f.key] || '').trim())
                    .map((f) => (
                      <div key={f.key}>
                        <dt className="text-zinc-500">{f.label}</dt>
                        <dd className="m-0 font-medium text-zinc-900 break-words">{meta.extra[f.key]}</dd>
                      </div>
                    ))}
                </dl>
                {requirement ? (
                  <p className="m-0 mt-2 text-[11px] text-zinc-500">
                    Wrong details? <Link to={requirement.href} className="font-semibold text-zinc-800">{requirement.label}</Link>
                  </p>
                ) : null}
              </div>
            ) : null}
            {!fixed && meta.manual
              ? field(
                  'sfl-name',
                  'Service *',
                  <input
                    id="sfl-name"
                    className={financeFieldClass}
                    maxLength={200}
                    value={name}
                    aria-invalid={errors.name ? 'true' : 'false'}
                    aria-describedby={errors.name ? 'sfl-name-err' : undefined}
                    onChange={(e) => setName(e.target.value)}
                  />,
                  errors.name
                )
              : null}
            {!fixed && meta.manual
              ? field(
                  'sfl-desc',
                  'Details',
                  <textarea id="sfl-desc" className={financeTextAreaClass} rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
                )
              : null}

            <div className="grid grid-cols-2 gap-3">
              {fixed ? null : field(
                'sfl-qty',
                'Quantity *',
                <input
                  id="sfl-qty"
                  type="number"
                  min="0.01"
                  step="any"
                  inputMode="decimal"
                  className={financeFieldClass}
                  value={qty}
                  aria-invalid={errors.qty ? 'true' : 'false'}
                  aria-describedby={errors.qty ? 'sfl-qty-err' : undefined}
                  onChange={(e) => setQty(e.target.value)}
                />,
                errors.qty,
                !meta.manual && meta.unit ? meta.unit : undefined
              )}
              {!fixed && meta.manual
                ? field('sfl-unit', 'Unit', <input id="sfl-unit" className={financeFieldClass} maxLength={60} placeholder="e.g. Persons" value={unit} onChange={(e) => setUnit(e.target.value)} />)
                : null}
              {field(
                'sfl-rate',
                `Rate (${currency}) *`,
                <input
                  id="sfl-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={financeFieldClass}
                  value={rate}
                  aria-invalid={errors.rate ? 'true' : 'false'}
                  aria-describedby={errors.rate ? 'sfl-rate-err' : undefined}
                  onChange={(e) => setRate(e.target.value)}
                />,
                errors.rate
              )}
              {field(
                'sfl-tax',
                'Tax (%)',
                <input
                  id="sfl-tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputMode="decimal"
                  className={financeFieldClass}
                  value={tax}
                  aria-invalid={errors.tax ? 'true' : 'false'}
                  aria-describedby={errors.tax ? 'sfl-tax-err' : undefined}
                  onChange={(e) => setTax(e.target.value)}
                />,
                errors.tax
              )}
            </div>
            <p className="m-0 -mt-2 text-xs text-zinc-600" data-testid="quotation-line-amount">
              Amount{' '}
              <strong className="text-zinc-950">
                {money(
                  (fixed ? line.qty : Number(qty) || 0) * (Number(rate) || 0) * (1 + (Number(tax) || 0) / 100),
                  currency
                )}
              </strong>{' '}
              incl. tax
            </p>

            {fields.length && !fixed ? (
              <div className="flex flex-col gap-4 border-t border-zinc-100 pt-4">
                {fields.map((f) => {
                  const id = `sfl-x-${f.key}`;
                  const value = extra[f.key] || '';
                  const set = (v: string) => setExtra((prev) => ({ ...prev, [f.key]: v }));
                  if (f.type === 'select') {
                    const options = (f.options || []).includes(value) || !value ? f.options || [] : [...(f.options || []), value];
                    return (
                      <React.Fragment key={f.key}>
                        {field(
                          id,
                          f.label,
                          <select id={id} className={financeFieldClass} value={value} onChange={(e) => set(e.target.value)}>
                            <option value="">Not set</option>
                            {options.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        )}
                      </React.Fragment>
                    );
                  }
                  return (
                    <React.Fragment key={f.key}>
                      {field(id, f.label, <input id={id} className={financeFieldClass} maxLength={f.maxLength || 200} value={value} onChange={(e) => set(e.target.value)} />)}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : null}

            <label className="flex items-center gap-2 border-t border-zinc-100 pt-4 text-sm text-zinc-800 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-zinc-950" checked={selected} onChange={(e) => setSelected(e.target.checked)} />
              Include in this quotation
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3">
          <button type="button" className="h-9 rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 cursor-pointer" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="h-9 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer" onClick={save}>
            {isNew ? 'Add service' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
