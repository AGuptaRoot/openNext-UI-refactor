/**
 * Workspace-extension pages inside the OpenNext CMS dashboard.
 *
 *   CRM route (react-router)  /ext/<extensionId>/<pageId>
 *   CMS URL                   /dashboard/plugins/runtime/openext-crm-suite/extension/<extensionId>/<pageId>
 *   sync route id             extension/<extensionId>/<pageId>   (useDashboardSidebarSync)
 *
 * The CMS reserves the segment "ext" for its *own* extensions
 * (/runtime/<plugin>/ext/<id>/<page> → "Extension page unavailable"), so CRM
 * workspace extensions use "extension". The CMS mounts the CRM for any other
 * first segment and passes it as ctx.pageId ("extension"); the rest of the
 * path is read from the URL. Older links of the form ext~<id>~<page> still work.
 */

export const CRM_PLUGIN_ID = 'openext-crm-suite';
export const EXTENSION_SEGMENT = 'extension';
const ID_PART = '[a-z][a-z0-9_-]{1,59}';
const LEGACY_SEGMENT_RE = new RegExp(`^ext~(${ID_PART})~(${ID_PART})$`);
const ROUTE_ID_RE = new RegExp(`^${EXTENSION_SEGMENT}/(${ID_PART})/(${ID_PART})$`);
const CRM_ROUTE_RE = new RegExp(`^/ext/(${ID_PART})/(${ID_PART})/?$`);

export function runtimeBase(pluginId = CRM_PLUGIN_ID): string {
  return `/dashboard/plugins/runtime/${encodeURIComponent(pluginId)}`;
}

export function extensionPageCmsPath(extensionId: string, pageId: string, pluginId = CRM_PLUGIN_ID): string {
  return `${runtimeBase(pluginId)}/${EXTENSION_SEGMENT}/${extensionId}/${pageId}`;
}

/** Sync route id for a CRM route, or null when the route is not an extension page. */
export function extensionRouteIdFromCrmPath(crmPath: string): string | null {
  const match = CRM_ROUTE_RE.exec(String(crmPath || '').split('?')[0]);
  return match ? `${EXTENSION_SEGMENT}/${match[1]}/${match[2]}` : null;
}

/** CRM route for a sync route id ("extension/<id>/<page>"), or null. */
export function crmPathFromExtensionRouteId(routeId: string): string | null {
  const match = ROUTE_ID_RE.exec(String(routeId || ''));
  return match ? `/ext/${match[1]}/${match[2]}` : null;
}

/** Path segments after /runtime/<plugin>/ → sync route id, or null. */
export function extensionRouteIdFromRuntimeParts(parts: string[]): string | null {
  const [first, extensionId, pageId] = parts.map((p) => decodeURIComponent(p));
  if (first === EXTENSION_SEGMENT && extensionId && pageId) {
    const id = `${EXTENSION_SEGMENT}/${extensionId}/${pageId}`;
    return ROUTE_ID_RE.test(id) ? id : null;
  }
  const legacy = LEGACY_SEGMENT_RE.exec(first || '');
  return legacy ? `${EXTENSION_SEGMENT}/${legacy[1]}/${legacy[2]}` : null;
}

/**
 * CRM start route when the CMS mounts the CRM with ctx.pageId. For "extension"
 * the page is read from the browser URL; returns null for ordinary pages.
 */
export function crmPathForMount(pageId: string | undefined, pathname: string, pluginId = CRM_PLUGIN_ID): string | null {
  const key = String(pageId || '').trim();
  if (key !== EXTENSION_SEGMENT && !LEGACY_SEGMENT_RE.test(key)) return null;
  const base = runtimeBase(pluginId);
  const suffix = pathname.startsWith(base) ? pathname.slice(base.length) : `/${key}`;
  const routeId = extensionRouteIdFromRuntimeParts(suffix.split('?')[0].split('/').filter(Boolean));
  return routeId ? crmPathFromExtensionRouteId(routeId) : null;
}
