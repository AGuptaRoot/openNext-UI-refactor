/**
 * Country dial codes for the mobile-number inputs.
 *
 * Deliberately dependency-free: `min`/`max` are national (subscriber) digit
 * counts, excluding the dial code, and stay deliberately loose where a country
 * mixes mobile and landline lengths.
 */
export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 — used as the <option> key, dial codes are not unique. */
  iso: string;
  name: string;
  /** Dial code digits, no leading "+". */
  dial: string;
  min: number;
  max: number;
}

/** Fallback bounds for a dial code we do not have specific rules for. */
export const GENERIC_NATIONAL_MIN = 4;
export const GENERIC_NATIONAL_MAX = 14;

/** E.164 caps the dial code + national number at 15 digits. */
export const E164_MAX_DIGITS = 15;

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso: 'IN', name: 'India', dial: '91', min: 10, max: 10 },
  { iso: 'US', name: 'United States', dial: '1', min: 10, max: 10 },
  { iso: 'CA', name: 'Canada', dial: '1', min: 10, max: 10 },
  { iso: 'GB', name: 'United Kingdom', dial: '44', min: 9, max: 10 },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', min: 9, max: 9 },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', min: 9, max: 9 },
  { iso: 'QA', name: 'Qatar', dial: '974', min: 8, max: 8 },
  { iso: 'KW', name: 'Kuwait', dial: '965', min: 8, max: 8 },
  { iso: 'BH', name: 'Bahrain', dial: '973', min: 8, max: 8 },
  { iso: 'OM', name: 'Oman', dial: '968', min: 8, max: 8 },
  { iso: 'SG', name: 'Singapore', dial: '65', min: 8, max: 8 },
  { iso: 'MY', name: 'Malaysia', dial: '60', min: 9, max: 10 },
  { iso: 'ID', name: 'Indonesia', dial: '62', min: 9, max: 12 },
  { iso: 'TH', name: 'Thailand', dial: '66', min: 9, max: 9 },
  { iso: 'VN', name: 'Vietnam', dial: '84', min: 9, max: 10 },
  { iso: 'PH', name: 'Philippines', dial: '63', min: 10, max: 10 },
  { iso: 'CN', name: 'China', dial: '86', min: 11, max: 11 },
  { iso: 'HK', name: 'Hong Kong', dial: '852', min: 8, max: 8 },
  { iso: 'JP', name: 'Japan', dial: '81', min: 9, max: 10 },
  { iso: 'KR', name: 'South Korea', dial: '82', min: 9, max: 10 },
  { iso: 'TW', name: 'Taiwan', dial: '886', min: 9, max: 9 },
  { iso: 'AU', name: 'Australia', dial: '61', min: 9, max: 9 },
  { iso: 'NZ', name: 'New Zealand', dial: '64', min: 8, max: 10 },
  { iso: 'BD', name: 'Bangladesh', dial: '880', min: 10, max: 10 },
  { iso: 'PK', name: 'Pakistan', dial: '92', min: 10, max: 10 },
  { iso: 'LK', name: 'Sri Lanka', dial: '94', min: 9, max: 9 },
  { iso: 'NP', name: 'Nepal', dial: '977', min: 9, max: 10 },
  { iso: 'DE', name: 'Germany', dial: '49', min: 6, max: 11 },
  { iso: 'FR', name: 'France', dial: '33', min: 9, max: 9 },
  { iso: 'IT', name: 'Italy', dial: '39', min: 9, max: 10 },
  { iso: 'ES', name: 'Spain', dial: '34', min: 9, max: 9 },
  { iso: 'PT', name: 'Portugal', dial: '351', min: 9, max: 9 },
  { iso: 'NL', name: 'Netherlands', dial: '31', min: 9, max: 9 },
  { iso: 'BE', name: 'Belgium', dial: '32', min: 8, max: 9 },
  { iso: 'CH', name: 'Switzerland', dial: '41', min: 9, max: 9 },
  { iso: 'AT', name: 'Austria', dial: '43', min: 10, max: 13 },
  { iso: 'SE', name: 'Sweden', dial: '46', min: 7, max: 9 },
  { iso: 'NO', name: 'Norway', dial: '47', min: 8, max: 8 },
  { iso: 'DK', name: 'Denmark', dial: '45', min: 8, max: 8 },
  { iso: 'FI', name: 'Finland', dial: '358', min: 6, max: 10 },
  { iso: 'IE', name: 'Ireland', dial: '353', min: 7, max: 9 },
  { iso: 'PL', name: 'Poland', dial: '48', min: 9, max: 9 },
  { iso: 'CZ', name: 'Czechia', dial: '420', min: 9, max: 9 },
  { iso: 'GR', name: 'Greece', dial: '30', min: 10, max: 10 },
  { iso: 'TR', name: 'Turkiye', dial: '90', min: 10, max: 10 },
  { iso: 'RU', name: 'Russia', dial: '7', min: 10, max: 10 },
  { iso: 'UA', name: 'Ukraine', dial: '380', min: 9, max: 9 },
  { iso: 'IL', name: 'Israel', dial: '972', min: 8, max: 9 },
  { iso: 'EG', name: 'Egypt', dial: '20', min: 9, max: 10 },
  { iso: 'ZA', name: 'South Africa', dial: '27', min: 9, max: 9 },
  { iso: 'NG', name: 'Nigeria', dial: '234', min: 10, max: 10 },
  { iso: 'KE', name: 'Kenya', dial: '254', min: 9, max: 9 },
  { iso: 'TZ', name: 'Tanzania', dial: '255', min: 9, max: 9 },
  { iso: 'GH', name: 'Ghana', dial: '233', min: 9, max: 9 },
  { iso: 'MA', name: 'Morocco', dial: '212', min: 9, max: 9 },
  { iso: 'BR', name: 'Brazil', dial: '55', min: 10, max: 11 },
  { iso: 'MX', name: 'Mexico', dial: '52', min: 10, max: 10 },
  { iso: 'AR', name: 'Argentina', dial: '54', min: 10, max: 11 },
  { iso: 'CL', name: 'Chile', dial: '56', min: 9, max: 9 },
  { iso: 'CO', name: 'Colombia', dial: '57', min: 10, max: 10 },
  { iso: 'PE', name: 'Peru', dial: '51', min: 9, max: 9 },
];

/** Dial code pre-selected for a blank form. */
export const DEFAULT_DIAL_CODE = '91';

export interface DialOption {
  dial: string;
  /** e.g. "+1 US/CA" — one entry per dial code, so the <select> never snaps. */
  label: string;
  /** e.g. "United States / Canada" — for the option title. */
  title: string;
}

/**
 * One option per dial code. Several countries share a code (+1 is US and CA),
 * and the stored value only carries the dial code, so collapsing them keeps
 * the selected option stable after a re-render.
 */
export const DIAL_OPTIONS: readonly DialOption[] = (() => {
  const byDial = new Map<string, string[]>();
  for (const country of PHONE_COUNTRIES) {
    const list = byDial.get(country.dial);
    if (list) list.push(country.iso);
    else byDial.set(country.dial, [country.iso]);
  }
  return Array.from(byDial.entries()).map(([dial, isos]) => ({
    dial,
    label: `+${dial} ${isos.join('/')}`,
    title: isos
      .map((iso) => PHONE_COUNTRIES.find((c) => c.iso === iso)?.name || iso)
      .join(' / '),
  }));
})();

/** Longest dial code first, so a short code never shadows a longer one. */
const DIALS_BY_LENGTH = Array.from(new Set(PHONE_COUNTRIES.map((c) => c.dial))).sort(
  (a, b) => b.length - a.length
);

export function onlyDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** Rules for a dial code — the first country that declares it wins. */
export function countryForDial(dial: string): PhoneCountry | null {
  const d = onlyDigits(dial);
  return PHONE_COUNTRIES.find((c) => c.dial === d) || null;
}

export interface SplitPhone {
  /** Dial code digits (no "+"); empty when the stored value carries no country. */
  dial: string;
  /** Subscriber digits after the dial code. */
  national: string;
}

/**
 * Split a stored phone into dial code + national number.
 *
 * Only a value written in international form ("+" or "00" prefixed) is treated
 * as carrying a country code — a bare local number keeps its digits intact so
 * editing an unrelated field never silently rewrites legacy data.
 */
export function splitPhoneNumber(phone: string | null | undefined): SplitPhone {
  const raw = String(phone ?? '').trim();
  const digits = onlyDigits(raw);
  if (!digits) return { dial: '', national: '' };
  if (!raw.startsWith('+') && !raw.startsWith('00')) {
    return { dial: '', national: digits };
  }
  const body = raw.startsWith('00') ? digits.replace(/^00/, '') : digits;
  for (const dial of DIALS_BY_LENGTH) {
    if (body.length > dial.length && body.startsWith(dial)) {
      return { dial, national: body.slice(dial.length) };
    }
  }
  return { dial: '', national: body };
}

/**
 * Compose the value stored on the record: compact E.164 ("+919876543210").
 * Returns "" for an empty national number so clearing the field really clears
 * it instead of leaving a bare dial code behind.
 */
export function composePhoneNumber(dial: string, national: string): string {
  const nat = onlyDigits(national);
  if (!nat) return '';
  const d = onlyDigits(dial);
  if (!d) return nat;
  return `+${d}${nat}`.slice(0, E164_MAX_DIGITS + 1);
}

/** Digits still allowed in the national part for this dial code. */
export function maxNationalDigits(dial: string): number {
  const d = onlyDigits(dial);
  const country = countryForDial(d);
  const budget = E164_MAX_DIGITS - d.length;
  return Math.max(1, Math.min(country ? country.max : GENERIC_NATIONAL_MAX, budget));
}

export interface PhoneValidation {
  state: 'empty' | 'incomplete' | 'invalid' | 'valid';
  message: string;
}

/**
 * Live validation for the national number as it is typed.
 * `incomplete` is the "keep going" state — too short, but not yet wrong.
 */
export function validateNationalNumber(dial: string, national: string): PhoneValidation {
  const nat = onlyDigits(national);
  if (!nat) return { state: 'empty', message: '' };

  const d = onlyDigits(dial);
  const country = countryForDial(d);
  const min = country ? country.min : GENERIC_NATIONAL_MIN;
  const max = maxNationalDigits(d);
  const label = country ? country.name : 'this country code';

  if (nat.length > max) {
    return {
      state: 'invalid',
      message: `Too long — ${label} numbers are at most ${max} digits.`,
    };
  }
  if (nat.length < min) {
    const left = min - nat.length;
    return {
      state: 'incomplete',
      message:
        min === max
          ? `${left} more digit${left === 1 ? '' : 's'} — ${label} numbers are ${min} digits.`
          : `At least ${min} digits needed for ${label}.`,
    };
  }
  if (d && d.length + nat.length > E164_MAX_DIGITS) {
    return { state: 'invalid', message: `A phone number cannot exceed ${E164_MAX_DIGITS} digits.` };
  }
  return { state: 'valid', message: 'Looks good.' };
}
