import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import {
  SALES_ORDER_LIST_TABS,
  type SalesOrderItem,
} from '../../types/salesOrders';
import { triggerFileDownload } from '../../utils/fileDownload';
import { displayLabel } from '../../utils/displayLabels';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-zinc-100 text-zinc-700',
    Pending: 'bg-amber-50 text-amber-800',
    'On Hold': 'bg-orange-50 text-orange-800',
    Failed: 'bg-red-50 text-red-800',
    Processing: 'bg-sky-50 text-sky-800',
    Approved: 'bg-emerald-50 text-emerald-800',
    'Partially Shipped': 'bg-indigo-50 text-indigo-800',
    Shipped: 'bg-blue-50 text-blue-800',
    Completed: 'bg-emerald-50 text-emerald-900',
    Cancelled: 'bg-rose-50 text-rose-800',
    Returned: 'bg-stone-100 text-stone-700',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

function deliveryClass(status?: string): string {
  const map: Record<string, string> = {
    'Pending Allocation': 'bg-zinc-100 text-zinc-600',
    Allocated: 'bg-sky-50 text-sky-800',
    'Partially Dispatched': 'bg-amber-50 text-amber-800',
    Dispatched: 'bg-indigo-50 text-indigo-800',
    'In-Transit': 'bg-blue-50 text-blue-800',
    Delivered: 'bg-emerald-50 text-emerald-800',
    Returned: 'bg-stone-100 text-stone-700',
  };
  return (status && map[status]) || 'bg-zinc-100 text-zinc-600';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
}

export const SalesOrdersPage: React.FC = () => {
  const { confirm } = useDialog();
  const navigate = useNavigate();
  const { hasPermission, isClient } = useAuth();
  const canWriteOrders = hasPermission('crm.orders.write') && !isClient;
  const canDeleteOrders = hasPermission('crm.orders.delete') && !isClient;
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [kpiSource, setKpiSource] = useState<SalesOrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<(typeof SALES_ORDER_LIST_TABS)[number]>('All Orders');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const statusParam = activeTab === 'All Orders' ? undefined : activeTab;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [filtered, allForKpis] = await Promise.all([
        crmApi.listSalesOrders({
          search: search || undefined,
          status: statusParam,
          page,
          limit: 20,
        }),
        crmApi.listSalesOrders({
          search: search || undefined,
          limit: 100,
        }),
      ]);
      setItems(filtered.data || []);
      setPagination(filtered.pagination || null);
      setKpiSource(allForKpis.data || []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  }, [search, statusParam, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusParam]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const onTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab && (SALES_ORDER_LIST_TABS as readonly string[]).includes(tab)) {
        setActiveTab(tab as (typeof SALES_ORDER_LIST_TABS)[number]);
        setPage(1);
      }
    };
    window.addEventListener('crm-sales-orders-tour-tab', onTab as EventListener);
    return () => window.removeEventListener('crm-sales-orders-tour-tab', onTab as EventListener);
  }, []);

  const kpis = useMemo(() => {
    const active = kpiSource.filter((item) =>
      ['Processing', 'Partially Shipped', 'Shipped'].includes(item.status)
    );
    const completedRevenue = kpiSource
      .filter((item) => item.status === 'Completed')
      .reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
    return {
      total: pagination?.total ?? kpiSource.length,
      active: active.length,
      completedRevenue,
    };
  }, [kpiSource, pagination]);

  useEffect(() => {
    if (!exportOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [exportOpen]);

  const exportData = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    try {
      const response = await crmApi.exportSalesOrders({
        search: search || undefined,
        status: statusParam,
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

  const deleteDraft = async (id: string, orderNumber: string) => {
    if (!(await confirm({ message: `Delete draft sales order ${orderNumber}?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    setBusyId(id);
    try {
      await crmApi.deleteSalesOrder(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Delete failed');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div data-tour="sales-orders-tour-landing" className="flex flex-col gap-5">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div data-tour="sales-orders-title">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">
            Order Management
          </p>
          <h1 className="text-2xl font-bold text-zinc-950 m-0">Sales Orders</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Track approved commitments through dispatch, delivery, RMA, and invoicing.
          </p>
        </div>
        <div data-tour="sales-orders-header-actions" className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
          >
            <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
          </button>
          {!isClient && (
            <div className="relative" ref={exportRef} data-tour="sales-orders-export-btn">
              <button
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <DownloadIcon sx={{ fontSize: 15 }} /> Export
                <ExpandMoreIcon sx={{ fontSize: 16 }} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg">
                  <button
                    type="button"
                    data-tour="sales-orders-export-csv"
                    onClick={() => void exportData('csv')}
                    className="w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    data-tour="sales-orders-export-json"
                    onClick={() => void exportData('json')}
                    className="w-full cursor-pointer border-0 border-t border-zinc-100 bg-transparent px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    Export JSON
                  </button>
                </div>
              )}
            </div>
          )}
          {canWriteOrders && (
            <button
              type="button"
              data-tour="sales-orders-create-btn"
              onClick={() => navigate('/sales-orders/create')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer"
            >
              <AddIcon sx={{ fontSize: 16 }} /> Create Sales Order
            </button>
          )}
          {!isClient && (
            <TourButton
              moduleId="sales-orders"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
            />
          )}
        </div>
      </header>

      <div data-tour="sales-orders-kpis" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Orders', value: String(kpis.total) },
          { label: 'Active / Dispatched', value: String(kpis.active) },
          { label: 'Completed Revenue', value: formatFinanceMoney(kpis.completedRevenue) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase text-zinc-500">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div
          data-tour="sales-orders-status-tabs"
          className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 min-w-min"
        >
          {SALES_ORDER_LIST_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer whitespace-nowrap ${
                activeTab === tab ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="sales-orders-search" className="bg-white border border-zinc-300 rounded-xl p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search order # or client name (e.g. SO-001, AR)…"
          className="h-9 w-full px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div data-tour="sales-orders-table" className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading sales orders…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">No sales orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase text-zinc-500">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Delivery target</th>
                  <th className="px-4 py-3">Delivery status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item._id}
                    data-tour={index === 0 ? 'sales-orders-row-first' : undefined}
                    data-sales-order-id={item._id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                    onClick={() => navigate(`/sales-orders/${item._id}`)}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/sales-orders/${item._id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-semibold text-zinc-950 no-underline hover:underline"
                      >
                        {item.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{displayLabel(item.clientName)}</td>
                    <td className="px-4 py-3 text-zinc-600">{formatDate(item.issueDate)}</td>
                    <td className="px-4 py-3 text-zinc-600">{formatDate(item.deliveryTargetDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${deliveryClass(
                          item.deliveryStatus
                        )}`}
                      >
                        {item.deliveryStatus || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatFinanceMoney(item.grandTotal, item.currency)}
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
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/sales-orders/${item._id}`)}
                          className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer"
                          title="Open detail"
                        >
                          <OpenInNewIcon sx={{ fontSize: 13 }} /> Open
                        </button>
                        {canDeleteOrders && item.status === 'Draft' && (
                          <button
                            type="button"
                            disabled={busyId === item._id}
                            onClick={() => deleteDraft(item._id, item.orderNumber)}
                            className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-md border border-red-200 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
                            title="Delete draft"
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 14 }} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div data-tour="sales-orders-pagination">
          <ListPager pagination={pagination} onPageChange={setPage} label="sales orders" />
        </div>
      </div>
    </div>
  );
};
