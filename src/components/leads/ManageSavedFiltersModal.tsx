import React, { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { SavedLeadFilter } from '../../types/leads';

interface ManageSavedFiltersModalProps {
  open: boolean;
  onClose: () => void;
  savedFilters: SavedLeadFilter[];
  onFiltersChanged: (updated: SavedLeadFilter[]) => void;
}

export const ManageSavedFiltersModal: React.FC<ManageSavedFiltersModalProps> = ({
  open,
  onClose,
  savedFilters,
  onFiltersChanged,
}) => {
  const { alert, confirm } = useDialog();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!open) return null;

  const handleSetDefault = async (filterId: string) => {
    setBusyId(filterId);
    try {
      await crmApi.updateSavedLeadFilter(filterId, { isDefault: true });
      const res = await crmApi.getSavedLeadFilters();
      onFiltersChanged(res.data || []);
    } catch (err: unknown) {
      void alert(err instanceof Error ? err.message : 'Failed to set default preset');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (filter: SavedLeadFilter) => {
    if (!(await confirm({ message: `Are you sure you want to delete the saved filter "${filter.name}"?`, tone: 'danger', confirmLabel: 'Delete' }))) {
      return;
    }
    setBusyId(filter.id);
    try {
      await crmApi.deleteSavedLeadFilter(filter.id);
      const res = await crmApi.getSavedLeadFilters();
      onFiltersChanged(res.data || []);
    } catch (err: unknown) {
      void alert(err instanceof Error ? err.message : 'Failed to delete preset');
    } finally {
      setBusyId(null);
    }
  };

  const formatCriteria = (filters?: Record<string, string>) => {
    if (!filters) return 'All Leads';
    const crit: string[] = [];
    if (filters.stage) crit.push(`Stage: ${filters.stage}`);
    if (filters.status) crit.push(`Status: ${filters.status}`);
    if (filters.source) crit.push(`Source: ${filters.source}`);
    if (filters.matchScore) {
      const matchLabels: Record<string, string> = {
        unscored: 'Not scored',
        strong: 'Strong (?80%)',
        partial: 'Partial (55�79%)',
        weak: 'Weak (30�54%)',
        poor: 'Poor (<30%)',
        scored: 'Scored',
      };
      crit.push(`Match %: ${matchLabels[filters.matchScore] || filters.matchScore}`);
    } else if (filters.tag) {
      crit.push(`Tag: ${filters.tag}`);
    }
    if (filters.search) crit.push(`Search: "${filters.search}"`);
    return crit.length > 0 ? crit.join(' � ') : 'All Leads';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-300 rounded-xl max-w-2xl w-full p-6 relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-1.5 m-0">
              <span>??</span> Manage Saved Lead Filters
            </h2>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              Review, set default presets, or delete saved filters.
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

        <div className="max-h-[380px] overflow-y-auto border border-zinc-200 rounded-lg mb-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-2.5 px-3.5 font-semibold">Preset</th>
                <th className="py-2.5 px-3.5 font-semibold">Criteria</th>
                <th className="py-2.5 px-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {savedFilters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-zinc-400 text-xs italic">
                    No saved filters yet. Create your first preset using the Save button.
                  </td>
                </tr>
              ) : (
                savedFilters.map((f) => (
                  <tr key={f.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-3 px-3.5 align-top">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="font-semibold text-zinc-900">{f.name}</strong>
                        {f.isDefault && (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                            ? DEFAULT
                          </span>
                        )}
                        {f.isShared && (
                          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                            ?? SHARED
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        By: {f.userName || 'User'}
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-zinc-600 text-[11px] align-top">
                      {formatCriteria(f.filters)}
                    </td>

                    <td className="py-3 px-3.5 text-right align-top whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {!f.isDefault && (
                          <button
                            type="button"
                            disabled={busyId === f.id}
                            onClick={() => handleSetDefault(f.id)}
                            className="px-2 py-1 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-[11px] font-semibold rounded cursor-pointer transition-colors"
                            title="Set as default"
                          >
                            ? Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === f.id}
                          onClick={() => handleDelete(f)}
                          className="p-1 text-zinc-400 hover:text-red-600 bg-transparent border-none cursor-pointer transition-colors"
                          title="Delete preset"
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
