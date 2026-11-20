/** GST reports (GST suite, Step 5; documentation/gst-planning/03). */

export interface GstReportWarning {
  type: 'error' | 'warning' | string;
  msg: string;
}

export interface GstTableTotals {
  count: number;
  taxable: number;
  tax: number;
}

export interface Gstr1Summary {
  b2b: GstTableTotals;
  b2cl: GstTableTotals;
  b2cs: GstTableTotals;
  cdnr: GstTableTotals;
  cdnur: GstTableTotals;
  exp: GstTableTotals;
  nil: GstTableTotals;
  hsn: GstTableTotals;
  at: GstTableTotals;
  txpd: GstTableTotals;
  documents: { total: number; cancelled: number };
  invoices: number;
  creditNotes: number;
}

export interface Gstr1Report {
  period: { mode: 'month' | 'quarter'; from: string; to: string; fp: string; label: string };
  ready: boolean;
  empty: boolean;
  canDownload: boolean;
  blocked: string[];
  warnings: GstReportWarning[];
  summary: Gstr1Summary | null;
  hsnSplit: boolean;
  csvTables: string[];
  filename: string;
}

export interface AdvanceTableItem {
  rt: number;
  ad_amt: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface AdvanceTableRow {
  pos: string;
  sply_ty: 'INTER' | 'INTRA' | string;
  itms: AdvanceTableItem[];
}

export interface AdvanceVoucher {
  receiptNo: string;
  receiptDate: string;
  placeOfSupply: string;
  posCode: string;
  supplyType: string;
  amount: number;
  taxable: number;
  totalTax: number;
  status: string;
  adjustedInvoiceNo: string;
  adjustedOn: string;
}

export interface GstAdvancesReport {
  range: { from: string; to: string };
  at: AdvanceTableRow[];
  txpd: AdvanceTableRow[];
  received: AdvanceVoucher[];
  adjusted: AdvanceVoucher[];
  note: string;
}

export interface GstCreditNoteRow {
  id: string;
  creditNoteNumber: string;
  date: string;
  clientName: string;
  clientGstin: string;
  invoiceNumber: string;
  reason: string;
  status: string;
  placeOfSupply: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  tax: number;
  total: number;
  hasGst: boolean;
  table: string;
}

export interface GstCreditNotesReport {
  range: { from: string; to: string };
  ready: boolean;
  notes: GstCreditNoteRow[];
  totals: { count: number; taxable: number; tax: number; total: number };
}

export interface TcsRegisterRow {
  id: string;
  invoiceNumber: string;
  date: string;
  quarter: string;
  party: string;
  gstin: string;
  pan: string;
  panGiven: boolean;
  section: string;
  rate: number;
  taxable: number;
  base: number;
  cumulativeBefore: number;
  amount: number;
  ruleKey: string;
  rule: string;
}

export interface TcsTotalRow {
  key: string;
  count: number;
  taxable: number;
  amount: number;
}

export interface TcsRegister {
  fy: string;
  quarter: string;
  range: { from: string; to: string };
  rule: string;
  rules: Array<{ key: string; label: string; enabled: boolean; sectionLabel: string }>;
  rows: TcsRegisterRow[];
  totals: { byRate: TcsTotalRow[]; byRule: TcsTotalRow[]; all: { count: number; base: number; amount: number } };
  warnings: string[];
}
