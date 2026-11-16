import { useEffect, useState } from 'react';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { EXTENSION_SETTINGS_CHANGED } from '../../utils/extensionFieldLogic';

const API_BASE = '/api/plugins/openext-crm-suite';

/** Settings values per extension@version, shared by every form on the page. */
const cache = new Map<string, Promise<Record<string, unknown>>>();

function load(extensionId: string, key: string): Promise<Record<string, unknown>> {
  let pending = cache.get(key);
  if (!pending) {
    pending = fetch(`${API_BASE}/x/${encodeURIComponent(extensionId)}/_settings`, { credentials: 'include' })
      .then((res) => res.json().catch(() => ({})))
      .then((body) => (body && body.success && body.data && typeof body.data === 'object' ? body.data : {}))
      .catch(() => ({}));
    cache.set(key, pending);
  }
  return pending;
}

/**
 * The active uploaded extension's settings values (GET /x/<id>/_settings), used
 * by declared fields whose options come from settings (optionsFrom). Built-in
 * extensions have none. Refreshes when Settings saves new values.
 */
export function useExtensionSettingsValues(enabled = true): Record<string, unknown> | null {
  const { extension } = useActiveExtension();
  const uploaded = extension.source === 'uploaded';
  const key = `${extension.id}@${extension.version || ''}`;
  const [values, setValues] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!enabled || !uploaded) {
      setValues(null);
      return undefined;
    }
    let active = true;
    void load(extension.id, key).then((data) => {
      if (active) setValues(data);
    });
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ extensionId: string; values: Record<string, unknown> }>).detail;
      if (!detail || detail.extensionId !== extension.id) return;
      cache.set(key, Promise.resolve(detail.values || {}));
      if (active) setValues(detail.values || {});
    };
    window.addEventListener(EXTENSION_SETTINGS_CHANGED, onChanged);
    return () => {
      active = false;
      window.removeEventListener(EXTENSION_SETTINGS_CHANGED, onChanged);
    };
  }, [enabled, uploaded, extension.id, key]);

  return values;
}
