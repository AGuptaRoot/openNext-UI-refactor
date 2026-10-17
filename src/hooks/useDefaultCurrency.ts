import { useCurrency } from '../context/CurrencyContext';
import {
  FALLBACK_DEFAULT_CURRENCY,
  normalizeCurrencyCode,
  getRuntimeDefaultCurrency,
} from '../utils/currency';

export {
  FALLBACK_DEFAULT_CURRENCY,
  CRM_SETTINGS_CURRENCY_CHANGED,
  normalizeCurrencyCode,
} from '../utils/currency';

/**
 * Returns Settings → General → Default Currency (`default_currency`).
 * Backed by CurrencyContext (single source of truth loaded once at app root).
 */
export function useDefaultCurrency(fallback: string = FALLBACK_DEFAULT_CURRENCY): string {
  const { defaultCurrencyCode, ready } = useCurrency();
  if (ready && defaultCurrencyCode) {
    return normalizeCurrencyCode(defaultCurrencyCode, fallback);
  }
  // Before settings load, prefer any runtime value already applied (e.g. from a prior save event).
  return normalizeCurrencyCode(getRuntimeDefaultCurrency(), fallback);
}
