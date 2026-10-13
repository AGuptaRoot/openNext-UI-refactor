/**
 * PersonContact — standalone CRM contact directory used by Leads.
 * Distinct from client-company contacts (`ClientContact`).
 */

export const CONTACT_SALUTATIONS = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'] as const;
export const CONTACT_GENDERS = ['', 'Male', 'Female', 'Other', 'Prefer not to say'] as const;

export interface PersonContact {
  _id: string;
  tenantId?: string;
  salutation?: string;
  /** Contact full name */
  name: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  gender?: string;
  pan?: string;
  companyName?: string;
  jobTitle?: string;
  /** Ids of leads linked to this contact */
  leadIds?: string[];
  leadsCount?: number;
  /** Ids of client companies linked to this contact */
  clientIds?: string[];
  clientsCount?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonContactInput {
  salutation?: string;
  name: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  gender?: string;
  pan?: string;
  companyName?: string;
  jobTitle?: string;
  /** Skip duplicate detection on the server (explicit override only). */
  allowDuplicate?: boolean;
  /** Explicitly confirmed creation when company differs but contact info matches. */
  confirmDifferentCompany?: boolean;
}

export interface PersonContactQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  /** When set, only contacts linked to this lead are returned. */
  leadId?: string;
  /** When set, only contacts related to this client (via converted leads) are returned. */
  clientId?: string;
}

export interface PersonContactPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PersonContactDuplicateQuery {
  email?: string;
  phone?: string;
  pan?: string;
  excludeId?: string;
}

export interface PersonContactDuplicateResult {
  duplicates: PersonContact[];
  isDuplicate: boolean;
}

export interface CompanyDiscrepancyDetail {
  matchedField: 'email' | 'phone' | 'name';
  matchedValue: string;
  existingCompany: string;
  newCompany: string;
  existingRecordName: string;
  entityType: 'lead' | 'contact';
  recordId?: string;
}

export interface CompanyDiscrepancyResult {
  hasDiscrepancy: boolean;
  discrepancy?: CompanyDiscrepancyDetail | null;
}

export interface SameCompanyLeadItem {
  _id: string;
  id: string;
  title: string;
  name?: string;
  company: string;
  stage?: string;
  status?: string;
  value?: number;
  email?: string;
  phone?: string;
  contactId?: string;
  createdAt?: string;
  isDirectlyLinked: boolean;
}

export interface ContactCompanyLeadsResult {
  company: string;
  items: SameCompanyLeadItem[];
  total: number;
}

/** Display helper: "Mr John Doe" */
export function formatContactName(contact?: Pick<PersonContact, 'salutation' | 'name'> | null): string {
  if (!contact) return '';
  return [contact.salutation, contact.name].filter(Boolean).join(' ').trim();
}
