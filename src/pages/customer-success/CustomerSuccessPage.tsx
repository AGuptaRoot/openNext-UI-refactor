import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarIcon from '@mui/icons-material/Star';
import { AlertTriangle, ShoppingCart, Star } from 'lucide-react';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { ClientItem, ClientRelatedTask } from '../../types/clients';
import { getClientInitials, resolveClientAvatarColor } from '../../utils/clientAvatar';
import {
  AccountHealthRecord,
  CSAT_CATEGORIES,
  CSAT_RATING_LABELS,
  CustomerFeedbackCreateInput,
  CustomerFeedbackItem,
  CustomerSuccessSummary,
  FeedbackRatingSummary,
  healthCategoryDotClass,
  healthCategoryTone,
} from '../../types/customerSuccess';
import { triggerFileDownload } from '../../utils/fileDownload';

type MainTab = 'accounts' | 'reviews';
type CsatModalStep = 1 | 2 | 3 | 4;

const fieldClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-400';

function initials(name?: string): string {
  return getClientInitials(name);
}

function formatDate(value?: string | null): string {
  if (!value) return 'Recently';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
}

function meterColor(category: string): string {
  if (category === 'Healthy') return 'bg-emerald-500';
  if (category === 'At Risk') return 'bg-amber-400';
  return 'bg-red-500';
}

function categoryChipClass(active: boolean): string {
  if (!active) return 'border-zinc-200 bg-white text-zinc-600';
  return 'border-slate-950 bg-slate-950 text-white';
}

export const CustomerSuccessPage: React.FC = () => {
  const { isClient, user } = useAuth();
  const myClientId = String(user?.clientId || '').trim();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: MainTab = tabParam === 'reviews' ? 'reviews' : 'accounts';

  const [summary, setSummary] = useState<CustomerSuccessSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountHealthRecord[]>([]);
  const [feedback, setFeedback] = useState<CustomerFeedbackItem[]>([]);
  const [ratingSummary, setRatingSummary] = useState<FeedbackRatingSummary | null>(null);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsPagination, setAccountsPagination] = useState<ListPaginationMeta | null>(null);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackPagination, setFeedbackPagination] = useState<ListPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<CsatModalStep>(1);
  const [saving, setSaving] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [relatedTasks, setRelatedTasks] = useState<ClientRelatedTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [form, setForm] = useState<CustomerFeedbackCreateInput>({
    clientId: '',
    rating: 0,
    category: 'Customer Service',
    comments: '',
    taskIds: [],
    taskName: '',
  });

  const setTab = useCallback(
    (tab: MainTab) => {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, accountsRes, feedbackRes, ratingRes] = await Promise.all([
        crmApi.getCustomerSuccessSummary(),
        crmApi.listCustomerSuccessAccounts({
          search: search.trim() || undefined,
          healthCategory: healthFilter || undefined,
          page: accountsPage,
          limit: 20,
        }),
        crmApi.listCustomerFeedback({
          page: feedbackPage,
          limit: 20,
        }),
        crmApi.getFeedbackRatingSummary(),
      ]);
      setSummary(summaryRes.data);
      const accountRows = accountsRes.data || [];
      setAccounts(accountRows);
      setAccountsPagination(accountsRes.pagination || null);
      setFeedback(feedbackRes.data || []);
      setFeedbackPagination(feedbackRes.pagination || null);
      setRatingSummary(ratingRes.data);

      // Client role has crm.customerSuccess.read but NOT crm.clients.read.
      // Do not call /clients — build the locked profile from CS accounts (or auth).
      if (isClient) {
        const fromAccount =
          accountRows.find((row) => String(row.clientId) === myClientId) || accountRows[0];
        if (fromAccount) {
          setClients([
            {
              _id: String(fromAccount.clientId),
              name: fromAccount.clientName || 'Your account',
              email: fromAccount.clientEmail || undefined,
              phone: fromAccount.clientPhone || undefined,
            },
          ]);
        } else if (myClientId) {
          setClients([
            {
              _id: myClientId,
              name: user?.username || user?.email || 'Your account',
              email: user?.email || undefined,
            },
          ]);
        } else {
          setClients([]);
        }
      } else {
        const clientsRes = await crmApi.listClients({ limit: 300 });
        setClients(clientsRes.data || []);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load customer success data');
    } finally {
      setLoading(false);
    }
  }, [search, healthFilter, isClient, myClientId, accountsPage, feedbackPage, user?.username, user?.email]);

  useEffect(() => {
    setAccountsPage(1);
  }, [search, healthFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const myProfileClient = useMemo(() => {
    if (!isClient) return null;
    return clients.find((item) => String(item._id) === myClientId) || clients[0] || null;
  }, [isClient, clients, myClientId]);

  const selectedClient = useMemo(
    () => clients.find((item) => item._id === form.clientId) || null,
    [clients, form.clientId]
  );

  const openModal = useCallback(() => {
    setModalOpen(true);
    setModalStep(1);
    setHoverRating(0);
    setRelatedTasks([]);
    setSelectedTaskIds([]);
    const lockedClientId = isClient ? myClientId || myProfileClient?._id || '' : '';
    setForm({
      clientId: lockedClientId,
      rating: 0,
      category: 'Customer Service',
      comments: '',
      taskIds: [],
      taskName: '',
    });
    setError('');
    setSuccess('');
  }, [isClient, myClientId, myProfileClient?._id]);

  useEffect(() => {
    if (!modalOpen || !isClient) return;
    const lockedClientId = myClientId || myProfileClient?._id || '';
    if (!lockedClientId) return;
    setForm((current) =>
      current.clientId === lockedClientId ? current : { ...current, clientId: lockedClientId }
    );
  }, [modalOpen, isClient, myClientId, myProfileClient?._id]);

  const loadRelatedTasks = useCallback(async (clientId: string) => {
    const id = String(clientId || '').trim();
    if (!id) {
      setRelatedTasks([]);
      return;
    }
    setLoadingTasks(true);
    try {
      let rows: ClientRelatedTask[] = [];
      try {
        const clientTasksRes = await crmApi.getClientTasks(id);
        rows = Array.isArray(clientTasksRes.data) ? clientTasksRes.data : [];
      } catch {
        rows = [];
      }
      if (!rows.length) {
        const listRes = await crmApi.listTasks({ clientId: id, limit: 100, page: 1 });
        rows = (listRes.data || []).map((task) => ({
          _id: String(task._id),
          title: String(task.title || 'Untitled task'),
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate || undefined,
          assigneeName: task.assigneeName || task.assignedUsername,
        }));
      }
      setRelatedTasks(rows);
    } catch {
      setRelatedTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (!modalOpen || modalStep < 3 || !form.clientId) return;
    void loadRelatedTasks(form.clientId);
  }, [modalOpen, modalStep, form.clientId, loadRelatedTasks]);

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
  }, [saving]);

  useEffect(() => {
    const onTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: MainTab }>).detail?.tab;
      if (tab === 'accounts' || tab === 'reviews') setTab(tab);
    };
    const onModal = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean; step?: CsatModalStep }>).detail || {};
      if (detail.open === false) {
        setModalOpen(false);
        return;
      }
      if (detail.open === true) {
        openModal();
        if (detail.step && detail.step >= 1 && detail.step <= 4) {
          // Allow tour to open mid-wizard without requiring prior Continue clicks.
          window.setTimeout(() => {
            setModalStep(detail.step as CsatModalStep);
            if ((detail.step as number) >= 2) {
              setForm((current) =>
                current.rating >= 1 ? current : { ...current, rating: 5 }
              );
            }
          }, 0);
        }
        return;
      }
      if (detail.step && detail.step >= 1 && detail.step <= 4) {
        setModalStep(detail.step);
      }
    };
    window.addEventListener('crm-customer-success-tour-tab', onTab as EventListener);
    window.addEventListener('crm-customer-success-tour-modal', onModal as EventListener);
    return () => {
      window.removeEventListener('crm-customer-success-tour-tab', onTab as EventListener);
      window.removeEventListener('crm-customer-success-tour-modal', onModal as EventListener);
    };
  }, [setTab, openModal]);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const submitCsat = async () => {
    setError('');
    setSuccess('');
    if (!form.clientId) return setError('Select a client.');
    if (form.rating < 1 || form.rating > 5) return setError('Select a star rating.');
    if (!form.category) return setError('Select a category.');
    const taskNames = relatedTasks
      .filter((task) => selectedTaskIds.includes(task._id))
      .map((task) => task.title)
      .filter(Boolean);
    setSaving(true);
    try {
      await crmApi.createCustomerFeedback({
        ...form,
        comments: form.comments?.trim() || undefined,
        taskIds: selectedTaskIds,
        taskId: selectedTaskIds[0],
        taskName: taskNames.join(', '),
        taskNames,
      });
      setModalOpen(false);
      setSuccess('CSAT review submitted successfully.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to submit CSAT review');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    try {
      const response = await crmApi.exportCustomerSuccess({
        format,
        search: search.trim() || undefined,
        healthCategory: healthFilter || undefined,
      });
      const payload = response.data;
      if (!payload?.content) throw new Error('Empty export');
      triggerFileDownload({
        filename: payload.filename,
        content: payload.content,
        format,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    }
  };

  const displayRating = hoverRating || form.rating;

  return (
    <div data-tour="cs-tour-landing" className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div data-tour="cs-title">
          <h1 className="m-0 text-2xl font-bold text-zinc-950">Customer Success</h1>
          <p className="mt-1 mb-0 text-sm text-zinc-500">
            Track 360° health scoring to prevent churn and capture CSAT feedback.
          </p>
        </div>
        <div data-tour="cs-header-actions" className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((open) => !open)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"
            >
              <DownloadIcon sx={{ fontSize: 18 }} />
              Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg">
                <button
                  type="button"
                  className="block w-full border-0 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  onClick={() => void handleExport('csv')}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="block w-full border-0 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  onClick={() => void handleExport('json')}
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            data-tour="cs-submit-btn"
            onClick={openModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-slate-950 px-3 text-sm font-semibold text-white"
          >
            <AddIcon sx={{ fontSize: 18 }} />
            Submit CSAT Review
          </button>
          <TourButton moduleId="customer-success" />
        </div>
      </header>

      {error && !modalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section data-tour="cs-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Healthy Accounts',
            value: summary?.healthyCount ?? 0,
            hint: `${summary?.healthyPercent ?? 0}% of portfolio`,
            tone: 'text-emerald-700',
          },
          {
            label: 'At Risk Accounts',
            value: summary?.atRiskCount ?? 0,
            hint: 'Need retention outreach',
            tone: 'text-amber-700',
          },
          {
            label: 'Critical Risk',
            value: summary?.criticalCount ?? 0,
            hint: 'Urgent intervention',
            tone: 'text-red-700',
          },
          {
            label: 'Average CSAT',
            value: Number(summary?.avgCsat || 0).toFixed(1),
            hint: `${summary?.totalFeedbacks ?? feedback.length} reviews`,
            tone: 'text-slate-950',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-xs font-medium text-zinc-500">{card.label}</div>
            <div className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</div>
            <div className="mt-1 text-[11px] text-zinc-400">{card.hint}</div>
          </div>
        ))}
      </section>

      <div data-tour="cs-tabs" className="flex flex-wrap items-center gap-2 border-b border-zinc-200">
        {(
          [
            ['accounts', 'Account Health'],
            ['reviews', 'CSAT Wall'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`border-0 border-b-2 bg-transparent px-3 py-2.5 text-sm font-semibold ${
              activeTab === id
                ? 'border-slate-950 text-slate-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        data-tour="cs-filters"
        className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-3 sm:flex-row sm:items-center"
      >
        <input
          className={`${fieldClass} sm:max-w-xs`}
          placeholder="Search accounts…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className={`${fieldClass} sm:max-w-[220px]`}
          value={healthFilter}
          onChange={(event) => setHealthFilter(event.target.value)}
        >
          <option value="">All Health Categories</option>
          <option value="Healthy">Healthy (75 - 100)</option>
          <option value="At Risk">At Risk (50 - 74)</option>
          <option value="Critical">Critical (&lt; 50)</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"
        >
          <RefreshIcon sx={{ fontSize: 18 }} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          Loading customer success…
        </div>
      ) : activeTab === 'accounts' ? (
        <section
          data-tour="cs-accounts-table"
          className="overflow-hidden rounded-xl border border-zinc-300 bg-white"
        >
          {accounts.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">No accounts match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Account</th>
                    <th className="px-4 py-3 font-semibold">Health Score</th>
                    <th className="px-4 py-3 font-semibold">Orders</th>
                    <th className="px-4 py-3 font-semibold">Avg CSAT</th>
                    <th className="px-4 py-3 font-semibold">Open Tickets</th>
                    <th className="px-4 py-3 font-semibold">Overdue Invoices</th>
                    <th className="px-4 py-3 font-semibold">Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.clientId} className="border-t border-zinc-100 align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">
                            {initials(account.clientName)}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900">{account.clientName}</div>
                            <div className="text-xs text-zinc-500">{account.clientEmail || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${healthCategoryTone(account.healthCategory)}`}
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${healthCategoryDotClass(account.healthCategory)}`}
                              aria-hidden
                            />
                            {account.healthCategory}
                          </span>
                          <span className="text-xs font-semibold text-zinc-700">{account.healthScore}/100</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={`h-full rounded-full ${meterColor(account.healthCategory)}`}
                            style={{ width: `${account.healthScore}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                          <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />
                          {account.factors.orderCount} orders
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700">
                          <Star className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                          {account.factors.avgCsat != null ? account.factors.avgCsat.toFixed(1) : '—'} / 5
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            account.factors.openTickets > 0
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                          {account.factors.openTickets} Open
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            account.factors.overdueInvoices > 0
                              ? 'bg-red-50 text-red-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              account.factors.overdueInvoices > 0 ? 'bg-red-500' : 'bg-zinc-400'
                            }`}
                            aria-hidden
                          />
                          {account.factors.overdueInvoices} Overdue
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex max-w-[260px] rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                          {account.recommendedAction}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ListPager
            pagination={accountsPagination}
            onPageChange={setAccountsPage}
            label="accounts"
          />
        </section>
      ) : (
        <div data-tour="cs-reviews-panel" className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
          <section data-tour="cs-rating-breakdown" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="mt-0 mb-1 text-base font-semibold text-zinc-900">Rating Breakdown</h2>
            <p className="mt-0 mb-4 text-xs text-zinc-500">
              Avg {Number(ratingSummary?.avgCsat || 0).toFixed(1)} / 5 · {ratingSummary?.total || 0} reviews
            </p>
            <div className="space-y-3">
              {(ratingSummary?.distribution || []).map((row) => (
                <div key={row.stars}>
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                    <span className="inline-flex items-center gap-0.5 font-semibold">
                      {row.stars}
                      <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden />
                    </span>
                    <span>
                      {row.count} · {row.percent}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section data-tour="cs-wall-of-love" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="mt-0 mb-4 text-base font-semibold text-zinc-900">Wall of Love</h2>
            {feedback.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">No CSAT reviews yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Task</th>
                      <th className="px-4 py-3 font-semibold">Rating</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedback.map((item) => (
                      <tr key={item._id} className="border-t border-zinc-100 align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-700">
                              {initials(item.clientName)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-zinc-900">
                                {item.clientName || 'Unknown client'}
                              </div>
                              <div className="truncate text-xs text-zinc-500">
                                {item.clientEmail || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.taskName ? (
                            <span className="inline-flex max-w-[220px] rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-900">
                              {item.taskName}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <StarIcon
                                key={star}
                                className={star <= item.rating ? 'text-amber-400' : 'text-zinc-200'}
                                sx={{ fontSize: 16 }}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                          {formatDate(item.submittedAt || item.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600 max-w-[260px]">
                          {item.comments ? (
                            <span className="line-clamp-3 italic">“{item.comments}”</span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="-mx-5 mt-4">
              <ListPager
                pagination={feedbackPagination}
                onPageChange={setFeedbackPage}
                label="reviews"
              />
            </div>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            data-tour="cs-csat-modal"
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-lg font-semibold text-zinc-950">Submit CSAT Review</h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">Step {modalStep} of 4</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {error && modalOpen && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-5 flex gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 flex-1 rounded-full ${step <= modalStep ? 'bg-slate-950' : 'bg-zinc-200'}`}
                  />
                ))}
              </div>

              {modalStep === 1 && (
                <div data-tour="cs-modal-client" className="space-y-4">
                  {isClient ? (
                    myProfileClient || selectedClient ? (
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Your profile
                        </div>
                        <div className="mt-4 flex flex-col items-center text-center">
                          {(myProfileClient || selectedClient)?.avatarUrl ? (
                            <img
                              src={(myProfileClient || selectedClient)!.avatarUrl}
                              alt={(myProfileClient || selectedClient)!.name}
                              className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow-sm"
                            />
                          ) : (
                            <div
                              className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white shadow-sm"
                              style={{
                                backgroundColor: resolveClientAvatarColor(
                                  (myProfileClient || selectedClient)?.avatarColor
                                ),
                              }}
                            >
                              {initials((myProfileClient || selectedClient)?.name)}
                            </div>
                          )}
                          <div className="mt-3 text-lg font-bold text-zinc-950">
                            {(myProfileClient || selectedClient)?.name}
                          </div>
                          <div className="mt-1 text-sm text-zinc-500">
                            {(myProfileClient || selectedClient)?.email ||
                              user?.email ||
                              'Your client account'}
                          </div>
                          <div className="mt-3 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                            Reviewing as this account
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        Your login is not linked to a CRM client profile, so CSAT cannot be submitted
                        yet. Please contact your account manager.
                      </div>
                    )
                  ) : (
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                        Select client *
                      </span>
                      <ClientSelect
                        clients={clients}
                        value={form.clientId}
                        required
                        placeholder="Search and select client…"
                        onChange={(nextId) => {
                          setSelectedTaskIds([]);
                          setRelatedTasks([]);
                          setForm((current) => ({
                            ...current,
                            clientId: nextId,
                            taskIds: [],
                            taskName: '',
                          }));
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {modalStep === 2 && (
                <div data-tour="cs-modal-rating" className="space-y-4 py-4 text-center">
                  <div className="text-sm font-semibold text-zinc-700">How was the experience?</div>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        aria-label={`${rating} stars`}
                        onMouseEnter={() => setHoverRating(rating)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setForm((current) => ({ ...current, rating }))}
                        className="border-0 bg-transparent p-0"
                      >
                        <StarIcon
                          className={rating <= displayRating ? 'text-amber-400' : 'text-zinc-200'}
                          sx={{ fontSize: 42 }}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="text-sm font-semibold text-zinc-800">
                    {displayRating
                      ? CSAT_RATING_LABELS[displayRating]
                      : 'Select a rating'}
                  </div>
                </div>
              )}

              {modalStep === 3 && (
                <div data-tour="cs-modal-tasks" className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Related tasks</div>
                    <p className="mb-0 mt-1 text-xs text-zinc-500">
                      Choose one or more of your related tasks this review is about. You can continue
                      without selecting a task.
                    </p>
                  </div>
                  {loadingTasks ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                      Loading related tasks…
                    </div>
                  ) : relatedTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                      No related tasks found for this account. Continue to add category & comments.
                    </div>
                  ) : (
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {relatedTasks.map((task) => {
                        const checked = selectedTaskIds.includes(task._id);
                        return (
                          <label
                            key={task._id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                              checked
                                ? 'border-slate-950 bg-slate-50'
                                : 'border-zinc-200 bg-white hover:border-zinc-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-slate-950 focus:ring-slate-950"
                              checked={checked}
                              onChange={() => toggleTaskSelection(task._id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-zinc-900">
                                {task.title || 'Untitled task'}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-zinc-500">
                                {[task.status, task.priority, task.assigneeName]
                                  .filter(Boolean)
                                  .join(' · ') || 'Related task'}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {selectedTaskIds.length > 0 ? (
                    <div className="text-xs font-medium text-zinc-600">
                      {selectedTaskIds.length} task{selectedTaskIds.length === 1 ? '' : 's'} selected
                    </div>
                  ) : null}
                </div>
              )}

              {modalStep === 4 && (
                <div data-tour="cs-modal-details" className="space-y-4">
                  {selectedTaskIds.length > 0 ? (
                    <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                      <span className="font-semibold">Related task(s): </span>
                      {relatedTasks
                        .filter((task) => selectedTaskIds.includes(task._id))
                        .map((task) => task.title)
                        .join(', ')}
                    </div>
                  ) : null}
                  <fieldset className="border-0 p-0">
                    <legend className="mb-1.5 text-xs font-semibold text-zinc-700">Category *</legend>
                    <div className="flex flex-wrap gap-2">
                      {CSAT_CATEGORIES.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, category }))}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${categoryChipClass(
                            form.category === category
                          )}`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Comments</span>
                    <textarea
                      maxLength={2000}
                      rows={5}
                      className="w-full box-border rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                      placeholder="Share what went well or what we can improve…"
                      value={form.comments || ''}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, comments: event.target.value }))
                      }
                    />
                  </label>
                </div>
              )}
            </div>

            <div
              data-tour="cs-modal-actions"
              className="flex items-center justify-between gap-2 border-t border-zinc-200 px-5 py-4"
            >
              <button
                type="button"
                disabled={modalStep === 1 || saving}
                onClick={() => setModalStep((step) => Math.max(1, step - 1) as CsatModalStep)}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 disabled:opacity-40"
              >
                Back
              </button>
              {modalStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    if (modalStep === 1 && !form.clientId) return setError('Select a client to continue.');
                    if (modalStep === 2 && (form.rating < 1 || form.rating > 5)) {
                      return setError('Select a star rating to continue.');
                    }
                    setModalStep((step) => (step + 1) as CsatModalStep);
                  }}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitCsat()}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Submitting…' : 'Submit Review'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
