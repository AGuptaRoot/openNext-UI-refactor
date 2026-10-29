import React, { useMemo } from 'react';

import {
  DEFAULT_DIAL_CODE,
  DIAL_OPTIONS,
  composePhoneNumber,
  maxNationalDigits,
  onlyDigits,
  splitPhoneNumber,
  validateNationalNumber,
} from '../../utils/phoneCountryCodes';

export interface PhoneNumberFieldProps {
  /** Stored phone value, e.g. "+919876543210". */
  value: string;
  /** Receives the recomposed stored value (compact E.164, or "" when cleared). */
  onChange: (phone: string) => void;
  onBlur?: (phone: string) => void;
  disabled?: boolean;
  inputClassName?: string;
  placeholder?: string;
  /** Hides the inline live-validation hint when false. */
  showHint?: boolean;
  id?: string;
  name?: string;
}

const HINT_TONE: Record<string, string> = {
  invalid: 'text-red-600',
  incomplete: 'text-amber-600',
  valid: 'text-emerald-600',
  empty: 'text-zinc-500',
};

/**
 * Drop utility classes we override locally. Tailwind classes of equal
 * specificity resolve by stylesheet order, not by order in the attribute, so
 * the conflicting ones have to be removed rather than appended past.
 */
function stripClasses(className: string, patterns: readonly RegExp[]): string {
  return className
    .split(/\s+/)
    .filter((token) => token && !patterns.some((re) => re.test(token)))
    .join(' ');
}

const WIDTH_CLASS = /^w-/;
const BORDER_COLOR_CLASS = /^(focus:)?border-(zinc|red|amber|emerald|slate|gray|neutral)-\d+$/;

/**
 * Country dial code + national number, stored as one compact E.164 string.
 *
 * The split is derived from `value` rather than held in state, so the field has
 * no second source of truth and a legacy local number is only rewritten into
 * international form once the user actually touches the control.
 */
export const PhoneNumberField: React.FC<PhoneNumberFieldProps> = ({
  value,
  onChange,
  onBlur,
  disabled = false,
  inputClassName = '',
  placeholder = '98765 43210',
  showHint = true,
  id,
  name,
}) => {
  const { dial, national } = useMemo(() => splitPhoneNumber(value), [value]);
  // A value without a country code still shows a selected dial code, but that
  // code is not written back until the user edits one of the two controls.
  const activeDial = dial || DEFAULT_DIAL_CODE;
  const validation = useMemo(
    () => validateNationalNumber(activeDial, national),
    [activeDial, national]
  );
  const maxDigits = maxNationalDigits(activeDial);

  const emit = (nextDial: string, nextNational: string) => {
    onChange(composePhoneNumber(nextDial, nextNational));
  };

  const handleNationalChange = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
      const split = splitPhoneNumber(trimmed);
      if (split.dial) {
        emit(split.dial, split.national.slice(0, maxNationalDigits(split.dial)));
        return;
      }
    }
    const digits = onlyDigits(raw).slice(0, maxDigits);
    emit(activeDial, digits);
  };

  const hintTone = HINT_TONE[validation.state] || 'text-zinc-500';
  const borderTone =
    validation.state === 'invalid'
      ? 'border-red-400 focus:border-red-500'
      : 'border-zinc-300 focus:border-zinc-950';
  const selectClass = stripClasses(inputClassName, [WIDTH_CLASS]);
  const numberClass = stripClasses(inputClassName, [WIDTH_CLASS, BORDER_COLOR_CLASS]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-2">
        <select
          aria-label="Country dial code"
          value={activeDial}
          disabled={disabled}
          onChange={(e) => emit(e.target.value, national)}
          className={`${selectClass} w-[7.5rem] shrink-0 font-mono`}
        >
          {DIAL_OPTIONS.map((option) => (
            <option key={option.dial} value={option.dial} title={option.title}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={maxDigits}
          value={national}
          disabled={disabled}
          onChange={(e) => handleNationalChange(e.target.value)}
          onBlur={() => onBlur?.(composePhoneNumber(activeDial, national))}
          placeholder={placeholder}
          aria-invalid={validation.state === 'invalid'}
          className={`${numberClass} min-w-0 flex-1 ${borderTone}`}
        />
      </div>
      {showHint && validation.message ? (
        <span className={`text-[11px] ${hintTone}`}>{validation.message}</span>
      ) : null}
    </div>
  );
};
