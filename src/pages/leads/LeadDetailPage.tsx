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
  CalendarClock,
  Check,
  CheckCircle2,
  MapPin,
  Sparkles,
  Tag,
  User,
} from 'lucide-react';

import { crmApi } from '../../services/api';
import { isLeadConvertibleStage, resolveWonStage } from '../../utils/leadPipeline';
import { displayLabel, displayUserLabel } from '../../utils/displayLabels';
import { reverseGeocode } from '../../utils/reverseGeocode';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { canAssignToOtherUsers, canChangeLeadStage } from '../../utils/permissions';
import { LeadLocationMap } from '../../components/leads/LeadLocationMap';
import { AddLeadItemModal } from '../../components/leads/AddLeadItemModal';
import { CommercialRequirementTab } from '../../components/leads/CommercialRequirementTab';
import {
  InterestedOpportunityModal,
  type ConvertBudgetContext,
} from '../../components/leads/InterestedOpportunityModal';
import { LeadPortalAccessButton } from '../../components/leads/LeadPortalAccess';
import {
  GoogleMapLocationPickerModal,
  type LocationCoordinates,
} from '../../components/common/GoogleMapLocationPickerModal';
import { captureActivityLocation, describeLocation, mapsLinkFor } from '../../utils/captureActivityLocation';
import { activityDisplayStatus, activityStatusClass } from '../../utils/activityStatus';
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
import { PhoneNumberField } from '../../components/common/PhoneNumberField';
import { splitPhoneNumber, validateNationalNumber } from '../../utils/phoneCountryCodes';
import {
  LeadItem,
  LeadEvent,
  ActivityLocation,
  LeadNote,
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
/** "21 Oct 2026, 14:35" — the date and time a note was saved. */
function formatNoteStamp(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Fallback when the tenant has not configured activity types yet. */
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
  'proposal',
  'deal',
  'samples',
  'audit',
];

function resolveLeadTab(raw: string | null): DetailTab {
  const value = String(raw || '').trim();
  const lower = value.toLowerCase();
  if (lower === 'deals' || lower === 'opportunity' || lower === 'opportunities') return 'deal';
  if (lower === 'sample' || lower === 'sample-requests') return 'samples';
  if (value.startsWith('ext__')) return value;
  if (LEAD_TABS.includes(lower)) return lower as DetailTab;
  return 'details';
}

export const LeadDetailPage: React.FC = () => {
  const { confirm } = useDialog();
  const { hasPermission, isClient, activeRole, user, isAdmin } = useAuth();
  const {
    leadTabsForRequestType,
    createFieldsForRequestType,
    extensionPageUrl,
  } = useExtensions();
  const settingsCurrency = useDefaultCurrency();
  const canWrite = hasPermission('crm.leads.write') && !isClient;
  /** Only a manager moves the lead along the pipeline by hand. */
  const canChangeStage = canWrite && canChangeLeadStage({ isAdmin, isClient, activeRole });
  const stageLockedHint =
    'Only a CRM manager or sales manager can change the lead stage';
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
  /** Settings → Qualification Match: ask to move to Qualified after a requirement save. */
  const [askQualifyOnRequirementSave, setAskQualifyOnRequirementSave] = useState(false);
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
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [auditEntries, setAuditEntries] = useState<LeadAuditEntry[]>([]);
  /** Set when the audit trail could not be loaded (e.g. no permission). */
  const [auditError, setAuditError] = useState('');
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
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [goalLocation, setGoalLocation] = useState<LocationCoordinates | null>(null);
  const [editingEventForGoal, setEditingEventForGoal] = useState<LeadEvent | null>(null);
  const [activityForm, setActivityForm] = useState({
    eventType: 'Call',
    eventDate: toLocalDateTimeInputValue(),
    assignedTo: '',
    note: '',
  });
  const [activityCreationMode, setActivityCreationMode] = useState<'current' | 'scheduled'>('current');
  const isMeetingOrFollowUp = /^(meeting|follow[\s-_]?up)$/i.test(
    String(activityForm.eventType || '').trim()
  );
  const [savingActivity, setSavingActivity] = useState(false);
  /** Which button is mid-flight: logging a done activity, or booking one. */
  const [activityKindSaving, setActivityKindSaving] = useState<'logged' | 'scheduled' | null>(null);
  const [completingActivityId, setCompletingActivityId] = useState<string | null>(null);
  const [acceptingActivityId, setAcceptingActivityId] = useState<string | null>(null);
  /** Tenant-configured activity types (Settings -> Leads & Funnels). */
  const [activityTypes, setActivityTypes] = useState<string[]>([...EVENT_TYPES]);
  /** Commercial-requirement row awaiting the "Interested" modal. */
  const [interestedEvent, setInterestedEvent] = useState<LeadEvent | null>(null);
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


  // Form state for the Notes tab (one textarea; each save is a new note row)
  const [notesContent, setNotesContent] = useState('');

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
      setLeadNotes([]);
      setAttachments([]);
      setAuditEntries([]);
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [leadRes, pipeRes, statRes, srcRes, tagRes, usrRes, cfRes, typeRes, prioRes, rtRes] = await Promise.all([
        crmApi.getLead(id),
        crmApi.getPipeline().catch(() => ({
          data: {
            pipeline_stages: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'],
            qualification_prompt_on_requirement_save: false,
          },
        })),
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
      setAskQualifyOnRequirementSave(
        Boolean(pipeRes.data?.qualification_prompt_on_requirement_save)
      );
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

  /**
   * Tab status colours need to be right on first paint, but activities and
   * follow-ups are otherwise only fetched when their tab is opened. Both are
   * small per-lead lists, so load them up front as well.
   */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const [eventsRes, notesRes, typesRes, oppsRes, quotesRes, samplesRes] = await Promise.all([
        crmApi.getLeadEvents(id).catch(() => ({ data: [] as LeadEvent[] })),
        crmApi.getLeadNotes(id).catch(() => ({ data: [] as LeadNote[] })),
        crmApi.getActivityTypes().catch(() => ({ data: [...EVENT_TYPES] })),
        // The Deal tab's visibility depends on whether any opportunity exists,
        // so it cannot wait for the tab to be opened.
        canReadOpportunities
          ? crmApi
              .listOpportunities({ leadId: id, limit: 100 })
              .catch(() => ({ data: [] as OpportunityItem[] }))
          : Promise.resolve({ data: [] as OpportunityItem[] }),
        canReadQuotations
          ? crmApi.getLeadQuotations(id).catch(() => ({ data: [] as QuotationItem[] }))
          : Promise.resolve({ data: [] as QuotationItem[] }),
        canReadSamples
          ? crmApi
              .listSamples({ leadId: id, limit: 100 })
              .catch(() => ({ data: [] as SampleItem[] }))
          : Promise.resolve({ data: [] as SampleItem[] }),
      ]);
      if (cancelled) return;
      setEvents(eventsRes.data || []);
      setLeadNotes(notesRes.data || []);
      setOpportunities(oppsRes.data || []);
      setQuotations(quotesRes.data || []);
      setSamples(samplesRes.data || []);
      const types = Array.isArray(typesRes.data) && typesRes.data.length
        ? typesRes.data
        : [...EVENT_TYPES];
      setActivityTypes(types);
      setActivityForm((prev) => ({
        ...prev,
        eventType: types.includes(prev.eventType) ? prev.eventType : types[0],
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, canReadOpportunities, canReadQuotations, canReadSamples]);

  // Load Tab Resources on Tab Change
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'activities') {
      crmApi.getLeadEvents(id).then(res => setEvents(res.data || [])).catch(() => setEvents([]));
      setActivityForm((prev) => ({ ...prev, eventDate: toLocalDateTimeInputValue() }));
    } else if (activeTab === 'notes') {
      crmApi.getLeadNotes(id).then((res) => setLeadNotes(res.data || [])).catch(() => undefined);
    } else if (activeTab === 'details') {
      crmApi.getLeadAttachments(id).then(res => setAttachments(res.data || [])).catch(() => setAttachments([]));
    } else if (activeTab === 'audit') {
      setAuditError('');
      crmApi
        .getAuditByRecord('lead', id)
        .then((res) => setAuditEntries(res.data || []))
        .catch((err: unknown) => {
          setAuditEntries([]);
          // An empty list and a refused request look identical otherwise.
          setAuditError(
            err instanceof Error ? err.message : 'Audit history could not be loaded.'
          );
        });
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

  /**
   * Tab status colours.
   *
   * GREEN marks a milestone that has been reached: the commercial requirement
   * has been saved, or at least one activity exists. ORANGE marks any other tab
   * that already holds records. Tabs with nothing in them stay neutral.
   */
  /**
   * Tab status colours: green once a tab holds at least one record, orange
   * while it is still empty. Counts are loaded up front (see the effect above)
   * so the colours are right before any tab is opened. Details and Audit carry
   * no colour — they are not record lists.
   */
  const tabTones = useMemo(() => {
    const commercial = lead?.commercialRequirement;
    const commercialCount = Number(
      commercial &&
        (commercial.score != null ||
          (commercial.values && Object.keys(commercial.values).length > 0) ||
          commercial.kind === 'dynamic')
    );
    // The legacy single-notes field still counts as a note.
    const notesCount = leadNotes.length + (String(lead?.notes || '').trim() ? 1 : 0);

    const counts: Record<string, number> = {
      qualification: commercialCount,
      activities: events.length,
      notes: notesCount,
      proposal: quotations.length,
      deal: opportunities.length,
      samples: samples.length,
    };

    const tones: Record<string, 'green' | 'orange' | null> = {};
    for (const [tabId, count] of Object.entries(counts)) {
      tones[tabId] = count > 0 ? 'green' : 'orange';
    }
    return tones;
  }, [
    lead?.commercialRequirement,
    lead?.notes,
    leadNotes.length,
    events.length,
    quotations.length,
    opportunities.length,
    samples.length,
  ]);

  /**
   * Tailwind classes for a tab button. The active tab keeps its dark underline
   * so the current selection always stays readable; the status colour shows in
   * the label and, when inactive, the underline too.
   */
  const tabClass = useCallback(
    (tabId: string): string => {
      const base =
        'pb-3 px-3 text-xs font-semibold border-0 border-b-2 cursor-pointer transition-colors bg-transparent';
      const isActive = activeTab === tabId;
      let tone = tabTones[tabId] || null;
      // Extension tabs ("ext__<extensionId>__<id>") light up when the lead
      // actually carries data for that extension.
      if (!tone && tabId.startsWith('ext__')) {
        const extensionId = tabId.split('__')[1] || '';
        const bag = (lead?.extension || {}) as Record<string, unknown>;
        const payload = bag[extensionId];
        const hasData =
          Boolean(payload) &&
          typeof payload === 'object' &&
          Object.keys(payload as Record<string, unknown>).length > 0;
        tone = hasData ? 'green' : 'orange';
      }

      if (isActive) {
        if (tone === 'green') return `${base} border-emerald-600 text-emerald-700`;
        if (tone === 'orange') return `${base} border-amber-600 text-amber-700`;
        return `${base} border-zinc-950 text-zinc-950`;
      }
      if (tone === 'green') {
        return `${base} border-emerald-200 text-emerald-700 hover:text-emerald-900`;
      }
      if (tone === 'orange') {
        return `${base} border-amber-200 text-amber-700 hover:text-amber-900`;
      }
      return `${base} border-transparent text-zinc-500 hover:text-zinc-800`;
    },
    [activeTab, tabTones, lead?.extension]
  );

  const showProposalTab = isQualifiedOrLaterStage(
    lead?.stage || detailsForm.stage,
    pipelineStages
  );
  // A deal can exist before the lead reaches Qualified (the "Interested" action
  // on a commercial requirement creates one at Contacted), so never hide the
  // tab while there are records in it.
  const showDealTab = showProposalTab || opportunities.length > 0;

  /**
   * A lead gets one opportunity from these two entry points.
   *
   * Once a deal exists the header button and the commercial-requirement
   * "Interested" action are hidden, so a second deal cannot be started by
   * accident. The Deal tab keeps its own Create Opportunity button for the
   * cases where another deal really is wanted.
   */
  const firstOpportunity = opportunities[0] || null;
  const hasOpportunity = Boolean(firstOpportunity);
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

  /**
   * Budget + allowed range handed to the convert-to-opportunity modal. Resolved
   * exactly as the commercial requirement form resolves it, so the deal value is
   * held to the same limits the budget field was.
   */
  const convertBudget = useMemo<ConvertBudgetContext>(() => {
    const commercial = lead?.commercialRequirement;
    const rawBudget =
      commercial?.values?.budget !== undefined && commercial?.values?.budget !== null
        ? commercial.values.budget
        : commercial?.project?.budget;
    const parsed = Number(rawBudget);
    const budgetField = (selectedRequestType?.fields || []).find((field) => {
      const key = String(field.key || '').trim().toLowerCase();
      const label = String(field.label || '').trim().toLowerCase();
      return key === 'budget' || label === 'budget';
    });
    const pick = (...candidates: Array<number | null | undefined>): number | null => {
      for (const candidate of candidates) {
        if (candidate != null && Number.isFinite(Number(candidate))) return Number(candidate);
      }
      return null;
    };
    return {
      value: Number.isFinite(parsed) ? parsed : null,
      min: pick(budgetField?.minAmount, budgetField?.matchNumberMin, selectedRequestType?.minBudget),
      max: pick(budgetField?.maxAmount, budgetField?.matchNumberMax, selectedRequestType?.maxBudget),
      requestTypeName: String(
        selectedRequestType?.name || lead?.requestType || detailsForm.requestType || ''
      ).trim(),
    };
  }, [lead, selectedRequestType, detailsForm.requestType]);

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

  /**
   * Offer to move the lead on to Qualified right after a commercial requirement
   * save, when the tenant has switched the prompt on in Settings → Qualification
   * Match.
   *
   * Forward-only and opt-in: the prompt is skipped when the tenant's pipeline has
   * no Qualified stage, when the lead is already there or past it, or when the
   * user cannot write to the lead. Declining changes nothing, and the next save
   * asks again.
   */
  const maybeOfferQualifiedStage = async (savedLead: LeadItem) => {
    if (!askQualifyOnRequirementSave || !canChangeStage || !id) return;
    if (savedLead.convertedClientId) return;

    const stages = pipelineStages.length ? pipelineStages : DEFAULT_LEAD_PIPELINE;
    const qualifiedIndex = stages.findIndex(
      (stage) => String(stage || '').trim().toLowerCase() === 'qualified'
    );
    if (qualifiedIndex < 0) return;

    const currentIndex = stages.findIndex(
      (stage) =>
        String(stage || '').trim().toLowerCase() ===
        String(savedLead.stage || '').trim().toLowerCase()
    );
    // Unknown stage, or already at Qualified or beyond — nothing to offer.
    if (currentIndex < 0 || currentIndex >= qualifiedIndex) return;

    const qualifiedStage = stages[qualifiedIndex];
    const agreed = await confirm({
      title: 'Convert lead stage?',
      message: `Do you want to convert the lead stage into "${qualifiedStage}"?`,
      confirmLabel: `Yes, move to ${qualifiedStage}`,
      cancelLabel: 'No, keep it as is',
    });
    if (!agreed) return;

    try {
      const res = await crmApi.changeLeadStage(id, qualifiedStage);
      setLead(res.data);
      setDetailsForm((prev) => ({ ...prev, stage: qualifiedStage }));
      showToast(`Stage updated to ${qualifiedStage}`);
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update the lead stage',
        'error'
      );
    }
  };

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
    const phoneSplit = splitPhoneNumber(detailsForm.phone);
    if (phoneSplit.dial && phoneSplit.national) {
      const check = validateNationalNumber(phoneSplit.dial, phoneSplit.national);
      if (check.state === 'invalid' || check.state === 'incomplete') {
        showToast(`Mobile number: ${check.message}`, 'error');
        return;
      }
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
        // A rep may edit everything else on the lead, but not move its stage —
        // sending the unchanged value keeps the server's rule from firing.
        stage: canChangeStage ? detailsForm.stage : lead?.stage || detailsForm.stage,
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

  /**
   * Save an activity.
   *
   * `kind: 'logged'` records something that already happened (saved as
   * Completed); `kind: 'scheduled'` books it for later and stays Open until the
   * rep presses Completed. Either way the rep's position is captured, and a
   * refused or unavailable fix never blocks the save — it is stored with its
   * reason so the Activity Location report stays honest.
   */
  const handleSelectMapLocation = async (loc: LocationCoordinates) => {
    if (editingEventForGoal) {
      if (!id) return;
      try {
        const updatedGoal: ActivityLocation = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address || '',
          capturedAt: new Date().toISOString(),
        };
        await crmApi.updateLeadEvent(id, editingEventForGoal._id, { goalLocation: updatedGoal });
        const res = await crmApi.getLeadEvents(id);
        setEvents(res.data || []);
        showToast('Goal location updated');
      } catch (err: any) {
        showToast(err.message || 'Failed to update goal location', 'error');
      } finally {
        setEditingEventForGoal(null);
        setShowMapPicker(false);
      }
    } else {
      setGoalLocation(loc);
      setShowMapPicker(false);
    }
  };

  const handleRemoveActivityGoalLocation = async (eventId: string) => {
    if (!id) return;
    try {
      await crmApi.updateLeadEvent(id, eventId, { goalLocation: null });
      const res = await crmApi.getLeadEvents(id);
      setEvents(res.data || []);
      showToast('Goal location removed');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove goal location', 'error');
    }
  };

  /**
   * Submit activity either as logged (already completed) or scheduled (open follow-up).
   *
   * Captures the rep's browser position at the moment of creation for createdLocation,
   * while attaching goalLocation if pinned.
   */
  const submitActivity = async (kind: 'logged' | 'scheduled') => {
    if (!canAssignActivities || !id) {
      showToast('You do not have permission to assign activities on this lead', 'error');
      return;
    }
    let finalEventDateIso: string;
    if (kind === 'scheduled') {
      if (!activityForm.eventDate) {
        showToast('Date & time is required for scheduled activities', 'error');
        return;
      }
      finalEventDateIso = new Date(activityForm.eventDate).toISOString();
    } else {
      finalEventDateIso = new Date().toISOString();
    }
    setSavingActivity(true);
    setActivityKindSaving(kind);
    try {
      const eventType = activityForm.eventType || activityTypes[0] || 'Call';
      const targetAssignee = canAssignOthers
        ? activityForm.assignedTo || defaultActivityAssignee || ''
        : currentUserId || defaultActivityAssignee || '';

      const isAssignedToOther = Boolean(
        kind === 'scheduled' && activityForm.assignedTo && activityForm.assignedTo !== currentUserId
      );

      const createdLocation = isAssignedToOther ? null : await captureActivityLocation();
      const goalLocationPayload: ActivityLocation | null = goalLocation
        ? {
            latitude: goalLocation.latitude,
            longitude: goalLocation.longitude,
            address: goalLocation.address || '',
            capturedAt: new Date().toISOString(),
          }
        : null;

      await crmApi.createLeadEvent(id, {
        title: eventType,
        eventType,
        eventDate: finalEventDateIso,
        description: activityForm.note.trim(),
        kind,
        createdLocation,
        goalLocation: goalLocationPayload,
        assignedTo: targetAssignee,
      });
      const res = await crmApi.getLeadEvents(id);
      setEvents(res.data || []);
      setGoalLocation(null);
      setActivityForm({
        eventType: activityTypes[0] || 'Call',
        eventDate: toLocalDateTimeInputValue(),
        note: '',
        assignedTo: canAssignOthers
          ? defaultActivityAssignee || ''
          : currentUserId || defaultActivityAssignee || '',
      });
      const locationNote = createdLocation?.unavailableReason
        ? ' (location not captured)'
        : '';
      showToast(
        kind === 'scheduled'
          ? `Activity scheduled${locationNote}`
          : `Activity logged${locationNote}`
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to add activity', 'error');
    } finally {
      setSavingActivity(false);
      setActivityKindSaving(null);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitActivity('logged');
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

  const handleAcceptActivity = async (eventId: string) => {
    if (!id) return;
    setAcceptingActivityId(eventId);
    try {
      // Accepting location is not captured
      await crmApi.acceptLeadEvent(id, eventId, {});
      try {
        localStorage.setItem('openext_crm_active_activity_id', eventId);
      } catch {}
      const res = await crmApi.getLeadEvents(id);
      setEvents(res.data || []);
      showToast('Activity accepted!');
    } catch (err: any) {
      showToast(err.message || 'Failed to accept activity', 'error');
    } finally {
      setAcceptingActivityId(null);
    }
  };

  /**
   * Completing a scheduled activity captures the rep's position again — this
   * reading, not the one taken when it was booked, is what evidences the visit.
   */
  const handleCompleteActivity = async (eventId: string) => {
    if (!id) return;
    setCompletingActivityId(eventId);
    try {
      const completedLocation = await captureActivityLocation();
      await crmApi.completeLeadEvent(id, eventId, { completedLocation });
      try {
        if (localStorage.getItem('openext_crm_active_activity_id') === eventId) {
          localStorage.removeItem('openext_crm_active_activity_id');
        }
      } catch {}
      const res = await crmApi.getLeadEvents(id);
      setEvents(res.data || []);
      showToast(
        completedLocation.unavailableReason
          ? 'Activity marked completed (location not captured)'
          : 'Activity marked completed'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to complete activity', 'error');
    } finally {
      setCompletingActivityId(null);
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

  /** Add one note as its own row, stamped with the current date and time. */
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !id) return;
    const content = notesContent.trim();
    if (!content) return;
    setSavingNote(true);
    try {
      await crmApi.createLeadNote(id, content);
      const res = await crmApi.getLeadNotes(id);
      setLeadNotes(res.data || []);
      setNotesContent('');
      showToast('Note added');
    } catch (err: any) {
      showToast(err.message || 'Failed to add note', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!canWrite || !id) return;
    const content = editingNoteText.trim();
    if (!content) return;
    setSavingNote(true);
    try {
      await crmApi.updateLeadNote(id, noteId, content);
      const res = await crmApi.getLeadNotes(id);
      setLeadNotes(res.data || []);
      setEditingNoteId(null);
      setEditingNoteText('');
      showToast('Note updated');
    } catch (err: any) {
      showToast(err.message || 'Failed to update note', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!canWrite || !id) return;
    if (!(await confirm({ message: 'Delete this note?', tone: 'danger', confirmLabel: 'Delete' }))) {
      return;
    }
    try {
      await crmApi.deleteLeadNote(id, noteId);
      setLeadNotes((prev) => prev.filter((n) => n._id !== noteId));
      showToast('Note deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete note', 'error');
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

        {/* Identity, Info & Actions Bar (3-column responsive layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-[20%_minmax(0,1fr)_auto] gap-4 items-center">
          {/* LEFT — Lead Identity (20% width) */}
          <div className="flex items-center gap-3 min-w-0">
            {lead.photoUrl ? (
              <img
                src={lead.photoUrl}
                alt={lead.name}
                className="w-12 h-12 rounded-lg object-cover border border-zinc-200 shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0 select-none">
                <User className="h-6 w-6 shrink-0 text-zinc-400" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Lead Profile</span>
                {lead.convertedClientId && (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Converted Client
                  </span>
                )}
              </div>
              <h1 className="text-base lg:text-lg font-bold text-zinc-950 m-0 tracking-tight leading-snug truncate" title={lead.title?.trim() || titleString}>
                {lead.title?.trim() || titleString}
              </h1>
              {lead.title?.trim() && titleString !== 'Lead Details' && (
                <p className="text-xs text-zinc-500 m-0 mt-0.5 truncate">
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
            </div>
          </div>

          {/* CENTER — All Lead Information (55% width) */}
          <div className="flex flex-col justify-center gap-1.5 min-w-0">
            {/* Row 1: Priority, Contact & Source Info */}
            {(lead.priority || lead.email || lead.phone || lead.company || lead.source) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600">
                {lead.priority && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <span className="text-zinc-400">Priority:</span>
                    <span className="text-zinc-900 font-semibold">{lead.priority}</span>
                  </span>
                )}
                {lead.email && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <EmailOutlinedIcon sx={{ fontSize: 13 }} />
                    <span className="truncate max-w-[150px]" title={lead.email}>{lead.email}</span>
                  </span>
                )}
                {lead.phone && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <PhoneIcon sx={{ fontSize: 13 }} />
                    <span>{lead.phone}</span>
                  </span>
                )}
                {lead.company && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <BusinessIcon sx={{ fontSize: 13 }} />
                    <span className="truncate max-w-[140px]" title={lead.company}>{lead.company}</span>
                  </span>
                )}
                {lead.source && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded font-medium">
                    <PublicIcon sx={{ fontSize: 13 }} />
                    <span className="truncate max-w-[120px]" title={lead.source}>{lead.source}</span>
                  </span>
                )}
              </div>
            )}

            {/* Row 2: Lifecycle, Ageing, Follow-up & Quality */}
            {(lead.ageing || lead.followUpSummary?.hasOverdue || lead.followUpSummary?.openCount || !lead.assignedTo || lead.dataQuality) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600">
                {lead.ageing && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded font-semibold ${
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-bold">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>Follow-up Overdue ({lead.followUpSummary.overdueDays}d)</span>
                  </span>
                ) : lead.followUpSummary?.openCount ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-medium">
                    <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{lead.followUpSummary.openCount} Open Follow-up(s)</span>
                  </span>
                ) : null}
                {!lead.assignedTo && (
                  <span
                    data-testid="lead-unassigned-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-semibold"
                  >
                    <WarningAmberIcon sx={{ fontSize: 13 }} />
                    <span>This lead is not assigned</span>
                  </span>
                )}
                {lead.dataQuality && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 border border-zinc-300 rounded font-bold text-zinc-800">
                    Quality {lead.dataQuality.score}/100 · {lead.dataQuality.label}
                  </span>
                )}
              </div>
            )}

            {/* Row 3: Tags & Segmentation */}
            {((Array.isArray(lead.tags) && lead.tags.length > 0) || (!lead.convertedClientId && canWrite)) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600">
                {Array.isArray(lead.tags) &&
                  lead.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-zinc-700 font-medium">
                      <Tag className="h-3 w-3 shrink-0 text-zinc-400" aria-hidden />
                      <span>{t}</span>
                    </span>
                  ))}
                {!lead.convertedClientId && canWrite && (
                  <button
                    type="button"
                    onClick={() => setShowAddTagModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-dashed border-zinc-300 text-zinc-600 hover:border-zinc-500 rounded text-[11px] cursor-pointer"
                  >
                    <AddIcon sx={{ fontSize: 12 }} />
                    <span>Tag</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Lead Stage and Actions (25% width) */}
          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
            {!lead.convertedClientId && (
              <>
                {/* Stage Quick Select */}
                {/* Representatives get no stage control — the stage is shown
                    as a plain badge so they can still see where the lead is. */}
                {canWrite && !canChangeStage && (
                  <span
                    className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-xs font-semibold text-zinc-700"
                    title={stageLockedHint}
                  >
                    Stage: {lead.stage || '—'}
                  </span>
                )}
                {canWrite && canChangeStage && (
                <select
                  data-tour="leads-stage-select"
                  value={lead.stage || ''}
                  onChange={(e) => handleQuickStageChange(e.target.value)}
                  className="bg-white border border-zinc-300 text-zinc-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer hover:border-zinc-400 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950"
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
                  className="bg-zinc-50 border border-zinc-300 text-zinc-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer hover:border-zinc-400 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950"
                  title="Change lifecycle status"
                >
                  {leadStatuses.map((st) => (
                    <option key={st} value={st}>
                      Status: {st}
                    </option>
                  ))}
                </select>
                )}

                {/* Create Opportunity Option — Qualified stage, and only until
                    the first deal exists. */}
                {canWriteOpportunities && !hasOpportunity && /qualif/i.test(lead.stage || '') && (
                  <button
                    type="button"
                    data-tour="leads-create-opportunity-btn"
                    onClick={() => {
                      const returnTo = encodeURIComponent(`/leads/${id}`);
                      navigate(
                        `/opportunities/create?leadId=${encodeURIComponent(String(id))}&returnTo=${returnTo}`
                      );
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <AddIcon fontSize="small" style={{ fontSize: 16 }} />
                    Create Opportunity
                  </button>
                )}

                {canReadOpportunities && hasOpportunity && firstOpportunity ? (
                  <Link
                    to={`/opportunities/${firstOpportunity._id}`}
                    title="This lead already has an opportunity"
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 no-underline hover:bg-indigo-100"
                  >
                    {opportunities.length === 1
                      ? '1 opportunity already created — open it'
                      : `${opportunities.length} opportunities — open latest`}
                  </Link>
                ) : null}

                {/* Client portal — offered once a deal reaches Requirement
                    Confirmed. Never converts the lead. */}
                {id && (
                  <LeadPortalAccessButton
                    leadId={id}
                    leadEmail={lead.email}
                    leadName={lead.company || lead.name}
                    canWrite={canWrite && !lead.convertedClientId}
                    showToast={showToast}
                  />
                )}

                {/* Convert Button — Won stage only (matches API) */}
                {canConvert && isLeadConvertibleStage(lead.stage, pipelineStages) && (
                <button
                  type="button"
                  data-tour="leads-convert-btn"
                  onClick={() => setShowConvertModal(true)}
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 whitespace-nowrap"
                >
                  Convert to Client
                </button>
                )}

                {/* Delete Button */}
                {canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-white hover:bg-red-50 text-red-600 border border-zinc-200 hover:border-red-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
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
            className={tabClass('details')}
          >
            Details
          </button>
          {!isTravelLead && (
            <button
              type="button"
              data-tour="leads-tab-qualification"
              onClick={() => setActiveTab('qualification')}
              className={tabClass('qualification')}
            >
              Commercial Requirement
            </button>
          )}
          <button
            type="button"
            data-tour="leads-tab-activities"
            onClick={() => setActiveTab('activities')}
            className={tabClass('activities')}
          >
            Activities
          </button>
          <button
            type="button"
            data-tour="leads-tab-notes"
            onClick={() => setActiveTab('notes')}
            className={tabClass('notes')}
          >
            Notes
          </button>
          {extensionLeadTabs.map((tab) => (
            <button
              key={tab.tabId}
              type="button"
              data-tour={`leads-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.tabId)}
              className={tabClass(tab.tabId)}
            >
              {tab.label || tab.title}
            </button>
          ))}
          {showProposalTab && (
            <button
              type="button"
              data-tour="leads-tab-proposal"
              onClick={() => setActiveTab('proposal')}
              className={tabClass('proposal')}
            >
              Proposal
            </button>
          )}
          {showDealTab && (
            <button
              type="button"
              data-tour="leads-tab-deal"
              onClick={() => setActiveTab('deal')}
              className={tabClass('deal')}
            >
              Deal
            </button>
          )}
          {showSamplesTab && (
            <button
              type="button"
              data-tour="leads-tab-samples"
              onClick={() => setActiveTab('samples')}
              className={tabClass('samples')}
            >
              Samples
            </button>
          )}
          <button
            type="button"
            data-tour="leads-tab-audit"
            onClick={() => setActiveTab('audit')}
            className={tabClass('audit')}
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
                    <PhoneNumberField
                      value={detailsForm.phone}
                      onChange={(phone) => setDetailsForm({ ...detailsForm, phone })}
                      inputClassName="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                      placeholder="98765 43210"
                    />
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
                    {!canChangeStage ? (
                      <p
                        className="m-0 rounded border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700"
                        title={stageLockedHint}
                      >
                        {detailsForm.stage || '—'}
                      </p>
                    ) : (
                    <select
                      value={detailsForm.stage}
                      onChange={(e) => setDetailsForm({ ...detailsForm, stage: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      {pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    )}
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
            onSaved={(saved) => {
              setLead(saved);
              // The server mirrors the save onto the Activity tab, so pull the
              // list again to surface that row (and its "Interested" action).
              void crmApi
                .getLeadEvents(id)
                .then((res) => setEvents(res.data || []))
                .catch(() => undefined);
              // Opt-in prompt: "do you want to convert the lead stage to Qualified?"
              void maybeOfferQualifiedStage(saved);
            }}
          />
        )}

        {/* ================= TAB 3: ACTIVITIES ================= */}
        {activeTab === 'activities' && (
          <div className="flex flex-col gap-6">
            {/* Add Activity Form — requires lead write permission; assignees exclude clients */}
            {canAssignActivities && !lead.convertedClientId && (
              <>
              {/* Presentation only for now — no handler is wired on purpose. */}
              <div className="flex items-center justify-start">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3.5 text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-100 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  AI agent
                </button>
              </div>
              <form
                onSubmit={handleAddActivity}
                className="bg-white border border-zinc-300 rounded-lg p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-zinc-100">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-950 mb-0.5">
                      {activityCreationMode === 'current' ? 'Log Current Activity' : 'Schedule Future Activity'}
                    </h3>
                    <p className="text-xs text-zinc-500 mb-0">
                      {activityCreationMode === 'current'
                        ? 'Record an interaction at current time without future scheduling.'
                        : 'Plan an upcoming visit, meeting, or follow-up with a future date and time.'}
                    </p>
                  </div>

                  {/* Radio option switcher */}
                  <div className="flex items-center gap-4 bg-zinc-100 p-1.5 rounded-lg border border-zinc-200">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer select-none px-2 py-1 rounded hover:bg-white/60 transition-colors">
                      <input
                        type="radio"
                        name="activityCreationMode"
                        value="current"
                        checked={activityCreationMode === 'current'}
                        onChange={() => setActivityCreationMode('current')}
                        className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span>Current time activity</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer select-none px-2 py-1 rounded hover:bg-white/60 transition-colors">
                      <input
                        type="radio"
                        name="activityCreationMode"
                        value="scheduled"
                        checked={activityCreationMode === 'scheduled'}
                        onChange={() => setActivityCreationMode('scheduled')}
                        className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span>Schedule activity</span>
                    </label>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-end gap-4">
                  {/* Type Selection* */}
                  <div className="w-[3cm] shrink-0">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={activityForm.eventType}
                      onChange={(e) => setActivityForm({ ...activityForm, eventType: e.target.value })}
                      className="w-full px-2 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                      {activityTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date & Time* (ONLY shown when activityCreationMode === 'scheduled') */}
                  {activityCreationMode === 'scheduled' && (
                    <div className="w-[4.5cm] shrink-0">
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Date & time <span className="text-red-500">* (Future)</span>
                      </label>
                      <input
                        type="datetime-local"
                        required
                        min={toLocalDateTimeInputValue()}
                        value={activityForm.eventDate}
                        onChange={(e) => setActivityForm({ ...activityForm, eventDate: e.target.value })}
                        className="w-full px-2 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Assign to* */}
                  <div className="w-[4cm] shrink-0">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Assign to <span className="text-red-500">*</span>
                    </label>
                    {canAssignOthers ? (
                      <select
                        value={activityForm.assignedTo}
                        onChange={(e) => setActivityForm({ ...activityForm, assignedTo: e.target.value })}
                        className="w-full px-2 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
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
                        className="w-full px-2 py-2 text-xs border border-zinc-200 rounded bg-zinc-50 text-zinc-600"
                        value="You (current user)"
                        disabled
                        readOnly
                        title="Sales representatives can only assign activities to themselves"
                      />
                    )}
                  </div>

                  {/* Note/Description */}
                  <div className="min-w-[180px] grow basis-1/3">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Note</label>
                    <input
                      type="text"
                      maxLength={2000}
                      value={activityForm.note}
                      onChange={(e) => setActivityForm({ ...activityForm, note: e.target.value })}
                      placeholder="What was discussed, or what to cover"
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded focus:border-zinc-950 focus:outline-none"
                    >
                    </input>
                  </div>
                </div>

                {isMeetingOrFollowUp && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-zinc-900 block">
                          Goal Location for this {activityForm.eventType}
                        </span>
                        <span className="text-[11px] text-zinc-500 block">
                          Pin the target destination or meeting location on Google Map.
                        </span>
                      </div>
                    </div>
                    <div>
                      {!goalLocation ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEventForGoal(null);
                            setShowMapPicker(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-300 bg-white text-blue-700 hover:bg-blue-50 shadow-sm cursor-pointer transition-colors"
                        >
                          🎯 Pin Goal Location on Map
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm">
                          <span>
                            🎯 Goal: Lat: {goalLocation.latitude.toFixed(4)}, Lng: {goalLocation.longitude.toFixed(4)}
                            {goalLocation.address ? ` (${goalLocation.address})` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEventForGoal(null);
                              setShowMapPicker(true);
                            }}
                            className="ml-1 text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer bg-transparent border-0 p-0"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setGoalLocation(null)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline cursor-pointer bg-transparent border-0 p-0 ml-1"
                            title="Remove goal location"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {activityCreationMode === 'current'
                      ? 'Your current location is captured upon logging this activity.'
                      : 'Your location is captured when this scheduled activity is completed.'}
                  </span>
                  <div className="flex items-center gap-2">
                    {activityCreationMode === 'current' ? (
                      <button
                        type="submit"
                        disabled={savingActivity}
                        title="Record an activity that has already happened at current time"
                        className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors border-0 disabled:opacity-50"
                      >
                        {activityKindSaving === 'logged' ? 'Logging…' : 'Log Activity'}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={savingActivity}
                        title="Book this activity for later - complete it after the visit or call"
                        className="inline-flex items-center gap-1.5 border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {activityKindSaving === 'scheduled' ? 'Scheduling…' : 'Schedule Activity'}
                      </button>
                    )}
                  </div>
                </div>
              </form>
              </>
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
                    {events.map((ev) => {
                      const isAssignedToMe = String(ev.assignedTo || '').trim() === currentUserId;
                      const isPendingAcceptance = ev.status === 'Assigned';
                      const isAccepted = ev.status === 'Accepted';
                      const startLoc = ev.acceptedLocation || ev.createdLocation;
                      const canComplete =
                        canWrite &&
                        (isAccepted || ev.status === 'Open') &&
                        (isAssignedToMe || (!ev.assignedTo && (isAdmin || String(ev.createdBy || '').trim() === currentUserId)));

                      return (
                      <React.Fragment key={ev._id}>
                        <tr className="hover:bg-zinc-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-zinc-950">
                            <Link to={`/activities/${ev._id}`} className="block hover:text-blue-600 hover:underline cursor-pointer">{ev.title}</Link>
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                              {ev.kind === 'scheduled' ? (
                                <>
                                  <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
                                  Scheduled
                                </>
                              ) : (
                                'Logged'
                              )}
                              {ev.source === 'commercial_requirement' ? ' · Requirement' : ''}
                            </span>
                            {ev.goalLocation && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-normal text-zinc-700">
                                <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                                  🎯 Goal: {ev.goalLocation.address || (ev.goalLocation.latitude != null && ev.goalLocation.longitude != null ? `Lat: ${ev.goalLocation.latitude.toFixed(4)}, Lng: ${ev.goalLocation.longitude.toFixed(4)}` : describeLocation(ev.goalLocation))}
                                </span>
                                {mapsLinkFor(ev.goalLocation) && (
                                  <a
                                    href={mapsLinkFor(ev.goalLocation) as string}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-blue-600 hover:text-blue-800 underline text-[10px]"
                                    title="Open in Google Maps"
                                  >
                                    View Map
                                  </a>
                                )}
                              </div>
                            )}
                            {startLoc && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-normal text-zinc-700">
                                <span className="inline-flex items-center gap-1 text-zinc-700 font-medium">
                                  📍 Started from: {startLoc.address || (startLoc.latitude != null && startLoc.longitude != null ? `Lat: ${startLoc.latitude.toFixed(4)}, Lng: ${startLoc.longitude.toFixed(4)}` : describeLocation(startLoc))}
                                </span>
                                {mapsLinkFor(startLoc) && (
                                  <a
                                    href={mapsLinkFor(startLoc) as string}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-blue-600 hover:text-blue-800 underline text-[10px]"
                                    title="Open in Google Maps"
                                  >
                                    View Map
                                  </a>
                                )}
                              </div>
                            )}
                            {ev.completedLocation && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-normal text-zinc-700">
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  🏁 Completed at: {ev.completedLocation.address || (ev.completedLocation.latitude != null && ev.completedLocation.longitude != null ? `Lat: ${ev.completedLocation.latitude.toFixed(4)}, Lng: ${ev.completedLocation.longitude.toFixed(4)}` : describeLocation(ev.completedLocation))}
                                </span>
                                {mapsLinkFor(ev.completedLocation) && (
                                  <a
                                    href={mapsLinkFor(ev.completedLocation) as string}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-blue-600 hover:text-blue-800 underline text-[10px]"
                                    title="Open in Google Maps"
                                  >
                                    View Map
                                  </a>
                                )}
                              </div>
                            )}
                          </td>
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
                            {canAssignActivities && canAssignOthers && (ev.status === 'Open' || ev.status === 'Assigned') ? (
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
                            {(() => {
                              const display = activityDisplayStatus(ev);
                              const badgeText =
                                isPendingAcceptance && !isAssignedToMe
                                  ? 'Assigned (Pending Rep Acceptance)'
                                  : display;
                              return (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${activityStatusClass(
                                    display
                                  )}`}
                                  title={
                                    display === 'Missed'
                                      ? 'Scheduled activity was not completed by its due time'
                                      : undefined
                                  }
                                >
                                  {badgeText}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canWrite &&
                                !hasOpportunity &&
                                ev.source === 'commercial_requirement' &&
                                !ev.convertedOpportunityId && (
                                  <button
                                    type="button"
                                    onClick={() => setInterestedEvent(ev)}
                                    title="Client is interested - create an opportunity"
                                    className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer"
                                  >
                                    <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
                                    Interested
                                  </button>
                                )}
                              {ev.convertedOpportunityId ? (
                                <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                                  Converted
                                </span>
                              ) : null}
                              {canWrite && (ev.status === 'Open' || ev.status === 'Assigned' || ev.status === 'Accepted') && ev.kind === 'scheduled' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEventForGoal(ev);
                                    setShowMapPicker(true);
                                  }}
                                  title={ev.goalLocation ? 'Edit Goal Location' : 'Add Goal Location'}
                                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  🎯 {ev.goalLocation ? 'Edit Goal' : 'Add Goal'}
                                </button>
                              )}
                              <Link
                                  to={`/activities/${ev._id}`}
                                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded text-[11px] font-semibold no-underline transition-colors"
                                  title="View Activity Details & Trail"
                                >
                                  View Details
                                </Link>
                                {isPendingAcceptance && isAssignedToMe && canWrite && (
                                <button
                                  type="button"
                                  onClick={() => handleAcceptActivity(ev._id)}
                                  disabled={acceptingActivityId === ev._id}
                                  title="Accept this activity and record your starting location"
                                  className="inline-flex items-center gap-1.5 text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
                                >
                                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  {acceptingActivityId === ev._id ? 'Accepting…' : 'Accept Activity'}
                                </button>
                              )}
                              {canComplete && (
                                <button
                                  type="button"
                                  onClick={() => handleCompleteActivity(ev._id)}
                                  disabled={completingActivityId === ev._id}
                                  title="Marks it done and records where you are now"
                                  className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                                >
                                  {completingActivityId === ev._id ? 'Completing…' : 'Complete'}
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
                        {ev.description || ev.createdLocation || ev.acceptedLocation || ev.completedLocation || ev.goalLocation || (canWrite && (ev.status === 'Open' || ev.status === 'Assigned' || ev.status === 'Accepted') && ev.kind === 'scheduled') ? (
                          <tr className="bg-zinc-50">
                            <td
                              colSpan={6}
                              className="px-4 py-2 text-[11px] text-zinc-600 border-b border-zinc-200"
                            >
                              {ev.description ? <div>{ev.description}</div> : null}
                              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                                {ev.goalLocation ? (
                                  <span className="inline-flex items-center gap-1 text-zinc-700">
                                    <span className="font-semibold text-blue-700">🎯 Goal:</span>&nbsp;
                                    {mapsLinkFor(ev.goalLocation) ? (
                                      <a
                                        href={mapsLinkFor(ev.goalLocation) as string}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="font-medium text-blue-600 underline"
                                      >
                                        {ev.goalLocation.address || (ev.goalLocation.latitude != null && ev.goalLocation.longitude != null ? `Lat: ${ev.goalLocation.latitude.toFixed(4)}, Lng: ${ev.goalLocation.longitude.toFixed(4)}` : describeLocation(ev.goalLocation))}
                                      </a>
                                    ) : (
                                      <span>
                                        {ev.goalLocation.address || (ev.goalLocation.latitude != null && ev.goalLocation.longitude != null ? `Lat: ${ev.goalLocation.latitude.toFixed(4)}, Lng: ${ev.goalLocation.longitude.toFixed(4)}` : describeLocation(ev.goalLocation))}
                                      </span>
                                    )}
                                    {canWrite && (ev.status === 'Open' || ev.status === 'Assigned' || ev.status === 'Accepted') && ev.kind === 'scheduled' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingEventForGoal(ev);
                                            setShowMapPicker(true);
                                          }}
                                          className="ml-1 text-blue-600 hover:text-blue-800 underline text-[11px] cursor-pointer bg-transparent border-0 p-0 font-medium"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleRemoveActivityGoalLocation(ev._id)}
                                          className="ml-1 text-rose-600 hover:text-rose-800 underline text-[11px] cursor-pointer bg-transparent border-0 p-0 font-medium"
                                          title="Remove goal location"
                                        >
                                          Remove
                                        </button>
                                      </>
                                    )}
                                  </span>
                                ) : canWrite && (ev.status === 'Open' || ev.status === 'Assigned' || ev.status === 'Accepted') && ev.kind === 'scheduled' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEventForGoal(ev);
                                      setShowMapPicker(true);
                                    }}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline text-[11px] cursor-pointer bg-transparent border-0 p-0 font-medium"
                                  >
                                    🎯 Add Goal Location
                                  </button>
                                ) : null}
                                {startLoc ? (
                                  <span className="inline-flex items-center gap-1 text-zinc-600">
                                    <span aria-hidden>📍</span>
                                    <span className="font-semibold text-zinc-700">Started from:</span>&nbsp;
                                    {mapsLinkFor(startLoc) ? (
                                      <a
                                        href={mapsLinkFor(startLoc) as string}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="font-medium text-zinc-700 underline"
                                      >
                                        {startLoc.address || (startLoc.latitude != null && startLoc.longitude != null ? `Lat: ${startLoc.latitude.toFixed(4)}, Lng: ${startLoc.longitude.toFixed(4)}` : describeLocation(startLoc))}
                                      </a>
                                    ) : (
                                      <span className="italic">
                                        {startLoc.address || (startLoc.latitude != null && startLoc.longitude != null ? `Lat: ${startLoc.latitude.toFixed(4)}, Lng: ${startLoc.longitude.toFixed(4)}` : describeLocation(startLoc))}
                                      </span>
                                    )}
                                    {startLoc.capturedAt ? (
                                      <span className="text-[10px] text-zinc-400">
                                        ({new Date(startLoc.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                      </span>
                                    ) : null}
                                  </span>
                                ) : null}
                                {ev.completedLocation && ev.kind === 'scheduled' ? (
                                  <span className="inline-flex items-center gap-1 text-zinc-500">
                                    <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                                    Completed at:&nbsp;
                                    {mapsLinkFor(ev.completedLocation) ? (
                                      <a
                                        href={mapsLinkFor(ev.completedLocation) as string}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="font-medium text-zinc-700 underline"
                                      >
                                        {describeLocation(ev.completedLocation)}
                                      </a>
                                    ) : (
                                      <span className="italic">
                                        {describeLocation(ev.completedLocation)}
                                      </span>
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: NOTES ================= */}
        {activeTab === 'notes' && (
          <div className="flex flex-col gap-6">
            {!lead.convertedClientId && canWrite && (
              <form onSubmit={handleAddNote} className="bg-white border border-zinc-300 rounded-lg p-6">
                <h3 className="text-sm font-bold text-zinc-950 mb-1">Add a note</h3>
                <p className="text-xs text-zinc-500 mb-4">
                  Each note is saved as its own entry, stamped with the date and time it was added.
                </p>
                <div className="mb-4">
                  <textarea
                    rows={5}
                    maxLength={5000}
                    placeholder="Record context, call memos, internal briefings, next steps…"
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    className="w-full px-3.5 py-3 text-xs border border-zinc-200 rounded-lg focus:border-zinc-950 focus:outline-none font-normal leading-relaxed"
                  />
                  <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
                    <span>Saved as a new entry below</span>
                    <span>{notesContent.length} / 5000</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNote || !notesContent.trim()}
                    className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg cursor-pointer transition-colors border-0 disabled:opacity-50"
                  >
                    {savingNote ? 'Saving…' : 'Add Note'}
                  </button>
                </div>
              </form>
            )}

            {/* All notes, newest first, below the box */}
            <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 m-0">Notes</h4>
                <span className="text-xs text-zinc-500 font-medium">
                  {leadNotes.length} note(s)
                </span>
              </div>

              {leadNotes.length === 0 && !String(lead.notes || '').trim() ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No notes added for this lead yet.
                </div>
              ) : (
                <ul className="m-0 list-none divide-y divide-zinc-200 p-0">
                  {leadNotes.map((note) => (
                    <li key={note._id} className="p-4">
                      {editingNoteId === note._id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            rows={4}
                            maxLength={5000}
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:border-zinc-950 focus:outline-none leading-relaxed"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(null);
                                setEditingNoteText('');
                              }}
                              className="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-[11px] font-semibold text-zinc-800 cursor-pointer hover:bg-zinc-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingNote || !editingNoteText.trim()}
                              onClick={() => void handleUpdateNote(note._id)}
                              className="h-8 rounded-lg border-0 bg-zinc-950 px-3 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-50"
                            >
                              {savingNote ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700">
                              <User className="h-3 w-3 shrink-0" aria-hidden />
                              {note.createdByName || 'Team member'}
                              <span className="font-normal text-zinc-400">
                                · {formatNoteStamp(note.createdAt)}
                                {note.editedAt ? ' · edited' : ''}
                              </span>
                            </span>
                            {canWrite && !lead.convertedClientId && (
                              <span className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteId(note._id);
                                    setEditingNoteText(note.content);
                                  }}
                                  className="bg-transparent border-0 p-0 text-[11px] font-semibold text-zinc-600 cursor-pointer hover:text-zinc-900 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteNote(note._id)}
                                  className="bg-transparent border-0 p-0 text-[11px] font-semibold text-red-600 cursor-pointer hover:text-red-800 hover:underline"
                                >
                                  Delete
                                </button>
                              </span>
                            )}
                          </div>
                          <p className="m-0 whitespace-pre-wrap text-xs leading-relaxed text-zinc-800">
                            {note.content}
                          </p>
                        </>
                      )}
                    </li>
                  ))}

                  {/* Anything written before notes became separate rows */}
                  {String(lead.notes || '').trim() ? (
                    <li className="bg-zinc-50/70 p-4">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        Earlier note (before notes were kept separately)
                      </div>
                      <p className="m-0 whitespace-pre-wrap text-xs leading-relaxed text-zinc-700">
                        {lead.notes}
                      </p>
                    </li>
                  ) : null}
                </ul>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {opportunities.map((opp) => (
                      <tr
                        key={opp._id}
                        // The row itself is the link now — keyboard users get the
                        // same action through Enter.
                        role="link"
                        tabIndex={0}
                        title={`Open ${opp.opportunityNumber || 'opportunity'}`}
                        onClick={() => navigate(`/opportunities/${opp._id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/opportunities/${opp._id}`);
                          }
                        }}
                        className="cursor-pointer hover:bg-zinc-50 transition-colors"
                      >
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
              {auditError ? (
                <div className="p-8 text-center text-xs text-amber-700">
                  <AlertCircle className="mx-auto mb-2 h-5 w-5 shrink-0" aria-hidden />
                  {auditError}
                </div>
              ) : auditEntries.length === 0 ? (
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

      <GoogleMapLocationPickerModal
        isOpen={showMapPicker}
        onClose={() => {
          setShowMapPicker(false);
          setEditingEventForGoal(null);
        }}
        onSelect={(loc) => void handleSelectMapLocation(loc)}
        initialLat={
          editingEventForGoal
            ? (editingEventForGoal.goalLocation?.latitude ?? undefined)
            : (goalLocation?.latitude ?? (lead?.latitude != null ? lead.latitude : undefined))
        }
        initialLng={
          editingEventForGoal
            ? (editingEventForGoal.goalLocation?.longitude ?? undefined)
            : (goalLocation?.longitude ?? (lead?.longitude != null ? lead.longitude : undefined))
        }
        title={
          editingEventForGoal
            ? `Pin Goal Location for ${editingEventForGoal.title || editingEventForGoal.eventType || 'Activity'}`
            : `Pin Goal Location for ${activityForm.eventType}`
        }
      />

      <AttachmentPreviewModal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        url={previewDoc?.url || ''}
        name={previewDoc?.name}
        mimeType={previewDoc?.mimeType}
      />

      {interestedEvent && id ? (
        <InterestedOpportunityModal
          leadId={id}
          eventId={interestedEvent._id}
          defaultTitle={
            String(lead?.title || '').trim() ||
            `${lead?.company || lead?.name || 'Lead'} — ${lead?.requestType || 'Opportunity'}`
          }
          budget={convertBudget}
          showToast={showToast}
          onClose={() => setInterestedEvent(null)}
          onCreated={(opportunityNumber) => {
            setInterestedEvent(null);
            showToast(
              opportunityNumber
                ? `Opportunity ${opportunityNumber} created`
                : 'Opportunity created'
            );
            // Refresh the row (now "Converted") and the Deal tab's list.
            void crmApi
              .getLeadEvents(id)
              .then((res) => setEvents(res.data || []))
              .catch(() => undefined);
            if (canReadOpportunities) {
              void crmApi
                .listOpportunities({ leadId: id, limit: 100 })
                .then((res) => setOpportunities(res.data || []))
                .catch(() => undefined);
            }
          }}
        />
      ) : null}
    </div>
  );
};

