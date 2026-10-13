import React from 'react';

/** Shared page wrapper — Layout already provides equal side padding. */
export const PAGE_SHELL_CLASS = 'flex w-full flex-col gap-5';

/** Module list / table / filter panel — visible zinc-300 border */
export const LIST_PANEL_CLASS = 'bg-white border border-zinc-300 rounded-xl overflow-hidden';
export const FILTER_PANEL_CLASS = 'bg-white border border-zinc-300 rounded-xl p-4';
export const CARD_PANEL_CLASS = 'bg-white border border-zinc-300 rounded-xl';

export interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export const PageShell: React.FC<PageShellProps> = ({ children, className = '' }) => {
  const extra = className.trim();
  return <div className={extra ? `${PAGE_SHELL_CLASS} ${extra}` : PAGE_SHELL_CLASS}>{children}</div>;
};
