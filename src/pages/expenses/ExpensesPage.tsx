import { displayLabel, displayUserLabel } from '../../utils/displayLabels';
﻿import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXPENSE_CURRENCIES,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_STATUSES,
  RECURRING_END_CONDITIONS,
  RECURRING_FREQUENCIES,
  formatExpenseMoney,
  frequencyLabel,
  type ExpenseItem,
  type ExpensePaymentMode,
  type RecurringEndCondition,
  type RecurringExpenseCreateInput,
  type RecurringExpenseFrequency,
  type RecurringExpenseItem,
  type RecurringForecastReport,
} from '../../types/expenses';
import type { AssignableUser } from '../../types/leads';
import type { ProjectItem } from '../../types/projects';
import {
  financeFieldClass,
  financeTextAreaClass,
} from '../../components/finance/FinanceFormElements';
import { triggerFileDownload } from '../../utils/fileDownload';

type MainTab = 'expenses' | 'recurring';
type ArchiveView = 'active' | 'archived';

const fieldClass =
  'h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-400';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-zinc-100 text-zinc-700',
    Submitted: 'bg-amber-50 text-amber-800',
    Approved: 'bg-emerald-50 text-emerald-800',
    Rejected: 'bg-red-50 text-red-800',
    Active: 'bg-emerald-50 text-emerald-800',
    Paused: 'bg-amber-50 text-amber-800',
    Completed: 'bg-sky-50 text-sky-800',
    Success: 'bg-emerald-50 text-emerald-800',
    Failed: 'bg-red-50 text-red-800',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(value?: string | null): string {
  if (!value) return 'â€”';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'â€”';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function endConditionLabel(value: RecurringEndCondition | string): string {
  if (value === 'after_cycles') return 'After cycles';
  if (value === 'on_date') return 'On date';
  return 'Never';
}

const emptyRecurringForm = (): RecurringExpenseCreateInput => ({
  profileName: '',
  category: 'Other',
  itemName: '',
  vendorName: '',
  price: 0,
  currency: 'INR',
  frequency: 'monthly',
  customIntervalDays: 30,
  startDate: localToday(),
  endCondition: 'never',
  totalCycles: 12,
  endDate: '',
  employeeId: '',
  projectId: '',
  paymentMode: 'Bank Transfer',
  isBillable: false,
  description: '',
});

export const ExpensesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { confirm } = useDialog();
  const canApproveExpenses = hasPermission('crm.expenses.approve');
  const [tab, setTab] = useState<MainTab>('expenses');
  const [archiveView, setArchiveView] = useState<ArchiveView>('active');

  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpenseItem[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [employees, setEmployees] = useState<AssignableUser[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListPaginationMeta | null>(null);

  useEffect(() => {
    const nextStatus = searchParams.get('status') || '';
    const nextCategory = searchParams.get('category') || '';
    setStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setCategory((prev) => (prev === nextCategory ? prev : nextCategory));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (status) params.set('status', status);
    else params.delete('status');
    if (category) params.set('category', category);
    else params.delete('category');
    setSearchParams(params, { replace: true });
  }, [status, category]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onArchive = (e: Event) => {
      const archivedFlag = (e as CustomEvent<{ archived?: boolean }>).detail?.archived;
      if (typeof archivedFlag === 'boolean') {
        setArchiveView(archivedFlag ? 'archived' : 'active');
        setTab('expenses');
      }
    };
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<{ tab?: MainTab }>).detail?.tab;
      if (next === 'expenses' || next === 'recurring') setTab(next);
    };
    window.addEventListener('crm-expenses-tour-archive', onArchive as EventListener);
    window.addEventListener('crm-expenses-tour-tab', onTab as EventListener);
    return () => {
      window.removeEventListener('crm-expenses-tour-archive', onArchive as EventListener);
      window.removeEventListener('crm-expenses-tour-tab', onTab as EventListener);
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<RecurringExpenseCreateInput>(emptyRecurringForm);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [logsItem, setLogsItem] = useState<RecurringExpenseItem | null>(null);

  const [forecastOpen, setForecastOpen] = useState(false);
  const [forecastDays, setForecastDays] = useState(90);
  const [forecast, setForecast] = useState<RecurringForecastReport | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listExpenses({
        search: search || undefined,
        status: status || undefined,
        category: category || undefined,
        isArchived: archiveView === 'archived',
        page,
        limit: 20,
      });
      setItems(response.data || []);
      setPagination(response.pagination || null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [search, status, category, archiveView, page]);

  const loadRecurring = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listRecurringExpenses({
        search: search || undefined,
        category: category || undefined,
      });
      setRecurring(response.data || []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load recurring expenses');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category, archiveView]);

  useEffect(() => {
    Promise.all([
      crmApi.getExpenseCategories(),
      crmApi.getAssignableUsers(),
      crmApi.listProjects({ limit: 200 }),
    ])
      .then(([categoryResponse, employeeResponse, projectResponse]) => {
        setCategories(
          categoryResponse.data?.length ? categoryResponse.data : DEFAULT_EXPENSE_CATEGORIES
        );
        setEmployees(employeeResponse.data || []);
        setProjects(projectResponse.data || []);
      })
      .catch(() => {
        setCategories(DEFAULT_EXPENSE_CATEGORIES);
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === 'expenses') loadExpenses();
      else loadRecurring();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [tab, loadExpenses, loadRecurring]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRejectId(null);
        setScheduleOpen(false);
        setLogsItem(null);
        setForecastOpen(false);
        setExportOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const baseCurrencyTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.price || item.amount || 0) * Number(item.exchangeRate || 1),
        0
      ),
    [items]
  );

  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setCategory('');
  };

  const refresh = () => {
    setInfoMessage('');
    if (tab === 'expenses') loadExpenses();
    else loadRecurring();
  };

  const exportData = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    try {
      const response = await crmApi.exportExpenses({
        search: search || undefined,
        status: status || undefined,
        category: category || undefined,
        isArchived: archiveView === 'archived',
        format,
      });
      triggerFileDownload({
        filename: response.data.filename,
        content: response.data.content,
        format,
        mimeType: response.data.mimeType,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    }
  };

  const runAction = async (id: string, action: () => Promise<unknown>, successMsg?: string) => {
    setBusyId(id);
    setError('');
    try {
      await action();
      if (successMsg) setInfoMessage(successMsg);
      if (tab === 'expenses') await loadExpenses();
      else await loadRecurring();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  };

  const openExpense = (item: ExpenseItem, edit = false) => {
    navigate(`/expenses/${encodeURIComponent(item._id)}${edit ? '?edit=1' : ''}`);
  };

  const openEdit = (item: ExpenseItem) => {
    openExpense(item, true);
  };

  const submitReject = async () => {
    if (!rejectId) return;
    if (!rejectReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    if (rejectReason.trim().length > 500) {
      setError('Rejection reason must be 500 characters or fewer.');
      return;
    }
    setBusyId(rejectId);
    try {
      await crmApi.rejectExpense(rejectId, { reason: rejectReason.trim() });
      setRejectId(null);
      setRejectReason('');
      await loadExpenses();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reject failed');
    } finally {
      setBusyId('');
    }
  };

  const createSchedule = async () => {
    if (!scheduleForm.profileName.trim() || !scheduleForm.itemName.trim() || !scheduleForm.category) {
      setError('Schedule name, item name, and category are required.');
      return;
    }
    if (!(Number(scheduleForm.price) > 0)) {
      setError('Price must be greater than zero.');
      return;
    }
    if (!scheduleForm.startDate) {
      setError('Start date is required.');
      return;
    }
    if (scheduleForm.frequency === 'custom') {
      const days = Number(scheduleForm.customIntervalDays || 0);
      if (!(days >= 1 && days <= 365)) {
        setError('Custom interval must be between 1 and 365 days.');
        return;
      }
    }
    if (scheduleForm.endCondition === 'after_cycles' && !(Number(scheduleForm.totalCycles) >= 1)) {
      setError('Total cycles must be at least 1.');
      return;
    }
    if (scheduleForm.endCondition === 'on_date' && !scheduleForm.endDate) {
      setError('End date is required when end condition is On date.');
      return;
    }

    const employee = employees.find(
      (user) => user.id === scheduleForm.employeeId || user._id === scheduleForm.employeeId
    );
    const project = projects.find((item) => item._id === scheduleForm.projectId);

    setScheduleSaving(true);
    setError('');
    try {
      await crmApi.createRecurringExpense({
        ...scheduleForm,
        profileName: scheduleForm.profileName.trim(),
        itemName: scheduleForm.itemName.trim(),
        vendorName: scheduleForm.vendorName?.trim() || '',
        price: Number(scheduleForm.price),
        amount: Number(scheduleForm.price),
        employeeName: employee?.name || employee?.displayName || '',
        clientId: project?.clientId || '',
        description: scheduleForm.description?.trim() || '',
        endDate: scheduleForm.endCondition === 'on_date' ? scheduleForm.endDate : undefined,
        totalCycles:
          scheduleForm.endCondition === 'after_cycles' ? Number(scheduleForm.totalCycles) : undefined,
        customIntervalDays:
          scheduleForm.frequency === 'custom' ? Number(scheduleForm.customIntervalDays) : undefined,
      });
      setScheduleOpen(false);
      setScheduleForm(emptyRecurringForm());
      setInfoMessage('Recurring schedule created.');
      await loadRecurring();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create schedule');
    } finally {
      setScheduleSaving(false);
    }
  };

  const loadForecast = async (days = forecastDays) => {
    setForecastLoading(true);
    setError('');
    try {
      const response = await crmApi.getRecurringExpenseForecast({ days });
      setForecast(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load forecast');
    } finally {
      setForecastLoading(false);
    }
  };

  const openForecast = async () => {
    setForecastOpen(true);
    await loadForecast(forecastDays);
  };

  const renderExpenseActions = (item: ExpenseItem) => {
    const archived = Boolean(item.isArchived) || archiveView === 'archived';
    const busy = busyId === item._id;

    if (archived) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction(item._id, () => crmApi.restoreExpense(item._id))}
          className="h-7 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer disabled:opacity-50"
        >
          Restore
        </button>
      );
    }

    if (item.status === 'Draft') {
      return (
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={() => openEdit(item)} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer disabled:opacity-50">
            Edit
          </button>
          <button type="button" disabled={busy} onClick={() => runAction(item._id, () => crmApi.submitExpense(item._id))} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-amber-200 bg-amber-50 text-amber-900 cursor-pointer disabled:opacity-50">
            Submit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!(await confirm({ message: `Delete draft expense "${item.itemName}"?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
              runAction(item._id, () => crmApi.deleteExpense(item._id));
            }}
            className="h-7 px-2 text-[11px] font-semibold rounded-md border border-red-200 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      );
    }

    if (item.status === 'Submitted') {
      if (!canApproveExpenses) {
        return <span className="text-[11px] text-zinc-400">Awaiting approval</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={() => runAction(item._id, () => crmApi.approveExpense(item._id))} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 cursor-pointer disabled:opacity-50">
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRejectId(item._id);
              setRejectReason('');
            }}
            className="h-7 px-2 text-[11px] font-semibold rounded-md border border-red-200 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      );
    }

    if (item.status === 'Rejected') {
      return (
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={() => openEdit(item)} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer disabled:opacity-50">
            Edit
          </button>
          <button type="button" disabled={busy} onClick={() => runAction(item._id, () => crmApi.submitExpense(item._id))} className="h-7 px-2 text-[11px] font-semibold rounded-md border border-amber-200 bg-amber-50 text-amber-900 cursor-pointer disabled:opacity-50">
            Submit
          </button>
        </div>
      );
    }

    if (item.status === 'Approved') {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction(item._id, () => crmApi.archiveExpense(item._id))}
          className="h-7 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer disabled:opacity-50"
        >
          Archive
        </button>
      );
    }

    return <span className="text-xs text-zinc-400">â€”</span>;
  };

  return (
    <div data-tour="expenses-tour-landing" className="flex flex-col gap-5">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div data-tour="expenses-title">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">Finance</p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0">Expenses</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Claims, approvals, billables, and recurring spend schedules.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {tab === 'expenses' && (
            <div
              data-tour="expenses-base-currency"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 min-w-[180px]"
            >
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Base-currency total</div>
              <div className="mt-1 text-lg font-bold text-zinc-950">
                {formatExpenseMoney(baseCurrencyTotal, 'INR')}
              </div>
            </div>
          )}
          <TourButton
            moduleId="expenses"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer"
          />
        </div>
      </header>

      <div data-tour="expenses-main-tabs" className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 self-start">
        <button
          type="button"
          data-tour="expenses-tab-expenses"
          onClick={() => setTab('expenses')}
          className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer ${
            tab === 'expenses' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
          }`}
        >
          Expenses
        </button>
        <button
          type="button"
          data-tour="expenses-tab-recurring"
          onClick={() => setTab('recurring')}
          className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer ${
            tab === 'recurring' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
          }`}
        >
          Recurring Expenses
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {infoMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {infoMessage}
        </div>
      )}

      {tab === 'expenses' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              data-tour="expenses-archive-toggle"
              className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-white"
            >
              <button
                type="button"
                data-tour="expenses-tab-active"
                onClick={() => setArchiveView('active')}
                className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer ${
                  archiveView === 'active' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
                }`}
              >
                Active Expenses
              </button>
              <button
                type="button"
                data-tour="expenses-tab-archived"
                onClick={() => setArchiveView('archived')}
                className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer ${
                  archiveView === 'archived' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
                }`}
              >
                Archived
              </button>
            </div>
            <Link
              to="/expenses/create"
              data-tour="expenses-create-btn"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white no-underline"
            >
              <AddIcon sx={{ fontSize: 16 }} /> Create Expense
            </Link>
          </div>

          <div
            data-tour="expenses-filters"
            className="bg-white border border-zinc-300 rounded-xl p-4 flex flex-col lg:flex-row flex-wrap gap-3 items-stretch lg:items-center"
          >            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expense #, item, client, or vendor…"
              className={`${fieldClass} flex-1 min-w-[200px]`}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`${fieldClass} lg:w-40`}
            >
              <option value="">All statuses</option>
              {EXPENSE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${fieldClass} lg:w-48`}
            >
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center gap-1 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
            >
              <CloseIcon sx={{ fontSize: 14 }} /> Reset
            </button>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex h-9 items-center gap-1 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
            >
              <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
            </button>
            <div className="relative" data-tour="expenses-export-btn">
              <button
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-1 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <DownloadIcon sx={{ fontSize: 15 }} /> Export CSV
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-zinc-300 bg-white shadow-lg overflow-hidden">
                  <button
                    type="button"
                    data-tour="expenses-export-csv"
                    onClick={() => exportData('csv')}
                    className="block w-full text-left px-3 py-2 text-xs font-semibold hover:bg-zinc-50 border-0 bg-white cursor-pointer"
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    data-tour="expenses-export-json"
                    onClick={() => exportData('json')}
                    className="block w-full text-left px-3 py-2 text-xs font-semibold hover:bg-zinc-50 border-0 bg-white cursor-pointer border-t border-zinc-100"
                  >
                    Download JSON
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            data-tour="expenses-table"
            className="bg-white border border-zinc-300 rounded-xl overflow-hidden"
          >            {loading ? (
              <div className="p-12 text-center text-sm text-zinc-500">Loading expensesâ€¦</div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500">
                No expenses match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Expense No</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Claimant</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Billable</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr
                        key={item._id}
                        data-tour={index === 0 ? 'expenses-row-first' : undefined}
                        data-expense-id={index === 0 ? item._id : undefined}
                        className="border-t border-zinc-100 hover:bg-zinc-50 align-top cursor-pointer"
                        onClick={() => openExpense(item)}
                      >
                        <td className="px-4 py-3 font-semibold text-zinc-950">
                          <Link
                            to={`/expenses/${encodeURIComponent(item._id)}`}
                            className="text-zinc-950 no-underline hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {displayLabel(item.expenseNo)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-950">{item.itemName || item.title}</div>
                          {item.status === 'Rejected' && item.rejectionReason && (
                            <div className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                              Rejection: {item.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {formatDate(item.purchaseDate || item.expenseDate)}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {displayUserLabel(item.employeeName, item.employeeId)}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{item.purchasedFrom || 'â€”'}</td>
                        <td className="px-4 py-3 font-semibold">
                          {formatExpenseMoney(Number(item.price || item.amount || 0), item.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}
                            >
                              {item.status}
                            </span>
                            {item.isBilled && (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                âœ“ Billed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {item.isBillable ? 'Yes' : 'No'}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {renderExpenseActions(item)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ListPager pagination={pagination} onPageChange={setPage} label="expenses" />
          </div>
        </>
      )}

      {tab === 'recurring' && (
        <>
          <div
            data-tour="expenses-recurring-toolbar"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-tour="expenses-recurring-new-btn"
                onClick={() => {
                  setScheduleForm(emptyRecurringForm());
                  setScheduleOpen(true);
                  setError('');
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white border-0 cursor-pointer"
              >
                <AddIcon sx={{ fontSize: 16 }} /> New Schedule
              </button>
              <button
                type="button"
                data-tour="expenses-recurring-run-due-btn"
                onClick={() =>
                  runAction('run-due', async () => {
                    const result = await crmApi.runDueRecurringExpenses();
                    setInfoMessage(result.data?.message || `Generated ${result.data?.generated || 0} expense(s).`);
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer"
              >
                Run Due Now
              </button>
              <button
                type="button"
                data-tour="expenses-recurring-forecast-btn"
                onClick={openForecast}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer"
              >
                Upcoming Forecast
              </button>
            </div>
            <button
              type="button"
              data-tour="expenses-recurring-refresh-btn"
              onClick={refresh}
              className="inline-flex h-9 items-center gap-1 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
            >
              <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
            </button>
          </div>

          <div
            data-tour="expenses-recurring-table"
            className="bg-white border border-zinc-300 rounded-xl overflow-hidden"
          >            {loading ? (
              <div className="p-12 text-center text-sm text-zinc-500">Loading schedulesâ€¦</div>
            ) : recurring.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500">No recurring schedules yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Frequency</th>
                      <th className="px-4 py-3">Next Run</th>
                      <th className="px-4 py-3">Cycles</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map((item) => {
                      const busy = busyId === item._id;
                      const cycleLabel =
                        item.endCondition === 'after_cycles' && item.totalCycles
                          ? `${item.cyclesCompleted || 0}/${item.totalCycles}`
                          : String(item.cyclesCompleted || 0);
                      return (
                        <tr key={item._id} className="border-t border-zinc-100 hover:bg-zinc-50">
                          <td className="px-4 py-3 font-semibold">{item.profileName}</td>
                          <td className="px-4 py-3">{item.itemName}</td>
                          <td className="px-4 py-3 text-zinc-600">{item.vendorName || 'â€”'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatExpenseMoney(Number(item.price || item.amount || 0), item.currency)}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {frequencyLabel(item.frequency)}
                            {item.frequency === 'custom' && item.customIntervalDays
                              ? ` (${item.customIntervalDays}d)`
                              : ''}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">{formatDate(item.nextRunDate)}</td>
                          <td className="px-4 py-3 text-zinc-600">{cycleLabel}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                disabled={busy || item.status === 'Completed'}
                                onClick={() =>
                                  runAction(item._id, () => crmApi.runRecurringExpenseNow(item._id), 'Expense generated.')
                                }
                                className="h-7 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer disabled:opacity-50"
                              >
                                Run Now
                              </button>
                              <button
                                type="button"
                                disabled={busy || item.status === 'Completed'}
                                onClick={() =>
                                  runAction(item._id, () => crmApi.toggleRecurringExpenseStatus(item._id))
                                }
                                className="h-7 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer disabled:opacity-50"
                              >
                                {item.status === 'Paused' ? 'Resume' : 'Pause'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setLogsItem(item)}
                                className="h-7 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer"
                              >
                                Logs
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  if (!(await confirm({ message: `Delete schedule "${item.profileName}"?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
                                  runAction(item._id, () => crmApi.deleteRecurringExpense(item._id));
                                }}
                                className="h-7 px-2 text-[11px] font-semibold rounded-md border border-red-200 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setRejectId(null)}>
          <aside
            className="h-full w-full max-w-md bg-white shadow-xl p-5 overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-bold m-0">Reject expense</h2>
            <p className="text-xs text-zinc-500 mt-1 mb-4">Provide a mandatory reason (max 500 characters).</p>
            <textarea
              className={financeTextAreaClass}
              rows={5}
              maxLength={500}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this claim being rejected?"
            />
            <div className="mt-1 text-[11px] text-zinc-400 text-right">{rejectReason.length}/500</div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectId(null)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === rejectId}
                onClick={submitReject}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-red-700 bg-red-700 text-white cursor-pointer disabled:opacity-50"
              >
                Reject Expense
              </button>
            </div>
          </aside>
        </div>
      )}

      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setScheduleOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-bold m-0">New recurring schedule</h2>
            <p className="text-xs text-zinc-500 mt-1 mb-4">Automate SaaS, rent, utilities, and retainers.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500 sm:col-span-2">
                Schedule name *
                <input
                  className={financeFieldClass}
                  maxLength={200}
                  value={scheduleForm.profileName}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, profileName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Category *
                <select
                  className={financeFieldClass}
                  value={scheduleForm.category}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Item name *
                <input
                  className={financeFieldClass}
                  maxLength={200}
                  value={scheduleForm.itemName}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, itemName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Vendor / merchant
                <input
                  className={financeFieldClass}
                  maxLength={200}
                  value={scheduleForm.vendorName || ''}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, vendorName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Price *
                <input
                  className={financeFieldClass}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={scheduleForm.price || ''}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, price: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Currency
                <select
                  className={financeFieldClass}
                  value={scheduleForm.currency}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  {EXPENSE_CURRENCIES.slice(0, 4).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Frequency
                <select
                  className={financeFieldClass}
                  value={scheduleForm.frequency}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      frequency: e.target.value as RecurringExpenseFrequency,
                    }))
                  }
                >
                  {RECURRING_FREQUENCIES.map((value) => (
                    <option key={value} value={value}>
                      {frequencyLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              {scheduleForm.frequency === 'custom' && (
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                  Custom interval (days)
                  <input
                    className={financeFieldClass}
                    type="number"
                    min={1}
                    max={365}
                    value={scheduleForm.customIntervalDays || 30}
                    onChange={(e) =>
                      setScheduleForm((f) => ({ ...f, customIntervalDays: Number(e.target.value) }))
                    }
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Start date *
                <input
                  className={financeFieldClass}
                  type="date"
                  value={scheduleForm.startDate}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                End condition
                <select
                  className={financeFieldClass}
                  value={scheduleForm.endCondition}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      endCondition: e.target.value as RecurringEndCondition,
                    }))
                  }
                >
                  {RECURRING_END_CONDITIONS.map((value) => (
                    <option key={value} value={value}>
                      {endConditionLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              {scheduleForm.endCondition === 'after_cycles' && (
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                  Total cycles
                  <input
                    className={financeFieldClass}
                    type="number"
                    min={1}
                    value={scheduleForm.totalCycles || 12}
                    onChange={(e) =>
                      setScheduleForm((f) => ({ ...f, totalCycles: Number(e.target.value) }))
                    }
                  />
                </label>
              )}
              {scheduleForm.endCondition === 'on_date' && (
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                  End date
                  <input
                    className={financeFieldClass}
                    type="date"
                    value={scheduleForm.endDate || ''}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Employee
                <select
                  className={financeFieldClass}
                  value={scheduleForm.employeeId || ''}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, employeeId: e.target.value }))}
                >
                  <option value="">Not assigned</option>
                  {employees.map((user) => (
                    <option key={user.id || user._id} value={user.id || user._id}>
                      {user.name || user.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Project
                <select
                  className={financeFieldClass}
                  value={scheduleForm.projectId || ''}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, projectId: e.target.value }))}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Payment mode
                <select
                  className={financeFieldClass}
                  value={scheduleForm.paymentMode || 'Bank Transfer'}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      paymentMode: e.target.value as ExpensePaymentMode,
                    }))
                  }
                >
                  {EXPENSE_PAYMENT_MODES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 mt-1">
                <input
                  type="checkbox"
                  checked={Boolean(scheduleForm.isBillable)}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, isBillable: e.target.checked }))}
                />
                Billable to project / client
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500 sm:col-span-2">
                Description & notes
                <textarea
                  className={financeTextAreaClass}
                  rows={3}
                  maxLength={2000}
                  value={scheduleForm.description || ''}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={scheduleSaving}
                onClick={createSchedule}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
              >
                {scheduleSaving ? 'Savingâ€¦' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {logsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLogsItem(null)}>
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold m-0">Execution logs</h2>
                <p className="text-xs text-zinc-500 mt-1 mb-0">{logsItem.profileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setLogsItem(null)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
            {(logsItem.executionLogs || []).length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">No execution history yet.</div>
            ) : (
              <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Run date</th>
                      <th className="px-4 py-3">Generated expense</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Error / notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(logsItem.executionLogs || [])]
                      .slice()
                      .reverse()
                      .map((log) => (
                        <tr key={log.runId} className="border-t border-zinc-100">
                          <td className="px-4 py-3 text-zinc-600">{formatDateTime(log.runDate)}</td>
                          <td className="px-4 py-3">
                            {log.expenseNo ? (
                              <span className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold">
                                {log.expenseNo}
                              </span>
                            ) : (
                              'â€”'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(log.status)}`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-600 max-w-sm">{log.error || 'â€”'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {forecastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setForecastOpen(false)}>
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold m-0">Upcoming forecast</h2>
                <p className="text-xs text-zinc-500 mt-1 mb-0">Projected recurring spend across the selected horizon.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className={financeFieldClass}
                  style={{ width: 'auto' }}
                  value={forecastDays}
                  onChange={(e) => {
                    const days = Number(e.target.value);
                    setForecastDays(days);
                    loadForecast(days);
                  }}
                >
                  {[30, 60, 90, 180, 365].map((days) => (
                    <option key={days} value={days}>
                      Next {days} days
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setForecastOpen(false)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white cursor-pointer"
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </button>
              </div>
            </div>

            {forecastLoading ? (
              <div className="p-10 text-center text-sm text-zinc-500">Loading forecastâ€¦</div>
            ) : forecast ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {[
                    {
                      label: 'Total projected',
                      value: formatExpenseMoney(forecast.totalProjected || 0, 'INR'),
                    },
                    {
                      label: 'Scheduled generations',
                      value: String(forecast.scheduledGenerations || 0),
                    },
                    {
                      label: 'Active profiles',
                      value: String(forecast.activeProfiles || 0),
                    },
                    {
                      label: 'Forecast horizon',
                      value: `${forecast.horizonDays || forecastDays} days`,
                    },
                  ].map((card) => (
                    <div key={card.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-[11px] font-semibold uppercase text-zinc-500">{card.label}</div>
                      <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
                    </div>
                  ))}
                </div>
                {(forecast.entries || []).length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">No scheduled generations in this horizon.</div>
                ) : (
                  <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Profile</th>
                          <th className="px-4 py-3">Vendor</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Cadence</th>
                          <th className="px-4 py-3">Cycle</th>
                          <th className="px-4 py-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecast.entries.map((entry, index) => (
                          <tr key={`${entry.profileId}-${entry.date}-${index}`} className="border-t border-zinc-100">
                            <td className="px-4 py-3 text-zinc-600">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3 font-semibold">{entry.profileName}</td>
                            <td className="px-4 py-3 text-zinc-600">{entry.vendorName || 'â€”'}</td>
                            <td className="px-4 py-3 text-zinc-600">{entry.category}</td>
                            <td className="px-4 py-3 text-zinc-600">{frequencyLabel(entry.frequency)}</td>
                            <td className="px-4 py-3 text-zinc-600">{entry.cycleNumber}</td>
                            <td className="px-4 py-3 font-semibold">
                              {formatExpenseMoney(entry.amount, entry.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">Forecast unavailable.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
