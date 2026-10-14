import { formatCrmMoney } from '../utils/currency';

export type ExpenseStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

export type ExpensePaymentMode =
  | 'Cash'
  | 'Bank Transfer'
  | 'UPI'
  | 'Cheque'
  | 'Card'
  | 'Other';

export type RecurringExpenseFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'custom';

export type RecurringEndCondition = 'never' | 'on_date' | 'after_cycles';

export type RecurringExpenseStatus = 'Active' | 'Paused' | 'Completed';

export const EXPENSE_STATUSES: ExpenseStatus[] = ['Draft', 'Submitted', 'Approved', 'Rejected'];

export const EXPENSE_PAYMENT_MODES: ExpensePaymentMode[] = [
  'Bank Transfer',
  'Card',
  'UPI',
  'Cash',
  'Cheque',
  'Other',
];

export const EXPENSE_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'CAD',
  'AUD',
  'SGD',
  'JPY',
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Travel',
  'Software',
  'Office Supplies',
  'Marketing',
  'Hardware / Equipment',
  'Meals & Entertainment',
  'Professional Services',
  'Utilities',
  'Other',
];

export const RECURRING_FREQUENCIES: RecurringExpenseFrequency[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
  'custom',
];

export const RECURRING_END_CONDITIONS: RecurringEndCondition[] = [
  'never',
  'after_cycles',
  'on_date',
];

export interface ExpenseItem {
  _id: string;
  expenseNo: string;
  title?: string;
  itemName: string;
  amount: number;
  price: number;
  currency: string;
  exchangeRate: number;
  expenseDate: string;
  purchaseDate: string;
  category: string;
  employeeId?: string;
  employeeName?: string;
  purchasedFrom?: string;
  bankAccount?: string;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectName?: string;
  paymentMode?: ExpensePaymentMode | string;
  receiptUrl?: string;
  bill?: string;
  billUrl?: string;
  notes?: string;
  description?: string;
  status: ExpenseStatus;
  submittedAt?: string | null;
  approvedBy?: string;
  approvedAt?: string | null;
  rejectedBy?: string;
  rejectedAt?: string | null;
  rejectionReason?: string;
  isBillable?: boolean;
  isBilled?: boolean;
  billedInvoiceId?: string | null;
  billedInvoiceNo?: string;
  billedAt?: string | null;
  recurringProfileId?: string | null;
  recurringCycle?: number | null;
  isArchived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Legacy fields retained for older create forms */
  isRecurring?: boolean;
  recurringEvery?: number;
  recurringInterval?: string;
  recurringCycles?: number;
}

export interface ExpenseCreateInput {
  itemName: string;
  category: string;
  price: number;
  amount?: number;
  currency?: string;
  exchangeRate: number;
  purchaseDate: string;
  expenseDate?: string;
  purchasedFrom?: string;
  isBillable?: boolean;
  employeeId?: string;
  employeeName?: string;
  projectId?: string;
  clientId?: string;
  paymentMode?: string;
  bankAccount?: string;
  billUrl?: string;
  bill?: string;
  receiptUrl?: string;
  description?: string;
  notes?: string;
  /** When true, create as Submitted; otherwise Draft */
  submit?: boolean;
  status?: ExpenseStatus;
  isRecurring?: boolean;
  recurringEvery?: number;
  recurringInterval?: string;
  recurringCycles?: number;
}

export interface ExpenseQueryParams {
  page?: number;
  limit?: number;
  projectId?: string;
  clientId?: string;
  employeeId?: string;
  category?: string;
  status?: string;
  search?: string;
  isArchived?: boolean | string;
  isBillable?: boolean | string;
  isBilled?: boolean | string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface RecurringExecutionLog {
  runId: string;
  runDate: string;
  expenseId?: string;
  expenseNo?: string;
  status: 'Success' | 'Failed';
  error?: string;
}

export interface RecurringExpenseItem {
  _id: string;
  profileName: string;
  vendorName?: string;
  itemName: string;
  category: string;
  amount: number;
  price: number;
  currency: string;
  exchangeRate: number;
  frequency: RecurringExpenseFrequency;
  customIntervalDays?: number;
  startDate: string;
  nextRunDate: string;
  lastRunDate?: string | null;
  endCondition: RecurringEndCondition;
  endDate?: string | null;
  totalCycles?: number | null;
  cyclesCompleted: number;
  status: RecurringExpenseStatus;
  employeeId?: string;
  employeeName?: string;
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  bankAccount?: string;
  paymentMode?: ExpensePaymentMode | string;
  isBillable?: boolean;
  autoSubmit?: boolean;
  description?: string;
  notes?: string;
  executionLogs?: RecurringExecutionLog[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface RecurringExpenseCreateInput {
  profileName: string;
  itemName: string;
  category: string;
  price: number;
  amount?: number;
  currency?: string;
  exchangeRate?: number;
  vendorName?: string;
  frequency?: RecurringExpenseFrequency;
  customIntervalDays?: number;
  startDate: string;
  endCondition?: RecurringEndCondition;
  endDate?: string;
  totalCycles?: number;
  employeeId?: string;
  employeeName?: string;
  projectId?: string;
  clientId?: string;
  paymentMode?: string;
  bankAccount?: string;
  isBillable?: boolean;
  autoSubmit?: boolean;
  description?: string;
  notes?: string;
}

export interface RecurringExpenseQueryParams {
  status?: string;
  category?: string;
  search?: string;
}

export interface RecurringForecastEntry {
  date: string;
  profileId: string;
  profileName: string;
  vendorName?: string;
  category: string;
  frequency: RecurringExpenseFrequency;
  cycleNumber: number;
  amount: number;
  currency: string;
}

export interface RecurringForecastReport {
  horizonDays: number;
  totalProjected: number;
  scheduledGenerations: number;
  activeProfiles: number;
  entries: RecurringForecastEntry[];
}

export function formatExpenseMoney(amount: number, currency?: string): string {
  return formatCrmMoney(amount, currency);
}

export function frequencyLabel(frequency: RecurringExpenseFrequency | string): string {
  const map: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    half_yearly: 'Half-yearly',
    yearly: 'Yearly',
    custom: 'Custom',
  };
  return map[frequency] || frequency;
}
