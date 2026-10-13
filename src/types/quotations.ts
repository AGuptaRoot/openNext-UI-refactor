export type DiscountType = 'percent' | 'amount';
export type TaxCalculation = 'before_discount' | 'after_discount';

export const QUOTATION_STATUSES = [
  'Draft',
  'Sent',
  'Accepted',
  'Rejected',
  'Expired',
  'Converted',
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

export interface QuotationLineItem {
  name: string;
  description?: string;
  qty: number;
  rate: number;
  tax: number;
  fileUrl?: string;
  amount?: number;
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
  subtotal?: number;
  taxTotal?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  gstMode?: 'intra' | 'inter';
  grandTotal: number;
  status: QuotationStatus;
  isArchived?: boolean;
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
  shippingCharge?: number;
  recipientNotes?: string;
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
