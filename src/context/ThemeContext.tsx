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

function applyDocumentTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  try {
    root.style.colorScheme = theme;
  } catch {
    // ignore
  }
  try {
    document.body.classList.toggle('dark', theme === 'dark');
    document.body.dataset.theme = theme;
  } catch {
    // ignore
  }
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
    return readParentCmsTheme() || readOwnStoredTheme() || 'light';
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
      const fromParent = readParentCmsTheme();
      if (fromParent) setTheme(fromParent);
    };

    syncFromParent();

    let observer: MutationObserver | null = null;
    let pollTimer: number | undefined;

    // Watch CMS <html class="dark"> toggled by CMS ThemeContext.
    try {
      if (window.parent !== window && window.parent.document?.documentElement) {
        const parentHtml = window.parent.document.documentElement;
        observer = new MutationObserver(syncFromParent);
        observer.observe(parentHtml, {
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
