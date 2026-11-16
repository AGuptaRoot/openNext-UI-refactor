import { CRM_PLUGIN_ID, runtimeBase } from './extensionPageRoute';
import { __iconData as layoutDashboard } from 'lucide-react/dist/esm/icons/layout-dashboard.mjs';
import { __iconData as chartColumn } from 'lucide-react/dist/esm/icons/chart-column.mjs';
import { __iconData as magnet } from 'lucide-react/dist/esm/icons/magnet.mjs';
import { __iconData as contactRound } from 'lucide-react/dist/esm/icons/contact-round.mjs';
import { __iconData as building2 } from 'lucide-react/dist/esm/icons/building-complex.mjs';
import { __iconData as target } from 'lucide-react/dist/esm/icons/target.mjs';
import { __iconData as packageOpen } from 'lucide-react/dist/esm/icons/package-open.mjs';
import { __iconData as filePenLine } from 'lucide-react/dist/esm/icons/file-pen-line.mjs';
import { __iconData as shoppingCart } from 'lucide-react/dist/esm/icons/shopping-cart.mjs';
import { __iconData as receiptText } from 'lucide-react/dist/esm/icons/receipt-text.mjs';
import { __iconData as banknote } from 'lucide-react/dist/esm/icons/banknote.mjs';
import { __iconData as folderKanban } from 'lucide-react/dist/esm/icons/folder-kanban.mjs';
import { __iconData as squareCheckBig } from 'lucide-react/dist/esm/icons/square-check-big.mjs';
import { __iconData as timer } from 'lucide-react/dist/esm/icons/timer.mjs';
import { __iconData as wallet } from 'lucide-react/dist/esm/icons/wallet.mjs';
import { __iconData as shieldCheck } from 'lucide-react/dist/esm/icons/shield-check.mjs';
import { __iconData as ticket } from 'lucide-react/dist/esm/icons/ticket.mjs';
import { __iconData as heartHandshake } from 'lucide-react/dist/esm/icons/heart-handshake.mjs';
import { __iconData as megaphone } from 'lucide-react/dist/esm/icons/megaphone.mjs';
import { __iconData as scrollText } from 'lucide-react/dist/esm/icons/scroll-text.mjs';
import { __iconData as settings } from 'lucide-react/dist/esm/icons/settings.mjs';
import { __iconData as handshake } from 'lucide-react/dist/esm/icons/handshake.mjs';
import { __iconData as chevronDown } from 'lucide-react/dist/esm/icons/chevron-down.mjs';
import { __iconData as chevronUp } from 'lucide-react/dist/esm/icons/chevron-up.mjs';

/**
 * Icons for the CRM's links in the CMS sidebar.
 *
 * The CMS resolves a plugin's adminNav icon names from a short list of its own
 * and shows a puzzle piece for every other name, so most CRM links would look
 * the same. The CRM swaps in its own icon for each module here (the inner SVG
 * only: the CMS keeps its size and colour classes on the <svg>).
 */

type IconData = typeof settings;

/** CRM route id (manifest adminNav id) → icon. */
const MODULE_ICONS: Record<string, IconData> = {
  dashboard: layoutDashboard,
  reports: chartColumn,
  leads: magnet,
  contacts: contactRound,
  clients: building2,
  opportunities: target,
  samples: packageOpen,
  quotations: filePenLine,
  'sales-orders': shoppingCart,
  invoices: receiptText,
  payments: banknote,
  projects: folderKanban,
  tasks: squareCheckBig,
  'time-logs': timer,
  expenses: wallet,
  'data-quality': shieldCheck,
  tickets: ticket,
  'customer-success': heartHandshake,
  marketing: megaphone,
  audit: scrollText,
  settings,
};

/** The CRM's own group header in the CMS sidebar. */
const GROUP_ICON = handshake;

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function innerSvg(icon: IconData): string {
  return icon.node
    .map(([tag, attrs]) => {
      const text = Object.entries(attrs)
        .filter(([name]) => name !== 'key')
        .map(([name, value]) => `${name}="${escapeAttr(String(value))}"`)
        .join(' ');
      return `<${tag} ${text}/>`;
    })
    .join('');
}

/** A complete Lucide-style <svg> string (stroke icons, currentColor). */
export function iconSvg(icon: IconData, size = 16, className = ''): string {
  const cls = className ? ` class="${escapeAttr(className)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls}>${innerSvg(icon)}</svg>`;
}

export const CHEVRON_DOWN = chevronDown;
export const CHEVRON_UP = chevronUp;

/** Replace the drawing inside an <svg> the CMS rendered; its own classes and size stay. */
function paint(svg: SVGElement, name: string, icon: IconData): void {
  if (svg.getAttribute('data-crm-icon') === name) return;
  svg.innerHTML = innerSvg(icon);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('data-crm-icon', name);
}

function moduleIdFromHref(href: string, base: string): string {
  if (!href.startsWith(`${base}/`)) return '';
  return decodeURIComponent(href.slice(base.length + 1).split(/[/?#]/)[0] || '');
}

/** Apply the CRM icons to the CRM's links (and its group header) in every reachable sidebar. */
export function syncSidebarCrmIcons(pluginId = CRM_PLUGIN_ID): void {
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

  const base = runtimeBase(pluginId);
  for (const doc of docs) {
    try {
      let groupHeaderDone = false;
      doc.querySelectorAll<HTMLAnchorElement>(`a[href^="${base}/"]`).forEach((link) => {
        if (link.hasAttribute('data-crm-extension-page') || link.hasAttribute('data-crm-settings-tab')) return;
        const id = moduleIdFromHref(link.getAttribute('href') || '', base);
        const icon = MODULE_ICONS[id];
        const svg = link.querySelector<SVGElement>(':scope > svg');
        if (icon && svg) paint(svg, id, icon);

        // The group header is the collapsible trigger that controls the list holding these links.
        if (groupHeaderDone) return;
        let node: HTMLElement | null = link.parentElement;
        for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
          if (!node.id) continue;
          const trigger = doc.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(node.id)}"]`);
          const headerSvg = trigger?.querySelector<SVGElement>('svg');
          if (headerSvg) {
            paint(headerSvg, 'crm', GROUP_ICON);
            groupHeaderDone = true;
            break;
          }
        }
      });
    } catch {
      /* never break the host sidebar */
    }
  }
}
