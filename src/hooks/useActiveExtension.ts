import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_ACTIVE_EXTENSION, type ActiveExtensionInfo } from '../types/extensions';

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
  const { features } = useAuth();
  const extension: ActiveExtensionInfo = features?.activeExtension || DEFAULT_ACTIVE_EXTENSION;
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

  return {
    extension,
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
