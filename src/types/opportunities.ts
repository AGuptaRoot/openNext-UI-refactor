export type OpportunityStage =
  | 'Discovery'
  | 'Requirement Confirmed'
  | 'Product Validated'
  | 'Sample Approved'
  | 'Commercial Discussion'
  | 'Quotation Sent'
  | 'Won'
  | 'Negotiation'
  | 'Lost'
  | string;

export interface OpportunityProductLine {
  productName: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  amount: number;
}

export interface OpportunityItem {
  _id: string;
  opportunityNumber?: string;
  title: string;
  leadId?: string | null;
  leadName?: string | null;
  clientId?: string;
  clientName?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactMobile?: string;
  /** Linked PersonContact from the Contacts directory */
  contactId?: string | null;
  products?: OpportunityProductLine[];
  expectedRevenue?: number;
  value?: number;
  currency?: string;
  shippingState?: string;
  shippingCharge?: number;
  probability?: number;
  weightedRevenue?: number;
  stage: OpportunityStage;
  /** Internal stage type from the opportunity pipeline (WON/LOST/NEGOTIATION/…). */
  stageType?: string | null;
  /** OpportunityPipeline id this deal belongs to. */
  pipelineId?: string | null;
  salesOwner?: string;
  salesOwnerName?: string;
  expectedCloseDate?: string | null;
  closedAt?: string | null;
  lostReason?: string | null;
  /** Latest quotation linked/generated from this deal. */
  generatedQuotationId?: string | null;
  generatedQuotationNo?: string | null;
  /** Final accepted quotation — locks further quotation creation. */
  acceptedQuotationId?: string | null;
  acceptedQuotationNo?: string | null;
  generatedSalesOrderId?: string | null;
  generatedSalesOrderNo?: string | null;
  description?: string;
  source?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpportunityCreateInput {
  title: string;
  /** Optional when leadId is provided */
  clientId?: string;
  clientName?: string;
  /** Optional when clientId is provided */
  leadId?: string;
  stage?: OpportunityStage;
  probability?: number;
  expectedRevenue?: number;
  value?: number;
  currency?: string;
  expectedCloseDate?: string;
  salesOwner?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactMobile?: string;
  /** Linked PersonContact id from the Contacts directory */
  contactId?: string;
  products?: OpportunityProductLine[];
  shippingState?: string;
  shippingCharge?: number;
  lostReason?: string;
  description?: string;
  source?: string;
}

export interface OpportunityQueryParams {
  page?: number;
  limit?: number;
  stage?: string;
  clientId?: string;
  leadId?: string;
  salesOwner?: string;
  search?: string;
}

export interface OpportunitySummary {
  totalDeals: number;
  pipelineValue: number;
  weightedForecast: number;
  wonRevenue: number;
  winRate?: number;
  openDeals?: number;
  wonDeals?: number;
  lostDeals?: number;
}

export interface OpportunityPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const OPPORTUNITY_STAGES: {
  key: string;
  label: string;
  probability: number;
  icon: string;
  color: string;
  desc: string;
}[] = [
  {
    key: 'Discovery',
    label: 'Discovery',
    probability: 10,
    icon: '🔍',
    color: '#64748b',
    desc: 'Initial qualification & customer discovery',
  },
  {
    key: 'Requirement Confirmed',
    label: 'Requirement Confirmed',
    probability: 25,
    icon: '📋',
    color: '#3b82f6',
    desc: 'Technical & business needs documented',
  },
  {
    key: 'Product Validated',
    label: 'Product Validated',
    probability: 40,
    icon: '🧪',
    color: '#06b6d4',
    desc: 'Solution architecture & specs agreed',
  },
  {
    key: 'Sample Approved',
    label: 'Sample Approved',
    probability: 55,
    icon: '✅',
    color: '#10b981',
    desc: 'Prototype / material swatch tested & accepted',
  },
  {
    key: 'Commercial Discussion',
    label: 'Commercial Discussion',
    probability: 70,
    icon: '💬',
    color: '#8b5cf6',
    desc: 'Pricing, payment terms & timeline review',
  },
  {
    key: 'Quotation Sent',
    label: 'Quotation Sent',
    probability: 95,
    icon: '📨',
    color: '#6366f1',
    desc: 'Formal quotation issued to the customer',
  },
  {
    key: 'Won',
    label: 'Won (Closed)',
    probability: 100,
    icon: '🏆',
    color: '#059669',
    desc: 'Deal successfully won & ready for quotation / order',
  },
  {
    key: 'Negotiation',
    label: 'Negotiation',
    probability: 85,
    icon: '🤝',
    color: '#f59e0b',
    desc: 'Final contract terms & discount discussion',
  },
  {
    key: 'Lost',
    label: 'Lost',
    probability: 0,
    icon: '❌',
    color: '#ef4444',
    desc: 'Opportunity abandoned or lost to competitor',
  },
];

export const DEFAULT_OPPORTUNITY_STAGE_NAMES = OPPORTUNITY_STAGES.map((s) => s.key);

export const DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES: Record<string, number> = Object.fromEntries(
  OPPORTUNITY_STAGES.map((s) => [s.key, s.probability])
);

const STAGE_PALETTE = ['#64748b', '#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#6366f1', '#059669', '#ef4444'];

/** Remap retired stage names so older settings/data keep working. */
export function normalizeOpportunityStageName(stage?: string | null): string {
  const key = String(stage || '').trim();
  if (/^contract reviews?$/i.test(key)) return 'Quotation Sent';
  return key;
}

/** Merge settings stage names (+ probabilities) with visual defaults for opportunity UI. */
export function buildOpportunityStages(
  stageNames?: string[] | null,
  probabilities?: Record<string, number> | null
): typeof OPPORTUNITY_STAGES {
  const rawNames =
    Array.isArray(stageNames) && stageNames.length
      ? stageNames.map((n) => normalizeOpportunityStageName(n)).filter(Boolean)
      : DEFAULT_OPPORTUNITY_STAGE_NAMES;
  const names: string[] = [];
  for (const name of rawNames) {
    if (!names.includes(name)) names.push(name);
  }
  // Negotiation must sit immediately after Won on opportunity boards.
  const negIdx = names.findIndex((name) => /negotiat/i.test(name));
  const wonIdx = names.findIndex((name) => name.trim().toLowerCase() === 'won');
  if (negIdx >= 0 && wonIdx >= 0 && negIdx !== wonIdx + 1) {
    const [negotiation] = names.splice(negIdx, 1);
    const newWonIdx = names.findIndex((name) => name.trim().toLowerCase() === 'won');
    names.splice(newWonIdx >= 0 ? newWonIdx + 1 : names.length, 0, negotiation);
  }
  return names.map((name, index) => {
    const known = OPPORTUNITY_STAGES.find((s) => s.key === name);
    const legacyProb =
      probabilities && Number.isFinite(Number(probabilities['Contract Review']))
        ? Number(probabilities['Contract Review'])
        : undefined;
    const prob =
      probabilities && Number.isFinite(Number(probabilities[name]))
        ? Math.min(100, Math.max(0, Math.round(Number(probabilities[name]))))
        : name === 'Quotation Sent' && Number.isFinite(legacyProb)
          ? Math.min(100, Math.max(0, Math.round(legacyProb as number)))
          : known?.probability ?? 50;
    return {
      key: name,
      label: known?.label || name,
      probability: prob,
      icon: known?.icon || '📍',
      color: known?.color || STAGE_PALETTE[index % STAGE_PALETTE.length],
      desc: known?.desc || '',
    };
  });
}

export function isOpportunityWonStage(stage?: string | null, stageType?: string | null): boolean {
  if (String(stageType || '').trim().toUpperCase() === 'WON') return true;
  return String(stage || '').trim().toLowerCase() === 'won';
}

export function isOpportunityLostStage(stage?: string | null, stageType?: string | null): boolean {
  if (String(stageType || '').trim().toUpperCase() === 'LOST') return true;
  return String(stage || '').trim().toLowerCase() === 'lost';
}

export const DEAL_TEMPLATES = [
  {
    label: 'Enterprise Software License',
    title: 'Enterprise Software Subscription Deal',
    items: [
      { name: 'Root CRM Enterprise Tier (Annual)', qty: 1, price: 180000, tax: 18 },
      { name: 'Dedicated Onboarding & Integration Support', qty: 1, price: 45000, tax: 18 },
    ],
  },
  {
    label: 'Annual AMC & Support',
    title: 'Annual Maintenance & Support Contract (AMC)',
    items: [
      {
        name: 'Comprehensive System Maintenance & SLA Support (12 Mo)',
        qty: 1,
        price: 65000,
        tax: 18,
      },
    ],
  },
  {
    label: 'Custom Software Development',
    title: 'Custom Engineering & Implementation Sprint',
    items: [
      { name: 'Full-Stack Architecture & Feature Development', qty: 160, price: 1200, tax: 18 },
      { name: 'QA Testing & Automated Deployment Setup', qty: 40, price: 900, tax: 18 },
    ],
  },
  {
    label: 'Bulk Material Supply Agreement',
    title: 'Commercial Material Supply Contract',
    items: [
      { name: 'Grade A Industrial Raw Material Swatches / Units', qty: 500, price: 450, tax: 12 },
      { name: 'Custom Finishing & Batch Packaging', qty: 1, price: 15000, tax: 18 },
    ],
  },
];

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Puducherry',
  'Chandigarh',
  'Jammu and Kashmir',
  'Ladakh',
];

export const DEFAULT_STATE_SHIPPING_RATES: Record<string, number> = {
  Maharashtra: 100,
  Karnataka: 150,
  'Tamil Nadu': 180,
  Telangana: 160,
  Delhi: 200,
  Gujarat: 140,
  Rajasthan: 170,
  'Uttar Pradesh': 190,
  'West Bengal': 220,
  Kerala: 200,
  Punjab: 180,
  Haryana: 160,
};

export function stageProbability(
  stage: string,
  stages?: Array<{ key: string; probability: number }> | null
): number {
  const fromList = stages?.find((s) => s.key === stage)?.probability;
  if (Number.isFinite(fromList)) return Number(fromList);
  if (Number.isFinite(DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES[stage])) {
    return DEFAULT_OPPORTUNITY_STAGE_PROBABILITIES[stage];
  }
  return OPPORTUNITY_STAGES.find((s) => s.key === stage)?.probability ?? 10;
}

export function calcLineAmount(qty: number, unitPrice: number, tax: number): number {
  const base = qty * unitPrice;
  return Math.round((base + (base * tax) / 100) * 100) / 100;
}

/** Stage is locked after an accepted quotation or sales order — not after draft/sent quotes. */
export function isOpportunityStageLocked(
  item: Pick<OpportunityItem, 'acceptedQuotationId' | 'generatedSalesOrderId' | 'generatedQuotationId' | 'stage'>
): boolean {
  return Boolean(item.acceptedQuotationId || item.generatedSalesOrderId);
}

export function opportunityLockLabel(
  item: Pick<OpportunityItem, 'acceptedQuotationId' | 'generatedSalesOrderId' | 'generatedQuotationId'>
): string {
  if (item.generatedSalesOrderId) return '🔒 Sales Order Generated';
  if (item.acceptedQuotationId) return '🔒 Quotation Accepted';
  return '';
}

/** Whether a new quotation may still be created for this opportunity. */
export function canCreateOpportunityQuotation(
  item: Pick<OpportunityItem, 'acceptedQuotationId' | 'generatedSalesOrderId' | 'stage'>
): boolean {
  if (item.acceptedQuotationId || item.generatedSalesOrderId) return false;
  if (isOpportunityWonStage(item.stage) || isOpportunityLostStage(item.stage)) return false;
  return true;
}

export function computeOpportunityFinancials(
  products: OpportunityProductLine[] = [],
  shippingCharge = 0,
  probability = 10
): { subtotal: number; taxTotal: number; expectedRevenue: number; weightedRevenue: number } {
  const subtotal = products.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const taxTotal = products.reduce((sum, line) => {
    const base = Number(line.quantity || 0) * Number(line.unitPrice || 0);
    return sum + (base * Number(line.tax || 0)) / 100;
  }, 0);
  const expectedRevenue = Math.round((subtotal + taxTotal + Number(shippingCharge || 0)) * 100) / 100;
  const weightedRevenue = Math.round((expectedRevenue * Number(probability || 0)) / 100);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    expectedRevenue,
    weightedRevenue,
  };
}
