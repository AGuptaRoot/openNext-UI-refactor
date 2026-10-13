import React from 'react';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';

import { PersonContact, formatContactName } from '../../types/contacts';

interface ContactDuplicateBannerProps {
  duplicates: PersonContact[];
  /** Option 1 — reuse / open an existing matching contact. */
  onUseContact: (contact: PersonContact) => void;
  /** Option 2 — continue and create a new record with the same email/phone/PAN. */
  onCreateNewLead?: () => void;
  /** Button label for each duplicate row (Option 1). */
  actionLabel?: string;
  /** Button label for Option 2. */
  createNewLabel?: string;
  /** Section heading for Option 1. */
  option1Title?: string;
  /** Section heading for Option 2. */
  option2Title?: string;
  /** Helper text under Option 2 heading. */
  option2Description?: React.ReactNode;
  /** Override the alert heading. */
  title?: string;
  /** Override the helper copy under the heading. */
  description?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  /** Optional status line (e.g. “Checking…”) shown above the list. */
  checking?: boolean;
  /** Disable both option buttons while a create is in progress. */
  busy?: boolean;
}

/**
 * Alert when email / mobile / PAN matches an existing contact.
 * Offers two ways to continue:
 * 1) Use / choose existing contact
 * 2) Add as new contact (allow duplicate identifiers)
 */
export const ContactDuplicateBanner: React.FC<ContactDuplicateBannerProps> = ({
  duplicates,
  onUseContact,
  onCreateNewLead,
  actionLabel = 'Use existing contact',
  createNewLabel = 'Add as new contact',
  option1Title = 'Option 1 — Use existing contact',
  option2Title = 'Option 2 — Add as new contact',
  option2Description,
  title,
  description,
  onDismiss,
  className = '',
  checking = false,
  busy = false,
}) => {
  if (!duplicates.length && !checking) return null;

  const heading =
    title ||
    (checking && !duplicates.length
      ? 'Checking for duplicate contacts…'
      : 'Matching contact found');

  return (
    <div
      role="alert"
      className={`bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 ${className}`.trim()}
    >
      <WarningAmberIcon sx={{ fontSize: 20 }} className="text-amber-700 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-xs text-amber-950">
        <strong className="block text-sm font-bold mb-1">{heading}</strong>
        {duplicates.length > 0 ? (
          <>
            <p className="m-0 mb-3 text-amber-900">
              {description ?? (
                <>
                  Same <strong>email</strong>, <strong>mobile</strong> or <strong>PAN</strong> already
                  exists. Choose one option below.
                </>
              )}
            </p>

            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
              <PersonOutlineIcon sx={{ fontSize: 14 }} />
              {option1Title}
            </div>
            <ul className="list-none m-0 mb-3 p-0 flex flex-col gap-2">
              {duplicates.slice(0, 5).map((contact) => (
                <li
                  key={contact._id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-amber-200 rounded-lg px-3 py-2.5"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
                      {contact.photoUrl ? (
                        <img
                          src={contact.photoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (contact.name?.charAt(0) || 'C').toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-zinc-950 block truncate">
                        {formatContactName(contact) || 'Unnamed contact'}
                      </span>
                      {contact.jobTitle ? (
                        <span className="text-[11px] text-zinc-500 block truncate">
                          {contact.jobTitle}
                        </span>
                      ) : null}
                      <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-zinc-600">
                        {contact.email ? (
                          <span className="truncate">
                            <span className="font-semibold text-zinc-500">Email:</span> {contact.email}
                          </span>
                        ) : null}
                        {contact.phone ? (
                          <span className="truncate">
                            <span className="font-semibold text-zinc-500">Mobile:</span>{' '}
                            {contact.phone}
                          </span>
                        ) : null}
                        {contact.pan ? (
                          <span className="truncate">
                            <span className="font-semibold text-zinc-500">PAN:</span> {contact.pan}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onUseContact(contact)}
                    className="shrink-0 px-3.5 py-2 text-[11px] font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  >
                    {actionLabel}
                  </button>
                </li>
              ))}
            </ul>

            {onCreateNewLead ? (
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                  <PersonAddAlt1Icon sx={{ fontSize: 14 }} />
                  {option2Title}
                </div>
                <p className="m-0 mb-2.5 text-[11px] text-zinc-600">
                  {option2Description ?? (
                    <>
                      Creates a <strong>new contact</strong> even if email / mobile / PAN already
                      exist on another contact.
                    </>
                  )}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCreateNewLead()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 text-[11px] font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
                >
                  <PersonAddAlt1Icon sx={{ fontSize: 15 }} />
                  {busy ? 'Creating…' : createNewLabel}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {onDismiss && duplicates.length > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          aria-label="Dismiss duplicate alert"
          className="text-[11px] font-semibold text-amber-900 hover:underline bg-transparent border-none cursor-pointer p-0 disabled:opacity-50"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
};
