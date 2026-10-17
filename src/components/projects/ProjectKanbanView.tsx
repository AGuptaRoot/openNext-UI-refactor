import React, { useMemo } from 'react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { ProjectItem, priorityBadgeClass } from '../../types/projects';
import { KanbanBoard, KanbanCard, KanbanColumn, KanbanColumnDropHint } from '../dndkit';
import { Archive } from 'lucide-react';

export type ProjectKanbanViewProps = {
  projects: ProjectItem[];
  statuses: string[];
  canWrite?: boolean;
  onOpenProject: (project: ProjectItem) => void;
  onMoveStatus: (project: ProjectItem, nextStatus: string) => void | Promise<void>;
};

function isOverdue(p: ProjectItem) {
  if (!p.deadline || p.status === 'Completed' || p.status === 'Cancelled' || p.isDropped) {
    return false;
  }
  return p.deadline < new Date().toISOString().slice(0, 10);
}

/**
 * Projects status board — drag cards between columns with @dnd-kit.
 */
export const ProjectKanbanView: React.FC<ProjectKanbanViewProps> = ({
  projects,
  statuses,
  canWrite = false,
  onOpenProject,
  onMoveStatus,
}) => {
  const columns = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const status of statuses) map[status] = [];
    for (const project of projects) {
      const key = project.status || statuses[0];
      if (!map[key]) map[key] = [];
      map[key].push(project._id);
    }
    return map;
  }, [projects, statuses]);

  const byId = useMemo(() => {
    const map: Record<string, ProjectItem> = {};
    for (const project of projects) map[project._id] = project;
    return map;
  }, [projects]);

  const projectsByStatus = useMemo(() => {
    const map: Record<string, ProjectItem[]> = {};
    for (const status of statuses) map[status] = [];
    for (const project of projects) {
      const key = project.status || statuses[0];
      if (!map[key]) map[key] = [];
      map[key].push(project);
    }
    return map;
  }, [projects, statuses]);

  return (
    <KanbanBoard
      columns={columns}
      disabled={!canWrite}
      onMoveCard={async (cardId, _from, toStatus) => {
        const project = byId[cardId];
        if (!project || project.status === toStatus) return;
        await onMoveStatus(project, toStatus);
      }}
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 overflow-x-auto"
      data-tour="projects-kanban"
      renderOverlay={(cardId) => {
        const p = byId[cardId];
        if (!p) return null;
        return (
          <div className="w-56 border-2 border-zinc-950 rounded-lg p-3 bg-white shadow-2xl rotate-1">
            <div className="text-sm font-semibold text-zinc-950">{p.name}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{p.clientName || '—'}</div>
            <p className="mb-0 mt-2 text-[10px] font-semibold text-zinc-500">
              Drop on a status column to move
            </p>
          </div>
        );
      }}
    >
      {statuses.map((status) => {
        const columnItems = projectsByStatus[status] || [];
        return (
          <KanbanColumn
            key={status}
            columnId={status}
            className="bg-white border border-zinc-300 rounded-xl min-w-[220px] flex flex-col data-[kanban-over=true]:border-zinc-950 data-[kanban-over=true]:ring-2 data-[kanban-over=true]:ring-zinc-950/15"
          >
            <div className="px-3 py-2.5 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-950">{status}</span>
              <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                {columnItems.length}
              </span>
            </div>
            <div className="p-2 flex flex-col gap-2 min-h-[120px]">
              {columnItems.map((p) => (
                <KanbanCard
                  key={p._id}
                  cardId={p._id}
                  disabled={!canWrite}
                  onClick={() => onOpenProject(p)}
                  className="border border-zinc-200 rounded-lg p-3 hover:bg-zinc-50/80 bg-white"
                >
                  <div className="flex items-start gap-1.5">
                    {canWrite && (
                      <span className="text-zinc-400 mt-0.5 shrink-0" title="Drag to change status">
                        <DragIndicatorIcon sx={{ fontSize: 14 }} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-zinc-950">{p.name}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">{p.clientName || '—'}</div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityBadgeClass(p.priority)}`}
                        >
                          {p.priority}
                        </span>
                        {isOverdue(p) && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">
                            Overdue
                          </span>
                        )}
                        {p.isArchived && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
                            <span className="inline-flex items-center gap-0.5">
                              <Archive className="h-3 w-3 shrink-0" aria-hidden />
                              Archived
                            </span>
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500">
                          {p.completedTaskCount || 0}/{p.taskCount || 0} tasks
                        </span>
                      </div>
                    </div>
                  </div>
                </KanbanCard>
              ))}
              {columnItems.length === 0 && (
                <div className="text-[11px] text-zinc-400 text-center py-6 border border-dashed border-zinc-200 rounded-lg">
                  No projects
                </div>
              )}
              <KanbanColumnDropHint columnId={status} label={status} />
            </div>
          </KanbanColumn>
        );
      })}
    </KanbanBoard>
  );
};
