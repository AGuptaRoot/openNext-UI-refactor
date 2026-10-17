import React, { useMemo, useState } from 'react';
import { Check, Clock, Siren, Tag } from 'lucide-react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

import { LeadItem, AssignableUser, leadNeedsSampleRequest } from '../../types/leads';
import { isLeadConvertibleStage } from '../../utils/leadPipeline';
import { displayUserLabel } from '../../utils/displayLabels';
import { getLeadStatusChipClass } from '../../utils/leadStatusStyle';
import { KanbanBoard, KanbanCard, KanbanColumn, KanbanColumnDropHint } from '../dndkit';
import { formatCrmMoney, getRuntimeDefaultCurrency } from '../../utils/currency';

export interface LeadKanbanViewProps {
  leads: LeadItem[];
  pipelineStages: string[];
  leadStatuses?: string[];
  assignableUsers: AssignableUser[];
  onViewLead: (lead: LeadItem) => void;
  onMoveStage: (leadId: string, newStage: string) => Promise<void>;
  onUpdateStatus?: (leadId: string, newStatus: string) => Promise<void>;
  onConvertLead: (lead: LeadItem) => void;
  canWrite?: boolean;
  canConvert?: boolean;
}

const getStatusBadgeStyle = getLeadStatusChipClass;

type LeadCardBodyProps = {
  lead: LeadItem;
  stages: string[];
  stageIdx: number;
  pipelineStages: string[];
  leadStatuses: string[];
  assignableUsers: AssignableUser[];
  canWrite: boolean;
  canConvert: boolean;
  canDrag: boolean;
  isMoving: boolean;
  onShift: (lead: LeadItem, direction: 'prev' | 'next') => void;
  onStageSelect: (lead: LeadItem, newStage: string) => void;
  onUpdateStatus?: (leadId: string, newStatus: string) => Promise<void>;
  onViewLead: (lead: LeadItem) => void;
  onConvertLead: (lead: LeadItem) => void;
  setMovingLeadId: (id: string | null) => void;
  compact?: boolean;
};

function LeadCardBody({
  lead,
  stages,
  stageIdx,
  pipelineStages,
  leadStatuses,
  assignableUsers,
  canWrite,
  canConvert,
  canDrag,
  isMoving,
  onShift,
  onStageSelect,
  onUpdateStatus,
  onViewLead,
  onConvertLead,
  setMovingLeadId,
  compact = false,
}: LeadCardBodyProps) {
  const repUser = assignableUsers.find(
    (u) => u.id === lead.assignedTo || u.username === lead.assignedUsername
  );
  const repName = displayUserLabel(
    repUser || lead.assignedToName,
    lead.assignedUsername || lead.assignedTo,
    'Unassigned'
  );
  const repInitials =
    repUser?.initials ||
    repName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ||
    '?';

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          {canDrag && (
            <span
              className="text-zinc-400 hover:text-zinc-700 flex-shrink-0 mt-0.5 cursor-grab"
              title="Drag to change stage"
            >
              <DragIndicatorIcon sx={{ fontSize: 14 }} />
            </span>
          )}
          <div className="w-7 h-7 rounded-md bg-zinc-950 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 overflow-hidden mt-0.5">
            {lead.photoUrl || lead.avatarUrl ? (
              <img
                src={lead.photoUrl || lead.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (sibling) sibling.style.display = 'flex';
                }}
              />
            ) : null}
            <span
              className="w-full h-full items-center justify-center"
              style={{ display: lead.photoUrl || lead.avatarUrl ? 'none' : 'flex' }}
            >
              {(lead.name || 'L').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-bold text-zinc-950 hover:underline m-0 leading-snug truncate">
                {lead.title?.trim() || lead.name}
              </h5>
              {lead.status && (
                <span
                  className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded border ${getStatusBadgeStyle(
                    lead.status
                  )}`}
                >
                  {lead.status}
                </span>
              )}
              {lead.convertedClientId && (
                <span className="text-[9.5px] font-semibold text-white bg-zinc-950 border border-zinc-950 px-1.5 py-0.2 rounded">
                  <span className="inline-flex items-center gap-0.5">
                    <Check className="h-3 w-3 shrink-0" aria-hidden /> Converted
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 m-0 mt-0.5 font-medium truncate">
              {lead.title?.trim() && lead.name ? `${lead.name} · ` : ''}
              {lead.company || '—'}
            </p>
            {leadNeedsSampleRequest(lead) ? (
              <span
                className="crm-badge crm-badge-warning mt-1"
                title="Lead needs sample request"
              >
                Sample needs
              </span>
            ) : null}
          </div>
        </div>
        <span className="text-[11px] font-mono font-bold text-zinc-900 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded flex-shrink-0">
          {formatCrmMoney(lead.value, lead.currency || getRuntimeDefaultCurrency())}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
        {lead.source && (
          <span className="text-zinc-600 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
            {lead.source}
          </span>
        )}
        {lead.ageing && (
          <span className="text-zinc-700 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-3 w-3 shrink-0" aria-hidden /> {lead.ageing.stageAgeDays}d
            </span>
          </span>
        )}
        {lead.followUpSummary?.hasOverdue && (
          <span className="text-red-700 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
            <span className="inline-flex items-center gap-0.5">
              <Siren className="h-3 w-3 shrink-0" aria-hidden /> Overdue {lead.followUpSummary.overdueDays}d
            </span>
          </span>
        )}
        {lead.tags && lead.tags.length > 0 && (
          <span className="text-zinc-600 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
            <span className="inline-flex items-center gap-0.5">
              <Tag className="h-3 w-3 shrink-0" aria-hidden /> {lead.tags[0]}
            </span>
            {lead.tags.length > 1 && ` +${lead.tags.length - 1}`}
          </span>
        )}
      </div>

      {!compact && (
        <div
          className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2"
          data-no-drag="true"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {lead.assignedTo ? (
            <div className="flex items-center gap-1.5 min-w-0" title={`Assigned to: ${repName}`}>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: repUser?.bgColor || '#09090b' }}
              >
                {repInitials}
              </div>
              <span className="text-[11px] text-zinc-600 truncate max-w-[85px]">{repName}</span>
            </div>
          ) : (
            <span
              className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
              title="This lead is not assigned"
            >
              Unassigned
            </span>
          )}

          <div className="flex items-center gap-1 flex-shrink-0" data-no-drag="true">
            {canWrite && (
              <>
                <button
                  type="button"
                  disabled={stageIdx === 0 || isMoving}
                  onClick={() => onShift(lead, 'prev')}
                  title="Move to previous stage"
                  className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-white text-zinc-700 cursor-pointer transition-colors"
                >
                  <ChevronLeftIcon sx={{ fontSize: 13 }} />
                </button>

                <select
                  value={lead.stage}
                  onChange={(e) => onStageSelect(lead, e.target.value)}
                  title="Quick switch stage"
                  className="text-[10px] border border-zinc-200 rounded px-1 py-0.5 bg-white text-zinc-900 outline-none cursor-pointer"
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {onUpdateStatus && leadStatuses.length > 0 && (
                  <select
                    value={lead.status || ''}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      if (!newStatus || newStatus === lead.status) return;
                      setMovingLeadId(lead._id);
                      try {
                        await onUpdateStatus(lead._id, newStatus);
                      } finally {
                        setMovingLeadId(null);
                      }
                    }}
                    title="Update lead status"
                    className="text-[10px] font-medium border border-zinc-200 rounded px-1 py-0.5 bg-white text-zinc-800 outline-none cursor-pointer hover:border-zinc-400"
                  >
                    <option value="" disabled>
                      Status…
                    </option>
                    {leadStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  disabled={stageIdx === stages.length - 1 || isMoving}
                  onClick={() => onShift(lead, 'next')}
                  title="Move to next stage"
                  className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-white text-zinc-700 cursor-pointer transition-colors"
                >
                  <ChevronRightIcon sx={{ fontSize: 13 }} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => onViewLead(lead)}
              title="View lead details"
              className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 cursor-pointer transition-colors"
            >
              <VisibilityOutlinedIcon sx={{ fontSize: 13 }} />
            </button>

            {!lead.convertedClientId &&
              canConvert &&
              isLeadConvertibleStage(lead.stage, pipelineStages) && (
                <button
                  type="button"
                  onClick={() => onConvertLead(lead)}
                  title="Convert to client"
                  className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-950 hover:text-white text-zinc-700 cursor-pointer transition-colors"
                >
                  <CheckCircleOutlineIcon sx={{ fontSize: 13 }} />
                </button>
              )}
          </div>
        </div>
      )}
    </>
  );
}

export const LeadKanbanView: React.FC<LeadKanbanViewProps> = ({
  leads,
  pipelineStages,
  leadStatuses = [],
  assignableUsers,
  onViewLead,
  onMoveStage,
  onUpdateStatus,
  onConvertLead,
  canWrite = false,
  canConvert = false,
}) => {
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);

  const stages = useMemo(() => {
    return pipelineStages.length > 0
      ? pipelineStages
      : ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'];
  }, [pipelineStages]);

  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadItem[]> = {};
    for (const stage of stages) {
      map[stage] = [];
    }
    for (const lead of leads) {
      const s = lead.stage || stages[0];
      if (!map[s]) map[s] = [];
      map[s].push(lead);
    }
    return map;
  }, [leads, stages]);

  const columns = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const stage of stages) {
      map[stage] = (leadsByStage[stage] || []).map((lead) => lead._id);
    }
    return map;
  }, [stages, leadsByStage]);

  const leadsById = useMemo(() => {
    const map: Record<string, LeadItem> = {};
    for (const lead of leads) {
      map[lead._id] = lead;
    }
    return map;
  }, [leads]);

  const handleShift = async (lead: LeadItem, direction: 'prev' | 'next') => {
    if (!canWrite) return;
    const currentIndex = stages.indexOf(lead.stage);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const targetStage = stages[targetIndex];
    setMovingLeadId(lead._id);
    try {
      await onMoveStage(lead._id, targetStage);
    } finally {
      setMovingLeadId(null);
    }
  };

  const handleStageSelect = async (lead: LeadItem, newStage: string) => {
    if (!canWrite) return;
    if (newStage === lead.stage) return;
    setMovingLeadId(lead._id);
    try {
      await onMoveStage(lead._id, newStage);
    } finally {
      setMovingLeadId(null);
    }
  };

  const handleMoveCard = async (cardId: string, _fromColumnId: string, toColumnId: string) => {
    if (!canWrite) return;
    const lead = leadsById[cardId];
    if (!lead || lead.convertedClientId) return;
    if (lead.stage === toColumnId) return;
    setMovingLeadId(cardId);
    try {
      await onMoveStage(cardId, toColumnId);
    } finally {
      setMovingLeadId(null);
    }
  };

  return (
    <KanbanBoard
      columns={columns}
      onMoveCard={handleMoveCard}
      disabled={!canWrite}
      className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[600px] select-none"
      data-tour="leads-kanban-board"
      renderOverlay={(cardId) => {
        const lead = leadsById[cardId];
        if (!lead) return null;
        const stageIdx = Math.max(0, stages.indexOf(lead.stage || stages[0]));
        return (
          <div className="w-80 bg-white border-2 border-zinc-950 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-2xl rotate-1 scale-[1.02]">
            <LeadCardBody
              lead={lead}
              stages={stages}
              stageIdx={stageIdx}
              pipelineStages={pipelineStages}
              leadStatuses={leadStatuses}
              assignableUsers={assignableUsers}
              canWrite={false}
              canConvert={false}
              canDrag
              isMoving={false}
              onShift={() => undefined}
              onStageSelect={() => undefined}
              onViewLead={() => undefined}
              onConvertLead={() => undefined}
              setMovingLeadId={() => undefined}
              compact
            />
            <p className="mb-0 text-[10px] font-semibold text-zinc-500">Drop on a stage column to move</p>
          </div>
        );
      }}
    >
      {stages.map((stage, stageIdx) => {
        const columnLeads = leadsByStage[stage] || [];
        const totalValue = columnLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);

        return (
          <KanbanColumn
            key={stage}
            columnId={stage}
            {...(stageIdx === 0 ? { 'data-tour': 'leads-kanban-column' } : {})}
            className="flex-shrink-0 w-80 rounded-xl flex flex-col max-h-[85vh] transition-all duration-150 border data-[kanban-over=true]:bg-zinc-100/90 data-[kanban-over=true]:border-zinc-950 data-[kanban-over=true]:ring-2 data-[kanban-over=true]:ring-zinc-950/20 bg-zinc-50 border-zinc-200"
          >
            <div className="p-3.5 border-b rounded-t-xl sticky top-0 z-10 border-zinc-200 bg-white data-[kanban-over=true]:border-zinc-300 data-[kanban-over=true]:bg-zinc-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-zinc-950 tracking-tight uppercase m-0">
                    {stage}
                  </h4>
                  <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                    {columnLeads.length}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-zinc-600">
                  {formatCrmMoney(totalValue)}
                </span>
              </div>
            </div>

            <div className="p-2.5 flex flex-col gap-2.5 overflow-y-auto flex-1 min-h-[160px]">
              {columnLeads.length === 0 ? (
                <div
                  {...(stageIdx === 0 ? { 'data-tour': 'leads-kanban-card' } : {})}
                  className="py-8 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-lg pointer-events-none"
                >
                  No deals in {stage}
                </div>
              ) : (
                columnLeads.map((lead) => {
                  const isMoving = movingLeadId === lead._id;
                  const canDrag = canWrite && !lead.convertedClientId && !isMoving;

                  return (
                    <KanbanCard
                      key={lead._id}
                      cardId={lead._id}
                      disabled={!canDrag}
                      {...(stageIdx === 0 && columnLeads[0]?._id === lead._id
                        ? { 'data-tour': 'leads-kanban-card' }
                        : {})}
                      onClick={() => {
                        if (isMoving) return;
                        onViewLead(lead);
                      }}
                      className={`bg-white border rounded-xl p-3.5 flex flex-col gap-2.5 transition-all duration-150 relative select-none border-zinc-200 hover:border-zinc-950 ${
                        isMoving ? 'opacity-50 pointer-events-none' : ''
                      } ${canDrag ? '' : 'cursor-pointer'}`}
                    >
                      <LeadCardBody
                        lead={lead}
                        stages={stages}
                        stageIdx={stageIdx}
                        pipelineStages={pipelineStages}
                        leadStatuses={leadStatuses}
                        assignableUsers={assignableUsers}
                        canWrite={canWrite}
                        canConvert={canConvert}
                        canDrag={canDrag}
                        isMoving={isMoving}
                        onShift={handleShift}
                        onStageSelect={handleStageSelect}
                        onUpdateStatus={onUpdateStatus}
                        onViewLead={onViewLead}
                        onConvertLead={onConvertLead}
                        setMovingLeadId={setMovingLeadId}
                      />
                    </KanbanCard>
                  );
                })
              )}

              <KanbanColumnDropHint columnId={stage} label={stage} />
            </div>
          </KanbanColumn>
        );
      })}
    </KanbanBoard>
  );
};
