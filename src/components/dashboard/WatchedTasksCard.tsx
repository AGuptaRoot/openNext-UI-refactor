import React from 'react';
import { useNavigate } from 'react-router-dom';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { TaskItem } from '../../types/dashboard';
import { dashboardListPath } from '../../utils/dashboardNavigation';

interface WatchedTasksCardProps {
  tasks: TaskItem[];
  openCount: number;
  overdueCount: number;
  onNavigateUnmigrated: (moduleName: string) => void;
}

function taskIdOf(task: TaskItem): string {
  return String(task._id || task.id || '').trim();
}

export const WatchedTasksCard: React.FC<WatchedTasksCardProps> = ({
  tasks,
  openCount,
  overdueCount,
  onNavigateUnmigrated: _onNavigateUnmigrated,
}) => {
  void _onNavigateUnmigrated;
  const navigate = useNavigate();

  if (tasks.length === 0 && openCount === 0) return null;

  return (
    <div className="bg-white border border-zinc-300 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center flex-shrink-0">
            <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-950 m-0">
              Watched Tasks & Deliverables ({openCount})
            </h3>
            <p className="text-xs text-zinc-500 m-0 mt-0.5">
              Deliverables you are actively monitoring as a watcher.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/tasks?watching=true&due=overdue')}
              className="text-[10px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-red-600 cursor-pointer"
              title="View overdue watched tasks"
            >
              {overdueCount} Overdue
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(dashboardListPath('tasksWatching'))}
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
          >
            <span>All Watched</span>
            <ArrowForwardIcon sx={{ fontSize: 13 }} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.slice(0, 4).map((task, idx) => {
          const id = taskIdOf(task);
          return (
            <div
              key={id || task.title || idx}
              onClick={() =>
                id
                  ? navigate(`/tasks/${encodeURIComponent(id)}`)
                  : navigate(dashboardListPath('tasksWatching'))
              }
              className="p-3 rounded-lg border border-zinc-300 bg-white hover:border-zinc-950 hover:bg-zinc-50/70 flex items-center justify-between cursor-pointer transition-all duration-150"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-950">{task.title}</div>
                {task.projectName && (
                  <span className="text-[11px] text-zinc-500 block">{task.projectName}</span>
                )}
              </div>

              <span className="text-[10.5px] font-medium px-2 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-zinc-900">
                {task.status || 'Active'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
