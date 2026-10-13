import React, { useId, useRef, useState } from 'react';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';

export interface FileUploadFieldProps {
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  /** Button label. Default: "Choose file" */
  buttonLabel?: string;
  /** Optional helper text under the control */
  hint?: string;
  /** Controlled selected file name (skip local tracking when set) */
  fileName?: string | null;
  className?: string;
  /** Smaller button for dense tables */
  compact?: boolean;
  /** Clear native input after change (useful when re-selecting same file) */
  clearAfterChange?: boolean;
  id?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  onFileChange: (file: File | null, files: FileList | null) => void | Promise<void>;
}

/**
 * Styled file picker — hides the native "Choose file" control and shows
 * a CRM-consistent bordered button + selected filename.
 */
export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  accept,
  disabled = false,
  multiple = false,
  buttonLabel = 'Choose file',
  hint,
  fileName,
  className = '',
  compact = false,
  clearAfterChange = false,
  id,
  inputRef,
  onFileChange,
}) => {
  const autoId = useId();
  const inputId = id || autoId;
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const [localName, setLocalName] = useState<string | null>(null);
  const displayName = fileName !== undefined ? fileName : localName;

  const buttonClass = compact
    ? 'inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 cursor-pointer'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 cursor-pointer';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <input
          ref={ref}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          multiple={multiple}
          className="hidden"
          onChange={async (e) => {
            const files = e.target.files;
            const file = files?.[0] ?? null;
            if (fileName === undefined) setLocalName(file?.name ?? null);
            try {
              await onFileChange(file, files);
            } finally {
              if (clearAfterChange) e.target.value = '';
            }
          }}
        />
        <label
          htmlFor={inputId}
          aria-disabled={disabled}
          className={`${buttonClass}${disabled ? ' opacity-50 pointer-events-none' : ''}`}
        >
          <UploadFileOutlinedIcon sx={{ fontSize: compact ? 14 : 16 }} />
          {buttonLabel}
        </label>
        <span className={`truncate text-zinc-500 ${compact ? 'text-[10px] max-w-[140px]' : 'text-xs max-w-[240px]'}`}>
          {displayName || 'No file chosen'}
        </span>
      </div>
      {hint ? <p className="m-0 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
};
