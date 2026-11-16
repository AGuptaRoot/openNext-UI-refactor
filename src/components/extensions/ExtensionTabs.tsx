import { useEffect, useMemo, useState } from 'react';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import type { ExtensionTabPage, ExtensionTabDef } from '../../types/extensions';

const PLUGIN_API = '/api/plugins/openext-crm-suite';

/**
 * Counts for tabs that declare a countRoute (CRM 3.33.0), keyed by tab id, e.g. { travellers: 3 }.
 * A tab whose count cannot be loaded simply shows no number.
 */
export function useExtensionTabCounts(tabs: ExtensionTabDef[], recordId: string | undefined): Record<string, number> {
  const { backend } = useActiveExtension();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const apiBase = backend?.apiBase || '';
  const key = tabs.filter((t) => t.countRoute).map((t) => `${t.id}:${t.countRoute}`).join('|');
  useEffect(() => {
    if (!recordId || !apiBase || !key) {
      setCounts({});
      return undefined;
    }
    let alive = true;
    const base = `${PLUGIN_API}${apiBase.startsWith('/') ? apiBase : `/${apiBase}`}`;
    Promise.all(
      tabs
        .filter((t) => t.countRoute)
        .map(async (t) => {
          const path = String(t.countRoute).replace(/:[a-z][a-z0-9_]*/i, encodeURIComponent(recordId));
          try {
            const res = await fetch(`${base}${path}`, { credentials: 'include', headers: { Accept: 'application/json' } });
            const json = await res.json().catch(() => ({}));
            const n = Number(json && json.data ? json.data.count : json && json.count);
            return res.ok && Number.isFinite(n) ? ([t.id, n] as const) : null;
          } catch {
            return null;
          }
        })
    ).then((pairs) => {
      if (alive) setCounts(Object.fromEntries(pairs.filter((p): p is readonly [string, number] => Boolean(p))));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, apiBase, key]);
  return counts;
}

/**
 * Returns the declared tabs for a detail page sorted by `order`,
 * filtered by the active user's permissions via `canUse(tab.permission)`.
 */
export function useExtensionTabs(page: ExtensionTabPage): ExtensionTabDef[] {
  const { declarations, canUse } = useActiveExtension();

  return useMemo(() => {
    const list = declarations.tabs?.[page] || [];
    return [...list]
      .filter((tab) => canUse(tab.permission))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [declarations.tabs, page, canUse]);
}
