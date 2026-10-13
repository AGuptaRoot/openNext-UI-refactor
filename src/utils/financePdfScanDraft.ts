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
  const exact = catalog.find((p) => p.name.trim().toLowerCase() === needle);
  if (exact) return exact;
  const partial = catalog.find(
    (p) =>
      p.name.trim().toLowerCase().includes(needle) ||
      needle.includes(p.name.trim().toLowerCase())
  );
  return partial || null;
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
    const tax =
      Number(item.tax) > 0
        ? Number(item.tax)
        : matched
          ? Number(matched.taxRate) || 0
          : 18;
    return {
      ...newEditableLine(),
      name: matched?.name || item.name || '',
      description: item.description || matched?.description || '',
      qty,
      rate,
      tax,
    };
  });
}
