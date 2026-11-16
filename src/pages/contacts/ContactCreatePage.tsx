import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DocumentScannerOutlinedIcon from '@mui/icons-material/DocumentScannerOutlined';

import { useAuth } from '../../context/AuthContext';
import { useNotifyMessage, notify } from '@/components/notifications';
import { ClientCompanyMatchModal } from '../../components/leads/ClientCompanyMatchModal';
import { useExistingClientMatch } from '../../hooks/useExistingClientMatch';
import { ApiError, crmApi } from '../../services/api';
import { PersonContact } from '../../types/contacts';
import type { LeadOcrExtractResult } from '../../types/leads';
import {
  ContactFormFields,
  ContactFormValues,
  EMPTY_CONTACT_FORM,
  contactFormToInput,
  validateContactForm,
} from '../../components/contacts/ContactFormFields';
import { ContactDuplicateBanner } from '../../components/contacts/ContactDuplicateBanner';
import { useContactDuplicates } from '../../components/contacts/useContactDuplicates';
import { useCompanyDiscrepancyCheck } from '../../hooks/useCompanyDiscrepancyCheck';
import { CompanyDiscrepancyModal } from '../../components/common/CompanyDiscrepancyModal';
import { OcrLeadImportModal } from '../../components/leads/OcrLeadImportModal';

function safeReturnPath(raw: string | null): string | null {
  const value = String(raw || '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export const ContactCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const { hasAnyPermission } = useAuth();
  const canWrite = hasAnyPermission('crm.contacts.write', 'crm.leads.write');

  const [values, setValues] = useState<ContactFormValues>({ ...EMPTY_CONTACT_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useNotifyMessage(error, 'error', () => setError(null));
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);

  const { duplicates, setDuplicates, checkValues, clear, checking } = useContactDuplicates();

  /**
   * CRM 3.48.0: the shared Existing Client Found flow — the typed company is an existing Client.
   * Not asked when this form was opened from a client (the contact is being added to that client anyway).
   * The resume step remembers how the user was creating: normal, duplicate kept, or different company.
   */
  type CreateStep = 'normal' | 'duplicate' | 'differentCompany';
  const clientMatch = useExistingClientMatch<CreateStep>();
  const askForClient = !(returnTo && returnTo.startsWith('/clients/'));

  // Debounced check for company discrepancy (different company but same email / phone / name)
  const { discrepancy, checkNow, clear: clearDiscrepancy } = useCompanyDiscrepancyCheck({
    name: values.name,
    email: values.email,
    phone: values.phone,
    companyName: values.companyName,
    entityType: 'contact',
    debounceMs: 500,
  });

  const patch = (next: Partial<ContactFormValues>) => setValues((prev) => ({ ...prev, ...next }));

  const goAfterCreate = (contactId: string) => {
    if (returnTo) {
      const join = returnTo.includes('?') ? '&' : '?';
      navigate(`${returnTo}${join}linkContact=${encodeURIComponent(contactId)}`);
      return;
    }
    navigate(`/contacts/${contactId}`);
  };

  /** Option 1 — use / open the matching existing contact (no new record). */
  const handleUseExisting = (contact: PersonContact) => {
    clear();
    clearDiscrepancy();
    setError(null);
    goAfterCreate(contact._id);
  };

  const createContact = async (allowDuplicate: boolean, confirmDifferentCompany = false) => {
    setError(null);
    if (!canWrite) {
      setError('You do not have permission to create contacts.');
      return;
    }
    const validationError = validateContactForm(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    const step: CreateStep = confirmDifferentCompany ? 'differentCompany' : allowDuplicate ? 'duplicate' : 'normal';
    if (askForClient && (await clientMatch.ask({ company: values.companyName.trim() }, step))) return;
    setSaving(true);
    try {
      const created = await crmApi.createContact({
        ...contactFormToInput(values),
        allowDuplicate: allowDuplicate || undefined,
        confirmDifferentCompany: confirmDifferentCompany || undefined,
      });
      clear();
      clearDiscrepancy();
      goAfterCreate(created.data._id);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409 && Array.isArray(err.duplicates)) {
        setDuplicates(err.duplicates as PersonContact[]);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create contact');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check company discrepancy first (same email/phone/name with different company name)
    const discCheck = await checkNow();
    if (discCheck.hasDiscrepancy) {
      setShowDiscrepancyModal(true);
      return;
    }

    if (duplicates.length) {
      setError(null);
      return;
    }
    await createContact(false);
  };

  const handleConfirmDiscrepancyCreate = async () => {
    setShowDiscrepancyModal(false);
    await createContact(true, true);
  };

  const handleCancelDiscrepancyCreate = () => {
    setShowDiscrepancyModal(false);
  };

  const handleOcrExtracted = (extracted: LeadOcrExtractResult) => {
    setShowOcrModal(false);
    const nextName = extracted.contactName || values.name;
    const nextCompany = extracted.companyName || values.companyName;
    const nextEmail = extracted.email || values.email;
    const nextPhone = extracted.phone || values.phone;
    patch({
      name: nextName,
      companyName: nextCompany,
      email: nextEmail,
      phone: nextPhone,
      jobTitle: extracted.jobRole || values.jobTitle,
      salutation: extracted.salutation || values.salutation,
      gender: extracted.gender || values.gender,
    });

    // Run duplicate check on prefilled OCR values
    void checkNow({
      name: nextName,
      companyName: nextCompany,
      email: nextEmail,
      phone: nextPhone,
    }).then((res) => {
      if (res.hasDiscrepancy) {
        setShowDiscrepancyModal(true);
      }
    });
  };

  const handleClientMatchContinue = () => {
    const step = clientMatch.continueAnyway();
    if (step === 'normal') void createContact(false);
    else if (step === 'duplicate') void createContact(true);
    else if (step === 'differentCompany') void createContact(true, true);
  };

  /** "Add as Secondary Contact": the contact (reused when it already exists once) joins the existing Client. */
  const handleClientMatchAddSecondary = async () => {
    const match = clientMatch.selected;
    if (!match || !match.canAddContact || clientMatch.busy) return;
    const keepDuplicate = clientMatch.resume === 'duplicate' || clientMatch.resume === 'differentCompany';
    clientMatch.setBusy(true);
    clientMatch.setError(null);
    try {
      const res = await crmApi.addSecondaryClientContact(match.id, {
        ...contactFormToInput(values),
        // The user already chose to keep a duplicate; otherwise one existing contact is reused.
        allowDuplicate: keepDuplicate,
        reuseExisting: !keepDuplicate,
        source: 'contact',
      });
      const clientName = res.data?.client?.name || match.name;
      const personName = res.data?.contact?.name || values.name;
      notify.success(
        res.data?.alreadyLinked
          ? `${personName} is already a contact of ${clientName}.`
          : `${personName} was added to ${clientName} as a Secondary Contact.`
      );
      clientMatch.close();
      clear();
      clearDiscrepancy();
      navigate(`/clients/${encodeURIComponent(match.id)}?tab=contacts`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409 && Array.isArray(err.duplicates)) {
        // Several contacts match: the duplicate banner lets the user pick one (or keep a new one).
        clientMatch.close();
        setDuplicates(err.duplicates as PersonContact[]);
      } else {
        clientMatch.setError(err instanceof Error ? err.message : 'Failed to add the contact to the client');
      }
    } finally {
      clientMatch.setBusy(false);
    }
  };

  /** Option 2 — force create a new contact with the same email / phone / PAN. */
  const handleAddAsNewContact = async () => {
    await createContact(true);
  };

  const backTo = returnTo || '/contacts';
  const backLabel = returnTo?.includes('/clients/') ? 'Back to client' : 'Back to contacts';

  if (!canWrite) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-10 text-center max-w-lg mx-auto">
        <p className="text-sm font-semibold text-red-700 m-0 mb-2">Permission denied</p>
        <p className="text-xs text-zinc-500 m-0 mb-4">
          You need <code className="text-[11px]">crm.contacts.write</code> or{' '}
          <code className="text-[11px]">crm.leads.write</code> to create contacts.
        </p>
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 no-underline"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          {backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div
      data-tour="contacts-create-form"
      className="flex w-full flex-col gap-6 pb-16 font-sans max-w-3xl"
    >
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Link to="/dashboard" className="text-zinc-600 hover:text-zinc-950 no-underline">
            CRM
          </Link>
          <span>/</span>
          <Link to="/contacts" className="text-zinc-600 hover:text-zinc-950 no-underline">
            Contacts
          </Link>
          <span>/</span>
          <span className="font-semibold text-zinc-950">New Contact</span>
        </div>
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 no-underline"
        >
          <ArrowBackIcon sx={{ fontSize: 15 }} />
          <span>{backLabel}</span>
        </Link>
      </div>

      <div className="bg-white border border-zinc-300 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            New Contact
          </span>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight m-0">Create Contact</h1>
          <p className="text-xs text-zinc-500 m-0 mt-0.5">
            Add a person once and reuse them across leads and clients. Fields marked * are required.
          </p>
        </div>
        <button
          type="button"
          data-tour="contacts-create-ocr"
          onClick={() => setShowOcrModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 shadow-sm shrink-0 cursor-pointer"
        >
          <DocumentScannerOutlinedIcon sx={{ fontSize: 16 }} />
          <span>Scan Visiting Card (OCR)</span>
        </button>
      </div>

      <ContactDuplicateBanner
        duplicates={duplicates}
        checking={checking}
        busy={saving}
        onUseContact={handleUseExisting}
        onCreateNewLead={() => void handleAddAsNewContact()}
        actionLabel="Use existing contact"
        createNewLabel="Add as new contact"
        option1Title="Option 1 — Use existing contact"
        option2Title="Option 2 — Add as new contact"
        option2Description={
          <>
            Creates a <strong>new contact</strong> with the same email / mobile / PAN (duplicate
            allowed).
          </>
        }
        title="Matching contact found"
        description={
          <>
            Same <strong>email</strong>, <strong>mobile</strong> or <strong>PAN</strong> already
            exists. Use the existing contact, or add this as a new contact.
          </>
        }
        onDismiss={clear}
      />

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
        <section
          data-tour="contacts-create-fields"
          className="bg-white border border-zinc-300 rounded-xl p-6"
        >
          <ContactFormFields
            values={values}
            onChange={patch}
            disabled={saving}
            onFieldBlur={(vals) => void checkValues(vals)}
            onUploadError={setError}
            tourPrefix="contacts-create"
          />
        </section>

        <div data-tour="contacts-create-actions" className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="px-5 py-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-xs font-semibold text-white border border-zinc-950 cursor-pointer"
          >
            {saving ? 'Creating…' : duplicates.length ? 'Resolve match above' : 'Create Contact'}
          </button>
        </div>
      </form>

      {/* Discrepancy Confirmation Modal (Different Company with Same Email/Phone/Name) */}
      <CompanyDiscrepancyModal
        open={showDiscrepancyModal}
        entityType="contact"
        discrepancy={discrepancy}
        onConfirm={() => void handleConfirmDiscrepancyCreate()}
        onCancel={handleCancelDiscrepancyCreate}
        loading={saving}
      />
      <ClientCompanyMatchModal
        open={clientMatch.open}
        matches={clientMatch.matches}
        selectedId={clientMatch.selectedId}
        onSelect={clientMatch.select}
        onAddSecondary={() => void handleClientMatchAddSecondary()}
        onContinueLead={handleClientMatchContinue}
        onClose={clientMatch.close}
        loading={clientMatch.busy}
        error={clientMatch.error}
        continueLabel="Continue Creating Contact"
        addNote="the contact is saved (an existing one with the same email / mobile / PAN is reused) and joins this client as a Secondary Contact. No client is created."
        continueNote="the same name does not always mean the same client. The contact is created as usual, without a client."
        newContact={{ name: values.name, email: values.email, phone: values.phone }}
      />

      {/* OCR Scan Visiting Card Modal */}
      <OcrLeadImportModal
        open={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onExtracted={handleOcrExtracted}
      />
    </div>
  );
};
