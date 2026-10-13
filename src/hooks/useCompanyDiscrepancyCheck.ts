import { useCallback, useEffect, useRef, useState } from 'react';
import { crmApi } from '../services/api';
import type { CompanyDiscrepancyDetail, CompanyDiscrepancyResult } from '../types/contacts';

export interface UseCompanyDiscrepancyOptions {
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  entityType?: 'contact' | 'lead';
  excludeId?: string;
  debounceMs?: number;
  enabled?: boolean;
}

export function useCompanyDiscrepancyCheck({
  name = '',
  email = '',
  phone = '',
  companyName = '',
  entityType = 'contact',
  excludeId,
  debounceMs = 500,
  enabled = true,
}: UseCompanyDiscrepancyOptions) {
  const [discrepancy, setDiscrepancy] = useState<CompanyDiscrepancyDetail | null>(null);
  const [checking, setChecking] = useState(false);
  const requestSeq = useRef(0);

  const clear = useCallback(() => {
    requestSeq.current += 1;
    setDiscrepancy(null);
    setChecking(false);
  }, []);

  const checkNow = useCallback(
    async (overrideValues?: {
      name?: string;
      email?: string;
      phone?: string;
      companyName?: string;
    }): Promise<CompanyDiscrepancyResult> => {
      const targetName = (overrideValues?.name ?? name).trim();
      const targetEmail = (overrideValues?.email ?? email).trim().toLowerCase();
      const targetPhone = (overrideValues?.phone ?? phone).trim();
      const targetCompany = (overrideValues?.companyName ?? companyName).trim();

      if (!targetEmail && !targetPhone && targetName.length < 2) {
        clear();
        return { hasDiscrepancy: false, discrepancy: null };
      }

      const seq = ++requestSeq.current;
      setChecking(true);
      try {
        const res = await crmApi.checkCompanyDiscrepancy({
          name: targetName || undefined,
          email: targetEmail || undefined,
          phone: targetPhone || undefined,
          companyName: targetCompany || undefined,
          entityType,
          excludeId,
        });

        if (seq !== requestSeq.current) {
          return { hasDiscrepancy: false, discrepancy: null };
        }

        const data = res.data;
        if (data?.hasDiscrepancy && data.discrepancy) {
          setDiscrepancy(data.discrepancy);
          return data;
        } else {
          setDiscrepancy(null);
          return { hasDiscrepancy: false, discrepancy: null };
        }
      } catch {
        if (seq === requestSeq.current) setDiscrepancy(null);
        return { hasDiscrepancy: false, discrepancy: null };
      } finally {
        if (seq === requestSeq.current) setChecking(false);
      }
    },
    [name, email, phone, companyName, entityType, excludeId, clear]
  );

  useEffect(() => {
    if (!enabled) {
      clear();
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail && !trimmedPhone && trimmedName.length < 2) {
      clear();
      return;
    }

    const timer = window.setTimeout(() => {
      void checkNow();
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [name, email, phone, companyName, enabled, debounceMs, checkNow, clear]);

  return {
    discrepancy,
    hasDiscrepancy: Boolean(discrepancy),
    checking,
    checkNow,
    clear,
  };
}
