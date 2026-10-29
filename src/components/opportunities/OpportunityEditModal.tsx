import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Info, Plus, Trash2, X } from 'lucide-react';

import { crmApi } from '../../services/api';
import type { OpportunityItem, OpportunityProductLine } from '../../types/opportunities';
import type { OpportunityItemDraft } from '../../types/leads';
import { INDIAN_STATES } from '../../types/opportunities';
import { PhoneNumberField } from '../common/PhoneNumberField';
import { splitPhoneNumber, validateNationalNumber } from '../../utils/phoneCountryCodes';

export type OpportunityEditSection = 'products' | 'financials' | 'contact';

export interface OpportunityEditModalProps {
  item: OpportunityItem;
  section: OpportunityEditSection;
  /** Currency used when the deal carries none of its own. */
  fallbackCurrency: string;
  onClose: () => void;
  onSaved: (updated: OpportunityItem & { contactSynced?: boolean }) => void;
  showToast: (message: string, kind?: 'success' | 'error') => void;
}

interface LineRow extends OpportunityProductLine {
  key: string;
}

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'SGD', 'AUD', 'CAD', 'JPY'];

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-950';
const labelClass = 'mb-1 block text-[11px] font-semibold text-zinc-600';

const SECTION_TITLE: Record<OpportunityEditSection, string> = {
  products: 'Edit products & line items',
  financials: 'Edit shipping & financials',
  contact: 'Edit primary contact',
};

let rowSeq = 0;
function toRows(lines: OpportunityProductLine[] = []): LineRow[] {
  return lines.map((line) => {
    rowSeq += 1;
    return {
      key: `line_${rowSeq}`,
      productName: line.productName || '',
      description: line.description || '',
      quantity: Number(line.quantity) || 1,
      unitPrice: Number(line.unitPrice) || 0,
      tax: line.tax == null ? 18 : Number(line.tax),
      amount: Number(line.amount) || 0,
    };
  });
}

function emptyRow(): LineRow {
  rowSeq += 1;
  return {
    key: `line_${rowSeq}`,
    productName: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    tax: 18,
    amount: 0,
  };
}

/**
 * Edits one section of a deal at a time, saved through PUT /opportunities/:id.
 *
 * Totals are shown live but always recomputed server-side from the line items,
 * so what is displayed here can never disagree with what is stored.
 */
export const OpportunityEditModal: React.FC<OpportunityEditModalProps> = ({
  item,
  section,
  fallbackCurrency,
  onClose,
  onSaved,
  showToast,
}) => {
  const [rows, setRows] = useState<LineRow[]>(() => toRows(item.products));
  const [shippingState, setShippingState] = useState(item.shippingState || '');
  const [shippingCharge, setShippingCharge] = useState(String(item.shippingCharge ?? 0));
  const [probability, setProbability] = useState(String(item.probability ?? 0));
  const [currency, setCurrency] = useState(item.currency || fallbackCurrency || 'INR');
  const [exchangeRate, setExchangeRate] = useState(String(item.exchangeRate ?? 1));
  const [contactPerson, setContactPerson] = useState(item.contactPerson || '');
  const [contactEmail, setContactEmail] = useState(item.contactEmail || '');
  const [contactMobile, setContactMobile] = useState(item.contactMobile || '');
  const [syncContact, setSyncContact] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<OpportunityItemDraft[]>([]);
  const [openSuggestFor, setOpenSuggestFor] = useState<string | null>(null);
  const linesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    crmApi
      .getOpportunityItemSuggestions()
      .then((res) => {
        if (!cancelled && res.data?.length) setSuggestions(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!openSuggestFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenSuggestFor(null);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (
        linesContainerRef.current &&
        !linesContainerRef.current.contains(e.target as Node)
      ) {
        setOpenSuggestFor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [openSuggestFor]);

  const matchesFor = useCallback(
    (row: LineRow) => {
      const term = `${row.productName} ${row.description || ''}`.trim().toLowerCase();
      const pool = suggestions.filter(
        (s) =>
          !rows.some(
            (r) =>
              r.key !== row.key &&
              r.productName.trim().toLowerCase() === s.name.toLowerCase() &&
              (r.description || '').trim().toLowerCase() === s.description.toLowerCase()
          )
      );
      if (!term) return pool.slice(0, 8);
      return pool
        .filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            term.split(/\s+/).some((part) => part && (s.name.toLowerCase().includes(part) || s.description.toLowerCase().includes(part)))
        )
        .slice(0, 8);
    },
    [suggestions, rows]
  );

  const hasLinkedContact = Boolean(item.contactId);
  const lockedBySalesOrder = Boolean(item.generatedSalesOrderId);
  const commercialLocked = lockedBySalesOrder && section !== 'contact';

  const totals = useMemo(() => {
    const subtotal = rows.reduce(
      (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
      0
    );
    const taxTotal = rows.reduce((sum, r) => {
      const base = (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);
      return sum + (base * (Number(r.tax) || 0)) / 100;
    }, 0);
    const shipping = Number(shippingCharge) || 0;
    const expected = Math.round((subtotal + taxTotal + shipping) * 100) / 100;
    return { subtotal, taxTotal, expected };
  }, [rows, shippingCharge]);

  const patchRow = (key: string, patch: Partial<LineRow>) => {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const body: Record<string, unknown> = {};

    if (section === 'products') {
      const cleaned = rows
        .map((r) => ({
          productName: r.productName.trim(),
          description: (r.description || '').trim(),
          quantity: Number(r.quantity) || 0,
          unitPrice: Number(r.unitPrice) || 0,
          tax: Number(r.tax) || 0,
        }))
        .filter((r) => r.productName);
      if (!cleaned.length) {
        showToast('Add at least one line item, or remove the empty rows', 'error');
        return;
      }
      const badQty = cleaned.find((r) => r.quantity < 1);
      if (badQty) {
        showToast(`"${badQty.productName}" needs a quantity of at least 1`, 'error');
        return;
      }
      body.products = cleaned;
    }

    if (section === 'financials') {
      const charge = Number(shippingCharge);
      if (!Number.isFinite(charge) || charge < 0) {
        showToast('Shipping charge cannot be negative', 'error');
        return;
      }
      const prob = Number(probability);
      if (!Number.isFinite(prob) || prob < 0 || prob > 100) {
        showToast('Probability must be between 0 and 100', 'error');
        return;
      }
      const rate = Number(exchangeRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        showToast('Exchange rate must be greater than zero', 'error');
        return;
      }
      body.shippingState = shippingState;
      body.shippingCharge = charge;
      body.probability = prob;
      body.currencyCode = currency;
      body.exchangeRate = rate;
    }

    if (section === 'contact') {
      if (contactMobile.trim()) {
        const split = splitPhoneNumber(contactMobile);
        if (split.dial && split.national) {
          const check = validateNationalNumber(split.dial, split.national);
          if (check.state === 'invalid' || check.state === 'incomplete') {
            showToast(`Mobile: ${check.message}`, 'error');
            return;
          }
        }
      }
      body.contactPerson = contactPerson.trim();
      body.contactEmail = contactEmail.trim();
      body.contactMobile = contactMobile.trim();
      body.syncContactRecord = hasLinkedContact && syncContact;
    }

    setSaving(true);
    try {
      const res = await crmApi.updateOpportunity(item._id, body);
      if (res.data) onSaved(res.data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={SECTION_TITLE[section]}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div>
            <h3 className="m-0 text-sm font-bold text-zinc-950">{SECTION_TITLE[section]}</h3>
            <p className="mb-0 mt-1 text-xs text-zinc-500">
              {item.opportunityNumber ? `${item.opportunityNumber} · ` : ''}
              {item.title}
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
          {commercialLocked ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                This deal has been converted to a sales order, which is already priced from these
                figures. Products, shipping and currency can no longer be changed here.
              </span>
            </div>
          ) : null}

          {section === 'products' && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-600">Line items</span>
                <button
                  type="button"
                  disabled={commercialLocked}
                  onClick={() => setRows((cur) => [...cur, emptyRow()])}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-40"
                >
                  <Plus className="h-3 w-3 shrink-0" aria-hidden />
                  Add line
                </button>
              </div>

              <div ref={linesContainerRef} className="flex flex-col gap-3">
                {rows.map((row, index) => {
                  const matches = openSuggestFor === row.key ? matchesFor(row) : [];
                  return (
                    <div key={row.key} className="relative rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
                      <div className="flex items-start gap-2">
                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-12">
                          <div className="sm:col-span-5">
                            <label className={labelClass}>Product / service {index + 1}</label>
                            <input
                              type="text"
                              maxLength={200}
                              disabled={commercialLocked}
                              value={row.productName}
                              onChange={(e) => patchRow(row.key, { productName: e.target.value })}
                              onFocus={() => setOpenSuggestFor(row.key)}
                              autoComplete="off"
                              className={inputClass}
                            />
                          </div>
                          <div className="sm:col-span-7">
                            <label className={labelClass}>Description</label>
                            <input
                              type="text"
                              maxLength={2000}
                              disabled={commercialLocked}
                              value={row.description || ''}
                              onChange={(e) => patchRow(row.key, { description: e.target.value })}
                              onFocus={() => setOpenSuggestFor(row.key)}
                              autoComplete="off"
                              className={inputClass}
                            />
                          </div>
                        <div className="sm:col-span-3">
                          <label className={labelClass}>Qty</label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            disabled={commercialLocked}
                            value={row.quantity}
                            onChange={(e) =>
                              patchRow(row.key, { quantity: Number(e.target.value) })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className={labelClass}>Unit price</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={commercialLocked}
                            value={row.unitPrice}
                            onChange={(e) =>
                              patchRow(row.key, { unitPrice: Number(e.target.value) })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelClass}>Tax %</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            disabled={commercialLocked}
                            value={row.tax}
                            onChange={(e) => patchRow(row.key, { tax: Number(e.target.value) })}
                            className={inputClass}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className={labelClass}>Line total</label>
                          <div className="px-1 py-2 font-mono text-xs text-zinc-700">
                            {(() => {
                              const base =
                                (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                              return (base + (base * (Number(row.tax) || 0)) / 100).toFixed(2);
                            })()}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={commercialLocked || rows.length === 1}
                        onClick={() => setRows((cur) => cur.filter((r) => r.key !== row.key))}
                        aria-label={`Remove line ${index + 1}`}
                        className="mt-5 shrink-0 rounded-lg border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </button>
                    </div>

                    {matches.length > 0 && (
                      <div className="absolute left-3 right-3 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl">
                        <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Used on other opportunities
                        </div>
                        {matches.map((match) => (
                          <button
                            key={`${match.name}|${match.description}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              patchRow(row.key, {
                                productName: match.name,
                                description: match.description,
                              });
                              setOpenSuggestFor(null);
                            }}
                            className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left hover:bg-zinc-50 transition-colors"
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

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
                    Subtotal
                  </span>
                  <span className="font-mono font-semibold">{totals.subtotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
                    Tax
                  </span>
                  <span className="font-mono font-semibold">{totals.taxTotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
                    Deal value (incl. shipping)
                  </span>
                  <span className="font-mono font-semibold">{totals.expected.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}

          {section === 'financials' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Destination state</label>
                <select
                  value={shippingState}
                  disabled={commercialLocked}
                  onChange={(e) => setShippingState(e.target.value)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Shipping charge</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={commercialLocked}
                  value={shippingCharge}
                  onChange={(e) => setShippingCharge(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select
                  value={currency}
                  disabled={commercialLocked}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={inputClass}
                >
                  {Array.from(new Set([currency, ...CURRENCIES])).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Exchange rate</label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  disabled={commercialLocked}
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Win probability %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={commercialLocked}
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-[11px] text-zinc-500">
                  Deal value is recalculated from the line items plus shipping when saved.
                </span>
              </div>
            </div>
          )}

          {section === 'contact' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Contact person</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    maxLength={200}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Mobile</label>
                  <PhoneNumberField
                    value={contactMobile}
                    onChange={setContactMobile}
                    inputClassName={inputClass}
                    placeholder="98765 43210"
                  />
                </div>
              </div>

              {hasLinkedContact ? (
                <label className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={syncContact}
                    onChange={(e) => setSyncContact(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Also update this person in the Contacts module. Other records showing this
                    contact will pick up the change.
                  </span>
                </label>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    This deal has no linked Contacts record, so the change applies to the
                    opportunity only.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || commercialLocked}
              className="inline-flex h-9 items-center rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
