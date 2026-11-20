import {
  FINANCE_PDF_SCAN_STORAGE_KEY,
  type FinancePdfDocumentType,
  type FinancePdfOcrExtractResult,
  type FinancePdfScanDraft,
} from '../types/financePdfOcr';
import type { EditableLine } from '../components/finance/FinanceFormElements';
import { newEditableLine } from '../components/finance/FinanceFormElements';
import type { TaxCalculation } from '../types/quotations';

export function saveFinancePdfScanDraft(
  type: FinancePdfDocumentType,
  extracted: FinancePdfOcrExtractResult
): void {
  const draft: FinancePdfScanDraft = {
    type,
    extracted,
    savedAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(FINANCE_PDF_SCAN_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota
  }
}

export function consumeFinancePdfScanDraft(
  expectedType: FinancePdfDocumentType
): FinancePdfOcrExtractResult | null {
  try {
    const raw = sessionStorage.getItem(FINANCE_PDF_SCAN_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FINANCE_PDF_SCAN_STORAGE_KEY);
    const draft = JSON.parse(raw) as FinancePdfScanDraft;
    if (!draft || draft.type !== expectedType || !draft.extracted) return null;
    return draft.extracted;
  } catch {
    return null;
  }
}

export function normalizeTaxCalculationValue(raw: unknown): TaxCalculation {
  const s = String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (s.includes('before')) return 'before_discount';
  return 'after_discount';
}

type CatalogProduct = {
  _id: string;
  name: string;
  description?: string;
  unitPrice: number;
  taxRate: number;
};

function matchCatalogProduct(
  name: string,
  catalog: CatalogProduct[]
): CatalogProduct | null {
  const needle = name.trim().toLowerCase();
  if (!needle || !catalog.length) return null;
  // CRM 3.58.0: exact name only — a loose match replaced details such as "DEL–BOM 6E-213" with "Flight".
  return catalog.find((p) => p.name.trim().toLowerCase() === needle) || null;
}

/** CRM 3.58.0: the scanned name picks a client / lead only when it is exactly the same name. */
export function sameScannedName(scanned: string, ...names: Array<string | undefined>): boolean {
  const clean = (v: string | undefined) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const needle = clean(scanned);
  return Boolean(needle) && names.some((n) => clean(n) === needle);
}

/** CRM 3.58.0: the PDF's printed total against the scanned lines (null = nothing to compare). */
export function scannedTotalGap(extracted: FinancePdfOcrExtractResult): { pdfTotal: number; linesTotal: number } | null {
  const pdfTotal = Number(extracted.grandTotal) || 0;
  const items = Array.isArray(extracted.items) ? extracted.items : [];
  if (pdfTotal <= 0 || !items.length) return null;
  const linesTotal = Math.round(items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) * 100) / 100;
  return Math.abs(linesTotal - pdfTotal) > 1 ? { pdfTotal, linesTotal } : null;
}

/**
 * Map AI items → editable lines, matching catalog products by name when possible.
 */
export function linesFromPdfExtract(
  extracted: FinancePdfOcrExtractResult,
  catalog: CatalogProduct[] = []
): EditableLine[] {
  const items = Array.isArray(extracted.items) ? extracted.items : [];
  if (!items.length) return [newEditableLine()];

  return items.map((item) => {
    const matched = matchCatalogProduct(item.name || '', catalog);
    const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    const rate =
      Number(item.price) > 0
        ? Number(item.price)
        : matched
          ? Number(matched.unitPrice) || 0
          : 0;
    // CRM 3.58.0: the PDF's own rate (0% stays 0%); no rate on the PDF → the catalog rate, else 0 (never a guessed 18%).
    const tax =
      item.tax !== null && item.tax !== undefined && Number.isFinite(Number(item.tax))
        ? Number(item.tax)
        : matched
          ? Number(matched.taxRate) || 0
          : 0;
    return {
      ...newEditableLine(),
      name: item.name || matched?.name || '',
      description: item.description || matched?.description || '',
      qty,
      rate,
      tax,
    };
  });
}
