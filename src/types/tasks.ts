export type TaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Completed' | 'On Hold' | string;
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent' | string;
export type ClientFeedbackStatus =
  | 'Pending Review'
  | 'Pending Feedback'
  | 'Satisfied'
  | 'Dissatisfied'
  | 'Not Replied'
  | 'Awaiting Reply'
  | 'Pending'
  | 'Needs Attention'
  | string;

export interface TaskRecurrence {
  every?: number;
  interval?: 'day' | 'week' | 'month' | 'quarter' | 'year' | string;
  cycles?: number;
  nextDate?: string | null;
}

export interface TaskSubtask {
  _id: string;
  taskId: string;
  title: string;
  done: boolean;
  isCompleted?: boolean;
  currentDate?: string | null;
  dueDate?: string | null;
  assignedTo?: string;
  assigneeName?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskComment {
  _id: string;
  taskId: string;
  userId?: string;
  userName: string;
  body: string;
  createdAt: string;
}

export interface TaskItem {
  _id: string;
  projectId: string;
  projectName?: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  assigneeName?: string;
  dueDate?: string | null;
  startDate?: string | null;
  milestoneId?: string | null;
  dependsOnTaskId?: string | null;
  templateId?: string | null;
  notifyClientOnCompletion?: boolean;
  clientNotifiedAt?: string | null;
  clientNotifiedEmail?: string | null;
  lastReminderSentAt?: string | null;
  reminderCount?: number;
  reminderScheduleEnabled?: boolean;
  reminderIntervalType?: 'hours' | 'days' | 'weeks' | 'months';
  reminderIntervalValue?: number | null;
  isRecurring?: boolean;
  recurrence?: TaskRecurrence;
  every?: number;
  interval?: string;
  cycles?: number;
  nextDate?: string | null;
  clientSatisfied?: boolean | null;
  clientFeedbackStatus?: ClientFeedbackStatus;
  clientFeedbackNotes?: string;
  followers?: string[];
  followerCount?: number;
  followerUsers?: Array<{ id: string; username: string; displayName?: string }>;
  milestoneTitle?: string;
  assignedUsername?: string;
  subtaskCount?: number;
  subtasksCompletedCount?: number;
  dependsOnTaskTitle?: string;
  dependsOnTaskStatus?: string;
  isDependencyBlocked?: boolean;
  recurringEvery?: number;
  recurringInterval?: string;
  recurringTotalCycles?: number;
  recurringCyclesCompleted?: number;
  recurringNextDate?: string | null;
  clientName?: string;
  description?: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskCreateInput {
  projectId: string;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  dueDate?: string | null;
  startDate?: string | null;
  milestoneId?: string | null;
  dependsOnTaskId?: string | null;
  templateId?: string | null;
  notifyClientOnCompletion?: boolean;
  clientNotifiedAt?: string | null;
  clientNotifiedEmail?: string | null;
  lastReminderSentAt?: string | null;
  reminderCount?: number;
  reminderScheduleEnabled?: boolean;
  reminderIntervalType?: 'hours' | 'days' | 'weeks' | 'months';
  reminderIntervalValue?: number | null;
  isRecurring?: boolean;
  every?: number;
  interval?: string;
  cycles?: number;
  nextDate?: string | null;
  recurringEvery?: number;
  recurringInterval?: string;
  recurringTotalCycles?: number;
  recurringNextDate?: string | null;
  clientSatisfied?: boolean | null;
  clientFeedbackStatus?: ClientFeedbackStatus;
  clientFeedbackNotes?: string;
  followers?: string[];
  description?: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  subtasks?: Array<{
    title: string;
    description?: string;
    currentDate?: string | null;
    assignedTo?: string;
  }>;
}

export interface TaskQueryParams {
  page?: number;
  limit?: number;
  projectId?: string;
  milestoneId?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  clientFeedbackStatus?: string;
  isRecurring?: boolean | string;
  watching?: boolean | string;
  isArchived?: boolean | string;
  search?: string;
  overdue?: boolean | string;
  due?: string;
  ids?: string;
}

export interface TaskTemplateSubtask {
  title: string;
  description?: string;
}

export interface TaskTemplate {
  _id: string;
  name: string;
  title?: string;
  category?: string;
  priority?: TaskPriority;
  hoursEstimate?: number;
  tags?: string[];
  subtasks?: TaskTemplateSubtask[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Completed', 'On Hold'];
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const TASK_CLIENT_STATUSES = [
  'Pending Review',
  'Pending Feedback',
  'Satisfied',
  'Dissatisfied',
  'Not Replied',
  'Awaiting Reply',
];
