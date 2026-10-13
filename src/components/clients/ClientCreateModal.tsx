import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { ClientCreateInput, ClientDuplicateCheckResult } from '../../types/clients';
import { crmApi } from '../../services/api';
import { AddLeadItemModal } from '../leads/AddLeadItemModal';

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

interface ClientCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories?: string[];
  tags?: string[];
}

export const ClientCreateModal: React.FC<ClientCreateModalProps> = ({
  open,
  onClose,
  onSuccess,
  categories = [],
  tags = [],
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [category, setCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [categoryList, setCategoryList] = useState<string[]>(categories);
  const [tagList, setTagList] = useState<string[]>(tags);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddTagModal, setShowAddTagModal] = useState(false);

  // Primary Contact
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactDesignation, setContactDesignation] = useState('');

  // Billing Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [zip, setZip] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<ClientDuplicateCheckResult | null>(null);

  useEffect(() => {
    setCategoryList(categories);
  }, [categories]);

  useEffect(() => {
    setTagList(tags);
  }, [tags]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setPhone('');
      setWebsite('');
      setStatus('Active');
      setCategory(categories[0] || '');
      setSelectedTags([]);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactDesignation('');
      setStreet('');
      setCity('');
      setState('');
      setCountry('India');
      setZip('');
      setError(null);
      setDuplicateResult(null);
    }
  }, [open, categories]);

  // Real-time duplicate check
  useEffect(() => {
    if (!name.trim() && !email.trim() && !phone.trim()) {
      setDuplicateResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await crmApi.checkClientDuplicates({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        if (res.data?.hasDuplicates) {
          setDuplicateResult(res.data);
        } else {
          setDuplicateResult(null);
        }
      } catch {
        setDuplicateResult(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [name, email, phone]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Company Name is required.';
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      return 'Enter a valid company email address.';
    }
    if (phone.trim() && !PHONE_RE.test(phone.trim())) {
      return 'Enter a valid company phone number (7–20 digits).';
    }
    const site = normalizeWebsite(website);
    if (site && !URL_RE.test(site)) {
      return 'Website must be a valid URL (e.g. https://www.example.com).';
    }
    if (contactEmail.trim() && !EMAIL_RE.test(contactEmail.trim())) {
      return 'Enter a valid primary contact email.';
    }
    if (contactPhone.trim() && !PHONE_RE.test(contactPhone.trim())) {
      return 'Enter a valid primary contact phone.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const body: ClientCreateInput = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        website: normalizeWebsite(website) || undefined,
        status,
        category: category || undefined,
        tags: selectedTags.length ? selectedTags : undefined,
        billingAddress: street || city || state || zip || country !== 'India' ? {
          type: 'billing',
          street: street.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          country: country.trim() || 'India',
          zip: zip.trim() || undefined,
          isDefault: true,
        } : undefined,
        primaryContact: contactName.trim() ? {
          name: contactName.trim(),
          email: contactEmail.trim() || undefined,
          phone: contactPhone.trim() || undefined,
          designation: contactDesignation.trim() || undefined,
          isPrimary: true,
        } : undefined,
        allowExactDuplicate: true,
      };

      await crmApi.createClient(body);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        className: 'rounded-xl border border-zinc-300 bg-white p-0 shadow-none',
        style: { borderRadius: '12px', boxShadow: 'none' },
      }}
    >
      <div className="flex items-center justify-between p-5 border-b border-zinc-200">
        <div>
          <h2 className="text-base font-bold text-zinc-950 m-0">Create New Client</h2>
          <p className="text-xs text-zinc-500 m-0 mt-0.5">
            Add a new company/customer account to your CRM. Fields marked * are required.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 cursor-pointer transition-colors"
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Duplicate detection warning */}
        {duplicateResult && duplicateResult.hasDuplicates && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
            <WarningAmberIcon sx={{ fontSize: 18 }} className="text-amber-800 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <strong className="block font-semibold mb-0.5">Similar Client Found:</strong>
              {[...(duplicateResult.exact || []), ...(duplicateResult.similar || [])]
                .slice(0, 3)
                .map((m) => (
                  <div key={m._id} className="text-amber-800">
                    • <strong>{m.name}</strong> {m.email ? `(${m.email})` : ''} {m.phone ? `· ${m.phone}` : ''}
                  </div>
                ))}
              <span className="text-[11px] text-amber-700 mt-1 block">
                You can still proceed if this is a separate account or branch.
              </span>
            </div>
          </div>
        )}

        {/* Section 1: Company Profile */}
        <div>
          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider mb-3">
            1. Company Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corporation Pvt Ltd"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Company Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Website
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-zinc-600">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(true)}
                  className="text-[10px] font-semibold text-zinc-900 hover:underline bg-transparent border-none cursor-pointer"
                >
                  + Add
                </button>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs border border-zinc-300 rounded-lg px-2.5 py-2 bg-white text-zinc-900 outline-none"
              >
                <option value="">None</option>
                {categoryList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full text-xs border border-zinc-300 rounded-lg px-2.5 py-2 bg-white text-zinc-900 outline-none"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="sm:col-span-12">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-zinc-600">
                  Tags
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddTagModal(true)}
                  className="text-[10px] font-semibold text-zinc-900 hover:underline bg-transparent border-none cursor-pointer"
                >
                  + Add Tag
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tagList.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border cursor-pointer transition-colors ${
                        active
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Primary Contact Person */}
        <div className="pt-2 border-t border-zinc-100">
          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider mb-3">
            2. Primary Contact Person
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Designation / Job Title
              </label>
              <input
                type="text"
                value={contactDesignation}
                onChange={(e) => setContactDesignation(e.target.value)}
                placeholder="e.g. Managing Director"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="rahul@company.com"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Billing Address */}
        <div className="pt-2 border-t border-zinc-100">
          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider mb-3">
            3. Billing Address
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-12">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Building, Street, Area"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Zip Code
              </label>
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="400001"
                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-zinc-950 border border-zinc-950 rounded-lg hover:bg-zinc-800 cursor-pointer disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating Client…' : 'Create Client'}
          </button>
        </div>
      </form>

      <AddLeadItemModal
        open={showAddCategoryModal}
        title="Add New Category"
        subtitle="Create a classification category for client accounts."
        label="Category Name *"
        placeholder="e.g. Enterprise, Government, Retail"
        submitLabel="Save Category"
        onClose={() => setShowAddCategoryModal(false)}
        onSubmit={async (val) => {
          const res = await crmApi.createClientCategory(val);
          setCategoryList(res.data || [...categoryList, val]);
          setCategory(val);
        }}
      />

      <AddLeadItemModal
        open={showAddTagModal}
        title="Add New Client Tag"
        subtitle="Create a tag for client labeling and segmentation."
        label="Tag Name *"
        placeholder="e.g. VIP, Key Account, Inbound"
        submitLabel="Save Tag"
        onClose={() => setShowAddTagModal(false)}
        onSubmit={async (val) => {
          const res = await crmApi.createClientTag(val);
          setTagList(res.data || [...tagList, val]);
          setSelectedTags((prev) => (prev.includes(val) ? prev : [...prev, val]));
        }}
      />
    </Dialog>
  );
};
