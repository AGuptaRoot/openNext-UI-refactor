import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { INVOICE_CURRENCIES, type InvoiceItem } from '../../types/invoices';
import type { DiscountType, TaxCalculation } from '../../types/quotations';
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
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { useFinanceOptions } from '../../components/finance/useFinanceOptions';
import { calculateFinanceTotals, clampDiscountValue } from '../../utils/financeTotals';

/** A draft invoice is still ours to correct; once it is sent, it is the client's copy. */
const EDITABLE_STATUS = 'Draft';

function toDateInput(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
    parsed.getDate()
  ).padStart(2, '0')}`;
}

function linesFromInvoice(invoice: InvoiceItem): EditableLine[] {
  const items = invoice.lineItems || [];
  if (!items.length) return [newEditableLine()];
  return items.map((item) => ({
    ...newEditableLine(),
    name: item.name || '',
    description: item.description || '',
    qty: Number(item.qty) || 1,
    rate: Number(item.rate) || 0,
    tax: Number(item.tax) || 0,
  }));
}

/**
 * Correct a draft invoice before it goes out.
 *
 * Only a Draft can be edited — the moment an invoice is sent, the client holds
 * a copy of those numbers, and changing them underneath would make the CRM
 * disagree with what they received. After that the honest routes are a credit
 * note or a cancellation, which the detail page offers. The server enforces the
 * same rule, so a stale tab cannot slip an edit through.
 */
export const InvoiceEditPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { hasPermission, isClient } = useAuth();
  const { showProjects } = useActiveExtension();
  const canWriteFinance = hasPermission('crm.finance.write') && !isClient;
  const { clients, projects } = useFinanceOptions();

  const [invoice, setInvoice] = useState<InvoiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation>('after_discount');
  const [lines, setLines] = useState<EditableLine[]>([newEditableLine()]);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [paymentDetails, setPaymentDetails] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const res = await crmApi.getInvoice(id);
        if (cancelled) return;
        const doc = res.data;
        setInvoice(doc);
        setClientId(doc.clientId || '');
        setProjectId(doc.projectId || '');
        setIssueDate(toDateInput(doc.issueDate));
        setDueDate(toDateInput(doc.dueDate));
        setCurrency(doc.currency || 'INR');
        setExchangeRate(Number(doc.exchangeRate) || 1);
        setTaxCalculation(doc.taxCalculation || 'after_discount');
        setLines(linesFromInvoice(doc));
        const percent = Number(doc.discountPercent) || 0;
        const amount = Number(doc.discountAmount) || 0;
        setDiscountType(amount > 0 && percent === 0 ? 'amount' : 'percent');
        setDiscountValue(amount > 0 && percent === 0 ? amount : percent);
        setShippingCharge(Number(doc.shippingCharge) || 0);
        setPaymentDetails(doc.paymentDetails || '');
        setBillingAddress(doc.billingAddress || '');
        setShippingAddress(doc.shippingAddress || '');
        setNotes(doc.notes || '');
        setTerms(doc.terms || '');
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Could not load this invoice');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const totals = useMemo(
    () =>
      calculateFinanceTotals({
        lines,
        discountType,
        discountValue,
        taxCalculation,
        shippingCharge,
      }),
    [lines, discountType, discountValue, taxCalculation, shippingCharge]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!clientId) return setError('Pick the client this invoice is for.');
    const items = lines
      .map((line) => ({
        name: line.name.trim(),
        description: line.description.trim(),
        qty: Number(line.qty) || 0,
        rate: Number(line.rate) || 0,
        tax: Number(line.tax) || 0,
      }))
      .filter((line) => (line.name || line.description) && line.qty > 0);

    if (!items.length) return setError('Add at least one item with a quantity.');
    if (!(totals.grandTotal > 0)) {
      return setError('An invoice cannot total ₹0. Set a price on at least one item.');
    }

    setSaving(true);
    try {
      await crmApi.updateInvoice(id, {
        clientId,
        projectId: projectId || undefined,
        issueDate,
        dueDate,
        currency,
        exchangeRate,
        taxCalculation,
        lineItems: items,
        discountType,
        discountValue: clampDiscountValue(discountType, discountValue),
        shippingCharge,
        paymentDetails,
        billingAddress,
        shippingAddress,
        notes,
        terms,
      });
      navigate(`/invoices/${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-8 text-center text-sm text-zinc-500">Loading invoice…</p>;
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-zinc-600">{error || 'Invoice not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="mt-3 h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer"
        >
          Back to invoices
        </button>
      </div>
    );
  }

  // Sent, viewed, paid or cancelled — editing is closed, so say why and where to go.
  if (!canWriteFinance || invoice.status !== EDITABLE_STATUS) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="m-0 text-lg font-bold text-zinc-950">
          {invoice.invoiceNo} cannot be edited
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {!canWriteFinance
            ? 'You do not have permission to edit invoices.'
            : `This invoice is ${invoice.status}. Only a draft can be changed — once an invoice has
               been sent the client holds those figures, so use a credit note or cancel and reissue
               instead.`}
        </p>
        <button
          type="button"
          onClick={() => navigate(`/invoices/${id}`)}
          className="mt-4 h-9 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white cursor-pointer"
        >
          Open invoice
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-12">
      <CreatePageHeader
        title={`Edit ${invoice.invoiceNo}`}
        backLabel="Back to invoice"
        backPath={returnTo || `/invoices/${id}`}
        saving={saving}
        formId="invoice-edit-form"
      />

      <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
        This invoice is still a draft, so it can be corrected freely. Once you send it, these
        figures are the client&apos;s copy and can only be changed with a credit note.
      </p>

      {error ? (
        <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <form id="invoice-edit-form" onSubmit={submit} className="flex flex-col gap-5">
        <FormSection title="Billing">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Client" required>
              <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
            </FormField>
            {showProjects && (
              <FormField label="Project">
                <select
                  className={financeFieldClass}
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label="Issue date" required>
              <input
                type="date"
                className={financeFieldClass}
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </FormField>
            <FormField label="Due date" required>
              <input
                type="date"
                className={financeFieldClass}
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </FormField>
            <FormField label="Currency">
              <select
                className={financeFieldClass}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {INVOICE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Exchange rate">
              <input
                type="number"
                min={0.0001}
                step="0.0001"
                className={financeFieldClass}
                value={exchangeRate}
                onChange={(event) => setExchangeRate(Number(event.target.value) || 1)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Items">
          <LineItemsEditor lines={lines} setLines={setLines} />

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Tax calculation">
              <select
                className={financeFieldClass}
                value={taxCalculation}
                onChange={(event) => setTaxCalculation(event.target.value as TaxCalculation)}
              >
                <option value="after_discount">Tax after discount</option>
                <option value="before_discount">Tax before discount</option>
              </select>
            </FormField>
            <FormField label="Discount">
              <div className="flex gap-2">
                <select
                  className={`${financeFieldClass} max-w-[7.5rem]`}
                  value={discountType}
                  onChange={(event) => setDiscountType(event.target.value as DiscountType)}
                >
                  <option value="percent">Percent</option>
                  <option value="amount">Amount</option>
                </select>
                <input
                  type="number"
                  min={0}
                  className={financeFieldClass}
                  value={discountValue}
                  onChange={(event) => setDiscountValue(Number(event.target.value) || 0)}
                />
              </div>
            </FormField>
            <FormField label="Shipping charge">
              <input
                type="number"
                min={0}
                className={financeFieldClass}
                value={shippingCharge}
                onChange={(event) => setShippingCharge(Number(event.target.value) || 0)}
              />
            </FormField>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-3 text-xs sm:grid-cols-4">
            {[
              { label: 'Subtotal', value: totals.subtotal },
              { label: 'Discount', value: totals.discount },
              { label: 'Tax', value: totals.taxTotal },
              { label: 'Total', value: totals.grandTotal },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {row.label}
                </dt>
                <dd
                  className={`m-0 mt-0.5 ${
                    row.label === 'Total' ? 'text-sm font-bold text-zinc-950' : 'font-semibold text-zinc-800'
                  }`}
                >
                  {formatFinanceMoney(row.value, currency)}
                </dd>
              </div>
            ))}
          </dl>
        </FormSection>

        <FormSection title="Addresses & payment">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Billing address" wide>
              <textarea
                rows={3}
                className={financeTextAreaClass}
                value={billingAddress}
                onChange={(event) => setBillingAddress(event.target.value)}
              />
            </FormField>
            <FormField label="Shipping address" wide>
              <textarea
                rows={3}
                className={financeTextAreaClass}
                value={shippingAddress}
                onChange={(event) => setShippingAddress(event.target.value)}
              />
            </FormField>
            <FormField label="Payment details" wide>
              <textarea
                rows={2}
                className={financeTextAreaClass}
                value={paymentDetails}
                onChange={(event) => setPaymentDetails(event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Notes & terms">
          <div className="grid grid-cols-1 gap-4">
            <FormField label="Notes">
              <textarea
                rows={3}
                className={financeTextAreaClass}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FormField>
            <FormField label="Terms">
              <textarea
                rows={3}
                className={financeTextAreaClass}
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => (returnTo ? navigate(returnTo) : navigate(`/invoices/${id}`))}
            className="h-9 rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-semibold cursor-pointer hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 hover:bg-zinc-800"
          >
            {saving ? 'Saving…' : 'Save invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};
