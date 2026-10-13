import type { DiscountType, QuotationLineItem, TaxCalculation } from './quotations';

export interface InvoiceTemplateItem {
  _id: string;
  name: string;
  category?: string;
  description?: string;
  currency: string;
  paymentTermsDays: number;
  taxCalculation: TaxCalculation;
  shippingCharge?: number;
  shippingState?: string;
  tags?: string[];
  adminNotes?: string;
  recipientNotes?: string;
  terms?: string;
  paymentDetails?: string;
  isDefault?: boolean;
  discountType?: DiscountType;
  discountValue?: number;
  lineItems: QuotationLineItem[];
  createdAt?: string;
  updatedAt?: string;
}

export type InvoiceTemplateCreateInput = Omit<
  InvoiceTemplateItem,
  '_id' | 'createdAt' | 'updatedAt'
>;

export interface InvoiceTemplateQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}

export const INVOICE_TEMPLATE_CATEGORIES = [
  'General',
  'Retainer',
  'Web Development',
  'Consulting',
  'AMC Maintenance',
  'Other',
] as const;
