/**
 * Central CRM currency configuration.
 * Runtime default is set by CurrencyContext from Settings → default_currency.
 * INR is only the seed fallback when no setting exists yet.
 */

export const FALLBACK_DEFAULT_CURRENCY = 'INR';

/** Dispatched after Settings save so CurrencyContext + listeners refresh. */
export const CRM_SETTINGS_CURRENCY_CHANGED = 'crm-settings-currency-changed';

export type CurrencyMeta = {
  code: string;
  symbol: string;
  name: string;
};

export const CURRENCY_CATALOG: readonly CurrencyMeta[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
] as const;

const CATALOG_BY_CODE = Object.fromEntries(
  CURRENCY_CATALOG.map((item) => [item.code, item])
) as Record<string, CurrencyMeta>;

let runtimeDefaultCurrency = FALLBACK_DEFAULT_CURRENCY;

export function normalizeCurrencyCode(
  value?: string | null,
  fallback: string = FALLBACK_DEFAULT_CURRENCY
): string {
  const code = String(value || '')
    .trim()
    .toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  const fb = String(fallback || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(fb) ? fb : FALLBACK_DEFAULT_CURRENCY;
}

/** Update the process-wide default (called after settings load/save). */
export function setRuntimeDefaultCurrency(code?: string | null): string {
  runtimeDefaultCurrency = normalizeCurrencyCode(code, FALLBACK_DEFAULT_CURRENCY);
  return runtimeDefaultCurrency;
}

export function getRuntimeDefaultCurrency(): string {
  return runtimeDefaultCurrency;
}

export function getCurrencyMeta(code?: string | null): CurrencyMeta {
  const normalized = normalizeCurrencyCode(code, getRuntimeDefaultCurrency());
  const known = CATALOG_BY_CODE[normalized];
  if (known) return known;
  return { code: normalized, symbol: normalized, name: normalized };
}

export function getCurrencySymbol(code?: string | null): string {
  return getCurrencyMeta(code).symbol;
}

export function getCurrencyName(code?: string | null): string {
  return getCurrencyMeta(code).name;
}

export function getDefaultCurrencyCode(): string {
  return getRuntimeDefaultCurrency();
}

export function getDefaultCurrencySymbol(): string {
  return getCurrencySymbol(getRuntimeDefaultCurrency());
}

export function getDefaultCurrencyName(): string {
  return getCurrencyName(getRuntimeDefaultCurrency());
}

/**
 * Format a monetary amount.
 * Uses the record currency when provided; otherwise the CRM default from settings.
 * Does not convert amounts between currencies.
 */
export function formatCrmMoney(
  amount: number | undefined | null,
  currency?: string | null,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  const value = Number(amount || 0);
  const code = normalizeCurrencyCode(currency, getRuntimeDefaultCurrency());
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const minimumFractionDigits = options?.minimumFractionDigits ?? 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits,
      minimumFractionDigits,
    }).format(value);
  } catch {
    return `${getCurrencySymbol(code)}${value.toLocaleString(undefined, {
      maximumFractionDigits,
      minimumFractionDigits,
    })}`;
  }
}
