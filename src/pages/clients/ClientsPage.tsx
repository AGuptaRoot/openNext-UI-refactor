import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
import {
  ClientItem,
  ClientListSummary,
  ClientPaginationMeta,
} from '../../types/clients';
import { ClientListView } from '../../components/clients/ClientListView';
import { CsvImportModal } from '../../components/common/CsvImportModal';

export const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm } = useDialog();
  const canRead = hasPermission('crm.clients.read');
  const canWrite = hasPermission('crm.clients.write');
  const canDelete = hasPermission('crm.clients.delete');

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [summary, setSummary] = useState<ClientListSummary | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [pagination, setPagination] = useState<ClientPaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 320);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (canWrite && (window.location.hash.includes('action=create') || window.location.search.includes('action=create'))) {
      navigate('/clients/create');
    }
  }, [canWrite, navigate]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!canRead) return;
    Promise.all([
      crmApi.getClientCategories(),
      crmApi.getClientTags(),
      crmApi.getClientsListSummary(),
    ])
      .then(([cat, tag, sum]) => {
        setCategories(cat.data || []);
        setTags(tag.data || []);
        setSummary(sum.data);
      })
      .catch(() => {});
  }, [canRead]);

  const loadClients = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const res = await crmApi.listClients({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        category: filterCategory || undefined,
        tag: filterTag || undefined,
        status: filterStatus || undefined,
      });
      setClients(res.data || []);
      setPagination(res.pagination || null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load clients', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterCategory, filterTag, filterStatus, canRead]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategory, filterTag, filterStatus]);

  const handleDelete = async (client: ClientItem) => {
    if (!(await confirm({ message: `Delete client "${client.name}"? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteClient(client._id);
      showToast('Client deleted');
      loadClients();
      const sum = await crmApi.getClientsListSummary();
      setSummary(sum.data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setExportOpen(false);
    try {
      const filename = await crmApi.downloadClientsExport({
        format,
        search: debouncedSearch || undefined,
        category: filterCategory || undefined,
        tag: filterTag || undefined,
        status: filterStatus || undefined,
      });
      showToast(`Exported ${filename}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterTag('');
    setFilterStatus('');
  };

  if (!canRead) {
    return (
      <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center">
        <p className="text-sm font-semibold text-zinc-900 m-0 mb-1">Access denied</p>
        <p className="text-xs text-zinc-500 m-0">
          You need the <code className="text-[11px]">crm.clients.read</code> permission to view clients.
        </p>
      </div>
    );
  }

  return (
    <div data-tour="clients-tour-landing" className="flex flex-col gap-5">
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

      <div data-tour="clients-page-header" className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-1 border-b border-zinc-200">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">
            Sales
          </p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">Clients</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Account directory, contacts, and client 360° profiles.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TourButton
            moduleId="clients"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-0 bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer"
          />

          <button
            type="button"
            data-tour="clients-refresh-btn"
            onClick={() => loadClients()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
          >
            <RefreshIcon sx={{ fontSize: 15 }} />
            Refresh
          </button>

          <div className="relative" ref={exportRef} data-tour="clients-export-btn">
            <button
              type="button"
              disabled={exporting}
              onClick={() => setExportOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
            >
              <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} />
              Export
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white border border-zinc-300 rounded-lg shadow-lg z-20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 border-none bg-transparent cursor-pointer"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 border-none bg-transparent cursor-pointer"
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
                data-tour="clients-import-btn"
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
              >
                <FileUploadOutlinedIcon sx={{ fontSize: 15 }} />
                Import
              </button>

              <button
                type="button"
                data-tour="clients-create-btn"
                onClick={() => navigate('/clients/create')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer"
              >
                <AddIcon sx={{ fontSize: 16 }} />
                New Client
              </button>
            </>
          )}
        </div>
      </div>

      {summary && (
        <div data-tour="clients-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Clients', value: summary.totalClients ?? summary.total ?? 0, tour: 'clients-kpi-total' },
            { label: 'From Leads', value: summary.fromLeads ?? summary.fromLead ?? 0, tour: 'clients-kpi-from-leads' },
            { label: 'Active', value: summary.activeClients ?? 0, tour: 'clients-kpi-active' },
            { label: 'Inactive', value: summary.inactiveClients ?? 0, tour: 'clients-kpi-inactive' },
          ].map((card) => (
            <div key={card.label} data-tour={card.tour} className="bg-white border border-zinc-300 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {card.label}
              </div>
              <div className="text-2xl font-bold text-zinc-950 mt-1">
                {Number.isFinite(Number(card.value)) ? Number(card.value) : 0}
              </div>
            </div>
          ))}
        </div>
      )}

      <div data-tour="clients-filters" className="bg-white border border-zinc-300 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <label data-tour="clients-filter-search" className="flex flex-col gap-1 min-w-[200px] flex-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Search
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name, email, phone, contact…"
            className="h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400"
          />
        </label>
        <label className="flex flex-col gap-1 min-w-[140px]">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Category
          </span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 px-2 text-sm border border-zinc-300 rounded-lg bg-white"
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
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Tag</span>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="h-9 px-2 text-sm border border-zinc-300 rounded-lg bg-white"
          >
            <option value="">All</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Status
          </span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 px-2 text-sm border border-zinc-300 rounded-lg bg-white"
          >
            <option value="">All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
        <button
          type="button"
          onClick={resetFilters}
          className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
        >
          Reset
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center text-sm text-zinc-500 animate-pulse">
          Loading clients…
        </div>
      ) : (
        <ClientListView
          clients={clients}
          pagination={pagination}
          onPageChange={setPage}
          onView={(c) => navigate(`/clients/${c._id}`)}
          onDelete={handleDelete}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      )}

      {importOpen && (
        <CsvImportModal
          isOpen={importOpen}
          entityType="clients"
          categories={categories}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            showToast('Clients imported successfully!');
            loadClients();
            crmApi.getClientsListSummary().then((sum) => setSummary(sum.data)).catch(() => {});
          }}
        />
      )}


    </div>
  );
};
