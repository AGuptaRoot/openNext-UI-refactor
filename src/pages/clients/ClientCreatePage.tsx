import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { ApiError, crmApi } from '../../services/api';
import {
  ClientCreateInput,
  ClientCustomFieldDef,
  ClientDuplicateCheckResult,
} from '../../types/clients';
import { LeadItem } from '../../types/leads';
import { AddLeadItemModal } from '../../components/leads/AddLeadItemModal';
import {
  AddCustomFieldModal,
  CustomFieldDefinitionInput,
} from '../../components/common/AddCustomFieldModal';
import { ClientAvatarColorPicker } from '../../components/clients/ClientAvatarColorPicker';
import {
  DocumentUploadControl,
  IMAGE_ACCEPT,
} from '../../components/common/DocumentUploadControl';
import { DEFAULT_CLIENT_AVATAR_COLOR, resolveClientAvatarColor, resolveClientMediaUrl } from '../../utils/clientAvatar';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{7,20}$/;
const URL_RE = /^https?:\/\/.+/i;

function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (URL_RE.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export const ClientCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm } = useDialog();
  const canWrite = hasPermission('crm.clients.write');

  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<ClientCustomFieldDef[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showAddCustomFieldModal, setShowAddCustomFieldModal] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarColor, setAvatarColor] = useState(DEFAULT_CLIENT_AVATAR_COLOR);
  const [status, setStatus] = useState('Active');
  const [category, setCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [leadId, setLeadId] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [zip, setZip] = useState('');

  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shipStreet, setShipStreet] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipCountry, setShipCountry] = useState('India');
  const [shipZip, setShipZip] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactDesignation, setContactDesignation] = useState('');
  const [contactIsPrimary, setContactIsPrimary] = useState(true);

  useEffect(() => {
    Promise.all([
      crmApi.getClientCategories(),
      crmApi.getClientTags(),
      crmApi.getClientCustomFields(),
      crmApi.getLeads({ limit: 100 }),
    ])
      .then(([c, t, cf, leadsRes]) => {
        setCategories(c.data || []);
        setTags(t.data || []);
        setCustomFieldDefs(cf.data || []);
        setLeads(leadsRes.data || []);
      })
      .catch(() => {});
  }, []);

  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'C';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [name]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleCreateCategory = async (catName: string) => {
    const res = await crmApi.createClientCategory(catName);
    setCategories(res.data || []);
    setCategory(catName);
  };

  const handleCreateTag = async (tagName: string) => {
    const res = await crmApi.createClientTag(tagName);
    setTags(res.data || []);
    setSelectedTags((prev) => (prev.includes(tagName) ? prev : [...prev, tagName]));
  };

  const handleCreateCustomField = async (field: CustomFieldDefinitionInput) => {
    await crmApi.addClientCustomField({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options,
    });
    const refreshed = await crmApi.getClientCustomFields();
    setCustomFieldDefs(refreshed.data || []);
  };

  const handleImportLead = (id: string) => {
    setLeadId(id);
    const lead = leads.find((l) => l._id === id);
    if (!lead) return;
    setName(lead.company || lead.name || '');
    setEmail(lead.email || '');
    setPhone(lead.phone || '');
    setContactName(lead.name || '');
    setContactEmail(lead.email || '');
    setContactPhone(lead.phone || '');
    setContactDesignation(lead.jobTitle || '');
    if (lead.address) setStreet(lead.address);
    if (Array.isArray(lead.tags) && lead.tags.length) {
      setSelectedTags(lead.tags);
    }
  };



  const validate = (): string | null => {
    if (!name.trim()) return 'Company name is required';
    if (email.trim() && !EMAIL_RE.test(email.trim())) return 'Enter a valid company email address';
    if (phone.trim() && !PHONE_RE.test(phone.trim())) {
      return 'Enter a valid company mobile number (7–15 digits; country code allowed)';
    }
    const site = normalizeWebsite(website);
    if (site && !URL_RE.test(site)) {
      return 'Website must be a valid URL (e.g. https://www.example.com)';
    }
    if (contactEmail.trim() && !EMAIL_RE.test(contactEmail.trim())) {
      return 'Enter a valid contact email';
    }
    if (contactPhone.trim() && !PHONE_RE.test(contactPhone.trim())) {
      return 'Enter a valid contact phone';
    }
    for (const def of customFieldDefs) {
      if (def.required) {
        const val = customFields[def.key];
        if (val === undefined || val === null || String(val).trim() === '') {
          return `${def.label} is required`;
        }
      }
    }
    return null;
  };

  const buildClientBody = (allowExactDuplicate = false): ClientCreateInput => {
    const billing = {
      street: street.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      country: country.trim() || 'India',
      zip: zip.trim() || undefined,
    };
    const shipping = sameAsBilling
      ? { ...billing }
      : {
          street: shipStreet.trim() || undefined,
          city: shipCity.trim() || undefined,
          state: shipState.trim() || undefined,
          country: shipCountry.trim() || 'India',
          zip: shipZip.trim() || undefined,
        };

    const addresses = [];
    if (billing.street || billing.city) {
      addresses.push({
        type: 'billing' as const,
        label: 'Primary Billing Address',
        ...billing,
        isDefault: true,
      });
    }
    if (shipping.street || shipping.city) {
      addresses.push({
        type: 'shipping' as const,
        label: 'Primary Shipping Address',
        ...shipping,
        isDefault: true,
      });
    }

    return {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      website: normalizeWebsite(website) || undefined,
      avatarUrl: avatarUrl.trim() || undefined,
      avatarColor: avatarColor || DEFAULT_CLIENT_AVATAR_COLOR,
      status,
      category: category || undefined,
      tags: selectedTags,
      customFields,
      billingAddress: billing,
      shippingAddress: shipping,
      addresses,
      leadId: leadId || undefined,
      allowExactDuplicate: allowExactDuplicate || undefined,
    };
  };

  const formatDuplicates = (dup: ClientDuplicateCheckResult): string => {
    const lines = [
      ...(dup.exact || []).map((d) => `Exact: ${d.name} (${d.matchReason || 'match'})`),
      ...(dup.similar || []).map((d) => `Similar: ${d.name} (${d.matchReason || 'match'})`),
    ];
    return lines.slice(0, 5).join('\n');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) {
      setError('You do not have permission to create clients');
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const clientBody = buildClientBody(false);
      const dupRes = await crmApi.checkClientDuplicates({
        name: clientBody.name,
        email: clientBody.email,
        phone: clientBody.phone,
      });
      let allowExact = false;
      if (dupRes.data?.hasDuplicates) {
        const proceed = await confirm(
          `Possible duplicates found:\n${formatDuplicates(dupRes.data)}\n\nCreate anyway?`
        );
        if (!proceed) {
          setSaving(false);
          return;
        }
        allowExact = true;
      }

      const res = await crmApi.createClient(buildClientBody(allowExact));
      const clientId = res.data._id;

      if (clientId && contactName.trim()) {
        try {
          let personContactId: string | undefined;
          try {
            const personRes = await crmApi.createContact({
              name: contactName.trim(),
              companyName: name.trim() || undefined,
              email: contactEmail.trim() || undefined,
              phone: contactPhone.trim() || undefined,
              jobTitle: contactDesignation.trim() || undefined,
            });
            personContactId = personRes.data?._id;
          } catch (personErr: unknown) {
            if (personErr instanceof ApiError && personErr.status === 409) {
              const dupes = Array.isArray(personErr.duplicates)
                ? (personErr.duplicates as Array<{ _id?: string }>)
                : [];
              const existingId = dupes[0]?._id ? String(dupes[0]._id) : '';
              if (existingId) personContactId = existingId;
            }
            // If directory create fails for other reasons, still add the client-row contact.
          }
          await crmApi.addClientContact(clientId, {
            name: contactName.trim(),
            email: contactEmail.trim() || undefined,
            phone: contactPhone.trim() || undefined,
            designation: contactDesignation.trim() || undefined,
            isPrimary: contactIsPrimary,
            personContactId,
          });
        } catch (contactErr: unknown) {
          setError(
            contactErr instanceof Error
              ? `Client created, but contact could not be added: ${contactErr.message}`
              : 'Client created, but contact could not be added'
          );
          navigate(`/clients/${clientId}`);
          return;
        }
      }

      if (clientId) {
        const body = buildClientBody(allowExact);
        for (const addr of body.addresses || []) {
          try {
            await crmApi.addClientAddress(clientId, addr);
          } catch {
            // Non-blocking — billing may already be on company record.
          }
        }
      }

      navigate(`/clients/${clientId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border';

  if (!canWrite) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-10 text-center max-w-lg">
        <p className="text-sm font-semibold text-red-700 m-0 mb-2">Permission denied</p>
        <p className="text-xs text-zinc-500 m-0 mb-4">
          You need <code className="text-[11px]">crm.clients.write</code> to create clients.
        </p>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 no-underline"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 no-underline hover:text-zinc-950"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          Back to Clients
        </Link>
      </div>

      <div className="bg-white border border-zinc-300 rounded-xl p-5 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-xl text-white flex items-center justify-center text-lg font-bold overflow-hidden border border-zinc-200 flex-shrink-0"
          style={{ backgroundColor: resolveClientAvatarColor(avatarColor) }}
        >
          {avatarUrl.trim() ? (
            <img
              src={resolveClientMediaUrl(avatarUrl.trim())}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-0.5">
            Client Directory
          </p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">
            {name.trim() || 'Create client'}
          </h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Add company profile, tags, custom fields, billing & shipping, and primary contact.
          </p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      <form data-tour="clients-create-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 flex flex-col gap-5">
          {leads.length > 0 && (
            <section data-tour="clients-section-import-lead" className="bg-white border border-zinc-300 rounded-xl p-5 border-l-4 border-l-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-1">Import from lead</h2>
              <p className="text-xs text-zinc-500 m-0 mb-3">
                Auto-fill company and contact information from an existing lead.
              </p>
              <select
                className={fieldClass}
                value={leadId}
                onChange={(e) => handleImportLead(e.target.value)}
              >
                <option value="">Choose a lead to auto-populate fields…</option>
                {leads.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.company || l.name}
                    {l.email ? ` · ${l.email}` : ''}
                    {l.status ? ` — ${l.status}` : ''}
                  </option>
                ))}
              </select>
            </section>
          )}

          <section data-tour="clients-section-company" className="bg-white border border-zinc-300 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-4">Company profile & avatar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label data-tour="clients-field-name" className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Company name *
                </span>
                <input
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Acme Corporation"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Upload logo / photo
                </span>
                <DocumentUploadControl
                  folder="clients"
                  accept={IMAGE_ACCEPT}
                  buttonLabel="Choose image"
                  mode="auto"
                  currentUrl={avatarUrl || null}
                  onUploaded={(res) => setAvatarUrl(res.url || res.fileUrl || '')}
                />
              </label>
              <div className="sm:col-span-2">
                <ClientAvatarColorPicker value={avatarColor} onChange={setAvatarColor} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Category</span>
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(true)}
                    className="text-[11px] font-semibold text-zinc-900 hover:underline bg-transparent border-none cursor-pointer"
                  >
                    + Add Category
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    className={fieldClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Select category (optional)</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(true)}
                    className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer inline-flex items-center gap-1 shrink-0"
                    title="Add new category"
                  >
                    <AddIcon sx={{ fontSize: 14 }} />
                    Add
                  </button>
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">Status</span>
                <select
                  className={fieldClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Company email
                </span>
                <input
                  className={fieldClass}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={120}
                  placeholder="contact@company.com"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Mobile number
                </span>
                <input
                  className={fieldClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={24}
                  placeholder="+91 98765 43210"
                />
                <span className="text-[10px] text-zinc-400">
                  Optional. 7 to 15 digits; country code is allowed.
                </span>
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">Website</span>
                <input
                  className={fieldClass}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  maxLength={200}
                  placeholder="https://www.example.com"
                />
              </label>
            </div>
          </section>

          <section data-tour="clients-section-tags" className="bg-white border border-zinc-300 rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 m-0">Client tags</h2>
                <p className="text-xs text-zinc-500 m-0 mt-0.5">
                  Categorize and segment this client account
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTagModal(true)}
                className="text-[11px] font-semibold text-zinc-900 hover:underline bg-transparent border-none cursor-pointer"
              >
                + Add New Tag
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer ${
                    selectedTags.includes(tag)
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowAddTagModal(true)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer inline-flex items-center gap-1.5 text-zinc-800"
              >
                <AddIcon sx={{ fontSize: 14 }} />
                Add Tag
              </button>
            </div>
          </section>

          <section data-tour="clients-section-custom-fields" className="bg-white border border-zinc-300 rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 m-0">Custom fields</h2>
                <p className="text-xs text-zinc-500 m-0 mt-0.5">
                  Account-level attributes and business metadata
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomFieldModal(true)}
                className="text-[11px] font-semibold text-zinc-900 hover:underline bg-transparent border-none cursor-pointer"
              >
                + Add Custom Field
              </button>
            </div>
            {customFieldDefs.length === 0 ? (
              <p className="text-xs text-zinc-500 m-0 mb-3">
                No custom fields configured yet. Add one below.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                {customFieldDefs.map((def) => (
                  <label key={def.key} className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                      {def.label}
                      {def.required ? ' *' : ''}
                    </span>
                    {def.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={Boolean(customFields[def.key])}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [def.key]: e.target.checked }))
                        }
                        className="w-4 h-4"
                      />
                    ) : def.type === 'select' ? (
                      <select
                        className={fieldClass}
                        value={String(customFields[def.key] ?? '')}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                        }
                      >
                        <option value="">Select…</option>
                        {(def.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : def.type === 'textarea' ? (
                      <textarea
                        className="min-h-[72px] px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border"
                        value={String(customFields[def.key] ?? '')}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                        }
                      />
                    ) : (
                      <input
                        className={fieldClass}
                        type={
                          def.type === 'number'
                            ? 'number'
                            : def.type === 'date'
                              ? 'date'
                              : def.type === 'email'
                                ? 'email'
                                : def.type === 'url'
                                  ? 'url'
                                  : 'text'
                        }
                        value={
                          customFields[def.key] === undefined || customFields[def.key] === null
                            ? ''
                            : String(customFields[def.key])
                        }
                        onChange={(e) =>
                          setCustomFields((prev) => ({
                            ...prev,
                            [def.key]:
                              def.type === 'number'
                                ? e.target.value === ''
                                  ? ''
                                  : Number(e.target.value)
                                : e.target.value,
                          }))
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowAddCustomFieldModal(true)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer inline-flex items-center gap-1.5 text-zinc-800"
              >
                <AddIcon sx={{ fontSize: 14 }} />
                Add Custom Field
              </button>
            </div>
          </section>

          <section data-tour="clients-section-billing" className="bg-white border border-zinc-300 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-1">Primary billing address</h2>
            <p className="text-xs text-zinc-500 m-0 mb-4">Optional invoicing location and postal details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">Street</span>
                <input
                  className={fieldClass}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  maxLength={200}
                  placeholder="Suite 400, 100 Main Street"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">City</span>
                <input
                  className={fieldClass}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={80}
                  placeholder="Mumbai"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  State / Province
                </span>
                <input
                  className={fieldClass}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  maxLength={80}
                  placeholder="Maharashtra"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">Country</span>
                <input
                  className={fieldClass}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={80}
                  placeholder="India"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  ZIP / Postal code
                </span>
                <input
                  className={fieldClass}
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  maxLength={20}
                  placeholder="400001"
                />
              </label>
            </div>
          </section>

          <section data-tour="clients-section-shipping" className="bg-white border border-zinc-300 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 m-0">
                  Shipping / delivery address
                </h2>
                <p className="text-xs text-zinc-500 m-0 mt-0.5">
                  Location for product dispatch and deliveries
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                />
                Same as billing
              </label>
            </div>
            {!sameAsBilling ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Street</span>
                  <input
                    className={fieldClass}
                    value={shipStreet}
                    onChange={(e) => setShipStreet(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">City</span>
                  <input
                    className={fieldClass}
                    value={shipCity}
                    onChange={(e) => setShipCity(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">State</span>
                  <input
                    className={fieldClass}
                    value={shipState}
                    onChange={(e) => setShipState(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Country</span>
                  <input
                    className={fieldClass}
                    value={shipCountry}
                    onChange={(e) => setShipCountry(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">ZIP</span>
                  <input
                    className={fieldClass}
                    value={shipZip}
                    onChange={(e) => setShipZip(e.target.value)}
                  />
                </label>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 m-0">Shipping will mirror the billing address.</p>
            )}
          </section>

          <section data-tour="clients-section-contact" className="bg-white border border-zinc-300 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-1">Primary contact person</h2>
            <p className="text-xs text-zinc-500 m-0 mb-4">
              Main representative at this organization
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Contact name
                </span>
                <input
                  className={fieldClass}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  maxLength={120}
                  placeholder="e.g., Jane Doe"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Designation
                </span>
                <input
                  className={fieldClass}
                  value={contactDesignation}
                  onChange={(e) => setContactDesignation(e.target.value)}
                  maxLength={80}
                  placeholder="e.g., CEO, Project Director"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Contact email
                </span>
                <input
                  className={fieldClass}
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  maxLength={120}
                  placeholder="jane@company.com"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Contact mobile
                </span>
                <input
                  className={fieldClass}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  maxLength={24}
                  placeholder="+91 98765 43210"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={contactIsPrimary}
                  onChange={(e) => setContactIsPrimary(e.target.checked)}
                />
                Set as primary account contact
              </label>
            </div>
          </section>

          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/clients')}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-tour="clients-save-btn"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Client'}
            </button>
          </div>
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="bg-white border border-zinc-300 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-950 m-0 mb-1">Client profile preview</h3>
            <p className="text-[11px] text-zinc-500 m-0 mb-3">Live card synchronization</p>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl text-white flex items-center justify-center text-sm font-bold overflow-hidden border border-zinc-200"
                style={{ backgroundColor: resolveClientAvatarColor(avatarColor) }}
              >
                {avatarUrl.trim() ? (
                  <img
              src={resolveClientMediaUrl(avatarUrl.trim())}
              alt=""
              className="w-full h-full object-cover"
            />
                ) : (
                  initials
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-950">
                  {name.trim() || 'Company Name'}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    {status}
                  </span>
                  {category ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-zinc-50 text-zinc-700 border-zinc-200">
                      {category}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {selectedTags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 text-xs text-zinc-600">
              <div className="flex justify-between gap-2">
                <span className="text-zinc-400">Email</span>
                <span className="text-right truncate">{email.trim() || 'No email specified'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-400">Phone</span>
                <span className="text-right">{phone.trim() || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-400">Website</span>
                <span className="text-right truncate">
                  {normalizeWebsite(website) || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-400">Contact</span>
                <span className="text-right truncate">{contactName.trim() || '—'}</span>
              </div>
            </div>
          </section>

          <section className="bg-white border border-zinc-300 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-950 m-0 mb-1">Tax ID & invoicing</h3>
            <p className="text-[11px] text-zinc-500 m-0 mb-3">Assigned automatically</p>
            <div className="text-xs">
              <div className="text-zinc-400 mb-1">Tax ID</div>
              <div className="font-mono font-bold text-zinc-800">Auto-generated on save</div>
              <p className="text-[11px] text-zinc-500 m-0 mt-2 leading-relaxed">
                Each client receives a unique tax identification number when created for quotes and
                invoices. Manual Tax ID entry is not required.
              </p>
            </div>
          </section>
        </aside>
      </form>

      <AddLeadItemModal
        open={showAddCategoryModal}
        title="Add New Category"
        subtitle="Create a classification category for client accounts."
        label="Category Name *"
        placeholder="e.g. Enterprise, Government, Retail"
        submitLabel="Save Category"
        onClose={() => setShowAddCategoryModal(false)}
        onSubmit={handleCreateCategory}
      />

      <AddLeadItemModal
        open={showAddTagModal}
        title="Add New Client Tag"
        subtitle="Create a tag for client labeling and segmentation."
        label="Tag Name *"
        placeholder="e.g. VIP, Key Account, Inbound"
        submitLabel="Save Tag"
        onClose={() => setShowAddTagModal(false)}
        onSubmit={handleCreateTag}
      />

      <AddCustomFieldModal
        open={showAddCustomFieldModal}
        title="Add Client Custom Field"
        subtitle="Define a custom attribute for client accounts."
        onClose={() => setShowAddCustomFieldModal(false)}
        onSubmit={handleCreateCustomField}
      />
    </div>
  );
};
