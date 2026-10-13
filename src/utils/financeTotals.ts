import type { DiscountType, TaxCalculation } from '../types/quotations';

export interface FinanceLineInput {
  qty: number;
  rate: number;
  tax: number;
}

export interface FinanceTotalsInput {
  lines: FinanceLineInput[];
  discountType?: DiscountType;
  discountValue?: number;
  taxCalculation?: TaxCalculation;
  shippingCharge?: number;
  amountPaid?: number;
  creditAmount?: number;
}

export interface FinanceTotalsResult {
  subtotal: number;
  discount: number;
  taxBase: number;
  taxTotal: number;
  shippingCharge: number;
  grandTotal: number;
  amountPaid: number;
  creditAmount: number;
  balanceDue: number;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Tax/discount engine aligned with INVOICE_MODULE_REFERENCE.md §2.3
 */
export function calculateFinanceTotals(input: FinanceTotalsInput): FinanceTotalsResult {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const subtotal = round2(
    lines.reduce((sum, line) => sum + Math.max(0, Number(line.qty) || 0) * Math.max(0, Number(line.rate) || 0), 0)
  );

  const discountType = input.discountType || 'percent';
  const discountValue = Math.max(0, Number(input.discountValue) || 0);
  const discount =
    discountType === 'amount'
      ? round2(Math.min(subtotal, discountValue))
      : round2(Math.min(subtotal, (subtotal * discountValue) / 100));

  const taxCalculation = input.taxCalculation || 'after_discount';
  const taxBase = taxCalculation === 'before_discount' ? subtotal : round2(Math.max(0, subtotal - discount));

  const lineSubtotal = subtotal || 0;
  const taxTotal = round2(
    lines.reduce((sum, line) => {
      const lineAmount = Math.max(0, Number(line.qty) || 0) * Math.max(0, Number(line.rate) || 0);
      if (lineAmount <= 0 || lineSubtotal <= 0) return sum;
      const share = lineAmount / lineSubtotal;
      const taxable = taxBase * share;
      return sum + (taxable * (Math.max(0, Number(line.tax) || 0)) / 100);
    }, 0)
  );

  const shippingCharge = round2(Math.max(0, Number(input.shippingCharge) || 0));
  const taxablePlusTax =
    taxCalculation === 'before_discount'
      ? round2(Math.max(0, subtotal - discount) + taxTotal + shippingCharge)
      : round2(taxBase + taxTotal + shippingCharge);

  const amountPaid = round2(Math.max(0, Number(input.amountPaid) || 0));
  const creditAmount = round2(Math.max(0, Number(input.creditAmount) || 0));
  const balanceDue = round2(Math.max(0, taxablePlusTax - amountPaid - creditAmount));

  return {
    subtotal,
    discount,
    taxBase,
    taxTotal,
    shippingCharge,
    grandTotal: taxablePlusTax,
    amountPaid,
    creditAmount,
    balanceDue,
  };
}

export function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ',
    CAD: '$',
    AUD: '$',
    SGD: '$',
    JPY: '¥',
  };
  return map[currency] || currency;
}
