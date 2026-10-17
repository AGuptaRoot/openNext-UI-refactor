export type HealthCategory = 'Healthy' | 'At Risk' | 'Critical';

export interface CustomerSuccessSummary {
  totalAccounts: number;
  healthyCount: number;
  atRiskCount: number;
  criticalCount: number;
  healthyPercent?: number;
  avgCsat: number;
  totalFeedbacks: number;
}

export interface CustomerFeedbackItem {
  _id: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  orderId?: string | null;
  sampleId?: string | null;
  ticketId?: string | null;
  taskId?: string | null;
  taskIds?: string[];
  /** Related task name(s) shown in CSAT list columns. */
  taskName?: string;
  rating: number;
  category: string;
  comments?: string;
  submittedBy?: string;
  submittedAt?: string;
  createdAt?: string;
}

export interface CustomerFeedbackCreateInput {
  clientId: string;
  rating: number;
  category: string;
  comments?: string;
  orderId?: string;
  sampleId?: string;
  ticketId?: string;
  taskId?: string;
  taskIds?: string[];
  taskName?: string;
  taskNames?: string[];
  submittedBy?: string;
}

export interface HealthScoreFactors {
  csatScore: number;
  orderScore: number;
  ticketScore: number;
  paymentScore: number;
  avgCsat: number | null;
  feedbackCount: number;
  orderCount: number;
  daysSinceLastOrder: number | null;
  openTickets: number;
  breachedTickets: number;
  overdueInvoices: number;
}

export interface AccountHealthRecord {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  category?: string;
  status?: string;
  healthScore: number;
  healthCategory: HealthCategory;
  factors: HealthScoreFactors;
  recommendedAction: string;
  lastActivityAt?: string | null;
}

export interface FeedbackRatingSummary {
  total: number;
  avgCsat: number;
  distribution: Array<{ stars: number; count: number; percent: number }>;
}

export interface CustomerSuccessAccountQuery {
  search?: string;
  healthCategory?: string;
  page?: number;
  limit?: number;
}

export const CSAT_CATEGORIES = [
  'Product Quality',
  'Delivery Speed',
  'Customer Service',
  'Pricing',
  'General',
] as const;

export const CSAT_RATING_LABELS: Record<number, string> = {
  1: 'Terrible — 1 / 5',
  2: 'Poor — 2 / 5',
  3: 'Average — 3 / 5',
  4: 'Good — 4 / 5',
  5: 'Excellent — 5 / 5',
};

export function healthCategoryFromScore(score: number): HealthCategory {
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'At Risk';
  return 'Critical';
}

export function healthCategoryTone(category: HealthCategory): string {
  if (category === 'Healthy') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (category === 'At Risk') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-red-50 text-red-800 border-red-200';
}

export function healthCategoryDotClass(category: HealthCategory): string {
  if (category === 'Healthy') return 'bg-emerald-500';
  if (category === 'At Risk') return 'bg-amber-500';
  return 'bg-red-500';
}

/** @deprecated Use healthCategoryDotClass with a colored dot instead */
export function healthCategoryEmoji(_category: HealthCategory): string {
  return '';
}

export function computeCsatScore(ratings: number[]): { score: number; avg: number | null } {
  if (!ratings.length) return { score: 85, avg: null };
  const avg = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
  return { score: Math.round((avg / 5) * 100), avg: Math.round(avg * 10) / 10 };
}

export function computeOrderScore(orderCount: number, daysSinceLastOrder: number | null): number {
  let base = 50;
  if (orderCount >= 3) base = 100;
  else if (orderCount === 2) base = 80;
  else if (orderCount === 1) base = 65;
  let penalty = 0;
  if (daysSinceLastOrder != null) {
    if (daysSinceLastOrder > 90) penalty = 20;
    else if (daysSinceLastOrder > 60) penalty = 10;
  }
  return Math.max(20, base - penalty);
}

export function computeTicketScore(openTickets: number, breachedTickets: number): number {
  return Math.max(0, 100 - openTickets * 15 - breachedTickets * 25);
}

export function computePaymentScore(overdueInvoices: number): number {
  return Math.max(0, 100 - overdueInvoices * 30);
}

export function computeCompositeHealthScore(factors: {
  csatScore: number;
  orderScore: number;
  ticketScore: number;
  paymentScore: number;
}): number {
  const score = Math.round(
    factors.csatScore * 0.3 +
      factors.orderScore * 0.3 +
      factors.ticketScore * 0.3 +
      factors.paymentScore * 0.1
  );
  return Math.min(100, Math.max(0, score));
}

export function recommendRetentionAction(input: {
  healthCategory: HealthCategory;
  openTickets: number;
  overdueInvoices: number;
}): string {
  if (input.healthCategory === 'Critical') {
    if (input.openTickets > 0) return 'Escalate Open Complaints Immediately';
    if (input.overdueInvoices > 0) return 'Resolve Overdue Invoices & Payment Terms';
    return 'Executive VIP Intervention Needed';
  }
  if (input.healthCategory === 'At Risk') {
    if (input.openTickets > 0) return 'Priority Ticket Resolution';
    return 'Schedule Relationship Review Call';
  }
  return 'Propose Upsell & Renewal Contract';
}

export function buildHealthFactors(input: {
  ratings: number[];
  orderCount: number;
  lastOrderAt?: string | null;
  openTickets: number;
  breachedTickets: number;
  overdueInvoices: number;
}): HealthScoreFactors {
  const csat = computeCsatScore(input.ratings);
  const daysSinceLastOrder =
    input.lastOrderAt != null
      ? Math.floor((Date.now() - new Date(input.lastOrderAt).getTime()) / 86400000)
      : input.orderCount === 0
        ? null
        : null;
  const orderScore = computeOrderScore(input.orderCount, daysSinceLastOrder);
  const ticketScore = computeTicketScore(input.openTickets, input.breachedTickets);
  const paymentScore = computePaymentScore(input.overdueInvoices);
  return {
    csatScore: csat.score,
    orderScore,
    ticketScore,
    paymentScore,
    avgCsat: csat.avg,
    feedbackCount: input.ratings.length,
    orderCount: input.orderCount,
    daysSinceLastOrder,
    openTickets: input.openTickets,
    breachedTickets: input.breachedTickets,
    overdueInvoices: input.overdueInvoices,
  };
}

export function buildAccountHealth(input: {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  category?: string;
  status?: string;
  ratings: number[];
  orderCount: number;
  lastOrderAt?: string | null;
  openTickets: number;
  breachedTickets: number;
  overdueInvoices: number;
}): AccountHealthRecord {
  const factors = buildHealthFactors(input);
  const healthScore = computeCompositeHealthScore(factors);
  const healthCategory = healthCategoryFromScore(healthScore);
  return {
    clientId: input.clientId,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    category: input.category,
    status: input.status,
    healthScore,
    healthCategory,
    factors,
    recommendedAction: recommendRetentionAction({
      healthCategory,
      openTickets: input.openTickets,
      overdueInvoices: input.overdueInvoices,
    }),
    lastActivityAt: input.lastOrderAt || null,
  };
}

/** Normalize live API / mock account payloads into the UI AccountHealthRecord shape. */
export function normalizeAccountHealthRecord(raw: Record<string, unknown>): AccountHealthRecord {
  const factorsRaw = (raw.factors || {}) as Record<string, unknown>;
  const healthScore = Number(raw.healthScore ?? 0);
  const healthCategory = (raw.healthCategory as HealthCategory) || healthCategoryFromScore(healthScore);
  const openTickets = Number(
    raw.openTicketsCount ?? factorsRaw.openTickets ?? 0
  );
  const overdueInvoices = Number(
    raw.overdueInvoicesCount ?? factorsRaw.overdueInvoices ?? 0
  );
  const orderCount = Number(raw.repeatOrdersCount ?? factorsRaw.orderCount ?? 0);
  const avgCsatRaw = raw.csatAvg ?? factorsRaw.avgCsat;
  const avgCsat =
    avgCsatRaw == null || avgCsatRaw === ''
      ? null
      : Math.round(Number(avgCsatRaw) * 10) / 10;

  const factors: HealthScoreFactors = {
    csatScore: Number(factorsRaw.csatScore ?? 85),
    orderScore: Number(factorsRaw.orderScore ?? 50),
    ticketScore: Number(factorsRaw.ticketScore ?? 100),
    paymentScore: Number(factorsRaw.paymentScore ?? 100),
    avgCsat,
    feedbackCount: Number(raw.feedbackCount ?? factorsRaw.feedbackCount ?? 0),
    orderCount,
    daysSinceLastOrder:
      factorsRaw.daysSinceLastOrder == null ? null : Number(factorsRaw.daysSinceLastOrder),
    openTickets,
    breachedTickets: Number(raw.slaBreachedCount ?? factorsRaw.breachedTickets ?? 0),
    overdueInvoices,
  };

  return {
    clientId: String(raw.clientId || raw._id || ''),
    clientName: String(raw.clientName || raw.name || raw.companyName || 'Unknown account'),
    clientEmail: (raw.clientEmail || raw.email || undefined) as string | undefined,
    clientPhone: (raw.clientPhone || raw.phone || undefined) as string | undefined,
    category: (raw.category || raw.clientCategory || undefined) as string | undefined,
    status: (raw.status || undefined) as string | undefined,
    healthScore,
    healthCategory,
    factors,
    recommendedAction:
      (raw.recommendedAction as string) ||
      recommendRetentionAction({ healthCategory, openTickets, overdueInvoices }),
    lastActivityAt: (raw.lastOrderDate || raw.lastActivityAt || null) as string | null,
  };
}

export function normalizeFeedbackRatingSummary(raw: Record<string, unknown>): FeedbackRatingSummary {
  const total = Number(raw.total ?? raw.totalReviews ?? 0);
  const avgCsat = Number(raw.avgCsat ?? raw.averageRating ?? 0);
  const distributionRaw = raw.distribution;

  if (Array.isArray(distributionRaw)) {
    return {
      total,
      avgCsat,
      distribution: [5, 4, 3, 2, 1].map((stars) => {
        const row = distributionRaw.find(
          (item) => Number((item as { stars?: number }).stars) === stars
        ) as { count?: number; percent?: number } | undefined;
        const count = Number(row?.count || 0);
        return {
          stars,
          count,
          percent: Number(row?.percent ?? (total ? Math.round((count / total) * 100) : 0)),
        };
      }),
    };
  }

  const map = (distributionRaw || {}) as Record<string, number>;
  return {
    total,
    avgCsat,
    distribution: [5, 4, 3, 2, 1].map((stars) => {
      const count = Number(map[String(stars)] || 0);
      return {
        stars,
        count,
        percent: total ? Math.round((count / total) * 100) : 0,
      };
    }),
  };
}
