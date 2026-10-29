import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import CloseIcon from '@mui/icons-material/Close';

export interface AddLeadFieldOptionModalProps {
  open: boolean;
  fieldLabel: string;
  /** When true, show “Add to Global Catalog” (admin). */
  canPromoteGlobal?: boolean;
  onClose: () => void;
  onSave: (payload: {
    label: string;
    value: string;
    addToGlobalCatalog: boolean;
  }) => Promise<void> | void;
}

/**
 * Reusable modal for adding a selectable option on a Lead commercial form.
 * By default the option is Lead-specific; admins can promote it to the
 * Request Type global catalog.
 */
export const AddLeadFieldOptionModal: React.FC<AddLeadFieldOptionModalProps> = ({
  open,
  fieldLabel,
  canPromoteGlobal = false,
  onClose,
  onSave,
}) => {
  const [label, setLabel] = useState('');
  const [addToGlobalCatalog, setAddToGlobalCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel('');
    setAddToGlobalCatalog(false);
    setSaving(false);
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event?: React.SyntheticEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Option name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        label: trimmed,
        value: trimmed,
        addToGlobalCatalog: canPromoteGlobal && addToGlobalCatalog,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add option');
    } finally {
      setSaving(false);
    }
  };

  const modalNode = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-tour="add-lead-field-option-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-field-option-title"
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="add-lead-field-option-title" className="m-0 text-sm font-bold text-zinc-950">Add new option</h3>
            <p className="mb-0 mt-1 text-xs text-zinc-500">
              For <strong className="text-zinc-800">{fieldLabel}</strong>. Saved for this lead
              only unless you add it to the global catalog.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            aria-label="Close"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Option name</span>
          <input
            autoFocus
            className="h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            placeholder="e.g. Flutter"
            value={label}
            disabled={saving}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                void handleSubmit(e);
              }
            }}
          />
        </label>

        {canPromoteGlobal ? (
          <label className="mb-3 flex items-start gap-2 text-xs font-semibold text-zinc-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={addToGlobalCatalog}
              disabled={saving}
              onChange={(e) => setAddToGlobalCatalog(e.target.checked)}
            />
            <span>
              Add to Global Catalog
              <span className="mt-0.5 block font-medium text-zinc-500">
                Makes this option available for future leads on the same Request Type.
              </span>
            </span>
          </label>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={(e) => void handleSubmit(e)}
            className="inline-flex h-9 items-center rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white disabled:opacity-50 hover:bg-zinc-800"
          >
            {saving ? 'Saving…' : 'Save option'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
