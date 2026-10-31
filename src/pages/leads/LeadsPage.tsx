import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
import { canAssignToOtherUsers, canChangeLeadStage } from '../../utils/permissions';
import {
  LeadItem,
  LeadPaginationMeta,
  AssignableUser,
  SavedLeadFilter,
} from '../../types/leads';
import { isLeadConvertibleStage, resolveWonStage } from '../../utils/leadPipeline';

import { LeadListView } from '../../components/leads/LeadListView';
import { LeadKanbanView } from '../../components/leads/LeadKanbanView';
import { LeadReportView } from '../../components/leads/LeadReportView';
import { LeadActivityView } from '../../components/leads/LeadActivityView';
import {
  PIPELINE_STAGES as DEFAULT_PIPELINE_STAGES,
  LEAD_STATUSES as DEFAULT_LEAD_STATUSES,
  LEAD_SOURCES as DEFAULT_LEAD_SOURCES,
  mergeLeadStatusesWithBuiltins,
} from '../../services/mockLeadData';
import { LeadDetailModal } from '../../components/leads/LeadDetailModal';
import { SaveLeadFilterModal } from '../../components/leads/SaveLeadFilterModal';
import { ManageSavedFiltersModal } from '../../components/leads/ManageSavedFiltersModal';
import { ExportResultModal, ExportResult } from '../../components/leads/ExportResultModal';
import { CsvImportModal } from '../../components/common/CsvImportModal';
import { VisitingCardLeadCaptureModal } from '../../components/leads/VisitingCardLeadCaptureModal';
import { TourButton } from '../../ui/tour';
import { restartLeadsTour } from '../../tours/LeadsTour';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  CalendarCheck2,
  ClipboardList,
  FileJson,
  FileText,
  FolderOpen,
  LayoutGrid,
  Lock,
  Save,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react';

type ViewMode = 'list' | 'kanban' | 'activity' | 'report';

const ROLE_SUBTITLES: Record<string, string> = {
  'crm-manager': 'Executive sales pipeline intelligence, lead conversion velocity, and team performance.',
  'sales-manager': 'Team lead progression, stage velocity, quotation status, and rep quota distribution.',
  'sales-representative': 'My active deal pipeline, inbound prospects, and follow-up schedules.',
  'project-manager': 'Converted client handoffs, incoming project scopes, and deliverable leads.',
  'crm-employee': 'Company leads, prospect contacts, and stage activity stream.',
  'finance-manager': 'Prospect deal values, quotation pipeline, and billing conversion readiness.',
  client: 'Access restricted: Leads are an internal sales module not visible to client accounts.',
};

export const LeadsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeRole, isClient, isAdmin, hasPermission, user } = useAuth();
  const { confirm } = useDialog();
  const canWrite = hasPermission('crm.leads.write') && !isClient;
  const canDelete = hasPermission('crm.leads.delete') && !isClient;
  const canConvert = hasPermission('crm.leads.convert') && !isClient;
  const canAssignOthers = canAssignToOtherUsers(user, { isClient, activeRole });
  /** Moving a lead's stage by hand is a manager action. */
  const canChangeStage = canWrite && canChangeLeadStage({ isAdmin, isClient, activeRole });

  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    try {
      const saved = sessionStorage.getItem('crm-leads-view');
      if (saved === 'kanban' || saved === 'report' || saved === 'list' || saved === 'activity') return saved;
    } catch {}
    return 'list';
  });

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedLeadFilter[]>([]);

  // Filters State — hydrate from URL (report drill-downs)
  const [filterStage, setFilterStage] = useState(() => searchParams.get('stage') || '');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || '');
  const [filterSource, setFilterSource] = useState(() => searchParams.get('source') || '');
  const [filterMatchScore, setFilterMatchScore] = useState(
    () => searchParams.get('matchScore') || ''
  );
  const [filterNeedsSample, setFilterNeedsSample] = useState(
    () => searchParams.get('needsSampleRequest') || ''
  );
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => {
    const nextStage = searchParams.get('stage') || '';
    const nextStatus = searchParams.get('status') || '';
    const nextSource = searchParams.get('source') || '';
    const nextMatch = searchParams.get('matchScore') || '';
    const nextNeedsSample = searchParams.get('needsSampleRequest') || '';
    const nextQ = searchParams.get('q') || '';
    setFilterStage((prev) => (prev === nextStage ? prev : nextStage));
    setFilterStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setFilterSource((prev) => (prev === nextSource ? prev : nextSource));
    setFilterMatchScore((prev) => (prev === nextMatch ? prev : nextMatch));
    setFilterNeedsSample((prev) => (prev === nextNeedsSample ? prev : nextNeedsSample));
    setSearchQuery((prev) => (prev === nextQ ? prev : nextQ));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStage) params.set('stage', filterStage);
    if (filterStatus) params.set('status', filterStatus);
    if (filterSource) params.set('source', filterSource);
    if (filterMatchScore) params.set('matchScore', filterMatchScore);
    if (filterNeedsSample) params.set('needsSampleRequest', filterNeedsSample);
    if (searchQuery) params.set('q', searchQuery);
    setSearchParams(params, { replace: true });
  }, [
    filterStage,
    filterStatus,
    filterSource,
    filterMatchScore,
    filterNeedsSample,
    searchQuery,
    setSearchParams,
  ]);

  // Selection & Sorting State
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [currentSortField, setCurrentSortField] = useState<string | null>('name');
  const [currentSortAsc, setCurrentSortAsc] = useState<boolean>(true);
  const [pagination, setPagination] = useState<LeadPaginationMeta | null>(null);
  const [page, setPage] = useState(1);

  // Loading & State
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modals State
  const [detailModalLead, setDetailModalLead] = useState<LeadItem | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [cardCaptureOpen, setCardCaptureOpen] = useState(false);
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false);
  const [manageFiltersModalOpen, setManageFiltersModalOpen] = useState(false);

  // Check URL params on initial mount
  useEffect(() => {
    if (canWrite && window.location.hash.includes('action=create')) {
      navigate('/leads/create');
    }
  }, [canWrite, navigate]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Load Settings & Metadata — isolate failures so pipeline/source/status/rep selects stay populated
  useEffect(() => {
    const loadMetadata = async () => {
      const asStringList = (value: unknown, fallback: string[]): string[] => {
        if (Array.isArray(value) && value.length) {
          return value.map((item) => String(item || '').trim()).filter(Boolean);
        }
        return [...fallback];
      };

      try {
        const [pipeRes, statRes, srcRes, usrRes, filtRes] = await Promise.allSettled([
          crmApi.getPipeline(),
          crmApi.getLeadStatuses(),
          crmApi.getLeadSources(),
          crmApi.getAssignableUsers(),
          crmApi.getSavedLeadFilters(),
        ]);

        const stages =
          pipeRes.status === 'fulfilled'
            ? asStringList(pipeRes.value.data?.pipeline_stages, DEFAULT_PIPELINE_STAGES)
            : [...DEFAULT_PIPELINE_STAGES];
        const statuses = mergeLeadStatusesWithBuiltins(
          statRes.status === 'fulfilled'
            ? asStringList(statRes.value.data, DEFAULT_LEAD_STATUSES)
            : [...DEFAULT_LEAD_STATUSES]
        );
        const sources =
          srcRes.status === 'fulfilled'
            ? asStringList(srcRes.value.data, DEFAULT_LEAD_SOURCES)
            : [...DEFAULT_LEAD_SOURCES];
        const users =
          usrRes.status === 'fulfilled' && Array.isArray(usrRes.value.data)
            ? usrRes.value.data.map((u) => ({
                ...u,
                id: String(u.id || u._id || u.userId || '').trim(),
                displayName: u.displayName || u.name || u.username || u.email || 'User',
                name: u.name || u.displayName || u.username || u.email || 'User',
              })).filter((u) => u.id)
            : [];
        const filters = filtRes.status === 'fulfilled' && Array.isArray(filtRes.value.data) ? filtRes.value.data : [];

        setPipelineStages(stages);
        setLeadStatuses(statuses);
        setLeadSources(sources);
        setAssignableUsers(users);
        setSavedFilters(filters);

        // Apply default preset if configured
        const defaultFilter = filters.find((f: SavedLeadFilter) => f.isDefault);
        if (defaultFilter && defaultFilter.filters) {
          setSelectedPreset(defaultFilter.id);
          setFilterStage(defaultFilter.filters.stage || '');
          setFilterStatus(defaultFilter.filters.status || '');
          setFilterSource(defaultFilter.filters.source || '');
          setFilterMatchScore(defaultFilter.filters.matchScore || '');
          setFilterNeedsSample(defaultFilter.filters.needsSampleRequest || '');
          setSearchQuery(defaultFilter.filters.search || '');
        }
      } catch (err) {
        console.warn('Metadata load error:', err);
      }
    };
    loadMetadata();
  }, []);

  // Load Leads
  const loadLeads = useCallback(async () => {
    if (currentView === 'activity') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await crmApi.getLeads({
        page: currentView === 'list' ? page : 1,
        limit: currentView === 'list' ? 10 : 500,
        view: currentView,
        stage: currentView === 'kanban' ? undefined : (filterStage || undefined),
        status: filterStatus || undefined,
        source: filterSource || undefined,
        matchScore: filterMatchScore || undefined,
        needsSampleRequest: filterNeedsSample || undefined,
        search: searchQuery.trim() || undefined,
        sort: currentSortField ? `${currentSortField}:${currentSortAsc ? 'asc' : 'desc'}` : undefined,
      });

      let items = res.data || [];

      // Local sorting if needed
      if (currentSortField) {
        items = [...items].sort((a, b) => {
          let valA = '';
          let valB = '';
          if (currentSortField === 'name') {
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
          } else if (currentSortField === 'company') {
            valA = (a.company || '').toLowerCase();
            valB = (b.company || '').toLowerCase();
          } else if (currentSortField === 'email') {
            valA = (a.email || '').toLowerCase();
            valB = (b.email || '').toLowerCase();
          } else if (currentSortField === 'stage') {
            valA = (a.stage || '').toLowerCase();
            valB = (b.stage || '').toLowerCase();
          } else if (currentSortField === 'match') {
            const scoreA = a.commercialRequirement?.score;
            const scoreB = b.commercialRequirement?.score;
            const numA = scoreA == null || Number.isNaN(Number(scoreA)) ? -1 : Number(scoreA);
            const numB = scoreB == null || Number.isNaN(Number(scoreB)) ? -1 : Number(scoreB);
            if (numA < numB) return currentSortAsc ? -1 : 1;
            if (numA > numB) return currentSortAsc ? 1 : -1;
            return 0;
          } else if (currentSortField === 'rep') {
            valA = (a.assignedToName || '').toLowerCase();
            valB = (b.assignedToName || '').toLowerCase();
          }
          if (valA < valB) return currentSortAsc ? -1 : 1;
          if (valA > valB) return currentSortAsc ? 1 : -1;
          return 0;
        });
      }

      setLeads(items);
      setPagination(res.pagination || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load leads';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    currentView,
    filterStage,
    filterStatus,
    filterSource,
    filterMatchScore,
    filterNeedsSample,
    searchQuery,
    currentSortField,
    currentSortAsc,
  ]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleSwitchView = (v: ViewMode) => {
    setCurrentView(v);
    try {
      sessionStorage.setItem('crm-leads-view', v);
    } catch {}
    setPage(1);
  };

  // Tour can switch List / Kanban / Report without changing CRM APIs
  useEffect(() => {
    const onTourView = (e: Event) => {
      const view = (e as CustomEvent<{ view?: ViewMode }>).detail?.view;
      if (view === 'list' || view === 'kanban' || view === 'report' || view === 'activity') {
        handleSwitchView(view);
      }
    };
    window.addEventListener('crm-leads-tour-view', onTourView as EventListener);
    return () => window.removeEventListener('crm-leads-tour-view', onTourView as EventListener);
  }, []);

  const handleSort = (field: string) => {
    if (currentSortField === field) {
      setCurrentSortAsc(!currentSortAsc);
    } else {
      setCurrentSortField(field);
      setCurrentSortAsc(true);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (leads.length > 0 && leads.every((l) => selectedLeadIds.has(l._id))) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map((l) => l._id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedLeadIds(new Set());
  };

  const handleResetFilters = () => {
    setFilterStage('');
    setFilterStatus('');
    setFilterSource('');
    setFilterMatchScore('');
    setFilterNeedsSample('');
    setSearchQuery('');
    setSelectedPreset('');
    setPage(1);
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const filter = savedFilters.find((f) => f.id === presetId);
    if (!filter) {
      handleResetFilters();
      return;
    }
    setFilterStage(filter.filters.stage || '');
    setFilterStatus(filter.filters.status || '');
    setFilterSource(filter.filters.source || '');
    setFilterMatchScore(filter.filters.matchScore || '');
    setFilterNeedsSample(filter.filters.needsSampleRequest || '');
    setSearchQuery(filter.filters.search || '');
    setPage(1);
  };

  // Bulk operations
  const handleBulkAssign = async (assignedTo: string) => {
    if (!canWrite) return;
    try {
      await crmApi.bulkAssignLeads(Array.from(selectedLeadIds), assignedTo);
      showToast(`Assigned ${selectedLeadIds.size} leads successfully`, 'success');
      setSelectedLeadIds(new Set());
      loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk assign failed';
      showToast(msg, 'error');
    }
  };

  const handleBulkChangeStage = async (stage: string) => {
    if (!canWrite) return;
    try {
      await crmApi.bulkChangeLeadStage(Array.from(selectedLeadIds), stage);
      showToast(`Moved ${selectedLeadIds.size} leads to ${stage}`, 'success');
      setSelectedLeadIds(new Set());
      loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk stage update failed';
      showToast(msg, 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (!canDelete) return;
    if (!(await confirm({ message: `Delete ${selectedLeadIds.size} selected leads? They will be removed from lists (soft delete) and history is retained.`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      for (const id of selectedLeadIds) {
        await crmApi.deleteLead(id);
      }
      showToast(`Deleted ${selectedLeadIds.size} leads`, 'success');
      setSelectedLeadIds(new Set());
      loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk delete failed';
      showToast(msg, 'error');
    }
  };

  // Single lead operations
  const handleMoveStage = async (leadId: string, newStage: string) => {
    if (!canWrite) return;
    if (!canChangeStage) {
      showToast('Only a CRM manager or sales manager can change the lead stage', 'error');
      return;
    }
    // Optimistic local update for instant responsive UI
    setLeads((prev) =>
      prev.map((l) => (l._id === leadId ? { ...l, stage: newStage } : l))
    );
    try {
      await crmApi.changeLeadStage(leadId, newStage);
      showToast(`Moved to ${newStage}`, 'success');
      loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update stage';
      showToast(msg, 'error');
      loadLeads();
    }
  };

  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    if (!canWrite) return;
    // Optimistic local update
    setLeads((prev) =>
      prev.map((l) => (l._id === leadId ? { ...l, status: newStatus } : l))
    );
    try {
      await crmApi.updateLead(leadId, { status: newStatus });
      showToast(`Status updated to "${newStatus}"`, 'success');
      loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      showToast(msg, 'error');
      loadLeads();
    }
  };

  const handleConvertLead = async (lead: LeadItem) => {
    if (!canConvert) return;
    if (!isLeadConvertibleStage(lead.stage, pipelineStages)) {
      const won = resolveWonStage(pipelineStages);
      showToast(`Move the lead to "${won}" stage before converting to a client.`, 'error');
      return;
    }
    try {
      const res = await crmApi.convertLead(lead._id);
      showToast(`Lead "${lead.name}" converted to client successfully!`, 'success');
      if (detailModalLead?._id === lead._id) {
        setDetailModalLead(res.data.lead);
      }
      loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conversion failed';
      showToast(msg, 'error');
    }
  };

  const handleDeleteLead = async (lead: LeadItem) => {
    if (!canDelete) return;
    try {
      await crmApi.deleteLead(lead._id);
      showToast(`Lead "${lead.title?.trim() || lead.name}" removed (soft deleted)`, 'success');
      if (detailModalLead?._id === lead._id) {
        setDetailModalLead(null);
      }
      loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete lead';
      showToast(msg, 'error');
    }
  };

  // Export handlers
  const handleExport = async (format: 'csv' | 'json') => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const exportParams = {
        stage: filterStage || undefined,
        status: filterStatus || undefined,
        source: filterSource || undefined,
        matchScore: filterMatchScore || undefined,
        needsSampleRequest: filterNeedsSample || undefined,
        search: searchQuery.trim() || undefined,
        format,
      };

      const result = await crmApi.downloadLeadsExport(exportParams);
      const filename = result?.filename || `leads_export.${format}`;
      showToast(`Leads exported: ${filename}`, 'success');

      setExportResult({
        title: `Export Leads (${format.toUpperCase()})`,
        filename: result.filename,
        format: result.format || format,
        content: result.content || '',
        directUrl: result.directUrl || '',
        recordCount: result.recordCount,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      showToast(msg, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Client Access Guard
  if (isClient) {
    return (
      <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center max-w-lg mx-auto my-12">
        <Lock className="h-10 w-10 shrink-0 mx-auto mb-2 text-zinc-400" aria-hidden />
        <h2 className="text-xl font-bold text-zinc-950 mb-1">Access Restricted</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          The Leads & Pipeline module is restricted to internal sales and account management teams.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5 pb-12">
      {/* Toast Alert Feedback */}
      {toastMessage && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            toastMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-zinc-950 text-white border-zinc-950'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-inherit hover:opacity-75 p-0 bg-transparent border-none cursor-pointer"
          >
            <CloseIcon sx={{ fontSize: 16 }} aria-label="Dismiss" />
          </button>
        </div>
      )}

      {/* 1. Header (OpenNext CMS Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Target className="h-6 w-6 shrink-0 text-zinc-700" aria-hidden />
            <h1 className="text-2xl font-bold text-zinc-950 tracking-tight m-0">Leads</h1>

            <span
              className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-800 rounded-lg border border-zinc-200"
              title="CRM role from your CMS session"
            >
              Role: {activeRole}
            </span>
          </div>
          <p className="text-xs text-zinc-500 m-0 mt-1">
            {ROLE_SUBTITLES[activeRole] || 'List, Kanban board, and pipeline reports for your sales leads.'}
          </p>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
          <TourButton
            moduleId="leads"
            onRestart={restartLeadsTour}
            title="Restart Leads onboarding tour"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer"
          >
            <HelpOutlineIcon sx={{ fontSize: 15 }} />
            <span>Tour</span>
          </TourButton>
          {/* Total Count Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs">
            <strong className="font-mono font-bold text-zinc-950">
              {pagination?.total ?? leads.length}
            </strong>
            <span className="text-zinc-500">leads</span>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              disabled={exporting}
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
            >
              <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />
              <span>{exporting ? 'Exporting…' : 'Export'}</span>
              <span className="text-[10px] text-zinc-400">▼</span>
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-300 rounded-lg py-1 z-30 min-w-[140px] flex flex-col shadow-none">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-xs text-zinc-700 bg-transparent border-none cursor-pointer flex items-center gap-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-xs text-zinc-700 bg-transparent border-none cursor-pointer flex items-center gap-2"
                >
                  <FileJson className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden /> Export JSON
                </button>
              </div>
            )}
          </div>

          {/* Import Leads Button */}
          {canWrite && (
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
              title="Import Leads from CSV"
            >
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
              <span>Import</span>
            </button>
          )}

          {/* Scan visiting card → auto-create lead */}
          {canWrite && (
            <button
              type="button"
              onClick={() => setCardCaptureOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 cursor-pointer transition-colors"
              title="Photograph a visiting card and create a lead with AI"
            >
              <PhotoCameraOutlinedIcon sx={{ fontSize: 16 }} />
              <span>Scan card</span>
            </button>
          )}

          {/* Create Lead Button */}
          {canWrite && (
            <button
              type="button"
              data-tour="leads-create-btn"
              onClick={() => navigate('/leads/create')}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold border border-zinc-950 cursor-pointer transition-colors"
            >
              <AddIcon sx={{ fontSize: 16 }} />
              <span>Create lead</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. View Switcher Tabs (Black Pill Theme) */}
      <div data-tour="leads-view-tabs" className="flex gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200 w-fit">
        <button
          type="button"
          data-tour="leads-tab-list"
          onClick={() => handleSwitchView('list')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            currentView === 'list'
              ? 'bg-zinc-950 text-white border-zinc-950'
              : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-950'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden /> List View
          </span>
        </button>

        <button
          type="button"
          data-tour="leads-tab-kanban"
          onClick={() => handleSwitchView('kanban')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            currentView === 'kanban'
              ? 'bg-zinc-950 text-white border-zinc-950'
              : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-950'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden /> Kanban Board
          </span>
        </button>

        <button
          type="button"
          data-tour="leads-tab-activity"
          onClick={() => handleSwitchView('activity')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            currentView === 'activity'
              ? 'bg-zinc-950 text-white border-zinc-950'
              : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-950'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <CalendarCheck2 className="h-4 w-4 shrink-0" aria-hidden /> Activity
          </span>
        </button>

        <button
          type="button"
          data-tour="leads-tab-report"
          onClick={() => handleSwitchView('report')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            currentView === 'report'
              ? 'bg-zinc-950 text-white border-zinc-950'
              : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-950'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 shrink-0" aria-hidden /> Funnel & BI Report
          </span>
        </button>
      </div>

      {/* 3. Filter Toolbar */}
      {currentView !== 'activity' && (
      <div data-tour="leads-filters" className="bg-white border border-zinc-300 rounded-xl p-3.5 flex flex-wrap items-end gap-3">
        {/* Preset filter */}
        <div id="lead-saved-filter-wrap" className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <span className="inline-flex items-center gap-1">
              <FolderOpen className="h-3 w-3 shrink-0" aria-hidden /> Preset
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <select
              id="lead-saved-filter-select"
              value={selectedPreset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 outline-none min-w-[140px] h-9 cursor-pointer"
            >
              <option value="">(None / Custom)</option>
              {savedFilters.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.isDefault ? '[Default] ' : f.isShared ? '[Shared] ' : ''}{f.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              id="btn-save-current-filter"
              title="Save current filter preset"
              onClick={() => setSaveFilterModalOpen(true)}
              className="h-9 px-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <Save className="h-4 w-4 shrink-0" aria-hidden />
              <span>Save</span>
            </button>
            <button
              type="button"
              id="btn-manage-saved-filters"
              title="Manage presets"
              onClick={() => setManageFiltersModalOpen(true)}
              className="h-9 px-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 cursor-pointer transition-colors flex items-center justify-center"
            >
              <SettingsOutlinedIcon sx={{ fontSize: 16 }} aria-label="Manage presets" />
            </button>
          </div>
        </div>

        {/* Stage filter (List view only) */}
        {currentView === 'list' && (
          <div id="lead-filter-stage-wrap" className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Stage
            </span>
            <select
              id="lead-filter-stage"
              value={filterStage}
              onChange={(e) => {
                setFilterStage(e.target.value);
                setSelectedPreset('');
                setPage(1);
              }}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 outline-none min-w-[120px] h-9 cursor-pointer"
            >
              <option value="">All stages</option>
              {pipelineStages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status filter */}
        {currentView !== 'report' && (
          <div id="lead-filter-status-wrap" className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Status
            </span>
            <select
              id="lead-filter-status"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setSelectedPreset('');
                setPage(1);
              }}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 outline-none min-w-[120px] h-9 cursor-pointer"
            >
              <option value="">All statuses</option>
              {leadStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Source filter */}
        {currentView !== 'report' && (
          <div id="lead-filter-source-wrap" className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Source
            </span>
            <select
              id="lead-filter-source"
              value={filterSource}
              onChange={(e) => {
                setFilterSource(e.target.value);
                setSelectedPreset('');
                setPage(1);
              }}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 outline-none min-w-[120px] h-9 cursor-pointer"
            >
              <option value="">All sources</option>
              {leadSources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Match % filter */}
        {currentView !== 'report' && (
          <div id="lead-filter-match-wrap" className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Match %
            </span>
            <select
              id="lead-filter-match"
              value={filterMatchScore}
              onChange={(e) => {
                setFilterMatchScore(e.target.value);
                setSelectedPreset('');
                setPage(1);
              }}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 outline-none min-w-[130px] h-9 cursor-pointer"
              title="Filter by qualification match %"
            >
              <option value="">All scores</option>
              <option value="unscored">Not scored</option>
              <option value="strong">Strong (≥80%)</option>
              <option value="partial">Partial (55–79%)</option>
              <option value="weak">Weak (30–54%)</option>
              <option value="poor">Poor (&lt;30%)</option>
            </select>
          </div>
        )}

        {/* Sample need filter (Commercial Requirement checkbox) */}
        {currentView !== 'report' && (
          <div id="lead-filter-sample-wrap" className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Sample
            </span>
            <select
              id="lead-filter-sample"
              value={filterNeedsSample}
              onChange={(e) => {
                setFilterNeedsSample(e.target.value);
                setSelectedPreset('');
                setPage(1);
              }}
              className="text-xs border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 outline-none min-w-[150px] h-9 cursor-pointer"
              title="Filter by Commercial Requirement → Lead needs sample request"
            >
              <option value="">All leads</option>
              <option value="true">Needs sample request</option>
              <option value="false">No sample request</option>
            </select>
          </div>
        )}

        {/* Search input */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Search
          </span>
          <div className="relative flex items-center w-full">
            <input
              type="search"
              id="lead-search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedPreset('');
                setPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSelectedPreset('');
                  setPage(1);
                  loadLeads();
                }
              }}
              placeholder="Name, email, company…"
              className="w-full text-xs border border-zinc-300 rounded-lg pl-3 pr-7 py-1.5 bg-white text-zinc-900 outline-none focus:border-zinc-950 h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedPreset('');
                  setPage(1);
                }}
                className="absolute right-2 text-zinc-400 hover:text-zinc-700 bg-transparent border-none cursor-pointer p-0 text-xs"
                title="Clear search"
              >
                <CloseIcon sx={{ fontSize: 16 }} aria-label="Dismiss" />
              </button>
            )}
          </div>
        </div>

        {/* Reset & Refresh */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            id="btn-reset-lead-filters"
            onClick={handleResetFilters}
            title="Clear all filters"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 h-9 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-colors whitespace-nowrap"
          >
            <CloseIcon sx={{ fontSize: 16 }} aria-label="Dismiss" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            id="lead-refresh"
            onClick={loadLeads}
            disabled={loading}
            title="Refresh leads"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 h-9 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-colors whitespace-nowrap"
          >
            <RefreshIcon sx={{ fontSize: 13 }} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      )}

      {/* 4. Main View Content */}
      {currentView === 'activity' ? (
        <LeadActivityView assignableUsers={assignableUsers} />
      ) : loading && leads.length === 0 ? (
        <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center text-xs text-zinc-500 animate-pulse">
          Loading sales leads…
        </div>
      ) : (
        <>
          {currentView === 'list' && (
            <LeadListView
              leads={leads}
              pipelineStages={pipelineStages}
              assignableUsers={assignableUsers}
              selectedLeadIds={selectedLeadIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onClearSelection={handleClearSelection}
              onBulkAssign={handleBulkAssign}
              onBulkChangeStage={handleBulkChangeStage}
              onBulkDelete={handleBulkDelete}
              onViewLead={(l) => navigate(`/leads/${l._id}`)}
              onDeleteLead={handleDeleteLead}
              onConvertLead={handleConvertLead}
              pagination={pagination}
              onPageChange={(p) => setPage(p)}
              currentSortField={currentSortField}
              currentSortAsc={currentSortAsc}
              onSort={handleSort}
              canWrite={canWrite}
              canChangeStage={canChangeStage}
              canDelete={canDelete}
              canConvert={canConvert}
              canAssignOthers={canAssignOthers}
            />
          )}

          {currentView === 'kanban' && (
            <LeadKanbanView
              leads={leads}
              pipelineStages={pipelineStages}
              leadStatuses={leadStatuses}
              assignableUsers={assignableUsers}
              onViewLead={(l) => navigate(`/leads/${l._id}`)}
              onMoveStage={handleMoveStage}
              onUpdateStatus={handleUpdateStatus}
              onConvertLead={handleConvertLead}
              canWrite={canWrite}
              canChangeStage={canChangeStage}
              canConvert={canConvert}
            />
          )}

          {currentView === 'report' && (
            <LeadReportView
              leads={leads}
              pipelineStages={pipelineStages}
              assignableUsers={assignableUsers}
            />
          )}
        </>
      )}



      {/* Detail Modal */}
      <LeadDetailModal
        open={Boolean(detailModalLead)}
        lead={detailModalLead}
        onClose={() => setDetailModalLead(null)}
        onStageChange={handleMoveStage}
        onStatusChange={handleUpdateStatus}
        onConvert={handleConvertLead}
        onDelete={handleDeleteLead}
        pipelineStages={pipelineStages}
        leadStatuses={leadStatuses}
        assignableUsers={assignableUsers}
        canWrite={canWrite}
        canDelete={canDelete}
        canConvert={canConvert}
      />

      {/* Save Filter Preset Modal */}
      <SaveLeadFilterModal
        open={saveFilterModalOpen}
        onClose={() => setSaveFilterModalOpen(false)}
        activeFilters={{
          stage: filterStage,
          status: filterStatus,
          source: filterSource,
          matchScore: filterMatchScore,
          needsSampleRequest: filterNeedsSample,
          search: searchQuery,
        }}
        onSaved={(newFilter) => {
          setSavedFilters((prev) => [...prev, newFilter]);
          setSelectedPreset(newFilter.id);
          showToast(`Filter preset "${newFilter.name}" saved!`);
        }}
      />

      {/* Manage Saved Presets Modal */}
      <ManageSavedFiltersModal
        open={manageFiltersModalOpen}
        onClose={() => setManageFiltersModalOpen(false)}
        savedFilters={savedFilters}
        onFiltersChanged={(updated) => {
          setSavedFilters(updated);
          if (selectedPreset && !updated.some((f) => f.id === selectedPreset)) {
            setSelectedPreset('');
          }
          showToast('Saved filters updated');
        }}
      />

      {/* Export Result Modal */}
      <ExportResultModal
        open={Boolean(exportResult)}
        result={exportResult}
        onClose={() => setExportResult(null)}
      />

      {/* CSV Bulk Import Modal */}
      {canWrite && importModalOpen && (
        <CsvImportModal
          isOpen={importModalOpen}
          entityType="leads"
          stages={pipelineStages}
          sources={leadSources}
          statuses={leadStatuses}
          onClose={() => setImportModalOpen(false)}
          onSuccess={() => {
            showToast('Leads imported successfully!', 'success');
            loadLeads();
          }}
        />
      )}

      {/* Visiting card camera → OCR → Groq → auto-create lead */}
      {canWrite && (
        <VisitingCardLeadCaptureModal
          open={cardCaptureOpen}
          onClose={() => setCardCaptureOpen(false)}
          onLeadCreated={(lead) => {
            showToast(`Lead created from card: ${lead.title || lead.name || lead.company}`, 'success');
            void loadLeads();
          }}
          onOpenLead={(lead) => {
            setCardCaptureOpen(false);
            navigate(`/leads/${lead._id}`);
          }}
        />
      )}
    </div>
  );
};

