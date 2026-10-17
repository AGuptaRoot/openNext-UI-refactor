import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import {
  COMPANY_STATE_DEFAULT,
  QUOTATION_CURRENCIES,
  type DiscountType,
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
import { calculateFinanceTotals, clampDiscountValue } from '../../utils/financeTotals';
import {
  consumeFinancePdfScanDraft,
  linesFromPdfExtract,
  normalizeTaxCalculationValue,
} from '../../utils/financePdfScanDraft';
import { normalizeCurrencyCode, useDefaultCurrency } from '../../hooks/useDefaultCurrency';

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
    tax: Number(item.tax) || 18,
    fileUrl: item.fileUrl || '',
  }));
}

export const QuotationCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const presetLeadId = String(searchParams.get('leadId') || '').trim();
  const fromScan = searchParams.get('fromScan') === '1';
  const { clients, leads, opportunities } = useFinanceOptions();
  const { alert, prompt } = useDialog();
  const { hasAnyPermission, isClient } = useAuth();
  const canWriteFinance = hasAnyPermission('crm.quotes.write', 'crm.finance.write') && !isClient;
  const settingsCurrency = useDefaultCurrency();
  const currencyLockedRef = useRef(false);

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

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
    if (!presetLeadId) return;
    setRecipientType('lead');
    setLeadId(presetLeadId);
  }, [presetLeadId]);

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

  const totals = useMemo(
    () =>
      calculateFinanceTotals({
        lines: lines.map((line) => ({ qty: line.qty, rate: line.rate, tax: line.tax })),
        discountType,
        discountValue,
        taxCalculation,
        shippingCharge,
      }),
    [lines, discountType, discountValue, taxCalculation, shippingCharge]
  );

  const cgst = gstMode === 'intra' ? totals.taxTotal / 2 : 0;
  const sgst = gstMode === 'intra' ? totals.taxTotal / 2 : 0;
  const igst = gstMode === 'inter' ? totals.taxTotal : 0;

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
        shippingCharge,
        recipientNotes,
        terms: recipientNotes,
        discountType,
        discountValue,
        lineItems: lines
          .filter((line) => line.name.trim())
          .map((line) => ({
            name: line.name.trim(),
            description: line.description.trim(),
            qty: line.qty,
            rate: line.rate,
            tax: line.tax,
            fileUrl: line.fileUrl?.trim() || undefined,
          })),
      });
      const refreshed = await crmApi.listQuotationTemplates();
      setTemplates(refreshed.data || []);
      await alert('Template saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save template');
    }
  };

  const onSelectLead = (id: string) => {
    setLeadId(id);
    const lead = leads.find((item) => item._id === id);
    if (lead) {
      const opp = opportunities.find(
        (item) => item.leadId === id || (item as { contactId?: string }).contactId === id
      );
      if (opp && !opportunityId) setOpportunityId(opp._id);
    }
  };

  const onSelectClient = (id: string) => {
    setClientId(id);
  };

  const onSelectOpportunity = async (id: string) => {
    setOpportunityId(id);
    if (!id) return;

    try {
      const fromList = opportunities.find((item) => item._id === id);
      const opp =
        fromList?.products && fromList.products.length > 0
          ? fromList
          : (await crmApi.getOpportunity(id)).data;

      if (opp.title && !title.trim()) setTitle(opp.title);

      if (opp.leadId) {
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
        setLines(
          linesFromSource(
            products.map((line) => ({
              name: line.productName || '',
              description: '',
              qty: Number(line.quantity) || 1,
              rate: Number(line.unitPrice) || 0,
              tax: Number(line.tax) || 18,
            }))
          )
        );
      }

      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load opportunity products');
    }
  };

  const submit = async (asDraft: boolean) => {
    setError(null);
    const recipientId = recipientType === 'lead' ? leadId : clientId;
    const validLines = lines.filter((line) => line.name.trim() && line.qty > 0 && line.rate >= 0);
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
    if (validTill < issueDate) {
      setError('Valid till date cannot be before the issue date.');
      return;
    }
    setSaving(true);
    try {
      const created = await crmApi.createQuotation({
        recipientType,
        clientId: recipientType === 'client' ? clientId : undefined,
        leadId: recipientType === 'lead' ? leadId : undefined,
        opportunityId: opportunityId || undefined,
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
        })),
        discountType,
        discountValue: clampDiscountValue(discountType, discountValue),
        shippingCharge,
        recipientNotes: recipientNotes.trim(),
      });
      void asDraft;
      if (returnTo.startsWith('/leads/')) {
        navigate(returnTo);
      } else {
        navigate(`/quotations/${created.data._id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create quotation');
      setSaving(false);
    }
  };

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
          <Link to={returnTo} className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950">
            {returnTo.startsWith('/leads/') ? '← Back to lead' : '← Quotations'}
          </Link>
          <h1 className="text-2xl font-bold text-zinc-950 m-0 mt-2">New Quotation</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {fromScan
              ? 'Filled from scanned PDF. Number assigned automatically on save.'
              : presetLeadId
                ? 'Pre-filled for this lead. Number assigned automatically on save.'
                : 'Number assigned automatically on save.'}
          </p>
        </div>
        <div data-tour="quotations-create-template-tools" className="flex flex-wrap gap-2">
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
          <button
            type="button"
            onClick={saveAsTemplate}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
          >
            Save as Template
          </button>
        </div>
      </header>

      {scanNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {scanNotice}
        </div>
      ) : null}

      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Recipient type" required wide>
              <div className="flex flex-wrap gap-4 h-9 items-center text-sm text-zinc-800">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    checked={recipientType === 'lead'}
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
                    onChange={() => {
                      setRecipientType('client');
                      setLeadId('');
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
                  onChange={(e) => onSelectLead(e.target.value)}
                >
                  <option value="">Select lead…</option>
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
                  onChange={(nextId) => onSelectClient(nextId)}
                />
              </FormField>
            )}

            <FormField label="Opportunity">
              <select
                className={financeFieldClass}
                value={opportunityId}
                onChange={(e) => {
                  void onSelectOpportunity(e.target.value);
                }}
              >
                <option value="">None</option>
                {opportunities
                  .filter((item) => {
                    if (item.acceptedQuotationId) return false;
                    const stage = String(item.stage || '').toLowerCase();
                    return stage !== 'won' && stage !== 'lost';
                  })
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
                  Selecting a deal loads its Proposed Products &amp; Line Items into this quotation
                  (and copies client/lead, title, and shipping when available). Won deals with an
                  accepted quotation are excluded.
                </p>
              ) : null}
            </FormField>

            <FormField label="Destination state" required>
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

        <div data-tour="quotations-create-commercial">
          <FormSection title="Commercial terms">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Issue date" required>
              <input
                className={financeFieldClass}
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  if (validTill < e.target.value) setValidTill(addDays(e.target.value, 30));
                }}
              />
            </FormField>
            <FormField label="Valid till" required>
              <input
                className={financeFieldClass}
                type="date"
                value={validTill}
                onChange={(e) => setValidTill(e.target.value)}
              />
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

        <div data-tour="quotations-create-lines" className="bg-white border border-zinc-300 rounded-xl p-4">
          <LineItemsEditor lines={lines} setLines={setLines} showFileUrl />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

          <div data-tour="quotations-create-totals">
            <FormSection title="Summary & totals">
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
              <div className="flex justify-between">
                <span>Shipping</span>
                <strong>{formatFinanceMoney(totals.shippingCharge, currency)}</strong>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
                <span>Grand total</span>
                <strong>{formatFinanceMoney(totals.grandTotal, currency)}</strong>
              </div>
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
            onClick={() => navigate(returnTo)}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
          >
            {returnTo.startsWith('/leads/') ? 'Back to lead' : 'Cancel'}
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => submit(true)}
              className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-3.5 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Quotation'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
