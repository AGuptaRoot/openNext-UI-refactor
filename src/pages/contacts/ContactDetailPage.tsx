import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LinkIcon from '@mui/icons-material/Link';
import BusinessIcon from '@mui/icons-material/Business';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import { CheckCircle2, User } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { ApiError, crmApi } from '../../services/api';
import { PersonContact, formatContactName, SameCompanyLeadItem } from '../../types/contacts';
import { LeadItem } from '../../types/leads';
import { ClientItem } from '../../types/clients';
import {
  ContactFormFields,
  ContactFormValues,
  EMPTY_CONTACT_FORM,
  contactFormToInput,
  contactToFormValues,
  validateContactForm,
} from '../../components/contacts/ContactFormFields';
import { ContactDuplicateBanner } from '../../components/contacts/ContactDuplicateBanner';
import { useContactDuplicates } from '../../components/contacts/useContactDuplicates';
import { LinkLeadModal } from '../../components/contacts/LinkLeadModal';
import { LinkClientModal } from '../../components/contacts/LinkClientModal';

/** Max linked leads/clients resolved to titles on the detail page (the rest stay as id links). */
const LINKED_LOOKUP_LIMIT = 25;

interface LinkedLeadRow {
  id: string;
  lead: LeadItem | null;
}

interface LinkedClientRow {
  id: string;
  client: ClientItem | null;
}

export const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasAnyPermission } = useAuth();
  const { confirm } = useDialog();
  const canWrite = hasAnyPermission('crm.contacts.write', 'crm.leads.write');
  const canDelete = hasAnyPermission('crm.contacts.delete', 'crm.leads.delete', 'crm.leads.write');
  const canReadLeads = hasAnyPermission('crm.leads.read');
  const canReadClients = hasAnyPermission('crm.clients.read', 'crm.leads.read');

  const [contact, setContact] = useState<PersonContact | null>(null);
  const [values, setValues] = useState<ContactFormValues>({ ...EMPTY_CONTACT_FORM });
  const [linkedLeads, setLinkedLeads] = useState<LinkedLeadRow[]>([]);
  const [linkedClients, setLinkedClients] = useState<LinkedClientRow[]>([]);
  const [companyLeads, setCompanyLeads] = useState<SameCompanyLeadItem[]>([]);
  const [loadingCompanyLeads, setLoadingCompanyLeads] = useState(false);
  const [showLinkLeadModal, setShowLinkLeadModal] = useState(false);
  const [showLinkClientModal, setShowLinkClientModal] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const { duplicates, setDuplicates, checkValues, clear } = useContactDuplicates(id);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (!id) return;
    // Reset everything tied to the previous contact when the route id changes.
    setLoading(true);
    setLoadError(null);
    setContact(null);
    setLinkedLeads([]);
    setLinkedClients([]);
    setValues({ ...EMPTY_CONTACT_FORM });
    clear();
    try {
      const res = await crmApi.getContact(id);
      const data = res.data;
      setContact(data);
      setValues(contactToFormValues(data));

      const leadIds = Array.isArray(data.leadIds) ? data.leadIds.filter(Boolean) : [];
      setLinkedLeads(leadIds.map((leadId) => ({ id: leadId, lead: null })));
      if (leadIds.length && canReadLeads) {
        const settled = await Promise.allSettled(
          leadIds.slice(0, LINKED_LOOKUP_LIMIT).map((leadId) => crmApi.getLead(leadId))
        );
        setLinkedLeads(
          leadIds.map((leadId, index) => {
            const result = index < settled.length ? settled[index] : null;
            return {
              id: leadId,
              lead: result && result.status === 'fulfilled' ? result.value.data : null,
            };
          })
        );
      }

      const clientIds = Array.isArray(data.clientIds) ? data.clientIds.filter(Boolean) : [];
      setLinkedClients(clientIds.map((clientId) => ({ id: clientId, client: null })));
      if (clientIds.length && canReadClients) {
        const settled = await Promise.allSettled(
          clientIds.slice(0, LINKED_LOOKUP_LIMIT).map((clientId) => crmApi.getClient(clientId))
        );
        setLinkedClients(
          clientIds.map((clientId, index) => {
            const result = index < settled.length ? settled[index] : null;
            return {
              id: clientId,
              client: result && result.status === 'fulfilled' ? result.value.data : null,
            };
          })
        );
      }

      if (canReadLeads) {
        setLoadingCompanyLeads(true);
        crmApi
          .getContactCompanyLeads(id)
          .then((cRes) => {
            setCompanyLeads(cRes.data?.items || []);
          })
          .catch(() => {
            setCompanyLeads([]);
          })
          .finally(() => {
            setLoadingCompanyLeads(false);
          });
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [id, canReadLeads, canReadClients, clear]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnlinkLead = async (leadId: string, leadTitle: string) => {
    if (!id || !canWrite) return;
    const ok = await confirm({
      title: 'Unlink Lead',
      message: `Are you sure you want to unlink lead "${leadTitle}" from this contact? This will remove the direct link without deleting the lead.`,
      confirmLabel: 'Unlink',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setActionBusyId(leadId);
    try {
      await crmApi.unlinkContactLead(id, leadId);
      showToast('Lead unlinked from contact');
      void load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to unlink lead', 'error');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleUnlinkClient = async (clientId: string, clientName: string) => {
    if (!id || !canWrite) return;
    const ok = await confirm({
      title: 'Unlink Client',
      message: `Are you sure you want to unlink client "${clientName}" from this contact? This will remove the direct link without deleting the client.`,
      confirmLabel: 'Unlink',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setActionBusyId(clientId);
    try {
      await crmApi.unlinkContactClient(id, clientId);
      showToast('Client unlinked from contact');
      void load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to unlink client', 'error');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleQuickLinkSameCompanyLead = async (leadId: string) => {
    if (!id || !canWrite) return;
    setActionBusyId(leadId);
    try {
      await crmApi.linkContactLead(id, leadId);
      showToast('Lead directly linked to contact');
      void load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to link lead', 'error');
    } finally {
      setActionBusyId(null);
    }
  };

  const patch = (next: Partial<ContactFormValues>) => setValues((prev) => ({ ...prev, ...next }));

  const saveContact = async (allowDuplicate: boolean) => {
    if (!canWrite || !id) return;
    const validationError = validateContactForm(values);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await crmApi.updateContact(id, {
        ...contactFormToInput(values),
        allowDuplicate: allowDuplicate || undefined,
      });
      setContact(res.data);
      setValues(contactToFormValues(res.data));
      clear();
      showToast('Contact saved successfully');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409 && Array.isArray(err.duplicates)) {
        setDuplicates(err.duplicates as PersonContact[]);
        // Soft match UI — no hard error toast
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to save contact', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicates.length) return;
    await saveContact(false);
  };

  const handleDelete = async () => {
    if (!canDelete || !id || !contact) return;
    const linked = linkedLeads.length + linkedClients.length;
    const ok = await confirm({
      message: linked
        ? `Delete contact "${contact.name}"? It is linked to ${linkedLeads.length} lead(s) and ${linkedClients.length} client(s); those records keep their copied contact details.`
        : `Delete contact "${contact.name}"?`,
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await crmApi.deleteContact(id);
      navigate('/contacts');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete contact', 'error');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-zinc-500 font-medium">Loading contact…</p>
      </div>
    );
  }

  if (loadError || !contact) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-zinc-300 rounded-lg text-center">
        <WarningAmberIcon sx={{ fontSize: 44 }} className="text-red-500 mb-3" />
        <h2 className="text-lg font-bold text-zinc-950 mb-2">Unable to Load Contact</h2>
        <p className="text-sm text-zinc-500 mb-6">
          {loadError || 'Contact was not found or has been deleted.'}
        </p>
        <Link
          to="/contacts"
          className="inline-flex items-center gap-2 bg-zinc-950 text-white text-xs font-semibold px-4 py-2.5 rounded-lg no-underline hover:bg-zinc-800"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          <span>Back to Contacts</span>
        </Link>
      </div>
    );
  }

  const leadsCount = Math.max(Number(contact.leadsCount) || 0, linkedLeads.length);
  const clientsCount = Math.max(Number(contact.clientsCount) || 0, linkedClients.length);
  const title = formatContactName(contact) || 'Contact';

  return (
    <div data-tour="contacts-detail" className="flex flex-col gap-5 pb-20">
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

      <div className="bg-white border border-zinc-300 rounded-xl px-5 py-6">
        <div className="flex items-center gap-3 text-xs text-zinc-400 mb-4 font-medium">
          <Link
            to="/contacts"
            className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-950 no-underline"
          >
            <ArrowBackIcon sx={{ fontSize: 14 }} />
            <span>Contacts</span>
          </Link>
          <span>/</span>
          <span className="text-zinc-950 font-semibold truncate max-w-sm">{title}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {contact.photoUrl ? (
              <img
                src={contact.photoUrl}
                alt={contact.name}
                className="w-16 h-16 rounded-lg object-cover border border-zinc-200 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 select-none">
                <User className="h-8 w-8 shrink-0 text-zinc-400" aria-hidden />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Contact Profile
              </span>
              <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight leading-snug truncate">
                {title}
              </h1>
              <p className="text-xs text-zinc-500 m-0 mt-1 truncate">
                {[contact.companyName, contact.jobTitle, contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="bg-white hover:bg-red-50 text-red-600 border border-zinc-200 hover:border-red-200 text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer w-fit"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <ContactDuplicateBanner
        duplicates={duplicates}
        busy={saving}
        onUseContact={(dup) => {
          clear();
          navigate(`/contacts/${dup._id}`);
        }}
        onCreateNewLead={() => void saveContact(true)}
        actionLabel="Open existing contact"
        createNewLabel="Save as new details anyway"
        option1Title="Option 1 — Open existing contact"
        option2Title="Option 2 — Keep these details"
        option2Description={
          <>
            Saves this contact even if email / mobile / PAN already exist on another contact.
          </>
        }
        title="Matching contact found"
        description={
          <>
            Same <strong>email</strong>, <strong>mobile</strong> or <strong>PAN</strong> already
            exists on another contact. Open that contact, or save these details anyway.
          </>
        }
        onDismiss={clear}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          data-tour="contacts-detail-form"
          onSubmit={handleSave}
          className="lg:col-span-8 flex flex-col gap-6"
        >
          <section className="bg-white border border-zinc-300 rounded-xl p-6">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-100">
              Contact Details
            </h3>
            <ContactFormFields
              values={values}
              onChange={patch}
              disabled={!canWrite || saving}
              onFieldBlur={(vals) => void checkValues(vals)}
              onUploadError={(msg) => showToast(msg, 'error')}
              tourPrefix="contacts-detail"
            />
          </section>
          {canWrite && (
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-xs font-semibold text-white border border-zinc-950 cursor-pointer"
              >
                {saving ? 'Saving…' : 'Save Contact'}
              </button>
            </div>
          )}
        </form>

        <aside className="lg:col-span-4 flex flex-col gap-6">
          {/* Section 1: Directly Linked Records */}
          <section
            data-tour="contacts-detail-links"
            className="bg-white border border-zinc-300 rounded-xl p-5 shadow-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <LinkIcon sx={{ fontSize: 16 }} className="text-zinc-600" />
                <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider m-0">
                  Linked Records
                </h3>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-700">
                {leadsCount + clientsCount} Total
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 m-0 mb-4">
              Records explicitly linked directly to this contact.
            </p>

            {/* Subsection 1.1: Linked Leads */}
            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                  Linked Leads
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-800">
                    {leadsCount}
                  </span>
                </span>
                {canWrite && canReadLeads && (
                  <button
                    type="button"
                    onClick={() => setShowLinkLeadModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-300 rounded px-2 py-0.5 cursor-pointer shadow-2xs"
                  >
                    <AddIcon sx={{ fontSize: 13 }} />
                    Link Lead
                  </button>
                )}
              </div>

              {linkedLeads.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1">
                  No lead directly linked to this contact.
                  {canWrite && canReadLeads && (
                    <button
                      type="button"
                      onClick={() => setShowLinkLeadModal(true)}
                      className="block text-zinc-900 font-semibold underline mt-1 cursor-pointer"
                    >
                      + Link an existing lead
                    </button>
                  )}
                </div>
              ) : (
                <ul className="list-none m-0 p-0 flex flex-col gap-2">
                  {linkedLeads.map((row) => {
                    const leadTitle = row.lead
                      ? row.lead.title || row.lead.name || row.lead.company || 'Lead'
                      : `Lead #${row.id.slice(-6)}`;
                    return (
                      <li
                        key={row.id}
                        className="bg-white border border-zinc-200 rounded-lg p-2.5 flex items-start justify-between gap-2 shadow-2xs hover:border-zinc-300 transition-colors"
                      >
                        <Link
                          to={`/leads/${row.id}`}
                          className="min-w-0 flex-1 no-underline group block"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="block text-xs font-semibold text-zinc-950 truncate group-hover:text-blue-600">
                              {leadTitle}
                            </span>
                            <span className="shrink-0 text-[10px] font-medium px-1 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                              Direct
                            </span>
                          </div>
                          <span className="block text-[11px] text-zinc-500 truncate mt-0.5">
                            {row.lead
                              ? [row.lead.company, row.lead.stage, row.lead.status]
                                  .filter(Boolean)
                                  .join(' · ')
                              : `ID: ${row.id}`}
                          </span>
                        </Link>
                        {canWrite && (
                          <Tooltip title="Unlink lead from this contact">
                            <button
                              type="button"
                              disabled={actionBusyId === row.id}
                              onClick={() => void handleUnlinkLead(row.id, leadTitle)}
                              className="text-zinc-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                              aria-label="Unlink lead"
                            >
                              {actionBusyId === row.id ? (
                                <CircularProgress size={12} color="inherit" />
                              ) : (
                                <CloseIcon sx={{ fontSize: 14 }} />
                              )}
                            </button>
                          </Tooltip>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Subsection 1.2: Linked Clients */}
            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                  Linked Clients
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-800">
                    {clientsCount}
                  </span>
                </span>
                {canWrite && canReadClients && (
                  <button
                    type="button"
                    onClick={() => setShowLinkClientModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-300 rounded px-2 py-0.5 cursor-pointer shadow-2xs"
                  >
                    <AddIcon sx={{ fontSize: 13 }} />
                    Link Client
                  </button>
                )}
              </div>

              {linkedClients.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1">
                  No client directly linked to this contact.
                  {canWrite && canReadClients && (
                    <button
                      type="button"
                      onClick={() => setShowLinkClientModal(true)}
                      className="block text-zinc-900 font-semibold underline mt-1 cursor-pointer"
                    >
                      + Link an existing client
                    </button>
                  )}
                </div>
              ) : (
                <ul className="list-none m-0 p-0 flex flex-col gap-2">
                  {linkedClients.map((row) => {
                    const clientName = row.client?.name || `Client #${row.id.slice(-6)}`;
                    return (
                      <li
                        key={row.id}
                        className="bg-white border border-zinc-200 rounded-lg p-2.5 flex items-start justify-between gap-2 shadow-2xs hover:border-zinc-300 transition-colors"
                      >
                        <Link
                          to={`/clients/${row.id}?tab=contacts`}
                          className="min-w-0 flex-1 no-underline group block"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="block text-xs font-semibold text-zinc-950 truncate group-hover:text-blue-600">
                              {clientName}
                            </span>
                            <span className="shrink-0 text-[10px] font-medium px-1 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                              Direct
                            </span>
                          </div>
                          <span className="block text-[11px] text-zinc-500 truncate mt-0.5">
                            {row.client
                              ? [row.client.city, row.client.status, row.client.category]
                                  .filter(Boolean)
                                  .join(' · ')
                              : `ID: ${row.id}`}
                          </span>
                        </Link>
                        {canWrite && (
                          <Tooltip title="Unlink client from this contact">
                            <button
                              type="button"
                              disabled={actionBusyId === row.id}
                              onClick={() => void handleUnlinkClient(row.id, clientName)}
                              className="text-zinc-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                              aria-label="Unlink client"
                            >
                              {actionBusyId === row.id ? (
                                <CircularProgress size={12} color="inherit" />
                              ) : (
                                <CloseIcon sx={{ fontSize: 14 }} />
                              )}
                            </button>
                          </Tooltip>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Section 2: Company-Based Lead Relation */}
          <section className="bg-white border border-zinc-300 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <BusinessIcon sx={{ fontSize: 16 }} className="text-zinc-600" />
                <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider m-0">
                  Leads from Same Company
                </h3>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-700">
                {companyLeads.length}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 m-0 mb-3">
              Dynamically matched by company name. Matching company does not automatically link.
            </p>

            {(contact.companyName || values.companyName) ? (
              <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-zinc-100/70 border border-zinc-200 flex items-center justify-between text-xs">
                <span className="text-zinc-500 text-[11px]">Matching Company:</span>
                <span className="font-semibold text-zinc-900 truncate max-w-[180px]">
                  {contact.companyName || values.companyName}
                </span>
              </div>
            ) : (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                No company name assigned to this contact. Set a company name above to find matching company leads.
              </div>
            )}

            {loadingCompanyLeads ? (
              <div className="py-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <CircularProgress size={14} className="text-zinc-600" />
                <span>Searching leads by company…</span>
              </div>
            ) : companyLeads.length === 0 ? (
              <p className="text-xs text-zinc-500 m-0 py-2">
                {(contact.companyName || values.companyName)
                  ? `No leads found matching company "${contact.companyName || values.companyName}".`
                  : 'Company name required to find matching leads.'}
              </p>
            ) : (
              <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
                {companyLeads.map((item) => (
                  <li
                    key={item.id}
                    className="border border-zinc-200 rounded-lg p-3 bg-white hover:border-zinc-300 transition-colors shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/leads/${item.id}`}
                        className="min-w-0 flex-1 no-underline group block"
                      >
                        <span className="block text-xs font-semibold text-zinc-950 truncate group-hover:text-blue-600">
                          {item.title || item.company}
                        </span>
                        <span className="block text-[11px] text-zinc-500 truncate mt-0.5">
                          {[item.company, item.stage, item.status].filter(Boolean).join(' · ')}
                        </span>
                      </Link>
                      {item.isDirectlyLinked ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                          Linked
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium text-zinc-600 bg-zinc-100 border border-zinc-200 rounded-full px-2 py-0.5">
                          Same Company
                        </span>
                      )}
                    </div>

                    {!item.isDirectlyLinked && canWrite && (
                      <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400">Not linked to contact</span>
                        <button
                          type="button"
                          disabled={actionBusyId === item.id}
                          onClick={() => void handleQuickLinkSameCompanyLead(item.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 rounded px-2 py-0.5 cursor-pointer disabled:opacity-50"
                        >
                          {actionBusyId === item.id ? (
                            <>
                              <CircularProgress size={10} color="inherit" />
                              Linking…
                            </>
                          ) : (
                            <>
                              <LinkIcon sx={{ fontSize: 12 }} />
                              Link to Contact
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Section 3: Record info */}
          <section className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-xs text-zinc-600">
            <h4 className="text-xs font-bold text-zinc-900 m-0 mb-2">Record info</h4>
            <dl className="m-0 grid grid-cols-2 gap-y-1.5">
              <dt className="text-zinc-500">Created</dt>
              <dd className="m-0 text-right text-zinc-800">
                {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('en-IN') : '—'}
              </dd>
              <dt className="text-zinc-500">Updated</dt>
              <dd className="m-0 text-right text-zinc-800">
                {contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString('en-IN') : '—'}
              </dd>
            </dl>
          </section>
        </aside>
      </div>

      {/* Link Lead Modal */}
      {showLinkLeadModal && id && (
        <LinkLeadModal
          contactId={id}
          contactName={title}
          existingLeadIds={linkedLeads.map((l) => l.id)}
          onClose={() => setShowLinkLeadModal(false)}
          onLinked={() => void load()}
        />
      )}

      {/* Link Client Modal */}
      {showLinkClientModal && id && (
        <LinkClientModal
          contactId={id}
          contactName={title}
          existingClientIds={linkedClients.map((c) => c.id)}
          onClose={() => setShowLinkClientModal(false)}
          onLinked={() => void load()}
        />
      )}
    </div>
  );
};
