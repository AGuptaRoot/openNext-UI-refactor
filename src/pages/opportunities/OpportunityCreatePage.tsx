import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import {
  OpportunityProductLine,
  DEAL_TEMPLATES,
  INDIAN_STATES,
  DEFAULT_STATE_SHIPPING_RATES,
  stageProbability,
  isOpportunityLostStage,
} from '../../types/opportunities';
import { ClientItem } from '../../types/clients';
import { LeadItem, AssignableUser } from '../../types/leads';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { ContactSelect } from '../../components/contacts/ContactSelect';
import { PersonContact, formatContactName } from '../../types/contacts';
import { useOpportunityStages } from '../../hooks/useOpportunityStages';
import {
  canAssignOpportunityOwner,
  formatAssignableUserLabel,
  isAssignableSalesRepresentative,
} from '../../utils/permissions';

const DEFAULT_COMPANY_STATE = 'Maharashtra';
const DEFAULT_FREE_SHIPPING_THRESHOLD = 5000;
const TAX_OPTIONS = [0, 5, 12, 18, 28];

type LineDraft = {
  key: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  tax: number;
};

function newLine(partial?: Partial<LineDraft>): LineDraft {
  return {
    key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productName: partial?.productName ?? 'General Product / Service Scope',
    quantity: partial?.quantity ?? 1,
    unitPrice: partial?.unitPrice ?? 10000,
    tax: partial?.tax ?? 18,
  };
}

function defaultCloseDate() {
  return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
}

function safeReturnPath(raw: string | null): string {
  const value = String(raw || '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/opportunities';
  return value;
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
  const defaultStage = opportunityStages[0];

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Settings
  const [companyState, setCompanyState] = useState(DEFAULT_COMPANY_STATE);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(DEFAULT_FREE_SHIPPING_THRESHOLD);
  const [settingsRates, setSettingsRates] = useState<Record<string, number>>(DEFAULT_STATE_SHIPPING_RATES);

  // Form State
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(searchParams.get('clientId') || '');
  const [leadId, setLeadId] = useState(searchParams.get('leadId') || '');
  const [salesOwner, setSalesOwner] = useState('');
  const [selectedContact, setSelectedContact] = useState<PersonContact | null>(null);
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [stage, setStage] = useState(defaultStage?.key || 'Discovery');
  const [probability, setProbability] = useState(defaultStage?.probability ?? 10);
  const [expectedCloseDate, setExpectedCloseDate] = useState(defaultCloseDate());
  const [lostReason, setLostReason] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [shippingState, setShippingState] = useState(DEFAULT_COMPANY_STATE);
  const [shippingCharge, setShippingCharge] = useState(
    DEFAULT_STATE_SHIPPING_RATES[DEFAULT_COMPANY_STATE] ?? 100
  );
  const [shippingOverridden, setShippingOverridden] = useState(false);
  const [leadPrefillDone, setLeadPrefillDone] = useState(false);

  const goBack = () => navigate(returnTo);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const applyPersonContact = (contact: PersonContact | null) => {
    setSelectedContact(contact);
    if (!contact) return;
    setContactPerson(formatContactName(contact) || contact.name || '');
    setContactEmail(contact.email || '');
    setContactMobile(contact.phone || '');
  };

  const fieldClass =
    'h-9 px-3 text-xs border border-zinc-300 rounded-lg outline-none focus:border-zinc-950 w-full box-border bg-white text-zinc-900 placeholder:text-zinc-400';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [clientsRes, leadsRes, settingsRes, usersRes] = await Promise.all([
          crmApi.listClients({ limit: 200 }).catch(() => ({ data: [] as ClientItem[] })),
          crmApi.getLeads({ limit: 200 }).catch(() => ({ data: [] as LeadItem[] })),
          crmApi.getSettings().catch(() => ({ data: null })),
          canAssignOwner
            ? crmApi.getAssignableUsers().catch(() => ({ data: [] as AssignableUser[] }))
            : Promise.resolve({ data: [] as AssignableUser[] }),
        ]);
        if (cancelled) return;
        setClients(clientsRes.data || []);
        setLeads(leadsRes.data || []);
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
            setCompanyState(s.company_state);
            setShippingState((curr) => (curr === DEFAULT_COMPANY_STATE ? s.company_state : curr));
          }
          if (s.free_shipping_threshold != null) {
            setFreeShippingThreshold(Number(s.free_shipping_threshold));
          }
          if (s.state_shipping_rates && Object.keys(s.state_shipping_rates).length > 0) {
            setSettingsRates(s.state_shipping_rates);
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

  // Prefill from ?leadId= once leads list is loaded
  useEffect(() => {
    if (leadPrefillDone || !leadId || !leads.length) return;
    const lead = leads.find((l) => l._id === leadId);
    if (!lead) return;
    setLeadPrefillDone(true);
    if (!title.trim()) {
      setTitle(`Deal with ${lead.company || lead.contactName || lead.name || 'Lead'}`);
    }
    if (canAssignOwner && !salesOwner.trim()) {
      const ownerId = resolveLeadOwnerId(lead);
      if (ownerId) setSalesOwner(ownerId);
    }
    if (lead.contactId) {
      void crmApi
        .getContact(lead.contactId)
        .then((res) => {
          if (res.data) applyPersonContact(res.data);
        })
        .catch(() => {
          if (!contactPerson.trim() && (lead.contactName || lead.name)) {
            setContactPerson(lead.contactName || lead.name || '');
          }
          if (!contactEmail.trim() && lead.email) setContactEmail(lead.email);
          if (!contactMobile.trim() && lead.phone) setContactMobile(lead.phone);
        });
    } else {
      if (!contactPerson.trim() && (lead.contactName || lead.name)) {
        setContactPerson(lead.contactName || lead.name || '');
      }
      if (!contactEmail.trim() && lead.email) setContactEmail(lead.email);
      if (!contactMobile.trim() && lead.phone) setContactMobile(lead.phone);
    }
  }, [
    leadId,
    leads,
    leadPrefillDone,
    title,
    contactPerson,
    contactEmail,
    contactMobile,
    salesOwner,
    canAssignOwner,
    salesRepOptions,
  ]);

  const selectedClient = clients.find((c) => c._id === clientId);
  const selectedLead = leads.find((l) => l._id === leadId);
  const hasAccountLink = Boolean(clientId || leadId);
  const accountLinkLabel = selectedClient?.name || selectedClient?.companyName
    || selectedLead?.company || selectedLead?.contactName || selectedLead?.name
    || '';

  // Available states combining settings rates and standard Indian states
  const statesList = useMemo(() => {
    const fromRates = Object.keys(settingsRates);
    const combined = Array.from(new Set([...fromRates, ...INDIAN_STATES]));
    return combined.sort((a, b) => a.localeCompare(b));
  }, [settingsRates]);

  const isIntra = shippingState.toLowerCase() === companyState.toLowerCase();

  // Financial Totals: subtotal = sum(qty * unitPrice), gst = sum(rowBase * tax / 100)
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    const validLines: OpportunityProductLine[] = [];

    for (const line of lines) {
      const name = line.productName.trim();
      if (!name) continue;
      const qty = Math.max(1, Number(line.quantity) || 1);
      const price = Math.max(0, Number(line.unitPrice) || 0);
      const tax = Math.max(0, Number(line.tax) || 0);
      const base = Math.round(qty * price * 100) / 100;
      const taxAmt = (base * tax) / 100;

      subtotal += base;
      totalTax += taxAmt;

      validLines.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        tax,
        amount: base,
      });
    }

    const ship = Math.max(0, Number(shippingCharge) || 0);
    const roundedSubtotal = Math.round(subtotal * 100) / 100;
    const roundedTax = Math.round(totalTax * 100) / 100;
    const grandTotal = Math.round((roundedSubtotal + roundedTax + ship) * 100) / 100;
    const weightedForecast = Math.round(grandTotal * (probability / 100) * 100) / 100;

    return {
      subtotal: roundedSubtotal,
      totalTax: roundedTax,
      shipping: ship,
      grandTotal,
      weightedForecast,
      validLines,
      expectedRevenue: roundedSubtotal,
    };
  }, [lines, shippingCharge, probability]);

  // Dynamic Shipping Calculation based on state & free shipping threshold
  useEffect(() => {
    if (shippingOverridden) return;
    const rate = settingsRates[shippingState] ?? (shippingState === companyState ? 100 : 150);
    if (totals.subtotal >= freeShippingThreshold && totals.subtotal > 0) {
      setShippingCharge(0);
    } else {
      setShippingCharge(rate);
    }
  }, [shippingState, totals.subtotal, shippingOverridden, settingsRates, companyState, freeShippingThreshold]);

  // Client Selection Handler
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
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
          setShippingOverridden(false);
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

  // Inbound Lead Link Handler: auto-fills deal details
  const handleLeadChange = (newLeadId: string) => {
    setLeadId(newLeadId);
    setSelectedContact(null);
    const lead = leads.find((l) => l._id === newLeadId);
    if (lead) {
      if (!title.trim()) {
        setTitle(`Deal with ${lead.company || lead.contactName || lead.name || 'Lead'}`);
      }
      if (canAssignOwner && !salesOwner.trim()) {
        const ownerId = resolveLeadOwnerId(lead);
        if (ownerId) setSalesOwner(ownerId);
      }
      // Prefer Contacts-module person linked to the lead when available
      if (lead.contactId) {
        void crmApi
          .getContact(lead.contactId)
          .then((res) => {
            if (res.data) applyPersonContact(res.data);
          })
          .catch(() => {
            if (!contactPerson.trim() && (lead.contactName || lead.name)) {
              setContactPerson(lead.contactName || lead.name || '');
            }
            if (!contactEmail.trim() && lead.email) setContactEmail(lead.email);
            if (!contactMobile.trim() && lead.phone) setContactMobile(lead.phone);
          });
      } else {
        if (!contactPerson.trim() && (lead.contactName || lead.name)) {
          setContactPerson(lead.contactName || lead.name || '');
        }
        if (!contactEmail.trim() && lead.email) setContactEmail(lead.email);
        if (!contactMobile.trim() && lead.phone) setContactMobile(lead.phone);
      }
      showToast(`Linked lead: ${lead.company || lead.name}`, 'info');
    }
  };

  // Quick Deal Templates
  const applyTemplate = (idx: number) => {
    const tpl = DEAL_TEMPLATES[idx];
    if (!tpl) return;
    setTitle(tpl.title);
    setLines(
      tpl.items.map((item) =>
        newLine({
          productName: item.name,
          quantity: item.qty,
          unitPrice: item.price,
          tax: item.tax,
        })
      )
    );
    setShippingOverridden(false);
    showToast(`Loaded template: "${tpl.label}"`, 'info');
  };

  useEffect(() => {
    if (!opportunityStages.length) return;
    setStage((prev) => {
      if (opportunityStages.some((s) => s.key === prev)) return prev;
      const next = opportunityStages[0];
      setProbability(next.probability);
      return next.key;
    });
  }, [opportunityStages]);

  // Stage selection
  const selectStage = (stageKey: string) => {
    setStage(stageKey);
    const fromSettings = opportunityStages.find((s) => s.key === stageKey);
    setProbability(fromSettings?.probability ?? stageProbability(stageKey, opportunityStages));
  };

  // Line Item modifications
  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    if (lines.length <= 1) {
      showToast('Opportunity must have at least one product row', 'info');
      return;
    }
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const stepQty = (key: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = Math.max(1, (Number(l.quantity) || 1) + delta);
        return { ...l, quantity: next };
      })
    );
  };

  // Form Submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!clientId && !leadId) {
      showToast('Select a Client Account or an Inbound Lead', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Please enter the Opportunity Title', 'error');
      return;
    }
    if (isOpportunityLostStage(stage) && !lostReason.trim()) {
      showToast('Please provide the reason why this deal was lost', 'error');
      return;
    }
    if (!totals.validLines.length) {
      showToast('Please add at least one product line item', 'error');
      return;
    }

    setSaving(true);
    try {
      await crmApi.createOpportunity({
        title: title.trim(),
        clientId: clientId || undefined,
        clientName: selectedClient?.name || selectedClient?.companyName,
        leadId: leadId || undefined,
        salesOwner: canAssignOwner ? salesOwner.trim() || undefined : undefined,
        stage,
        probability,
        expectedCloseDate: expectedCloseDate || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactMobile: contactMobile.trim() || undefined,
        contactId: selectedContact?._id || undefined,
        products: totals.validLines,
        expectedRevenue: totals.expectedRevenue,
        value: totals.expectedRevenue,
        currency: 'INR',
        shippingState,
        shippingCharge: totals.shipping,
        lostReason: isOpportunityLostStage(stage) ? lostReason.trim() : undefined,
      });
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
          <span className="text-3xl block mb-2">🔒</span>
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

  const shippingRuleLabel =
    totals.subtotal >= freeShippingThreshold && totals.subtotal > 0 && !shippingOverridden
      ? `Free Shipping (≥ ₹${freeShippingThreshold.toLocaleString('en-IN')})`
      : shippingOverridden
        ? 'Manual Override'
        : `${shippingState} Rate`;

  return (
    <div data-tour="opportunities-create-form" className="flex w-full flex-col gap-5 pb-16">
      {toast && (
        <div
          className={`fixed top-20 right-6 z-[80] px-4 py-2.5 rounded-lg text-xs font-semibold border ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : toast.type === 'info'
                ? 'bg-sky-50 text-sky-800 border-sky-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Top Header Card */}
      <div
        data-tour="opportunities-create-header"
        className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
          >
            <ArrowBackIcon sx={{ fontSize: 15 }} />
            {returnTo.startsWith('/leads/') ? 'Back to lead' : 'Back'}
          </button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 m-0">
              Sales Pipeline &amp; Revenue Forecasting
            </p>
            <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight flex items-center gap-2">
                <span>💼</span> New Opportunity Deal
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {stage} ({probability}%)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={goBack}
            className="px-3.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-none"
          >
            {saving ? 'Saving Deal…' : '💾 Save Opportunity Deal'}
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-5 items-start">
        <form
          id="form-create-opp-full"
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          noValidate
        >
          {/* SECTION 1: Deal Overview & Client Account */}
          <div
            data-tour="opportunities-section-overview"
            className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-4"
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-3">
              <span className="text-xl">🏢</span>
              <div>
                <h2 className="text-sm font-bold text-zinc-950 m-0">
                  1. Deal Overview &amp; Account Link
                </h2>
                <p className="text-xs text-zinc-500 m-0 mt-0.5">
                  Link either a client account or an inbound lead (at least one), then assign sales ownership.
                </p>
              </div>
            </div>

            {/* Quick Deal Templates Chips */}
            <div>
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
                Quick Deal Templates
              </span>
              <div className="flex flex-wrap gap-2">
                {DEAL_TEMPLATES.map((tpl, idx) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => applyTemplate(idx)}
                    className="px-3 py-1 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-700 cursor-pointer transition-colors"
                  >
                    ⚡ {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title & account link (client OR lead) */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Opportunity Deal Title *
                </label>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="e.g. Enterprise CRM Software & Cloud Migration"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Client Account
                    <small className="font-normal text-zinc-500"> (or lead below)</small>
                  </label>
                  <ClientSelect
                    clients={clients}
                    value={clientId}
                    placeholder="Select client account…"
                    onChange={(nextId) => handleClientChange(nextId)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Inbound Lead
                    <small className="font-normal text-zinc-500"> (or client above)</small>
                  </label>
                  <select
                    className={fieldClass}
                    value={leadId}
                    onChange={(e) => handleLeadChange(e.target.value)}
                    data-tour="opportunities-create-lead"
                  >
                    <option value="">-- None / Direct client deal --</option>
                    {leads.map((l) => {
                      const comp = l.company || 'Individual Prospect';
                      const contact = l.contactName || l.name ? ` (${l.contactName || l.name})` : '';
                      return (
                        <option key={l._id} value={l._id}>
                          {comp}
                          {contact}
                        </option>
                      );
                    })}
                  </select>
                  {!hasAccountLink ? (
                    <p className="m-0 mt-1 text-[11px] text-amber-700">
                      Choose a client or a lead to create this opportunity.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Sales Owner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Sales Owner / Account Exec
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
                    <p className="m-0 mt-1 text-[11px] text-zinc-500">
                      {assignableUsers.some((u) => isAssignableSalesRepresentative(u))
                        ? 'OpenNext CMS Sales Representatives are listed even if they are not yet assigned on this client or lead.'
                        : 'No CMS Sales Representative role users were found — showing other assignable staff. Leave default to keep ownership yourself.'}
                    </p>
                  </>
                ) : (
                  <input
                    type="text"
                    className={`${fieldClass} bg-zinc-50 text-zinc-600`}
                    value="You (current user)"
                    disabled
                    readOnly
                    title="Only admins and sales managers can assign opportunities to other sales representatives"
                  />
                )}
              </div>
            </div>

            {/* Client / Lead Info Preview Card */}
            <div className="p-3 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {selectedClient ? (
                <div className="flex-1">
                  <strong className="font-bold text-zinc-950">
                    {selectedClient.name || selectedClient.companyName || 'Unnamed Client'}
                  </strong>
                  {(selectedClient.primaryContact?.name || selectedClient.contactPerson) && (
                    <span className="text-zinc-500 ml-1.5">
                      · {selectedClient.primaryContact?.name || selectedClient.contactPerson}
                    </span>
                  )}
                  {(selectedClient.email || selectedClient.primaryContact?.email) && (
                    <span className="text-zinc-500 ml-1.5">
                      · {selectedClient.email || selectedClient.primaryContact?.email}
                    </span>
                  )}
                </div>
              ) : selectedLead ? (
                <div className="flex-1">
                  <strong className="font-bold text-zinc-950">
                    {selectedLead.company || selectedLead.contactName || selectedLead.name || 'Lead'}
                  </strong>
                  <span className="ml-1.5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    Lead
                  </span>
                  {(selectedLead.email || selectedLead.phone) && (
                    <span className="text-zinc-500 ml-1.5">
                      · {[selectedLead.email, selectedLead.phone].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex-1 text-zinc-400 italic">
                  Select a client account or inbound lead to preview contact details.
                </div>
              )}

              {selectedClient && (
                <button
                  type="button"
                  onClick={autoFillContactDetails}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 cursor-pointer transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  ⚡ Auto-fill Contact Info
                </button>
              )}
            </div>
          </div>

          {/* SECTION 2: Pipeline Stage & Win Probability */}
          <div
            data-tour="opportunities-section-stage"
            className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-4"
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-3">
              <span className="text-xl">🎯</span>
              <div>
                <h2 className="text-sm font-bold text-zinc-950 m-0">
                  2. Pipeline Stage &amp; Win Probability
                </h2>
                <p className="text-xs text-zinc-500 m-0 mt-0.5">
                  Select the sales progress milestone to forecast weighted pipeline revenue.
                </p>
              </div>
            </div>

            {/* Interactive Stage Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {opportunityStages.map((s) => {
                const isSelected = stage === s.key;
                return (
                  <label
                    key={s.key}
                    onClick={() => selectStage(s.key)}
                    className={`border-2 rounded-xl p-3 cursor-pointer flex flex-col gap-1 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs" style={{ color: s.color }}>
                        {s.icon} {s.label}
                      </span>
                      <input
                        type="radio"
                        name="stageRadio"
                        checked={isSelected}
                        onChange={() => selectStage(s.key)}
                        className="accent-blue-600"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[11px] font-bold text-zinc-600">
                        {s.probability}% Prob
                      </span>
                    </div>
                    <small className="text-[10px] text-zinc-400 leading-snug">{s.desc}</small>
                  </label>
                );
              })}
            </div>

            {/* Slider & Close Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 items-center">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 mb-1.5">
                  <span>
                    Win Probability: <strong className="text-blue-600 font-bold">{probability}%</strong>
                  </span>
                  <small className="text-[10px] text-zinc-400 font-normal">
                    Adjust slider if custom probability
                  </small>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={probability}
                  onChange={(e) => setProbability(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Expected Close Date 📅
                </label>
                <input
                  type="date"
                  className={fieldClass}
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                />
              </div>
            </div>

            {/* Lost Reason Panel */}
            {isOpportunityLostStage(stage) && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-1.5">
                <label className="text-xs font-bold text-red-800">
                  Reason for Lost Deal *
                </label>
                <textarea
                  rows={2}
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder="e.g. Budget constraints, Competitor chosen (Vendor X), Project delayed indefinitely"
                  className="w-full p-2.5 text-xs border border-red-300 rounded-md outline-none focus:border-red-500 bg-white resize-y"
                  required
                />
              </div>
            )}
          </div>

          {/* SECTION 3: Primary Contact Person */}
          <div
            data-tour="opportunities-section-contact"
            className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-4"
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-3">
              <span className="text-xl">👤</span>
              <div>
                <h2 className="text-sm font-bold text-zinc-950 m-0">
                  3. Primary Contact Person
                </h2>
                <p className="text-xs text-zinc-500 m-0 mt-0.5">
                  After selecting a lead or client, pick a related contact — unrelated contacts are hidden.
                </p>
              </div>
            </div>

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
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Contact Name
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
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Email Address
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
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Mobile / Phone
                </label>
                <input
                  type="tel"
                  className={fieldClass}
                  placeholder="+91 9876543210"
                  value={contactMobile}
                  onChange={(e) => {
                    setContactMobile(e.target.value);
                    if (selectedContact) setSelectedContact(null);
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Proposed Products & Line Items */}
          <div
            data-tour="opportunities-section-products"
            className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📦</span>
                <div>
                  <h2 className="text-sm font-bold text-zinc-950 m-0">
                    4. Proposed Products &amp; Line Items
                  </h2>
                  <p className="text-xs text-zinc-500 m-0 mt-0.5">
                    Add products, billable items, quantities, and GST rates for this proposal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    newLine({ productName: '', quantity: 1, unitPrice: 0, tax: 18 }),
                  ])
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
              >
                <AddIcon sx={{ fontSize: 14 }} />
                Add Line Item
              </button>
            </div>

            {/* Products Table */}
            <div className="overflow-x-auto border border-zinc-200 rounded-lg">
              <table className="w-full text-left min-w-[620px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2.5">Item / Product Description *</th>
                    <th className="px-3 py-2.5 w-[110px]">Qty</th>
                    <th className="px-3 py-2.5 w-[130px]">Unit Price (₹)</th>
                    <th className="px-3 py-2.5 w-[100px]">Tax Rate</th>
                    <th className="px-3 py-2.5 w-[120px] text-right">Amount (₹)</th>
                    <th className="px-2 py-2.5 w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const rowSub =
                      Math.max(1, Number(line.quantity) || 1) *
                      Math.max(0, Number(line.unitPrice) || 0);
                    return (
                      <tr key={line.key} className="border-b border-zinc-100">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.productName}
                            onChange={(e) =>
                              updateLine(line.key, { productName: e.target.value })
                            }
                            placeholder="Item description / Service"
                            className={fieldClass}
                            required
                          />
                        </td>

                        <td className="px-3 py-2">
                          <div className="flex items-center border border-zinc-300 rounded-lg overflow-hidden bg-white h-9">
                            <button
                              type="button"
                              onClick={() => stepQty(line.key, -1)}
                              className="px-2.5 h-full bg-zinc-50 hover:bg-zinc-100 text-zinc-600 font-bold border-r border-zinc-200 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              className="w-full text-center text-xs font-bold border-none outline-none p-0"
                            />
                            <button
                              type="button"
                              onClick={() => stepQty(line.key, 1)}
                              className="px-2.5 h-full bg-zinc-50 hover:bg-zinc-100 text-zinc-600 font-bold border-l border-zinc-200 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLine(line.key, {
                                unitPrice: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className={`${fieldClass} font-semibold`}
                            required
                          />
                        </td>

                        <td className="px-3 py-2">
                          <select
                            value={line.tax}
                            onChange={(e) =>
                              updateLine(line.key, { tax: Number(e.target.value) })
                            }
                            className={fieldClass}
                          >
                            {TAX_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}%
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-3 py-2 text-right font-bold text-zinc-900 text-xs whitespace-nowrap">
                          ₹{rowSub.toLocaleString('en-IN')}
                        </td>

                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            disabled={lines.length <= 1}
                            className="w-7 h-7 rounded border border-zinc-200 bg-white hover:bg-red-50 text-red-600 inline-flex items-center justify-center cursor-pointer disabled:opacity-30"
                            title="Remove row"
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Destination State & Shipping Engine */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Destination State (GST &amp; Shipping) *
                </label>
                <select
                  className={fieldClass}
                  value={shippingState}
                  onChange={(e) => {
                    setShippingState(e.target.value);
                    setShippingOverridden(false);
                  }}
                >
                  {statesList.map((st) => {
                    const isCompany = st.toLowerCase() === companyState.toLowerCase();
                    const rate = settingsRates[st] !== undefined ? settingsRates[st] : 100;
                    return (
                      <option key={st} value={st}>
                        {st} ({isCompany ? 'Intra-State: CGST+SGST' : 'Inter-State: IGST'} • ₹{rate})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-zinc-700">
                    Shipping Charge (₹)
                  </label>
                  <span className="text-[10px] font-bold text-blue-600">
                    {shippingRuleLabel}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={shippingCharge}
                  onChange={(e) => {
                    setShippingOverridden(true);
                    setShippingCharge(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className={`${fieldClass} font-bold text-blue-900`}
                />
              </div>
            </div>
          </div>

          {/* Bottom Actions Bar */}
          <div
            data-tour="opportunities-create-actions"
            className="bg-white border border-zinc-300 rounded-xl p-4 flex items-center justify-between"
          >
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
            >
              {returnTo.startsWith('/leads/') ? 'Back to lead' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-none"
            >
              {saving ? 'Saving Deal…' : '💾 Save Opportunity Deal'}
            </button>
          </div>
        </form>

        {/* Right Column: Sticky Live Financial & Forecast Summary */}
        <div
          data-tour="opportunities-create-sidebar"
          className="lg:sticky lg:top-20 flex flex-col gap-4"
        >
          {/* Summary Card */}
          <div className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-950 m-0">📊 Pipeline Summary</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {stage} ({probability}%)
              </span>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Account link
                </span>
                <div className="font-bold text-zinc-900 mt-0.5">
                  {accountLinkLabel || (
                    <em className="text-zinc-400 font-normal">None selected</em>
                  )}
                  {clientId && leadId ? (
                    <span className="block text-[10px] font-medium text-zinc-500 mt-0.5">
                      Client + lead linked
                    </span>
                  ) : leadId && !clientId ? (
                    <span className="block text-[10px] font-medium text-zinc-500 mt-0.5">
                      Lead only
                    </span>
                  ) : clientId ? (
                    <span className="block text-[10px] font-medium text-zinc-500 mt-0.5">
                      Client only
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Opportunity Title
                </span>
                <div className="font-semibold text-zinc-800 mt-0.5 break-words">
                  {title.trim() || <em className="text-zinc-400 font-normal">Untitled deal</em>}
                </div>
              </div>

              <hr className="border-0 border-t border-zinc-100 my-1" />

              <div className="flex justify-between text-zinc-500">
                <span>Products Subtotal:</span>
                <strong className="text-zinc-900 font-bold">₹{totals.subtotal.toLocaleString('en-IN')}</strong>
              </div>

              <div className="flex justify-between text-zinc-500">
                <span>Estimated GST ({isIntra ? 'CGST+SGST' : 'IGST'}):</span>
                <strong className="text-zinc-900 font-bold">₹{totals.totalTax.toLocaleString('en-IN')}</strong>
              </div>

              <div className="flex justify-between text-zinc-500">
                <span>Shipping Charge:</span>
                <strong className="text-zinc-900 font-bold">₹{totals.shipping.toLocaleString('en-IN')}</strong>
              </div>

              {/* Total & Weighted Highlight */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex flex-col gap-2 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold uppercase text-sky-900">Total Deal Value</span>
                  <strong className="text-base font-extrabold text-sky-950">
                    ₹{totals.grandTotal.toLocaleString('en-IN')}
                  </strong>
                </div>

                <div className="flex justify-between items-center border-t border-dashed border-sky-200 pt-2 text-[11px]">
                  <span className="font-semibold text-sky-800">
                    Weighted Forecast ({probability}%):
                  </span>
                  <strong className="font-bold text-sky-950">
                    ₹{totals.weightedForecast.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <hr className="border-0 border-t border-zinc-100 my-1" />

              {/* Checklist */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Checklist
                </span>
                <ul className="list-none p-0 m-0 flex flex-col gap-1.5 text-xs">
                  <li className={`flex items-center gap-1.5 ${hasAccountLink ? 'text-emerald-700' : 'text-red-600'}`}>
                    <span>{hasAccountLink ? '✅' : '❌'}</span>
                    <span>
                      {hasAccountLink
                        ? `${clientId ? 'Client' : 'Lead'}: ${accountLinkLabel || 'Selected'}`
                        : 'Client or lead selected'}
                    </span>
                  </li>
                  <li className={`flex items-center gap-1.5 ${title.trim() ? 'text-emerald-700' : 'text-red-600'}`}>
                    <span>{title.trim() ? '✅' : '❌'}</span>
                    <span>{title.trim() ? `Title: ${title.slice(0, 24)}${title.length > 24 ? '…' : ''}` : 'Opportunity title entered'}</span>
                  </li>
                  <li className={`flex items-center gap-1.5 ${totals.validLines.length > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    <span>{totals.validLines.length > 0 ? '✅' : '❌'}</span>
                    <span>
                      {totals.validLines.length > 0
                        ? `${totals.validLines.length} product line item(s)`
                        : 'Valid line items added'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Pipeline Workflow Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 leading-relaxed">
            <strong className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 mb-1">
              💡 Pipeline Workflow
            </strong>
            <p className="m-0 text-emerald-800">
              Once saved, you can track stage transitions, request product samples for the client, and seamlessly convert winning deals into formal GST Quotations &amp; Sales Orders with 1-click.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
