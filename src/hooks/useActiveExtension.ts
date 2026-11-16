import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_ACTIVE_EXTENSION,
  EMPTY_DECLARATIONS,
  normalizeActiveExtension,
  type ActiveExtensionInfo,
} from '../types/extensions';

/** Mirrors api/utils/extension-permission.util.js (contract §5). */
const EXTENSION_KEY_RE = /^x\.[a-z][a-z0-9_-]{2,31}\.[a-z0-9_.]{2,60}$/;

/** Route ids of the optional modules, keyed by their `/me` feature flag. */
const OPTIONAL_MODULE_ROUTES: Array<{ routeId: string; flag: 'expenses' | 'marketing' | 'customerSuccess' | 'dataQuality' }> = [
  { routeId: 'expenses', flag: 'expenses' },
  { routeId: 'marketing', flag: 'marketing' },
  { routeId: 'customer-success', flag: 'customerSuccess' },
  { routeId: 'data-quality', flag: 'dataQuality' },
];

/**
 * The CRM extension that fixes this tenant's workspace mode
 * (Settings → Extensions) plus the optional-module switches, folded into
 * one "is this module visible?" answer for pages, forms and navigation.
 */
export function useActiveExtension() {
  const { features, hasPermission, isClient } = useAuth();
  const extension: ActiveExtensionInfo = useMemo(
    () => normalizeActiveExtension(features?.activeExtension || DEFAULT_ACTIVE_EXTENSION),
    [features?.activeExtension]
  );
  const modules = features?.modules;

  const hiddenModules = useMemo(() => {
    const hidden = new Set<string>(extension.hiddenModules || []);
    for (const { routeId, flag } of OPTIONAL_MODULE_ROUTES) {
      if (!modules?.[flag]) hidden.add(routeId);
    }
    return hidden;
  }, [extension.hiddenModules, modules]);

  /** True when the sidebar route id (e.g. `projects`, `sales-orders`) is available. */
  const isModuleVisible = useCallback(
    (routeId: string) => !hiddenModules.has(String(routeId || '').trim().toLowerCase()),
    [hiddenModules]
  );

  /**
   * Permission check that understands extension-defined keys (x.<id>.<name>):
   * until roles can be granted them, crm.settings.manage holders have them all.
   * An empty key means "no permission required".
   */
  const canUse = useCallback(
    (key?: string | null) => {
      const wanted = String(key || '').trim();
      if (!wanted) return true;
      if (hasPermission(wanted)) return true;
      if (!EXTENSION_KEY_RE.test(wanted)) return false;
      if (hasPermission('crm.settings.manage')) return true;
      // A defined key may come with a core permission (permissions.defines[].grantedWith).
      const grant = (extension.permissionsDefined || []).find((p) => p.key === wanted)?.grantedWith;
      return Boolean(grant && hasPermission(grant));
    },
    [hasPermission, extension.permissionsDefined]
  );

  /** A declared page this user may open: its permission and its audience (staff / portal / all). */
  const canSeePage = useCallback(
    (page: { permission?: string | null; audience?: string }) => {
      const audience = page.audience || 'all';
      if (audience === 'portal' && !isClient) return false;
      if (audience === 'staff' && isClient) return false;
      return canUse(page.permission);
    },
    [canUse, isClient]
  );

  return {
    extension,
    canSeePage,
    /** json/ declarations of the active extension (empty for built-ins). */
    declarations: extension.declarations || EMPTY_DECLARATIONS,
    /** ui/ bundle info, or null when the active extension ships no UI. */
    ui: extension.ui || null,
    /** api/ info (apiBase, models, trust), or null. */
    backend: extension.backend || null,
    canUse,
    extensionId: extension.id,
    isProduct: extension.id === 'product',
    isProject: extension.id === 'project',
    requestTypeKey: extension.requestTypeKey,
    requestTypeName: extension.requestTypeName,
    hiddenModules,
    isModuleVisible,
    /** Projects, Tasks and Time Logs are one unit: all on or all off. */
    showProjects: !hiddenModules.has('projects'),
    showSalesOrders: !hiddenModules.has('sales-orders'),
    /** A won opportunity converts to a Sales Order (product) or straight to an Invoice (project). */
    canConvertToSalesOrder: Boolean(extension.conversions?.salesOrder) && !hiddenModules.has('sales-orders'),
    canConvertToInvoice: Boolean(extension.conversions?.invoice),
  };
}
