import React, { useState, useEffect } from 'react';

import Dialog from '@mui/material/Dialog';

import CloseIcon from '@mui/icons-material/Close';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';



import { LeadCreateInput, AssignableUser, LeadItem } from '../../types/leads';

import { PersonContact } from '../../types/contacts';

import { ApiError, crmApi } from '../../services/api';

import { ContactDuplicateBanner } from '../contacts/ContactDuplicateBanner';
import { CompanyDiscrepancyModal } from '../common/CompanyDiscrepancyModal';
import { useCompanyDiscrepancyCheck } from '../../hooks/useCompanyDiscrepancyCheck';

import { LeadLocationMap } from './LeadLocationMap';

import { useAuth } from '../../context/AuthContext';

import { canAssignToOtherUsers } from '../../utils/permissions';

import { reverseGeocode } from '../../utils/reverseGeocode';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { getCurrencySymbol } from '../../utils/currency';



interface LeadCreateModalProps {

  open: boolean;

  onClose: () => void;

  onSubmit: (data: LeadCreateInput) => Promise<void>;

  pipelineStages: string[];

  leadStatuses: string[];

  leadSources: string[];

  leadTags: string[];

  assignableUsers: AssignableUser[];

}



export const LeadCreateModal: React.FC<LeadCreateModalProps> = ({

  open,

  onClose,

  onSubmit,

  pipelineStages,

  leadStatuses,

  leadSources,

  leadTags,

  assignableUsers,

}) => {

  const { user, isClient, activeRole } = useAuth();

  const canAssignOthers = canAssignToOtherUsers(user, { isClient, activeRole });

  const currentUserId = String(user?.userId || '').trim();
  const settingsCurrency = useDefaultCurrency();

  const [name, setName] = useState('');

  const [salutation, setSalutation] = useState('');

  const [jobTitle, setJobTitle] = useState('');

  const [company, setCompany] = useState('');

  const [email, setEmail] = useState('');

  const [phone, setPhone] = useState('');

  const [pan, setPan] = useState('');

  const [stage, setStage] = useState(pipelineStages[0] || 'New');

  const [status, setStatus] = useState(leadStatuses[0] || 'New');

  const [source, setSource] = useState(leadSources[0] || 'Website');

  const [value, setValue] = useState<number | ''>('');

  const [assignedTo, setAssignedTo] = useState(assignableUsers[0]?.id || '');

  const [selectedTags, setSelectedTags] = useState<string[]>(['Inbound']);

  const [address, setAddress] = useState('');

  const [city, setCity] = useState('');

  const [state, setState] = useState('');

  const [latitude, setLatitude] = useState<number | ''>('');

  const [longitude, setLongitude] = useState<number | ''>('');

  const [notes, setNotes] = useState('');



  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [duplicateMatches, setDuplicateMatches] = useState<LeadItem[]>([]);

  const [contactDuplicates, setContactDuplicates] = useState<PersonContact[]>([]);

  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);

  // Debounced discrepancy check (different company with same email/phone/name)
  const { discrepancy, checkNow: checkDiscrepancyNow } = useCompanyDiscrepancyCheck({
    name,
    email,
    phone,
    companyName: company,
    entityType: 'lead',
    debounceMs: 500,
    enabled: open,
  });



  // Reset form on open

  useEffect(() => {

    if (open) {

      setName('');

      setSalutation('');

      setJobTitle('');

      setCompany('');

      setEmail('');

      setPhone('');

      setPan('');

      setStage(pipelineStages[0] || 'New');

      setStatus(leadStatuses[0] || 'New');

      setSource(leadSources[0] || 'Website');

      setValue('');

      setAssignedTo(
        !canAssignOthers && currentUserId
          ? currentUserId
          : assignableUsers[0]?.id || currentUserId || ''
      );

      setSelectedTags(['Inbound']);

      setAddress('');

      setCity('');

      setState('');

      setLatitude('');

      setLongitude('');

      setNotes('');

      setError(null);

      setDuplicateMatches([]);

      setContactDuplicates([]);

    }

  }, [open, pipelineStages, leadStatuses, leadSources, assignableUsers]);



  // Check lead + contact duplicates when email / phone / PAN changes

  useEffect(() => {

    if (!email && !phone && !pan) {

      setDuplicateMatches([]);

      setContactDuplicates([]);

      return;

    }

    const timer = setTimeout(async () => {

      try {

        const [leadRes, contactRes] = await Promise.all([

          crmApi.checkLeadDuplicates({

            email: email.trim() || undefined,

            phone: phone.trim() || undefined,

          }),

          crmApi.checkContactDuplicates({

            email: email.trim() || undefined,

            phone: phone.trim() || undefined,

            pan: pan.trim() || undefined,

          }),

        ]);

        setDuplicateMatches(leadRes.data?.hasDuplicate ? leadRes.data.matches : []);

        setContactDuplicates(

          Array.isArray(contactRes.data?.duplicates) ? contactRes.data.duplicates : []

        );

      } catch {

        setDuplicateMatches([]);

        setContactDuplicates([]);

      }

    }, 400);



    return () => clearTimeout(timer);

  }, [email, phone, pan]);



  const handleTagToggle = (tag: string) => {

    if (selectedTags.includes(tag)) {

      setSelectedTags(selectedTags.filter((t) => t !== tag));

    } else {

      setSelectedTags([...selectedTags, tag]);

    }

  };



  const buildLeadPayload = (

    contact: PersonContact,

    allowExactDuplicate = false

  ): LeadCreateInput => ({

    name: contact.name || name.trim(),

    contactId: contact._id,

    salutation: contact.salutation || salutation || undefined,

    jobTitle: contact.jobTitle || jobTitle.trim() || undefined,

    company: company.trim(),

    email: contact.email || email.trim(),

    phone: contact.phone || phone.trim(),

    pan: contact.pan || pan.trim() || undefined,

    stage,

    status,

    source,

    value: value ? Number(value) : 0,

    currency: settingsCurrency,

    assignedTo: canAssignOthers
      ? assignedTo || assignableUsers[0]?.id || currentUserId || ''
      : currentUserId || assignedTo || assignableUsers[0]?.id || '',

    tags: selectedTags,

    address: address.trim() || undefined,

    city: city.trim() || undefined,

    state: state.trim() || undefined,

    latitude: latitude === '' ? null : Number(latitude),

    longitude: longitude === '' ? null : Number(longitude),

    notes: notes.trim() || undefined,

    allowExactDuplicate: allowExactDuplicate || undefined,

    allowSimilarCompany: allowExactDuplicate || undefined,

    confirmDifferentCompany: (allowExactDuplicate || undefined) as boolean | undefined,

  });



  const validateBasics = (): string | null => {

    if (!name.trim()) return 'Full Name is required';

    if (!company.trim()) return 'Company Name is required';

    if (!email.trim() && !phone.trim()) return 'Either Email or Mobile Number is required';

    return null;

  };



  const finishCreate = async (

    existingContact: PersonContact | null,

    allowDuplicateContact = false

  ) => {

    const basicError = validateBasics();

    if (basicError) {

      setError(basicError);

      return;

    }

    if (!allowDuplicateContact) {
      const discCheck = await checkDiscrepancyNow();
      if (discCheck.hasDiscrepancy) {
        setShowDiscrepancyModal(true);
        return;
      }
    }

    setSaving(true);

    setError(null);

    try {

      let contact = existingContact;

      if (!contact?._id) {

        try {

          const created = await crmApi.createContact({

            name: name.trim(),

            salutation: salutation || undefined,

            jobTitle: jobTitle.trim() || undefined,

            companyName: company.trim() || undefined,

            email: email.trim() || undefined,

            phone: phone.trim() || undefined,

            pan: pan.trim() || undefined,

            allowDuplicate: allowDuplicateContact || undefined,

            confirmDifferentCompany: allowDuplicateContact || undefined,

          });

          contact = created.data || null;

        } catch (err: unknown) {

          if (err instanceof ApiError && err.status === 409 && Array.isArray(err.duplicates)) {

            setContactDuplicates(err.duplicates as PersonContact[]);

            setError(

              'Matching contact found (email / mobile / PAN). Choose existing contact or Create new lead.'

            );

            setSaving(false);

            return;

          }

          throw err;

        }

      }

      if (!contact?._id) throw new Error('Could not resolve a contact for this lead.');

      await onSubmit(

        buildLeadPayload(contact, Boolean(existingContact?._id || allowDuplicateContact))

      );

      onClose();

    } catch (err: unknown) {

      setError(err instanceof Error ? err.message : 'Failed to create lead');

    } finally {

      setSaving(false);

    }

  };



  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    setError(null);

    const basicError = validateBasics();

    if (basicError) {

      setError(basicError);

      return;

    }

    if (contactDuplicates.length > 0) {

      setError(

        'Matching contact found (email / mobile / PAN). Choose existing contact or Create new lead below.'

      );

      return;

    }

    await finishCreate(null, false);

  };



  return (
    <>
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

          <h2 className="text-base font-bold text-zinc-950 m-0">Create New Lead</h2>

          <p className="text-xs text-zinc-500 m-0 mt-0.5">

            Add a new prospect to your sales pipeline. Fields marked * are required.

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

        {/* Error message banner */}

        {error && (

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">

            {error}

          </div>

        )}



        {/* Duplicate detection warning */}

        {duplicateMatches.length > 0 && (

          <div className="p-3.5 bg-zinc-50 border border-zinc-300 rounded-lg flex items-start gap-2.5">

            <WarningAmberIcon sx={{ fontSize: 18 }} className="text-zinc-900 flex-shrink-0 mt-0.5" />

            <div className="text-xs text-zinc-900">

              <strong className="block font-semibold mb-0.5">Existing Lead Detected:</strong>

              {duplicateMatches.map((m) => (

                <div key={m._id} className="text-zinc-600">

                  ? <strong>{m.name}</strong> ({m.company}) ? {m.email || m.phone} (Stage: {m.stage})

                </div>

              ))}

              <span className="text-[11px] text-zinc-500 mt-1 block">

                You can still proceed if this is a separate inquiry or location.

              </span>

            </div>

          </div>

        )}



        {contactDuplicates.length > 0 ? (

          <ContactDuplicateBanner

            duplicates={contactDuplicates}

            busy={saving}

            actionLabel="Choose existing contact"

            createNewLabel="Create new lead"

            option1Title="Option 1 — Choose existing contact"

            option2Title="Option 2 — Create new lead"

            option2Description={
              <>
                Creates a <strong>new contact</strong> with the same email / mobile / PAN and then
                creates the lead.
              </>
            }

            onUseContact={(contact) => void finishCreate(contact, false)}

            onCreateNewLead={() => void finishCreate(null, true)}

            onDismiss={() => setContactDuplicates([])}

          />

        ) : null}



        {/* Section 1: Contact Information */}

        <div>

          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider mb-3">

            1. Contact & Identity

          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">

            <div className="sm:col-span-2">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Salutation

              </label>

              <select

                value={salutation}

                onChange={(e) => setSalutation(e.target.value)}

                className="w-full text-xs border border-zinc-300 rounded-lg px-2.5 py-2 bg-white text-zinc-900 outline-none"

              >

                <option value="">?</option>

                <option value="Mr">Mr</option>

                <option value="Ms">Ms</option>

                <option value="Mrs">Mrs</option>

                <option value="Dr">Dr</option>

                <option value="Prof">Prof</option>

              </select>

            </div>



            <div className="sm:col-span-5">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Full Name *

              </label>

              <input

                type="text"

                required

                value={name}

                onChange={(e) => setName(e.target.value)}

                placeholder="e.g. Ramesh Chandra"

                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"

              />

            </div>



            <div className="sm:col-span-5">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Company Name *

              </label>

              <input

                type="text"

                required

                value={company}

                onChange={(e) => setCompany(e.target.value)}

                placeholder="e.g. Acme Innovations Pvt Ltd"

                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"

              />

            </div>



            <div className="sm:col-span-4">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Job Title / Role

              </label>

              <input

                type="text"

                value={jobTitle}

                onChange={(e) => setJobTitle(e.target.value)}

                placeholder="e.g. Director of Operations"

                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"

              />

            </div>



            <div className="sm:col-span-4">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Email Address *

              </label>

              <input

                type="email"

                required

                value={email}

                onChange={(e) => setEmail(e.target.value)}

                placeholder="name@company.com"

                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"

              />

            </div>



            <div className="sm:col-span-4">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Mobile Number *

              </label>

              <input

                type="tel"

                required

                value={phone}

                onChange={(e) => setPhone(e.target.value)}

                placeholder="+91 98765 43210"

                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"

              />

            </div>

          </div>

        </div>



        {/* Section 2: Pipeline & Commercials */}

        <div className="pt-2 border-t border-zinc-100">

          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider mb-3">

            2. Pipeline & Ownership

          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">

            <div className="sm:col-span-3">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Pipeline Stage *

              </label>

              <select

                value={stage}

                onChange={(e) => setStage(e.target.value)}

                className="w-full text-xs border border-zinc-300 rounded-lg px-2.5 py-2 bg-white text-zinc-900 outline-none"

              >

                {pipelineStages.map((s) => (

                  <option key={s} value={s}>

                    {s}

                  </option>

                ))}

              </select>

            </div>



            <div className="sm:col-span-3">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Lead Source

              </label>

              <select

                value={source}

                onChange={(e) => setSource(e.target.value)}

                className="w-full text-xs border border-zinc-300 rounded-lg px-2.5 py-2 bg-white text-zinc-900 outline-none"

              >

                {leadSources.map((src) => (

                  <option key={src} value={src}>

                    {src}

                  </option>

                ))}

              </select>

            </div>



            <div className="sm:col-span-3">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Deal Value ({getCurrencySymbol(settingsCurrency)})

              </label>

              <input

                type="number"

                min="0"

                step="1000"

                value={value}

                onChange={(e) => setValue(e.target.value ? Number(e.target.value) : '')}

                placeholder="500000"

                className="w-full text-xs border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 outline-none focus:border-zinc-950"

              />

            </div>



            <div className="sm:col-span-3">

              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

                Assigned Rep *

              </label>

              {canAssignOthers ? (

                <select

                  value={assignedTo}

                  onChange={(e) => setAssignedTo(e.target.value)}

                  className="w-full text-xs border border-zinc-300 rounded-lg px-2.5 py-2 bg-white text-zinc-900 outline-none"

                >

                  {assignableUsers.map((u) => (

                    <option key={u.id} value={u.id}>

                      {u.displayName || u.name}

                    </option>

                  ))}

                </select>

              ) : (

                <input

                  type="text"

                  className="w-full text-xs border border-zinc-300 rounded-lg px-2.5 py-2 bg-zinc-50 text-zinc-600"

                  value="You (current user)"

                  disabled

                  readOnly

                  title="Sales representatives can only assign leads to themselves"

                />

              )}

            </div>

          </div>

        </div>



        {/* Section 3: Tags */}

        <div className="pt-2 border-t border-zinc-100">

          <label className="block text-[11px] font-semibold text-zinc-600 mb-2">

            Tags & Segmentation (Click to toggle)

          </label>

          <div className="flex flex-wrap gap-1.5">

            {leadTags.map((tag) => {

              const active = selectedTags.includes(tag);

              return (

                <button

                  key={tag}

                  type="button"

                  onClick={() => handleTagToggle(tag)}

                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${

                    active

                      ? 'bg-zinc-950 text-white border-zinc-950 font-semibold'

                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'

                  }`}

                >

                  ??? {tag}

                </button>

              );

            })}

          </div>

        </div>



        {/* Section 4: Address, Google Map & Notes */}

        <div className="pt-2 border-t border-zinc-100 flex flex-col gap-3.5">
          <LeadLocationMap
            showSearch={true}
            latitude={latitude}
            longitude={longitude}

            address={address}

            onPlaceSelect={(place) => {

              setAddress(place.address);

              if (place.city) setCity(place.city);

              if (place.state) setState(place.state);

              setLatitude(place.lat);

              setLongitude(place.lng);

            }}

            onChange={(lat, lng) => {

              setLatitude(lat);

              setLongitude(lng);

            }}

            onSettle={(lat, lng) => {

              setLatitude(lat);

              setLongitude(lng);

              void (async () => {

                try {

                  const geo = await reverseGeocode(lat, lng);

                  if (geo.addressLine) setAddress(geo.addressLine);

                  if (geo.city) setCity(geo.city);

                  if (geo.state) setState(geo.state);

                } catch {

                  // Keep coordinates; user can type address manually

                }

              })();

            }}

            height="220px"

          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

          <div>

            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

              Office / Location Address

            </label>

            <textarea

              rows={3}

              value={address}

              onChange={(e) => setAddress(e.target.value)}

              placeholder="Building, street, city, state"
              className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 bg-white text-zinc-900 outline-none focus:border-zinc-950"

            />

          </div>



          <div>

            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">

              Internal Prospect Notes

            </label>

            <textarea

              rows={3}

              value={notes}

              onChange={(e) => setNotes(e.target.value)}

              placeholder="Key requirements, client expectations, next steps"

              className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 bg-white text-zinc-900 outline-none focus:border-zinc-950"

            />

          </div>

          </div>

          {(city || state || latitude !== '' || longitude !== '') && (

            <p className="m-0 text-[11px] text-zinc-500">

              {[city, state].filter(Boolean).join(', ') || 'Pinned'}

              {latitude !== '' && longitude !== ''

                ? ` · ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
                : ''}

            </p>

          )}

        </div>



        {/* Modal Actions */}

        <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2.5">

          <button

            type="button"

            onClick={onClose}

            disabled={saving}

            className="px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"

          >

            Cancel

          </button>

          <button

            type="submit"

            disabled={saving}

            className="px-5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-xs font-semibold text-white border border-zinc-950 cursor-pointer transition-colors"

          >

            {saving ? 'Creating…' : 'Create Lead'}
          </button>

        </div>

      </form>

    </Dialog>

    <CompanyDiscrepancyModal
      open={showDiscrepancyModal}
      entityType="lead"
      discrepancy={discrepancy}
      onConfirm={() => {
        setShowDiscrepancyModal(false);
        void finishCreate(null, true);
      }}
      onCancel={() => setShowDiscrepancyModal(false)}
      loading={saving}
    />
  </>
  );

};

