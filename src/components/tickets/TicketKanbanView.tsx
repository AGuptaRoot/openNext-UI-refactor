import React, { useMemo } from 'react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  TICKET_STATUSES,
  evaluateSla,
  slaToneClass,
  type TicketItem,
  type TicketStatus,
} from '../../types/tickets';
import { displayUserLabel } from '../../utils/displayLabels';
import { KanbanBoard, KanbanCard, KanbanColumn, KanbanColumnDropHint } from '../dndkit';

export type TicketKanbanViewProps = {
  tickets: TicketItem[];
  statuses?: readonly TicketStatus[];
  canManageStatus?: boolean;
  canResolve?: boolean;
  busyId?: string;
  onOpenTicket: (ticket: TicketItem) => void;
  onMoveStatus: (ticketId: string, nextStatus: string) => void | Promise<void>;
};

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

/**
 * Tickets status board — drag cards between columns with @dnd-kit.
 */
export const TicketKanbanView: React.FC<TicketKanbanViewProps> = ({
  tickets,
  statuses = TICKET_STATUSES,
  canManageStatus = false,
  canResolve = false,
  busyId = '',
  onOpenTicket,
  onMoveStatus,
}) => {
  const columns = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const status of statuses) map[status] = [];
    for (const ticket of tickets) {
      const key = ticket.status || 'Open';
      if (!map[key]) map[key] = [];
      map[key].push(ticket._id);
    }
    return map;
  }, [tickets, statuses]);

  const byId = useMemo(() => {
    const map: Record<string, TicketItem> = {};
    for (const ticket of tickets) map[ticket._id] = ticket;
    return map;
  }, [tickets]);

  const ticketsByStatus = useMemo(() => {
    const map: Record<string, TicketItem[]> = {};
    for (const status of statuses) map[status] = [];
    for (const ticket of tickets) {
      const key = ticket.status || 'Open';
      if (!map[key]) map[key] = [];
      map[key].push(ticket);
    }
    return map;
  }, [tickets, statuses]);

  return (
    <KanbanBoard
      columns={columns}
      disabled={!canManageStatus}
      onMoveCard={async (cardId, _from, toStatus) => {
        const ticket = byId[cardId];
        if (!ticket || ticket.status === toStatus) return;
        if (['Resolved', 'Closed'].includes(toStatus) && !canResolve) return;
        await onMoveStatus(cardId, toStatus);
      }}
      className="grid grid-cols-1 gap-3 xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2"
      data-tour="tickets-kanban"
      renderOverlay={(cardId) => {
        const item = byId[cardId];
        if (!item) return null;
        return (
          <div className="w-64 rounded-lg border-2 border-zinc-950 bg-white p-3 shadow-2xl rotate-1">
            <div className="text-xs font-bold text-zinc-950">{item.ticketNumber}</div>
            <div className="mt-1 line-clamp-2 text-xs font-medium text-zinc-800">{item.subject}</div>
            <p className="mb-0 mt-2 text-[10px] font-semibold text-zinc-500">
              Drop on a status column to move
            </p>
          </div>
        );
      }}
    >
      {statuses.map((colStatus) => {
        const columnTickets = ticketsByStatus[colStatus] || [];
        return (
          <KanbanColumn
            key={colStatus}
            columnId={colStatus}
            className="flex min-h-[420px] flex-col rounded-xl border border-zinc-200 bg-zinc-50/50 data-[kanban-over=true]:border-zinc-950 data-[kanban-over=true]:ring-2 data-[kanban-over=true]:ring-zinc-950/15"
          >
            <div className="flex items-center justify-between rounded-t-xl border-b border-zinc-200 bg-white p-3">
              <span className="text-xs font-bold text-zinc-900">{colStatus}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                {columnTickets.length}
              </span>
            </div>
            <div className="flex max-h-[calc(100vh-280px)] flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
              {columnTickets.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
                  Drop tickets here
                </div>
              ) : (
                columnTickets.map((item) => {
                  const isBusy = busyId === item._id;
                  return (
                    <KanbanCard
                      key={item._id}
                      cardId={item._id}
                      disabled={!canManageStatus || isBusy}
                      onClick={() => onOpenTicket(item)}
                      className={`rounded-lg border border-zinc-300 bg-white p-3 transition-all hover:border-zinc-400 ${
                        isBusy ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1 min-w-0">
                          {canManageStatus && (
                            <span className="text-zinc-400 mt-0.5 shrink-0" title="Drag to change status">
                              <DragIndicatorIcon sx={{ fontSize: 14 }} />
                            </span>
                          )}
                          <span className="text-xs font-bold text-zinc-950">{item.ticketNumber}</span>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(item.priority)}`}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <div className="mb-2 line-clamp-2 text-xs font-medium text-zinc-800">
                        {item.subject}
                      </div>
                      <div className="mb-2">
                        <SlaBadge ticket={item} />
                      </div>
                      <div className="mb-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">
                        <span>{item.requesterName || 'Requester'}</span>
                        <span className="font-medium text-zinc-700">
                          {displayUserLabel(item.assignedToName, item.assignedTo, 'Unassigned')}
                        </span>
                      </div>
                      {canManageStatus && (
                        <div
                          className="mt-2 flex flex-wrap gap-1"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {statuses
                            .filter(
                              (s) =>
                                s !== item.status &&
                                (!['Resolved', 'Closed'].includes(s) || canResolve)
                            )
                            .map((status) => (
                              <button
                                key={status}
                                type="button"
                                disabled={isBusy}
                                onClick={() => void onMoveStatus(item._id, status)}
                                className={`cursor-pointer rounded border-0 px-1.5 py-0.5 text-[10px] font-semibold disabled:opacity-50 ${statusBadgeClass(status)}`}
                              >
                                → {status}
                              </button>
                            ))}
                        </div>
                      )}
                    </KanbanCard>
                  );
                })
              )}
              <KanbanColumnDropHint columnId={colStatus} label={colStatus} />
            </div>
          </KanbanColumn>
        );
      })}
    </KanbanBoard>
  );
};
