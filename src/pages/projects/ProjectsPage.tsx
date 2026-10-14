import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';

import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
import {
  DEFAULT_PROJECT_STATUSES,
  ProjectItem,
  ProjectPaginationMeta,
  isLiveProjectStatus,
  LIVE_PROJECT_STATUS,
  priorityBadgeClass,
  statusBadgeClass,
} from '../../types/projects';
import { ProjectTemplateModal } from '../../components/projects/ProjectTemplateModal';
import { ProjectKanbanView } from '../../components/projects/ProjectKanbanView';
import { LiveLinkModal } from '../../components/projects/LiveLinkModal';
import { formatCrmMoney } from '../../utils/currency';

const VIEW_KEY = 'crm-projects-view';

function formatMoney(value?: number, currency?: string) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return formatCrmMoney(value, currency, { maximumFractionDigits: 0 });
}

function isOverdue(p: ProjectItem) {
  if (!p.deadline || p.status === 'Completed' || p.status === 'Cancelled' || p.isDropped) {
    return false;
  }
  return p.deadline < new Date().toISOString().slice(0, 10);
}

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isClient } = useAuth();
  const { confirm, prompt } = useDialog();
  const canRead = hasPermission('crm.projects.read');
  const canWrite = hasPermission('crm.projects.write') && !isClient;
  const canDelete = hasPermission('crm.projects.delete') && !isClient;

  const droppedView =
    location.pathname.includes('/projects/dropped') ||
    new URLSearchParams(location.search).get('view') === 'dropped';

  const [items, setItems] = useState<ProjectItem[]>([]);
  const [allForKpis, setAllForKpis] = useState<ProjectItem[]>([]);
  const [pagination, setPagination] = useState<ProjectPaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || '');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTag, setFilterTag] = useState('');

  useEffect(() => {
    const next = searchParams.get('status') || '';
    setFilterStatus((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  useEffect(() => {
    if (droppedView) return;
    const params = new URLSearchParams(searchParams);
    if (filterStatus) params.set('status', filterStatus);
    else params.delete('status');
    setSearchParams(params, { replace: true });
  }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([...DEFAULT_PROJECT_STATUSES]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
    try {
      return sessionStorage.getItem(VIEW_KEY) === 'kanban' ? 'kanban' : 'list';
    } catch {
      return 'list';
    }
  });

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [filterArchived, setFilterArchived] = useState<'false' | 'true' | 'all'>('false');
  const [liveModal, setLiveModal] = useState<{
    project: ProjectItem;
    previousStatus: string;
  } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onTourView = (e: Event) => {
      const view = (e as CustomEvent<{ view?: string }>).detail?.view;
      if (view === 'list' || view === 'kanban') setViewMode(view);
    };
    const onTourExportMenu = (e: Event) => {
      const open = (e as CustomEvent<{ open?: boolean }>).detail?.open;
      setExportMenuOpen(Boolean(open));
    };
    const onTourTemplates = (e: Event) => {
      const open = (e as CustomEvent<{ open?: boolean }>).detail?.open;
      setTemplatesOpen(Boolean(open));
    };
    const onTourArchive = (e: Event) => {
      const filter = (e as CustomEvent<{ filter?: string }>).detail?.filter;
      if (filter === 'false' || filter === 'true' || filter === 'all') {
        setPage(1);
        setFilterArchived(filter);
      }
    };
    window.addEventListener('crm-projects-tour-view', onTourView as EventListener);
    window.addEventListener('crm-projects-tour-export-menu', onTourExportMenu as EventListener);
    window.addEventListener('crm-projects-tour-templates', onTourTemplates as EventListener);
    window.addEventListener('crm-projects-tour-archive', onTourArchive as EventListener);
    return () => {
      window.removeEventListener('crm-projects-tour-view', onTourView as EventListener);
      window.removeEventListener('crm-projects-tour-export-menu', onTourExportMenu as EventListener);
      window.removeEventListener('crm-projects-tour-templates', onTourTemplates as EventListener);
      window.removeEventListener('crm-projects-tour-archive', onTourArchive as EventListener);
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fieldClass =
    'h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white';

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    if (!canRead) return;
    Promise.all([
      crmApi.getProjectCategories(),
      crmApi.getProjectTags(),
      crmApi.getProjectPriorities(),
      crmApi.getProjectStatuses(),
    ])
      .then(([cat, tag, pri, st]) => {
        setCategories(cat.data || []);
        setTags(tag.data || []);
        setPriorities(pri.data || []);
        setStatuses(st.data?.length ? st.data : [...DEFAULT_PROJECT_STATUSES]);
      })
      .catch(() => {});
  }, [canRead]);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const [listRes, kpiRes] = await Promise.all([
        crmApi.listProjects({
          page: viewMode === 'kanban' ? 1 : page,
          limit: viewMode === 'kanban' ? 200 : 20,
          search: debouncedSearch || undefined,
          status: filterStatus || undefined,
          priority: filterPriority || undefined,
          category: filterCategory || undefined,
          tag: filterTag || undefined,
          isDropped: droppedView ? true : false,
          isArchived: droppedView
            ? undefined
            : filterArchived === 'all'
            ? 'all'
            : filterArchived === 'true'
            ? true
            : false,
        }),
        crmApi.listProjects({ limit: 500, isDropped: false, isArchived: false }),
      ]);
      setItems(listRes.data || []);
      setPagination(listRes.pagination || null);
      setAllForKpis((kpiRes.data || []).filter((p) => !p.isDropped));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    canRead,
    page,
    debouncedSearch,
    filterStatus,
    filterPriority,
    filterCategory,
    filterTag,
    droppedView,
    viewMode,
    filterArchived,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterPriority, filterCategory, filterTag, droppedView, filterArchived]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: allForKpis.length,
      inProgress: allForKpis.filter((p) =>
        ['In Progress', 'Not Started', 'On Hold'].includes(String(p.status))
      ).length,
      overdue: allForKpis.filter(
        (p) =>
          p.deadline &&
          p.deadline < today &&
          p.status !== 'Completed' &&
          p.status !== 'Cancelled' &&
          p.status !== 'Dropped'
      ).length,
      completed: allForKpis.filter((p) => p.status === 'Completed').length,
    };
  }, [allForKpis]);

  const droppedKpis = useMemo(() => {
    if (!droppedView) return { count: 0, budget: 0 };
    return {
      count: items.length,
      budget: items.reduce((sum, p) => sum + (Number(p.budget) || 0), 0),
    };
  }, [droppedView, items]);

  const resetFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterPriority('');
    setFilterCategory('');
    setFilterTag('');
    setFilterArchived('false');
  };

  const handleStatusChange = async (item: ProjectItem, status: string) => {
    if (isLiveProjectStatus(status) && !isLiveProjectStatus(item.status)) {
      setLiveModal({ project: item, previousStatus: item.status });
      return;
    }
    try {
      await crmApi.updateProject(item._id, { status });
      showToast(`Status → ${status}`);
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Status update failed', 'error');
    }
  };

  const confirmLiveStatus = async (liveUrl: string) => {
    if (!liveModal) return;
    const { project } = liveModal;
    await crmApi.updateProject(project._id, {
      status: LIVE_PROJECT_STATUS,
      liveUrl,
    });
    setLiveModal(null);
    showToast('Project is Live — client notified with the live link');
    load();
  };

  const handleDrop = async (item: ProjectItem) => {
    if (item.status === 'Completed') {
      showToast('Completed projects cannot be dropped from the list', 'error');
      return;
    }
    const reason = await prompt(`Drop project "${item.name}"? Optional reason:`, '');
    if (reason === null) return;
    try {
      await crmApi.dropProject(item._id, { reason: reason.trim() || undefined });
      showToast('Project dropped');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Drop failed', 'error');
    }
  };

  const handleReactivate = async (item: ProjectItem) => {
    try {
      await crmApi.reactivateProject(item._id);
      showToast('Project reactivated');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Reactivate failed', 'error');
    }
  };

  const handleArchive = async (item: ProjectItem) => {
    if (!(await confirm({ message: `Archive project "${item.name}"?`, tone: 'danger', confirmLabel: 'Archive' }))) return;
    try {
      await crmApi.archiveProject(item._id);
      showToast('Project archived');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Archive failed', 'error');
    }
  };

  const handleRestore = async (item: ProjectItem) => {
    try {
      await crmApi.restoreProject(item._id);
      showToast('Project restored from archive');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Restore failed', 'error');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const filename = await crmApi.downloadProjectsExport({
        format,
        search: debouncedSearch || undefined,
        status: filterStatus || undefined,
        priority: filterPriority || undefined,
        category: filterCategory || undefined,
        tag: filterTag || undefined,
        isDropped: droppedView,
        isArchived: droppedView
          ? undefined
          : filterArchived === 'all'
          ? 'all'
          : filterArchived === 'true'
          ? true
          : false,
      });
      showToast(`Exported ${filename}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const openTemplates = () => {
    setTemplatesOpen(true);
  };

  if (!canRead) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        You do not have permission to view projects (`crm.projects.read`).
      </div>
    );
  }

  const kanbanColumns = statuses.filter((s) => s !== 'Cancelled' || droppedView);

  return (
    <div data-tour="projects-tour-landing" className="flex flex-col gap-5">
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

      <div data-tour="projects-page-header" className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-1 border-b border-zinc-200">
        <div data-tour="projects-title">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">
            Delivery
          </p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">
            {droppedView
              ? 'Dropped Projects'
              : filterArchived === 'true'
              ? 'Archived Projects'
              : filterArchived === 'all'
              ? 'All Projects'
              : 'Projects & Milestones'}
          </h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {droppedView
              ? 'Reactivate projects that were dropped from the active workspace.'
              : filterArchived === 'true'
              ? 'Restore archived projects back into the active workspace.'
              : filterArchived === 'all'
              ? 'Active and archived projects in one list.'
              : 'Plan delivery, track progress, and manage client project portfolios.'}
            {!droppedView && pagination ? ` · ${pagination.total} records` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TourButton
            moduleId="projects"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 cursor-pointer"
          />
          <button
            type="button"
            data-tour="projects-refresh-btn"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
          >
            <RefreshIcon sx={{ fontSize: 15 }} />
            Refresh
          </button>

          <div className="relative" ref={exportMenuRef} data-tour="projects-export-btn">
            <button
              type="button"
              disabled={exporting}
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
            >
              <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} />
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-300 rounded-lg py-1 z-30 min-w-[140px] flex flex-col">
                <button
                  type="button"
                  data-tour="projects-export-csv"
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-xs text-zinc-700 bg-transparent border-none cursor-pointer"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  data-tour="projects-export-json"
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-xs text-zinc-700 bg-transparent border-none cursor-pointer"
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>

          {!droppedView && (
            <>
              <button
                type="button"
                data-tour="projects-dropped-btn"
                onClick={() => navigate('/projects/dropped')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
              >
                Dropped Projects
              </button>
              <button
                type="button"
                data-tour="projects-listing-archive-btn"
                onClick={() => {
                  setPage(1);
                  setFilterArchived((cur) => (cur === 'true' ? 'false' : 'true'));
                }}
                aria-pressed={filterArchived === 'true'}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                  filterArchived === 'true'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                📦 {filterArchived === 'true' ? 'Show Active' : 'Archived Projects'}
              </button>
              {canWrite && (
                <button
                  type="button"
                  data-tour="projects-templates-btn"
                  onClick={openTemplates}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
                >
                  Templates
                </button>
              )}
            </>
          )}

          {droppedView && (
            <button
              type="button"
              data-tour="projects-active-btn"
              onClick={() => navigate('/projects')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
            >
              Active Projects
            </button>
          )}

          {canWrite && !droppedView && (
            <button
              type="button"
              data-tour="projects-create-btn"
              onClick={() => navigate('/projects/create')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer"
            >
              <AddIcon sx={{ fontSize: 16 }} />
              New Project
            </button>
          )}
        </div>
      </div>

      {!droppedView && (
        <div data-tour="projects-kpis" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: kpis.total, tour: 'projects-kpi-total' },
            { label: 'In Progress', value: kpis.inProgress, tour: 'projects-kpi-in-progress' },
            { label: 'Overdue', value: kpis.overdue, tour: 'projects-kpi-overdue' },
            { label: 'Completed', value: kpis.completed, tour: 'projects-kpi-completed' },
          ].map((card) => (
            <div key={card.label} data-tour={card.tour} className="bg-white border border-zinc-300 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {card.label}
              </div>
              <div className="text-xl font-bold text-zinc-950 mt-1">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {droppedView && (
        <div data-tour="projects-dropped-kpis" className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-zinc-300 rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Dropped
            </div>
            <div className="text-xl font-bold text-zinc-950 mt-1">{droppedKpis.count}</div>
          </div>
          <div className="bg-white border border-zinc-300 rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Budget (loaded)
            </div>
            <div className="text-xl font-bold text-zinc-950 mt-1">
              {formatMoney(droppedKpis.budget)}
            </div>
          </div>
        </div>
      )}

      <div data-tour="projects-filters" className="bg-white border border-zinc-300 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <label data-tour="projects-filter-search" className="flex flex-col gap-1 min-w-[200px] flex-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Search</span>
          <input
            className={fieldClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, client, category, tag…"
          />
        </label>
        {!droppedView && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase">Status</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setFilterStatus('')}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                  !filterStatus
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                All
              </button>
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                    filterStatus === s
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex flex-col gap-1 min-w-[140px]">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Priority</span>
          <select
            className={fieldClass}
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">All</option>
            {priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-[160px]">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Category</span>
          <select
            className={fieldClass}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-[140px]">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Tag</span>
          <select
            className={fieldClass}
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          >
            <option value="">All</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {!droppedView && (
          <label data-tour="projects-filter-archive" className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase">Archive</span>
            <select
              className={fieldClass}
              value={filterArchived}
              onChange={(e) => {
                setPage(1);
                setFilterArchived(e.target.value as 'false' | 'true' | 'all');
              }}
            >
              <option value="false">Active Only</option>
              <option value="true">Archived Only</option>
              <option value="all">All (Active &amp; Archived)</option>
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-1 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
        >
          <RestartAltIcon sx={{ fontSize: 14 }} />
          Reset
        </button>
        {!droppedView && (
          <div data-tour="projects-view-tabs" className="inline-flex rounded-lg border border-zinc-200 overflow-hidden ml-auto">
            <button
              type="button"
              data-tour="projects-tab-list"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 px-3 h-9 text-xs font-semibold border-none cursor-pointer ${
                viewMode === 'list' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-700'
              }`}
            >
              <ViewListOutlinedIcon sx={{ fontSize: 15 }} />
              List
            </button>
            <button
              type="button"
              data-tour="projects-tab-kanban"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1 px-3 h-9 text-xs font-semibold border-none cursor-pointer border-l border-zinc-200 ${
                viewMode === 'kanban' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-700'
              }`}
            >
              <ViewColumnOutlinedIcon sx={{ fontSize: 15 }} />
              Kanban
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center text-sm text-zinc-500 animate-pulse">
          Loading projects…
        </div>
      ) : viewMode === 'kanban' && !droppedView ? (
        <ProjectKanbanView
          projects={items}
          statuses={kanbanColumns}
          canWrite={canWrite}
          onOpenProject={(p) => navigate(`/projects/${p._id}`)}
          onMoveStatus={(project, status) => void handleStatusChange(project, status)}
        />
      ) : (
        <div data-tour="projects-table" className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
          {items.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No projects found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1100px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    {[
                      ['Project', 'projects-col-project'],
                      ['Client', 'projects-col-client'],
                      ['Priority', 'projects-col-priority'],
                      ['Status', 'projects-col-status'],
                      ['Progress', 'projects-col-progress'],
                      ['Budget', 'projects-col-budget'],
                      ['Members', 'projects-col-members'],
                      ['Tasks', 'projects-col-tasks'],
                      ['Actions', 'projects-col-actions'],
                    ].map(([h, tour]) => (
                      <th
                        key={h}
                        data-tour={tour}
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p, rowIdx) => {
                    const done = p.completedTaskCount || 0;
                    const total = p.taskCount || 0;
                    const pct = p.progress ?? (total ? Math.round((done / total) * 100) : 0);
                    return (
                      <tr
                        key={p._id}
                        data-project-id={p._id}
                        {...(rowIdx === 0 ? { 'data-tour': 'projects-row-first' } : {})}
                        className="border-b border-zinc-100 hover:bg-zinc-50/70"
                      >
                        <td className="px-4 py-3">
                          <Link
                            to={`/projects/${p._id}`}
                            className="text-sm font-semibold text-zinc-950 no-underline hover:underline"
                          >
                            {p.name}
                          </Link>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {p.category || 'Uncategorized'}
                            {p.deadline ? ` · Due ${p.deadline}` : ''}
                            {isOverdue(p) ? ' · Overdue' : ''}
                          </div>
                          {!!p.tags?.length && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.tags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {p.droppedReason && (
                            <div className="text-[11px] text-zinc-400 italic mt-1">
                              "{p.droppedReason}"
                            </div>
                          )}
                          {p.isArchived && (
                            <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
                              📦 Archived
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700">{p.clientName || '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${priorityBadgeClass(p.priority)}`}
                          >
                            {p.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {canWrite && !droppedView ? (
                            <select
                              value={p.status}
                              onChange={(e) => handleStatusChange(p, e.target.value)}
                              className={`h-8 px-2 text-xs border rounded-lg ${statusBadgeClass(p.status)}`}
                            >
                              {statuses.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${statusBadgeClass(p.status)}`}
                            >
                              {p.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="text-[11px] text-zinc-600 mb-1">
                            {done}/{total} tasks · {pct}%
                          </div>
                          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                            <div
                              className="h-full bg-zinc-900"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700">
                          {formatMoney(p.budget, p.currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700">
                          {Number(
                            p.memberCount ??
                              (Array.isArray(p.assignedTo) ? p.assignedTo.length : 0)
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700">
                          {done}/{total}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Open"
                              onClick={() => navigate(`/projects/${p._id}`)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 cursor-pointer shadow-xs transition-colors"
                            >
                              <OpenInNewIcon sx={{ fontSize: 20 }} />
                            </button>
                            {canWrite && !droppedView && (
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => navigate(`/projects/${p._id}/edit`)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 cursor-pointer shadow-xs transition-colors"
                              >
                                <EditOutlinedIcon sx={{ fontSize: 20 }} />
                              </button>
                            )}
                            {droppedView && canWrite && (
                              <button
                                type="button"
                                onClick={() => handleReactivate(p)}
                                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 cursor-pointer shadow-xs transition-colors"
                              >
                                <RestartAltIcon sx={{ fontSize: 18 }} />
                                Reactivate
                              </button>
                            )}
                            {!droppedView && p.isArchived && canWrite && (
                              <button
                                type="button"
                                title="Restore from archive"
                                onClick={() => handleRestore(p)}
                                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 cursor-pointer shadow-xs transition-colors"
                              >
                                <UnarchiveOutlinedIcon sx={{ fontSize: 18 }} />
                                Restore
                              </button>
                            )}
                            {!droppedView && !p.isArchived && canWrite && (
                              <button
                                type="button"
                                title="Archive project"
                                onClick={() => handleArchive(p)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 cursor-pointer shadow-xs transition-colors"
                              >
                                <ArchiveOutlinedIcon sx={{ fontSize: 18 }} />
                              </button>
                            )}
                            {canDelete && !droppedView && p.status !== 'Completed' && (
                              <button
                                type="button"
                                title="Drop project"
                                onClick={() => handleDrop(p)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer shadow-xs transition-colors"
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 20 }} />
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
          {pagination && pagination.totalPages > 1 && viewMode === 'list' && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200">
              <span className="text-xs text-zinc-500">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ProjectTemplateModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onUseTemplate={(tpl) => {
          setTemplatesOpen(false);
          navigate(`/projects/new?templateId=${tpl._id}`);
        }}
        showToast={showToast}
      />

      <LiveLinkModal
        open={Boolean(liveModal)}
        projectName={liveModal?.project.name}
        initialUrl={liveModal?.project.liveUrl || ''}
        onCancel={() => setLiveModal(null)}
        onConfirm={confirmLiveStatus}
      />
    </div>
  );
};
