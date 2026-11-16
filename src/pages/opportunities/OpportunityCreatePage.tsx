import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { notify } from '@/components/notifications';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import { useSalesFlowConfig } from '../../hooks/useSalesFlowConfig';
import {
  OpportunityProductLine,
  INDIAN_STATES,
  stageProbability,
  isOpportunityLostStage,
  buildOpportunityStages,
} from '../../types/opportunities';
import { computeQualificationMatchScore } from '../../utils/qualificationMatchScore';
import { OpportunityPipeline } from '../../types/opportunity-pipelines';
import { ClientItem } from '../../types/clients';
import { LeadItem, AssignableUser, OpportunityItemDraft, OpportunityStartStage, SalesFlowCheck, SalesFlowConfig, SalesFlowPanel, SalesFlowNotice } from '../../types/leads';
import { SalesFlowNotices } from '../../components/finance/SalesFlowQuotationParts';
import { salesTerms } from '../../utils/salesTerms';
import type { ExtensionFact, ExtensionValueConfirm } from '../../types/extensions';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { LeadSelect } from '../../components/leads/LeadSelect';
import { ContactSelect } from '../../components/contacts/ContactSelect';
import { PersonContact, formatContactName } from '../../types/contacts';
import { useOpportunityStages } from '../../hooks/useOpportunityStages';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { formatCrmMoney, getCurrencySymbol, normalizeCurrencyCode } from '../../utils/currency';
import { CURRENCY_OPTIONS } from '../../components/finance/FinanceFormElements';
import {
  canAssignOpportunityOwner,
  formatAssignableUserLabel,
  isAssignableSalesRepresentative,
} from '../../utils/permissions';
import { OpportunityStageIcon } from '../../components/icons/OpportunityStageIcon';
import { PhoneNumberField } from '../../components/common/PhoneNumberField';
import { splitPhoneNumber, validateNationalNumber } from '../../utils/phoneCountryCodes';
import { ExtensionCreateFields, SalesFlowPanels, countCheckRow } from '../../components/extensions';
import { useExtensionSettingsValues } from '../../components/extensions/useExtensionSettings';
import { extensionDataApi } from '../../services/extensionDataApi';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import {
  canReplaceWithPrefill,
  emptyFieldValue,
  invalidFieldValue,
  missingRequiredFields,
  withFormulas,
} from '../../utils/extensionFieldLogic';
import { useDialog } from '../../context/DialogContext';
import { notifySalesFlowSaved } from '../../utils/salesFlowSaved';
import { RequestType } from '../../types/request-types';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  GripVertical,
  Lightbulb,
  Lock,
  Save,
  Target,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';

const DEFAULT_COMPANY_STATE = 'Maharashtra';

type LineDraft = {
  key: string;
  productName: string;
  description: string;
  /** From the extension's prefill line (e.g. 2 Adults, Rooms × Nights); a hand-made line is 1 × 0. */
  quantity?: number;
  unitPrice?: number;
  tax?: number;
};

function newLine(partial?: Partial<LineDraft>): LineDraft {
  return {
    key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productName: partial?.productName ?? '',
    description: partial?.description ?? '',
    ...(partial?.quantity !== undefined ? { quantity: partial.quantity } : {}),
    ...(partial?.unitPrice !== undefined ? { unitPrice: partial.unitPrice } : {}),
    ...(partial?.tax !== undefined ? { tax: partial.tax } : {}),
  };
}

/** A prefill line's number, or undefined when it is missing / out of range. */
function lineNumber(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function defaultCloseDate() {
  return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD of the user's own (local) calendar day, offset by whole days. */
function localDateIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Product lines compared by what the agent sees (name + description). */
function linesSignature(list: LineDraft[]): string {
  return JSON.stringify(list.map((l) => [l.productName, l.description]));
}

/** Same stored value (lists compared by content). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

function safeReturnPath(raw: string | null): string {
  const value = String(raw || '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/opportunities';
  return value;
}

function getLeadCommercialMatchScore(lead: LeadItem): number | null {
  if (lead.commercialRequirement?.score != null && Number.isFinite(Number(lead.commercialRequirement.score))) {
    return Number(lead.commercialRequirement.score);
  }
  if (
    lead.commercialRequirement &&
    (lead.commercialRequirement.kind ||
      lead.commercialRequirement.project ||
      lead.commercialRequirement.product ||
      lead.commercialRequirement.values)
  ) {
    try {
      const res = computeQualificationMatchScore(lead.commercialRequirement, null);
      if (res.score != null) return res.score;
    } catch {
      // ignore
    }
  }
  if ((lead as any).qualificationScore != null) return Number((lead as any).qualificationScore);
  if ((lead as any).qualification?.score != null) return Number((lead as any).qualification.score);
  return null;
}

export const OpportunityCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const { hasPermission, user, isClient, activeRole } = useAuth();
  const canWrite =
    hasPermission('crm.opportunities.write') || hasPermission('crm.leads.write');
  const canAssignOwner = canAssignOpportunityOwner(user, { isClient, activeRole });
  const opportunityStages = useOpportunityStages();
  const settingsCurrency = useDefaultCurrency();
  const defaultStage = opportunityStages[0];

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  /** Why the lead from a ?leadId= link was not used (e.g. it is not ready for an opportunity yet). */
  const [leadLinkProblem, setLeadLinkProblem] = useState('');
  // Lead workflow: leads not offered because they are neither Qualified nor ready (Settings → Qualification Match).
  const [hiddenLeadCount, setHiddenLeadCount] = useState(0);
  const [leadRule, setLeadRule] = useState<'all' | 'qualified_or_ready'>('all');
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [pipelines, setPipelines] = useState<OpportunityPipeline[]>([]);
  const [pipelineId] = useState<string>(
    () => searchParams.get('pipelineId') || searchParams.get('pipeline') || ''
  );
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extensionValues, setExtensionValues] = useState<Record<string, unknown>>({});

  // Form State
  const [title, setTitle] = useState('');
  const initialLeadId = searchParams.get('leadId') || '';
  const initialClientId = searchParams.get('clientId') || '';
  /** Create Opportunity For — Lead or Client (never both selectors). */
  const [linkType, setLinkType] = useState<'lead' | 'client'>(
    initialLeadId ? 'lead' : 'client'
  );
  const [clientId, setClientId] = useState(initialLeadId ? '' : initialClientId);
  const [leadId, setLeadId] = useState(initialLeadId);
  const [salesOwner, setSalesOwner] = useState('');
  const [selectedContact, setSelectedContact] = useState<PersonContact | null>(null);
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [stage, setStage] = useState(defaultStage?.key || 'Discovery');
  const [probability, setProbability] = useState(defaultStage?.probability ?? 10);
  const [expectedCloseDate, setExpectedCloseDate] = useState(defaultCloseDate());
  const [lostReason, setLostReason] = useState('');
  /** Per-record currency (defaults from Settings; not rewritten when global default changes). */
  const [currency, setCurrency] = useState(settingsCurrency);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [dealValue, setDealValue] = useState<number>(0);
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [suggestions, setSuggestions] = useState<OpportunityItemDraft[]>([]);
  const [openSuggestFor, setOpenSuggestFor] = useState<string | null>(null);
  const linesContainerRef = useRef<HTMLDivElement | null>(null);
  const [shippingState, setShippingState] = useState(DEFAULT_COMPANY_STATE);
  const [leadPrefillDone, setLeadPrefillDone] = useState(false);
  /** Sales flow: what the active extension filled in for the chosen lead (only when it offers it). */
  const [salesPrefill, setSalesPrefill] = useState<{ leadId: string; warnings: string[]; lines: number; notices?: SalesFlowNotice[] } | null>(null);
  /** Layout switches of the active extension (e.g. its panels replace the product lines). */
  const salesFlow: SalesFlowConfig = useSalesFlowConfig();
  const terms = salesTerms(salesFlow);
  const [salesPanels, setSalesPanels] = useState<{ leadId: string; panels: SalesFlowPanel[] } | null>(null);
  const [salesPanelsLoading, setSalesPanelsLoading] = useState(false);
  /** The extension's checklist for the chosen lead (prefill `checks`). */
  const [salesChecks, setSalesChecks] = useState<{ leadId: string; checks: SalesFlowCheck[] } | null>(null);
  /** The extension's facts and value questions for the chosen lead (prefill facts / valueConfirms). */
  const [salesFacts, setSalesFacts] = useState<{ leadId: string; facts: ExtensionFact[]; confirms: ExtensionValueConfirm[] } | null>(null);
  /**
   * The extension's own layout of this page (salesFlow.opportunityForm). Without it the page
   * stays as it was: both link types, declared fields at the bottom.
   */
  const oppForm = salesFlow.opportunityForm || null;
  /**
   * salesFlow.opportunityForm.startStage: the CRM sets the stage of a new opportunity (from the lead's
   * readiness); the stepper is read-only and no stage / probability is sent.
   */
  const stageLocked = Boolean(oppForm?.startStage && oppForm.startStage.locked !== false);
  const stageLockedRef = useRef(stageLocked);
  stageLockedRef.current = stageLocked;
  const [startStageInfo, setStartStageInfo] = useState<OpportunityStartStage | null>(null);
  const { declarations } = useActiveExtension();
  const declaredOppGroups = useMemo(() => declarations.fields?.opportunity || [], [declarations.fields]);
  const declaredOppFields = useMemo(
    () => new Map(declaredOppGroups.flatMap((g) => g.fields).map((f) => [f.key, f] as const)),
    [declaredOppGroups]
  );
  /** Latest declared fields for async prefill answers (the declarations may load after the request starts). */
  const declaredOppFieldsRef = useRef(declaredOppFields);
  declaredOppFieldsRef.current = declaredOppFields;
  const oppSettingsValues = useExtensionSettingsValues(
    useMemo(() => Array.from(declaredOppFields.values()).some((f) => f.optionsFrom), [declaredOppFields])
  );
  const { confirm } = useDialog();
  const allowedLinkTypes = useMemo<Array<'lead' | 'client'>>(() => {
    const listed = (oppForm?.linkTypes || []).filter((t): t is 'lead' | 'client' => t === 'lead' || t === 'client');
    return listed.length ? Array.from(new Set(listed)) : ['lead', 'client'];
  }, [oppForm]);
  /** Declared groups shown as numbered cards right after section 1 (they shift the later numbers). */
  const formGroupCount = oppForm ? declaredOppGroups.length : 0;
  /** The agent picked Lead / Client by hand: the form's default no longer applies. */
  const linkTypeTouched = useRef(false);
  // Only for a lead, and only when the active extension asks for it (salesFlow.hideOpportunityLines):
  // an opportunity for a client has no lead requirements, so it keeps the product editor.
  const hideLines = Boolean(salesFlow.hideOpportunityLines) && linkType === 'lead';
  const hideLinesRef = useRef(false);
  hideLinesRef.current = hideLines;
  const prefillSeq = useRef(0);
  /** Values this page filled in itself — replaced on the next lead, while the agent's own edits are kept. */
  const autoFilled = useRef<{
    title: string;
    closeDate: string;
    lines: string;
    values: Record<string, unknown>;
    person: string;
    email: string;
    mobile: string;
    dealValue: number;
    currency: string;
  }>({
    title: '',
    closeDate: '',
    lines: '',
    values: {},
    person: '',
    email: '',
    mobile: '',
    dealValue: 0,
    currency: '',
  });
  /** Current values for handlers that run after an await (state in their closure may be old). */
  const extensionValuesRef = useRef(extensionValues);
  extensionValuesRef.current = extensionValues;
  const contactRef = useRef({ person: contactPerson, email: contactEmail, mobile: contactMobile });
  contactRef.current = { person: contactPerson, email: contactEmail, mobile: contactMobile };
  /** Bumped on every lead sync / reset, so a late contact answer for an older lead is dropped. */
  const leadSyncSeq = useRef(0);
  const [leadMatchScore, setLeadMatchScore] = useState<number | null>(null);

  const goBack = () => navigate(returnTo);


  const showToast = (text: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    notify.show(type, text);
  };

  const applyPersonContact = (contact: PersonContact | null) => {
    setSelectedContact(contact);
    if (!contact) return;
    setContactPerson(formatContactName(contact) || contact.name || '');
    setContactEmail(contact.email || '');
    setContactMobile(contact.phone || '');
  };

  const fieldClass =
    'h-10 px-3 text-sm border border-zinc-300 rounded-lg outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200 w-full box-border bg-white text-zinc-900 placeholder:text-zinc-400 transition-colors';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [clientsRes, leadsRes, settingsRes, usersRes, pipelinesRes, specificLeadRes, requestTypesRes] = await Promise.all([
          crmApi.listClients({ limit: 200 }).catch(() => ({ data: [] as ClientItem[] })),
          // Leads the workflow allows; an older backend without the endpoint → every lead, as before.
          crmApi
            .getOpportunityLeadOptions('', initialLeadId)
            .then((res) => ({ data: res.data?.leads || [], hidden: res.data?.hidden || 0, rule: res.data?.rule || 'all' }))
            .catch(() =>
              crmApi
                .getLeads({ limit: 200 })
                .then((res) => ({ data: res.data || [], hidden: 0, rule: 'all' as const }))
                .catch(() => ({ data: [] as LeadItem[], hidden: 0, rule: 'all' as const }))
            ),
          crmApi.getSettings().catch(() => ({ data: null })),
          canAssignOwner
            ? crmApi.getAssignableUsers().catch(() => ({ data: [] as AssignableUser[] }))
            : Promise.resolve({ data: [] as AssignableUser[] }),
          crmApi.listOpportunityPipelines().catch(() => ({ data: [] as OpportunityPipeline[] })),
          initialLeadId ? crmApi.getLead(initialLeadId).catch(() => null) : Promise.resolve(null),
          crmApi.listRequestTypes({ includeDisabled: true }).catch(() => ({ data: [] as RequestType[] })),
        ]);
        if (cancelled) return;
        setClients(clientsRes.data || []);
        setRequestTypes(Array.isArray(requestTypesRes?.data) ? requestTypesRes.data : []);
        let allLeads: LeadItem[] = leadsRes.data || [];
        setHiddenLeadCount(leadsRes.hidden || 0);
        setLeadRule(leadsRes.rule === 'qualified_or_ready' ? 'qualified_or_ready' : 'all');
        // A lead opened from its page is added when the rule allows every lead; otherwise only
        // offered leads can be chosen (the server refuses the rest with the reason).
        // A lead converted into a client is never offered (no new opportunity from it).
        if (specificLeadRes?.data && leadsRes.rule !== 'qualified_or_ready' && !specificLeadRes.data.convertedClientId) {
          if (!allLeads.some((l) => l._id === specificLeadRes.data._id)) {
            allLeads = [specificLeadRes.data, ...allLeads];
          }
        }
        setLeads(allLeads);
        const loadedPipelines = Array.isArray(pipelinesRes?.data) ? pipelinesRes.data : [];
        setPipelines(loadedPipelines);
        const linkedLeadOffered = Boolean(initialLeadId) && allLeads.some((l) => l._id === initialLeadId);
        if (initialLeadId && !linkedLeadOffered) {
          // A lead the workflow does not offer is never synced or prefilled: the lead stays empty, with the reason.
          const reason = specificLeadRes?.data?.convertedClientId
            ? 'This lead is already a client — a new opportunity cannot be created from it.'
            : leadsRes.rule === 'qualified_or_ready'
              ? "This lead is not ready for an opportunity yet — only Qualified leads and leads that meet the workspace's requirements can be used."
              : 'The lead from the link could not be loaded — choose a lead.';
          setLeadPrefillDone(true);
          setLeadId('');
          setLeadLinkProblem(reason);
          showToast(reason, 'warning');
        } else if (specificLeadRes?.data) {
          setLeadPrefillDone(true);
          setLinkType('lead');
          setLeadId(specificLeadRes.data._id);
          syncFromLead(specificLeadRes.data, { availablePipelines: loadedPipelines });
        }
        const users = Array.isArray(usersRes.data)
          ? usersRes.data
              .map((u) => {
                const id = String(u.id || u._id || u.userId || '').trim();
                const username = String(u.username || '').trim();
                const email = String(u.email || '').trim();
                const displayName =
                  username ||
                  u.name ||
                  email ||
                  String(u.displayName || '')
                    .replace(/\s*\([^)]*\)\s*$/, '')
                    .trim() ||
                  'User';
                return {
                  ...u,
                  id,
                  username: username || displayName,
                  name: u.name || displayName,
                  displayName,
                  email,
                  role: u.role || u.designation || '',
                  cmsRole: u.cmsRole ?? undefined,
                };
              })
              .filter((u) => {
                if (!u.id) return false;
                if (u.isClient || u.isClientUser) return false;
                const role = String(u.role || '').toLowerCase();
                if (role.includes('client') || role.includes('customer') || role.includes('portal')) {
                  return false;
                }
                return true;
              })
          : [];
        setAssignableUsers(users);

        if (settingsRes?.data) {
          const s = settingsRes.data;
          if (s.company_state) {
            setShippingState((curr) => (curr === DEFAULT_COMPANY_STATE ? s.company_state : curr));
          }
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssignOwner]);

  useEffect(() => {
    let cancelled = false;
    const fetchSuggestions = async () => {
      try {
        let list: OpportunityItemDraft[] = [];
        try {
          const res = await crmApi.getOpportunityItemSuggestions();
          if (res.data && res.data.length) list = res.data;
        } catch {
          // ignore
        }
        if (!list.length && leadId) {
          try {
            const res = await crmApi.getLeadEventItemSuggestions(leadId);
            if (res.data && res.data.length) list = res.data;
          } catch {
            // ignore
          }
        }
        if (!list.length) {
          try {
            const res = await crmApi.listOpportunities({ limit: 100 });
            const pool = new Map<string, { name: string; description: string }>();
            for (const opp of res.data || []) {
              for (const prod of opp.products || []) {
                const name = String(prod.productName || '').trim();
                if (!name) continue;
                const desc = String(prod.description || '').trim();
                const key = `${name.toLowerCase()}|${desc.toLowerCase()}`;
                if (!pool.has(key)) {
                  pool.set(key, { name, description: desc });
                }
              }
            }
            list = Array.from(pool.values());
          } catch {
            // ignore
          }
        }
        if (!cancelled) setSuggestions(list);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    };
    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    if (!openSuggestFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenSuggestFor(null);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (
        linesContainerRef.current &&
        !linesContainerRef.current.contains(e.target as Node)
      ) {
        setOpenSuggestFor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [openSuggestFor]);

  const matchesFor = useCallback(
    (line: LineDraft) => {
      const term = `${line.productName} ${line.description}`.trim().toLowerCase();
      const pool = suggestions.filter(
        (s) =>
          !lines.some(
            (l) =>
              l.key !== line.key &&
              l.productName.trim().toLowerCase() === s.name.toLowerCase() &&
              l.description.trim().toLowerCase() === s.description.toLowerCase()
          )
      );
      if (!term) return pool.slice(0, 8);
      return pool
        .filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            term.split(/\s+/).some((part) => part && (s.name.toLowerCase().includes(part) || s.description.toLowerCase().includes(part)))
        )
        .slice(0, 8);
    },
    [suggestions, lines]
  );

  const salesRepOptions = useMemo(() => {
    // Always list OpenNext CMS Sales Representative users for admin / sales manager.
    // Do NOT require the rep to already be assigned on the client or lead.
    const reps = assignableUsers.filter((u) => isAssignableSalesRepresentative(u));
    const list = reps.length > 0 ? reps : assignableUsers;
    return [...list].sort((a, b) =>
      formatAssignableUserLabel(a).localeCompare(formatAssignableUserLabel(b), undefined, {
        sensitivity: 'base',
      })
    );
  }, [assignableUsers]);

  const currentUserId = String(user?.userId || '').trim();

  const resolveLeadOwnerId = (lead: LeadItem): string => {
    const candidate = String(lead.assignedTo || lead.salesOwner || '').trim();
    if (!candidate) return '';
    if (salesRepOptions.some((u) => u.id === candidate)) return candidate;
    // Legacy free-text owner names — try match by display name
    const byName = salesRepOptions.find((u) => {
      const label = String(u.displayName || u.name || u.username || '').trim().toLowerCase();
      return label && label === candidate.toLowerCase();
    });
    return byName?.id || '';
  };

  /** The lead's budget for the Estimated Deal Value (0 when it has none). */
  const leadBudget = (lead: LeadItem): number => {
    const qual = lead.qualification;
    const comm = lead.commercialRequirement;
    const candidates: Array<number | string | null | undefined> = [
      comm?.project?.budget,
      (comm?.values as any)?.budget,
      qual?.budget,
      (lead as LeadItem & { budget?: number | string }).budget,
      qual?.expectedRevenue,
      (lead as LeadItem & { expectedRevenue?: number | null }).expectedRevenue,
      lead.value,
    ];
    if (comm?.product?.targetPrice && comm?.product?.quantity) {
      const targetVal = Number(comm.product.targetPrice) * Number(comm.product.quantity);
      if (Number.isFinite(targetVal) && targetVal > 0) {
        candidates.unshift(targetVal);
      }
    }
    for (const raw of candidates) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };

  /** Deal value filled in by the page: replaces an empty or earlier automatic value, never the agent's. */
  const applyAutoDealValue = (next: number) => {
    const before = autoFilled.current.dealValue;
    setDealValue((prev) => (!prev || prev === before ? next : prev));
    autoFilled.current.dealValue = next;
  };

  /** Currency filled in by the page (the lead's, else Settings): replaces the default or an earlier automatic one. */
  const applyAutoCurrency = (next: string) => {
    const before = autoFilled.current.currency;
    const fallback = normalizeCurrencyCode(settingsCurrency);
    setCurrency((prev) => {
      const current = normalizeCurrencyCode(prev, settingsCurrency);
      return current === before || current === fallback ? next : prev;
    });
    autoFilled.current.currency = next;
  };

  /**
   * Contact filled in by the page: each of name / email / mobile replaces an empty or earlier automatic
   * value (the agent's own entries stay). The directory contact follows the name.
   */
  const applyAutoContact = (
    next: { person: string; email: string; mobile: string },
    contact: PersonContact | null
  ) => {
    const auto = autoFilled.current;
    const now = contactRef.current;
    const replaceable = (current: string, autoValue: string) => !current.trim() || current === autoValue;
    if (replaceable(now.person, auto.person)) {
      setContactPerson(next.person);
      setSelectedContact(next.person ? contact : null);
      now.person = next.person;
      auto.person = next.person;
    } else auto.person = '';
    if (replaceable(now.email, auto.email)) {
      setContactEmail(next.email);
      now.email = next.email;
      auto.email = next.email;
    } else auto.email = '';
    if (replaceable(now.mobile, auto.mobile)) {
      setContactMobile(next.mobile);
      now.mobile = next.mobile;
      auto.mobile = next.mobile;
    } else auto.mobile = '';
  };

  /**
   * The lead was cleared or the opportunity is no longer for a lead: everything filled in from it goes
   * (title, close date, lines, declared values, contact, deal value, currency) — the agent's own entries stay.
   * Also drops any prefill still on its way.
   */
  const clearLeadAutoFill = () => {
    leadSyncSeq.current += 1;
    void applySalesFlowPrefill('');
    applyAutoContact({ person: '', email: '', mobile: '' }, null);
    applyAutoDealValue(0);
    applyAutoCurrency(normalizeCurrencyCode(settingsCurrency));
    autoFilled.current.currency = '';
  };

  const syncFromLead = (
    lead: LeadItem,
    opts?: { forceTitle?: boolean; availablePipelines?: OpportunityPipeline[] }
  ) => {
    const syncSeq = ++leadSyncSeq.current;
    {
      // The lead's own title is the agreed name for this piece of business, so
      // the deal carries it through. Leads with no title keep the old wording.
      // An earlier lead's automatic title is replaced; a title the agent typed stays.
      const leadTitle = String(lead.title || '').trim();
      const autoTitle = leadTitle || `Deal with ${lead.company || lead.contactName || lead.name || 'Lead'}`;
      const before = autoFilled.current.title;
      setTitle((prev) => (opts?.forceTitle || !prev.trim() || prev === before ? autoTitle : prev));
      autoFilled.current.title = autoTitle;
    }
    void applySalesFlowPrefill(lead._id);
    if (canAssignOwner && !salesOwner.trim()) {
      const ownerId = resolveLeadOwnerId(lead);
      if (ownerId) setSalesOwner(ownerId);
    }
    const pipes = opts?.availablePipelines || pipelines;
    let targetPipeline: OpportunityPipeline | null = null;
    if (pipelineId && pipes.length > 0) {
      targetPipeline = pipes.find((p) => p._id === pipelineId) || null;
    }

    // Deal value, currency and contact follow the chosen lead (an earlier lead's automatic values are
    // replaced or cleared; the agent's own entries stay). No lead currency → the Settings currency.
    applyAutoDealValue(leadBudget(lead));
    applyAutoCurrency(
      lead.currency ? normalizeCurrencyCode(lead.currency, settingsCurrency) : normalizeCurrencyCode(settingsCurrency)
    );
    const leadContact = {
      person: String(lead.contactName || lead.name || ''),
      email: String(lead.email || ''),
      mobile: String(lead.phone || ''),
    };
    if (lead.contactId) {
      void crmApi
        .getContact(lead.contactId)
        .then((res) => {
          if (syncSeq !== leadSyncSeq.current) return;
          if (res.data) {
            applyAutoContact(
              {
                person: formatContactName(res.data) || res.data.name || '',
                email: res.data.email || '',
                mobile: res.data.phone || '',
              },
              res.data
            );
          } else applyAutoContact(leadContact, null);
        })
        .catch(() => {
          if (syncSeq === leadSyncSeq.current) applyAutoContact(leadContact, null);
        });
    } else {
      applyAutoContact(leadContact, null);
    }

    // Commercial Requirement Match: If match score is 80% or greater, set Pipeline Stage to the second stage
    const matchScore = getLeadCommercialMatchScore(lead);
    setLeadMatchScore(matchScore);
    const pipeStages = targetPipeline?.stages?.length
      ? targetPipeline.stages
      : (displayStages.length ? displayStages : opportunityStages);
    // Not when the stage is set automatically (salesFlow.opportunityForm.startStage).
    if (!stageLockedRef.current && matchScore != null && matchScore >= 80 && pipeStages.length > 1) {
      const secondStage = pipeStages[1];
      const stageKey = (secondStage as any).key || secondStage.label || (secondStage as any).name;
      const prob = Number(secondStage.probability) || 25;
      setStage(stageKey);
      setProbability(prob);
      showToast(
        `Commercial requirement match is ${matchScore}% (≥ 80%) — Stage set to "${(secondStage as any).label || stageKey}"`,
        'info'
      );
    }
  };

  /**
   * Asks the active extension what an opportunity for this lead starts with (sales flow).
   * Without such an extension the answer is { available: false } and nothing changes.
   * Only fields that are empty or were filled automatically are replaced.
   */
  const applySalesFlowPrefill = async (forLeadId: string) => {
    const seq = ++prefillSeq.current;
    setSalesPrefill(null);
    setSalesPanels(null);
    setSalesChecks(null);
    setSalesFacts(null);
    // What the previous lead's prefill filled in goes first (the agent's own edits stay), so nothing of
    // lead A is left on lead B — also when B's prefill fails or sends fewer values. No lead: the title too.
    clearPrefilled(!forLeadId);
    if (!forLeadId) {
      setSalesPanelsLoading(false);
      return;
    }
    let data;
    setSalesPanelsLoading(true);
    try {
      data = (await crmApi.getOpportunityPrefill(forLeadId)).data;
    } catch {
      return; // older backend or no access: the form works as before
    } finally {
      if (seq === prefillSeq.current) setSalesPanelsLoading(false);
    }
    if (seq !== prefillSeq.current || !data) return;
    if (!data.available) {
      if (data.reason === 'failed') {
        setSalesPrefill({ leadId: forLeadId, warnings: [data.message || 'The extension could not prepare this opportunity — fill it in by hand.'], lines: 0 });
      }
      return;
    }
    const auto = autoFilled.current;
    setSalesPanels({ leadId: forLeadId, panels: data.panels || [] });
    setSalesChecks({ leadId: forLeadId, checks: Array.isArray(data.checks) ? data.checks : [] });
    setSalesFacts({
      leadId: forLeadId,
      facts: Array.isArray(data.facts) ? data.facts : [],
      confirms: Array.isArray(data.valueConfirms) ? data.valueConfirms : [],
    });
    // The lead's Deal Value is the Estimated Deal Value (the agent may still change it).
    if (data.dealValue !== null && data.dealValue !== undefined && Number.isFinite(Number(data.dealValue))) {
      applyAutoDealValue(Math.max(0, Number(data.dealValue)));
    }
    if (data.title) {
      const next = data.title;
      const before = auto.title;
      setTitle((prev) => (!prev.trim() || prev === before ? next : prev));
      auto.title = next;
    }
    if (data.expectedCloseDate) {
      const next = data.expectedCloseDate;
      const before = auto.closeDate;
      setExpectedCloseDate((prev) => (!prev || prev === before || prev === defaultCloseDate() ? next : prev));
      auto.closeDate = next;
    }
    // Quantity, rate and tax come with the line, so the saved rows match the quotation's rows and a
    // price agreed on the opportunity carries over to the quotation.
    const suggested = (data.lines || []).map((l) =>
      newLine({
        productName: l.name,
        description: l.description,
        quantity: lineNumber(l.quantity, 1, 100000),
        unitPrice: lineNumber(l.unitPrice, 0, 1e12),
        tax: lineNumber(l.tax, 0, 100),
      })
    );
    if (hideLinesRef.current) {
      setLines(suggested.length ? suggested : [newLine()]);
    } else if (suggested.length) {
      const before = auto.lines;
      setLines((prev) => {
        const blank = prev.every((l) => !l.productName.trim() && !l.description.trim());
        return blank || linesSignature(prev) === before ? suggested : prev;
      });
      auto.lines = linesSignature(suggested);
    }
    const values = data.values || {};
    const fields = declaredOppFieldsRef.current;
    const current = extensionValuesRef.current;
    const before = auto.values;
    const merged = { ...current };
    for (const [key, value] of Object.entries(values)) {
      if (canReplaceWithPrefill(current[key], before[key], fields.get(key))) merged[key] = value;
    }
    // Formulas follow the merged values (e.g. a day count from the new dates).
    const next = withFormulas(Array.from(fields.values()), merged);
    extensionValuesRef.current = next;
    setExtensionValues(next);
    auto.values = values;
    setSalesPrefill({ leadId: forLeadId, warnings: data.warnings || [], lines: suggested.length, notices: data.notices || [] });

    // A value the agent set before choosing this lead (not this prefill's) still needs this lead's question,
    // e.g. a field changed by hand to a value that this lead's records are not ready for.
    const confirms: ExtensionValueConfirm[] = Array.isArray(data.valueConfirms) ? data.valueConfirms : [];
    for (const ask of confirms) {
      const held = current[ask.field];
      const setByAgent = !canReplaceWithPrefill(held, undefined, fields.get(ask.field));
      if (!setByAgent || String(held ?? '') !== ask.value || String(next[ask.field] ?? '') !== ask.value) continue;
      if (String(values[ask.field] ?? '') === ask.value) continue; // this lead's own value: not the agent's
      const ok = await confirm({
        title: ask.title || 'Please confirm',
        message: ask.message,
        confirmLabel: 'Continue',
        cancelLabel: 'Change it back',
      });
      if (seq !== prefillSeq.current) return;
      if (!ok) {
        const fallback = values[ask.field] !== undefined ? values[ask.field] : '';
        const reverted = withFormulas(Array.from(declaredOppFieldsRef.current.values()), {
          ...extensionValuesRef.current,
          [ask.field]: fallback,
        });
        extensionValuesRef.current = reverted;
        setExtensionValues(reverted);
      }
    }
  };

  /**
   * Withdraws what the last prefill filled in, wherever the agent has not changed it: declared values go
   * back to empty (or their declared default), the close date to the default, the product lines to one
   * empty row; the title only when `withTitle` (no lead any more).
   */
  const clearPrefilled = (withTitle: boolean) => {
    const auto = autoFilled.current;
    if (withTitle && auto.title) {
      const before = auto.title;
      setTitle((prev) => (prev === before ? '' : prev));
      auto.title = '';
    }
    if (auto.closeDate) {
      const before = auto.closeDate;
      setExpectedCloseDate((prev) => (prev === before ? defaultCloseDate() : prev));
      auto.closeDate = '';
    }
    // Hidden product lines belong to the chosen lead only.
    if (hideLinesRef.current) setLines([newLine()]);
    else if (auto.lines) {
      const before = auto.lines;
      setLines((prev) => (linesSignature(prev) === before ? [newLine()] : prev));
    }
    auto.lines = '';
    const previous = auto.values;
    auto.values = {};
    if (!Object.keys(previous).length) return;
    const fields = declaredOppFieldsRef.current;
    const current = extensionValuesRef.current;
    const next = { ...current };
    let changed = false;
    for (const [key, value] of Object.entries(previous)) {
      if (!(key in current) || !sameValue(current[key], value)) continue; // changed by the agent: kept
      next[key] = emptyFieldValue(fields.get(key));
      changed = true;
    }
    if (!changed) return;
    const computed = withFormulas(Array.from(fields.values()), next);
    extensionValuesRef.current = computed;
    setExtensionValues(computed);
  };

  // Prefill from ?leadId= once leads list is loaded
  useEffect(() => {
    if (leadPrefillDone || !leadId || !leads.length) return;
    const lead = leads.find((l) => l._id === leadId);
    if (!lead) return;
    setLeadPrefillDone(true);
    setLinkType('lead');
    setClientId('');
    syncFromLead(lead);
  }, [
    leadId,
    leads,
    leadPrefillDone,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPipeline = useMemo(() => {
    if (!pipelineId) return null;
    return pipelines.find((p) => p._id === pipelineId) || null;
  }, [pipelines, pipelineId]);

  const displayStages = useMemo(() => {
    if (selectedPipeline && Array.isArray(selectedPipeline.stages) && selectedPipeline.stages.length > 0) {
      const names = selectedPipeline.stages.map((s) => s.label || (s as { name?: string }).name || '').filter(Boolean);
      const probs: Record<string, number> = {};
      for (const stg of selectedPipeline.stages) {
        const key = stg.label || (stg as { name?: string }).name;
        if (key) probs[key] = Number(stg.probability) || 50;
      }
      return buildOpportunityStages(names, probs);
    }
    return opportunityStages;
  }, [selectedPipeline, opportunityStages]);

  const selectedClient = clients.find((c) => c._id === clientId);
  const selectedLead = leads.find((l) => l._id === leadId);
  const hasAccountLink = Boolean(clientId || leadId);
  const accountLinkLabel = selectedClient?.name || selectedClient?.companyName
    || selectedLead?.company || selectedLead?.contactName || selectedLead?.name
    || '';

  // Available states combining standard Indian states
  const statesList = useMemo(() => {
    return [...INDIAN_STATES].sort((a, b) => a.localeCompare(b));
  }, []);

  // Estimated Deal Value only (no weighted forecast on create form)
  const totals = useMemo(() => {
    const validLines: OpportunityProductLine[] = [];

    for (const line of lines) {
      const name = line.productName.trim();
      if (!name) continue;

      const quantity = line.quantity ?? 1;
      const unitPrice = line.unitPrice ?? 0;
      validLines.push({
        productName: name,
        description: line.description.trim(),
        quantity,
        unitPrice,
        tax: line.tax ?? 0,
        amount: Math.round(quantity * unitPrice * 100) / 100,
      });
    }

    const value = Math.max(0, Number(dealValue) || 0);

    return {
      subtotal: value,
      totalTax: 0,
      shipping: 0,
      grandTotal: value,
      validLines,
      estimatedDealValue: value,
      expectedRevenue: value,
    };
  }, [lines, dealValue]);

  const commercialBudget = useMemo(() => {
    if (linkType !== 'lead' || !selectedLead) return null;
    const comm = selectedLead.commercialRequirement;
    const targetId = String(comm?.requestTypeId || selectedLead.requestTypeId || '').trim();
    const targetKeyOrName = String(comm?.requestTypeKey || selectedLead.requestType || '').trim().toLowerCase();

    const reqType = requestTypes.find(
      (rt) =>
        (targetId && rt._id === targetId) ||
        (targetKeyOrName && rt.key?.toLowerCase() === targetKeyOrName) ||
        (targetKeyOrName && rt.name?.toLowerCase() === targetKeyOrName)
    );

    const budgetField = (reqType?.fields || []).find((field) => {
      const k = String(field?.key || '').trim().toLowerCase();
      const l = String(field?.label || '').trim().toLowerCase();
      return k === 'budget' || l === 'budget';
    });

    const pick = (...candidates: Array<number | null | undefined>): number | null => {
      for (const candidate of candidates) {
        if (candidate !== undefined && candidate !== null && Number.isFinite(Number(candidate))) {
          return Number(candidate);
        }
      }
      return null;
    };

    const min = pick(budgetField?.minAmount, budgetField?.matchNumberMin, reqType?.minBudget);
    const max = pick(budgetField?.maxAmount, budgetField?.matchNumberMax, reqType?.maxBudget);

    const rawValue =
      comm?.values && typeof comm.values === 'object' && 'budget' in (comm.values as Record<string, unknown>)
        ? (comm.values as Record<string, unknown>).budget
        : comm?.project?.budget ?? selectedLead.qualification?.expectedRevenue ?? selectedLead.value;
    const parsed = Number(rawValue);
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

    if (min == null && max == null && value == null) return null;

    return {
      min,
      max,
      value,
      requestTypeName: String(reqType?.name || selectedLead.requestType || 'Commercial Requirement').trim(),
    };
  }, [linkType, selectedLead, requestTypes]);

  const numDealValue = Math.max(0, Number(dealValue) || 0);
  const isBelowBudgetMin =
    commercialBudget?.min != null && numDealValue < commercialBudget.min;
  const isAboveBudgetMax =
    commercialBudget?.max != null && numDealValue > commercialBudget.max;
  const hasBudgetRangeError = isBelowBudgetMin || isAboveBudgetMax;

  const isSection1Done = hasAccountLink && Boolean(title.trim());
  const isSection2Done = Boolean(stage && probability !== undefined);
  const isSection3Done = Boolean(contactPerson.trim() || contactEmail.trim() || selectedContact);
  const isSection4Done = hideLines ? (linkType === 'lead' ? Boolean(leadId) : true) : totals.validLines.length > 0;

  /** Declared fields wait for a lead (salesFlow.opportunityForm.needsLead). */
  const fieldsNeedLead = Boolean(oppForm?.needsLead) && linkType === 'lead' && !leadId;
  /** ...and for the lead's prefill, so its questions (valueConfirms) cannot be skipped by typing first. */
  const prefillLoading = linkType === 'lead' && Boolean(leadId) && salesPanelsLoading;
  const fieldsLocked = fieldsNeedLead || prefillLoading;

  /** With an opportunity form: the extension's checks for this lead + one row per required declared field. */
  const formChecks = useMemo<SalesFlowCheck[]>(() => {
    if (!oppForm) return [];
    const rows: SalesFlowCheck[] = [];
    if (linkType === 'lead' && leadId && salesChecks && salesChecks.leadId === leadId) rows.push(...salesChecks.checks);
    // Live rows of the groups' count checks (countCheck.checkLabel), once the lead's numbers are known.
    if (linkType === 'lead' && leadId && salesFacts && salesFacts.leadId === leadId) {
      for (const group of declaredOppGroups) {
        const row = countCheckRow(group, extensionValues, salesFacts.facts);
        if (row) rows.push(row);
      }
    }
    for (const group of declaredOppGroups) {
      for (const field of group.fields || []) {
        if (!field.required || field.formula || field.readOnly || field.hidden) continue;
        rows.push({ label: field.label, ok: !missingRequiredFields([{ fields: [field] }], extensionValues).length });
      }
    }
    return rows;
  }, [oppForm, linkType, leadId, salesChecks, salesFacts, declaredOppGroups, extensionValues]);

  const totalChecklistItems = (hideLines ? 2 : 3) + formChecks.length;
  const checklistScore =
    (hasAccountLink ? 1 : 0) +
    (Boolean(title.trim()) ? 1 : 0) +
    (!hideLines && totals.validLines.length > 0 ? 1 : 0) +
    formChecks.filter((c) => c.ok).length;

  /** Subtitle of a locked stage section, from the pipeline's own stage labels. */
  const lockedStageText = useMemo(() => {
    const first = startStageInfo?.startStage || oppForm?.startStage?.stage || '';
    const later = startStageInfo?.readyStage ?? oppForm?.startStage?.readyStage ?? '';
    if (!first) return 'Set automatically when the opportunity is saved.';
    let text = `Set automatically — starts at "${first}"`;
    if (later) text += `; "${later}" when the lead is ready (its requirements are complete)`;
    text += '.';
    if (later && startStageInfo && linkType === 'lead' && leadId) {
      const reasons = startStageInfo.reasons && startStageInfo.reasons.length ? ` (${startStageInfo.reasons.slice(0, 3).join('; ')})` : '';
      text += startStageInfo.ready ? ` This lead is ready: "${later}".` : ` This lead is not ready yet${reasons}.`;
    }
    return text;
  }, [startStageInfo, oppForm, linkType, leadId]);

  const stepperStages = useMemo(() => {
    return displayStages.filter(
      (s) =>
        !isOpportunityLostStage(s.key) &&
        s.probability !== 100 &&
        !s.key.toLowerCase().includes('won')
    );
  }, [displayStages]);

  const currentStepIndex = useMemo(() => {
    return stepperStages.findIndex((s) => s.key === stage);
  }, [stepperStages, stage]);

  const wonStage = useMemo(() => {
    return (
      displayStages.find(
        (s) => s.probability === 100 || s.key.toLowerCase().includes('won')
      ) || {
        key: 'closed_won',
        label: 'Mark as Won (Closed)',
        probability: 100,
        icon: 'trophy',
        desc: 'Deal successfully closed and won',
      }
    );
  }, [displayStages]);

  const lostStage = useMemo(() => {
    return (
      displayStages.find((s) => isOpportunityLostStage(s.key)) || {
        key: 'closed_lost',
        label: 'Mark as Lost',
        probability: 0,
        icon: 'x',
        desc: 'Deal closed and lost',
      }
    );
  }, [displayStages]);

  // Client Selection Handler
  const handleClientChange = (newClientId: string) => {
    if (leadId) clearLeadAutoFill();
    setClientId(newClientId);
    setLeadId('');
    setSelectedContact(null);
    const client = clients.find((c) => c._id === newClientId);
    if (client) {
      const clientState =
        client.state ||
        client.billingAddress?.state ||
        client.shippingAddress?.state ||
        '';
      if (clientState) {
        const match = statesList.find(
          (s) => s.toLowerCase() === clientState.trim().toLowerCase()
        );
        if (match) {
          setShippingState(match);
        }
      }
    }
  };

  // Auto-fill Contact Info from selected client profile
  const autoFillContactDetails = () => {
    if (!selectedClient) {
      showToast('Select a client account to auto-fill contact info', 'info');
      return;
    }
    const c = selectedClient;
    const contactName = c.primaryContact?.name || c.contactPerson || '';
    const email = c.primaryContact?.email || c.email || '';
    const mobile = c.primaryContact?.phone || c.mobile || c.phone || '';

    // Client-company contact is not a PersonContact — clear directory selection.
    setSelectedContact(null);
    if (contactName) setContactPerson(contactName);
    if (email) setContactEmail(email);
    if (mobile) setContactMobile(mobile);

    showToast('Contact details auto-filled from client profile!', 'success');
  };

  const applyLinkType = (next: 'lead' | 'client') => {
    // Leaving Lead: the lead's values, title and lines go (and a prefill on its way is dropped).
    const leavingLead = linkType === 'lead' && next !== 'lead';
    setLinkType(next);
    setSelectedContact(null);
    if (next === 'lead') {
      setClientId('');
    } else {
      setLeadId('');
    }
    if (leavingLead) clearLeadAutoFill();
  };

  const handleLinkTypeChange = (next: 'lead' | 'client') => {
    linkTypeTouched.current = true;
    applyLinkType(next);
  };

  // salesFlow.opportunityForm: start with its preferred link type (a ?leadId= / ?clientId= link wins
  // when that type is allowed) and never stay on a type it does not allow.
  const linkTypesKey = oppForm ? allowedLinkTypes.join(',') : '';
  useEffect(() => {
    if (!linkTypesKey) return;
    const allowed = linkTypesKey.split(',') as Array<'lead' | 'client'>;
    if (linkTypeTouched.current && allowed.includes(linkType)) return;
    const next =
      initialLeadId && allowed.includes('lead')
        ? 'lead'
        : initialClientId && allowed.includes('client')
          ? 'client'
          : allowed[0];
    if (next !== linkType) applyLinkType(next);
  }, [linkTypesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inbound Lead Link Handler: auto-fills deal details + Estimated Deal Value from Lead budget
  const handleLeadChange = (newLeadId: string) => {
    setLeadLinkProblem('');
    setLeadId(newLeadId);
    setClientId('');
    setSelectedContact(null);
    const lead = leads.find((l) => l._id === newLeadId);
    if (lead) {
      syncFromLead(lead);
      showToast(`Linked lead: ${lead.company || lead.name}`, 'info');
    } else {
      // Lead cleared: drop its values and any prefill still on its way (a late answer must not land).
      clearLeadAutoFill();
    }
  };

  // Locked start stage: ask the server for this lead (no lead → the first stage); asked again when the lead changes.
  const startLeadId = linkType === 'lead' ? leadId : '';
  useEffect(() => {
    if (!stageLocked) {
      setStartStageInfo(null);
      return;
    }
    let cancelled = false;
    crmApi
      .getOpportunityStartStage(startLeadId || undefined)
      .then((res) => {
        if (!cancelled) setStartStageInfo(res.data && res.data.locked ? res.data : null);
      })
      .catch(() => {
        if (!cancelled) setStartStageInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [stageLocked, startLeadId]);

  useEffect(() => {
    if (!stageLocked) return;
    const label = startStageInfo?.stage || oppForm?.startStage?.stage || '';
    if (!label) return;
    const lower = label.trim().toLowerCase();
    const hit = displayStages.find((s) => s.key.toLowerCase() === lower || s.label.toLowerCase() === lower);
    setStage(hit ? hit.key : label);
    setProbability(
      startStageInfo?.probability ?? hit?.probability ?? stageProbability(hit ? hit.key : label, displayStages)
    );
  }, [stageLocked, startStageInfo, oppForm, displayStages]);

  useEffect(() => {
    if (!displayStages.length || stageLocked) return;
    if (leadMatchScore != null && leadMatchScore >= 80 && displayStages.length > 1) {
      const secondStage = displayStages[1];
      setStage(secondStage.key);
      setProbability(secondStage.probability);
      return;
    }
    setStage((prev) => {
      if (displayStages.some((s) => s.key === prev)) return prev;
      const next = displayStages[0];
      setProbability(next.probability);
      return next.key;
    });
  }, [displayStages, leadMatchScore, stageLocked]);

  // Stage selection (not when the stage is set automatically)
  const selectStage = (stageKey: string) => {
    if (stageLocked) return;
    setStage(stageKey);
    const fromStages = displayStages.find((s) => s.key === stageKey);
    setProbability(fromStages?.probability ?? stageProbability(stageKey, displayStages));
  };

  // Line Item modifications
  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    if (lines.length <= 1) {
      showToast('Opportunity must have at least one proposed item row', 'info');
      return;
    }
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  // Form Submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (linkType === 'lead' && !leadId) {
      showToast('Select a Lead to create this opportunity', 'error');
      return;
    }
    if (linkType === 'client' && !clientId) {
      showToast('Select a Client to create this opportunity', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Please enter the Opportunity Title', 'error');
      return;
    }
    if (!stageLocked && isOpportunityLostStage(stage) && !lostReason.trim()) {
      showToast('Please provide the reason why this deal was lost', 'error');
      return;
    }
    if (expectedCloseDate && expectedCloseDate < localDateIso(1)) {
      showToast('Expected close date must be a future date (tomorrow or later)', 'error');
      return;
    }
    if (!hideLines && !totals.validLines.length) {
      showToast('Please add at least one proposed item name', 'error');
      return;
    }
    if (contactMobile.trim()) {
      const split = splitPhoneNumber(contactMobile);
      if (split.dial && split.national) {
        const check = validateNationalNumber(split.dial, split.national);
        if (check.state === 'invalid' || check.state === 'incomplete') {
          showToast(`Mobile: ${check.message}`, 'error');
          return;
        }
      }
    }

    if (commercialBudget) {
      const currencySym = getCurrencySymbol(currency);
      const forType = commercialBudget.requestTypeName ? ` for ${commercialBudget.requestTypeName}` : '';
      if (commercialBudget.min != null && numDealValue < commercialBudget.min) {
        showToast(
          `Estimated Deal Value must be at least ${currencySym}${commercialBudget.min.toLocaleString()}${forType} according to commercial requirement budget (allowed range: ${currencySym}${commercialBudget.min.toLocaleString()} – ${commercialBudget.max != null ? `${currencySym}${commercialBudget.max.toLocaleString()}` : '∞'})`,
          'error'
        );
        return;
      }
      if (commercialBudget.max != null && numDealValue > commercialBudget.max) {
        showToast(
          `Estimated Deal Value cannot exceed ${currencySym}${commercialBudget.max.toLocaleString()}${forType} according to commercial requirement budget (allowed range: ${commercialBudget.min != null ? `${currencySym}${commercialBudget.min.toLocaleString()}` : `${currencySym}0`} – ${currencySym}${commercialBudget.max.toLocaleString()})`,
          'error'
        );
        return;
      }
    }

    // Declared values are checked before the opportunity is created, so it is never saved and then left
    // without them: only declared keys are sent, with the server's rules (numbers, options, required).
    const valuesToSave = Object.fromEntries(
      Object.entries(extensionValues).filter(([key]) => declaredOppFields.has(key))
    );
    if (declaredOppFields.size) {
      const missing = missingRequiredFields(declaredOppGroups, valuesToSave);
      const problem =
        invalidFieldValue(Array.from(declaredOppFields.values()), valuesToSave, oppSettingsValues) ||
        (missing.length ? `${missing[0]} is required` : null);
      if (problem) {
        showToast(`${salesFlow.extensionName || 'Extension'} details: ${problem}`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const created = await crmApi.createOpportunity({
        title: title.trim(),
        // A locked start stage: the server decides the pipeline, stage and probability.
        pipelineId: stageLocked ? undefined : pipelineId || undefined,
        clientId: linkType === 'client' ? clientId || undefined : undefined,
        clientName:
          linkType === 'client'
            ? selectedClient?.name || selectedClient?.companyName
            : undefined,
        leadId: linkType === 'lead' ? leadId || undefined : undefined,
        salesOwner: canAssignOwner ? salesOwner.trim() || undefined : undefined,
        stage: stageLocked ? undefined : stage,
        probability: stageLocked ? undefined : probability,
        expectedCloseDate: expectedCloseDate || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactMobile: contactMobile.trim() || undefined,
        contactId: selectedContact?._id || undefined,
        products: totals.validLines,
        estimatedDealValue: totals.estimatedDealValue,
        expectedRevenue: totals.estimatedDealValue,
        value: totals.estimatedDealValue,
        currency: normalizeCurrencyCode(currency, settingsCurrency),
        currencyCode: normalizeCurrencyCode(currency, settingsCurrency),
        exchangeRate: exchangeRate > 0 ? exchangeRate : 1,
        shippingState,
        shippingCharge: totals.shipping,
        lostReason: !stageLocked && isOpportunityLostStage(stage) ? lostReason.trim() : undefined,
      });
      const newId = created?.data?._id;
      // Declared values, then the extension's own copy (salesFlow.opportunityForm.savedRoute).
      // Neither undoes the saved opportunity; a values problem is shown, and the copy is not made from nothing.
      let syncProblem: string | null = null;
      if (newId && Object.keys(valuesToSave).length > 0) {
        await extensionDataApi.setValues('opportunity', newId, valuesToSave).catch((err: unknown) => {
          syncProblem = `the details were not saved (${err instanceof Error && err.message ? err.message : 'unknown error'}); add them on the opportunity page`;
        });
      }
      // Saving values already tells the extension (server side); otherwise tell it here.
      if (!syncProblem && newId && oppForm?.savedRoute && Object.keys(valuesToSave).length === 0) {
        syncProblem = await notifySalesFlowSaved('opportunity', newId);
      }
      if (syncProblem) {
        showToast(`Opportunity saved. ${salesFlow.extensionName || 'Extension'} details were not synced: ${syncProblem}`, 'warning');
        window.setTimeout(() => navigate(returnTo), 2500);
        return;
      }
      showToast('Opportunity deal created successfully!', 'success');
      navigate(returnTo);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create opportunity', 'error');
      setSaving(false);
    }
  };

  if (!canWrite) {
    return (
      <div className="flex w-full flex-col gap-4 py-12">
        <div className="bg-white border border-zinc-300 rounded-xl p-6 text-center">
          <Lock className="h-10 w-10 shrink-0 text-zinc-400 mx-auto mb-2" aria-hidden />
          <h1 className="text-lg font-bold text-zinc-950 m-0">Permission Denied</h1>
          <p className="text-sm text-zinc-500 mt-2 mb-4">
            You do not have permission to create opportunities. Contact your CRM administrator.
          </p>
          <Link
            to={returnTo}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 no-underline"
          >
            <ArrowBackIcon sx={{ fontSize: 15 }} />
            {returnTo.startsWith('/leads/') ? 'Back to lead' : 'Back to Opportunities'}
          </Link>
        </div>
      </div>
    );
  }

  if (loadingMeta) {
    return (
      <div className="p-16 text-center text-xs text-zinc-500 animate-pulse">
        Loading client accounts &amp; pipeline settings…
      </div>
    );
  }

  return (
    <div data-tour="opportunities-create-form" className="flex w-full flex-col gap-6 pb-16">
      {/* Top Header Row */}
      <div
        data-tour="opportunities-create-header"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5"
      >
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={goBack}
            className="w-[38px] h-[38px] rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-700 cursor-pointer transition-colors shrink-0 shadow-none"
            title={returnTo.startsWith('/leads/') ? 'Back to lead' : 'Back to opportunities'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 m-0">
              Sales pipeline &amp; revenue forecasting
            </div>
            <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">
                {oppForm?.title || 'New Opportunity Deal'}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-300">
                {linkType === 'lead' ? 'Lead' : 'Client'}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-300">
                {stage} · {probability}%
              </span>
            </div>
            {oppForm?.subtitle ? (
              <p className="text-xs text-zinc-500 m-0 mt-1" data-testid="opportunity-form-subtitle">{oppForm.subtitle}</p>
            ) : null}
          </div>
        </div>

        <div data-tour="opportunities-create-actions" className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={goBack}
            className="px-3.5 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors shadow-none"
            title="Cancel and discard changes"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-none inline-flex items-center gap-1.5"
            title="Save opportunity deal"
          >
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            {saving ? 'Saving Deal…' : 'Save Opportunity Deal'}
          </button>
        </div>
      </div>

      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* COLUMN 1: Form & 4 Section Cards */}
        <form
          id="form-create-opp-full"
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
          noValidate
        >
          {/* SECTION 1: Deal Overview & Account Link */}
          <section
            id="deal-overview"
            data-tour="opportunities-section-overview"
            className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="p-5 pb-3 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isSection1Done
                      ? 'bg-zinc-950 text-white'
                      : 'border border-zinc-300 text-zinc-700 bg-zinc-50'
                  }`}
                >
                  {isSection1Done ? <Check className="h-4 w-4 stroke-[2.5]" /> : '1'}
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-950 m-0">
                    Deal overview &amp; account link
                  </h2>
                  <p className="text-xs text-zinc-500 m-0 mt-0.5">
                    {allowedLinkTypes.length === 1
                      ? `Choose the ${allowedLinkTypes[0]} first, then complete the deal details.`
                      : 'Choose Lead or Client first, then complete the deal details.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-[18px]">
              {/* Toggle row (only the link types the active extension allows; hidden when just one) */}
              {allowedLinkTypes.length > 1 ? (
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[12.5px] font-semibold text-zinc-900">
                  Create opportunity for <span className="text-zinc-950 font-bold">*</span>
                </span>
                <div
                  data-tour="opportunities-create-link-type"
                  className="inline-flex rounded-lg bg-zinc-100 p-1 border border-zinc-200"
                >
                  <button
                    type="button"
                    aria-pressed={linkType === 'lead'}
                    onClick={() => handleLinkTypeChange('lead')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md cursor-pointer transition-all ${
                      linkType === 'lead'
                        ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-950 font-medium'
                    }`}
                    title="Create opportunity from an inbound sales lead"
                  >
                    <Target className="h-3.5 w-3.5 shrink-0" />
                    Lead
                  </button>
                  <button
                    type="button"
                    aria-pressed={linkType === 'client'}
                    onClick={() => handleLinkTypeChange('client')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md cursor-pointer transition-all ${
                      linkType === 'client'
                        ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-950 font-medium'
                    }`}
                    title="Create opportunity for an existing client account"
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    Client
                  </button>
                </div>
              </div>
              ) : null}

              {/* Row 1 (2 cols): Lead/Client Select + Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {linkType === 'lead' ? (
                  <div>
                    <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                      Lead <span className="text-zinc-950 font-bold">*</span>
                    </label>
                    <div data-tour="opportunities-create-lead">
                      <LeadSelect
                        leads={leads}
                        value={leadId}
                        placeholder="Select inbound lead…"
                        onChange={(nextId) => handleLeadChange(nextId)}
                        required
                      />
                      {leadRule === 'qualified_or_ready' && (
                        <p className="m-0 mt-1 text-[11px] text-zinc-500" data-testid="opportunity-lead-rule">
                          Only Qualified leads and leads that meet the workspace's requirements are listed
                          {hiddenLeadCount ? ` (${hiddenLeadCount} other lead${hiddenLeadCount === 1 ? ' is' : 's are'} not ready yet)` : ''}.
                        </p>
                      )}
                    </div>
                    {!leadId && leadLinkProblem ? (
                      <p role="alert" className="m-0 mt-1.5 text-xs text-amber-700" data-testid="opportunity-lead-link-problem">
                        {leadLinkProblem}
                      </p>
                    ) : null}
                    {!leadId ? (
                      <p className="m-0 mt-1.5 text-xs text-zinc-500">
                        Select a lead to prefill opportunity details.
                      </p>
                    ) : null}
                    {leadId && salesPrefill && salesPrefill.leadId === leadId ? (
                      <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2" data-testid="opportunity-sales-prefill">
                        {salesPrefill.lines ? (
                          <p className="m-0 text-[11.5px] text-zinc-600">
                            {hideLines
                              ? `Title, close date, deal value and ${salesPrefill.lines} item${salesPrefill.lines === 1 ? '' : 's'} were filled from the lead's requirements — review them before saving.`
                              : `Title, close date and ${salesPrefill.lines} product line${salesPrefill.lines === 1 ? '' : 's'} were filled from the lead's requirements — review them before saving.`}
                          </p>
                        ) : null}
                        {salesPrefill.warnings.length ? (
                          <ul className="m-0 mt-1 pl-4 text-[11.5px] text-amber-700 space-y-0.5">
                            {salesPrefill.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                    {leadId && salesPrefill && salesPrefill.leadId === leadId && salesPrefill.notices?.length ? (
                      <div className="mt-2">
                        <SalesFlowNotices notices={salesPrefill.notices} leadId={leadId} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                      Client <span className="text-zinc-950 font-bold">*</span>
                    </label>
                    <ClientSelect
                      clients={clients}
                      value={clientId}
                      placeholder="Select client account…"
                      onChange={(nextId) => handleClientChange(nextId)}
                      required
                    />
                    {!clientId ? (
                      <p className="m-0 mt-1.5 text-xs text-zinc-500">
                        Select a client to create this opportunity.
                      </p>
                    ) : null}
                  </div>
                )}

                <div>
                  <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                    Opportunity Deal Title <span className="text-zinc-950 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="e.g. Enterprise CRM Software & Cloud Migration"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    required
                    title="Enter opportunity deal title"
                  />
                  <p className="m-0 mt-1.5 text-xs text-zinc-500">
                    Descriptive name for proposals, quotes, and pipeline tracking.
                  </p>
                </div>
              </div>

              {/* Row 2 (3 cols): Value, Currency, Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <label className="block text-[12.5px] font-semibold text-zinc-900">
                      Estimated Deal Value
                    </label>
                    {commercialBudget && (commercialBudget.min != null || commercialBudget.max != null) && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200/80 font-mono">
                        {commercialBudget.min != null && commercialBudget.max != null
                          ? `Allowed: ${getCurrencySymbol(currency)}${commercialBudget.min.toLocaleString()} – ${getCurrencySymbol(currency)}${commercialBudget.max.toLocaleString()}`
                          : commercialBudget.min != null
                            ? `Min: ${getCurrencySymbol(currency)}${commercialBudget.min.toLocaleString()}`
                            : commercialBudget.max != null
                              ? `Max: ${getCurrencySymbol(currency)}${commercialBudget.max.toLocaleString()}`
                              : ''}
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-semibold text-zinc-400 select-none">
                      {getCurrencySymbol(currency)}
                    </span>
                    <input
                      type="number"
                      min={commercialBudget?.min != null ? commercialBudget.min : 0}
                      max={commercialBudget?.max != null ? commercialBudget.max : undefined}
                      step={100}
                      className={`${fieldClass} pl-7 font-semibold ${
                        hasBudgetRangeError
                          ? 'border-red-500 bg-red-50/20 text-red-950 focus:border-red-600 focus:ring-1 focus:ring-red-600'
                          : ''
                      }`}
                      placeholder="0"
                      value={dealValue || ''}
                      onChange={(e) => setDealValue(Math.max(0, Number(e.target.value) || 0))}
                      title="Estimated deal value"
                    />
                  </div>
                  {hasBudgetRangeError && (
                    <p className="m-0 mt-1.5 text-[11px] font-semibold text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {isBelowBudgetMin
                        ? `Deal value must be at least ${getCurrencySymbol(currency)}${commercialBudget!.min!.toLocaleString()} for ${commercialBudget!.requestTypeName}`
                        : `Deal value cannot exceed ${getCurrencySymbol(currency)}${commercialBudget!.max!.toLocaleString()} for ${commercialBudget!.requestTypeName}`}
                    </p>
                  )}
                  {commercialBudget?.value && !hasBudgetRangeError && (
                    <p className="m-0 mt-1.5 text-xs text-zinc-500">
                      Prefilled from commercial requirement budget ({getCurrencySymbol(currency)}{commercialBudget.value.toLocaleString()})
                    </p>
                  )}
                  {!commercialBudget?.value && !hasBudgetRangeError && (
                    <p className="m-0 mt-1.5 text-xs text-zinc-500">Prefilled from lead budget</p>
                  )}
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                    Currency <span className="text-zinc-950 font-bold">*</span>
                  </label>
                  <select
                    className={fieldClass}
                    value={normalizeCurrencyCode(currency, settingsCurrency)}
                    onChange={(e) => setCurrency(normalizeCurrencyCode(e.target.value, settingsCurrency))}
                    title="Currency for this deal"
                  >
                    {Array.from(new Set([...CURRENCY_OPTIONS, currency, settingsCurrency])).map((code) => (
                      <option key={code} value={code}>
                        {code} ({getCurrencySymbol(code)})
                      </option>
                    ))}
                  </select>
                  <p className="m-0 mt-1.5 text-xs text-zinc-500">
                    Default from Settings ({settingsCurrency})
                  </p>
                  {normalizeCurrencyCode(currency, settingsCurrency) !==
                    normalizeCurrencyCode(settingsCurrency) && (
                    <div className="mt-3">
                      <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                        Exchange rate <span className="text-zinc-950 font-bold">*</span>
                      </label>
                      <input
                        type="number"
                        min={0.0001}
                        step={0.0001}
                        className={fieldClass}
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                        title="Exchange rate relative to base currency"
                      />
                      <p className="m-0 mt-1.5 text-xs text-zinc-500">
                        Exchange rate to base {settingsCurrency}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                    Sales Owner
                    {canAssignOwner ? (
                      <small className="font-normal text-zinc-500"> (assign to sales rep)</small>
                    ) : null}
                  </label>
                  {canAssignOwner ? (
                    <>
                      <select
                        className={fieldClass}
                        value={salesOwner}
                        onChange={(e) => setSalesOwner(e.target.value)}
                        data-tour="opportunities-create-sales-owner"
                        title="Assigned sales owner"
                      >
                        <option value="">
                          {currentUserId
                            ? 'Assign to me (default)'
                            : 'Select sales representative…'}
                        </option>
                        {salesRepOptions.length === 0 ? (
                          <option value="" disabled>
                            No assignable sales users found
                          </option>
                        ) : (
                          salesRepOptions.map((u) => (
                            <option key={u.id} value={u.id}>
                              {formatAssignableUserLabel(u)}
                              {u.id === currentUserId ? ' (you)' : ''}
                            </option>
                          ))
                        )}
                      </select>
                      <p className="m-0 mt-1.5 text-xs text-zinc-500">Sales Rep</p>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        className={`${fieldClass} bg-zinc-50 text-zinc-600 cursor-not-allowed`}
                        value="You (current user)"
                        disabled
                        readOnly
                        title="Only admins and sales managers can assign opportunities to other sales representatives"
                      />
                      <p className="m-0 mt-1.5 text-xs text-zinc-500">Sales Rep</p>
                    </>
                  )}
                </div>
              </div>

              {/* Account preview callout */}
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {selectedClient ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {(selectedClient.name || selectedClient.companyName || 'C').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <strong className="font-bold text-zinc-950">
                        {selectedClient.name || selectedClient.companyName || 'Unnamed Client'}
                      </strong>
                      <span className="ml-1.5 inline-flex rounded-full border border-zinc-300 bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-800">
                        Client
                      </span>
                      <span className="text-zinc-500 ml-1.5 truncate">
                        · {[selectedClient.primaryContact?.name || selectedClient.contactPerson, selectedClient.email || selectedClient.primaryContact?.email].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                ) : selectedLead ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {(selectedLead.company || selectedLead.contactName || selectedLead.name || 'L').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <strong className="font-bold text-zinc-950">
                        {selectedLead.company || selectedLead.contactName || selectedLead.name || 'Lead'}
                      </strong>
                      <span className="ml-1.5 inline-flex rounded-full border border-zinc-300 bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-800">
                        Lead
                      </span>
                      <span className="text-zinc-500 ml-1.5 truncate">
                        · {[selectedLead.email, selectedLead.phone].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-400 italic">
                    Select a client account or inbound lead to preview contact details.
                  </div>
                )}

                {selectedClient && (
                  <button
                    type="button"
                    onClick={autoFillContactDetails}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 cursor-pointer transition-colors whitespace-nowrap self-start sm:self-auto inline-flex items-center gap-1.5 shrink-0"
                    title="Auto-fill primary contact details from selected client profile"
                  >
                    <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Auto-fill Contact Info
                  </button>
                )}
              </div>
            </div>
          </section>

          {oppForm ? (
            <ExtensionCreateFields
              record="opportunity"
              values={extensionValues}
              onChange={setExtensionValues}
              disabled={saving || fieldsLocked}
              disabledHint={
                fieldsNeedLead
                  ? oppForm.emptyText || 'Select a lead first.'
                  : prefillLoading
                    ? "Loading the lead's details…"
                    : undefined
              }
              currencySymbol={getCurrencySymbol(currency)}
              variant="numbered"
              startIndex={2}
              facts={linkType === 'lead' && salesFacts && salesFacts.leadId === leadId ? salesFacts.facts : []}
              confirms={linkType === 'lead' && salesFacts && salesFacts.leadId === leadId ? salesFacts.confirms : []}
            />
          ) : null}

          {/* SECTION 2: Pipeline Stage & Win Probability */}
          <section
            id="pipeline-stage"
            data-tour="opportunities-section-stage"
            className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="p-5 pb-3 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isSection2Done
                      ? 'bg-zinc-950 text-white'
                      : 'border border-zinc-300 text-zinc-700 bg-zinc-50'
                  }`}
                >
                  {isSection2Done ? <Check className="h-4 w-4 stroke-[2.5]" /> : 2 + formGroupCount}
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-950 m-0">
                    Pipeline stage &amp; win probability
                  </h2>
                  <p className="text-xs text-zinc-500 m-0 mt-0.5">
                    {stageLocked ? lockedStageText : 'Click a milestone — probability updates automatically.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-[18px]">
              {/* Stepper */}
              <div className="overflow-x-auto pb-2">
                <div className="flex items-start min-w-[520px] relative px-3 pt-2">
                  {stepperStages.map((s, idx) => {
                    const isCur = stage === s.key;
                    const isPast = currentStepIndex !== -1 && idx < currentStepIndex;
                    return (
                      <div
                        key={s.key}
                        role={stageLocked ? undefined : 'button'}
                        tabIndex={stageLocked ? undefined : 0}
                        aria-pressed={stageLocked ? undefined : isCur}
                        aria-current={stageLocked && isCur ? 'step' : undefined}
                        aria-label={`${s.label} — ${s.probability}%`}
                        onClick={stageLocked ? undefined : () => selectStage(s.key)}
                        onKeyDown={
                          stageLocked
                            ? undefined
                            : (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  selectStage(s.key);
                                }
                              }
                        }
                        title={`${s.label} — ${s.probability}% · ${s.desc || ''}`}
                        className={`flex-1 flex flex-col items-center gap-2 relative text-center rounded-lg outline-none ${
                          stageLocked ? 'cursor-default' : 'cursor-pointer group focus-visible:ring-2 focus-visible:ring-zinc-400'
                        }`}
                      >
                        {idx > 0 && (
                          <div
                            className={`absolute top-4 -left-1/2 right-1/2 h-0.5 -z-0 transition-colors ${
                              isPast || isCur ? 'bg-zinc-950' : 'bg-zinc-200'
                            }`}
                          />
                        )}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all ${
                            isCur
                              ? 'bg-white border-2 border-zinc-950 text-zinc-950 ring-4 ring-zinc-200 shadow-sm font-bold'
                              : isPast
                              ? 'bg-zinc-950 border-2 border-zinc-950 text-white'
                              : 'bg-white border-2 border-zinc-300 text-zinc-400 group-hover:border-zinc-500'
                          }`}
                        >
                          {isPast ? (
                            <Check className="h-4 w-4 stroke-[2.5]" />
                          ) : (
                            <OpportunityStageIcon iconKey={s.icon} className="h-3.5 w-3.5 shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-col items-center">
                          <b className={`text-xs font-semibold leading-tight line-clamp-2 max-w-[90px] ${isCur ? 'text-zinc-950 font-bold' : 'text-zinc-600'}`}>
                            {s.label}
                          </b>
                          <small className="text-[11px] text-zinc-400 font-medium">{s.probability}%</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Outcomes (Won / Lost) — not offered when the stage is set automatically */}
              {!stageLocked && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => selectStage(wonStage.key)}
                  title="Mark opportunity as Won (100% probability)"
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-1.5 border-dashed cursor-pointer transition-all text-xs font-semibold ${
                    stage === wonStage.key
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                      : 'bg-white border-zinc-300 text-zinc-800 hover:border-zinc-950 hover:bg-zinc-50'
                  }`}
                >
                  <Trophy className="h-4 w-4 shrink-0" />
                  <span>Mark as Won (Closed)</span>
                  <span className={`ml-auto font-bold text-xs ${stage === wonStage.key ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    100%
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => selectStage(lostStage.key)}
                  title={`Mark opportunity as Lost (${lostStage.probability || 0}% probability)`}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-1.5 border-dashed cursor-pointer transition-all text-xs font-semibold ${
                    isOpportunityLostStage(stage)
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                      : 'bg-white border-zinc-300 text-zinc-800 hover:border-zinc-950 hover:bg-zinc-50'
                  }`}
                >
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>Mark as Lost</span>
                  <span className={`ml-auto font-bold text-xs ${isOpportunityLostStage(stage) ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {lostStage.probability || 0}%
                  </span>
                </button>
              </div>
              )}

              {/* Current-stage panel */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight shrink-0">
                  {probability}%
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <b className="text-sm font-bold text-zinc-950">
                    {displayStages.find((s) => s.key === stage)?.label || stage}
                  </b>
                  <div className="text-xs text-zinc-500 m-0 mt-0.5 line-clamp-1">
                    {displayStages.find((s) => s.key === stage)?.desc || 'Track progress along the pipeline.'}
                  </div>
                </div>
                <div className="w-full sm:w-56 shrink-0">
                  <label className="block text-[12px] font-semibold text-zinc-700 mb-1">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      Expected close date
                    </span>
                  </label>
                  <input
                    type="date"
                    className={fieldClass}
                    min={localDateIso(1)}
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    title="Expected close date"
                  />
                </div>
              </div>

              {/* Lost Reason Panel */}
              {!stageLocked && isOpportunityLostStage(stage) && (
                <div className="p-3.5 bg-zinc-50 border border-zinc-950 rounded-xl flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-950 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-zinc-950" />
                    Reason for Lost Deal *
                  </label>
                  <textarea
                    rows={2}
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    placeholder="e.g. Budget constraints, Competitor chosen (Vendor X), Project delayed indefinitely"
                    className="w-full p-2.5 text-xs border border-zinc-300 rounded-lg outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200 bg-white resize-y"
                    required
                    title="Provide specific reason why the deal was lost"
                  />
                </div>
              )}
            </div>
          </section>

          {/* SECTION 3: Primary Contact Person */}
          <section
            id="primary-contact"
            data-tour="opportunities-section-contact"
            className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="p-5 pb-3 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isSection3Done
                      ? 'bg-zinc-950 text-white'
                      : 'border border-zinc-300 text-zinc-700 bg-zinc-50'
                  }`}
                >
                  {isSection3Done ? <Check className="h-4 w-4 stroke-[2.5]" /> : 3 + formGroupCount}
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-950 m-0">
                    Primary contact person
                  </h2>
                  <p className="text-xs text-zinc-500 m-0 mt-0.5">
                    Only contacts related to the selected lead or client are shown.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-[18px]">
              <ContactSelect
                value={selectedContact}
                disabled={saving}
                leadId={leadId}
                clientId={clientId}
                requireRelatedScope
                onChange={(contact) => {
                  if (!contact) {
                    setSelectedContact(null);
                    return;
                  }
                  applyPersonContact(contact);
                }}
                hint="Select a lead or client first. Only related contacts are listed."
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                    Contact name
                  </label>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="Full name"
                    value={contactPerson}
                    onChange={(e) => {
                      setContactPerson(e.target.value);
                      if (selectedContact) setSelectedContact(null);
                    }}
                    title="Primary contact person name"
                  />
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    className={fieldClass}
                    placeholder="name@company.com"
                    value={contactEmail}
                    onChange={(e) => {
                      setContactEmail(e.target.value);
                      if (selectedContact) setSelectedContact(null);
                    }}
                    title="Primary contact email address"
                  />
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-zinc-900 mb-1.5">
                    Mobile / phone
                  </label>
                  <PhoneNumberField
                    value={contactMobile}
                    onChange={(val) => {
                      setContactMobile(val);
                      if (selectedContact) setSelectedContact(null);
                    }}
                    inputClassName={fieldClass}
                    placeholder="98765 43210"
                  />
                </div>
              </div>
            </div>
          </section>

          {hideLines ? (
            linkType === 'lead' ? (
              <section
                id="line-items"
                data-testid="opportunity-sales-panels"
                className="rounded-xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="p-5 pb-3 border-b border-zinc-100 flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isSection4Done ? 'bg-zinc-950 text-white' : 'border border-zinc-300 text-zinc-700 bg-zinc-50'
                    }`}
                  >
                    {isSection4Done ? <Check className="h-4 w-4 stroke-[2.5]" /> : 4 + formGroupCount}
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-950 m-0">Lead requirements</h2>
                    <p className="text-xs text-zinc-500 m-0 mt-0.5">
                      Taken from the selected lead. Completed requirements are saved as this opportunity's items.
                    </p>
                  </div>
                </div>
                <div className="p-5">
                  {!leadId ? (
                    <p className="m-0 text-xs text-zinc-500">{oppForm?.emptyText || 'Select a lead to see its requirements.'}</p>
                  ) : (
                    <SalesFlowPanels
                      loading={salesPanelsLoading}
                      panels={salesPanels && salesPanels.leadId === leadId ? salesPanels.panels : []}
                      placeholder="No requirement details for this lead."
                    />
                  )}
                </div>
              </section>
            ) : null
          ) : (
          /* SECTION 4: Proposed Products & Line Items */
          <section
            id="line-items"
            data-tour="opportunities-section-products"
            className="rounded-xl border border-zinc-200 bg-white shadow-sm"
          >
            <div className="p-5 pb-3 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isSection4Done
                      ? 'bg-zinc-950 text-white'
                      : 'border border-zinc-300 text-zinc-700 bg-zinc-50'
                  }`}
                >
                  {isSection4Done ? <Check className="h-4 w-4 stroke-[2.5]" /> : 4 + formGroupCount}
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-950 m-0">
                    {terms.proposedLines}
                  </h2>
                  <p className="text-xs text-zinc-500 m-0 mt-0.5">
                    Add products or billable items for this proposal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    newLine({ productName: '', description: '' }),
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-800 cursor-pointer transition-colors shadow-none"
                title="Add proposed product or item"
              >
                <AddIcon sx={{ fontSize: 14 }} />
                Add item
              </button>
            </div>

            <div ref={linesContainerRef} className="p-5 space-y-2.5">
              {/* Header row */}
              <div className="grid grid-cols-[24px_28px_1fr_1.4fr_34px] gap-2.5 items-center text-[11px] font-semibold tracking-wider uppercase text-zinc-400 px-1">
                <span></span>
                <span className="text-center">#</span>
                <span>Item name *</span>
                <span>Description</span>
                <span></span>
              </div>

              {/* Rows */}
              {lines.map((line, idx) => {
                const matches = openSuggestFor === line.key ? matchesFor(line) : [];
                return (
                  <div
                    key={line.key}
                    className="relative grid grid-cols-[24px_28px_1fr_1.4fr_34px] gap-2.5 items-center"
                  >
                    <GripVertical className="h-4 w-4 text-zinc-300 shrink-0 select-none" />
                    <b className="text-xs font-bold text-zinc-400 text-center select-none">
                      {idx + 1}
                    </b>
                    <input
                      type="text"
                      value={line.productName}
                      onChange={(e) =>
                        updateLine(line.key, { productName: e.target.value })
                      }
                      onFocus={() => setOpenSuggestFor(line.key)}
                      placeholder={terms.hideShipping ? 'Service name' : 'Item name / Product name'}
                      className={fieldClass}
                      required
                      autoComplete="off"
                      title={terms.hideShipping ? 'Service name' : 'Product or service item name'}
                    />
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.key, { description: e.target.value })
                      }
                      onFocus={() => setOpenSuggestFor(line.key)}
                      placeholder="Item description / specifications (optional)"
                      className={fieldClass}
                      autoComplete="off"
                      title="Optional item specifications or details"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length <= 1}
                      className="w-[34px] h-[34px] rounded-lg border border-zinc-300 bg-white hover:bg-zinc-950 hover:text-white text-zinc-600 inline-flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remove item"
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </button>

                    {matches.length > 0 && (
                      <div className="absolute left-[56px] right-[44px] top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl">
                        <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Used on other opportunities
                        </div>
                        {matches.map((match) => (
                          <button
                            key={`${match.name}|${match.description}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              updateLine(line.key, {
                                productName: match.name,
                                description: match.description,
                              });
                              setOpenSuggestFor(null);
                            }}
                            className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left hover:bg-zinc-50 transition-colors"
                          >
                            <span className="block text-xs font-semibold text-zinc-900">
                              {match.name}
                            </span>
                            {match.description ? (
                              <span className="block text-[11px] text-zinc-500">
                                {match.description}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {oppForm ? null : (
            <ExtensionCreateFields
              record="opportunity"
              values={extensionValues}
              onChange={setExtensionValues}
              disabled={saving || prefillLoading}
              currencySymbol={getCurrencySymbol(currency)}
            />
          )}

          {/* Bottom Actions Bar */}
          <div
            className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center justify-between shadow-sm"
          >
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors shadow-none"
              title="Cancel and return to previous page"
            >
              {returnTo.startsWith('/leads/') ? 'Back to lead' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-none inline-flex items-center gap-1.5"
              title="Submit and save opportunity deal"
            >
              <Save className="h-4 w-4 shrink-0" aria-hidden />
              {saving ? 'Saving Deal…' : 'Save Opportunity Deal'}
            </button>
          </div>
        </form>

        {/* COLUMN 3: Sticky Summary Sidebar */}
        <aside
          data-tour="opportunities-create-sidebar"
          className="sticky top-5 flex flex-col gap-4"
        >
          {/* Estimated Deal Value Dark Card */}
          <div className="rounded-xl bg-zinc-950 text-white p-4 shadow-sm flex flex-col gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Estimated Deal Value
              </span>
              <div className="text-[28px] font-extrabold text-white mt-0.5 tracking-tight">
                {formatCrmMoney(totals.estimatedDealValue, currency, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
            <div className="border-t border-zinc-800 pt-2.5 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Weighted forecast ({probability}%)</span>
              <strong className="text-white font-bold">
                {formatCrmMoney((totals.estimatedDealValue * (probability || 0)) / 100, currency, {
                  maximumFractionDigits: 0,
                })}
              </strong>
            </div>
          </div>

          {/* Key-Value Details Card */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col gap-3.5 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Account link
              </span>
              <b className="text-zinc-900 font-bold">
                {accountLinkLabel || <em className="text-zinc-400 font-normal">None selected</em>}
              </b>
              <small className="text-zinc-500 font-medium">
                {clientId && leadId
                  ? 'Client + lead linked'
                  : leadId && !clientId
                  ? 'Lead only'
                  : clientId
                  ? 'Client only'
                  : ''}
              </small>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Opportunity title
              </span>
              <b className="text-zinc-900 font-bold break-words">
                {title.trim() || <em className="text-zinc-400 font-normal">Untitled deal</em>}
              </b>
            </div>

            {!hideLines && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Proposed items
                </span>
                <b className="text-zinc-900 font-bold">{totals.validLines.length} item(s)</b>
              </div>
            )}

            <hr className="border-0 border-t border-zinc-200 my-0.5" />

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-zinc-900 mb-2">
                <span>Checklist</span>
                <div className="flex-1 mx-3 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 transition-all duration-300"
                    style={{ width: `${(checklistScore / totalChecklistItems) * 100}%` }}
                  />
                </div>
                <span className="text-zinc-500 font-medium">{checklistScore}/{totalChecklistItems}</span>
              </div>
              <ul className="list-none p-0 m-0 flex flex-col gap-2 text-xs">
                <li className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      hasAccountLink
                        ? 'bg-zinc-950 text-white'
                        : 'border border-dashed border-zinc-400 text-transparent'
                    }`}
                  >
                    <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                  </span>
                  <span className={hasAccountLink ? 'text-zinc-900 font-medium' : 'text-zinc-400'}>
                    {hasAccountLink
                      ? `${clientId ? 'Client' : 'Lead'}: ${accountLinkLabel || 'Selected'}`
                      : linkType === 'lead'
                        ? 'Lead selected'
                        : 'Client selected'}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      title.trim()
                        ? 'bg-zinc-950 text-white'
                        : 'border border-dashed border-zinc-400 text-transparent'
                    }`}
                  >
                    <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                  </span>
                  <span className={title.trim() ? 'text-zinc-900 font-medium' : 'text-zinc-400'}>
                    {title.trim()
                      ? `Title: ${title.slice(0, 24)}${title.length > 24 ? '…' : ''}`
                      : 'Opportunity title entered'}
                  </span>
                </li>
                {!hideLines && (
                  <li className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        totals.validLines.length > 0
                          ? 'bg-zinc-950 text-white'
                          : 'border border-dashed border-zinc-400 text-transparent'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                    </span>
                    <span className={totals.validLines.length > 0 ? 'text-zinc-900 font-medium' : 'text-zinc-400'}>
                      {totals.validLines.length > 0
                        ? `${totals.validLines.length} proposed item(s)`
                        : 'Proposed items added'}
                    </span>
                  </li>
                )}
                {formChecks.map((check, i) => (
                  <li key={`form-check-${i}`} className="flex items-start gap-2" data-testid="opportunity-form-check">
                    <span
                      className={`mt-px w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        check.ok
                          ? 'bg-zinc-950 text-white'
                          : 'border border-dashed border-zinc-400 text-transparent'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block break-words ${check.ok ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                        {check.label}
                      </span>
                      {check.hint ? (
                        <span className="block text-[11px] text-zinc-500 break-words">{check.hint}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pipeline Workflow Tip Card */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-xs text-zinc-600 leading-relaxed shadow-sm">
            <strong className="flex items-center gap-1.5 text-xs font-bold text-zinc-950 mb-1">
              <Lightbulb className="h-4 w-4 shrink-0 text-zinc-900" aria-hidden />
              Pipeline workflow
            </strong>
            <p className="m-0 text-zinc-600">
              Once saved, track stage transitions, request product samples and convert winning deals into GST Quotations &amp; Sales Orders in one click.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
