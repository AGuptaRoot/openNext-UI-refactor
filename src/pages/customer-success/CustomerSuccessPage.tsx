import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarIcon from '@mui/icons-material/Star';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { ClientItem } from '../../types/clients';
import { getClientInitials, resolveClientAvatarColor } from '../../utils/clientAvatar';
import {
  AccountHealthRecord,
  CSAT_CATEGORIES,
  CSAT_RATING_LABELS,
  CustomerFeedbackCreateInput,
  CustomerFeedbackItem,
  CustomerSuccessSummary,
  FeedbackRatingSummary,
  healthCategoryEmoji,
  healthCategoryTone,
} from '../../types/customerSuccess';
import { triggerFileDownload } from '../../utils/fileDownload';

type MainTab = 'accounts' | 'reviews';

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
  const [modalStep, setModalStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [form, setForm] = useState<CustomerFeedbackCreateInput>({
    clientId: '',
    rating: 0,
    category: 'Customer Service',
    comments: '',
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
    const lockedClientId = isClient ? myClientId || myProfileClient?._id || '' : '';
    setForm({
      clientId: lockedClientId,
      rating: 0,
      category: 'Customer Service',
      comments: '',
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
      const detail = (e as CustomEvent<{ open?: boolean; step?: 1 | 2 | 3 }>).detail || {};
      if (detail.open === false) {
        setModalOpen(false);
        return;
      }
      if (detail.open === true) {
        openModal();
        if (detail.step === 1 || detail.step === 2 || detail.step === 3) {
          // Allow tour to open mid-wizard without requiring prior Continue clicks.
          window.setTimeout(() => {
            setModalStep(detail.step as 1 | 2 | 3);
            if ((detail.step as number) >= 2) {
              setForm((current) =>
                current.rating >= 1 ? current : { ...current, rating: 5 }
              );
            }
          }, 0);
        }
        return;
      }
      if (detail.step === 1 || detail.step === 2 || detail.step === 3) {
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

  const submitCsat = async () => {
    setError('');
    setSuccess('');
    if (!form.clientId) return setError('Select a client.');
    if (form.rating < 1 || form.rating > 5) return setError('Select a star rating.');
    if (!form.category) return setError('Select a category.');
    setSaving(true);
    try {
      await crmApi.createCustomerFeedback({
        ...form,
        comments: form.comments?.trim() || undefined,
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
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${healthCategoryTone(account.healthCategory)}`}
                          >
                            {healthCategoryEmoji(account.healthCategory)} {account.healthCategory}
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
                        <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                          🛒 {account.factors.orderCount} orders
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-zinc-700">
                          ⭐ {account.factors.avgCsat != null ? account.factors.avgCsat.toFixed(1) : '—'} / 5
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            account.factors.openTickets > 0
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          ⚠️ {account.factors.openTickets} Open
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            account.factors.overdueInvoices > 0
                              ? 'bg-red-50 text-red-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          🔴 {account.factors.overdueInvoices} Overdue
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
                    <span className="font-semibold">{row.stars} ⭐</span>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {feedback.map((item) => (
                  <article key={item._id} className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-zinc-700 ring-1 ring-zinc-200">
                          {initials(item.clientName)}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900">
                            {item.clientName || 'Unknown client'}
                          </div>
                          <div className="text-xs text-zinc-500">{item.clientEmail || '—'}</div>
                        </div>
                      </div>
                      <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                        {item.category}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <StarIcon
                            key={star}
                            className={star <= item.rating ? 'text-amber-400' : 'text-zinc-200'}
                            sx={{ fontSize: 18 }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {formatDate(item.submittedAt || item.createdAt)}
                      </span>
                    </div>
                    {item.comments && (
                      <blockquote className="mb-0 mt-3 border-l-2 border-zinc-300 pl-3 text-sm italic text-zinc-600">
                        “{item.comments}”
                      </blockquote>
                    )}
                  </article>
                ))}
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
                <p className="mb-0 mt-1 text-xs text-zinc-500">Step {modalStep} of 3</p>
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
                {[1, 2, 3].map((step) => (
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
                        onChange={(nextId) =>
                          setForm((current) => ({ ...current, clientId: nextId }))
                        }
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
                <div data-tour="cs-modal-details" className="space-y-4">
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
                onClick={() => setModalStep((step) => Math.max(1, step - 1))}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 disabled:opacity-40"
              >
                Back
              </button>
              {modalStep < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    if (modalStep === 1 && !form.clientId) return setError('Select a client to continue.');
                    if (modalStep === 2 && (form.rating < 1 || form.rating > 5)) {
                      return setError('Select a star rating to continue.');
                    }
                    setModalStep((step) => step + 1);
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
