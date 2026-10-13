import { displayLabel, displayUserLabel } from '../../utils/displayLabels';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import {
  TICKET_CHANNELS,
  TICKET_GROUPS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  evaluateSla,
  slaToneClass,
  type TicketItem,
  type TicketStatus,
} from '../../types/tickets';
import { triggerFileDownload } from '../../utils/fileDownload';
import { TicketKanbanView } from '../../components/tickets/TicketKanbanView';

type ViewMode = 'table' | 'kanban';
type ArchiveView = 'active' | 'archived';
type StatusFilter = '' | TicketStatus;

const fieldClass =
  'h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-400';

const OPEN_COMPLAINT_STATUSES = new Set(['Open', 'In Progress', 'Pending Client']);

function priorityBadgeClass(priority: string): string {
  const map: Record<string, string> = {
    Urgent: 'bg-red-50 text-red-800 border-red-200',
    High: 'bg-amber-50 text-amber-800 border-amber-200',
    Medium: 'bg-sky-50 text-sky-800 border-sky-200',
    Low: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  };
  return map[priority] || 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    Open: 'bg-sky-50 text-sky-800',
    'In Progress': 'bg-amber-50 text-amber-800',
    'Pending Client': 'bg-orange-50 text-orange-800',
    Resolved: 'bg-emerald-50 text-emerald-800',
    Closed: 'bg-zinc-100 text-zinc-600',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

function SlaBadge({ ticket }: { ticket: TicketItem }) {
  const sla = evaluateSla(ticket);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${slaToneClass(sla.tone)}`}
    >
      {sla.label}
    </span>
  );
}

export const TicketsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isClient } = useAuth();
  // Clients may create tickets (crm.tickets.write) but cannot run staff status/kanban controls.
  const canCreateTicket = hasPermission('crm.tickets.write');
  const canManageStatus = hasPermission('crm.tickets.write') && !isClient;
  const canResolve = hasPermission('crm.tickets.resolve') && !isClient;
  const [items, setItems] = useState<TicketItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [archiveView, setArchiveView] = useState<ArchiveView>('active');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState(() => searchParams.get('priority') || '');
  const [attentionFilter, setAttentionFilter] = useState(() => searchParams.get('attention') || '');
  const [attentionIds, setAttentionIds] = useState(() => searchParams.get('ids') || '');
  const [type, setType] = useState('');
  const [assignGroup, setAssignGroup] = useState('');
  const [channel, setChannel] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const listLimit = viewMode === 'kanban' ? 100 : 20;

  useEffect(() => {
    const nextPriority = searchParams.get('priority') || '';
    const nextAttention = searchParams.get('attention') || '';
    const nextIds = searchParams.get('ids') || '';
    setPriority((prev) => (prev === nextPriority ? prev : nextPriority));
    setAttentionFilter((prev) => (prev === nextAttention ? prev : nextAttention));
    setAttentionIds((prev) => (prev === nextIds ? prev : nextIds));
  }, [searchParams]);

  const syncAttentionParams = useCallback(
    (next: { priority?: string; attention?: string; ids?: string }) => {
      const params = new URLSearchParams(searchParams);
      const nextPriority = next.priority ?? priority;
      const nextAttention = next.attention ?? attentionFilter;
      const nextIds = next.ids ?? attentionIds;
      if (nextPriority) params.set('priority', nextPriority);
      else params.delete('priority');
      if (nextAttention) params.set('attention', nextAttention);
      else params.delete('attention');
      if (nextIds) params.set('ids', nextIds);
      else params.delete('ids');
      setSearchParams(params, { replace: true });
    },
    [attentionFilter, attentionIds, priority, searchParams, setSearchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await crmApi.listTickets({
        search: search || undefined,
        priority: attentionFilter === 'escalations' ? undefined : priority || undefined,
        type: type || undefined,
        assignGroup: assignGroup || undefined,
        channelName: channel || undefined,
        ids: attentionIds || undefined,
        attention: attentionFilter || undefined,
        isArchived: archiveView === 'archived',
        page: viewMode === 'table' ? page : 1,
        limit: listLimit,
      });
      setItems(response.data || []);
      setPagination(viewMode === 'table' ? response.pagination || null : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [
    search,
    priority,
    type,
    assignGroup,
    channel,
    attentionIds,
    attentionFilter,
    archiveView,
    page,
    viewMode,
    listLimit,
  ]);

  useEffect(() => {
    setPage(1);
  }, [search, priority, type, assignGroup, channel, attentionIds, attentionFilter, archiveView, viewMode]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onView = (e: Event) => {
      const view = (e as CustomEvent<{ view?: ViewMode }>).detail?.view;
      if (view === 'table' || view === 'kanban') {
        setViewMode(view);
        setPage(1);
      }
    };
    const onArchive = (e: Event) => {
      const archive = (e as CustomEvent<{ archive?: ArchiveView }>).detail?.archive;
      if (archive === 'active' || archive === 'archived') {
        setArchiveView(archive);
        setPage(1);
      }
    };
    window.addEventListener('crm-tickets-tour-view', onView as EventListener);
    window.addEventListener('crm-tickets-tour-archive', onArchive as EventListener);
    return () => {
      window.removeEventListener('crm-tickets-tour-view', onView as EventListener);
      window.removeEventListener('crm-tickets-tour-archive', onArchive as EventListener);
    };
  }, []);

  const kpis = useMemo(() => {
    void tick;
    const activePool = items.filter((item) => !item.isArchived);
    const pool = archiveView === 'active' ? activePool : items;
    return {
      total: archiveView === 'active' ? activePool.length : items.length,
      openComplaints: pool.filter((item) => OPEN_COMPLAINT_STATUSES.has(String(item.status))).length,
      slaBreached: pool.filter((item) => evaluateSla(item).breached).length,
      resolvedClosed: pool.filter((item) => item.status === 'Resolved' || item.status === 'Closed')
        .length,
    };
  }, [items, archiveView, tick]);

  // Status pills filter client-side so Kanban still shows all columns when a pill is selected.
  const filteredItems = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const changeStatus = async (id: string, nextStatus: string) => {
    if (!canManageStatus) return;
    if (['Resolved', 'Closed'].includes(nextStatus) && !canResolve) {
      setError('You do not have permission to resolve or close tickets.');
      return;
    }
    const current = items.find((item) => item._id === id);
    if (!current || current.status === nextStatus) return;
    setBusyId(id);
    setError('');
    try {
      const response = await crmApi.updateTicketStatus(id, { status: nextStatus });
      setItems((list) =>
        list.map((item) => (item._id === id ? { ...item, ...response.data } : item))
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to update status');
    } finally {
      setBusyId('');
    }
  };

  const exportData = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    try {
      const response = await crmApi.exportTickets({
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priority || undefined,
        type: type || undefined,
        assignGroup: assignGroup || undefined,
        channelName: channel || undefined,
        isArchived: archiveView === 'archived',
        format,
      });
      triggerFileDownload({
        filename: response.data.filename,
        content: response.data.content,
        format,
        mimeType: response.data.mimeType,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    }
  };

  const statusPills: Array<{ value: StatusFilter; label: string }> = [
    { value: '', label: 'All' },
    ...TICKET_STATUSES.map((status) => ({ value: status as StatusFilter, label: status })),
  ];

  return (
    <div data-tour="tickets-tour-landing" className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div data-tour="tickets-title">
          <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Support & Helpdesk
          </p>
          <h1 className="m-0 text-2xl font-bold text-zinc-950">Support Tickets</h1>
          <p className="m-0 mt-1 text-sm text-zinc-500">
            Track cases, SLA targets, assignments, and resolution workflows.
          </p>
        </div>
        <div data-tour="tickets-header-actions" className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700"
          >
            <RefreshIcon sx={{ fontSize: 15 }} /> Refresh
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((open) => !open)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700"
            >
              <DownloadIcon sx={{ fontSize: 15 }} /> Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => exportData('csv')}
                  className="block w-full cursor-pointer border-0 bg-white px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => exportData('json')}
                  className="block w-full cursor-pointer border-0 bg-white px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>
          {canCreateTicket && (
            <Link
              data-tour="tickets-create-btn"
              to="/tickets/create"
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white no-underline hover:bg-zinc-800"
            >
              <AddIcon sx={{ fontSize: 18 }} /> New Ticket
            </Link>
          )}
          <TourButton moduleId="tickets" />
        </div>
      </header>

      <div data-tour="tickets-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Cases', value: String(kpis.total) },
          { label: 'Open Complaints', value: String(kpis.openComplaints) },
          { label: 'SLA Breached', value: String(kpis.slaBreached) },
          { label: 'Resolved & Closed', value: String(kpis.resolvedClosed) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase text-zinc-500">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div data-tour="tickets-view-tabs" className="inline-flex self-start rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border-0 px-3 text-xs font-semibold ${
              viewMode === 'table' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
            }`}
          >
            <ViewListIcon sx={{ fontSize: 15 }} /> Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border-0 px-3 text-xs font-semibold ${
              viewMode === 'kanban' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
            }`}
          >
            <ViewKanbanIcon sx={{ fontSize: 15 }} /> Kanban
          </button>
        </div>

        <div data-tour="tickets-archive-tabs" className="inline-flex self-start rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          <button
            type="button"
            onClick={() => setArchiveView('active')}
            className={`h-8 cursor-pointer rounded-md border-0 px-3 text-xs font-semibold ${
              archiveView === 'active' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setArchiveView('archived')}
            className={`h-8 cursor-pointer rounded-md border-0 px-3 text-xs font-semibold ${
              archiveView === 'archived' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
            }`}
          >
            Archived
          </button>
        </div>

        <div data-tour="tickets-status-pills" className="flex flex-wrap gap-1.5">
          {statusPills.map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={() => setStatusFilter(pill.value)}
              className={`h-8 cursor-pointer rounded-full border px-3 text-xs font-semibold ${
                statusFilter === pill.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="tickets-filters" className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4 lg:flex-row lg:flex-wrap">
        <input
          className={`${fieldClass} min-w-[200px] flex-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticket #, subject, requester…"
        />
        <select
          className={`${fieldClass} min-w-36`}
          value={priority}
          onChange={(e) => {
            const nextPriority = e.target.value;
            setPriority(nextPriority);
            setAttentionFilter('');
            setAttentionIds('');
            syncAttentionParams({ priority: nextPriority, attention: '', ids: '' });
          }}
        >
          <option value="">All priorities</option>
          {TICKET_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {attentionFilter === 'escalations' || attentionIds ? (
          <button
            type="button"
            onClick={() => {
              setAttentionFilter('');
              setAttentionIds('');
              syncAttentionParams({ attention: '', ids: '' });
            }}
            className="h-9 cursor-pointer rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Showing Attention Radar escalations · Clear
          </button>
        ) : null}
        <select className={`${fieldClass} min-w-40`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {TICKET_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} min-w-40`}
          value={assignGroup}
          onChange={(e) => setAssignGroup(e.target.value)}
        >
          <option value="">All groups</option>
          {TICKET_GROUPS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} min-w-36`}
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="">All channels</option>
          {TICKET_CHANNELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
          Loading tickets…
        </div>
      ) : viewMode === 'table' ? (
        <div data-tour="tickets-table" className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No tickets found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Ticket ID</th>
                    <th className="px-4 py-3">Subject & Requester</th>
                    <th className="px-4 py-3">Group & Channel</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">SLA</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assignee</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => (
                    <tr
                      key={item._id}
                      data-tour={index === 0 ? 'tickets-row-first' : undefined}
                      data-ticket-id={index === 0 ? item._id : undefined}
                      className="border-t border-zinc-100 hover:bg-zinc-50/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/tickets/${item._id}`}
                          className="font-semibold text-zinc-950 no-underline hover:underline"
                        >
                          {displayLabel(item.ticketNumber)}
                        </Link>
                        {item.escalationLevel && item.escalationLevel !== 'Standard' && (
                          <div className="mt-1">
                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              {item.escalationLevel}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{item.subject}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {item.requesterName || item.contactPerson || '—'}
                          {item.requesterCompany ? ` · ${item.requesterCompany}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        <div>{item.assignGroup}</div>
                        <div className="text-xs text-zinc-500">{item.channelName}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{item.type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityBadgeClass(item.priority)}`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SlaBadge ticket={item} />
                      </td>
                      <td className="px-4 py-3">
                        {canManageStatus ? (
                          <select
                            className={`${fieldClass} min-w-[130px]`}
                            value={item.status}
                            disabled={busyId === item._id}
                            onChange={(e) => changeStatus(item._id, e.target.value)}
                          >
                            {TICKET_STATUSES.filter(
                              (status) =>
                                !['Resolved', 'Closed'].includes(status) ||
                                canResolve ||
                                item.status === status
                            ).map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(item.status)}`}
                          >
                            {item.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {displayUserLabel(item.assignedToName, item.assignedTo, 'Unassigned')}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/tickets/${item._id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 no-underline hover:bg-zinc-50"
                        >
                          <OpenInNewIcon sx={{ fontSize: 14 }} /> Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ListPager pagination={pagination} onPageChange={setPage} label="tickets" />
        </div>
      ) : (
        <TicketKanbanView
          tickets={filteredItems}
          canManageStatus={canManageStatus}
          canResolve={canResolve}
          busyId={busyId}
          onOpenTicket={(ticket) => navigate(`/tickets/${ticket._id}`)}
          onMoveStatus={(id, status) => void changeStatus(id, status)}
        />
      )}
    </div>
  );
};
