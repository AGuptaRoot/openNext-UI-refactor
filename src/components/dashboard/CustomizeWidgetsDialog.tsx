import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CloseIcon from '@mui/icons-material/Close';
import { SectionDefinition } from '../../types/dashboard';

interface CustomizeWidgetsDialogProps {
  open: boolean;
  onClose: () => void;
  sections: SectionDefinition[];
  enabledSections: string[];
  allowedSections: string[];
  defaultSections: string[];
  onSave: (newEnabled: string[]) => void;
}

export const CustomizeWidgetsDialog: React.FC<CustomizeWidgetsDialogProps> = ({
  open,
  onClose,
  sections,
  enabledSections,
  allowedSections,
  defaultSections,
  onSave,
}) => {
  const [selected, setSelected] = useState<string[]>(enabledSections);

  useEffect(() => {
    setSelected(enabledSections);
  }, [enabledSections, open]);

  const handleToggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    setSelected(defaultSections);
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  // Group sections by category
  const visibleSections = sections.filter((s) => allowedSections.includes(s.id));
  const categories = Array.from(new Set(visibleSections.map((s) => s.category)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'rounded-2xl border border-zinc-200 bg-white shadow-none overflow-hidden max-h-[85vh]',
      }}
    >
      <DialogContent className="p-0">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between" data-tour="dashboard-customize-dialog">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-950 text-white flex items-center justify-center flex-shrink-0">
              <TuneIcon sx={{ fontSize: 18 }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 m-0 leading-tight">
                Customize Dashboard
              </h3>
              <p className="text-xs text-zinc-500 m-0 mt-0.5">
                Enable or hide sections tailored to your daily workflow.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-950 bg-transparent border-none cursor-pointer"
            >
              <RestartAltIcon sx={{ fontSize: 15 }} />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center border-none cursor-pointer"
            >
              <CloseIcon sx={{ fontSize: 15 }} />
            </button>
          </div>
        </div>

        {/* Categories & Sections */}
        <div className="p-6 overflow-y-auto max-h-[60vh] flex flex-col gap-6">
          {categories.map((cat) => {
            const catSections = visibleSections.filter((s) => s.category === cat);
            const activeCount = catSections.filter((s) => selected.includes(s.id)).length;

            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[11px] font-bold text-zinc-950 uppercase tracking-wider">
                    {cat}
                  </span>
                  <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded border border-zinc-200">
                    {activeCount}/{catSections.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {catSections.map((sec) => {
                    const isChecked = selected.includes(sec.id);
                    return (
                      <div
                        key={sec.id}
                        onClick={() => handleToggle(sec.id)}
                        className={`p-3 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 ${
                          isChecked
                            ? 'border-zinc-950 bg-zinc-50/50'
                            : 'border-zinc-200 bg-white hover:border-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg select-none">{sec.icon}</span>
                          <div>
                            <div className="text-xs font-semibold text-zinc-950 leading-tight">
                              {sec.title}
                            </div>
                            <span className="text-[11px] text-zinc-500 block mt-0.5">
                              {sec.description}
                            </span>
                          </div>
                        </div>

                        {/* Tailwind Toggle Switch */}
                        <div
                          className={`w-9 h-5 rounded-full transition-colors duration-200 ease-in-out p-0.5 flex items-center flex-shrink-0 ${
                            isChecked ? 'bg-zinc-950 justify-end' : 'bg-zinc-300 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white border border-zinc-200 shadow-none" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg border-none cursor-pointer transition-colors"
          >
            Save Layout
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
