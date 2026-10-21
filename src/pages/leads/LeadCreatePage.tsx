import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { ApiError, crmApi } from '../../services/api';
import { canAssignToOtherUsers } from '../../utils/permissions';
import { AssignableUser, LeadCustomFieldDef, LeadItem, LeadOcrExtractResult } from '../../types/leads';
import { PersonContact, formatContactName } from '../../types/contacts';
import { LeadLocationMap } from '../../components/leads/LeadLocationMap';
import { AddLeadItemModal } from '../../components/leads/AddLeadItemModal';
import { OcrLeadImportModal } from '../../components/leads/OcrLeadImportModal';
import { AddCustomFieldModal } from '../../components/common/AddCustomFieldModal';
import { CompanyDiscrepancyModal } from '../../components/common/CompanyDiscrepancyModal';
import { useCompanyDiscrepancyCheck } from '../../hooks/useCompanyDiscrepancyCheck';
import {
  ContactFormFields,
  ContactFormValues,
  EMPTY_CONTACT_FORM,
  contactFormToInput,
  validateContactForm,
} from '../../components/contacts/ContactFormFields';
import { ContactDuplicateBanner } from '../../components/contacts/ContactDuplicateBanner';
import { useContactDuplicates } from '../../components/contacts/useContactDuplicates';
import {
  PIPELINE_STAGES as DEFAULT_PIPELINE_STAGES,
  LEAD_STATUSES as DEFAULT_LEAD_STATUSES,
  LEAD_SOURCES as DEFAULT_LEAD_SOURCES,
  LEAD_TAGS as DEFAULT_LEAD_TAGS,
  LEAD_TYPES as DEFAULT_LEAD_TYPES,
  LEAD_PRIORITIES as DEFAULT_LEAD_PRIORITIES,
  LEAD_REQUEST_TYPES,
  mergeLeadStatusesWithBuiltins,
} from '../../services/mockLeadData';
import type { RequestType } from '../../types/request-types';
import { displayLabel } from '../../utils/displayLabels';
import { reverseGeocode } from '../../utils/reverseGeocode';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { getCurrencySymbol } from '../../utils/currency';
import {
  ExtensionFieldsSlot,
  buildExtensionPayloadFromFields,
  validateExtensionFields,
} from '../../components/extensions/ExtensionFieldsSlot';
import { useExtensions } from '../../hooks/useExtensions';

const CONTACT_SEARCH_LIMIT = 8;

const inputCls =
  'w-full border border-zinc-300 rounded-lg p-2 bg-white text-zinc-900 outline-none focus:border-zinc-950';
const labelCls = 'block font-semibold text-zinc-600 mb-1';
const addLinkCls =
  'text-[11px] font-semibold text-zinc-900 hover:underline bg-transparent border-none cursor-pointer';
const sectionCls = 'bg-white border border-zinc-300 rounded-xl p-6';
const sectionTitleCls =
  'text-xs font-bold text-zinc-950 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-100';

const asStringList = (value: unknown, fallback: string[]): string[] => {
  if (Array.isArray(value) && value.length) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return [...fallback];
};

/** `YYYY-MM-DD` in the user's local timezone (for <input type="date"> min / validation). */
const localDateInputValue = (): string => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
};

export const LeadCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission, user, isClient, activeRole } = useAuth();
  const { confirm } = useDialog();
  const {
    createFieldsForRequestType,
    leadTabsForRequestType,
    summary: extensionSummary,
  } = useExtensions();
  const canWrite = hasPermission('crm.leads.write');
  const canAssignOthers = canAssignToOtherUsers(user, { isClient, activeRole });
  const currentUserId = String(user?.userId || '').trim();
  const settingsCurrency = useDefaultCurrency();
  const preparedByLabel =
    String(user?.username || user?.email || user?.userId || '').trim() || 'current-user';
  /** Flat field values per extensionId — logic lives in extension ui/fields/calc.js */
  const [extensionFieldValues, setExtensionFieldValues] = useState<
    Record<string, Record<string, unknown>>
  >({});

  // Metadata
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [leadPriorities, setLeadPriorities] = useState<string[]>([]);
  const [leadTags, setLeadTags] = useState<string[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<LeadCustomFieldDef[]>([]);
  /** Fields added on this create form only — not saved to Settings / other leads. */
  const [sessionCustomFieldDefs, setSessionCustomFieldDefs] = useState<LeadCustomFieldDef[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});

  // A) Lead
  const [title, setTitle] = useState('');
  const [leadType, setLeadType] = useState('');
  const [company, setCompany] = useState('');
  const [priority, setPriority] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [status, setStatus] = useState('');
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [requestType, setRequestType] = useState('');
  const [requestTypeId, setRequestTypeId] = useState('');
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [value, setValue] = useState<number | ''>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Inbound']);
  const [notes, setNotes] = useState('');

  // B) Contact person
  const [selectedContact, setSelectedContact] = useState<PersonContact | null>(null);
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<PersonContact[]>([]);
  const [contactSearching, setContactSearching] = useState(false);
  const [contactSearchError, setContactSearchError] = useState<string | null>(null);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [newContact, setNewContact] = useState<ContactFormValues>({ ...EMPTY_CONTACT_FORM });
  const contactPickerRef = useRef<HTMLDivElement>(null);
  const contactSearchSeq = useRef(0);
  const {
    duplicates: contactDuplicates,
    checkValues: checkContactDuplicates,
    setDuplicates: setContactDuplicates,
    clear: clearContactDuplicates,
    checking: contactDupChecking,
  } = useContactDuplicates();

  // C) Location
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  /** GPS origin from “Use my location” — pin adjustments stay within 50 m of this. */
  const [locationAnchor, setLocationAnchor] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Submission state
  const [duplicateMatches, setDuplicateMatches] = useState<LeadItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Modals
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [showAddStatusModal, setShowAddStatusModal] = useState(false);
  const [showAddPriorityModal, setShowAddPriorityModal] = useState(false);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showAddCustomFieldModal, setShowAddCustomFieldModal] = useState(false);
  const [showOcrImportModal, setShowOcrImportModal] = useState(false);
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);

  // Email / phone / name that will end up on the lead (drives duplicate & discrepancy checks)
  const leadName = selectedContact ? selectedContact.name || '' : newContact.name;
  const leadEmail = selectedContact ? selectedContact.email || '' : newContact.email;
  const leadPhone = selectedContact ? selectedContact.phone || '' : newContact.phone;

  // Debounced discrepancy check (different company with same email/phone/name)
  const { discrepancy, checkNow: checkDiscrepancyNow } = useCompanyDiscrepancyCheck({
    name: leadName,
    email: leadEmail,
    phone: leadPhone,
    companyName: company,
    entityType: 'lead',
    debounceMs: 400,
  });

  // Load metadata — each endpoint loads independently so one failure does not blank all selects
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [pipeRes, statRes, srcRes, tagRes, usrRes, cfRes, prioRes, rtRes] =
          await Promise.allSettled([
            crmApi.getPipeline(),
            crmApi.getLeadStatuses(),
            crmApi.getLeadSources(),
            crmApi.getLeadTags(),
            crmApi.getAssignableUsers(),
            crmApi.getLeadCustomFields(),
            crmApi.getLeadPriorities(),
            crmApi.listRequestTypes({ enabledOnly: true }),
          ]);

        const stages =
          pipeRes.status === 'fulfilled'
            ? asStringList(pipeRes.value.data?.pipeline_stages, DEFAULT_PIPELINE_STAGES)
            : [...DEFAULT_PIPELINE_STAGES];
        const statuses = mergeLeadStatusesWithBuiltins(
          statRes.status === 'fulfilled'
            ? asStringList(statRes.value.data, DEFAULT_LEAD_STATUSES)
            : [...DEFAULT_LEAD_STATUSES]
        );
        const sources =
          srcRes.status === 'fulfilled'
            ? asStringList(srcRes.value.data, DEFAULT_LEAD_SOURCES)
            : [...DEFAULT_LEAD_SOURCES];
        const tags =
          tagRes.status === 'fulfilled'
            ? asStringList(tagRes.value.data, DEFAULT_LEAD_TAGS)
            : [...DEFAULT_LEAD_TAGS];
        const priorities =
          prioRes.status === 'fulfilled'
            ? asStringList(prioRes.value.data, DEFAULT_LEAD_PRIORITIES)
            : [...DEFAULT_LEAD_PRIORITIES];
        const users =
          usrRes.status === 'fulfilled' && Array.isArray(usrRes.value.data)
            ? usrRes.value.data
                .map((u) => {
                  const id = String(u.id || u._id || u.userId || '').trim();
                  const displayName = u.displayName || u.name || u.username || u.email || 'User';
                  return { ...u, id, name: u.name || displayName, displayName };
                })
                .filter((u) => u.id)
            : [];
        const customFieldList =
          cfRes.status === 'fulfilled' && Array.isArray(cfRes.value.data) ? cfRes.value.data : [];
        const enabledRequestTypes =
          rtRes.status === 'fulfilled' && Array.isArray(rtRes.value.data)
            ? rtRes.value.data
            : [];

        setPipelineStages(stages);
        setLeadStatuses(statuses);
        setLeadSources(sources);
        setLeadTags(tags);
        setLeadPriorities(priorities);
        setAssignableUsers(users);
        if (!canAssignOthers && currentUserId) {
          setAssignedTo(currentUserId);
        } else if (!canAssignOthers && users[0]?.id) {
          setAssignedTo(users[0].id);
        }
        setCustomFieldDefs(customFieldList);
        setSessionCustomFieldDefs([]);
        setCustomFields({});
        const nextRequestTypes = enabledRequestTypes.length
          ? enabledRequestTypes
          : LEAD_REQUEST_TYPES.map((name, index) => ({
              _id: `legacy_${index}`,
              key: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              name,
              isEnabled: true,
              fields: [],
            }));
        setRequestTypes(nextRequestTypes);

        // Defaults for required fields: Stage = New, Request Type = Project (software)
        if (stages.length) {
          setStage((prev) => prev || (stages.includes('New') ? 'New' : stages[0]));
        }
        if (statuses.length) setStatus((prev) => prev || statuses[0]);
        setRequestTypeId((prev) => {
          if (prev) return prev;
          const software =
            nextRequestTypes.find((rt) => String(rt.key || '').toLowerCase() === 'project_software') ||
            nextRequestTypes.find((rt) => {
              const name = String(rt.name || '').toLowerCase();
              return name.includes('software') || name === 'project (software)';
            });
          return software?._id || '';
        });
        setRequestType((prev) => {
          if (prev) return prev;
          const software =
            nextRequestTypes.find((rt) => String(rt.key || '').toLowerCase() === 'project_software') ||
            nextRequestTypes.find((rt) => {
              const name = String(rt.name || '').toLowerCase();
              return name.includes('software') || name === 'project (software)';
            });
          return software?.name || '';
        });
        // Managers may leave owner unassigned; sales reps are forced to self above.
      } catch (err) {
        console.warn('Failed to load form metadata:', err);
        setPipelineStages([...DEFAULT_PIPELINE_STAGES]);
        setLeadStatuses(mergeLeadStatusesWithBuiltins([...DEFAULT_LEAD_STATUSES]));
        setLeadSources([...DEFAULT_LEAD_SOURCES]);
        setLeadTags([...DEFAULT_LEAD_TAGS]);
        setLeadPriorities([...DEFAULT_LEAD_PRIORITIES]);
        setCustomFieldDefs([]);
        setSessionCustomFieldDefs([]);
        setCustomFields({});
        setRequestTypes(
          LEAD_REQUEST_TYPES.map((name, index) => ({
            _id: `legacy_${index}`,
            key: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            name,
            isEnabled: true,
            fields: [],
          }))
        );
        setStage(DEFAULT_PIPELINE_STAGES[0]);
        setStatus(DEFAULT_LEAD_STATUSES[0]);
      }
    };
    void loadMetadata();
  }, []);

  /**
   * Generic: merge request types contributed by enabled extensions (host-slots).
   * Best-effort create missing types in CRM so they persist for all users.
   */
  useEffect(() => {
    const contrib = extensionSummary?.requestTypes || [];
    if (!contrib.length) return;

    setRequestTypes((prev) => {
      const next = [...prev];
      for (const c of contrib) {
        const key = String(c.key || '')
          .trim()
          .toLowerCase();
        if (!key) continue;
        const name = String(c.name || key).trim() || key;
        const exists = next.some(
          (rt) =>
            String(rt.key || '')
              .trim()
              .toLowerCase() === key ||
            String(rt.name || '')
              .trim()
              .toLowerCase() === name.toLowerCase()
        );
        if (exists) continue;
        next.push({
          _id: `ext_${c.extensionId}_${key}`,
          key,
          name,
          description: c.description || '',
          isEnabled: true,
          fields: [],
        });
      }
      return next;
    });

    let cancelled = false;
    void (async () => {
      let created = false;
      for (const c of contrib) {
        const key = String(c.key || '')
          .trim()
          .toLowerCase();
        if (!key) continue;
        const name = String(c.name || key).trim() || key;
        try {
          await crmApi.createRequestType({
            key,
            name,
            description: c.description || `Contributed by extension ${c.extensionId}`,
            isEnabled: true,
            fields: [],
          });
          created = true;
        } catch {
          /* may already exist or lack permission */
        }
      }
      if (cancelled || !created) return;
      try {
        const refreshed = await crmApi.listRequestTypes({ enabledOnly: true });
        if (cancelled || !Array.isArray(refreshed.data)) return;
        setRequestTypes(refreshed.data);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [extensionSummary]);

  /** Workspace fields (Settings) + this-create-only session fields, no duplicate keys. */
  const activeCustomFieldDefs = useMemo(() => {
    const map = new Map<string, LeadCustomFieldDef>();
    for (const def of customFieldDefs) {
      if (def?.key) map.set(def.key, def);
    }
    for (const def of sessionCustomFieldDefs) {
      if (def?.key) map.set(def.key, def);
    }
    return Array.from(map.values());
  }, [customFieldDefs, sessionCustomFieldDefs]);

  // Guided-tour hook: reveal the "create contact" form on demand
  useEffect(() => {
    const onTourOpen = () => {
      setSelectedContact(null);
      setShowCreateContact(true);
    };
    window.addEventListener('crm-leads-tour-open-contact-form', onTourOpen);
    return () => window.removeEventListener('crm-leads-tour-open-contact-form', onTourOpen);
  }, []);

  // Bring validation / API errors into view (the banner sits at the top of a long form)
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  // Close contact dropdown on outside click
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (contactPickerRef.current && !contactPickerRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // Search existing contacts (debounced, stale responses ignored)
  useEffect(() => {
    if (!contactDropdownOpen || selectedContact) return;
    const seq = ++contactSearchSeq.current;
    const timer = window.setTimeout(async () => {
      setContactSearching(true);
      setContactSearchError(null);
      try {
        const res = await crmApi.listContacts({
          search: contactQuery.trim() || undefined,
          limit: CONTACT_SEARCH_LIMIT,
        });
        if (seq !== contactSearchSeq.current) return;
        setContactResults(Array.isArray(res.data) ? res.data : []);
      } catch (err: unknown) {
        if (seq !== contactSearchSeq.current) return;
        setContactResults([]);
        setContactSearchError(err instanceof Error ? err.message : 'Failed to search contacts');
      } finally {
        if (seq === contactSearchSeq.current) setContactSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [contactQuery, contactDropdownOpen, selectedContact]);

  // Real-time lead duplicate check (email / mobile of the chosen or new contact)
  useEffect(() => {
    if (!leadEmail.trim() && !leadPhone.trim()) {
      setDuplicateMatches([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await crmApi.checkLeadDuplicates({
          email: leadEmail.trim() || undefined,
          phone: leadPhone.trim() || undefined,
        });
        setDuplicateMatches(res.data?.hasDuplicate ? res.data.matches : []);
      } catch {
        setDuplicateMatches([]);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [leadEmail, leadPhone]);

  // ─── Contact helpers ──────────────────────────────────────────────────────
  const chooseContact = (contact: PersonContact) => {
    setSelectedContact(contact);
    setShowCreateContact(false);
    setNewContact({ ...EMPTY_CONTACT_FORM });
    setContactQuery('');
    setContactDropdownOpen(false);
    clearContactDuplicates();
    setError(null);
  };

  /** Create the lead linked to an already-resolved contact. */
  const createLeadWithContact = async (
    contact: PersonContact,
    options: { allowExactDuplicate?: boolean; confirmDifferentCompany?: boolean } = {}
  ) => {
    if (!contact?._id) throw new Error('Contact is required to create the lead.');
    const allowExactDuplicate = options.allowExactDuplicate !== false;
    const selectedRt = requestTypes.find((rt) => rt._id === requestTypeId);
    const fieldGroups = createFieldsForRequestType({
      key: selectedRt?.key,
      name: selectedRt?.name || requestType,
    });
    const primaryTravellerName = selectedContact
      ? formatContactName(selectedContact)
      : showCreateContact
        ? newContact.name
        : '';
    const fieldError = await validateExtensionFields(
      fieldGroups,
      extensionFieldValues,
      { key: selectedRt?.key, name: selectedRt?.name || requestType }
    );
    if (fieldError) throw new Error(fieldError);

    const extensionPayload = await buildExtensionPayloadFromFields(
      fieldGroups,
      extensionFieldValues,
      { key: selectedRt?.key, name: selectedRt?.name || requestType },
      {
        preparedBy: preparedByLabel,
        primaryTraveller: primaryTravellerName,
        defaultCurrency: settingsCurrency,
      }
    );

    const created = await crmApi.createLead({
      title: title.trim(),
      contactId: contact._id,
      name: contact.name,
      salutation: contact.salutation || undefined,
      jobTitle: contact.jobTitle || undefined,
      gender: contact.gender || undefined,
      pan: contact.pan || undefined,
      email: contact.email || '',
      phone: contact.phone || '',
      photoUrl: contact.photoUrl || undefined,
      company: company.trim(),
      leadType: leadType || undefined,
      priority: priority || undefined,
      nextFollowUp: nextFollowUp || null,
      stage: stage || pipelineStages[0] || 'New',
      status: status || leadStatuses[0] || 'Hot',
      source: source || undefined,
      assignedTo: canAssignOthers
        ? assignedTo || ''
        : currentUserId || assignedTo || '',
      requestType: requestType.trim(),
      requestTypeId:
        requestTypeId.startsWith('legacy_') || requestTypeId.startsWith('ext_')
          ? null
          : requestTypeId,
      value: value !== '' ? Number(value) : 0,
      currency: settingsCurrency,
      tags: selectedTags,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      latitude: latitude !== '' ? Number(latitude) : null,
      longitude: longitude !== '' ? Number(longitude) : null,
      notes: notes.trim() || undefined,
      customFields,
      extension: extensionPayload,
      // Existing contact (or intentional duplicate) may already have other leads.
      allowExactDuplicate,
      allowSimilarCompany: allowExactDuplicate,
      confirmDifferentCompany: options.confirmDifferentCompany,
    });
    const detailTabs = leadTabsForRequestType({
      key: selectedRt?.key,
      name: selectedRt?.name || requestType,
    });
    const openTab = detailTabs[0]?.tabId;
    navigate(
      openTab
        ? `/leads/${created.data._id}?tab=${encodeURIComponent(openTab)}`
        : `/leads/${created.data._id}`
    );
  };

  const confirmDuplicateLeadsIfNeeded = async (): Promise<boolean> => {
    if (!duplicateMatches.length) return true;
    return confirm(
      `Possible duplicate leads found:\n${duplicateMatches
        .slice(0, 5)
        .map((m) => `• ${m.title || m.name} (${displayLabel(m.email, m.phone, 'match')})`)
        .join('\n')}\n\nCreate anyway?`
    );
  };

  /** Option 1 — use existing contact, then create the lead immediately. */
  const handleChooseExistingContactAndCreate = async (contact: PersonContact) => {
    if (!canWrite || saving) return;
    setError(null);
    if (!title.trim()) {
      setError('Lead Title is required.');
      return;
    }
    if (!company.trim()) {
      setError('Company Name is required.');
      return;
    }
    if (!requestType.trim() || !requestTypeId.trim()) {
      setError('Request Type is required.');
      return;
    }
    if (!stage) {
      setError('Stage is required.');
      return;
    }
    // Do not block: existing contact may already have other leads with same email/phone/PAN.

    setSaving(true);
    try {
      chooseContact(contact);
      await createLeadWithContact(contact, { allowExactDuplicate: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
      setSaving(false);
    }
  };

  /** Option 2 — create a new contact (allow duplicate email/phone/PAN) and create the lead. */
  const handleCreateNewLeadDespiteDuplicate = async () => {
    if (!canWrite || saving) return;
    setError(null);
    if (!showCreateContact && !selectedContact) {
      setError('Fill the new contact form first, then choose Create new lead.');
      return;
    }
    const contactError = validateContactForm(newContact, { requireReachability: true });
    if (contactError) {
      setError(contactError);
      return;
    }
    if (!title.trim()) {
      setError('Lead Title is required.');
      return;
    }
    if (!company.trim()) {
      setError('Company Name is required.');
      return;
    }
    if (!requestType.trim() || !requestTypeId.trim()) {
      setError('Request Type is required.');
      return;
    }
    if (!stage) {
      setError('Stage is required.');
      return;
    }
    if (!(await confirmDuplicateLeadsIfNeeded())) return;

    setSaving(true);
    try {
      const contactData = contactFormToInput(newContact);
      if (!contactData.companyName && company.trim()) {
        contactData.companyName = company.trim();
      }
      const created = await crmApi.createContact({
        ...contactData,
        allowDuplicate: true,
      });
      if (!created.data?._id) throw new Error(created.error || 'Failed to create contact');
      setSelectedContact(created.data);
      setShowCreateContact(false);
      setNewContact({ ...EMPTY_CONTACT_FORM });
      clearContactDuplicates();
      await createLeadWithContact(created.data, { allowExactDuplicate: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
      setSaving(false);
    }
  };

  const clearSelectedContact = () => {
    setSelectedContact(null);
    setContactQuery('');
  };

  const [contactCompanyEdited, setContactCompanyEdited] = useState(false);

  const openCreateContact = () => {
    setSelectedContact(null);
    setShowCreateContact(true);
    setContactDropdownOpen(false);
    setContactCompanyEdited(false);
    setNewContact((prev) => ({
      ...prev,
      name: prev.name || contactQuery.trim(),
      companyName: company.trim() || prev.companyName,
    }));
  };

  // Automatically fetch / prefill company name from lead to contact, unless user edited it
  useEffect(() => {
    if (showCreateContact && company.trim() && !contactCompanyEdited) {
      setNewContact((prev) => (prev.companyName !== company.trim() ? { ...prev, companyName: company.trim() } : prev));
    }
  }, [company, showCreateContact, contactCompanyEdited]);

  const cancelCreateContact = () => {
    setShowCreateContact(false);
    setContactCompanyEdited(false);
    setNewContact({ ...EMPTY_CONTACT_FORM });
    clearContactDuplicates();
  };

  const patchNewContact = (patch: Partial<ContactFormValues>) => {
    if (patch.companyName !== undefined) {
      setContactCompanyEdited(true);
    }
    setNewContact((prev) => ({ ...prev, ...patch }));
  };

  // Live duplicate check while typing email / mobile / PAN on the inline create form
  useEffect(() => {
    if (!showCreateContact || selectedContact) return;
    const timer = window.setTimeout(() => {
      void checkContactDuplicates(newContact);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    newContact.email,
    newContact.phone,
    newContact.pan,
    showCreateContact,
    selectedContact,
    checkContactDuplicates,
  ]);

  // Keep the duplicate alert visible near the contact form (not jump to page top)
  useEffect(() => {
    if (!contactDuplicates.length || !showCreateContact) return;
    const el = document.getElementById('lead-create-contact-duplicate-alert');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [contactDuplicates, showCreateContact]);

  // ─── Location helpers ─────────────────────────────────────────────────────
  const LOCATION_ADJUST_RADIUS_M = 50;

  const applyCoordsAndGeocode = async (
    lat: number,
    lng: number,
    options: { setAsAnchor?: boolean } = {}
  ) => {
    setLatitude(lat);
    setLongitude(lng);
    if (options.setAsAnchor) {
      setLocationAnchor({ lat, lng });
    }
    setLocationStatus('Looking up address from Google Maps…');
    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo.city) setCity(geo.city);
      if (geo.state) setState(geo.state);
      if (geo.addressLine) setAddress(geo.addressLine);
      const place = [geo.city, geo.state].filter(Boolean).join(', ') || geo.addressLine;
      const radiusNote = options.setAsAnchor
        ? ` You can adjust the pin within ${LOCATION_ADJUST_RADIUS_M} m.`
        : locationAnchor
          ? ` Pin is limited to ${LOCATION_ADJUST_RADIUS_M} m of your GPS location.`
          : '';
      const sourceLabel = geo.source === 'google' ? 'Google Maps' : 'map';
      setLocationStatus(
        place
          ? `Address from ${sourceLabel}: ${place}.${radiusNote}`
          : `Location coordinates captured. Address not found for this point.${radiusNote}`
      );
    } catch {
      setLocationStatus(
        options.setAsAnchor
          ? `Coordinates captured. Adjust the pin within ${LOCATION_ADJUST_RADIUS_M} m — address lookup failed.`
          : 'Coordinates captured, but address lookup failed. You can enter them manually.'
      );
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }
    setLocationStatus('Detecting your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyCoordsAndGeocode(
          Number(pos.coords.latitude.toFixed(6)),
          Number(pos.coords.longitude.toFixed(6)),
          { setAsAnchor: true }
        );
      },
      () => {
        setLocationStatus('Location access denied. Click the map to place a pin instead.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleClearPin = () => {
    setLatitude('');
    setLongitude('');
    setLocationAnchor(null);
    setLocationStatus(null);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  // ─── "Add item" modal handlers ────────────────────────────────────────────
  const handleCreateSource = async (name: string) => {
    const res = await crmApi.addLeadSource(name);
    setLeadSources(asStringList(res.data, leadSources));
    setSource(name);
  };

  const handleCreateStatus = async (name: string) => {
    const res = await crmApi.addLeadStatus(name);
    setLeadStatuses(mergeLeadStatusesWithBuiltins(asStringList(res.data, leadStatuses)));
    setStatus(name);
  };

  const handleCreatePriority = async (name: string) => {
    const res = await crmApi.addLeadPriority(name);
    setLeadPriorities(asStringList(res.data, [...leadPriorities, name]));
    setPriority(name);
  };

  const handleCreateTag = async (name: string) => {
    const res = await crmApi.addLeadTag(name);
    setLeadTags(asStringList(res.data, leadTags));
    setSelectedTags((prev) => (prev.includes(name) ? prev : [...prev, name]));
  };

  /** Prefill create form from visiting-card OCR + Groq extraction. */
  const applyOcrExtract = (data: LeadOcrExtractResult) => {
    const companyName = String(data.companyName || '').trim();
    const contactName = String(data.contactName || '').trim();
    const email = String(data.email || '').trim();
    const phone = String(data.phone || '').trim();
    const jobRole = String(data.jobRole || '').trim();
    const addr = String(data.address || '').trim();
    const cityVal = String(data.city || '').trim();
    const stateVal = String(data.state || '').trim();
    // Optional guesses — only apply when the API returned a non-empty confident value.
    const salutation = String(data.salutation || '').trim();
    const gender = String(data.gender || '').trim();
    const guessedLeadType = String(data.leadType || '').trim();
    const guessedRequestTypeId = String(data.requestTypeId || '').trim();
    const guessedRequestTypeName = String(data.requestType || '').trim();

    if (companyName) {
      setCompany(companyName);
      setTitle((prev) => (prev.trim() ? prev : `Inquiry from ${companyName}`));
    }
    if (addr) setAddress(addr);
    if (cityVal) setCity(cityVal);
    if (stateVal) setState(stateVal);

    if (
      guessedLeadType &&
      DEFAULT_LEAD_TYPES.some((t) => t.toLowerCase() === guessedLeadType.toLowerCase())
    ) {
      setLeadType(
        DEFAULT_LEAD_TYPES.find((t) => t.toLowerCase() === guessedLeadType.toLowerCase()) ||
          guessedLeadType
      );
    }

    {
      const matched =
        (guessedRequestTypeId &&
          requestTypes.find((rt) => rt._id === guessedRequestTypeId)) ||
        (guessedRequestTypeName &&
          requestTypes.find(
            (rt) => rt.name.toLowerCase() === guessedRequestTypeName.toLowerCase()
          )) ||
        requestTypes.find((rt) => String(rt.key || '').toLowerCase() === 'project_software') ||
        requestTypes.find((rt) => {
          const name = String(rt.name || '').toLowerCase();
          return name.includes('software') || name === 'project (software)';
        }) ||
        null;
      if (matched) {
        setRequestTypeId(matched._id);
        setRequestType(matched.name);
      }
    }
    // Default stage + source for card / OCR imports
    setStage('New');
    setSource('OCR');
    setLeadSources((prev) =>
      prev.some((s) => s.toLowerCase() === 'ocr') ? prev : [...prev, 'OCR']
    );
    void crmApi.addLeadSource('OCR').then((res) => {
      if (res.data) setLeadSources(asStringList(res.data, ['OCR']));
    }).catch(() => undefined);

    // Prefer creating a new contact with card details rather than an existing picker selection.
    setSelectedContact(null);
    setContactQuery('');
    setContactResults([]);
    setContactDropdownOpen(false);
    setShowCreateContact(true);
    setContactCompanyEdited(false);
    setNewContact({
      ...EMPTY_CONTACT_FORM,
      salutation,
      name: contactName,
      companyName,
      email,
      phone,
      gender,
      jobTitle: jobRole,
    });
    setError(null);

    // Duplicate discrepancy check after prefilling from OCR
    if (companyName && (email || phone || contactName)) {
      void checkDiscrepancyNow({
        name: contactName,
        email,
        phone,
        companyName,
      }).then((discResult) => {
        if (discResult.hasDiscrepancy) {
          setShowDiscrepancyModal(true);
        }
      });
    }
  };

  // ─── Validation + submit ──────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!title.trim()) return 'Lead Title is required.';
    if (!company.trim()) return 'Company Name is required.';
    if (!requestType.trim() || !requestTypeId.trim()) return 'Request Type is required.';
    if (
      !requestTypes.some(
        (rt) =>
          rt._id === requestTypeId ||
          rt.name.toLowerCase() === requestType.trim().toLowerCase()
      )
    ) {
      return 'Select a valid enabled Request Type.';
    }
    if (!stage) return 'Stage is required.';
    if (nextFollowUp && nextFollowUp < localDateInputValue()) {
      return 'Next follow-up date cannot be in the past.';
    }

    if (selectedContact) {
      if (!selectedContact.email?.trim() || !selectedContact.phone?.trim()) {
        return 'The selected contact needs both an email and a mobile number. Open the contact, add them, then try again.';
      }
    } else if (showCreateContact) {
      const contactError = validateContactForm(newContact, { requireReachability: true });
      if (contactError) return contactError;
    } else {
      return 'Select an existing contact or create a new one.';
    }

    for (const def of activeCustomFieldDefs) {
      if (def.required) {
        const val = customFields[def.key];
        if (val === undefined || val === null || String(val).trim() === '') {
          return `${def.label} is required.`;
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canWrite) {
      setError('You do not have permission to create leads.');
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!(await confirmDuplicateLeadsIfNeeded())) return;

    // Check company discrepancy (different company with same email/phone/name)
    const discCheck = await checkDiscrepancyNow();
    if (discCheck.hasDiscrepancy) {
      setShowDiscrepancyModal(true);
      return;
    }

    // If contact duplicates are already known, force the two-option banner instead of auto-create.
    if (!selectedContact && contactDuplicates.length > 0) {
      setError(
        'Matching contact found (email / mobile / PAN). Choose existing contact or Create new lead below.'
      );
      document
        .getElementById('lead-create-contact-duplicate-alert')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    let contactCreatedNow = false;
    try {
      let contact = selectedContact;
      if (!contact) {
        try {
          const contactData = contactFormToInput(newContact);
          if (!contactData.companyName && company.trim()) {
            contactData.companyName = company.trim();
          }
          const created = await crmApi.createContact(contactData);
          contact = created.data;
          contactCreatedNow = true;
          setSelectedContact(contact);
          setShowCreateContact(false);
          setNewContact({ ...EMPTY_CONTACT_FORM });
          clearContactDuplicates();
        } catch (err: unknown) {
          if (err instanceof ApiError && err.status === 409 && Array.isArray(err.duplicates)) {
            setContactDuplicates(err.duplicates as PersonContact[]);
            setError(
              'Matching contact found (email / mobile / PAN). Choose existing contact or Create new lead below.'
            );
            document
              .getElementById('lead-create-contact-duplicate-alert')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            setError(err instanceof Error ? err.message : 'Failed to create contact');
          }
          setSaving(false);
          return;
        }
      }

      if (!contact?._id) {
        setError('Could not resolve a contact for this lead.');
        setSaving(false);
        return;
      }
      await createLeadWithContact(contact);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create lead';
      setError(
        contactCreatedNow
          ? `${msg} (the new contact was saved and is now selected — fix the issue and submit again)`
          : msg
      );
      setSaving(false);
    }
  };

  const handleConfirmDiscrepancyLeadCreate = async () => {
    setShowDiscrepancyModal(false);
    setSaving(true);
    setError(null);
    try {
      let contact = selectedContact;
      if (!contact) {
        const contactData = contactFormToInput(newContact);
        if (!contactData.companyName && company.trim()) {
          contactData.companyName = company.trim();
        }
        contactData.allowDuplicate = true;
        contactData.confirmDifferentCompany = true;
        const created = await crmApi.createContact(contactData);
        if (!created.data?._id) throw new Error(created.error || 'Failed to create contact');
        contact = created.data;
        setSelectedContact(contact);
        setShowCreateContact(false);
        setNewContact({ ...EMPTY_CONTACT_FORM });
        clearContactDuplicates();
      }
      if (!contact?._id) {
        setError('Could not resolve a contact for this lead.');
        setSaving(false);
        return;
      }
      await createLeadWithContact(contact, { allowExactDuplicate: true, confirmDifferentCompany: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
      setSaving(false);
    }
  };

  const handleCancelDiscrepancyLeadCreate = () => {
    setShowDiscrepancyModal(false);
  };

  if (!canWrite) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-10 text-center max-w-lg mx-auto">
        <p className="text-sm font-semibold text-red-700 m-0 mb-2">Permission denied</p>
        <p className="text-xs text-zinc-500 m-0 mb-4">
          You need <code className="text-[11px]">crm.leads.write</code> to create leads.
        </p>
        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 no-underline"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          Back to leads
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-16 font-sans">
      {/* Breadcrumbs & Back Link */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Link to="/dashboard" className="text-zinc-600 hover:text-zinc-950 no-underline">
            CRM
          </Link>
          <span>/</span>
          <Link to="/leads" className="text-zinc-600 hover:text-zinc-950 no-underline">
            Leads & Prospects
          </Link>
          <span>/</span>
          <span className="font-semibold text-zinc-950">Create New Lead</span>
        </div>

        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 no-underline"
        >
          <ArrowBackIcon sx={{ fontSize: 15 }} />
          <span>Back to leads</span>
        </Link>
      </div>

      {/* Hero Header */}
      <div className="bg-white border border-zinc-300 rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            New Lead
          </span>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight m-0">Create Lead</h1>
          <p className="text-xs text-zinc-500 m-0 mt-0.5">
            Capture the opportunity, link a contact person, and pin the location. Fields marked *
            are required.
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={() => setShowOcrImportModal(true)}
            className="inline-flex items-center gap-1.5 h-[36px] px-3.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 cursor-pointer transition-colors"
            title="Import lead details from a visiting card image"
          >
            <PhotoCameraOutlinedIcon sx={{ fontSize: 16 }} />
            Import from card
          </button>
        ) : null}
      </div>

      {/* Duplicate contact alert kept near contact section while creating */}
      {contactDuplicates.length > 0 && !showCreateContact ? (
        <ContactDuplicateBanner
          duplicates={contactDuplicates}
          onUseContact={(c) => void handleChooseExistingContactAndCreate(c)}
          onCreateNewLead={() => void handleCreateNewLeadDespiteDuplicate()}
          actionLabel="Choose existing contact"
          createNewLabel="Create new lead"
          option1Title="Option 1 — Choose existing contact"
          option2Title="Option 2 — Create new lead"
          option2Description={
            <>
              Creates a <strong>new contact</strong> with the same email / mobile / PAN and then
              creates the lead.
            </>
          }
          busy={saving}
          onDismiss={clearContactDuplicates}
          checking={contactDupChecking}
        />
      ) : null}

      {/* Duplicate lead warning */}
      {duplicateMatches.length > 0 && (
        <div className="bg-zinc-50 border border-zinc-300 rounded-xl p-4 flex items-start gap-3">
          <WarningAmberIcon sx={{ fontSize: 20 }} className="text-zinc-950 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-900">
            <strong className="block font-bold mb-1">
              Existing Lead Detected With Matching Contact Information:
            </strong>
            <ul className="list-disc pl-4 space-y-0.5">
              {duplicateMatches.map((m) => (
                <li key={m._id}>
                  <strong>{m.title || m.name}</strong> ({m.company}) — {m.email || m.phone} (Stage:{' '}
                  {m.stage}, Owner: {m.assignedToName || 'Unassigned'})
                </li>
              ))}
            </ul>
            <span className="text-[11px] text-zinc-500 mt-2 block">
              You can still proceed if this is a separate branch or project inquiry.
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          ref={errorRef}
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3.5 rounded-xl"
        >
          {error}
        </div>
      )}

      <form data-tour="leads-create-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* A) Lead */}
        <section className={sectionCls}>
          <h3 className={sectionTitleCls}>A. Lead</h3>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
            <div data-tour="leads-field-title" className="sm:col-span-6">
              <label className={labelCls}>Lead Title *</label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. ERP rollout for Acme Pvt Ltd"
                className={inputCls}
              />
            </div>

            <div data-tour="leads-field-company" className="sm:col-span-6">
              <label className={labelCls}>Company Name *</label>
              <input
                type="text"
                required
                maxLength={120}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Global Solutions Pvt Ltd"
                className={inputCls}
              />
            </div>

            <div data-tour="leads-field-type" className="sm:col-span-4">
              <label className="font-semibold text-zinc-600 mb-1 block">Lead Type</label>
              <select
                value={leadType}
                onChange={(e) => setLeadType(e.target.value)}
                className={inputCls}
              >
                <option value="">Select type…</option>
                {DEFAULT_LEAD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div data-tour="leads-field-priority" className="sm:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-zinc-600">Priority</label>
                <button
                  type="button"
                  onClick={() => setShowAddPriorityModal(true)}
                  className={addLinkCls}
                >
                  + Add Priority
                </button>
              </div>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputCls}
              >
                <option value="">Select priority…</option>
                {leadPriorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div data-tour="leads-field-next-followup" className="sm:col-span-4">
              <label className={labelCls}>Next follow-up</label>
              <input
                type="date"
                min={localDateInputValue()}
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className={inputCls}
              />
            </div>

            <div data-tour="leads-field-status" className="sm:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-zinc-600">Status</label>
                <button type="button" onClick={() => setShowAddStatusModal(true)} className={addLinkCls}>
                  + Add Status
                </button>
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputCls}
              >
                {leadStatuses.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div data-tour="leads-field-stage" className="sm:col-span-4">
              <label className={labelCls}>Stage *</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className={`${inputCls} font-semibold`}
              >
                {pipelineStages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div data-tour="leads-field-source" className="sm:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-zinc-600">Source (optional)</label>
                <button type="button" onClick={() => setShowAddSourceModal(true)} className={addLinkCls}>
                  + Add Source
                </button>
              </div>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className={inputCls}
              >
                <option value="">Select acquisition source…</option>
                {leadSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div data-tour="leads-field-owner" className="sm:col-span-6">
              <label className={labelCls}>
                Assigned To {canAssignOthers ? '(optional)' : ''}
              </label>
              {canAssignOthers ? (
                <>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Unassigned</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName || u.name || u.username || u.email}
                      </option>
                    ))}
                  </select>
                  {!assignedTo && (
                    <span className="block text-[11px] text-amber-700 mt-1">
                      This lead will be saved as unassigned. A sales manager or admin can assign it
                      later from the lead page.
                    </span>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className={`${inputCls} bg-zinc-50 text-zinc-600`}
                    value="You (current user)"
                    disabled
                    readOnly
                    title="Sales representatives can only assign leads to themselves"
                  />
                  <span className="block text-[11px] text-zinc-500 mt-1">
                    This lead will be assigned to you.
                  </span>
                </>
              )}
            </div>

            <div data-tour="leads-field-value" className="sm:col-span-3">
              <label className={labelCls}>
                Deal Value ({getCurrencySymbol(settingsCurrency)})
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={value}
                onChange={(e) => setValue(e.target.value ? Number(e.target.value) : '')}
                placeholder="500000"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div data-tour="leads-field-request" className="sm:col-span-3">
              <label className={labelCls}>Request Type *</label>
              <select
                required
                value={requestTypeId}
                onChange={(e) => {
                  const id = e.target.value;
                  const rt = requestTypes.find((item) => item._id === id);
                  setRequestTypeId(id);
                  setRequestType(rt?.name || '');
                }}
                className={inputCls}
              >
                <option value="">Select request type…</option>
                {requestTypes.map((rt) => (
                  <option key={rt._id} value={rt._id}>
                    {rt.name}
                  </option>
                ))}
              </select>
              {(() => {
                const selectedRt = requestTypes.find((rt) => rt._id === requestTypeId);
                const groups = createFieldsForRequestType({
                  key: selectedRt?.key,
                  name: selectedRt?.name || requestType,
                });
                if (!groups.length) return null;
                return (
                  <p className="mt-2 mb-0 text-[11px] text-zinc-500">
                    Extension fields for this request type render below in the CRM form (no iframe).
                  </p>
                );
              })()}
            </div>
          </div>
        </section>

        {/* B) Contact person */}
        <section data-tour="leads-field-contact" className={sectionCls}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4 pb-2 border-b border-zinc-100">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider m-0">
              B. Contact Person
            </h3>
            {!showCreateContact && (
              <button
                type="button"
                onClick={openCreateContact}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-2.5 py-1 rounded cursor-pointer"
              >
                <AddIcon sx={{ fontSize: 13 }} />
                Create contact
              </button>
            )}
          </div>

          {selectedContact ? (
            <div className="flex items-center justify-between gap-3 border border-zinc-300 bg-zinc-50 rounded-lg p-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold overflow-hidden shrink-0">
                  {selectedContact.photoUrl ? (
                    <img
                      src={selectedContact.photoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (selectedContact.name.charAt(0) || 'C').toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <span className="block font-semibold text-zinc-950 truncate">
                    {formatContactName(selectedContact)}
                  </span>
                  <span className="block text-[11px] text-zinc-500 truncate">
                    {[selectedContact.jobTitle, selectedContact.email, selectedContact.phone]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedContact}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 bg-white border border-zinc-300 px-2.5 py-1 rounded cursor-pointer shrink-0"
              >
                <CloseIcon sx={{ fontSize: 13 }} />
                Change
              </button>
            </div>
          ) : !showCreateContact ? (
            <div ref={contactPickerRef} className="relative text-xs">
              <label className={labelCls}>Search existing contact</label>
              <div className="relative">
                <SearchIcon
                  sx={{ fontSize: 16 }}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={contactQuery}
                  onChange={(e) => {
                    setContactQuery(e.target.value);
                    setContactDropdownOpen(true);
                  }}
                  onFocus={() => setContactDropdownOpen(true)}
                  placeholder="Search by name, email or mobile…"
                  autoComplete="off"
                  className={`${inputCls} pl-8`}
                />
              </div>
              {contactDropdownOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-zinc-300 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {contactSearching ? (
                    <p className="m-0 p-3 text-zinc-500">Searching contacts…</p>
                  ) : contactSearchError ? (
                    <p className="m-0 p-3 text-red-600">{contactSearchError}</p>
                  ) : contactResults.length === 0 ? (
                    <div className="p-3 text-zinc-500">
                      <p className="m-0 mb-2">
                        {contactQuery.trim()
                          ? 'No contacts match your search.'
                          : 'No contacts yet.'}
                      </p>
                      <button
                        type="button"
                        onClick={openCreateContact}
                        className="text-[11px] font-semibold text-zinc-950 underline bg-transparent border-none cursor-pointer p-0"
                      >
                        Create a new contact
                      </button>
                    </div>
                  ) : (
                    <ul className="list-none m-0 p-0 divide-y divide-zinc-100">
                      {contactResults.map((c) => (
                        <li key={c._id}>
                          <button
                            type="button"
                            onClick={() => chooseContact(c)}
                            className="w-full text-left px-3 py-2 bg-white hover:bg-zinc-50 border-none cursor-pointer flex items-center gap-2.5"
                          >
                            <span className="w-7 h-7 rounded-md bg-zinc-950 text-white flex items-center justify-center text-[11px] font-bold overflow-hidden shrink-0">
                              {c.photoUrl ? (
                                <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (c.name.charAt(0) || 'C').toUpperCase()
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold text-zinc-950 truncate">
                                {formatContactName(c)}
                              </span>
                              <span className="block text-[11px] text-zinc-500 truncate">
                                {[c.jobTitle, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-[11px] text-zinc-500 mt-1.5 mb-0">
                Pick an existing contact, or use “Create contact” to add a new person.
              </p>
            </div>
          ) : null}

          {showCreateContact && !selectedContact && (
            <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-zinc-900 m-0">New contact</h4>
                <button
                  type="button"
                  onClick={cancelCreateContact}
                  className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-950 hover:underline bg-transparent border-none cursor-pointer"
                >
                  Cancel — search existing instead
                </button>
              </div>

              <div id="lead-create-contact-duplicate-alert" className="mb-3">
                <ContactDuplicateBanner
                  duplicates={contactDuplicates}
                  onUseContact={(c) => void handleChooseExistingContactAndCreate(c)}
                  onCreateNewLead={() => void handleCreateNewLeadDespiteDuplicate()}
                  actionLabel="Choose existing contact"
                  createNewLabel="Create new lead"
                  option1Title="Option 1 — Choose existing contact"
                  option2Title="Option 2 — Create new lead"
                  option2Description={
                    <>
                      Creates a <strong>new contact</strong> with the same email / mobile / PAN and
                      then creates the lead.
                    </>
                  }
                  busy={saving}
                  onDismiss={clearContactDuplicates}
                  checking={contactDupChecking}
                />
              </div>

              <ContactFormFields
                values={newContact}
                onChange={patchNewContact}
                requireReachability
                disabled={saving}
                tourPrefix="leads-field"
                onFieldBlur={(vals) => void checkContactDuplicates(vals)}
                onUploadError={setError}
              />
              <p className="text-[11px] text-zinc-500 mt-3 mb-0">
                The contact is saved to the Contacts directory when you create the lead. If email,
                mobile or PAN already exists, choose <strong>Choose existing contact</strong> or{' '}
                <strong>Create new lead</strong> — either option creates the lead.
              </p>
            </div>
          )}
        </section>

        {/* C) Location */}
        <section data-tour="leads-field-location" className={sectionCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider m-0">
              C. Location
            </h3>
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900 hover:text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded cursor-pointer"
            >
              <MyLocationIcon sx={{ fontSize: 13 }} />
              <span>Use my location</span>
            </button>
          </div>

          {locationStatus && <p className="text-[11px] text-zinc-600 mb-3">{locationStatus}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
            <div className="sm:col-span-12">
              <LeadLocationMap
                showSearch={true}
                latitude={latitude}
                longitude={longitude}
                address={address}
                anchorLatitude={locationAnchor?.lat ?? ''}
                anchorLongitude={locationAnchor?.lng ?? ''}
                maxRadiusMeters={LOCATION_ADJUST_RADIUS_M}
                onPlaceSelect={(place) => {
                  setAddress(place.address);
                  if (place.city) setCity(place.city);
                  if (place.state) setState(place.state);
                  setLatitude(place.lat);
                  setLongitude(place.lng);
                  // Google search is an absolute pin — clear GPS 50 m lock
                  setLocationAnchor(null);
                  const placeLabel = [place.city, place.state].filter(Boolean).join(', ');
                  setLocationStatus(
                    placeLabel
                      ? `Address selected from Google Maps: ${placeLabel}.`
                      : 'Address selected from Google Maps.'
                  );
                }}
                onChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
                onSettle={(lat, lng) => {
                  void applyCoordsAndGeocode(lat, lng);
                }}
                height="280px"
              />
            </div>

            <div className="sm:col-span-12">
              <label className={labelCls}>Office Address</label>
              <textarea
                rows={2}
                maxLength={500}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Plot/Building, Tech Park, City, State, PIN"
                className="w-full border border-zinc-300 rounded-lg p-2.5 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-6">
              <label className={labelCls}>City</label>
              <input
                type="text"
                maxLength={120}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-6">
              <label className={labelCls}>State</label>
              <input
                type="text"
                maxLength={120}
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-5">
              <label className={labelCls}>Latitude</label>
              <input
                type="text"
                readOnly
                aria-readonly="true"
                tabIndex={-1}
                value={latitude === '' ? '' : Number(latitude).toFixed(6)}
                placeholder="Set from map"
                className="w-full border border-zinc-200 rounded-lg p-2 bg-zinc-50 text-zinc-600 font-mono outline-none cursor-not-allowed"
              />
            </div>

            <div className="sm:col-span-5">
              <label className={labelCls}>Longitude</label>
              <input
                type="text"
                readOnly
                aria-readonly="true"
                tabIndex={-1}
                value={longitude === '' ? '' : Number(longitude).toFixed(6)}
                placeholder="Set from map"
                className="w-full border border-zinc-200 rounded-lg p-2 bg-zinc-50 text-zinc-600 font-mono outline-none cursor-not-allowed"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button
                type="button"
                onClick={handleClearPin}
                disabled={latitude === '' && longitude === ''}
                className="w-full h-[34px] px-2 text-[11px] font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear pin
              </button>
            </div>

            <p className="sm:col-span-12 text-[11px] text-zinc-500 m-0 -mt-2">
              {locationAnchor
                ? `GPS locked. Drag or click the Google Map pin within ${LOCATION_ADJUST_RADIUS_M} m — latitude and longitude update as you move.`
                : 'Search Google Maps above the map, click to place a pin, or use “Use my location” then fine-tune within 50 m.'}
            </p>
          </div>
        </section>

        {/* D) Tags & Segmentation */}
        <section data-tour="leads-field-tags" className={sectionCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider m-0">
              D. Tags & Segmentation
            </h3>
            <button type="button" onClick={() => setShowAddTagModal(true)} className={addLinkCls}>
              + Add New Tag
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {leadTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`text-xs px-3 py-1 rounded-md border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-950 text-white border-zinc-950 font-semibold'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </section>

        {/* E) Custom Attributes — Settings fields + this-create-only session fields */}
        <section className={sectionCls}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider m-0">
              E. Custom Attributes
            </h3>
            <button
              type="button"
              onClick={() => setShowAddCustomFieldModal(true)}
              className={addLinkCls}
            >
              + Add for this lead
            </button>
          </div>
          <p className="text-xs text-zinc-500 m-0 mb-4">
            Shared fields come from Settings → Leads. Attributes you add here apply only to this
            create and will not appear on the next new lead.
          </p>
          {activeCustomFieldDefs.length === 0 ? (
            <p className="text-xs text-zinc-500 m-0 mb-3">
              No custom fields yet. Add one for this lead, or configure shared fields in Settings →
              Leads.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-xs">
              {activeCustomFieldDefs.map((def) => {
                const isSessionOnly = sessionCustomFieldDefs.some((s) => s.key === def.key);
                return (
                  <label key={def.key} className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-600">
                      {def.label}
                      {def.required ? ' *' : ''}
                      <span className="ml-1 font-medium text-zinc-400">
                        {isSessionOnly ? '(this lead only)' : '(settings)'}
                      </span>
                    </span>
                    {def.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={Boolean(customFields[def.key])}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [def.key]: e.target.checked }))
                        }
                      />
                    ) : def.type === 'select' ? (
                      <select
                        className={inputCls}
                        value={String(customFields[def.key] ?? '')}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                        }
                      >
                        <option value="">Select…</option>
                        {(def.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : def.type === 'textarea' ? (
                      <textarea
                        className="min-h-[72px] border border-zinc-300 rounded-lg p-2 outline-none focus:border-zinc-950"
                        value={String(customFields[def.key] ?? '')}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                        }
                      />
                    ) : (
                      <input
                        className={inputCls}
                        type={
                          def.type === 'number'
                            ? 'number'
                            : def.type === 'date'
                              ? 'date'
                              : def.type === 'email'
                                ? 'email'
                                : def.type === 'url'
                                  ? 'url'
                                  : 'text'
                        }
                        value={
                          customFields[def.key] === undefined || customFields[def.key] === null
                            ? ''
                            : String(customFields[def.key])
                        }
                        onChange={(e) =>
                          setCustomFields((prev) => ({
                            ...prev,
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
                );
              })}
            </div>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowAddCustomFieldModal(true)}
              className="h-9 px-3.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 cursor-pointer inline-flex items-center gap-1.5"
            >
              <AddIcon sx={{ fontSize: 14 }} />
              Add attribute for this lead only
            </button>
          </div>
        </section>

        {/* F) Notes */}
        <section data-tour="leads-field-notes" className={sectionCls}>
          <h3 className={sectionTitleCls}>F. Internal Notes</h3>
          <textarea
            rows={4}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Initial context, prospect expectations, call summaries, next steps…"
            className="w-full text-xs border border-zinc-300 rounded-lg p-3 bg-white text-zinc-900 outline-none focus:border-zinc-950 leading-relaxed"
          />
        </section>

        {/* Generic extension fields slot — no nested iframe (docs: fields.register) */}
        {canWrite && !isClient ? (
          <ExtensionFieldsSlot
            groups={createFieldsForRequestType({
              key: requestTypes.find((rt) => rt._id === requestTypeId)?.key,
              name:
                requestTypes.find((rt) => rt._id === requestTypeId)?.name || requestType,
            })}
            requestType={{
              key: requestTypes.find((rt) => rt._id === requestTypeId)?.key,
              name:
                requestTypes.find((rt) => rt._id === requestTypeId)?.name || requestType,
            }}
            meta={{
              preparedBy: preparedByLabel,
              primaryTraveller: selectedContact
                ? formatContactName(selectedContact)
                : showCreateContact
                  ? newContact.name
                  : '',
              defaultCurrency: settingsCurrency,
            }}
            valuesByExtension={extensionFieldValues}
            onChange={(extensionId, values) => {
              setExtensionFieldValues((prev) => ({ ...prev, [extensionId]: values }));
            }}
            sectionClassName={sectionCls}
            titleClassName={sectionTitleCls}
            inputClassName={`${inputCls} text-xs`}
          />
        ) : null}

        {/* Form Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="px-5 py-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-tour="leads-save-btn"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-xs font-semibold text-white border border-zinc-950 cursor-pointer transition-colors"
          >
            {saving ? 'Creating Lead…' : 'Create Lead'}
          </button>
        </div>
      </form>

      {/* Reusable "add item" modals */}
      <AddLeadItemModal
        open={showAddPriorityModal}
        title="Add New Lead Priority"
        subtitle="Define an urgency level for prioritising leads."
        label="Priority Name *"
        placeholder="e.g. Critical, Nice to have"
        submitLabel="Save Priority"
        onClose={() => setShowAddPriorityModal(false)}
        onSubmit={handleCreatePriority}
      />

      <AddLeadItemModal
        open={showAddSourceModal}
        title="Add New Lead Source"
        subtitle="Create an acquisition source for tracking lead origin."
        label="Source Name *"
        placeholder="e.g. Billboard, Radio Ad, Partner"
        submitLabel="Save Source"
        onClose={() => setShowAddSourceModal(false)}
        onSubmit={handleCreateSource}
      />

      <AddLeadItemModal
        open={showAddStatusModal}
        title="Add New Lead Status"
        subtitle="Add a status such as Hot, Warm, Cold, or a custom lifecycle label."
        label="Status Name *"
        placeholder="e.g. Hot, Warm, Cold, Nurturing"
        submitLabel="Save Status"
        onClose={() => setShowAddStatusModal(false)}
        onSubmit={handleCreateStatus}
      />

      <AddLeadItemModal
        open={showAddTagModal}
        title="Add New Lead Tag"
        subtitle="Create a tag for labeling and segmenting leads."
        label="Tag Name *"
        placeholder="e.g. High Priority, VIP, Inbound"
        submitLabel="Save Tag"
        onClose={() => setShowAddTagModal(false)}
        onSubmit={handleCreateTag}
      />

      <AddCustomFieldModal
        open={showAddCustomFieldModal}
        title="Add Attribute for This Lead"
        subtitle="This field is only used while creating this lead. It is not saved to Settings and will not show on other lead creates."
        onClose={() => setShowAddCustomFieldModal(false)}
        onSubmit={async (field) => {
          const key = String(field.key || '').trim();
          if (!key) return;
          // Session-only: never persist to tenant lead_custom_fields from create form.
          setSessionCustomFieldDefs((prev) => {
            if (prev.some((d) => d.key === key) || customFieldDefs.some((d) => d.key === key)) {
              return prev;
            }
            return [
              ...prev,
              {
                key,
                label: String(field.label || key).trim() || key,
                type: field.type,
                required: Boolean(field.required),
                options: Array.isArray(field.options) ? field.options : [],
              },
            ];
          });
        }}
      />

      <OcrLeadImportModal
        open={showOcrImportModal}
        onClose={() => setShowOcrImportModal(false)}
        onExtracted={applyOcrExtract}
      />

      {/* Discrepancy Confirmation Modal (Different Company with Same Email/Phone/Name) */}
      <CompanyDiscrepancyModal
        open={showDiscrepancyModal}
        entityType="lead"
        discrepancy={discrepancy}
        onConfirm={() => void handleConfirmDiscrepancyLeadCreate()}
        onCancel={handleCancelDiscrepancyLeadCreate}
        loading={saving}
      />
    </div>
  );
};
