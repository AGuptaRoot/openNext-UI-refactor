import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

import { crmApi } from '../../services/api';
import { getDefaultCurrencySymbol } from '../../utils/currency';
import type { OpportunityItemDraft } from '../../types/leads';

/**
 * The budget captured on the lead's commercial requirement, with the range its
 * request type allows. The deal value defaults to the budget and is held to the
 * same range, so the figure cannot drift away from what was agreed on the
 * requirement form. The backend repeats both checks.
 */
export interface ConvertBudgetContext {
  value: number | null;
  min: number | null;
  max: number | null;
  requestTypeName: string;
}

interface ItemRow extends OpportunityItemDraft {
  /** Stable key so React does not remount rows while typing. */
  key: string;
}

export interface InterestedOpportunityModalProps {
  leadId: string;
  eventId: string;
  /** Pre-filled opportunity title; the rep can override it. */
  defaultTitle: string;
  onClose: () => void;
  /** Fired after the opportunity is created. */
  onCreated: (opportunityNumber: string) => void;
  showToast: (message: string, kind?: 'success' | 'error') => void;
  /** Budget + allowed range from the lead's commercial requirement. */
  budget?: ConvertBudgetContext;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Money as the tenant writes it, for range hints. */
function money(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString()}`;
}

let rowSeq = 0;
function emptyRow(): ItemRow {
  rowSeq += 1;
  return { key: `item_${rowSeq}`, name: '', description: '' };
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-950';

/**
 * "Interested" on a commercial-requirement activity row.
 *
 * Collects item name + description pairs (no quantity or price by design) and
 * creates the opportunity in one call. Both fields offer a type-ahead of pairs
 * already used on other opportunities. The deal opens on the pipeline's
 * requirement-confirmed stage, since that is what this conversion asserts.
 */
export const InterestedOpportunityModal: React.FC<InterestedOpportunityModalProps> = ({
  leadId,
  eventId,
  defaultTitle,
  onClose,
  onCreated,
  showToast,
  budget,
}) => {
  const currencySymbol = getDefaultCurrencySymbol();
  const budgetValue =
    budget?.value != null && Number.isFinite(budget.value) && budget.value > 0
      ? budget.value
      : null;

  const [title, setTitle] = useState(defaultTitle);
  // Synced from the requirement's budget; the rep can still override it.
  const [dealValue, setDealValue] = useState(budgetValue != null ? String(budgetValue) : '');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [closedAt, setClosedAt] = useState('');
  const [rows, setRows] = useState<ItemRow[]>(() => [emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<OpportunityItemDraft[]>([]);
  const [openSuggestFor, setOpenSuggestFor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    crmApi
      .getLeadEventItemSuggestions(leadId)
      .then((res) => {
        if (!cancelled) setSuggestions(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openSuggestFor) setOpenSuggestFor(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, openSuggestFor]);

  const patchRow = useCallback((key: string, patch: Partial<OpportunityItemDraft>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }, []);

  const addRow = useCallback(() => {
    setRows((current) => [...current, emptyRow()]);
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((current) => (current.length === 1 ? current : current.filter((r) => r.key !== key)));
  }, []);

  /** Suggestions matching whatever the active row has typed so far. */
  const matchesFor = useCallback(
    (row: ItemRow) => {
      const term = `${row.name} ${row.description}`.trim().toLowerCase();
      const pool = suggestions.filter(
        (s) => !rows.some((r) => r.name === s.name && r.description === s.description)
      );
      if (!term) return pool.slice(0, 8);
      return pool
        .filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            term.split(/\s+/).some((part) => part && s.name.toLowerCase().includes(part))
        )
        .slice(0, 8);
    },
    [suggestions, rows]
  );

  const filledRows = useMemo(() => rows.filter((r) => r.name.trim()), [rows]);

  /** Range hint under the deal value, e.g. "Budget range: ₹1,00,000 – ₹5,00,000". */
  const rangeHint = useMemo(() => {
    const min = budget?.min ?? null;
    const max = budget?.max ?? null;
    if (min == null && max == null) return '';
    const forType = budget?.requestTypeName ? ` (${budget.requestTypeName})` : '';
    if (min != null && max != null) {
      return `Allowed range: ${money(min, currencySymbol)} – ${money(max, currencySymbol)}${forType}`;
    }
    if (min != null) return `Minimum ${money(min, currencySymbol)}${forType}`;
    return `Maximum ${money(max as number, currencySymbol)}${forType}`;
  }, [budget, currencySymbol]);

  const valueError = useMemo(() => {
    const raw = dealValue.trim();
    if (!raw) return '';
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      return 'Enter a valid amount';
    }
    const forType = budget?.requestTypeName ? ` for ${budget.requestTypeName}` : '';
    if (budget?.min != null && amount < budget.min) {
      return `Must be at least ${money(budget.min, currencySymbol)}${forType}`;
    }
    if (budget?.max != null && amount > budget.max) {
      return `Cannot exceed ${money(budget.max, currencySymbol)}${forType}`;
    }
    return '';
  }, [dealValue, budget, currencySymbol]);

  const closedAtError = useMemo(() => {
    if (!closedAt) return '';
    return closedAt > todayIso() ? 'A close date cannot be in the future' : '';
  }, [closedAt]);

  const blocked = Boolean(valueError || closedAtError);
  const budgetOutOfSync =
    budgetValue != null && dealValue.trim() !== '' && Number(dealValue) !== budgetValue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!filledRows.length) {
      showToast('Add at least one item', 'error');
      return;
    }
    if (valueError) {
      showToast(valueError, 'error');
      return;
    }
    if (closedAtError) {
      showToast(closedAtError, 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await crmApi.convertLeadEventToOpportunity(leadId, eventId, {
        items: filledRows.map((r) => ({
          name: r.name.trim(),
          description: r.description.trim(),
        })),
        title: title.trim() || undefined,
        // Left out when blank, so the backend falls back to the lead's budget.
        estimatedDealValue: dealValue.trim() === '' ? undefined : Number(dealValue),
        expectedCloseDate: expectedCloseDate || undefined,
        closedAt: closedAt || undefined,
      });
      const created = res.data?.opportunity;
      onCreated(String(created?.opportunityNumber || created?._id || ''));
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Failed to create the opportunity',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Create opportunity from commercial requirement"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div>
            <h3 className="m-0 text-sm font-bold text-zinc-950">Convert to opportunity</h3>
            <p className="mb-0 mt-1 text-xs text-zinc-500">
              Add the items the client is interested in. The deal opens at the
              <strong className="font-semibold text-zinc-700"> Requirement Confirmed </strong>
              stage; revenue, pipeline and close date can be set on it afterwards.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg border-0 bg-transparent p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold text-zinc-600">
              Opportunity title
            </label>
            <input
              type="text"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Acme Corporation — Product"
              className={inputClass}
            />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">
                Estimated deal value
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder={budgetValue != null ? String(budgetValue) : '0'}
                  className={`${inputClass} pl-7 ${
                    valueError ? 'border-red-400 focus:border-red-500' : ''
                  }`}
                />
              </div>
              {valueError ? (
                <p className="mb-0 mt-1 text-[11px] font-medium text-red-600">{valueError}</p>
              ) : (
                <p className="mb-0 mt-1 text-[11px] text-zinc-500">
                  {budgetValue != null
                    ? `Synced from the requirement budget${rangeHint ? ` · ${rangeHint}` : ''}`
                    : rangeHint || 'Falls back to the qualified revenue when left blank'}
                </p>
              )}
              {budgetOutOfSync ? (
                <button
                  type="button"
                  onClick={() => setDealValue(String(budgetValue))}
                  className="mt-1 cursor-pointer rounded-md border-0 bg-transparent p-0 text-[11px] font-semibold text-zinc-700 underline hover:text-zinc-950"
                >
                  Reset to budget ({money(budgetValue as number, currencySymbol)})
                </button>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">
                Expected close
              </label>
              <input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className={inputClass}
              />
              <p className="mb-0 mt-1 text-[11px] text-zinc-500">When you expect to win it</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Closed at</label>
              <input
                type="date"
                value={closedAt}
                max={todayIso()}
                onChange={(e) => setClosedAt(e.target.value)}
                className={`${inputClass} ${
                  closedAtError ? 'border-red-400 focus:border-red-500' : ''
                }`}
              />
              {closedAtError ? (
                <p className="mb-0 mt-1 text-[11px] font-medium text-red-600">{closedAtError}</p>
              ) : (
                <p className="mb-0 mt-1 text-[11px] text-zinc-500">
                  Leave blank — filled when the deal is Won or Lost
                </p>
              )}
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600">Items</span>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              <Plus className="h-3 w-3 shrink-0" aria-hidden />
              Add new item
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const matches = openSuggestFor === row.key ? matchesFor(row) : [];
              return (
                <div
                  key={row.key}
                  className="relative rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-5">
                        <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                          Item {index + 1}
                        </label>
                        <input
                          type="text"
                          maxLength={200}
                          value={row.name}
                          onChange={(e) => patchRow(row.key, { name: e.target.value })}
                          onFocus={() => setOpenSuggestFor(row.key)}
                          placeholder="e.g. Annual licence"
                          className={inputClass}
                          autoComplete="off"
                        />
                      </div>
                      <div className="sm:col-span-7">
                        <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                          Description
                        </label>
                        <input
                          type="text"
                          maxLength={2000}
                          value={row.description}
                          onChange={(e) => patchRow(row.key, { description: e.target.value })}
                          onFocus={() => setOpenSuggestFor(row.key)}
                          placeholder="e.g. 25 seats, includes support"
                          className={inputClass}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length === 1}
                      aria-label={`Remove item ${index + 1}`}
                      className="mt-5 shrink-0 rounded-lg border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </button>
                  </div>

                  {matches.length > 0 && (
                    <div className="absolute left-3 right-3 top-full z-10 -mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                      <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Used on other opportunities
                      </div>
                      {matches.map((match) => (
                        <button
                          key={`${match.name}|${match.description}`}
                          type="button"
                          // mousedown fires before the input's blur, so the row
                          // is filled before the dropdown can close.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            patchRow(row.key, {
                              name: match.name,
                              description: match.description,
                            });
                            setOpenSuggestFor(null);
                          }}
                          className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left hover:bg-zinc-50"
                        >
                          <span className="block text-xs font-semibold text-zinc-900">
                            {match.name}
                          </span>
                          {match.description ? (
                            <span className="block text-[11px] text-zinc-500">
                              {match.description}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4">
            <span className="text-[11px] text-zinc-500">
              {filledRows.length} item{filledRows.length === 1 ? '' : 's'} ready
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !filledRows.length || blocked}
                className="inline-flex h-9 items-center rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create opportunity'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
