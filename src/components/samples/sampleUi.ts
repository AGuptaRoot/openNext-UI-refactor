/**
 * Class tokens for the sample request screens.
 *
 * The detail page and its progress tracker were each inventing their own
 * cards, labels and buttons — zinc-200 next to zinc-300 borders, rounded-2xl
 * next to rounded-xl, four filled button colours in one row. These tokens are
 * the single description of the surface so the whole screen reads as one thing,
 * and they follow the same light-theme language the rest of the CRM uses:
 * white cards on zinc-50, zinc-200 hairlines, zinc-950 as the only primary.
 */

/* ---------------------------------------------------------------- surfaces */

export const CARD = 'rounded-xl border border-zinc-200 bg-white p-5 shadow-sm';
export const HEADER_CARD = 'rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6';

/** Card title row: icon + heading, separated from the body by one hairline. */
export const CARD_HEAD = 'flex items-center gap-2 border-b border-zinc-200 pb-3';
export const CARD_HEAD_BETWEEN =
  'flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3';
export const CARD_TITLE = 'm-0 text-sm font-semibold text-zinc-950';

/** Quiet inset panel for notes and addresses. */
export const NOTE_BOX =
  'm-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800';

/* ------------------------------------------------------------------ fields */

export const FIELD_LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-zinc-500';
/** Same label, with an icon beside it. */
export const FIELD_LABEL_ROW =
  'mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500';
export const FIELD_VALUE = 'text-sm font-medium text-zinc-900';
export const FIELD_VALUE_STRONG = 'text-sm font-semibold text-zinc-950';
export const FIELD_VALUE_MUTED = 'text-sm text-zinc-600';
export const FIELD_EMPTY = 'text-sm text-zinc-400';

export const INPUT =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950';

/* ----------------------------------------------------------------- buttons */

const BTN_BASE =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * One filled button per state — the action the page is waiting for. Everything
 * else is an outline, so the eye lands on the next step rather than on whoever
 * picked the brightest colour.
 */
export const BTN_PRIMARY = `${BTN_BASE} border-0 bg-zinc-950 text-white shadow-sm hover:bg-zinc-800`;
export const BTN_CONFIRM = `${BTN_BASE} border-0 bg-zinc-950 text-white shadow-sm hover:bg-zinc-800`;
export const BTN_SECONDARY = `${BTN_BASE} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`;
export const BTN_DANGER_QUIET = `${BTN_BASE} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100`;

/** Toolbar buttons sit above the header card and stay visually lighter. */
export const BTN_TOOLBAR =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 cursor-pointer hover:bg-zinc-50';

/** Text-only action inside a field, e.g. "Change" next to the stock address. */
export const BTN_INLINE =
  'border-0 bg-transparent p-0 text-[11px] font-semibold text-zinc-950 underline cursor-pointer hover:text-zinc-700';

/** One accent for every link on these screens. */
export const LINK =
  'inline-flex items-center gap-1 text-sm font-semibold text-zinc-950 no-underline hover:underline cursor-pointer';
export const LINK_SMALL =
  'inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 no-underline hover:underline cursor-pointer';

/* -------------------------------------------------------- stats and tables */

export const STAT_CARD = 'rounded-xl border border-zinc-200 bg-white p-4 shadow-sm';
export const STAT_LABEL =
  'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500';
export const STAT_VALUE = 'truncate text-sm font-bold text-zinc-900';
export const STAT_HINT = 'mt-0.5 text-xs text-zinc-500';

export const TABLE_WRAP = 'overflow-hidden rounded-lg border border-zinc-200';
export const TABLE = 'w-full text-left text-xs';
export const TABLE_HEAD = 'border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600';
export const TABLE_TH = 'px-3 py-2';
export const TABLE_TD = 'px-3 py-2';

/* ------------------------------------------------------------------ badges */

export const BADGE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold';

/* ------------------------------------------------------------------ modals */

export const MODAL_BACKDROP =
  'fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4';
export const MODAL_PANEL = 'rounded-xl border border-zinc-200 bg-white shadow-xl';
export const MODAL_HEAD = 'flex items-start justify-between gap-3 border-b border-zinc-200 p-5';
export const MODAL_TITLE = 'm-0 text-base font-semibold text-zinc-950';
export const MODAL_SUBTITLE = 'm-0 mt-1 text-xs text-zinc-500';
export const MODAL_FOOT = 'flex justify-end gap-2 border-t border-zinc-200 p-5';
