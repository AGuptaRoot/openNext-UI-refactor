import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useNotifyMessage } from '@/components/notifications';
import { crmApi } from '../../services/api';
import { useSalesFlowConfig } from '../../hooks/useSalesFlowConfig';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import {
  COMPANY_STATE_DEFAULT,
  QUOTATION_CURRENCIES,
  type DiscountType,
  type QuotationSection,
  type QuotationTemplateItem,
  type TaxCalculation,
} from '../../types/quotations';
import {
  EditableLine,
  FormField,
  FormSection,
  INDIAN_STATES,
  LineItemsEditor,
  financeFieldClass,
  financeTextAreaClass,
  newEditableLine,
} from '../../components/finance/FinanceFormElements';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { useFinanceOptions } from '../../components/finance/useFinanceOptions';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { ClientQuotationPicker } from '../../components/finance/ClientQuotationPicker';
import {
  SalesFlowChecklist,
  SalesFlowLinesTable,
  SalesFlowListCard,
  SalesFlowSummaryStrip,
  SalesFlowNotices,
  leadTabHref,
  type SalesFlowLineMeta,
} from '../../components/finance/SalesFlowQuotationParts';
import type { QuotationDateRules, SalesFlowCheck, SalesFlowConfig, SalesFlowDetail, SalesFlowPanel, SalesFlowSummaryItem, SalesFlowNotice } from '../../types/leads';
import { ExtensionCreateFields } from '../../components/extensions/ExtensionCreateFields';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { extensionDataApi } from '../../services/extensionDataApi';
import { notifySalesFlowSaved } from '../../utils/salesFlowSaved';
import { salesTerms } from '../../utils/salesTerms';
import { canReplaceWithPrefill } from '../../utils/extensionFieldLogic';
import { calculateFinanceTotals, clampDiscountValue } from '../../utils/financeTotals';
import {
  consumeFinancePdfScanDraft,
  linesFromPdfExtract,
  normalizeTaxCalculationValue,
} from '../../utils/financePdfScanDraft';
import { normalizeCurrencyCode, useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import type { QuotationPaymentType, QuotationAdvanceMode } from '../../types/quotations';
import { computeQuotationPayable } from '../../utils/quotationPayment';

function safeReturnPath(raw: string | null): string {
  const value = String(raw || '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/quotations';
  return value;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "2026-11-03" → "3 Nov 2026" (for messages). */
function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function linesFromSource(
  items: Array<{
    name?: string;
    description?: string;
    qty?: number;
    rate?: number;
    tax?: number;
    fileUrl?: string;
  }>
): EditableLine[] {
  if (!items.length) return [newEditableLine()];
  return items.map((item) => ({
    ...newEditableLine(),
    name: item.name || '',
    description: item.description || '',
    qty: Number(item.qty) || 1,
    rate: Number(item.rate) || 0,
    tax: item.tax !== undefined && item.tax !== null && Number.isFinite(Number(item.tax)) ? Number(item.tax) : 18,
    fileUrl: item.fileUrl || '',
  }));
}

const MAX_SECTIONS = 10;

export const QuotationCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const presetLeadId = String(searchParams.get('leadId') || '').trim();
  const presetOpportunityId = String(searchParams.get('opportunityId') || '').trim();
  const presetClientId = String(searchParams.get('clientId') || '').trim();
  const fromScan = searchParams.get('fromScan') === '1';
  const { clients, leads, opportunities } = useFinanceOptions();
  /** Opportunities a new quotation may use: not Won / Lost and without an accepted quotation. */
  const openOpportunities = useMemo(
    () =>
      opportunities.filter((item) => {
        if (item.acceptedQuotationId) return false;
        const type = String(item.stageType || '').toUpperCase();
        const stage = String(item.stage || '').toLowerCase();
        return type !== 'WON' && type !== 'LOST' && stage !== 'won' && stage !== 'lost';
      }),
    [opportunities]
  );
  const { alert, confirm, prompt } = useDialog();
  const { hasAnyPermission, isClient, features } = useAuth();
  const [paymentType, setPaymentType] = useState<QuotationPaymentType>('full');
  const [advanceMode, setAdvanceMode] = useState<QuotationAdvanceMode>('percent');
  const [advanceValue, setAdvanceValue] = useState<number>(features.defaultAdvancePercent || 30);
  const [proformaEnabled, setProformaEnabled] = useState(features.proformaAdvance);
  const canWriteFinance = hasAnyPermission('crm.quotes.write', 'crm.finance.write') && !isClient;
  const settingsCurrency = useDefaultCurrency();
  const currencyLockedRef = useRef(false);

  useEffect(() => {
    setProformaEnabled(features.proformaAdvance);
    crmApi.getSettings().then((res) => {
      if (res.data?.proforma_advance_enabled !== undefined) {
        setProformaEnabled(Boolean(res.data.proforma_advance_enabled));
        if (res.data.default_advance_percent) {
          setAdvanceValue((prev) => prev || Number(res.data.default_advance_percent) || 30);
        }
      }
    }).catch(() => {});
  }, [features.proformaAdvance]);

  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [editQuotationNo, setEditQuotationNo] = useState('');
  const [editStatus, setEditStatus] = useState<string | null>(null);
  /** CRM 3.51.0: the extension record a client quotation being edited was made for (e.g. Travel's client trip). */
  const [editRecordId, setEditRecordId] = useState('');

  const [recipientType, setRecipientType] = useState<'lead' | 'client'>(presetLeadId ? 'lead' : 'lead');
  const [leadId, setLeadId] = useState(presetLeadId);
  const [clientId, setClientId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [opportunitySourceCurrency, setOpportunitySourceCurrency] = useState<string | null>(null);
  const [shippingState, setShippingState] = useState(COMPANY_STATE_DEFAULT);
  const [issueDate, setIssueDate] = useState(localToday());
  const [validTill, setValidTill] = useState(addDays(localToday(), 30));
  const [currency, setCurrency] = useState(settingsCurrency);
  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation>('after_discount');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([newEditableLine()]);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [recipientNotes, setRecipientNotes] = useState('');
  /** Titled text blocks (inclusions, cancellation policy, ...) — offered when the active extension suggests them. */
  const [sections, setSections] = useState<QuotationSection[]>([]);
  const [salesPrefill, setSalesPrefill] = useState<{ warnings: string[]; lines: number; notices?: SalesFlowNotice[] } | null>(null);
  /** Layout switches of the active extension (e.g. lines come only from it). */
  const salesFlow: SalesFlowConfig = useSalesFlowConfig();
  const terms = salesTerms(salesFlow);
  /** Read-only details shown with each extension line, by line key (not saved). */
  const [lineDetails, setLineDetails] = useState<Record<string, SalesFlowDetail[]>>({});
  /** Per line: selected, unit, extension column values, added by hand. */
  const [lineMeta, setLineMeta] = useState<Record<string, SalesFlowLineMeta>>({});
  /** Summary row, read-only lists and add-line choices from the extension. */
  const [salesExtras, setSalesExtras] = useState<{
    summary: SalesFlowSummaryItem[];
    panels: SalesFlowPanel[];
    lineOptions: Array<{ name: string; unit?: string; tax?: number; group?: string }>;
    lineNote: string;
  }>({ summary: [], panels: [], lineOptions: [], lineNote: '' });
  const [linesLoading, setLinesLoading] = useState(false);
  const prefillSeq = useRef(0);
  /** What this page filled in itself — replaced on the next lead, while the agent's own edits are kept. */
  const autoFilled = useRef<{ lines: string; sections: string; title: string; description: string; values: Record<string, unknown> }>({
    lines: '',
    sections: '',
    title: '',
    description: '',
    values: {},
  });
  /**
   * The extension's quotation layout (salesFlow.quotationForm) and line groups. Without them the
   * page stays as it was.
   */
  const quoteForm = salesFlow.quotationForm || null;
  const lineGroups = salesFlow.quotationLineGroups || [];
  const { declarations } = useActiveExtension();
  const hasQuoteFields = (declarations.fields?.quotation || []).length > 0;
  const declaredQuoteFields = useMemo(
    () => new Map((declarations.fields?.quotation || []).flatMap((g) => g.fields).map((f) => [f.key, f] as const)),
    [declarations.fields]
  );
  /** Edit: the saved values could not be loaded, so saving must not overwrite them with what the form shows. */
  const [quoteValuesUnloaded, setQuoteValuesUnloaded] = useState(false);
  /** Declared quotation field values (saved in the extension's table after the quotation). */
  const [quoteValues, setQuoteValues] = useState<Record<string, unknown>>({});
  /** The extension's checks for the chosen lead / opportunity (prefill `checks`). */
  const [salesChecks, setSalesChecks] = useState<SalesFlowCheck[]>([]);
  /** Latest sensible "Valid till" from the extension (prefill validTillMax); '' = no limit. */
  const [validTillMax, setValidTillMax] = useState('');
  /** The agent set "Valid till" by hand: the extension's default no longer replaces it. */
  const validTillTouched = useRef(false);
  /**
   * Hard limits for Issue Date / Valid Till from the active extension (e.g. a travel quotation is not valid
   * after the trip starts); the server refuses dates outside them on every save. {} = no limits.
   */
  const [dateRules, setDateRules] = useState<QuotationDateRules>({});
  const issueDateMin = !isEdit ? dateRules.issueDateMin || '' : '';
  const validTillLimit = dateRules.validTillMax || '';
  const validTillLimitText = validTillLimit ? `${dateRules.validTillMaxLabel || 'the latest allowed date'} (${formatDay(validTillLimit)})` : '';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scanNotice, setScanNotice] = useState<string | null>(null);
  useNotifyMessage(error, 'error', () => setError(null));
  useNotifyMessage(scanNotice, 'success', () => setScanNotice(null));

  const [templates, setTemplates] = useState<QuotationTemplateItem[]>([]);
  const [templateId, setTemplateId] = useState('');
  /** Loaded only to help match PDF-scan line items — not shown as a picker. */
  const [catalog, setCatalog] = useState<
    Array<{ _id: string; name: string; description?: string; unitPrice: number; taxRate: number }>
  >([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const scanAppliedRef = useRef(false);
  const scanClientNameRef = useRef('');

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoadingEdit(true);
    crmApi
      .getQuotation(editId)
      .then((res) => {
        if (cancelled) return;
        const quote = res.data;
        if (!quote) {
          setError('Quotation not found.');
          return;
        }
        setEditStatus(quote.status);
        const qNo = String(quote.quotationNo || quote.quotationNumber || quote.number || '');
        setEditQuotationNo(qNo);

        if (quote.status !== 'Draft') {
          setError(`Only quotations in Draft status can be edited. Current status is "${quote.status}". Please create a revision instead.`);
          return;
        }

        currencyLockedRef.current = true;
        const rawQuote = quote as unknown as Record<string, unknown>;
        const isClientType = Boolean(quote.clientId);
        setRecipientType(isClientType ? 'client' : 'lead');
        if (quote.clientId) setClientId(String(quote.clientId));
        if (quote.leadId) setLeadId(String(quote.leadId));
        if (typeof rawQuote.extensionRecordId === 'string' && rawQuote.extensionRecordId) setEditRecordId(rawQuote.extensionRecordId);
        const resolvedOppId = String(quote.opportunityId || rawQuote.dealId || '');
        if (resolvedOppId) {
          setOpportunityId(resolvedOppId);
        }
        if (quote.shippingState) setShippingState(quote.shippingState);
        if (quote.issueDate) setIssueDate(String(quote.issueDate).slice(0, 10));
        if (quote.validTill || quote.expiryDate) {
          validTillTouched.current = true;
          setValidTill(String(quote.validTill || quote.expiryDate).slice(0, 10));
        }
        if (quote.currency) setCurrency(quote.currency.toUpperCase());
        if (quote.taxCalculation) setTaxCalculation(quote.taxCalculation);
        if (quote.title) setTitle(quote.title);
        if (quote.description) setDescription(quote.description);
        const resolvedNotes = String(quote.recipientNotes || rawQuote.notes || '');
        if (resolvedNotes) {
          setRecipientNotes(resolvedNotes);
        }
        if (rawQuote.paymentType || quote.paymentType) {
          setPaymentType((quote.paymentType || rawQuote.paymentType) === 'advance' ? 'advance' : 'full');
        }
        if (rawQuote.advanceMode || quote.advanceMode) {
          setAdvanceMode((quote.advanceMode || rawQuote.advanceMode) === 'amount' ? 'amount' : 'percent');
        }
        if (quote.advanceValue !== undefined || rawQuote.advanceValue !== undefined) {
          setAdvanceValue(Number(quote.advanceValue ?? rawQuote.advanceValue) || 0);
        }
        setDiscountType((quote.discountType as DiscountType) || 'percent');
        setDiscountValue(Number(quote.discountValue ?? quote.discountPercent) || 0);
        setShippingCharge(Number(quote.shippingCharge) || 0);
        if (Array.isArray(quote.lineItems) && quote.lineItems.length > 0) {
          const loaded = linesFromSource(quote.lineItems);
          setLines(loaded);
          setLineMeta(
            Object.fromEntries(
              loaded.map((l, i) => [
                l.key,
                {
                  selected: true,
                  unit: String(quote.lineItems[i]?.unit || ''),
                  extra: { ...(quote.lineItems[i]?.extra || {}) },
                  sourceRef: String(quote.lineItems[i]?.sourceRef || ''),
                  group: String(quote.lineItems[i]?.group || ''),
                },
              ])
            )
          );
        }
        if (Array.isArray(quote.sections)) {
          setSections(quote.sections.map((s) => ({ title: String(s.title || ''), body: String(s.body || '') })));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load quotation');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEdit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  // Edit: the declared quotation values saved with this quotation.
  useEffect(() => {
    if (!editId || !hasQuoteFields) return;
    let cancelled = false;
    extensionDataApi
      .getValues('quotation', editId)
      .then((res) => {
        if (!cancelled) {
          setQuoteValues((prev) => ({ ...prev, ...(res.values || {}) }));
          setQuoteValuesUnloaded(false);
        }
      })
      .catch(() => {
        if (!cancelled) setQuoteValuesUnloaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, hasQuoteFields]);

  useEffect(() => {
    if (presetOpportunityId && !isEdit) {
      void onSelectOpportunity(presetOpportunityId);
      return;
    }
    if (!presetLeadId) {
      // ?clientId= (Client → Create Quotation): the quotation is for that client.
      if (presetClientId && !isEdit) {
        setRecipientType('client');
        setClientId(presetClientId);
      }
      return;
    }
    setRecipientType('lead');
    setLeadId(presetLeadId);
  }, [presetLeadId, presetOpportunityId, presetClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ?leadId=: link the lead's open opportunity once the list is known (or prefill from the lead alone).
  const presetLeadLinked = useRef(false);
  useEffect(() => {
    if (!presetLeadId || presetOpportunityId || isEdit || presetLeadLinked.current) return;
    const opp = openOpportunities.find((item) => String(item.leadId || '') === presetLeadId);
    if (!opp && !opportunities.length) return; // list not loaded yet
    presetLeadLinked.current = true;
    if (opp) void onSelectOpportunity(opp._id);
    else void applySalesFlowPrefill({ leadId: presetLeadId });
  }, [presetLeadId, presetOpportunityId, openOpportunities, opportunities.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currencyLockedRef.current) return;
    setCurrency(settingsCurrency);
  }, [settingsCurrency]);

  useEffect(() => {
    crmApi.listQuotationTemplates().then((r) => setTemplates(r.data || [])).catch(() => setTemplates([]));
    crmApi
      .listCatalogProducts()
      .then((r) => setCatalog(r.data || []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogReady(true));
  }, []);

  useEffect(() => {
    if (!fromScan || !catalogReady || scanAppliedRef.current) return;
    const extracted = consumeFinancePdfScanDraft('quotation');
    if (!extracted) {
      setScanNotice('No scanned PDF data found. You can fill the form manually.');
      scanAppliedRef.current = true;
      return;
    }
    scanAppliedRef.current = true;
    scanClientNameRef.current = (extracted.clientName || '').trim();

    if (extracted.issueDate) setIssueDate(extracted.issueDate);
    if (extracted.dueDate) setValidTill(extracted.dueDate);
    currencyLockedRef.current = true;
    setCurrency(normalizeCurrencyCode(extracted.currency, settingsCurrency));
    setTaxCalculation(normalizeTaxCalculationValue(extracted.taxCalculation));
    if (extracted.documentNumber?.trim()) {
      setTitle(`Quotation ${extracted.documentNumber.trim()}`);
    }
    const descParts = [
      extracted.billingAddress?.trim() ? `Billing:\n${extracted.billingAddress.trim()}` : '',
      extracted.shippingAddress?.trim() ? `Shipping:\n${extracted.shippingAddress.trim()}` : '',
      extracted.notes?.trim() || '',
    ].filter(Boolean);
    if (descParts.length) setDescription(descParts.join('\n\n'));
    const notesParts = [
      extracted.paymentDetails?.trim() || '',
      extracted.exchangeRate && Number(extracted.exchangeRate) !== 1
        ? `Exchange rate: ${extracted.exchangeRate}`
        : '',
    ].filter(Boolean);
    if (notesParts.length) setRecipientNotes(notesParts.join('\n'));
    setLines(linesFromPdfExtract(extracted, catalog));
    setScanNotice(
      `Filled from scanned PDF${extracted.documentNumber ? ` (#${extracted.documentNumber})` : ''}. Review required fields before saving.`
    );
  }, [fromScan, catalogReady, catalog, settingsCurrency]);

  useEffect(() => {
    if (!fromScan || !scanClientNameRef.current || !clients.length) return;
    if (clientId || leadId) return;
    const needle = scanClientNameRef.current.toLowerCase();
    const matchedClient = clients.find((c) => {
      const name = String((c as { name?: string }).name || '').trim().toLowerCase();
      const company = String((c as { company?: string }).company || '').trim().toLowerCase();
      return (
        name === needle ||
        company === needle ||
        (name && (name.includes(needle) || needle.includes(name))) ||
        (company && (company.includes(needle) || needle.includes(company)))
      );
    });
    if (matchedClient) {
      setRecipientType('client');
      setClientId(matchedClient._id);
      return;
    }
    const matchedLead = leads.find((l) => {
      const name = String((l as { name?: string }).name || '').trim().toLowerCase();
      const company = String((l as { company?: string }).company || '').trim().toLowerCase();
      return (
        name === needle ||
        company === needle ||
        (name && (name.includes(needle) || needle.includes(name)))
      );
    });
    if (matchedLead) {
      setRecipientType('lead');
      setLeadId(matchedLead._id);
    }
  }, [fromScan, clients, leads, clientId, leadId]);

  const gstMode = shippingState === COMPANY_STATE_DEFAULT ? 'intra' : 'inter';

  const salesFlowRef = useRef(salesFlow);
  salesFlowRef.current = salesFlow;
  /** salesFlow.clientQuotation: the client step's result (the opportunity, or the enquiry it prepared). */
  const [startedFor, setStartedFor] = useState<{ clientId: string; opportunityId: string; leadId?: string; recordId?: string; title: string } | null>(null);
  /** CRM 3.45.0: the enquiry a client quotation without an opportunity is made for (from the client step). */
  const clientEnquiryId =
    recipientType === 'client' && startedFor && startedFor.clientId === clientId && !startedFor.opportunityId ? startedFor.leadId || '' : '';
  /**
   * CRM 3.45.1: the lead the extension works from: the chosen lead, or the client quotation's enquiry. Every
   * extension part of the page (lines, summary, panels, dates, notices, links) uses it, so a client quotation
   * shows the same extension layout as a lead / opportunity quotation.
   */
  const salesLeadId = leadId || clientEnquiryId;
  /**
   * CRM 3.51.0: a client quotation for the extension's own record (the client step returned { recordId },
   * e.g. Travel's client trip — no lead is made). Lines, dates and checks come from that record.
   */
  const clientRecordId =
    recipientType === 'client' && !salesLeadId && !opportunityId
      ? (startedFor && startedFor.clientId === clientId && !startedFor.opportunityId && startedFor.recordId) || (isEdit ? editRecordId : '') || ''
      : '';
  /** Lines come only from the extension for a lead / opportunity / record; a client-only quotation keeps the editor. */
  const lockLines = Boolean(salesFlow.lockQuotationLines) && Boolean(salesLeadId || opportunityId || clientRecordId);
  /**
   * salesFlow.quotationForm: before a lead / opportunity is chosen the extension's layout is shown
   * already (summary, lines and fields), empty and with the form's hint.
   */
  const waitingLines =
    Boolean(quoteForm) && Boolean(salesFlow.lockQuotationLines) && !lockLines && recipientType === 'lead' && !fromScan;
  const fieldsWaiting = Boolean(quoteForm) && !leadId && !opportunityId && !clientId;
  const waitingText = quoteForm?.emptyText || 'Select a lead or an opportunity first.';

  /** The lines that go on the quotation (unticked extension lines are left out). */
  const pricedLines = useMemo(
    () => (lockLines ? lines.filter((l) => lineMeta[l.key]?.selected !== false && (l.name.trim() || lineMeta[l.key]?.manual)) : lines),
    [lockLines, lines, lineMeta]
  );

  const totals = useMemo(
    () =>
      calculateFinanceTotals({
        lines: pricedLines.map((line) => ({ qty: line.qty, rate: line.rate, tax: line.tax })),
        discountType,
        discountValue,
        taxCalculation,
        shippingCharge: terms.hideShipping ? 0 : shippingCharge,
      }),
    [pricedLines, discountType, discountValue, taxCalculation, shippingCharge, terms.hideShipping]
  );

  /** quotationForm.totalPer: grand total ÷ a declared count field (computed, never stored). */
  const totalPer = quoteForm?.totalPer || null;
  const totalPerCount = totalPer ? Number(quoteValues[totalPer.countField]) : 0;
  const showTotalPer = Boolean(totalPer) && Number.isFinite(totalPerCount) && totalPerCount > 0;

  /** Right column: the extension's checks plus two of the page's own (with a quotation form). */
  const formChecks = useMemo<SalesFlowCheck[]>(() => {
    const rows: SalesFlowCheck[] = [...salesChecks];
    if (quoteForm) {
      const named = pricedLines.filter((l) => l.name.trim());
      // CRM 3.45.1: a client quotation made for the client's enquiry needs no opportunity.
      if (recipientType === 'client' && salesLeadId && !opportunityId) rows.push({ label: 'Linked to the client’s enquiry', ok: true });
      else if (recipientType === 'client' && clientRecordId) rows.push({ label: 'Linked to the client’s trip', ok: true });
      else rows.push({ label: 'Linked to an opportunity', ok: Boolean(opportunityId) });
      rows.push({ label: 'Every selected line has a rate', ok: named.length > 0 && named.every((l) => l.rate > 0) });
    }
    return rows;
  }, [salesChecks, quoteForm, pricedLines, opportunityId, recipientType, salesLeadId, clientRecordId]);

  const cgst = gstMode === 'intra' ? totals.taxTotal / 2 : 0;
  const sgst = gstMode === 'intra' ? totals.taxTotal / 2 : 0;
  const igst = gstMode === 'inter' ? totals.taxTotal : 0;

  const payableNow = useMemo(
    () =>
      computeQuotationPayable(
        { grandTotal: totals.grandTotal, paymentType, advanceMode, advanceValue },
        features.defaultAdvancePercent || 30
      ),
    [totals.grandTotal, paymentType, advanceMode, advanceValue, features.defaultAdvancePercent]
  );

  const loadTemplate = async (id: string) => {
    setTemplateId(id);
    if (!id) return;
    try {
      const template = (await crmApi.getQuotationTemplate(id)).data;
      currencyLockedRef.current = true;
      setCurrency(normalizeCurrencyCode(template.currency, settingsCurrency));
      setTaxCalculation(template.taxCalculation || 'after_discount');
      setDiscountType(template.discountType || 'percent');
      setDiscountValue(Number(template.discountValue) || 0);
      setShippingCharge(Number(template.shippingCharge) || 0);
      setRecipientNotes(template.recipientNotes || template.terms || '');
      setDescription(template.description || '');
      setTitle(template.name || '');
      setLines(linesFromSource(template.lineItems || []));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load template');
    }
  };

  const saveAsTemplate = async () => {
    const name = await prompt('Template name');
    if (!name?.trim()) return;
    try {
      await crmApi.createQuotationTemplate({
        name: name.trim(),
        category: 'General',
        currency,
        taxCalculation,
        shippingCharge: terms.hideShipping ? 0 : shippingCharge,
        recipientNotes,
        terms: recipientNotes,
        discountType,
        discountValue,
        lineItems: pricedLines
          .filter((line) => line.name.trim())
          .map((line) => ({
            name: line.name.trim(),
            description: line.description.trim(),
            qty: line.qty,
            rate: line.rate,
            tax: line.tax,
            fileUrl: line.fileUrl?.trim() || undefined,
            ...(lockLines && lineMeta[line.key]
              ? {
                  unit: lineMeta[line.key].unit.trim() || undefined,
                  extra: Object.fromEntries(Object.entries(lineMeta[line.key].extra).filter(([, v]) => String(v || '').trim())),
                }
              : {}),
          })),
        sections: sections
          .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
          .filter((s) => s.title && s.body),
      });
      const refreshed = await crmApi.listQuotationTemplates();
      setTemplates(refreshed.data || []);
      await alert('Template saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save template');
    }
  };


  /** Settings → Lead workflow (or the extension): a new quotation needs an opportunity. */
  const opportunityRule = Boolean(salesFlow.requireOpportunityForQuotation) && !isEdit;
  /**
   * salesFlow.clientQuotation (CRM 3.34.0): "Client account" lists only the clients the extension allows
   * (e.g. a completed Travel Requirement); choosing one asks what the extension needs first (e.g. who
   * travels), and the extension prepares the opportunity the quotation then belongs to.
   */
  const clientQuote = !isEdit && salesFlow.available && salesFlow.clientQuotation ? salesFlow.clientQuotation : null;
  const [eligibleClientIds, setEligibleClientIds] = useState<Set<string> | null>(null);
  const [pickerClientId, setPickerClientId] = useState('');
  const clientQuoteActive = Boolean(clientQuote);
  /**
   * CRM 3.45.0 (clientQuotation.withoutOpportunity): a quotation for a client is saved for the client and
   * the enquiry its step prepared (e.g. the trip with its travellers); no opportunity is made or asked for.
   */
  const clientNoOpportunity = Boolean(clientQuote && clientQuote.withoutOpportunity) && recipientType === 'client';
  const needsOpportunity = opportunityRule && !clientNoOpportunity;
  useEffect(() => {
    if (!clientQuoteActive) return undefined;
    let alive = true;
    crmApi
      .getClientQuotationEligible()
      .then((res) => alive && setEligibleClientIds(new Set(res.data?.clientIds || [])))
      .catch(() => alive && setEligibleClientIds(new Set()));
    return () => {
      alive = false;
    };
  }, [clientQuoteActive]);
  // CRM 3.44.0: every client can be chosen; one that is not ready yet is tagged, and choosing it opens the
  // extension's step, which says what is missing (e.g. the Travel Requirement) with a link to fill it.
  const clientNotReady = (id: string) => Boolean(clientQuote && eligibleClientIds && id && !eligibleClientIds.has(String(id)));
  const notReadyLabel = (clientQuote && clientQuote.notEligibleLabel) || 'Not ready for a quotation';
  // ?clientId= (Client → Travel Requirement → Create Quotation): ask straight away.
  const presetPickerDone = useRef(false);
  useEffect(() => {
    if (!clientQuoteActive || !presetClientId || presetPickerDone.current || presetLeadId || presetOpportunityId) return;
    presetPickerDone.current = true;
    setRecipientType('client');
    setClientId(presetClientId);
    setPickerClientId(presetClientId);
  }, [clientQuoteActive, presetClientId, presetLeadId, presetOpportunityId]);

  const lineSignature = (list: EditableLine[]) =>
    JSON.stringify(list.filter((l) => l.name.trim()).map((l) => [l.name.trim(), l.description.trim(), l.qty]));
  const sectionSignature = (list: QuotationSection[]) => JSON.stringify(list.map((s) => [s.title, s.body]));

  /**
   * Asks the active extension what a quotation for this lead / opportunity starts with (sales flow).
   * Without such an extension the answer is { available: false } and nothing changes.
   * Lines and sections are replaced only when empty or filled automatically before.
   */
  const applySalesFlowPrefill = async (ref: { leadId?: string; opportunityId?: string; recordId?: string; clientId?: string }) => {
    const seq = ++prefillSeq.current;
    setSalesPrefill(null);
    setSalesChecks([]);
    setValidTillMax('');
    if (isEdit || (!ref.leadId && !ref.opportunityId && !(ref.recordId && ref.clientId))) return;
    if (salesFlowRef.current.lockQuotationLines) {
      setLines([]);
      setLineMeta({});
      setLineDetails({});
      setSalesExtras({ summary: [], panels: [], lineOptions: [], lineNote: '' });
    }
    let data;
    setLinesLoading(true);
    try {
      data = (await crmApi.getQuotationPrefill(ref)).data;
    } catch {
      return; // older backend or no access: the form works as before
    } finally {
      if (seq === prefillSeq.current) setLinesLoading(false);
    }
    if (seq !== prefillSeq.current || !data) return;
    if (!data.available) {
      if (data.reason === 'failed') {
        setSalesPrefill({ warnings: [data.message || 'The extension could not prepare this quotation — fill it in by hand.'], lines: 0 });
      }
      return;
    }
    const auto = autoFilled.current;
    const suggested = (data.lines || []).map((l) => ({
      ...newEditableLine(),
      name: l.name,
      description: l.description || '',
      qty: Number(l.quantity) || 1,
      rate: Number(l.unitPrice) || 0,
      tax: l.tax !== undefined && l.tax !== null ? Number(l.tax) : 18,
    }));
    setLineDetails(Object.fromEntries(suggested.map((l, i) => [l.key, data.lines?.[i]?.details || []])));
    setLineMeta(
      Object.fromEntries(
        suggested.map((l, i) => [
          l.key,
          {
            selected: data.lines?.[i]?.selected !== false,
            unit: data.lines?.[i]?.unit || '',
            extra: { ...(data.lines?.[i]?.extra || {}) },
            sourceRef: data.lines?.[i]?.sourceRef || '',
            group: data.lines?.[i]?.group || '',
          },
        ])
      )
    );
    setSalesExtras({
      summary: data.summary || [],
      panels: data.panels || [],
      lineOptions: data.lineOptions || [],
      lineNote: data.lineNote || '',
    });
    if (data.title) {
      const next = data.title;
      setTitle((prev) => (!prev.trim() || prev === auto.title ? next : prev));
      auto.title = next;
    }
    if (data.description) {
      const next = data.description;
      setDescription((prev) => (!prev.trim() || prev === auto.description ? next : prev));
      auto.description = next;
    }
    if (data.available && salesFlowRef.current.lockQuotationLines) {
      // Lines come only from the extension: always the chosen lead's (none when nothing is complete).
      setLines(suggested);
      auto.lines = lineSignature(suggested);
    } else if (suggested.length) {
      setLines((prev) => (!prev.some((l) => l.name.trim()) || lineSignature(prev) === auto.lines ? suggested : prev));
      auto.lines = lineSignature(suggested);
    }
    const nextSections = (data.sections || []).map((s) => ({ title: s.title, body: s.body }));
    setSections((prev) => (!prev.length || sectionSignature(prev) === auto.sections ? nextSections : prev));
    auto.sections = sectionSignature(nextSections);
    const values = data.values && typeof data.values === 'object' ? data.values : {};
    if (Object.keys(values).length) {
      const before = auto.values;
      setQuoteValues((prev) => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(values)) {
          if (canReplaceWithPrefill(prev[key], before[key], declaredQuoteFields.get(key))) next[key] = value;
        }
        return next;
      });
      auto.values = values;
    }
    if (data.validTill && /^\d{4}-\d{2}-\d{2}$/.test(data.validTill) && !validTillTouched.current) {
      setValidTill(data.validTill);
    }
    setValidTillMax(data.validTillMax && /^\d{4}-\d{2}-\d{2}$/.test(data.validTillMax) ? data.validTillMax : '');
    setSalesChecks(Array.isArray(data.checks) ? data.checks : []);
    setSalesPrefill({ warnings: data.warnings || [], lines: suggested.length, notices: data.notices || [] });
  };

  // Date limits of the chosen lead / opportunity (create and edit).
  useEffect(() => {
    if (!salesLeadId && !opportunityId && !clientRecordId) {
      setDateRules({});
      return undefined;
    }
    let alive = true;
    crmApi
      .getQuotationDateRules(
        clientRecordId ? { recordId: clientRecordId, clientId } : { leadId: salesLeadId, opportunityId }
      )
      .then((res) => {
        if (alive) setDateRules(res.data || {});
      })
      .catch(() => {
        if (alive) setDateRules({}); // older server: it still checks on save
      });
    return () => {
      alive = false;
    };
  }, [salesLeadId, opportunityId, clientRecordId, clientId]);

  // A default Valid Till (not set by hand) never passes the limit; a new quotation starts no earlier than allowed.
  useEffect(() => {
    if (validTillLimit && !validTillTouched.current && validTill > validTillLimit && validTillLimit >= issueDate) setValidTill(validTillLimit);
    if (issueDateMin && issueDate < issueDateMin) setIssueDate(issueDateMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validTillLimit, issueDateMin]);

  const onSelectLead = (id: string) => {
    setLeadId(id);
    // The lead's open opportunity (or none): never keep another lead's opportunity.
    const opp = id ? openOpportunities.find((item) => String(item.leadId || '') === id) : undefined;
    setOpportunityId(opp ? opp._id : '');
    void applySalesFlowPrefill({ leadId: id, opportunityId: opp ? opp._id : '' });
  };

  const onSelectClient = (id: string) => {
    setClientId(id);
  };

  const opportunitySeq = useRef(0);
  const onSelectOpportunity = async (id: string) => {
    const seq = ++opportunitySeq.current;
    setOpportunityId(id);
    if (!id) {
      prefillSeq.current += 1; // any prefill still on its way is for the old choice
      setSalesPrefill(null);
      setSalesChecks([]);
      setValidTillMax('');
      if (salesFlowRef.current.lockQuotationLines) {
        setLines([newEditableLine()]);
        setLineMeta({});
        setLineDetails({});
        setSalesExtras({ summary: [], panels: [], lineOptions: [], lineNote: '' });
      }
      return;
    }

    try {
      const fromList = opportunities.find((item) => item._id === id);
      const opp =
        fromList?.products && fromList.products.length > 0
          ? fromList
          : (await crmApi.getOpportunity(id)).data;
      if (seq !== opportunitySeq.current) return; // the agent picked another opportunity meanwhile

      if (opp.title && !title.trim()) setTitle(opp.title);

      if (clientQuote && opp.clientId) {
        // CRM 3.44.0 (salesFlow.clientQuotation): a deal made for a client is quoted to that client.
        setRecipientType('client');
        setLeadId('');
        setClientId(String(opp.clientId));
      } else if (opp.leadId) {
        setRecipientType('lead');
        setLeadId(String(opp.leadId));
      } else if (opp.clientId) {
        setRecipientType('client');
        setClientId(String(opp.clientId));
      }

      if (opp.shippingState) setShippingState(opp.shippingState);
      if (opp.shippingCharge != null) setShippingCharge(Number(opp.shippingCharge) || 0);
      if (opp.currency) {
        currencyLockedRef.current = true;
        const inherited = normalizeCurrencyCode(opp.currency, settingsCurrency);
        setOpportunitySourceCurrency(inherited);
        setCurrency(inherited);
      } else {
        setOpportunitySourceCurrency(null);
      }

      const products = Array.isArray(opp.products) ? opp.products : [];
      if (products.length > 0) {
        const fromProducts = linesFromSource(
          products.map((line) => ({
            name: line.productName || '',
            description: line.description || '',
            qty: Number(line.quantity) || 1,
            rate: Number(line.unitPrice) || 0,
            tax: line.tax !== undefined && line.tax !== null && Number.isFinite(Number(line.tax)) ? Number(line.tax) : 18,
          }))
        );
        setLines(fromProducts);
        // Filled automatically: the extension's priced lines may replace them below.
        autoFilled.current.lines = lineSignature(fromProducts);
      }

      setError(null);
      void applySalesFlowPrefill({ opportunityId: id, leadId: opp.leadId ? String(opp.leadId) : undefined });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load opportunity products');
    }
  };

  const submit = async (asDraft: boolean) => {
    setError(null);
    const recipientId = recipientType === 'lead' ? leadId : clientId;
    if (needsOpportunity && !opportunityId) {
      setError('Choose the opportunity this quotation belongs to (create one from the lead first).');
      return;
    }
    if (clientNoOpportunity && !isEdit && !clientEnquiryId && !clientRecordId) {
      setError('Finish the client step first: choose the client, then complete what it asks for.');
      if (clientId) setPickerClientId(clientId);
      return;
    }
    const validLines = pricedLines.filter((line) => line.name.trim() && line.qty > 0 && line.rate >= 0);
    if (lockLines) {
      if (!pricedLines.length) {
        setError('Select at least one service line for this quotation.');
        return;
      }
      const unnamed = pricedLines.find((line) => !line.name.trim());
      if (unnamed) {
        setError('Every added line needs a service name.');
        return;
      }
      const noQty = pricedLines.find((line) => !(line.qty > 0));
      if (noQty) {
        setError(`Quantity for "${noQty.name}" must be greater than zero.`);
        return;
      }
      const unpriced = validLines.find((line) => !(line.rate > 0));
      if (unpriced) {
        setError(`Enter a rate for "${unpriced.name}".`);
        return;
      }
      const badTax = validLines.find((line) => !(line.tax >= 0 && line.tax <= 100));
      if (badTax) {
        setError(`Tax for "${badTax.name}" must be between 0 and 100%.`);
        return;
      }
    }
    if (
      !recipientId ||
      !shippingState.trim() ||
      !issueDate ||
      !validTill ||
      !currency.trim() ||
      validLines.length === 0
    ) {
      setError('Complete all required fields and provide at least one valid line item.');
      return;
    }
    if (issueDateMin && issueDate < issueDateMin) {
      setError(`Issue Date cannot be before ${formatDay(issueDateMin)}.`);
      return;
    }
    if (validTill < issueDate) {
      setError('Valid Till cannot be before Issue Date.');
      return;
    }
    if (validTillLimit && validTill > validTillLimit) {
      setError(`Valid Till cannot be after ${validTillLimitText}.`);
      return;
    }
    if (!(totals.grandTotal > 0)) {
      setError('Enter the prices — the quotation total must be greater than zero.');
      return;
    }
    const cleanSections = sections
      .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
      .filter((s) => s.title || s.body);
    const badSection = cleanSections.find((s) => !s.title || !s.body);
    if (badSection) {
      setError(`Every section needs a title and some text${badSection.title ? ` ("${badSection.title}")` : ''}.`);
      return;
    }
    if (cleanSections.length > MAX_SECTIONS) {
      setError(`A quotation can have at most ${MAX_SECTIONS} sections.`);
      return;
    }
    if (validTillMax && validTill > validTillMax) {
      const goOn = await confirm({
        title: 'Check the expiry date',
        message: `Valid till is after ${formatDay(validTillMax)} (the latest date this quotation should be valid). Save anyway?`,
        confirmLabel: 'Save anyway',
      });
      if (!goOn) return;
    }
    setSaving(true);
    try {
      const payload = {
        recipientType,
        clientId: recipientType === 'client' ? clientId : undefined,
        leadId: recipientType === 'lead' ? leadId : clientNoOpportunity && clientEnquiryId ? clientEnquiryId : undefined,
        opportunityId: clientNoOpportunity ? undefined : opportunityId || undefined,
        // CRM 3.51.0: the client's trip record (no lead).
        extensionRecordId: clientNoOpportunity && clientRecordId ? clientRecordId : undefined,
        shippingState: shippingState.trim(),
        issueDate,
        validTill,
        currency: currency.toUpperCase(),
        taxCalculation,
        title: title.trim(),
        description: description.trim(),
        lineItems: validLines.map((line) => ({
          name: line.name.trim(),
          description: line.description.trim(),
          qty: line.qty,
          rate: line.rate,
          tax: line.tax,
          fileUrl: line.fileUrl?.trim() || undefined,
          ...(lineMeta[line.key]
            ? {
                unit: lineMeta[line.key].unit.trim() || undefined,
                sourceRef: lineMeta[line.key].sourceRef || undefined,
                group: lineMeta[line.key].group || undefined,
                extra: Object.fromEntries(
                  Object.entries(lineMeta[line.key].extra).filter(([, v]) => String(v || '').trim())
                ),
              }
            : {}),
        })),
        discountType,
        discountValue: clampDiscountValue(discountType, discountValue),
        shippingCharge: terms.hideShipping ? 0 : shippingCharge,
        recipientNotes: recipientNotes.trim(),
        sections: cleanSections,
        ...(proformaEnabled
          ? {
              paymentType,
              advanceMode: paymentType === 'advance' ? advanceMode : 'percent',
              advanceValue: paymentType === 'advance' ? Number(advanceValue) || 0 : 0,
            }
          : {}),
      };

      let savedId = '';
      if (isEdit && editId) {
        await crmApi.updateQuotation(editId, payload);
        savedId = editId;
      } else {
        const created = await crmApi.createQuotation(payload);
        void asDraft;
        savedId = created.data._id;
      }
      // Declared quotation fields, then the extension's own copy; neither undoes the saved quotation.
      const problems: string[] = [];
      let valuesSaved = false;
      if (quoteValuesUnloaded) {
        problems.push('the saved quotation fields could not be loaded, so they were left unchanged');
      } else if (savedId && hasQuoteFields && Object.keys(quoteValues).length) {
        // Saving values also tells the extension (server side), so no second call is needed then.
        valuesSaved = await extensionDataApi
          .setValues('quotation', savedId, quoteValues)
          .then(() => true)
          .catch((err: unknown) => {
            problems.push(err instanceof Error && err.message ? err.message : 'the fields were not saved');
            return false;
          });
      }
      if (savedId && quoteForm?.savedRoute && !valuesSaved) {
        const syncProblem = await notifySalesFlowSaved('quotation', savedId);
        if (syncProblem) problems.push(syncProblem);
      }
      if (problems.length) {
        // Not awaited: the notice stays up on the next page.
        void alert({
          title: 'Quotation saved',
          message: `Quotation saved. ${salesFlow.extensionName || 'Extension'} details were not synced: ${problems.join(' · ')}`,
        });
      }
      if (isEdit && editId) {
        navigate(`/quotations/${editId}`);
      } else if (returnTo.startsWith('/leads/')) {
        navigate(returnTo);
      } else {
        navigate(`/quotations/${savedId}`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? 'Failed to update quotation'
            : 'Failed to create quotation'
      );
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return <div className="p-12 text-center text-sm text-zinc-500">Loading quotation for edit…</div>;
  }

  if (isEdit && editStatus && editStatus !== 'Draft') {
    return (
      <div className="py-16 text-center text-sm text-zinc-700 max-w-lg mx-auto">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
          <h2 className="text-lg font-bold text-zinc-950 mb-2">Quotation Locked</h2>
          <p className="text-sm text-zinc-600 mb-4">
            Only quotations in <strong>Draft</strong> status can be edited. Quotation{' '}
            <strong>{editQuotationNo || editId}</strong> is currently in <strong>{editStatus}</strong> status and is read-only.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to={`/quotations/${editId}`}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-zinc-950 text-white text-xs font-semibold no-underline"
            >
              View Quotation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!canWriteFinance) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        You do not have permission to create quotations.
        <div className="mt-3">
          <Link to={returnTo} className="text-sm font-semibold text-zinc-950 no-underline hover:underline">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-tour="quotations-create-form" className="flex w-full flex-col gap-5 pb-14">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <Link
            to={isEdit ? `/quotations/${editId}` : returnTo}
            className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950"
          >
            {isEdit
              ? '← Back to quotation'
              : returnTo.startsWith('/leads/')
                ? '← Back to lead'
                : '← Quotations'}
          </Link>
          <h1 className="text-2xl font-bold text-zinc-950 m-0 mt-2">
            {isEdit
              ? `Edit Quotation ${editQuotationNo ? `(${editQuotationNo})` : ''}`
              : (salesFlow.lockQuotationLines && salesFlow.quotationPageTitle) || 'New Quotation'}
          </h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {isEdit
              ? 'Update draft quotation pricing, client details, and terms before sending.'
              : salesFlow.lockQuotationLines && salesFlow.quotationPageSubtitle
                ? salesFlow.quotationPageSubtitle
                : fromScan
                ? 'Filled from scanned PDF. Number assigned automatically on save.'
                : presetLeadId
                  ? 'Pre-filled for this lead. Number assigned automatically on save.'
                  : 'Number assigned automatically on save.'}
          </p>
        </div>
        {/* salesFlow.hideQuotationTemplates: the active extension has no quotation templates. */}
        {!salesFlow.hideQuotationTemplates && (
        <div data-tour="quotations-create-template-tools" className="flex flex-wrap gap-2">
          {lockLines || waitingLines ? null : (
          <select
            className={`${financeFieldClass} lg:max-w-xs`}
            value={templateId}
            onChange={(event) => loadTemplate(event.target.value)}
          >
            <option value="">Load Template…</option>
            {templates.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
                {item.category ? ` · ${item.category}` : ''}
              </option>
            ))}
          </select>
          )}
          <button
            type="button"
            onClick={saveAsTemplate}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
          >
            Save as Template
          </button>
        </div>
        )}
      </header>

      {pickerClientId ? (
        <ClientQuotationPicker
          clientId={pickerClientId}
          clientName={clients.find((c) => String(c._id) === pickerClientId)?.name}
          onClose={() => setPickerClientId('')}
          onStarted={async (result) => {
            const forClient = pickerClientId;
            setPickerClientId('');
            if (result.opportunityId) {
              let title = '';
              try {
                title = String((await crmApi.getOpportunity(result.opportunityId)).data?.title || '');
              } catch {
                title = '';
              }
              setStartedFor({ clientId: forClient, opportunityId: result.opportunityId, title });
              await onSelectOpportunity(result.opportunityId);
              // CRM 3.44.0: the quotation stays the client's (the trip opportunity may also carry its lead).
              setRecipientType('client');
              setLeadId('');
              setClientId(forClient);
            } else if (result.recordId && clientQuote) {
              // CRM 3.51.0: the extension keeps the trip in its own record — no lead is made.
              setStartedFor({ clientId: forClient, opportunityId: '', recordId: result.recordId, title: '' });
              setRecipientType('client');
              setLeadId('');
              setClientId(forClient);
              setOpportunityId('');
              void applySalesFlowPrefill({ recordId: result.recordId, clientId: forClient });
            } else if (result.leadId && clientQuote) {
              // CRM 3.45.0: no opportunity: the quotation is the client's, made for the enquiry just prepared.
              setStartedFor({ clientId: forClient, opportunityId: '', leadId: result.leadId, title: '' });
              setRecipientType('client');
              setLeadId('');
              setClientId(forClient);
              setOpportunityId('');
              void applySalesFlowPrefill({ leadId: result.leadId });
            } else if (result.leadId) {
              onSelectLead(result.leadId);
            }
          }}
        />
      ) : null}

      <form
        id="quotation-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(false);
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        <div data-tour="quotations-create-recipient">
          <FormSection title="Recipient & pipeline">
          {salesFlow.available && salesFlow.lockQuotationLines && salesFlow.extensionName ? (
            <div className="flex justify-end -mt-9 mb-3" data-testid="quotation-extension-badge">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <span aria-hidden>✦</span> {salesFlow.extensionName} extension active
              </span>
            </div>
          ) : null}
          {needsOpportunity ? (
            <div className="mb-4" data-testid="quotation-opportunity-required">
              <FormField label="Opportunity" required wide>
                <select
                  className={financeFieldClass}
                  value={opportunityId}
                  required
                  onChange={(e) => {
                    void onSelectOpportunity(e.target.value);
                  }}
                >
                  <option value="">Select opportunity…</option>
                  {startedFor && !openOpportunities.some((o) => o._id === startedFor.opportunityId) ? (
                    <option value={startedFor.opportunityId}>{startedFor.title || 'Trip opportunity'}</option>
                  ) : null}
                  {openOpportunities.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                      {item.opportunityNumber ? ` · ${item.opportunityNumber}` : ''}
                      {item.stage ? ` (${item.stage})` : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <p className="text-[11px] text-zinc-500 m-0 mt-1.5">
                New quotations belong to an opportunity. The lead or client comes from it.{' '}
                {leadId && !openOpportunities.some((o) => String(o.leadId || '') === leadId) ? (
                  <Link to={`/opportunities/create?leadId=${encodeURIComponent(leadId)}`} className="font-semibold text-zinc-900">
                    Create an opportunity for this lead
                  </Link>
                ) : !openOpportunities.length ? (
                  <Link to="/opportunities/create" className="font-semibold text-zinc-900">
                    Create an opportunity
                  </Link>
                ) : null}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Recipient type" required wide>
              <div className="flex flex-wrap gap-4 h-9 items-center text-sm text-zinc-800">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    checked={recipientType === 'lead'}
                    disabled={needsOpportunity && !clientQuote}
                    onChange={() => {
                      setRecipientType('lead');
                      setClientId('');
                    }}
                  />
                  Lead contact
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    checked={recipientType === 'client'}
                    disabled={needsOpportunity && !clientQuote}
                    onChange={() => {
                      setRecipientType('client');
                      setLeadId('');
                      if (clientQuote) {
                        setClientId('');
                        void onSelectOpportunity('');
                      }
                    }}
                  />
                  Client account
                </label>
              </div>
            </FormField>

            {recipientType === 'lead' ? (
              <FormField label="Lead" required>
                <select
                  className={financeFieldClass}
                  value={leadId}
                  disabled={needsOpportunity}
                  onChange={(e) => onSelectLead(e.target.value)}
                >
                  <option value="">{needsOpportunity ? 'From the opportunity' : 'Select lead…'}</option>
                  {leadId && !leads.some((item) => item._id === leadId) ? <option value={leadId}>Linked lead</option> : null}
                  {leads.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.company || item.name}
                      {item.email ? ` · ${item.email}` : ''}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <FormField label="Client" required>
                <ClientSelect
                  clients={clients}
                  value={clientId}
                  required
                  placeholder="Select client…"
                  onChange={(nextId) => {
                    onSelectClient(nextId);
                    if (clientQuote && nextId) setPickerClientId(nextId);
                  }}
                  optionNote={clientQuote ? (c) => (clientNotReady(String(c._id)) ? notReadyLabel : '') : undefined}
                />
                {clientQuote ? (
                  <p className="m-0 mt-1.5 text-[11px] text-zinc-500" data-testid="client-quotation-hint">
                    {startedFor && startedFor.clientId === clientId
                      ? startedFor.opportunityId
                        ? 'Ready: the trip opportunity below holds the travellers you chose.'
                        : 'Ready: the travellers you chose are kept with this quotation.'
                      : clientQuote.notEligibleText || 'Clients that are not ready yet are marked.'}
                    {clientId && clientNotReady(clientId) ? (
                      <>
                        {' '}
                        <Link to={`/clients/${encodeURIComponent(clientId)}`} className="text-[11px] font-semibold text-amber-700 underline" data-testid="client-quotation-not-ready">
                          {notReadyLabel}: open the client
                        </Link>
                      </>
                    ) : clientId && !(startedFor && startedFor.clientId === clientId) ? (
                      <>
                        {' '}
                        <button type="button" onClick={() => setPickerClientId(clientId)} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-zinc-900 underline">
                          Choose travellers
                        </button>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </FormField>
            )}

            {needsOpportunity || clientNoOpportunity ? null : (
            <FormField label="Opportunity">
              <select
                className={financeFieldClass}
                value={opportunityId}
                onChange={(e) => {
                  void onSelectOpportunity(e.target.value);
                }}
              >
                <option value="">None</option>
                {openOpportunities
                  .map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                      {item.opportunityNumber ? ` · ${item.opportunityNumber}` : ''}
                      {item.stage ? ` (${item.stage})` : ''}
                    </option>
                  ))}
              </select>
              {opportunityId ? (
                <p className="text-[11px] text-zinc-500 m-0 mt-1.5">
                  Selecting a deal loads its {terms.proposedLines} into this quotation
                  (and copies client/lead and title{terms.hideShipping ? '' : ', and shipping'} when available). Won deals
                  with an accepted quotation are excluded.
                </p>
              ) : null}
            </FormField>
            )}

            <FormField label={terms.hideShipping ? 'Place of supply (GST)' : 'Destination state'} required>
              <select
                className={financeFieldClass}
                value={shippingState}
                onChange={(e) => setShippingState(e.target.value)}
              >
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="GST mode">
              <div className="h-9 flex items-center">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    gstMode === 'intra'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-sky-50 text-sky-800'
                  }`}
                >
                  {gstMode === 'intra' ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
                </span>
              </div>
            </FormField>
          </div>
        </FormSection>
        </div>

        {(lockLines && salesExtras.summary.length) || waitingLines ? (
          <SalesFlowSummaryStrip
            title={salesFlow.quotationSummaryTitle || 'Summary'}
            items={lockLines ? salesExtras.summary : []}
            emptyText={waitingLines ? waitingText : undefined}
            // The trip details live on the opportunity (or the lead): edited there, not per service.
            editHref={
              opportunityId
                ? `/opportunities/${encodeURIComponent(opportunityId)}`
                : salesLeadId
                  ? `/leads/${encodeURIComponent(salesLeadId)}`
                  : undefined
            }
          />
        ) : null}

        <div data-tour="quotations-create-commercial">
          <FormSection title="Commercial terms">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Issue date" required>
              <input
                className={financeFieldClass}
                type="date"
                value={issueDate}
                min={issueDateMin || undefined}
                max={validTillLimit || undefined}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  if (validTill < e.target.value) {
                    const next = addDays(e.target.value, 30);
                    setValidTill(validTillLimit && next > validTillLimit && validTillLimit >= e.target.value ? validTillLimit : next);
                  }
                }}
              />
            </FormField>
            <FormField label="Valid till" required>
              <input
                className={financeFieldClass}
                type="date"
                value={validTill}
                min={issueDate || undefined}
                max={validTillLimit || undefined}
                onChange={(e) => {
                  validTillTouched.current = true;
                  setValidTill(e.target.value);
                }}
              />
              {validTillLimit ? (
                <p
                  className={`m-0 mt-1 text-[11px] ${validTill > validTillLimit ? 'text-rose-700' : 'text-zinc-500'}`}
                  data-testid="quotation-valid-till-limit"
                >
                  {validTill > validTillLimit ? `Valid Till cannot be after ${validTillLimitText}.` : `Up to ${validTillLimitText}.`}
                </p>
              ) : null}
              {validTillMax && validTill > validTillMax ? (
                <p className="m-0 mt-1 text-[11px] text-amber-700" data-testid="quotation-valid-till-max">
                  After {formatDay(validTillMax)}, the latest date suggested for this quotation.
                </p>
              ) : null}
            </FormField>
            <FormField label="Currency" required>
              <select
                className={financeFieldClass}
                value={currency}
                onChange={(e) => {
                  currencyLockedRef.current = true;
                  setCurrency(e.target.value);
                }}
              >
                {Array.from(new Set([...QUOTATION_CURRENCIES, currency, settingsCurrency])).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </FormField>
            {opportunitySourceCurrency &&
              normalizeCurrencyCode(currency, settingsCurrency) !==
                normalizeCurrencyCode(opportunitySourceCurrency, settingsCurrency) && (
                <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Currency differs from linked opportunity (
                  {normalizeCurrencyCode(opportunitySourceCurrency, settingsCurrency)} →{' '}
                  {normalizeCurrencyCode(currency, settingsCurrency)}). Confirm the change. Inherited
                  opportunity currency is not replaced by the global default.
                </div>
              )}
            <FormField label="Calculate tax" required>
              <select
                className={financeFieldClass}
                value={taxCalculation}
                onChange={(e) => setTaxCalculation(e.target.value as TaxCalculation)}
              >
                <option value="after_discount">After discount</option>
                <option value="before_discount">Before discount</option>
              </select>
            </FormField>
            <FormField label="Quotation title" wide>
              <input
                className={financeFieldClass}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cloud Migration & Support Retainer"
              />
            </FormField>
            <FormField label="Description / scope" wide>
              <textarea
                className={financeTextAreaClass}
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>
        </div>

        {salesPrefill?.notices?.length ? <SalesFlowNotices notices={salesPrefill.notices} leadId={salesLeadId} /> : null}

        {salesPrefill ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3" data-testid="quotation-sales-prefill">
            {salesPrefill.lines ? (
              <p className="m-0 text-xs text-zinc-600">
                {salesPrefill.lines} service{salesPrefill.lines === 1 ? '' : 's'}
                {salesFlow.hideQuotationSections ? ' were' : ' and the sections below were'} filled from the lead's
                requirements. Enter a price for each one{salesFlow.hideQuotationSections ? '' : ' and review the text'} before saving.
              </p>
            ) : null}
            {salesPrefill.warnings.length ? (
              <ul className="m-0 mt-1 pl-4 text-xs text-amber-700 space-y-0.5">
                {salesPrefill.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {lockLines || waitingLines ? (
          <>
            <SalesFlowLinesTable
              title={salesFlow.quotationLinesTitle || 'Lines'}
              subtitle={salesFlow.quotationLinesSubtitle || 'Lines suggested from the lead. Review, select and confirm for this quotation.'}
              addLabel={salesFlow.quotationAddLineLabel || 'Add line'}
              lines={lines}
              setLines={setLines}
              meta={lineMeta}
              setMeta={setLineMeta}
              details={lineDetails}
              fields={salesFlow.quotationLineFields || []}
              lineOptions={salesExtras.lineOptions}
              note={salesExtras.lineNote}
              currency={currency}
              loading={linesLoading}
              newLine={newEditableLine}
              groups={lineGroups}
              fixed={Boolean(salesFlow.fixedLines)}
              requirement={
                salesFlow.requirementLink && salesLeadId
                  ? { href: leadTabHref(salesLeadId, salesFlow.requirementLink.leadTab), label: salesFlow.requirementLink.label }
                  : null
              }
              disabled={waitingLines}
              emptyText={waitingLines ? waitingText : undefined}
            />
          </>
        ) : (
          <div data-tour="quotations-create-lines" className="bg-white border border-zinc-300 rounded-xl p-4">
            <LineItemsEditor lines={lines} setLines={setLines} showFileUrl />
          </div>
        )}

        <ExtensionCreateFields
          record="quotation"
          values={quoteValues}
          onChange={setQuoteValues}
          disabled={saving || fieldsWaiting}
          disabledHint={fieldsWaiting ? waitingText : undefined}
        />

        {(sections.length || salesPrefill) && !(lockLines && salesFlow.hideQuotationSections) ? (
          <div className="bg-white border border-zinc-300 rounded-xl p-4" data-testid="quotation-sections">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="m-0 text-sm font-semibold text-zinc-950">Terms &amp; details</h2>
                <p className="m-0 text-xs text-zinc-500">Printed on the quotation after the totals.</p>
              </div>
              <button
                type="button"
                className="h-8 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                disabled={sections.length >= MAX_SECTIONS}
                onClick={() => setSections((prev) => [...prev, { title: '', body: '' }])}
              >
                Add section
              </button>
            </div>
            {!sections.length ? <p className="m-0 text-xs text-zinc-500">No sections.</p> : null}
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={index} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex gap-2 mb-2">
                    <input
                      className={financeFieldClass}
                      maxLength={80}
                      value={section.title}
                      placeholder="Section title"
                      aria-label={`Section ${index + 1} title`}
                      onChange={(e) =>
                        setSections((prev) => prev.map((s, i) => (i === index ? { ...s, title: e.target.value } : s)))
                      }
                    />
                    <button
                      type="button"
                      className="h-10 px-3 text-xs font-semibold rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 shrink-0"
                      onClick={() => setSections((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    className={financeTextAreaClass}
                    rows={4}
                    maxLength={3000}
                    value={section.body}
                    aria-label={`Section ${index + 1} text`}
                    onChange={(e) =>
                      setSections((prev) => prev.map((s, i) => (i === index ? { ...s, body: e.target.value } : s)))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {proformaEnabled && (
          <div data-tour="quotations-create-payment-terms" className="bg-white border border-zinc-300 rounded-xl p-5">
            <h2 className="m-0 mb-1 text-sm font-semibold text-zinc-950">Payment Terms &amp; Advance Payment</h2>
            <p className="m-0 mb-3 text-xs text-zinc-500">
              Select whether this quotation requires full payment or an initial advance. A proforma invoice will be raised accordingly.
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { value: 'full' as QuotationPaymentType, label: 'Full Payment' },
                { value: 'advance' as QuotationPaymentType, label: 'Advance Payment' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentType(option.value)}
                  className={`h-8 rounded-lg border px-3 text-xs font-semibold cursor-pointer transition-colors ${
                    paymentType === option.value
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {paymentType === 'advance' && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                  {[
                    { value: 'percent' as QuotationAdvanceMode, label: 'Percentage (%)' },
                    { value: 'amount' as QuotationAdvanceMode, label: 'Fixed Amount' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAdvanceMode(option.value)}
                      className={`h-7 rounded-md border-0 px-3 text-xs font-semibold cursor-pointer transition-colors ${
                        advanceMode === option.value
                          ? 'bg-zinc-950 text-white shadow-xs'
                          : 'bg-transparent text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">
                    {advanceMode === 'percent' ? 'Advance %' : `Advance (${currency})`}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={advanceMode === 'percent' ? 100 : undefined}
                    value={advanceValue}
                    onChange={(event) => setAdvanceValue(Number(event.target.value) || 0)}
                    className="h-9 w-40 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                  />
                </label>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
              {payableNow.error ? (
                <p className="m-0 font-semibold text-amber-800">{payableNow.error}</p>
              ) : (
                <>
                  <p className="m-0 text-zinc-700">
                    Payable now:{' '}
                    <strong className="text-zinc-950">
                      {formatFinanceMoney(payableNow.amount, currency)}
                    </strong>{' '}
                    of {formatFinanceMoney(payableNow.total, currency)}
                  </p>
                  {payableNow.isAdvance && (
                    <p className="m-0 mt-0.5 text-zinc-500">
                      Remaining balance {formatFinanceMoney(payableNow.balance, currency)} will be invoiced with the final Tax Invoice upon delivery/completion.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="flex flex-col gap-5">
          {lockLines ? salesExtras.panels.map((panel, i) => <SalesFlowListCard key={`${panel.title}-${i}`} panel={panel} />) : null}
          <FormSection title="Recipient notes">
            <FormField label="Notes / payment terms">
              <textarea
                className={financeTextAreaClass}
                rows={6}
                maxLength={2000}
                value={recipientNotes}
                onChange={(e) => setRecipientNotes(e.target.value)}
                placeholder="50% advance, balance on delivery…"
              />
            </FormField>
          </FormSection>
          </div>

          <div data-tour="quotations-create-totals" className="flex flex-col gap-5">
            {formChecks.length ? <SalesFlowChecklist checks={formChecks} /> : null}
            <FormSection title={terms.hideShipping ? terms.commercialSummary : 'Summary & totals'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <FormField label="Discount type">
                <select
                  className={financeFieldClass}
                  value={discountType}
                  onChange={(e) => {
                    const next = e.target.value as DiscountType;
                    setDiscountType(next);
                    if (next === 'percent') {
                      setDiscountValue((prev) => Math.min(100, Math.max(0, Number(prev) || 0)));
                    }
                  }}
                >
                  <option value="percent">Percent</option>
                  <option value="amount">Amount</option>
                </select>
              </FormField>
              <FormField label="Discount value">
                <input
                  className={financeFieldClass}
                  type="number"
                  min={0}
                  max={discountType === 'percent' ? 100 : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setDiscountValue(
                      discountType === 'percent'
                        ? Math.min(100, Math.max(0, next || 0))
                        : Math.max(0, next || 0)
                    );
                  }}
                />
              </FormField>
              {terms.hideShipping ? null : (
              <FormField label="Shipping charge">
                <input
                  className={financeFieldClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={shippingCharge}
                  onChange={(e) => setShippingCharge(Number(e.target.value))}
                />
              </FormField>
              )}
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm space-y-2 sticky top-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <strong>{formatFinanceMoney(totals.subtotal, currency)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <strong>-{formatFinanceMoney(totals.discount, currency)}</strong>
              </div>
              {gstMode === 'intra' ? (
                <>
                  <div className="flex justify-between">
                    <span>CGST</span>
                    <strong>{formatFinanceMoney(cgst, currency)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST</span>
                    <strong>{formatFinanceMoney(sgst, currency)}</strong>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>IGST</span>
                  <strong>{formatFinanceMoney(igst, currency)}</strong>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax total</span>
                <strong>{formatFinanceMoney(totals.taxTotal, currency)}</strong>
              </div>
              {terms.hideShipping ? null : (
              <div className="flex justify-between">
                <span>Shipping</span>
                <strong>{formatFinanceMoney(totals.shippingCharge, currency)}</strong>
              </div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
                <span>Grand total</span>
                <strong>{formatFinanceMoney(totals.grandTotal, currency)}</strong>
              </div>
              {showTotalPer && totalPer ? (
                <div className="flex justify-between gap-3 text-zinc-700" data-testid="quotation-total-per">
                  <span>
                    {totalPer.label} ({totalPerCount})
                  </span>
                  <strong>{formatFinanceMoney(totals.grandTotal / totalPerCount, currency)}</strong>
                </div>
              ) : null}
            </div>
          </FormSection>
          </div>
        </div>

        <div
          data-tour="quotations-create-actions"
          className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200"
        >
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/quotations/${editId}` : returnTo)}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
          >
            {isEdit ? 'Cancel' : returnTo.startsWith('/leads/') ? 'Back to lead' : 'Cancel'}
          </button>
          <div className="flex flex-wrap gap-2">
            {!isEdit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => submit(true)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-3.5 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Quotation'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
