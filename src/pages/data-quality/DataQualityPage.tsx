import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AlertTriangle, Settings } from 'lucide-react';

import { ApiError, crmApi } from '../../services/api';
import { TourButton } from '../../ui/tour';
import type {
  DataQualityIssue,
  DataQualityRules,
  DataQualitySummary,
  AdminPagination,
} from '../../types/admin';
import type { PersonContact } from '../../types/contacts';
import { ContactDuplicateBanner } from '../../components/contacts/ContactDuplicateBanner';
import {
  ExportResultModal,
  ExportResult,
} from '../../components/leads/ExportResultModal';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

const REASON_LABELS: Record<string, string> = {
  email: 'Same email',
  mobile: 'Same mobile',
  pan: 'Same PAN',
  company: 'Similar company',
};

const DEFAULT_LEAD_WEIGHTS: Record<string, number> = {
  name: 10,
  email: 15,
  phone: 15,
  company: 15,
  pan: 15,
  address: 10,
  owner: 10,
  duplicates: 10,
};

const DEFAULT_CLIENT_WEIGHTS: Record<string, number> = {
  name: 15,
  email: 15,
  phone: 15,
  website: 10,
  address: 15,
  taxId: 10,
  contact: 10,
  duplicates: 10,
};

const DEFAULT_THRESHOLDS = {
  excellent: 85,
  good: 70,
  needsAttention: 50,
};

const emptySummary: DataQualitySummary = {
  leads: { duplicates: 0, lowQuality: 0, averageScore: 0 },
  clients: { duplicates: 0, lowQuality: 0, averageScore: 0 },
};

export const DataQualityPage: React.FC = () => {
  const navigate = useNavigate();
  const settingsCurrency = useDefaultCurrency();

  // Primary data state
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [summary, setSummary] = useState<DataQualitySummary>(emptySummary);
  const [pagination, setPagination] = useState<AdminPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [warningMessage, setWarningMessage] = useState<string>('');

  // Filters state
  const [view, setView] = useState<'duplicates' | 'low-quality'>('duplicates');
  const [recordType, setRecordType] = useState<'lead' | 'client'>('lead');
  const [matchType, setMatchType] = useState<'all' | 'exact' | 'similar'>('all');
  const [maxScore, setMaxScore] = useState<number>(69);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Scoring rules modal state
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rules, setRules] = useState<DataQualityRules | null>(null);
  const [modalLeadWeights, setModalLeadWeights] = useState<Record<string, number>>(DEFAULT_LEAD_WEIGHTS);
  const [modalClientWeights, setModalClientWeights] = useState<Record<string, number>>(DEFAULT_CLIENT_WEIGHTS);
  const [modalThresholds, setModalThresholds] = useState(DEFAULT_THRESHOLDS);
  const [savingRules, setSavingRules] = useState(false);

  // Export state
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Notification toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Duplicate lead review: Choose existing contact / Create new lead
  const [reviewItem, setReviewItem] = useState<DataQualityIssue | null>(null);
  const [reviewContacts, setReviewContacts] = useState<PersonContact[]>([]);
  const [reviewContactsLoading, setReviewContactsLoading] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const onView = (e: Event) => {
      const next = (e as CustomEvent<{ view?: 'duplicates' | 'low-quality' }>).detail?.view;
      if (next === 'duplicates' || next === 'low-quality') {
        setView(next);
        setPage(1);
      }
    };
    const onRules = (e: Event) => {
      const open = (e as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof open === 'boolean') {
        if (open) {
          if (rules) {
            setModalLeadWeights(rules.leadWeights || DEFAULT_LEAD_WEIGHTS);
            setModalClientWeights(rules.clientWeights || DEFAULT_CLIENT_WEIGHTS);
            setModalThresholds(rules.thresholds || DEFAULT_THRESHOLDS);
          }
          setRulesModalOpen(true);
        } else {
          setRulesModalOpen(false);
        }
      }
    };
    const onExport = (e: Event) => {
      const open = (e as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof open === 'boolean') setExportOpen(open);
    };
    window.addEventListener('crm-data-quality-tour-view', onView as EventListener);
    window.addEventListener('crm-data-quality-tour-rules', onRules as EventListener);
    window.addEventListener('crm-data-quality-tour-export', onExport as EventListener);
    return () => {
      window.removeEventListener('crm-data-quality-tour-view', onView as EventListener);
      window.removeEventListener('crm-data-quality-tour-rules', onRules as EventListener);
      window.removeEventListener('crm-data-quality-tour-export', onExport as EventListener);
    };
  }, [rules]);

  // Fetch scoring rules once
  useEffect(() => {
    crmApi.getDataQualityRules()
      .then((res) => {
        if (res.data) {
          setRules(res.data);
          setModalLeadWeights(res.data.leadWeights || DEFAULT_LEAD_WEIGHTS);
          setModalClientWeights(res.data.clientWeights || DEFAULT_CLIENT_WEIGHTS);
          setModalThresholds(res.data.thresholds || DEFAULT_THRESHOLDS);
        }
      })
      .catch((err) => {
        console.warn('Failed to load rules:', err);
      });
  }, []);

  // Load reviews list & metrics
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.getDataQuality({
        view,
        recordType,
        matchType: view === 'duplicates' ? matchType : undefined,
        maxScore: view === 'low-quality' ? maxScore : undefined,
        search: debouncedSearch,
        page,
        limit: 20,
      });

      setIssues(response.data || []);
      if (response.summary) setSummary(response.summary);
      if (response.pagination) setPagination(response.pagination);

      // Check meta warnings if present
      const meta = (response as unknown as { meta?: { truncated?: boolean; comparisonLimited?: boolean; maxScanRecords?: number } }).meta;
      const warnings: string[] = [];
      if (meta?.truncated) {
        warnings.push(`More than ${meta.maxScanRecords || 1000} active records exist; displaying newest review window.`);
      }
      if (meta?.comparisonLimited) {
        warnings.push('Similar-company comparisons reached safety limit; use exact-match filters or refine search.');
      }
      setWarningMessage(warnings.join(' '));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to scan data quality', 'error');
    } finally {
      setLoading(false);
    }
  }, [view, recordType, matchType, maxScore, debouncedSearch, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Open record detail
  const handleOpenRecord = (id: string) => {
    if (recordType === 'lead') {
      navigate(`/leads/${id}`);
    } else {
      navigate(`/clients/${id}`);
    }
  };

  const closeReviewModal = (force = false) => {
    if (reviewBusy && !force) return;
    setReviewItem(null);
    setReviewContacts([]);
    setReviewError(null);
    setReviewBusy(false);
  };

  /** Review lead duplicates — load matching PersonContacts by email / mobile / PAN. */
  const openLeadDuplicateReview = async (item: DataQualityIssue) => {
    setReviewItem(item);
    setReviewError(null);
    setReviewContacts([]);
    setReviewContactsLoading(true);
    try {
      const res = await crmApi.checkContactDuplicates({
        email: item.email || undefined,
        phone: item.phone || undefined,
        pan: item.pan || undefined,
      });
      setReviewContacts(Array.isArray(res.data?.duplicates) ? res.data.duplicates : []);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to load matching contacts');
      setReviewContacts([]);
    } finally {
      setReviewContactsLoading(false);
    }
  };

  const handleReviewAction = (item: DataQualityIssue) => {
    if (recordType === 'lead' && view === 'duplicates') {
      void openLeadDuplicateReview(item);
      return;
    }
    handleOpenRecord(item.id);
  };

  const resolveDefaultRequestType = async () => {
    try {
      const res = await crmApi.listRequestTypes({ enabledOnly: true });
      const list = Array.isArray(res.data) ? res.data : [];
      const software =
        list.find((rt) => String(rt.key || '').toLowerCase() === 'project_software') ||
        list.find((rt) => String(rt.name || '').toLowerCase().includes('software')) ||
        list[0] ||
        null;
      return {
        requestTypeId: software?._id || null,
        requestType: software?.name || 'Project (software)',
      };
    } catch {
      return { requestTypeId: null, requestType: 'Project (software)' };
    }
  };

  /** Create another lead for this identity (existing contact or new contact). */
  const createLeadFromReview = async (
    existingContact: PersonContact | null,
    allowDuplicateContact: boolean
  ) => {
    if (!reviewItem || reviewBusy) return;
    const email = String(reviewItem.email || '').trim();
    const phone = String(reviewItem.phone || '').trim();
    const name = String(reviewItem.name || '').trim();
    const company = String(reviewItem.company || name || '').trim();
    if (!name) {
      setReviewError('Record is missing a name.');
      return;
    }
    if (!email || !phone) {
      setReviewError('Email and mobile are required to create a lead.');
      return;
    }

    setReviewBusy(true);
    setReviewError(null);
    try {
      let contact = existingContact;
      if (!contact?._id) {
        const created = await crmApi.createContact({
          name,
          companyName: (company || name).trim(),
          email,
          phone,
          pan: reviewItem.pan || undefined,
          allowDuplicate: allowDuplicateContact || undefined,
        });
        contact = created.data || null;
        if (!contact?._id) throw new Error(created.error || 'Failed to create contact');
      }

      const rt = await resolveDefaultRequestType();
      const leadRes = await crmApi.createLead({
        title: company ? `Inquiry from ${company}` : `Inquiry from ${name}`,
        contactId: contact._id,
        name: contact.name || name,
        email: contact.email || email,
        phone: contact.phone || phone,
        pan: contact.pan || reviewItem.pan || undefined,
        company,
        stage: 'New',
        status: 'New',
        source: 'Other',
        requestType: rt.requestType,
        requestTypeId: rt.requestTypeId,
        value: 0,
        currency: settingsCurrency,
        tags: ['Inbound'],
        notes: `Created from Data Quality duplicate review (source record ${reviewItem.id}).`,
        allowExactDuplicate: true,
        allowSimilarCompany: true,
      });
      if (!leadRes.data?._id) throw new Error(leadRes.error || 'Failed to create lead');
      showToast('Lead created from Data Quality review');
      closeReviewModal(true);
      navigate(`/leads/${leadRes.data._id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409 && Array.isArray(err.duplicates)) {
        setReviewContacts(err.duplicates as PersonContact[]);
        setReviewError(
          'Matching contact found. Choose existing contact or Create new lead.'
        );
      } else {
        setReviewError(err instanceof Error ? err.message : 'Failed to create lead');
      }
    } finally {
      setReviewBusy(false);
    }
  };

  // Open rules modal and initialize form state
  const handleOpenRulesModal = () => {
    if (rules) {
      setModalLeadWeights(rules.leadWeights || DEFAULT_LEAD_WEIGHTS);
      setModalClientWeights(rules.clientWeights || DEFAULT_CLIENT_WEIGHTS);
      setModalThresholds(rules.thresholds || DEFAULT_THRESHOLDS);
    }
    setRulesModalOpen(true);
  };

  // Save scoring rules
  const handleSaveRules = async () => {
    const { excellent, good, needsAttention } = modalThresholds;
    if (!(excellent > good && good > needsAttention && needsAttention >= 0)) {
      showToast('Thresholds must descend: Excellent > Good > Needs Attention >= 0', 'error');
      return;
    }

    setSavingRules(true);
    try {
      const updatedRules: DataQualityRules = {
        leadWeights: modalLeadWeights,
        clientWeights: modalClientWeights,
        thresholds: modalThresholds,
      };
      const res = await crmApi.updateDataQualityRules(updatedRules);
      setRules(res.data);
      showToast('Data-quality rules and weights updated');
      setRulesModalOpen(false);
      void loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save rules', 'error');
    } finally {
      setSavingRules(false);
    }
  };

  // Trigger export
  const handleExport = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    setExporting(true);
    try {
      const result = await crmApi.downloadDataQualityExport({
        view,
        recordType,
        matchType: view === 'duplicates' ? matchType : undefined,
        maxScore: view === 'low-quality' ? maxScore : undefined,
        search: debouncedSearch,
        format,
      });
      showToast(`Data quality review exported: ${result.filename}`);
      setExportResult({
        title: `Data Quality Export Ready (${format.toUpperCase()})`,
        filename: result.filename,
        format: result.format,
        content: result.content,
        directUrl: result.directUrl,
        recordCount: result.recordCount,
      });
      setExportModalOpen(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div data-tour="data-quality-tour-landing" className="flex w-full flex-col gap-5 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg border ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div data-tour="data-quality-title">
          <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Record hygiene
          </p>
          <h1 className="m-0 text-2xl font-bold tracking-tight text-zinc-950">
            Data Quality &amp; Duplicate Center
          </h1>
          <p className="m-0 mt-1 text-sm text-zinc-500">
            Review possible duplicates and low-quality records. Nothing is merged or deleted automatically.
          </p>
        </div>

        <div data-tour="data-quality-actions" className="flex flex-wrap items-center gap-2">
          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef} data-tour="data-quality-export-btn">
            <button
              type="button"
              disabled={exporting}
              onClick={() => setExportOpen((prev) => !prev)}
              className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />
              <span>{exporting ? 'Exporting…' : 'Export'}</span>
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-xl border border-zinc-300 bg-white p-1.5 shadow-lg z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  data-tour="data-quality-export-csv"
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg cursor-pointer flex items-center justify-between transition-colors border-none bg-transparent"
                >
                  <span>Export as CSV</span>
                  <span className="text-[10px] uppercase font-mono text-zinc-400">.csv</span>
                </button>
                <button
                  type="button"
                  data-tour="data-quality-export-json"
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg cursor-pointer flex items-center justify-between transition-colors border-none bg-transparent"
                >
                  <span>Export as JSON</span>
                  <span className="text-[10px] uppercase font-mono text-zinc-400">.json</span>
                </button>
              </div>
            )}
          </div>

          {/* Display Scoring Rules Button */}
          <button
            type="button"
            data-tour="data-quality-display-scoring-btn"
            onClick={handleOpenRulesModal}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <SettingsOutlinedIcon sx={{ fontSize: 16 }} />
            <span>Display Scoring</span>
          </button>

          {/* Refresh Scan Button */}
          <button
            type="button"
            data-tour="data-quality-refresh-btn"
            onClick={() => void loadData()}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshIcon sx={{ fontSize: 16 }} />
            <span>Refresh scan</span>
          </button>

          <TourButton
            moduleId="data-quality"
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
          />
        </div>
      </div>

      {/* Warning Notification Banner */}
      {warningMessage && (
        <div
          data-tour="data-quality-warning-banner"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <section data-tour="data-quality-kpi-cards" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article data-tour="data-quality-kpi-duplicate-leads" className="rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Duplicate leads
          </span>
          <strong className="block text-2xl font-bold text-zinc-950 mt-1">
            {summary.leads.duplicates || 0}
          </strong>
        </article>

        <article data-tour="data-quality-kpi-duplicate-customers" className="rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Duplicate customers
          </span>
          <strong className="block text-2xl font-bold text-zinc-950 mt-1">
            {summary.clients.duplicates || 0}
          </strong>
        </article>

        <article data-tour="data-quality-kpi-low-quality" className="rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Low-quality records
          </span>
          <strong className="block text-2xl font-bold text-zinc-950 mt-1">
            {(summary.leads.lowQuality || 0) + (summary.clients.lowQuality || 0)}
          </strong>
        </article>

        <article data-tour="data-quality-kpi-averages" className="rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Lead / customer average
          </span>
          <strong className="block text-2xl font-bold text-zinc-950 mt-1">
            {summary.leads.averageScore || 0}% / {summary.clients.averageScore || 0}%
          </strong>
        </article>
      </section>

      {/* Toolbar: Tabs & Filtering Options */}
      <section data-tour="data-quality-toolbar" className="rounded-xl border border-zinc-300 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tabs: Possible duplicates vs Low quality */}
          <div
            data-tour="data-quality-view-tabs"
            className="flex items-center gap-1 rounded-lg border border-zinc-200 p-1 bg-zinc-50"
          >
            <button
              type="button"
              role="tab"
              data-tour="data-quality-tab-duplicates"
              aria-selected={view === 'duplicates'}
              onClick={() => {
                setView('duplicates');
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer border-none ${
                view === 'duplicates'
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'bg-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Possible duplicates
            </button>
            <button
              type="button"
              role="tab"
              data-tour="data-quality-tab-low-quality"
              aria-selected={view === 'low-quality'}
              onClick={() => {
                setView('low-quality');
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer border-none ${
                view === 'low-quality'
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'bg-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Low quality
            </button>
          </div>

          {/* Filters */}
          <div data-tour="data-quality-filters" className="flex flex-wrap items-center gap-3">
            {/* Record type */}
            <label
              data-tour="data-quality-record-type"
              className="flex items-center gap-2 text-xs font-semibold text-zinc-600"
            >
              <span>Record type</span>
              <select
                value={recordType}
                onChange={(e) => {
                  setRecordType(e.target.value as 'lead' | 'client');
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 outline-none focus:border-zinc-500 cursor-pointer"
              >
                <option value="lead">Leads</option>
                <option value="client">Customers</option>
              </select>
            </label>

            {/* Match type (shown on duplicates tab) */}
            {view === 'duplicates' && (
              <label
                data-tour="data-quality-match-type"
                className="flex items-center gap-2 text-xs font-semibold text-zinc-600"
              >
                <span>Match type</span>
                <select
                  value={matchType}
                  onChange={(e) => {
                    setMatchType(e.target.value as 'all' | 'exact' | 'similar');
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 outline-none focus:border-zinc-500 cursor-pointer"
                >
                  <option value="all">All matches</option>
                  <option value="exact">Exact details</option>
                  <option value="similar">Similar company</option>
                </select>
              </label>
            )}

            {/* Maximum score (shown on low-quality tab) */}
            {view === 'low-quality' && (
              <label
                data-tour="data-quality-max-score"
                className="flex items-center gap-2 text-xs font-semibold text-zinc-600"
              >
                <span>Maximum score</span>
                <select
                  value={maxScore}
                  onChange={(e) => {
                    setMaxScore(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 outline-none focus:border-zinc-500 cursor-pointer"
                >
                  <option value={49}>Below 50</option>
                  <option value={69}>69 or below</option>
                  <option value={79}>79 or below</option>
                </select>
              </label>
            )}

            {/* Search */}
            <div data-tour="data-quality-search" className="relative min-w-[220px]">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, company, email, mobile…"
                maxLength={120}
                className="h-9 w-full rounded-lg border border-zinc-300 bg-white pl-8 pr-3 text-xs text-zinc-800 outline-none focus:border-zinc-500"
              />
              <SearchIcon
                sx={{ fontSize: 16 }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Review Queue Table */}
      <div data-tour="data-quality-table">
      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500 animate-pulse">
          Scanning tenant records…
        </div>
      ) : issues.length === 0 ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-zinc-900 m-0 mb-1">
            {view === 'duplicates' ? 'No possible duplicates found' : 'No low-quality records found'}
          </p>
          <p className="text-xs text-zinc-500 m-0">Change the filters or refresh the scan.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Record
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Contact Info
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Quality Score
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Possible Matches
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Signals
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {issues.map((item, index) => {
                  const initial = (item.name || 'R').charAt(0).toUpperCase();
                  const matchReasons = Array.from(
                    new Set((item.matches || []).flatMap((match) => match.reasons || []))
                  );
                  const missingLabels = item.dataQuality?.missing || [];

                  return (
                    <tr
                      key={item.id}
                      data-tour={index === 0 ? 'data-quality-row-first' : undefined}
                      className="border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors"
                    >
                      {/* Record column */}
                      <td className="px-4 py-3">
                        <div
                          onClick={() => handleOpenRecord(item.id)}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-950 group-hover:underline">
                              {item.name || 'Unnamed'}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {recordType === 'lead'
                                ? item.company || '—'
                                : item.website || item.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info column */}
                      <td className="px-4 py-3 text-xs text-zinc-700">
                        <div>{item.email || '—'}</div>
                        {item.phone && (
                          <div className="text-[11px] text-zinc-400 mt-0.5">{item.phone}</div>
                        )}
                      </td>

                      {/* Quality Score column */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            item.dataQuality.score >= 85
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.dataQuality.score >= 70
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : item.dataQuality.score >= 50
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {item.dataQuality.score}% · {item.dataQuality.label}
                        </span>
                      </td>

                      {/* Possible Matches column */}
                      <td className="px-4 py-3">
                        {item.matches && item.matches.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.matches.slice(0, 3).map((match, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200"
                              >
                                {match.name || match.company || match.email || match.id}
                              </span>
                            ))}
                            {item.matches.length > 3 && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-200/80 text-zinc-600">
                                +{item.matches.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Signals column */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {view === 'duplicates' ? (
                            matchReasons.length > 0 ? (
                              matchReasons.map((reason) => (
                                <span
                                  key={reason}
                                  className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200"
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                                    {REASON_LABELS[reason] || reason}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )
                          ) : missingLabels.length > 0 ? (
                            missingLabels.map((label, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                                  {label}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-400">No issues</span>
                          )}
                        </div>
                      </td>

                      {/* Actions column */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleReviewAction(item)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white cursor-pointer transition-colors border-none"
                        >
                          {view === 'duplicates' ? 'Review' : 'Improve'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.total > 0 && (
            <div
              data-tour="data-quality-pagination"
              className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50"
            >
              <span className="text-xs text-zinc-500">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                  className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white flex items-center justify-center cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon sx={{ fontSize: 18 }} />
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                  className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white flex items-center justify-center cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRightIcon sx={{ fontSize: 18 }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Lead duplicate review — Choose existing contact / Create new lead */}
      {reviewItem && (
        <div
          className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReviewModal();
          }}
        >
          <div className="bg-white border border-zinc-300 rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-none">
            <div className="p-4 sm:p-5 border-b border-zinc-200 flex items-start justify-between gap-3 bg-zinc-50">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-zinc-950 m-0">Review duplicate lead</h3>
                <p className="m-0 mt-1 text-xs text-zinc-500">
                  Same email, mobile, or PAN — choose an option to create another lead, or open the
                  existing record.
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeReviewModal()}
                disabled={reviewBusy}
                className="p-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer transition-colors bg-white disabled:opacity-50 shrink-0"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-sm font-semibold text-zinc-950 truncate">
                  {reviewItem.name || 'Unnamed'}
                </div>
                {reviewItem.company ? (
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">{reviewItem.company}</div>
                ) : null}
                <div className="mt-2 flex flex-col gap-0.5 text-xs text-zinc-700">
                  {reviewItem.email ? <span>Email: {reviewItem.email}</span> : null}
                  {reviewItem.phone ? <span>Mobile: {reviewItem.phone}</span> : null}
                  {reviewItem.pan ? <span>PAN: {reviewItem.pan}</span> : null}
                </div>
                {reviewItem.matches?.length ? (
                  <div className="mt-3 pt-3 border-t border-zinc-200">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-1.5">
                      Possible matches
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {reviewItem.matches.slice(0, 5).map((match) => (
                        <span
                          key={match.id}
                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-white text-zinc-700 border border-zinc-200"
                        >
                          {match.name || match.company || match.email || match.id}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {reviewError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {reviewError}
                </div>
              ) : null}

              {reviewContactsLoading ? (
                <div className="text-xs text-zinc-500 py-2">Checking matching contacts…</div>
              ) : (
                <ContactDuplicateBanner
                  duplicates={reviewContacts}
                  checking={false}
                  busy={reviewBusy}
                  onUseContact={(contact) => void createLeadFromReview(contact, false)}
                  onCreateNewLead={() => void createLeadFromReview(null, true)}
                  actionLabel="Choose existing contact"
                  createNewLabel="Create new lead"
                  option1Title="Option 1 — Choose existing contact"
                  option2Title="Option 2 — Create new lead"
                  title={
                    reviewContacts.length
                      ? 'Matching contact found'
                      : 'No PersonContact match — you can still create a new lead'
                  }
                  description={
                    reviewContacts.length ? (
                      <>
                        Same <strong>email</strong>, <strong>mobile</strong> or <strong>PAN</strong>{' '}
                        already exists. Choose existing contact or Create new lead — both create a
                        lead.
                      </>
                    ) : (
                      <>
                        No exact contact match loaded. Use Create new lead to add a contact and lead
                        for this identity.
                      </>
                    )
                  }
                />
              )}

              {!reviewContactsLoading && reviewContacts.length === 0 ? (
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => void createLeadFromReview(null, true)}
                  className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white border-none cursor-pointer disabled:opacity-50"
                >
                  {reviewBusy ? 'Creating…' : 'Create new lead'}
                </button>
              ) : null}
            </div>

            <div className="p-4 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2 bg-white">
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => handleOpenRecord(reviewItem.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 cursor-pointer disabled:opacity-50"
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
                Open existing lead
              </button>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => closeReviewModal()}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-600 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configurable Scoring Rules Modal ("Display Scoring") */}
      {rulesModalOpen && (
        <div
          data-tour="data-quality-rules-modal"
          className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRulesModalOpen(false);
          }}
        >
          <div className="bg-white border border-zinc-300 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-none animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2.5">
                <Settings className="h-[18px] w-[18px] shrink-0 text-zinc-600" aria-hidden />
                <h3 className="text-base font-bold text-zinc-950 m-0">
                  Configurable Data-Quality Rules &amp; Score Weights
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                className="p-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer transition-colors bg-white"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
              {/* Lead Quality Field Weights */}
              <div data-tour="data-quality-rules-lead-weights">
                <h4 className="m-0 mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-800">
                  Lead Quality Field Weights (Points)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-zinc-50 p-3.5 rounded-lg border border-zinc-200">
                  {[
                    { key: 'name', label: 'Full Name' },
                    { key: 'email', label: 'Valid Email' },
                    { key: 'phone', label: 'Valid Mobile' },
                    { key: 'company', label: 'Company Name' },
                    { key: 'pan', label: 'PAN Number' },
                    { key: 'address', label: 'Address' },
                    { key: 'owner', label: 'Assigned Owner' },
                    { key: 'duplicates', label: 'No Duplicates' },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center justify-between text-xs text-zinc-700 bg-white p-2 rounded border border-zinc-200"
                    >
                      <span className="font-medium">{label}</span>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={modalLeadWeights[key] ?? 0}
                        onChange={(e) =>
                          setModalLeadWeights({
                            ...modalLeadWeights,
                            [key]: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-16 h-7 px-2 text-xs font-mono text-right rounded border border-zinc-300 outline-none focus:border-zinc-600 bg-white"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Client Quality Field Weights */}
              <div data-tour="data-quality-rules-client-weights">
                <h4 className="m-0 mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-800">
                  Client Quality Field Weights (Points)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-zinc-50 p-3.5 rounded-lg border border-zinc-200">
                  {[
                    { key: 'name', label: 'Company Name' },
                    { key: 'email', label: 'Company Email' },
                    { key: 'phone', label: 'Company Mobile' },
                    { key: 'website', label: 'Website' },
                    { key: 'address', label: 'Billing Address' },
                    { key: 'taxId', label: 'Tax ID (GST/VAT)' },
                    { key: 'contact', label: 'Contact Added' },
                    { key: 'duplicates', label: 'No Duplicates' },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center justify-between text-xs text-zinc-700 bg-white p-2 rounded border border-zinc-200"
                    >
                      <span className="font-medium">{label}</span>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={modalClientWeights[key] ?? 0}
                        onChange={(e) =>
                          setModalClientWeights({
                            ...modalClientWeights,
                            [key]: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-16 h-7 px-2 text-xs font-mono text-right rounded border border-zinc-300 outline-none focus:border-zinc-600 bg-white"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Quality Rating Thresholds */}
              <div data-tour="data-quality-rules-thresholds">
                <h4 className="m-0 mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-800">
                  Quality Rating Thresholds (%)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50 p-3.5 rounded-lg border border-zinc-200">
                  <label className="block text-xs font-semibold text-emerald-700">
                    <span>Excellent &ge;</span>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={modalThresholds.excellent}
                      onChange={(e) =>
                        setModalThresholds({
                          ...modalThresholds,
                          excellent: Number(e.target.value),
                        })
                      }
                      className="w-full h-8 mt-1.5 px-2.5 text-xs font-mono rounded border border-zinc-300 outline-none focus:border-emerald-600 bg-white"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-sky-700">
                    <span>Good &ge;</span>
                    <input
                      type="number"
                      min="30"
                      max="90"
                      value={modalThresholds.good}
                      onChange={(e) =>
                        setModalThresholds({
                          ...modalThresholds,
                          good: Number(e.target.value),
                        })
                      }
                      className="w-full h-8 mt-1.5 px-2.5 text-xs font-mono rounded border border-zinc-300 outline-none focus:border-sky-600 bg-white"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-amber-700">
                    <span>Needs Attention &ge;</span>
                    <input
                      type="number"
                      min="10"
                      max="80"
                      value={modalThresholds.needsAttention}
                      onChange={(e) =>
                        setModalThresholds({
                          ...modalThresholds,
                          needsAttention: Number(e.target.value),
                        })
                      }
                      className="w-full h-8 mt-1.5 px-2.5 text-xs font-mono rounded border border-zinc-300 outline-none focus:border-amber-600 bg-white"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              data-tour="data-quality-rules-footer"
              className="p-3.5 sm:p-4 border-t border-zinc-200 flex justify-end gap-2 bg-zinc-50"
            >              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRules}
                onClick={handleSaveRules}
                className="px-4 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold border border-zinc-950 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {savingRules ? 'Saving…' : 'Save Rules & Weights'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Result Modal */}
      <ExportResultModal
        open={exportModalOpen}
        result={exportResult}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
};
export default DataQualityPage;
