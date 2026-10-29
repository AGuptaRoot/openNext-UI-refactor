import { displayLabel, displayUserLabel } from '../../utils/displayLabels';
import { formatCrmMoney } from '../../utils/currency';
import { resolveClientAvatarColor, resolveClientMediaUrl, DEFAULT_CLIENT_AVATAR_COLOR } from '../../utils/clientAvatar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
import { LeadAuditEntry, LeadItem } from '../../types/leads';
import {
  DocumentUploadControl,
  IMAGE_ACCEPT,
} from '../../components/common/DocumentUploadControl';
import { ClientAvatarColorPicker } from '../../components/clients/ClientAvatarColorPicker';
import { ContactSelect } from '../../components/contacts/ContactSelect';
import { PhoneNumberField } from '../../components/common/PhoneNumberField';
import { splitPhoneNumber, validateNationalNumber } from '../../utils/phoneCountryCodes';
import { ClientExtensionOverviewSection } from '../../components/clients/ClientExtensionOverviewSection';
import { ClientPassportsTab } from '../../components/clients/ClientPassportsTab';
import { useExtensions } from '../../hooks/useExtensions';
import { PersonContact, formatContactName } from '../../types/contacts';
import {
  ClientAddress,
  ClientContact,
  ClientCustomFieldDef,
  ClientDetailSummary,
  ClientDocument,
  ClientEvent,
  ClientHealthScore,
  ClientItem,
  ClientNote,
  ClientPortalAccess,
  ClientRelatedInvoice,
  ClientRelatedPayment,
  ClientRelatedProject,
  ClientRelatedQuotation,
  ClientRelatedTask,
  ClientRelatedTimeLog,
  ClientTimelineEntry,
  ClientExtensionData,
  CLIENT_PORTAL_PERMISSIONS,
} from '../../types/clients';
import { TicketItem } from '../../types/tickets';

/**
 * Extension-contributed tabs use an `ext:` prefix so they can be deep-linked
 * (`?tab=ext:passports`) without widening the static union to `string`.
 */
type ExtensionTabId = `ext:${string}`;

type StaticTabId =
  | 'overview'
  | 'contacts'
  | 'addresses'
  | 'notes'
  | 'timeline'
  | 'documents'
  | 'portal'
  | 'projects'
  | 'tasks'
  | 'time-logs'
  | 'finance'
  | 'tickets'
  | 'health'
  | 'audit';

type TabId = StaticTabId | ExtensionTabId;

const CLIENT_TABS: StaticTabId[] = [
  'overview',
  'contacts',
  'addresses',
  'notes',
  'timeline',
  'documents',
  'portal',
  'projects',
  'tasks',
  'time-logs',
  'finance',
  'tickets',
  'health',
  'audit',
];

/**
 * Extension tab ids are accepted optimistically — the contributions load after
 * the first render, and an id that never appears falls back to Overview when
 * the tab list is built.
 */
function resolveClientTab(raw: string | null): TabId {
  const value = String(raw || '').trim();
  const lower = value.toLowerCase();
  if (lower === 'events') return 'timeline';
  if ((CLIENT_TABS as string[]).includes(lower)) return lower as TabId;
  if (/^ext:[A-Za-z0-9_-]+$/.test(value)) return value as ExtensionTabId;
  return 'overview';
}

function isExtensionTab(tab: TabId): tab is ExtensionTabId {
  return String(tab).startsWith('ext:');
}

function extensionTabId(id: string): ExtensionTabId {
  return `ext:${id}`;
}

const fieldClass =
  'h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border';

const emptyState = (msg: string, action?: React.ReactNode) => (
  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center">
    <p className="m-0 text-xs font-medium text-zinc-500">{msg}</p>
    {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
  </div>
);

const statusPill = (status?: string) => {
  const value = String(status || 'Active');
  const active = value.toLowerCase() === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        active ? 'crm-badge-success' : 'crm-badge-neutral'
      }`}
      style={{ borderWidth: 1, borderStyle: 'solid' }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? 'var(--success)' : 'var(--muted-foreground)' }}
      />
      {value}
    </span>
  );
};

const moneyLabel = (amount: number | undefined, currency?: string) =>
  formatCrmMoney(amount, currency);

export const ClientDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isAdmin, activeRole } = useAuth();
  const canApprovePortal = isAdmin || activeRole === 'crm-manager' || activeRole === 'sales-manager' || hasPermission('crm.users.manage');
  const { confirm } = useDialog();
  const {
    clientOverviewSectionsForRequestType,
    clientTabsForRequestType,
    clientFieldsForTab,
  } = useExtensions();
  const canWrite = hasPermission('crm.clients.write');
  const canDelete = hasPermission('crm.clients.delete');
  const canProjects = hasPermission('crm.projects.read');
  const canTasks = hasPermission('crm.tasks.read');
  const canFinance = hasPermission('crm.finance.read');
  const canAudit = hasPermission('crm.audit.read');
  const canTime = hasPermission('crm.time.read') || hasPermission('crm.timeLogs.read') || canTasks;
  const canTickets = hasPermission('crm.tickets.read');

  const [client, setClient] = useState<ClientItem | null>(null);
  const [summary, setSummary] = useState<ClientDetailSummary | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [sourceLead, setSourceLead] = useState<LeadItem | null>(null);
  const [extensionData, setExtensionData] = useState<ClientExtensionData | null>(null);
  const [extensionDataLoading, setExtensionDataLoading] = useState(false);
  const [extensionDataError, setExtensionDataError] = useState<string | null>(null);

  /**
   * Read-through extension context (source lead's extension bag + request
   * type). Loaded once per client — extension tabs are decided from it, so it
   * cannot wait for a tab to be opened.
   */
  const loadExtensionData = useCallback(async (clientId: string) => {
    setExtensionDataLoading(true);
    setExtensionDataError(null);
    try {
      const res = await crmApi.getClientExtensionData(clientId);
      setExtensionData(res.data || null);
    } catch (reason) {
      setExtensionData(null);
      setExtensionDataError(
        reason instanceof Error ? reason.message : 'Failed to load extension data'
      );
    } finally {
      setExtensionDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    void loadExtensionData(id);
  }, [id, loadExtensionData]);
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [timeline, setTimeline] = useState<ClientTimelineEntry[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [portalUsers, setPortalUsers] = useState<ClientPortalAccess[]>([]);
  const [rejectingAccessId, setRejectingAccessId] = useState<string | null>(null);
  const [clientRejectionReason, setClientRejectionReason] = useState('');
  const [rejectingSaving, setRejectingSaving] = useState(false);
  const [resubmittingAccessId, setResubmittingAccessId] = useState<string | null>(null);

  const handleApprovePortalUser = async (accessId: string) => {
    try {
      const res = await crmApi.approveClientPortalAccess(id, accessId);
      const emailed = res.data?.emailSent !== false;
      showToast(
        emailed
          ? 'Portal access approved & login details emailed to client'
          : 'Portal access approved & user created, but email could not be sent'
      );
      const updated = await crmApi.getClientPortalAccess(id);
      setPortalUsers(updated.data || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to approve portal access');
    }
  };

  const handleRejectPortalUser = async () => {
    if (!rejectingAccessId) return;
    if (!clientRejectionReason.trim()) {
      showToast('Rejection reason is required');
      return;
    }
    setRejectingSaving(true);
    try {
      await crmApi.rejectClientPortalAccess(id, rejectingAccessId, {
        reason: clientRejectionReason.trim(),
      });
      showToast('Portal access request rejected');
      setRejectingAccessId(null);
      setClientRejectionReason('');
      const updated = await crmApi.getClientPortalAccess(id);
      setPortalUsers(updated.data || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reject portal access');
    } finally {
      setRejectingSaving(false);
    }
  };
  const [projects, setProjects] = useState<ClientRelatedProject[]>([]);
  const [tasks, setTasks] = useState<ClientRelatedTask[]>([]);
  const [quotations, setQuotations] = useState<ClientRelatedQuotation[]>([]);
  const [invoices, setInvoices] = useState<ClientRelatedInvoice[]>([]);
  const [payments, setPayments] = useState<ClientRelatedPayment[]>([]);
  const [timeLogs, setTimeLogs] = useState<ClientRelatedTimeLog[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [health, setHealth] = useState<ClientHealthScore | null>(null);
  const [audit, setAudit] = useState<LeadAuditEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<ClientCustomFieldDef[]>([]);
  const [tab, setTab] = useState<TabId>(() => resolveClientTab(searchParams.get('tab')));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingSummary, setRefreshingSummary] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addrFilter, setAddrFilter] = useState<'all' | 'billing' | 'shipping' | 'branch'>('all');
  const [notesPinnedOnly, setNotesPinnedOnly] = useState(false);
  const [notesSearch, setNotesSearch] = useState('');
  const [pickerContact, setPickerContact] = useState<PersonContact | null>(null);
  const [linkingContact, setLinkingContact] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showPortalInvite, setShowPortalInvite] = useState(false);
  const [docCategory, setDocCategory] = useState('All');
  const DOC_CATEGORIES = [
    'All',
    'General',
    'Contract',
    'Proposal',
    'Invoice',
    'Compliance',
    'NDA',
    'Identification',
    'Tax',
    'KYC',
    'Other',
  ] as const;
  const DOC_CATEGORY_OPTIONS = DOC_CATEGORIES.filter((c) => c !== 'All');
  const [docUploadForm, setDocUploadForm] = useState({ category: 'General', description: '' });
  const [docLinkForm, setDocLinkForm] = useState({
    name: '',
    url: '',
    category: 'General',
    description: '',
  });
  const [docUploading] = useState(false);
  const [docLinkSaving, setDocLinkSaving] = useState(false);
  const [lastPortalInviteUrl, setLastPortalInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    setTab(resolveClientTab(searchParams.get('tab')));
  }, [id, searchParams]);

  useEffect(() => {
    const onTourTab = (e: Event) => {
      const next = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (next) setTab(resolveClientTab(next));
    };
    window.addEventListener('crm-clients-tour-tab', onTourTab as EventListener);
    return () => window.removeEventListener('crm-clients-tour-tab', onTourTab as EventListener);
  }, []);

  const clientPortalLoginUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'http://localhost:3011/login';
    return `${window.location.origin}/login`;
  }, []);

  const overviewEditorRef = useRef<HTMLDivElement | null>(null);
  const overviewNameRef = useRef<HTMLInputElement | null>(null);

  const goToOverviewEditor = useCallback(() => {
    setTab('overview');
    window.setTimeout(() => {
      overviewEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      overviewNameRef.current?.focus();
    }, 50);
  }, []);

  const openPortalInviteModal = () => {
    setPortalInvite((prev) => ({
      ...prev,
      name: prev.name || client?.name || '',
      email: prev.email || client?.email || '',
      username: prev.username || (client?.email ? client.email.split('@')[0] : ''),
    }));
    setShowPortalInvite(true);
  };

  const resetPortalInviteForm = () => {
    setResubmittingAccessId(null);
    setPortalInvite({
      name: '',
      email: '',
      username: '',
      password: '',
      portalRole: 'Standard',
      permissions: [],
    });
  };

  const submitPortalInvite = async () => {
    if (!portalInvite.name.trim() || !portalInvite.email.trim()) {
      showToast('Name and email are required');
      return;
    }
    setPortalInviteSaving(true);
    try {
      if (resubmittingAccessId) {
        await crmApi.resubmitClientPortalAccess(id, resubmittingAccessId, {
          username: portalInvite.username.trim() || undefined,
          password: portalInvite.password.trim() || undefined,
        });
        showToast('Portal access request resubmitted for manager approval');
      } else {
        const invited = await crmApi.inviteClientPortalContact(id, {
          name: portalInvite.name.trim(),
          email: portalInvite.email.trim(),
          username: portalInvite.username.trim() || undefined,
          password: portalInvite.password.trim() || undefined,
          portalRole: portalInvite.portalRole,
        });
        const rawLoginUrl = invited.data?.loginCredentials?.loginUrl || clientPortalLoginUrl;
        const loginUrl = String(rawLoginUrl).replace(/\/admin\/login\b/g, '/login');
        setLastPortalInviteUrl(loginUrl);
        const isPending = invited.data?.status === 'Pending_Approval';
        if (isPending) {
          showToast('Portal access request submitted for manager approval');
        } else {
          showToast(
            invited.data?.emailSent !== false
              ? `Portal invite sent · ${loginUrl}`
              : `Portal user created, but email could not be sent`
          );
        }
      }
      resetPortalInviteForm();
      setResubmittingAccessId(null);
      setShowPortalInvite(false);
      const res = await crmApi.getClientPortalAccess(id);
      setPortalUsers(res.data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send portal invite');
    } finally {
      setPortalInviteSaving(false);
    }
  };

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editAvatarColor, setEditAvatarColor] = useState(DEFAULT_CLIENT_AVATAR_COLOR);
  const [editTaxId, setEditTaxId] = useState('');
  const [editStatus, setEditStatus] = useState('Active');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editCustomFields, setEditCustomFields] = useState<Record<string, string | number | boolean>>(
    {}
  );
  const [editBilling, setEditBilling] = useState({
    street: '',
    city: '',
    state: '',
    country: 'India',
    zip: '',
  });

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    isPrimary: false,
  });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const [addressForm, setAddressForm] = useState({
    type: 'billing',
    label: '',
    street: '',
    city: '',
    state: '',
    country: 'India',
    zip: '',
    isDefault: false,
  });
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('Meeting');
  const [eventDue, setEventDue] = useState('');

  const [portalInvite, setPortalInvite] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    portalRole: 'Standard',
    permissions: [...CLIENT_PORTAL_PERMISSIONS] as string[],
  });
  const [portalInviteSaving, setPortalInviteSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadCore = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setSourceLead(null);
    try {
      const [c, s, ct, n, e, cats, tags, cfs] = await Promise.all([
        crmApi.getClient(id),
        crmApi.getClientSummary(id),
        crmApi.getClientContacts(id),
        crmApi.getClientNotes(id),
        crmApi.getClientEvents(id),
        crmApi.getClientCategories(),
        crmApi.getClientTags(),
        crmApi.getClientCustomFields(),
      ]);
      setClient(c.data);
      const sLeadId = c.data?.leadId || c.data?.sourceLead?._id || c.data?.sourceLead?.id;
      if (sLeadId) {
        crmApi.getLead(String(sLeadId)).then((res) => {
          if (res.data) setSourceLead(res.data);
        }).catch(() => {});
      }
      setSummary(s.data);
      setContacts(ct.data || []);
      setNotes(n.data || []);
      setEvents(e.data || []);
      setCategories(cats.data || []);
      setAllTags(tags.data || []);
      setCustomFieldDefs(cfs.data || []);
      setEditName(c.data.name || '');
      setEditEmail(c.data.email || '');
      setEditPhone(c.data.phone || '');
      setEditWebsite(c.data.website || '');
      setEditAvatar(c.data.avatarUrl || '');
      setEditAvatarColor(resolveClientAvatarColor(c.data.avatarColor));
      setEditTaxId(c.data.taxId || '');
      setEditStatus(c.data.status || 'Active');
      setEditCategory(c.data.category || '');
      setEditTags(c.data.tags || []);
      setEditCustomFields(c.data.customFields || {});
      setEditBilling({
        street: c.data.billingAddress?.street || '',
        city: c.data.billingAddress?.city || '',
        state: c.data.billingAddress?.state || '',
        country: c.data.billingAddress?.country || 'India',
        zip: c.data.billingAddress?.zip || '',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (!id || !client) return;
    const loadTab = async () => {
      try {
        if (tab === 'addresses') {
          const res = await crmApi.getClientAddresses(id);
          setAddresses(res.data || []);
        } else if (tab === 'timeline') {
          const [tl, ev] = await Promise.all([
            crmApi.getClientTimeline(id),
            crmApi.getClientEvents(id),
          ]);
          setTimeline(tl.data || []);
          setEvents(ev.data || []);
        } else if (tab === 'documents') {
          const res = await crmApi.getClientDocuments(
            id,
            docCategory !== 'All' ? docCategory : undefined
          );
          setDocuments(res.data || []);
        } else if (tab === 'portal') {
          const res = await crmApi.getClientPortalAccess(id);
          setPortalUsers(res.data || []);
        } else if (tab === 'projects') {
          const res = await crmApi.getClientProjects(id);
          setProjects(res.data || []);
        } else if (tab === 'tasks') {
          const res = await crmApi.getClientTasks(id);
          setTasks(res.data || []);
        } else if (tab === 'time-logs') {
          const res = await crmApi.getClientTimeLogs(id);
          setTimeLogs(res.data || []);
        } else if (tab === 'finance') {
          const [q, inv, pay] = await Promise.all([
            crmApi.getClientQuotations(id),
            crmApi.getClientInvoices(id),
            crmApi.getClientPayments(id),
          ]);
          setQuotations(q.data || []);
          setInvoices(inv.data || []);
          setPayments(pay.data || []);
        } else if (tab === 'tickets') {
          const res = await crmApi.listTickets({ clientId: id, limit: 50 });
          setTickets(res.data || []);
        } else if (tab === 'health') {
          const res = await crmApi.getClientHealthScore(id);
          setHealth(res.data);
        } else if (tab === 'audit') {
          const res = await crmApi.getAuditByRecord('client', id).catch(() =>
            crmApi.getAuditByRecord('company', id)
          );
          setAudit(res.data || []);
        } else if (tab === 'notes') {
          const res = await crmApi.getClientNotes(id);
          setNotes(res.data || []);
        } else if (tab === 'contacts') {
          const res = await crmApi.getClientContacts(id);
          setContacts(res.data || []);
        }
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Failed to load tab data');
      }
    };
    loadTab();
  }, [tab, id, client, docCategory]);

  const filteredAddresses = useMemo(() => {
    if (addrFilter === 'all') return addresses;
    return addresses.filter((a) => a.type === addrFilter);
  }, [addresses, addrFilter]);

  const filteredNotes = useMemo(() => {
    const q = notesSearch.trim().toLowerCase();
    return notes
      .filter((n) => (notesPinnedOnly ? Boolean(n.pinned || n.isPinned) : true))
      .filter((n) => {
        if (!q) return true;
        return (
          String(n.title || '')
            .toLowerCase()
            .includes(q) ||
          String(n.body || n.content || '')
            .toLowerCase()
            .includes(q)
        );
      })
      .slice()
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned || b.isPinned)) - Number(Boolean(a.pinned || a.isPinned))
      );
  }, [notes, notesPinnedOnly, notesSearch]);

  const quickNotes = useMemo(() => {
    return notes
      .slice()
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned || b.isPinned)) - Number(Boolean(a.pinned || a.isPinned))
      )
      .slice(0, 3);
  }, [notes]);

  const portalMetrics = useMemo(() => {
    const total = portalUsers.length;
    const active = portalUsers.filter((u) => String(u.status).toLowerCase() === 'active').length;
    const invited = portalUsers.filter((u) => String(u.status).toLowerCase() === 'invited').length;
    const suspended = portalUsers.filter((u) => String(u.status).toLowerCase() === 'suspended').length;
    return { total, active, invited, suspended };
  }, [portalUsers]);

  const refreshSummary = async () => {
    if (!id) return;
    setRefreshingSummary(true);
    try {
      const res = await crmApi.getClientSummary(id);
      setSummary(res.data || null);
      showToast('Account summary refreshed');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to refresh summary');
    } finally {
      setRefreshingSummary(false);
    }
  };

  const handleSaveOverview = async () => {
    if (!id || !editName.trim()) return;
    if (editPhone.trim()) {
      const split = splitPhoneNumber(editPhone);
      if (split.dial && split.national) {
        const check = validateNationalNumber(split.dial, split.national);
        if (check.state === 'invalid' || check.state === 'incomplete') {
          showToast(`Phone: ${check.message}`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const websiteRaw = editWebsite.trim();
      let website: string | undefined;
      if (websiteRaw) {
        if (/^https?:\/\//i.test(websiteRaw)) website = websiteRaw;
        else if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(websiteRaw)) website = `https://${websiteRaw}`;
        else website = websiteRaw;
      }
      const res = await crmApi.updateClient(id, {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        website,
        avatarUrl: editAvatar.trim() || undefined,
        avatarColor: editAvatarColor || DEFAULT_CLIENT_AVATAR_COLOR,
        status: editStatus,
        category: editCategory || undefined,
        tags: editTags,
        customFields: editCustomFields,
        billingAddress: {
          street: editBilling.street || undefined,
          city: editBilling.city || undefined,
          state: editBilling.state || undefined,
          country: editBilling.country || 'India',
          zip: editBilling.zip || undefined,
        },
      });
      setClient({
        ...res.data,
        avatarColor: res.data.avatarColor || editAvatarColor,
        avatarUrl: res.data.avatarUrl || editAvatar.trim() || undefined,
      });
      showToast('Client updated');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !client) return;
    if (!(await confirm({ message: `Delete "${client.name}"?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteClient(id);
      navigate('/clients');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const refreshContacts = async () => {
    if (!id) return;
    const res = await crmApi.getClientContacts(id);
    setContacts(res.data || []);
  };

  const createContactReturnTo = id
    ? `/clients/${id}?tab=contacts`
    : '/clients';

  const handleLinkPersonContact = async (person: PersonContact | null) => {
    if (!person || !id || !canWrite) {
      setPickerContact(null);
      return;
    }
    const email = String(person.email || '').trim().toLowerCase();
    const phone = String(person.phone || '').trim();
    const pPhone = phone.replace(/\D/g, '');
    const matchByIdentity = (c: (typeof contacts)[number]) => {
      if (c.personContactId && String(c.personContactId) === String(person._id)) return true;
      const cEmail = String(c.email || '').trim().toLowerCase();
      const cPhone = String(c.phone || '').trim().replace(/\D/g, '');
      if (email && cEmail && cEmail === email) return true;
      if (pPhone.length >= 7 && cPhone.length >= 7 && cPhone.slice(-10) === pPhone.slice(-10)) {
        return true;
      }
      return false;
    };
    const existing = contacts.find(matchByIdentity);

    setLinkingContact(true);
    setPickerContact(person);
    try {
      if (existing) {
        // Row already exists (e.g. from client create) — attach PersonContact link so
        // Open → Contacts works and Contact detail shows this client.
        if (String(existing.personContactId || '') !== String(person._id)) {
          await crmApi.updateClientContact(id, existing._id, {
            name: existing.name || formatContactName(person) || person.name,
            email: existing.email || person.email || '',
            phone: existing.phone || person.phone || '',
            designation: existing.designation || person.jobTitle || '',
            isPrimary: !!existing.isPrimary,
            personContactId: person._id,
          });
          await refreshContacts();
          showToast(`Linked ${formatContactName(person) || person.name} to this client`);
        } else {
          showToast('This contact is already linked to this client');
        }
        setPickerContact(null);
        return;
      }

      await crmApi.addClientContact(id, {
        name: formatContactName(person) || person.name,
        email: person.email || '',
        phone: person.phone || '',
        designation: person.jobTitle || '',
        isPrimary: contacts.length === 0,
        personContactId: person._id,
      });
      setPickerContact(null);
      await refreshContacts();
      showToast(`Added ${formatContactName(person) || person.name} to this client`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to link contact');
      setPickerContact(null);
    } finally {
      setLinkingContact(false);
    }
  };

  // After Create Contact redirects back with ?linkContact=, auto-link that person.
  useEffect(() => {
    const linkId = String(searchParams.get('linkContact') || '').trim();
    if (!linkId || !id || !canWrite || linkingContact) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await crmApi.getContact(linkId);
        if (cancelled || !res.data) return;
        await handleLinkPersonContact(res.data);
      } catch {
        if (!cancelled) showToast('Created contact, but failed to link it automatically');
      } finally {
        if (!cancelled) {
          const next = new URLSearchParams(searchParams);
          next.delete('linkContact');
          setSearchParams(next, { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per linkContact param
  }, [searchParams, id, canWrite]);

  const handleSaveContact = async () => {
    if (!id || !editingContactId || !contactForm.name.trim()) return;
    if (contactForm.phone.trim()) {
      const split = splitPhoneNumber(contactForm.phone);
      if (split.dial && split.national) {
        const check = validateNationalNumber(split.dial, split.national);
        if (check.state === 'invalid' || check.state === 'incomplete') {
          showToast(`Phone: ${check.message}`);
          return;
        }
      }
    }
    try {
      await crmApi.updateClientContact(id, editingContactId, contactForm);
      setContactForm({ name: '', email: '', phone: '', designation: '', isPrimary: false });
      setEditingContactId(null);
      await refreshContacts();
      showToast('Contact updated');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save contact');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!id) return;
    try {
      await crmApi.deleteClientContact(id, contactId);
      setContacts((prev) => prev.filter((c) => c._id !== contactId));
      showToast('Contact removed');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const refreshAddresses = async () => {
    if (!id) return;
    const res = await crmApi.getClientAddresses(id);
    setAddresses(res.data || []);
  };

  const handleSaveAddress = async () => {
    if (!id) return;
    try {
      if (editingAddressId) {
        await crmApi.updateClientAddress(id, editingAddressId, addressForm);
      } else {
        await crmApi.addClientAddress(id, addressForm);
      }
      setAddressForm({
        type: 'billing',
        label: '',
        street: '',
        city: '',
        state: '',
        country: 'India',
        zip: '',
        isDefault: false,
      });
      setEditingAddressId(null);
      await refreshAddresses();
      showToast(editingAddressId ? 'Address updated' : 'Address added');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save address');
    }
  };

  const handleSaveNote = async () => {
    if (!id || !noteBody.trim()) {
      showToast('Note content is required');
      return;
    }
    try {
      if (editingNoteId) {
        await crmApi.updateClientNote(id, editingNoteId, {
          title: noteTitle.trim() || 'Untitled note',
          body: noteBody.trim(),
          content: noteBody.trim(),
        });
      } else {
        await crmApi.createClientNote(id, {
          title: noteTitle.trim() || 'Untitled note',
          body: noteBody.trim(),
          content: noteBody.trim(),
        });
      }
      setNoteTitle('');
      setNoteBody('');
      setEditingNoteId(null);
      setShowNoteForm(false);
      const res = await crmApi.getClientNotes(id);
      setNotes(res.data || []);
      showToast(editingNoteId ? 'Note updated' : 'Note added');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const handleAddEvent = async () => {
    if (!id || !eventTitle.trim()) {
      showToast('Activity title is required');
      return;
    }
    try {
      await crmApi.createClientEvent(id, {
        title: eventTitle.trim(),
        type: eventType,
        eventType,
        dueAt: eventDue || new Date().toISOString().slice(0, 10),
        eventDate: eventDue || new Date().toISOString().slice(0, 10),
      });
      setEventTitle('');
      setEventDue('');
      const [ev, tl] = await Promise.all([
        crmApi.getClientEvents(id),
        crmApi.getClientTimeline(id),
      ]);
      setEvents(ev.data || []);
      setTimeline(tl.data || []);
      showToast('Activity added');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to add activity');
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-zinc-500 animate-pulse">Loading client…</div>;
  }

  if (error || !client) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-semibold text-zinc-900">{error || 'Client not found'}</p>
        <Link to="/clients" className="text-xs font-semibold text-zinc-600 mt-3 inline-block">
          Back to Clients
        </Link>
      </div>
    );
  }

  const leadId = client.leadId || client.sourceLead?._id || client.sourceLead?.id || sourceLead?._id;

  const extensionRequestType = {
    key: extensionData?.requestType?.key,
    name: extensionData?.requestType?.name || client.sourceLead?.requestType || sourceLead?.requestType,
  };

  const leadRequestType =
    sourceLead?.requestType ||
    client.sourceLead?.requestType ||
    extensionData?.requestType?.name ||
    '';

  /**
   * Read-only sections an extension contributes to this Overview tab
   * (crm-travel adds Travel Requirement when the source lead's Request Type
   * is Travel). Formatted by the extension — never raw JSON.
   */
  const overviewSections = extensionData
    ? clientOverviewSectionsForRequestType(extensionRequestType)
    : [];

  /**
   * Native tabs contributed by enabled extensions, filtered by the source
   * lead's request type (crm-travel adds Passports when the lead's Request
   * Type is Travel).
   */
  const extensionTabs = extensionData ? clientTabsForRequestType(extensionRequestType) : [];

  const activeExtensionTab = isExtensionTab(tab)
    ? extensionTabs.find((t) => extensionTabId(t.id) === tab) || null
    : null;

  const tabs = (
    [
      { id: 'overview', label: 'Overview' },
      { id: 'contacts', label: `Contacts (${contacts.length})` },
      { id: 'addresses', label: 'Addresses' },
      { id: 'notes', label: `Notes (${notes.length})` },
      { id: 'timeline', label: 'Timeline' },
      { id: 'documents', label: 'Documents' },
      { id: 'portal', label: 'Portal' },
      { id: 'projects', label: 'Projects', show: canProjects },
      { id: 'tasks', label: 'Tasks', show: canTasks },
      { id: 'time-logs', label: 'Time logs', show: canTime },
      { id: 'finance', label: 'Finance', show: canFinance },
      { id: 'tickets', label: 'Tickets', show: canTickets },
      { id: 'health', label: 'Health' },
      { id: 'audit', label: 'Audit', show: canAudit },
      ...extensionTabs.map((t) => ({
        id: extensionTabId(t.id),
        label: t.label,
      })),
    ] as { id: TabId; label: string; show?: boolean }[]
  ).filter((t) => t.show !== false);

  const kpiCards = summary
    ? [
        {
          label: 'Contacts',
          value: String(summary.contactCount ?? summary.contacts ?? contacts.length ?? 0),
          tab: 'contacts' as TabId,
          alert: false,
        },
        {
          label: 'Projects',
          value: `${summary.activeProjects ?? 0}/${summary.totalProjects ?? summary.projects ?? 0}`,
          tab: 'projects' as TabId,
          alert: false,
        },
        {
          label: 'Open tasks',
          value: String(summary.openTasks ?? 0),
          tab: 'tasks' as TabId,
          alert: Number(summary.overdueTasks || 0) > 0,
          hint: Number(summary.overdueTasks || 0) > 0 ? `${summary.overdueTasks} overdue` : undefined,
        },
        {
          label: 'Unpaid invoices',
          value: String(summary.unpaidInvoices ?? summary.invoices ?? 0),
          tab: 'finance' as TabId,
          alert: Number(summary.overdueInvoices || 0) > 0,
          hint:
            Number(summary.overdueInvoices || 0) > 0 ? `${summary.overdueInvoices} overdue` : undefined,
        },
        {
          label: 'Outstanding',
          value: moneyLabel(summary.outstandingBalance, summary.defaultCurrency),
          tab: 'finance' as TabId,
          alert: Number(summary.outstandingBalance || 0) > 0,
        },
        {
          label: 'Hours this month',
          value: `${Number(summary.loggedHoursThisMonth || 0)}h`,
          tab: 'time-logs' as TabId,
          alert: false,
        },
      ]
    : [];

  return (
    <div data-tour="clients-detail-root" className="flex flex-col gap-5">
      {toast && (
        <div className="fixed top-20 right-6 z-[80] px-4 py-2.5 rounded-lg text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          {toast}
        </div>
      )}

      {/* Hero */}
      <section data-tour="clients-detail-hero" className="rounded-xl border border-zinc-300 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link
              to="/clients"
              data-tour="clients-detail-back"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground no-underline hover:text-foreground"
            >
              <ArrowBackIcon sx={{ fontSize: 16 }} />
              Clients
            </Link>
            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Client profile
            </p>
            <div className="flex items-start gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl font-bold crm-on-solid"
                style={{ backgroundColor: resolveClientAvatarColor(client.avatarColor) }}
              >
                {client.avatarUrl ? (
                  <img
                    src={resolveClientMediaUrl(client.avatarUrl)}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  client.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h1 className="m-0 text-2xl font-bold tracking-tight text-foreground">{client.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {statusPill(client.status)}
                  {client.category ? (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      {client.category}
                    </span>
                  ) : null}
                  {(client.tags || []).slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {client.email ? (
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {client.email}
                    </span>
                  ) : null}
                  {client.phone ? (
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {client.phone}
                    </span>
                  ) : null}
                  {client.taxId ? (
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Tax: {client.taxId}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {leadId ? (
              <Link
                to={`/leads/${leadId}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 no-underline hover:bg-zinc-50"
              >
                <OpenInNewIcon sx={{ fontSize: 14 }} />
                View source lead
              </Link>
            ) : null}
            <button
              type="button"
              data-tour="clients-edit-overview-btn"
              onClick={goToOverviewEditor}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Edit overview
            </button>
            {canDelete && (
              <button
                type="button"
                data-tour="clients-delete-btn"
                onClick={handleDelete}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                Delete
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Account summary KPIs */}
      {summary && (
        <section data-tour="clients-account-summary" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="m-0 text-sm font-bold text-zinc-950">Account summary</h2>
              <p className="m-0 text-[11px] text-zinc-500">Click a card to jump to related records</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && (
                <button
                  type="button"
                  data-tour="clients-summary-add-contact"
                  onClick={() => {
                    setTab('contacts');
                    setEditingContactId(null);
                  }}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Link contact
                </button>
              )}
              {canProjects && (
                <button
                  type="button"
                  data-tour="clients-summary-view-projects"
                  onClick={() => setTab('projects')}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  View projects
                </button>
              )}
              {canTasks && (
                <button
                  type="button"
                  data-tour="clients-summary-view-tasks"
                  onClick={() => setTab('tasks')}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  View tasks
                </button>
              )}
              <button
                type="button"
                data-tour="clients-summary-refresh"
                onClick={refreshSummary}
                disabled={refreshingSummary}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <RefreshIcon sx={{ fontSize: 14 }} />
                {refreshingSummary ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
          <div data-tour="clients-summary-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {kpiCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => setTab(card.tab)}
                className={`cursor-pointer rounded-xl border p-3 text-left transition-colors hover:bg-zinc-50 ${
                  card.alert
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-zinc-200 bg-white'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {card.label}
                </div>
                <div className="mt-0.5 text-lg font-bold text-zinc-950">{card.value}</div>
                {card.hint ? (
                  <div className="mt-1 text-[10px] font-semibold text-amber-800">{card.hint}</div>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      )}

      <div data-tour="clients-detail-tabs" className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            data-tour={`clients-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px cursor-pointer whitespace-nowrap border-none border-b-2 bg-transparent px-3 py-2.5 text-xs font-semibold ${
              tab === t.id
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <aside className="flex flex-col gap-4 lg:col-span-4">
            <div data-tour="clients-overview-glance" className="rounded-xl border border-zinc-300 bg-white p-4">
              <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-500">
                At a glance
              </h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Contacts</dt>
                  <dd className="m-0 font-semibold text-zinc-900">
                    {summary?.contactCount ?? contacts.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Projects</dt>
                  <dd className="m-0 font-semibold text-zinc-900">
                    {summary?.totalProjects ?? summary?.projects ?? 0}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Open tasks</dt>
                  <dd className="m-0 font-semibold text-zinc-900">{summary?.openTasks ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Tax ID</dt>
                  <dd className="m-0 font-semibold text-zinc-900">{client.taxId || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Website</dt>
                  <dd className="m-0 truncate font-semibold text-zinc-900">
                    {client.website || '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div data-tour="clients-overview-origin" className="rounded-xl border border-zinc-300 bg-white p-4">
              <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-500">Origin</h3>
              <p className="mt-2 mb-0 text-sm font-semibold text-zinc-900">
                {leadId ? (
                  <Link to={`/leads/${leadId}`} className="text-zinc-900 no-underline hover:underline">
                    Converted from lead
                  </Link>
                ) : (
                  'Manual entry'
                )}
              </p>
              <p className="m-0 mt-1 text-[11px] text-zinc-500">
                Created {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '—'}
              </p>
            </div>

            <div data-tour="clients-overview-quick-notes" className="rounded-xl border border-zinc-300 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Quick notes
                </h3>
                <button
                  type="button"
                  onClick={() => setTab('notes')}
                  className="cursor-pointer border-none bg-transparent text-[11px] font-semibold text-zinc-600 hover:text-zinc-950"
                >
                  View all
                </button>
              </div>
              {quickNotes.length === 0 ? (
                <p className="m-0 text-xs text-zinc-400">No notes yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {quickNotes.map((n) => (
                    <div
                      key={n._id}
                      className={`rounded-lg border p-2.5 ${
                        n.pinned || n.isPinned ? 'border-amber-200 bg-amber-50/40' : 'border-zinc-100 bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {n.pinned || n.isPinned ? (
                          <PushPinIcon sx={{ fontSize: 12 }} className="text-amber-700" />
                        ) : null}
                        <span className="truncate text-xs font-semibold text-zinc-900">
                          {n.title || 'Untitled note'}
                        </span>
                      </div>
                      <p className="m-0 mt-1 line-clamp-2 text-[11px] text-zinc-600">{n.body || n.content || ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <div className="flex flex-col gap-4 lg:col-span-8">
            <div
              ref={overviewEditorRef}
              id="client-overview-editor"
              data-tour="clients-overview-company"
              className="rounded-xl border border-zinc-300 bg-white p-5 scroll-mt-24"
            >
              <h3 className="m-0 mb-1 text-sm font-bold text-zinc-950">Company information</h3>
              <p className="m-0 mb-4 text-[11px] text-zinc-500">
                Core account details used across projects, finance, and portal access.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Name</span>
                  <input
                    ref={overviewNameRef}
                    className={fieldClass}
                    value={editName}
                    disabled={!canWrite}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Email</span>
                  <input className={fieldClass} value={editEmail} disabled={!canWrite} onChange={(e) => setEditEmail(e.target.value)} />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Phone</span>
                  <PhoneNumberField
                    value={editPhone}
                    disabled={!canWrite}
                    onChange={setEditPhone}
                    inputClassName={fieldClass}
                    placeholder="98765 43210"
                  />
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Website</span>
                  <input className={fieldClass} value={editWebsite} disabled={!canWrite} onChange={(e) => setEditWebsite(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Avatar / photo</span>
                  <input className={fieldClass} value={editAvatar} disabled={!canWrite} onChange={(e) => setEditAvatar(e.target.value)} placeholder="Image URL" />
                  {canWrite ? (
                    <DocumentUploadControl
                      className="mt-1"
                      folder="clients"
                      entityId={id}
                      accept={IMAGE_ACCEPT}
                      buttonLabel="Choose image"
                      mode="auto"
                      currentUrl={editAvatar || null}
                      onUploaded={async (res) => {
                        const url = res.url || res.fileUrl || '';
                        setEditAvatar(url);
                        if (!id || !url) {
                          showToast('Photo uploaded — click Save changes');
                          return;
                        }
                        try {
                          const updated = await crmApi.updateClient(id, { avatarUrl: url });
                          const nextUrl = updated.data?.avatarUrl || url;
                          setEditAvatar(nextUrl);
                          setClient((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  avatarUrl: nextUrl,
                                }
                              : prev
                          );
                          showToast('Photo updated');
                        } catch (err: unknown) {
                          showToast(
                            err instanceof Error
                              ? `${err.message} — click Save changes to keep the photo`
                              : 'Photo uploaded — click Save changes'
                          );
                        }
                      }}
                      onError={(msg) => showToast(msg)}
                    />
                  ) : null}
                </label>
                <div className="sm:col-span-2">
                  <ClientAvatarColorPicker
                    value={editAvatarColor}
                    onChange={setEditAvatarColor}
                    disabled={!canWrite}
                  />
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Tax ID</span>
                  <input className={fieldClass} value={editTaxId} disabled={!canWrite} onChange={(e) => setEditTaxId(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Status</span>
                  <select className={fieldClass} value={editStatus} disabled={!canWrite} onChange={(e) => setEditStatus(e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Category</span>
                  <select className={fieldClass} value={editCategory} disabled={!canWrite} onChange={(e) => setEditCategory(e.target.value)}>
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Request type</span>
                  <div className="flex items-center gap-2">
                    <input
                      className={`${fieldClass} bg-zinc-50 text-zinc-700 cursor-default`}
                      value={leadRequestType || '—'}
                      readOnly
                      disabled
                      placeholder="—"
                    />
                    {leadId ? (
                      <Link
                        to={`/leads/${leadId}`}
                        className="inline-flex items-center text-xs font-semibold text-primary hover:underline whitespace-nowrap"
                        title="View source lead"
                      >
                        View lead
                      </Link>
                    ) : null}
                  </div>
                </label>
              </div>
            </div>

            <div data-tour="clients-overview-tags" className="rounded-xl border border-zinc-300 bg-white p-5">
              <h3 className="m-0 mb-3 text-sm font-bold text-zinc-950">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={!canWrite}
                    onClick={() =>
                      setEditTags((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-60 ${
                      editTags.includes(tag)
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {customFieldDefs.length > 0 && (
              <div className="rounded-xl border border-zinc-300 bg-white p-5">
                <h3 className="m-0 mb-3 text-sm font-bold text-zinc-950">Custom fields</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {customFieldDefs.map((def) => (
                    <label key={def.key} className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase text-zinc-500">{def.label}</span>
                      {def.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          disabled={!canWrite}
                          checked={Boolean(editCustomFields[def.key])}
                          onChange={(e) =>
                            setEditCustomFields((p) => ({ ...p, [def.key]: e.target.checked }))
                          }
                        />
                      ) : (
                        <input
                          className={fieldClass}
                          disabled={!canWrite}
                          type={def.type === 'number' ? 'number' : 'text'}
                          value={
                            editCustomFields[def.key] === undefined
                              ? ''
                              : String(editCustomFields[def.key])
                          }
                          onChange={(e) =>
                            setEditCustomFields((p) => ({
                              ...p,
                              [def.key]:
                                def.type === 'number'
                                  ? e.target.value === ''
                                    ? ''
                                    : Number(e.target.value)
                                  : e.target.value,
                            }))
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div data-tour="clients-overview-billing" className="rounded-xl border border-zinc-300 bg-white p-5">
              <h3 className="m-0 mb-3 text-sm font-bold text-zinc-950">Billing address</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(['street', 'city', 'state', 'country', 'zip'] as const).map((key) => (
                  <label key={key} className={`flex flex-col gap-1 ${key === 'street' ? 'sm:col-span-2' : ''}`}>
                    <span className="text-[11px] font-semibold uppercase text-zinc-500">{key}</span>
                    <input
                      className={fieldClass}
                      value={editBilling[key]}
                      disabled={!canWrite}
                      onChange={(e) => setEditBilling((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/*
              A failed extension-data fetch means the request type is unknown,
              so no extension sections or tabs can appear — say so rather than
              silently rendering nothing.
            */}
            {extensionDataError && leadId ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                Extension data could not be loaded: {extensionDataError}
              </div>
            ) : null}

            {/*
              Extension-contributed read-only sections (e.g. crm-travel's
              Travel Requirement). Read through from the source lead and
              formatted by the extension's own logic module.
            */}
            {overviewSections.map((entry) => (
              <ClientExtensionOverviewSection
                key={entry.sectionId}
                section={entry}
                extension={extensionData?.extension || null}
                leadId={extensionData?.leadId || (leadId ? String(leadId) : null)}
                loading={extensionDataLoading}
              />
            ))}

            {canWrite && (
              <div className="sticky bottom-4 z-10 flex justify-end">
                <button
                  type="button"
                  data-tour="clients-overview-save"
                  disabled={saving}
                  onClick={handleSaveOverview}
                  className="cursor-pointer rounded-lg border-none bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="m-0 text-sm font-bold text-zinc-950">Contacts</h3>
              <p className="m-0 text-[11px] text-zinc-500">
                Choose people from the Contacts directory, or create a new contact.
              </p>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/contacts/create?returnTo=${encodeURIComponent(createContactReturnTo)}`)
                }
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-3 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                <PersonAddAlt1Icon sx={{ fontSize: 15 }} />
                Create contact
              </button>
            )}
          </div>

          {canWrite && (
            <div className="rounded-xl border border-zinc-300 bg-white p-4">
              <ContactSelect
                value={pickerContact}
                disabled={linkingContact || saving}
                onChange={(contact) => void handleLinkPersonContact(contact)}
                hint={
                  linkingContact
                    ? 'Linking contact to this client…'
                    : 'Search and select a contact from the Contacts module to link them here.'
                }
              />
            </div>
          )}

          {canWrite && editingContactId && (
            <div className="grid grid-cols-1 items-end gap-3 rounded-xl border border-zinc-300 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
              <input
                className={fieldClass}
                placeholder="Name *"
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className={fieldClass}
                placeholder="Email"
                value={contactForm.email}
                onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
              />
              <PhoneNumberField
                inputClassName={fieldClass}
                placeholder="Phone"
                value={contactForm.phone}
                onChange={(phone) => setContactForm((p) => ({ ...p, phone }))}
              />
              <input
                className={fieldClass}
                placeholder="Designation"
                value={contactForm.designation}
                onChange={(e) => setContactForm((p) => ({ ...p, designation: e.target.value }))}
              />
              <label className="inline-flex h-9 items-center gap-2 text-xs font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={contactForm.isPrimary}
                  onChange={(e) => setContactForm((p) => ({ ...p, isPrimary: e.target.checked }))}
                />
                Primary
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveContact}
                  className="h-9 flex-1 cursor-pointer rounded-lg border-none bg-zinc-950 px-3 text-xs font-semibold text-white"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingContactId(null);
                    setContactForm({
                      name: '',
                      email: '',
                      phone: '',
                      designation: '',
                      isPrimary: false,
                    });
                  }}
                  className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            emptyState(
              'No contacts linked yet.',
              canWrite ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/contacts/create?returnTo=${encodeURIComponent(createContactReturnTo)}`)
                  }
                  className="cursor-pointer rounded-lg border-none bg-zinc-950 px-3 py-2 text-xs font-semibold text-white"
                >
                  Create first contact
                </button>
              ) : undefined
            )
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    {['Name', 'Email', 'Phone', 'Role', ''].map((h) => (
                      <th
                        key={h || 'a'}
                        className="px-4 py-2.5 text-[11px] font-semibold uppercase text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c._id} className="border-b border-zinc-100">
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-bold text-white">
                            {(c.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            {c.personContactId ? (
                              <Link
                                to={`/contacts/${c.personContactId}`}
                                className="font-semibold text-zinc-900 no-underline hover:underline"
                              >
                                {c.name}
                              </Link>
                            ) : (
                              <div className="font-semibold text-zinc-900">{c.name}</div>
                            )}
                            {c.isPrimary ? (
                              <span className="text-[10px] font-semibold text-zinc-500">
                                Primary contact
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{c.designation || '—'}</td>
                      <td className="space-x-2 px-4 py-3 text-right">
                        {c.personContactId ? (
                          <Link
                            to={`/contacts/${c.personContactId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 no-underline hover:text-zinc-950"
                          >
                            Open
                            <OpenInNewIcon sx={{ fontSize: 12 }} />
                          </Link>
                        ) : null}
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContactId(c._id);
                                setContactForm({
                                  name: c.name,
                                  email: c.email || '',
                                  phone: c.phone || '',
                                  designation: c.designation || '',
                                  isPrimary: !!c.isPrimary,
                                });
                              }}
                              className="cursor-pointer border-none bg-transparent text-xs text-zinc-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContact(c._id)}
                              className="cursor-pointer border-none bg-transparent text-xs text-red-600"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}



      {/*
        Extension-contributed record tabs — the CRM record manager (upload +
        OCR + list) whose fields come from the extension package. Read-only
        enquiry data is a section on the Overview tab instead.
      */}
      {activeExtensionTab ? (
        <ClientPassportsTab
          key={activeExtensionTab.tabId}
          clientId={String(id)}
          tab={activeExtensionTab}
          group={clientFieldsForTab(activeExtensionTab.extensionId, activeExtensionTab.id)}
          leadId={extensionData?.leadId || (leadId ? String(leadId) : null)}
          canWrite={canWrite}
          showToast={(message) => showToast(message)}
          confirm={confirm}
        />
      ) : isExtensionTab(tab) ? (
        extensionDataLoading ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-xs text-zinc-500">
            Loading extension tab…
          </div>
        ) : (
          emptyState(
            'This tab is no longer available — the extension that provided it may be disabled, or this client’s request type changed.'
          )
        )
      ) : null}

      {tab === 'addresses' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'billing', 'shipping', 'branch'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setAddrFilter(f)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                  addrFilter === f ? 'bg-zinc-950 text-white border-zinc-950' : 'bg-white text-zinc-700 border-zinc-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {canWrite && (
            <div className="bg-white border border-zinc-300 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <select className={fieldClass} value={addressForm.type} onChange={(e) => setAddressForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="billing">Billing</option>
                <option value="shipping">Shipping</option>
                <option value="branch">Branch</option>
                <option value="warehouse">Warehouse</option>
              </select>
              <input className={fieldClass} placeholder="Label" value={addressForm.label} onChange={(e) => setAddressForm((p) => ({ ...p, label: e.target.value }))} />
              <input className={fieldClass} placeholder="Street" value={addressForm.street} onChange={(e) => setAddressForm((p) => ({ ...p, street: e.target.value }))} />
              <input className={fieldClass} placeholder="City" value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} />
              <input className={fieldClass} placeholder="State" value={addressForm.state} onChange={(e) => setAddressForm((p) => ({ ...p, state: e.target.value }))} />
              <input className={fieldClass} placeholder="Country" value={addressForm.country} onChange={(e) => setAddressForm((p) => ({ ...p, country: e.target.value }))} />
              <input className={fieldClass} placeholder="ZIP" value={addressForm.zip} onChange={(e) => setAddressForm((p) => ({ ...p, zip: e.target.value }))} />
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
                  <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm((p) => ({ ...p, isDefault: e.target.checked }))} />
                  Default
                </label>
                <button type="button" onClick={handleSaveAddress} className="h-9 px-3 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer">
                  {editingAddressId ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}
          {filteredAddresses.length === 0 ? (
            emptyState('No addresses for this filter.')
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredAddresses.map((a) => (
                <div key={a._id} className="bg-white border border-zinc-300 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {a.label || a.type || 'Address'}
                        {a.isDefault ? (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Default</span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 uppercase">{a.type}</div>
                      <p className="text-xs text-zinc-700 m-0 mt-2">
                        {[a.street, a.city, a.state, a.country, a.zip].filter(Boolean).join(', ') || '—'}
                      </p>
                    </div>
                    {canWrite && (
                      <div className="flex flex-col gap-1 items-end">
                        <button
                          type="button"
                          className="text-[11px] text-zinc-700 bg-transparent border-none cursor-pointer"
                          onClick={() => {
                            setEditingAddressId(a._id || null);
                            setAddressForm({
                              type: a.type || 'billing',
                              label: a.label || '',
                              street: a.street || '',
                              city: a.city || '',
                              state: a.state || '',
                              country: a.country || 'India',
                              zip: a.zip || '',
                              isDefault: !!a.isDefault,
                            });
                          }}
                        >
                          Edit
                        </button>
                        {!a.isDefault && a._id && (
                          <button
                            type="button"
                            className="text-[11px] text-zinc-700 bg-transparent border-none cursor-pointer"
                            onClick={async () => {
                              await crmApi.setClientDefaultAddress(id, a._id!, a.type);
                              await refreshAddresses();
                              showToast('Default set');
                            }}
                          >
                            Set default
                          </button>
                        )}
                        {a._id && (
                          <button
                            type="button"
                            className="text-[11px] text-red-600 bg-transparent border-none cursor-pointer"
                            onClick={async () => {
                              await crmApi.deleteClientAddress(id, a._id!);
                              await refreshAddresses();
                              showToast('Address deleted');
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="m-0 text-sm font-bold text-zinc-950">Notes</h3>
              <p className="m-0 text-[11px] text-zinc-500">Internal account notes for the team</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="h-9 w-44 rounded-lg border border-zinc-300 bg-white px-3 text-xs outline-none focus:border-zinc-400"
                placeholder="Search notes…"
                value={notesSearch}
                onChange={(e) => setNotesSearch(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setNotesPinnedOnly(false)}
                className={`h-9 cursor-pointer rounded-lg border px-2.5 text-[11px] font-semibold ${
                  !notesPinnedOnly
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700'
                }`}
              >
                All ({notes.length})
              </button>
              <button
                type="button"
                onClick={() => setNotesPinnedOnly(true)}
                className={`h-9 cursor-pointer rounded-lg border px-2.5 text-[11px] font-semibold ${
                  notesPinnedOnly
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700'
                }`}
              >
                Pinned ({notes.filter((n) => n.pinned || n.isPinned).length})
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setShowNoteForm((v) => !v)}
                  className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800"
                >
                  {showNoteForm || editingNoteId ? 'Close form' : 'Add note'}
                </button>
              )}
            </div>
          </div>
          {canWrite && (showNoteForm || editingNoteId) && (
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
              <input className={fieldClass} placeholder="Title (optional)" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                placeholder="Add an internal note…"
                className="box-border w-full rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400"
              />
              <div className="flex justify-end gap-2">
                {editingNoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setNoteTitle('');
                      setNoteBody('');
                      setShowNoteForm(false);
                    }}
                    className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                )}
                <button type="button" onClick={() => void handleSaveNote()} className="cursor-pointer rounded-lg border-none bg-zinc-950 px-4 py-2 text-xs font-semibold text-white">
                  {editingNoteId ? 'Update note' : 'Add note'}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredNotes.length === 0 ? (
              emptyState('No notes yet.')
            ) : (
              filteredNotes.map((n) => (
                <div
                  key={n._id}
                  className={`rounded-xl border p-4 ${
                    n.pinned || n.isPinned ? 'border-amber-200 bg-amber-50/30' : 'border-zinc-200 bg-white'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {n.pinned || n.isPinned ? <PushPinIcon sx={{ fontSize: 14 }} className="text-amber-700" /> : null}
                      <h4 className="m-0 truncate text-sm font-semibold text-zinc-950">
                        {n.title || 'Untitled note'}
                      </h4>
                    </div>
                    {canWrite && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title={n.pinned || n.isPinned ? 'Unpin' : 'Pin'}
                          className="cursor-pointer border-none bg-transparent text-zinc-500"
                          onClick={async () => {
                            try {
                              await crmApi.togglePinClientNote(id, n._id);
                              const res = await crmApi.getClientNotes(id);
                              setNotes(res.data || []);
                            } catch (err: unknown) {
                              showToast(err instanceof Error ? err.message : 'Failed to update pin');
                            }
                          }}
                        >
                          {n.pinned || n.isPinned ? (
                            <PushPinIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="cursor-pointer border-none bg-transparent text-xs text-zinc-600"
                          onClick={() => {
                            setEditingNoteId(n._id);
                            setNoteTitle(n.title || '');
                            setNoteBody(n.body || n.content || '');
                            setShowNoteForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="cursor-pointer border-none bg-transparent text-xs text-red-600"
                          onClick={async () => {
                            try {
                              if (!(await confirm({ message: 'Delete this note?', tone: 'danger', confirmLabel: 'Delete' }))) return;
                              await crmApi.deleteClientNote(id, n._id);
                              setNotes((prev) => prev.filter((x) => x._id !== n._id));
                            } catch (err: unknown) {
                              showToast(err instanceof Error ? err.message : 'Failed to delete note');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="m-0 whitespace-pre-wrap text-xs leading-relaxed text-zinc-700">{n.body || n.content || ''}</p>
                  <p className="m-0 mt-2 text-[10px] text-zinc-400">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="flex flex-col gap-4">
          {canWrite && (
            <div className="bg-white border border-zinc-300 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <input className={fieldClass} placeholder="Activity title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
              <select className={fieldClass} value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {['Meeting', 'Call', 'Email', 'Follow-up', 'Task', 'Other'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input className={fieldClass} type="date" value={eventDue} onChange={(e) => setEventDue(e.target.value)} />
              <button type="button" onClick={() => void handleAddEvent()} className="h-9 px-4 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer">
                Add event
              </button>
            </div>
          )}
          <div className="bg-white border border-zinc-300 rounded-xl divide-y divide-zinc-100">
            {timeline.length === 0 && events.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">No timeline events.</div>
            ) : (
              (timeline.length ? timeline : events.map((ev) => ({
                _id: ev._id,
                title: ev.title,
                type: ev.type,
                description: ev.description,
                createdAt: ev.createdAt || '',
                category: 'event',
                meta: { eventId: ev._id, completed: ev.completed },
              }))).map((entry) => {
                const eventId = (entry.meta?.eventId as string) || (entry.category === 'event' ? entry._id.replace(/^tl_event_/, '') : '');
                const completed = Boolean(entry.meta?.completed);
                return (
                  <div key={entry._id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">{entry.title}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {entry.type || entry.category || 'Activity'}
                        {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleString()}` : ''}
                      </div>
                      {entry.description ? <p className="text-xs text-zinc-600 m-0 mt-1">{entry.description}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          completed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                        }`}
                      >
                        {completed ? 'Done' : 'Open'}
                      </span>
                      {canWrite && eventId && entry.category === 'event' && (
                        <>
                          {!completed && (
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-zinc-700 bg-transparent border-none cursor-pointer"
                              onClick={async () => {
                                await crmApi.completeClientEvent(id, eventId);
                                const [ev, tl] = await Promise.all([
                                  crmApi.getClientEvents(id),
                                  crmApi.getClientTimeline(id),
                                ]);
                                setEvents(ev.data || []);
                                setTimeline(tl.data || []);
                              }}
                            >
                              Complete
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-red-600 bg-transparent border-none cursor-pointer"
                            onClick={async () => {
                              await crmApi.deleteClientEvent(id, eventId);
                              const [ev, tl] = await Promise.all([
                                crmApi.getClientEvents(id),
                                crmApi.getClientTimeline(id),
                              ]);
                              setEvents(ev.data || []);
                              setTimeline(tl.data || []);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {DOC_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setDocCategory(cat)}
                className={`inline-flex h-8 cursor-pointer items-center rounded-lg border px-3 text-[11px] font-semibold ${
                  docCategory === cat
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {canWrite && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Upload document */}
              <div className="rounded-xl border border-zinc-300 bg-white p-4">
                <div className="mb-1 text-sm font-semibold text-zinc-950">Upload document</div>
                <p className="m-0 mb-3 text-[11px] text-zinc-500">
                  PDF, Word, Excel, PowerPoint, Markdown, text, CSV, RTF, or images (max 20MB).
                </p>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-zinc-600">Category</span>
                      <select
                        className={fieldClass}
                        value={docUploadForm.category}
                        onChange={(e) =>
                          setDocUploadForm((p) => ({ ...p, category: e.target.value }))
                        }
                      >
                        {DOC_CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-zinc-600">Description</span>
                      <input
                        className={fieldClass}
                        placeholder="Optional"
                        value={docUploadForm.description}
                        onChange={(e) =>
                          setDocUploadForm((p) => ({ ...p, description: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <DocumentUploadControl
                    mode="button"
                    buttonLabel="Choose file"
                    uploadButtonLabel="Upload document"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.markdown,.txt,.csv,.rtf,image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    disabled={docUploading}
                    uploadFn={async (file) => {
                      const res = await crmApi.uploadClientDocument(id, file, {
                        category: docUploadForm.category || 'General',
                        description: docUploadForm.description,
                      });
                      return {
                        url: res.data.url || '',
                        fileUrl: res.data.url || '',
                        fileName: res.data.name || file.name,
                        mimeType: res.data.mimeType || file.type,
                        fileSize: res.data.size || file.size,
                      };
                    }}
                    onUploaded={async () => {
                      setDocUploadForm({ category: 'General', description: '' });
                      const res = await crmApi.getClientDocuments(
                        id,
                        docCategory !== 'All' ? docCategory : undefined
                      );
                      setDocuments(res.data || []);
                      showToast('Document uploaded');
                    }}
                    onError={(msg) => showToast(msg)}
                  />
                </div>
              </div>

              {/* Add link */}
              <div className="rounded-xl border border-zinc-300 bg-white p-4">
                <div className="mb-1 text-sm font-semibold text-zinc-950">Add link</div>
                <p className="m-0 mb-3 text-[11px] text-zinc-500">
                  Save an external URL (Google Drive, Dropbox, SharePoint, etc.). Opens in a new tab.
                </p>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      className={fieldClass}
                      placeholder="Link name *"
                      value={docLinkForm.name}
                      onChange={(e) => setDocLinkForm((p) => ({ ...p, name: e.target.value }))}
                    />
                    <input
                      className={fieldClass}
                      placeholder="https://… *"
                      value={docLinkForm.url}
                      onChange={(e) => setDocLinkForm((p) => ({ ...p, url: e.target.value }))}
                    />
                    <select
                      className={fieldClass}
                      value={docLinkForm.category}
                      onChange={(e) => setDocLinkForm((p) => ({ ...p, category: e.target.value }))}
                    >
                      {DOC_CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      className={fieldClass}
                      placeholder="Description (optional)"
                      value={docLinkForm.description}
                      onChange={(e) =>
                        setDocLinkForm((p) => ({ ...p, description: e.target.value }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    disabled={docLinkSaving}
                    onClick={async () => {
                      if (!docLinkForm.name.trim() || !docLinkForm.url.trim()) {
                        showToast('Link name and URL are required');
                        return;
                      }
                      setDocLinkSaving(true);
                      try {
                        await crmApi.createClientDocument(id, docLinkForm);
                        setDocLinkForm({
                          name: '',
                          url: '',
                          category: 'General',
                          description: '',
                        });
                        const res = await crmApi.getClientDocuments(
                          id,
                          docCategory !== 'All' ? docCategory : undefined
                        );
                        setDocuments(res.data || []);
                        showToast('Link added');
                      } catch (err: unknown) {
                        showToast(err instanceof Error ? err.message : 'Failed to add link');
                      } finally {
                        setDocLinkSaving(false);
                      }
                    }}
                    className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-lg border-none bg-zinc-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                    {docLinkSaving ? 'Saving…' : 'Add link'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            emptyState(
              'No documents or links in this category yet.',
              canWrite ? (
                <span className="text-[11px] text-zinc-500">
                  Upload a file or add a link using the panels above.
                </span>
              ) : undefined
            )
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Uploaded files */}
              <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                  <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                    Documents ({documents.filter((d) => d.kind !== 'link').length})
                  </h3>
                  <p className="m-0 mt-0.5 text-[11px] text-zinc-500">Uploaded files — download</p>
                </div>
                {documents.filter((d) => d.kind !== 'link').length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500">No uploaded files</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        {['Name', 'Category', ''].map((h) => (
                          <th
                            key={h || 'x'}
                            className="px-4 py-2 text-[10px] font-semibold uppercase text-zinc-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {documents
                        .filter((d) => d.kind !== 'link')
                        .map((d) => (
                          <tr key={d._id} className="border-b border-zinc-100 hover:bg-zinc-50">
                            <td className="px-4 py-3 text-sm">
                              <div className="font-semibold text-zinc-900">{d.name}</div>
                              {d.description ? (
                                <div className="text-[11px] text-zinc-500">{d.description}</div>
                              ) : null}
                              <div className="mt-0.5 text-[10px] text-zinc-400">
                                {d.createdAt
                                  ? new Date(d.createdAt).toLocaleDateString()
                                  : '—'}
                                {d.uploadedByName ? ` · ${d.uploadedByName}` : ''}
                                {d.size ? ` · ${Math.max(1, Math.round(d.size / 1024))} KB` : ''}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                                {d.category || 'General'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex cursor-pointer items-center gap-1 border-none bg-transparent text-xs font-semibold text-zinc-800"
                                  onClick={async () => {
                                    try {
                                      await crmApi.downloadClientDocument(
                                        id,
                                        d._id,
                                        d.name || 'document'
                                      );
                                      showToast('Download started');
                                    } catch (err) {
                                      showToast(
                                        err instanceof Error ? err.message : 'Download failed'
                                      );
                                    }
                                  }}
                                >
                                  <DownloadOutlinedIcon sx={{ fontSize: 14 }} />
                                  Download
                                </button>
                                {canWrite && (
                                  <button
                                    type="button"
                                    className="cursor-pointer border-none bg-transparent text-xs text-red-600"
                                    onClick={async () => {
                                      await crmApi.deleteClientDocument(id, d._id);
                                      setDocuments((prev) =>
                                        prev.filter((x) => x._id !== d._id)
                                      );
                                      showToast('Document deleted');
                                    }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Links */}
              <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                  <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                    Links ({documents.filter((d) => d.kind === 'link').length})
                  </h3>
                  <p className="m-0 mt-0.5 text-[11px] text-zinc-500">External URLs — view</p>
                </div>
                {documents.filter((d) => d.kind === 'link').length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500">No links yet</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        {['Name', 'Category', ''].map((h) => (
                          <th
                            key={h || 'x'}
                            className="px-4 py-2 text-[10px] font-semibold uppercase text-zinc-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {documents
                        .filter((d) => d.kind === 'link')
                        .map((d) => (
                          <tr key={d._id} className="border-b border-zinc-100 hover:bg-zinc-50">
                            <td className="px-4 py-3 text-sm">
                              <div className="font-semibold text-zinc-900">{d.name}</div>
                              {d.description ? (
                                <div className="text-[11px] text-zinc-500">{d.description}</div>
                              ) : null}
                              <div className="mt-0.5 truncate text-[10px] text-zinc-400">
                                {d.url || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                                {d.category || 'General'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-2">
                                <a
                                  href={
                                    d.url?.startsWith('http')
                                      ? d.url
                                      : d.url
                                        ? `https://${d.url}`
                                        : '#'
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 no-underline hover:underline"
                                >
                                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                                  View
                                </a>
                                {canWrite && (
                                  <button
                                    type="button"
                                    className="cursor-pointer border-none bg-transparent text-xs text-red-600"
                                    onClick={async () => {
                                      await crmApi.deleteClientDocument(id, d._id);
                                      setDocuments((prev) =>
                                        prev.filter((x) => x._id !== d._id)
                                      );
                                      showToast('Link deleted');
                                    }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'portal' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-semibold text-zinc-950">Client portal</h3>
                <p className="m-0 text-[11px] text-zinc-500">
                  Share the full login URL, or invite a new portal user with credentials.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={clientPortalLoginUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-[11px] font-semibold text-zinc-800 no-underline hover:bg-zinc-50"
                >
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                  Open portal
                </a>
                {canWrite && (
                  <button
                    type="button"
                    onClick={openPortalInviteModal}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-zinc-950 px-3 text-[11px] font-semibold text-white hover:bg-zinc-800"
                  >
                    <PersonAddAlt1Icon sx={{ fontSize: 15 }} />
                    Client portal
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 break-all rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800">
              {lastPortalInviteUrl || clientPortalLoginUrl}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total users', value: portalMetrics.total },
              { label: 'Active', value: portalMetrics.active },
              { label: 'Invited', value: portalMetrics.invited },
              { label: 'Suspended', value: portalMetrics.suspended },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-zinc-300 bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{m.label}</div>
                <div className="mt-1 text-xl font-bold text-zinc-950">{m.value}</div>
              </div>
            ))}
          </div>

          {portalUsers.length === 0 ? (
            emptyState(
              'No client portal users invited yet.',
              canWrite ? (
                <button
                  type="button"
                  onClick={openPortalInviteModal}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-zinc-950 px-3 text-[11px] font-semibold text-white"
                >
                  <PersonAddAlt1Icon sx={{ fontSize: 15 }} />
                  Client portal
                </button>
              ) : undefined
            )
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
                <div>
                  <h3 className="m-0 text-sm font-semibold text-zinc-950">Portal users</h3>
                  <p className="m-0 text-[11px] text-zinc-500">Manage access and invitation status</p>
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={openPortalInviteModal}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    <PersonAddAlt1Icon sx={{ fontSize: 15 }} />
                    Client portal
                  </button>
                )}
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    {['User', 'Status', 'Activity', 'Permissions', ''].map((h) => (
                      <th key={h || 'p'} className="px-4 py-2.5 text-[11px] font-semibold uppercase text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portalUsers.map((u) => {
                    const status = String(u.status || 'Invited');
                    const statusClass =
                      status.toLowerCase() === 'active'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : status.toLowerCase() === 'pending_approval'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : status.toLowerCase() === 'rejected'
                            ? 'border-rose-200 bg-rose-50 text-rose-800'
                            : status.toLowerCase() === 'suspended'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : status.toLowerCase() === 'revoked'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-zinc-200 bg-zinc-100 text-zinc-700';
                    const displayStatus =
                      status === 'Pending_Approval'
                        ? 'Pending Approval'
                        : status;
                    return (
                      <tr key={u._id} className="border-b border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3 text-sm">
                          <div className="font-semibold text-zinc-900">{u.name || 'User'}</div>
                          <div className="text-[11px] text-zinc-500">{u.email}</div>
                          {u.username ? <div className="text-[10px] text-zinc-400">@{u.username}</div> : null}
                          {u.requestedByName ? (
                            <div className="text-[10px] text-zinc-400">Requested by: {u.requestedByName}</div>
                          ) : null}
                          {status === 'Rejected' && u.rejectionReason ? (
                            <div className="text-[10px] font-semibold text-rose-600 mt-0.5">Reason: {u.rejectionReason}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-zinc-500">
                          <div>{status === 'Pending_Approval' ? 'Requested' : 'Invited'}: {u.requestedAt || u.invitedAt ? new Date(u.requestedAt || u.invitedAt!).toLocaleDateString() : '—'}</div>
                          <div>Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-zinc-500">Standard CRM Client Permissions</td>
                        <td className="px-4 py-3 text-right">
                          {canWrite && (
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {u.status === 'Pending_Approval' && canApprovePortal && (
                                <>
                                  <button
                                    type="button"
                                    className="cursor-pointer rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                    onClick={() => handleApprovePortalUser(u._id)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="cursor-pointer rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                                    onClick={() => {
                                      setRejectingAccessId(u._id);
                                      setClientRejectionReason('');
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {u.status === 'Rejected' && (
                                <button
                                  type="button"
                                  className="cursor-pointer rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                                  onClick={() => {
                                    setResubmittingAccessId(u._id);
                                    setPortalInvite({
                                      name: u.name || '',
                                      email: u.email,
                                      username: u.username || '',
                                      password: '',
                                      portalRole: u.portalRole || 'Standard',
                                      permissions: [],
                                    });
                                    setShowPortalInvite(true);
                                  }}
                                >
                                  Resubmit
                                </button>
                              )}
                              {u.status === 'Invited' && (
                                <>
                                  <button type="button" className="cursor-pointer border-none bg-transparent text-[11px] text-zinc-700 hover:underline" onClick={async () => { await crmApi.resendClientPortalInvitation(id, u._id); showToast('Resent'); }}>Resend</button>
                                  <button type="button" className="cursor-pointer border-none bg-transparent text-[11px] text-zinc-700 hover:underline" onClick={async () => { await crmApi.activateClientPortalUser(id, u._id); const res = await crmApi.getClientPortalAccess(id); setPortalUsers(res.data || []); }}>Activate</button>
                                </>
                              )}
                              {u.status === 'Active' && (
                                <button type="button" className="cursor-pointer border-none bg-transparent text-[11px] text-zinc-700 hover:underline" onClick={async () => { await crmApi.suspendClientPortalUser(id, u._id, 'Suspended from CRM'); const res = await crmApi.getClientPortalAccess(id); setPortalUsers(res.data || []); }}>Suspend</button>
                              )}
                              {u.status === 'Suspended' && (
                                <button type="button" className="cursor-pointer border-none bg-transparent text-[11px] text-zinc-700 hover:underline" onClick={async () => { await crmApi.reinstateClientPortalUser(id, u._id); const res = await crmApi.getClientPortalAccess(id); setPortalUsers(res.data || []); }}>Reinstate</button>
                              )}
                              <button type="button" className="cursor-pointer border-none bg-transparent text-[11px] text-red-600 hover:underline" onClick={async () => { if (!(await confirm({ message: 'Revoke portal access?', tone: 'danger', confirmLabel: 'Revoke' }))) return; await crmApi.revokeClientPortalAccess(id, u._id); setPortalUsers((prev) => prev.filter((x) => x._id !== u._id)); }}>Revoke</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

                    {rejectingAccessId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
                <h3 className="m-0 text-base font-bold text-zinc-950">Reject Portal Access Request</h3>
                <p className="mt-1 mb-3 text-xs text-zinc-500">
                  Please provide a rejection reason so the sales representative can make necessary corrections.
                </p>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                  value={clientRejectionReason}
                  onChange={(e) => setClientRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason (e.g., Missing verification or incorrect contact details)..."
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={rejectingSaving}
                    onClick={() => {
                      setRejectingAccessId(null);
                      setClientRejectionReason('');
                    }}
                    className="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={rejectingSaving}
                    onClick={handleRejectPortalUser}
                    className="h-8 rounded-lg border-0 bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    {rejectingSaving ? 'Rejecting…' : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPortalInvite && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="client-portal-invite-title"
              onClick={() => {
                if (!portalInviteSaving) setShowPortalInvite(false);
              }}
            >
              <div
                className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                  <div>
                    <h3 id="client-portal-invite-title" className="m-0 text-base font-bold text-zinc-950">
                      {resubmittingAccessId ? 'Resubmit Client Portal Request' : canApprovePortal ? 'Invite Client Portal User' : 'Request Client Portal Access'}
                    </h3>
                    <p className="m-0 mt-1 text-[11px] text-zinc-500">
                      {canApprovePortal ? 'Create login credentials and email the full portal URL to this client.' : 'Submit credentials to Sales Manager for approval. Once approved, login link and credentials will be emailed to the client.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    disabled={portalInviteSaving}
                    onClick={() => setShowPortalInvite(false)}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-600">
                      Name *
                      <input
                        className={fieldClass}
                        value={portalInvite.name}
                        onChange={(e) => setPortalInvite((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Contact name"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-600">
                      Email *
                      <input
                        type="email"
                        className={fieldClass}
                        value={portalInvite.email}
                        onChange={(e) => setPortalInvite((p) => ({ ...p, email: e.target.value }))}
                        placeholder="client@company.com"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-600">
                      Username
                      <input
                        className={fieldClass}
                        value={portalInvite.username}
                        onChange={(e) => setPortalInvite((p) => ({ ...p, username: e.target.value }))}
                        placeholder="Optional username"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-zinc-600">
                      Password
                      <input
                        type="text"
                        className={fieldClass}
                        value={portalInvite.password}
                        onChange={(e) => setPortalInvite((p) => ({ ...p, password: e.target.value }))}
                        placeholder="Leave blank to auto-generate"
                        autoComplete="new-password"
                      />
                    </label>
                  </div>



                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Portal login URL
                    </div>
                    <div className="mt-1 break-all font-mono text-[11px] text-zinc-800">
                      {clientPortalLoginUrl}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
                  <button
                    type="button"
                    disabled={portalInviteSaving}
                    onClick={() => setShowPortalInvite(false)}
                    className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={portalInviteSaving}
                    onClick={submitPortalInvite}
                    className="inline-flex h-9 cursor-pointer items-center rounded-lg border-none bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {portalInviteSaving ? 'Submitting…' : resubmittingAccessId ? 'Resubmit Request' : canApprovePortal ? 'Send Invite' : 'Submit for Approval'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'projects' && (
        projects.length === 0 ? emptyState('No projects linked to this client.') : (
          <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  {['Project', 'Status', 'Start', 'End'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p._id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                      <Link to={`/projects/${p._id}`} className="text-zinc-950 no-underline hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{p.status || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{p.startDate || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{p.endDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'tasks' && (
        tasks.length === 0 ? emptyState('No tasks for this client.') : (
          <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  {['Task', 'Status', 'Priority', 'Due', 'Assignee'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t._id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                      <Link to={`/tasks/${t._id}`} className="text-zinc-950 no-underline hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{t.status || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{t.priority || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{t.dueDate || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{displayUserLabel(t.assigneeName)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'time-logs' && (
        timeLogs.length === 0 ? emptyState('No time logs for this client.') : (
          <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  {['Task', 'User', 'Hours', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeLogs.map((tl) => (
                  <tr key={tl._id} className="border-b border-zinc-100">
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{tl.taskTitle || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{displayUserLabel(tl.userName)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-zinc-900">{tl.hours ?? 0}h</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{tl.date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'tickets' && (
        tickets.length === 0 ? emptyState('No tickets for this client.') : (
          <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  {['Ticket', 'Status', 'Priority', 'Updated'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((tk) => (
                  <tr key={tk._id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                      <Link to={`/tickets/${tk._id}`} className="text-zinc-950 no-underline hover:underline">
                        {tk.ticketNumber ? `${tk.ticketNumber} · ` : ''}
                        {displayLabel(tk.subject)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{tk.status || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{tk.priority || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {tk.updatedAt ? new Date(tk.updatedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'finance' && (
        <div className="flex flex-col gap-5">
          {[
            {
              title: 'Quotations',
              empty: 'No quotations.',
              rows: quotations,
              headers: ['Number', 'Title', 'Status', 'Total'],
              render: (q: ClientRelatedQuotation) => (
                <>
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                    <Link to={`/quotations/${q._id}`} className="text-zinc-950 no-underline hover:underline">
                      {displayLabel(q.number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700">{q.title || '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{q.status || '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-700">
                    {q.total != null ? moneyLabel(q.total, q.currency) : '—'}
                  </td>
                </>
              ),
            },
            {
              title: 'Invoices',
              empty: 'No invoices.',
              rows: invoices,
              headers: ['Number', 'Status', 'Total', 'Balance'],
              render: (inv: ClientRelatedInvoice) => (
                <>
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                    <Link to={`/invoices/${inv._id}`} className="text-zinc-950 no-underline hover:underline">
                      {displayLabel(inv.number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{inv.status || '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-700">
                    {inv.total != null ? moneyLabel(inv.total, inv.currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700">
                    {inv.balanceDue != null ? moneyLabel(inv.balanceDue, inv.currency) : '—'}
                  </td>
                </>
              ),
            },
            {
              title: 'Payments',
              empty: 'No payments.',
              rows: payments,
              headers: ['Number', 'Amount', 'Method', 'Status'],
              render: (p: ClientRelatedPayment) => (
                <>
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                    <Link to={`/payments/${p._id}`} className="text-zinc-950 no-underline hover:underline">
                      {displayLabel(p.number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700">
                    {p.amount != null ? moneyLabel(p.amount, p.currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{p.method || '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{p.status || '—'}</td>
                </>
              ),
            },
          ].map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 mt-0 text-sm font-semibold text-zinc-950">{section.title}</h3>
              {section.rows.length === 0 ? (
                emptyState(section.empty)
              ) : (
                <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        {section.headers.map((h) => (
                          <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row) => (
                        <tr key={row._id} className="border-b border-zinc-100 hover:bg-zinc-50">
                          {section.render(row as never)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'health' && (
        <div className="rounded-xl border border-zinc-300 bg-white p-6">
          {!health ? (
            <div className="text-xs text-zinc-500">Loading health score…</div>
          ) : (
            <div className="flex flex-col items-start gap-6 sm:flex-row">
              <div
                className={`flex h-28 w-28 flex-col items-center justify-center rounded-2xl border ${
                  (health.healthScore || 0) < 50
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : (health.healthScore || 0) < 75
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                <div className="text-3xl font-bold">{health.healthScore}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase">{health.healthCategory || 'Score'}</div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3">
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="text-[10px] font-semibold uppercase text-zinc-500">Open tickets</div>
                  <div className="text-lg font-bold text-zinc-950">{health.openTicketsCount ?? 0}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="text-[10px] font-semibold uppercase text-zinc-500">Overdue invoices</div>
                  <div className="text-lg font-bold text-zinc-950">{health.overdueInvoicesCount ?? 0}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="text-[10px] font-semibold uppercase text-zinc-500">Open tasks</div>
                  <div className="text-lg font-bold text-zinc-950">{summary?.openTasks ?? 0}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="text-[10px] font-semibold uppercase text-zinc-500">Outstanding</div>
                  <div className="text-lg font-bold text-zinc-950">
                    {moneyLabel(summary?.outstandingBalance, summary?.defaultCurrency)}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3 sm:col-span-2">
                  <div className="text-[10px] font-semibold uppercase text-zinc-500">Last activity</div>
                  <div className="mt-0.5 text-sm font-semibold text-zinc-800">
                    {health.lastActivityAt ? new Date(health.lastActivityAt).toLocaleString() : '—'}
                  </div>
                  {health.notes ? <p className="m-0 mt-2 text-xs text-zinc-500">{health.notes}</p> : null}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        audit.length === 0 ? emptyState('No audit entries for this client.') : (
          <div className="bg-white border border-zinc-300 rounded-xl divide-y divide-zinc-100">
            {audit.map((a) => (
              <div key={a._id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-zinc-900">{a.action}</div>
                  <div className="text-[11px] text-zinc-400">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                  </div>
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">{a.description}</div>
                <div className="text-[11px] text-zinc-400 mt-1">{a.username || 'System'}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
