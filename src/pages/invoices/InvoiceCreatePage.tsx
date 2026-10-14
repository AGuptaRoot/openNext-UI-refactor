import { displayLabel } from '../../utils/displayLabels';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import type { DiscountType, TaxCalculation } from '../../types/quotations';
import type { QuotationItem } from '../../types/quotations';
import type { SalesOrderItem } from '../../types/salesOrders';
import type { InvoiceTemplateItem } from '../../types/invoiceTemplates';
import { INVOICE_CURRENCIES } from '../../types/invoices';
import {
  CreatePageHeader,
  EditableLine,
  FormField,
  FormSection,
  LineItemsEditor,
  financeFieldClass,
  financeTextAreaClass,
  newEditableLine,
} from '../../components/finance/FinanceFormElements';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { DocumentUploadControl } from '../../components/common/DocumentUploadControl';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { useFinanceOptions } from '../../components/finance/useFinanceOptions';
import { calculateFinanceTotals, clampDiscountValue } from '../../utils/financeTotals';
import {
  consumeFinancePdfScanDraft,
  linesFromPdfExtract,
  normalizeTaxCalculationValue,
} from '../../utils/financePdfScanDraft';
import { normalizeCurrencyCode, useDefaultCurrency } from '../../hooks/useDefaultCurrency';

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
  items: Array<{ name?: string; description?: string; qty?: number; rate?: number; tax?: number; unitPrice?: number; taxRate?: number }>
): EditableLine[] {
  if (!items.length) return [newEditableLine()];
  return items.map((item) => ({
    ...newEditableLine(),
    name: item.name || '',
    description: item.description || '',
    qty: Number(item.qty) || 1,
    rate: Number(item.rate ?? item.unitPrice) || 0,
    tax: Number(item.tax ?? item.taxRate) || 18,
  }));
}

export function isQuotationConverted(quote?: { status?: string } | null): boolean {
  return String(quote?.status || '').trim().toLowerCase() === 'converted';
}

export function isSalesOrderDispatched(order?: {
  status?: string;
  deliveryStatus?: string;
  dispatchedAt?: string | null;
  shipments?: Array<{ deliveryStatus?: string }>;
} | null): boolean {
  if (!order) return false;
  const status = String(order.status || '').trim().toLowerCase();
  const deliveryStatus = String(order.deliveryStatus || '').trim().toLowerCase();
  if (status === 'dispatched' || deliveryStatus === 'dispatched') return true;
  if (deliveryStatus === 'in-transit' || deliveryStatus === 'delivered' || status === 'shipped') return true;
  if (Boolean(order.dispatchedAt)) return true;
  if (
    Array.isArray(order.shipments) &&
    order.shipments.some((s) => {
      const sStat = String(s.deliveryStatus || '').trim().toLowerCase();
      return sStat === 'dispatched' || sStat === 'in-transit' || sStat === 'delivered';
    })
  ) {
    return true;
  }
  return false;
}

export const InvoiceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromScan = searchParams.get('fromScan') === '1';
  const { clients, projects } = useFinanceOptions();
  const { alert, prompt } = useDialog();
  const settingsCurrency = useDefaultCurrency();
  const currencyLockedRef = useRef(false);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [issueDate, setIssueDate] = useState(localToday());
  const [dueDate, setDueDate] = useState(addDays(localToday(), 30));
  const [currency, setCurrency] = useState(settingsCurrency);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation>('after_discount');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [quotationId, setQuotationId] = useState('');
  const [salesOrderId, setSalesOrderId] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([newEditableLine()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTiming, setReminderTiming] = useState<'before_due_date' | 'after_due_date'>(
    'after_due_date'
  );
  const [reminderCount, setReminderCount] = useState(1);
  const [reminderDays, setReminderDays] = useState(3);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderItem[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplateItem[]>([]);
  const [templateId, setTemplateId] = useState('');
  /** Loaded only to help match PDF-scan line items — not shown as a picker. */
  const [catalog, setCatalog] = useState<
    Array<{ _id: string; name: string; description?: string; unitPrice: number; taxRate: number }>
  >([]);
  // Recurring invoice settings
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [recurringEvery, setRecurringEvery] = useState(1);
  const [recurringCycles, setRecurringCycles] = useState(0); // 0 = infinite
  const [recurringNextDate, setRecurringNextDate] = useState(addDays(localToday(), 30));
  const scanAppliedRef = useRef(false);
  const skipClientAddressFillRef = useRef(false);
  const scanClientNameRef = useRef('');
  const [catalogReady, setCatalogReady] = useState(false);

  const convertedQuotations = useMemo(() => {
    return quotations.filter(isQuotationConverted);
  }, [quotations]);

  const dispatchedSalesOrders = useMemo(() => {
    return salesOrders.filter(isSalesOrderDispatched);
  }, [salesOrders]);

  useEffect(() => {
    if (!fromScan) {
      crmApi.getNextInvoiceNumber().then((result) => setInvoiceNo(result.data.invoiceNo)).catch(() => setInvoiceNo(''));
    }
    crmApi.listQuotations({ limit: 200, status: 'Converted' }).then((r) => setQuotations(r.data || [])).catch(() => setQuotations([]));
    crmApi.listSalesOrders({ limit: 200 }).then((r) => setSalesOrders(r.data || [])).catch(() => setSalesOrders([]));
    crmApi.listInvoiceTemplates().then((r) => setTemplates(r.data || [])).catch(() => setTemplates([]));
    crmApi
      .listCatalogProducts()
      .then((r) => setCatalog(r.data || []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogReady(true));
  }, [fromScan]);

  useEffect(() => {
    if (currencyLockedRef.current) return;
    setCurrency(settingsCurrency);
  }, [settingsCurrency]);

  useEffect(() => {
    if (!fromScan || !catalogReady || scanAppliedRef.current) return;
    const extracted = consumeFinancePdfScanDraft('invoice');
    if (!extracted) {
      setScanNotice('No scanned PDF data found. You can fill the form manually.');
      scanAppliedRef.current = true;
      crmApi.getNextInvoiceNumber().then((result) => setInvoiceNo(result.data.invoiceNo)).catch(() => setInvoiceNo(''));
      return;
    }
    scanAppliedRef.current = true;
    skipClientAddressFillRef.current = Boolean(
      extracted.billingAddress?.trim() || extracted.shippingAddress?.trim()
    );
    scanClientNameRef.current = (extracted.clientName || '').trim();

    if (extracted.documentNumber?.trim()) setInvoiceNo(extracted.documentNumber.trim());
    else {
      crmApi.getNextInvoiceNumber().then((result) => setInvoiceNo(result.data.invoiceNo)).catch(() => setInvoiceNo(''));
    }
    if (extracted.issueDate) setIssueDate(extracted.issueDate);
    if (extracted.dueDate) setDueDate(extracted.dueDate);
    currencyLockedRef.current = true;
    setCurrency(normalizeCurrencyCode(extracted.currency, settingsCurrency));
    setExchangeRate(Number(extracted.exchangeRate) > 0 ? Number(extracted.exchangeRate) : 1);
    setTaxCalculation(normalizeTaxCalculationValue(extracted.taxCalculation));
    if (extracted.paymentDetails?.trim()) setPaymentDetails(extracted.paymentDetails.trim());
    if (extracted.billingAddress?.trim()) setBillingAddress(extracted.billingAddress.trim());
    if (extracted.shippingAddress?.trim()) setShippingAddress(extracted.shippingAddress.trim());
    if (extracted.notes?.trim()) setNotes(extracted.notes.trim());
    setLines(linesFromPdfExtract(extracted, catalog));

    setScanNotice(
      `Filled from scanned PDF${extracted.documentNumber ? ` (#${extracted.documentNumber})` : ''}. Review required fields before saving.`
    );
  }, [fromScan, catalogReady, catalog, settingsCurrency]);

  useEffect(() => {
    if (!fromScan || !scanClientNameRef.current || clientId || !clients.length) return;
    const needle = scanClientNameRef.current.toLowerCase();
    const matched = clients.find((c) => {
      const name = String((c as { name?: string }).name || '').trim().toLowerCase();
      const company = String((c as { company?: string }).company || '').trim().toLowerCase();
      return (
        name === needle ||
        company === needle ||
        (name && (name.includes(needle) || needle.includes(name))) ||
        (company && (company.includes(needle) || needle.includes(company)))
      );
    });
    if (matched) setClientId(matched._id);
  }, [fromScan, clients, clientId]);

  useEffect(() => {
    if (skipClientAddressFillRef.current) return;
    const client = clients.find((item) => item._id === clientId);
    if (!client) return;
    const billing =
      (client as { billingAddress?: string; address?: string }).billingAddress ||
      (client as { address?: string }).address ||
      '';
    const shipping =
      (client as { shippingAddress?: string }).shippingAddress || billing;
    if (billing && !billingAddress) setBillingAddress(billing);
    if (shipping && !shippingAddress) setShippingAddress(shipping);
  }, [clientId, clients, billingAddress, shippingAddress]);

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

  const importQuotation = async (id: string) => {
    setQuotationId(id);
    if (!id) return;
    try {
      const quote = (await crmApi.getQuotation(id)).data;
      if (!isQuotationConverted(quote)) {
        setError(`Cannot import quotation: only quotations with 'Converted' status can be imported into an invoice.`);
        setQuotationId('');
        return;
      }
      if (quote.clientId) setClientId(quote.clientId);
      currencyLockedRef.current = true;
      setCurrency(normalizeCurrencyCode(quote.currency, settingsCurrency));
      setTaxCalculation(quote.taxCalculation || 'after_discount');
      setDiscountType(quote.discountType || 'percent');
      setDiscountValue(Number(quote.discountValue ?? quote.discountPercent ?? quote.discountAmount) || 0);
      setShippingCharge(Number(quote.shippingCharge) || 0);
      setNotes(quote.recipientNotes || quote.description || '');
      setLines(linesFromSource(quote.lineItems || []));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to import quotation');
    }
  };

  const importSalesOrder = async (id: string) => {
    setSalesOrderId(id);
    if (!id) return;
    try {
      const order = (await crmApi.getSalesOrder(id)).data;
      if (!isSalesOrderDispatched(order)) {
        setError(`Cannot import sales order: only sales orders with status 'Dispatched' can be imported into an invoice.`);
        setSalesOrderId('');
        return;
      }
      if (order.clientId) setClientId(order.clientId);
      if (order.projectId) setProjectId(order.projectId);
      currencyLockedRef.current = true;
      setCurrency(normalizeCurrencyCode((order as { currency?: string }).currency, settingsCurrency));
      setShippingCharge(Number(order.shippingCharge) || 0);
      setDiscountType('amount');
      setDiscountValue(Number(order.discount || order.discountTotal) || 0);
      setLines(
        linesFromSource(
          (order.lineItems || []).map((line) => ({
            name: line.description,
            description: line.sku || '',
            qty: line.qty,
            rate: line.rate,
            tax: line.tax ?? 18,
          }))
        )
      );
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to import sales order');
    }
  };

  const importExpenses = async () => {
    if (!clientId && !projectId) {
      setError('Select a client or project before importing billable expenses.');
      return;
    }
    try {
      const response = await crmApi.listUnbilledBillableExpenses({
        clientId: clientId || undefined,
        projectId: projectId || undefined,
      });
      const expenses = response.data || [];
      if (!expenses.length) {
        setError('No unbilled billable expenses found for this client/project.');
        return;
      }
      setLines((current) => [
        ...current.filter((line) => line.name.trim()),
        ...expenses.map((expense) => ({
          ...newEditableLine(),
          name: expense.itemName || expense.category || 'Billable expense',
          description: expense.description || `${expense.category || 'Expense'} · ${expense.purchaseDate || ''}`.trim(),
          qty: 1,
          rate: Number(expense.price) || 0,
          tax: 18,
        })),
      ]);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to import expenses');
    }
  };

  const loadTemplate = async (id: string) => {
    setTemplateId(id);
    if (!id) return;
    try {
      const template = (await crmApi.getInvoiceTemplate(id)).data;
      currencyLockedRef.current = true;
      setCurrency(normalizeCurrencyCode(template.currency, settingsCurrency));
      setTaxCalculation(template.taxCalculation || 'after_discount');
      setDueDate(addDays(issueDate, Number(template.paymentTermsDays) || 30));
      setShippingCharge(Number(template.shippingCharge) || 0);
      setDiscountType(template.discountType || 'percent');
      setDiscountValue(Number(template.discountValue) || 0);
      setNotes(template.recipientNotes || '');
      setTerms(template.terms || '');
      setPaymentDetails(template.paymentDetails || '');
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
      await crmApi.createInvoiceTemplate({
        name: name.trim(),
        category: 'General',
        currency,
        paymentTermsDays: 30,
        taxCalculation,
        shippingCharge,
        recipientNotes: notes,
        terms,
        paymentDetails,
        isDefault: false,
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
          })),
      });
      const refreshed = await crmApi.listInvoiceTemplates();
      setTemplates(refreshed.data || []);
      await alert('Template saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save template');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const validLines = lines.filter((line) => line.name.trim() && line.qty > 0 && line.rate >= 0);
    if (
      !invoiceNo.trim() ||
      !issueDate ||
      !dueDate ||
      !currency.trim() ||
      exchangeRate <= 0 ||
      !clientId ||
      validLines.length === 0
    ) {
      setError('Complete all required fields and provide at least one valid line item.');
      return;
    }
    if (dueDate < issueDate) {
      setError('Due date cannot be before the issue date.');
      return;
    }
    setSaving(true);
    try {
      const linePayload = validLines.map((line) => ({
        name: line.name.trim(),
        description: line.description.trim(),
        qty: line.qty,
        rate: line.rate,
        tax: line.tax,
      }));

      if (isRecurring) {
        const profile = await crmApi.createRecurringInvoice({
          profileName: `${invoiceNo.trim() || 'Invoice'} Recurring`,
          clientId,
          projectId: projectId || undefined,
          frequency: recurringFrequency,
          customIntervalDays:
            recurringEvery > 1
              ? recurringFrequency === 'weekly'
                ? recurringEvery * 7
                : recurringFrequency === 'monthly'
                  ? recurringEvery * 30
                  : recurringFrequency === 'quarterly'
                    ? recurringEvery * 90
                    : recurringEvery * 365
              : undefined,
          startDate: issueDate,
          nextRunDate: recurringNextDate || issueDate,
          endCondition: recurringCycles > 0 ? 'after_cycles' : 'never',
          totalCycles: recurringCycles > 0 ? recurringCycles : null,
          currency: currency.toUpperCase(),
          lineItems: linePayload,
          discountType,
          discountValue: clampDiscountValue(discountType, discountValue),
          taxCalculation,
          paymentTermsDays: Math.max(
            0,
            Math.round(
              (new Date(`${dueDate}T12:00:00`).getTime() - new Date(`${issueDate}T12:00:00`).getTime()) /
                (1000 * 60 * 60 * 24)
            ) || 30
          ),
          notes: notes.trim(),
          terms: terms.trim(),
          autoSendEmail: false,
        });
        const run = await crmApi.runRecurringInvoiceNow(profile.data._id);
        const invoiceId = (run.data as { invoice?: { _id?: string } })?.invoice?._id;
        if (invoiceId) {
          navigate(`/invoices/${invoiceId}`);
        } else {
          navigate('/invoices?tab=recurring');
        }
        return;
      }

      const created = await crmApi.createInvoice({
        invoiceNo: invoiceNo.trim(),
        issueDate,
        dueDate,
        currency: currency.toUpperCase(),
        exchangeRate,
        taxCalculation,
        clientId,
        projectId: projectId || undefined,
        quotationId: quotationId || undefined,
        salesOrderId: salesOrderId || undefined,
        paymentDetails: paymentDetails.trim(),
        billingAddress: billingAddress.trim(),
        shippingAddress: shippingAddress.trim(),
        lineItems: linePayload,
        notes: notes.trim(),
        terms: terms.trim(),
        reminder: {
          enabled: reminderEnabled,
          timing: reminderTiming,
          count: reminderCount,
          days: reminderDays,
        },
        discountType,
        discountValue: clampDiscountValue(discountType, discountValue),
        shippingCharge,
        attachmentUrl: attachmentUrl.trim() || undefined,
      });
      navigate(`/invoices/${created.data._id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
      setSaving(false);
    }
  };

  return (
    <div data-tour="invoices-create-form" className="flex w-full flex-col gap-5 pb-14">
      <CreatePageHeader
        title="Create Invoice"
        backLabel="Invoices"
        backPath="/invoices"
        saving={saving}
        formId="invoice-form"
      />

      {scanNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {scanNotice}
        </div>
      ) : null}

      <div
        data-tour="invoices-create-import"
        className="bg-white border border-zinc-300 rounded-xl p-4 flex flex-col lg:flex-row gap-3 flex-wrap"
      >        <select
          className={`${financeFieldClass} lg:max-w-xs`}
          value={quotationId}
          onChange={(event) => importQuotation(event.target.value)}
        >
          <option value="">Import from Quotation (Converted only)…</option>
          {convertedQuotations.length === 0 ? (
            <option disabled value="">No converted quotations available</option>
          ) : (
            convertedQuotations.map((item) => (
              <option key={item._id} value={item._id}>
                {displayLabel(item.quotationNo, item.quotationNumber, item.number)} ·{' '}
                {displayLabel(item.recipientName, item.clientName, item.customerName, item.customerLabel)}
              </option>
            ))
          )}
        </select>
        <select
          className={`${financeFieldClass} lg:max-w-xs`}
          value={salesOrderId}
          onChange={(event) => importSalesOrder(event.target.value)}
        >
          <option value="">Import from Sales Order (Dispatched only)…</option>
          {dispatchedSalesOrders.length === 0 ? (
            <option disabled value="">No dispatched sales orders available</option>
          ) : (
            dispatchedSalesOrders.map((item) => (
              <option key={item._id} value={item._id}>
                {item.orderNumber} · {displayLabel(item.clientName)}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          onClick={importExpenses}
          className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
        >
          Import Billable Expenses
        </button>
        <select
          className={`${financeFieldClass} lg:max-w-xs`}
          value={templateId}
          onChange={(event) => loadTemplate(event.target.value)}
        >
          <option value="">Load Template…</option>
          {templates.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
              {item.isDefault ? ' (Default)' : ''}
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

      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      <form id="invoice-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div data-tour="invoices-create-client">
        <FormSection title="Invoice & client details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Invoice number" required>
              <input className={financeFieldClass} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </FormField>
            <FormField label="Issue date" required>
              <input
                className={financeFieldClass}
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  if (dueDate < e.target.value) setDueDate(addDays(e.target.value, 30));
                }}
              />
            </FormField>
            <FormField label="Due date" required>
              <input className={financeFieldClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
                {Array.from(new Set([...INVOICE_CURRENCIES, currency, settingsCurrency])).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Exchange rate" required>
              <input
                className={financeFieldClass}
                type="number"
                min="0.0001"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
              />
            </FormField>
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
            <FormField label="Client" required>
              <ClientSelect
                clients={clients}
                value={clientId}
                required
                placeholder="Select client…"
                onChange={(nextId) => setClientId(nextId)}
              />
            </FormField>
            <FormField label="Project">
              <select className={financeFieldClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projects
                  .filter((project) => !clientId || project.clientId === clientId)
                  .map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="Payment details" wide>
              <textarea
                className={financeTextAreaClass}
                rows={2}
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder="NEFT / UPI / bank instructions"
              />
            </FormField>
            <FormField label="Billing address">
              <textarea
                className={financeTextAreaClass}
                rows={3}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
              />
            </FormField>
            <FormField label="Shipping address">
              <div className="flex flex-col gap-2">
                <textarea
                  className={financeTextAreaClass}
                  rows={3}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShippingAddress(billingAddress)}
                  className="self-start h-8 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer"
                >
                  Copy billing address
                </button>
              </div>
            </FormField>
          </div>
        </FormSection>
        </div>

        <div data-tour="invoices-create-lines" className="bg-white border border-zinc-300 rounded-xl p-4">
          <LineItemsEditor lines={lines} setLines={setLines} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div data-tour="invoices-create-recurring">
          <FormSection title="Recurring Invoice">
            <div className="grid grid-cols-1 gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                Create as recurring schedule (generates first invoice now)
              </label>
              {isRecurring && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-1">
                  <FormField label="Frequency">
                    <select
                      className={financeFieldClass}
                      value={recurringFrequency}
                      onChange={(e) => setRecurringFrequency(e.target.value as typeof recurringFrequency)}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </FormField>
                  <FormField label="Every (n intervals)">
                    <input
                      className={financeFieldClass}
                      type="number"
                      min={1}
                      value={recurringEvery}
                      onChange={(e) => setRecurringEvery(Math.max(1, Number(e.target.value)))}
                    />
                  </FormField>
                  <FormField label="Total cycles (0 = infinite)">
                    <input
                      className={financeFieldClass}
                      type="number"
                      min={0}
                      value={recurringCycles}
                      onChange={(e) => setRecurringCycles(Math.max(0, Number(e.target.value)))}
                    />
                  </FormField>
                  <FormField label="Next / first issue date">
                    <input
                      className={financeFieldClass}
                      type="date"
                      value={recurringNextDate}
                      onChange={(e) => setRecurringNextDate(e.target.value)}
                    />
                  </FormField>
                  <p className="sm:col-span-2 lg:col-span-4 m-0 text-xs text-zinc-500">
                    This creates a recurring profile (same as old CRM) and runs it once to issue the first invoice.
                    Manage pause/run/logs from Invoices → Recurring Profiles.
                  </p>
                </div>
              )}
            </div>
          </FormSection>
          </div>

          <div data-tour="invoices-create-notes">
          <FormSection title="Notes, terms & reminders">
            <div className="grid grid-cols-1 gap-4">
              <FormField label="Client notes">
                <textarea className={financeTextAreaClass} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormField>
              <FormField label="Terms & conditions">
                <textarea className={financeTextAreaClass} rows={3} maxLength={3000} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </FormField>
              <FormField label="Upload attachment">
                <DocumentUploadControl
                  folder="invoices"
                  mode="button"
                  buttonLabel="Choose file"
                  uploadButtonLabel="Upload document"
                  currentUrl={attachmentUrl || null}
                  onUploaded={(res) => setAttachmentUrl(res.url || res.fileUrl || '')}
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                />
                Send email reminders
              </label>
              {reminderEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField label="Timing">
                    <select
                      className={financeFieldClass}
                      value={reminderTiming}
                      onChange={(e) => setReminderTiming(e.target.value as typeof reminderTiming)}
                    >
                      <option value="after_due_date">After due date</option>
                      <option value="before_due_date">Before due date</option>
                    </select>
                  </FormField>
                  <FormField label="Count">
                    <input
                      className={financeFieldClass}
                      type="number"
                      min={1}
                      max={10}
                      value={reminderCount}
                      onChange={(e) => setReminderCount(Number(e.target.value))}
                    />
                  </FormField>
                  <FormField label="Interval days">
                    <input
                      className={financeFieldClass}
                      type="number"
                      min={1}
                      value={reminderDays}
                      onChange={(e) => setReminderDays(Number(e.target.value))}
                    />
                  </FormField>
                </div>
              )}
            </div>
          </FormSection>
          </div>

          <div data-tour="invoices-create-totals">
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
              <div className="flex justify-between"><span>Subtotal</span><strong>{formatFinanceMoney(totals.subtotal, currency)}</strong></div>
              <div className="flex justify-between"><span>Discount</span><strong>-{formatFinanceMoney(totals.discount, currency)}</strong></div>
              <div className="flex justify-between"><span>Tax total</span><strong>{formatFinanceMoney(totals.taxTotal, currency)}</strong></div>
              <div className="flex justify-between"><span>Shipping</span><strong>{formatFinanceMoney(totals.shippingCharge, currency)}</strong></div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
                <span>Grand total</span>
                <strong>{formatFinanceMoney(totals.grandTotal, currency)}</strong>
              </div>
            </div>
          </FormSection>
          </div>
        </div>
      </form>
    </div>
  );
};
