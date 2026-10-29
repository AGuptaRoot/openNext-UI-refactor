import type { QuotationAdvanceMode, QuotationPaymentType } from '../types/quotations';

/**
 * What a client is being asked to pay now on a quotation.
 *
 * Mirrors `computePayableAmount` in
 * openext-crm-suite/api/services/proforma.service.js — the server decides the
 * real figure, this one only keeps the screen honest while someone types. It
 * reports problems instead of throwing, because a half-typed advance is a
 * normal state for a form to be in.
 */

export interface QuotationPaymentTerms {
  grandTotal?: number;
  paymentType?: QuotationPaymentType | string;
  advanceMode?: QuotationAdvanceMode | string;
  advanceValue?: number;
}

export interface QuotationPayable {
  /** Payable now; 0 when the terms are not usable yet. */
  amount: number;
  /** True only when something is still owed after this payment. */
  isAdvance: boolean;
  total: number;
  /** What is left after this payment. */
  balance: number;
  /** Why `amount` is 0, in the words the server would use. */
  error: string;
}

function round2(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

export function computeQuotationPayable(
  terms: QuotationPaymentTerms,
  defaultAdvancePercent = 30
): QuotationPayable {
  const total = round2(terms.grandTotal);
  const empty = { amount: 0, isAdvance: false, total, balance: total };

  if (!(total > 0)) {
    return { ...empty, error: 'This quotation has no amount to pay.' };
  }

  if (String(terms.paymentType || 'full') !== 'advance') {
    return { amount: total, isAdvance: false, total, balance: 0, error: '' };
  }

  const fallbackPercent =
    Number.isFinite(Number(defaultAdvancePercent)) && Number(defaultAdvancePercent) > 0
      ? Number(defaultAdvancePercent)
      : 30;
  const raw = Number(terms.advanceValue);

  let amount: number;
  if (String(terms.advanceMode || 'percent') === 'amount') {
    amount = round2(raw);
  } else {
    const percent = Number.isFinite(raw) && raw > 0 ? raw : fallbackPercent;
    amount = round2((total * Math.min(100, percent)) / 100);
  }

  if (!(amount > 0)) {
    return { ...empty, error: 'The advance amount must be greater than zero.' };
  }
  if (amount > total) {
    return { ...empty, error: 'The advance cannot be more than the quotation total.' };
  }

  return {
    amount,
    isAdvance: amount < total,
    total,
    balance: round2(total - amount),
    error: '',
  };
}
