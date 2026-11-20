import type { TaxCalculation } from './quotations';

export type FinancePdfDocumentType = 'invoice' | 'quotation';

export interface FinancePdfOcrLineItem {
  name: string;
  description?: string;
  quantity: number;
  price: number;
  /** GST / VAT percent; null = the PDF shows no rate (CRM 3.58.0). */
  tax: number | null;
  amount: number;
  /** Matched catalog product id (filled client-side). */
  catalogProductId?: string;
}

export interface FinancePdfOcrExtractResult {
  documentType: FinancePdfDocumentType;
  documentNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  taxCalculation: TaxCalculation | string;
  paymentDetails: string;
  billingAddress: string;
  shippingAddress: string;
  clientName: string;
  notes: string;
  /** The total printed on the PDF (0 = not shown). */
  grandTotal?: number;
  items: FinancePdfOcrLineItem[];
  model?: string;
  pageCount?: number;
  /** Pages after the first 5 that were not read. */
  skippedPages?: number;
  extractionMode?: string;
}

export const FINANCE_PDF_SCAN_STORAGE_KEY = 'crm_finance_pdf_scan_draft';

export interface FinancePdfScanDraft {
  type: FinancePdfDocumentType;
  extracted: FinancePdfOcrExtractResult;
  savedAt: string;
}
