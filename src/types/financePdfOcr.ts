import type { TaxCalculation } from './quotations';

export type FinancePdfDocumentType = 'invoice' | 'quotation';

export interface FinancePdfOcrLineItem {
  name: string;
  description?: string;
  quantity: number;
  price: number;
  tax: number;
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
  items: FinancePdfOcrLineItem[];
  model?: string;
  pageCount?: number;
  extractionMode?: string;
}

export const FINANCE_PDF_SCAN_STORAGE_KEY = 'crm_finance_pdf_scan_draft';

export interface FinancePdfScanDraft {
  type: FinancePdfDocumentType;
  extracted: FinancePdfOcrExtractResult;
  savedAt: string;
}
