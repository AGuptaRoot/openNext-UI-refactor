import React, { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { crmApi } from '../../services/api';
import { SavedLeadFilter } from '../../types/leads';

interface SaveLeadFilterModalProps {
  open: boolean;
  onClose: () => void;
  activeFilters: {
    stage?: string;
    status?: string;
    source?: string;
    tag?: string;
    matchScore?: string;
    search?: string;
  };
  onSaved: (newFilter: SavedLeadFilter) => void;
}

export const SaveLeadFilterModal: React.FC<SaveLeadFilterModalProps> = ({
  open,
  onClose,
  activeFilters,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setIsDefault(false);
      setIsShared(false);
      setError(null);
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const criteriaList: string[] = [];
  if (activeFilters.stage) criteriaList.push(`Stage: ${activeFilters.stage}`);
  if (activeFilters.status) criteriaList.push(`Status: ${activeFilters.status}`);
  if (activeFilters.source) criteriaList.push(`Source: ${activeFilters.source}`);
  if (activeFilters.matchScore) {
    const matchLabels: Record<string, string> = {
      unscored: 'Not scored',
      strong: 'Strong (?80%)',
      partial: 'Partial (55�79%)',
      weak: 'Weak (30�54%)',
      poor: 'Poor (<30%)',
      scored: 'Scored',
    };
    criteriaList.push(
      `Match %: ${matchLabels[activeFilters.matchScore] || activeFilters.matchScore}`
    );
  } else if (activeFilters.tag) {
    criteriaList.push(`Tag: ${activeFilters.tag}`);
  }
  if (activeFilters.search) criteriaList.push(`Search: "${activeFilters.search}"`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Preset name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await crmApi.createSavedLeadFilter({
        name: name.trim(),
        filters: {
          stage: activeFilters.stage || '',
          status: activeFilters.status || '',
          source: activeFilters.source || '',
          matchScore: activeFilters.matchScore || '',
          search: activeFilters.search || '',
        },
        isDefault,
        isShared,
      });

      onSaved(res.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save filter preset');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-300 rounded-xl max-w-md w-full p-6 relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-1.5 m-0">
              <span>??</span> Save Filter Preset
            </h2>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              Save your active filter criteria for 1-click access anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 bg-transparent border-none cursor-pointer p-1"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Preset Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hot Tech Leads in Negotiation"
              className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 bg-white text-zinc-900 outline-none focus:border-zinc-950"
            />
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
            <span className="block text-[11px] font-semibold text-zinc-600 mb-2">
              Active Filter Criteria Being Saved:
            </span>
            {criteriaList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {criteriaList.map((crit, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center text-[11px] font-medium bg-white text-zinc-800 border border-zinc-200 px-2.5 py-1 rounded-md"
                  >
                    {crit}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-400 italic">
                All leads (no active filters)
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2.5 py-1">
            <label className="inline-flex items-center gap-2.5 text-xs text-zinc-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-zinc-950 focus:ring-0 cursor-pointer"
              />
              <span>
                ? <strong>Set as my default filter</strong> (Loads automatically on page open)
              </span>
            </label>

            <label className="inline-flex items-center gap-2.5 text-xs text-zinc-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-zinc-950 focus:ring-0 cursor-pointer"
              />
              <span>
                ?? <strong>Share with team</strong> (Visible to all team members)
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 border border-zinc-950 rounded-lg hover:bg-zinc-800 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {saving ? 'Saving�' : 'Save Preset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
