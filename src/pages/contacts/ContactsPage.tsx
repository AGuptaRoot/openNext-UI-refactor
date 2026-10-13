import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
import {
  PersonContact,
  PersonContactPaginationMeta,
  formatContactName,
} from '../../types/contacts';
import { ListPager } from '../../components/common/ListPager';

const PAGE_SIZE = 20;

export const ContactsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasAnyPermission } = useAuth();
  const { confirm } = useDialog();
  const canRead = hasAnyPermission('crm.contacts.read', 'crm.leads.read');
  const canWrite = hasAnyPermission('crm.contacts.write', 'crm.leads.write');
  const canDelete = hasAnyPermission('crm.contacts.delete', 'crm.leads.delete', 'crm.leads.write');

  const [contacts, setContacts] = useState<PersonContact[]>([]);
  const [pagination, setPagination] = useState<PersonContactPaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 320);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadContacts = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await crmApi.listContacts({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setContacts(Array.isArray(res.data) ? res.data : []);
      setPagination(res.meta || null);
    } catch (err: unknown) {
      setContacts([]);
      setPagination(null);
      setLoadError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, canRead]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const handleDelete = async (contact: PersonContact) => {
    const linked = Number(contact.leadsCount) || contact.leadIds?.length || 0;
    const ok = await confirm({
      message: linked
        ? `Delete contact "${contact.name}"? It is linked to ${linked} lead(s); those leads keep their copied contact details.`
        : `Delete contact "${contact.name}"?`,
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await crmApi.deleteContact(contact._id);
      showToast('Contact deleted');
      void loadContacts();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  if (!canRead) {
    return (
      <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center">
        <p className="text-sm font-semibold text-zinc-900 m-0 mb-1">Access denied</p>
        <p className="text-xs text-zinc-500 m-0">
          You need the <code className="text-[11px]">crm.contacts.read</code> or{' '}
          <code className="text-[11px]">crm.leads.read</code> permission to view contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {toast && (
        <div
          className={`fixed top-20 right-6 z-[80] px-4 py-2.5 rounded-lg text-xs font-semibold border ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-1 border-b border-zinc-200">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">
            Sales
          </p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">Contacts</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            People directory shared across leads. Reuse a contact instead of retyping details.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void loadContacts()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
          >
            <RefreshIcon sx={{ fontSize: 15 }} />
            Refresh
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => navigate('/contacts/create')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer"
            >
              <AddIcon sx={{ fontSize: 16 }} />
              New Contact
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-zinc-300 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 min-w-[200px] flex-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Search
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name, email, mobile, PAN, job title…"
            className="h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400"
          />
        </label>
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          disabled={!searchQuery}
          className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3.5 rounded-xl flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadContacts()}
            className="text-[11px] font-semibold underline bg-transparent border-none cursor-pointer text-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center text-sm text-zinc-500 animate-pulse">
          Loading contacts…
        </div>
      ) : (
        <div className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Company Name</th>
                  <th className="px-4 py-3">Job title</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Clients</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs text-zinc-900">
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-zinc-500 text-sm">
                      {debouncedSearch
                        ? 'No contacts match your search.'
                        : 'No contacts yet.'}
                      {canWrite && !debouncedSearch ? (
                        <>
                          {' '}
                          <Link to="/contacts/create" className="font-semibold text-zinc-950">
                            Create the first contact
                          </Link>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => {
                    const leadsCount =
                      Number(contact.leadsCount) || (contact.leadIds ? contact.leadIds.length : 0);
                    const clientsCount =
                      Number(contact.clientsCount) ||
                      (contact.clientIds ? contact.clientIds.length : 0);
                    const firstClientId =
                      Array.isArray(contact.clientIds) && contact.clientIds.length
                        ? String(contact.clientIds[0])
                        : '';
                    return (
                      <tr
                        key={contact._id}
                        className="hover:bg-zinc-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/contacts/${contact._id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-md bg-zinc-950 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                              {contact.photoUrl ? (
                                <img
                                  src={contact.photoUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (contact.name.charAt(0) || 'C').toUpperCase()
                              )}
                            </div>
                            <span className="font-semibold text-zinc-950 truncate">
                              {formatContactName(contact) || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-900 font-medium">
                          {contact.companyName || '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{contact.jobTitle || '—'}</td>
                        <td className="px-4 py-3 font-mono text-[11px]">{contact.email || '—'}</td>
                        <td className="px-4 py-3 font-mono text-[11px]">{contact.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-700">
                            {leadsCount}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {clientsCount > 0 && firstClientId ? (
                            <Link
                              to={`/clients/${firstClientId}?tab=contacts`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-800 no-underline hover:underline"
                              title="Open linked client contacts"
                            >
                              <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5">
                                {clientsCount}
                              </span>
                              Open
                            </Link>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-500">
                              0
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              title="View contact"
                              onClick={() => navigate(`/contacts/${contact._id}`)}
                              className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 cursor-pointer"
                            >
                              <VisibilityOutlinedIcon sx={{ fontSize: 14 }} />
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                title="Delete contact"
                                onClick={() => void handleDelete(contact)}
                                className="p-1 rounded border border-zinc-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-400 cursor-pointer"
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <ListPager pagination={pagination} onPageChange={setPage} label="contacts" />
        </div>
      )}
    </div>
  );
};
