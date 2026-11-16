import { useEffect, useState } from 'react';
import { crmApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { SalesFlowConfig } from '../types/leads';

/**
 * What the active extension offers on the sales pages (GET /sales-flow), shared by every page.
 * One request per minute at most; an older backend without the endpoint means "nothing offered".
 */
const TTL_MS = 60_000;
let cached: { at: number; owner: string; value: SalesFlowConfig } | null = null;
let pending: { owner: string; promise: Promise<SalesFlowConfig> } | null = null;

function load(owner: string): Promise<SalesFlowConfig> {
  if (cached && cached.owner === owner && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.value);
  if (!pending || pending.owner !== owner) {
    const promise = crmApi
      .getSalesFlowConfig()
      .then((res) => {
        const value = res.data || { available: false };
        cached = { at: Date.now(), owner, value };
        return value;
      })
      // A failed request is not remembered: the next page asks again.
      .catch(() => ({ available: false }) as SalesFlowConfig)
      .finally(() => {
        if (pending && pending.promise === promise) pending = null;
      });
    pending = { owner, promise };
  }
  return pending.promise;
}

/** Forget the cached answer (e.g. after the active extension changes). */
export function resetSalesFlowConfig() {
  cached = null;
}

export function useSalesFlowConfig(): SalesFlowConfig {
  const { user } = useAuth();
  const owner = String((user as { id?: string; _id?: string; userId?: string } | null)?.id || (user as { _id?: string } | null)?._id || (user as { userId?: string } | null)?.userId || '');
  const [config, setConfig] = useState<SalesFlowConfig>(cached && cached.owner === owner ? cached.value : { available: false });
  useEffect(() => {
    let active = true;
    void load(owner).then((value) => {
      if (active) setConfig(value);
    });
    return () => {
      active = false;
    };
  }, [owner]);
  return config;
}
