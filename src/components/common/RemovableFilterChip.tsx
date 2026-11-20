import React from 'react';
import CloseIcon from '@mui/icons-material/Close';

/** A small "Location: Surat ×" style chip for a filter that came in from a report drill-down. */
export const RemovableFilterChip: React.FC<{ label: string; onRemove: () => void; title?: string }> = ({
  label,
  onRemove,
  title,
}) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-zinc-800">
    <span>{label}</span>
    <button
      type="button"
      onClick={onRemove}
      title={title || `Remove filter: ${label}`}
      aria-label={title || `Remove filter: ${label}`}
      className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
    >
      <CloseIcon sx={{ fontSize: 14 }} />
    </button>
  </span>
);
