import type { DiscountType, QuotationLineItem, TaxCalculation } from './quotations';

export type InvoiceStatus =
  | 'Draft'
  | 'Sent'
  | 'Viewed'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Written Off'
  | 'Cancelled'
  | string;

export interface InvoiceReminder {
  enabled: boolean;
  timing: 'before_due_date' | 'after_due_date';
  count?: number;
  days?: number;
}

export interface InvoicePaymentRecord {
  _id: string;
  amount: number;
  currency?: string;
  paymentDate: string;
  mode?: string;
  transactionId?: string;
  paymentGateway?: string;
  status?: string;
  remark?: string;
}

/**
 * What kind of document this is.
 *
 * A `proforma` is a payment request raised from a quotation: its own numbering
 * series, excluded from tax and revenue reporting, and converted into a `tax`
 * invoice for the full value once the work is delivered. Records saved before
 * the field existed have none, and are tax invoices.
 */
export type InvoiceDocumentType = 'tax' | 'proforma';

export interface InvoiceItem {
  _id: string;
  invoiceNo: string;
  documentType?: InvoiceDocumentType;
  issueDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  taxCalculation: TaxCalculation;
  clientId: string;
  clientName?: string;
  customerEmail?: string;
  clientEmail?: string;
  projectId?: string;
  projectName?: string;
  quotationId?: string;
  quotationNo?: string;
  /** Set on a proforma raised for a prospect who has no client account yet. */
  leadId?: string;
  /** The proforma this tax invoice came from, and the advance it carried. */
  proformaInvoiceId?: string;
  proformaInvoiceNo?: string;
  /** On a proforma: the tax invoice it was converted into. */
  convertedInvoiceId?: string;
  convertedInvoiceNo?: string;
  convertedAt?: string;
  salesOrderId?: string;
  salesOrderNo?: string;
  isSalesOrderDelivered?: boolean;
  salesOrderDeliveryStatus?: string;
  paymentDetails?: string;
  billingAddress?: string;
  shippingAddress?: string;
  lineItems: QuotationLineItem[];
  notes?: string;
  terms?: string;
  reminder?: InvoiceReminder;
  discountType?: DiscountType;
  discountValue?: number;
  discountPercent?: number;
  discountAmount?: number;
  shippingCharge?: number;
  attachmentUrl?: string;
  attachments?: Array<{ name?: string; url: string }>;
  subtotal?: number;
  taxTotal?: number;
  grandTotal: number;
  amountPaid?: number;
  creditAmount?: number;
  creditNoteIds?: string[];
  balanceDue?: number;
  status: InvoiceStatus;
  isArchived?: boolean;
  payToken?: string;
  portalUrl?: string;
  payUrl?: string;
  writtenOffReason?: string;
  writtenOffAt?: string;
  cancelledAt?: string;
  sentAt?: string;
  viewedAt?: string;
  recurringProfileId?: string;
  recurringCycle?: number;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  recurringEvery?: number;
  recurringCycles?: number;
  recurringCyclesCompleted?: number;
  recurringNextDate?: string | null;
  recurringStartDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InvoiceCreateInput = Omit<
  InvoiceItem,
  | '_id'
  | 'clientName'
  | 'projectName'
  | 'subtotal'
  | 'taxTotal'
  | 'grandTotal'
  | 'amountPaid'
  | 'balanceDue'
  | 'status'
  | 'isArchived'
  | 'payToken'
  | 'portalUrl'
  | 'writtenOffReason'
  | 'writtenOffAt'
  | 'cancelledAt'
  | 'sentAt'
  | 'viewedAt'
  | 'documentType'
  | 'proformaInvoiceId'
  | 'proformaInvoiceNo'
  | 'convertedInvoiceId'
  | 'convertedInvoiceNo'
  | 'convertedAt'
  | 'createdAt'
  | 'updatedAt'
>;

export interface InvoiceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  /** Omitted shows tax invoices only, which is what the list means by default. */
  documentType?: InvoiceDocumentType | 'all';
  clientId?: string;
  projectId?: string;
  archived?: boolean | 'true' | 'false' | 'all';
  isArchived?: boolean | 'true' | 'false' | 'all';
  isRecurring?: boolean | 'true' | 'false';
  recurringProfileId?: string;
  ids?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface InvoicePaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type RecurringInvoiceFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'custom';

export type RecurringInvoiceStatus = 'Active' | 'Paused' | 'Completed';
export type RecurringInvoiceEndCondition = 'never' | 'on_date' | 'after_cycles';

export interface RecurringInvoiceExecutionLog {
  runId: string;
  runDate: string;
  invoiceId?: string | null;
  invoiceNo?: string;
  status: 'Success' | 'Failed';
  error?: string;
}

export interface RecurringInvoiceItem {
  _id: string;
  profileName: string;
  clientId: string;
  clientName?: string;
  projectId?: string | null;
  projectName?: string;
  templateId?: string | null;
  frequency: RecurringInvoiceFrequency | string;
  customIntervalDays?: number;
  startDate: string;
  nextRunDate: string;
  lastRunDate?: string | null;
  endCondition: RecurringInvoiceEndCondition | string;
  endDate?: string | null;
  totalCycles?: number | null;
  cyclesCompleted?: number;
  status: RecurringInvoiceStatus | string;
  bankAccount?: string;
  clientCanStopRecurring?: boolean;
  currency: string;
  lineItems: QuotationLineItem[];
  discountType?: DiscountType;
  discountValue?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxCalculation?: TaxCalculation;
  paymentTermsDays?: number;
  recipientNotes?: string;
  notes?: string;
  terms?: string;
  autoSendEmail?: boolean;
  executionLogs?: RecurringInvoiceExecutionLog[];
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecurringInvoiceCreateInput {
  profileName?: string;
  clientId: string;
  projectId?: string;
  bankAccount?: string;
  clientCanStopRecurring?: boolean;
  templateId?: string;
  frequency?: RecurringInvoiceFrequency | string;
  customIntervalDays?: number;
  startDate?: string;
  nextRunDate?: string;
  endCondition?: RecurringInvoiceEndCondition | string;
  endDate?: string | null;
  totalCycles?: number | null;
  currency?: string;
  lineItems: Array<{
    name?: string;
    description?: string;
    qty: number;
    rate: number;
    tax?: number;
  }>;
  discountType?: DiscountType;
  discountValue?: number;
  taxCalculation?: TaxCalculation;
  paymentTermsDays?: number;
  recipientNotes?: string;
  notes?: string;
  terms?: string;
  autoSendEmail?: boolean;
}

export interface RecurringInvoiceQueryParams {
  status?: string;
  clientId?: string;
  search?: string;
}

export interface RecurringInvoiceUpcomingReport {
  daysAhead?: number;
  items?: Array<{
    profileId: string;
    profileName: string;
    clientId: string;
    clientName?: string;
    nextRunDate: string;
    frequency?: string;
    amount?: number;
    currency?: string;
  }>;
  profiles?: RecurringInvoiceItem[];
}

export const RECURRING_INVOICE_FREQUENCIES: RecurringInvoiceFrequency[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
  'custom',
];

export function recurringInvoiceFrequencyLabel(frequency: string): string {
  const map: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    half_yearly: 'Half-yearly',
    yearly: 'Yearly',
    custom: 'Custom',
  };
  return map[frequency] || frequency;
}

export interface InvoiceExportParams extends InvoiceQueryParams {
  format?: 'csv' | 'json';
}

export interface InvoiceWriteOffInput {
  reason: string;
}

export const INVOICE_STATUSES = [
  'Draft',
  'Sent',
  'Viewed',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Written Off',
  'Cancelled',
] as const;

export const INVOICE_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'CAD',
  'AUD',
  'SGD',
  'JPY',
] as const;

export interface RazorpayStatusData {
  configured: boolean;
  available?: boolean;
  keyId?: string;
  businessName?: string;
  currency?: string;
}

export interface RazorpayOrderData {
  order: any;
  keyId: string;
  amount: number;
  currency: string;
  businessName?: string;
  amountDue?: number;
  invoice?: {
    id: string;
    invoiceNo: string;
    balanceDue?: number;
    currency?: string;
  };
  /** Present when the order was raised from a quotation. */
  proformaId?: string;
  proformaNo?: string;
  quotationId?: string;
  quotationNo?: string;
  isAdvance?: boolean;
}

export interface RazorpayConfirmInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

