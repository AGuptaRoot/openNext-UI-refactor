import React from 'react';

import {
  CONTACT_GENDERS,
  CONTACT_SALUTATIONS,
  PersonContact,
  PersonContactInput,
} from '../../types/contacts';
import { DocumentUploadControl, IMAGE_ACCEPT } from '../common/DocumentUploadControl';

export const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CONTACT_PHONE_RE = /^\+?\d{7,15}$/;
export const CONTACT_PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;

export interface ContactFormValues {
  salutation: string;
  name: string;
  photoUrl: string;
  email: string;
  phone: string;
  gender: string;
  pan: string;
  companyName: string;
  jobTitle: string;
}

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  salutation: '',
  name: '',
  photoUrl: '',
  email: '',
  phone: '',
  gender: '',
  pan: '',
  companyName: '',
  jobTitle: '',
};

export type ContactDuplicateField = 'email' | 'phone' | 'pan';

export function contactToFormValues(contact?: PersonContact | null): ContactFormValues {
  if (!contact) return { ...EMPTY_CONTACT_FORM };
  return {
    salutation: contact.salutation || '',
    name: contact.name || '',
    photoUrl: contact.photoUrl || '',
    email: contact.email || '',
    phone: contact.phone || '',
    gender: contact.gender || '',
    pan: contact.pan || '',
    companyName: contact.companyName || '',
    jobTitle: contact.jobTitle || '',
  };
}

/** Trim + normalise form values into an API payload. */
export function contactFormToInput(values: ContactFormValues): PersonContactInput {
  return {
    salutation: values.salutation,
    name: values.name.trim(),
    photoUrl: values.photoUrl.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    gender: values.gender,
    pan: values.pan.trim().toUpperCase(),
    companyName: values.companyName.trim(),
    jobTitle: values.jobTitle.trim(),
  };
}

/**
 * Client-side validation mirroring the server rules.
 * Returns the first error message, or null when valid.
 * `requireReachability` makes email + mobile mandatory (needed when the contact feeds a lead).
 */
export function validateContactForm(
  values: ContactFormValues,
  options: { requireReachability?: boolean } = {}
): string | null {
  if (!values.name.trim()) return 'Contact name is required.';
  if (values.name.trim().length > 120) return 'Contact name must be 120 characters or fewer.';
  if (!values.companyName.trim()) return 'Company name is required.';
  if (values.companyName.trim().length > 160) return 'Company name must be 160 characters or fewer.';
  const email = values.email.trim();
  const phoneDigits = values.phone.replace(/[\s().-]/g, '');
  if (options.requireReachability) {
    if (!email) return 'Email address is required.';
    if (!phoneDigits) return 'Mobile number is required.';
  }
  if (email && !CONTACT_EMAIL_RE.test(email)) return 'Enter a valid email address.';
  if (phoneDigits && !CONTACT_PHONE_RE.test(phoneDigits)) {
    return 'Enter a valid mobile number (7–15 digits; country code allowed).';
  }
  if (values.pan.trim() && !CONTACT_PAN_RE.test(values.pan.trim().toUpperCase())) {
    return 'PAN must match format AAAAA9999A.';
  }
  return null;
}

interface ContactFormFieldsProps {
  values: ContactFormValues;
  onChange: (patch: Partial<ContactFormValues>) => void;
  /**
   * Fired when email / mobile / PAN lose focus (for duplicate detection).
   * Receives the latest form values (including the blurred input) so parents
   * are not stuck with a stale React state closure.
   */
  onFieldBlur?: (values: ContactFormValues, field: ContactDuplicateField) => void;
  disabled?: boolean;
  /** Marks email + mobile as required in the UI. */
  requireReachability?: boolean;
  onUploadError?: (message: string) => void;
  /** When set, adds data-tour="<prefix>-<field>" attributes (guided tours). */
  tourPrefix?: string;
}

const inputClass =
  'w-full border border-zinc-300 rounded-lg p-2 bg-white text-zinc-900 outline-none focus:border-zinc-950 disabled:bg-zinc-50 disabled:text-zinc-500';
const labelClass = 'block font-semibold text-zinc-600 mb-1';

/**
 * Reusable PersonContact form body: Photo, Salutation, Contact name, Email,
 * Mobile, Gender, PAN, Job Title. Used by Contacts pages and Lead create.
 */
export const ContactFormFields: React.FC<ContactFormFieldsProps> = ({
  values,
  onChange,
  onFieldBlur,
  disabled = false,
  requireReachability = false,
  onUploadError,
  tourPrefix,
}) => {
  const tour = (field: string) => (tourPrefix ? { 'data-tour': `${tourPrefix}-${field}` } : {});
  return (
    <div className="flex flex-col gap-4 text-xs">
      <div {...tour('photo')} className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-2xl font-bold text-zinc-400 overflow-hidden shrink-0">
          {values.photoUrl ? (
            <img src={values.photoUrl} alt="Contact" className="w-full h-full object-cover" />
          ) : (
            '👤'
          )}
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className={labelClass}>Photo</span>
          <DocumentUploadControl
            folder="contacts"
            mode="auto"
            accept={IMAGE_ACCEPT}
            buttonLabel="Choose photo"
            hint="JPG, PNG, WEBP or GIF — uploads as soon as you choose it"
            disabled={disabled}
            currentUrl={values.photoUrl || null}
            onUploaded={(result) => onChange({ photoUrl: result.url || result.fileUrl })}
            onError={onUploadError}
          />
          {values.photoUrl && !disabled ? (
            <button
              type="button"
              onClick={() => onChange({ photoUrl: '' })}
              className="w-fit text-[11px] font-semibold text-red-600 hover:underline bg-transparent border-none cursor-pointer p-0"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
        <div {...tour('salutation')} className="sm:col-span-3">
          <label className={labelClass}>Salutation</label>
          <select
            value={values.salutation}
            disabled={disabled}
            onChange={(e) => onChange({ salutation: e.target.value })}
            className={inputClass}
          >
            {CONTACT_SALUTATIONS.map((s) => (
              <option key={s} value={s}>
                {s || '—'}
              </option>
            ))}
          </select>
        </div>

        <div {...tour('contact-name')} className="sm:col-span-6">
          <label className={labelClass}>Contact name *</label>
          <input
            type="text"
            maxLength={120}
            value={values.name}
            disabled={disabled}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Adarsh Gupta"
            className={inputClass}
          />
        </div>

        <div {...tour('gender')} className="sm:col-span-3">
          <label className={labelClass}>Gender</label>
          <select
            value={values.gender}
            disabled={disabled}
            onChange={(e) => onChange({ gender: e.target.value })}
            className={inputClass}
          >
            {CONTACT_GENDERS.map((g) => (
              <option key={g} value={g}>
                {g || '—'}
              </option>
            ))}
          </select>
        </div>

        <div {...tour('email')} className="sm:col-span-6">
          <label className={labelClass}>Email{requireReachability ? ' *' : ''}</label>
          <input
            type="email"
            maxLength={120}
            value={values.email}
            disabled={disabled}
            onChange={(e) => onChange({ email: e.target.value })}
            onBlur={(e) =>
              onFieldBlur?.({ ...values, email: e.currentTarget.value }, 'email')
            }
            placeholder="name@company.com"
            className={inputClass}
          />
        </div>

        <div {...tour('phone')} className="sm:col-span-6">
          <label className={labelClass}>Mobile{requireReachability ? ' *' : ''}</label>
          <input
            type="tel"
            maxLength={24}
            value={values.phone}
            disabled={disabled}
            onChange={(e) => onChange({ phone: e.target.value })}
            onBlur={(e) =>
              onFieldBlur?.({ ...values, phone: e.currentTarget.value }, 'phone')
            }
            placeholder="+91 98765 43210"
            className={inputClass}
          />
        </div>

        <div {...tour('pan')} className="sm:col-span-6">
          <label className={labelClass}>PAN (optional)</label>
          <input
            type="text"
            maxLength={10}
            value={values.pan}
            disabled={disabled}
            onChange={(e) => onChange({ pan: e.target.value.toUpperCase() })}
            onBlur={(e) =>
              onFieldBlur?.(
                { ...values, pan: e.currentTarget.value.toUpperCase() },
                'pan'
              )
            }
            placeholder="ABCDE1234F"
            className={`${inputClass} uppercase font-mono`}
          />
        </div>

        <div {...tour('company')} className="sm:col-span-6">
          <label className={labelClass}>Company name *</label>
          <input
            type="text"
            required
            maxLength={160}
            value={values.companyName}
            disabled={disabled}
            onChange={(e) => onChange({ companyName: e.target.value })}
            placeholder="e.g. Acme Corporation"
            className={inputClass}
          />
        </div>

        <div {...tour('job')} className="sm:col-span-6">
          <label className={labelClass}>Job title</label>
          <input
            type="text"
            maxLength={120}
            value={values.jobTitle}
            disabled={disabled}
            onChange={(e) => onChange({ jobTitle: e.target.value })}
            placeholder="e.g. Procurement Head"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
};
