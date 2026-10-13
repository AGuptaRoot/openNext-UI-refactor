import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { DashboardData, TaskItem } from '../../types/dashboard';
import { dashboardListPath } from '../../utils/dashboardNavigation';

interface MyTasksCardProps {
  data: DashboardData;
  onNavigateUnmigrated: (moduleName: string) => void;
}

function taskIdOf(task: TaskItem): string {
  return String(task._id || task.id || '').trim();
}

export const MyTasksCard: React.FC<MyTasksCardProps> = ({
  data,
  onNavigateUnmigrated,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');

  const allTasks: TaskItem[] = [
    ...(data.overdueTasksList || []),
    ...(data.watchedTasksList || []),
    ...(data.blockedAwaitingClientTasks || []),
  ];

  const uniqueTasks = allTasks.filter(
    (task, index, self) =>
      index ===
      self.findIndex(
        (t) =>
          (taskIdOf(t) && taskIdOf(t) === taskIdOf(task)) || t.title === task.title
      )
  );

  const overdueList = data.overdueTasksList || [];

  const filteredTasks = uniqueTasks.filter((t) => {
    if (activeTab === 'overdue') {
      return t.status === 'overdue' || overdueList.some((o) => o.title === t.title);
    }
    if (activeTab === 'today') return true;
    if (activeTab === 'upcoming') return t.status !== 'completed' && t.status !== 'overdue';
    return true;
  });

  const displayTasks =
    filteredTasks.length > 0 ? filteredTasks.slice(0, 5) : overdueList.slice(0, 5);

  const openTask = (task: TaskItem) => {
    const id = taskIdOf(task);
    if (id) {
      navigate(`/tasks/${encodeURIComponent(id)}`);
      return;
    }
    onNavigateUnmigrated('Tasks');
  };

  const getPriorityClasses = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'text-red-600 bg-zinc-100 border-zinc-200';
      case 'high':
        return 'text-amber-600 bg-zinc-100 border-zinc-200';
      case 'low':
        return 'text-zinc-500 bg-zinc-100 border-zinc-200';
      case 'medium':
      default:
        return 'text-zinc-900 bg-zinc-100 border-zinc-200';
    }
  };

  return (
    <div
      data-tour="dashboard-my-tasks"
      className="bg-white border border-zinc-300 rounded-xl p-6 flex-1 flex flex-col justify-between"
    >
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-950 m-0 leading-tight">
              My Tasks Work Queue
            </h3>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              Deliverables and assigned milestones requiring attention.
            </p>
          </div>

          <div className="bg-zinc-100 p-1 rounded-lg border border-zinc-200 flex items-center">
            {(['all', 'overdue', 'today', 'upcoming'] as const).map((tabKey) => {
              const isActive = activeTab === tabKey;
              const label =
                tabKey === 'all'
                  ? 'All'
                  : tabKey === 'overdue'
                    ? `Overdue (${overdueList.length})`
                    : tabKey === 'today'
                      ? 'Today'
                      : 'Upcoming';

              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveTab(tabKey)}
                  className={`text-[11.5px] px-2.5 py-1 rounded-md border-none cursor-pointer transition-colors duration-150 ${
                    isActive
                      ? 'bg-zinc-950 text-white font-semibold'
                      : 'bg-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {displayTasks.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircleOutlineIcon className="text-emerald-600 mb-2" sx={{ fontSize: 36 }} />
            <p className="text-xs text-zinc-500 m-0">
              No tasks pending for this filter. All deliverables completed.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayTasks.map((task, idx) => {
              const priorityClass = getPriorityClasses(task.priority);
              const isOverdue =
                task.status === 'overdue' ||
                overdueList.some((o) => o.title === task.title);

              return (
                <div
                  key={taskIdOf(task) || task.title || idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => openTask(task)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openTask(task);
                    }
                  }}
                  className="p-3 rounded-lg border border-zinc-300 bg-white hover:border-zinc-950 hover:bg-zinc-50/70 cursor-pointer flex items-center justify-between gap-3 transition-all duration-150"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RadioButtonUncheckedIcon
                      sx={{ fontSize: 17, color: '#71717a' }}
                      className="flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-950 truncate">
                        {task.title}
                      </div>
                      <span className="text-[11px] text-zinc-500 block">
                        {task.projectName ? `${task.projectName} • ` : ''}
                        Due{' '}
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString()
                          : 'Today'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${priorityClass}`}
                    >
                      {task.priority || 'Medium'}
                    </span>
                    {isOverdue && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-red-600">
                        Overdue
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 mt-6 border-t border-zinc-200">
        <span className="text-xs text-zinc-500">
          Showing {displayTasks.length} of {uniqueTasks.length} total deliverables
        </span>
        <button
          type="button"
          onClick={() => {
            if (activeTab === 'overdue') navigate(dashboardListPath('tasksOverdue'));
            else if (activeTab === 'today') navigate(dashboardListPath('tasksDueToday'));
            else navigate(dashboardListPath('tasksOpen'));
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
        >
          <span>View All Tasks</span>
          <ArrowForwardIcon sx={{ fontSize: 13 }} />
        </button>
      </div>
    </div>
  );
};
