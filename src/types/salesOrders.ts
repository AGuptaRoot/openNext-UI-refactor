export const SALES_ORDER_STATUSES = [
  'Draft',
  'Pending',
  'On Hold',
  'Failed',
  'Processing',
  'Approved',
  'Partially Shipped',
  'Shipped',
  'Completed',
  'Cancelled',
  'Returned',
] as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const SALES_ORDER_LIST_TABS = [
  'All Orders',
  'Approved',
  'Processing',
  'Completed',
  'Pending',
  'On Hold',
  'Cancelled',
] as const;

export type SalesOrderDeliveryStatus =
  | 'Pending Allocation'
  | 'Allocated'
  | 'Partially Dispatched'
  | 'Dispatched'
  | 'In-Transit'
  | 'Delivered'
  | 'Returned';

export const SALES_ORDER_DELIVERY_STATUSES: SalesOrderDeliveryStatus[] = [
  'Pending Allocation',
  'Allocated',
  'Partially Dispatched',
  'Dispatched',
  'In-Transit',
  'Delivered',
  'Returned',
];

export const SALES_ORDER_COURIERS = [
  'BlueDart Express',
  'Delhivery Logistics',
  'Shiprocket Direct',
  'FedEx Express',
  'DTDC Courier',
  'Professional Courier',
  'Custom Courier',
] as const;

export type SalesOrderCourier = (typeof SALES_ORDER_COURIERS)[number];

export const DEFAULT_SALES_ORDER_SOURCES = [
  'Root CRM',
  'Direct Sales',
  'E-Commerce Store',
  'POS Terminal',
  'Client Portal',
] as const;

export const RMA_REASON_CATEGORIES = [
  'Damaged in transit',
  'Defective / Quality issue',
  'Wrong item shipped',
  'Customer specification change',
  'Other',
] as const;

export const RMA_STATUSES = [
  'Requested',
  'Approved',
  'Received',
  'Inspected',
  'Refunded',
  'Replaced',
  'Rejected',
] as const;

export type RmaStatus = (typeof RMA_STATUSES)[number];
export type RmaType = 'Return' | 'Replacement';

export const DEFAULT_STATE_SHIPPING_RATES: Record<string, number> = {
  Maharashtra: 100,
  Gujarat: 150,
  Karnataka: 150,
  Delhi: 200,
  'Tamil Nadu': 200,
  'Uttar Pradesh': 200,
  'West Bengal': 250,
  Rajasthan: 200,
  Assam: 300,
  Goa: 200,
  Other: 350,
};

export const FREE_SHIPPING_THRESHOLD_DEFAULT = 5000;

export interface SalesOrderLineItem {
  description: string;
  sku?: string;
  qty: number;
  rate: number;
  tax?: number;
  amount?: number;
  productId?: string | null;
  shippedQty?: number;
  returnedQty?: number;
}

export interface SalesOrderShippedItem {
  lineItemIndex: number;
  description: string;
  qty: number;
  productId?: string | null;
}

export type ShipmentDeliveryStatus = 'Dispatched' | 'In-Transit' | 'Delivered' | 'Failed';

export interface SalesOrderShipment {
  _id: string;
  shipmentNumber: string;
  courierName: string;
  trackingNumber: string;
  shippingState?: string;
  weightKg?: number;
  shippedItems: SalesOrderShippedItem[];
  dispatchedAt?: string;
  deliveredAt?: string | null;
  deliveryStatus: ShipmentDeliveryStatus;
  proofOfDelivery?: string;
  notes?: string;
  createdBy?: string;
}

export interface SalesOrderReturnedItem {
  description: string;
  qty: number;
  unitRate?: number;
  reason?: string;
  productId?: string | null;
  lineItemIndex?: number;
}

export interface SalesOrderReturn {
  _id: string;
  rmaNumber: string;
  type: RmaType;
  status: RmaStatus;
  returnedItems: SalesOrderReturnedItem[];
  reason: string;
  reasonCategory?: string;
  refundAmount?: number;
  replacementOrderId?: string | null;
  requestedAt?: string;
  resolvedAt?: string | null;
  notes?: string;
  inspectedBy?: string | null;
  inspectedByName?: string | null;
  createdBy?: string;
}

export interface SalesOrderStockAudit {
  action: string;
  performedAt: string;
  performedBy: string;
  performedByName?: string;
  details?: string;
}

export interface SalesOrderItem {
  _id: string;
  orderNumber: string;
  quotationId?: string | null;
  opportunityId?: string | null;
  clientId: string;
  clientName?: string;
  projectId?: string | null;
  projectName?: string;
  leadId?: string | null;
  generatedBy: string;
  issueDate: string;
  deliveryTargetDate?: string | null;
  status: SalesOrderStatus;
  currency?: string;
  lineItems: SalesOrderLineItem[];
  subtotal?: number;
  discountType?: 'percent' | 'amount' | 'fixed';
  discountValue?: number;
  /** @deprecated use discountValue */
  discount?: number;
  discountPercent?: number;
  discountTotal?: number;
  taxTotal?: number;
  shippingCharge: number;
  shippingState: string;
  totalWeightKg?: number;
  grandTotal: number;
  deliveryStatus?: SalesOrderDeliveryStatus;
  courierName?: string;
  trackingNumber?: string;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  proofOfDelivery?: string;
  shipments?: SalesOrderShipment[];
  returns?: SalesOrderReturn[];
  stockReserved?: boolean;
  stockReservedAt?: string | null;
  inventoryDeducted?: boolean;
  inventoryDeductedAt?: string | null;
  stockAudit?: SalesOrderStockAudit[];
  billingAddress?: string;
  shippingAddress?: string;
  notes?: string;
  convertedInvoiceId?: string | null;
  convertedInvoiceNo?: string | null;
  invoiceStatus?: string | null;
  cancellationReason?: string;
  createdBy?: string;
  updatedBy?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SalesOrderCreateInput = {
  orderNumber?: string;
  clientId: string;
  projectId?: string;
  quotationId?: string;
  opportunityId?: string;
  leadId?: string;
  generatedBy: string;
  status: SalesOrderStatus;
  issueDate: string;
  deliveryTargetDate?: string;
  shippingState: string;
  billingAddress?: string;
  shippingAddress?: string;
  lineItems: SalesOrderLineItem[];
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  discount?: number;
  shippingCharge: number;
  currency?: string;
  notes?: string;
  totalWeightKg?: number;
};

export interface SalesOrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  deliveryStatus?: string;
  clientId?: string;
}

export interface SalesOrderShipmentInput {
  courierName: string;
  trackingNumber: string;
  weightKg?: number;
  notes?: string;
  items: Array<{ lineItemIndex: number; qty: number }>;
}

export interface SalesOrderReturnInput {
  type: RmaType;
  refundAmount?: number;
  reasonCategory: string;
  reason: string;
  notes?: string;
  /** Preferred API payload — line snapshots with description + qty. */
  returnedItems: Array<{
    description: string;
    qty: number;
    unitRate?: number;
    productId?: string | null;
    reason?: string;
  }>;
}

export interface SalesOrderDeliveryConfirmInput {
  shipmentId: string;
  proofOfDelivery: string;
}

export function resolveShippingCharge(
  state: string,
  subtotal: number,
  rates: Record<string, number> = DEFAULT_STATE_SHIPPING_RATES,
  freeThreshold = FREE_SHIPPING_THRESHOLD_DEFAULT,
  manualOverride?: number | null
): number {
  if (manualOverride != null && Number.isFinite(manualOverride)) {
    return Math.max(0, Number(manualOverride));
  }
  if (subtotal >= freeThreshold) return 0;
  const exact = rates[state];
  if (exact != null) return Number(exact);
  return Number(rates.Other ?? 350);
}

export function gstTaxModeLabel(shippingState: string, companyState = 'Maharashtra'): string {
  if (!shippingState.trim()) return 'Select destination state for GST mode';
  return shippingState.trim().toLowerCase() === companyState.trim().toLowerCase()
    ? 'Intra-State GST (CGST + SGST)'
    : 'Inter-State GST (IGST)';
}

export function remainingShipQty(line: SalesOrderLineItem): number {
  return Math.max(0, Number(line.qty || 0) - Number(line.shippedQty || 0));
}

export function remainingReturnQty(line: SalesOrderLineItem): number {
  return Math.max(0, Number(line.shippedQty || 0) - Number(line.returnedQty || 0));
}
