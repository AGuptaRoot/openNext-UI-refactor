import { CRM_PLUGIN_ID, EXTENSION_SEGMENT, extensionPageCmsPath } from './extensionPageRoute';
import { SETTINGS_NAV_ATTR, SETTINGS_TAB_ATTR } from './cmsSidebarSettingsNav';

/** Set on <html> by a CMS that renders plugin dynamic navigation itself (CMS lib/plugins/dynamicNav.ts). */
export const NATIVE_PLUGIN_NAV_ATTRIBUTE = 'data-cms-native-plugin-nav';
/** Window event that makes the CMS reload a plugin's dynamic navigation. */
export const PLUGIN_NAV_CHANGED_EVENT = 'cms:plugin-nav-changed';

/** CRM 3.50.0: ask the CMS to reload the CRM menu (GET /admin-nav), e.g. after the extension changed. */
export function notifyHostNavChanged(pluginId = CRM_PLUGIN_ID): void {
  const targets: Window[] = [];
  try {
    targets.push(window);
    if (window.parent && window.parent !== window) targets.push(window.parent);
  } catch {
    /* cross-origin parent */
  }
  for (const target of targets) {
    try {
      target.dispatchEvent(new CustomEvent(PLUGIN_NAV_CHANGED_EVENT, { detail: { pluginId } }));
    } catch {
      /* best effort */
    }
  }
}

/**
 * Show the active workspace extension's pages (json/navigation.json) inside the
 * CMS sidebar, directly under the CRM's own menu links, styled like them.
 *
 * Each item links to the CMS URL /dashboard/plugins/runtime/<plugin>/extension/<id>/<page>
 * (utils/extensionPageRoute.ts), which the CMS opens as a normal CRM page, so a
 * reload or a copied link works. Clicks are normally taken over by
 * useDashboardSidebarSync (capture phase), which switches the CRM route and
 * updates the URL; the handler here is the fallback. Nothing is added while the CRM's menu group is not
 * rendered (e.g. collapsed or on another CMS page).
 */
export function syncParentSidebarExtensionPages(
  pages: Array<{ id: string; label: string; icon: string }>,
  extensionId: string,
  currentCrmRoute: string,
  onNavigate: (path: string) => void,
  iconSvg: (icon: string) => string,
  pluginId = CRM_PLUGIN_ID
): void {
  if (typeof window === 'undefined') return;

  const docs: Document[] = [];
  try {
    docs.push(document);
  } catch {
    /* no document */
  }
  try {
    if (window.parent && window.parent !== window && window.parent.document) docs.push(window.parent.document);
  } catch {
    /* cross-origin parent */
  }

  const prefix = `/dashboard/plugins/runtime/${encodeURIComponent(pluginId)}/`;

  const allPages = pages;
  for (const doc of docs) {
    pages = allPages;
    try {
      const existing = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[data-crm-extension-page]'));
      // Legacy section injected by earlier builds.
      doc.querySelectorAll('[data-crm-extension-nav="true"]').forEach((node) => node.remove());

      // CRM 3.50.3: a CMS that renders plugin navigation natively (GET /admin-nav) may already show some
      // or all of these pages. Only the pages it does NOT show are added here (matched by link), so the
      // menu is complete even when /admin-nav could not answer, and nothing is ever shown twice.
      const hostPaths = new Set(
        Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))
          .filter((a) => !a.hasAttribute('data-crm-extension-page'))
          .map((a) => {
            try {
              return decodeURIComponent(new URL(a.getAttribute('href') || '', 'http://localhost').pathname).replace(/\/+$/, '');
            } catch {
              return '';
            }
          })
          .filter(Boolean)
      );
      const pathOf = (page: { id: string }) => {
        try {
          return decodeURIComponent(new URL(extensionPageCmsPath(extensionId, page.id, pluginId), 'http://localhost').pathname).replace(/\/+$/, '');
        } catch {
          return extensionPageCmsPath(extensionId, page.id, pluginId);
        }
      };
      pages = pages.filter((page) => !hostPaths.has(pathOf(page)));
      if (!pages.length) {
        existing.forEach((node) => node.remove());
        continue;
      }
      const docKey = `${pages.map((p) => `${p.id}:${p.label}:${p.icon}`).join('|')}@${extensionId}`;

      if (!pages.length) {
        existing.forEach((node) => node.remove());
        continue;
      }

      const own = Array.from(doc.querySelectorAll<HTMLAnchorElement>(`a[href^="${prefix}"]`)).filter(
        (a) => !a.hasAttribute('data-crm-extension-page') && !a.hasAttribute(SETTINGS_TAB_ATTR) && a.offsetParent !== null
      );
      if (!own.length) {
        existing.forEach((node) => node.remove());
        continue;
      }
      const lastOwn = own[own.length - 1];
      const container = lastOwn.parentElement;
      if (!container) continue;

      const view = doc.defaultView || window;
      const pathname = view.location.pathname;
      const isCurrent = (pageId: string) =>
        pathname.endsWith(`/${EXTENSION_SEGMENT}/${extensionId}/${pageId}`) ||
        currentCrmRoute === `/ext/${extensionId}/${pageId}`;

      // Native look: copy the classes of an inactive and of the active CRM item.
      const inactiveSample = own.find((a) => a.getAttribute('href') !== pathname) || lastOwn;
      const activeSample = own.find((a) => a.getAttribute('href') === pathname) || null;
      const iconSample = inactiveSample.querySelector('svg');
      const iconClass = iconSample?.getAttribute('class') || 'h-4 w-4 mr-2 text-muted-foreground';

      const upToDate =
        existing.length === pages.length &&
        existing.every((node) => node.parentElement === container && node.getAttribute('data-crm-extension-key') === docKey);

      if (!upToDate) {
        existing.forEach((node) => node.remove());
        // Keep the Settings sections (utils/cmsSidebarSettingsNav) directly under Settings.
        let after: Element =
          lastOwn.nextElementSibling?.hasAttribute(SETTINGS_NAV_ATTR) ? lastOwn.nextElementSibling : lastOwn;
        for (const page of pages) {
          const item = doc.createElement('a');
          const cmsPath = extensionPageCmsPath(extensionId, page.id, pluginId);
          item.href = cmsPath;
          item.setAttribute('data-crm-extension-page', page.id);
          item.setAttribute('data-crm-extension-key', docKey);
          item.setAttribute('data-inactive-class', inactiveSample.className);
          item.setAttribute('data-active-class', activeSample ? activeSample.className : `${inactiveSample.className} font-medium`);
          item.className = inactiveSample.className;

          const icon = doc.createElement('span');
          icon.className = 'inline-flex shrink-0 items-center justify-center';
          icon.innerHTML = iconSvg(page.icon);
          const svg = icon.querySelector('svg');
          if (svg) svg.setAttribute('class', iconClass);
          const label = doc.createElement('span');
          label.textContent = page.label;
          item.append(icon, label);

          item.addEventListener('click', (event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // new tab etc.
            event.preventDefault();
            event.stopPropagation();
            try {
              view.history.replaceState(view.history.state, '', cmsPath);
            } catch {
              /* URL update is best-effort */
            }
            onNavigate(`/ext/${extensionId}/${page.id}`);
          });

          after.after(item);
          after = item;
        }
      }

      doc.querySelectorAll<HTMLAnchorElement>('a[data-crm-extension-page]').forEach((item) => {
        const current = isCurrent(item.getAttribute('data-crm-extension-page') || '');
        item.className = (current ? item.getAttribute('data-active-class') : item.getAttribute('data-inactive-class')) || item.className;
        if (current) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
    } catch {
      /* never break the host sidebar */
    }
  }
}
