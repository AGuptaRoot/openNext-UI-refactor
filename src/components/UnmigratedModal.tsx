import React from 'react';
import { Dialog, DialogContent } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface UnmigratedModalProps {
  open: boolean;
  moduleName: string;
  onClose: () => void;
}

export const UnmigratedModal: React.FC<UnmigratedModalProps> = ({
  open,
  moduleName,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        className: 'rounded-2xl border border-zinc-200 bg-white p-0 shadow-none overflow-hidden',
      }}
    >
      <DialogContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center flex-shrink-0">
            <InfoOutlinedIcon sx={{ fontSize: 20 }} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950 m-0 leading-tight">
              Module Notice
            </h3>
            <span className="text-xs text-zinc-500">Pilot Application</span>
          </div>
        </div>

        <p className="text-sm font-semibold text-zinc-900 mb-2">
          {moduleName ? `The "${moduleName}" module is not migrated yet.` : 'Module not migrated yet.'}
        </p>

        <p className="text-xs text-zinc-500 leading-relaxed mb-6">
          Dashboard, Reports, Leads, Clients, Opportunities, and Projects are available in this React release. Additional modules (Invoices, Tasks, etc.) will be migrated in subsequent phases.
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg border-none cursor-pointer transition-colors duration-150"
          >
            Understood
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
