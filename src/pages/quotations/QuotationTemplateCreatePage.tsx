import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmApi } from '../../services/api';
import {
  QUOTATION_CURRENCIES,
  type DiscountType,
  type TaxCalculation,
} from '../../types/quotations';
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

export const QuotationTemplateCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const settingsCurrency = useDefaultCurrency();
  const currencyLockedRef = useRef(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(settingsCurrency);
  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation>('after_discount');

  useEffect(() => {
    if (currencyLockedRef.current) return;
    setCurrency(settingsCurrency);
  }, [settingsCurrency]);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [recipientNotes, setRecipientNotes] = useState('');
  const [terms, setTerms] = useState('');
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
      await crmApi.createQuotationTemplate({
        name: name.trim(),
        category: category.trim() || 'General',
        description: description.trim(),
        currency,
        taxCalculation,
        shippingCharge,
        recipientNotes: recipientNotes.trim(),
        terms: terms.trim() || recipientNotes.trim(),
        discountType,
        discountValue,
        lineItems: validLines.map((line) => ({
          name: line.name.trim(),
          description: line.description.trim(),
          qty: line.qty,
          rate: line.rate,
          tax: line.tax,
          fileUrl: line.fileUrl?.trim() || undefined,
        })),
      });
      navigate('/quotation-templates');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create template');
      setSaving(false);
    }
  };

  return (
    <div data-tour="quotations-template-create" className="flex w-full flex-col gap-5 pb-14">
      <CreatePageHeader
        title="New Template"
        backLabel="Templates"
        backPath="/quotation-templates"
        saving={saving}
        formId="quotation-template-form"
      />
      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}
      <form id="quotation-template-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <FormSection title="Template details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" required>
              <input
                className={financeFieldClass}
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
            <FormField label="Category">
              <input
                className={financeFieldClass}
                maxLength={100}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Retainers, Fixed Scope…"
              />
            </FormField>
            <FormField label="Description" wide>
              <textarea
                className={financeTextAreaClass}
                rows={2}
                maxLength={1000}
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
                {Array.from(new Set([...QUOTATION_CURRENCIES, currency, settingsCurrency])).map(
                  (code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  )
                )}
              </select>
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
            <FormField label="Recipient notes / terms" wide>
              <textarea
                className={financeTextAreaClass}
                rows={3}
                maxLength={3000}
                value={recipientNotes}
                onChange={(e) => setRecipientNotes(e.target.value)}
              />
            </FormField>
            <FormField label="Commercial terms" wide>
              <textarea
                className={financeTextAreaClass}
                rows={3}
                maxLength={3000}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Optional boilerplate clauses"
              />
            </FormField>
          </div>
        </FormSection>
        <LineItemsEditor lines={lines} setLines={setLines} showFileUrl />
      </form>
    </div>
  );
};
