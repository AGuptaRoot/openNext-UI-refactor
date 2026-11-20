import { useCallback, useRef, useState } from 'react';
import { crmApi } from '../services/api';
import type { ClientCompanyMatch } from '../types/clients';

/**
 * CRM 3.48.0 — the ONE "Existing Client Found" flow, shared by Lead create, Client create (Primary Contact
 * Person) and Contact create. It asks the server (POST /clients/company-match) for Clients the company or
 * the contact already belongs to; nothing is linked until the user picks "Add as Secondary Contact".
 *
 *   const match = useExistingClientMatch<'submit'>();
 *   if (await match.ask({ company, personContactId, email, phone }, 'submit')) return;  // modal shown
 *   … "Continue Creating …" → const resume = match.continueAnyway(); then run that step again
 *
 * A lookup the user already answered "Continue" for is not asked again. A failed lookup never blocks the form.
 */
export interface ExistingClientLookup {
  company: string;
  personContactId?: string;
  email?: string;
  phone?: string;
  /** CRM 3.57.1: person / family lead — only person / family clients of this person. */
  personOnly?: boolean;
}

const lookupKey = (l: ExistingClientLookup) =>
  [
    l.personOnly ? 'person' : 'any',
    String(l.company || '').trim().toLowerCase().replace(/\s+/g, ' '),
    String(l.personContactId || ''),
    String(l.email || '').trim().toLowerCase(),
    String(l.phone || '').replace(/\D/g, '').slice(-10),
  ].join('|');

export function useExistingClientMatch<R extends string = string>() {
  const [state, setState] = useState<{ matches: ClientCompanyMatch[]; selectedId: string; resume: R; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answered = useRef('');

  /** Shows the modal when a Client matches; true = wait for the user's answer. */
  const ask = useCallback(async (lookup: ExistingClientLookup, resume: R): Promise<boolean> => {
    const key = lookupKey(lookup);
    const hasContact = Boolean(lookup.personContactId || String(lookup.email || '').trim() || String(lookup.phone || '').trim());
    if (String(lookup.company || '').trim().length < 2 && !hasContact) return false;
    if (answered.current === key) return false;
    try {
      const res = await crmApi.findExistingClients(lookup);
      const matches = Array.isArray(res.data) ? res.data : [];
      if (!matches.length) return false;
      setError(null);
      setState({ matches, selectedId: (matches.find((m) => m.canAddContact) || matches[0]).id, resume, key });
      return true;
    } catch {
      return false;
    }
  }, []);

  /** "Continue Creating …": remembered for this lookup; returns the step to run again. */
  const continueAnyway = useCallback((): R | null => {
    if (!state) return null;
    answered.current = state.key;
    setState(null);
    return state.resume;
  }, [state]);

  const close = useCallback(() => setState(null), []);
  const select = useCallback((id: string) => setState((prev) => (prev ? { ...prev, selectedId: id } : prev)), []);
  const selected = state ? state.matches.find((m) => m.id === state.selectedId) || null : null;

  return {
    open: Boolean(state),
    matches: state?.matches || [],
    selectedId: state?.selectedId || '',
    selected,
    resume: state?.resume || null,
    ask,
    continueAnyway,
    close,
    select,
    busy,
    setBusy,
    error,
    setError,
  };
}
