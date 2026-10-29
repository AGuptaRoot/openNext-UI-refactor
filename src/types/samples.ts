export type SampleLinkType = 'lead' | 'client' | 'opportunity';

export type SampleUrgency = 'Low' | 'Normal' | 'High' | 'Urgent';

export type SampleStatus =
  | 'Requested'
  | 'Approved'
  | 'Rejected'
  | 'Preparing'
  | 'Dispatched'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled';

export type SampleRoutedDepartment =
  | 'R&D / Technical'
  | 'Quality Control'
  | 'Production'
  | 'Sales'
  | 'None';

export interface SampleFeedback {
  rating?: number | null;
  comments?: string;
  interestedInOrder?: boolean | null;
  requiresImprovement?: boolean;
  routedDepartment?: SampleRoutedDepartment | string;
  improvementNotes?: string;
  routedTaskId?: string | null;
  feedbackDate?: string | null;
  submittedBy?: string | null;
}

export interface SampleProductItem {
  productName: string;
  quantity: number;
  unit: string;
}

export interface SampleItem {
  _id: string;
  sampleNumber: string;
  linkType: SampleLinkType;
  leadId?: string | null;
  clientId?: string | null;
  opportunityId?: string | null;
  opportunityTitle?: string | null;
  opportunityNumber?: string | null;
  linkedName?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  productName: string;
  quantity: number;
  unit: string;
  items?: SampleProductItem[];
  urgency: SampleUrgency | string;
  deliveryAddress?: string;
  notes?: string;
  isChargeable?: boolean;
  chargeAmount?: number;
  currency?: string;
  currencyCode?: string;
  exchangeRate?: number;
  status: SampleStatus | string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string;
  cancellationReason?: string;
  stockLocation?: string;
  courierName?: string;
  trackingNumber?: string;
  dispatchDate?: string | null;
  estimatedDeliveryDate?: string | null;
  deliveredAt?: string | null;
  feedback?: SampleFeedback | null;
  createdBy?: string;
  updatedBy?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SampleCreateInput {
  linkType: SampleLinkType;
  leadId?: string;
  clientId?: string;
  opportunityId?: string;
  productName: string;
  quantity: number;
  unit: string;
  items?: SampleProductItem[];
  urgency: SampleUrgency | string;
  deliveryAddress?: string;
  notes?: string;
  recipientName?: string;
  /** When true, chargeAmount + currency are persisted on the sample. */
  isChargeable?: boolean;
  chargeAmount?: number;
  currency?: string;
  currencyCode?: string;
  exchangeRate?: number;
}

export interface SampleQueryParams {
  search?: string;
  status?: string;
  leadId?: string;
  clientId?: string;
  opportunityId?: string;
  page?: number;
  limit?: number;
}

/**
 * Fields a sample request can still be changed on before it leaves the
 * warehouse. The link to the lead / client / opportunity and the lifecycle
 * fields are deliberately absent — those are not edits, they are transitions.
 */
export interface SampleUpdateInput {
  productName: string;
  quantity: number;
  unit: string;
  items?: SampleProductItem[];
  urgency: SampleUrgency | string;
  deliveryAddress?: string;
  notes?: string;
  recipientName?: string;
  isChargeable?: boolean;
  chargeAmount?: number;
  currency?: string;
  currencyCode?: string;
  exchangeRate?: number;
}

export interface SampleApproveInput {
  action: 'approve' | 'reject';
  stockLocation?: string;
  rejectionReason?: string;
}

export interface SampleDispatchInput {
  courierName: string;
  trackingNumber: string;
  dispatchDate?: string;
  estimatedDeliveryDate?: string;
}

export interface SampleFeedbackInput {
  rating: number;
  comments?: string;
  interestedInOrder?: boolean;
  requiresImprovement?: boolean;
  routedDepartment?: SampleRoutedDepartment | string;
  improvementNotes?: string;
}

export interface SampleProductPreset {
  label: string;
  productName: string;
  quantity: number;
  unit: string;
}

export const SAMPLE_URGENCIES: SampleUrgency[] = ['Low', 'Normal', 'High', 'Urgent'];

export const SAMPLE_STATUSES: SampleStatus[] = [
  'Requested',
  'Approved',
  'Preparing',
  'Dispatched',
  'Delivered',
  'Completed',
  'Rejected',
  'Cancelled',
];

/**
 * Statuses a sample request can still be called off from.
 *
 * Dispatched is deliberately absent: once the kit is with the courier it is on
 * its way, and "cancelled" would misstate what happened to it.
 */
export const CANCELLABLE_SAMPLE_STATUSES: SampleStatus[] = [
  'Requested',
  'Approved',
  'Preparing',
];

/**
 * Whether this request can still be cancelled — i.e. before it is handed to
 * the courier. Mirrors CANCELLABLE_SAMPLE_STATUSES on the server.
 */
export function canCancelSampleRequest(status: string): boolean {
  return CANCELLABLE_SAMPLE_STATUSES.includes(status as SampleStatus);
}

/**
 * Statuses in which a sample request is still editable — mirrors
 * EDITABLE_SAMPLE_STATUSES in the backend sample schema. The window closes at
 * dispatch, and a rejected request has to be raised again rather than rewritten.
 */
export const EDITABLE_SAMPLE_STATUSES: SampleStatus[] = [
  'Requested',
  'Approved',
  'Preparing',
];

export function canEditSampleRequest(status: SampleStatus | string): boolean {
  return (EDITABLE_SAMPLE_STATUSES as string[]).includes(String(status));
}

export const SAMPLE_UNITS = [
  'pcs',
  'kg',
  'litre',
  'liters',
  'meter',
  'meters',
  'box',
  'boxes',
  'packet',
  'swatches',
  'grams',
  'sets',
  'rolls',
] as const;

export const SAMPLE_DEPARTMENTS: SampleRoutedDepartment[] = [
  'R&D / Technical',
  'Quality Control',
  'Production',
  'Sales',
];

export const SAMPLE_PRODUCT_PRESETS: SampleProductPreset[] = [
  {
    label: 'Fabric Swatch',
    productName: '100% Organic Cotton Swatch Kit',
    quantity: 1,
    unit: 'swatches',
  },
  {
    label: 'Packaging',
    productName: 'Custom Printed Box Packaging Prototype',
    quantity: 2,
    unit: 'pcs',
  },
  {
    label: 'Chemical',
    productName: 'Sample Formulation Grade A (Vial)',
    quantity: 1,
    unit: 'liters',
  },
  {
    label: 'Material Prototype',
    productName: 'Precision Machined Alloy Component Sample',
    quantity: 1,
    unit: 'pcs',
  },
  {
    label: 'Color Catalog',
    productName: 'Pantone Color Finish Shade Card Booklet',
    quantity: 1,
    unit: 'sets',
  },
  {
    label: 'Textile Roll',
    productName: 'Polyester Yarn / Fabric Sample Roll',
    quantity: 5,
    unit: 'meters',
  },
];

export const SAMPLE_RATING_LABELS: Record<number, string> = {
  5: '5 Stars (Excellent)',
  4: '4 Stars (Good)',
  3: '3 Stars (Average)',
  2: '2 Stars (Poor)',
  1: '1 Star (Unsatisfactory)',
};

export function sampleStatusTone(status: string): string {
  if (status === 'Requested') return 'border-zinc-300 bg-zinc-50 text-zinc-800';
  if (status === 'Approved' || status === 'Preparing') return 'border-zinc-400 bg-zinc-100 text-zinc-900 font-semibold';
  if (status === 'Dispatched') return 'border-zinc-700 bg-zinc-800 text-white font-semibold';
  if (status === 'Delivered' || status === 'Completed') {
    return 'border-zinc-950 bg-zinc-950 text-white font-bold';
  }
  if (status === 'Rejected') return 'border-zinc-300 bg-zinc-100 text-zinc-600 line-through';
  if (status === 'Cancelled') return 'border-zinc-300 bg-zinc-50 text-zinc-500 line-through';
  return 'border-zinc-200 bg-zinc-50 text-zinc-700';
}

export function sampleUrgencyTone(urgency: string): string {
  if (urgency === 'Urgent') return 'border-zinc-950 bg-zinc-950 text-white font-bold';
  if (urgency === 'High') return 'border-zinc-400 bg-zinc-100 text-zinc-900 font-semibold';
  if (urgency === 'Normal') return 'border-zinc-300 bg-zinc-50 text-zinc-800';
  return 'border-zinc-200 bg-white text-zinc-600';
}

/** Tailwind background class for urgency indicator dots (no emoji). */
export function sampleUrgencyDotClass(urgency: string): string {
  if (urgency === 'Urgent') return 'bg-zinc-950 ring-1 ring-zinc-400';
  if (urgency === 'High') return 'bg-zinc-800';
  if (urgency === 'Normal') return 'bg-zinc-500';
  return 'bg-zinc-300';
}

/** @deprecated Use SampleUrgencyDot or sampleUrgencyDotClass instead */
export function sampleUrgencyEmoji(_urgency: string): string {
  return '';
}

export function normalizeSample(raw: Partial<SampleItem> & Record<string, unknown>): SampleItem {
  const leadId = (raw.leadId as string) || null;
  const clientId = (raw.clientId as string) || null;
  const opportunityId = (raw.opportunityId as string) || null;
  const linkType: SampleLinkType =
    raw.linkType === 'client' || raw.linkType === 'lead' || raw.linkType === 'opportunity'
      ? raw.linkType
      : opportunityId
        ? 'opportunity'
        : clientId && !leadId
          ? 'client'
          : 'lead';

  const linkedName = String(
    raw.linkedName ||
      raw.opportunityTitle ||
      raw.leadCompany ||
      raw.clientName ||
      raw.companyName ||
      raw.recipientName ||
      '—'
  );

  const feedbackRaw = (raw.feedback || {}) as SampleFeedback;
  const hasFeedback =
    raw.feedback != null &&
    (feedbackRaw.rating != null || Boolean(feedbackRaw.comments) || feedbackRaw.feedbackDate);

  return {
    _id: String(raw._id || `sample-${Date.now()}`),
    sampleNumber: String(raw.sampleNumber || 'SMP-0000'),
    linkType,
    leadId,
    clientId,
    opportunityId,
    opportunityTitle: (raw.opportunityTitle as string) || null,
    opportunityNumber: (raw.opportunityNumber as string) || null,
    linkedName,
    recipientName: (raw.recipientName || raw.leadContact || raw.contactPerson || '') as string,
    recipientEmail: (raw.recipientEmail || raw.email || '') as string,
    recipientPhone: (raw.recipientPhone || raw.phone || '') as string,
    productName: String(raw.productName || ''),
    quantity: Math.max(1, Number(raw.quantity || 1)),
    unit: String(raw.unit || 'pcs'),
    urgency: (raw.urgency as string) || 'Normal',
    deliveryAddress: String(raw.deliveryAddress || ''),
    notes: String(raw.notes || ''),
    status: (raw.status as string) || 'Requested',
    approvedBy: (raw.approvedBy as string) || null,
    approvedAt: (raw.approvedAt as string) || null,
    rejectionReason: (raw.rejectionReason as string) || null,
    cancelledAt: (raw.cancelledAt as string) || null,
    cancelledBy: String(raw.cancelledBy || ''),
    cancellationReason: String(raw.cancellationReason || ''),
    stockLocation: String(raw.stockLocation || ''),
    courierName: String(raw.courierName || ''),
    trackingNumber: String(raw.trackingNumber || ''),
    dispatchDate: (raw.dispatchDate as string) || null,
    estimatedDeliveryDate: (raw.estimatedDeliveryDate as string) || null,
    deliveredAt: (raw.deliveredAt as string) || null,
    feedback: hasFeedback
      ? {
          rating: feedbackRaw.rating ?? null,
          comments: feedbackRaw.comments || '',
          interestedInOrder: feedbackRaw.interestedInOrder ?? null,
          requiresImprovement: Boolean(feedbackRaw.requiresImprovement),
          routedDepartment: feedbackRaw.routedDepartment || 'None',
          improvementNotes: feedbackRaw.improvementNotes || '',
          routedTaskId: feedbackRaw.routedTaskId || null,
          feedbackDate: feedbackRaw.feedbackDate || null,
          submittedBy: feedbackRaw.submittedBy || null,
        }
      : null,
    createdBy: (raw.createdBy as string) || undefined,
    updatedBy: (raw.updatedBy as string) || undefined,
    isDeleted: Boolean(raw.isDeleted),
    createdAt: (raw.createdAt as string) || new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) || (raw.createdAt as string) || new Date().toISOString(),
  };
}

export function nextSampleNumber(existing: SampleItem[], year = new Date().getFullYear()): string {
  const prefix = `SMP-${year}-`;
  const max = existing.reduce((highest, item) => {
    const value = String(item.sampleNumber || '');
    if (!value.startsWith(prefix)) return highest;
    const num = Number(value.slice(prefix.length));
    return Number.isFinite(num) ? Math.max(highest, num) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}
