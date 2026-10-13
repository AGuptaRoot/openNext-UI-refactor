import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
import { TaskItem } from '../../types/dashboard';
import { dashboardListPath } from '../../utils/dashboardNavigation';

interface BlockedTasksCardProps {
  tasks: TaskItem[];
  onNavigateUnmigrated: (moduleName: string) => void;
  onTasksChanged?: () => void;
}

export const BlockedTasksCard: React.FC<BlockedTasksCardProps> = ({
  tasks,
  onNavigateUnmigrated,
  onTasksChanged,
}) => {
  const navigate = useNavigate();
  const { isClient, hasPermission } = useAuth();
  const { alert } = useDialog();
  const [busyId, setBusyId] = useState('');
  const canRemind = hasPermission('crm.tasks.write') && !isClient;

  if (tasks.length === 0) return null;

  const openTask = (task: TaskItem) => {
    const id = task._id || task.id;
    if (id) {
      navigate(`/tasks/${id}`);
      return;
    }
    onNavigateUnmigrated('Tasks');
  };

  const submitFeedback = async (task: TaskItem, status: 'Satisfied' | 'Dissatisfied') => {
    const id = task._id || task.id;
    if (!id || !isClient) return;
    setBusyId(id);
    try {
      await crmApi.updateTask(id, {
        clientFeedbackStatus: status,
        clientSatisfied: status === 'Satisfied',
      });
      onTasksChanged?.();
    } catch (reason) {
      await alert(reason instanceof Error ? reason.message : 'Failed to submit feedback');
    } finally {
      setBusyId('');
    }
  };

  const resendReminder = async (task: TaskItem) => {
    const id = task._id || task.id;
    if (!id || !canRemind) return;
    setBusyId(id);
    try {
      const res = await crmApi.sendTaskReminderEmail(id);
      await alert(res.message || 'Client review reminder sent.');
    } catch (reason) {
      await alert(reason instanceof Error ? reason.message : 'Failed to send reminder');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="bg-white border border-zinc-300 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center flex-shrink-0">
            <HourglassEmptyIcon sx={{ fontSize: 18 }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 m-0">
              {isClient
                ? `Deliverable review required (${tasks.length})`
                : `Tasks blocked awaiting client reply (${tasks.length})`}
            </h3>
            <p className="text-xs text-zinc-500 m-0 mt-0.5">
              {isClient
                ? 'Mark each completed deliverable Satisfied or Not Satisfied to unblock dependent work.'
                : 'Completed deliverables waiting for client review. Resend a reminder or open the task.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(dashboardListPath('tasksBlockedClient'))}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-900 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-150"
        >
          <span>View all</span>
          <ArrowForwardIcon sx={{ fontSize: 13 }} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.slice(0, 6).map((task, idx) => {
          const id = task._id || task.id || String(idx);
          const busy = busyId === id;
          return (
            <div
              key={id}
              className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <button
                type="button"
                onClick={() => openTask(task)}
                className="text-left bg-transparent border-0 p-0 cursor-pointer min-w-0"
              >
                <div className="text-xs font-semibold text-zinc-950 hover:underline">
                  {task.title}
                </div>
                {task.projectName && (
                  <span className="text-[11px] text-zinc-500 block mt-0.5">
                    Project: {task.projectName}
                  </span>
                )}
                {task.dependsOnTitle && (
                  <span className="text-[11px] text-amber-800 block mt-0.5">
                    Blocks work depending on this deliverable
                    {task.dependsOnTitle ? ` · ${task.dependsOnTitle}` : ''}
                  </span>
                )}
              </button>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {isClient ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => submitFeedback(task, 'Satisfied')}
                      className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                      Satisfied
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => submitFeedback(task, 'Dissatisfied')}
                      className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold rounded-lg border border-red-300 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
                    >
                      <CancelOutlinedIcon sx={{ fontSize: 14 }} />
                      Not Satisfied
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-white text-zinc-700">
                      Awaiting reply
                    </span>
                    {canRemind && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => resendReminder(task)}
                        className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold rounded-lg border border-amber-300 bg-white text-amber-900 cursor-pointer disabled:opacity-50"
                      >
                        <EmailOutlinedIcon sx={{ fontSize: 14 }} />
                        Resend email
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
