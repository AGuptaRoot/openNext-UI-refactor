import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { crmApi } from '../../services/api';
import {
  DEFAULT_SALES_ORDER_SOURCES,
  DEFAULT_STATE_SHIPPING_RATES,
  FREE_SHIPPING_THRESHOLD_DEFAULT,
  gstTaxModeLabel,
  resolveShippingCharge,
  type SalesOrderStatus,
} from '../../types/salesOrders';
import type { ClientAddress, ClientItem } from '../../types/clients';
import type { CrmSettings } from '../../types/admin';
import {
  CreatePageHeader,
  FormField,
  FormSection,
  INDIAN_STATES,
  LineItemsEditor,
  financeFieldClass,
  financeTextAreaClass,
  newEditableLine,
  type EditableLine,
} from '../../components/finance/FinanceFormElements';
import { useFinanceOptions } from '../../components/finance/useFinanceOptions';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { calculateFinanceTotals, clampDiscountValue } from '../../utils/financeTotals';

const CREATE_STATUSES: SalesOrderStatus[] = ['Approved', 'Draft', 'Processing', 'Cancelled'];

function formatAddress(addr?: ClientAddress | string | null): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(', ');
}

export const SalesOrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { clients, projects } = useFinanceOptions();

  const [orderNumber, setOrderNumber] = useState(`SO-${new Date().getFullYear()}-`);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [generatedBy, setGeneratedBy] = useState<string>(DEFAULT_SALES_ORDER_SOURCES[0]);
  const [status, setStatus] = useState<SalesOrderStatus>('Approved');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryTargetDate, setDeliveryTargetDate] = useState('');
  const [shippingState, setShippingState] = useState('Maharashtra');
  const [companyState, setCompanyState] = useState('Maharashtra');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([newEditableLine()]);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [shippingCharge, setShippingCharge] = useState(100);
  const [shippingOverridden, setShippingOverridden] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sources, setSources] = useState<string[]>([...DEFAULT_SALES_ORDER_SOURCES]);
  const [stateRates, setStateRates] = useState<Record<string, number>>({ ...DEFAULT_STATE_SHIPPING_RATES });
  const [freeThreshold, setFreeThreshold] = useState(FREE_SHIPPING_THRESHOLD_DEFAULT);
  const [settingsSnapshot, setSettingsSnapshot] = useState<CrmSettings | null>(null);

  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [newStateRate, setNewStateRate] = useState(200);
  const [modalSaving, setModalSaving] = useState(false);

  useEffect(() => {
    crmApi
      .getSettings()
      .then((r) => {
        const s = r.data;
        if (!s) return;
        setSettingsSnapshot(s);
        if (s.company_state) {
          setCompanyState(s.company_state);
          setShippingState((curr) => (curr === 'Maharashtra' ? s.company_state : curr));
        }
        if (s.free_shipping_threshold != null) setFreeThreshold(Number(s.free_shipping_threshold));
        if (s.state_shipping_rates && Object.keys(s.state_shipping_rates).length > 0) {
          setStateRates({ ...DEFAULT_STATE_SHIPPING_RATES, ...s.state_shipping_rates });
        }
        if (s.sales_order_generated_by_sources?.length) {
          setSources(s.sales_order_generated_by_sources);
          setGeneratedBy(s.sales_order_generated_by_sources[0]);
        }
      })
      .catch(() => undefined);
  }, []);

  const statesList = useMemo(() => {
    const fromRates = Object.keys(stateRates);
    return Array.from(new Set([...fromRates, ...INDIAN_STATES])).sort((a, b) => a.localeCompare(b));
  }, [stateRates]);

  const totals = useMemo(
    () =>
      calculateFinanceTotals({
        lines: lines.map((line) => ({ qty: line.qty, rate: line.rate, tax: line.tax })),
        discountType,
        discountValue,
        shippingCharge,
      }),
    [lines, discountType, discountValue, shippingCharge]
  );

  useEffect(() => {
    if (shippingOverridden) return;
    setShippingCharge(
      resolveShippingCharge(shippingState, totals.subtotal, stateRates, freeThreshold, null)
    );
  }, [shippingState, totals.subtotal, stateRates, freeThreshold, shippingOverridden]);

  const taxMode = gstTaxModeLabel(shippingState, companyState);
  const freeShippingApplied = !shippingOverridden && totals.subtotal >= freeThreshold && totals.subtotal > 0;

  const persistSettings = async (patch: Partial<CrmSettings>) => {
    const base =
      settingsSnapshot ||
      (await crmApi.getSettings().catch(() => ({ data: null }))).data ||
      ({} as CrmSettings);
    const next = { ...base, ...patch } as CrmSettings;
    const response = await crmApi.updateSettings(next);
    setSettingsSnapshot(response.data || next);
    return response.data || next;
  };

  const onSelectClient = async (id: string) => {
    setClientId(id);
    setProjectId('');
    if (!id) {
      setBillingAddress('');
      setShippingAddress('');
      return;
    }
    try {
      const response = await crmApi.getClient(id);
      const client: ClientItem = response.data;
      const billing = formatAddress(client.billingAddress) || formatAddress(client.addresses?.[0]);
      const shipping =
        formatAddress(client.shippingAddress) ||
        formatAddress(client.addresses?.find((a) => a.type === 'shipping')) ||
        billing;
      setBillingAddress(billing);
      setShippingAddress(shipping);
      const clientState =
        client.state || client.billingAddress?.state || client.shippingAddress?.state || '';
      if (clientState) {
        const match = statesList.find((s) => s.toLowerCase() === clientState.trim().toLowerCase());
        if (match) {
          setShippingState(match);
          setShippingOverridden(false);
        }
      }
    } catch {
      // ClientOption list may not expose addresses; leave blank
    }
  };

  const saveNewSource = async () => {
    const name = newSourceName.trim();
    if (!name) {
      setError('Source name is required.');
      return;
    }
    setModalSaving(true);
    try {
      const nextSources = Array.from(new Set([...sources, name]));
      await persistSettings({ sales_order_generated_by_sources: nextSources });
      setSources(nextSources);
      setGeneratedBy(name);
      setSourceModalOpen(false);
      setNewSourceName('');
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save source');
    } finally {
      setModalSaving(false);
    }
  };

  const saveNewState = async () => {
    const name = newStateName.trim();
    const rate = Number(newStateRate);
    if (!name) {
      setError('State / region name is required.');
      return;
    }
    if (!(rate >= 0)) {
      setError('Default shipping fee must be zero or positive.');
      return;
    }
    setModalSaving(true);
    try {
      const nextRates = { ...stateRates, [name]: rate };
      await persistSettings({ state_shipping_rates: nextRates });
      setStateRates(nextRates);
      setShippingState(name);
      setShippingOverridden(false);
      setStateModalOpen(false);
      setNewStateName('');
      setNewStateRate(200);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save state rate');
    } finally {
      setModalSaving(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const validLines = lines.filter((line) => line.description.trim() && line.qty > 0 && line.rate >= 0);
    if (
      !orderNumber.trim() ||
      !clientId ||
      !generatedBy.trim() ||
      !status ||
      !shippingState.trim() ||
      validLines.length === 0 ||
      validLines.length !== lines.filter((l) => l.description.trim() || l.qty > 0 || l.rate > 0).length
    ) {
      setError('Complete all required fields and provide valid values for every line item.');
      return;
    }
    if (deliveryTargetDate && issueDate && deliveryTargetDate < issueDate) {
      setError('Delivery target date cannot be before the issue date.');
      return;
    }
    setSaving(true);
    try {
      const response = await crmApi.createSalesOrder({
        orderNumber: orderNumber.trim(),
        clientId,
        projectId: projectId || undefined,
        generatedBy: generatedBy.trim(),
        status,
        issueDate,
        deliveryTargetDate: deliveryTargetDate || undefined,
        shippingState: shippingState.trim(),
        billingAddress: billingAddress.trim(),
        shippingAddress: shippingAddress.trim(),
        currency: settingsSnapshot?.default_currency || undefined,
        lineItems: validLines.map((line) => ({
          description: line.description.trim(),
          sku: line.sku?.trim() || undefined,
          qty: line.qty,
          rate: line.rate,
          tax: line.tax,
        })),
        discountType,
        discountValue: clampDiscountValue(discountType, discountValue),
        shippingCharge,
        notes: notes.trim(),
      });
      const id = response.data?._id;
      navigate(id ? `/sales-orders/${id}` : '/sales-orders');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create sales order');
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSourceModalOpen(false);
        setStateModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div data-tour="sales-orders-create-form" className="flex w-full flex-col gap-5 pb-14">
      <CreatePageHeader
        title="New Sales Order"
        backLabel="Sales Orders"
        backPath="/sales-orders"
        saving={saving}
        formId="sales-order-form"
      />
      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}
      <form id="sales-order-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div data-tour="sales-orders-create-order-client">
        <FormSection title="Order & client details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Order number" required>
              <input
                className={financeFieldClass}
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
              />
            </FormField>
            <FormField label="Client account" required>
              <ClientSelect
                clients={clients}
                value={clientId}
                required
                placeholder="Select client…"
                onChange={(nextId) => onSelectClient(nextId)}
              />
            </FormField>
            <FormField label="Project">
              <select
                className={financeFieldClass}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
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
            <FormField label="Generated by" required>
              <div className="flex gap-2">
                <select
                  className={financeFieldClass}
                  value={generatedBy}
                  onChange={(event) => setGeneratedBy(event.target.value)}
                >
                  {sources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setNewSourceName('');
                    setSourceModalOpen(true);
                  }}
                  className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white whitespace-nowrap cursor-pointer hover:bg-zinc-50"
                >
                  + New Source
                </button>
              </div>
            </FormField>
            <FormField label="Status" required>
              <select
                className={financeFieldClass}
                value={status}
                onChange={(event) => setStatus(event.target.value as SalesOrderStatus)}
              >
                {CREATE_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Order issue date">
              <input
                className={financeFieldClass}
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </FormField>
            <FormField label="Target delivery date">
              <input
                className={financeFieldClass}
                type="date"
                value={deliveryTargetDate}
                onChange={(event) => setDeliveryTargetDate(event.target.value)}
              />
            </FormField>
            <FormField label="Destination state" required>
              <div className="flex gap-2">
                <select
                  className={financeFieldClass}
                  value={shippingState}
                  onChange={(event) => {
                    setShippingState(event.target.value);
                    setShippingOverridden(false);
                  }}
                >
                  {statesList.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setNewStateName('');
                    setNewStateRate(200);
                    setStateModalOpen(true);
                  }}
                  className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white whitespace-nowrap cursor-pointer hover:bg-zinc-50"
                >
                  + Add State
                </button>
              </div>
            </FormField>
            <FormField label="Tax mode">
              <div className="h-9 px-3 flex items-center text-sm border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-700">
                {taxMode}
              </div>
            </FormField>
          </div>
        </FormSection>
        </div>

        <div data-tour="sales-orders-create-addresses">
        <FormSection title="Address details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Billing address">
              <textarea
                className={financeTextAreaClass}
                rows={3}
                maxLength={1000}
                value={billingAddress}
                onChange={(event) => setBillingAddress(event.target.value)}
              />
            </FormField>
            <FormField label="Shipping address">
              <textarea
                className={financeTextAreaClass}
                rows={3}
                maxLength={1000}
                value={shippingAddress}
                onChange={(event) => setShippingAddress(event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>
        </div>

        <div data-tour="sales-orders-create-lines">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setLines((current) => [...current, newEditableLine()])}
              className="inline-flex items-center gap-1 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
            >
              <AddIcon sx={{ fontSize: 14 }} /> Add item
            </button>
          </div>
          <LineItemsEditor lines={lines} setLines={setLines} orderMode />
        </div>

        <div data-tour="sales-orders-create-totals">
        <FormSection title="Financial summary">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Discount type">
              <select
                className={financeFieldClass}
                value={discountType}
                onChange={(event) => {
                  const next = event.target.value as 'percent' | 'amount';
                  setDiscountType(next);
                  if (next === 'percent') {
                    setDiscountValue((prev) => Math.min(100, Math.max(0, Number(prev) || 0)));
                  }
                }}
              >
                <option value="percent">Percent %</option>
                <option value="amount">Amount ₹</option>
              </select>
            </FormField>
            <FormField label="Discount value">
              <input
                className={financeFieldClass}
                type="number"
                min="0"
                max={discountType === 'percent' ? 100 : undefined}
                step="0.01"
                value={discountValue}
                onChange={(event) => {
                  const next = Number(event.target.value);
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
                min="0"
                step="0.01"
                value={shippingCharge}
                onChange={(event) => {
                  setShippingOverridden(true);
                  setShippingCharge(Number(event.target.value));
                }}
              />
              {freeShippingApplied && (
                <span className="text-[11px] text-emerald-700 mt-1">
                  Free shipping applied (subtotal ≥ {formatFinanceMoney(freeThreshold)})
                </span>
              )}
              {shippingOverridden && (
                <button
                  type="button"
                  className="text-[11px] text-zinc-600 underline mt-1 bg-transparent border-0 cursor-pointer p-0"
                  onClick={() => setShippingOverridden(false)}
                >
                  Reset to auto shipping
                </button>
              )}
            </FormField>
          </div>
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Subtotal</div>
              <div className="font-semibold text-zinc-950">{formatFinanceMoney(totals.subtotal)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Discount</div>
              <div className="font-semibold text-zinc-950">− {formatFinanceMoney(totals.discount)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Tax</div>
              <div className="font-semibold text-zinc-950">{formatFinanceMoney(totals.taxTotal)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Shipping</div>
              <div className="font-semibold text-zinc-950">{formatFinanceMoney(totals.shippingCharge)}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Grand total</div>
              <div className="text-lg font-bold text-zinc-950">{formatFinanceMoney(totals.grandTotal)}</div>
            </div>
          </div>
        </FormSection>
        </div>

        <div data-tour="sales-orders-create-actions">
        <FormSection title="Order notes & terms">
          <FormField label="Notes" wide>
            <textarea
              className={financeTextAreaClass}
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
          <div className="mt-4 flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => navigate('/sales-orders')}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Sales Order'}
            </button>
          </div>
        </FormSection>
        </div>
      </form>

      {sourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-950 m-0">Add order origin source</h3>
              <button
                type="button"
                onClick={() => setSourceModalOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Source / channel name *</span>
              <input
                className={financeFieldClass}
                value={newSourceName}
                onChange={(event) => setNewSourceName(event.target.value)}
                placeholder="e.g. Shopify App"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSourceModalOpen(false)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSaving}
                onClick={saveNewSource}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
              >
                {modalSaving ? 'Saving…' : 'Save source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-950 m-0">Add destination state</h3>
              <button
                type="button"
                onClick={() => setStateModalOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">State / region name *</span>
                <input
                  className={financeFieldClass}
                  value={newStateName}
                  onChange={(event) => setNewStateName(event.target.value)}
                  placeholder="e.g. Sikkim"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Default shipping fee (₹) *
                </span>
                <input
                  className={financeFieldClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={newStateRate}
                  onChange={(event) => setNewStateRate(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStateModalOpen(false)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSaving}
                onClick={saveNewState}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
              >
                {modalSaving ? 'Saving…' : 'Save state'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
