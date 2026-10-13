import React, { useEffect, useMemo, useRef, useState } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import { getClientInitials, resolveClientAvatarColor, resolveClientMediaUrl } from '../../utils/clientAvatar';

export interface ClientSelectOption {
  _id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  avatarColor?: string;
  companyName?: string;
  phone?: string;
  mobile?: string;
}

export function normalizeClientSelectOption(
  raw: Partial<ClientSelectOption> & { _id?: string; id?: string }
): ClientSelectOption | null {
  const id = String(raw._id || raw.id || '').trim();
  if (!id) return null;
  const name = String(raw.name || raw.companyName || 'Unnamed client').trim();
  return {
    _id: id,
    name,
    email: raw.email ? String(raw.email).trim() : undefined,
    avatarUrl: raw.avatarUrl ? String(raw.avatarUrl).trim() : undefined,
    avatarColor: raw.avatarColor ? String(raw.avatarColor).trim() : undefined,
    companyName: raw.companyName ? String(raw.companyName).trim() : undefined,
    phone: raw.phone ? String(raw.phone).trim() : undefined,
    mobile: raw.mobile ? String(raw.mobile).trim() : undefined,
  };
}

interface ClientAvatarProps {
  client: Pick<ClientSelectOption, 'name' | 'avatarUrl' | 'avatarColor'>;
  size?: 'sm' | 'md';
}

export const ClientAvatarBadge: React.FC<ClientAvatarProps> = ({ client, size = 'sm' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const dim = size === 'md' ? 'h-10 w-10 text-xs' : 'h-8 w-8 text-[10px]';
  const showImage = Boolean(client.avatarUrl) && !imgFailed;

  if (showImage) {
    return (
      <img
        src={resolveClientMediaUrl(client.avatarUrl)}
        alt={client.name}
        className={`${dim} shrink-0 rounded-full object-cover ring-1 ring-zinc-200`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full font-bold text-white ring-1 ring-zinc-200`}
      style={{ backgroundColor: resolveClientAvatarColor(client.avatarColor) }}
      aria-hidden
    >
      {getClientInitials(client.name)}
    </div>
  );
};

interface ClientSelectProps {
  clients: ClientSelectOption[];
  value: string;
  onChange: (clientId: string, client?: ClientSelectOption | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  id?: string;
  emptyLabel?: string;
}

export const ClientSelect: React.FC<ClientSelectProps> = ({
  clients,
  value,
  onChange,
  placeholder = 'Select client…',
  required = false,
  disabled = false,
  allowClear = true,
  className = '',
  id,
  emptyLabel = 'No clients found',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => clients.find((client) => client._id === value) || null,
    [clients, value]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => {
      const haystack = [
        client.name,
        client.companyName,
        client.email,
        client.phone,
        client.mobile,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [clients, search]);

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

  const pick = (client: ClientSelectOption | null) => {
    onChange(client?._id || '', client);
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
            <ClientAvatarBadge client={selected} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-950">{selected.name}</div>
              <div className="truncate text-[11px] text-zinc-500">
                {selected.email || 'No email'}
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
              placeholder="Search name or email…"
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
              filtered.map((client) => {
                const active = client._id === value;
                return (
                  <button
                    key={client._id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(client)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                      active ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <ClientAvatarBadge client={client} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-950">{client.name}</div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {client.email || 'No email'}
                      </div>
                    </div>
                    {active ? <span className="text-xs font-semibold text-emerald-700">✓</span> : null}
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
