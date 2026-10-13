import React from 'react';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_CLASS =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50';

export type TourButtonProps = {
  /**
   * Module slug used for `data-tour` and the restart event.
   * Example: `"tickets"` → `data-tour="tickets-tour-btn"`, event `crm-tickets-tour-restart`.
   */
  moduleId: string;
  /** Button label when `children` is not provided. */
  label?: string;
  title?: string;
  className?: string;
  /**
   * Optional custom restart handler (e.g. `restartLeadsTour`).
   * Defaults to dispatching `crm-${moduleId}-tour-restart`.
   */
  onRestart?: () => void;
  children?: React.ReactNode;
};

/**
 * Shared header “Tour” control. Hides itself when tours are disabled for the user.
 * Tour-only UI — does not call CRM APIs.
 */
export const TourButton: React.FC<TourButtonProps> = ({
  moduleId,
  label = 'Tour',
  title,
  className,
  onRestart,
  children,
}) => {
  const { canUseTours } = useAuth();
  if (!canUseTours) return null;

  const handleClick = () => {
    if (onRestart) {
      onRestart();
      return;
    }
    window.dispatchEvent(new CustomEvent(`crm-${moduleId}-tour-restart`));
  };

  return (
    <button
      type="button"
      data-tour={`${moduleId}-tour-btn`}
      onClick={handleClick}
      title={title || `Restart ${moduleId.replace(/-/g, ' ')} onboarding tour`}
      className={className || DEFAULT_CLASS}
    >
      {children ?? label}
    </button>
  );
};
