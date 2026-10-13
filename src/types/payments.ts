export const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_STATUSES = [
  'Completed',
  'Pending',
  'Partially Refunded',
  'Refunded',
  'Disputed',
  'Failed',
  'Cancelled',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number] | string;

export const REFUND_STATUSES = [
  'None',
  'Pending Approval',
  'Approved',
  'Rejected',
  'Processed',
] as const;
export type RefundWorkflowStatus = (typeof REFUND_STATUSES)[number] | string;

export const REFUND_MODES = [
  'Bank Transfer',
  'UPI',
  'Original Payment Method',
  'Cash',
  'Card',
  'Cheque',
  'Other',
] as const;

export const PAYMENT_GATEWAY_OPTIONS = [
  '',
  'Razorpay',
  'Stripe',
  'PayPal',
  'Bank Transfer / Wire',
  'Cash',
  'Cheque',
  'Square',
  'Authorize.Net',
  'Other',
] as const;

export const PAYMENT_CURRENCIES = [
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

export interface PaymentAllocation {
  invoiceId: string;
  invoiceNumber?: string;
  amount: number;
}

export interface PaymentRefund {
  _id: string;
  amount: number;
  mode: string;
  transactionId?: string;
  reason: string;
  status: RefundWorkflowStatus;
  requestedAt?: string;
  requestedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  processedAt?: string;
}

export interface PaymentItem {
  _id: string;
  paymentNo?: string;
  paymentNumber?: string;
  receiptNumber?: string;
  clientId: string;
  clientName?: string;
  projectId?: string;
  projectName?: string;
  invoiceId?: string;
  invoiceNo?: string;
  invoiceNumber?: string;
  salesOrderId?: string | null;
  salesOrderNo?: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  paymentDate: string;
  mode: PaymentMode | string;
  displayMode?: string;
  allocations?: PaymentAllocation[];
  transactionId?: string;
  paymentGateway?: string;
  receiptUrl?: string;
  receipt?: string;
  remark?: string;
  status: PaymentStatus;
  refundStatus?: RefundWorkflowStatus;
  refundedAmount?: number;
  refunds?: PaymentRefund[];
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentCreateInput = Omit<
  PaymentItem,
  | '_id'
  | 'paymentNo'
  | 'paymentNumber'
  | 'receiptNumber'
  | 'clientName'
  | 'projectName'
  | 'invoiceNumber'
  | 'status'
  | 'refundStatus'
  | 'refundedAmount'
  | 'refunds'
  | 'createdAt'
  | 'updatedAt'
>;

export interface PaymentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  mode?: string;
  clientId?: string;
  invoiceId?: string;
}

export interface PaymentExportParams extends PaymentQueryParams {
  format?: 'csv' | 'json';
}

export interface RefundRequestInput {
  amount: number;
  mode: string;
  transactionId?: string;
  reason: string;
  autoApprove?: boolean;
}

export interface RefundRejectInput {
  reason: string;
}

export interface RefundListItem extends PaymentRefund {
  paymentId: string;
  paymentNumber?: string;
  clientId?: string;
  clientName?: string;
  paymentAmount?: number;
  currency?: string;
}
