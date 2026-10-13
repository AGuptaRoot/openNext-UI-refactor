import {
  ClientItem,
  ClientContact,
  ClientNote,
  ClientEvent,
  ClientAddress,
  ClientDocument,
  ClientPortalAccess,
  ClientRelatedProject,
  ClientRelatedTask,
  ClientRelatedQuotation,
  ClientRelatedInvoice,
  ClientRelatedPayment,
  ClientCustomFieldDef,
  DEFAULT_CLIENT_CUSTOM_FIELDS,
} from '../types/clients';

export const INITIAL_MOCK_CLIENTS: ClientItem[] = [
  {
    _id: 'client_1',
    name: 'Acme Corporation',
    email: 'billing@acmecorp.com',
    phone: '+91 98765 43210',
    website: 'https://acmecorp.com',
    avatarUrl: '',
    status: 'Active',
    category: 'Enterprise',
    tags: ['VIP', 'Key Account'],
    taxId: 'GSTIN29AABCU9603R1ZM',
    city: 'Bengaluru',
    country: 'India',
    contactCount: 2,
    leadId: 'lead_1',
    sourceLead: { _id: 'lead_1', name: 'Rahul Mehta', company: 'Acme Corporation', email: 'rahul@acmecorp.com' },
    customFields: { industry: 'Technology', employeeCount: 250, preferredContact: 'Email', ndaSigned: true },
    primaryContact: {
      _id: 'contact_1',
      name: 'Rahul Mehta',
      email: 'rahul@acmecorp.com',
      phone: '+91 98765 11111',
      designation: 'CTO',
      isPrimary: true,
    },
    billingAddress: {
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      zip: '560001',
    },
    shippingAddress: {
      street: 'Warehouse 4, Peenya',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      zip: '560058',
    },
    createdAt: '2026-06-12T10:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
  {
    _id: 'client_2',
    name: 'Stark Industries',
    email: 'finance@stark.com',
    phone: '+91 99887 76655',
    website: 'https://stark.com',
    status: 'Active',
    category: 'Strategic',
    tags: ['Enterprise', 'High Value'],
    taxId: 'GSTIN27AAACS5052J1Z4',
    city: 'Mumbai',
    country: 'India',
    contactCount: 1,
    customFields: { industry: 'Manufacturing', employeeCount: 1200 },
    primaryContact: {
      _id: 'contact_2',
      name: 'Priya Sharma',
      email: 'priya@stark.com',
      phone: '+91 99887 70001',
      designation: 'VP Procurement',
      isPrimary: true,
    },
    billingAddress: {
      street: '88 Bandra Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      zip: '400051',
    },
    createdAt: '2026-05-20T10:00:00.000Z',
    updatedAt: '2026-08-28T08:00:00.000Z',
  },
  {
    _id: 'client_3',
    name: 'Wayne Enterprises',
    email: 'contact@wayne.com',
    phone: '+91 91234 56789',
    status: 'Active',
    category: 'VIP',
    tags: ['VIP', 'Monthly Retainer'],
    city: 'Delhi',
    country: 'India',
    contactCount: 1,
    primaryContact: {
      _id: 'contact_3',
      name: 'Ananya Roy',
      email: 'ananya@wayne.com',
      designation: 'Operations Head',
      isPrimary: true,
    },
    billingAddress: {
      street: 'Connaught Place',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      zip: '110001',
    },
    createdAt: '2026-04-02T10:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    _id: 'client_4',
    name: 'Cyberdyne Systems',
    email: 'info@cyberdyne.io',
    phone: '+91 90000 11223',
    status: 'Inactive',
    category: 'SMB',
    tags: ['Prospect'],
    city: 'Hyderabad',
    country: 'India',
    contactCount: 0,
    primaryContact: null,
    billingAddress: {
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
    },
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    _id: 'client_5',
    name: 'Globex Corp',
    email: 'support@globex.org',
    phone: '+91 95555 44332',
    status: 'Active',
    category: 'Retainer',
    tags: ['SMB', 'Referral Partner'],
    city: 'Pune',
    country: 'India',
    contactCount: 1,
    primaryContact: {
      _id: 'contact_5',
      name: 'Vikram Mehta',
      email: 'vikram@globex.org',
      designation: 'Founder',
      isPrimary: true,
    },
    createdAt: '2026-07-18T10:00:00.000Z',
    updatedAt: '2026-09-05T08:00:00.000Z',
  },
];

export const INITIAL_MOCK_CONTACTS: Record<string, ClientContact[]> = {
  client_1: [
    {
      _id: 'contact_1',
      name: 'Rahul Mehta',
      email: 'rahul@acmecorp.com',
      phone: '+91 98765 11111',
      designation: 'CTO',
      isPrimary: true,
      companyId: 'client_1',
    },
    {
      _id: 'contact_1b',
      name: 'Sneha Iyer',
      email: 'sneha@acmecorp.com',
      designation: 'Finance Manager',
      isPrimary: false,
      companyId: 'client_1',
    },
  ],
  client_2: [
    {
      _id: 'contact_2',
      name: 'Priya Sharma',
      email: 'priya@stark.com',
      phone: '+91 99887 70001',
      designation: 'VP Procurement',
      isPrimary: true,
      companyId: 'client_2',
    },
  ],
};

export const INITIAL_MOCK_NOTES: Record<string, ClientNote[]> = {
  client_1: [
    {
      _id: 'note_1',
      title: 'Renewal',
      body: 'Strategic account — renew retainer before Q4.',
      pinned: true,
      createdByName: 'CRM Manager',
      createdAt: '2026-08-20T10:00:00.000Z',
    },
  ],
};

export const INITIAL_MOCK_EVENTS: Record<string, ClientEvent[]> = {
  client_1: [
    {
      _id: 'event_1',
      title: 'Quarterly business review',
      type: 'Meeting',
      dueAt: '2026-09-20T10:00:00.000Z',
      completed: false,
      createdAt: '2026-09-01T10:00:00.000Z',
    },
  ],
};

export const INITIAL_MOCK_ADDRESSES: Record<string, ClientAddress[]> = {
  client_1: [
    {
      _id: 'addr_1_billing',
      type: 'billing',
      label: 'HQ Billing',
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      zip: '560001',
      isDefault: true,
    },
    {
      _id: 'addr_1_shipping',
      type: 'shipping',
      label: 'Peenya Warehouse',
      street: 'Warehouse 4, Peenya',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      zip: '560058',
      isDefault: true,
    },
    {
      _id: 'addr_1_branch',
      type: 'branch',
      label: 'Koramangala Office',
      street: '80 Feet Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      zip: '560034',
      isDefault: false,
    },
  ],
  client_2: [
    {
      _id: 'addr_2_billing',
      type: 'billing',
      street: '88 Bandra Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      zip: '400051',
      isDefault: true,
    },
  ],
};

export const INITIAL_MOCK_DOCUMENTS: Record<string, ClientDocument[]> = {
  client_1: [
    {
      _id: 'doc_1',
      name: 'MSA 2026.pdf',
      url: 'https://example.com/docs/msa-2026.pdf',
      kind: 'file',
      category: 'Contract',
      description: 'Master service agreement',
      uploadedByName: 'CRM Manager',
      createdAt: '2026-07-01T10:00:00.000Z',
    },
    {
      _id: 'doc_2',
      name: 'Shared drive folder',
      url: 'https://drive.google.com/drive/folders/example',
      kind: 'link',
      storageProvider: 'url',
      category: 'General',
      description: 'Client shared folder',
      uploadedByName: 'CRM Manager',
      createdAt: '2026-07-02T10:00:00.000Z',
    },
  ],
};

export const INITIAL_MOCK_PORTAL: Record<string, ClientPortalAccess[]> = {
  client_1: [
    {
      _id: 'portal_1',
      name: 'Rahul Mehta',
      email: 'rahul@acmecorp.com',
      username: 'rahul_acme',
      portalRole: 'Admin',
      permissions: ['invoices', 'estimates', 'contracts', 'projects', 'documents', 'tickets'],
      status: 'Active',
      contactId: 'contact_1',
      invitedAt: '2026-06-15T10:00:00.000Z',
      activatedAt: '2026-06-16T08:00:00.000Z',
      lastLoginAt: '2026-09-01T12:00:00.000Z',
    },
  ],
};

export const INITIAL_MOCK_PROJECTS: Record<string, ClientRelatedProject[]> = {
  client_1: [
    { _id: 'proj_1', name: 'Cloud Migration', status: 'In Progress', startDate: '2026-06-01' },
    { _id: 'proj_2', name: 'Support Retainer', status: 'Active', startDate: '2026-01-01' },
  ],
};

export const INITIAL_MOCK_TASKS: Record<string, ClientRelatedTask[]> = {
  client_1: [
    {
      _id: 'task_1',
      title: 'Prepare QBR deck',
      status: 'Open',
      priority: 'High',
      dueDate: '2026-09-18',
      assigneeName: 'Sales Rep',
    },
    {
      _id: 'task_2',
      title: 'Collect tax certificates',
      status: 'In Progress',
      priority: 'Medium',
      dueDate: '2026-09-25',
    },
  ],
};

export const INITIAL_MOCK_QUOTATIONS: Record<string, ClientRelatedQuotation[]> = {
  client_1: [
    {
      _id: 'quot_1',
      number: 'QT-1001',
      title: 'Migration Phase 2',
      status: 'Sent',
      total: 450000,
      currency: 'INR',
      createdAt: '2026-08-10T10:00:00.000Z',
    },
  ],
};

export const INITIAL_MOCK_INVOICES: Record<string, ClientRelatedInvoice[]> = {
  client_1: [
    {
      _id: 'inv_1',
      number: 'INV-2044',
      status: 'Paid',
      total: 250000,
      balanceDue: 0,
      currency: 'INR',
      dueDate: '2026-07-30',
      createdAt: '2026-07-01T10:00:00.000Z',
    },
    {
      _id: 'inv_2',
      number: 'INV-2090',
      status: 'Unpaid',
      total: 180000,
      balanceDue: 180000,
      currency: 'INR',
      dueDate: '2026-09-15',
      createdAt: '2026-08-15T10:00:00.000Z',
    },
  ],
};

export const INITIAL_MOCK_PAYMENTS: Record<string, ClientRelatedPayment[]> = {
  client_1: [
    {
      _id: 'pay_1',
      number: 'PAY-501',
      amount: 250000,
      currency: 'INR',
      method: 'NEFT',
      status: 'Completed',
      paidAt: '2026-07-28T10:00:00.000Z',
    },
  ],
};

export const INITIAL_MOCK_CUSTOM_FIELD_DEFS: ClientCustomFieldDef[] = [...DEFAULT_CLIENT_CUSTOM_FIELDS];
