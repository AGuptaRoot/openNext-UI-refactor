/** Employee work reports (Tasks → Reports): CRM managers and project managers only. */

export interface WorkTotals {
  hours: number;
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  billableHours: number;
  entries: number;
  tasks: number;
  projects: number;
  daysWorked: number;
  running: boolean;
}

export interface WorkReportEmployeeRow {
  userId: string;
  name: string;
  today: WorkTotals;
  month: WorkTotals;
  openTasks: number;
}

export interface WorkReportEmployees {
  date: string;
  dateLabel: string;
  month: string;
  monthLabel: string;
  timeZone: string;
  scope: 'all' | 'projects';
  items: WorkReportEmployeeRow[];
  totals: { employees: number; activeToday: number; hoursToday: number; hoursMonth: number };
}

export interface WorkReportTaskRow {
  taskId: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  entries: number;
  hours: number;
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  billableHours: number;
  daysWorked: number;
  running: boolean;
  firstStart: string | null;
  lastEnd: string | null;
}

export interface WorkReportDayRow {
  date: string;
  hours: number;
  approvedHours: number;
  entries: number;
  tasks: number;
  firstStart: string | null;
  lastEnd: string | null;
}

export interface WorkReportLogRow {
  _id: string;
  date: string;
  taskId: string;
  taskTitle: string;
  projectName: string;
  hours: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: 'Running' | 'Completed' | string;
  entryType: 'manual' | 'timer' | string;
  approvalStatus: 'Draft' | 'Pending' | 'Approved' | 'Rejected' | string;
  isBillable: boolean;
  description: string;
}

export interface EmployeeWorkReport {
  employee: { userId: string; name: string };
  period: 'day' | 'month';
  key: string;
  from: string;
  to: string;
  label: string;
  timeZone: string;
  summary: WorkTotals & { averageHoursPerDay: number };
  tasks: WorkReportTaskRow[];
  days: WorkReportDayRow[];
  logs: WorkReportLogRow[];
  assignedOpenTasks: {
    taskId: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    projectName: string;
    workedInPeriod: boolean;
  }[];
  truncated: boolean;
}

export interface WorkReportQuery {
  period?: 'day' | 'month';
  date?: string;
  month?: string;
}
