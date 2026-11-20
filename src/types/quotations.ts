export type DiscountType = 'percent' | 'amount';
export type TaxCalculation = 'before_discount' | 'after_discount';

export const QUOTATION_STATUSES = [
  'Draft',
  'Sent',
  'Accepted',
  'Rejected',
  'Expired',
  'Converted',
  'Closed',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number] | string;

export const QUOTATION_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
  'CAD',
  'AUD',
  'JPY',
] as const;

export const QUOTATION_TAX_SLABS = [0, 5, 12, 18, 28] as const;

/**
 * How the client pays this quotation — Settings → General → Proforma &
 * Advance Payment. `full` asks for the whole amount; `advance` asks for a
 * percentage of the total or a fixed amount up front.
 */
export type QuotationPaymentType = 'full' | 'advance';
export type QuotationAdvanceMode = 'percent' | 'amount';

/** Titled text block printed after the totals (inclusions, cancellation policy, ...). */
export interface QuotationSection {
  title: string;
  body: string;
}

export interface QuotationLineItem {
  /** What the quantity counts, e.g. "Rooms × Nights". */
  unit?: string;
  /** Values of the active extension's line columns (e.g. availability, provider). */
  extra?: Record<string, string>;
  /** The extension's own reference for the line (kept on revisions, never shown). */
  sourceRef?: string;
  /** Key of the extension's line group (salesFlow.quotationLineGroups); '' = ungrouped. */
  group?: string;
  /** GST suite (CRM 3.53.0): SAC code and service key of the line. */
  sac?: string;
  serviceType?: string;
  name: string;
  description?: string;
  qty: number;
  rate: number;
  tax: number;
  fileUrl?: string;
  amount?: number;
}

/** How much of a quotation is paid, from the server's verified payment records. */
export interface QuotationPaymentState {
  total: number;
  paid: number;
  balance: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  /** Advance workflow: 'Advance Paid' once the required advance is in (nothing more payable on the quotation). */
  stage?: 'Unpaid' | 'Advance Paid' | 'Partially Paid' | 'Paid';
  isAdvanceFlow?: boolean;
  advanceRequired?: number;
  advancePaid?: number;
  advanceSatisfied?: boolean;
  currency: string;
  invoiceId: string | null;
  invoiceNo: string;
  invoiceStatus: string;
  invoiceTotal?: number;
  invoiceBalance?: number;
  nextPayment: { amount: number; kind: 'full' | 'advance' | 'balance' | 'invoice' } | null;
  canPay: boolean;
}

export interface QuotationItem {
  _id: string;
  quotationNo?: string;
  quotationNumber?: string;
  number?: string;
  recipientType: 'lead' | 'client';
  leadId?: string;
  clientId?: string;
  recipientName?: string;
  clientName?: string;
  customerName?: string;
  customerLabel?: string;
  opportunityId?: string;
  opportunityTitle?: string;
  shippingState: string;
  issueDate: string;
  validTill: string;
  expiryDate?: string;
  currency: string;
  taxCalculation: TaxCalculation;
  title?: string;
  description?: string;
  lineItems: QuotationLineItem[];
  discountType?: DiscountType;
  discountValue?: number;
  discountPercent?: number;
  discountAmount?: number;
  shippingCharge?: number;
  recipientNotes?: string;
  sections?: QuotationSection[];
  /** GST suite (CRM 3.53.0): one place of supply per document ('' = the client's state) and the TCS rule. */
  placeOfSupply?: string;
  tcsRuleKey?: string;
  subtotal?: number;
  taxTotal?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  gstMode?: 'intra' | 'inter';
  grandTotal: number;
  status: QuotationStatus;
  isArchived?: boolean;
  /** Closed (CRM 3.28.0): why, and the accepted quotation of the same opportunity. */
  closedReason?: string;
  closedByQuotationId?: string;
  closedAt?: string | null;
  isLatestVersion?: boolean;
  revisionOf?: string;
  revisionNumber?: number;
  revisionReason?: string;
  portalToken?: string;
  portalUrl?: string;
  portalViewedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  acceptedByName?: string;
  acceptedByEmail?: string;
  acceptedIp?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  convertedInvoiceId?: string;
  convertedSalesOrderId?: string;
  /** Payment terms — only meaningful while proforma & advance payment is on. */
  paymentType?: QuotationPaymentType;
  advanceMode?: QuotationAdvanceMode;
  advanceValue?: number;
  /** The payment request raised from this quotation, once one exists. */
  proformaInvoiceId?: string;
  /** Present on the detail response. */
  paymentState?: QuotationPaymentState | null;
  proformaInvoiceNo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type QuotationCreateInput = Omit<
  QuotationItem,
  | '_id'
  | 'quotationNo'
  | 'quotationNumber'
  | 'number'
  | 'recipientName'
  | 'opportunityTitle'
  | 'subtotal'
  | 'taxTotal'
  | 'cgst'
  | 'sgst'
  | 'igst'
  | 'gstMode'
  | 'grandTotal'
  | 'status'
  | 'isArchived'
  | 'isLatestVersion'
  | 'revisionOf'
  | 'revisionNumber'
  | 'portalToken'
  | 'portalUrl'
  | 'portalViewedAt'
  | 'sentAt'
  | 'acceptedAt'
  | 'acceptedByName'
  | 'acceptedByEmail'
  | 'acceptedIp'
  | 'rejectedAt'
  | 'rejectionReason'
  | 'convertedInvoiceId'
  | 'convertedSalesOrderId'
  | 'proformaInvoiceId'
  | 'proformaInvoiceNo'
  | 'createdAt'
  | 'updatedAt'
>;

export interface QuotationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  clientId?: string;
  leadId?: string;
  opportunityId?: string;
  archived?: boolean | 'true' | 'false';
}

export interface QuotationExportParams extends QuotationQueryParams {
  format?: 'csv' | 'json';
}

export interface QuotationRevisionInput {
  reason: string;
  validTill?: string;
  lineItems?: QuotationLineItem[];
  discountType?: DiscountType;
  discountValue?: number;
  /** Percent discount on the revision; what the server reads. */
  discountPercent?: number;
  shippingCharge?: number;
  recipientNotes?: string;
  terms?: string;
}

export interface QuotationTemplateItem {
  _id: string;
  name: string;
  category?: string;
  description?: string;
  currency: string;
  taxCalculation: TaxCalculation;
  shippingCharge?: number;
  recipientNotes?: string;
  terms?: string;
  sections?: QuotationSection[];
  lineItems: QuotationLineItem[];
  discountType?: DiscountType;
  discountValue?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type QuotationTemplateCreateInput = Omit<
  QuotationTemplateItem,
  '_id' | 'createdAt' | 'updatedAt'
>;

/** Default company place-of-supply for GST intra vs inter detection */
export const COMPANY_STATE_DEFAULT = 'Maharashtra';
