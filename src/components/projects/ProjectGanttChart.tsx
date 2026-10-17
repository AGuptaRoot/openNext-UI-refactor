import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { displayUserLabel } from '../../utils/displayLabels';
import {
  AlertTriangle,
  Calendar,
  Check,
  ClipboardList,
  Eye,
  Flag,
  Hourglass,
  MapPin,
  Pause,
  X,
  type LucideIcon,
} from 'lucide-react';

import {
  ProjectItem,
  ProjectMilestone,
  ProjectTaskSummary,
} from '../../types/projects';

export interface ProjectGanttChartProps {
  project: ProjectItem;
  tasks: ProjectTaskSummary[];
  milestones: ProjectMilestone[];
  canTaskWrite: boolean;
  isReadOnly: boolean;
  onAddTask: () => void;
  onRefresh: () => void;
  onUpdateTaskDates: (taskId: string, startDate: string, dueDate: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export type GanttZoomScale = 'days' | 'weeks' | 'months';

interface DragState {
  barElement: HTMLElement;
  taskId: string;
  action: 'resize-left' | 'resize-right' | 'move';
  initialClientX: number;
  initialLeft: number;
  initialWidth: number;
  initialStartMs: number;
  initialEndMs: number;
  hasMoved: boolean;
  currentStartDate: Date;
  currentDueDate: Date;
}

const GANTT_STATUS_CONFIG: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    label: string;
    pillBg: string;
    pillText: string;
    pillBorder: string;
  }
> = {
  Completed: {
    bg: '#10b981',
    border: '#059669',
    text: '#ffffff',
    label: 'Completed',
    pillBg: '#ecfdf5',
    pillText: '#065f46',
    pillBorder: '#a7f3d0',
  },
  'In Progress': {
    bg: '#3b82f6',
    border: '#2563eb',
    text: '#ffffff',
    label: 'In Progress',
    pillBg: '#eff6ff',
    pillText: '#1e40af',
    pillBorder: '#bfdbfe',
  },
  Review: {
    bg: '#f59e0b',
    border: '#d97706',
    text: '#ffffff',
    label: 'In Review',
    pillBg: '#fffbeb',
    pillText: '#92400e',
    pillBorder: '#fde68a',
  },
  'To Do': {
    bg: '#6366f1',
    border: '#4f46e5',
    text: '#ffffff',
    label: 'To Do',
    pillBg: '#eef2ff',
    pillText: '#3730a3',
    pillBorder: '#c7d2fe',
  },
  'On Hold': {
    bg: '#f97316',
    border: '#ea580c',
    text: '#ffffff',
    label: 'On Hold',
    pillBg: '#fff7ed',
    pillText: '#9a3412',
    pillBorder: '#fed7aa',
  },
};

const GANTT_STATUS_ICONS: Record<string, LucideIcon> = {
  Completed: Check,
  'In Progress': Hourglass,
  Review: Eye,
  'To Do': ClipboardList,
  'On Hold': Pause,
};

function GanttBarStatusIcon({ status }: { status?: string }) {
  const Icon = GANTT_STATUS_ICONS[status || 'To Do'] ?? MapPin;
  return <Icon className="h-3.5 w-3.5 shrink-0 drop-shadow-xs" aria-hidden />;
}

function getStatusStyle(status?: string) {
  return (
    GANTT_STATUS_CONFIG[status || 'To Do'] || {
      bg: '#64748b',
      border: '#475569',
      text: '#ffffff',
      label: status || 'To Do',
      pillBg: '#f1f5f9',
      pillText: '#475569',
      pillBorder: '#cbd5e1',
    }
  );
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const ProjectGanttChart: React.FC<ProjectGanttChartProps> = ({
  project,
  tasks,
  milestones,
  canTaskWrite,
  isReadOnly,
  onAddTask,
  onRefresh,
  onUpdateTaskDates,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [milestoneFilter, setMilestoneFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomScale, setZoomScale] = useState<GanttZoomScale>('days');
  const [columnWidth, setColumnWidth] = useState<number>(55);
  const [sidebarWidth, setSidebarWidth] = useState<number>(340);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [groupByMilestone, setGroupByMilestone] = useState<boolean>(false);
  const [showHelpTip, setShowHelpTip] = useState<boolean>(true);

  // Dragging interaction state
  const [activeTooltip, setActiveTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const splitterRef = useRef<HTMLDivElement>(null);

  // Status task counts for pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      Completed: 0,
      'In Progress': 0,
      Review: 0,
      'To Do': 0,
      'On Hold': 0,
    };
    for (const t of tasks) {
      if (t.isArchived) continue;
      counts.all = (counts.all || 0) + 1;
      const st = t.status || 'To Do';
      counts[st] = (counts[st] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) => !t.isArchived);

    if (statusFilter) {
      list = list.filter((t) => (t.status || 'To Do') === statusFilter);
    }
    if (milestoneFilter) {
      if (milestoneFilter === 'none') {
        list = list.filter((t) => !t.milestoneId);
      } else {
        list = list.filter((t) => String(t.milestoneId) === String(milestoneFilter));
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.assigneeName || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [tasks, statusFilter, milestoneFilter, searchQuery]);

  // Today normalized
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Map task rows with resolved start/due dates and progress
  const taskRows = useMemo(() => {
    return filteredTasks.map((t) => {
      let start: Date;
      let end: Date;

      if (t.startDate && t.dueDate) {
        start = new Date(t.startDate);
        end = new Date(t.dueDate);
      } else if (t.startDate && !t.dueDate) {
        start = new Date(t.startDate);
        end = new Date(start.getTime() + 2 * 86400000);
      } else if (!t.startDate && t.dueDate) {
        end = new Date(t.dueDate);
        start = new Date(end.getTime() - 2 * 86400000);
      } else {
        const base = t.createdAt
          ? new Date(t.createdAt)
          : project.startDate
          ? new Date(project.startDate)
          : today;
        start = new Date(base);
        end = new Date(start.getTime() + 3 * 86400000);
      }

      if (isNaN(start.getTime())) start = new Date(today);
      if (isNaN(end.getTime())) end = new Date(start.getTime() + 3 * 86400000);

      if (end.getTime() < start.getTime()) {
        end = new Date(start.getTime() + 86400000);
      }

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const isCompleted = t.status === 'Completed';
      const isOverdue = !isCompleted && end.getTime() < today.getTime();
      const progress = isCompleted
        ? 100
        : t.status === 'In Progress'
        ? 50
        : t.status === 'Review'
        ? 80
        : 0;
      const style = getStatusStyle(t.status);

      const milestone = milestones.find((m) => String(m._id) === String(t.milestoneId));

      return {
        task: t,
        start,
        end,
        isCompleted,
        isOverdue,
        progress,
        style,
        milestoneTitle: milestone?.title || '',
      };
    });
  }, [filteredTasks, project.startDate, today, milestones]);

  // Group task rows if groupByMilestone is active
  const groupedTaskRows = useMemo(() => {
    if (!groupByMilestone) {
      return [{ key: 'all', title: '', rows: taskRows }];
    }

    const groups: Array<{ key: string; title: string; rows: typeof taskRows }> = [];
    const milestoneMap = new Map<string, typeof taskRows>();
    const noMilestoneRows: typeof taskRows = [];

    for (const row of taskRows) {
      if (row.task.milestoneId) {
        const mId = String(row.task.milestoneId);
        if (!milestoneMap.has(mId)) milestoneMap.set(mId, []);
        milestoneMap.get(mId)!.push(row);
      } else {
        noMilestoneRows.push(row);
      }
    }

    for (const m of milestones) {
      const rows = milestoneMap.get(String(m._id)) || [];
      if (rows.length > 0) {
        groups.push({
          key: m._id,
          title: m.title,
          rows,
        });
      }
    }

    if (noMilestoneRows.length > 0) {
      groups.push({
        key: 'general',
        title: 'General (No Milestone)',
        rows: noMilestoneRows,
      });
    }

    return groups;
  }, [groupByMilestone, taskRows, milestones]);

  // Flattened row list for timeline index mapping
  const flatDisplayRows = useMemo(() => {
    return groupedTaskRows.flatMap((g) => g.rows);
  }, [groupedTaskRows]);

  // Timeline bounds calculation
  const timelineBounds = useMemo(() => {
    let minTime = today.getTime();
    let maxTime = today.getTime() + 14 * 86400000;

    if (flatDisplayRows.length > 0) {
      minTime = Math.min(today.getTime(), ...flatDisplayRows.map((r) => r.start.getTime()));
      maxTime = Math.max(today.getTime(), ...flatDisplayRows.map((r) => r.end.getTime()));
    }

    if (project.startDate) {
      const pStart = new Date(project.startDate).getTime();
      if (!isNaN(pStart)) minTime = Math.min(minTime, pStart);
    }
    if (project.deadline) {
      const pEnd = new Date(project.deadline).getTime();
      if (!isNaN(pEnd)) maxTime = Math.max(maxTime, pEnd);
    }

    // Add padding days
    const start = new Date(minTime);
    start.setDate(start.getDate() - 4);
    start.setHours(0, 0, 0, 0);

    const end = new Date(maxTime);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    const totalDays = Math.max(14, Math.ceil((end.getTime() - start.getTime()) / 86400000));

    return {
      start,
      end,
      totalDays,
    };
  }, [today, flatDisplayRows, project.startDate, project.deadline]);

  // Effective day column width based on zoom scale & slider
  const effectiveDayWidth = useMemo(() => {
    if (zoomScale === 'weeks') {
      return Math.max(18, Math.round(columnWidth * 0.45));
    }
    if (zoomScale === 'months') {
      return Math.max(10, Math.round(columnWidth * 0.22));
    }
    return columnWidth;
  }, [zoomScale, columnWidth]);

  const totalTimelineWidth = timelineBounds.totalDays * effectiveDayWidth;

  // Calendar Day & Month structures
  const { days, monthSpans } = useMemo(() => {
    const dayList: Array<{
      date: Date;
      dayNum: number;
      dayName: string;
      isToday: boolean;
      isWeekend: boolean;
      index: number;
    }> = [];

    const spans: Array<{ label: string; daysCount: number }> = [];
    let currentKey = '';
    let currentSpan: { label: string; daysCount: number } | null = null;

    for (let i = 0; i < timelineBounds.totalDays; i++) {
      const d = new Date(timelineBounds.start.getTime() + i * 86400000);
      const monthKey = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const dayNum = d.getDate();
      const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      const isToday = d.getTime() === today.getTime();
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      dayList.push({ date: d, dayNum, dayName, isToday, isWeekend, index: i });

      if (monthKey !== currentKey) {
        if (currentSpan) spans.push(currentSpan);
        currentKey = monthKey;
        currentSpan = { label: monthKey, daysCount: 1 };
      } else if (currentSpan) {
        currentSpan.daysCount++;
      }
    }
    if (currentSpan) spans.push(currentSpan);

    return { days: dayList, monthSpans: spans };
  }, [timelineBounds.start, timelineBounds.totalDays, today]);

  // Today marker offset in pixels
  const todayLeftPx = useMemo(() => {
    const diffDays = (today.getTime() - timelineBounds.start.getTime()) / 86400000;
    const index = Math.max(0, Math.floor(diffDays));
    return index * effectiveDayWidth + effectiveDayWidth / 2;
  }, [today, timelineBounds.start, effectiveDayWidth]);

  // Auto-scroll timeline to Today on first render
  useEffect(() => {
    if (timelineScrollRef.current) {
      const scrollTo = Math.max(0, todayLeftPx - 260);
      timelineScrollRef.current.scrollLeft = scrollTo;
    }
  }, [todayLeftPx]);

  // Synchronize vertical scroll between left rows and right timeline
  const handleTimelineScroll = useCallback(() => {
    if (timelineScrollRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = timelineScrollRef.current.scrollTop;
    }
  }, []);

  // Splitter drag to resize left sidebar
  const handleSplitterPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onPointerMove = (moveEv: PointerEvent) => {
      const delta = moveEv.clientX - startX;
      const newWidth = Math.max(160, Math.min(540, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [sidebarWidth]);

  // Start dragging a Gantt bar or resize handle
  const handleBarPointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      row: typeof taskRows[0],
      action: 'resize-left' | 'resize-right' | 'move'
    ) => {
      if (e.button !== 0 || !canTaskWrite || isReadOnly) return;
      e.stopPropagation();
      e.preventDefault();

      const barElement = (e.currentTarget.closest('.gantt-interactive-bar') ||
        e.currentTarget) as HTMLElement;
      if (!barElement) return;

      const initialClientX = e.clientX;
      const initialLeft = parseFloat(barElement.style.left) || 0;
      const initialWidth = parseFloat(barElement.style.width) || effectiveDayWidth;
      const initialStartMs = row.start.getTime();
      const initialEndMs = row.end.getTime();

      const dragState: DragState = {
        barElement,
        taskId: row.task._id,
        action,
        initialClientX,
        initialLeft,
        initialWidth,
        initialStartMs,
        initialEndMs,
        hasMoved: false,
        currentStartDate: new Date(initialStartMs),
        currentDueDate: new Date(initialEndMs),
      };
      dragRef.current = dragState;

      document.body.style.cursor = action === 'move' ? 'grabbing' : 'ew-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEv: PointerEvent) => {
        if (!dragRef.current) return;
        const state = dragRef.current;
        state.hasMoved = true;
        const deltaX = moveEv.clientX - state.initialClientX;

        if (state.action === 'resize-left') {
          const candidateLeft = state.initialLeft + deltaX;
          const snappedLeft = Math.max(
            0,
            Math.round(candidateLeft / effectiveDayWidth) * effectiveDayWidth
          );
          const maxLeft = state.initialLeft + state.initialWidth - effectiveDayWidth;
          const clampedLeft = Math.min(snappedLeft, maxLeft);
          const clampedWidth = state.initialLeft + state.initialWidth - clampedLeft;

          state.barElement.style.left = `${clampedLeft}px`;
          state.barElement.style.width = `${clampedWidth}px`;

          const startOffsetDays = Math.round(clampedLeft / effectiveDayWidth);
          state.currentStartDate = new Date(
            timelineBounds.start.getTime() + startOffsetDays * 86400000
          );
          state.currentDueDate = new Date(state.initialEndMs);

          const durationDays = Math.max(1, Math.round(clampedWidth / effectiveDayWidth));
          setActiveTooltip({
            text: `↔ Start: ${formatDateShort(state.currentStartDate)} → Due: ${formatDateShort(
              state.currentDueDate
            )} (${durationDays}d)`,
            x: moveEv.clientX,
            y: moveEv.clientY - 42,
          });
        } else if (state.action === 'resize-right') {
          const candidateWidth = state.initialWidth + deltaX;
          const snappedWidth = Math.max(
            effectiveDayWidth,
            Math.round(candidateWidth / effectiveDayWidth) * effectiveDayWidth
          );

          state.barElement.style.width = `${snappedWidth}px`;

          const durationDays = Math.max(1, Math.round(snappedWidth / effectiveDayWidth));
          state.currentStartDate = new Date(state.initialStartMs);
          state.currentDueDate = new Date(
            state.initialStartMs + durationDays * 86400000 - 1000
          );

          setActiveTooltip({
            text: `↔ Start: ${formatDateShort(state.currentStartDate)} → Due: ${formatDateShort(
              state.currentDueDate
            )} (${durationDays}d)`,
            x: moveEv.clientX,
            y: moveEv.clientY - 42,
          });
        } else if (state.action === 'move') {
          const candidateLeft = state.initialLeft + deltaX;
          const snappedLeft = Math.max(
            0,
            Math.round(candidateLeft / effectiveDayWidth) * effectiveDayWidth
          );

          state.barElement.style.left = `${snappedLeft}px`;

          const startOffsetDays = Math.round(snappedLeft / effectiveDayWidth);
          const durationDays = Math.max(1, Math.round(state.initialWidth / effectiveDayWidth));
          state.currentStartDate = new Date(
            timelineBounds.start.getTime() + startOffsetDays * 86400000
          );
          state.currentDueDate = new Date(
            timelineBounds.start.getTime() + (startOffsetDays + durationDays) * 86400000 - 1000
          );

          setActiveTooltip({
            text: `Rescheduled: ${formatDateShort(
              state.currentStartDate
            )} → ${formatDateShort(state.currentDueDate)} (${durationDays}d)`,
            x: moveEv.clientX,
            y: moveEv.clientY - 42,
          });
        }
      };

      const onPointerUp = async () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setActiveTooltip(null);

        const currentDrag = dragRef.current;
        dragRef.current = null;

        if (!currentDrag) return;

        if (currentDrag.hasMoved) {
          const newStartStr = currentDrag.currentStartDate.toISOString().slice(0, 10);
          const newDueStr = currentDrag.currentDueDate.toISOString().slice(0, 10);

          try {
            await onUpdateTaskDates(currentDrag.taskId, newStartStr, newDueStr);
          } catch {
            // Error handled by parent toast
          }
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [canTaskWrite, isReadOnly, effectiveDayWidth, timelineBounds.start, onUpdateTaskDates]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Top Control Toolbar ────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-300 rounded-xl p-4 flex flex-col gap-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <CalendarMonthIcon sx={{ fontSize: 20 }} className="text-zinc-700" />
              Project Schedule & Gantt Chart
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
              {flatDisplayRows.length} {flatDisplayRows.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canTaskWrite && !isReadOnly && (
              <button
                type="button"
                onClick={onAddTask}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer hover:bg-zinc-800 transition-colors"
              >
                <AddIcon sx={{ fontSize: 16 }} />
                Add Task
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors"
              title="Refresh schedule"
            >
              <RefreshIcon sx={{ fontSize: 15 }} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                sidebarCollapsed
                  ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
              title="Toggle task sidebar list"
            >
              <ViewSidebarOutlinedIcon sx={{ fontSize: 15 }} />
              {sidebarCollapsed ? 'Show Task List' : 'Hide Task List'}
            </button>

            <button
              type="button"
              onClick={() => setGroupByMilestone(!groupByMilestone)}
              className={`inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                groupByMilestone
                  ? 'border-zinc-950 bg-zinc-950 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
              title="Group tasks under milestones"
            >
              <LayersOutlinedIcon sx={{ fontSize: 15 }} />
              {groupByMilestone ? 'Grouped by Milestone' : 'Flat Task List'}
            </button>
          </div>
        </div>

        {/* ─── Second Row: Filters, Search, Zoom & Slider ────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={`h-7 px-3 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                statusFilter === ''
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              All ({statusCounts.all || 0})
            </button>

            {(['Completed', 'In Progress', 'Review', 'To Do', 'On Hold'] as const).map((st) => {
              const cfg = GANTT_STATUS_CONFIG[st];
              const count = statusCounts[st] || 0;
              const isActive = statusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(isActive ? '' : st)}
                  className={`h-7 px-2.5 text-xs font-semibold rounded-full border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                      : 'hover:opacity-90'
                  }`}
                  style={{
                    backgroundColor: isActive ? '#09090b' : cfg.pillBg,
                    color: isActive ? '#ffffff' : cfg.pillText,
                    borderColor: isActive ? '#09090b' : cfg.pillBorder,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: cfg.bg }}
                  />
                  <span>{cfg.label}</span>
                  <span className="opacity-75 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Right Controls: Milestone filter, search, zoom, stretch slider */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Milestone select */}
            <select
              value={milestoneFilter}
              onChange={(e) => setMilestoneFilter(e.target.value)}
              className="h-8 px-2.5 text-xs font-medium border border-zinc-300 rounded-lg bg-white outline-none focus:border-zinc-400 text-zinc-800 cursor-pointer"
            >
              <option value="">All Milestones</option>
              <option value="none">General (No Milestone)</option>
              {milestones.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title}
                </option>
              ))}
            </select>

            {/* Quick search */}
            <div className="relative">
              <SearchIcon
                sx={{ fontSize: 16 }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tasks..."
                className="h-8 pl-8 pr-2.5 text-xs border border-zinc-300 rounded-lg bg-white outline-none focus:border-zinc-400 w-36 sm:w-44"
              />
            </div>

            {/* Zoom scale tabs */}
            <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
              {(['days', 'weeks', 'months'] as GanttZoomScale[]).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomScale(z)}
                  className={`h-7 px-2.5 text-[11px] font-semibold rounded-md border-0 cursor-pointer capitalize transition-all ${
                    zoomScale === z
                      ? 'bg-zinc-950 text-white shadow-xs'
                      : 'bg-transparent text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            {/* Stretch slider */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-semibold text-zinc-500">Width:</span>
              <input
                type="range"
                min={24}
                max={140}
                value={columnWidth}
                onChange={(e) => setColumnWidth(Number(e.target.value))}
                className="w-16 sm:w-20 accent-zinc-900 cursor-ew-resize"
                title="Stretch or compress timeline column widths"
              />
              <span className="text-[11px] font-bold text-zinc-800 w-8 text-right">
                {columnWidth}px
              </span>
            </div>
          </div>
        </div>

        {/* Informative Tip Banner */}
        {showHelpTip && (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <HelpOutlineIcon sx={{ fontSize: 16 }} className="text-zinc-500 shrink-0" />
              <span>
                <strong>Worksuite Gantt Mode:</strong> Hover on any task bar edge{' '}
                <strong>(↔)</strong> to stretch start & due dates, or drag the center to move the
                schedule. Drag the vertical divider to resize the task sidebar.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpTip(false)}
              className="text-zinc-400 hover:text-zinc-700 text-xs font-bold border-0 bg-transparent cursor-pointer"
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* ─── Main Gantt Workspace ───────────────────────────────────────── */}
      <div className="bg-white border border-zinc-300 rounded-xl overflow-hidden shadow-xs">
        {flatDisplayRows.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <Calendar className="h-10 w-10 shrink-0 text-zinc-400 mx-auto mb-3" aria-hidden />
            <h3 className="text-base font-bold text-zinc-900 m-0 mb-1">
              No tasks found for current filter
            </h3>
            <p className="text-xs text-zinc-500 m-0 mb-4 max-w-md mx-auto">
              Try changing the status filter, milestone selection, search query, or add a new task
              to the project schedule.
            </p>
            {canTaskWrite && !isReadOnly && (
              <button
                type="button"
                onClick={onAddTask}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer hover:bg-zinc-800"
              >
                <AddIcon sx={{ fontSize: 15 }} />
                Create Task
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-[620px] max-h-[75vh] overflow-hidden select-none">
            {/* ─── Left Sidebar: Task List ──────────────────────────────── */}
            {!sidebarCollapsed && (
              <div
                style={{ width: `${sidebarWidth}px` }}
                className="shrink-0 flex flex-col border-r border-zinc-200 bg-white z-10 relative overflow-hidden"
              >
                {/* Left Panel Header */}
                <div className="h-[74px] border-b border-zinc-200 bg-zinc-50 px-3.5 flex items-center justify-between shrink-0">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Tasks ({flatDisplayRows.length})
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {project.name || 'Project Schedule'}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-500">Status & Due</span>
                </div>

                {/* Left Panel Rows */}
                <div
                  ref={leftPanelRef}
                  className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-zinc-100"
                >
                  {groupedTaskRows.map((group) => (
                    <React.Fragment key={group.key}>
                      {groupByMilestone && group.title && (
                        <div className="bg-zinc-100/80 px-3 py-1.5 text-[11px] font-bold text-zinc-700 border-b border-zinc-200 flex items-center justify-between sticky top-0 z-10">
                          <span className="flex items-center gap-1.5 truncate">
                            <FlagOutlinedIcon sx={{ fontSize: 13 }} className="text-zinc-500" />
                            {group.title}
                          </span>
                          <span className="text-[10px] font-medium text-zinc-500 shrink-0">
                            {group.rows.length} {group.rows.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      )}

                      {group.rows.map((row) => (
                        <div
                          key={row.task._id}
                          className="h-14 px-3 flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: row.style.bg }}
                              />
                              <Link
                                to={`/tasks/${row.task._id}`}
                                className="text-xs font-bold text-zinc-900 truncate hover:underline no-underline block"
                                title={row.task.title}
                              >
                                {row.task.title}
                              </Link>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                              <span className="flex items-center gap-0.5 truncate">
                                <PersonOutlineIcon sx={{ fontSize: 13 }} className="text-zinc-400" />
                                {displayUserLabel(row.task.assigneeName, row.task.assigneeId, 'Unassigned')}
                              </span>
                              {row.milestoneTitle && (
                                <span className="inline-flex items-center gap-0.5 text-zinc-400 truncate">
                                  ·
                                  <Flag className="h-3 w-3 shrink-0" aria-hidden />
                                  {row.milestoneTitle}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block"
                              style={{
                                backgroundColor: row.style.pillBg,
                                color: row.style.pillText,
                                borderColor: row.style.pillBorder,
                              }}
                            >
                              {row.style.label}
                            </span>
                            <div
                              className={`text-[10px] font-medium mt-0.5 ${
                                row.isOverdue ? 'text-red-600 font-bold' : 'text-zinc-500'
                              }`}
                            >
                              {row.task.dueDate
                                ? formatDateShort(new Date(row.task.dueDate))
                                : 'No due date'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Draggable Splitter Divider ──────────────────────────── */}
            {!sidebarCollapsed && (
              <div
                ref={splitterRef}
                onPointerDown={handleSplitterPointerDown}
                className="w-1.5 bg-zinc-200 hover:bg-zinc-400 active:bg-zinc-600 cursor-col-resize z-20 shrink-0 transition-colors"
                title="Drag left or right to resize task list"
              />
            )}

            {/* ─── Right Panel: Interactive Gantt Timeline ─────────────── */}
            <div
              ref={timelineScrollRef}
              onScroll={handleTimelineScroll}
              className="flex-1 overflow-auto relative bg-white"
            >
              <div
                style={{ width: `${totalTimelineWidth}px` }}
                className="relative min-h-full pb-6"
              >
                {/* Sticky Header: Months & Days */}
                <div className="sticky top-0 z-30 bg-white border-b border-zinc-200 shadow-2xs">
                  {/* Month Spans Header */}
                  <div className="flex h-9 bg-zinc-50 border-b border-zinc-200">
                    {monthSpans.map((m, idx) => (
                      <div
                        key={idx}
                        style={{ width: `${m.daysCount * effectiveDayWidth}px` }}
                        className="px-3 flex items-center text-xs font-bold text-zinc-700 uppercase tracking-wider border-r border-zinc-200 truncate shrink-0"
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>

                  {/* Day Columns Header */}
                  <div className="flex h-9 bg-white">
                    {days.map((d) => (
                      <div
                        key={d.index}
                        style={{ width: `${effectiveDayWidth}px` }}
                        className={`shrink-0 text-center py-1 border-r border-zinc-100 flex flex-col justify-center leading-tight ${
                          d.isToday
                            ? 'bg-blue-50 text-blue-700 font-extrabold'
                            : d.isWeekend
                            ? 'bg-zinc-50/80 text-zinc-400'
                            : 'text-zinc-600'
                        }`}
                      >
                        <span className="text-[11px] font-bold">{d.dayNum}</span>
                        {zoomScale !== 'months' && (
                          <span className="text-[9px] font-semibold opacity-70">
                            {d.dayName}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Today Vertical Line Marker */}
                <div
                  style={{ left: `${todayLeftPx}px` }}
                  className="absolute top-[72px] bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                >
                  <div className="sticky top-[76px] -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    Today
                  </div>
                </div>

                {/* Vertical Background Grid Columns */}
                <div className="absolute top-[72px] bottom-0 left-0 right-0 flex pointer-events-none z-0">
                  {days.map((d) => (
                    <div
                      key={d.index}
                      style={{ width: `${effectiveDayWidth}px` }}
                      className={`shrink-0 border-r border-zinc-100 ${
                        d.isToday
                          ? 'bg-blue-50/30'
                          : d.isWeekend
                          ? 'bg-zinc-50/50'
                          : 'transparent'
                      }`}
                    />
                  ))}
                </div>

                {/* Timeline Task Bars Container */}
                <div className="relative z-10">
                  {groupedTaskRows.map((group) => (
                    <React.Fragment key={group.key}>
                      {groupByMilestone && group.title && (
                        <div className="h-7 bg-zinc-100/60 border-b border-zinc-200 px-3 flex items-center text-[10px] font-semibold text-zinc-500 sticky left-0">
                          <span className="inline-flex items-center gap-1">
                            <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {group.title} ({group.rows.length})
                          </span>
                        </div>
                      )}

                      {group.rows.map((row) => {
                        const startOffsetDays =
                          (row.start.getTime() - timelineBounds.start.getTime()) / 86400000;
                        const durationDays = Math.max(
                          1,
                          (row.end.getTime() - row.start.getTime()) / 86400000
                        );
                        const barLeft = Math.max(0, startOffsetDays * effectiveDayWidth);
                        const barWidth = Math.max(
                          effectiveDayWidth,
                          durationDays * effectiveDayWidth
                        );

                        return (
                          <div
                            key={row.task._id}
                            className="h-14 border-b border-zinc-100 relative flex items-center hover:bg-zinc-50/30 transition-colors"
                          >
                            {/* Gantt Bar */}
                            <div
                              data-task-id={row.task._id}
                              className="gantt-interactive-bar absolute h-9 rounded-lg shadow-xs flex items-center overflow-visible select-none transition-shadow hover:shadow-md group/bar"
                              style={{
                                left: `${barLeft}px`,
                                width: `${barWidth}px`,
                                backgroundColor: row.style.bg,
                                border: `1.5px solid ${row.style.border}`,
                                zIndex: 5,
                              }}
                            >
                              {/* Left Resize Handle (Start Date) */}
                              {canTaskWrite && !isReadOnly && (
                                <div
                                  onPointerDown={(e) =>
                                    handleBarPointerDown(e, row, 'resize-left')
                                  }
                                  className="absolute -left-1 top-0 bottom-0 w-3 cursor-ew-resize z-20 flex items-center justify-center bg-black/10 hover:bg-black/30 rounded-l-md transition-colors"
                                  title="Drag to stretch start date"
                                >
                                  <div className="w-0.5 h-3.5 bg-white/90 rounded-xs" />
                                </div>
                              )}

                              {/* Progress Fill Underlay */}
                              <div
                                style={{ width: `${row.progress}%` }}
                                className="absolute top-0 bottom-0 left-0 bg-white/25 rounded-l-md pointer-events-none"
                              />

                              {/* Center Bar Content & Move Handle */}
                              <div
                                onPointerDown={(e) =>
                                  canTaskWrite && !isReadOnly
                                    ? handleBarPointerDown(e, row, 'move')
                                    : undefined
                                }
                                className={`w-full h-full px-2.5 flex items-center gap-1.5 text-white text-xs font-bold truncate z-10 ${
                                  canTaskWrite && !isReadOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                }`}
                                title={`${row.task.title}\nStatus: ${row.task.status}\nStart: ${formatDateShort(
                                  row.start
                                )}\nDue: ${formatDateShort(row.end)}\nProgress: ${row.progress}%`}
                              >
                                <GanttBarStatusIcon status={row.task.status} />
                                <span className="truncate drop-shadow-xs">{row.task.title}</span>
                                <span className="text-[10px] font-extrabold opacity-90 ml-auto shrink-0 drop-shadow-xs">
                                  {row.progress}%
                                </span>
                              </div>

                              {/* Right Resize Handle (Due Date) */}
                              {canTaskWrite && !isReadOnly && (
                                <div
                                  onPointerDown={(e) =>
                                    handleBarPointerDown(e, row, 'resize-right')
                                  }
                                  className="absolute -right-1 top-0 bottom-0 w-3 cursor-ew-resize z-20 flex items-center justify-center bg-black/10 hover:bg-black/30 rounded-r-md transition-colors"
                                  title="Drag to stretch due date"
                                >
                                  <div className="w-0.5 h-3.5 bg-white/90 rounded-xs" />
                                </div>
                              )}

                              {/* Overdue Warning Pill */}
                              {row.isOverdue && (
                                <div className="absolute -right-22 top-1/2 -translate-y-1/2 bg-red-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-xs pointer-events-none flex items-center gap-1 whitespace-nowrap z-20">
                                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                                  OVERDUE
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Floating Drag Tooltip */}
      {activeTooltip && (
        <div
          style={{ left: `${activeTooltip.x}px`, top: `${activeTooltip.y}px` }}
          className="fixed z-50 -translate-x-1/2 bg-zinc-950 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg border border-zinc-800 pointer-events-none whitespace-nowrap"
        >
          {activeTooltip.text}
        </div>
      )}
    </div>
  );
};
