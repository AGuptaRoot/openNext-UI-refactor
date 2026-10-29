import React, { useEffect, useMemo, useRef, useState } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import { Check } from 'lucide-react';
import {
  CLIENT_AVATAR_COLOR_PRESETS,
  getClientInitials,
  resolveClientMediaUrl,
} from '../../utils/clientAvatar';

/**
 * Searchable lead picker — the lead-side counterpart of `ClientSelect`, so
 * both sides of the Lead/Client toggle look and behave the same.
 */
export interface LeadSelectOption {
  _id: string;
  /** Company / organisation name — the primary label. */
  company?: string;
  /** Contact person name (denormalized on the lead). */
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  avatarUrl?: string;
}

export function normalizeLeadSelectOption(
  raw: Partial<LeadSelectOption> & { _id?: string; id?: string }
): LeadSelectOption | null {
  const id = String(raw._id || raw.id || '').trim();
  if (!id) return null;
  return {
    _id: id,
    company: raw.company ? String(raw.company).trim() : undefined,
    name: raw.name ? String(raw.name).trim() : undefined,
    contactName: raw.contactName ? String(raw.contactName).trim() : undefined,
    email: raw.email ? String(raw.email).trim() : undefined,
    phone: raw.phone ? String(raw.phone).trim() : undefined,
    photoUrl: raw.photoUrl ? String(raw.photoUrl).trim() : undefined,
    avatarUrl: raw.avatarUrl ? String(raw.avatarUrl).trim() : undefined,
  };
}

/** Primary label: company first, falling back to the contact person. */
export function leadPrimaryLabel(lead: LeadSelectOption): string {
  return lead.company || lead.contactName || lead.name || 'Individual Prospect';
}

/** Secondary line: contact person and/or email, whichever is available. */
export function leadSecondaryLabel(lead: LeadSelectOption): string {
  const contact = lead.contactName || lead.name || '';
  const parts = [contact && contact !== lead.company ? contact : '', lead.email || ''].filter(
    Boolean
  );
  return parts.join(' · ') || 'No contact details';
}

/**
 * Leads carry no stored avatar colour, so derive a stable one from the id.
 * Reuses the client palette to keep the two pickers visually consistent.
 */
function leadAvatarColor(lead: LeadSelectOption): string {
  const seed = String(lead._id || leadPrimaryLabel(lead));
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_000_007;
  }
  const palette = CLIENT_AVATAR_COLOR_PRESETS;
  return palette[hash % palette.length].value;
}

export const LeadAvatarBadge: React.FC<{ lead: LeadSelectOption; size?: 'sm' | 'md' }> = ({
  lead,
  size = 'sm',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const dim = size === 'md' ? 'h-10 w-10 text-xs' : 'h-8 w-8 text-[10px]';
  const photo = lead.photoUrl || lead.avatarUrl;
  const showImage = Boolean(photo) && !imgFailed;

  if (showImage) {
    return (
      <img
        src={resolveClientMediaUrl(photo)}
        alt={leadPrimaryLabel(lead)}
        className={`${dim} shrink-0 rounded-full object-cover ring-1 ring-zinc-200`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full font-bold crm-on-solid ring-1 ring-border`}
      style={{ backgroundColor: leadAvatarColor(lead) }}
      aria-hidden
    >
      {getClientInitials(leadPrimaryLabel(lead))}
    </div>
  );
};

interface LeadSelectProps {
  leads: LeadSelectOption[];
  value: string;
  onChange: (leadId: string, lead?: LeadSelectOption | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  id?: string;
  emptyLabel?: string;
}

export const LeadSelect: React.FC<LeadSelectProps> = ({
  leads,
  value,
  onChange,
  placeholder = 'Select lead…',
  required = false,
  disabled = false,
  allowClear = true,
  className = '',
  id,
  emptyLabel = 'No leads found',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => leads.find((lead) => lead._id === value) || null, [leads, value]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) => {
      const haystack = [lead.company, lead.contactName, lead.name, lead.email, lead.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [leads, search]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  const pick = (lead: LeadSelectOption | null) => {
    onChange(lead?._id || '', lead);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Hidden required input for native form validation */}
      {required ? (
        <input
          id={id}
          tabIndex={-1}
          className="sr-only"
          value={value}
          required
          onChange={() => undefined}
          aria-hidden
        />
      ) : null}

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className="flex h-auto min-h-9 w-full items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-left outline-none hover:border-zinc-300 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {selected ? (
          <>
            <LeadAvatarBadge lead={selected} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-950">
                {leadPrimaryLabel(selected)}
              </div>
              <div className="truncate text-[11px] text-zinc-500">
                {leadSecondaryLabel(selected)}
              </div>
            </div>
          </>
        ) : (
          <span className="flex-1 truncate text-sm text-zinc-400">{placeholder}</span>
        )}
        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: '#71717a' }} />
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-lg">
          <div className="border-b border-zinc-100 p-2">
            <input
              ref={searchRef}
              className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Search company, contact or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {allowClear && value ? (
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex w-full items-center gap-2 border-b border-zinc-100 px-3 py-2 text-left text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              <CloseIcon sx={{ fontSize: 14 }} />
              Clear selection
            </button>
          ) : null}
          <div className="max-h-64 overflow-y-auto p-1.5" role="listbox">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">{emptyLabel}</div>
            ) : (
              filtered.map((lead) => {
                const active = lead._id === value;
                return (
                  <button
                    key={lead._id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(lead)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                      active ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <LeadAvatarBadge lead={lead} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-950">
                        {leadPrimaryLabel(lead)}
                      </div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {leadSecondaryLabel(lead)}
                      </div>
                    </div>
                    {active ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
