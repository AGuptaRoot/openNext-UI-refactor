import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';
import { evaluateRouteAccess, type RouteAccessRule } from '../../utils/routeAccess';

interface RequirePermissionProps {
  children: React.ReactNode;
  /** Override auto path lookup — useful for explicit route wrappers. */
  anyOf?: string[];
  denyClient?: boolean;
  label?: string;
}

function AccessDenied({ label, required }: { label: string; required?: string[] }) {
  const moduleDisabled = label.includes('(Module Disabled)');
  const notInExtension = label.includes('(Not in Active Extension)');
  const moduleName = label
    .replace(' (Module Disabled)', '')
    .replace(' (Not in Active Extension)', '');
  return (
    <div className="py-24 px-6 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mb-5">
        <LockOutlinedIcon sx={{ fontSize: 28 }} />
      </div>
      <h2 className="text-2xl font-bold text-zinc-950 mb-2 tracking-tight">
        {moduleDisabled || notInExtension ? 'Module Disabled' : 'Access denied'}
      </h2>
      <p className="text-sm text-zinc-500 mb-2 leading-relaxed">
        {moduleDisabled ? (
          <><strong>{moduleName}</strong> has been turned off by your administrator. You can re-enable it in Settings &rarr; Modules &amp; Features.</>
        ) : notInExtension ? (
          <><strong>{moduleName}</strong> is not part of the active CRM extension. An administrator can switch extensions in Settings &rarr; Extensions.</>
        ) : (
          <>You do not have permission to open <strong>{label}</strong>.</>
        )}
      </p>
      {required && required.length > 0 && (
        <p className="text-xs text-zinc-400 mb-8 m-0">
          Required: {required.join(' or ')}
        </p>
      )}
      {!required?.length && <div className="mb-8" />}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg no-underline"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} />
        <span>Go to Dashboard</span>
      </Link>
    </div>
  );
}

/**
 * Blocks rendering of a page when the current user lacks the required CRM permission(s).
 * If anyOf/denyClient/label are omitted, access is resolved from the current pathname via routeAccess.
 */
export const RequirePermission: React.FC<RequirePermissionProps> = ({
  children,
  anyOf,
  denyClient,
  label,
}) => {
  const location = useLocation();
  const { loading, hasAnyPermission, isClient, activeRole, features } = useAuth();

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-zinc-500">Checking access…</div>
    );
  }

  let allowed: boolean;
  let rule: RouteAccessRule | null = null;

  if (anyOf && anyOf.length > 0) {
    rule = {
      anyOf,
      denyClient,
      label: label || 'this module',
    };
    if (denyClient && isClient) {
      allowed = false;
    } else {
      allowed = hasAnyPermission(...anyOf);
    }
  } else {
    const result = evaluateRouteAccess(location.pathname, {
      hasAnyPermission,
      isClient,
      activeRole,
      features,
    });
    allowed = result.allowed;
    rule = result.rule;
  }

  if (!allowed) {
    return (
      <AccessDenied
        label={rule?.label || label || 'this module'}
        required={rule?.anyOf}
      />
    );
  }

  return <>{children}</>;
};

/** Convenience wrapper for App routes that always uses pathname-based rules. */
export const Guarded: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequirePermission>{children}</RequirePermission>
);
