import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { ApiError, crmApi } from '../../services/api';
import type { LeadItem, LeadOcrExtractResult } from '../../types/leads';
import type { RequestType } from '../../types/request-types';
import type { PersonContact, CompanyDiscrepancyDetail } from '../../types/contacts';
import { formatContactName } from '../../types/contacts';
import { ContactDuplicateBanner } from '../contacts/ContactDuplicateBanner';
import { CompanyDiscrepancyModal } from '../common/CompanyDiscrepancyModal';
import { CONTACT_EMAIL_RE, CONTACT_PHONE_RE } from '../contacts/ContactFormFields';
import { LiveCameraCapture } from '../common/LiveCameraCapture';
import { fileToVisionDataUrl } from '../../utils/imageDataUrl';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { PhoneNumberField } from '../common/PhoneNumberField';
import { splitPhoneNumber, validateNationalNumber } from '../../utils/phoneCountryCodes';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';
const MAX_BYTES = 12 * 1024 * 1024;

type Step = 'pick' | 'ai' | 'review' | 'creating' | 'done' | 'error';

class ExistingContactConflictError extends Error {
  duplicates: PersonContact[];
  constructor(duplicates: PersonContact[]) {
    super('This visiting card matches a contact that already exists.');
    this.name = 'ExistingContactConflictError';
    this.duplicates = duplicates;
  }
}

export interface VisitingCardLeadCaptureModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a lead is created successfully. */
  onLeadCreated?: (lead: LeadItem) => void;
  /** Navigate to the new lead detail page. */
  onOpenLead?: (lead: LeadItem) => void;
}

interface DraftFields {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  jobRole: string;
  salutation: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  leadType: string;
  requestTypeId: string;
  requestTypeName: string;
  stage: string;
}

const emptyDraft = (): DraftFields => ({
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  jobRole: '',
  salutation: '',
  gender: '',
  address: '',
  city: '',
  state: '',
  leadType: '',
  requestTypeId: '',
  requestTypeName: 'Project (software)',
  stage: 'New',
});

function findSoftwareRequestType(requestTypes: RequestType[]): RequestType | null {
  return (
    requestTypes.find((rt) => String(rt.key || '').toLowerCase() === 'project_software') ||
    requestTypes.find((rt) => {
      const name = String(rt.name || '').toLowerCase();
      return name.includes('software') || name === 'project (software)';
    }) ||
    null
  );
}

function draftFromExtract(
  data: LeadOcrExtractResult,
  requestTypes: RequestType[],
  stages: string[]
): DraftFields {
  const software = findSoftwareRequestType(requestTypes);
  const guessedRt =
    (data.requestTypeId && requestTypes.find((rt) => rt._id === data.requestTypeId)) ||
    (data.requestType &&
      requestTypes.find(
        (rt) => rt.name.toLowerCase() === String(data.requestType).toLowerCase()
      )) ||
    null;
  // Prefer confident AI guess; otherwise default to Project (software).
  const rt = guessedRt || software || requestTypes[0] || null;
  const stage = stages.includes('New') ? 'New' : stages[0] || 'New';

  return {
    companyName: String(data.companyName || '').trim(),
    contactName: String(data.contactName || '').trim(),
    email: String(data.email || '').trim().toLowerCase(),
    phone: String(data.phone || '').trim(),
    jobRole: String(data.jobRole || '').trim(),
    salutation: String(data.salutation || '').trim(),
    gender: String(data.gender || '').trim(),
    address: String(data.address || '').trim(),
    city: String(data.city || '').trim(),
    state: String(data.state || '').trim(),
    leadType: String(data.leadType || '').trim() || 'Organizational',
    requestTypeId: rt?._id || '',
    requestTypeName: rt?.name || 'Project (software)',
    stage,
  };
}

function validateDraft(d: DraftFields): string | null {
  if (!d.companyName.trim()) return 'Company name is required.';
  if (!d.contactName.trim()) return 'Contact name is required.';
  if (!d.email.trim()) return 'Email is required to create the lead.';
  if (!CONTACT_EMAIL_RE.test(d.email.trim())) return 'Enter a valid email address.';
  const phone = d.phone.replace(/[\s().-]/g, '');
  if (!phone) return 'Mobile number is required to create the lead.';
  const split = splitPhoneNumber(d.phone);
  if (split.dial && split.national) {
    const check = validateNationalNumber(split.dial, split.national);
    if (check.state === 'invalid' || check.state === 'incomplete') return check.message;
  } else if (!CONTACT_PHONE_RE.test(phone)) {
    return 'Enter a valid mobile number (7–15 digits).';
  }
  if (!d.requestTypeId.trim()) return 'Request Type could not be resolved (expected Project (software)).';
  if (!d.stage.trim()) return 'Stage is required.';
  return null;
}

const inputCls =
  'w-full h-9 border border-zinc-300 rounded-lg px-2.5 bg-white text-xs text-zinc-900 outline-none focus:border-zinc-950';
const labelCls = 'block text-[11px] font-semibold text-zinc-600 mb-1';

export const VisitingCardLeadCaptureModal: React.FC<VisitingCardLeadCaptureModalProps> = ({
  open,
  onClose,
  onLeadCreated,
  onOpenLead,
}) => {
  const settingsCurrency = useDefaultCurrency();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [draft, setDraft] = useState<DraftFields>(emptyDraft());
  const [createdLead, setCreatedLead] = useState<LeadItem | null>(null);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [stages, setStages] = useState<string[]>(['New']);
  const [existingContacts, setExistingContacts] = useState<PersonContact[]>([]);
  const [selectedExistingContact, setSelectedExistingContact] = useState<PersonContact | null>(
    null
  );
  const [discrepancy, setDiscrepancy] = useState<CompanyDiscrepancyDetail | null>(null);
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    clearPreview();
    setStep('pick');
    setStatusText('');
    setError(null);
    setBusy(false);
    setDraft(emptyDraft());
    setCreatedLead(null);
    setLiveCameraOpen(false);
    setExistingContacts([]);
    setSelectedExistingContact(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }, [clearPreview]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }

    void (async () => {
      try {
        const [rtRes, pipeRes] = await Promise.allSettled([
          crmApi.listRequestTypes({ enabledOnly: true }),
          crmApi.getPipeline(),
        ]);
        const rts =
          rtRes.status === 'fulfilled' && Array.isArray(rtRes.value.data) ? rtRes.value.data : [];
        setRequestTypes(rts);
        const stageList =
          pipeRes.status === 'fulfilled'
            ? (Array.isArray(pipeRes.value.data?.pipeline_stages)
                ? pipeRes.value.data.pipeline_stages.map((s: unknown) => String(s || '').trim())
                : []
              ).filter(Boolean)
            : [];
        setStages(stageList.length ? stageList : ['New']);
      } catch {
        setRequestTypes([]);
        setStages(['New']);
      }
    })();
  }, [open, reset]);

  useEffect(() => () => clearPreview(), [clearPreview]);

  const onPickFile = (chosen: File | null) => {
    setError(null);
    setCreatedLead(null);
    setExistingContacts([]);
    setSelectedExistingContact(null);
    if (!chosen) return;
    if (!chosen.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WEBP, or GIF).');
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setError('Image must be 12 MB or smaller.');
      return;
    }
    clearPreview();
    const url = URL.createObjectURL(chosen);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(chosen);
    setStep('pick');
    setDraft(emptyDraft());
  };

  const findExistingContacts = async (fields: DraftFields): Promise<PersonContact[]> => {
    const email = fields.email.trim();
    const phone = fields.phone.replace(/[\s().-]/g, '');
    if (!email && !phone) return [];
    try {
      const res = await crmApi.checkContactDuplicates({
        email: email || undefined,
        phone: phone || undefined,
      });
      return Array.isArray(res.data?.duplicates) ? res.data.duplicates : [];
    } catch {
      return [];
    }
  };

  const enterExistingContactReview = (fields: DraftFields, duplicates: PersonContact[]) => {
    setDraft(fields);
    setExistingContacts(duplicates);
    setSelectedExistingContact(null);
    setStep('review');
    setStatusText('');
    setError(null);
  };

  const createLeadFromDraft = async (
    fields: DraftFields,
    existingContact: PersonContact | null = null,
    options: { allowDuplicateContact?: boolean } = {}
  ): Promise<LeadItem> => {
    const validationError = validateDraft(fields);
    if (validationError) {
      throw new Error(validationError);
    }

    let contact: PersonContact | null = existingContact;
    const allowDuplicateContact = Boolean(options.allowDuplicateContact);

    if (!contact?._id) {
      if (!allowDuplicateContact) {
        const matches = await findExistingContacts(fields);
        if (matches.length) {
          throw new ExistingContactConflictError(matches);
        }
      }

      try {
        const created = await crmApi.createContact({
          salutation: fields.salutation || undefined,
          name: fields.contactName.trim(),
          companyName: fields.companyName.trim() || undefined,
          email: fields.email.trim(),
          phone: fields.phone.replace(/[\s().-]/g, ''),
          gender: fields.gender || undefined,
          jobTitle: fields.jobRole || undefined,
          allowDuplicate: allowDuplicateContact || undefined,
          confirmDifferentCompany: allowDuplicateContact || undefined,
        });
        contact = created.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 409 && Array.isArray(err.duplicates)) {
          throw new ExistingContactConflictError(err.duplicates as PersonContact[]);
        }
        throw err;
      }
    }

    if (!contact?._id) {
      throw new Error('Could not create or match a contact for this card.');
    }

    const company = fields.companyName.trim();
    try {
      await crmApi.addLeadSource('OCR');
    } catch {
      // Source catalog update is best-effort; lead create still uses source OCR.
    }
    const reused = Boolean(existingContact?._id);
    const leadRes = await crmApi.createLead({
      title: `Inquiry from ${company}`,
      contactId: contact._id,
      name: contact.name || fields.contactName.trim(),
      email: contact.email || fields.email.trim(),
      phone: contact.phone || fields.phone.replace(/[\s().-]/g, ''),
      salutation: fields.salutation || contact.salutation || undefined,
      jobTitle: fields.jobRole || contact.jobTitle || undefined,
      gender: fields.gender || contact.gender || undefined,
      company,
      stage: fields.stage || 'New',
      status: 'New',
      source: 'OCR',
      leadType: fields.leadType || 'Organizational',
      requestType: fields.requestTypeName || 'Project (software)',
      requestTypeId: fields.requestTypeId.startsWith('legacy_') ? null : fields.requestTypeId,
      value: 0,
      currency: settingsCurrency,
      tags: ['Inbound'],
      address: fields.address || undefined,
      city: fields.city || undefined,
      state: fields.state || undefined,
      notes: reused
        ? 'Created from visiting card scan using an existing contact (Groq vision AI).'
        : allowDuplicateContact
          ? 'Created from visiting card with a new contact (duplicate email/mobile allowed).'
          : 'Created automatically from visiting card photo (Groq vision AI).',
      // Same person can have multiple leads when reusing contact / allowing duplicate contact.
      allowExactDuplicate: reused || allowDuplicateContact || undefined,
      allowSimilarCompany: reused || allowDuplicateContact || undefined,
      confirmDifferentCompany: (reused || allowDuplicateContact || undefined) as boolean | undefined,
    });

    if (!leadRes.data) {
      throw new Error(leadRes.error || 'Lead creation returned no data');
    }
    return leadRes.data;
  };

  const finishLeadCreate = async (
    fields: DraftFields,
    existingContact: PersonContact | null,
    options: { allowDuplicateContact?: boolean } = {}
  ) => {
    setBusy(true);
    setError(null);
    try {
      setStep('creating');
      setStatusText(
        existingContact
          ? 'Creating lead with selected existing contact…'
          : options.allowDuplicateContact
            ? 'Creating new contact and lead…'
            : 'Creating lead…'
      );
      const lead = await createLeadFromDraft(fields, existingContact, options);
      const leadId = (lead as any)?._id || (lead as any)?.id;
      if (file && leadId) {
        try {
          setStatusText('Saving visiting card image to storage…');
          const uploadRes = await crmApi.uploadLeadAttachment(leadId, file, { category: 'visiting-card' });
          const uploadedUrl = (uploadRes.data as any)?.fileUrl;
          if (uploadedUrl) {
            lead.visitingCardUrl = uploadedUrl;
            if (!lead.photoUrl) lead.photoUrl = uploadedUrl;
          }
        } catch (uploadErr) {
          console.warn('Visiting card image upload failed:', uploadErr);
        }
      }
      setCreatedLead(lead);
      setExistingContacts([]);
      setSelectedExistingContact(null);
      setStep('done');
      setStatusText('Lead created from visiting card.');
      onLeadCreated?.(lead);
    } catch (err: unknown) {
      if (err instanceof ExistingContactConflictError) {
        enterExistingContactReview(fields, err.duplicates);
        return;
      }
      setStep('review');
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to create lead'
      );
    } finally {
      setBusy(false);
    }
  };

  const runScanAndCreate = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setCreatedLead(null);
    setExistingContacts([]);
    setSelectedExistingContact(null);
    let workingDraft = draft;

    try {
      setStep('ai');
      setStatusText('Preparing image for Groq vision…');
      const imageDataUrl = await fileToVisionDataUrl(file);

      setStatusText('Reading visiting card with Groq AI (vision)…');
      const res = await crmApi.extractLeadFromOcr({ imageDataUrl });
      const extracted = res.data;
      if (!extracted) {
        throw new Error(res.error || 'AI extraction returned no data');
      }

      workingDraft = draftFromExtract(extracted, requestTypes, stages);
      setDraft(workingDraft);

      const missing = validateDraft(workingDraft);
      if (missing) {
        setStep('review');
        setStatusText('Review & complete required fields, then create the lead.');
        setError(missing);
        return;
      }

      setStatusText('Checking for company discrepancy & existing contacts…');
      const discRes = await crmApi.checkCompanyDiscrepancy({
        name: workingDraft.contactName,
        email: workingDraft.email,
        phone: workingDraft.phone,
        companyName: workingDraft.companyName,
        entityType: 'lead',
      });
      if (discRes.data?.hasDiscrepancy && discRes.data.discrepancy) {
        setDiscrepancy(discRes.data.discrepancy);
        setShowDiscrepancyModal(true);
        setStep('review');
        setBusy(false);
        return;
      }

      const matches = await findExistingContacts(workingDraft);
      if (matches.length) {
        enterExistingContactReview(workingDraft, matches);
        return;
      }

      await finishLeadCreate(workingDraft, null);
      return;
    } catch (err: unknown) {
      if (err instanceof ExistingContactConflictError) {
        enterExistingContactReview(workingDraft, err.duplicates);
        return;
      }
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to create lead from visiting card';
      // Prefer review so missing email/phone can be completed after a partial extract.
      setStep('review');
      setError(msg);
      setStatusText('');
    } finally {
      setBusy(false);
    }
  };

  const confirmCreateFromReview = async () => {
    if (busy) return;

    if (existingContacts.length > 0 && !selectedExistingContact?._id) {
      setError(
        'Matching contact found. Choose existing contact or Create new lead from the options below.'
      );
      return;
    }

    if (!selectedExistingContact?._id) {
      const discRes = await crmApi.checkCompanyDiscrepancy({
        name: draft.contactName,
        email: draft.email,
        phone: draft.phone,
        companyName: draft.companyName,
        entityType: 'lead',
      });
      if (discRes.data?.hasDiscrepancy && discRes.data.discrepancy) {
        setDiscrepancy(discRes.data.discrepancy);
        setShowDiscrepancyModal(true);
        return;
      }
    }

    await finishLeadCreate(draft, selectedExistingContact);
  };

  const handleConfirmDiscrepancyLeadCreate = async () => {
    setShowDiscrepancyModal(false);
    await finishLeadCreate(draft, null, { allowDuplicateContact: true });
  };

  const handleCancelDiscrepancyLeadCreate = () => {
    setShowDiscrepancyModal(false);
  };

  const handleChooseExistingAndCreate = async (contact: PersonContact) => {
    if (busy) return;
    setSelectedExistingContact(contact);
    setDraft((prev) => ({
      ...prev,
      contactName: contact.name || prev.contactName,
      email: contact.email || prev.email,
      phone: contact.phone || prev.phone,
      jobRole: contact.jobTitle || prev.jobRole,
      salutation: contact.salutation || prev.salutation,
      gender: contact.gender || prev.gender,
    }));
    await finishLeadCreate(
      {
        ...draft,
        contactName: contact.name || draft.contactName,
        email: contact.email || draft.email,
        phone: contact.phone || draft.phone,
        jobRole: contact.jobTitle || draft.jobRole,
        salutation: contact.salutation || draft.salutation,
        gender: contact.gender || draft.gender,
      },
      contact
    );
  };

  const handleCreateNewLeadDespiteDuplicate = async () => {
    if (busy) return;
    await finishLeadCreate(draft, null, { allowDuplicateContact: true });
  };

  const updateDraft = (patch: Partial<DraftFields>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setError(null);
    // Editing card fields may invalidate a prior existing-contact match.
    if (existingContacts.length || selectedExistingContact) {
      setExistingContacts([]);
      setSelectedExistingContact(null);
    }
  };

  const createLeadDisabled =
    busy || (existingContacts.length > 0 && !selectedExistingContact?._id);

  return (
    <>
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'rounded-xl! border border-zinc-300 shadow-xl',
        sx: { m: 2, maxHeight: '92vh' },
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
            <PhotoCameraOutlinedIcon sx={{ fontSize: 20 }} />
          </span>
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-bold text-zinc-950">Scan visiting card</h2>
            <p className="m-0 mt-0.5 text-[11px] text-zinc-500">
              Take a photo → Groq vision AI → create lead automatically (Stage: New · Request Type:
              Project (software))
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          aria-label="Close"
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
        <input
          ref={galleryInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] || null)}
        />

        {step !== 'done' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setLiveCameraOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-950 bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              <PhotoCameraOutlinedIcon sx={{ fontSize: 18 }} />
              Take photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
            >
              <PhotoLibraryOutlinedIcon sx={{ fontSize: 18 }} />
              Choose image
            </button>
          </div>
        )}

        {previewUrl ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <img
              src={previewUrl}
              alt="Visiting card preview"
              className="max-h-44 max-w-full rounded-lg border border-zinc-200 object-contain bg-white"
            />
            <p className="m-0 text-[11px] text-zinc-500 truncate max-w-full">{file?.name}</p>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
            <PhotoCameraOutlinedIcon sx={{ fontSize: 36 }} className="text-zinc-400" />
            <p className="m-0 mt-2 text-xs font-semibold text-zinc-800">
              Photograph the visiting card
            </p>
            <p className="m-0 mt-1 text-[11px] text-zinc-500">
              “Take photo” opens your live camera (with permission). Clear, well-lit cards work best.
            </p>
          </div>
        )}

        {(step === 'ai' || step === 'creating') && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800">
              <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              <span>{statusText || 'Working…'}</span>
            </div>
          </div>
        )}

        {(step === 'review' || (step === 'error' && draft.companyName)) && (
          <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
            <p className="m-0 text-[11px] font-semibold text-zinc-700">
              {existingContacts.length
                ? 'This visiting card matches an existing contact. Select it below, then create the lead.'
                : 'Complete required fields, then create the lead. Defaults: Stage = New, Request Type = Project (software).'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className={labelCls}>Company Name *</span>
                <input
                  className={inputCls}
                  value={draft.companyName}
                  onChange={(e) => updateDraft({ companyName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Contact Name *</span>
                <input
                  className={inputCls}
                  value={draft.contactName}
                  onChange={(e) => updateDraft({ contactName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Job role</span>
                <input
                  className={inputCls}
                  value={draft.jobRole}
                  onChange={(e) => updateDraft({ jobRole: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Email *</span>
                <input
                  type="email"
                  className={inputCls}
                  value={draft.email}
                  onChange={(e) => updateDraft({ email: e.target.value })}
                />
              </label>
              <div className="block">
                <span className={labelCls}>Mobile *</span>
                <PhoneNumberField
                  value={draft.phone}
                  onChange={(val) => updateDraft({ phone: val })}
                  inputClassName={inputCls}
                  placeholder="98765 43210"
                />
              </div>
              <label className="block">
                <span className={labelCls}>Stage</span>
                <input className={inputCls} value={draft.stage} readOnly />
              </label>
              <label className="block">
                <span className={labelCls}>Request Type</span>
                <input className={inputCls} value={draft.requestTypeName} readOnly />
              </label>
            </div>
          </div>
        )}

        {step === 'review' && existingContacts.length > 0 ? (
          <ContactDuplicateBanner
            duplicates={existingContacts}
            title="Matching contact found"
            description={
              <>
                Same email or mobile already exists. Choose <strong>existing contact</strong> or{' '}
                <strong>Create new lead</strong> — either option creates the lead.
              </>
            }
            actionLabel="Choose existing contact"
            createNewLabel="Create new lead"
            option1Title="Option 1 — Choose existing contact"
            option2Title="Option 2 — Create new lead"
            busy={busy}
            onUseContact={(contact) => void handleChooseExistingAndCreate(contact)}
            onCreateNewLead={() => void handleCreateNewLeadDespiteDuplicate()}
            onDismiss={() => {
              setExistingContacts([]);
              setSelectedExistingContact(null);
            }}
          />
        ) : null}

        {selectedExistingContact && step === 'creating' ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
            <div className="font-semibold">Using existing contact</div>
            <p className="m-0 mt-1">
              {formatContactName(selectedExistingContact) || selectedExistingContact.name}
              {selectedExistingContact.email ? ` · ${selectedExistingContact.email}` : ''}
              {selectedExistingContact.phone ? ` · ${selectedExistingContact.phone}` : ''}
            </p>
          </div>
        ) : null}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {step === 'done' && createdLead && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
              Lead created
            </div>
            <p className="m-0 mt-1.5">
              <strong>{createdLead.title || createdLead.name}</strong>
              {createdLead.company ? ` · ${createdLead.company}` : ''}
            </p>
            <p className="m-0 mt-1 text-[11px] text-emerald-800/80">
              Stage: {createdLead.stage || 'New'} · Request:{' '}
              {createdLead.requestType || draft.requestTypeName || 'Project (software)'}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="h-[34px] rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
        >
          {step === 'done' ? 'Close' : 'Cancel'}
        </button>
        {step === 'review' ? (
          <button
            type="button"
            disabled={createLeadDisabled}
            onClick={() => void confirmCreateFromReview()}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            title={
              existingContacts.length > 0 && !selectedExistingContact
                ? 'Select an existing contact first'
                : undefined
            }
          >
            <AutoAwesomeIcon sx={{ fontSize: 15 }} />
            {busy
              ? 'Creating…'
              : selectedExistingContact
                ? 'Create lead with existing contact'
                : 'Create lead'}
          </button>
        ) : step !== 'done' ? (
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => void runScanAndCreate()}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
          >
            <AutoAwesomeIcon sx={{ fontSize: 15 }} />
            {busy ? 'Processing…' : 'Scan & create lead'}
          </button>
        ) : createdLead?._id ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLead?.(createdLead);
            }}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
          >
            Open lead
          </button>
        ) : null}
      </div>
    </Dialog>

    <LiveCameraCapture
      open={liveCameraOpen}
      onClose={() => setLiveCameraOpen(false)}
      onCapture={(captured) => onPickFile(captured)}
      title="Photograph visiting card"
      hint="Allow camera access, frame the card clearly, then tap Capture."
    />

    <CompanyDiscrepancyModal
      open={showDiscrepancyModal}
      entityType="lead"
      discrepancy={discrepancy}
      onConfirm={() => void handleConfirmDiscrepancyLeadCreate()}
      onCancel={handleCancelDiscrepancyLeadCreate}
      loading={busy}
    />
    </>
  );
};
