import type { RequestType } from '../types/request-types';

/**
 * True when the Request Type is Product (system key, name, field signature, or
 * commercial kind). Used to show "Lead needs sample request" on Commercial tab.
 */
export function isProductRequestType(
  rt?: RequestType | null,
  fallback?: { key?: string | null; name?: string | null; kind?: string | null }
): boolean {
  const key = String(rt?.key || fallback?.key || '')
    .trim()
    .toLowerCase();
  const name = String(rt?.name || fallback?.name || '')
    .trim()
    .toLowerCase();
  const kind = String(fallback?.kind || '')
    .trim()
    .toLowerCase();

  if (kind === 'product') return true;
  if (key === 'product' || key.startsWith('product_') || key.endsWith('_product')) return true;
  if (name === 'product') return true;
  if (name.includes('product') && !name.includes('project')) return true;

  const fields = Array.isArray(rt?.fields) ? rt!.fields : [];
  if (
    fields.some((f) => {
      const fk = String(f?.key || '')
        .trim()
        .toLowerCase();
      return (
        fk === 'product_name' ||
        fk === 'product' ||
        fk.startsWith('product_') ||
        fk === 'specification' ||
        fk === 'certifications' ||
        fk === 'target_price' ||
        fk === 'quantity'
      );
    })
  ) {
    if (key === 'project' || name === 'project' || name.includes('project')) return false;
    return true;
  }

  return false;
}
