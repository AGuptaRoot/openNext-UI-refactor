import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { crmApi } from '../services/api';
import { useAuth } from './AuthContext';
import {
  CRM_SETTINGS_CURRENCY_CHANGED,
  FALLBACK_DEFAULT_CURRENCY,
  formatCrmMoney,
  getCurrencyMeta,
  getCurrencyName,
  getCurrencySymbol,
  getRuntimeDefaultCurrency,
  normalizeCurrencyCode,
  setRuntimeDefaultCurrency,
} from '../utils/currency';

export type CurrencyContextValue = {
  /** ISO code from CRM settings (e.g. USD). */
  defaultCurrencyCode: string;
  defaultCurrencySymbol: string;
  defaultCurrencyName: string;
  ready: boolean;
  refresh: () => Promise<void>;
  setDefaultCurrency: (code: string) => void;
  formatMoney: (
    amount: number | undefined | null,
    currency?: string | null,
    options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
  ) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function applyCode(code: string) {
  const normalized = setRuntimeDefaultCurrency(code);
  const meta = getCurrencyMeta(normalized);
  return meta;
}

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [defaultCurrencyCode, setCode] = useState(() =>
    normalizeCurrencyCode(getCurrencyMeta(FALLBACK_DEFAULT_CURRENCY).code)
  );
  const [ready, setReady] = useState(false);

  const apply = useCallback((raw?: string | null) => {
    const meta = applyCode(raw || FALLBACK_DEFAULT_CURRENCY);
    setCode(meta.code);
    return meta.code;
  }, []);

  // Only admins may read the settings (GET /settings is crm.settings.manage); everyone else — staff
  // roles and client portal logins — takes the currency from their login context, so no 403 is raised.
  const { user, hasPermission, loading: authLoading } = useAuth();
  const canReadSettings = Boolean(user) && hasPermission('crm.settings.manage');
  const contextCurrency = user?.features?.defaultCurrency || null;

  const refresh = useCallback(async () => {
    if (!canReadSettings) {
      if (contextCurrency) apply(contextCurrency);
      setReady(true);
      return;
    }
    try {
      const response = await crmApi.getSettings();
      apply(response.data?.default_currency);
    } catch {
      // Keep last known / fallback; do not force INR over a saved value in memory.
    } finally {
      setReady(true);
    }
  }, [apply, canReadSettings, contextCurrency]);

  const setDefaultCurrency = useCallback(
    (code: string) => {
      apply(code);
    },
    [apply]
  );

  useEffect(() => {
    if (authLoading) return undefined;
    void refresh();

    const onCurrencyChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ default_currency?: string }>).detail;
      if (detail?.default_currency) {
        apply(detail.default_currency);
        return;
      }
      void refresh();
    };

    window.addEventListener(CRM_SETTINGS_CURRENCY_CHANGED, onCurrencyChanged);
    return () => {
      window.removeEventListener(CRM_SETTINGS_CURRENCY_CHANGED, onCurrencyChanged);
    };
  }, [apply, refresh, authLoading]);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      defaultCurrencyCode,
      defaultCurrencySymbol: getCurrencySymbol(defaultCurrencyCode),
      defaultCurrencyName: getCurrencyName(defaultCurrencyCode),
      ready,
      refresh,
      setDefaultCurrency,
      formatMoney: formatCrmMoney,
    }),
    [defaultCurrencyCode, ready, refresh, setDefaultCurrency]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    const code = getRuntimeDefaultCurrency();
    return {
      defaultCurrencyCode: code,
      defaultCurrencySymbol: getCurrencySymbol(code),
      defaultCurrencyName: getCurrencyName(code),
      ready: false,
      refresh: async () => undefined,
      setDefaultCurrency: () => undefined,
      formatMoney: formatCrmMoney,
    };
  }
  return ctx;
}
