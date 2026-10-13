import React from 'react';
import Dialog from '@mui/material/Dialog';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import BusinessIcon from '@mui/icons-material/Business';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import type { CompanyDiscrepancyDetail } from '../../types/contacts';

export interface CompanyDiscrepancyModalProps {
  open: boolean;
  entityType?: 'lead' | 'contact';
  discrepancy?: CompanyDiscrepancyDetail | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const CompanyDiscrepancyModal: React.FC<CompanyDiscrepancyModalProps> = ({
  open,
  entityType = 'contact',
  discrepancy,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const entityLabel = entityType === 'lead' ? 'Lead' : 'Contact';
  const existingCompany = discrepancy?.existingCompany || 'None';
  const newCompany = discrepancy?.newCompany || 'None';

  const matchedFieldLabel = discrepancy?.matchedField
    ? discrepancy.matchedField === 'email'
      ? 'Email'
      : discrepancy.matchedField === 'phone'
        ? 'Phone'
        : 'Name'
    : 'Contact Detail';

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        },
      }}
    >
      <div className="bg-white p-6 sm:p-7">
        {/* Header Icon + Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <WarningAmberRoundedIcon sx={{ fontSize: 28 }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-zinc-950 m-0">
              Possible duplicate contact found.
            </h2>
            <p className="text-xs text-zinc-600 m-0 mt-1">
              The same contact information already exists under another company.
            </p>
          </div>
        </div>

        {/* Existing vs New Company Box */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 mb-4 text-xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500 font-semibold flex items-center gap-1.5">
              <BusinessIcon sx={{ fontSize: 16 }} />
              Existing Company:
            </span>
            <span className="font-semibold text-zinc-900 bg-white px-2.5 py-1 rounded border border-zinc-200">
              {existingCompany}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500 font-semibold flex items-center gap-1.5">
              <BusinessIcon sx={{ fontSize: 16 }} />
              New Company:
            </span>
            <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              {newCompany}
            </span>
          </div>

          {discrepancy && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200/80">
              <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                <PersonOutlineIcon sx={{ fontSize: 15 }} />
                Matching {matchedFieldLabel}:
              </span>
              <span className="font-mono text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded">
                {discrepancy.matchedValue}
              </span>
            </div>
          )}

          {discrepancy?.existingRecordName && (
            <div className="text-[11px] text-zinc-500 italic">
              Existing record: {discrepancy.existingRecordName} ({discrepancy.entityType === 'lead' ? 'Lead' : 'Contact'})
            </div>
          )}
        </div>

        {/* User Required Notice Text */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 mb-5 text-xs leading-relaxed text-amber-950 font-medium">
          <p className="m-0 mb-2">
            You are creating this <strong>{entityLabel}</strong> based on a different Company Name even though the Name, Email, or Phone already matches an existing contact.
          </p>
          <p className="m-0 font-semibold text-zinc-900">
            Do you want to continue?
          </p>
        </div>

        {/* Action Buttons: [Yes, Create] or [No, Cancel] */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-50"
          >
            No, Cancel
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-xs font-semibold text-white border border-zinc-950 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? 'Creating…' : 'Yes, Create'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
