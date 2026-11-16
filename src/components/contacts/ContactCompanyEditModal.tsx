import React, { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';

import { crmApi } from '../../services/api';
import { PersonContact, formatContactName } from '../../types/contacts';
import { useNotifyMessage } from '@/components/notifications';

interface ContactCompanyEditModalProps {
  contact: PersonContact;
  onClose: () => void;
  /** The same contact, saved with its new Company Name. */
  onSaved: (contact: PersonContact) => void;
}

/**
 * Edit Contact from the matched-contact flow: only the Company Name can change; every other field is
 * shown read-only. Saves the existing contact (no new contact). Records created earlier keep their own
 * snapshot of the old Company Name.
 */
export const ContactCompanyEditModal: React.FC<ContactCompanyEditModalProps> = ({
  contact,
  onClose,
  onSaved,
}) => {
  const [companyName, setCompanyName] = useState(String(contact.companyName || '').trim());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useNotifyMessage(error, 'error', () => setError(null));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const original = String(contact.companyName || '').trim();
  const next = companyName.trim();
  const changed = next !== original;

  const save = async () => {
    if (saving) return;
    if (!next) {
      setError('Company Name is required.');
      return;
    }
    if (next.length > 120) {
      setError('Company Name must be at most 120 characters.');
      return;
    }
    if (!changed) {
      onSaved(contact);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Only the Company Name is sent; email / mobile / PAN are unchanged, so the contact's own
      // matches are not a reason to refuse this save.
      const res = await crmApi.updateContact(contact._id, { companyName: next, allowDuplicate: true });
      if (!res.data?._id) throw new Error(res.error || 'Could not save the contact');
      onSaved(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the contact');
      setSaving(false);
    }
  };

  const readOnlyRows: Array<[string, string]> = [
    ['Name', formatContactName(contact) || '—'],
    ['Email', contact.email || '—'],
    ['Mobile', contact.phone || '—'],
    ['Job title', contact.jobTitle || '—'],
    ['PAN', contact.pan || '—'],
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-company-edit-title"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3 id="contact-company-edit-title" className="m-0 text-sm font-bold text-zinc-950">
              Edit Contact
            </h3>
            <p className="m-0 mt-0.5 text-[11px] text-zinc-500">
              Only the Company Name can be changed here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-100"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 text-xs">
          <dl className="m-0 grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5">
            {readOnlyRows.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt className="font-semibold text-zinc-500">{label}</dt>
                <dd className="m-0 truncate text-zinc-900" data-testid={`contact-readonly-${label}`}>
                  {value}
                </dd>
              </React.Fragment>
            ))}
          </dl>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-700">
              Company Name <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={companyName}
              maxLength={120}
              autoFocus
              disabled={saving}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void save();
                }
              }}
              className="h-9 rounded-lg border border-zinc-300 px-3 text-xs text-zinc-950 outline-none focus:border-zinc-950"
            />
          </label>
          <p className="m-0 text-[11px] text-zinc-500">
            Existing leads, quotations, invoices and other records keep the Company Name they were
            created with.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !next}
            className="h-9 cursor-pointer rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
