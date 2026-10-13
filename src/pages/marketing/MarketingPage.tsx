import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { TourButton } from '../../ui/tour';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  MERGE_TAG_HINTS,
  TARGET_SEGMENTS,
  WINBACK_ACTION_TYPES,
  WINBACK_TARGET_STAGES,
  campaignStatusTone,
  formatMarketingMoney,
  type MarketingAnalytics,
  type MarketingAudienceStats,
  type MarketingCampaign,
  type MarketingCampaignCreateInput,
  type MarketingEligibleLead,
  type PipelineReEntryEvent,
  type ReEngagementRequest,
} from '../../types/marketing';
import { triggerFileDownload } from '../../utils/fileDownload';

type MainTab = 'campaigns' | 'analytics';

const fieldClass =
  'h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-400';

const emptyForm = (): MarketingCampaignCreateInput => ({
  name: '',
  type: 'Lost Lead Re-engagement',
  targetSegment: 'Lost Leads',
  emailSubject: '',
  emailContent: '',
  initialStatus: 'Draft',
});

function formatDateTime(value?: string | null): string {
  if (!value) return 'Never executed';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

export const MarketingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm, prompt } = useDialog();
  const activeTab: MainTab = searchParams.get('tab') === 'analytics' ? 'analytics' : 'campaigns';

  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [audienceStats, setAudienceStats] = useState<MarketingAudienceStats | null>(null);
  const [analytics, setAnalytics] = useState<MarketingAnalytics | null>(null);
  const [requests, setRequests] = useState<ReEngagementRequest[]>([]);
  const [activity, setActivity] = useState<PipelineReEntryEvent[]>([]);
  const [eligibleLeads, setEligibleLeads] = useState<MarketingEligibleLead[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [testOpen, setTestOpen] = useState(false);
  const [testCampaignId, setTestCampaignId] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const [winBackOpen, setWinBackOpen] = useState(false);
  const [winBackCampaignId, setWinBackCampaignId] = useState('');
  const [winBackLeadId, setWinBackLeadId] = useState('');
  const [winBackStage, setWinBackStage] = useState('Contacted');
  const [winBackAction, setWinBackAction] = useState('Client Re-contacted & Ready');
  const [winBackNotes, setWinBackNotes] = useState('');

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
      const settled = await Promise.allSettled([
        crmApi.listMarketingCampaigns({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          page,
          limit: 20,
        }),
        crmApi.getMarketingAudienceStats(),
        crmApi.getMarketingAnalytics(),
        crmApi.listReEngagementRequests(),
        crmApi.listMarketingActivity(),
        crmApi.listMarketingEligibleLeads(),
      ]);

      const valueOf = <T,>(index: number, fallback: T): T => {
        const result = settled[index];
        if (result.status === 'fulfilled') return result.value as T;
        return fallback;
      };

      const campaignRes = valueOf(0, { data: [] as typeof campaigns, pagination: null });
      const audienceRes = valueOf(1, { data: null as MarketingAudienceStats | null });
      const analyticsRes = valueOf(2, { data: null as MarketingAnalytics | null });
      const requestRes = valueOf(3, { data: [] as typeof requests });
      const activityRes = valueOf(4, { data: [] as PipelineReEntryEvent[] });
      const eligibleRes = valueOf(5, { data: [] as typeof eligibleLeads });

      setCampaigns(campaignRes.data || []);
      setPagination(campaignRes.pagination || null);
      setAudienceStats(audienceRes.data);
      setAnalytics(analyticsRes.data);
      setRequests(requestRes.data || []);
      setActivity(activityRes.data || []);
      setEligibleLeads(eligibleRes.data || []);

      const failed = settled.find((item) => item.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      if (failed) {
        const reason = failed.reason;
        const message =
          reason instanceof Error ? reason.message : 'Some marketing data failed to load';
        // Only surface hard errors when campaigns themselves failed.
        if (settled[0].status === 'rejected') {
          setError(message);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load marketing data');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pendingRequests = useMemo(
    () => requests.filter((item) => item.status === 'Pending'),
    [requests]
  );

  const testCampaign = campaigns.find((item) => item._id === testCampaignId);
  const winBackCampaign = campaigns.find((item) => item._id === winBackCampaignId);

  const openCreate = useCallback(() => {
    setCreateForm(emptyForm());
    setCreateOpen(true);
    setError('');
  }, []);

  useEffect(() => {
    const onTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: MainTab }>).detail?.tab;
      if (tab === 'campaigns' || tab === 'analytics') setTab(tab);
    };
    const onCreate = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail || {};
      if (detail.open === false) {
        setCreateOpen(false);
        setTestOpen(false);
        setWinBackOpen(false);
        return;
      }
      if (detail.open === true) openCreate();
    };
    window.addEventListener('crm-marketing-tour-tab', onTab as EventListener);
    window.addEventListener('crm-marketing-tour-create', onCreate as EventListener);
    return () => {
      window.removeEventListener('crm-marketing-tour-tab', onTab as EventListener);
      window.removeEventListener('crm-marketing-tour-create', onCreate as EventListener);
    };
  }, [setTab, openCreate]);

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (
      !createForm.name.trim() ||
      !createForm.type ||
      !createForm.targetSegment ||
      !createForm.emailSubject.trim() ||
      !createForm.emailContent.trim()
    ) {
      return setError('Complete all required campaign fields.');
    }
    setSaving(true);
    try {
      await crmApi.createMarketingCampaign({
        ...createForm,
        name: createForm.name.trim(),
        emailSubject: createForm.emailSubject.trim(),
        emailContent: createForm.emailContent.trim(),
      });
      setCreateOpen(false);
      setSuccess('Campaign created successfully.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const runCampaign = async (campaign: MarketingCampaign) => {
    if (
      !(await confirm(
        `Run drip for "${campaign.name}"?\nThis will dispatch personalized emails to the ${campaign.targetAudience || campaign.targetSegment} segment.`
      ))
    ) {
      return;
    }
    setBusyId(campaign._id);
    setError('');
    try {
      const response = await crmApi.executeMarketingCampaign(campaign._id);
      setSuccess(response.data?.message || response.message || 'Campaign executed.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to execute campaign');
    } finally {
      setBusyId('');
    }
  };

  const deleteCampaign = async (campaign: MarketingCampaign) => {
    if (!(await confirm({ message: `Delete campaign "${campaign.name}"? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    setBusyId(campaign._id);
    try {
      await crmApi.deleteMarketingCampaign(campaign._id);
      setSuccess('Campaign deleted.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete campaign');
    } finally {
      setBusyId('');
    }
  };

  const submitTest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!testCampaignId || !testEmail.trim()) return setError('Enter a test email address.');
    setSaving(true);
    setError('');
    try {
      const response = await crmApi.sendMarketingTestEmail(testCampaignId, {
        email: testEmail.trim(),
      });
      setTestOpen(false);
      setSuccess(response.message || `Test email queued for ${testEmail.trim()}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to send test email');
    } finally {
      setSaving(false);
    }
  };

  const openWinBack = (campaignId: string) => {
    setWinBackCampaignId(campaignId);
    setWinBackLeadId(eligibleLeads[0]?._id || '');
    setWinBackStage('Contacted');
    setWinBackAction('Client Re-contacted & Ready');
    setWinBackNotes('');
    setWinBackOpen(true);
    setError('');
  };

  const submitWinBack = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!winBackCampaignId || !winBackLeadId) return setError('Select a lead to win back.');
    setSaving(true);
    setError('');
    try {
      await crmApi.reEngageMarketingLead({
        campaignId: winBackCampaignId,
        leadId: winBackLeadId,
        targetStage: winBackStage,
        actionType: winBackAction,
        notes: winBackNotes.trim() || undefined,
      });
      setWinBackOpen(false);
      setSuccess('Lead stage updated and pipeline re-entry logged.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to win back lead');
    } finally {
      setSaving(false);
    }
  };

  const approveRequest = async (id: string) => {
    setBusyId(id);
    try {
      await crmApi.approveReEngagementRequest(id);
      setSuccess('Re-engagement request approved.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to approve request');
    } finally {
      setBusyId('');
    }
  };

  const rejectRequest = async (id: string) => {
    const reason =
      (await prompt('Rejection reason', 'Not interested / wrong contact')) ||
      'Not interested / wrong contact';
    setBusyId(id);
    try {
      await crmApi.rejectReEngagementRequest(id, { reason });
      setSuccess('Re-engagement request rejected.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setBusyId('');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    try {
      const response = await crmApi.exportMarketing({
        format,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      });
      if (!response.data?.content) throw new Error('Empty export');
      triggerFileDownload({
        filename: response.data.filename,
        content: response.data.content,
        format,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    }
  };

  return (
    <div data-tour="mkt-tour-landing" className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div data-tour="mkt-title">
          <h1 className="m-0 text-2xl font-bold text-zinc-950">Marketing Automation</h1>
          <p className="mt-1 mb-0 text-sm text-zinc-500">
            Drip campaigns, win-back workflows, and closed-loop ROI attribution.
          </p>
        </div>
        <div data-tour="mkt-header-actions" className="flex flex-wrap items-center gap-2">
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
            data-tour="mkt-create-btn"
            onClick={openCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-slate-950 px-3 text-sm font-semibold text-white"
          >
            <AddIcon sx={{ fontSize: 18 }} />
            Create Campaign
          </button>
          <TourButton moduleId="marketing" />
        </div>
      </header>

      {error && !createOpen && !testOpen && !winBackOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section data-tour="mkt-audience-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Lost Leads', audienceStats?.lostLeads ?? 0],
          ['Unqualified Leads', audienceStats?.unqualifiedLeads ?? 0],
          ['Dormant Clients (>90d)', audienceStats?.dormantClients ?? 0],
          ['All Contacts', audienceStats?.totalContacts ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-xs font-medium text-zinc-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-950">{value}</div>
          </div>
        ))}
      </section>

      <div data-tour="mkt-tabs" className="flex flex-wrap items-center gap-2 border-b border-zinc-200">
        {(
          [
            ['campaigns', 'Campaigns & Drips'],
            ['analytics', 'Analytics & ROI'],
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

      {activeTab === 'campaigns' ? (
        <>
          <div
            data-tour="mkt-filters"
            className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <label className="min-w-[200px] flex-1">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-zinc-500">Search</span>
              <input
                className={fieldClass}
                placeholder="Campaign name or subject…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="min-w-[160px]">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-zinc-500">Status</span>
              <select
                className={fieldClass}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                {CAMPAIGN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[200px]">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-zinc-500">Type</span>
              <select
                className={fieldClass}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">All types</option>
                {CAMPAIGN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"
            >
              <RefreshIcon sx={{ fontSize: 18 }} />
              Refresh
            </button>
          </div>

          {pendingRequests.length > 0 && (
            <section data-tour="mkt-approval-queue" className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <h2 className="mt-0 mb-3 text-base font-semibold text-zinc-900">
                Manager Re-Engagement Approval Queue ({pendingRequests.length})
              </h2>
              <div className="space-y-3">
                {pendingRequests.map((item) => (
                  <div
                    key={item._id}
                    className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900">
                        {item.leadName} · {item.leadCompany}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {item.campaignName} · {item.actionType} ·{' '}
                        {formatMarketingMoney(item.expectedRevenue)} ·{' '}
                        {formatDateTime(item.createdAt)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === item._id}
                        onClick={() => void approveRequest(item._id)}
                        className="h-8 rounded-lg border-0 bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item._id}
                        onClick={() => void rejectRequest(item._id)}
                        className="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section
            data-tour="mkt-campaigns-table"
            className="overflow-hidden rounded-xl border border-zinc-300 bg-white"
          >
            {loading ? (
              <div className="p-10 text-center text-sm text-zinc-500">Loading campaigns…</div>
            ) : campaigns.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500">No campaigns match these filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Campaign & Subject</th>
                      <th className="px-4 py-3 font-semibold">Channel Type</th>
                      <th className="px-4 py-3 font-semibold">Target Segment</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Sent / Won-Back</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr key={campaign._id} className="border-t border-zinc-100 align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-950">{campaign.name}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            📧 {campaign.subject || campaign.emailSubject}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                            📢 {campaign.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-800">
                            🎯 {campaign.targetAudience || campaign.targetSegment}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${campaignStatusTone(String(campaign.status))}`}
                          >
                            {campaign.status}
                          </span>
                          <div className="mt-1 text-[11px] text-zinc-400">
                            {formatDateTime(campaign.executedAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700">
                          <div>
                            Sent: <strong>{campaign.stats?.sent ?? 0}</strong>
                          </div>
                          <div>
                            Won-back: <strong>{campaign.stats?.reEngagedLeads ?? 0}</strong>
                          </div>
                          <div className="text-zinc-500">
                            Rev: {formatMarketingMoney(campaign.stats?.revenueGenerated || 0)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {campaign.type === 'Lost Lead Re-engagement' && (
                              <button
                                type="button"
                                onClick={() => openWinBack(campaign._id)}
                                className="h-8 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700"
                              >
                                ⚡ Win-Back
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setTestCampaignId(campaign._id);
                                setTestEmail('');
                                setTestOpen(true);
                                setError('');
                              }}
                              className="h-8 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700"
                            >
                              ✉ Test
                            </button>
                            <button
                              type="button"
                              disabled={busyId === campaign._id}
                              onClick={() => void runCampaign(campaign)}
                              className="h-8 rounded-lg border-0 bg-slate-950 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              ▶ Run
                            </button>
                            <button
                              type="button"
                              disabled={busyId === campaign._id}
                              onClick={() => void deleteCampaign(campaign)}
                              className="h-8 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ListPager pagination={pagination} onPageChange={setPage} label="campaigns" />
          </section>

          <section data-tour="mkt-activity-log" className="rounded-xl border border-zinc-300 bg-white p-4">
            <h2 className="mt-0 mb-3 text-base font-semibold text-zinc-900">
              Pipeline Re-Entry Activity Log
            </h2>
            {activity.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-500">No win-back activity yet.</div>
            ) : (
              <div className="space-y-2">
                {activity.slice(0, 12).map((event) => (
                  <div
                    key={event._id}
                    className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-zinc-50/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm text-zinc-800">
                      <strong>{event.leadName}</strong> ({event.leadCompany}) moved{' '}
                      <span className="font-semibold text-zinc-500">{event.previousStage}</span> →{' '}
                      <span className="font-semibold text-emerald-700">{event.newStage}</span> via{' '}
                      {event.campaignName}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatMarketingMoney(event.expectedRevenue)} · {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <div data-tour="mkt-analytics-panel" className="flex flex-col gap-5">
          <section data-tour="mkt-analytics-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Dispatched Emails', analytics?.totalSent ?? 0],
              ['Won-Back Contacts', analytics?.totalReEngaged ?? 0],
              ['Win-Back Rate', `${analytics?.conversionRate ?? 0}%`],
              ['Attributed Revenue', formatMarketingMoney(analytics?.attributedRevenue || 0)],
              ['Avg Deal / Won-Back', formatMarketingMoney(analytics?.avgDeal || 0)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-zinc-300 bg-white p-4">
                <div className="text-xs font-medium text-zinc-500">{label}</div>
                <div className="mt-1 text-xl font-bold text-slate-950">{value}</div>
              </div>
            ))}
          </section>

          <section data-tour="mkt-funnel" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="mt-0 mb-4 text-base font-semibold text-zinc-900">
              End-to-End Marketing Conversion Funnel
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {[
                ['CRM Audience Base', analytics?.funnel.audienceBase ?? 0],
                ['Emails Dispatched', analytics?.funnel.dispatched ?? 0],
                ['Won-Back Leads', analytics?.funnel.reEngaged ?? 0],
                ['Pipeline Revenue', formatMarketingMoney(analytics?.funnel.revenue || 0)],
              ].map(([label, value], index) => (
                <div key={String(label)} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Step {index + 1}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-700">{label}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <div data-tour="mkt-performance" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="rounded-xl border border-zinc-300 bg-white p-5">
              <h2 className="mt-0 mb-3 text-base font-semibold text-zinc-900">
                Performance by Audience Segment
              </h2>
              <div className="space-y-3">
                {(analytics?.bySegment || []).map((row) => (
                  <div key={row.key} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
                    <div className="font-semibold text-zinc-900">{row.label}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Sent {row.sent} · Won-back {row.reEngaged} · {row.conversionRate}% ·{' '}
                      {formatMarketingMoney(row.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-xl border border-zinc-300 bg-white p-5">
              <h2 className="mt-0 mb-3 text-base font-semibold text-zinc-900">
                Performance by Campaign Type
              </h2>
              <div className="space-y-3">
                {(analytics?.byType || []).map((row) => (
                  <div key={row.key} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
                    <div className="font-semibold text-zinc-900">{row.label}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {row.campaigns ?? 0} campaigns · Sent {row.sent} · Won-back {row.reEngaged} ·{' '}
                      {formatMarketingMoney(row.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section
            data-tour="mkt-leaderboard"
            className="overflow-hidden rounded-xl border border-zinc-300 bg-white"
          >
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="m-0 text-base font-semibold text-zinc-900">Top ROI Campaign Leaderboard</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Rank</th>
                    <th className="px-4 py-3 font-semibold">Campaign</th>
                    <th className="px-4 py-3 font-semibold">Segment</th>
                    <th className="px-4 py-3 font-semibold">Sent</th>
                    <th className="px-4 py-3 font-semibold">Won-Back</th>
                    <th className="px-4 py-3 font-semibold">Conv %</th>
                    <th className="px-4 py-3 font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.leaderboard || []).map((row) => (
                    <tr key={row.campaignId} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-semibold text-zinc-700">#{row.rank}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-950">{row.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{row.targetAudience}</td>
                      <td className="px-4 py-3">{row.sent}</td>
                      <td className="px-4 py-3">{row.reEngaged}</td>
                      <td className="px-4 py-3">{row.conversionRate}%</td>
                      <td className="px-4 py-3 font-semibold">
                        {formatMarketingMoney(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            data-tour="mkt-create-modal"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-lg font-semibold text-zinc-950">Create Marketing Campaign</h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">
                  Supports merge tags: {MERGE_TAG_HINTS.join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form data-tour="mkt-create-form" onSubmit={submitCreate} className="space-y-4 p-5">
              {error && createOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Campaign Name *</span>
                <input
                  required
                  maxLength={200}
                  className={fieldClass}
                  value={createForm.name}
                  onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                />
              </label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Campaign Type *</span>
                  <select
                    required
                    className={fieldClass}
                    value={createForm.type}
                    onChange={(event) => setCreateForm({ ...createForm, type: event.target.value })}
                  >
                    {CAMPAIGN_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Target Segment *</span>
                  <select
                    required
                    className={fieldClass}
                    value={createForm.targetSegment}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, targetSegment: event.target.value })
                    }
                  >
                    {TARGET_SEGMENTS.map((segment) => (
                      <option key={segment} value={segment}>
                        {segment}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Email Subject *</span>
                <input
                  required
                  maxLength={250}
                  className={fieldClass}
                  value={createForm.emailSubject}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, emailSubject: event.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Email Content (HTML / Text) *
                </span>
                <textarea
                  required
                  maxLength={10000}
                  rows={7}
                  className="w-full box-border rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  value={createForm.emailContent}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, emailContent: event.target.value })
                  }
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Initial Status</span>
                <select
                  className={fieldClass}
                  value={createForm.initialStatus}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, initialStatus: event.target.value })
                  }
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                </select>
              </label>
              <div data-tour="mkt-create-actions" className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : '+ Save Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {testOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-lg font-semibold text-zinc-950">Send Test Preview Email</h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">{testCampaign?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setTestOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitTest} className="space-y-4 p-5">
              {error && testOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Recipient Test Email *
                </span>
                <input
                  required
                  type="email"
                  className={fieldClass}
                  placeholder="tester@example.com"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Sending Test…' : 'Send Test Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {winBackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="m-0 text-lg font-semibold text-zinc-950">Direct Lead Stage Win-Back</h2>
                <p className="mb-0 mt-1 text-xs text-zinc-500">{winBackCampaign?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setWinBackOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-zinc-100 text-zinc-600"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitWinBack} className="space-y-4 p-5">
              {error && winBackOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Select Lost / Inactive Lead *
                </span>
                <select
                  required
                  className={fieldClass}
                  value={winBackLeadId}
                  disabled={eligibleLeads.length === 0}
                  onChange={(event) => setWinBackLeadId(event.target.value)}
                >
                  {eligibleLeads.length === 0 ? (
                    <option value="">No eligible lost leads</option>
                  ) : (
                    eligibleLeads.map((lead) => (
                      <option key={lead._id} value={lead._id}>
                        {lead.name} · {lead.company} · {lead.stage} ·{' '}
                        {formatMarketingMoney(lead.expectedRevenue)}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    New Pipeline Stage *
                  </span>
                  <select
                    required
                    className={fieldClass}
                    value={winBackStage}
                    onChange={(event) => setWinBackStage(event.target.value)}
                  >
                    {WINBACK_TARGET_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Win-Back Action *
                  </span>
                  <select
                    required
                    className={fieldClass}
                    value={winBackAction}
                    onChange={(event) => setWinBackAction(event.target.value)}
                  >
                    {WINBACK_ACTION_TYPES.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Optional Notes</span>
                <input
                  maxLength={2000}
                  className={fieldClass}
                  value={winBackNotes}
                  onChange={(event) => setWinBackNotes(event.target.value)}
                  placeholder="Client requested updated proposal for Q3"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWinBackOpen(false)}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || eligibleLeads.length === 0}
                  className="h-9 rounded-lg border-0 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Updating…' : 'Update Stage & Re-Activate Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
