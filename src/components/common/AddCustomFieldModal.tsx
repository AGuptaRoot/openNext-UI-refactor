import React, { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';

export interface CustomFieldDefinitionInput {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export interface AddCustomFieldModalProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (field: CustomFieldDefinitionInput) => Promise<void> | void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Single-line Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL / Link' },
  { value: 'select', label: 'Dropdown / Select' },
  { value: 'textarea', label: 'Multi-line Text (Textarea)' },
  { value: 'boolean', label: 'Yes/No (Checkbox)' },
];

export const AddCustomFieldModal: React.FC<AddCustomFieldModalProps> = ({
  open,
  title = 'Add Custom Attribute',
  subtitle = 'Create a new custom field to capture additional entity data.',
  onClose,
  onSubmit,
}) => {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [required, setRequired] = useState(false);
  const [optionsStr, setOptionsStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLabel('');
      setType('text');
      setRequired(false);
      setOptionsStr('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Attribute / field label is required');
      return;
    }

    const key = trimmedLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const options =
      type === 'select'
        ? optionsStr
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

    if (type === 'select' && (!options || options.length === 0)) {
      setError('Please provide at least one comma-separated option for dropdown type');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        key,
        label: trimmedLabel,
        type,
        required,
        options,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create custom attribute';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-white border border-zinc-300 rounded-xl max-w-md w-full p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
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

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Field Label *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={label}
              disabled={loading}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. GST Number, Deal Size, Industry Sector"
              className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 outline-none focus:border-zinc-950 bg-white"
            />
            <span className="text-[10px] text-zinc-400 mt-1 block">
              Unique display label that users will see on forms and profiles.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Data Type
            </label>
            <select
              value={type}
              disabled={loading}
              onChange={(e) => setType(e.target.value)}
              className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 outline-none focus:border-zinc-950 bg-white"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {type === 'select' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Dropdown Options (comma-separated) *
              </label>
              <input
                type="text"
                value={optionsStr}
                disabled={loading}
                onChange={(e) => setOptionsStr(e.target.value)}
                placeholder="Small, Medium, Enterprise, Government"
                className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 outline-none focus:border-zinc-950 bg-white"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={required}
              disabled={loading}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
            />
            <span className="text-xs text-zinc-700 font-medium select-none">
              Mark as mandatory / required field
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg border border-zinc-950 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {loading ? 'Saving…' : 'Save Attribute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
