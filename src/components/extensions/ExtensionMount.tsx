import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as ReactDOMClient from 'react-dom/client';
import { createPortal } from 'react-dom';
import { ExtensionCreateFields } from './ExtensionCreateFields';
import { invalidFieldValue, missingRequiredFields } from '../../utils/extensionFieldLogic';
import type { ExtensionFieldGroup, ExtensionRecordType } from '../../types/extensions';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { extensionDataApi } from '../../services/extensionDataApi';
import {
  EXTENSION_SETTINGS_CHANGED,
  EXTENSION_VALUES_CHANGED,
  emitSettingsChanged,
  emitValuesChanged,
} from '../../utils/extensionFieldLogic';
import { notify } from '@/components/notifications';

const PLUGIN_ID = 'openext-crm-suite';
const API_BASE = `/api/plugins/${PLUGIN_ID}`;

export interface ExtensionMountRecord {
  type: 'lead' | 'client' | 'opportunity' | 'ticket' | 'contact' | 'quotation' | 'invoice';
  id: string;
  data: unknown;
}

export interface ExtensionMountProps {
  slot: string;
  record?: ExtensionMountRecord | null;
  className?: string;
  /** CRM 3.34.0: the record is locked (e.g. a Won lead): ctx.can() answers false for write-like rights. */
  readOnly?: boolean;
}

/** Rights that change data: refused inside a read-only (locked) record view. */
const WRITE_RIGHT_RE = /\.(write|delete|issue|convert|manage)$/;

export interface ExtensionMountContext {
  slot: string;
  extensionId: string;
  extensionVersion: string;
  record: ExtensionMountRecord | null;
  user: {
    id: string;
    name: string;
    email: string;
    permissions: string[];
  };
  theme: 'dark' | 'light';
  settings: Record<string, unknown>;
  api: {
    get: <T = unknown>(path: string) => Promise<T>;
    post: <T = unknown>(path: string, body?: unknown) => Promise<T>;
    put: <T = unknown>(path: string, body?: unknown) => Promise<T>;
    patch: <T = unknown>(path: string, body?: unknown) => Promise<T>;
    del: <T = unknown>(path: string) => Promise<T>;
  };
  navigate: (path: string) => void;
  toast: (message: string, kind?: 'success' | 'error' | 'info' | 'warning') => void;
  assetUrl: (path: string) => string;
  libs: {
    React: typeof React;
    ReactDOMClient: typeof ReactDOMClient;
  };
  /** Permission check that understands extension keys (x.<id>.*). */
  can: (permission: string) => boolean;
  /** Save some of the extension's own settings (json/settings.json keys). Admins only; resolves to all values. */
  saveSettings: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Declared field values of the record this tab is mounted on (null outside record tabs). */
  values: {
    get: () => Promise<Record<string, unknown>>;
    set: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>;
  } | null;
  /** Called when the record's declared values are saved elsewhere on the page. Returns an unsubscribe function. */
  onValuesChanged: (callback: (values: Record<string, unknown>) => void) => () => void;
  /** Called when the extension's settings are saved. Returns an unsubscribe function. */
  onSettingsChanged: (callback: (values: Record<string, unknown>) => void) => () => void;
  /**
   * Tell the page that the extension changed something that affects the record it is mounted on
   * (e.g. the CRM moved the lead to Qualified). The page reloads the record. Window event:
   * `crm-record-changed` with detail { type, id }.
   */
  recordChanged: () => void;
  /** Called when the CRM switches between light and dark. Returns an unsubscribe function. */
  onThemeChange: (callback: (theme: 'dark' | 'light') => void) => () => void;
  /**
   * CRM 3.34.0: the CRM's own declared-fields form (the one Lead Create uses: options from settings,
   * formulas, date rules, required marks) inside an element of the extension's view. The extension keeps
   * the values; nothing is saved by the form.
   */
  fieldsForm?: (element: HTMLElement, options: FieldsFormOptions) => FieldsFormHandle;
  /** The page URL's query parameters (e.g. { id } on an extension page). */
  query: Record<string, string>;
  /** Called when the query parameters change (e.g. after ctx.navigate to the same page). Returns an unsubscribe function. */
  onQueryChange: (callback: (query: Record<string, string>) => void) => () => void;
}

export interface FieldsFormOptions {
  record: ExtensionRecordType;
  requestTypeKey?: string;
  /** Only these field groups (json/fields.json ids). */
  groupIds?: string[];
  values?: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
}

export interface FieldsFormHandle {
  getValues: () => Record<string, unknown>;
  /** The first problem the server would refuse (required, options, numbers, dates), or null. */
  validate: () => string | null;
  destroy: () => void;
}

interface FieldsFormEntry {
  id: number;
  element: HTMLElement;
  options: FieldsFormOptions;
  store: { values: Record<string, unknown> };
}

/** One ctx.fieldsForm: rendered through a portal so the CRM's providers (auth, dialogs, router) apply. */
const FieldsFormHost: React.FC<{ entry: FieldsFormEntry }> = ({ entry }) => {
  const [values, setValues] = useState<Record<string, unknown>>(entry.store.values);
  return (
    <ExtensionCreateFields
      record={entry.options.record}
      requestTypeKey={entry.options.requestTypeKey}
      groupIds={entry.options.groupIds}
      values={values}
      onChange={(next) => {
        entry.store.values = next;
        setValues(next);
        if (typeof entry.options.onChange === 'function') {
          try {
            entry.options.onChange({ ...next });
          } catch {
            /* the extension's callback never breaks the form */
          }
        }
      }}
    />
  );
};

const EXTENSION_QUERY_CHANGED = 'crm-extension-query-changed';

function readTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    document.querySelector('[data-theme="dark"]') !== null
    ? 'dark'
    : 'light';
}

function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(search || '').forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Global module cache keyed by `${extension.id}@${extension.version}` */
const moduleCache = new Map<string, Promise<any>>();

/** Stylesheet ref count tracker to safely add and remove CSS links without breaking concurrent mounts */
const styleRefCount = new Map<string, number>();

function validateApiPath(path: string): void {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error('API path must start with "/"');
  }
  if (path.includes('//')) {
    throw new Error('API path cannot contain "//"');
  }
  if (path.includes('..')) {
    throw new Error('API path cannot contain ".."');
  }
  if (/^https?:\/\//i.test(path)) {
    throw new Error('Absolute URLs are not allowed in extension API calls');
  }
}

export const ExtensionMount: React.FC<ExtensionMountProps> = ({
  slot,
  record = null,
  className = '',
  readOnly = false,
}) => {
  const { extension, ui, backend, canUse } = useActiveExtension();
  const canUseRef = useRef(canUse);
  canUseRef.current = canUse;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const { declarations: fieldDeclarations } = useActiveExtension();
  const declarationsRef = useRef(fieldDeclarations);
  declarationsRef.current = fieldDeclarations;
  const [fieldForms, setFieldForms] = useState<FieldsFormEntry[]>([]);
  const fieldFormSeq = useRef(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationSearchRef = useRef(location.search);
  locationSearchRef.current = location.search;
  // Tell mounted extensions when the query changes (ctx.onQueryChange); skip the first render.
  const firstSearchRef = useRef(true);
  useEffect(() => {
    if (firstSearchRef.current) {
      firstSearchRef.current = false;
      return;
    }
    window.dispatchEvent(new CustomEvent(EXTENSION_QUERY_CHANGED, { detail: location.search }));
  }, [location.search]);
  const dialog = useDialog();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedModuleRef = useRef<{ unmount?: (el: HTMLElement) => void } | null>(null);

  /*
   * Callers pass `record` as a fresh object literal on every render, and the
   * auth/dialog/router values are not guaranteed stable. Keep the latest
   * values in refs and re-mount only when the record identity (type + id),
   * the slot, the extension version or the UI/backend info change; otherwise
   * every parent re-render would unmount and reload the extension UI.
   */
  const recordRef = useRef(record);
  recordRef.current = record;
  const userRef = useRef(user);
  userRef.current = user;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const recordKey = record ? `${record.type}:${record.id}` : '';
  const uiKey = ui ? `${ui.assetBase}|${ui.entry}|${ui.styles}` : '';
  const backendKey = backend ? backend.apiBase : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    // Bust cache on explicit retry to allow hot recovery
    const key = `${extension.id}@${extension.version || '1.0.0'}`;
    moduleCache.delete(key);
    setRetryNonce((n) => n + 1);
  }, [extension.id, extension.version]);

  const extensionKey = useMemo(
    () => `${extension.id}@${extension.version || '1.0.0'}`,
    [extension.id, extension.version]
  );

  useEffect(() => {
    let isCancelled = false;
    /** Event subscriptions made by the extension through ctx.on*Changed, removed on unmount. */
    const listeners: Array<() => void> = [];
    let timerId: number | null = null;
    const currentContainer = containerRef.current;

    if (!ui || !ui.entry) {
      setLoading(false);
      setError(`Extension "${extension.name}" does not provide a UI bundle.`);
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Manage stylesheet injection with ref count
    const cleanAssetBase = ui.assetBase?.startsWith('/') ? ui.assetBase : `/${ui.assetBase || ''}`;
    const styleKey = extensionKey;

    if (ui.styles) {
      const currentCount = styleRefCount.get(styleKey) || 0;
      styleRefCount.set(styleKey, currentCount + 1);

      let existingLink = document.head.querySelector<HTMLLinkElement>(
        `link[data-extension-style="${styleKey}"]`
      );

      if (!existingLink) {
        const cleanStylePath = ui.styles.replace(/^\/+/, '');
        const styleUrl = `${API_BASE}${cleanAssetBase}/${cleanStylePath}`;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = styleUrl;
        link.setAttribute('data-extension-style', styleKey);
        document.head.appendChild(link);
      }
    }

    // Clean up older extension styles that have 0 refs
    document.head.querySelectorAll<HTMLLinkElement>('link[data-extension-style]').forEach((l) => {
      const key = l.getAttribute('data-extension-style');
      if (key && key !== styleKey && (!styleRefCount.get(key) || (styleRefCount.get(key) || 0) <= 0)) {
        l.remove();
      }
    });

    // 2. Build Scoped API & Helpers
    const scopedBase = backend?.apiBase
      ? `${API_BASE}${backend.apiBase.startsWith('/') ? backend.apiBase : `/${backend.apiBase}`}`
      : null;

    const makeApiRequest = async <T = unknown>(
      method: string,
      path: string,
      body?: unknown
    ): Promise<T> => {
      if (!scopedBase) {
        throw new Error('This extension has no backend');
      }
      validateApiPath(path);

      const url = `${scopedBase}${path}`;
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = json.error || json.message || `Request failed with status ${response.status}`;
        const err = new Error(message) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      if (json && typeof json === 'object' && json.success === true && json.data !== undefined) {
        return json.data as T;
      }
      if (json && typeof json === 'object' && json.success === false) {
        const message = json.error || json.message || 'API request returned failure';
        const err = new Error(message) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      return json as T;
    };

    const safeNavigate = (path: string) => {
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
        throw new Error('Invalid navigate path: must start with "/" and not contain leading "//"');
      }
      navigateRef.current(path);
    };

    const triggerToast = (message: string, kind?: 'success' | 'error' | 'info' | 'warning') => {
      const severity = kind === 'success' || kind === 'error' || kind === 'warning' ? kind : 'info';
      // Dispatches custom event for CRM shell listeners; shown as the CRM top-right snackbar.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('crm-toast', { detail: { message, kind: severity } }));
      }
      notify.show(severity, message);
    };

    const getAssetUrl = (assetPath: string) => {
      const cleanPath = String(assetPath || '').replace(/^\/+/, '');
      return `${API_BASE}${cleanAssetBase}/${cleanPath}`;
    };

    // 3. Mount Lifecycle with 15s Timeout
    const mountPromise = (async () => {
      // Fetch settings asynchronously, fallback to empty object
      let settingsObj: Record<string, unknown> = {};
      try {
        if (scopedBase) {
          settingsObj = await makeApiRequest<Record<string, unknown>>('GET', '/_settings');
        } else {
          const res = await extensionDataApi.getSettings();
          settingsObj = res.values || {};
        }
      } catch {
        settingsObj = {};
      }

      if (isCancelled) return;

      const cleanEntry = ui.entry.replace(/^\/+/, '');
      const entryUrl = `${API_BASE}${cleanAssetBase}/${cleanEntry}`;

      let loadPromise = moduleCache.get(styleKey);
      if (!loadPromise) {
        loadPromise = import(/* @vite-ignore */ entryUrl);
        moduleCache.set(styleKey, loadPromise);
      }

      const mod = await loadPromise.catch((err) => {
        moduleCache.delete(styleKey);
        throw err;
      });

      if (isCancelled) return;

      const isDark = readTheme() === 'dark';

      const ctx: ExtensionMountContext = {
        slot,
        extensionId: extension.id,
        extensionVersion: String(extension.version || '1.0.0'),
        record: recordRef.current ? { ...recordRef.current, ...(readOnlyRef.current ? { locked: true } : {}) } : null,
        user: {
          id: String((userRef.current as any)?.id || (userRef.current as any)?._id || userRef.current?.userId || ''),
          name: String(
            (userRef.current as any)?.name || (userRef.current as any)?.displayName || userRef.current?.username || ''
          ),
          email: String(userRef.current?.email || ''),
          permissions: Array.isArray(userRef.current?.permissions) ? userRef.current!.permissions : [],
        },
        theme: isDark ? 'dark' : 'light',
        settings: settingsObj,
        api: {
          get: <T = unknown>(p: string) => makeApiRequest<T>('GET', p),
          post: <T = unknown>(p: string, b?: unknown) => makeApiRequest<T>('POST', p, b),
          put: <T = unknown>(p: string, b?: unknown) => makeApiRequest<T>('PUT', p, b),
          patch: <T = unknown>(p: string, b?: unknown) => makeApiRequest<T>('PATCH', p, b),
          del: <T = unknown>(p: string) => makeApiRequest<T>('DELETE', p),
        },
        navigate: safeNavigate,
        toast: triggerToast,
        recordChanged: () => {
          const rec = recordRef.current;
          if (!rec) return;
          window.dispatchEvent(new CustomEvent('crm-record-changed', { detail: { type: rec.type, id: rec.id } }));
        },
        assetUrl: getAssetUrl,
        libs: {
          React,
          ReactDOMClient,
        },
        fieldsForm: (element: HTMLElement, options: FieldsFormOptions): FieldsFormHandle => {
          if (!(element instanceof HTMLElement)) throw new Error('fieldsForm: an element is required');
          const entry: FieldsFormEntry = {
            id: ++fieldFormSeq.current,
            element,
            options: { ...options },
            store: { values: { ...(options && options.values ? options.values : {}) } },
          };
          setFieldForms((list) => [...list, entry]);
          const groups = (): ExtensionFieldGroup[] =>
            (declarationsRef.current.fields?.[options.record] || []).filter(
              (g) =>
                (!options.groupIds || !options.groupIds.length || options.groupIds.includes(g.id)) &&
                (options.record !== 'lead' || !g.whenRequestTypeKey || g.whenRequestTypeKey === options.requestTypeKey)
            );
          return {
            getValues: () => ({ ...entry.store.values }),
            validate: () => {
              const missing = missingRequiredFields(groups(), entry.store.values, options.requestTypeKey);
              if (missing.length) return `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required.`;
              return invalidFieldValue(groups().flatMap((g) => g.fields), entry.store.values, null);
            },
            destroy: () => setFieldForms((list) => list.filter((f) => f.id !== entry.id)),
          };
        },
        can: (permission: string) =>
          readOnlyRef.current && WRITE_RIGHT_RE.test(String(permission || '')) ? false : canUseRef.current(permission),
        saveSettings: async (patch: Record<string, unknown>) => {
          const res = await extensionDataApi.setSettings(patch && typeof patch === 'object' ? patch : {});
          emitSettingsChanged(extension.id, res.values || {});
          return res.values || {};
        },
        values: recordRef.current
          ? {
              get: async () => {
                const current = recordRef.current;
                if (!current) return {};
                return (await extensionDataApi.getValues(current.type, current.id)).values || {};
              },
              set: async (patch: Record<string, unknown>) => {
                const current = recordRef.current;
                if (!current) return {};
                const res = await extensionDataApi.setValues(current.type, current.id, patch || {});
                emitValuesChanged(current.type, current.id, res.values || {});
                return res.values || {};
              },
            }
          : null,
        onValuesChanged: (callback: (values: Record<string, unknown>) => void) => {
          const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ record: string; recordId: string; values: Record<string, unknown> }>).detail;
            const current = recordRef.current;
            if (!detail || !current || detail.record !== current.type || detail.recordId !== current.id) return;
            try {
              callback(detail.values || {});
            } catch (e) {
              console.warn('[ExtensionMount] onValuesChanged callback failed:', e);
            }
          };
          window.addEventListener(EXTENSION_VALUES_CHANGED, handler);
          const off = () => window.removeEventListener(EXTENSION_VALUES_CHANGED, handler);
          listeners.push(off);
          return off;
        },
        onThemeChange: (callback: (theme: 'dark' | 'light') => void) => {
          let last = readTheme();
          const observer = new MutationObserver(() => {
            const next = readTheme();
            if (next === last) return;
            last = next;
            try {
              callback(next);
            } catch (e) {
              console.warn('[ExtensionMount] onThemeChange callback failed:', e);
            }
          });
          observer.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class', 'data-theme'] });
          const off = () => observer.disconnect();
          listeners.push(off);
          return off;
        },
        query: parseQuery(locationSearchRef.current),
        onQueryChange: (callback: (query: Record<string, string>) => void) => {
          const handler = (event: Event) => {
            try {
              callback(parseQuery(String((event as CustomEvent<string>).detail || '')));
            } catch (e) {
              console.warn('[ExtensionMount] onQueryChange callback failed:', e);
            }
          };
          window.addEventListener(EXTENSION_QUERY_CHANGED, handler);
          const off = () => window.removeEventListener(EXTENSION_QUERY_CHANGED, handler);
          listeners.push(off);
          return off;
        },
        onSettingsChanged: (callback: (values: Record<string, unknown>) => void) => {
          const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ extensionId: string; values: Record<string, unknown> }>).detail;
            if (!detail || detail.extensionId !== extension.id) return;
            try {
              callback(detail.values || {});
            } catch (e) {
              console.warn('[ExtensionMount] onSettingsChanged callback failed:', e);
            }
          };
          window.addEventListener(EXTENSION_SETTINGS_CHANGED, handler);
          const off = () => window.removeEventListener(EXTENSION_SETTINGS_CHANGED, handler);
          listeners.push(off);
          return off;
        },
      };

      const mountFn = mod.mount || (typeof mod.default === 'object' && mod.default?.mount);
      const unmountFn = mod.unmount || (typeof mod.default === 'object' && mod.default?.unmount);

      if (typeof mountFn !== 'function') {
        throw new Error(`Extension bundle at "${entryUrl}" does not export a mount() function.`);
      }

      if (!containerRef.current) return;

      // Clean container before mount
      containerRef.current.innerHTML = '';

      await mountFn(containerRef.current, ctx);

      if (!isCancelled) {
        mountedModuleRef.current = { unmount: unmountFn };
        setLoading(false);
      }
    })();

    // 15 second load timeout race
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = window.setTimeout(() => {
        reject(new Error(`Extension UI mount timed out after 15 seconds (slot: ${slot})`));
      }, 15000);
    });

    Promise.race([mountPromise, timeoutPromise])
      .catch((err) => {
        if (!isCancelled) {
          setError(err?.message || 'Failed to mount extension');
          setLoading(false);
        }
      })
      .finally(() => {
        if (timerId) window.clearTimeout(timerId);
      });

    return () => {
      isCancelled = true;
      for (const off of listeners.splice(0)) off();
      if (timerId) window.clearTimeout(timerId);

      // Unmount active module
      if (mountedModuleRef.current?.unmount && currentContainer) {
        try {
          mountedModuleRef.current.unmount(currentContainer);
        } catch (e) {
          console.warn('[ExtensionMount] Unmount warning:', e);
        }
        mountedModuleRef.current = null;
      }
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }

      // Stylesheet cleanup tracking
      if (ui.styles) {
        const count = styleRefCount.get(styleKey) || 1;
        const newCount = Math.max(0, count - 1);
        styleRefCount.set(styleKey, newCount);
        if (newCount === 0) {
          const link = document.head.querySelector<HTMLLinkElement>(
            `link[data-extension-style="${styleKey}"]`
          );
          if (link) link.remove();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, recordKey, extensionKey, uiKey, backendKey, retryNonce]);

  return (
    <div className={`extension-mount-root relative w-full ${className}`}>
      {loading && !error && (
        <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
          <span className="text-xs font-medium">Loading extension ({slot})...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 p-5 text-left">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                Extension Mount Error ({extension.name} • {slot})
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 break-words">{error}</p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        data-extension-slot={slot}
        data-extension-id={extension.id}
        className={`extension-mount-container ${loading || error ? 'hidden' : 'block'}`}
      />
      {fieldForms
        .filter((f) => f.element.isConnected)
        .map((f) => createPortal(<FieldsFormHost entry={f} />, f.element, `fields-form-${f.id}`))}
    </div>
  );
};
