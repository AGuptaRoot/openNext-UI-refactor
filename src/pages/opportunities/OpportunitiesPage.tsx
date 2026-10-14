import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import FlashOnOutlinedIcon from '@mui/icons-material/FlashOnOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
import { ClientItem } from '../../types/clients';
import { LeadItem } from '../../types/leads';
import { ClientSelect } from '../../components/clients/ClientSelect';
import {
  OpportunityItem,
  OpportunityPaginationMeta,
  OpportunityProductLine,
  OpportunitySummary,
  INDIAN_STATES,
  DEFAULT_STATE_SHIPPING_RATES,
  DEAL_TEMPLATES,
  stageProbability,
  isOpportunityStageLocked,
  opportunityLockLabel,
  computeOpportunityFinancials,
  calcLineAmount,
  isOpportunityWonStage,
  isOpportunityLostStage,
  canCreateOpportunityQuotation,
} from '../../types/opportunities';
import { useOpportunityStages } from '../../hooks/useOpportunityStages';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { formatCrmMoney } from '../../utils/currency';

const DEFAULT_COMPANY_STATE = 'Maharashtra';
const TAX_OPTIONS = [0, 5, 12, 18, 28];

type QuickLine = {
  key: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  tax: number;
};

function formatMoney(value?: number, currency?: string) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return formatCrmMoney(value, currency, { maximumFractionDigits: 0 });
}

function dealValue(item: OpportunityItem): number {
  return item.expectedRevenue ?? item.value ?? 0;
}

function weightedValue(item: OpportunityItem): number {
  if (item.weightedRevenue != null) return item.weightedRevenue;
  const value = dealValue(item);
  const prob = item.probability ?? stageProbability(item.stage);
  return Math.round((value * prob) / 100);
}

function newQuickLine(partial?: Partial<QuickLine>): QuickLine {
  return {
    key: `ql_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productName: partial?.productName ?? '',
    quantity: partial?.quantity ?? 1,
    unitPrice: partial?.unitPrice ?? 0,
    tax: partial?.tax ?? 18,
  };
}

function defaultCloseDate() {
  return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
}

export const OpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { alert, confirm } = useDialog();
  const canWrite =
    hasPermission('crm.opportunities.write') || hasPermission('crm.leads.write');
  const canDelete =
    hasPermission('crm.opportunities.delete') || hasPermission('crm.leads.delete');
  const opportunityStages = useOpportunityStages();
  const settingsCurrency = useDefaultCurrency();
  const defaultStageKey = opportunityStages[0]?.key || 'Discovery';

  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [summary, setSummary] = useState<OpportunitySummary | null>(null);
  const [pagination, setPagination] = useState<OpportunityPaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  // Quick Create Modal
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [settingsRates, setSettingsRates] = useState<Record<string, number>>(
    DEFAULT_STATE_SHIPPING_RATES
  );
  const [companyState, setCompanyState] = useState(DEFAULT_COMPANY_STATE);
  const [qcTitle, setQcTitle] = useState('');
  const [qcClientId, setQcClientId] = useState('');
  const [qcLeadId, setQcLeadId] = useState('');
  const [qcStage, setQcStage] = useState(defaultStageKey);
  const [qcCloseDate, setQcCloseDate] = useState(defaultCloseDate());
  const [qcContactPerson, setQcContactPerson] = useState('');
  const [qcContactEmail, setQcContactEmail] = useState('');
  const [qcContactMobile, setQcContactMobile] = useState('');
  const [qcShippingState, setQcShippingState] = useState(DEFAULT_COMPANY_STATE);
  const [qcLines, setQcLines] = useState<QuickLine[]>([newQuickLine()]);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

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
  }, [page, debouncedSearch, filterStage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStage]);

  useEffect(() => {
    const next = searchParams.get('stage') || '';
    setFilterStage((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (filterStage) params.set('stage', filterStage);
    else params.delete('stage');
    setSearchParams(params, { replace: true });
  }, [filterStage]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuickMeta = useCallback(async () => {
    if (metaLoaded) return;
    try {
      const [clientsRes, leadsRes, settingsRes] = await Promise.all([
        crmApi.listClients({ limit: 200 }).catch(() => ({ data: [] as ClientItem[] })),
        crmApi.getLeads({ limit: 200 }).catch(() => ({ data: [] as LeadItem[] })),
        crmApi.getSettings().catch(() => ({ data: null })),
      ]);
      setClients(clientsRes.data || []);
      setLeads(leadsRes.data || []);
      if (settingsRes?.data) {
        const s = settingsRes.data;
        if (s.company_state) {
          setCompanyState(s.company_state);
          setQcShippingState(s.company_state);
        }
        if (s.state_shipping_rates && Object.keys(s.state_shipping_rates).length > 0) {
          setSettingsRates({ ...DEFAULT_STATE_SHIPPING_RATES, ...s.state_shipping_rates });
        }
      }
      setMetaLoaded(true);
    } catch {
      /* keep defaults */
    }
  }, [metaLoaded]);

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

  const statesList = useMemo(() => {
    const fromRates = Object.keys(settingsRates);
    return Array.from(new Set([...fromRates, ...INDIAN_STATES])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [settingsRates]);

  const qcProducts: OpportunityProductLine[] = useMemo(
    () =>
      qcLines
        .filter((l) => l.productName.trim())
        .map((l) => ({
          productName: l.productName.trim(),
          quantity: Math.max(1, Number(l.quantity) || 1),
          unitPrice: Math.max(0, Number(l.unitPrice) || 0),
          tax: Math.max(0, Number(l.tax) || 0),
          amount:
            Math.max(1, Number(l.quantity) || 1) * Math.max(0, Number(l.unitPrice) || 0),
        })),
    [qcLines]
  );

  const qcFinancials = useMemo(
    () =>
      computeOpportunityFinancials(
        qcProducts,
        0,
        stageProbability(qcStage, opportunityStages)
      ),
    [qcProducts, qcStage, opportunityStages]
  );

  useEffect(() => {
    if (!opportunityStages.length) return;
    setQcStage((prev) =>
      opportunityStages.some((s) => s.key === prev) ? prev : opportunityStages[0].key
    );
  }, [opportunityStages]);

  const resetQuickForm = () => {
    setQcTitle('');
    setQcClientId('');
    setQcLeadId('');
    setQcStage(defaultStageKey);
    setQcCloseDate(defaultCloseDate());
    setQcContactPerson('');
    setQcContactEmail('');
    setQcContactMobile('');
    setQcShippingState(companyState);
    setQcLines([newQuickLine()]);
  };

  const openQuickCreate = async () => {
    await loadQuickMeta();
    resetQuickForm();
    setQuickOpen(true);
  };

  const applyTemplate = (templateIndex: number) => {
    const tpl = DEAL_TEMPLATES[templateIndex];
    if (!tpl) return;
    setQcTitle(tpl.title);
    setQcLines(
      tpl.items.map((item) =>
        newQuickLine({
          productName: item.name,
          quantity: item.qty,
          unitPrice: item.price,
          tax: item.tax,
        })
      )
    );
  };

  const applyStageChange = async (
    item: OpportunityItem,
    stage: string,
    reason?: string
  ) => {
    try {
      await crmApi.changeOpportunityStage(item._id, {
        stage,
        probability: stageProbability(stage, opportunityStages),
        lostReason: isOpportunityLostStage(stage) ? reason : undefined,
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
    if (isOpportunityLostStage(stage)) {
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

  const handleConvertSalesOrder = async (item: OpportunityItem) => {
    if (item.generatedSalesOrderId) {
      await alert({
        title: 'Opportunity Converted',
        message: 'This opportunity converted',
      });
      return;
    }
    if (!(await confirm(`Generate sales order from "${item.title}"?`))) return;
    setConvertingId(item._id);
    try {
      await crmApi.convertOpportunityToSalesOrder(item._id);
      await load();
      await alert({
        title: 'Opportunity Converted',
        message: 'This opportunity converted',
      });
      showToast('This opportunity converted', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sales order conversion failed';
      if (msg.toLowerCase().includes('converted')) {
        await load();
        await alert({
          title: 'Opportunity Converted',
          message: 'This opportunity converted',
        });
        showToast('This opportunity converted', 'success');
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

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = qcTitle.trim();
    if (!title) {
      showToast('Deal title is required', 'error');
      return;
    }
    if (!qcClientId && !qcLeadId) {
      showToast('Select a client or a lead', 'error');
      return;
    }
    if (!qcShippingState.trim()) {
      showToast('Shipping destination state is required', 'error');
      return;
    }
    if (!qcProducts.length) {
      showToast('Add at least one product line item', 'error');
      return;
    }

    const client = clients.find((c) => c._id === qcClientId);
    setQuickSaving(true);
    try {
      await crmApi.createOpportunity({
        title,
        clientId: qcClientId || undefined,
        clientName: client?.name || client?.companyName,
        leadId: qcLeadId || undefined,
        stage: qcStage,
        probability: stageProbability(qcStage, opportunityStages),
        expectedCloseDate: qcCloseDate || undefined,
        contactPerson: qcContactPerson.trim() || undefined,
        contactEmail: qcContactEmail.trim() || undefined,
        contactMobile: qcContactMobile.trim() || undefined,
        shippingState: qcShippingState,
        shippingCharge: 0,
        products: qcProducts,
        expectedRevenue: qcFinancials.expectedRevenue,
        value: qcFinancials.expectedRevenue,
        currency: settingsCurrency,
      });
      showToast('Opportunity created');
      setQuickOpen(false);
      resetQuickForm();
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setQuickSaving(false);
    }
  };

  const fieldClass =
    'h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white';

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
            Track deals, weighted forecast, and convert won deals to quotations or sales orders.
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
                data-tour="opportunities-quick-create-btn"
                onClick={openQuickCreate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
              >
                <FlashOnOutlinedIcon sx={{ fontSize: 15 }} />
                Quick Create
              </button>
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

      <div data-tour="opportunities-kpis" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {summary ? (
          [
            { label: 'Total Deals', value: String(summary.totalDeals ?? 0) },
            { label: 'Pipeline Value', value: formatMoney(summary.pipelineValue ?? 0) },
            { label: 'Weighted Forecast', value: formatMoney(summary.weightedForecast ?? 0) },
            { label: 'Won Revenue', value: formatMoney(summary.wonRevenue ?? 0) },
            {
              label: 'Win Rate %',
              value: `${Number(winRate || 0).toLocaleString('en-IN', {
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
        <label data-tour="opportunities-search" className="flex flex-col gap-1 min-w-[220px] max-w-md">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Search</span>
          <input
            className={fieldClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deal # or client name (e.g. OPP-001, AR)…"
          />
        </label>

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
          {opportunityStages.map((s) => (
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
              {isOpportunityWonStage(s.key)
                ? 'Won'
                : isOpportunityLostStage(s.key)
                  ? 'Lost'
                  : s.label}
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
                    'Value',
                    'Weighted Value',
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
                    prob >= 70 ? 'bg-zinc-900' : prob >= 40 ? 'bg-zinc-600' : 'bg-zinc-300';
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
                        {canWrite && !locked ? (
                          <select
                            value={item.stage}
                            onChange={(e) => handleStageChange(item, e.target.value)}
                            className={`h-8 px-2 text-xs border rounded-lg max-w-[180px] ${
                              isOpportunityWonStage(item.stage)
                                ? 'border-zinc-950 bg-zinc-950 text-white'
                                : isOpportunityLostStage(item.stage)
                                  ? 'border-zinc-200 bg-zinc-100 text-zinc-500'
                                  : 'border-zinc-200 bg-white text-zinc-800'
                            }`}
                          >
                            {opportunityStages.map((s) => (
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
                      <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                        {formatMoney(dealValue(item), item.currency)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-zinc-600">
                        {formatMoney(weightedValue(item), item.currency)}
                      </td>
                      <td className="px-4 py-3 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${Math.min(100, Math.max(0, prob))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-zinc-700 w-8 text-right">
                            {prob}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {item.expectedCloseDate
                          ? new Date(item.expectedCloseDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
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
                                disabled={busy}
                                onClick={() => handleConvertQuotation(item)}
                                title="Create Quotation"
                                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-[11px] font-semibold text-zinc-800 cursor-pointer disabled:opacity-50"
                              >
                                <RequestQuoteOutlinedIcon sx={{ fontSize: 14 }} />
                                Quote
                              </button>
                            )}
                          {canWrite &&
                            isOpportunityWonStage(item.stage) &&
                            !item.generatedSalesOrderId && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleConvertSalesOrder(item)}
                                title="Convert to Sales Order"
                                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-[11px] font-semibold text-zinc-800 cursor-pointer disabled:opacity-50"
                              >
                                <ShoppingCartOutlinedIcon sx={{ fontSize: 14 }} />
                                Sales Order
                              </button>
                            )}
                          {item.generatedSalesOrderId && (
                            <Link
                              to={`/sales-orders/${item.generatedSalesOrderId}`}
                              title={item.generatedSalesOrderNo ? `Open Sales Order ${item.generatedSalesOrderNo}` : 'Open Sales Order'}
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-800 no-underline"
                            >
                              <ShoppingCartOutlinedIcon sx={{ fontSize: 14 }} />
                              SO
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

      {quickOpen && (
        <div className="fixed inset-0 z-[90] bg-black/30 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleQuickSubmit}
            className="bg-white border border-zinc-300 rounded-xl w-full max-w-3xl my-4 p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-950 m-0">Quick Create Opportunity</h2>
                <p className="text-xs text-zinc-500 m-0 mt-1">
                  Rapid deal entry — use New Deal for the full workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickOpen(false);
                  resetQuickForm();
                }}
                className="text-xs font-semibold text-zinc-500 bg-transparent border-none cursor-pointer"
              >
                Close
              </button>
            </div>

            {DEAL_TEMPLATES.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {DEAL_TEMPLATES.map((tpl, idx) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => applyTemplate(idx)}
                    className="px-2.5 h-7 text-[10px] font-semibold rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 cursor-pointer"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Opportunity Title *
                </span>
                <input
                  className={fieldClass}
                  value={qcTitle}
                  onChange={(e) => setQcTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Deal title"
                  required
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Client <span className="normal-case font-normal">(or lead)</span>
                </span>
                <ClientSelect
                  clients={clients}
                  value={qcClientId}
                  placeholder="Select client…"
                  onChange={(id) => {
                    setQcClientId(id);
                    const client = clients.find((c) => c._id === id);
                    if (client) {
                      const clientState =
                        client.state ||
                        client.billingAddress?.state ||
                        client.shippingAddress?.state ||
                        '';
                      if (clientState) {
                        const match = statesList.find(
                          (s) => s.toLowerCase() === clientState.trim().toLowerCase()
                        );
                        if (match) {
                          setQcShippingState(match);
                        }
                      }
                      if (!qcContactPerson && (client.contactPerson || client.primaryContact?.name)) {
                        setQcContactPerson(
                          client.contactPerson || client.primaryContact?.name || ''
                        );
                      }
                      if (!qcContactEmail && (client.email || client.primaryContact?.email)) {
                        setQcContactEmail(client.email || client.primaryContact?.email || '');
                      }
                      if (
                        !qcContactMobile &&
                        (client.mobile || client.phone || client.primaryContact?.phone)
                      ) {
                        setQcContactMobile(
                          client.mobile || client.phone || client.primaryContact?.phone || ''
                        );
                      }
                    }
                  }}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Lead <span className="normal-case font-normal">(or client)</span>
                </span>
                <select
                  className={fieldClass}
                  value={qcLeadId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setQcLeadId(nextId);
                    const lead = leads.find((l) => l._id === nextId);
                    if (!lead) return;
                    if (!qcTitle.trim()) {
                      setQcTitle(
                        `Deal with ${lead.company || lead.contactName || lead.name || 'Lead'}`
                      );
                    }
                    if (!qcContactPerson && (lead.contactName || lead.name)) {
                      setQcContactPerson(lead.contactName || lead.name || '');
                    }
                    if (!qcContactEmail && lead.email) setQcContactEmail(lead.email);
                    if (!qcContactMobile && lead.phone) setQcContactMobile(lead.phone);
                  }}
                  data-tour="opportunities-quick-lead"
                >
                  <option value="">-- None --</option>
                  {leads.map((l) => {
                    const comp = l.company || 'Individual Prospect';
                    const contact = l.contactName || l.name ? ` (${l.contactName || l.name})` : '';
                    return (
                      <option key={l._id} value={l._id}>
                        {comp}
                        {contact}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Pipeline Stage *
                </span>
                <select
                  className={fieldClass}
                  value={qcStage}
                  onChange={(e) => setQcStage(e.target.value)}
                  required
                >
                  {opportunityStages
                    .filter((s) => !isOpportunityLostStage(s.key))
                    .map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} ({s.probability}%)
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Shipping State *
                </span>
                <select
                  className={fieldClass}
                  value={qcShippingState}
                  onChange={(e) => setQcShippingState(e.target.value)}
                  required
                >
                  {statesList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Expected Close Date
                </span>
                <input
                  type="date"
                  className={fieldClass}
                  value={qcCloseDate}
                  onChange={(e) => setQcCloseDate(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Contact Person
                </span>
                <input
                  className={fieldClass}
                  value={qcContactPerson}
                  onChange={(e) => setQcContactPerson(e.target.value)}
                  placeholder="Primary buyer"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Contact Email
                </span>
                <input
                  type="email"
                  className={fieldClass}
                  value={qcContactEmail}
                  onChange={(e) => setQcContactEmail(e.target.value)}
                  placeholder="email@company.com"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Contact Mobile
                </span>
                <input
                  type="tel"
                  className={fieldClass}
                  value={qcContactMobile}
                  onChange={(e) => setQcContactMobile(e.target.value)}
                  placeholder="Phone"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Product Line Items *
                </span>
                <button
                  type="button"
                  onClick={() => setQcLines((prev) => [...prev, newQuickLine()])}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 bg-transparent border-none cursor-pointer"
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                  Add row
                </button>
              </div>
              <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                <table className="w-full text-left min-w-[640px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      {['Product / Service', 'Qty', 'Unit Price', 'Tax %', 'Amount', ''].map(
                        (h) => (
                          <th
                            key={h || 'act'}
                            className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {qcLines.map((line, idx) => {
                      const amount = calcLineAmount(
                        Math.max(1, Number(line.quantity) || 1),
                        Math.max(0, Number(line.unitPrice) || 0),
                        Math.max(0, Number(line.tax) || 0)
                      );
                      return (
                        <tr key={line.key} className="border-b border-zinc-100">
                          <td className="px-2 py-1.5">
                            <input
                              className="h-8 px-2 text-xs border border-zinc-200 rounded-md w-full box-border outline-none focus:border-zinc-400"
                              value={line.productName}
                              onChange={(e) =>
                                setQcLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx ? { ...l, productName: e.target.value } : l
                                  )
                                )
                              }
                              placeholder="Item description"
                            />
                          </td>
                          <td className="px-2 py-1.5 w-20">
                            <input
                              type="number"
                              min={1}
                              className="h-8 px-2 text-xs border border-zinc-200 rounded-md w-full box-border outline-none focus:border-zinc-400"
                              value={line.quantity}
                              onChange={(e) =>
                                setQcLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) }
                                      : l
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5 w-28">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-8 px-2 text-xs border border-zinc-200 rounded-md w-full box-border outline-none focus:border-zinc-400"
                              value={line.unitPrice}
                              onChange={(e) =>
                                setQcLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? {
                                          ...l,
                                          unitPrice: Math.max(0, Number(e.target.value) || 0),
                                        }
                                      : l
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5 w-24">
                            <select
                              className="h-8 px-2 text-xs border border-zinc-200 rounded-md w-full box-border outline-none focus:border-zinc-400 bg-white"
                              value={line.tax}
                              onChange={(e) =>
                                setQcLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx ? { ...l, tax: Number(e.target.value) } : l
                                  )
                                )
                              }
                            >
                              {TAX_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-1.5 text-xs font-semibold text-zinc-800 whitespace-nowrap">
                            {formatMoney(amount)}
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              disabled={qcLines.length <= 1}
                              onClick={() =>
                                setQcLines((prev) =>
                                  prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="w-7 h-7 rounded-md border border-zinc-200 bg-white hover:bg-red-50 text-red-600 inline-flex items-center justify-center cursor-pointer disabled:opacity-30"
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
              <div className="text-xs text-zinc-600">
                <span className="font-semibold text-zinc-800">Subtotal: </span>
                {formatMoney(qcFinancials.subtotal)}
                <span className="mx-2 text-zinc-300">·</span>
                <span className="font-semibold text-zinc-800">Tax: </span>
                {formatMoney(qcFinancials.taxTotal)}
                <span className="mx-2 text-zinc-300">·</span>
                <span className="font-semibold text-zinc-800">Deal value: </span>
                {formatMoney(qcFinancials.expectedRevenue)}
                <span className="mx-2 text-zinc-300">·</span>
                <span className="font-semibold text-zinc-800">Weighted: </span>
                {formatMoney(qcFinancials.weightedRevenue)}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickOpen(false);
                    resetQuickForm();
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickSaving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer disabled:opacity-50"
                >
                  {quickSaving ? 'Saving…' : 'Save Opportunity'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
