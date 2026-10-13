export type SampleLinkType = 'lead' | 'client' | 'opportunity';

export type SampleUrgency = 'Low' | 'Normal' | 'High' | 'Urgent';

export type SampleStatus =
  | 'Requested'
  | 'Approved'
  | 'Rejected'
  | 'Preparing'
  | 'Dispatched'
  | 'Delivered'
  | 'Completed';

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
  urgency: SampleUrgency | string;
  deliveryAddress?: string;
  notes?: string;
  status: SampleStatus | string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
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
  urgency: SampleUrgency | string;
  deliveryAddress?: string;
  notes?: string;
  recipientName?: string;
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
];

export const SAMPLE_UNITS = [
  'pcs',
  'swatches',
  'meters',
  'kg',
  'grams',
  'liters',
  'sets',
  'rolls',
  'boxes',
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
  if (status === 'Requested') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Approved' || status === 'Preparing') return 'bg-sky-50 text-sky-800 border-sky-200';
  if (status === 'Dispatched') return 'bg-violet-50 text-violet-800 border-violet-200';
  if (status === 'Delivered' || status === 'Completed') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (status === 'Rejected') return 'bg-red-50 text-red-800 border-red-200';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

export function sampleUrgencyTone(urgency: string): string {
  if (urgency === 'Urgent') return 'bg-red-50 text-red-800 border-red-200';
  if (urgency === 'High') return 'bg-orange-50 text-orange-800 border-orange-200';
  if (urgency === 'Normal') return 'bg-sky-50 text-sky-800 border-sky-200';
  return 'bg-emerald-50 text-emerald-800 border-emerald-200';
}

export function sampleUrgencyEmoji(urgency: string): string {
  if (urgency === 'Urgent') return '🔴';
  if (urgency === 'High') return '🟠';
  if (urgency === 'Normal') return '🔵';
  return '🟢';
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
