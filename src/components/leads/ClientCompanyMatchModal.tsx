import React from 'react';
import Dialog from '@mui/material/Dialog';
import BusinessIcon from '@mui/icons-material/Business';
import type { ClientCompanyMatch } from '../../types/clients';

/**
 * CRM 3.46.0 — Lead create: the company of the NEW contact already exists as a Client.
 * The user decides; nothing is linked because the names match. "Add as Secondary Contact" adds the
 * contact to the chosen Client (no Lead); "Continue Creating Lead" creates the Lead as usual.
 *
 * CRM 3.47.0: CRM theme tokens only (card / foreground / primary / border / muted), so both buttons stay
 * readable in light and dark mode; and the active extension's optional "sync" checkbox (e.g. copy the
 * lead form's Travel Information to the client), shown only when the extension allows it for that client.
 */
export interface LeadFormSyncOption {
  label: string;
  help?: string;
  /** null = still checking for the selected client. */
  available: boolean | null;
  checked: boolean;
}

export interface ClientCompanyMatchModalProps {
  open: boolean;
  matches: ClientCompanyMatch[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAddSecondary: () => void;
  onContinueLead: () => void;
  /**
   * CRM 3.56.0 (lead create only): "Create lead for this client" — the lead is the chosen client's enquiry,
   * so its accepted quotation goes to that client (no second client with the same name).
   */
  onCreateForClient?: () => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  /** The extension's sync checkbox; omitted when the extension offers none. */
  sync?: LeadFormSyncOption | null;
  onSyncChange?: (checked: boolean) => void;
  /**
   * CRM 3.48.0: one modal for Lead create, Client create and Contact create — only the words differ:
   * the "continue" button ("Continue Creating Lead / Client / Contact"), what each choice means, and the
   * contact entered on the form (shown so the user sees who would be added).
   */
  continueLabel?: string;
  addNote?: string;
  continueNote?: string;
  newContact?: { name?: string; email?: string; phone?: string } | null;
}

const panel = 'rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground';

export const ClientCompanyMatchModal: React.FC<ClientCompanyMatchModalProps> = ({
  open,
  matches,
  selectedId,
  onSelect,
  onAddSecondary,
  onContinueLead,
  onCreateForClient,
  onClose,
  loading = false,
  error = null,
  sync = null,
  onSyncChange,
  continueLabel = 'Continue Creating Lead',
  addNote = 'the contact joins this client; no new lead is created. Start the new business from the client.',
  continueNote = 'the same name does not always mean the same client. The lead is created as usual.',
  newContact = null,
}) => {
  const contactLine = newContact ? [newContact.name, newContact.email, newContact.phone].map((v) => String(v || '').trim()).filter(Boolean).join(' · ') : '';
  const selected = matches.find((m) => m.id === selectedId) || matches[0] || null;
  const canAdd = Boolean(selected?.canAddContact);
  const showSync = Boolean(sync && canAdd && sync.available !== false);

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: '16px', overflow: 'hidden', bgcolor: 'var(--card)', color: 'var(--foreground)' },
      }}
    >
      <div className="bg-card p-6 text-foreground sm:p-7" data-testid="client-company-match-modal">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-foreground">
            <BusinessIcon sx={{ fontSize: 26 }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-lg font-bold text-foreground">Existing Client Found</h2>
            <p className="m-0 mt-1 text-sm leading-relaxed text-foreground">
              {selected?.reason === 'contact' ? 'This contact already belongs to Client' : 'This company already exists as Client'}{' '}
              <strong>{selected?.name || ''}</strong>. Do you want to add this Contact as a Secondary Contact?
            </p>
          </div>
        </div>

        {matches.length > 1 ? (
          <div className="mb-4 flex flex-col gap-2" role="radiogroup" aria-label="Matching clients">
            <p className="m-0 text-[11px] font-semibold uppercase text-muted-foreground">Matching clients</p>
            {matches.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm text-foreground ${
                  m.id === selected?.id ? 'border-primary bg-muted' : 'border-border bg-card'
                }`}
              >
                <input
                  type="radio"
                  name="client-company-match"
                  checked={m.id === selected?.id}
                  disabled={loading}
                  onChange={() => onSelect(m.id)}
                />
                <span className="font-semibold">{m.name}</span>
                {m.primaryContactName ? (
                  <span className="text-xs text-muted-foreground">Primary: {m.primaryContactName}</span>
                ) : null}
              </label>
            ))}
          </div>
        ) : selected?.primaryContactName ? (
          <p className={`m-0 mb-4 ${panel}`}>
            Primary contact: <span className="font-semibold text-foreground">{selected.primaryContactName}</span> (stays
            unchanged)
          </p>
        ) : null}

        {contactLine ? (
          <p className={`m-0 mb-4 ${panel}`} data-testid="client-company-match-new-contact">
            Contact entered: <span className="font-semibold text-foreground">{contactLine}</span>
          </p>
        ) : null}

        {showSync && sync ? (
          <label
            className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3"
            data-testid="client-company-match-sync"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={sync.checked}
              disabled={loading || sync.available === null}
              onChange={(e) => onSyncChange?.(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{sync.label}</span>
              {sync.help ? <span className="mt-0.5 block text-xs text-muted-foreground">{sync.help}</span> : null}
              {sync.available === null ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">Checking the client…</span>
              ) : null}
            </span>
          </label>
        ) : null}

        <div className={`mb-5 ${panel}`}>
          <p className="m-0">
            <strong className="text-foreground">Add as Secondary Contact</strong>: {addNote}
          </p>
          {onCreateForClient ? (
            <p className="m-0 mt-1">
              <strong className="text-foreground">Create lead for this client</strong>: the lead is this client’s new
              enquiry. When its quotation is accepted, it goes to this client (no new client is made).
            </p>
          ) : null}
          <p className="m-0 mt-1">
            <strong className="text-foreground">{continueLabel}</strong>: {continueNote}
          </p>
        </div>

        {selected && !canAdd ? (
          <p className="m-0 mb-4 text-xs font-medium text-warning-foreground" data-testid="client-company-match-no-access">
            You don’t have access to add contacts to this client. You can still choose “{continueLabel}”.
          </p>
        ) : null}
        {error ? <p className="m-0 mb-4 text-xs font-medium text-danger-foreground">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onContinueLead}
            className="cursor-pointer rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="client-company-match-continue"
          >
            {continueLabel}
          </button>
          {onCreateForClient ? (
            <button
              type="button"
              disabled={loading || !selected}
              onClick={onCreateForClient}
              className="cursor-pointer rounded-lg border border-primary bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="client-company-match-for-client"
            >
              Create lead for this client
            </button>
          ) : null}
          <button
            type="button"
            disabled={loading || !canAdd}
            onClick={onAddSecondary}
            className="cursor-pointer rounded-lg border border-primary bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="client-company-match-add"
          >
            {loading ? 'Adding…' : 'Add as Secondary Contact'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
