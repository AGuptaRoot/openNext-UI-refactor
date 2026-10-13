export type ProjectStatus =
  | 'Not Started'
  | 'In Progress'
  | 'On Hold'
  | 'Completed'
  | 'Cancelled'
  | string;

export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Urgent' | string;

export type ProgressCalculationMethod = 'tasks' | 'time' | 'manual';

export interface ProjectItem {
  _id: string;
  name: string;
  description?: string;
  clientId: string;
  clientName?: string;
  category?: string;
  label?: string;
  tags?: string[];
  priority: ProjectPriority;
  status: ProjectStatus;
  budget?: number;
  currency?: string;
  hoursEstimate?: number;
  progressCalculationMethod?: ProgressCalculationMethod;
  startDate?: string | null;
  deadline?: string | null;
  assignedTo?: string[];
  createdBy?: string;
  customFields?: Record<string, string | number | boolean | null>;
  isArchived?: boolean;
  isDropped?: boolean;
  droppedReason?: string | null;
  previousStatus?: ProjectStatus | null;
  /** Public go-live URL when project status is Live */
  liveUrl?: string | null;
  progress?: number;
  taskCount?: number;
  completedTaskCount?: number;
  memberCount?: number;
  assignedUsername?: string;
  assignedUsernames?: string[];
  ownerName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectCreateInput {
  name: string;
  clientId: string;
  clientName?: string;
  description?: string;
  category?: string;
  label?: string;
  tags?: string[];
  priority?: ProjectPriority;
  status?: ProjectStatus;
  budget?: number;
  currency?: string;
  hoursEstimate?: number;
  progressCalculationMethod?: ProgressCalculationMethod;
  startDate?: string | null;
  deadline?: string | null;
  assignedTo?: string[];
  customFields?: Record<string, string | number | boolean | null>;
  templateId?: string;
  liveUrl?: string | null;
}

export interface ProjectQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  category?: string;
  label?: string;
  tag?: string;
  clientId?: string;
  search?: string;
  isDropped?: boolean;
  dropped?: boolean;
  view?: string;
  isArchived?: boolean | 'all' | 'true' | 'false';
  archived?: boolean | 'all' | 'true' | 'false';
}

export interface ProjectPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProjectOverview {
  budget: number;
  earnings: number;
  expenses: number;
  profit: number;
  progress: number;
  hoursLogged: number;
  hoursEstimate: number;
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  currency?: string;
  /** Present when live API returns nested overview payload */
  blockedAwaitingClientTasks?: Array<{
    taskId: string;
    taskTitle?: string;
    dependsOnTaskTitle?: string;
    alertMessage?: string;
    clientFeedbackStatus?: string;
  }>;
  taskBreakdown?: Record<string, number>;
  hoursByUser?: Array<{ userName: string; hours: number }>;
}

export interface ProjectMember {
  _id?: string;
  userId: string;
  userName?: string;
  username?: string;
  displayName?: string;
  name?: string;
  email?: string;
  role?: string;
  designation?: string;
  tenantRole?: string;
  hourlyRate?: number;
  addedAt?: string;
}

export interface ProjectMilestone {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  summary?: string;
  cost?: number;
  addCostToBudget?: boolean;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectTaskSummary {
  _id: string;
  projectId: string;
  title: string;
  status: string;
  priority?: ProjectPriority;
  dueDate?: string | null;
  startDate?: string | null;
  assigneeName?: string;
  assigneeId?: string;
  milestoneId?: string | null;
  dependsOnTaskId?: string | null;
  notifyClientOnCompletion?: boolean;
  clientNotifiedAt?: string | null;
  clientNotifiedEmail?: string | null;
  lastReminderSentAt?: string | null;
  reminderCount?: number;
  isRecurring?: boolean;
  every?: number;
  interval?: string;
  cycles?: number;
  nextDate?: string | null;
  clientFeedbackStatus?: string;
  clientFeedbackNotes?: string;
  followers?: string[];
  isArchived?: boolean;
  hoursEstimate?: number;
  hoursLogged?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectDocument {
  _id: string;
  projectId: string;
  name: string;
  url: string;
  category?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  milestoneId?: string | null;
  taskId?: string | null;
  uploadedBy?: string;
  uploadedByName?: string;
  storageProvider?: string;
  createdAt?: string;
}

export interface ProjectTemplateMilestone {
  name: string;
  description?: string;
  order?: number;
  dueDayOffset?: number;
}

export interface ProjectTemplateTask {
  title: string;
  description?: string;
  milestoneIndex?: number | null;
  dayOffset?: number;
  dueDayOffset?: number;
  priority?: ProjectPriority;
  hoursEstimate?: number;
}

export interface ProjectTemplate {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  priority?: ProjectPriority;
  hoursEstimate?: number;
  budget?: number;
  currency?: string;
  tags?: string[];
  label?: string;
  progressCalculationMethod?: 'tasks' | 'time' | 'manual' | string;
  milestones?: Array<string | ProjectTemplateMilestone>;
  tasks?: ProjectTemplateTask[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectActivityEntry {
  _id: string;
  projectId: string;
  action: string;
  message: string;
  userName?: string;
  userId?: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface ProjectTimeLog {
  _id: string;
  projectId: string;
  taskId?: string;
  taskTitle?: string;
  userId?: string;
  userName?: string;
  hours: number;
  hourlyRate?: number;
  note?: string;
  description?: string;
  date?: string;
  workDate?: string;
  billable?: boolean;
  isBillable?: boolean;
  billableAmount?: number;
  entryType?: 'manual' | 'timer' | string;
  approvalStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectExpense {
  _id: string;
  projectId: string;
  title: string;
  amount: number;
  currency?: string;
  category?: string;
  status?: string;
  date?: string;
  note?: string;
  createdAt?: string;
}

export const DEFAULT_PROJECT_STATUSES: ProjectStatus[] = [
  'Not Started',
  'In Progress',
  'On Hold',
  'Completed',
  'Cancelled',
];

/** Built-in project statuses — always present; cannot be renamed or deleted in Settings. */
export const BUILTIN_PROJECT_STATUSES: readonly string[] = [...DEFAULT_PROJECT_STATUSES];

export function isBuiltinProjectStatus(name: string): boolean {
  const needle = String(name || '').trim().toLowerCase();
  return BUILTIN_PROJECT_STATUSES.some((s) => s.toLowerCase() === needle);
}

/** Merge so all builtins remain first, then unique custom statuses. */
export function mergeProjectStatusesWithBuiltins(statuses: string[] | undefined | null): string[] {
  const incoming = Array.isArray(statuses)
    ? statuses.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  const result = [...BUILTIN_PROJECT_STATUSES];
  for (const status of incoming) {
    if (!result.some((s) => s.toLowerCase() === status.toLowerCase())) {
      result.push(status);
    }
  }
  return result;
}

/** Optional custom status — when set on a project, a live URL is required and emailed to the client. */
export const LIVE_PROJECT_STATUS = 'Live';

export function isLiveProjectStatus(status?: string | null): boolean {
  return String(status || '').trim().toLowerCase() === 'live';
}

export function normalizeLiveUrl(url?: string | null): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidLiveUrl(url?: string | null): boolean {
  const normalized = normalizeLiveUrl(url);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const DEFAULT_PROJECT_PRIORITIES: ProjectPriority[] = [
  'Low',
  'Medium',
  'High',
  'Urgent',
];

export const DEFAULT_PROJECT_CATEGORIES: string[] = [
  'Web Development',
  'Mobile App',
  'UI/UX Design',
  'Marketing / SEO',
  'Cloud / DevOps',
  'Consulting',
  'Maintenance',
  'Internal',
];

export const DEFAULT_PROJECT_TAGS: string[] = [
  'Client Project',
  'Internal',
  'High Priority',
  'Bug Fix',
  'Feature MVP',
  'Maintenance',
  'Q3 Deliverable',
  'Design System',
];

export interface ProjectCurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

export const DEFAULT_PROJECT_CURRENCIES: ProjectCurrencyOption[] = [
  { code: 'INR', label: 'INR (₹) - Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'USD ($) - US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR (€) - Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP (£) - British Pound', symbol: '£' },
  { code: 'AED', label: 'AED (د.إ) - UAE Dirham', symbol: 'د.إ' },
  { code: 'CAD', label: 'CAD ($) - Canadian Dollar', symbol: '$' },
  { code: 'AUD', label: 'AUD ($) - Australian Dollar', symbol: '$' },
  { code: 'SGD', label: 'SGD ($) - Singapore Dollar', symbol: '$' },
];

export const DEFAULT_DOC_CATEGORIES: string[] = [
  'General',
  'Design',
  'Specification',
  'Contract',
  'Invoice',
  'Deliverable',
  'Source Code',
  'Asset',
  'Other',
];

export const CLIENT_FEEDBACK_STATUSES = [
  'Pending Review',
  'Satisfied',
  'Dissatisfied',
  'Not Replied',
] as const;

export const PROJECT_MILESTONE_STATUSES = [
  'Pending',
  'In Progress',
  'Completed',
  'Cancelled',
] as const;

export const DEFAULT_TASK_STATUSES = [
  'To Do',
  'In Progress',
  'Review',
  'Completed',
  'On Hold',
] as const;

export interface DeliverySettings {
  project_statuses?: string[];
  project_priorities?: string[];
  project_categories?: string[];
  project_tags?: string[];
  project_custom_fields?: Array<{ key?: string; name?: string; type?: string; label?: string }>;
  task_statuses?: string[];
  task_priorities?: string[];
  task_client_reminder_hours?: number;
  delivery_guidelines?: string;
}

export function priorityBadgeClass(priority?: string): string {
  switch (priority) {
    case 'Urgent':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'High':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Medium':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'Low':
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    default:
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
}

export function statusBadgeClass(status?: string): string {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Live':
      return 'bg-violet-50 text-violet-800 border-violet-200';
    case 'In Progress':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'On Hold':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Dropped':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Not Started':
    default:
      return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

export function computeProjectProgress(
  project: ProjectItem,
  tasks: ProjectTaskSummary[] = [],
  hoursLogged = 0
): number {
  if (project.progressCalculationMethod === 'manual' && project.progress != null) {
    return Math.min(100, Math.max(0, Number(project.progress) || 0));
  }
  if (project.progressCalculationMethod === 'time') {
    const est = Number(project.hoursEstimate) || 0;
    if (est <= 0) return 0;
    return Math.min(100, Math.round((hoursLogged / est) * 100));
  }
  const total = tasks.length || project.taskCount || 0;
  if (total <= 0) return Number(project.progress) || 0;
  const completed =
    tasks.filter((t) => t.status === 'Completed').length ||
    project.completedTaskCount ||
    0;
  return Math.min(100, Math.round((completed / total) * 100));
}
