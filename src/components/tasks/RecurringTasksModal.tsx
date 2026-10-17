import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import { Calendar, RefreshCw, Zap } from 'lucide-react';

import { crmApi } from '../../services/api';
import { TaskItem } from '../../types/tasks';
import { displayLabel, displayUserLabel } from '../../utils/displayLabels';

export interface RecurringTasksModalProps {
  open: boolean;
  onClose: () => void;
  onOpenCreateRecurring: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const RecurringTasksModal: React.FC<RecurringTasksModalProps> = ({
  open,
  onClose,
  onOpenCreateRecurring,
  showToast,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadRecurring = async () => {
    setLoading(true);
    try {
      const res = await crmApi.listTasks({ isRecurring: true, isArchived: 'all' });
      setTasks(res.data || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load recurring tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadRecurring();
    }
  }, [open]);

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = tasks.filter((t) => !t.isArchived);
    const dueNow = tasks.filter((t) => t.recurringNextDate && t.recurringNextDate <= today);
    const totalCycles = tasks.reduce((sum, t) => sum + (t.recurringCyclesCompleted || 0), 0);
    return {
      total: tasks.length,
      active: active.length,
      dueNow: dueNow.length,
      totalCycles,
    };
  }, [tasks]);

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const res = await crmApi.processRecurringTasks();
      showToast(res.data?.message || 'Recurring tasks processed successfully');
      await loadRecurring();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to process recurring tasks', 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:px-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="h-[18px] w-[18px] shrink-0 text-zinc-700" aria-hidden />
            <div>
              <h2 className="text-base font-bold text-zinc-950 m-0">Recurring Tasks &amp; Schedules</h2>
              <p className="m-0 mt-0.5 text-xs text-zinc-500">
                Automated recurring delivery schedules, frequencies, and generation controls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProcessNow}
              disabled={processing}
              className="h-8 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-none disabled:opacity-50 transition-colors"
            >
              <PlayArrowIcon sx={{ fontSize: 14 }} />
              {processing ? (
                <span>Processing…</span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Zap className="h-4 w-4 shrink-0" aria-hidden />
                  Run Due Now
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenCreateRecurring}
              className="h-8 px-3 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <AddIcon sx={{ fontSize: 15 }} />
              <span>+ New Schedule</span>
            </button>

            <button
              type="button"
              onClick={() => void loadRecurring()}
              className="h-8 w-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
              title="Refresh"
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer bg-white"
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-zinc-300 bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Active Schedules
              </span>
              <div className="text-2xl font-extrabold text-zinc-950 mt-1">{kpis.active}</div>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                kpis.dueNow > 0
                  ? 'border-amber-300 bg-amber-50/50'
                  : 'border-zinc-200 bg-white'
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  kpis.dueNow > 0 ? 'text-amber-800' : 'text-zinc-500'
                }`}
              >
                Due to Generate Now
              </span>
              <div
                className={`text-2xl font-extrabold mt-1 ${
                  kpis.dueNow > 0 ? 'text-amber-700' : 'text-zinc-950'
                }`}
              >
                {kpis.dueNow}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-300 bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Total Cycles Completed
              </span>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">{kpis.totalCycles}</div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-16 text-center text-xs text-zinc-500 animate-pulse">
              Loading recurring task schedules…
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-zinc-200 rounded-xl">
              <p className="text-sm font-semibold text-zinc-900 m-0 mb-1">
                No recurring task schedules configured
              </p>
              <p className="text-xs text-zinc-500 m-0 mb-4">
                Automate periodic deliverables (e.g. monthly security scans, weekly reports).
              </p>
              <button
                type="button"
                onClick={onOpenCreateRecurring}
                className="px-4 py-2 rounded-lg bg-zinc-950 text-white text-xs font-semibold cursor-pointer border-none"
              >
                + Create First Recurring Schedule
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-semibold text-[10px]">
                      <th className="px-4 py-3">Task Deliverable</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Frequency</th>
                      <th className="px-4 py-3">Next Generation</th>
                      <th className="px-4 py-3">Cycles</th>
                      <th className="px-4 py-3">Assignee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {tasks.map((task) => {
                      const today = new Date().toISOString().slice(0, 10);
                      const isDue = task.recurringNextDate && task.recurringNextDate <= today;
                      const every = task.recurringEvery || task.every || 1;
                      const interval = task.recurringInterval || task.interval || 'month';
                      const cyclesCompleted = task.recurringCyclesCompleted || 0;
                      const totalCycles =
                        task.recurringTotalCycles !== undefined
                          ? task.recurringTotalCycles === 0
                            ? '∞'
                            : task.recurringTotalCycles
                          : '∞';

                      return (
                        <tr key={task._id} className="hover:bg-zinc-50/80">
                          <td className="px-4 py-3">
                            <Link
                              to={`/tasks/${task._id}`}
                              onClick={onClose}
                              className="font-bold text-zinc-950 no-underline hover:underline block"
                            >
                              {task.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {displayLabel(task.projectName)}
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-800">
                            Every {every} {interval}
                            {every > 1 ? 's' : ''}
                          </td>
                          <td className="px-4 py-3">
                            {task.recurringNextDate ? (
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${
                                  isDue ? 'text-amber-700 font-bold' : 'text-zinc-700'
                                }`}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                                  {task.recurringNextDate}
                                </span>
                                {isDue && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Due Now
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-700 font-mono">
                            {cyclesCompleted} / {totalCycles}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {displayUserLabel(task.assigneeName || task.assignedUsername, task.assignedUsername || task.assignedTo, 'Unassigned')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default RecurringTasksModal;
