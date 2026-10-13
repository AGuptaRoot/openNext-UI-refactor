import React, { useEffect, useMemo, useRef, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

import { crmApi } from '../../services/api';
import { PersonContact, formatContactName } from '../../types/contacts';
import type { ClientContact } from '../../types/clients';

const SEARCH_LIMIT = 20;

interface ContactSelectProps {
  value: PersonContact | null;
  onChange: (contact: PersonContact | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Optional hint under the search input. */
  hint?: string;
  /** When set, only contacts linked to this lead are listed. */
  leadId?: string;
  /** When set, only contacts linked to this client (and its converted leads) are listed. */
  clientId?: string;
  /**
   * When true, a lead or client must be selected before contacts can be picked.
   * Unrelated directory contacts are never shown once a scope is active.
   */
  requireRelatedScope?: boolean;
}

function mapClientContact(contact: ClientContact): PersonContact {
  return {
    _id: String(contact._id),
    name: String(contact.name || '').trim() || 'Contact',
    email: contact.email || '',
    phone: contact.phone || '',
    jobTitle: contact.designation || '',
    leadIds: [],
  };
}

function contactKey(contact: PersonContact): string {
  const email = String(contact.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = String(contact.phone || '').replace(/\D/g, '');
  if (phone) return `phone:${phone.slice(-10)}`;
  return `id:${contact._id}`;
}

/**
 * Searchable PersonContact picker (Contacts module directory).
 * Used on Opportunity create and anywhere a CRM contact must be selected.
 */
export const ContactSelect: React.FC<ContactSelectProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Search by name, email or mobile…',
  className = '',
  hint = 'Pick a contact from the Contacts directory.',
  leadId = '',
  clientId = '',
  requireRelatedScope = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonContact[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);

  const scopedLeadId = String(leadId || '').trim();
  const scopedClientId = String(clientId || '').trim();
  const hasScope = Boolean(scopedLeadId || scopedClientId);
  const blocked = requireRelatedScope && !hasScope;
  const inputDisabled = disabled || blocked;

  const scopeHint = useMemo(() => {
    if (blocked) {
      return 'Select a client or lead first — only related contacts can be chosen.';
    }
    if (hasScope) {
      if (scopedLeadId && scopedClientId) {
        return 'Showing contacts related to the selected lead and client only.';
      }
      if (scopedLeadId) {
        return 'Showing contacts related to the selected lead only.';
      }
      return 'Showing contacts related to the selected client only.';
    }
    return hint;
  }, [blocked, hasScope, scopedLeadId, scopedClientId, hint]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open || value || inputDisabled) return;
    const seq = ++searchSeq.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const q = query.trim();
        const personRes = await crmApi.listContacts({
          search: q || undefined,
          limit: SEARCH_LIMIT,
          leadId: scopedLeadId || undefined,
          clientId: scopedClientId || undefined,
        });
        let merged: PersonContact[] = Array.isArray(personRes.data) ? [...personRes.data] : [];

        // Client company contacts (separate collection) for client-scoped picks.
        if (scopedClientId) {
          try {
            const clientRes = await crmApi.getClientContacts(scopedClientId);
            const clientContacts = (Array.isArray(clientRes.data) ? clientRes.data : [])
              .map(mapClientContact)
              .filter((c) => {
                if (!q) return true;
                const hay = [c.name, c.email, c.phone, c.jobTitle]
                  .join(' ')
                  .toLowerCase();
                return hay.includes(q.toLowerCase());
              });
            const seen = new Set(merged.map(contactKey));
            for (const c of clientContacts) {
              const key = contactKey(c);
              if (seen.has(key)) continue;
              seen.add(key);
              merged.push(c);
            }
          } catch {
            /* person contacts alone are fine */
          }
        }

        if (seq !== searchSeq.current) return;
        setResults(merged.slice(0, SEARCH_LIMIT));
      } catch (err: unknown) {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setSearchError(err instanceof Error ? err.message : 'Failed to search contacts');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, open, value, inputDisabled, scopedLeadId, scopedClientId]);

  if (value) {
    return (
      <div className={`flex items-center justify-between gap-3 border border-zinc-300 bg-zinc-50 rounded-lg p-3 text-xs ${className}`.trim()}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold overflow-hidden shrink-0">
            {value.photoUrl ? (
              <img src={value.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (value.name.charAt(0) || 'C').toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <span className="block font-semibold text-zinc-950 truncate">
              {formatContactName(value)}
            </span>
            <span className="block text-[11px] text-zinc-500 truncate">
              {[value.jobTitle, value.email, value.phone].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
        </div>
        {!disabled ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery('');
              setOpen(false);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 bg-white border border-zinc-300 px-2.5 py-1 rounded cursor-pointer shrink-0"
          >
            <CloseIcon sx={{ fontSize: 13 }} />
            Change
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative text-xs ${className}`.trim()}>
      <label className="block text-xs font-semibold text-zinc-700 mb-1">
        Select from Contacts
      </label>
      <div className="relative">
        <SearchIcon
          sx={{ fontSize: 16 }}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          disabled={inputDisabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (!inputDisabled) setOpen(true);
          }}
          placeholder={
            blocked
              ? 'Select a lead or client first…'
              : placeholder
          }
          autoComplete="off"
          className="w-full border border-zinc-300 rounded-lg p-2 pl-8 bg-white text-zinc-900 outline-none focus:border-zinc-950 disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </div>
      {open && !inputDisabled && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-zinc-300 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {searching ? (
            <p className="m-0 p-3 text-zinc-500">Searching contacts…</p>
          ) : searchError ? (
            <p className="m-0 p-3 text-red-600">{searchError}</p>
          ) : results.length === 0 ? (
            <p className="m-0 p-3 text-zinc-500">
              {query.trim()
                ? 'No related contacts match your search.'
                : hasScope
                  ? 'No contacts linked to this lead/client yet.'
                  : 'No contacts yet. Add one under Contacts.'}
            </p>
          ) : (
            <ul className="list-none m-0 p-0 divide-y divide-zinc-100">
              {results.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setQuery('');
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 bg-white hover:bg-zinc-50 border-none cursor-pointer flex items-center gap-2.5"
                  >
                    <span className="w-7 h-7 rounded-md bg-zinc-950 text-white flex items-center justify-center text-[11px] font-bold overflow-hidden shrink-0">
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (c.name.charAt(0) || 'C').toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-zinc-950 truncate">
                        {formatContactName(c)}
                      </span>
                      <span className="block text-[11px] text-zinc-500 truncate">
                        {[c.jobTitle, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {scopeHint ? <p className="text-[11px] text-zinc-500 mt-1.5 mb-0">{scopeHint}</p> : null}
    </div>
  );
};
