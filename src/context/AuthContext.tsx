import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { crmApi, isCrmMockModeEnabled } from '../services/api';
import { CrmFeatureFlags, CrmRole, UserContext } from '../types/dashboard';
import { canUseCrmTours, userCanAssignTickets, userHasPermission } from '../utils/permissions';
import { roleHasPermission } from '../utils/rolePermissions';

interface AuthContextValue {
  user: UserContext | null;
  loading: boolean;
  error: string | null;
  /** Resolved CRM role from CMS/session — not switchable. */
  activeRole: CrmRole;
  isClient: boolean;
  /**
   * Which portal this login is, when it is one.
   *
   * `client` is a real account with the full portal. `lead` is a prospect whose
   * deal was opened to the portal: their own deal, quotations and samples, and
   * none of the account-level features (support tickets, satisfaction reviews,
   * projects, invoices). `null` means this is not a portal login.
   */
  portalKind: 'client' | 'lead' | null;
  /** True for a prospect portal — the narrow case above. */
  isLeadPortal: boolean;
  isAdmin: boolean;
  /**
   * Tenant feature switches, always present — everything is off until the
   * server says otherwise, so a failed `/me` never exposes a feature.
   */
  features: CrmFeatureFlags;
  /** Super Admin / CRM Manager only — Beacon & Module tours. */
  canUseTours: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  canAssignTickets: boolean;
  refreshAuth: () => Promise<void>;
}

const LEGACY_PREVIEW_STORAGE_KEY = 'openext_crm_dashboard_active_role';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function resolveOpenNextRole(me: UserContext | null): CrmRole {
  if (!me) return 'crm-employee';
  if (me.isClientUser || me.isClient) return 'client';

  // Platform / CMS admins always map to CRM Manager (before tenant/plugin role tokens).
  if (me.isAdmin) return 'crm-manager';

  const candidates = [
    me.tenantRole,
    me.role,
    ...(Array.isArray(me.roles) ? me.roles : []),
  ].filter((r) => r !== undefined && r !== null && String(r).trim() !== '');

  for (const raw of candidates) {
    // Mirror openext-crm-suite/api/utils/tenant-role.util.js normalizeTenantRoleKey
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      if (raw <= 1 || raw === 100) return 'crm-manager';
      if (raw === 2 || raw === 101) return 'sales-manager';
      if (raw === 3 || raw === 102) return 'sales-representative';
      if (raw === 103) return 'project-manager';
      if (raw === 104) return 'crm-employee';
      if (raw === 105) return 'finance-manager';
      // Legacy support-agent (106) / user-agent (107) → employee
      if (raw === 106 || raw === 107) return 'crm-employee';
    }

    const s = String(raw).trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (
      s === '0' ||
      s === '1' ||
      s === '100' ||
      s === 'tenant-admin' ||
      s === 'crm-manager' ||
      s === 'admin' ||
      s === 'superadmin' ||
      s === 'super-admin' ||
      s === 'owner'
    ) {
      return 'crm-manager';
    }
    if (s === '2' || s === '101' || s === 'sales-manager') return 'sales-manager';
    if (
      s === '3' ||
      s === '102' ||
      s === 'sales-rep' ||
      s === 'sales-agent' ||
      s === 'sales-representative' ||
      s === 'author' ||
      s === 'viewer'
    ) {
      return 'sales-representative';
    }
    if (s === '103' || s === 'project-manager') return 'project-manager';
    if (s === '104' || s === 'crm-employee' || s === 'employee' || s === 'freelancer') {
      return 'crm-employee';
    }
    if (s === '105' || s === 'finance-manager' || s === 'accountant') return 'finance-manager';
    if (
      s === '106' ||
      s === '107' ||
      s === 'support-agent' ||
      s === 'user-agent'
    ) {
      return 'crm-employee';
    }
    if (s === 'client' || s.includes('client') || s.includes('customer') || s.includes('portal')) {
      return 'client';
    }
    if (
      s === 'crm-manager' ||
      s === 'sales-manager' ||
      s === 'sales-representative' ||
      s === 'project-manager' ||
      s === 'crm-employee' ||
      s === 'finance-manager' ||
      s === 'client'
    ) {
      return s as CrmRole;
    }
  }

  return 'crm-employee';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Drop legacy Admin Preview selection so old devices cannot keep a fake role.
    try {
      localStorage.removeItem(LEGACY_PREVIEW_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchUserContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await crmApi.getMe();
      setUser(response.data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to authenticate user context';
      setError(errorMsg);
      // Fail closed on live CMS. Fake admin is opt-in demo mode only.
      if (isCrmMockModeEnabled()) {
        setUser({
          userId: 'dev-admin',
          username: 'Admin User',
          email: 'admin@opennext.local',
          role: 'crm-manager',
          roles: ['crm-manager'],
          permissions: ['*'],
          isAdmin: true,
          tenant: { id: 'default', name: 'Root CRM Demo Tenant' },
          tenantRole: 'crm-manager',
          isSalesAgentScoped: false,
          isEmployeeScoped: false,
          isClientUser: false,
          isClient: false,
          clientId: null,
          portalKind: null,
          unlinkedClient: false,
        });
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserContext();
  }, [fetchUserContext]);

  const activeRole = resolveOpenNextRole(user);
  const isClient = activeRole === 'client' || Boolean(user?.isClientUser || user?.isClient);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (isClient) {
        // Portal users must never receive mutating grants via role-catalog fallback.
        if (
          /^crm\.(projects|tasks|leads|contacts|clients|opportunities|orders|finance|quotes|marketing|samples|time|timeLogs)\.(write|delete)$/.test(
            permission
          )
        ) {
          return false;
        }
        if (/^crm\.leads\.convert$/.test(permission)) return false;
        if (/^crm\.expenses\./.test(permission)) return false;
        if (userHasPermission(user, permission)) return true;
        return roleHasPermission(activeRole, permission);
      }
      if (userHasPermission(user, permission)) return true;
      // Fall back to role catalog when membership permissions are incomplete
      // (e.g. Sales Manager should still assign lead activities).
      return roleHasPermission(activeRole, permission);
    },
    [user, activeRole, isClient]
  );

  const hasAnyPermission = useCallback(
    (...permissions: string[]): boolean =>
      permissions.some((permission) => hasPermission(permission)),
    [hasPermission]
  );

  const canAssignTickets = useMemo(
    () => userCanAssignTickets(user, { isClient, activeRole }),
    [user, isClient, activeRole]
  );

  const canUseTours = useMemo(() => canUseCrmTours(user, activeRole), [user, activeRole]);

  const features = useMemo<CrmFeatureFlags>(() => {
    const raw = user?.features;
    const percent = Number(raw?.defaultAdvancePercent);
    const proformaAdvance = Boolean(raw?.proformaAdvance);
    return {
      proformaAdvance,
      quotationAutoAcceptOnPayment:
        proformaAdvance && Boolean(raw?.quotationAutoAcceptOnPayment),
      defaultAdvancePercent: Number.isFinite(percent) && percent > 0 ? percent : 30,
    };
  }, [user?.features]);

  /**
   * A prospect portal is a client-role login the CRM resolved to a lead with a
   * portal-enabled deal. It gets the deal, its quotations and its samples —
   * not the account-level portal.
   */
  const portalKind: 'client' | 'lead' | null = useMemo(() => {
    if (!isClient) return null;
    const fromApi = user?.portalKind;
    if (fromApi === 'client' || fromApi === 'lead') return fromApi;
    return user?.clientId ? 'client' : null;
  }, [isClient, user?.portalKind, user?.clientId]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        activeRole,
        isClient,
        portalKind,
        isLeadPortal: portalKind === 'lead',
        isAdmin: user?.isAdmin ?? false,
        features,
        canUseTours,
        hasPermission,
        hasAnyPermission,
        canAssignTickets,
        refreshAuth: fetchUserContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
