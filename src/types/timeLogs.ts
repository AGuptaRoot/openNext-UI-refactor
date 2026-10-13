export type TimeLogApprovalStatus =
  | 'Draft'
  | 'Pending'
  | 'Submitted'
  | 'Approved'
  | 'Rejected'
  | string;

export type TimeLogEntryType = 'manual' | 'timer' | string;

export interface TimeLogItem {
  _id: string;
  projectId?: string;
  projectName?: string;
  taskId: string;
  taskTitle?: string;
  userId?: string;
  userName?: string;
  username?: string;
  memberUsername?: string;
  assignedUsername?: string;
  taskAssignedUsername?: string;
  createdBy?: string;
  workDate: string;
  date?: string;
  hours: number;
  hourlyRate?: number;
  isBillable: boolean;
  billable?: boolean;
  billableAmount?: number;
  description?: string;
  note?: string;
  checkInAt?: string;
  checkInTime?: string;
  checkOutAt?: string;
  checkOutTime?: string;
  status?: 'Running' | 'Completed' | string;
  entryType?: TimeLogEntryType;
  approvalStatus?: TimeLogApprovalStatus;
  rejectionReason?: string;
  isLocked?: boolean;
  invoiceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeeklyTimesheetCell {
  taskId: string;
  taskTitle: string;
  projectId?: string;
  projectName?: string;
  days: Record<string, number>;
  dayMeta?: Record<string, { approvalStatus?: string; count?: number; notes?: string }>;
  total: number;
  billableTotal?: number;
}

export interface WeeklyTimesheet {
  weekStart: string;
  weekEnd: string;
  days: string[];
  rows: WeeklyTimesheetCell[];
  dayTotals: Record<string, number>;
  grandTotal: number;
  billableGrandTotal?: number;
}

export interface TimeLogCreateInput {
  taskId: string;
  projectId?: string;
  taskTitle?: string;
  workDate: string;
  date?: string;
  hours: number;
  hourlyRate?: number;
  isBillable?: boolean;
  description?: string;
  entryType?: TimeLogEntryType;
}

export interface TimeLogQueryParams {
  page?: number;
  limit?: number;
  projectId?: string;
  taskId?: string;
  userId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  approvalStatus?: string;
  entryType?: string;
  isLocked?: boolean | 'true' | 'false';
  isBillable?: boolean | 'true' | 'false';
  sortBy?: 'workDate' | 'taskTitle' | 'hours' | string;
  sortDir?: 'asc' | 'desc';
}

export interface TimeLogCheckInInput {
  taskId: string;
  projectId?: string;
  workDate?: string;
  hourlyRate?: number;
  isBillable?: boolean;
  description?: string;
}

export interface TimeLogCheckOutInput {
  timeLogId?: string;
  id?: string;
  description?: string;
  note?: string;
}

export interface TimeLogExportParams extends TimeLogQueryParams {
  format?: 'csv' | 'json';
}

export const TIME_DURATION_PRESETS = [
  { label: '+15m', hours: 0, minutes: 15 },
  { label: '+30m', hours: 0, minutes: 30 },
  { label: '+45m', hours: 0, minutes: 45 },
  { label: '1h', hours: 1, minutes: 0 },
  { label: '1.5h', hours: 1, minutes: 30 },
  { label: '2h', hours: 2, minutes: 0 },
  { label: '4h', hours: 4, minutes: 0 },
  { label: '8h', hours: 8, minutes: 0 },
] as const;

export function normalizeApprovalStatus(status?: string): TimeLogApprovalStatus {
  if (!status) return 'Draft';
  if (status === 'Submitted') return 'Pending';
  return status;
}

export function computeBillableAmount(hours: number, rate: number, isBillable: boolean): number {
  if (isBillable === false) return 0;
  const hrs = Number(hours || 0);
  const hourly = Number(rate || 0);
  if (!Number.isFinite(hrs) || !Number.isFinite(hourly) || hrs <= 0 || hourly <= 0) return 0;
  return Math.round(hrs * hourly * 100) / 100;
}

/** Live hours for a running check-in timer (falls back to stored hours). */
export function resolveTimeLogHours(item: {
  status?: string;
  hours?: number;
  checkInAt?: string;
  checkInTime?: string;
  createdAt?: string;
}): number {
  const stored = Number(item.hours || 0);
  if (String(item.status || '') !== 'Running') {
    return Number.isFinite(stored) ? stored : 0;
  }
  const startStr = item.checkInAt || item.checkInTime || item.createdAt;
  if (!startStr) return Math.max(0.01, stored || 0.01);
  const startMs = new Date(startStr).getTime();
  if (!Number.isFinite(startMs) || startMs <= 0) return Math.max(0.01, stored || 0.01);
  return Math.max(0.01, Math.round(((Date.now() - startMs) / 3600000) * 100) / 100);
}

export function resolveTimeLogBillableAmount(item: {
  status?: string;
  hours?: number;
  hourlyRate?: number;
  billableAmount?: number;
  isBillable?: boolean;
  billable?: boolean;
  checkInAt?: string;
  checkInTime?: string;
  createdAt?: string;
}): number {
  const isBillable = item.isBillable ?? item.billable;
  const hours = resolveTimeLogHours(item);
  const rate = Number(item.hourlyRate || 0);
  const computed = computeBillableAmount(hours, rate, isBillable !== false);
  const stored = Number(item.billableAmount);
  if (String(item.status || '') === 'Running') return computed;
  if (!Number.isFinite(stored) || (stored <= 0 && computed > 0)) return computed;
  return stored;
}
