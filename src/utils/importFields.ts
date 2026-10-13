/**
 * Case/spacing-insensitive field lookup for CSV/TSV import rows.
 * "Company name", "Company Name", "company_name" all resolve the same.
 */

export function normalizeImportHeaderKey(key: string): string {
  return String(key || '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function pickImportField(
  row: Record<string, unknown> | null | undefined,
  aliases: string[]
): string {
  if (!row || typeof row !== 'object') return '';
  const wanted = new Set(aliases.map(normalizeImportHeaderKey));
  for (const [key, value] of Object.entries(row)) {
    if (!wanted.has(normalizeImportHeaderKey(key))) continue;
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  // Return first matching key even if empty (so callers can detect "present but blank")
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeImportHeaderKey(key))) {
      return String(value ?? '').trim();
    }
  }
  return '';
}

export const LEAD_IMPORT_ALIASES = {
  name: ['name', 'full name', 'lead name', 'contact name', 'person name'],
  company: ['company', 'company name', 'organization', 'organisation', 'account', 'account name'],
  email: ['email', 'email address', 'e-mail', 'mail'],
  phone: ['phone', 'mobile', 'phone number', 'mobile number', 'contact', 'contact number', 'cell'],
  stage: ['stage', 'pipeline stage', 'lead stage', 'status stage'],
  source: ['source', 'lead source', 'origin'],
  status: ['status', 'lead status'],
  value: ['value', 'budget', 'amount', 'budget / value', 'budget value', 'deal value', 'estimated value'],
  jobTitle: ['job title', 'title', 'designation', 'role'],
  city: ['city'],
  state: ['state'],
  country: ['country'],
  address: ['address', 'street'],
  pan: ['pan', 'pan number', 'tax id', 'gstin'],
  notes: ['notes', 'description', 'remark', 'comments'],
  tags: ['tags', 'labels'],
} as const;

export const CLIENT_IMPORT_ALIASES = {
  name: ['name', 'company', 'company name', 'organization', 'organisation', 'client name', 'account name'],
  email: ['email', 'company email', 'email address', 'e-mail'],
  phone: ['phone', 'company phone', 'mobile', 'phone number', 'contact'],
  website: ['website', 'url', 'web'],
  taxId: ['tax id', 'gstin', 'vat', 'tax number', 'pan'],
  category: ['category', 'client category'],
  status: ['status', 'client status'],
  street: ['street', 'address', 'billing street'],
  city: ['city', 'billing city'],
  state: ['state', 'billing state'],
  country: ['country', 'billing country'],
  zip: ['zip', 'postal', 'postal code', 'billing zip', 'billing postal'],
  contactName: ['contact name', 'primary contact', 'contact person'],
  contactEmail: ['contact email'],
  contactPhone: ['contact phone', 'contact mobile'],
  contactDesignation: ['contact designation', 'designation', 'title'],
  tags: ['tags', 'labels'],
} as const;
