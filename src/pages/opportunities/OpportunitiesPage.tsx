import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import { useAuth } from '../../context/AuthContext';
import { canChangeOpportunityStage } from '../../utils/permissions';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { ApiError, crmApi } from '../../services/api';
import {
  OpportunityItem,
  OpportunityPaginationMeta,
  OpportunitySummary,
  stageProbability,
  isOpportunityStageLocked,
  opportunityLockLabel,
  isOpportunityWonStage,
  isOpportunityLostStage,
  canCreateOpportunityQuotation,
  describeOpportunityAmountBlock,
  getEstimatedDealValue,
} from '../../types/opportunities';
import { OpportunityPipeline, OpportunityPipelineStage } from '../../types/opportunity-pipelines';
import { useOpportunityStages } from '../../hooks/useOpportunityStages';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { formatCrmMoney } from '../../utils/currency';

function formatMoney(value?: number, currency?: string) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return formatCrmMoney(value, currency, { maximumFractionDigits: 0 });
}

export const OpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isClient, isAdmin, activeRole } = useAuth();
  const { confirm } = useDialog();
  const canWrite =
    hasPermission('crm.opportunities.write') || hasPermission('crm.leads.write');
  const canDelete =
    hasPermission('crm.opportunities.delete') || hasPermission('crm.leads.delete');
  /** A representative sees the stage but cannot move the deal themselves. */
  const canChangeStage =
    canWrite && canChangeOpportunityStage({ isAdmin, isClient, activeRole });
  /*
   * The active CRM extension decides what a won deal becomes: a Sales Order
   * (Product Sales) or an Invoice straight away (Project Delivery).
   */
  const { canConvertToSalesOrder, canConvertToInvoice, showSalesOrders } = useActiveExtension();
  const canViewSalesOrders = hasPermission('crm.orders.read') && !isClient && showSalesOrders;
  const canCreateSalesOrders =
    hasPermission('crm.orders.write') && !isClient && canConvertToSalesOrder;
  const canCreateInvoices = hasPermission('crm.finance.write') && !isClient && canConvertToInvoice;
  const opportunityStages = useOpportunityStages();
  const settingsCurrency = useDefaultCurrency();

  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [summary, setSummary] = useState<OpportunitySummary | null>(null);
  const [pagination, setPagination] = useState<OpportunityPaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pipelines, setPipelines] = useState<OpportunityPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(
    () => searchParams.get('pipeline') || 'all'
  );
  const [filterStage, setFilterStage] = useState(() => searchParams.get('stage') || '');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [lostModal, setLostModal] = useState<{ id: string; title: string; stage: string } | null>(
    null
  );
  const [lostReason, setLostReason] = useState('');
  const [savingStage, setSavingStage] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fieldClass =
    'h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    crmApi
      .listOpportunityPipelines()
      .then((res) => {
        if (Array.isArray(res.data)) {
          setPipelines(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const activePipeline = useMemo(() => {
    if (selectedPipelineId === 'all') return null;
    return pipelines.find((p) => p._id === selectedPipelineId) || null;
  }, [pipelines, selectedPipelineId]);

  const displayStages: Array<{ key: string; label: string; probability: number }> = useMemo(() => {
    if (activePipeline?.stages && activePipeline.stages.length) {
      return activePipeline.stages.map((s: OpportunityPipelineStage) => ({
        key: s.label,
        label: s.label,
        probability: Number(s.probability) || 50,
      }));
    }
    return opportunityStages;
  }, [activePipeline, opportunityStages]);

  const getItemStages = useCallback(
    (item: OpportunityItem) => {
      const pipe = (item.pipelineId && pipelines.find((p) => p._id === item.pipelineId)) || activePipeline;
      if (pipe?.stages && pipe.stages.length) {
        const list = pipe.stages.map((s: OpportunityPipelineStage) => ({
          key: s.label,
          label: s.label,
          probability: Number(s.probability) || 50,
        }));
        if (item.stage && !list.some((s) => s.key === item.stage)) {
          list.push({
            key: item.stage,
            label: item.stage,
            probability: item.probability || 50,
          });
        }
        return list;
      }
      const list: Array<{ key: string; label: string; probability: number }> = opportunityStages.map((s) => ({
        key: s.key,
        label: s.label,
        probability: s.probability,
      }));
      if (item.stage && !list.some((s) => s.key === item.stage)) {
        list.push({
          key: item.stage,
          label: item.stage,
          probability: item.probability || 50,
        });
      }
      return list;
    },
    [activePipeline, opportunityStages, pipelines]
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        crmApi.listOpportunities({
          page,
          limit: 20,
          search: debouncedSearch || undefined,
          stage: filterStage || undefined,
          pipelineId: selectedPipelineId !== 'all' ? selectedPipelineId : undefined,
        }),
        crmApi.getOpportunitySummary(),
      ]);
      setItems(listRes.data || []);
      setPagination(listRes.pagination || null);
      setSummary(sumRes.data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load opportunities', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStage, selectedPipelineId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStage, selectedPipelineId]);

  useEffect(() => {
    const next = searchParams.get('stage') || '';
    setFilterStage((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  useEffect(() => {
    const nextPipe = searchParams.get('pipeline') || 'all';
    setSelectedPipelineId((prev) => (prev === nextPipe ? prev : nextPipe));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (filterStage) params.set('stage', filterStage);
    else params.delete('stage');
    if (selectedPipelineId && selectedPipelineId !== 'all') params.set('pipeline', selectedPipelineId);
    else params.delete('pipeline');
    setSearchParams(params, { replace: true });
  }, [filterStage, selectedPipelineId]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const onStage = (e: Event) => {
      const stage = (e as CustomEvent<{ stage?: string }>).detail?.stage;
      if (typeof stage === 'string') {
        setFilterStage(stage);
        setPage(1);
      }
    };
    window.addEventListener('crm-opportunities-tour-stage', onStage as EventListener);
    return () =>
      window.removeEventListener('crm-opportunities-tour-stage', onStage as EventListener);
  }, []);






  const applyStageChange = async (
    item: OpportunityItem,
    stage: string,
    reason?: string
  ) => {
    try {
      const rowStages = getItemStages(item);
      await crmApi.changeOpportunityStage(item._id, {
        stage,
        probability: stageProbability(stage, rowStages),
        lostReason: isOpportunityLostStage(stage, item.stageType) ? reason : undefined,
      });
      showToast(`Moved to ${stage}`);
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Stage update failed', 'error');
      load();
    }
  };

  const handleStageChange = (item: OpportunityItem, stage: string) => {
    if (isOpportunityStageLocked(item)) return;
    if (isOpportunityLostStage(stage, item.stageType)) {
      setLostModal({ id: item._id, title: item.title, stage });
      setLostReason(item.lostReason || '');
      return;
    }
    applyStageChange(item, stage);
  };

  const confirmLost = async () => {
    if (!lostModal) return;
    const reason = lostReason.trim();
    if (!reason) {
      showToast('Lost reason is required', 'error');
      return;
    }
    setSavingStage(true);
    try {
      const item = items.find((o) => o._id === lostModal.id);
      if (!item) throw new Error('Opportunity not found');
      await applyStageChange(item, lostModal.stage, reason);
      setLostModal(null);
      setLostReason('');
    } finally {
      setSavingStage(false);
    }
  };

  const handleConvertQuotation = async (item: OpportunityItem) => {
    if (!(await confirm(`Generate quotation from "${item.title}"?`))) return;
    setConvertingId(item._id);
    try {
      const res = await crmApi.convertOpportunityToQuotation(item._id);
      showToast(res.message || 'Quotation generated successfully');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Convert failed', 'error');
    } finally {
      setConvertingId(null);
    }
  };

  const markOpportunityConverted = (opportunityId: string, salesOrderId?: string, salesOrderNo?: string) => {
    setItems((prev) =>
      prev.map((row) =>
        row._id === opportunityId
          ? {
              ...row,
              generatedSalesOrderId: salesOrderId || row.generatedSalesOrderId || null,
              generatedSalesOrderNo: salesOrderNo || row.generatedSalesOrderNo || null,
            }
          : row
      )
    );
  };

  const promptOpenExistingSalesOrder = async (salesOrderId?: string | null) => {
    const open = await confirm({
      title: 'Sales Order exists',
      message: 'A Sales Order already exists for this Opportunity.',
      confirmLabel: 'Open Sales Order',
      cancelLabel: 'Close',
    });
    if (open && salesOrderId && salesOrderId !== 'converted') {
      navigate(`/sales-orders/${salesOrderId}`);
    }
  };

  const handleConvertSalesOrder = async (item: OpportunityItem) => {
    if (item.generatedSalesOrderId) {
      await promptOpenExistingSalesOrder(item.generatedSalesOrderId);
      return;
    }
    if (!(await confirm(`Create sales order from "${item.title}"?`))) return;
    setConvertingId(item._id);
    try {
      const res = await crmApi.convertOpportunityToSalesOrder(item._id);
      const salesOrderId = res.data?.salesOrderId || '';
      markOpportunityConverted(item._id, salesOrderId);
      await load();
      showToast('Sales Order created', 'success');
      if (salesOrderId) navigate(`/sales-orders/${salesOrderId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sales order conversion failed';
      const existingId =
        err instanceof ApiError && err.data && typeof err.data === 'object'
          ? String((err.data as { salesOrderId?: string }).salesOrderId || '')
          : '';
      if (
        err instanceof ApiError &&
        (err.status === 409 ||
          err.code === 'SALES_ORDER_EXISTS' ||
          /already exists|converted/i.test(msg))
      ) {
        const soId = existingId || item.generatedSalesOrderId;
        markOpportunityConverted(item._id, soId || undefined);
        await load();
        await promptOpenExistingSalesOrder(soId || item.generatedSalesOrderId);
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = async (item: OpportunityItem) => {
    if (!(await confirm({ message: `Delete opportunity "${item.title}"? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteOpportunity(item._id);
      showToast('Opportunity deleted');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const filename = await crmApi.downloadOpportunitiesExport({
        format,
        search: debouncedSearch || undefined,
        stage: filterStage || undefined,
      });
      showToast(`Exported ${filename}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };


  const winRate =
    summary?.winRate != null
      ? summary.winRate
      : summary && (summary.wonDeals ?? 0) + (summary.lostDeals ?? 0) > 0
        ? Math.round(
            ((summary.wonDeals || 0) /
              ((summary.wonDeals || 0) + (summary.lostDeals || 0))) *
              1000
          ) / 10
        : 0;

  return (
    <div data-tour="opportunities-tour-landing" className="flex flex-col gap-5">
      {toast && (
        <div
          className={`fixed top-20 right-6 z-[80] px-4 py-2.5 rounded-lg text-xs font-semibold border ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-1 border-b border-zinc-200">
        <div data-tour="opportunities-title">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">
            Sales Pipeline
          </p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">Opportunities</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Track deals and convert won opportunities to quotations or sales orders.
          </p>
        </div>
        <div data-tour="opportunities-header-actions" className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
          >
            <RefreshIcon sx={{ fontSize: 15 }} />
            Refresh
          </button>

          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              disabled={exporting}
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
            >
              <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} />
              {exporting ? 'Exporting…' : 'Export'}
              <span className="text-[10px] text-zinc-400">▼</span>
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-300 rounded-lg py-1 z-30 min-w-[140px] flex flex-col">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-xs text-zinc-700 bg-transparent border-none cursor-pointer"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-xs text-zinc-700 bg-transparent border-none cursor-pointer"
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>

          {canWrite && (
            <>
              <button
                type="button"
                data-tour="opportunities-new-deal-btn"
                onClick={() => navigate('/opportunities/create')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer"
              >
                <AddIcon sx={{ fontSize: 16 }} />
                New Deal
              </button>
            </>
          )}
          <TourButton
            moduleId="opportunities"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
          />
        </div>
      </div>

      <div data-tour="opportunities-kpis" className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-2 gap-3 max-w-xl">
        {summary ? (
          [
            { label: 'Total Deals', value: String(summary.totalDeals ?? 0) },
            {
              label: 'Win Rate %',
              value: `${Number(winRate || 0).toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}%`,
            },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-zinc-300 rounded-xl p-4 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {card.label}
              </div>
              <div className="text-xl font-bold text-zinc-950 mt-1 truncate" title={String(card.value)}>
                {card.value}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-400">
            Loading pipeline metrics…
          </div>
        )}
      </div>

      <div
        data-tour="opportunities-filters"
        className="bg-white border border-zinc-300 rounded-xl p-4 flex flex-col gap-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label data-tour="opportunities-search" className="flex flex-col gap-1 min-w-[220px] max-w-md flex-1">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase">Search</span>
            <input
              className={fieldClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deal # or client name (e.g. OPP-001, AR)…"
            />
          </label>
        </div>

        <div data-tour="opportunities-stage-pills" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterStage('')}
            className={`px-3 h-8 text-[11px] font-semibold rounded-lg border cursor-pointer transition-colors ${
              filterStage === ''
                ? 'bg-zinc-950 text-white border-zinc-950'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            All
          </button>
          {displayStages.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFilterStage(s.key)}
              className={`px-3 h-8 text-[11px] font-semibold rounded-lg border cursor-pointer transition-colors ${
                filterStage === s.key
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
              }`}
              title={`${s.label} · ${s.probability}%`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="opportunities-table" className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500 animate-pulse">Loading deals…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">No opportunities found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1200px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  {[
                    'Deal',
                    'Client',
                    'Stage',
                    'Estimated Deal Value',
                    'Probability',
                    'Close Date',
                    'Owner',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const locked = isOpportunityStageLocked(item);
                  const lockLabel = opportunityLockLabel(item);
                  const prob = item.probability ?? stageProbability(item.stage, opportunityStages);
                  const barColor =
                    prob >= 70
                      ? 'bg-foreground'
                      : prob >= 40
                        ? 'bg-muted-foreground'
                        : 'bg-border';
                  const busy = convertingId === item._id;
                  const preferOpp6 = items.some((entry) => entry._id === 'opp_6');
                  const actionsTourTarget = preferOpp6
                    ? item._id === 'opp_6'
                      ? 'opportunities-row-actions'
                      : undefined
                    : index === 0
                      ? 'opportunities-row-actions'
                      : undefined;

                  return (
                    <tr
                      key={item._id}
                      data-tour={index === 0 ? 'opportunities-row-first' : undefined}
                      data-opportunity-id={item._id}
                      className="border-b border-zinc-100 hover:bg-zinc-50/70"
                    >                      <td className="px-4 py-3">
                        <Link
                          to={`/opportunities/${item._id}`}
                          className="text-sm font-semibold text-zinc-950 no-underline hover:underline"
                        >
                          {item.title}
                        </Link>
                        {item.opportunityNumber && (
                          <code className="block text-[11px] text-zinc-500 font-mono mt-0.5">
                            {item.opportunityNumber}
                          </code>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-700">
                        {item.clientName || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {canWrite && canChangeStage && !locked ? (
                          <select
                            value={item.stage}
                            onChange={(e) => handleStageChange(item, e.target.value)}
                            className={`h-8 px-2 text-xs border rounded-lg max-w-[180px] ${
                              isOpportunityWonStage(item.stage, item.stageType)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : isOpportunityLostStage(item.stage, item.stageType)
                                  ? 'border-border bg-muted text-muted-foreground'
                                  : 'border-border bg-card text-foreground'
                            }`}
                          >
                            {getItemStages(item).map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <span className="text-xs font-semibold text-zinc-700">
                              {item.stage}
                            </span>
                            {locked && lockLabel && (
                              <span className="block mt-1 text-[10px] font-bold text-zinc-500 tracking-wide">
                                {lockLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">
                        {formatMoney(getEstimatedDealValue(item), item.currency || settingsCurrency)}
                      </td>
                      <td className="px-4 py-3 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${Math.min(100, Math.max(0, prob))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-foreground w-8 text-right">
                            {prob}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {item.expectedCloseDate
                          ? new Date(item.expectedCloseDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {item.salesOwnerName || item.salesOwner || '—'}
                      </td>
                      <td className="px-4 py-3" data-tour={actionsTourTarget}>
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          <Link
                            to={`/opportunities/${item._id}`}
                            title="Open deal"
                            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-[11px] font-semibold text-zinc-800 no-underline"
                          >
                            <VisibilityOutlinedIcon sx={{ fontSize: 14 }} />
                            Open
                          </Link>
                          {canWrite && canCreateOpportunityQuotation(item) && (
                              <button
                                type="button"
                                disabled={busy || Boolean(describeOpportunityAmountBlock(item))}
                                onClick={() => handleConvertQuotation(item)}
                                title={
                                  describeOpportunityAmountBlock(item) || 'Create Quotation'
                                }
                                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-[11px] font-semibold text-zinc-800 cursor-pointer disabled:opacity-50"
                              >
                                <RequestQuoteOutlinedIcon sx={{ fontSize: 14 }} />
                                Quote
                              </button>
                            )}
                          {isOpportunityWonStage(item.stage, item.stageType) &&
                            !item.generatedSalesOrderId &&
                            canCreateSalesOrders && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleConvertSalesOrder(item)}
                                title="Create Sales Order"
                                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-[11px] font-semibold text-zinc-800 cursor-pointer disabled:opacity-50"
                              >
                                <ShoppingCartOutlinedIcon sx={{ fontSize: 14 }} />
                                Create Sales Order
                              </button>
                            )}
                          {isOpportunityWonStage(item.stage, item.stageType) &&
                            canCreateInvoices && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  navigate(`/invoices/create?opportunityId=${encodeURIComponent(item._id)}`)
                                }
                                title="Create Invoice from this won deal"
                                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[11px] font-semibold text-indigo-900 cursor-pointer disabled:opacity-50"
                              >
                                <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />
                                Create Invoice
                              </button>
                            )}
                          {isOpportunityWonStage(item.stage, item.stageType) &&
                            item.generatedSalesOrderId &&
                            item.generatedSalesOrderId !== 'converted' &&
                            canViewSalesOrders && (
                            <Link
                              to={`/sales-orders/${item.generatedSalesOrderId}`}
                              title={
                                item.generatedSalesOrderNo
                                  ? `Open Sales Order ${item.generatedSalesOrderNo}`
                                  : 'Open Sales Order'
                              }
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-800 no-underline"
                            >
                              <ShoppingCartOutlinedIcon sx={{ fontSize: 14 }} />
                              Open Sales Order
                            </Link>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-red-50 text-red-600 inline-flex items-center justify-center cursor-pointer"
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
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

        {pagination && pagination.totalPages > 1 && (
          <div
            data-tour="opportunities-pagination"
            className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50"
          >
            <span className="text-xs text-zinc-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} deals
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage(pagination.page - 1)}
                className="px-3 h-8 text-xs font-semibold rounded-lg border border-zinc-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(pagination.page + 1)}
                className="px-3 h-8 text-xs font-semibold rounded-lg border border-zinc-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {lostModal && (
        <div className="fixed inset-0 z-[90] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-300 rounded-xl w-full max-w-md p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-950 m-0">Mark as Lost</h2>
              <button
                type="button"
                onClick={() => {
                  setLostModal(null);
                  setLostReason('');
                  load();
                }}
                className="text-xs font-semibold text-zinc-500 bg-transparent border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-zinc-500 m-0">
              Reason for losing <strong className="text-zinc-800">{lostModal.title}</strong>
            </p>
            <textarea
              rows={3}
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Competitor pricing, budget cancelled, specification mismatch"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 resize-y box-border"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setLostModal(null);
                  setLostReason('');
                  load();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingStage}
                onClick={confirmLost}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer disabled:opacity-50"
              >
                {savingStage ? 'Saving…' : 'Confirm Lost'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
