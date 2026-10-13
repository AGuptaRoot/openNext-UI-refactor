export const TICKET_STATUSES = [
  'Open',
  'In Progress',
  'Pending Client',
  'Resolved',
  'Closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_GROUPS = [
  'Technical',
  'Legal',
  'Installation',
  'Spam',
  'Very Important',
  'Billing',
  'Sales',
  'Customer Success',
] as const;

export const TICKET_TYPES = [
  'Service Request',
  'Bug',
  'Complaint',
  'Suggestion',
  'Question',
  'Product Feedback',
  'Inquiry',
  'Billing Issue',
  'Sales',
  'Code',
  'Management',
  'Problem',
  'Incident',
  'Feature Request',
] as const;

export const TICKET_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number] | string;

export const TICKET_CHANNELS = [
  'Email',
  'Phone',
  'Twitter',
  'Facebook',
  'Portal',
  'Chat',
  'WhatsApp',
  'Slack',
  'Zendesk',
] as const;

export const TICKET_QUICK_TAGS = [
  'Billing',
  'Bug',
  'Critical',
  'Installation',
  'V2',
  'Onboarding',
] as const;

export const ESCALATION_LEVELS = ['Standard', 'Level 2', 'Level 3', 'Supervisor'] as const;

export type EscalationLevel = (typeof ESCALATION_LEVELS)[number];

export const DEFAULT_PRIORITY_SLA_HOURS: Record<string, number> = {
  Urgent: 4,
  High: 24,
  Medium: 48,
  Low: 72,
};

export interface TicketAttachment {
  name?: string;
  url: string;
  size?: number;
  type?: string;
}

export interface TicketMessage {
  _id: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  message: string;
  isInternal?: boolean;
  attachments?: TicketAttachment[];
  createdAt?: string;
}

export interface TicketReassignmentEntry {
  fromUser?: string;
  toUser: string;
  toUserName?: string;
  reallocatedBy?: string;
  reason?: string;
  reassignedAt: string;
}

export interface CannedResponse {
  _id: string;
  title: string;
  body: string;
  createdAt?: string;
}

export interface TicketItem {
  _id: string;
  ticketNumber: string;
  requesterType?: 'Client' | 'Employee';
  requesterId?: string | null;
  requesterName?: string;
  requesterCompany?: string;
  clientId?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactMobile?: string;
  assignGroup: string;
  assignedTo?: string | null;
  assignedToName?: string;
  projectId?: string | null;
  projectName?: string;
  channelName: string;
  tags: string[];
  subject: string;
  description: string;
  type: string;
  priority: string;
  status: TicketStatus | string;
  slaDueDate: string;
  slaHours: number;
  slaBreached?: boolean;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string;
  satisfactionRating?: number | null;
  watchers?: string[];
  watcherNames?: string[];
  messages?: TicketMessage[];
  reassignmentHistory?: TicketReassignmentEntry[];
  escalationLevel?: EscalationLevel | string;
  isArchived?: boolean;
  isDeleted?: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TicketCreateInput {
  assignGroup: string;
  assignedTo?: string;
  projectId?: string | null;
  ticketType: string;
  type?: string;
  subject: string;
  description: string;
  priority: string;
  channel: string;
  channelName?: string;
  tags: string[];
  clientId?: string;
  requesterType?: 'Client' | 'Employee';
  requesterName?: string;
  requesterCompany?: string;
  slaHours?: number;
}

export interface TicketQueryParams {
  search?: string;
  status?: string;
  priority?: string;
  type?: string;
  assignGroup?: string;
  channelName?: string;
  clientId?: string;
  isArchived?: boolean | string;
  ids?: string;
  attention?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface TicketMessageInput {
  message: string;
  isInternal?: boolean;
  attachmentUrl?: string;
}

export interface TicketResolveInput {
  resolutionNotes: string;
  satisfactionRating: number;
}

export interface TicketReassignInput {
  assignedTo: string;
  assignedToName?: string;
  reason?: string;
}

export interface TicketEscalateInput {
  level: EscalationLevel | string;
  assignedTo?: string;
  assignedToName?: string;
  reason: string;
}

export function slaHoursForPriority(priority: string, customHours?: number): number {
  if (customHours != null && Number(customHours) > 0) return Number(customHours);
  return DEFAULT_PRIORITY_SLA_HOURS[priority] ?? 48;
}

export function computeSlaDueDate(createdAt: string | Date, slaHours: number): string {
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) {
    const now = new Date();
    now.setHours(now.getHours() + slaHours);
    return now.toISOString();
  }
  base.setTime(base.getTime() + slaHours * 3600 * 1000);
  return base.toISOString();
}

export type SlaBadgeTone = 'ok' | 'warning' | 'breached' | 'resolved-ok' | 'resolved-breached';

export function evaluateSla(ticket: Pick<TicketItem, 'slaDueDate' | 'slaBreached' | 'status' | 'resolvedAt'>): {
  tone: SlaBadgeTone;
  label: string;
  remainingMs: number;
  breached: boolean;
} {
  const due = new Date(ticket.slaDueDate).getTime();
  const completed = ['Resolved', 'Closed'].includes(String(ticket.status));
  const now = Date.now();
  const remainingMs = due - now;
  const breached = Boolean(ticket.slaBreached) || (!completed && remainingMs < 0) ||
    (completed && ticket.resolvedAt
      ? new Date(ticket.resolvedAt).getTime() > due
      : false);

  if (completed) {
    return {
      tone: breached ? 'resolved-breached' : 'resolved-ok',
      label: breached ? 'SLA Breached' : 'Resolved in SLA',
      remainingMs,
      breached,
    };
  }
  if (remainingMs < 0) {
    return { tone: 'breached', label: 'SLA Breached', remainingMs, breached: true };
  }
  if (remainingMs < 4 * 3600 * 1000) {
    return {
      tone: 'warning',
      label: formatRemaining(remainingMs),
      remainingMs,
      breached: false,
    };
  }
  return {
    tone: 'ok',
    label: formatRemaining(remainingMs),
    remainingMs,
    breached: false,
  };
}

export function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function slaToneClass(tone: SlaBadgeTone): string {
  switch (tone) {
    case 'ok':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'warning':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'breached':
    case 'resolved-breached':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'resolved-ok':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    default:
      return 'bg-zinc-50 text-zinc-700 border-zinc-200';
  }
}
