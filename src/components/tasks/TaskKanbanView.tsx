import React, { useMemo } from 'react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { TaskItem, TASK_STATUSES, TaskPriority } from '../../types/tasks';
import { displayUserLabel } from '../../utils/displayLabels';
import { KanbanBoard, KanbanCard, KanbanColumn, KanbanColumnDropHint } from '../dndkit';

export type TaskKanbanViewProps = {
  tasks: TaskItem[];
  statuses?: readonly string[];
  canWrite?: boolean;
  reminderHours?: number;
  onOpenTask: (task: TaskItem) => void;
  onMoveStatus: (taskId: string, nextStatus: string) => void | Promise<void>;
  onResendReminder?: (taskId: string, title: string) => void | Promise<void>;
};

function priorityBadge(priority: TaskPriority) {
  const p = String(priority || '').toLowerCase();
  if (p === 'urgent') {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">
        Urgent
      </span>
    );
  }
  if (p === 'high') {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        High
      </span>
    );
  }
  if (p === 'medium') {
    return (
      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
        Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
      Low
    </span>
  );
}

function clientReviewBadge(status?: string, notes?: string) {
  const s = status || 'Pending Review';
  if (s === 'Satisfied') {
    return (
      <span
        title={notes || 'Client satisfied'}
        className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
      >
        Satisfied
      </span>
    );
  }
  if (s === 'Dissatisfied') {
    return (
      <span
        title={notes || 'Client dissatisfied'}
        className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800"
      >
        Not Satisfied
      </span>
    );
  }
  if (s === 'Not Replied') {
    return (
      <span
        title={notes || 'Awaiting client reply'}
        className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
      >
        Awaiting Reply
      </span>
    );
  }
  return (
    <span
      title={notes || 'Pending review'}
      className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600"
    >
      Pending Review
    </span>
  );
}

/**
 * Tasks status board — drag cards between columns with @dnd-kit.
 */
export const TaskKanbanView: React.FC<TaskKanbanViewProps> = ({
  tasks,
  statuses = TASK_STATUSES,
  canWrite = false,
  reminderHours = 24,
  onOpenTask,
  onMoveStatus,
  onResendReminder,
}) => {
  const columns = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const status of statuses) map[status] = [];
    for (const task of tasks) {
      const key = task.status || 'To Do';
      if (!map[key]) map[key] = [];
      map[key].push(task._id);
    }
    return map;
  }, [tasks, statuses]);

  const byId = useMemo(() => {
    const map: Record<string, TaskItem> = {};
    for (const task of tasks) map[task._id] = task;
    return map;
  }, [tasks]);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    for (const status of statuses) map[status] = [];
    for (const task of tasks) {
      const key = task.status || 'To Do';
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks, statuses]);

  const renderEmailBadge = (t: TaskItem) => {
    if (!t) return null;
    if (t.clientNotifiedAt) {
      const hoursAgo = Math.max(
        0,
        (Date.now() - new Date(t.clientNotifiedAt).getTime()) / (1000 * 60 * 60)
      );
      const hasClientReplied = t.clientFeedbackStatus === 'Satisfied';
      const isOverThreshold = hoursAgo >= reminderHours;
      if (!hasClientReplied && isOverThreshold && onResendReminder) {
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void onResendReminder(t._id, t.title);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex cursor-pointer items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
          >
            Resend ({reminderHours}h+)
          </button>
        );
      }
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          Sent
        </span>
      );
    }
    if (t.notifyClientOnCompletion) {
      return (
        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
          Auto-Email
        </span>
      );
    }
    return null;
  };

  return (
    <KanbanBoard
      columns={columns}
      disabled={!canWrite}
      onMoveCard={async (cardId, _from, toStatus) => {
        const task = byId[cardId];
        if (!task || task.status === toStatus) return;
        await onMoveStatus(cardId, toStatus);
      }}
      className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4"
      data-tour="tasks-kanban"
      renderOverlay={(cardId) => {
        const task = byId[cardId];
        if (!task) return null;
        return (
          <div className="w-64 rounded-lg border-2 border-zinc-950 bg-white p-3 shadow-2xl rotate-1">
            <div className="text-xs font-bold text-zinc-950 line-clamp-2">{task.title}</div>
            <p className="mb-0 mt-2 text-[10px] font-semibold text-zinc-500">
              Drop on a status column to move
            </p>
          </div>
        );
      }}
    >
      {statuses.map((colStatus) => {
        const columnTasks = tasksByStatus[colStatus] || [];
        return (
          <KanbanColumn
            key={colStatus}
            columnId={colStatus}
            className="rounded-xl border border-zinc-200 bg-zinc-50/50 flex flex-col min-h-[480px] data-[kanban-over=true]:border-zinc-950 data-[kanban-over=true]:ring-2 data-[kanban-over=true]:ring-zinc-950/15"
          >
            <div className="p-3 border-b border-zinc-200 bg-white rounded-t-xl flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900">{colStatus}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-600">
                {columnTasks.length}
              </span>
            </div>
            <div className="p-2.5 flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-280px)]">
              {columnTasks.map((task, idx) => {
                const isOverdue =
                  Boolean(task.dueDate) &&
                  new Date(task.dueDate!) < new Date() &&
                  task.status !== 'Completed';
                const subDone = task.subtasksCompletedCount || 0;
                const subTotal = task.subtaskCount || 0;
                const subPct = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;

                return (
                  <KanbanCard
                    key={task._id}
                    cardId={task._id}
                    disabled={!canWrite}
                    {...(idx === 0 && colStatus === statuses[0]
                      ? { 'data-tour': 'tasks-kanban-card-first' }
                      : {})}
                    onClick={() => onOpenTask(task)}
                    className="p-3 bg-white border border-zinc-300 rounded-lg shadow-none hover:border-zinc-400 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-1 min-w-0 flex-1">
                        {canWrite && (
                          <span className="text-zinc-400 mt-0.5 shrink-0" title="Drag to change status">
                            <DragIndicatorIcon sx={{ fontSize: 14 }} />
                          </span>
                        )}
                        <span className="text-xs font-bold text-zinc-950 line-clamp-2 hover:underline">
                          {task.title}
                        </span>
                      </div>
                      {priorityBadge(task.priority)}
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-1">
                      {task.projectName && (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                          {task.projectName}
                        </span>
                      )}
                      {task.milestoneTitle && (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                          {task.milestoneTitle}
                        </span>
                      )}
                    </div>

                    {subTotal > 0 && (
                      <div className="mb-2.5 p-2 rounded bg-zinc-50 border border-zinc-200">
                        <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
                          <span>
                            Subtasks ({subDone}/{subTotal})
                          </span>
                          <strong className={subDone === subTotal ? 'text-emerald-600' : 'text-blue-600'}>
                            {subPct}%
                          </strong>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${subDone === subTotal ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${subPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div
                      className="mb-2 flex flex-wrap items-center gap-1"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {clientReviewBadge(task.clientFeedbackStatus, task.clientFeedbackNotes)}
                      {renderEmailBadge(task)}
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">
                      <span className="font-medium text-zinc-700">
                        {displayUserLabel(
                          task.assigneeName || task.assignedUsername,
                          task.assignedUsername || task.assignedTo,
                          'Unassigned'
                        )}
                      </span>
                      {task.dueDate && (
                        <span
                          className={`font-medium ${
                            isOverdue ? 'font-semibold text-red-600' : 'text-zinc-500'
                          }`}
                        >
                          {new Date(task.dueDate).toLocaleDateString()}
                          {isOverdue ? ' · Overdue' : ''}
                        </span>
                      )}
                    </div>
                  </KanbanCard>
                );
              })}

              {columnTasks.length === 0 && (
                <div className="py-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
                  Drop tasks here
                </div>
              )}
              <KanbanColumnDropHint columnId={colStatus} label={colStatus} />
            </div>
          </KanbanColumn>
        );
      })}
    </KanbanBoard>
  );
};
