/** Cash book (GST suite, CRM 3.53.0). Built by the server from cash payments, refunds, approved cash expenses and manual entries. */

export type CashLineSource = 'payment' | 'refund' | 'expense' | 'own';

export interface CashLine {
  key: string;
  source: CashLineSource;
  label: string;
  type: 'in' | 'out';
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  name: string;
  note: string;
  category: string;
  balance: number;
  link?: { kind: 'invoice' | 'expense' | 'record'; id: string; refType?: string };
  /** Only on manual entries (source 'own'). */
  entry?: { id: string; refType: string; refId: string };
}

export interface CashTotals {
  in: number;
  out: number;
  net: number;
}

export interface CashBookView {
  opening: number;
  rows: CashLine[];
  totals: CashTotals;
  closing: number;
}

export interface CashSummary {
  inHand: number;
  today: CashTotals;
  month: CashTotals;
  lockedUpTo: string;
}

export interface CashCategories {
  categories: string[];
  extension: { id: string; categories: string[]; refTypes: Array<{ refType: string; label: string }> } | null;
}

export interface CashEntryInput {
  type: 'in' | 'out';
  date: string;
  amount: number;
  category: string;
  name?: string;
  note?: string;
}

export interface CashEntry extends CashEntryInput {
  id: string;
  refType: string;
  refId: string;
}

export type PreferredPaymentMethod = '' | 'razorpay' | 'cash' | 'bank';

export const PREFERRED_PAYMENT_LABELS: Record<PreferredPaymentMethod, string> = {
  '': 'No preference',
  razorpay: 'Online (Razorpay)',
  cash: 'Cash at office',
  bank: 'Bank transfer / UPI',
};

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  mode: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Card' | 'Other';
  /** YYYY-MM-DD */
  paymentDate: string;
  transactionId?: string;
  remark?: string;
}
