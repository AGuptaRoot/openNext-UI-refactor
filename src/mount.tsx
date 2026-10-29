import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
// Imported twice on purpose: the plain import makes Vite emit a real
// stylesheet for `manifest.styles` (which the host scopes), and the `?inline`
// copy is the fallback injected when that scoping did not apply.
import './index.css';
import appCss from './index.css?inline';

/**
 * OpenNext CMS Mount API entry.
 *
 * The CMS no longer loads plugins in an iframe: it imports this module and
 * hands us a `<div>` inside its own dashboard, keeping its sidebar. So this
 * file does what `index.html` + `main.tsx` used to do, with three differences.
 *
 *  - The host owns the browser URL, so the CRM runs on a memory router and
 *    takes its starting page from `ctx.pageId` (the active adminNav item).
 *  - Styles come from `manifest.styles`, which the host fetches and wraps in
 *    `@scope (#plugin-root)` so they cannot leak into the CMS chrome. A probe
 *    below notices when that scoping did not take effect (it needs a browser
 *    with CSS `@scope`) and falls back to injecting our CSS directly, because
 *    an unstyled CRM is worse than a slightly leaky one.
 *  - `unmount` must tear the React root down; the host re-mounts on every nav
 *    change, and a leaked root would keep timers and fetches alive.
 */

/** Matches the `ctx` the CMS builds in `lib/plugins/mountRuntime.ts`. */
export interface PluginMountContext {
  pluginId: string;
  pageId?: string;
  roleId?: string;
  features: string[] | '*';
  assetBase: string;
  apiBase: string;
  extensionId?: string;
}

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
const FONT_MARK = 'data-opennext-crm-font';
const CSS_MARK = 'data-opennext-crm-css';
const PROBE_CLASS = 'opennext-crm-style-probe';
/** Marks the element the CRM is mounted into, so the theme can follow it. */
const MOUNT_ROOT_ATTR = 'data-crm-mount-root';

/**
 * Nav ids the CRM declares in `manifest.adminNav`, mapped to routes.
 *
 * Most ids already match their route, so only the ones that differ are listed;
 * anything unknown falls through to `/<pageId>` and then to the CRM's own
 * not-found handling.
 */
const PAGE_ROUTES: Record<string, string> = {
  dashboard: '/dashboard',
  'add-ons': '/add-ons',
  'customer-success': '/customer-success',
  'data-quality': '/data-quality',
  'sales-orders': '/sales-orders',
  'time-logs': '/time-logs',
  'analytics-ai': '/analytics-ai',
  'invoice-templates': '/invoices?tab=templates',
};

function routeForPage(pageId?: string): string {
  const key = String(pageId || '').trim();
  if (!key) return '/';
  return PAGE_ROUTES[key] || `/${key.replace(/^\/+/, '')}`;
}

/** The Inter webfont lived in index.html, which the host no longer loads. */
function ensureFontLink(): void {
  if (document.querySelector(`link[${FONT_MARK}]`)) return;
  const link = document.createElement('link');
  link.setAttribute(FONT_MARK, '');
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

/**
 * True when the host's scoped stylesheet is actually styling our subtree.
 *
 * CSS `@scope` is not in every browser yet; where it is missing the host's
 * `<style>` is parsed and dropped, leaving the CRM unstyled.
 */
function pluginStylesApplied(el: HTMLElement): boolean {
  const probe = document.createElement('div');
  probe.className = `${PROBE_CLASS} hidden`;
  el.appendChild(probe);
  try {
    return window.getComputedStyle(probe).display === 'none';
  } catch {
    return true;
  } finally {
    probe.remove();
  }
}

function injectCssFallback(): void {
  if (document.querySelector(`style[${CSS_MARK}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(CSS_MARK, '');
  style.textContent = appCss;
  document.head.appendChild(style);
}

let activeRoot: ReactDOM.Root | null = null;

export async function mount(el: HTMLElement, ctx: PluginMountContext) {
  // Read by ThemeContext and Layout: <html> belongs to the CMS in this mode,
  // so the CRM reads the theme from it and never writes to it.
  (window as unknown as { __OPENNEXT_CRM_MOUNTED__?: boolean }).__OPENNEXT_CRM_MOUNTED__ = true;

  ensureFontLink();

  /*
   * The host wraps our stylesheet in `@scope (#plugin-root)`, which matches
   * only elements inside this div. The build rewrites `:root`, `html` and
   * `body` selectors to `:scope` so the CSS variables and the page canvas land
   * here instead — and `Layout` mirrors the `dark` class onto this element,
   * because `:scope.dark …` cannot see a class on <html> from inside the scope.
   */
  el.setAttribute(MOUNT_ROOT_ATTR, '');
  el.classList.add('crm-mount-root');
  // Seed the theme from the CMS before the first paint; ThemeProvider then
  // keeps it in step through a MutationObserver on the CMS's <html>.
  const hostIsDark = document.documentElement.classList.contains('dark');
  el.classList.toggle('dark', hostIsDark);
  el.setAttribute('data-theme', hostIsDark ? 'dark' : document.documentElement.dataset.theme || 'light');

  // The host may still be fetching manifest.styles when mount runs, so give it
  // the current frame before deciding the CRM is unstyled.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  if (!pluginStylesApplied(el)) injectCssFallback();

  const root = ReactDOM.createRoot(el);
  activeRoot = root;
  root.render(
    <React.StrictMode>
      <App router="memory" initialPath={routeForPage(ctx?.pageId)} />
    </React.StrictMode>
  );

  return {
    unmount() {
      root.unmount();
      if (activeRoot === root) activeRoot = null;
    },
  };
}

export function unmount(): void {
  if (!activeRoot) return;
  activeRoot.unmount();
  activeRoot = null;
}

export default { mount, unmount };
