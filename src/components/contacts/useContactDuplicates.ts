import { useCallback, useRef, useState } from 'react';

import { crmApi } from '../../services/api';
import { PersonContact } from '../../types/contacts';
import {
  CONTACT_EMAIL_RE,
  CONTACT_PAN_RE,
  CONTACT_PHONE_RE,
  ContactFormValues,
} from './ContactFormFields';

/**
 * Duplicate detection for the contact form (email / mobile / PAN).
 * Call `checkValues` from blur handlers or a debounced effect while typing.
 */
export function useContactDuplicates(excludeId?: string) {
  const [duplicates, setDuplicates] = useState<PersonContact[]>([]);
  const [checking, setChecking] = useState(false);
  const requestSeq = useRef(0);

  const clear = useCallback(() => {
    requestSeq.current += 1;
    setDuplicates([]);
    setChecking(false);
  }, []);

  const checkValues = useCallback(
    async (values: Pick<ContactFormValues, 'email' | 'phone' | 'pan'>) => {
      const email = values.email.trim();
      const phoneDigits = values.phone.replace(/[\s().-]/g, '');
      const digitsOnly = phoneDigits.replace(/\D/g, '');
      const pan = values.pan.trim().toUpperCase();

      // Accept well-formed values, or a 10+ digit mobile (common while typing Indian numbers).
      const phoneForQuery =
        (phoneDigits && CONTACT_PHONE_RE.test(phoneDigits) && phoneDigits) ||
        (digitsOnly.length >= 10 ? digitsOnly.slice(-10) : undefined);

      const query = {
        email: email && CONTACT_EMAIL_RE.test(email) ? email : undefined,
        phone: phoneForQuery || undefined,
        pan: pan && CONTACT_PAN_RE.test(pan) ? pan : undefined,
        excludeId,
      };

      const seq = ++requestSeq.current;
      if (!query.email && !query.phone && !query.pan) {
        setDuplicates([]);
        setChecking(false);
        return [] as PersonContact[];
      }

      setChecking(true);
      try {
        const res = await crmApi.checkContactDuplicates(query);
        if (seq !== requestSeq.current) return [] as PersonContact[];
        const found = Array.isArray(res.data?.duplicates) ? res.data.duplicates : [];
        setDuplicates(found);
        return found;
      } catch {
        // Duplicate lookup is advisory — the create call enforces it server-side.
        if (seq === requestSeq.current) setDuplicates([]);
        return [] as PersonContact[];
      } finally {
        if (seq === requestSeq.current) setChecking(false);
      }
    },
    [excludeId]
  );

  return { duplicates, setDuplicates, checking, checkValues, clear };
}
