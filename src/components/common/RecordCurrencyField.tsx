import React from 'react';
import { CURRENCY_OPTIONS, FormField, financeFieldClass } from '../finance/FinanceFormElements';
import { CURRENCY_CATALOG, getCurrencyMeta, normalizeCurrencyCode } from '../../utils/currency';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

export type RecordCurrencyFieldProps = {
  currency: string;
  onCurrencyChange: (code: string) => void;
  exchangeRate?: number;
  onExchangeRateChange?: (rate: number) => void;
  /** Currency from parent/source document (quotation, opportunity, invoice, …). */
  sourceCurrency?: string | null;
  sourceLabel?: string;
  /** Show exchange rate when currency ≠ global default or ≠ source. */
  requireExchangeRateWhenDifferent?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Per-record currency picker.
 * Defaults come from Settings → default_currency for NEW records only.
 * When linked to a source document, inherit that currency; changing away shows a warning
 * and requires exchange rate when base-currency reporting is needed.
 */
export const RecordCurrencyField: React.FC<RecordCurrencyFieldProps> = ({
  currency,
  onCurrencyChange,
  exchangeRate = 1,
  onExchangeRateChange,
  sourceCurrency,
  sourceLabel = 'source document',
  requireExchangeRateWhenDifferent = true,
  disabled,
  className,
}) => {
  const settingsCurrency = useDefaultCurrency();
  const code = normalizeCurrencyCode(currency, settingsCurrency);
  const source = sourceCurrency
    ? normalizeCurrencyCode(sourceCurrency, settingsCurrency)
    : '';
  const differsFromSource = Boolean(source && code !== source);
  const differsFromDefault = code !== normalizeCurrencyCode(settingsCurrency);
  const showExchangeRate =
    Boolean(onExchangeRateChange) &&
    requireExchangeRateWhenDifferent &&
    (differsFromSource || differsFromDefault);

  const options = Array.from(
    new Set([
      ...CURRENCY_OPTIONS,
      ...CURRENCY_CATALOG.map((c) => c.code),
      code,
      settingsCurrency,
      ...(source ? [source] : []),
    ])
  );

  return (
    <div className={className || 'contents'}>
      <FormField label="Currency" required>
        <select
          className={financeFieldClass}
          value={code}
          disabled={disabled}
          onChange={(e) => onCurrencyChange(normalizeCurrencyCode(e.target.value, settingsCurrency))}
        >
          {options.map((item) => {
            const meta = getCurrencyMeta(item);
            return (
              <option key={item} value={item}>
                {meta.code} ({meta.symbol}) — {meta.name}
              </option>
            );
          })}
        </select>
      </FormField>

      {showExchangeRate && (
        <FormField label="Exchange rate" required>
          <input
            className={financeFieldClass}
            type="number"
            min="0.0001"
            step="0.0001"
            value={exchangeRate}
            disabled={disabled}
            onChange={(e) => onExchangeRateChange?.(Number(e.target.value))}
          />
        </FormField>
      )}

      {differsFromSource && (
        <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Currency differs from {sourceLabel} ({source} → {code}). Confirm the change and set a
          valid exchange rate for base-currency reporting. Existing source documents are not
          rewritten.
        </div>
      )}
    </div>
  );
};

export function currenciesDiffer(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeCurrencyCode(a) !== normalizeCurrencyCode(b);
}
