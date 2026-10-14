import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';

import { useAuth } from '../../context/AuthContext';
import { displayUserLabel } from '../../utils/displayLabels';
import { formatCrmMoney, getRuntimeDefaultCurrency } from '../../utils/currency';
import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { useTimer } from '../../context/TimerContext';
import {
  TaskComment,
  TaskItem,
  TaskSubtask,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_CLIENT_STATUSES,
  TaskPriority,
} from '../../types/tasks';
import { TimeLogItem } from '../../types/timeLogs';
import { ProjectItem, ProjectMember, ProjectMilestone, ProjectTaskSummary } from '../../types/projects';
import { AssignableUser, LeadAuditEntry } from '../../types/leads';
import { buildProjectAssigneeOptions } from '../../utils/projectAssigneeOptions';
import { canFullyManageTasks } from '../../utils/permissions';

const fieldClass =
  'h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 text-zinc-800';

type TabId = 'overview' | 'subtasks' | 'time' | 'discussion' | 'emails' | 'history';

type ReminderIntervalType = 'hours' | 'days' | 'weeks' | 'months';

const REMINDER_EMAIL_ACTIONS = new Set(['reminder_sent', 'auto_reminder_sent', 'notification_sent']);

const REMINDER_PRESETS: Array<{
  id: string;
  label: string;
  type: ReminderIntervalType;
  value: number;
  hint: string;
}> = [
  { id: '24h', label: 'Every 24 hours', type: 'hours', value: 24, hint: 'Once a day' },
  { id: 'week', label: 'Once a week', type: 'weeks', value: 1, hint: 'Weekly reminder' },
  { id: 'month', label: 'Once a month', type: 'months', value: 1, hint: 'Monthly reminder' },
];

function formatReminderScheduleSummary(
  enabled: boolean,
  type: ReminderIntervalType,
  value: number | null | undefined
): string {
  if (!enabled || !value || value < 1) return 'Using workspace default (Settings)';
  if (type === 'hours' && value === 1) return 'Every 1 hour';
  if (type === 'hours') return `Every ${value} hours`;
  if (type === 'days') return value === 1 ? 'Every day' : `Every ${value} days`;
  if (type === 'weeks') return value === 1 ? 'Once a week' : `Every ${value} weeks`;
  if (type === 'months') return value === 1 ? 'Once a month' : `Every ${value} months`;
  return `Every ${value} ${type}`;
}

export const TaskDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isClient, activeRole } = useAuth();
  const canWrite = hasPermission('crm.tasks.write') && !isClient;
  const canManageTasks = canFullyManageTasks({
    hasTaskWrite: canWrite,
    isClient,
    activeRole,
  });
  const canDelete = hasPermission('crm.tasks.delete') && !isClient && canManageTasks;
  const canLogTime = hasPermission('crm.time.write') && !isClient;

  const btnSecondary =
    'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50';

  const btnIcon =
    'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors';

  // Task data
  const [task, setTask] = useState<TaskItem | null>(null);
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskSummary[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  // Tab contents
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogItem[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [auditLogs, setAuditLogs] = useState<LeadAuditEntry[]>([]);

  useEffect(() => {
    const onTourTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (
        tab === 'overview' ||
        tab === 'subtasks' ||
        tab === 'time' ||
        tab === 'discussion' ||
        tab === 'emails' ||
        tab === 'history'
      ) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('crm-tasks-tour-tab', onTourTab as EventListener);
    return () => window.removeEventListener('crm-tasks-tour-tab', onTourTab as EventListener);
  }, []);

  // Assignee options: project team members only (API enforces the same rule)
  const assigneeOptions = useMemo(() => {
    return buildProjectAssigneeOptions({
      members: projectMembers,
      project,
      users: assignableUsers,
      ensureUserIds: [
        task?.assignedTo,
        ...(subtasks || []).map((s) => s.assignedTo),
      ],
    });
  }, [projectMembers, project, assignableUsers, task?.assignedTo, subtasks]);

  // Per-task automatic reminder schedule
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderType, setReminderType] = useState<ReminderIntervalType>('hours');
  const [reminderValue, setReminderValue] = useState(24);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Global Active Timer integration
  const {
    activeTimer,
    elapsedSecs,
    formatTimerSeconds,
    startTimer,
    openCheckoutModal,
  } = useTimer();
  const { confirm } = useDialog();

  const isCurrentTaskActive = Boolean(
    activeTimer && (activeTimer.taskId === id || String(activeTimer.taskId) === String(id))
  );
  const activeCheckIn = isCurrentTaskActive ? activeTimer : null;

  // Modals and Drafts state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('General');

  const [draft, setDraft] = useState<Partial<TaskItem>>({});

  // Subtask Form state
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');
  const [subtaskAssignee, setSubtaskAssignee] = useState('');
  const [subtaskDescription, setSubtaskDescription] = useState('');
  const [showSubtaskFormDetails, setShowSubtaskFormDetails] = useState(false);

  // Discussion & Watchers state
  const [commentBody, setCommentBody] = useState('');
  const [selectedNewWatcher, setSelectedNewWatcher] = useState('');

  // Manual Time Log Form state
  const [manualHours, setManualHours] = useState('1');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualRate, setManualRate] = useState('50');
  const [manualBillable, setManualBillable] = useState(true);
  const [manualNote, setManualNote] = useState('');

  // Page state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load main task data
  const loadTaskData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [taskRes, subRes, timeRes, commRes, auditRes, usersRes] = await Promise.all([
        crmApi.getTask(id),
        crmApi.getTaskSubtasks(id).catch(() => ({ data: [] })),
        crmApi.listTimeLogs({ taskId: id }).catch(() => ({ data: [] })),
        crmApi.getTaskComments(id).catch(() => ({ data: [] })),
        crmApi.getAuditByRecord('task', id).catch(() => ({ data: [] })),
        crmApi.getAssignableUsers().catch(() => ({ data: [] })),
      ]);

      const t = taskRes.data;
      setTask(t);
      setDraft(t);
      setSubtasks(subRes.data || []);
      setTimeLogs(timeRes.data || []);
      setComments(commRes.data || []);
      setAuditLogs(auditRes.data || []);
      setAssignableUsers(usersRes.data || []);
      setReminderEnabled(Boolean(t.reminderScheduleEnabled));
      setReminderType((t.reminderIntervalType as ReminderIntervalType) || 'hours');
      setReminderValue(Number(t.reminderIntervalValue) > 0 ? Number(t.reminderIntervalValue) : 24);

      // Load associated project data
      if (t.projectId) {
        try {
          const [pRes, mRes, msRes, ptRes] = await Promise.all([
            crmApi.getProject(t.projectId).catch(() => null),
            crmApi.getProjectMembers(t.projectId).catch(() => ({ data: [] })),
            crmApi.getProjectMilestones(t.projectId).catch(() => ({ data: [] })),
            crmApi.getProjectTasks(t.projectId).catch(() => ({ data: [] })),
          ]);
          if (pRes?.data) setProject(pRes.data);
          setProjectMembers(mRes?.data || []);
          setProjectMilestones(msRes?.data || []);
          setProjectTasks(ptRes?.data || []);
        } catch {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task details');
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTaskData();
  }, [loadTaskData]);

  // Listen for global timer changed events (refresh logged sessions when checkout occurs)
  useEffect(() => {
    const onTimerChanged = () => {
      crmApi.listTimeLogs({ taskId: id }).then((res) => {
        setTimeLogs(res.data || []);
      }).catch(() => {});
    };
    window.addEventListener('crm:timer-changed', onTimerChanged);
    return () => {
      window.removeEventListener('crm:timer-changed', onTimerChanged);
    };
  }, [id]);

  // Format Currency
  const currency = project?.currency || 'INR';
  const formatMoney = (val: number) => {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹';
    return `${symbol}${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 4 Executive Metrics Calculations
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((s) => s.done).length;
  const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const emailEvents = useMemo(() => {
    return (auditLogs || [])
      .filter((entry) => REMINDER_EMAIL_ACTIONS.has(String(entry.action || '')))
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [auditLogs]);

  const calculatedTotalHours = useMemo(() => {
    return timeLogs.reduce((sum, tl) => sum + (Number(tl.hours) || 0), 0);
  }, [timeLogs]);

  const calculatedBillableHours = useMemo(() => {
    return timeLogs
      .filter((tl) => tl.isBillable !== false)
      .reduce((sum, tl) => sum + (Number(tl.hours) || 0), 0);
  }, [timeLogs]);

  const calculatedBillableAmount = useMemo(() => {
    return timeLogs
      .filter((tl) => tl.isBillable !== false)
      .reduce((sum, tl) => {
        const h = Number(tl.hours) || 0;
        const rate = Number(tl.hourlyRate) || 50;
        return sum + (Number(tl.billableAmount) || h * rate);
      }, 0);
  }, [timeLogs]);

  // Handle Timer Start & Stop (Check In starts timer; Check Out prompts note form modal)
  const handleToggleTimer = async () => {
    if (!task || isClient || !canLogTime) return;
    if (activeCheckIn) {
      // Open Note form modal for checkout
      openCheckoutModal();
      return;
    }
    // Another task already has a running timer — open checkout instead of failing with 409
    if (activeTimer && !isCurrentTaskActive) {
      showToast(
        `Timer is already running on "${activeTimer.taskTitle || 'another task'}". Check out first.`,
        'error'
      );
      openCheckoutModal();
      return;
    }
    setSaving(true);
    try {
      await startTimer({
        taskId: task._id,
        projectId: task.projectId,
        taskTitle: task.title,
      });
      showToast('Timer started and active in navigation bar');
      const refreshed = await crmApi.listTimeLogs({ taskId: id });
      setTimeLogs(refreshed.data || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Timer action failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save quick task property edits
  const handleSaveProperties = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task || !canManageTasks) return;
    setSaving(true);
    try {
      const updated = await crmApi.updateTask(task._id, {
        title: draft.title?.trim() || task.title,
        status: draft.status || task.status,
        priority: draft.priority || task.priority,
        dueDate: draft.dueDate,
        startDate: draft.startDate,
        milestoneId: draft.milestoneId !== undefined ? draft.milestoneId : task.milestoneId,
        dependsOnTaskId: draft.dependsOnTaskId !== undefined ? draft.dependsOnTaskId : task.dependsOnTaskId,
        description: draft.description,
        notifyClientOnCompletion: draft.notifyClientOnCompletion,
        clientSatisfied: draft.clientSatisfied,
        clientFeedbackStatus: draft.clientFeedbackStatus,
        clientFeedbackNotes: draft.clientFeedbackNotes,
        assignedTo: draft.assignedTo,
        isRecurring: draft.isRecurring,
        recurringEvery: draft.recurringEvery,
        recurringInterval: draft.recurringInterval,
        recurringTotalCycles: draft.recurringTotalCycles,
        recurringNextDate: draft.recurringNextDate,
      });
      setTask(updated.data);
      setDraft(updated.data);
      setEditModalOpen(false);
      showToast(updated.message || 'Task updated successfully');
      void loadTaskData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClientFeedback = async (status: 'Satisfied' | 'Dissatisfied') => {
    if (!task || !isClient) return;
    setSaving(true);
    try {
      const updated = await crmApi.updateTask(task._id, {
        clientFeedbackStatus: status,
        clientSatisfied: status === 'Satisfied',
      });
      setTask(updated.data);
      setDraft(updated.data);
      showToast(`Marked as ${status}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit feedback', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Send or Resend Client Review Reminder
  const handleSendReminderEmail = async () => {
    if (!task || !canManageTasks) return;
    setSaving(true);
    try {
      const res = await crmApi.sendTaskReminderEmail(task._id);
      showToast(res.message || 'Client review email dispatched successfully!');
      await loadTaskData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send reminder email', 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyReminderPreset = (presetId: string) => {
    if (!canManageTasks) return;
    const preset = REMINDER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setReminderEnabled(true);
    setReminderType(preset.type);
    setReminderValue(preset.value);
  };

  const handleSaveReminderSchedule = async () => {
    if (!task || !canManageTasks) return;
    if (reminderEnabled && (!Number.isFinite(reminderValue) || reminderValue < 1)) {
      showToast('Enter a custom interval of at least 1', 'error');
      return;
    }
    setSavingSchedule(true);
    try {
      const res = await crmApi.updateTask(task._id, {
        reminderScheduleEnabled: reminderEnabled,
        reminderIntervalType: reminderType,
        reminderIntervalValue: reminderEnabled ? reminderValue : null,
      });
      if (res.data) {
        setTask(res.data);
        setDraft(res.data);
      } else {
        await loadTaskData();
      }
      showToast(
        reminderEnabled
          ? `Automatic emails rescheduled: ${formatReminderScheduleSummary(true, reminderType, reminderValue)}`
          : 'Per-task schedule disabled — workspace default will be used'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save email schedule', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Save as Template Handler
  const handleOpenSaveTemplate = () => {
    if (!task || !canManageTasks) return;
    setTemplateName(`${task.title} (Template)`);
    setTemplateCategory('General');
    setSaveTemplateModalOpen(true);
  };

  const handleSaveAsTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !templateName.trim() || !canManageTasks) return;
    setSaving(true);
    try {
      await crmApi.saveTaskAsTemplate(task._id, {
        title: templateName.trim(),
        category: templateCategory.trim() || 'General',
      });
      showToast(`Saved "${templateName.trim()}" to Task Templates!`);
      setSaveTemplateModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Archive
  const handleToggleArchive = async () => {
    if (!task || !canManageTasks) return;
    const nextArchived = !task.isArchived;
    setSaving(true);
    try {
      const res = await crmApi.updateTask(task._id, {
        isArchived: nextArchived,
        archivedAt: nextArchived ? new Date().toISOString() : null,
      });
      setTask(res.data);
      showToast(nextArchived ? 'Task archived' : 'Task restored');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Archive failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async () => {
    if (!task || !canDelete) return;
    if (!(await confirm({ message: `Delete task "${task.title}"? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteTask(task._id);
      showToast('Task deleted');
      navigate('/tasks');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // Subtask Handlers
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTasks || !subtaskTitle.trim() || !task) return;
    setSaving(true);
    try {
      const res = await crmApi.createTaskSubtask(task._id, {
        title: subtaskTitle.trim(),
        currentDate: subtaskDueDate || null,
        dueDate: subtaskDueDate || null,
        assignedTo: subtaskAssignee || undefined,
        description: subtaskDescription.trim() || undefined,
      });
      setSubtasks((prev) => [...prev, res.data]);
      setSubtaskTitle('');
      setSubtaskDueDate('');
      setSubtaskAssignee('');
      setSubtaskDescription('');
      setShowSubtaskFormDetails(false);
      showToast('Checklist subtask added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add subtask', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubtask = async (subtask: TaskSubtask) => {
    if (!canManageTasks) return;
    try {
      const nextDone = !subtask.done;
      const res = await crmApi.updateTaskSubtask(id, subtask._id, { isCompleted: nextDone });
      setSubtasks((prev) =>
        prev.map((s) =>
          s._id === subtask._id
            ? { ...s, ...res.data, done: Boolean(res.data.done ?? res.data.isCompleted), isCompleted: Boolean(res.data.done ?? res.data.isCompleted) }
            : s
        )
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update subtask', 'error');
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!canManageTasks) return;
    try {
      await crmApi.deleteTaskSubtask(id, subtaskId);
      setSubtasks((prev) => prev.filter((s) => s._id !== subtaskId));
      showToast('Subtask removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete subtask', 'error');
    }
  };

  // Time Log Handlers
  const handleAddManualTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !canLogTime) return;
    const hoursNum = parseFloat(manualHours);
    if (!(hoursNum > 0)) {
      showToast('Please enter valid hours', 'error');
      return;
    }
    setSaving(true);
    try {
      await crmApi.createTimeLog({
        projectId: task.projectId,
        taskId: task._id,
        taskTitle: task.title,
        hours: hoursNum,
        hourlyRate: parseFloat(manualRate) || 50,
        workDate: manualDate,
        date: manualDate,
        isBillable: manualBillable,
        billable: manualBillable,
        note: manualNote.trim(),
        description: manualNote.trim(),
      });
      const res = await crmApi.listTimeLogs({ taskId: task._id });
      setTimeLogs(res.data || []);
      setManualHours('1');
      setManualNote('');
      showToast('Time log added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to log time', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Discussion Handlers
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || !task) return;
    if (!canWrite && !isClient) return;
    try {
      const res = await crmApi.createTaskComment(task._id, {
        body: commentBody.trim(),
        userName: 'Admin User',
      });
      setComments((prev) => [...prev, res.data]);
      setCommentBody('');
      showToast('Comment posted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to post comment', 'error');
    }
  };

  // Watchers Handlers
  const followersList = useMemo(() => {
    return Array.isArray(task?.followers) ? task.followers : [];
  }, [task?.followers]);

  const currentUserId = 'admin-user';
  const isWatching = followersList.includes(currentUserId);

  const handleToggleWatch = async () => {
    if (!task || !canManageTasks) return;
    const nextFollowers = isWatching
      ? followersList.filter((f) => f !== currentUserId)
      : [...followersList, currentUserId];

    try {
      const res = await crmApi.updateTask(task._id, { followers: nextFollowers });
      setTask(res.data);
      showToast(isWatching ? 'Unwatched task' : 'Now watching task');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update watch status', 'error');
    }
  };

  const handleAddWatcher = async () => {
    if (!selectedNewWatcher || !task || !canManageTasks) return;
    if (followersList.includes(selectedNewWatcher)) {
      showToast('User is already watching this task', 'error');
      return;
    }
    const nextFollowers = [...followersList, selectedNewWatcher];
    try {
      const res = await crmApi.updateTask(task._id, { followers: nextFollowers });
      setTask(res.data);
      setSelectedNewWatcher('');
      showToast('Watcher added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add watcher', 'error');
    }
  };

  const handleRemoveWatcher = async (userId: string) => {
    if (!task || !canManageTasks) return;
    const nextFollowers = followersList.filter((f) => f !== userId);
    try {
      const res = await crmApi.updateTask(task._id, { followers: nextFollowers });
      setTask(res.data);
      showToast('Watcher removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove watcher', 'error');
    }
  };

  // Priority Badge Helper
  const renderPriorityChip = (prio: TaskPriority) => {
    const p = String(prio || '').toLowerCase();
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
  };

  // Client Review Badge Helper
  const renderClientReviewBadge = (status?: string, notes?: string) => {
    const s = status || 'Pending Review';
    if (s === 'Satisfied') {
      return (
        <span
          title={notes || ''}
          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800"
        >
          Satisfied
        </span>
      );
    }
    if (s === 'Dissatisfied') {
      return (
        <span
          title={notes || ''}
          className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-800"
        >
          Dissatisfied
        </span>
      );
    }
    if (s === 'Not Replied' || s === 'Awaiting Reply') {
      return (
        <span
          title={notes || ''}
          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800"
        >
          {s}
        </span>
      );
    }
    if (s === 'Pending Feedback') {
      return (
        <span
          title={notes || ''}
          className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800"
        >
          Pending Feedback
        </span>
      );
    }
    return (
      <span
        title={notes || ''}
        className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600"
      >
        {s}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500 animate-pulse">Loading task…</div>
    );
  }

  if (!task) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="m-0 mb-1 text-base font-bold text-red-800">Task Unavailable</h2>
        <p className="m-0 mb-4 text-sm text-red-600">{error || 'Task could not be found.'}</p>
        <Link
          to="/tasks"
          className="inline-flex h-9 items-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white no-underline"
        >
          Return to Tasks
        </Link>
      </div>
    );
  }

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';
  const assigneeName = displayUserLabel(
    task.assigneeName || task.assignedUsername,
    task.assignedUsername || task.assignedTo,
    'Unassigned'
  );
  const assigneeInitials = (assigneeName || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-lg border px-4 py-2.5 text-xs font-semibold shadow-lg ${
            toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <header data-tour="tasks-detail-hero" className="flex flex-col gap-4 border-b border-zinc-200 pb-4">
        <Link
          to="/tasks"
          data-tour="tasks-detail-back"
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-zinc-600 no-underline hover:text-zinc-950"
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to Tasks
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Delivery · Task
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {renderPriorityChip(task.priority)}
              {task.milestoneTitle && (
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                  {task.milestoneTitle}
                </span>
              )}
              {task.isRecurring && (
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                  Recurring ({task.recurringInterval || 'month'})
                </span>
              )}
              {task.dependsOnTaskTitle && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    task.isDependencyBlocked
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  Depends on: {task.dependsOnTaskTitle}
                  {task.isDependencyBlocked ? ' (Blocked)' : ''}
                </span>
              )}
              {renderClientReviewBadge(task.clientFeedbackStatus, task.clientFeedbackNotes)}
              {task.isArchived && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  Archived
                </span>
              )}
            </div>
            <h1 className="m-0 text-2xl font-bold tracking-tight text-zinc-950">{task.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-zinc-600">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Status
                </span>
                {canWrite ? (
                  <select
                    data-tour="tasks-status-select"
                    value={task.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      setDraft((prev) => ({ ...prev, status: nextStatus }));
                      void crmApi.updateTask(task._id, { status: nextStatus }).then((res) => {
                        setTask(res.data);
                        showToast(res.message || `Status: ${nextStatus}`);
                        void loadTaskData();
                      });
                    }}
                    className="h-8 cursor-pointer rounded-lg border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-zinc-500"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="h-8 inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs font-semibold text-zinc-800">
                    {task.status}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Assignee
                </span>
                <div className="flex items-center gap-1.5 font-medium text-zinc-800">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold text-white">
                    {assigneeInitials}
                  </div>
                  <span>{assigneeName}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Due
                </span>
                <span className={`font-medium ${isOverdue ? 'font-semibold text-red-600' : 'text-zinc-700'}`}>
                  {task.dueDate
                    ? `${new Date(task.dueDate).toLocaleDateString()}${isOverdue ? ' (Overdue)' : ''}`
                    : 'No due date'}
                </span>
              </div>

              {project && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Project
                  </span>
                  <Link
                    to={`/projects/${project._id}`}
                    className="font-medium text-zinc-800 no-underline hover:underline"
                  >
                    {project.name}
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canLogTime && (
              <button
                type="button"
                data-tour="tasks-timer-btn"
                disabled={saving}
                onClick={handleToggleTimer}
                className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  activeCheckIn
                    ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                {activeCheckIn ? (
                  <>
                    <StopIcon sx={{ fontSize: 15 }} />
                    Stop ({formatTimerSeconds(elapsedSecs)})
                  </>
                ) : (
                  <>
                    <PlayArrowIcon sx={{ fontSize: 15 }} />
                    Start Timer
                  </>
                )}
              </button>
            )}

            <button type="button" onClick={() => void loadTaskData()} className={btnIcon} title="Refresh">
              <RefreshIcon sx={{ fontSize: 16 }} />
            </button>

            {canManageTasks && (
              <button
                type="button"
                data-tour="tasks-detail-template-btn"
                onClick={handleOpenSaveTemplate}
                className={btnSecondary}
                title="Save as reusable Task Template"
              >
                <BookmarkBorderIcon sx={{ fontSize: 15 }} />
                Template
              </button>
            )}

            {canManageTasks && (
              <button
                type="button"
                data-tour="tasks-send-review-btn"
                disabled={saving}
                onClick={handleSendReminderEmail}
                className={btnSecondary}
                title="Send or resend completion review email to client"
              >
                <SendOutlinedIcon sx={{ fontSize: 14 }} />
                {task.clientNotifiedAt ? 'Resend Reminder' : 'Send Review'}
              </button>
            )}

            {canManageTasks && (
              <button
                type="button"
                data-tour="tasks-edit-btn"
                onClick={() => setEditModalOpen(true)}
                className={btnSecondary}
              >
                <EditOutlinedIcon sx={{ fontSize: 15 }} />
                Edit
              </button>
            )}

            {canManageTasks && (
              <button
                type="button"
                data-tour="tasks-archive-btn"
                onClick={handleToggleArchive}
                className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                  task.isArchived
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
                }`}
              >
                {task.isArchived ? (
                  <>
                    <UnarchiveOutlinedIcon sx={{ fontSize: 15 }} />
                    Restore
                  </>
                ) : (
                  <>
                    <ArchiveOutlinedIcon sx={{ fontSize: 15 }} />
                    Archive
                  </>
                )}
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                data-tour="tasks-delete-btn"
                onClick={handleDeleteTask}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white text-red-600 transition-colors hover:bg-red-50"
                title="Delete task"
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Archived Banner */}
      {task.isArchived && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div>
            <strong>This task is archived.</strong>
            <p className="m-0 text-xs text-amber-800">
              Archived tasks are retained for audit and history records.
            </p>
          </div>
          {canManageTasks && (
            <button
              type="button"
              onClick={handleToggleArchive}
              className="h-9 cursor-pointer rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900"
            >
              Restore Task
            </button>
          )}
        </div>
      )}

      {/* Client email dispatch banner */}
      {canManageTasks &&
        (task.clientNotifiedAt || task.status === 'Completed') &&
        (task.clientNotifiedAt ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div>
              <strong className="block text-sm font-semibold text-emerald-950">
                Client completion review sent
              </strong>
              <span className="mt-0.5 block text-xs text-emerald-800">
                Sent to <strong>{task.clientNotifiedEmail || project?.clientName || 'client'}</strong> on{' '}
                {new Date(task.clientNotifiedAt).toLocaleString()}.
              </span>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSendReminderEmail}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              Resend Reminder
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div>
              <strong className="block text-sm font-semibold text-sky-950">
                Deliverable marked completed
              </strong>
              <span className="mt-0.5 block text-xs text-sky-800">
                Notify the client to review this deliverable and rate their satisfaction.
              </span>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSendReminderEmail}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-zinc-950 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Send Review Email
            </button>
          </div>
        ))}

      {/* KPI cards */}
      <section data-tour="tasks-detail-kpis" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="flex flex-col justify-between rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Checklist Items
          </span>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <strong className="text-lg font-bold text-zinc-950">
                {completedSubtasks}{' '}
                <span className="text-sm font-normal text-zinc-400">/ {totalSubtasks}</span>
              </strong>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  subtaskPercent === 100
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-200 bg-zinc-100 text-zinc-700'
                }`}
              >
                {subtaskPercent}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full ${subtaskPercent === 100 ? 'bg-emerald-500' : 'bg-zinc-900'}`}
                style={{ width: `${subtaskPercent}%` }}
              />
            </div>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Labor Time Logged
          </span>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <strong className="text-lg font-bold text-zinc-950">
                {calculatedTotalHours.toFixed(1)}{' '}
                <span className="text-sm font-normal text-zinc-400">hrs</span>
              </strong>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                {timeLogs.length} session(s)
              </span>
            </div>
            <p className="m-0 mt-2 text-[11px] text-zinc-500">
              {calculatedBillableHours.toFixed(1)} billable hrs
            </p>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Billable Cost
          </span>
          <div className="mt-2">
            <strong className="text-lg font-bold text-emerald-700">
              {formatMoney(calculatedBillableAmount)}
            </strong>
            <p className="m-0 mt-2 text-[11px] text-zinc-500">Labor cost allocated to project</p>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Client Satisfaction
          </span>
          <div className="mt-2">
            <strong
              className={`text-lg font-bold ${
                task.clientFeedbackStatus === 'Satisfied'
                  ? 'text-emerald-700'
                  : task.clientFeedbackStatus === 'Dissatisfied'
                    ? 'text-red-700'
                    : 'text-zinc-950'
              }`}
            >
              {task.clientFeedbackStatus || 'Pending'}
            </strong>
            <p className="m-0 mt-2 text-[11px] text-zinc-500">
              {task.clientFeedbackNotes ? 'Review notes recorded' : 'Awaiting client review'}
            </p>
          </div>
        </article>
      </section>

      {/* 2-COLUMN MAIN WORKSPACE */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN (70% - 8 COLS): 5 TABS */}
        <main className="flex flex-col gap-4 lg:col-span-8">
          {/* TAB BAR */}
          <nav data-tour="tasks-detail-tabs" className="flex items-center gap-1 overflow-x-auto rounded-xl border border-zinc-300 bg-white p-1.5">
            {[
              { id: 'overview', label: 'Overview' },
              {
                id: 'subtasks',
                label: `Subtasks (${completedSubtasks}/${totalSubtasks})`,
              },
              { id: 'time', label: `Time (${timeLogs.length})` },
              { id: 'discussion', label: `Discussion (${comments.length})` },
              {
                id: 'emails',
                label: `Emails (${task.reminderCount || emailEvents.length || 0})`,
              },
              { id: 'history', label: `History (${auditLogs.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                data-tour={`tasks-tab-${t.id}`}
                onClick={() => setActiveTab(t.id as TabId)}
                className={`cursor-pointer whitespace-nowrap rounded-lg border-none px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === t.id
                    ? 'bg-zinc-950 text-white shadow-sm'
                    : 'bg-transparent text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* TAB 1: OVERVIEW & DESCRIPTION */}
          {activeTab === 'overview' && (
            <div data-tour="tasks-overview-body" className="rounded-xl border border-zinc-300 bg-white p-5 flex flex-col gap-5">
              <div>
                <h3 className="m-0 text-sm font-bold text-zinc-900 mb-2">Description</h3>
                <div className="text-xs text-zinc-700 leading-relaxed bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 min-h-[90px] whitespace-pre-wrap">
                  {task.description || (
                    <span className="text-zinc-400 italic">No description provided.</span>
                  )}
                </div>
              </div>

              {/* Recurring Schedule Details Card (if active) */}
              {task.isRecurring && (
                <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ScheduleIcon sx={{ fontSize: 16 }} className="text-zinc-600" />
                      <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-900">
                        Recurring Schedule
                      </h4>
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                      Active
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-3 text-xs text-zinc-800 sm:grid-cols-3">
                    <div>
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase text-zinc-500">
                        Frequency
                      </span>
                      <strong>
                        Every {task.recurringEvery || task.every || 1}{' '}
                        {task.recurringInterval || task.interval || 'month'}(s)
                      </strong>
                    </div>
                    <div>
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase text-zinc-500">
                        Next Run
                      </span>
                      <strong>{task.recurringNextDate || task.nextDate || 'Auto on completion'}</strong>
                    </div>
                    <div>
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase text-zinc-500">
                        Cycles
                      </span>
                      <strong>
                        {task.recurringCyclesCompleted || 0} of{' '}
                        {task.recurringTotalCycles ? `${task.recurringTotalCycles} cycles` : 'Infinite'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Prerequisite Blocker Card (if dependency present) */}
              {task.dependsOnTaskTitle && (
                <div className={`rounded-xl border p-4 flex flex-col gap-1.5 ${
                  task.isDependencyBlocked
                    ? 'border-amber-200 bg-amber-50/60 text-amber-900'
                    : 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {task.isDependencyBlocked ? (
                        <WarningAmberIcon sx={{ fontSize: 16 }} className="text-amber-600" />
                      ) : (
                        <CheckCircleOutlineIcon sx={{ fontSize: 16 }} className="text-emerald-600" />
                      )}
                      <h4 className="m-0 text-xs font-bold uppercase tracking-wider">
                        Prerequisite Task Dependency
                      </h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      task.isDependencyBlocked
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {task.isDependencyBlocked ? 'Blocked' : 'Satisfied'}
                    </span>
                  </div>
                  <p className="m-0 text-xs">
                    Depends on deliverable: <strong>{task.dependsOnTaskTitle}</strong> (Status: <em>{task.dependsOnTaskStatus || 'Pending'}</em>)
                  </p>
                  {task.isDependencyBlocked && (
                    <p className="m-0 text-[11px] text-amber-700 font-medium">
                      ⚠️ Prerequisite deliverable has not been completed yet.
                    </p>
                  )}
                </div>
              )}

              {/* Client Review Feedback Settings */}
              <div className="border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="m-0 text-sm font-bold text-zinc-900">
                    Client Review &amp; Satisfaction
                    {canManageTasks ? ' Settings' : ''}
                  </h3>
                  {canManageTasks && (
                    <button
                      type="button"
                      onClick={handleSendReminderEmail}
                      disabled={saving}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <SendOutlinedIcon sx={{ fontSize: 12 }} />
                      <span>{task?.clientNotifiedAt ? 'Resend Review Reminder' : 'Send Review Email'}</span>
                    </button>
                  )}
                </div>

                {isClient ? (
                  <div className="flex flex-col gap-3">
                    <p className="m-0 text-xs text-zinc-600">
                      Current status:{' '}
                      <strong className="text-zinc-900">
                        {task.clientFeedbackStatus || 'Pending Review'}
                      </strong>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleClientFeedback('Satisfied')}
                        className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                        Satisfied
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleClientFeedback('Dissatisfied')}
                        className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-red-300 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
                      >
                        <CancelOutlinedIcon sx={{ fontSize: 14 }} />
                        Dissatisfied
                      </button>
                    </div>
                    {task.clientFeedbackNotes ? (
                      <p className="m-0 text-xs text-zinc-600 whitespace-pre-wrap bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                        {task.clientFeedbackNotes}
                      </p>
                    ) : null}
                  </div>
                ) : canManageTasks ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <label className="block text-xs font-semibold text-zinc-700">
                        <span className="mb-1 block">Feedback Status</span>
                        <select
                          className={fieldClass}
                          value={draft.clientFeedbackStatus || 'Pending Review'}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              clientFeedbackStatus: e.target.value,
                              clientSatisfied: e.target.value === 'Satisfied' ? true : e.target.value === 'Dissatisfied' ? false : null,
                            }))
                          }
                        >
                          {TASK_CLIENT_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex flex-col justify-center gap-2 pt-1">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.clientSatisfied === true || draft.clientFeedbackStatus === 'Satisfied'}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                clientSatisfied: e.target.checked,
                                clientFeedbackStatus: e.target.checked ? 'Satisfied' : 'Pending Review',
                              }))
                            }
                          />
                          <span>Client is Satisfied with Deliverable</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.notifyClientOnCompletion || false}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                notifyClientOnCompletion: e.target.checked,
                              }))
                            }
                          />
                          <span>Send completion email &amp; feedback link to client</span>
                        </label>
                      </div>
                    </div>

                    <label className="block text-xs font-semibold text-zinc-700 mb-3">
                      <span className="mb-1 block">Review Notes / Feedback</span>
                      <textarea
                        rows={3}
                        className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs outline-none focus:border-zinc-500 text-zinc-800"
                        placeholder="Specific remarks, client feedback or change requests recorded during deliverable review…"
                        value={draft.clientFeedbackNotes || ''}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            clientFeedbackNotes: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveProperties()}
                        className="px-4 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 text-xs text-zinc-700">
                    <p className="m-0">
                      Status:{' '}
                      <strong className="text-zinc-900">
                        {task.clientFeedbackStatus || 'Pending Review'}
                      </strong>
                    </p>
                    {task.clientFeedbackNotes ? (
                      <p className="m-0 whitespace-pre-wrap bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                        {task.clientFeedbackNotes}
                      </p>
                    ) : (
                      <p className="m-0 text-zinc-500">No review notes recorded.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SUBTASKS */}
          {activeTab === 'subtasks' && (
            <div className="rounded-xl border border-zinc-300 bg-white p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div>
                  <h3 className="m-0 text-sm font-bold text-zinc-900">Task Checklist</h3>
                  <p className="m-0 mt-0.5 text-xs text-zinc-500">
                    {completedSubtasks} of {totalSubtasks} completed ({subtaskPercent}%)
                  </p>
                </div>
                <div className="w-36 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      subtaskPercent === 100 ? 'bg-emerald-500' : 'bg-zinc-900'
                    }`}
                    style={{ width: `${subtaskPercent}%` }}
                  />
                </div>
              </div>

              {/* Add Subtask Input Form */}
              {canManageTasks && (
              <form onSubmit={handleAddSubtask} className="flex flex-col gap-2.5 p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
                <div className="flex gap-2">
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    required
                    placeholder="+ Add new checklist deliverable item…"
                    className={`${fieldClass} flex-1`}
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSubtaskFormDetails((prev) => !prev)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-medium cursor-pointer"
                    title="Toggle additional subtask fields"
                  >
                    {showSubtaskFormDetails ? 'Fewer Options' : '+ Details'}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !subtaskTitle.trim()}
                    className="px-4 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none disabled:opacity-40 transition-colors"
                  >
                    Add Item
                  </button>
                </div>

                {showSubtaskFormDetails && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-200">
                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block text-[11px]">Assign To</span>
                      <select
                        className={fieldClass}
                        value={subtaskAssignee}
                        onChange={(e) => setSubtaskAssignee(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {assigneeOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                        {u.label || u.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block text-[11px]">Target / Due Date</span>
                      <input
                        type="date"
                        className={fieldClass}
                        value={subtaskDueDate}
                        onChange={(e) => setSubtaskDueDate(e.target.value)}
                      />
                    </label>

                    <label className="block text-xs font-semibold text-zinc-700 sm:col-span-2">
                      <span className="mb-1 block text-[11px]">Description / Acceptance Notes</span>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs outline-none focus:border-zinc-500 text-zinc-800"
                        placeholder="Detailed instructions or acceptance criteria for this checklist step…"
                        value={subtaskDescription}
                        onChange={(e) => setSubtaskDescription(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </form>
              )}

              {/* Subtasks List */}
              <div className="flex flex-col divide-y divide-zinc-100">
                {subtasks.length > 0 ? (
                  subtasks.map((s) => {
                    const isSubtaskOverdue = s.dueDate && new Date(s.dueDate) < new Date() && !s.done;
                    const subtaskUser = assigneeOptions.find((u) => u.id === s.assignedTo);
                    const subtaskUserName = displayUserLabel(
                      subtaskUser || s.assigneeName,
                      (subtaskUser as { username?: string } | undefined)?.username || s.assignedTo,
                      'Unassigned'
                    );

                    return (
                      <div
                        key={s._id}
                        className="py-3 flex flex-col gap-1.5 group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <label className={`flex items-center gap-2.5 flex-1 min-w-0 ${canManageTasks ? 'cursor-pointer' : ''}`}>
                            <input
                              type="checkbox"
                              checked={s.done}
                              disabled={!canManageTasks}
                              onChange={() => handleToggleSubtask(s)}
                              className="w-4 h-4 rounded text-zinc-950 focus:ring-0 cursor-pointer disabled:cursor-default"
                            />
                            <span
                              className={`text-xs ${
                                s.done
                                  ? 'line-through text-zinc-400'
                                  : 'text-zinc-800 font-medium'
                              }`}
                            >
                              {s.title}
                            </span>
                          </label>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {subtaskUserName && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                                👤 {subtaskUserName}
                              </span>
                            )}
                            {s.dueDate && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                isSubtaskOverdue
                                  ? 'bg-red-50 text-red-700 border-red-200 font-bold'
                                  : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                              }`}>
                                📅 {s.dueDate.slice(0, 10)}
                              </span>
                            )}
                            {canManageTasks && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSubtask(s._id)}
                                className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-600 text-xs p-1 border-none bg-transparent cursor-pointer transition-opacity"
                                title="Delete subtask"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {s.description && (
                          <p className="m-0 pl-6 text-[11px] text-zinc-500 whitespace-pre-wrap">
                            {s.description}
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-xs text-zinc-400">
                    No checklist items yet.{canManageTasks ? ' Add subtasks above to track granular progress.' : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TIME & TIMERS */}
          {activeTab === 'time' && (
            <div data-tour="tasks-time-panel" className="flex flex-col gap-4">
              {/* Active Timer Control Card */}
              <div className="rounded-xl border border-zinc-300 bg-white p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                      activeCheckIn
                        ? 'bg-red-50 text-red-700 animate-pulse'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    ⏱️
                  </div>
                  <div>
                    <h4 className="m-0 text-xs font-bold text-zinc-900">
                      {activeCheckIn ? 'Live Check-in Active' : 'Task Timer Ready'}
                    </h4>
                    <p className="m-0 mt-0.5 text-xs text-zinc-500 font-mono">
                      Elapsed: {formatTimerSeconds(elapsedSecs)}
                    </p>
                  </div>
                </div>

                {canLogTime && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleToggleTimer}
                    className={`h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors ${
                      activeCheckIn
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-zinc-950 hover:bg-zinc-800 text-white'
                    }`}
                  >
                    {activeCheckIn ? 'Stop & Log Session' : 'Start Live Timer'}
                  </button>
                )}
              </div>

              {/* Manual Time Log Form */}
              {canLogTime && (
              <div className="rounded-xl border border-zinc-300 bg-white p-5">
                <h3 className="m-0 text-sm font-bold text-zinc-900 mb-3">Log Manual Time Entry</h3>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 mb-3.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Quick Presets:</span>
                  {[
                    { label: '+15m', hrs: '0.25' },
                    { label: '+30m', hrs: '0.5' },
                    { label: '1h', hrs: '1' },
                    { label: '1.5h', hrs: '1.5' },
                    { label: '2h', hrs: '2' },
                    { label: '4h', hrs: '4' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setManualHours(preset.hrs)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-colors ${
                        manualHours === preset.hrs
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleAddManualTime} className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block">Hours</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        max="24"
                        className={fieldClass}
                        value={manualHours}
                        onChange={(e) => setManualHours(e.target.value)}
                      />
                    </label>

                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block">Work Date</span>
                      <input
                        type="date"
                        className={fieldClass}
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                      />
                    </label>

                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block">Hourly Rate ({currency})</span>
                      <input
                        type="number"
                        min="0"
                        className={fieldClass}
                        value={manualRate}
                        onChange={(e) => setManualRate(e.target.value)}
                      />
                    </label>

                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block">Billing</span>
                      <label className="flex items-center gap-2 h-9 text-xs text-zinc-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualBillable}
                          onChange={(e) => setManualBillable(e.target.checked)}
                        />
                        <span>Billable Labor</span>
                      </label>
                    </label>
                  </div>

                  <input
                    type="text"
                    placeholder="Description of work done during this session…"
                    className={fieldClass}
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none transition-colors"
                    >
                      {saving ? 'Logging…' : 'Log Time Entry'}
                    </button>
                  </div>
                </form>
              </div>
              )}

              {/* Time Logs List */}
              <div className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
                <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="m-0 text-sm font-bold text-zinc-900">Logged Sessions</h3>
                  <span className="text-xs text-zinc-500 font-semibold">
                    Total: {calculatedTotalHours.toFixed(1)} hrs ({formatMoney(calculatedBillableAmount)})
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-semibold text-[10px]">
                        <th className="px-4 py-2.5">User</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Hours</th>
                        <th className="px-4 py-2.5">Rate</th>
                        <th className="px-4 py-2.5">Total</th>
                        <th className="px-4 py-2.5">Billable</th>
                        <th className="px-4 py-2.5">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {timeLogs.length > 0 ? (
                        timeLogs.map((tl) => {
                          const h = Number(tl.hours) || 0;
                          const r = Number(tl.hourlyRate) || 50;
                          const totalAmt = Number(tl.billableAmount) || h * r;

                          return (
                            <tr key={tl._id} className="hover:bg-zinc-50">
                              <td className="px-4 py-2.5 font-medium text-zinc-900">
                                {displayUserLabel(tl.userName, tl.userId, 'Admin')}
                              </td>
                              <td className="px-4 py-2.5 text-zinc-600">
                                {tl.workDate || tl.date || '—'}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-zinc-900">{h.toFixed(1)}</td>
                              <td className="px-4 py-2.5 text-zinc-600">{formatMoney(r)}</td>
                              <td className="px-4 py-2.5 font-bold text-emerald-700">
                                {formatMoney(totalAmt)}
                              </td>
                              <td className="px-4 py-2.5">
                                {tl.isBillable !== false ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Yes
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600">
                                    No
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-zinc-600 truncate max-w-xs">
                                {tl.description || tl.note || '—'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                            No time logs recorded for this task yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DISCUSSION */}
          {activeTab === 'discussion' && (
            <div className="rounded-xl border border-zinc-300 bg-white p-5 flex flex-col gap-4">
              <h3 className="m-0 text-sm font-bold text-zinc-900">Discussion &amp; Notes</h3>

              {/* Comment Post Box */}
              {(canWrite || isClient) && (
              <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                <textarea
                  ref={commentInputRef}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs outline-none focus:border-zinc-500 text-zinc-800"
                  placeholder="Add comment, update, or feedback for this task…"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none transition-colors"
                  >
                    Post Comment
                  </button>
                </div>
              </form>
              )}

              {/* Comments Timeline */}
              <div className="flex flex-col divide-y divide-zinc-100 pt-2">
                {comments.length > 0 ? (
                  comments.map((c) => (
                    <div key={c._id} className="py-3 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(displayUserLabel(c.userName, c.userId, 'U') || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <strong className="text-xs text-zinc-900 font-semibold">
                            {displayUserLabel(c.userName, c.userId, 'User')}
                          </strong>
                          <span className="text-[10px] text-zinc-400">
                            {new Date(c.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="m-0 text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                          {c.body}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-zinc-400">
                    No comments yet. Start a discussion above.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB: CLIENT EMAILS & AUTO-REMINDER SCHEDULE */}
          {activeTab === 'emails' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <article className="rounded-xl border border-zinc-300 bg-white p-4">
                  <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Emails sent
                  </p>
                  <p className="m-0 mt-1 font-mono text-2xl font-bold text-zinc-950">
                    {Math.max(Number(task.reminderCount) || 0, emailEvents.length)}
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-zinc-500">
                    Manual + automatic reminders
                  </p>
                </article>
                <article className="rounded-xl border border-zinc-300 bg-white p-4">
                  <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Last sent
                  </p>
                  <p className="m-0 mt-1 text-sm font-semibold text-zinc-950">
                    {task.lastReminderSentAt || task.clientNotifiedAt
                      ? new Date(
                          String(task.lastReminderSentAt || task.clientNotifiedAt)
                        ).toLocaleString()
                      : 'Not sent yet'}
                  </p>
                  <p className="m-0 mt-1 truncate text-[11px] text-zinc-500">
                    {task.clientNotifiedEmail || project?.clientName || 'No client email on file'}
                  </p>
                </article>
                <article className="rounded-xl border border-zinc-300 bg-white p-4">
                  <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Active schedule
                  </p>
                  <p className="m-0 mt-1 text-sm font-semibold text-zinc-950">
                    {formatReminderScheduleSummary(
                      Boolean(task.reminderScheduleEnabled),
                      (task.reminderIntervalType as ReminderIntervalType) || 'hours',
                      task.reminderIntervalValue
                    )}
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-zinc-500">
                    {task.reminderScheduleEnabled
                      ? 'Per-task override is active'
                      : 'Falls back to Settings → Tasks'}
                  </p>
                </article>
              </div>

              {canManageTasks && (
              <div className="rounded-xl border border-zinc-300 bg-white p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ScheduleIcon sx={{ fontSize: 16 }} className="text-zinc-600" />
                      <h3 className="m-0 text-sm font-bold text-zinc-900">
                        Reschedule automatic emails
                      </h3>
                    </div>
                    <p className="m-0 mt-1 text-xs text-zinc-500">
                      Project managers and team members can change how often this task sends review
                      reminders to the client.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800">
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(e) => setReminderEnabled(e.target.checked)}
                      className="h-4 w-4 accent-zinc-950"
                    />
                    Enable per-task schedule
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {REMINDER_PRESETS.map((preset) => {
                    const active =
                      reminderEnabled &&
                      reminderType === preset.type &&
                      Number(reminderValue) === preset.value;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyReminderPreset(preset.id)}
                        className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-zinc-950 bg-zinc-950 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        <span className="block text-xs font-bold">{preset.label}</span>
                        <span
                          className={`mt-0.5 block text-[10px] ${
                            active ? 'text-zinc-300' : 'text-zinc-500'
                          }`}
                        >
                          {preset.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Custom interval
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={8760}
                      value={reminderValue}
                      disabled={!reminderEnabled}
                      onChange={(e) => setReminderValue(Math.max(1, Number(e.target.value) || 1))}
                      className={fieldClass}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Unit
                    </label>
                    <select
                      value={reminderType}
                      disabled={!reminderEnabled}
                      onChange={(e) => setReminderType(e.target.value as ReminderIntervalType)}
                      className={fieldClass}
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4 flex items-end">
                    <button
                      type="button"
                      onClick={handleSaveReminderSchedule}
                      disabled={savingSchedule}
                      className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border-none bg-zinc-950 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {savingSchedule ? 'Saving…' : 'Save schedule'}
                    </button>
                  </div>
                </div>

                <p className="m-0 text-[11px] text-zinc-500">
                  Preview:{' '}
                  <strong className="text-zinc-800">
                    {formatReminderScheduleSummary(reminderEnabled, reminderType, reminderValue)}
                  </strong>
                  . Automatic sends only apply while client feedback is still awaiting reply.
                </p>

                <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                  <button
                    type="button"
                    onClick={handleSendReminderEmail}
                    disabled={saving}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <SendOutlinedIcon sx={{ fontSize: 14 }} />
                    {task.clientNotifiedAt ? 'Send reminder now' : 'Send review email now'}
                  </button>
                </div>
              </div>
              )}

              <div className="rounded-xl border border-zinc-300 bg-white p-5 flex flex-col gap-3">
                <h3 className="m-0 text-sm font-bold text-zinc-900">Email history</h3>
                <p className="m-0 text-xs text-zinc-500">
                  Completion notifications, manual reminders, and automatic reminders for this task.
                </p>
                <div className="flex flex-col divide-y divide-zinc-100">
                  {emailEvents.length > 0 ? (
                    emailEvents.map((entry) => {
                      const kind =
                        entry.action === 'auto_reminder_sent'
                          ? 'Automatic'
                          : entry.action === 'notification_sent'
                            ? 'Completion'
                            : 'Manual';
                      return (
                        <div key={entry._id} className="flex items-start justify-between gap-4 py-2.5">
                          <div>
                            <div className="mb-0.5 flex flex-wrap items-center gap-2">
                              <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
                                {kind}
                              </span>
                              <span className="text-xs font-semibold text-zinc-900">
                                {entry.username || 'System'}
                              </span>
                            </div>
                            <p className="m-0 text-xs text-zinc-600">{entry.description}</p>
                          </div>
                          <span className="whitespace-nowrap text-[10px] text-zinc-400">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-8 text-center text-xs text-zinc-400">
                      No client emails have been sent for this task yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HISTORY & AUDIT */}
          {activeTab === 'history' && (
            <div className="rounded-xl border border-zinc-300 bg-white p-5 flex flex-col gap-3">
              <h3 className="m-0 text-sm font-bold text-zinc-900 mb-1">Task History &amp; Audit Trail</h3>
              <p className="m-0 text-xs text-zinc-500 mb-3">
                Complete record of status updates, field modifications, and user actions.
              </p>

              <div className="flex flex-col divide-y divide-zinc-100">
                {auditLogs.length > 0 ? (
                  auditLogs.map((entry) => (
                    <div key={entry._id} className="py-2.5 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 text-zinc-700">
                            {entry.action}
                          </span>
                          <span className="text-xs font-semibold text-zinc-900">
                            {entry.username || 'System'}
                          </span>
                        </div>
                        <p className="m-0 text-xs text-zinc-600">{entry.description}</p>
                      </div>
                      <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-zinc-400">
                    No audit records available for this task.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT COLUMN (30% - 4 COLS): SIDE VIEW */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          {/* SIDE VIEW 1: Project Context */}
          <section data-tour="tasks-sidebar-project" className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-900">
                Project Context
              </h4>
              {project?.status && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {project.status}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2.5 text-xs text-zinc-700">
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Project:</span>
                <strong className="text-zinc-900 text-right">
                  {project?.name || task.projectName || 'Internal'}
                </strong>
              </div>

              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Client:</span>
                <span className="text-zinc-800 text-right">
                  {project?.clientName || task.clientName || 'Internal'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Milestone:</span>
                <span className="text-zinc-800 text-right">
                  {task.milestoneTitle ? `🚩 ${task.milestoneTitle}` : 'None'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Depends on:</span>
                <span className="text-zinc-800 text-right">
                  {task.dependsOnTaskTitle ? `🔗 ${task.dependsOnTaskTitle}` : 'None'}
                </span>
              </div>

              {project && (
                <Link
                  to={`/projects/${project._id}`}
                  className="mt-2 w-full text-center py-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold no-underline flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Project Workspace</span>
                  <OpenInNewIcon sx={{ fontSize: 13 }} />
                </Link>
              )}
            </div>
          </section>

          {/* SIDE VIEW: Task Properties */}
          <section className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-900">
                Task Properties
              </h4>
            </div>
            <div className="flex flex-col gap-2.5 text-xs text-zinc-700">
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Created:</span>
                <span className="text-zinc-800 text-right">
                  {new Date(task.createdAt || Date.now()).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Updated:</span>
                <span className="text-zinc-800 text-right">
                  {new Date(task.updatedAt || task.createdAt || Date.now()).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Priority:</span>
                <strong className="text-zinc-900 text-right">{task.priority || 'Medium'}</strong>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Notify on Done:</span>
                <span className="text-right font-medium text-zinc-800">
                  {task.notifyClientOnCompletion
                    ? task.clientNotifiedAt
                      ? 'Yes (Email sent)'
                      : 'Yes (On completion)'
                    : 'No'}
                </span>
              </div>
              {task.clientNotifiedAt && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-zinc-500">Email Sent:</span>
                  <span className="text-right text-[11px] text-zinc-800">
                    {new Date(task.clientNotifiedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* SIDE VIEW 2: Watchers & Followers */}
          <section data-tour="tasks-sidebar-watchers" className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-900">
                Watchers &amp; Followers
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700">
                {followersList.length}
              </span>
            </div>

            {/* Toggle Watch Button */}
            {canManageTasks && (
            <button
              type="button"
              onClick={handleToggleWatch}
              className={`mb-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                isWatching
                  ? 'border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                  : 'border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800'
              }`}
            >
              {isWatching ? 'Watching (click to unwatch)' : 'Watch this task'}
            </button>
            )}

            {/* Watchers List */}
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto mb-3">
              {followersList.length > 0 ? (
                followersList.map((uid) => {
                  const userObj = assignableUsers.find((u) => u.id === uid || u.username === uid);
                  const name = userObj?.displayName || userObj?.username || uid;
                  const initial = name.charAt(0).toUpperCase();

                  return (
                    <div
                      key={uid}
                      className="p-1.5 rounded-lg border border-zinc-100 bg-zinc-50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold text-white">
                          {initial}
                        </div>
                        <span className="font-medium text-zinc-800 truncate max-w-[140px]">
                          {name}
                        </span>
                      </div>
                      {canManageTasks && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWatcher(uid)}
                          className="text-zinc-400 hover:text-red-600 text-[11px] p-0.5 border-none bg-transparent cursor-pointer"
                          title="Remove watcher"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-[11px] text-zinc-400 text-center py-2 m-0">
                  No team members watching yet.
                </p>
              )}
            </div>

            {/* Add Watcher Selector */}
            {canManageTasks && (
            <div className="flex gap-1.5 pt-2 border-t border-zinc-100">
              <select
                className={`${fieldClass} text-[11px]`}
                value={selectedNewWatcher}
                onChange={(e) => setSelectedNewWatcher(e.target.value)}
              >
                <option value="">+ Add Watcher…</option>
                {assigneeOptions
                  .filter((u) => !followersList.includes(u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label || u.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleAddWatcher}
                disabled={!selectedNewWatcher}
                className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
            )}
          </section>

          {/* SIDE VIEW 3: Quick Actions */}
          <section data-tour="tasks-sidebar-quick-actions" className="rounded-xl border border-zinc-300 bg-white p-4">
            <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-900 mb-3">
              Quick Actions
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {/* Quick Timer Button */}
              {canLogTime && (
              <button
                type="button"
                disabled={saving}
                onClick={handleToggleTimer}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer transition-colors ${
                  activeCheckIn
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200'
                }`}
              >
                <span>⏱️ {activeCheckIn ? 'Stop Active Timer' : 'Start Task Timer'}</span>
                {activeCheckIn && (
                  <span className="font-mono">{formatTimerSeconds(elapsedSecs)}</span>
                )}
              </button>
              )}

              {/* Save as Template */}
              {canManageTasks && (
              <button
                type="button"
                onClick={handleOpenSaveTemplate}
                className="py-2 px-3 rounded-lg text-xs font-semibold border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>💾 Save as Template</span>
                <span className="text-[10px] text-zinc-400">Blueprint</span>
              </button>
              )}

              {/* Send / Resend Review Reminder */}
              {canManageTasks && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSendReminderEmail}
                className="py-2 px-3 rounded-lg text-xs font-semibold border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
                title="Send or resend review reminder email to client"
              >
                <span>{task.clientNotifiedAt ? '🔔 Resend Reminder' : '✉️ Send Review Email'}</span>
                <span className="text-[10px] text-zinc-400">Client Email</span>
              </button>
              )}

              {/* Add Subtask shortcut */}
              {canManageTasks && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('subtasks');
                  setTimeout(() => subtaskInputRef.current?.focus(), 50);
                }}
                className="py-2 px-3 rounded-lg text-xs font-semibold border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>☑️ Add Subtask</span>
                <span className="text-[10px] text-zinc-400">Checklist</span>
              </button>
              )}

              {/* Post Comment shortcut */}
              {(canWrite || isClient) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('discussion');
                  setTimeout(() => commentInputRef.current?.focus(), 50);
                }}
                className="py-2 px-3 rounded-lg text-xs font-semibold border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>💬 Post Comment</span>
                <span className="text-[10px] text-zinc-400">Discussion</span>
              </button>
              )}

              {/* Edit Task shortcut */}
              {canManageTasks && (
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="py-2 px-3 rounded-lg text-xs font-semibold border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>✏️ Edit Task Details</span>
                <span className="text-[10px] text-zinc-400">Settings</span>
              </button>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Save as Template Modal */}
      {canManageTasks && saveTemplateModalOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSaveTemplateModalOpen(false);
          }}
        >
          <div className="bg-white border border-zinc-300 rounded-xl max-w-md w-full overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <BookmarkBorderIcon sx={{ fontSize: 18 }} className="text-zinc-800" />
                <h3 className="text-sm font-bold text-zinc-950 m-0">Save as Task Template</h3>
              </div>
              <button
                type="button"
                onClick={() => setSaveTemplateModalOpen(false)}
                className="p-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer bg-white"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>

            <form onSubmit={handleSaveAsTemplateSubmit} className="p-5 flex flex-col gap-4">
              <p className="m-0 text-xs text-zinc-600">
                This will create a reusable template copy of this task deliverable, including its priority, description, and <strong>{subtasks.length} checklist subtasks</strong>.
              </p>

              <label className="block text-xs font-semibold text-zinc-700">
                <span className="mb-1 block">Template Title *</span>
                <input
                  type="text"
                  required
                  className={fieldClass}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </label>

              <label className="block text-xs font-semibold text-zinc-700">
                <span className="mb-1 block">Category</span>
                <input
                  type="text"
                  placeholder="e.g. Design, Development, QA, Client Onboarding"
                  className={fieldClass}
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                />
              </label>

              <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50 text-[11px] text-zinc-600">
                <span className="font-semibold block text-zinc-800 mb-1">Included Subtasks ({subtasks.length}):</span>
                {subtasks.length > 0 ? (
                  <ul className="m-0 pl-4 list-disc space-y-0.5">
                    {subtasks.slice(0, 4).map((st) => (
                      <li key={st._id} className="truncate">{st.title}</li>
                    ))}
                    {subtasks.length > 4 && <li>...and {subtasks.length - 4} more</li>}
                  </ul>
                ) : (
                  <span>No subtasks in current task.</span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setSaveTemplateModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !templateName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {canManageTasks && editModalOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditModalOpen(false);
          }}
        >
          <div className="bg-white border border-zinc-300 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <h3 className="text-sm font-bold text-zinc-950 m-0">Edit Task Details</h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer bg-white"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProperties} className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
              <label className="block text-xs font-semibold text-zinc-700">
                <span className="mb-1 block">Task Title *</span>
                <input
                  type="text"
                  required
                  className={fieldClass}
                  value={draft.title || ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Status</span>
                  <select
                    className={fieldClass}
                    value={draft.status || 'To Do'}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Priority</span>
                  <select
                    className={fieldClass}
                    value={draft.priority || 'Medium'}
                    onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Assigned Team Member</span>
                  <select
                    className={fieldClass}
                    value={draft.assignedTo || ''}
                    onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {assigneeOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label || u.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Milestone</span>
                  <select
                    className={fieldClass}
                    value={draft.milestoneId || ''}
                    onChange={(e) => setDraft({ ...draft, milestoneId: e.target.value || null })}
                  >
                    <option value="">None (General Deliverable)</option>
                    {projectMilestones.map((ms) => (
                      <option key={ms._id} value={ms._id}>
                        🚩 {ms.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Depends on Prerequisite Task</span>
                  <select
                    className={fieldClass}
                    value={draft.dependsOnTaskId || ''}
                    onChange={(e) => setDraft({ ...draft, dependsOnTaskId: e.target.value || null })}
                  >
                    <option value="">None (No dependency)</option>
                    {projectTasks
                      .filter((pt) => pt._id !== task._id)
                      .map((pt) => (
                        <option key={pt._id} value={pt._id}>
                          🔗 {pt.title} [{pt.status}]
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Due Date</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={draft.dueDate ? draft.dueDate.slice(0, 10) : ''}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })}
                  />
                </label>
              </div>

              {/* Recurring Task Schedule Section */}
              <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.isRecurring || false}
                    onChange={(e) => setDraft({ ...draft, isRecurring: e.target.checked })}
                  />
                  <span>🔁 Repeat this task (Recurring Task Schedule)</span>
                </label>

                {draft.isRecurring && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block text-[11px]">Repeat Every</span>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        className={fieldClass}
                        value={draft.recurringEvery || 1}
                        onChange={(e) => setDraft({ ...draft, recurringEvery: Number(e.target.value) || 1 })}
                      />
                    </label>

                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block text-[11px]">Interval</span>
                      <select
                        className={fieldClass}
                        value={draft.recurringInterval || 'month'}
                        onChange={(e) => setDraft({ ...draft, recurringInterval: e.target.value })}
                      >
                        <option value="day">Day(s)</option>
                        <option value="week">Week(s)</option>
                        <option value="month">Month(s)</option>
                        <option value="quarter">Quarter(s)</option>
                        <option value="year">Year(s)</option>
                      </select>
                    </label>

                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block text-[11px]">Total Cycles</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0 = Infinite"
                        className={fieldClass}
                        value={draft.recurringTotalCycles || 0}
                        onChange={(e) => setDraft({ ...draft, recurringTotalCycles: Number(e.target.value) || 0 })}
                      />
                    </label>

                    <label className="block text-xs font-semibold text-zinc-700">
                      <span className="mb-1 block text-[11px]">Next Run Date</span>
                      <input
                        type="date"
                        className={fieldClass}
                        value={draft.recurringNextDate ? draft.recurringNextDate.slice(0, 10) : ''}
                        onChange={(e) => setDraft({ ...draft, recurringNextDate: e.target.value || null })}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Client Review Section */}
              <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col gap-3">
                <span className="text-xs font-bold text-zinc-900">Client Review &amp; Completion Email</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-zinc-700">
                    <span className="mb-1 block text-[11px]">Client Review Status</span>
                    <select
                      className={fieldClass}
                      value={draft.clientFeedbackStatus || 'Pending Review'}
                      onChange={(e) => setDraft({ ...draft, clientFeedbackStatus: e.target.value })}
                    >
                      {TASK_CLIENT_STATUSES.map((cs) => (
                        <option key={cs} value={cs}>{cs}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer pt-4">
                    <input
                      type="checkbox"
                      checked={draft.notifyClientOnCompletion || false}
                      onChange={(e) => setDraft({ ...draft, notifyClientOnCompletion: e.target.checked })}
                    />
                    <span>Email client on completion</span>
                  </label>
                </div>
              </div>

              <label className="block text-xs font-semibold text-zinc-700">
                <span className="mb-1 block">Description &amp; Acceptance Criteria</span>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs outline-none focus:border-zinc-500 text-zinc-800"
                  value={draft.description || ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>

              <div className="p-3 border-t border-zinc-200 flex justify-end gap-2 bg-zinc-50 -mx-5 -mb-5 mt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDetailPage;
