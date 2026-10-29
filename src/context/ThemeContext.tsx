import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { createOpenNextTheme, type CmsThemeMode } from '../theme/muiTheme';

/**
 * OpenNext CMS ThemeContext-compatible API.
 *
 * Usage (same as CMS):
 *   import { useTheme } from '@/context/ThemeContext';
 *   const { theme } = useTheme(); // 'light' | 'dark'
 *
 * CRM runs in a plugin iframe, so this provider mirrors the CMS theme from the
 * parent window (html.dark / localStorage `theme`) and applies it locally.
 */

export type ThemeMode = CmsThemeMode;

type ThemeContextValue = {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeTheme(value: unknown): ThemeMode | null {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (v === 'dark' || v === 'light') return v;
  return null;
}

/**
 * True when the CRM is mounted inside the CMS dashboard through the Mount API
 * (no iframe). `src/mount.tsx` sets the flag before rendering.
 *
 * It changes two things: `<html>` belongs to the CMS, so it is the source of
 * truth for the theme and must never be written to by us; and our own styles
 * are scoped to the mount element, which is where the `dark` class has to go.
 */
export function isCrmMountedInHost(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as unknown as { __OPENNEXT_CRM_MOUNTED__?: boolean }).__OPENNEXT_CRM_MOUNTED__ === true
  );
}

/** Elements the CRM owns: the mount roots when hosted, else the document. */
function themeTargets(): HTMLElement[] {
  const targets: HTMLElement[] = [];
  if (isCrmMountedInHost()) {
    targets.push(...document.querySelectorAll<HTMLElement>('[data-crm-mount-root]'));
    targets.push(...document.querySelectorAll<HTMLElement>('.crm-mount-root'));
    const pluginRoot = document.getElementById('plugin-root');
    if (pluginRoot && !targets.includes(pluginRoot)) targets.push(pluginRoot);
  } else {
    targets.push(document.documentElement);
    if (document.body) targets.push(document.body);
  }
  return targets;
}

export function applyDocumentTheme(theme: ThemeMode) {
  for (const target of themeTargets()) {
    target.classList.toggle('dark', theme === 'dark');
    target.dataset.theme = theme;
    try {
      target.style.colorScheme = theme;
    } catch {
      // ignore
    }
  }
}

/**
 * Read the CMS theme from our own document.
 *
 * Mounted in the dashboard there is no parent frame to ask — `<html>` is the
 * CMS's own element, so its `dark` class and `data-theme` are the answer. We
 * never write there in that mode, so this cannot read back our own value.
 */
function readHostCmsTheme(): ThemeMode | null {
  if (typeof window === 'undefined' || !isCrmMountedInHost()) return null;
  const html = document.documentElement;
  if (html.classList.contains('dark')) return 'dark';
  const dataTheme = normalizeTheme(html.dataset.theme);
  if (dataTheme) return dataTheme;
  if (document.body?.classList.contains('dark')) return 'dark';
  const bodyTheme = normalizeTheme(document.body?.dataset.theme);
  if (bodyTheme) return bodyTheme;
  return 'light';
}

/** Read OpenNext CMS theme from the parent window (same-origin plugin iframe). */
function readParentCmsTheme(): ThemeMode | null {
  if (typeof window === 'undefined' || window.parent === window) return null;

  try {
    const parentHtml = window.parent.document?.documentElement;
    if (parentHtml?.classList?.contains('dark')) return 'dark';
    const dataTheme = normalizeTheme(parentHtml?.dataset?.theme);
    if (dataTheme) return dataTheme;
  } catch {
    // cross-origin
  }

  try {
    const stored = window.parent.localStorage?.getItem('theme');
    const fromStorage = normalizeTheme(stored);
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }

  try {
    const parentHtml = window.parent.document?.documentElement;
    if (parentHtml && !parentHtml.classList.contains('dark')) return 'light';
  } catch {
    // ignore
  }

  return null;
}

function readOwnStoredTheme(): ThemeMode | null {
  try {
    return (
      normalizeTheme(window.localStorage.getItem('theme')) ||
      normalizeTheme(window.localStorage.getItem('crm-theme'))
    );
  } catch {
    return null;
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    return readHostCmsTheme() || readParentCmsTheme() || readOwnStoredTheme() || 'light';
  });
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const setTheme = useCallback((next: ThemeMode) => {
    if (themeRef.current === next) {
      applyDocumentTheme(next);
      return;
    }
    setThemeState(next);
    applyDocumentTheme(next);
    try {
      window.localStorage.setItem('theme', next);
      window.localStorage.setItem('crm-theme', next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  useEffect(() => {
    const syncFromParent = () => {
      const fromHost = readHostCmsTheme() || readParentCmsTheme();
      if (fromHost) setTheme(fromHost);
    };

    syncFromParent();

    let observer: MutationObserver | null = null;
    let pollTimer: number | undefined;

    // Watch CMS <html class="dark"> toggled by CMS ThemeContext.
    try {
      // Mounted: watch the CMS's own <html>. In an iframe: watch the parent's.
      const watched = isCrmMountedInHost()
        ? document.documentElement
        : window.parent !== window
          ? window.parent.document?.documentElement
          : null;
      if (watched) {
        observer = new MutationObserver(syncFromParent);
        observer.observe(watched, {
          attributes: true,
          attributeFilter: ['class', 'data-theme'],
        });
      }
    } catch {
      // ignore
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'theme') return;
      const next = normalizeTheme(event.newValue);
      if (next) setTheme(next);
      else syncFromParent();
    };
    window.addEventListener('storage', onStorage);

    // Fallback — CMS ThemeContext does not notify iframes.
    pollTimer = window.setInterval(syncFromParent, 400);

    return () => {
      observer?.disconnect();
      window.removeEventListener('storage', onStorage);
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [setTheme]);

  const muiTheme = useMemo(() => createOpenNextTheme(theme), [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
    }),
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

/**
 * OpenNext CMS-compatible hook.
 * Prefer: `const { theme } = useTheme();`
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light',
      isDark: false,
      setTheme: () => undefined,
    };
  }
  return ctx;
}
