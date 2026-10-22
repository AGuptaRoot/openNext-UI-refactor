import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import PublicIcon from '@mui/icons-material/Public';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  MapPin,
  Tag,
  User,
} from 'lucide-react';

import { crmApi } from '../../services/api';
import { isLeadConvertibleStage, resolveWonStage } from '../../utils/leadPipeline';
import { displayLabel, displayUserLabel } from '../../utils/displayLabels';
import { reverseGeocode } from '../../utils/reverseGeocode';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { canAssignToOtherUsers } from '../../utils/permissions';
import { LeadLocationMap } from '../../components/leads/LeadLocationMap';
import { AddLeadItemModal } from '../../components/leads/AddLeadItemModal';
import { CommercialRequirementTab } from '../../components/leads/CommercialRequirementTab';
import {
  ExtensionFieldsSlot,
  buildExtensionPayloadFromFields,
  hydrateExtensionFieldValuesFromLead,
  validateExtensionFields,
} from '../../components/extensions/ExtensionFieldsSlot';
import { ExtensionTab } from '../../components/extensions/ExtensionTab';
import { LeadTravelRequirementTab } from '../../components/leads/LeadTravelRequirementTab';
import { useExtensions } from '../../hooks/useExtensions';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import {
  asExtensionBag,
  isExtensionLeadGetMessage,
  isExtensionLeadSyncMessage,
} from '../../utils/extensionLeadEmbed';
import {
  AttachmentPreviewModal,
  downloadAttachment,
  resolvePreviewKind,
} from '../../components/common/AttachmentPreviewModal';
import { FileUploadField } from '../../components/common/FileUploadField';
import { DocumentUploadControl } from '../../components/common/DocumentUploadControl';
import {
  LeadItem,
  LeadEvent,
  LeadFollowUp,
  LeadAttachment,
  LeadAuditEntry,
  LeadCustomFieldDef,
  AssignableUser,
} from '../../types/leads';
import type { QuotationItem } from '../../types/quotations';
import type { OpportunityItem } from '../../types/opportunities';
import type { SampleItem } from '../../types/samples';
import { sampleStatusTone, sampleUrgencyEmoji, sampleUrgencyTone } from '../../types/samples';
import {
  LEAD_TYPES as DEFAULT_LEAD_TYPES,
  LEAD_PRIORITIES as DEFAULT_LEAD_PRIORITIES,
  LEAD_REQUEST_TYPES,
  mergeLeadStatusesWithBuiltins,
} from '../../services/mockLeadData';
import type { RequestType } from '../../types/request-types';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { getRuntimeDefaultCurrency } from '../../utils/currency';

const LEAD_DOC_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.markdown,.txt,.csv,.rtf,image/jpeg,image/png,image/webp,image/gif,application/pdf';

const SALUTATIONS = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];
const GENDERS = ['', 'Male', 'Female', 'Other', 'Prefer not to say'];
const EVENT_TYPES = ['Call', 'Meeting', 'Follow up', 'Other'];

type LeadCustomFieldValues = Record<string, string | number | boolean>;

/** Keep only primitive values stored on THIS lead (never values from another lead). */
function pickLeadCustomFieldValues(raw: unknown): LeadCustomFieldValues {
  const result: LeadCustomFieldValues = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      result[key] = val;
    }
  }
  return result;
}

/** Keep a saved value selectable even if it was removed from the configured list. */
function withCurrentOption(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}

/** `YYYY-MM-DD` slice of an ISO date for <input type="date">. */
function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
}

/** Local `YYYY-MM-DDTHH:mm` for <input type="datetime-local"> (not UTC). */
function toLocalDateTimeInputValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Default pipeline used when settings have not loaded yet. */
const DEFAULT_LEAD_PIPELINE = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Won',
  'Lost',
];

/**
 * Proposal / Deal / Samples tabs are available from Qualified onward
 * (Qualified, Proposal Sent, Won, Lost, and any custom stages after Qualified).
 */
function isQualifiedOrLaterStage(
  stage?: string | null,
  pipelineStages: string[] = []
): boolean {
  const current = String(stage || '').trim();
  if (!current) return false;

  const stages = (pipelineStages.length ? pipelineStages : DEFAULT_LEAD_PIPELINE).map((s) =>
    String(s || '').trim()
  );
  const lowerStages = stages.map((s) => s.toLowerCase());
  const qualifiedIdx = lowerStages.findIndex((s) => s === 'qualified');
  const currentIdx = lowerStages.findIndex((s) => s === current.toLowerCase());

  if (qualifiedIdx >= 0 && currentIdx >= 0) {
    return currentIdx >= qualifiedIdx;
  }

  // Fallback when stage names differ from the configured pipeline list
  const key = current.toLowerCase();
  if (key === 'qualified' || key === 'proposal sent' || key === 'won' || key === 'lost') {
    return true;
  }
  return key.includes('qualif') || key.includes('proposal') || key.includes('negotiat');
}

function quotationStatusClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    Sent: 'bg-blue-50 text-blue-800 border-blue-200',
    Accepted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-50 text-red-700 border-red-200',
    Expired: 'bg-amber-50 text-amber-800 border-amber-200',
    Converted: 'bg-violet-50 text-violet-800 border-violet-200',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

type DetailTab =
  | 'details'
  | 'qualification'
  | 'activities'
  | 'notes'
  | 'follow-ups'
  | 'proposal'
  | 'deal'
  | 'samples'
  | 'audit'
  | string;

const LEAD_TABS: string[] = [
  'details',
  'qualification',
  'activities',
  'notes',
  'follow-ups',
  'proposal',
  'deal',
  'samples',
  'audit',
];

function resolveLeadTab(raw: string | null): DetailTab {
  const value = String(raw || '').trim();
  const lower = value.toLowerCase();
  if (lower === 'followups') return 'follow-ups';
  if (lower === 'deals' || lower === 'opportunity' || lower === 'opportunities') return 'deal';
  if (lower === 'sample' || lower === 'sample-requests') return 'samples';
  if (value.startsWith('ext__')) return value;
  if (LEAD_TABS.includes(lower)) return lower as DetailTab;
  return 'details';
}

export const LeadDetailPage: React.FC = () => {
  const { confirm } = useDialog();
  const { hasPermission, isClient, activeRole, user } = useAuth();
  const {
    leadTabsForRequestType,
    createFieldsForRequestType,
    extensionPageUrl,
  } = useExtensions();
  const settingsCurrency = useDefaultCurrency();
  const canWrite = hasPermission('crm.leads.write') && !isClient;
  const canAssignOthers = canAssignToOtherUsers(user, { isClient, activeRole });
  const currentUserId = String(user?.userId || '').trim();
  /** Sales managers (and other lead editors) may assign activities to employees / sales reps. */
  const canAssignActivities =
    canWrite ||
    (!isClient &&
      (activeRole === 'sales-manager' ||
        activeRole === 'crm-manager' ||
        activeRole === 'sales-representative'));
  const canDelete = hasPermission('crm.leads.delete') && !isClient;
  const canConvert = hasPermission('crm.leads.convert') && !isClient;
  const canReadQuotations =
    (hasPermission('crm.finance.read') || hasPermission('crm.quotes.write')) && !isClient;
  const canWriteQuotations =
    (hasPermission('crm.quotes.write') || hasPermission('crm.finance.write')) && !isClient;
  const canReadOpportunities =
    (hasPermission('crm.opportunities.read') ||
      hasPermission('crm.opportunities.write') ||
      hasPermission('crm.leads.read')) &&
    !isClient;
  const canWriteOpportunities =
    (hasPermission('crm.opportunities.write') || hasPermission('crm.leads.write')) && !isClient;
  const canReadSamples =
    (hasPermission('crm.samples.read') ||
      hasPermission('crm.samples.write') ||
      hasPermission('crm.leads.read')) &&
    !isClient;
  const canWriteSamples =
    (hasPermission('crm.samples.write') || hasPermission('crm.leads.write')) && !isClient;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [lead, setLead] = useState<LeadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>(() =>
    resolveLeadTab(searchParams.get('tab'))
  );

  useEffect(() => {
    setActiveTab(resolveLeadTab(searchParams.get('tab')));
  }, [id, searchParams]);

  useEffect(() => {
    const onTourTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab) setActiveTab(resolveLeadTab(tab));
    };
    window.addEventListener('crm-leads-tour-tab', onTourTab as EventListener);
    return () => window.removeEventListener('crm-leads-tour-tab', onTourTab as EventListener);
  }, []);

  // Metadata
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [leadTags, setLeadTags] = useState<string[]>([]);
  const [leadTypes, setLeadTypes] = useState<string[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [leadPriorities, setLeadPriorities] = useState<string[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<LeadCustomFieldDef[]>([]);
  // Values belong to the lead currently loaded — always reset when `id` changes.
  const [customFields, setCustomFields] = useState<LeadCustomFieldValues>({});

  // Sub-resources
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [auditEntries, setAuditEntries] = useState<LeadAuditEntry[]>([]);
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(false);

  // Feedback notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Modals state
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [showAddStatusModal, setShowAddStatusModal] = useState(false);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [showAddPriorityModal, setShowAddPriorityModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form states for Details Tab
  const [detailsForm, setDetailsForm] = useState({
    title: '',
    priority: '',
    nextFollowUp: '',
    salutation: '',
    name: '',
    jobTitle: '',
    gender: '',
    email: '',
    phone: '',
    company: '',
    pan: '',
    source: '',
    stage: '',
    status: '',
    assignedTo: '',
    leadType: '',
    requestType: '',
    requestTypeId: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    placeId: '',
    latitude: '' as number | '',
    longitude: '' as number | '',
    photoUrl: '',
    tags: [] as string[],
  });
  const [savingDetails, setSavingDetails] = useState(false);
  /** Same native field bags as Create Lead (no Details iframe). */
  const [extensionFieldValues, setExtensionFieldValues] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [docUploading] = useState(false);
  const [storageStatusHint, setStorageStatusHint] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    name: string;
    mimeType?: string;
  } | null>(null);

  // Form states for Activities Tab
  const [activityForm, setActivityForm] = useState({
    eventType: 'Call',
    eventDate: toLocalDateTimeInputValue(),
    assignedTo: '',
  });
  const [savingActivity, setSavingActivity] = useState(false);
  const activityAssignees = useMemo(
    () =>
      assignableUsers.filter(
        (u) => !u.isClient && !u.isClientUser && !String(u.role || '').toLowerCase().includes('client')
      ),
    [assignableUsers]
  );
  const defaultActivityAssignee = useMemo(() => {
    const ownerId = String(lead?.assignedTo || detailsForm.assignedTo || '').trim();
    if (!ownerId) return '';
    return activityAssignees.some((u) => u.id === ownerId) ? ownerId : '';
  }, [lead?.assignedTo, detailsForm.assignedTo, activityAssignees]);

  // Prefill activity assignee with lead owner when empty / owner changes.
  useEffect(() => {
    if (!defaultActivityAssignee) return;
    setActivityForm((prev) =>
      prev.assignedTo ? prev : { ...prev, assignedTo: defaultActivityAssignee }
    );
  }, [defaultActivityAssignee]);


  // Form states for Notes Tab
  const [notesContent, setNotesContent] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Form states for Follow-ups Tab
  const [followUpForm, setFollowUpForm] = useState({
    title: 'Follow up',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    notes: '',
  });
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  // Initial Lead & Metadata loading
  const loadSeqRef = useRef(0);
  const loadedLeadIdRef = useRef<string | undefined>(undefined);
  const loadLeadData = useCallback(async () => {
    if (!id) return;
    const seq = ++loadSeqRef.current;
    // Switching to a different lead: drop everything that belonged to the previous one
    // so custom fields, notes, qualification and sub-resources never leak across leads.
    if (loadedLeadIdRef.current !== id) {
      loadedLeadIdRef.current = id;
      setLead(null);
      setCustomFields({});
      setNotesContent('');
      setEvents([]);
      setFollowUps([]);
      setAttachments([]);
      setAuditEntries([]);
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [leadRes, pipeRes, statRes, srcRes, tagRes, usrRes, cfRes, typeRes, prioRes, rtRes] = await Promise.all([
        crmApi.getLead(id),
        crmApi.getPipeline().catch(() => ({ data: { pipeline_stages: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'] } })),
        crmApi.getLeadStatuses().catch(() => ({
          data: ['Hot', 'Warm', 'Cold', 'New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost', 'Disqualified', 'Junk'],
        })),
        crmApi.getLeadSources().catch(() => ({ data: ['Website', 'Referral', 'Cold Call', 'LinkedIn', 'Google Ads', 'Organic Search', 'Trade Show', 'Email Campaign', 'Other'] })),
        crmApi.getLeadTags().catch(() => ({ data: ['Enterprise', 'Hot Lead', 'Follow Up', 'Decision Maker', 'Inbound', 'Outbound', 'High Value', 'Partner'] })),
        crmApi.getAssignableUsers().catch(() => ({ data: [] })),
        crmApi.getLeadCustomFields().catch(() => ({ data: [] as LeadCustomFieldDef[] })),
        crmApi.getLeadTypes().catch(() => ({ data: [...DEFAULT_LEAD_TYPES] })),
        crmApi.getLeadPriorities().catch(() => ({ data: [...DEFAULT_LEAD_PRIORITIES] })),
        crmApi.listRequestTypes({ includeDisabled: true }).catch(() => ({ data: [] as RequestType[] })),
      ]);

      // A newer load (route change / reload) superseded this one — ignore stale data.
      if (seq !== loadSeqRef.current) return;

      const leadData = leadRes.data;
      setLead(leadData);
      setPipelineStages(pipeRes.data?.pipeline_stages || []);
      setLeadStatuses(mergeLeadStatusesWithBuiltins(statRes.data || []));
      setLeadSources(srcRes.data || []);
      setLeadTags(tagRes.data || []);
      setLeadTypes(Array.isArray(typeRes.data) && typeRes.data.length ? typeRes.data : [...DEFAULT_LEAD_TYPES]);
      // Prefer Organizational / Individual when settings still have legacy types
      if (
        !typeRes.data?.length ||
        typeRes.data.every((t) =>
          ['inbound', 'outbound', 'partner', 'referral', 'other'].includes(String(t).toLowerCase())
        )
      ) {
        setLeadTypes([...DEFAULT_LEAD_TYPES]);
      }
      setLeadPriorities(Array.isArray(prioRes.data) ? prioRes.data : [...DEFAULT_LEAD_PRIORITIES]);
      setAssignableUsers(usrRes.data || []);
      setCustomFieldDefs(Array.isArray(cfRes.data) ? cfRes.data : []);
      const loadedRequestTypes = Array.isArray(rtRes.data) ? rtRes.data : [];
      setRequestTypes(
        loadedRequestTypes.length
          ? loadedRequestTypes
          : LEAD_REQUEST_TYPES.map((name, index) => ({
              _id: `legacy_${index}`,
              key: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              name,
              isEnabled: true,
              fields: [],
            }))
      );
      // Only THIS lead's saved values — never reuse state from another lead.
      setCustomFields(pickLeadCustomFieldValues(leadData.customFields));

      const resolvedRequestTypeId =
        String(leadData.requestTypeId || leadData.commercialRequirement?.requestTypeId || '') ||
        loadedRequestTypes.find(
          (rt) =>
            rt.name.toLowerCase() === String(leadData.requestType || '').trim().toLowerCase()
        )?._id ||
        '';

      // Populate Details Form
      setDetailsForm({
        title: leadData.title || '',
        priority: leadData.priority || '',
        nextFollowUp: toDateInputValue(leadData.nextFollowUp),
        salutation: leadData.salutation || '',
        name: leadData.name || '',
        jobTitle: leadData.jobTitle || '',
        gender: leadData.gender || '',
        email: leadData.email || '',
        phone: leadData.phone || '',
        company: leadData.company || '',
        pan: leadData.pan || '',
        source: leadData.source || '',
        stage: leadData.stage || '',
        status: leadData.status || 'New',
        assignedTo: leadData.assignedTo || '',
        leadType: leadData.leadType || '',
        requestType: leadData.requestType || '',
        requestTypeId: resolvedRequestTypeId,
        address: leadData.address || leadData.formattedAddress || '',
        city: leadData.city || '',
        state: leadData.state || '',
        country: leadData.country || '',
        postalCode: leadData.postalCode || '',
        placeId: leadData.placeId || '',
        latitude: leadData.latitude != null ? leadData.latitude : '',
        longitude: leadData.longitude != null ? leadData.longitude : '',
        photoUrl: leadData.photoUrl || '',
        tags: Array.isArray(leadData.tags) ? [...leadData.tags] : [],
      });

      // Populate Notes
      setNotesContent(leadData.notes || '');

      // Load Storage Hint
      try {
        const storageRes = await crmApi.getLeadStorageStatus();
        setStorageStatusHint(
          storageRes.data?.storageMode === 's3'
            ? 'Files are stored securely on Amazon S3.'
            : 'Files are stored locally under /upload/crm/.'
        );
      } catch {
        setStorageStatusHint('');
      }

    } catch (err: any) {
      if (seq === loadSeqRef.current) setLoadError(err.message || 'Failed to load lead details');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadLeadData();
  }, [loadLeadData]);

  // Load Tab Resources on Tab Change
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'activities') {
      crmApi.getLeadEvents(id).then(res => setEvents(res.data || [])).catch(() => setEvents([]));
      setActivityForm((prev) => ({ ...prev, eventDate: toLocalDateTimeInputValue() }));
    } else if (activeTab === 'follow-ups') {
      crmApi.getLeadFollowUps(id).then(res => setFollowUps(res.data || [])).catch(() => setFollowUps([]));
    } else if (activeTab === 'details') {
      crmApi.getLeadAttachments(id).then(res => setAttachments(res.data || [])).catch(() => setAttachments([]));
    } else if (activeTab === 'audit') {
      crmApi.getAuditByRecord('lead', id).then(res => setAuditEntries(res.data || [])).catch(() => setAuditEntries([]));
    } else if (activeTab === 'proposal' && canReadQuotations) {
      setLoadingQuotations(true);
      crmApi
        .getLeadQuotations(id)
        .then((res) => setQuotations(res.data || []))
        .catch(() => setQuotations([]))
        .finally(() => setLoadingQuotations(false));
    } else if (activeTab === 'deal' && canReadOpportunities) {
      setLoadingOpportunities(true);
      crmApi
        .listOpportunities({ leadId: id, limit: 100 })
        .then((res) => setOpportunities(res.data || []))
        .catch(() => setOpportunities([]))
        .finally(() => setLoadingOpportunities(false));
    } else if (activeTab === 'samples' && canReadSamples) {
      setLoadingSamples(true);
      crmApi
        .listSamples({ leadId: id, limit: 100 })
        .then((res) => setSamples(res.data || []))
        .catch(() => setSamples([]))
        .finally(() => setLoadingSamples(false));
    }
  }, [activeTab, id, canReadQuotations, canReadOpportunities, canReadSamples]);

  const showProposalTab = isQualifiedOrLaterStage(
    lead?.stage || detailsForm.stage,
    pipelineStages
  );
  const showDealTab = showProposalTab;
  const showSamplesTab = showProposalTab;

  const selectedRequestType = useMemo(() => {
    const byId = requestTypes.find((rt) => rt._id === detailsForm.requestTypeId);
    if (byId) return byId;
    return (
      requestTypes.find(
        (rt) =>
          String(rt.name || '')
            .trim()
            .toLowerCase() === String(detailsForm.requestType || '').trim().toLowerCase()
      ) || null
    );
  }, [requestTypes, detailsForm.requestTypeId, detailsForm.requestType]);

  const isTravelLead = useMemo(() => {
    const key = String(selectedRequestType?.key || '').trim().toLowerCase();
    const name = String(selectedRequestType?.name || detailsForm.requestType || lead?.requestType || '').trim().toLowerCase();
    return key === 'travel' || name === 'travel' || /travel/i.test(name) || /travel/i.test(key);
  }, [selectedRequestType, detailsForm.requestType, lead?.requestType]);

  const extensionLeadTabs = useMemo(() => {
    const tabs = leadTabsForRequestType({
      key: selectedRequestType?.key,
      name: selectedRequestType?.name || detailsForm.requestType || lead?.requestType,
    });
    const isTravel =
      isTravelLead ||
      Boolean(lead?.extension && (lead.extension as Record<string, unknown>)['crm-travel']);
    if (isTravel && !tabs.some((t) => t.id === 'travel-requirement')) {
      tabs.push({
        extensionId: 'crm-travel',
        id: 'travel-requirement',
        tabId: 'ext__crm-travel__travel-requirement',
        title: 'Travel Requirement',
        label: 'Travel Requirement',
        entry: 'ui/pages/travel-requirement.html',
        url: '/extensions/crm-travel/ui/pages/travel-requirement.html',
        slot: 'lead.detail.tab',
        whenRequestTypeKey: 'travel',
        whenRequestTypeName: 'travel',
        appendLeadId: true,
        openOnCreate: false,
        order: 20,
        hintMessage: 'Travel Requirement',
      });
    }
    return tabs;
  }, [
    leadTabsForRequestType,
    selectedRequestType,
    detailsForm.requestType,
    lead?.requestType,
    lead?.extension,
  ]);

  const detailRequestType = useMemo(
    () => ({
      key: selectedRequestType?.key,
      name: selectedRequestType?.name || detailsForm.requestType || lead?.requestType,
    }),
    [selectedRequestType, detailsForm.requestType, lead?.requestType]
  );

  const extensionFieldGroups = useMemo(
    () => createFieldsForRequestType(detailRequestType),
    [createFieldsForRequestType, detailRequestType]
  );

  const extensionDetailMeta = useMemo(
    () => ({
      preparedBy: displayUserLabel(lead?.createdByUsername, lead?.createdBy, ''),
      primaryTraveller: String(lead?.name || detailsForm.name || '').trim(),
      defaultCurrency: settingsCurrency,
    }),
    [
      lead?.createdByUsername,
      lead?.createdBy,
      lead?.name,
      detailsForm.name,
      settingsCurrency,
    ]
  );

  // Hydrate native Travel (etc.) fields from Lead.extension — same slot as Create Lead.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!extensionFieldGroups.length) {
        if (!cancelled) setExtensionFieldValues({});
        return;
      }
      const ext =
        lead?.extension && typeof lead.extension === 'object' ? lead.extension : {};
      const hydrated = await hydrateExtensionFieldValuesFromLead(
        extensionFieldGroups,
        ext,
        detailRequestType
      );
      if (!cancelled) setExtensionFieldValues(hydrated);
    })();
    return () => {
      cancelled = true;
    };
  }, [lead?._id, lead?.extension, extensionFieldGroups, detailRequestType]);

  const leadExtensionRef = useRef(lead?.extension);
  leadExtensionRef.current = lead?.extension;

  const handleExtensionEmbedSynced = useCallback(
    async (ext: Record<string, unknown>) => {
      if (!id || !ext || !Object.keys(ext).length) return;
      const prev =
        leadExtensionRef.current && typeof leadExtensionRef.current === 'object'
          ? leadExtensionRef.current
          : {};
      // Skip empty shells so sync cannot wipe filled Lead.extension (server also deep-merges).
      const hasReal =
        Object.values(ext).some((bag) => {
          if (!bag || typeof bag !== 'object') return bag != null && bag !== '';
          try {
            return JSON.stringify(bag).replace(/[{}\[\]",:\s]|null|0|""/g, '').length > 0;
          } catch {
            return true;
          }
        });
      if (!hasReal) return;
      try {
        if (JSON.stringify({ ...prev, ...ext }) === JSON.stringify(prev)) return;
      } catch {
        /* continue */
      }
      try {
        if (canWrite) {
          const res = await crmApi.updateLead(id, { extension: ext });
          setLead(res.data);
        } else {
          setLead((prevLead) =>
            prevLead
              ? {
                  ...prevLead,
                  extension: {
                    ...(prevLead.extension && typeof prevLead.extension === 'object'
                      ? prevLead.extension
                      : {}),
                    ...ext,
                  },
                }
              : prevLead
          );
        }
      } catch (err) {
        console.warn('Failed to persist extension embed sync:', err);
      }
    },
    [id, canWrite]
  );

  // Leave Proposal / Deal / Samples tabs if stage moves before Qualified
  useEffect(() => {
    if (
      (activeTab === 'proposal' || activeTab === 'deal' || activeTab === 'samples') &&
      lead &&
      !showProposalTab
    ) {
      setActiveTab('details');
    }
  }, [activeTab, lead, showProposalTab]);

  useEffect(() => {
    if (
      String(activeTab).startsWith('ext__') &&
      !extensionLeadTabs.some((tab) => tab.tabId === activeTab)
    ) {
      setActiveTab('details');
    }
  }, [activeTab, extensionLeadTabs]);

  // If request type is travel, hide commercial requirement and switch to details
  useEffect(() => {
    if (activeTab === 'qualification' && isTravelLead) {
      setActiveTab('details');
    }
  }, [activeTab, isTravelLead]);

  /**
   * Host bridge for extension detail TABS (separate tab iframes only).
   * Details tab uses native ExtensionFieldsSlot (same as Create Lead) — no iframe.
   */
  useEffect(() => {
    if (!id) return;

    const onMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (isExtensionLeadGetMessage(data)) {
        const wantId = String(data.leadId || '').trim();
        if (wantId && wantId !== id) return;
        const bag =
          leadExtensionRef.current && typeof leadExtensionRef.current === 'object'
            ? leadExtensionRef.current
            : {};
        const target = event.source as Window | null;
        target?.postMessage(
          {
            source: 'crm-host',
            type: 'extension-lead-get-result',
            requestId: data.requestId,
            leadId: id,
            extension: bag,
          },
          '*'
        );
        return;
      }

      if (!isExtensionLeadSyncMessage(data)) return;
      // Details tab is native (no iframe) — ignore sync messages while on Details.
      if (activeTab === 'details') return;
      const wantId = String(data.leadId || '').trim();
      if (wantId && wantId !== id) return;
      const ext = asExtensionBag(data.extension);
      if (!ext || !Object.keys(ext).length) return;
      await handleExtensionEmbedSynced(ext);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [id, activeTab, handleExtensionEmbedSynced]);

  // Quick Stage Change
  const handleQuickStageChange = async (newStage: string) => {
    if (!canWrite || !id || !lead) return;
    try {
      const res = await crmApi.changeLeadStage(id, newStage);
      setLead(res.data);
      setDetailsForm(prev => ({ ...prev, stage: newStage }));
      showToast(`Stage updated to ${newStage}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update stage', 'error');
    }
  };

  // Quick Status Change
  const handleQuickStatusChange = async (newStatus: string) => {
    if (!canWrite || !id || !lead) return;
    try {
      const res = await crmApi.updateLead(id, { status: newStatus });
      setLead(res.data);
      setDetailsForm(prev => ({ ...prev, status: newStatus }));
      showToast(`Status updated to ${newStatus}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Quick Add Tag to Lead
  const handleQuickAddTag = async (tagName: string) => {
    if (!canWrite || !id || !lead || !tagName.trim()) return;
    const cleanTag = tagName.trim();
    const currentTags = Array.isArray(lead.tags) ? [...lead.tags] : [];
    if (!currentTags.includes(cleanTag)) {
      currentTags.push(cleanTag);
      try {
        await crmApi.addLeadTag(cleanTag);
        const res = await crmApi.updateLead(id, { tags: currentTags });
        setLead(res.data);
        setDetailsForm(prev => ({ ...prev, tags: currentTags }));
        if (!leadTags.includes(cleanTag)) setLeadTags(prev => [...prev, cleanTag]);
        showToast(`Tag "${cleanTag}" assigned successfully`);
      } catch (err: any) {
        showToast(err.message || 'Failed to assign tag', 'error');
      }
    }
  };

  // Convert Lead to Client — API allows convert only from Won stage
  const handleConvertLead = async () => {
    if (!canConvert || !id || !lead) return;
    if (!isLeadConvertibleStage(lead.stage, pipelineStages)) {
      setShowConvertModal(false);
      showToast(`Move the lead to "${resolveWonStage(pipelineStages)}" stage before converting.`, 'error');
      return;
    }
    try {
      await crmApi.convertLead(id);
      setShowConvertModal(false);
      showToast('Lead successfully converted to client!');
      loadLeadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to convert lead', 'error');
    }
  };

  // Delete Lead
  const handleDeleteLead = async () => {
    if (!canDelete || !id) return;
    try {
      await crmApi.deleteLead(id);
      showToast('Lead removed (soft deleted)');
      navigate('/leads');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete lead', 'error');
    }
  };

  // Details Save
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !id) return;
    if (!detailsForm.name.trim()) {
      showToast('Full name is required', 'error');
      return;
    }
    if (!detailsForm.email.trim()) {
      showToast('Email address is required', 'error');
      return;
    }
    if (!detailsForm.phone.trim()) {
      showToast('Mobile number is required', 'error');
      return;
    }
    if (!detailsForm.company.trim()) {
      showToast('Company name is required', 'error');
      return;
    }
    if (!detailsForm.requestType.trim()) {
      showToast('Request type is required', 'error');
      return;
    }
    for (const def of customFieldDefs) {
      if (def.required) {
        const val = customFields[def.key];
        if (val === undefined || val === null || String(val).trim() === '') {
          showToast(`${def.label} is required`, 'error');
          return;
        }
      }
    }

    if (extensionFieldGroups.length) {
      const extErr = await validateExtensionFields(
        extensionFieldGroups,
        extensionFieldValues,
        detailRequestType
      );
      if (extErr) {
        showToast(extErr, 'error');
        return;
      }
    }

    setSavingDetails(true);
    try {
      const extensionPayload = extensionFieldGroups.length
        ? await buildExtensionPayloadFromFields(
            extensionFieldGroups,
            extensionFieldValues,
            detailRequestType,
            extensionDetailMeta
          )
        : undefined;

      const payload: Partial<LeadItem> = {
        title: detailsForm.title.trim(),
        priority: detailsForm.priority,
        nextFollowUp: detailsForm.nextFollowUp || null,
        customFields: { ...customFields },
        salutation: detailsForm.salutation,
        name: detailsForm.name.trim(),
        jobTitle: detailsForm.jobTitle.trim(),
        gender: detailsForm.gender,
        email: detailsForm.email.trim(),
        phone: detailsForm.phone.trim(),
        company: detailsForm.company.trim(),
        pan: detailsForm.pan.trim(),
        source: detailsForm.source,
        stage: detailsForm.stage,
        status: detailsForm.status,
        assignedTo: canAssignOthers
          ? detailsForm.assignedTo
          : currentUserId || detailsForm.assignedTo,
        leadType: detailsForm.leadType.trim(),
        requestType: detailsForm.requestType.trim(),
        requestTypeId: detailsForm.requestTypeId.startsWith('legacy_')
          ? null
          : detailsForm.requestTypeId || null,
        address: detailsForm.address.trim(),
        formattedAddress: detailsForm.address.trim(),
        city: detailsForm.city.trim(),
        state: detailsForm.state.trim(),
        country: detailsForm.country.trim(),
        postalCode: detailsForm.postalCode.trim(),
        placeId: detailsForm.placeId.trim(),
        latitude: detailsForm.latitude === '' ? null : Number(detailsForm.latitude),
        longitude: detailsForm.longitude === '' ? null : Number(detailsForm.longitude),
        photoUrl: detailsForm.photoUrl.trim(),
        tags: detailsForm.tags,
        ...(extensionPayload && Object.keys(extensionPayload).length
          ? { extension: extensionPayload }
          : {}),
      };

      const res = await crmApi.updateLead(id, payload);
      setLead(res.data);
      showToast('Lead details saved successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save details', 'error');
    } finally {
      setSavingDetails(false);
    }
  };

  // Photo Upload — store on S3 (via CRM → s3-media-plugin) and save URL on lead.photoUrl
  const handlePhotoUpload = async (file: File | null) => {
    if (!file || !id) return;
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
      showToast('Please select a valid image file (JPG, PNG, WEBP, GIF)', 'error');
      return;
    }
    setPhotoUploading(true);
    try {
      let newUrl = '';
      try {
        const res = await crmApi.uploadLeadPhoto(id, file);
        newUrl = res.data?.photoUrl || '';
      } catch {
        // Fallback: general media upload then persist URL on the lead
        const uploaded = await crmApi.uploadMedia(file, { folder: 'leads', entityId: id });
        newUrl = uploaded.data?.url || uploaded.data?.fileUrl || '';
        if (!newUrl) throw new Error('Upload returned no URL');
        await crmApi.updateLead(id, { photoUrl: newUrl });
      }
      if (!newUrl) throw new Error('Upload returned no photo URL');
      setDetailsForm((prev) => ({ ...prev, photoUrl: newUrl }));
      if (lead) setLead({ ...lead, photoUrl: newUrl });
      showToast('Photo uploaded to storage successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setPhotoUploading(false);
    }
  };

  // Delete Document
  const handleDeleteDoc = async (attachmentId: string) => {
    if (!canWrite || !id) return;
    if (!(await confirm({ message: 'Delete this document?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteLeadAttachment(id, attachmentId);
      setAttachments(prev => prev.filter(a => a._id !== attachmentId));
      showToast('Document deleted successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document', 'error');
    }
  };

  // Geolocation / “Use my location” → reverse-geocode and sync all location fields
  const applyCoordsAndGeocode = async (lat: number, lng: number) => {
    setDetailsForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    try {
      const geo = await reverseGeocode(lat, lng);
      setDetailsForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        city: geo.city || prev.city,
        state: geo.state || prev.state,
        country: geo.country || prev.country,
        postalCode: geo.postcode || prev.postalCode,
        address: geo.addressLine || prev.address,
      }));
      const place = [geo.city, geo.state].filter(Boolean).join(', ') || geo.addressLine;
      showToast(
        place
          ? `Address from ${geo.source === 'google' ? 'Google Maps' : 'map'}: ${place}`
          : 'Coordinates captured. Address not found for this point.'
      );
    } catch {
      showToast(
        'Coordinates captured, but address lookup failed. You can enter them manually.',
        'error'
      );
    }
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyCoordsAndGeocode(
          Number(pos.coords.latitude.toFixed(6)),
          Number(pos.coords.longitude.toFixed(6))
        );
      },
      (err) => {
        showToast(`Location error: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Activity Submit
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAssignActivities || !id) {
      showToast('You do not have permission to assign activities on this lead', 'error');
      return;
    }
    if (!activityForm.eventDate) {
      showToast('Date & time is required', 'error');
      return;
    }
    setSavingActivity(true);
    try {
      const eventType = activityForm.eventType || 'Call';
      await crmApi.createLeadEvent(id, {
        title: eventType,
        eventType,
        eventDate: new Date(activityForm.eventDate).toISOString(),
        description: '',
        assignedTo: canAssignOthers
          ? activityForm.assignedTo || defaultActivityAssignee || ''
          : currentUserId || defaultActivityAssignee || '',
      });
      const res = await crmApi.getLeadEvents(id);
      setEvents(res.data || []);
      setActivityForm({
        eventType: 'Call',
        eventDate: toLocalDateTimeInputValue(),
        assignedTo: canAssignOthers
          ? defaultActivityAssignee || ''
          : currentUserId || defaultActivityAssignee || '',
      });
      showToast('Activity logged successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to add activity', 'error');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleReassignActivity = async (eventId: string, assignedTo: string) => {
    if (!canAssignActivities || !id) return;
    try {
      await crmApi.updateLeadEvent(id, eventId, { assignedTo });
      const res = await crmApi.getLeadEvents(id);
      setEvents(res.data || []);
      showToast(assignedTo ? 'Activity reassigned' : 'Activity unassigned');
    } catch (err: any) {
      showToast(err.message || 'Failed to reassign activity', 'error');
    }
  };

  // Activity Complete
  const handleCompleteActivity = async (eventId: string) => {
    if (!id) return;
    try {
      await crmApi.completeLeadEvent(id, eventId);
      const res = await crmApi.getLeadEvents(id);
      setEvents(res.data || []);
      showToast('Activity marked completed');
    } catch (err: any) {
      showToast(err.message || 'Failed to complete activity', 'error');
    }
  };

  // Activity Delete
  const handleDeleteActivity = async (eventId: string) => {
    if (!canWrite || !id) return;
    if (!(await confirm({ message: 'Delete this activity?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteLeadEvent(id, eventId);
      setEvents(prev => prev.filter(e => e._id !== eventId));
      showToast('Activity deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete activity', 'error');
    }
  };

  // Notes Save
  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !id) return;
    setSavingNotes(true);
    try {
      const res = await crmApi.updateLead(id, { notes: notesContent.trim() });
      setLead(res.data);
      showToast('Notes saved successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save notes', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  // Follow-up Schedule
  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !followUpForm.dueDate) {
      showToast('Due date is required', 'error');
      return;
    }
    setSavingFollowUp(true);
    try {
      await crmApi.createLeadFollowUp(id, {
        title: followUpForm.title.trim() || 'Follow up',
        dueDate: followUpForm.dueDate,
        notes: followUpForm.notes.trim(),
      });
      const res = await crmApi.getLeadFollowUps(id);
      setFollowUps(res.data || []);
      setFollowUpForm({
        title: 'Follow up',
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        notes: '',
      });
      showToast('Follow-up scheduled successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to schedule follow-up', 'error');
    } finally {
      setSavingFollowUp(false);
    }
  };

  // Follow-up Complete
  const handleCompleteFollowUp = async (followUpId: string) => {
    if (!id) return;
    try {
      await crmApi.completeLeadFollowUp(id, followUpId);
      const res = await crmApi.getLeadFollowUps(id);
      setFollowUps(res.data || []);
      showToast('Follow-up completed');
    } catch (err: any) {
      showToast(err.message || 'Failed to complete follow-up', 'error');
    }
  };

  // Follow-up Delete
  const handleDeleteFollowUp = async (followUpId: string) => {
    if (!canWrite || !id) return;
    if (!(await confirm({ message: 'Delete this follow-up?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteLeadFollowUp(id, followUpId);
      setFollowUps(prev => prev.filter(f => f._id !== followUpId));
      showToast('Follow-up deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete follow-up', 'error');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-zinc-500 font-medium">Loading lead details…</p>
      </div>
    );
  }

  if (loadError || !lead) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-zinc-300 rounded-lg text-center">
        <WarningAmberIcon sx={{ fontSize: 44 }} className="text-red-500 mb-3" />
        <h2 className="text-lg font-bold text-zinc-950 mb-2">Unable to Load Lead</h2>
        <p className="text-sm text-zinc-500 mb-6">{loadError || 'Lead was not found or has been deleted.'}</p>
        <Link
          to="/leads"
          className="inline-flex items-center gap-2 bg-zinc-950 text-white text-xs font-semibold px-4 py-2.5 rounded-lg no-underline hover:bg-zinc-800 transition-colors"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          <span>Back to Leads</span>
        </Link>
      </div>
    );
  }

  const titleString = [lead.salutation, lead.name].filter(Boolean).join(' ') || 'Lead Details';

  return (
    <div className="flex flex-col gap-5 pb-20">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-zinc-950 text-white border-zinc-900'
              : 'bg-red-600 text-white border-red-700'
          }`}
        >
          {toast.type === 'success' ? <CheckCircleOutlineIcon sx={{ fontSize: 18 }} /> : <WarningAmberIcon sx={{ fontSize: 18 }} />}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-zinc-400 hover:text-white bg-transparent border-0 cursor-pointer p-0"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-white border border-zinc-300 rounded-xl px-5 py-6">
        {/* Breadcrumb & Back */}
        <div className="flex items-center gap-3 text-xs text-zinc-400 mb-4 font-medium">
          <Link to="/leads" className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-950 transition-colors no-underline">
            <ArrowBackIcon sx={{ fontSize: 14 }} />
            <span>Leads</span>
          </Link>
          <span>/</span>
          <span className="text-zinc-950 font-semibold truncate max-w-sm">{titleString}</span>
        </div>

        {/* Identity & Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Identity */}
          <div className="flex items-start gap-4">
            {lead.photoUrl ? (
              <img
                src={lead.photoUrl}
                alt={lead.name}
                className="w-16 h-16 rounded-lg object-cover border border-zinc-200 shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-2xl text-zinc-400 shrink-0 select-none">
                <User className="h-8 w-8 shrink-0 text-zinc-400" aria-hidden />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Lead Profile</span>
                {lead.convertedClientId && (
                  <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    Converted Client
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight leading-snug">
                {lead.title?.trim() || titleString}
              </h1>
              {lead.title?.trim() && titleString !== 'Lead Details' && (
                <p className="text-sm text-zinc-500 m-0 mt-0.5">
                  Contact:{' '}
                  {lead.contactId ? (
                    <Link
                      to={`/contacts/${lead.contactId}`}
                      className="text-zinc-800 font-medium underline decoration-zinc-300 hover:decoration-zinc-800"
                    >
                      {titleString}
                    </Link>
                  ) : (
                    <span className="text-zinc-800 font-medium">{titleString}</span>
                  )}
                </p>
              )}

              {/* Meta Chips */}
              <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-zinc-600">
                {!lead.assignedTo && (
                  <span
                    data-testid="lead-unassigned-badge"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded font-semibold"
                  >
                    <WarningAmberIcon sx={{ fontSize: 13 }} />
                    <span>This lead is not assigned</span>
                  </span>
                )}
                {lead.priority && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <span className="text-zinc-400">Priority</span>
                    <span className="text-zinc-900 font-semibold">{lead.priority}</span>
                  </span>
                )}
                {lead.email && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <EmailOutlinedIcon sx={{ fontSize: 13 }} />
                    <span>{lead.email}</span>
                  </span>
                )}
                {lead.phone && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <PhoneIcon sx={{ fontSize: 13 }} />
                    <span>{lead.phone}</span>
                  </span>
                )}
                {lead.company && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <BusinessIcon sx={{ fontSize: 13 }} />
                    <span>{lead.company}</span>
                  </span>
                )}
                {lead.source && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <PublicIcon sx={{ fontSize: 13 }} />
                    <span>{lead.source}</span>
                  </span>
                )}
                {lead.ageing && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 border rounded font-semibold text-xs ${
                      lead.ageing.status === 'Stale'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : lead.ageing.status === 'Attention'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    <AccessTimeIcon sx={{ fontSize: 13 }} />
                    <span>{lead.ageing.stageAgeDays}d in stage · {lead.ageing.totalAgeDays}d total</span>
                  </span>
                )}
                {lead.followUpSummary?.hasOverdue ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-bold text-xs">
                    <span className="inline-flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                      Follow-up Overdue ({lead.followUpSummary.overdueDays}d)
                    </span>
                  </span>
                ) : lead.followUpSummary?.openCount ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-medium text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                      {lead.followUpSummary.openCount} Open Follow-up(s)
                    </span>
                  </span>
                ) : null}
                {Array.isArray(lead.tags) &&
                  lead.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded text-zinc-700 font-medium">
                      <Tag className="h-4 w-4 shrink-0" aria-hidden />
                      {t}
                    </span>
                  ))}
                {!lead.convertedClientId && canWrite && (
                  <button
                    type="button"
                    onClick={() => setShowAddTagModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-dashed border-zinc-300 text-zinc-600 hover:border-zinc-500 rounded text-xs cursor-pointer"
                  >
                    <AddIcon sx={{ fontSize: 12 }} />
                    <span>Tag</span>
                  </button>
                )}
                {lead.dataQuality && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 border border-zinc-300 rounded font-bold text-xs text-zinc-800">
                    Quality {lead.dataQuality.score}/100 · {lead.dataQuality.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!lead.convertedClientId && (
              <>
                {/* Stage Quick Select */}
                {canWrite && (
                <select
                  data-tour="leads-stage-select"
                  value={lead.stage || ''}
                  onChange={(e) => handleQuickStageChange(e.target.value)}
                  className="bg-white border border-zinc-300 text-zinc-800 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer hover:border-zinc-400 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950"
                  title="Change stage directly"
                >
                  {pipelineStages.map((s) => (
                    <option key={s} value={s}>
                      Stage: {s}
                    </option>
                  ))}
                </select>
                )}

                {/* Status Quick Select */}
                {canWrite && (
                <select
                  value={lead.status || 'New'}
                  onChange={(e) => handleQuickStatusChange(e.target.value)}
                  className="bg-zinc-50 border border-zinc-300 text-zinc-800 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer hover:border-zinc-400 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950"
                  title="Change lifecycle status"
                >
                  {leadStatuses.map((st) => (
                    <option key={st} value={st}>
                      Status: {st}
                    </option>
                  ))}
                </select>
                )}

                {/* Convert Button — Won stage only (matches API) */}
                {canConvert && isLeadConvertibleStage(lead.stage, pipelineStages) && (
                <button
                  type="button"
                  data-tour="leads-convert-btn"
                  onClick={() => setShowConvertModal(true)}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer border-0"
                >
                  Convert to Client
                </button>
                )}

                {/* Delete Button */}
                {canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-white hover:bg-red-50 text-red-600 border border-zinc-200 hover:border-red-200 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Delete
                </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div data-tour="leads-detail-tabs" className="mb-1">
        <div className="flex border-b border-zinc-200 overflow-x-auto gap-2">
          <button
            type="button"
            data-tour="leads-tab-details"
            onClick={() => setActiveTab('details')}
            className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
              activeTab === 'details'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Details
          </button>
          {!isTravelLead && (
            <button
              type="button"
              data-tour="leads-tab-qualification"
              onClick={() => setActiveTab('qualification')}
              className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
                activeTab === 'qualification'
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Commercial Requirement
            </button>
          )}
          <button
            type="button"
            data-tour="leads-tab-activities"
            onClick={() => setActiveTab('activities')}
            className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
              activeTab === 'activities'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Activities
          </button>
          <button
            type="button"
            data-tour="leads-tab-notes"
            onClick={() => setActiveTab('notes')}
            className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
              activeTab === 'notes'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Notes
          </button>
          <button
            type="button"
            data-tour="leads-tab-followups"
            onClick={() => setActiveTab('follow-ups')}
            className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
              activeTab === 'follow-ups'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Follow-ups
          </button>
          {extensionLeadTabs.map((tab) => (
            <button
              key={tab.tabId}
              type="button"
              data-tour={`leads-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.tabId)}
              className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
                activeTab === tab.tabId
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {tab.label || tab.title}
            </button>
          ))}
          {showProposalTab && (
            <button
              type="button"
              data-tour="leads-tab-proposal"
              onClick={() => setActiveTab('proposal')}
              className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
                activeTab === 'proposal'
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Proposal
            </button>
          )}
          {showDealTab && (
            <button
              type="button"
              data-tour="leads-tab-deal"
              onClick={() => setActiveTab('deal')}
              className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
                activeTab === 'deal'
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Deal
            </button>
          )}
          {showSamplesTab && (
            <button
              type="button"
              data-tour="leads-tab-samples"
              onClick={() => setActiveTab('samples')}
              className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
                activeTab === 'samples'
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Samples
            </button>
          )}
          <button
            type="button"
            data-tour="leads-tab-audit"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent ${
              activeTab === 'audit'
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Audit History
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        {/* ================= TAB 1: DETAILS ================= */}
        {activeTab === 'details' && (
          <form onSubmit={handleSaveDetails} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Photo Block */}
              <div className="bg-white border border-zinc-300 rounded-lg p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 mb-3">Profile Photo</h3>
                <div className="flex flex-col items-center justify-center p-4 bg-zinc-50 border border-zinc-200 rounded-lg mb-4 text-center">
                  {detailsForm.photoUrl ? (
                    <img
                      src={detailsForm.photoUrl}
                      alt="Preview"
                      className="w-24 h-24 rounded-lg object-cover border border-zinc-200 mb-2"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-zinc-200 border border-zinc-300 flex items-center justify-center text-4xl text-zinc-400 mb-2 select-none">
                      <User className="h-8 w-8 shrink-0 text-zinc-400" aria-hidden />
                    </div>
                  )}
                  <p className="text-[11px] text-zinc-500 m-0">JPG, PNG, WEBP, GIF — max 5MB</p>
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 mb-1 block">Upload image file</span>
                    <FileUploadField
                      accept="image/*"
                      buttonLabel={photoUploading ? 'Uploading…' : 'Choose image'}
                      disabled={photoUploading}
                      clearAfterChange
                      onFileChange={handlePhotoUpload}
                    />
                  </label>
                  {/* <label className="block">
                    <span className="text-xs font-medium text-zinc-700 mb-1 block">Or paste image URL</span>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={detailsForm.photoUrl}
                      onChange={(e) => setDetailsForm({ ...detailsForm, photoUrl: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </label> */}
                </div>
              </div>

              {/* At a Glance */}
              <div className="bg-white border border-zinc-300 rounded-lg p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 mb-3">At a Glance</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded">
                    <span className="text-[11px] text-zinc-400 block font-medium">Stage</span>
                    <strong className="text-zinc-900 font-bold mt-0.5 block">{detailsForm.stage || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded">
                    <span className="text-[11px] text-zinc-400 block font-medium">Owner</span>
                    {detailsForm.assignedTo ? (
                      <strong className="text-zinc-900 font-bold mt-0.5 block">
                        {displayUserLabel(
                          assignableUsers.find((u) => u.id === detailsForm.assignedTo) || lead.assignedToName,
                          lead.assignedUsername || detailsForm.assignedTo,
                          'Team member'
                        )}
                      </strong>
                    ) : (
                      <strong className="text-amber-800 font-semibold mt-0.5 block">
                        This lead is not assigned
                      </strong>
                    )}
                  </div>
                  <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded">
                    <span className="text-[11px] text-zinc-400 block font-medium">Priority</span>
                    <strong className="text-zinc-900 font-bold mt-0.5 block">{detailsForm.priority || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded">
                    <span className="text-[11px] text-zinc-400 block font-medium">Next Follow-up</span>
                    <strong className="text-zinc-900 font-bold mt-0.5 block">{detailsForm.nextFollowUp || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded">
                    <span className="text-[11px] text-zinc-400 block font-medium">Lead Type</span>
                    <strong className="text-zinc-900 font-bold mt-0.5 block">{detailsForm.leadType || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded">
                    <span className="text-[11px] text-zinc-400 block font-medium">Source</span>
                    <strong className="text-zinc-900 font-bold mt-0.5 block">{detailsForm.source || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Data Quality */}
              {lead.dataQuality && (
                <div className="bg-white border border-zinc-300 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 m-0">Data Quality</h3>
                    <span className="text-xs font-bold text-zinc-950">{lead.dataQuality.score} / 100</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 border border-zinc-200 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full ${
                        lead.dataQuality.score >= 80
                          ? 'bg-emerald-500'
                          : lead.dataQuality.score >= 50
                          ? 'bg-blue-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${lead.dataQuality.score}%` }}
                    />
                  </div>
                  {lead.dataQuality.missing && lead.dataQuality.missing.length > 0 ? (
                    <p className="text-[11px] text-zinc-500 m-0 leading-relaxed">
                      Improve quality by adding: <strong className="text-zinc-700">{lead.dataQuality.missing.join(', ')}</strong>
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-700 font-medium m-0 inline-flex items-center gap-1">
                      <Check className="h-4 w-4 shrink-0" aria-hidden />
                      All quality checks are complete.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right Main Form Sections */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Personal Information */}
              <div className="bg-white border border-zinc-300 rounded-lg p-6">
                <h3 className="text-sm font-bold text-zinc-950 mb-1">Personal Information</h3>
                <p className="text-xs text-zinc-500 mb-4">Basic identity details for this prospect.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Salutation</label>
                    <select
                      value={detailsForm.salutation}
                      onChange={(e) => setDetailsForm({ ...detailsForm, salutation: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      {SALUTATIONS.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={detailsForm.name}
                      onChange={(e) => setDetailsForm({ ...detailsForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Job title</label>
                    <input
                      type="text"
                      value={detailsForm.jobTitle}
                      onChange={(e) => setDetailsForm({ ...detailsForm, jobTitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Gender</label>
                    <select
                      value={detailsForm.gender}
                      onChange={(e) => setDetailsForm({ ...detailsForm, gender: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      {GENDERS.map(g => <option key={g} value={g}>{g || '— None —'}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact & Company */}
              <div className="bg-white border border-zinc-300 rounded-lg p-6">
                <h3 className="text-sm font-bold text-zinc-950 mb-1">Contact & Company</h3>
                <p className="text-xs text-zinc-500 mb-4">Communication coordinates and corporate details.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={detailsForm.email}
                      onChange={(e) => setDetailsForm({ ...detailsForm, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Mobile number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={detailsForm.phone}
                      onChange={(e) => setDetailsForm({ ...detailsForm, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                    <span className="text-[11px] text-zinc-400 mt-1 block">7 to 15 digits; country codes accepted.</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Company name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={detailsForm.company}
                      onChange={(e) => setDetailsForm({ ...detailsForm, company: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">PAN number</label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={detailsForm.pan}
                      onChange={(e) => setDetailsForm({ ...detailsForm, pan: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                    <span className="text-[11px] text-zinc-400 mt-1 block">Format: 5 letters, 4 digits, 1 letter.</span>
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-zinc-700">Lead Source</label>
                      <button
                        type="button"
                        onClick={() => setShowAddSourceModal(true)}
                        className="text-[11px] text-zinc-600 hover:text-zinc-950 font-semibold bg-transparent border-0 cursor-pointer p-0"
                      >
                        + Add Source
                      </button>
                    </div>
                    <select
                      value={detailsForm.source}
                      onChange={(e) => setDetailsForm({ ...detailsForm, source: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      <option value="">Select source…</option>
                      {leadSources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Pipeline & Ownership */}
              <div className="bg-white border border-zinc-300 rounded-lg p-6">
                <h3 className="text-sm font-bold text-zinc-950 mb-1">Pipeline & Ownership</h3>
                <p className="text-xs text-zinc-500 mb-4">Stage, status, and account manager assignment.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Pipeline stage</label>
                    <select
                      value={detailsForm.stage}
                      onChange={(e) => setDetailsForm({ ...detailsForm, stage: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      {pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-zinc-700">Lead Status</label>
                      <button
                        type="button"
                        onClick={() => setShowAddStatusModal(true)}
                        className="text-[11px] text-zinc-600 hover:text-zinc-950 font-semibold bg-transparent border-0 cursor-pointer p-0"
                      >
                        + Add Status
                      </button>
                    </div>
                    <select
                      value={detailsForm.status}
                      onChange={(e) => setDetailsForm({ ...detailsForm, status: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      {leadStatuses.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Lead owner</label>
                    {canAssignOthers ? (
                      <>
                        <select
                          value={detailsForm.assignedTo}
                          onChange={(e) => setDetailsForm({ ...detailsForm, assignedTo: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {assignableUsers.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.displayName || u.username} {u.designation ? `(${u.designation})` : ''}
                            </option>
                          ))}
                        </select>
                        {!detailsForm.assignedTo && (
                          <span className="text-[11px] text-amber-700 mt-1 block">
                            This lead is not assigned. Pick an owner and save to assign it.
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded bg-zinc-50 text-zinc-600"
                          value={
                            detailsForm.assignedTo === currentUserId || !detailsForm.assignedTo
                              ? 'You (current user)'
                              : displayUserLabel(
                                  assignableUsers.find((u) => u.id === detailsForm.assignedTo) ||
                                    lead?.assignedToName,
                                  lead?.assignedUsername || detailsForm.assignedTo
                                )
                          }
                          disabled
                          readOnly
                          title="Sales representatives can only assign leads to themselves"
                        />
                        <span className="text-[11px] text-zinc-500 mt-1 block">
                          You can only assign this lead to yourself.
                        </span>
                      </>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-zinc-700">Lead type</label>
                      <button
                        type="button"
                        onClick={() => setShowAddTypeModal(true)}
                        className="text-[11px] text-zinc-600 hover:text-zinc-950 font-semibold bg-transparent border-0 cursor-pointer p-0"
                      >
                        + Add Type
                      </button>
                    </div>
                    <select
                      value={detailsForm.leadType}
                      onChange={(e) => setDetailsForm({ ...detailsForm, leadType: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      <option value="">Select type…</option>
                      {withCurrentOption(leadTypes, detailsForm.leadType).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-zinc-700">Priority</label>
                      <button
                        type="button"
                        onClick={() => setShowAddPriorityModal(true)}
                        className="text-[11px] text-zinc-600 hover:text-zinc-950 font-semibold bg-transparent border-0 cursor-pointer p-0"
                      >
                        + Add Priority
                      </button>
                    </div>
                    <select
                      value={detailsForm.priority}
                      onChange={(e) => setDetailsForm({ ...detailsForm, priority: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      <option value="">Select priority…</option>
                      {withCurrentOption(leadPriorities, detailsForm.priority).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Next follow-up date</label>
                    <input
                      type="date"
                      value={detailsForm.nextFollowUp}
                      onChange={(e) => setDetailsForm({ ...detailsForm, nextFollowUp: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Lead title</label>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="e.g. ERP rollout for Acme Pvt Ltd"
                      value={detailsForm.title}
                      onChange={(e) => setDetailsForm({ ...detailsForm, title: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Request type *
                    </label>
                    <select
                      required
                      value={detailsForm.requestTypeId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const rt = requestTypes.find((item) => item._id === id);
                        setDetailsForm({
                          ...detailsForm,
                          requestTypeId: id,
                          requestType: rt?.name || '',
                        });
                      }}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      <option value="">Select request type…</option>
                      {requestTypes
                        .filter(
                          (rt) =>
                            rt.isEnabled ||
                            rt._id === detailsForm.requestTypeId ||
                            rt.name.toLowerCase() ===
                              detailsForm.requestType.trim().toLowerCase()
                        )
                        .map((rt) => (
                          <option key={rt._id} value={rt._id}>
                            {rt.name}
                            {!rt.isEnabled ? ' (disabled)' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Created by</label>
                    <div className="w-full px-3 py-2 text-xs border border-zinc-200 rounded bg-zinc-50 text-zinc-600">
                      {displayUserLabel(lead.createdByUsername, lead.createdBy, 'System')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Same native extension fields as Create Lead — no Details-tab iframe */}
              {extensionFieldGroups.length ? (
                <ExtensionFieldsSlot
                  groups={
                    canWrite
                      ? extensionFieldGroups
                      : extensionFieldGroups.map((g) => ({
                          ...g,
                          fields: (g.fields || []).map((f) => ({ ...f, readOnly: true })),
                        }))
                  }
                  requestType={detailRequestType}
                  meta={extensionDetailMeta}
                  valuesByExtension={extensionFieldValues}
                  onChange={(extensionId, values) => {
                    if (!canWrite) return;
                    setExtensionFieldValues((prev) => ({
                      ...prev,
                      [extensionId]: values,
                    }));
                  }}
                  sectionClassName="bg-white border border-zinc-300 rounded-lg p-6"
                  titleClassName="text-sm font-bold text-zinc-950 mb-1"
                  inputClassName="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none bg-white text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                />
              ) : null}

              {/* Tags & Segmentation */}
              <div className="bg-white border border-zinc-300 rounded-lg p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-zinc-950">Tags & Segmentation</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddTagModal(true)}
                    className="text-xs text-zinc-600 hover:text-zinc-950 font-semibold bg-transparent border-0 cursor-pointer p-0"
                  >
                    + Add New Tag
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mb-4">Categorize this lead for targeted filtering and campaigns.</p>
                <div className="flex flex-wrap gap-2">
                  {leadTags.map(tag => {
                    const isChecked = detailsForm.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const nextTags = isChecked
                            ? detailsForm.tags.filter(t => t !== tag)
                            : [...detailsForm.tags, tag];
                          setDetailsForm({ ...detailsForm, tags: nextTags });
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer font-medium transition-all ${
                          isChecked
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        <Tag className="h-4 w-4 shrink-0" aria-hidden />
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Attributes — values belong to THIS lead only */}
              {customFieldDefs.length > 0 && (
                <div className="bg-white border border-zinc-300 rounded-lg p-6" data-testid="lead-custom-fields">
                  <h3 className="text-sm font-bold text-zinc-950 mb-1">Custom Attributes</h3>
                  <p className="text-xs text-zinc-500 mb-4">Extra details configured in settings for leads.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customFieldDefs.map((def) => {
                      const raw = customFields[def.key];
                      const fieldCls =
                        'w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none';
                      return (
                        <div key={def.key} className={def.type === 'textarea' ? 'md:col-span-2' : ''}>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            {def.label}
                            {def.required ? ' *' : ''}
                          </label>
                          {def.type === 'boolean' ? (
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
                              <input
                                type="checkbox"
                                checked={Boolean(raw)}
                                disabled={!canWrite}
                                onChange={(e) =>
                                  setCustomFields((prev) => ({ ...prev, [def.key]: e.target.checked }))
                                }
                              />
                              {raw ? 'Yes' : 'No'}
                            </label>
                          ) : def.type === 'select' ? (
                            <select
                              className={fieldCls}
                              value={String(raw ?? '')}
                              disabled={!canWrite}
                              onChange={(e) =>
                                setCustomFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                              }
                            >
                              <option value="">Select…</option>
                              {withCurrentOption(def.options || [], String(raw ?? '')).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : def.type === 'textarea' ? (
                            <textarea
                              className={`${fieldCls} min-h-[72px]`}
                              value={String(raw ?? '')}
                              disabled={!canWrite}
                              onChange={(e) =>
                                setCustomFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                              }
                            />
                          ) : (
                            <input
                              className={fieldCls}
                              type={
                                ['number', 'date', 'email', 'url'].includes(def.type) ? def.type : 'text'
                              }
                              value={raw === undefined || raw === null ? '' : String(raw)}
                              disabled={!canWrite}
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Location Coordinates */}
              <div className="bg-white border border-zinc-300 rounded-lg p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-zinc-950">Location & Coordinates</h3>
                  <button
                    type="button"
                    onClick={handleCaptureLocation}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-100 px-3 py-1.5 border border-zinc-300 rounded cursor-pointer transition-colors"
                  >
                    <MyLocationIcon sx={{ fontSize: 14 }} />
                    <span>Use my current location</span>
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mb-4">
                  Search Google Maps, click the map, or use your current location.
                </p>

                {/* Google Places search bound to Google Map (not Leaflet) */}
                <div className="w-full mb-4">
                  <LeadLocationMap
                    showSearch={canWrite}
                    readOnly={!canWrite}
                    latitude={detailsForm.latitude}
                    longitude={detailsForm.longitude}
                    address={detailsForm.address}
                    onPlaceSelect={(place) => {
                      setDetailsForm((prev) => ({
                        ...prev,
                        address: place.address,
                        city: place.city || prev.city,
                        state: place.state || prev.state,
                        country: place.country || prev.country,
                        postalCode: place.postcode || prev.postalCode,
                        placeId: place.placeId || prev.placeId,
                        latitude: place.lat,
                        longitude: place.lng,
                      }));
                      showToast(
                        [place.city, place.state].filter(Boolean).join(', ')
                          ? `Address selected: ${[place.city, place.state].filter(Boolean).join(', ')}`
                          : 'Address selected from Google Maps'
                      );
                    }}
                    onChange={(lat, lng) => {
                      setDetailsForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                    }}
                    height="260px"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Address</label>
                    <textarea
                      rows={2}
                      value={detailsForm.address}
                      onChange={(e) =>
                        setDetailsForm({ ...detailsForm, address: e.target.value, placeId: '' })
                      }
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">City</label>
                    <input
                      type="text"
                      maxLength={120}
                      value={detailsForm.city}
                      onChange={(e) => setDetailsForm({ ...detailsForm, city: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">State</label>
                    <input
                      type="text"
                      maxLength={120}
                      value={detailsForm.state}
                      onChange={(e) => setDetailsForm({ ...detailsForm, state: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Country</label>
                    <input
                      type="text"
                      maxLength={120}
                      value={detailsForm.country}
                      onChange={(e) => setDetailsForm({ ...detailsForm, country: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      maxLength={32}
                      value={detailsForm.postalCode}
                      onChange={(e) => setDetailsForm({ ...detailsForm, postalCode: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Latitude</label>
                    <input
                      type="text"
                      readOnly
                      aria-readonly="true"
                      tabIndex={-1}
                      value={
                        detailsForm.latitude === ''
                          ? ''
                          : Number(detailsForm.latitude).toFixed(6)
                      }
                      placeholder="Set from map"
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded bg-zinc-50 text-zinc-600 font-mono cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Longitude</label>
                    <input
                      type="text"
                      readOnly
                      aria-readonly="true"
                      tabIndex={-1}
                      value={
                        detailsForm.longitude === ''
                          ? ''
                          : Number(detailsForm.longitude).toFixed(6)
                      }
                      placeholder="Set from map"
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded bg-zinc-50 text-zinc-600 font-mono cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Documents & Collateral */}
              <div className="bg-white border border-zinc-300 rounded-lg p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-zinc-950">Documents & Attachments</h3>
                  <span className="text-[11px] text-zinc-400">{storageStatusHint}</span>
                </div>
                <p className="text-xs text-zinc-500 mb-4">
                  Attach PDF, Word, Excel, PowerPoint, Markdown, text, CSV, RTF, or images (max 20MB).
                  Preview is available for PDF and images.
                </p>

                {/* Visiting Card Showcase */}
                {(() => {
                  const cardUrl =
                    attachments.find((a) => a.category === 'visiting-card')?.fileUrl ||
                    lead.visitingCardUrl;
                  if (!cardUrl) return null;
                  return (
                    <div className="mb-4 p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/40">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="relative group w-20 h-14 rounded-md overflow-hidden border border-zinc-200 bg-zinc-100 shrink-0 cursor-pointer shadow-2xs"
                            onClick={() =>
                              setPreviewDoc({
                                url: cardUrl,
                                name: 'Scanned Visiting Card',
                                mimeType: 'image/jpeg',
                              })
                            }
                            title="Click to preview visiting card"
                          >
                            <img
                              src={cardUrl}
                              alt="Visiting Card"
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <VisibilityOutlinedIcon sx={{ fontSize: 16 }} className="text-white" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                Visiting Card
                              </span>
                              <span className="text-xs text-zinc-400">Captured via OCR Vision</span>
                            </div>
                            <p className="text-xs text-zinc-600 mt-1 truncate">
                              Visiting card image stored securely. Click preview to inspect card details.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                url: cardUrl,
                                name: 'Scanned Visiting Card',
                                mimeType: 'image/jpeg',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-100 rounded border border-zinc-300 shadow-2xs cursor-pointer"
                          >
                            <VisibilityOutlinedIcon sx={{ fontSize: 14 }} />
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await downloadAttachment(cardUrl, 'visiting-card.jpg');
                                showToast('Download started');
                              } catch (err: any) {
                                showToast(err.message || 'Download failed', 'error');
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-100 rounded border border-zinc-300 shadow-2xs cursor-pointer"
                          >
                            <DownloadOutlinedIcon sx={{ fontSize: 14 }} />
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Upload Picker */}
                <div className="mb-4">
                  <DocumentUploadControl
                    mode="button"
                    buttonLabel="Choose file"
                    uploadButtonLabel="Upload document"
                    accept={LEAD_DOC_ACCEPT}
                    disabled={docUploading || !canWrite || Boolean(lead.convertedClientId)}
                    hint="Select a file, then click Upload document"
                    uploadFn={async (file) => {
                      if (!id) throw new Error('Lead id is missing');
                      await crmApi.uploadLeadAttachment(id, file);
                      return {
                        url: '',
                        fileUrl: '',
                        fileName: file.name,
                        mimeType: file.type,
                        fileSize: file.size,
                      };
                    }}
                    onUploaded={async () => {
                      if (!id) return;
                      const res = await crmApi.getLeadAttachments(id);
                      setAttachments(res.data || []);
                      showToast('Document uploaded successfully');
                    }}
                    onError={(msg) => showToast(msg, 'error')}
                  />
                </div>

                {/* Documents Table */}
                {attachments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-400 bg-zinc-50 border border-dashed border-zinc-200 rounded-lg">
                    No documents uploaded yet.
                  </div>
                ) : (
                  <div className="border border-zinc-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">File document</th>
                          <th className="py-2.5 px-4 font-semibold">File size</th>
                          <th className="py-2.5 px-4 font-semibold">Uploaded</th>
                          <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {attachments.map((att) => {
                          const canPreview = Boolean(
                            resolvePreviewKind(att.mimeType, att.originalName || att.fileName)
                          );
                          const isImageOrCard =
                            att.mimeType?.startsWith('image/') ||
                            att.category === 'visiting-card' ||
                            att.category === 'photo';
                          return (
                          <tr key={att._id} className="hover:bg-zinc-50 transition-colors">
                            <td className="py-3 px-4 font-medium text-zinc-900 flex items-center gap-2.5">
                              {isImageOrCard ? (
                                <img
                                  src={att.fileUrl}
                                  alt={att.originalName || att.fileName}
                                  className="w-7 h-7 object-cover rounded border border-zinc-200 shrink-0 cursor-pointer hover:opacity-80"
                                  onClick={() =>
                                    setPreviewDoc({
                                      url: att.fileUrl,
                                      name: att.originalName || att.fileName,
                                      mimeType: att.mimeType,
                                    })
                                  }
                                />
                              ) : (
                                <InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} className="text-zinc-400 shrink-0" />
                              )}
                              <div className="min-w-0 flex items-center gap-2">
                                <a
                                  href={att.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline truncate max-w-xs"
                                >
                                  {att.originalName || att.fileName}
                                </a>
                                {att.category === 'visiting-card' && (
                                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Visiting Card
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-zinc-500">
                              {(att.fileSize / 1024).toFixed(1)} KB
                            </td>
                            <td className="py-3 px-4 text-zinc-500">
                              {new Date(att.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                {canPreview && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDoc({
                                        url: att.fileUrl,
                                        name: att.originalName || att.fileName,
                                        mimeType: att.mimeType,
                                      })
                                    }
                                    className="text-zinc-700 hover:text-zinc-950 bg-transparent border-0 cursor-pointer p-1"
                                    title="Preview"
                                  >
                                    <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await downloadAttachment(
                                        att.fileUrl,
                                        att.originalName || att.fileName || 'document'
                                      );
                                      showToast('Download started');
                                    } catch (err: any) {
                                      showToast(err.message || 'Download failed', 'error');
                                    }
                                  }}
                                  className="text-zinc-700 hover:text-zinc-950 bg-transparent border-0 cursor-pointer p-1"
                                  title="Download"
                                >
                                  <DownloadOutlinedIcon sx={{ fontSize: 16 }} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDoc(att._id)}
                                  className="text-red-600 hover:text-red-800 bg-transparent border-0 cursor-pointer p-1"
                                  title="Delete document"
                                  hidden={!canWrite || Boolean(lead.convertedClientId)}
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {canWrite && !lead.convertedClientId && (
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-6 py-2.5 rounded-lg cursor-pointer transition-colors border-0 disabled:opacity-50"
                >
                  {savingDetails ? 'Saving details…' : 'Save Details'}
                </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* ================= TAB 2: COMMERCIAL REQUIREMENT ================= */}
        {!isTravelLead && activeTab === 'qualification' && id && lead && (
          <CommercialRequirementTab
            leadId={id}
            lead={lead}
            canWrite={canWrite}
            showToast={showToast}
            onSaved={setLead}
          />
        )}

        {/* ================= TAB 3: ACTIVITIES ================= */}
        {activeTab === 'activities' && (
          <div className="flex flex-col gap-6">
            {/* Add Activity Form — requires lead write permission; assignees exclude clients */}
            {canAssignActivities && !lead.convertedClientId && (
              <form onSubmit={handleAddActivity} className="bg-white border border-zinc-300 rounded-lg p-6">
                <h3 className="text-sm font-bold text-zinc-950 mb-1">Log New Activity</h3>
                <p className="text-xs text-zinc-500 mb-4">
                  Record phone calls, product demos, emails, or meetings. Sales managers and lead
                  editors can assign the activity to an employee or sales representative (clients
                  cannot be assigned).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Type</label>
                    <select
                      value={activityForm.eventType}
                      onChange={(e) => setActivityForm({ ...activityForm, eventType: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Date & time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={activityForm.eventDate}
                      onChange={(e) => setActivityForm({ ...activityForm, eventDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Assign to</label>
                    {canAssignOthers ? (
                      <select
                        value={activityForm.assignedTo}
                        onChange={(e) => setActivityForm({ ...activityForm, assignedTo: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {activityAssignees.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName || u.username || u.name}
                            {u.designation ? ` (${u.designation})` : ''}
                            {u.id === defaultActivityAssignee ? ' — Lead owner' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded bg-zinc-50 text-zinc-600"
                        value="You (current user)"
                        disabled
                        readOnly
                        title="Sales representatives can only assign activities to themselves"
                      />
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingActivity}
                    className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors border-0 disabled:opacity-50"
                  >
                    {savingActivity ? 'Adding…' : 'Add Activity'}
                  </button>
                </div>
              </form>
            )}

            {/* Activities List */}
            <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 m-0">Activity History</h4>
                <span className="text-xs text-zinc-500 font-medium">{events.length} record(s)</span>
              </div>
              {events.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">No activities logged yet for this lead.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Title</th>
                      <th className="py-2.5 px-4 font-semibold">Type</th>
                      <th className="py-2.5 px-4 font-semibold">Date & time</th>
                      <th className="py-2.5 px-4 font-semibold">Assigned to</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {events.map((ev) => (
                      <React.Fragment key={ev._id}>
                        <tr className="hover:bg-zinc-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-zinc-950">{ev.title}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[11px] font-medium text-zinc-700">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                                {ev.eventType}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-zinc-600">
                            {new Date(ev.eventDate || ev.date || Date.now()).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-zinc-700">
                            {canAssignActivities && canAssignOthers && ev.status === 'Open' ? (
                              <select
                                value={ev.assignedTo || ''}
                                onChange={(e) => void handleReassignActivity(ev._id, e.target.value)}
                                className="h-8 max-w-[180px] px-2 text-[11px] border border-zinc-200 rounded-lg bg-white"
                              >
                                <option value="">Unassigned</option>
                                {activityAssignees.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.displayName || u.username || u.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[11px] font-medium">
                                {ev.assignedToLabel ||
                                  ev.assignedToName ||
                                  (() => {
                                    const match = ev.assignedTo
                                      ? assignableUsers.find((u) => u.id === ev.assignedTo)
                                      : undefined;
                                    return match
                                      ? match.displayName || match.username || match.name || 'Team member'
                                      : ev.assignedTo
                                        ? 'Team member'
                                        : 'Unassigned';
                                  })()}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                ev.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}
                            >
                              {ev.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canWrite && ev.status === 'Open' && (
                                <button
                                  type="button"
                                  onClick={() => handleCompleteActivity(ev._id)}
                                  className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Complete
                                </button>
                              )}
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteActivity(ev._id)}
                                  className="text-red-600 hover:text-red-800 bg-transparent border-0 cursor-pointer p-1"
                                  title="Delete activity"
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {ev.description && (
                          <tr className="bg-zinc-50">
                            <td colSpan={5} className="px-4 py-2 text-zinc-600 text-[11px] border-b border-zinc-200">
                              {ev.description}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: NOTES ================= */}
        {activeTab === 'notes' && (
          <div className="flex flex-col gap-6">
            {lead.notes && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">Saved Notes</span>
                <p className="text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed m-0 font-normal">{lead.notes}</p>
              </div>
            )}

            {!lead.convertedClientId && (
              <form onSubmit={handleSaveNotes} className="bg-white border border-zinc-300 rounded-lg p-6">
                <h3 className="text-sm font-bold text-zinc-950 mb-1">
                  {lead.notes ? 'Update Lead Notes' : 'Add Lead Notes'}
                </h3>
                <p className="text-xs text-zinc-500 mb-4">Record context, call memos, internal briefings, and next steps.</p>
                <div className="mb-4">
                  <textarea
                    rows={8}
                    maxLength={2000}
                    placeholder="Write detailed notes regarding this prospect…"
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    className="w-full px-3.5 py-3 text-xs border border-zinc-200 rounded-lg focus:border-zinc-950 focus:outline-none font-normal leading-relaxed"
                  />
                  <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
                    <span>Formatted plain text</span>
                    <span>{notesContent.length} / 2000</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNotes}
                    className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg cursor-pointer transition-colors border-0 disabled:opacity-50"
                  >
                    {savingNotes ? 'Saving notes…' : 'Save Notes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ================= TAB 5: FOLLOW-UPS ================= */}
        {activeTab === 'follow-ups' && (
          <div className="flex flex-col gap-6">
            {!lead.convertedClientId && (
              <form onSubmit={handleScheduleFollowUp} className="bg-white border border-zinc-300 rounded-lg p-6">
                <h3 className="text-sm font-bold text-zinc-950 mb-1">Schedule Follow-up</h3>
                <p className="text-xs text-zinc-500 mb-4">Set automated reminder for next touchpoint or check-in date.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Follow-up title</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={followUpForm.title}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, title: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Due date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={followUpForm.dueDate}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, dueDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Inquire about executive board decision and quotation review"
                      value={followUpForm.notes}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingFollowUp}
                    className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors border-0 disabled:opacity-50"
                  >
                    {savingFollowUp ? 'Scheduling…' : 'Schedule Follow-up'}
                  </button>
                </div>
              </form>
            )}

            {/* Follow-ups List */}
            <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 m-0">Scheduled Follow-ups</h4>
                <span className="text-xs text-zinc-500 font-medium">{followUps.length} record(s)</span>
              </div>
              {followUps.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">No follow-ups scheduled for this lead.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Title</th>
                      <th className="py-2.5 px-4 font-semibold">Due date</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Notes</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {followUps.map((fu) => (
                      <tr key={fu._id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-zinc-950">{fu.title}</td>
                        <td className="py-3 px-4 text-zinc-600">
                          {new Date(fu.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              fu.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {fu.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-500 max-w-xs truncate">{fu.notes || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {fu.status === 'Open' && (
                              <button
                                type="button"
                                onClick={() => handleCompleteFollowUp(fu._id)}
                                className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Complete
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteFollowUp(fu._id)}
                              className="text-red-600 hover:text-red-800 bg-transparent border-0 cursor-pointer p-1"
                              title="Delete follow-up"
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </button>
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

        {/* ================= TAB: PROPOSAL (Qualified and later stages) ================= */}
        {extensionLeadTabs.map((tab) => {
          if (!id) return null;
          if (tab.id === 'travel-requirement' || tab.tabId.includes('travel-requirement')) {
            if (activeTab !== tab.tabId) return null;
            return (
              <LeadTravelRequirementTab
                key={tab.tabId}
                leadId={id}
                lead={lead}
                onUpdated={() => void loadLeadData()}
              />
            );
          }
          return (
            <ExtensionTab
              key={tab.tabId}
              active={activeTab === tab.tabId}
              leadId={id}
              extension={
                lead?.extension && typeof lead.extension === 'object' ? lead.extension : {}
              }
              tab={tab}
              extensionPageUrl={extensionPageUrl}
              onExtensionSynced={handleExtensionEmbedSynced}
              minHeight="42rem"
            />
          );
        })}

        {activeTab === 'proposal' && showProposalTab && (
          <div className="flex flex-col gap-5">
            <div className="bg-white border border-zinc-300 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 m-0">Proposals & Quotations</h3>
                <p className="text-xs text-zinc-500 m-0 mt-1">
                  Quotations linked to this qualified lead. Create a new quotation and return here with
                  Back.
                </p>
              </div>
              {canWriteQuotations && !lead.convertedClientId && (
                <button
                  type="button"
                  data-tour="leads-proposal-create"
                  onClick={() => {
                    const returnTo = encodeURIComponent(`/leads/${id}?tab=proposal`);
                    navigate(`/quotations/create?leadId=${encodeURIComponent(String(id))}&returnTo=${returnTo}`);
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer hover:bg-zinc-800"
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                  Create Quotation
                </button>
              )}
            </div>

            <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 m-0">
                  Quotation list
                </h4>
                <span className="text-xs text-zinc-500 font-medium">
                  {loadingQuotations ? 'Loading…' : `${quotations.length} quotation(s)`}
                </span>
              </div>
              {!canReadQuotations ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  You do not have permission to view quotations.
                </div>
              ) : loadingQuotations ? (
                <div className="p-8 text-center text-xs text-zinc-400">Loading quotations…</div>
              ) : quotations.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No quotations yet for this lead.
                  {canWriteQuotations ? ' Click Create Quotation to add one.' : ''}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Number</th>
                      <th className="py-2.5 px-4 font-semibold">Title</th>
                      <th className="py-2.5 px-4 font-semibold">Issue date</th>
                      <th className="py-2.5 px-4 font-semibold">Valid till</th>
                      <th className="py-2.5 px-4 font-semibold">Amount</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {quotations.map((q) => (
                      <tr key={q._id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-zinc-950">
                          {displayLabel(q.quotationNo, q.quotationNumber, q.number) || '—'}
                        </td>
                        <td className="py-3 px-4 text-zinc-700">{q.title || '—'}</td>
                        <td className="py-3 px-4 text-zinc-600">
                          {q.issueDate ? new Date(q.issueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-zinc-600">
                          {q.validTill || q.expiryDate
                            ? new Date(q.validTill || q.expiryDate || '').toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-zinc-900">
                          {formatFinanceMoney(q.grandTotal, q.currency)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${quotationStatusClass(
                              String(q.status || '')
                            )}`}
                          >
                            {q.status || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/quotations/${q._id}`}
                            className="text-[11px] font-semibold text-zinc-700 no-underline hover:text-zinc-950"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB: DEAL (Qualified and later stages) ================= */}
        {activeTab === 'deal' && showDealTab && (
          <div className="flex flex-col gap-5">
            <div className="bg-white border border-zinc-300 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 m-0">Deals & Opportunities</h3>
                <p className="text-xs text-zinc-500 m-0 mt-1">
                  Opportunities linked to this qualified lead. Create a new opportunity and return here
                  with Back.
                </p>
              </div>
              {canWriteOpportunities && (
                <button
                  type="button"
                  data-tour="leads-deal-create"
                  onClick={() => {
                    const returnTo = encodeURIComponent(`/leads/${id}?tab=deal`);
                    navigate(
                      `/opportunities/create?leadId=${encodeURIComponent(String(id))}&returnTo=${returnTo}`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer hover:bg-zinc-800"
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                  Create Opportunity
                </button>
              )}
            </div>

            <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 m-0">
                  Opportunity list
                </h4>
                <span className="text-xs text-zinc-500 font-medium">
                  {loadingOpportunities ? 'Loading…' : `${opportunities.length} deal(s)`}
                </span>
              </div>
              {!canReadOpportunities ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  You do not have permission to view opportunities.
                </div>
              ) : loadingOpportunities ? (
                <div className="p-8 text-center text-xs text-zinc-400">Loading opportunities…</div>
              ) : opportunities.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No opportunities yet for this lead.
                  {canWriteOpportunities ? ' Click Create Opportunity to add one.' : ''}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Number</th>
                      <th className="py-2.5 px-4 font-semibold">Title</th>
                      <th className="py-2.5 px-4 font-semibold">Stage</th>
                      <th className="py-2.5 px-4 font-semibold">Expected close</th>
                      <th className="py-2.5 px-4 font-semibold">Revenue</th>
                      <th className="py-2.5 px-4 font-semibold">Owner</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {opportunities.map((opp) => (
                      <tr key={opp._id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-zinc-950">
                          {displayLabel(opp.opportunityNumber) || '—'}
                        </td>
                        <td className="py-3 px-4 text-zinc-700">{opp.title || '—'}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
                            {opp.stage || '—'}
                            {opp.probability != null ? ` (${opp.probability}%)` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600">
                          {opp.expectedCloseDate
                            ? new Date(opp.expectedCloseDate).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-zinc-900">
                          {formatFinanceMoney(
                            opp.expectedRevenue ?? opp.value ?? 0,
                            opp.currency || getRuntimeDefaultCurrency()
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-600">
                          {displayUserLabel(opp.salesOwnerName, opp.salesOwner) || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/opportunities/${opp._id}`}
                            className="text-[11px] font-semibold text-zinc-700 no-underline hover:text-zinc-950"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB: SAMPLES (Qualified / Proposal Sent / Won and later) ================= */}
        {activeTab === 'samples' && showSamplesTab && (
          <div className="flex flex-col gap-5">
            <div className="bg-white border border-zinc-300 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 m-0">Sample Requests</h3>
                <p className="text-xs text-zinc-500 m-0 mt-1">
                  Samples linked to this qualified lead. Available from Qualified, Proposal Sent, and Won
                  stages.
                </p>
              </div>
              {canWriteSamples && (
                <button
                  type="button"
                  data-tour="leads-samples-create"
                  onClick={() => {
                    const returnTo = encodeURIComponent(`/leads/${id}?tab=samples`);
                    navigate(
                      `/samples/create?leadId=${encodeURIComponent(String(id))}&returnTo=${returnTo}`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer hover:bg-zinc-800"
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                  Request Sample
                </button>
              )}
            </div>

            <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 m-0">
                  Sample list
                </h4>
                <span className="text-xs text-zinc-500 font-medium">
                  {loadingSamples ? 'Loading…' : `${samples.length} sample(s)`}
                </span>
              </div>
              {!canReadSamples ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  You do not have permission to view samples.
                </div>
              ) : loadingSamples ? (
                <div className="p-8 text-center text-xs text-zinc-400">Loading samples…</div>
              ) : samples.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No sample requests yet for this lead.
                  {canWriteSamples ? ' Click Request Sample to add one.' : ''}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Number</th>
                      <th className="py-2.5 px-4 font-semibold">Product</th>
                      <th className="py-2.5 px-4 font-semibold">Qty</th>
                      <th className="py-2.5 px-4 font-semibold">Urgency</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Created</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {samples.map((sample) => (
                      <tr key={sample._id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-zinc-950">
                          {sample.sampleNumber || '—'}
                        </td>
                        <td className="py-3 px-4 text-zinc-700">{sample.productName || '—'}</td>
                        <td className="py-3 px-4 text-zinc-600">
                          {sample.quantity} {sample.unit || ''}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sampleUrgencyTone(
                              String(sample.urgency || '')
                            )}`}
                          >
                            {sampleUrgencyEmoji(String(sample.urgency || ''))} {sample.urgency || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sampleStatusTone(
                              String(sample.status || '')
                            )}`}
                          >
                            {sample.status || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600">
                          {sample.createdAt
                            ? new Date(sample.createdAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/samples?search=${encodeURIComponent(sample.sampleNumber || sample._id)}`}
                            className="text-[11px] font-semibold text-zinc-700 no-underline hover:text-zinc-950"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 6: AUDIT HISTORY ================= */}
        {activeTab === 'audit' && (
          <div>
            <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 m-0">Audit Trail</h4>
                <span className="text-xs text-zinc-500 font-medium">{auditEntries.length} log entry(s)</span>
              </div>
              {auditEntries.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">No audit log entries recorded for this lead yet.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Date & time</th>
                      <th className="py-2.5 px-4 font-semibold">User</th>
                      <th className="py-2.5 px-4 font-semibold">Action</th>
                      <th className="py-2.5 px-4 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {auditEntries.map((aud) => (
                      <tr key={aud._id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                          {new Date(aud.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-zinc-800">
                          {aud.username && !/^[0-9a-fA-F]{24}$/.test(aud.username) ? aud.username : 'User'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[11px] font-medium text-zinc-700">
                            {aud.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600">{aud.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: ADD SOURCE ================= */}
      <AddLeadItemModal
        open={showAddSourceModal}
        title="Add New Lead Source"
        subtitle="Create an acquisition source for tracking lead origin."
        label="Source Name *"
        placeholder="e.g. Billboard, Radio Ad, Partner"
        submitLabel="Save Source"
        onClose={() => setShowAddSourceModal(false)}
        onSubmit={async (name) => {
          await crmApi.addLeadSource(name);
          if (!leadSources.includes(name)) {
            setLeadSources([...leadSources, name]);
          }
          setDetailsForm((prev) => ({ ...prev, source: name }));
          showToast('Source created and selected');
        }}
      />

      {/* ================= MODAL: ADD STATUS ================= */}
      <AddLeadItemModal
        open={showAddStatusModal}
        title="Add New Lead Status"
        subtitle="Define a custom lifecycle status for tracking leads."
        label="Status Name *"
        placeholder="e.g. Nurturing, Meeting Scheduled"
        submitLabel="Save Status"
        onClose={() => setShowAddStatusModal(false)}
        onSubmit={async (name) => {
          await crmApi.addLeadStatus(name);
          if (!leadStatuses.includes(name)) {
            setLeadStatuses([...leadStatuses, name]);
          }
          setDetailsForm((prev) => ({ ...prev, status: name }));
          showToast('Status created and selected');
        }}
      />

      {/* ================= MODAL: ADD TYPE ================= */}
      <AddLeadItemModal
        open={showAddTypeModal}
        title="Add New Lead Type"
        subtitle="Create a lead type to classify how this lead was generated."
        label="Type Name *"
        placeholder="e.g. Tender, Channel Partner"
        submitLabel="Save Type"
        onClose={() => setShowAddTypeModal(false)}
        onSubmit={async (name) => {
          await crmApi.addLeadType(name);
          setLeadTypes((prev) => (prev.includes(name) ? prev : [...prev, name]));
          setDetailsForm((prev) => ({ ...prev, leadType: name }));
          showToast('Lead type created and selected');
        }}
      />

      {/* ================= MODAL: ADD PRIORITY ================= */}
      <AddLeadItemModal
        open={showAddPriorityModal}
        title="Add New Lead Priority"
        subtitle="Define an urgency level for prioritising leads."
        label="Priority Name *"
        placeholder="e.g. Critical, Nice to have"
        submitLabel="Save Priority"
        onClose={() => setShowAddPriorityModal(false)}
        onSubmit={async (name) => {
          await crmApi.addLeadPriority(name);
          setLeadPriorities((prev) => (prev.includes(name) ? prev : [...prev, name]));
          setDetailsForm((prev) => ({ ...prev, priority: name }));
          showToast('Priority created and selected');
        }}
      />

      {/* ================= MODAL: ADD TAG ================= */}
      <AddLeadItemModal
        open={showAddTagModal}
        title="Add & Assign Tag"
        subtitle="Create a tag for labeling and segmenting leads."
        label="Tag Name *"
        placeholder="e.g. High Priority, VIP, Inbound"
        submitLabel="Add & Assign"
        onClose={() => setShowAddTagModal(false)}
        onSubmit={async (name) => {
          await handleQuickAddTag(name);
        }}
      />

      {/* ================= MODAL: CONVERT TO CLIENT ================= */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-300 rounded-lg max-w-md w-full p-6">
            <h3 className="text-base font-bold text-zinc-950 mb-2">Convert Lead to Client</h3>
            <p className="text-xs text-zinc-600 mb-6 leading-relaxed">
              Converting <strong>{lead.name}</strong> will create a new corporate Client record from this lead profile. Pipeline history and contacts will remain linked.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded border border-zinc-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvertLead}
                className="px-4 py-2 text-xs bg-zinc-950 hover:bg-zinc-800 text-white rounded font-semibold cursor-pointer border-0"
              >
                Convert Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE LEAD ================= */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-300 rounded-lg max-w-md w-full p-6">
            <h3 className="text-base font-bold text-red-600 mb-2">Delete Lead</h3>
            <p className="text-xs text-zinc-600 mb-6 leading-relaxed">
              Delete <strong>{lead.title?.trim() || lead.name}</strong>? The lead will be removed from your lists and
              boards (soft delete). Its history, events, notes, and follow-ups are retained for audit purposes.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded border border-zinc-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLead}
                className="px-4 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer border-0"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <AttachmentPreviewModal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        url={previewDoc?.url || ''}
        name={previewDoc?.name}
        mimeType={previewDoc?.mimeType}
      />
    </div>
  );
};

