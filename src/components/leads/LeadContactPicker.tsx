import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { crmApi } from '../../services/api';
import { formatContactName, type PersonContact } from '../../types/contacts';

/**
 * Lead → Contact & Company (CRM 3.55.0). The lead's contact details are not edited here: they come from
 * the lead's contact (Contacts module). The user can open that contact, or choose another one by
 * searching, as on the Create Lead form. Choosing saves at once; the server copies the contact's details
 * onto the lead and moves the lead to that contact.
 */

interface Props {
  leadId: string;
  contactId?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  pan?: string;
  /** CRM 3.57.0: a person / family lead — "Family / person name" instead of the company. */
  personLead?: boolean;
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
}

const field = 'w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none';

const Row: React.FC<{ label: string; value?: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <div className="block text-xs font-medium text-zinc-500 mb-1">{label}</div>
    <div className={`rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
  </div>
);

export const LeadContactPicker: React.FC<Props> = ({ leadId, contactId, name, email, phone, company, pan, personLead = false,
  canEdit, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonContact[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<PersonContact | null>(null);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  // Search contacts (debounced; an older answer never replaces a newer one).
  useEffect(() => {
    if (!open || picked) return;
    const mine = ++seq.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const res = await crmApi.listContacts({ search: query.trim() || undefined, limit: 10 });
        if (mine !== seq.current) return;
        setResults((Array.isArray(res.data) ? res.data : []).filter((c) => String(c._id) !== String(contactId || '')));
      } catch (err) {
        if (mine !== seq.current) return;
        setResults([]);
        setError(err instanceof Error ? err.message : 'Could not search contacts');
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, open, picked, contactId]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setPicked(null);
    setError('');
  };

  const apply = async () => {
    if (!picked) return;
    setSaving(true);
    setError('');
    try {
      await crmApi.updateLead(leadId, { contactId: String(picked._id) });
      close();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="md:col-span-2 flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Row label="Contact" value={name} />
        <Row label="Email" value={email} />
        <Row label="Mobile number" value={phone} />
        <Row label={personLead ? 'Family / person name' : 'Company name'} value={company} />
        <Row label="PAN number" value={pan} mono />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span>These details come from the lead's contact. Change them on the contact, or choose another contact.</span>
        {contactId ? (
          <Link to={`/contacts/${contactId}`} className="font-semibold text-zinc-700 no-underline hover:text-zinc-950">Open contact</Link>
        ) : null}
        {canEdit && !open ? (
          <button type="button" onClick={() => setOpen(true)}
            className="cursor-pointer rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50">
            {contactId ? 'Choose another contact' : 'Choose a contact'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="rounded-lg border border-zinc-300 bg-white p-3">
          {!picked ? (
            <>
              <input className={field} autoFocus placeholder="Search contacts by name, email or mobile…" value={query}
                onChange={(e) => setQuery(e.target.value)} />
              <div className="mt-2 max-h-56 overflow-y-auto">
                {searching ? <p className="m-0 p-2 text-xs text-zinc-500">Searching…</p> : null}
                {!searching && !results.length ? <p className="m-0 p-2 text-xs text-zinc-500">No contacts found.</p> : null}
                {results.map((c) => (
                  <button key={c._id} type="button" onClick={() => setPicked(c)}
                    className="block w-full cursor-pointer border-0 border-b border-zinc-100 bg-white px-2 py-2 text-left hover:bg-zinc-50">
                    <span className="block text-xs font-semibold text-zinc-900">{formatContactName(c) || c.name}</span>
                    <span className="block text-[11px] text-zinc-500">{[c.email, c.phone, c.companyName].filter(Boolean).join(' · ') || '—'}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs">
              <p className="m-0 mb-2 text-zinc-800">
                Use <b>{formatContactName(picked) || picked.name}</b> ({[picked.email, picked.phone].filter(Boolean).join(' · ') || 'no email / mobile'}) as this lead's contact?
                Its email, mobile, company and PAN replace the lead's.
              </p>
              {!picked.email || !picked.phone ? (
                <p className="m-0 mb-2 font-semibold text-amber-700">This contact has no email or mobile number. Add them on the contact first.</p>
              ) : null}
              <div className="flex gap-2">
                <button type="button" disabled={saving || !picked.email || !picked.phone} onClick={() => void apply()}
                  className="cursor-pointer rounded border-0 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  {saving ? 'Saving…' : 'Use this contact'}
                </button>
                <button type="button" disabled={saving} onClick={() => setPicked(null)}
                  className="cursor-pointer rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">Back</button>
              </div>
            </div>
          )}
          {error ? <p className="m-0 mt-2 text-xs font-semibold text-red-600" role="alert">{error}</p> : null}
          <div className="mt-2 text-right">
            <button type="button" onClick={close} disabled={saving}
              className="cursor-pointer border-0 bg-transparent text-[11px] font-semibold text-zinc-600">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LeadContactPicker;
