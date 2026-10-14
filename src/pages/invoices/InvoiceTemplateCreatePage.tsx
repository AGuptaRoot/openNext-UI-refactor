import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmApi } from '../../services/api';
import type { TaxCalculation } from '../../types/quotations';
import { INVOICE_TEMPLATE_CATEGORIES } from '../../types/invoiceTemplates';
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
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

export const InvoiceTemplateCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const settingsCurrency = useDefaultCurrency();
  const currencyLockedRef = useRef(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(settingsCurrency);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);

  useEffect(() => {
    if (currencyLockedRef.current) return;
    setCurrency(settingsCurrency);
  }, [settingsCurrency]);
  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation>('after_discount');
  const [shippingCharge, setShippingCharge] = useState(0);
  const [shippingState, setShippingState] = useState('');
  const [tags, setTags] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [recipientNotes, setRecipientNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>([newEditableLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const validLines = useMemo(
    () => lines.filter((line) => line.name.trim() && line.qty > 0),
    [lines]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || validLines.length === 0) {
      setError('Template name and at least one line item are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await crmApi.createInvoiceTemplate({
        name: name.trim(),
        category,
        description: description.trim(),
        currency,
        paymentTermsDays,
        taxCalculation,
        shippingCharge,
        shippingState: shippingState.trim() || undefined,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        adminNotes: adminNotes.trim(),
        recipientNotes: recipientNotes.trim(),
        terms: terms.trim(),
        paymentDetails: paymentDetails.trim(),
        isDefault,
        discountType: 'percent',
        discountValue: 0,
        lineItems: validLines.map((line) => ({
          name: line.name.trim(),
          description: line.description.trim(),
          qty: line.qty,
          rate: line.rate,
          tax: line.tax,
        })),
      });
      navigate('/invoice-templates');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create template');
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5 pb-14">
      <CreatePageHeader
        title="New Template"
        backLabel="Templates"
        backPath="/invoice-templates"
        saving={saving}
        formId="invoice-template-form"
      />
      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}
      <form id="invoice-template-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <FormSection title="Template details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" required>
              <input className={financeFieldClass} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Category">
              <select className={financeFieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {INVOICE_TEMPLATE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Description" wide>
              <textarea
                className={financeTextAreaClass}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                {Array.from(new Set([...INVOICE_CURRENCIES, currency, settingsCurrency])).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Payment terms (days)" required>
              <input
                className={financeFieldClass}
                type="number"
                min={0}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
              />
            </FormField>
            <FormField label="Tax calculation" required>
              <select
                className={financeFieldClass}
                value={taxCalculation}
                onChange={(e) => setTaxCalculation(e.target.value as TaxCalculation)}
              >
                <option value="after_discount">After discount</option>
                <option value="before_discount">Before discount</option>
              </select>
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
            <FormField label="Shipping state">
              <input
                className={financeFieldClass}
                value={shippingState}
                onChange={(e) => setShippingState(e.target.value)}
                placeholder="Place of supply"
              />
            </FormField>
            <FormField label="Tags">
              <input
                className={financeFieldClass}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="retainer, monthly"
              />
            </FormField>
            <FormField label="Default template">
              <label className="h-9 flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Auto-select for new invoices
              </label>
            </FormField>
            <FormField label="Admin notes">
              <textarea
                className={financeTextAreaClass}
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </FormField>
            <FormField label="Recipient notes">
              <textarea
                className={financeTextAreaClass}
                rows={2}
                value={recipientNotes}
                onChange={(e) => setRecipientNotes(e.target.value)}
              />
            </FormField>
            <FormField label="Terms">
              <textarea
                className={financeTextAreaClass}
                rows={2}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            </FormField>
            <FormField label="Payment details">
              <textarea
                className={financeTextAreaClass}
                rows={2}
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>
        <LineItemsEditor lines={lines} setLines={setLines} />
      </form>
    </div>
  );
};
