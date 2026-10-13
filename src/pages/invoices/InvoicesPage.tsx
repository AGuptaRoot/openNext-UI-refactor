import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DocumentScannerOutlinedIcon from '@mui/icons-material/DocumentScannerOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { useFinanceOptions } from '../../components/finance/useFinanceOptions';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { FinancePdfScanModal } from '../../components/finance/FinancePdfScanModal';
import {
  INVOICE_STATUSES,
  RECURRING_INVOICE_FREQUENCIES,
  recurringInvoiceFrequencyLabel,
  type InvoiceItem,
  type InvoicePaginationMeta,
  type RecurringInvoiceCreateInput,
  type RecurringInvoiceItem,
} from '../../types/invoices';
import { triggerFileDownload } from '../../utils/fileDownload';
import { displayLabel } from '../../utils/displayLabels';

type MainTab = 'invoices' | 'recurring';

const PAGE_SIZE = 20;
const fieldClass =
  'h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-400';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-zinc-100 text-zinc-700',
    Sent: 'bg-sky-50 text-sky-800',
    Viewed: 'bg-indigo-50 text-indigo-800',
    'Partially Paid': 'bg-amber-50 text-amber-800',
    Paid: 'bg-emerald-50 text-emerald-800',
    Overdue: 'bg-red-50 text-red-800',
    'Written Off': 'bg-stone-100 text-stone-700',
    Cancelled: 'bg-rose-50 text-rose-800',
    Active: 'bg-emerald-50 text-emerald-800',
    Paused: 'bg-amber-50 text-amber-800',
    Completed: 'bg-zinc-100 text-zinc-600',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

function emptyScheduleForm(): RecurringInvoiceCreateInput {
  const today = new Date().toISOString().slice(0, 10);
  return {
    profileName: '',
    clientId: '',
    projectId: '',
    frequency: 'monthly',
    customIntervalDays: 30,
    startDate: today,
    nextRunDate: today,
    endCondition: 'never',
    endDate: null,
    totalCycles: null,
    currency: 'INR',
    paymentTermsDays: 30,
    lineItems: [{ name: '', description: '', qty: 1, rate: 0, tax: 18 }],
    discountType: 'percent',
    discountValue: 0,
    taxCalculation: 'after_discount',
    notes: '',
    terms: '',
    autoSendEmail: false,
    clientCanStopRecurring: false,
  };
}

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isClient } = useAuth();
  const { confirm } = useDialog();
  const canWriteFinance = hasPermission('crm.finance.write') && !isClient;
  const { clients, projects } = useFinanceOptions();

  const tabParam = searchParams.get('tab');
  const tab: MainTab = tabParam === 'recurring' ? 'recurring' : 'invoices';

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [kpiItems, setKpiItems] = useState<InvoiceItem[]>([]);
  const [pagination, setPagination] = useState<InvoicePaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [attentionIds, setAttentionIds] = useState(() => searchParams.get('ids') || '');
  const [archived, setArchived] = useState(false);
  const [filterRecurring, setFilterRecurring] = useState(false);
  const [profileFilter, setProfileFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const [recurring, setRecurring] = useState<RecurringInvoiceItem[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pdfScanOpen, setPdfScanOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<RecurringInvoiceCreateInput>(emptyScheduleForm());
  const [forecastOpen, setForecastOpen] = useState(false);
  const [forecastDays, setForecastDays] = useState(30);
  const [forecastItems, setForecastItems] = useState<
    Array<{
      profileId?: string;
      profileName?: string;
      clientName?: string;
      nextRunDate?: string;
      frequency?: string;
      amount?: number;
      currency?: string;
    }>
  >([]);
  const [logsOpen, setLogsOpen] = useState<RecurringInvoiceItem | null>(null);

  const setTab = (next: MainTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'recurring') params.set('tab', 'recurring');
    else params.delete('tab');
    setSearchParams(params, { replace: true });
  };

  const syncListParams = useCallback(
    (next: { status?: string; ids?: string }) => {
      const params = new URLSearchParams(searchParams);
      const nextStatus = next.status ?? status;
      const nextIds = next.ids ?? attentionIds;
      if (nextStatus) params.set('status', nextStatus);
      else params.delete('status');
      if (nextIds) params.set('ids', nextIds);
      else params.delete('ids');
      setSearchParams(params, { replace: true });
    },
    [attentionIds, searchParams, setSearchParams, status]
  );

  useEffect(() => {
    const nextStatus = searchParams.get('status') || '';
    const nextIds = searchParams.get('ids') || '';
    setStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setAttentionIds((prev) => (prev === nextIds ? prev : nextIds));
  }, [searchParams]);

  useEffect(() => {
    const onArchive = (e: Event) => {
      const archivedFlag = (e as CustomEvent<{ archived?: boolean }>).detail?.archived;
      if (typeof archivedFlag === 'boolean') {
        setArchived(archivedFlag);
        setTab('invoices');
      }
    };
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<{ tab?: MainTab }>).detail?.tab;
      if (next === 'invoices' || next === 'recurring') setTab(next);
    };
    window.addEventListener('crm-invoices-tour-archive', onArchive as EventListener);
    window.addEventListener('crm-invoices-tour-tab', onTab as EventListener);
    return () => {
      window.removeEventListener('crm-invoices-tour-archive', onArchive as EventListener);
      window.removeEventListener('crm-invoices-tour-tab', onTab as EventListener);
    };
  }, [searchParams, setSearchParams]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const common = {
        search: search || undefined,
        status: status || undefined,
        ids: attentionIds || undefined,
        archived,
        isRecurring: filterRecurring || undefined,
        recurringProfileId: profileFilter || undefined,
      };
      const [listRes, kpiRes] = await Promise.all([
        crmApi.listInvoices({ ...common, page, limit: PAGE_SIZE }),
        crmApi.listInvoices({ ...common, page: 1, limit: 500 }),
      ]);
      setItems(listRes.data || []);
      setPagination(
        listRes.pagination || {
          page,
          limit: PAGE_SIZE,
          total: listRes.data?.length || 0,
          totalPages: 1,
        }
      );
      setKpiItems(kpiRes.data || []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [search, status, attentionIds, archived, filterRecurring, profileFilter, page]);

  const loadRecurring = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listRecurringInvoices({
        search: search || undefined,
      });
      setRecurring(response.data || []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load recurring invoices');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [search, status, attentionIds, archived, filterRecurring, profileFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === 'recurring') void loadRecurring();
      else void loadInvoices();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [tab, loadInvoices, loadRecurring]);

  const kpis = useMemo(() => {
    const pool = kpiItems;
    const open = pool.filter((item) => !['Paid', 'Cancelled', 'Written Off'].includes(item.status));
    const overdue = pool.filter((item) => item.status === 'Overdue');
    const paid = pool.filter((item) => item.status === 'Paid');
    const recurringCount = pool.filter((item) => item.isRecurring || item.recurringProfileId).length;
    const outstanding = open.reduce(
      (sum, item) => sum + Number(item.balanceDue ?? item.grandTotal ?? 0),
      0
    );
    const collected = paid.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
    return {
      count: pagination?.total ?? pool.length,
      outstanding,
      overdue: overdue.length,
      collected,
      recurring: tab === 'recurring' ? recurring.length : recurringCount,
    };
  }, [kpiItems, pagination, recurring.length, tab]);

  const refresh = () => {
    if (tab === 'recurring') void loadRecurring();
    else void loadInvoices();
  };

  const runInvoiceAction = async (id: string, action: 'archive' | 'restore' | 'cancel') => {
    setBusyId(id);
    try {
      if (action === 'archive') await crmApi.archiveInvoice(id);
      if (action === 'restore') await crmApi.restoreInvoice(id);
      if (action === 'cancel') {
        if (!(await confirm({ message: 'Cancel / void this invoice?', tone: 'danger', confirmLabel: 'Cancel invoice' }))) return;
        await crmApi.cancelInvoice(id);
      }
      await loadInvoices();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  };

  const runRecurringAction = async (
    id: string,
    action: () => Promise<unknown>,
    successMessage?: string
  ) => {
    setBusyId(id);
    setError('');
    try {
      await action();
      if (successMessage) setInfoMessage(successMessage);
      await loadRecurring();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  };

  const exportData = async (format: 'csv' | 'json') => {
    try {
      const response = await crmApi.exportInvoices({
        search: search || undefined,
        status: status || undefined,
        archived,
        format,
      });
      triggerFileDownload({
        filename: response.data.filename,
        content: response.data.content,
        format,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    }
  };

  const submitSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const lines = (scheduleForm.lineItems || []).filter(
      (line) => (line.name || line.description) && Number(line.qty) >= 0 && Number(line.rate) >= 0
    );
    if (!scheduleForm.clientId) return setError('Client is required.');
    if (!lines.length) return setError('Add at least one line item.');
    setBusyId('schedule-create');
    try {
      const payload: RecurringInvoiceCreateInput = {
        ...scheduleForm,
        profileName:
          scheduleForm.profileName?.trim() ||
          `${recurringInvoiceFrequencyLabel(String(scheduleForm.frequency || 'monthly'))} Recurring Invoice`,
        lineItems: lines.map((line) => ({
          name: (line.name || line.description || '').trim(),
          description: (line.description || line.name || '').trim(),
          qty: Number(line.qty) || 1,
          rate: Number(line.rate) || 0,
          tax: Number(line.tax) || 0,
        })),
        endCondition: scheduleForm.endCondition || 'never',
        totalCycles:
          scheduleForm.endCondition === 'after_cycles'
            ? Math.max(1, Number(scheduleForm.totalCycles) || 1)
            : null,
        endDate: scheduleForm.endCondition === 'on_date' ? scheduleForm.endDate : null,
      };
      await crmApi.createRecurringInvoice(payload);
      setScheduleOpen(false);
      setScheduleForm(emptyScheduleForm());
      setInfoMessage('Recurring invoice profile created.');
      setTab('recurring');
      await loadRecurring();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create recurring profile');
    } finally {
      setBusyId('');
    }
  };

  const openForecast = async () => {
    setForecastOpen(true);
    try {
      const response = await crmApi.getUpcomingRecurringInvoicesReport({ daysAhead: forecastDays });
      const data = response.data;
      const rows =
        data.items ||
        (data.profiles || []).map((profile) => ({
          profileId: profile._id,
          profileName: profile.profileName,
          clientName: profile.clientName,
          nextRunDate: profile.nextRunDate,
          frequency: String(profile.frequency),
          amount: (profile.lineItems || []).reduce(
            (sum, line) => sum + Number(line.qty || 0) * Number(line.rate || 0),
            0
          ),
          currency: profile.currency,
        }));
      setForecastItems(rows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load forecast');
    }
  };

  return (
    <div data-tour="invoices-tour-landing" className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div data-tour="invoices-title">
          <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Accounts Receivable
          </p>
          <h1 className="m-0 text-2xl font-bold text-zinc-950">Invoices</h1>
          <p className="m-0 mt-1 text-sm text-zinc-500">
            Tax invoices, collections, write-offs, templates, and recurring billing schedules.
          </p>
        </div>
        <div data-tour="invoices-header-actions" className="flex flex-wrap gap-2">
          <button
            type="button"
            data-tour="invoices-refresh-btn"
            onClick={refresh}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
          >
            <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
          </button>
          {tab === 'invoices' && (
            <>
              <button
                type="button"
                data-tour="invoices-export-btn"
                onClick={() => exportData('csv')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <DownloadIcon sx={{ fontSize: 15 }} /> Export CSV
              </button>
              <button
                type="button"
                data-tour="invoices-templates-btn"
                onClick={() => navigate('/invoice-templates')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <FolderOpenIcon sx={{ fontSize: 15 }} /> Templates
              </button>
              {canWriteFinance && (
                <button
                  type="button"
                  data-tour="invoices-scan-pdf-btn"
                  onClick={() => setPdfScanOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800"
                >
                  <DocumentScannerOutlinedIcon sx={{ fontSize: 16 }} /> Scan PDF
                </button>
              )}
              {canWriteFinance && (
                <button
                  type="button"
                  data-tour="invoices-create-btn"
                  onClick={() => navigate('/invoices/create')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  <AddIcon sx={{ fontSize: 16 }} /> Create Invoice
                </button>
              )}
            </>
          )}
          <TourButton
            moduleId="invoices"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
          />
        </div>
      </header>

      <div data-tour="invoices-main-tabs" className="inline-flex self-start rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
        <button
          type="button"
          data-tour="invoices-tab-invoices"
          onClick={() => setTab('invoices')}
          className={`h-8 cursor-pointer rounded-md border-0 px-3 text-xs font-semibold ${
            tab === 'invoices' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
          }`}
        >
          Invoices
        </button>
        <button
          type="button"
          data-tour="invoices-tab-recurring"
          onClick={() => setTab('recurring')}
          className={`h-8 cursor-pointer rounded-md border-0 px-3 text-xs font-semibold ${
            tab === 'recurring' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
          }`}
        >
          Recurring Profiles
        </button>
      </div>

      <div data-tour="invoices-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          {
            label: tab === 'recurring' ? 'Profiles' : archived ? 'Archived' : 'Total invoices',
            value: String(tab === 'recurring' ? recurring.length : kpis.count),
          },
          { label: 'Outstanding', value: formatFinanceMoney(kpis.outstanding) },
          { label: 'Overdue', value: String(kpis.overdue) },
          { label: 'Collected (Paid)', value: formatFinanceMoney(kpis.collected) },
          { label: 'Recurring invoices', value: String(kpis.recurring) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase text-zinc-500">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
          </div>
        ))}
      </div>

      {tab === 'invoices' && (
        <div
          data-tour="invoices-filters"
          className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4 lg:flex-row"
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoice # or client name (e.g. INV-001, AR)…"
            className="h-9 flex-1 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
          />
          <select
            value={status}
            onChange={(event) => {
              const nextStatus = event.target.value;
              setStatus(nextStatus);
              setAttentionIds('');
              syncListParams({ status: nextStatus, ids: '' });
            }}
            className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm lg:w-48"
          >
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {attentionIds ? (
            <button
              type="button"
              onClick={() => {
                setAttentionIds('');
                syncListParams({ ids: '' });
              }}
              className="h-9 cursor-pointer rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Showing Attention Radar selection · Clear
            </button>
          ) : null}
          <div
            data-tour="invoices-archive-toggle"
            className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
          >
            <button
              type="button"
              onClick={() => setArchived(false)}
              className={`h-8 cursor-pointer rounded-md border-0 px-3 text-xs font-semibold ${
                !archived ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setArchived(true)}
              className={`h-8 cursor-pointer rounded-md border-0 px-3 text-xs font-semibold ${
                archived ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
              }`}
            >
              Archived
            </button>
          </div>
          <button
            type="button"
            data-tour="invoices-recurring-filter"
            onClick={() => setFilterRecurring((value) => !value)}
            className={`h-9 cursor-pointer rounded-lg border px-3 text-xs font-semibold transition-colors ${
              filterRecurring
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {filterRecurring ? 'All invoices' : 'From recurring only'}
          </button>
          {profileFilter && (
            <button
              type="button"
              onClick={() => setProfileFilter('')}
              className="h-9 cursor-pointer rounded-lg border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-900"
            >
              Clear profile filter
            </button>
          )}
        </div>
      )}

      {tab === 'recurring' && (
        <div
          data-tour="invoices-recurring-toolbar"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap gap-2">
            {canWriteFinance && (
              <button
                type="button"
                data-tour="invoices-recurring-new-btn"
                onClick={() => {
                  setScheduleForm(emptyScheduleForm());
                  setScheduleOpen(true);
                  setError('');
                }}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white"
              >
                <AddIcon sx={{ fontSize: 16 }} /> New Schedule
              </button>
            )}
            {canWriteFinance && (
              <button
                type="button"
                data-tour="invoices-recurring-run-due-btn"
                onClick={() =>
                  void runRecurringAction(
                    'run-due',
                    async () => {
                      const result = await crmApi.runDueRecurringInvoices();
                      setInfoMessage(
                        result.data?.message ||
                          result.message ||
                          `Generated ${result.data?.generated || 0} invoice(s).`
                      );
                    },
                    undefined
                  )
                }
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold"
              >
                Run Due Now
              </button>
            )}
            <button
              type="button"
              data-tour="invoices-recurring-forecast-btn"
              onClick={() => void openForecast()}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold"
            >
              Upcoming Forecast
            </button>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search profiles…"
            className="h-9 min-w-[220px] rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {infoMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {infoMessage}
          <button
            type="button"
            className="ml-3 cursor-pointer border-0 bg-transparent text-xs font-semibold underline"
            onClick={() => setInfoMessage('')}
          >
            Dismiss
          </button>
        </div>
      )}

      {tab === 'invoices' && (
        <div
          data-tour="invoices-table"
          className="overflow-hidden rounded-xl border border-zinc-300 bg-white"
        >
          {loading ? (
            <div className="p-12 text-center text-sm text-zinc-500">Loading invoices…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No invoices found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase text-zinc-500">
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Issued</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr
                        key={item._id}
                        data-tour={index === 0 ? 'invoices-row-first' : undefined}
                        data-invoice-id={index === 0 ? item._id : undefined}
                        className="border-b border-zinc-100 hover:bg-zinc-50"
                      >                        <td className="px-4 py-3">
                          <Link
                            to={`/invoices/${item._id}`}
                            className="font-semibold text-zinc-950 no-underline hover:underline"
                          >
                            {item.invoiceNo}
                          </Link>
                          {(item.isRecurring || item.recurringProfileId) && (
                            <span className="ml-1.5 inline-block rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                              Recurring
                              {item.recurringCycle ? ` #${item.recurringCycle}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{displayLabel(item.clientName)}</td>
                        <td className="px-4 py-3 text-zinc-600">
                          {item.issueDate ? new Date(item.issueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {formatFinanceMoney(item.grandTotal, item.currency)}
                        </td>
                        <td className="px-4 py-3">
                          {formatFinanceMoney(item.balanceDue ?? item.grandTotal, item.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/invoices/${item._id}`)}
                              className="h-7 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold"
                            >
                              Open
                            </button>
                            {canWriteFinance &&
                              (archived ? (
                                <button
                                  type="button"
                                  disabled={busyId === item._id}
                                  onClick={() => runInvoiceAction(item._id, 'restore')}
                                  className="h-7 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold disabled:opacity-50"
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busyId === item._id}
                                  onClick={() => runInvoiceAction(item._id, 'archive')}
                                  className="h-7 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold disabled:opacity-50"
                                >
                                  Archive
                                </button>
                              ))}
                            {canWriteFinance &&
                              item.status !== 'Cancelled' &&
                              item.status !== 'Paid' && (
                                <button
                                  type="button"
                                  disabled={busyId === item._id}
                                  onClick={() => runInvoiceAction(item._id, 'cancel')}
                                  className="h-7 cursor-pointer rounded-md border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-700 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3">
                  <span className="text-xs text-zinc-500">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total} invoices
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white disabled:opacity-40"
                    >
                      <ChevronLeftIcon sx={{ fontSize: 18 }} />
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage((current) => current + 1)}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white disabled:opacity-40"
                    >
                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                    </button>
                  </div>
                </div>
              )}
              {pagination && pagination.totalPages <= 1 && pagination.total > 0 && (
                <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
                  Showing {items.length} of {pagination.total} invoices
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'recurring' && (
        <div
          data-tour="invoices-recurring-table"
          className="overflow-hidden rounded-xl border border-zinc-300 bg-white"
        >          {loading ? (
            <div className="p-12 text-center text-sm text-zinc-500">Loading schedules…</div>
          ) : recurring.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              No recurring invoice profiles yet. Create a schedule to auto-generate invoices.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Profile</th>
                    <th className="px-4 py-3">Client</th>
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
                        <td className="px-4 py-3 text-zinc-700">{displayLabel(item.clientName)}</td>
                        <td className="px-4 py-3 text-zinc-600">
                          {recurringInvoiceFrequencyLabel(String(item.frequency))}
                          {item.frequency === 'custom' && item.customIntervalDays
                            ? ` (${item.customIntervalDays}d)`
                            : ''}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {item.nextRunDate ? new Date(item.nextRunDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{cycleLabel}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                              String(item.status)
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {canWriteFinance && (
                              <button
                                type="button"
                                disabled={busy || item.status === 'Completed'}
                                onClick={() =>
                                  void runRecurringAction(
                                    item._id,
                                    () => crmApi.runRecurringInvoiceNow(item._id),
                                    'Invoice generated from schedule.'
                                  )
                                }
                                className="h-7 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold disabled:opacity-50"
                              >
                                Run Now
                              </button>
                            )}
                            {canWriteFinance && item.status !== 'Completed' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runRecurringAction(item._id, () =>
                                    crmApi.toggleRecurringInvoiceStatus(item._id)
                                  )
                                }
                                className="h-7 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold disabled:opacity-50"
                              >
                                {item.status === 'Paused' ? 'Resume' : 'Pause'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setLogsOpen(item)}
                              className="h-7 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold"
                            >
                              Logs
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setProfileFilter(item._id);
                                setFilterRecurring(false);
                                setSearch('');
                                setPage(1);
                                setTab('invoices');
                              }}
                              className="h-7 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold"
                            >
                              Invoices
                            </button>
                            {canWriteFinance && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  if (!(await confirm({ message: `Delete schedule "${item.profileName}"?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
                                  void runRecurringAction(item._id, () =>
                                    crmApi.deleteRecurringInvoice(item._id)
                                  );
                                }}
                                className="h-7 cursor-pointer rounded-md border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-700 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
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
      )}

      {scheduleOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setScheduleOpen(false)}
        >
          <form
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitSchedule}
          >
            <h2 className="m-0 text-lg font-bold">New recurring invoice schedule</h2>
            <p className="mb-4 mt-1 text-xs text-zinc-500">
              Creates a billing profile. Use Run Now or Run Due to generate invoices.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500 sm:col-span-2">
                Profile name
                <input
                  className={fieldClass}
                  value={scheduleForm.profileName || ''}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, profileName: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Client *
                <ClientSelect
                  clients={clients}
                  value={scheduleForm.clientId}
                  required
                  placeholder="Select client…"
                  onChange={(nextId) => setScheduleForm((f) => ({ ...f, clientId: nextId }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Project
                <select
                  className={fieldClass}
                  value={scheduleForm.projectId || ''}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, projectId: e.target.value }))}
                >
                  <option value="">None</option>
                  {projects
                    .filter((project) => !scheduleForm.clientId || project.clientId === scheduleForm.clientId)
                    .map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Frequency
                <select
                  className={fieldClass}
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, frequency: e.target.value }))}
                >
                  {RECURRING_INVOICE_FREQUENCIES.map((value) => (
                    <option key={value} value={value}>
                      {recurringInvoiceFrequencyLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              {scheduleForm.frequency === 'custom' && (
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                  Custom interval (days)
                  <input
                    className={fieldClass}
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
                Start / next run
                <input
                  className={fieldClass}
                  type="date"
                  value={scheduleForm.nextRunDate || scheduleForm.startDate || ''}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      startDate: e.target.value,
                      nextRunDate: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                End condition
                <select
                  className={fieldClass}
                  value={scheduleForm.endCondition}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, endCondition: e.target.value }))}
                >
                  <option value="never">Never</option>
                  <option value="after_cycles">After cycles</option>
                  <option value="on_date">On date</option>
                </select>
              </label>
              {scheduleForm.endCondition === 'after_cycles' && (
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                  Total cycles
                  <input
                    className={fieldClass}
                    type="number"
                    min={1}
                    value={scheduleForm.totalCycles || 1}
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
                    className={fieldClass}
                    type="date"
                    value={scheduleForm.endDate || ''}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Payment terms (days)
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  max={365}
                  value={scheduleForm.paymentTermsDays || 30}
                  onChange={(e) =>
                    setScheduleForm((f) => ({ ...f, paymentTermsDays: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500 sm:col-span-2">
                Line item description *
                <input
                  className={fieldClass}
                  value={scheduleForm.lineItems?.[0]?.description || scheduleForm.lineItems?.[0]?.name || ''}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      lineItems: [
                        {
                          ...(f.lineItems?.[0] || { qty: 1, rate: 0, tax: 18 }),
                          name: e.target.value,
                          description: e.target.value,
                        },
                      ],
                    }))
                  }
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Qty
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={scheduleForm.lineItems?.[0]?.qty ?? 1}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      lineItems: [
                        {
                          ...(f.lineItems?.[0] || { name: '', description: '', rate: 0, tax: 18 }),
                          qty: Number(e.target.value),
                        },
                      ],
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
                Rate
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={scheduleForm.lineItems?.[0]?.rate ?? 0}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      lineItems: [
                        {
                          ...(f.lineItems?.[0] || { name: '', description: '', qty: 1, tax: 18 }),
                          rate: Number(e.target.value),
                        },
                      ],
                    }))
                  }
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === 'schedule-create'}
                className="h-9 cursor-pointer rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busyId === 'schedule-create' ? 'Saving…' : 'Create Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {forecastOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setForecastOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-bold">Upcoming recurring invoices</h2>
              <select
                className={fieldClass + ' w-auto'}
                value={forecastDays}
                onChange={(e) => {
                  setForecastDays(Number(e.target.value));
                  void crmApi
                    .getUpcomingRecurringInvoicesReport({ daysAhead: Number(e.target.value) })
                    .then((response) => {
                      const data = response.data;
                      setForecastItems(
                        data.items ||
                          (data.profiles || []).map((profile) => ({
                            profileId: profile._id,
                            profileName: profile.profileName,
                            clientName: profile.clientName,
                            nextRunDate: profile.nextRunDate,
                            frequency: String(profile.frequency),
                          }))
                      );
                    });
                }}
              >
                <option value={7}>Next 7 days</option>
                <option value={30}>Next 30 days</option>
                <option value={90}>Next 90 days</option>
              </select>
            </div>
            {forecastItems.length === 0 ? (
              <p className="text-sm text-zinc-500">No upcoming runs in this window.</p>
            ) : (
              <div className="space-y-2">
                {forecastItems.map((row, index) => (
                  <div
                    key={`${row.profileId || index}-${row.nextRunDate}`}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <div className="font-semibold text-zinc-950">{row.profileName || 'Schedule'}</div>
                    <div className="text-xs text-zinc-500">
                      {row.clientName || '—'} ·{' '}
                      {row.nextRunDate ? new Date(row.nextRunDate).toLocaleDateString() : '—'}
                      {row.frequency ? ` · ${recurringInvoiceFrequencyLabel(row.frequency)}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setForecastOpen(false)}
                className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {logsOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setLogsOpen(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="m-0 text-lg font-bold">Execution logs · {logsOpen.profileName}</h2>
            <div className="mt-4 space-y-2">
              {(logsOpen.executionLogs || []).length === 0 ? (
                <p className="text-sm text-zinc-500">No runs recorded yet.</p>
              ) : (
                (logsOpen.executionLogs || []).map((log) => (
                  <div key={log.runId} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                    <div className="font-semibold">
                      {log.status}
                      {log.invoiceNo ? ` · ${log.invoiceNo}` : ''}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {log.runDate ? new Date(log.runDate).toLocaleString() : '—'}
                      {log.error ? ` · ${log.error}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setLogsOpen(null)}
                className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <FinancePdfScanModal
        open={pdfScanOpen}
        onClose={() => setPdfScanOpen(false)}
        documentType="invoice"
      />
    </div>
  );
};
