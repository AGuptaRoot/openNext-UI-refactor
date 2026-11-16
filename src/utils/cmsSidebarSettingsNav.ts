import { CRM_PLUGIN_ID, runtimeBase } from './extensionPageRoute';
import { CHEVRON_DOWN, CHEVRON_UP, iconSvg } from './cmsSidebarCrmIcons';

/**
 * CRM Settings sections as a sub-menu of the CRM's "Settings" link in the CMS
 * sidebar.
 *
 * - The Settings link gets an up / down arrow on its right; the arrow opens and
 *   closes the sub-menu without leaving the current page.
 * - The sub-menu lists every Settings tab (no group titles), each with a dot.
 *   Items link to /dashboard/plugins/runtime/<plugin>/settings?tab=<id>, so a
 *   reload or a copied link opens that tab; clicks switch the tab in place.
 *
 * Nothing is added while the CRM's Settings link is not rendered (CMS sidebar
 * collapsed, CRM group closed, another CMS page). The Settings page reads
 * `useSidebarSettingsNavOpen()` and shows its own menu whenever this one is not open.
 */

export interface SidebarSettingsGroup {
  groupId: string;
  title: string;
  tabs: Array<{ id: string; label: string }>;
}

export interface SidebarSettingsNavOptions {
  groups: SidebarSettingsGroup[];
  /** Open Settings tab, or '' when the Settings page is not open. */
  activeTab: string;
  expanded: boolean;
  onSelect: (tabId: string) => void;
  onToggle: () => void;
  pluginId?: string;
}

/** Attribute on the wrapper inserted under the Settings link. */
export const SETTINGS_NAV_ATTR = 'data-crm-settings-nav';
/** Attribute on each inserted tab link (value: the tab id). */
export const SETTINGS_TAB_ATTR = 'data-crm-settings-tab';
/** Attribute on the arrow inside the Settings link. */
export const SETTINGS_TOGGLE_ATTR = 'data-crm-settings-toggle';

const ACTIVE_STYLE = { backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: '500' };

/* ------------------------------------------------ open state, for the Settings page */

let navOpen = false;
const listeners = new Set<() => void>();

function setNavOpen(open: boolean): void {
  if (navOpen === open) return;
  navOpen = open;
  listeners.forEach((listener) => listener());
}

export function subscribeSidebarSettingsNav(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the sub-menu is shown (open) in a CMS sidebar. */
export function isSidebarSettingsNavOpen(): boolean {
  return navOpen;
}

/* ------------------------------------------------------------------- DOM */

function sidebarDocs(): Document[] {
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
  return docs;
}

function settingsPath(pluginId: string): string {
  return `${runtimeBase(pluginId)}/settings`;
}

/** The CRM's own, visible "Settings" link in a document. */
function findSettingsLink(doc: Document, pluginId: string): HTMLAnchorElement | null {
  const path = settingsPath(pluginId);
  const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>(`a[href^="${path}"]`));
  return (
    links.find(
      (a) =>
        !a.hasAttribute(SETTINGS_TAB_ATTR) &&
        !a.hasAttribute('data-crm-extension-page') &&
        (a.getAttribute('href') || '').split(/[?#]/)[0].replace(/\/+$/, '') === path &&
        a.offsetParent !== null
    ) || null
  );
}

export function removeSidebarSettingsNav(): void {
  for (const doc of sidebarDocs()) {
    try {
      doc.querySelectorAll(`[${SETTINGS_NAV_ATTR}], [${SETTINGS_TOGGLE_ATTR}]`).forEach((node) => node.remove());
    } catch {
      /* never break the host sidebar */
    }
  }
  setNavOpen(false);
}

/** @returns true when the CRM's Settings link was found (arrow in place). */
export function syncSidebarSettingsNav(options: SidebarSettingsNavOptions): boolean {
  if (typeof window === 'undefined') return false;
  const { groups, activeTab, expanded, onSelect, onToggle, pluginId = CRM_PLUGIN_ID } = options;
  const tabs = groups.flatMap((group) => group.tabs);
  const key = tabs.map((t) => `${t.id}=${t.label}`).join('|');
  let found = false;
  let open = false;

  for (const doc of sidebarDocs()) {
    try {
      const existing = doc.querySelector<HTMLElement>(`[${SETTINGS_NAV_ATTR}]`);
      const settingsLink = tabs.length ? findSettingsLink(doc, pluginId) : null;
      if (!settingsLink) {
        existing?.remove();
        doc.querySelectorAll(`[${SETTINGS_TOGGLE_ATTR}]`).forEach((node) => node.remove());
        continue;
      }
      found = true;
      syncToggle(doc, settingsLink, expanded, onToggle);

      if (!expanded) {
        existing?.remove();
        continue;
      }

      let wrapper = existing;
      const upToDate =
        wrapper && wrapper.getAttribute(SETTINGS_NAV_ATTR) === key && wrapper.previousElementSibling === settingsLink;
      if (!upToDate) {
        wrapper?.remove();
        wrapper = buildWrapper(doc, tabs, key, settingsLink, onSelect, pluginId);
        settingsLink.after(wrapper);
      }

      wrapper!.querySelectorAll<HTMLAnchorElement>(`a[${SETTINGS_TAB_ATTR}]`).forEach((item) => {
        const current = item.getAttribute(SETTINGS_TAB_ATTR) === activeTab;
        for (const [prop, value] of Object.entries(ACTIVE_STYLE)) {
          item.style[prop as keyof typeof ACTIVE_STYLE] = current ? value : '';
        }
        const dot = item.querySelector<HTMLElement>('[data-crm-dot]');
        if (dot) {
          dot.style.opacity = current ? '1' : '.45';
          dot.style.backgroundColor = current ? 'hsl(var(--primary))' : 'currentColor';
        }
        if (current) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
      open = true;
    } catch {
      /* never break the host sidebar */
    }
  }
  setNavOpen(open);
  return found;
}

/** The up / down arrow at the right end of the Settings link. */
function syncToggle(doc: Document, settingsLink: HTMLAnchorElement, expanded: boolean, onToggle: () => void): void {
  let toggle = settingsLink.querySelector<HTMLElement>(`[${SETTINGS_TOGGLE_ATTR}]`);
  if (!toggle) {
    toggle = doc.createElement('span');
    toggle.setAttribute(SETTINGS_TOGGLE_ATTR, '');
    toggle.setAttribute('role', 'button');
    toggle.tabIndex = 0;
    Object.assign(toggle.style, {
      marginLeft: 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '22px',
      height: '22px',
      borderRadius: '6px',
      flexShrink: '0',
      cursor: 'pointer',
      opacity: '.7',
    });
    const fire = (event: Event) => {
      // The arrow only opens / closes the sub-menu; the Settings link must not navigate.
      event.preventDefault();
      event.stopPropagation();
      onToggleRef.get(toggle!)?.();
    };
    toggle.addEventListener('click', fire);
    toggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') fire(event);
    });
    toggle.addEventListener('mouseenter', () => (toggle!.style.backgroundColor = 'hsl(var(--muted))'));
    toggle.addEventListener('mouseleave', () => (toggle!.style.backgroundColor = ''));
    settingsLink.append(toggle);
  }
  onToggleRef.set(toggle, onToggle);
  const state = expanded ? 'open' : 'closed';
  if (toggle.getAttribute('data-state') !== state) {
    toggle.setAttribute('data-state', state);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Hide settings sections' : 'Show settings sections');
    toggle.title = expanded ? 'Hide settings sections' : 'Show settings sections';
    toggle.innerHTML = iconSvg(expanded ? CHEVRON_UP : CHEVRON_DOWN, 16);
  }
}

/** Latest toggle callback per arrow element (the arrow outlives a render). */
const onToggleRef = new WeakMap<HTMLElement, () => void>();

function buildWrapper(
  doc: Document,
  tabs: Array<{ id: string; label: string }>,
  key: string,
  settingsLink: HTMLAnchorElement,
  onSelect: (tabId: string) => void,
  pluginId: string
): HTMLElement {
  const view = doc.defaultView || window;
  // Native look: the class of an inactive CRM link (Settings itself may be the active one).
  const base = runtimeBase(pluginId);
  const inactiveSample = Array.from(doc.querySelectorAll<HTMLAnchorElement>(`a[href^="${base}/"]`)).find(
    (a) =>
      a !== settingsLink &&
      !a.hasAttribute(SETTINGS_TAB_ATTR) &&
      !a.hasAttribute('data-crm-extension-page') &&
      a.getAttribute('aria-current') !== 'page' &&
      a.offsetParent !== null
  );
  const itemClass = (inactiveSample || settingsLink).className;

  const wrapper = doc.createElement('div');
  wrapper.setAttribute(SETTINGS_NAV_ATTR, key);
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', 'CRM settings sections');
  Object.assign(wrapper.style, { display: 'flex', flexDirection: 'column', gap: '1px', margin: '2px 0 6px' });

  for (const tab of tabs) {
    const href = `${settingsPath(pluginId)}?tab=${encodeURIComponent(tab.id)}`;
    const item = doc.createElement('a');
    item.href = href;
    item.className = itemClass;
    item.setAttribute(SETTINGS_TAB_ATTR, tab.id);
    item.style.paddingLeft = '2.25rem';
    item.style.fontSize = '13px';

    const dot = doc.createElement('span');
    dot.setAttribute('data-crm-dot', '');
    dot.setAttribute('aria-hidden', 'true');
    Object.assign(dot.style, {
      display: 'inline-block',
      width: '6px',
      height: '6px',
      borderRadius: '999px',
      backgroundColor: 'currentColor',
      opacity: '.45',
      marginRight: '10px',
      flexShrink: '0',
    });
    const label = doc.createElement('span');
    label.textContent = tab.label;
    item.append(dot, label);

    item.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // new tab etc.
      event.preventDefault();
      event.stopPropagation();
      try {
        view.history.replaceState(view.history.state, '', href);
      } catch {
        /* URL update is best-effort */
      }
      onSelect(tab.id);
    });
    wrapper.append(item);
  }
  return wrapper;
}

/** The ?tab= of the CMS URL while it shows the CRM Settings page, else ''. */
export function readCmsSettingsTab(pluginId = CRM_PLUGIN_ID): string {
  try {
    const url = new URL(window.parent.location.href);
    if (url.pathname.replace(/\/+$/, '') !== settingsPath(pluginId)) return '';
    return url.searchParams.get('tab') || '';
  } catch {
    return '';
  }
}

/** Keep the CMS URL's ?tab= in step with the open Settings tab (reload and copied links). */
export function writeCmsSettingsTab(tab: string, pluginId = CRM_PLUGIN_ID): void {
  try {
    const view = window.parent;
    const url = new URL(view.location.href);
    if (url.pathname.replace(/\/+$/, '') !== settingsPath(pluginId)) return;
    if (url.searchParams.get('tab') === tab) return;
    url.searchParams.set('tab', tab);
    view.history.replaceState(view.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* URL update is best-effort */
  }
}
