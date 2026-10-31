import { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const PLUGIN_ID = 'openext-crm-suite';
export const PLUGIN_RUNTIME_BASE = `/dashboard/plugins/runtime/${PLUGIN_ID}`;
export const DASHBOARD_ROUTE_ID = 'dashboard';

export interface SidebarSyncOptions {
  pluginId?: string;
  defaultRouteId?: string;
  pollingIntervalMs?: number;
}

export interface CrmRouteChangeDetail {
  pluginId: string;
  routeId: string;
  path: string;
}

export interface SidebarSyncResult {
  isEmbedded: boolean;
  activeRouteId: string;
  syncReactToParent: (routeId?: string) => void;
  syncParentToReact: () => void;
  highlightSidebarItem: (routeId?: string) => void;
}

/**
 * Extract root module route identifier from a URL path.
 * e.g. "/dashboard" -> "dashboard", "/leads/create" -> "leads", "/" -> "dashboard"
 */
export function extractRouteIdFromPath(path: string, defaultRoute = 'dashboard'): string {
  const clean = path.replace(/^#\/?/, '').replace(/^\/+/, '').trim();
  const parts = clean.split('?')[0].split('/').filter(Boolean);
  if (parts[0] === 'ext') {
    return parts[2] || parts[1] || 'travel-requirement';
  }
  const segment = parts[0]?.trim();
  return segment && segment !== '' ? segment : defaultRoute;
}

/**
 * Extract route ID from a parent anchor href.
 */
export function extractRouteIdFromHref(href: string, pluginId = PLUGIN_ID): string {
  if (!href) return '';
  try {
    const runtimePath = `/dashboard/plugins/runtime/${pluginId}`;
    if (href.includes(runtimePath)) {
      const suffix = href.slice(href.indexOf(runtimePath) + runtimePath.length).replace(/^\/+/, '');
      const parts = suffix.split('?')[0].split('/').filter(Boolean);
      if (parts[0] === 'ext') {
        return parts[2] || parts[1] || 'travel-requirement';
      }
      if (parts[0]) return decodeURIComponent(parts[0]);
    }
    const url = new URL(href, 'http://localhost');
    const viewParam = url.searchParams.get('view');
    if (viewParam) return viewParam;
    return '';
  } catch {
    return '';
  }
}

/**
 * Hide specific CRM module links in the parent OpenNext CMS sidebar (e.g. Dashboard for clients).
 * Also matches by visible label text when `labels` is provided (extension pages like Travel).
 */
export function hideParentSidebarRoutes(
  routeIds: string[],
  pluginId = PLUGIN_ID,
  labels: string[] = []
): void {
  if (typeof window === 'undefined') return;
  const hideSet = new Set(routeIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean));
  const labelSet = new Set(
    labels.map((l) => String(l || '').trim().toLowerCase()).filter(Boolean)
  );
  if (!hideSet.size && !labelSet.size) return;

  const targetDocs: Document[] = [];
  try {
    if (typeof document !== 'undefined') targetDocs.push(document);
  } catch {
    // ignore
  }
  try {
    if (window.parent && window.parent !== window && window.parent.document) {
      targetDocs.push(window.parent.document);
    }
  } catch {
    // ignore
  }

  targetDocs.forEach((parentDoc) => {
    try {
      const anchors = parentDoc.querySelectorAll<HTMLAnchorElement>(
        `a[href*="${pluginId}"], a[href*="/plugins/"], a[href*="/runtime/"], nav a, aside a, [role="navigation"] a, [class*="sidebar"] a`
      );

      anchors.forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        const hrefLower = href.toLowerCase();
        const extracted = extractRouteIdFromHref(href, pluginId);
        const anchorRoute = extracted ? extracted.toLowerCase() : '';

        // Match href segments e.g. /expenses, ?view=expenses, etc.
        const hasRouteInHref = [...hideSet].some(
          (id) => hrefLower.includes(`/${id}`) || hrefLower.endsWith(`/${id}`) || hrefLower.includes(`view=${id}`)
        );

        const rawText = String(anchor.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        const cleanText = rawText.replace(/\s+\d+$/, '').trim();

        const row =
          anchor.closest<HTMLElement>('li') ||
          anchor.closest<HTMLElement>('[role="menuitem"]') ||
          anchor.closest<HTMLElement>('button') ||
          anchor.closest<HTMLElement>('[class*="justify-start"]') ||
          anchor.closest<HTMLElement>('[class*="nav-item"]') ||
          anchor;

        // Never hide the Travel requirement extension module for Admin/Managers
        const isTravelRequirement =
          rawText === 'travel requirement' ||
          cleanText === 'travel requirement' ||
          anchorRoute === 'travel-requirement' ||
          hrefLower.includes('/ext/crm-travel/travel-requirement') ||
          hrefLower.includes('travel-requirement');

        if (isTravelRequirement && !hideSet.has('travel-requirement') && !labelSet.has('travel requirement')) {
          row.style.display = '';
          row.removeAttribute('data-crm-nav-hidden');
          row.removeAttribute('aria-hidden');
          return;
        }

        const hideByRoute = (anchorRoute && hideSet.has(anchorRoute)) || hasRouteInHref;
        const hideByLabel =
          labelSet.has(rawText) ||
          labelSet.has(cleanText) ||
          [...labelSet].some((want) => rawText === want || cleanText === want || rawText.startsWith(want));

        if (hideByRoute || hideByLabel) {
          row.style.display = 'none';
          row.setAttribute('data-crm-nav-hidden', '1');
          row.setAttribute('aria-hidden', 'true');
        } else if (row.getAttribute('data-crm-nav-hidden') === '1') {
          row.style.display = '';
          row.removeAttribute('data-crm-nav-hidden');
          row.removeAttribute('aria-hidden');
        }
      });
    } catch {
      // Cross-origin boundary — ignore
    }
  });
}

/**
 * Typed React hook to synchronize all OpenNext CMS sidebar menu options
 * with the React CRM routes (Dashboard, Leads, and all CRM modules).
 *
 * Capabilities:
 * 1. Synchronizes React route -> Parent URL (/dashboard/plugins/runtime/openext-crm-suite/<routeId>)
 * 2. Dispatches `crm-plugin-route-change` event on window.parent with { pluginId, routeId, path }
 * 3. Dynamically highlights the active module in the OpenNext CMS parent sidebar
 * 4. Observes parent DOM mutations to maintain active styling across Next.js re-renders
 * 5. Synchronizes Parent sidebar clicks -> React route navigation
 * 6. Handles iframe environment and cross-origin security boundaries safely
 */
export const useSidebarSync = (
  options: SidebarSyncOptions = {}
): SidebarSyncResult => {
  const {
    pluginId = PLUGIN_ID,
    defaultRouteId = DASHBOARD_ROUTE_ID,
    pollingIntervalMs = 100,
  } = options;

  const location = useLocation();
  const navigate = useNavigate();
  const observerRef = useRef<MutationObserver | null>(null);
  const timerRef = useRef<number | null>(null);

  // Determine current active route identifier
  const activeRouteId = extractRouteIdFromPath(location.pathname, defaultRouteId);

  // Stable references for event listeners and interval loops
  const activeRouteRef = useRef(activeRouteId);
  activeRouteRef.current = activeRouteId;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Safe check if running in a browser environment (iframe or direct mount mode)
  const isEmbedded = typeof window !== 'undefined';

  /**
   * Safely highlight the active module's nav item in the parent OpenNext CMS sidebar
   */
  const highlightSidebarItem = useCallback(
    (targetRouteId = activeRouteRef.current) => {
      if (!isEmbedded) return;

      try {
        const targetDocs: Document[] = [];
        if (typeof document !== 'undefined') targetDocs.push(document);
        if (window.parent && window.parent !== window && window.parent.document) {
          targetDocs.push(window.parent.document);
        }

        const runtimePath = `/dashboard/plugins/runtime/${pluginId}`;

        targetDocs.forEach((doc) => {
          const anchors = doc.querySelectorAll<HTMLAnchorElement>(`a[href*="${runtimePath}"]`);

          anchors.forEach((anchor) => {
            const href = anchor.getAttribute('href') || '';
            const anchorRoute = extractRouteIdFromHref(href, pluginId) || defaultRouteId;
            const isCurrent = anchorRoute.toLowerCase() === targetRouteId.toLowerCase();

            const row =
              anchor.closest<HTMLElement>('button') ||
              anchor.closest<HTMLElement>('[class*="justify-start"]') ||
              anchor;

            if (isCurrent) {
              anchor.classList.add('active', 'is-active');
              row.classList.add('active', 'is-active');
              row.setAttribute('data-crm-nav-active', '1');
              row.style.backgroundColor = 'hsl(var(--secondary))';
              row.style.color = 'hsl(var(--secondary-foreground))';
              row.style.fontWeight = '500';
              const icon = row.querySelector<SVGElement>('svg');
              if (icon) icon.style.color = 'hsl(var(--primary))';
            } else {
              anchor.classList.remove('active', 'is-active');
              row.classList.remove('active', 'is-active');
              if (row.getAttribute('data-crm-nav-active') === '1') {
                row.removeAttribute('data-crm-nav-active');
                row.style.backgroundColor = '';
                row.style.color = '';
                row.style.fontWeight = '';
                const icon = row.querySelector<SVGElement>('svg');
                if (icon) icon.style.color = '';
              }
            }
          });
        });
      } catch {
        // Cross-origin security boundary handled safely
      }
    },
    [isEmbedded, pluginId, defaultRouteId]
  );

  /**
   * Synchronize React route -> Parent URL & dispatch crm-plugin-route-change
   */
  const syncReactToParent = useCallback(
    (targetRouteId = activeRouteRef.current) => {
      if (!isEmbedded) return;

      try {
        const parentWindow = window.parent;
        const parentUrl = new URL(parentWindow.location.href);
        const runtimePath = `/dashboard/plugins/runtime/${pluginId}`;

        // Only synchronize if parent is in the plugin runtime path
        if (!parentUrl.pathname.startsWith(runtimePath)) return;

        const currentSuffix = parentUrl.pathname.slice(runtimePath.length).replace(/^\/+/, '');
        let targetPath = `${runtimePath}/${encodeURIComponent(targetRouteId)}`;
        if (targetRouteId === 'travel-requirement' && currentSuffix.startsWith('ext/')) {
          targetPath = `${runtimePath}/${currentSuffix.split('?')[0]}`;
        }
        if (parentUrl.pathname !== targetPath || parentUrl.searchParams.has('view')) {
          parentUrl.pathname = targetPath;
          parentUrl.searchParams.delete('view');

          parentWindow.history.replaceState(
            parentWindow.history.state,
            '',
            `${parentUrl.pathname}${parentUrl.search}${parentUrl.hash}`
          );
        }

        // Dispatch crm-plugin-route-change custom event on window.parent
        const detail: CrmRouteChangeDetail = {
          pluginId,
          routeId: targetRouteId,
          path: targetPath,
        };

        parentWindow.dispatchEvent(
          new CustomEvent<CrmRouteChangeDetail>('crm-plugin-route-change', {
            detail,
          })
        );

        // Highlight the item in the parent sidebar
        highlightSidebarItem(targetRouteId);
      } catch {
        // Cross-origin or browser history restrictions handled gracefully
      }
    },
    [isEmbedded, pluginId, highlightSidebarItem]
  );

  /**
   * Read requested route from parent URL
   */
  const getParentRequestedRoute = useCallback((): string => {
    if (!isEmbedded) return '';
    try {
      const parentUrl = new URL(window.parent.location.href);
      const runtimePath = `/dashboard/plugins/runtime/${pluginId}`;
      if (!parentUrl.pathname.startsWith(runtimePath)) return '';

      const suffix = parentUrl.pathname.slice(runtimePath.length).replace(/^\/+/, '');
      const parts = suffix.split('?')[0].split('/').filter(Boolean);
      if (parts[0] === 'ext') {
        return parts[2] || parts[1] || 'travel-requirement';
      }
      const navId = parts[0];
      if (navId) return decodeURIComponent(navId);
      return parentUrl.searchParams.get('view') || '';
    } catch {
      return '';
    }
  }, [isEmbedded, pluginId]);

  /**
   * Synchronize OpenNext parent route -> React route
   */
  const syncParentToReact = useCallback(() => {
    const parentRoute = getParentRequestedRoute();
    if (parentRoute && parentRoute.toLowerCase() !== activeRouteRef.current.toLowerCase()) {
      navigateRef.current(`/${parentRoute}`);
      highlightSidebarItem(parentRoute);
    }
  }, [getParentRequestedRoute, highlightSidebarItem]);

  // 1. Trigger React -> Parent sync whenever activeRouteId changes
  useEffect(() => {
    syncReactToParent(activeRouteId);
  }, [activeRouteId, syncReactToParent]);

  // 2. Initial check on mount: sync from parent route if already requested
  useEffect(() => {
    if (!isEmbedded) return;
    syncParentToReact();
  }, [isEmbedded, syncParentToReact]);

  // 3. Set up Parent -> React synchronization listeners (Capture click on sidebar, popstate, custom event, polling)
  useEffect(() => {
    if (!isEmbedded) return;

    // Capture click on parent sidebar anchors to enable instant 1-click navigation without iframe reload
    const handleParentAnchorClick = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        const runtimePath = `/dashboard/plugins/runtime/${pluginId}`;
        const anchor = target.closest<HTMLAnchorElement>(`a[href*="${runtimePath}"]`);
        if (!anchor) return;

        const href = anchor.getAttribute('href') || '';
        const targetRoute = extractRouteIdFromHref(href, pluginId) || defaultRouteId;
        if (!targetRoute) return;

        // Prevent Next.js from intercepting and remounting the iframe
        e.preventDefault();
        e.stopPropagation();

        if (targetRoute.toLowerCase() !== activeRouteRef.current.toLowerCase()) {
          navigateRef.current(`/${targetRoute}`);
          syncReactToParent(targetRoute);
          highlightSidebarItem(targetRoute);
        } else {
          highlightSidebarItem(targetRoute);
        }
      } catch {
        // Cross-origin safe
      }
    };

    const handleParentPopState = () => {
      syncParentToReact();
      highlightSidebarItem(activeRouteRef.current);
    };

    const handlePluginRouteChange = (event: Event) => {
      const customEv = event as CustomEvent<CrmRouteChangeDetail>;
      const routeId = customEv?.detail?.routeId;
      if (routeId && routeId.toLowerCase() !== activeRouteRef.current.toLowerCase()) {
        navigateRef.current(`/${routeId}`);
        highlightSidebarItem(routeId);
      }
    };

    try {
      const parentDoc = window.parent.document;
      if (parentDoc) {
        parentDoc.addEventListener('click', handleParentAnchorClick, true);
      }
      window.parent.addEventListener('popstate', handleParentPopState);
      window.parent.addEventListener('crm-plugin-route-change', handlePluginRouteChange as EventListener);
    } catch {
      // Ignore cross-origin listener errors
    }

    // Polling fallback to catch any parent URL changes if events are suppressed
    timerRef.current = window.setInterval(() => {
      syncParentToReact();
    }, pollingIntervalMs);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      try {
        const parentDoc = window.parent.document;
        if (parentDoc) {
          parentDoc.removeEventListener('click', handleParentAnchorClick, true);
        }
        window.parent.removeEventListener('popstate', handleParentPopState);
        window.parent.removeEventListener('crm-plugin-route-change', handlePluginRouteChange as EventListener);
      } catch {
        // Ignore cross-origin listener removal errors
      }
    };
  }, [isEmbedded, pluginId, defaultRouteId, pollingIntervalMs, syncReactToParent, syncParentToReact, highlightSidebarItem]);

  // 4. MutationObserver on parent sidebar nav to preserve active highlight across parent re-renders
  useEffect(() => {
    if (!isEmbedded) return;

    try {
      const parentDoc = window.parent.document;
      if (!parentDoc) return;

      const navEl = parentDoc.querySelector('nav') || parentDoc.querySelector('aside') || parentDoc.body;
      if (!navEl) return;

      highlightSidebarItem(activeRouteRef.current);

      observerRef.current = new MutationObserver(() => {
        highlightSidebarItem(activeRouteRef.current);
      });

      observerRef.current.observe(navEl, { childList: true, subtree: true });
    } catch {
      // Ignore cross-origin observer errors
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [isEmbedded, highlightSidebarItem]);

  return {
    isEmbedded,
    activeRouteId,
    syncReactToParent,
    syncParentToReact,
    highlightSidebarItem,
  };
};

/**
 * Backward-compatible alias for useSidebarSync
 */
export const useDashboardSidebarSync = useSidebarSync;
