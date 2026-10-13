import React, { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import { isValidLiveUrl, normalizeLiveUrl } from '../../types/projects';

export interface LiveLinkModalProps {
  open: boolean;
  projectName?: string;
  /** Prefill when editing an existing live URL */
  initialUrl?: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  /** When true, blur/X/Cancel call onCancel (revert status). Default true. */
  cancelReverts?: boolean;
  onCancel: () => void;
  onConfirm: (liveUrl: string) => Promise<void> | void;
}

/**
 * Reusable modal: require a live URL when moving a project to Live status.
 * Cancel / empty URL → caller reverts status to the previous value.
 */
export const LiveLinkModal: React.FC<LiveLinkModalProps> = ({
  open,
  projectName,
  initialUrl = '',
  title = 'Add live link',
  subtitle,
  submitLabel = 'Save & go Live',
  onCancel,
  onConfirm,
}) => {
  const [value, setValue] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialUrl || '');
      setError(null);
      setLoading(false);
    }
  }, [open, initialUrl]);

  if (!open) return null;

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Live URL is required. Cancel to keep the previous status.');
      return;
    }
    if (!isValidLiveUrl(trimmed)) {
      setError('Enter a valid URL (e.g. https://example.com).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(normalizeLiveUrl(trimmed));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save live link');
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const defaultSubtitle = projectName
    ? `Project “${projectName}” is going Live. Add the public URL to share with the client.`
    : 'Add the public URL to share with the client.';

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        className="bg-white border border-zinc-300 rounded-xl max-w-md w-full p-5 shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-link-modal-title"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <LinkIcon sx={{ fontSize: 20 }} />
            </div>
            <div className="min-w-0">
              <h3 id="live-link-modal-title" className="text-sm font-bold text-zinc-950 m-0">
                {title}
              </h3>
              <p className="text-xs text-zinc-500 m-0 mt-1 leading-relaxed">
                {subtitle || defaultSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={handleCancel}
            className="p-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-500 cursor-pointer disabled:opacity-50"
            aria-label="Cancel"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5" htmlFor="live-url-input">
              Live URL *
            </label>
            <input
              id="live-url-input"
              type="url"
              required
              autoFocus
              value={value}
              disabled={loading}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://example.com"
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:border-zinc-950 focus:outline-none bg-white text-zinc-900 disabled:bg-zinc-50"
            />
            <span className="block text-[11px] text-zinc-400 mt-1">
              Required to set status to Live. An email with this link will be sent to the client.
            </span>
            {error ? (
              <span className="block text-[11px] font-medium text-red-600 mt-1">{error}</span>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 mt-1">
            <button
              type="button"
              disabled={loading}
              onClick={handleCancel}
              className="px-3.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 cursor-pointer font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-1.5 text-xs text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg border-0 cursor-pointer font-semibold disabled:opacity-50"
            >
              {loading ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
