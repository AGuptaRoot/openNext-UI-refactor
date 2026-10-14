import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { crmApi } from '../../services/api';
import { ClientItem } from '../../types/clients';
import { LeadItem } from '../../types/leads';
import { OpportunityItem } from '../../types/opportunities';
import { CrmSettings } from '../../types/admin';
import { ClientSelect } from '../../components/clients/ClientSelect';
import {
  SAMPLE_PRODUCT_PRESETS,
  SAMPLE_UNITS,
  SAMPLE_URGENCIES,
  sampleUrgencyEmoji,
  sampleUrgencyTone,
  type SampleCreateInput,
  type SampleLinkType,
  type SampleProductItem,
  type SampleProductPreset,
  type SampleUrgency,
} from '../../types/samples';

const fieldClass =
  'h-10 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';

const LINK_OPTIONS: { type: SampleLinkType; label: string }[] = [
  { type: 'lead', label: 'Prospective Lead' },
  { type: 'opportunity', label: 'Opportunity Deal' },
  { type: 'client', label: 'Client Account' },
];

function resolveInitialLinkType(params: URLSearchParams): SampleLinkType {
  if (params.get('opportunityId')) return 'opportunity';
  if (params.get('clientId')) return 'client';
  return 'lead';
}

/** Stages where sample requests are no longer offered on create. */
const SAMPLE_CREATE_EXCLUDED_OPP_STAGES = new Set([
  'won',
  'commercial discussion',
  'negotiation',
  'quotation sent',
  'sample approved',
]);

function isOpportunitySelectableForSample(stage?: string | null): boolean {
  const key = String(stage || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  return !SAMPLE_CREATE_EXCLUDED_OPP_STAGES.has(key);
}

export const SampleCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<SampleProductItem[]>([
    { productName: '', quantity: 1, unit: 'pcs' },
  ]);
  const [form, setForm] = useState<SampleCreateInput>({
    linkType: resolveInitialLinkType(searchParams),
    leadId: searchParams.get('leadId') || '',
    clientId: searchParams.get('clientId') || '',
    opportunityId: searchParams.get('opportunityId') || '',
    productName: '',
    quantity: 1,
    unit: 'pcs',
    urgency: 'Normal',
    deliveryAddress: '',
    notes: '',
  });

  const availableUnits = useMemo(() => {
    const list = settings?.sample_units_of_measure;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return Array.from(SAMPLE_UNITS);
  }, [settings]);

  useEffect(() => {
    Promise.all([
      crmApi.listClients({ limit: 200 }).catch(() => ({ data: [] as ClientItem[] })),
      crmApi.getLeads({ limit: 200 }).catch(() => ({ data: [] as LeadItem[] })),
      crmApi.listOpportunities({ limit: 200 }).catch(() => ({ data: [] as OpportunityItem[] })),
      crmApi.getSettings().catch(() => ({ data: null })),
    ])
      .then(([clientResponse, leadResponse, oppResponse, settingsResponse]) => {
        setClients(clientResponse.data || []);
        setLeads(leadResponse.data || []);
        setOpportunities(oppResponse.data || []);
        if (settingsResponse?.data) {
          setSettings(settingsResponse.data);
          const firstUnit = settingsResponse.data.sample_units_of_measure?.[0];
          if (firstUnit) {
            setItems((curr) =>
              curr.map((it) => (it.unit === 'pcs' ? { ...it, unit: firstUnit } : it))
            );
            setForm((curr) => (curr.unit === 'pcs' ? { ...curr, unit: firstUnit } : curr));
          }
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Failed to load linked records')
      )
      .finally(() => setLoading(false));
  }, []);

  const sampleEligibleOpportunities = useMemo(
    () => opportunities.filter((item) => isOpportunitySelectableForSample(item.stage)),
    [opportunities]
  );

  // Drop preselected / stale opportunity if it is in an excluded late stage.
  useEffect(() => {
    if (!form.opportunityId || !opportunities.length) return;
    const selected = opportunities.find((item) => item._id === form.opportunityId);
    if (selected && !isOpportunitySelectableForSample(selected.stage)) {
      setForm((current) => ({
        ...current,
        opportunityId: '',
        leadId: current.linkType === 'opportunity' ? '' : current.leadId,
        clientId: current.linkType === 'opportunity' ? '' : current.clientId,
      }));
    }
  }, [form.opportunityId, opportunities]);

  const selectedLead = useMemo(
    () => leads.find((item) => item._id === form.leadId) || null,
    [leads, form.leadId]
  );
  const selectedClient = useMemo(
    () => clients.find((item) => item._id === form.clientId) || null,
    [clients, form.clientId]
  );
  const selectedOpportunity = useMemo(
    () =>
      sampleEligibleOpportunities.find((item) => item._id === form.opportunityId) || null,
    [sampleEligibleOpportunities, form.opportunityId]
  );

  const recipientName =
    form.linkType === 'lead'
      ? selectedLead
        ? `${selectedLead.company} (${selectedLead.name})`
        : 'None selected'
      : form.linkType === 'opportunity'
        ? selectedOpportunity
          ? `${selectedOpportunity.opportunityNumber || 'Deal'} · ${selectedOpportunity.title}`
          : 'None selected'
        : selectedClient?.name || 'None selected';

  const recipientContact =
    form.linkType === 'lead'
      ? selectedLead
        ? `${selectedLead.email || '—'} · ${selectedLead.phone || '—'}`
        : ''
      : form.linkType === 'opportunity'
        ? selectedOpportunity
          ? [
              selectedOpportunity.contactPerson,
              selectedOpportunity.contactEmail,
              selectedOpportunity.contactMobile,
            ]
              .filter(Boolean)
              .join(' · ') || selectedOpportunity.clientName || ''
          : ''
        : selectedClient
          ? `${selectedClient.email || '—'} · ${selectedClient.phone || selectedClient.mobile || '—'}`
          : '';

  const recipientAddress =
    form.linkType === 'lead'
      ? selectedLead?.address || ''
      : form.linkType === 'opportunity'
        ? selectedOpportunity?.shippingState
          ? `Shipping state: ${selectedOpportunity.shippingState}`
          : ''
        : [
            selectedClient?.billingAddress?.street,
            selectedClient?.billingAddress?.city,
            selectedClient?.billingAddress?.state,
            selectedClient?.billingAddress?.country,
            selectedClient?.city,
          ]
            .filter(Boolean)
            .join(', ');

  const linkedId =
    form.linkType === 'lead'
      ? form.leadId
      : form.linkType === 'opportunity'
        ? form.opportunityId
        : form.clientId;

  const update = <K extends keyof SampleCreateInput>(key: K, value: SampleCreateInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setLinkType = (type: SampleLinkType) => {
    setForm((current) => ({
      ...current,
      linkType: type,
      leadId: '',
      clientId: '',
      opportunityId: '',
    }));
  };

  const updateItem = (index: number, patch: Partial<SampleProductItem>) => {
    setItems((curr) => {
      const next = [...curr];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addItem = (preset?: Partial<SampleProductItem>) => {
    setItems((curr) => [
      ...curr,
      {
        productName: preset?.productName || '',
        quantity: Math.max(1, Number(preset?.quantity) || 1),
        unit: preset?.unit || availableUnits[0] || 'pcs',
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((curr) => (curr.length > 1 ? curr.filter((_, i) => i !== index) : curr));
  };

  const applyPreset = (preset: SampleProductPreset) => {
    setItems((curr) => {
      if (curr.length === 1 && !curr[0].productName.trim()) {
        return [{ productName: preset.productName, quantity: preset.quantity, unit: preset.unit }];
      }
      return [
        ...curr,
        { productName: preset.productName, quantity: preset.quantity, unit: preset.unit },
      ];
    });
  };

  const handleOpportunityChange = (opportunityId: string) => {
    const opp = opportunities.find((item) => item._id === opportunityId) || null;
    setForm((current) => ({
      ...current,
      opportunityId,
      leadId: opp?.leadId || '',
      clientId: opp?.clientId || '',
    }));
    if (opp?.products?.length) {
      setItems(
        opp.products.map((p) => ({
          productName: p.productName || '',
          quantity: Math.max(1, Number(p.quantity) || 1),
          unit: availableUnits[0] || 'pcs',
        }))
      );
    }
  };

  const copyAddress = () => {
    if (!recipientAddress) return setError('No address found on the selected record.');
    update('deliveryAddress', recipientAddress);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const validItems = items.filter((item) => item.productName.trim());
    if (!linkedId || validItems.length === 0) {
      return setError('Linked record and at least one product / item name are required.');
    }
    setSaving(true);
    try {
      const recipient =
        form.linkType === 'lead'
          ? selectedLead?.name
          : form.linkType === 'opportunity'
            ? selectedOpportunity?.contactPerson ||
              selectedOpportunity?.clientName ||
              selectedOpportunity?.title
            : selectedClient?.contactPerson || selectedClient?.name;

      const totalQty = validItems.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
      const combinedProductName = validItems.map((it) => it.productName.trim()).join(', ');
      const primaryUnit = validItems[0]?.unit || 'pcs';

      const created = await crmApi.createSample({
        ...form,
        leadId: form.linkType === 'lead' ? form.leadId : form.linkType === 'opportunity' ? form.leadId || undefined : undefined,
        clientId:
          form.linkType === 'client'
            ? form.clientId
            : form.linkType === 'opportunity'
              ? form.clientId || undefined
              : undefined,
        opportunityId: form.linkType === 'opportunity' ? form.opportunityId : undefined,
        productName: combinedProductName,
        quantity: totalQty,
        unit: primaryUnit,
        items: validItems,
        recipientName: recipient,
      });
      const returnTo = searchParams.get('returnTo');
      navigate(
        returnTo && returnTo.startsWith('/')
          ? returnTo
          : created.data?._id
            ? `/samples/${created.data._id}`
            : '/samples'
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create sample request');
    } finally {
      setSaving(false);
    }
  };

  const checklist = [
    {
      ok: Boolean(linkedId),
      label:
        form.linkType === 'lead'
          ? `Lead: ${recipientName}`
          : form.linkType === 'opportunity'
            ? `Opportunity: ${recipientName}`
            : `Client: ${recipientName}`,
      empty: 'Target Lead, Opportunity, or Client selected',
    },
    {
      ok: Boolean(items.some((i) => i.productName.trim())),
      label: `Items: ${items.map((i) => i.productName.trim()).filter(Boolean).join(', ') || 'None entered'}`,
      empty: 'Product / Item name filled',
    },
    {
      ok: items.every((i) => i.quantity > 0),
      label: `Total Quantity: ${items.reduce((s, i) => s + i.quantity, 0)} (${items.map((i) => `${i.quantity} ${i.unit}`).join(', ')})`,
      empty: 'Quantity must be > 0',
    },
  ];

  return (
    <div data-tour="samples-create-form" className="flex w-full flex-col gap-5">
      <Link
        to="/samples"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 no-underline hover:text-zinc-950"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} />
        Back to Samples
      </Link>
      <div data-tour="samples-create-title" className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-zinc-950">New Sample Request</h1>
          <p className="mt-1 mb-0 text-sm text-zinc-500">
            Link a lead, opportunity, or client, define the sample kit, and set dispatch urgency.
          </p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
          Draft Request
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          Loading form…
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-5">
            <section
              data-tour="samples-create-recipient"
              className="rounded-xl border border-zinc-300 bg-white p-5"
            >
              <h2 className="mt-0 text-base font-bold text-zinc-950">1. Target Recipient & Account</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {LINK_OPTIONS.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLinkType(type)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      form.linkType === type
                        ? 'border-sky-300 bg-sky-50 text-sky-900'
                        : 'border-zinc-200 bg-white text-zinc-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-4 block">
                <span className={labelClass}>
                  {form.linkType === 'lead'
                    ? 'Select Lead Prospect *'
                    : form.linkType === 'opportunity'
                      ? 'Select Opportunity Deal *'
                      : 'Select Client Account *'}
                </span>
                {form.linkType === 'lead' ? (
                  <select
                    required
                    className={fieldClass}
                    value={form.leadId || ''}
                    onChange={(event) => update('leadId', event.target.value)}
                    data-tour="samples-create-lead"
                  >
                    <option value="">Choose lead…</option>
                    {leads.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.company} ({item.name})
                      </option>
                    ))}
                  </select>
                ) : form.linkType === 'opportunity' ? (
                  <select
                    required
                    className={fieldClass}
                    value={form.opportunityId || ''}
                    onChange={(event) => handleOpportunityChange(event.target.value)}
                    data-tour="samples-create-opportunity"
                  >
                    <option value="">Choose opportunity…</option>
                    {sampleEligibleOpportunities.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.opportunityNumber || 'OPP'} · {item.title}
                        {item.clientName ? ` (${item.clientName})` : item.leadId ? ' (Lead)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <ClientSelect
                    clients={clients}
                    value={form.clientId || ''}
                    required
                    placeholder="Choose client…"
                    onChange={(nextId) => update('clientId', nextId)}
                  />
                )}
              </label>
              {(selectedLead || selectedClient || selectedOpportunity) && (
                <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700">
                  <div className="font-semibold text-zinc-900">{recipientName}</div>
                  <div className="mt-1 text-xs text-zinc-500">{recipientContact}</div>
                  {form.linkType === 'opportunity' && selectedOpportunity && (
                    <div className="mt-1 text-xs text-zinc-500">
                      Stage: {selectedOpportunity.stage}
                      {selectedOpportunity.leadId ? ' · Linked lead' : ''}
                      {selectedOpportunity.clientId ? ' · Linked client' : ''}
                    </div>
                  )}
                  {recipientAddress && (
                    <div className="mt-1 text-xs text-zinc-500">📍 {recipientAddress}</div>
                  )}
                  {recipientAddress && form.linkType !== 'opportunity' && (
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="mt-2 h-8 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700"
                    >
                      📋 Copy Address to Shipping
                    </button>
                  )}
                </div>
              )}
            </section>

            <section
              data-tour="samples-create-product"
              className="rounded-xl border border-zinc-300 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div>
                  <h2 className="m-0 text-base font-bold text-zinc-950">
                    2. Product & Sample Specifications
                  </h2>
                  <p className="m-0 mt-0.5 text-xs text-zinc-500">
                    Specify items, requested quantities, and choose Unit of Measure configured from Settings.
                  </p>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-zinc-500">Quick Presets</span>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PRODUCT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 space-y-3 transition hover:border-zinc-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-700">
                          {idx + 1}
                        </span>
                        Item #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition cursor-pointer"
                          title="Remove item"
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <span className={labelClass}>Product / Item Name *</span>
                        <input
                          required
                          maxLength={200}
                          className={fieldClass}
                          placeholder="e.g. Cotton fabric sample, Grade A polymer…"
                          value={item.productName}
                          onChange={(e) => updateItem(idx, { productName: e.target.value })}
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <span className={labelClass}>Quantity *</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })}
                            className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-base font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                          >
                            −
                          </button>
                          <input
                            required
                            type="number"
                            min={1}
                            max={99999}
                            className={`${fieldClass} text-center px-1 font-semibold`}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { quantity: Math.min(99999, item.quantity + 1) })}
                            className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-base font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <span className={labelClass}>Unit of Measure *</span>
                        <select
                          className={fieldClass}
                          value={item.unit}
                          onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        >
                          {availableUnits.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                          {!availableUnits.includes(item.unit) && item.unit && (
                            <option value={item.unit}>{item.unit}</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Item Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => addItem()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-zinc-400 bg-white px-3.5 text-xs font-semibold text-zinc-800 shadow-sm hover:border-zinc-950 hover:bg-zinc-50 transition cursor-pointer"
                >
                  <AddIcon sx={{ fontSize: 16 }} /> + Add New Item
                </button>
              </div>
            </section>

            <section
              data-tour="samples-create-urgency"
              className="rounded-xl border border-zinc-300 bg-white p-5"
            >
              <h2 className="mt-0 text-base font-bold text-zinc-950">
                3. Dispatch Urgency & Priority SLA
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {SAMPLE_URGENCIES.map((urgency) => (
                  <button
                    key={urgency}
                    type="button"
                    onClick={() => update('urgency', urgency as SampleUrgency)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold ${
                      form.urgency === urgency
                        ? sampleUrgencyTone(urgency)
                        : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    <div>
                      {sampleUrgencyEmoji(urgency)} {urgency}
                    </div>
                  </button>
                ))}
              </div>
              <label className="mt-4 block">
                <span className={labelClass}>Delivery / Shipping Address</span>
                <textarea
                  rows={3}
                  className={`${fieldClass} h-auto py-2`}
                  value={form.deliveryAddress || ''}
                  onChange={(event) => update('deliveryAddress', event.target.value)}
                  placeholder="Full shipping address for the sample kit"
                />
              </label>
              <label className="mt-4 block">
                <span className={labelClass}>Internal Notes</span>
                <textarea
                  rows={3}
                  className={`${fieldClass} h-auto py-2`}
                  value={form.notes || ''}
                  onChange={(event) => update('notes', event.target.value)}
                  placeholder="Packaging preferences, special handling, etc."
                />
              </label>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/samples')}
                className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Create Sample Request'}
              </button>
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <div className="rounded-xl border border-zinc-300 bg-white p-5">
              <h3 className="m-0 text-sm font-bold text-zinc-950">Checklist</h3>
              <ul className="mt-3 list-none space-y-2 p-0 text-xs">
                {checklist.map((item) => (
                  <li
                    key={item.empty}
                    className={`flex items-start gap-2 ${item.ok ? 'text-emerald-700' : 'text-red-600'}`}
                  >
                    <span>{item.ok ? '✅' : '❌'}</span>
                    <span>{item.ok ? item.label : item.empty}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
};
