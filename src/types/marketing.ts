export type CampaignType =
  | 'Lost Lead Re-engagement'
  | 'Repeat Business Nurture'
  | 'Email Drip'
  | 'Promotional Announcement';

export type TargetAudience =
  | 'Lost Leads'
  | 'Unqualified Leads'
  | 'Dormant Clients (>90 days)'
  | 'All Contacts';

export type CampaignStatus = 'Draft' | 'Active' | 'Paused' | 'Completed';

export type ReEngagementStatus = 'Pending' | 'Approved' | 'Rejected';

export type WinBackTargetStage = 'Contacted' | 'Qualified' | 'Proposal' | 'Negotiation';

export type WinBackActionType =
  | 'Client Re-contacted & Ready'
  | 'Follow-up Call Success'
  | 'Accepted WinBack Offer'
  | 'Meeting / Demo Booked'
  | 'Email CTA Button Click';

export interface CampaignStats {
  sent: number;
  opened: number;
  clicked: number;
  reEngagedLeads: number;
  revenueGenerated: number;
}

export interface MarketingCampaign {
  _id: string;
  name: string;
  type: CampaignType | string;
  targetSegment: string;
  targetAudience?: string;
  emailSubject: string;
  subject?: string;
  emailContent: string;
  content?: string;
  initialStatus?: string;
  status: CampaignStatus | string;
  scheduledDate?: string | null;
  executedAt?: string | null;
  stats?: CampaignStats;
  createdBy?: string;
  updatedBy?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingCampaignCreateInput {
  name: string;
  type: string;
  targetSegment: string;
  emailSubject: string;
  emailContent: string;
  initialStatus: string;
}

export interface MarketingCampaignQuery {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export interface MarketingAudienceStats {
  lostLeads: number;
  unqualifiedLeads: number;
  dormantClients: number;
  totalContacts: number;
}

export interface MarketingAudienceRecipient {
  id: string;
  kind: 'lead' | 'client';
  name: string;
  company: string;
  email: string;
  phone?: string;
  stage?: string;
  expectedRevenue?: number;
}

export interface MarketingEligibleLead {
  _id: string;
  name: string;
  company: string;
  email: string;
  stage: string;
  status: string;
  expectedRevenue: number;
}

export interface ReEngagementRequest {
  _id: string;
  campaignId: string;
  campaignName: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  leadEmail: string;
  expectedRevenue: number;
  actionType: string;
  notes?: string;
  status: ReEngagementStatus | string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string;
  createdTaskId?: string | null;
  previousStage?: string;
  newStage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReEngageLeadInput {
  campaignId: string;
  leadId: string;
  targetStage: WinBackTargetStage | string;
  actionType: WinBackActionType | string;
  notes?: string;
}

export interface MarketingExecuteResult {
  success: boolean;
  sentCount: number;
  totalRecipients: number;
  message: string;
}

export interface MarketingSendTestInput {
  email: string;
}

export interface MarketingAnalyticsBreakdownRow {
  key: string;
  label: string;
  campaigns?: number;
  sent: number;
  reEngaged: number;
  conversionRate: number;
  revenue: number;
}

export interface MarketingLeaderboardRow {
  rank: number;
  campaignId: string;
  name: string;
  targetAudience: string;
  type: string;
  sent: number;
  reEngaged: number;
  conversionRate: number;
  revenue: number;
}

export interface MarketingAnalytics {
  totalSent: number;
  totalReEngaged: number;
  conversionRate: number;
  attributedRevenue: number;
  avgDeal: number;
  funnel: {
    audienceBase: number;
    dispatched: number;
    reEngaged: number;
    revenue: number;
  };
  bySegment: MarketingAnalyticsBreakdownRow[];
  byType: MarketingAnalyticsBreakdownRow[];
  leaderboard: MarketingLeaderboardRow[];
}

export interface PipelineReEntryEvent {
  _id: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  campaignId: string;
  campaignName: string;
  previousStage: string;
  newStage: string;
  actionType: string;
  expectedRevenue: number;
  createdAt: string;
}

export const CAMPAIGN_TYPES: CampaignType[] = [
  'Lost Lead Re-engagement',
  'Repeat Business Nurture',
  'Email Drip',
  'Promotional Announcement',
];

export const TARGET_SEGMENTS: TargetAudience[] = [
  'Lost Leads',
  'Unqualified Leads',
  'Dormant Clients (>90 days)',
  'All Contacts',
];

export const CAMPAIGN_STATUSES: CampaignStatus[] = ['Draft', 'Active', 'Paused', 'Completed'];

export const WINBACK_TARGET_STAGES: WinBackTargetStage[] = [
  'Contacted',
  'Qualified',
  'Proposal',
  'Negotiation',
];

export const WINBACK_ACTION_TYPES: WinBackActionType[] = [
  'Client Re-contacted & Ready',
  'Follow-up Call Success',
  'Accepted WinBack Offer',
  'Meeting / Demo Booked',
];

export const MERGE_TAG_HINTS = [
  '{{name}}',
  '{{company}}',
  '{{email}}',
  '{{phone}}',
  '{{cta_link}}',
  '{{cta_button}}',
] as const;

export const DEFAULT_CAMPAIGN_STATS = (): CampaignStats => ({
  sent: 0,
  opened: 0,
  clicked: 0,
  reEngagedLeads: 0,
  revenueGenerated: 0,
});

export function normalizeCampaign(
  raw: Partial<MarketingCampaign> & { _id?: string }
): MarketingCampaign {
  const target = raw.targetSegment || raw.targetAudience || 'Lost Leads';
  const subject = raw.emailSubject || raw.subject || '';
  const content = raw.emailContent || raw.content || '';
  const status = (raw.status || raw.initialStatus || 'Draft') as string;
  const stats = {
    ...DEFAULT_CAMPAIGN_STATS(),
    ...(raw.stats || {}),
  };
  return {
    ...raw,
    _id: raw._id || `campaign-${Date.now()}`,
    name: raw.name || 'Untitled Campaign',
    type: raw.type || 'Lost Lead Re-engagement',
    targetSegment: target,
    targetAudience: target,
    emailSubject: subject,
    subject,
    emailContent: content,
    content,
    initialStatus: status,
    status,
    scheduledDate: raw.scheduledDate ?? null,
    executedAt: raw.executedAt ?? null,
    stats,
    isDeleted: Boolean(raw.isDeleted),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

export function campaignStatusTone(status: string): string {
  if (status === 'Active') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'Paused') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Completed') return 'bg-sky-50 text-sky-800 border-sky-200';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

export function renderMarketingTemplate(
  template: string,
  recipient: { name?: string; company?: string; email?: string; phone?: string; ctaUrl?: string }
): string {
  const name = recipient.name?.trim() || 'Valued Customer';
  const company = recipient.company?.trim() || 'your company';
  const email = recipient.email?.trim() || '';
  const phone = recipient.phone?.trim() || '';
  const ctaUrl = recipient.ctaUrl || '#';
  const ctaButton = `<div style="margin: 24px 0; text-align: center;">
  <a href="${ctaUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    👉 Click Here — I am Interested / Request Quote
  </a>
</div>`;

  let output = String(template || '')
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*company\s*\}\}/gi, company)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*phone\s*\}\}/gi, phone)
    .replace(/\{\{\s*cta_link\s*\}\}/gi, ctaUrl)
    .replace(/\{\{\s*cta_button\s*\}\}/gi, ctaButton);

  const hasCtaToken = /\{\{\s*cta_(link|button)\s*\}\}/i.test(String(template || ''));
  if (!hasCtaToken) {
    output = `${output}\n${ctaButton}`;
  }
  return output;
}

export function formatMarketingMoney(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;
  }
}

export function conversionRate(sent: number, reEngaged: number): number {
  if (!sent) return 0;
  return Math.round((reEngaged / sent) * 1000) / 10;
}
