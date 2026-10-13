import React, { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';

export interface AddLeadItemModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  label?: string;
  placeholder?: string;
  hint?: string;
  submitLabel?: string;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}

export const AddLeadItemModal: React.FC<AddLeadItemModalProps> = ({
  open,
  title,
  subtitle,
  label = 'Name *',
  placeholder = 'Enter name…',
  hint,
  submitLabel = 'Save',
  initialValue = '',
  onClose,
  onSubmit,
}) => {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
      setLoading(false);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError('This field cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setValue('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save item';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-white border border-zinc-300 rounded-xl max-w-sm w-full p-5 shadow-none animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 m-0">{title}</h3>
            {subtitle && <p className="text-xs text-zinc-500 m-0 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-500 cursor-pointer disabled:opacity-50"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              {label}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={value}
              disabled={loading}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:border-zinc-950 focus:outline-none bg-white text-zinc-900 disabled:bg-zinc-50"
            />
            {hint && <span className="block text-[11px] text-zinc-400 mt-1">{hint}</span>}
            {error && <span className="block text-[11px] font-medium text-red-600 mt-1">{error}</span>}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 mt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 cursor-pointer font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="px-3.5 py-1.5 text-xs bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg font-semibold cursor-pointer border border-zinc-950 disabled:opacity-50 flex items-center gap-1"
            >
              {loading ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
