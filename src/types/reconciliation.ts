/** Bank statement matching and Razorpay fees (GST suite, CRM 3.53.0). */

export interface BankRow {
  date: string;
  description: string;
  reference: string;
  credit: number;
  debit: number;
  balance: number;
}

export interface BankSuggestion {
  key: string;
  kind: 'invoice' | 'expense' | 'settlement' | string;
  label: string;
  amount: number;
  date: string;
  record: boolean;
  why?: string[];
}

export interface BankLine {
  id: string;
  statementId: string;
  account: string;
  date: string;
  description: string;
  reference: string;
  credit: number;
  debit: number;
  balance: number;
  status: 'open' | 'matched' | 'ignored';
  match: { key: string; kind: string; id: string; paymentId?: string; recorded?: boolean; label?: string } | null;
  suggestions: BankSuggestion[];
}

export interface BankLinesResponse {
  accounts: string[];
  lines: BankLine[];
  counts: { open: number; matched: number; ignored: number };
}

export interface BankImportResult {
  statementId: string;
  added: number;
  skippedAsDuplicate: number;
  ignoredRows: number;
}

export interface GatewayFeeRow {
  paymentId: string;
  paidOn: string;
  method: string;
  gross: number;
  fee: number | null;
  gstOnFee: number | null;
  net: number | null;
  settlementId: string;
  settledOn: string;
  invoiceId: string;
  bankMatched: boolean;
}

export interface GatewayFeeSummary {
  month: string;
  payments: number;
  gross: number;
  fee: number;
  gstOnFee: number;
  net: number;
  pending: number;
  rows: GatewayFeeRow[];
  note: string;
}
