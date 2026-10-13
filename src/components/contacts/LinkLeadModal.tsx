import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import BusinessIcon from '@mui/icons-material/Business';
import CircularProgress from '@mui/material/CircularProgress';

import { crmApi } from '../../services/api';
import type { LeadItem } from '../../types/leads';

export interface LinkLeadModalProps {
  open?: boolean;
  contactId: string;
  contactName: string;
  alreadyLinkedLeadIds?: string[];
  existingLeadIds?: string[];
  onClose: () => void;
  onLinked: () => void;
}

export const LinkLeadModal: React.FC<LinkLeadModalProps> = ({
  open = true,
  contactId,
  contactName,
  alreadyLinkedLeadIds,
  existingLeadIds,
  onClose,
  onLinked,
}) => {
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeLinkedIds = existingLeadIds || alreadyLinkedLeadIds || [];
  const linkedSet = new Set(activeLinkedIds.map(String));

  useEffect(() => {
    if (!open) {
      setSearch('');
      setLeads([]);
      setError(null);
      setLinkingId(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const res = await crmApi.getLeads({ search: search.trim() || undefined, limit: 15 });
        if (isMounted) {
          const items = Array.isArray(res.data) ? res.data : (res.data as any)?.items || [];
          setLeads(items);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to search leads');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }, search ? 300 : 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [open, search]);

  const handleLink = async (leadId: string) => {
    setLinkingId(leadId);
    setError(null);
    try {
      await crmApi.linkContactLead(contactId, leadId);
      onLinked();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to link lead');
      setLinkingId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={linkingId ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
            <LinkIcon sx={{ fontSize: 18 }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-950 m-0">Directly Link Lead</h2>
            <p className="text-[11px] text-zinc-500 m-0">
              Link a lead directly to <strong>{contactName}</strong>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={Boolean(linkingId)}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer disabled:opacity-50"
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4 bg-zinc-50/50">
        <div className="relative">
          <SearchIcon
            sx={{ fontSize: 18 }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="Search leads by title, company, contact name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <CircularProgress size={24} sx={{ color: '#18181b' }} />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-10 text-xs text-zinc-500">
              No leads found matching your search.
            </div>
          ) : (
            leads.map((lead) => {
              const leadId = String(lead._id || '');
              const isAlreadyLinked = linkedSet.has(leadId);
              const isBusyThis = linkingId === leadId;

              return (
                <div
                  key={leadId}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-zinc-950 truncate">
                        {lead.title || lead.name || 'Untitled Lead'}
                      </span>
                      {lead.stage && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 font-medium">
                          {lead.stage}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 truncate">
                      {lead.company && (
                        <span className="flex items-center gap-1">
                          <BusinessIcon sx={{ fontSize: 13 }} />
                          {lead.company}
                        </span>
                      )}
                      {lead.email && <span>• {lead.email}</span>}
                    </div>
                  </div>

                  {isAlreadyLinked ? (
                    <span className="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                      Already Linked
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(linkingId)}
                      onClick={() => void handleLink(leadId)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer flex items-center gap-1"
                    >
                      {isBusyThis ? 'Linking…' : 'Link Lead'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
};
