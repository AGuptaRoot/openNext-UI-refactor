import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SendIcon from '@mui/icons-material/Send';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';

import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TourButton } from '../../ui/tour';
import { useDialog } from '../../context/DialogContext';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import {
  TaskItem,
  TASK_STATUSES,
  TASK_CLIENT_STATUSES,
  TaskPriority,
} from '../../types/tasks';
import { ProjectItem, ProjectMilestone } from '../../types/projects';
import TaskTemplateModal from '../../components/tasks/TaskTemplateModal';
import RecurringTasksModal from '../../components/tasks/RecurringTasksModal';
import { TaskKanbanView } from '../../components/tasks/TaskKanbanView';
import { triggerFileDownload } from '../../utils/fileDownload';
import { canCreateTasks, canFullyManageTasks } from '../../utils/permissions';
import { displayLabel, displayUserLabel } from '../../utils/displayLabels';

const fieldClass =
  'h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-400 text-zinc-800';

const labelClass = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';

const btnSecondary =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors';

const btnPrimary =
  'inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white no-underline hover:bg-zinc-800 transition-colors cursor-pointer';

type ViewMode = 'list' | 'kanban';

export const TasksPage: React.FC = () => {
  const { confirm } = useDialog();
  const { hasPermission, isClient, activeRole } = useAuth();
  const canWrite = hasPermission('crm.tasks.write') && !isClient;
  const canAddTask = canCreateTasks({
    hasTaskWrite: canWrite,
    isClient,
  });
  const canManageTasks = canFullyManageTasks({
    hasTaskWrite: canWrite,
    isClient,
    activeRole,
  });
  const canDelete = hasPermission('crm.tasks.delete') && !isClient && canManageTasks;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data state
  const [items, setItems] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Filters state
  const [selectedProject, setSelectedProject] = useState(() => searchParams.get('projectId') || '');
  const [selectedMilestone, setSelectedMilestone] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(() => searchParams.get('status') || '');
  const [selectedClientStatus, setSelectedClientStatus] = useState(
    () => searchParams.get('clientFeedbackStatus') || ''
  );
  const [selectedRecurring, setSelectedRecurring] = useState('');
  const [selectedWatching, setSelectedWatching] = useState(
    () => (searchParams.get('watching') === 'true' || searchParams.get('watching') === '1' ? 'true' : '')
  );
  const [selectedArchived, setSelectedArchived] = useState('false');
  const [dueFilter, setDueFilter] = useState(() => searchParams.get('due') || '');
  const [attentionIds, setAttentionIds] = useState(() => searchParams.get('ids') || '');
  const [assignedToFilter, setAssignedToFilter] = useState(() => searchParams.get('assignedTo') || '');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // View mode and pagination
  const [view, setView] = useState<ViewMode>(
    () => (sessionStorage.getItem('crm-tasks-view') as ViewMode) || 'list'
  );
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListPaginationMeta | null>(null);
  const listLimit = view === 'kanban' ? 100 : 20;

  useEffect(() => {
    const onTourView = (e: Event) => {
      const next = (e as CustomEvent<{ view?: string }>).detail?.view;
      if (next === 'list' || next === 'kanban') {
        setView(next);
        try {
          sessionStorage.setItem('crm-tasks-view', next);
        } catch {
          /* ignore */
        }
      }
    };
    const onTourExport = (e: Event) => {
      setExportDropdownOpen(Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open));
    };
    const onTourTemplates = (e: Event) => {
      setTemplatesModalOpen(Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open));
    };
    const onTourRecurring = (e: Event) => {
      setRecurringModalOpen(Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open));
    };
    window.addEventListener('crm-tasks-tour-view', onTourView as EventListener);
    window.addEventListener('crm-tasks-tour-export-menu', onTourExport as EventListener);
    window.addEventListener('crm-tasks-tour-templates', onTourTemplates as EventListener);
    window.addEventListener('crm-tasks-tour-recurring', onTourRecurring as EventListener);
    return () => {
      window.removeEventListener('crm-tasks-tour-view', onTourView as EventListener);
      window.removeEventListener('crm-tasks-tour-export-menu', onTourExport as EventListener);
      window.removeEventListener('crm-tasks-tour-templates', onTourTemplates as EventListener);
      window.removeEventListener('crm-tasks-tour-recurring', onTourRecurring as EventListener);
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const nextDue = searchParams.get('due') || '';
    const nextIds = searchParams.get('ids') || '';
    const nextStatus = searchParams.get('status') || '';
    const nextWatching =
      searchParams.get('watching') === 'true' || searchParams.get('watching') === '1' ? 'true' : '';
    const nextClient = searchParams.get('clientFeedbackStatus') || '';
    const nextAssignedTo = searchParams.get('assignedTo') || '';
    const nextProjectId = searchParams.get('projectId') || '';
    setDueFilter((prev) => (prev === nextDue ? prev : nextDue));
    setAttentionIds((prev) => (prev === nextIds ? prev : nextIds));
    setSelectedStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setSelectedWatching((prev) => (prev === nextWatching ? prev : nextWatching));
    setSelectedClientStatus((prev) => (prev === nextClient ? prev : nextClient));
    setAssignedToFilter((prev) => (prev === nextAssignedTo ? prev : nextAssignedTo));
    setSelectedProject((prev) => (prev === nextProjectId ? prev : nextProjectId));
  }, [searchParams]);

  const syncAttentionParams = useCallback(
    (next: {
      due?: string;
      ids?: string;
      status?: string;
      watching?: string;
      clientFeedbackStatus?: string;
      assignedTo?: string;
      projectId?: string;
    }) => {
      const params = new URLSearchParams(searchParams);
      const nextDue = next.due ?? dueFilter;
      const nextIds = next.ids ?? attentionIds;
      const nextStatus = next.status ?? selectedStatus;
      const nextWatching = next.watching ?? selectedWatching;
      const nextClient = next.clientFeedbackStatus ?? selectedClientStatus;
      const nextAssignedTo = next.assignedTo ?? assignedToFilter;
      const nextProjectId = next.projectId ?? selectedProject;
      if (nextDue) params.set('due', nextDue);
      else params.delete('due');
      if (nextIds) params.set('ids', nextIds);
      else params.delete('ids');
      if (nextStatus) params.set('status', nextStatus);
      else params.delete('status');
      if (nextWatching) params.set('watching', nextWatching);
      else params.delete('watching');
      if (nextClient) params.set('clientFeedbackStatus', nextClient);
      else params.delete('clientFeedbackStatus');
      if (nextAssignedTo) params.set('assignedTo', nextAssignedTo);
      else params.delete('assignedTo');
      if (nextProjectId) params.set('projectId', nextProjectId);
      else params.delete('projectId');
      setSearchParams(params, { replace: true });
    },
    [
      attentionIds,
      assignedToFilter,
      dueFilter,
      searchParams,
      selectedClientStatus,
      selectedProject,
      selectedStatus,
      selectedWatching,
      setSearchParams,
    ]
  );

  useEffect(() => {
    syncAttentionParams({ status: selectedStatus });
  }, [selectedStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    syncAttentionParams({ projectId: selectedProject });
  }, [selectedProject]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load projects list for dropdown
  useEffect(() => {
    crmApi
      .listProjects({ limit: 200, view: 'all' })
      .then((res) => setProjects(res.data || []))
      .catch(() => setProjects([]));
  }, []);

  // Update milestones when project filter changes
  useEffect(() => {
    if (!selectedProject) {
      setMilestones([]);
      setSelectedMilestone('');
      return;
    }
    crmApi
      .getProjectMilestones(selectedProject)
      .then((res) => setMilestones(res.data || []))
      .catch(() => setMilestones([]));
  }, [selectedProject]);

  // Load tasks list
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await crmApi.listTasks({
        projectId: selectedProject || undefined,
        milestoneId: selectedMilestone || undefined,
        status: selectedStatus || undefined,
        clientFeedbackStatus: selectedClientStatus || undefined,
        isRecurring: selectedRecurring || undefined,
        watching: selectedWatching || undefined,
        isArchived: selectedArchived || undefined,
        due: dueFilter || undefined,
        overdue: dueFilter === 'overdue' ? true : undefined,
        ids: attentionIds || undefined,
        assignedTo: assignedToFilter || undefined,
        search: debouncedSearch || undefined,
        page: view === 'list' ? page : 1,
        limit: listLimit,
      });
      setItems(response.data || []);
      setPagination(view === 'list' ? response.pagination || null : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [
    selectedProject,
    selectedMilestone,
    selectedStatus,
    selectedClientStatus,
    selectedRecurring,
    selectedWatching,
    selectedArchived,
    dueFilter,
    attentionIds,
    assignedToFilter,
    debouncedSearch,
    page,
    view,
    listLimit,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    selectedProject,
    selectedMilestone,
    selectedStatus,
    selectedClientStatus,
    selectedRecurring,
    selectedWatching,
    selectedArchived,
    dueFilter,
    attentionIds,
    assignedToFilter,
    debouncedSearch,
    view,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const setViewMode = (mode: ViewMode) => {
    setView(mode);
    sessionStorage.setItem('crm-tasks-view', mode);
  };

  // Resend review reminder
  const handleResendReminder = async (taskId: string, title: string) => {
    try {
      const res = await crmApi.sendTaskReminderEmail(taskId);
      showToast(res.message || `Review reminder email sent to client for "${title}"`);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send reminder', 'error');
    }
  };

  // Archive / Restore task
  const handleToggleArchive = async (task: TaskItem) => {
    if (!canManageTasks) return;
    const nextArchived = !task.isArchived;
    try {
      await crmApi.updateTask(task._id, {
        isArchived: nextArchived,
        archivedAt: nextArchived ? new Date().toISOString() : null,
      });
      showToast(nextArchived ? 'Task archived' : 'Task restored from archive');
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Archive failed', 'error');
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!canDelete) return;
    if (!(await confirm({ message: `Delete task "${title}"? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteTask(taskId);
      showToast('Task deleted');
      setItems((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // Data Export (CSV and JSON)
  const handleExport = (format: 'csv' | 'json') => {
    setExportDropdownOpen(false);
    const filename = `tasks-export-${new Date().toISOString().slice(0, 10)}.${format}`;
    if (format === 'json') {
      triggerFileDownload({
        filename,
        content: JSON.stringify(items, null, 2),
        format: 'json',
      });
      showToast('Exported tasks to JSON');
      return;
    }

    const headers = [
      'Title',
      'Project',
      'Milestone',
      'Status',
      'Priority',
      'Client Status',
      'Client Notes',
      'Assigned To',
      'Due Date',
      'Subtasks Done',
      'Subtasks Total',
      'Is Recurring',
      'Recurring Interval',
      'Is Archived',
      'Description',
    ];

    const escapeCsv = (str: string | undefined | null) => {
      const s = String(str || '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = items.map((t) => [
      escapeCsv(t.title),
      escapeCsv(t.projectName),
      escapeCsv(t.milestoneTitle),
      escapeCsv(t.status),
      escapeCsv(t.priority),
      escapeCsv(t.clientFeedbackStatus || 'Pending Review'),
      escapeCsv(t.clientFeedbackNotes),
      escapeCsv(t.assignedUsername || t.assigneeName),
      escapeCsv(t.dueDate),
      t.subtasksCompletedCount || 0,
      t.subtaskCount || 0,
      t.isRecurring ? 'Yes' : 'No',
      escapeCsv(t.recurringInterval || t.interval || ''),
      t.isArchived ? 'Yes' : 'No',
      escapeCsv(t.description),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    triggerFileDownload({
      filename,
      content: csvContent,
      format: 'csv',
    });
    showToast('Exported tasks to CSV');
  };

  // Update task status
  const handleStatusChange = async (taskId: string, nextStatus: string) => {
    if (!canWrite) return;
    try {
      const res = await crmApi.updateTask(taskId, { status: nextStatus });
      setItems((prev) =>
        prev.map((item) =>
          item._id === taskId ? { ...item, ...(res.data || {}), status: nextStatus } : item
        )
      );
      showToast(res.message || `Status updated to ${nextStatus}`);
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Failed to update status', 'error');
    }
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: items.length,
      inProgress: items.filter((t) => t.status === 'In Progress').length,
      completed: items.filter((t) => t.status === 'Completed').length,
      overdue: items.filter(
        (t) => t.dueDate && t.dueDate < today && t.status !== 'Completed'
      ).length,
    };
  }, [items]);

  // Priority Badge Helper
  const renderPriorityBadge = (priority: TaskPriority) => {
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
  };

  // Client Review Badge Helper
  const renderClientReviewBadge = (status?: string, notes?: string) => {
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
  };

  // Email Notification & Reminder Badge Helper (matching old CRM)
  const renderEmailNotificationBadge = (t: TaskItem, reminderHours = 24) => {
    if (!t) return null;

    if (t.clientNotifiedAt) {
      const sentDate = new Date(t.clientNotifiedAt).toLocaleString();
      const email = t.clientNotifiedEmail || 'client';
      const hoursAgo = Math.max(
        0,
        (Date.now() - new Date(t.clientNotifiedAt).getTime()) / (1000 * 60 * 60)
      );
      const hasClientReplied = t.clientFeedbackStatus === 'Satisfied';
      const isOverThreshold = hoursAgo >= reminderHours;

      if (!hasClientReplied && isOverThreshold) {
        return (
          <div className="inline-flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
              title={`Notification email sent to ${email} on ${sentDate} (${Math.floor(hoursAgo)}h ago)`}
            >
              Sent
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleResendReminder(t._id, t.title);
              }}
              className="inline-flex cursor-pointer items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
              title={`Client has not replied for over ${reminderHours} hours (sent ${Math.floor(hoursAgo)}h ago). Click to resend reminder email.`}
            >
              Resend ({reminderHours}h+)
            </button>
          </div>
        );
      }

      const timeAgoLabel = hoursAgo < 1 ? 'Just now' : `${Math.floor(hoursAgo)}h ago`;
      return (
        <span
          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
          title={`Notification email sent to ${email} on ${sentDate} (${timeAgoLabel})`}
        >
          Sent ({timeAgoLabel})
        </span>
      );
    }

    if (t.status === 'Completed') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleResendReminder(t._id, t.title);
          }}
          className="inline-flex cursor-pointer items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 transition-colors hover:bg-sky-100"
          title="Send completion review email to client"
        >
          Send Email
        </button>
      );
    }

    if (t.notifyClientOnCompletion) {
      return (
        <span
          className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800"
          title="Auto-email enabled: Will notify client when marked Completed"
        >
          Auto-Email
        </span>
      );
    }

    return null;
  };

  return (
    <div data-tour="tasks-tour-landing" className="flex flex-col gap-5">
      {/* Toast */}
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

      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Delivery
          </p>
          <h1 className="m-0 text-2xl font-bold text-zinc-950">Tasks</h1>
          <p className="m-0 mt-1 text-sm text-zinc-500">
            View, assign, and track deliverables &amp; milestones across all client projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TourButton
            moduleId="tasks"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-950 cursor-pointer hover:bg-amber-100"
          />
          <div className="relative" data-tour="tasks-export-btn">
            <button
              type="button"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className={btnSecondary}
            >
              <FileDownloadIcon sx={{ fontSize: 15 }} />
              Export
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg">
                <button
                  type="button"
                  data-tour="tasks-export-csv"
                  onClick={() => handleExport('csv')}
                  className="block w-full cursor-pointer border-0 bg-white px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  data-tour="tasks-export-json"
                  onClick={() => handleExport('json')}
                  className="block w-full cursor-pointer border-0 bg-white px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>

          {canManageTasks && (
            <button
              type="button"
              data-tour="tasks-templates-btn"
              onClick={() => setTemplatesModalOpen(true)}
              className={btnSecondary}
            >
              Templates
            </button>
          )}

          {canManageTasks && (
            <button
              type="button"
              data-tour="tasks-recurring-btn"
              onClick={() => setRecurringModalOpen(true)}
              className={btnSecondary}
            >
              Recurring
            </button>
          )}

          {canAddTask && (
            <Link to="/tasks/create" data-tour="tasks-create-btn" className={btnPrimary}>
              <AddIcon sx={{ fontSize: 18 }} />
              Add Task
            </Link>
          )}
        </div>
      </header>

      {/* KPI cards */}
      <div data-tour="tasks-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Tasks', value: kpis.total },
          { label: 'In Progress', value: kpis.inProgress },
          { label: 'Completed', value: kpis.completed },
          { label: 'Overdue', value: kpis.overdue, isAlert: kpis.overdue > 0 },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {card.label}
            </div>
            <div
              className={`mt-1 text-lg font-bold ${
                card.isAlert ? 'text-red-600' : 'text-zinc-950'
              }`}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div data-tour="tasks-view-tabs" className="inline-flex self-start rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          <button
            type="button"
            data-tour="tasks-tab-list"
            onClick={() => setViewMode('list')}
            className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border-0 px-3 text-xs font-semibold ${
              view === 'list' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
            }`}
          >
            <ViewListIcon sx={{ fontSize: 15 }} /> List
          </button>
          <button
            type="button"
            data-tour="tasks-tab-kanban"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border-0 px-3 text-xs font-semibold ${
              view === 'kanban' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
            }`}
          >
            <ViewKanbanIcon sx={{ fontSize: 15 }} /> Kanban
          </button>
        </div>
      </div>

      {/* Filters */}
      <section data-tour="tasks-filters" className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
        {assignedToFilter ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            <span>
              Filtered by assignee from report:{' '}
              <span className="font-mono font-semibold text-zinc-950">{assignedToFilter}</span>
            </span>
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-zinc-300 bg-white px-2 text-[11px] font-semibold text-zinc-800 cursor-pointer"
              onClick={() => {
                setAssignedToFilter('');
                syncAttentionParams({ assignedTo: '' });
              }}
            >
              Clear assignee
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[140px] flex-col gap-1">
            <span className={labelClass}>Project</span>
            <select
              className={fieldClass}
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[140px] flex-col gap-1">
            <span className={labelClass}>Milestone</span>
            <select
              className={fieldClass}
              value={selectedMilestone}
              onChange={(e) => {
                setSelectedMilestone(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Milestones</option>
              <option value="none">No Milestone / General Tasks</option>
              {milestones.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[120px] flex-col gap-1">
            <span className={labelClass}>Status</span>
            <select
              className={fieldClass}
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[140px] flex-col gap-1">
            <span className={labelClass}>Due</span>
            <select
              className={fieldClass}
              value={dueFilter}
              onChange={(e) => {
                const nextDue = e.target.value;
                setDueFilter(nextDue);
                setAttentionIds('');
                setPage(1);
                syncAttentionParams({ due: nextDue, ids: '' });
              }}
            >
              <option value="">All due dates</option>
              <option value="open">Open (not completed)</option>
              <option value="today">Due today</option>
              <option value="overdue">Overdue only</option>
            </select>
          </label>
          {attentionIds ? (
            <button
              type="button"
              onClick={() => {
                setAttentionIds('');
                syncAttentionParams({ ids: '' });
                setPage(1);
              }}
              className="mt-5 h-9 cursor-pointer rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Showing Attention Radar selection · Clear
            </button>
          ) : null}
          <label className="flex min-w-[140px] flex-col gap-1">
            <span className={labelClass}>Client Status</span>
            <select
              className={fieldClass}
              value={selectedClientStatus}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedClientStatus(next);
                setPage(1);
                syncAttentionParams({ clientFeedbackStatus: next });
              }}
            >
              <option value="">All Client Statuses</option>
              {TASK_CLIENT_STATUSES.map((cs) => (
                <option key={cs} value={cs}>
                  {cs}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[120px] flex-col gap-1">
            <span className={labelClass}>Recurrence</span>
            <select
              className={fieldClass}
              value={selectedRecurring}
              onChange={(e) => {
                setSelectedRecurring(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Tasks</option>
              <option value="true">Recurring Only</option>
              <option value="false">One-Time Only</option>
            </select>
          </label>

          <label className="flex min-w-[120px] flex-col gap-1">
            <span className={labelClass}>Watching</span>
            <select
              className={fieldClass}
              value={selectedWatching}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedWatching(next);
                setPage(1);
                syncAttentionParams({ watching: next });
              }}
            >
              <option value="">All Tasks</option>
              <option value="true">Watching Only</option>
            </select>
          </label>

          <label className="flex min-w-[140px] flex-col gap-1">
            <span className={labelClass}>Archive</span>
            <select
              className={fieldClass}
              value={selectedArchived}
              onChange={(e) => {
                setSelectedArchived(e.target.value);
                setPage(1);
              }}
            >
              <option value="false">Active Only</option>
              <option value="true">Archived Only</option>
              <option value="all">All (Active &amp; Archived)</option>
            </select>
          </label>

          <div className="relative min-w-[200px] flex-1">
            <span className={`${labelClass} mb-1 block`}>Search</span>
            <div className="relative">
              <input
                type="search"
                className={`${fieldClass} w-full pl-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Task title, project, assignee…"
              />
              <SearchIcon
                sx={{ fontSize: 16 }}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />
            </div>
          </div>

          <button type="button" onClick={() => void load()} className={btnSecondary}>
            <RefreshIcon sx={{ fontSize: 15 }} />
            Refresh
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Main Content Area: List View vs Kanban View */}
      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500 animate-pulse">
          Loading tasks…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-zinc-900 m-0 mb-1">No tasks found</p>
          <p className="text-xs text-zinc-500 m-0">
            {canManageTasks
              ? 'Adjust filters or click "+ Add Task" to create a new one.'
              : 'Adjust filters or ask your project team if you need a new task.'}
          </p>
        </div>
      ) : view === 'list' ? (
        /* 1. TASK LISTING TABLE WITH EXACT COLUMNS */
        <div data-tour="tasks-table" className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th data-tour="tasks-col-title" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Task Title
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Project
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Milestone
                  </th>
                  <th data-tour="tasks-col-status" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Client Review
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Assigned To
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Due Date
                  </th>
                  <th data-tour="tasks-col-actions" className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, rowIdx) => {
                  const isOverdue =
                    item.dueDate &&
                    new Date(item.dueDate) < new Date() &&
                    item.status !== 'Completed';
                  const userInitial = (item.assignedUsername || item.assigneeName || 'U')
                    .charAt(0)
                    .toUpperCase();
                  const subDone = item.subtasksCompletedCount || 0;
                  const subTotal = item.subtaskCount || 0;

                  return (
                    <tr
                      key={item._id}
                      data-task-id={item._id}
                      {...(rowIdx === 0 ? { 'data-tour': 'tasks-row-first' } : {})}
                      className="border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors"
                    >
                      {/* Column 1: Task Title */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                              to={`/tasks/${item._id}`}
                              className="cursor-pointer text-sm font-semibold text-zinc-950 no-underline hover:underline"
                            >
                              {item.title}
                            </Link>

                            {/* Subtasks Count Badge */}
                            {subTotal > 0 ? (
                              <span
                                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  subDone === subTotal
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-zinc-200 bg-zinc-100 text-zinc-700'
                                }`}
                              >
                                {subDone}/{subTotal} subtasks
                              </span>
                            ) : null}

                            {/* Recurring Badge */}
                            {item.isRecurring && (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                                Recurring
                              </span>
                            )}

                            {/* Dependency Badge */}
                            {item.dependsOnTaskTitle && (
                              <span
                                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  item.isDependencyBlocked
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-zinc-200 bg-zinc-100 text-zinc-700'
                                }`}
                                title={`Depends on: ${item.dependsOnTaskTitle}`}
                              >
                                {item.isDependencyBlocked ? 'Blocked by' : 'Depends on'}:{' '}
                                {item.dependsOnTaskTitle}
                              </span>
                            )}

                            {/* Archived Badge */}
                            {item.isArchived && (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                Archived
                              </span>
                            )}

                            {/* Watchers Count */}
                            {item.followerCount && item.followerCount > 0 ? (
                              <span
                                className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                                title={`${item.followerCount} member(s) watching`}
                              >
                                {item.followerCount} watching
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Project */}
                      <td className="px-4 py-3 text-sm">
                        {item.projectId ? (
                          <Link
                            to={`/projects/${item.projectId}`}
                            className="font-medium text-zinc-800 no-underline hover:underline"
                          >
                            {displayLabel(item.projectName)}
                          </Link>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Column 3: Milestone */}
                      <td className="px-4 py-3 text-sm">
                        {item.milestoneTitle ? (
                          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                            {item.milestoneTitle}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Column 4: Status */}
                      <td className="px-4 py-3">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item._id, e.target.value)}
                          disabled={!canWrite}
                          className="h-7 px-2 text-xs font-semibold rounded-md border border-zinc-200 bg-white text-zinc-800 outline-none cursor-pointer focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Column 5: Priority */}
                      <td className="px-4 py-3">{renderPriorityBadge(item.priority)}</td>

                      {/* Column 6: Client Review */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {renderClientReviewBadge(
                            item.clientFeedbackStatus,
                            item.clientFeedbackNotes
                          )}
                          {renderEmailNotificationBadge(item)}
                        </div>
                      </td>

                      {/* Column 7: Assigned To */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {userInitial}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {displayUserLabel(item.assigneeName || item.assignedUsername, item.assignedUsername || item.assignedTo, 'Unassigned')}
                          </span>
                        </div>
                      </td>

                      {/* Column 8: Due Date */}
                      <td className="px-4 py-3 text-sm">
                        {item.dueDate ? (
                          <div
                            className={`inline-flex items-center gap-1 font-medium ${
                              isOverdue ? 'font-semibold text-red-600' : 'text-zinc-700'
                            }`}
                          >
                            <span>{new Date(item.dueDate).toLocaleDateString()}</span>
                            {isOverdue && (
                              <span className="text-[10px] font-semibold uppercase text-red-600">
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Column 9: Actions */}
                      <td className="px-4 py-3 text-xs text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {canManageTasks && item.clientFeedbackStatus !== 'Satisfied' && (
                            <button
                              type="button"
                              onClick={() => handleResendReminder(item._id, item.title)}
                              className="p-1 rounded text-zinc-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 cursor-pointer transition-colors"
                              title="Resend Client Review Reminder"
                            >
                              <SendIcon sx={{ fontSize: 13 }} />
                            </button>
                          )}
                          <Link
                            to={`/tasks/${item._id}`}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer"
                            title="View task"
                          >
                            <EditOutlinedIcon sx={{ fontSize: 14 }} />
                          </Link>
                          {canManageTasks && (
                            <button
                              type="button"
                              onClick={() => handleToggleArchive(item)}
                              className="p-1 rounded text-zinc-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer border-none bg-transparent"
                              title={item.isArchived ? 'Restore task' : 'Archive task'}
                            >
                              {item.isArchived ? (
                                <UnarchiveOutlinedIcon sx={{ fontSize: 14 }} />
                              ) : (
                                <ArchiveOutlinedIcon sx={{ fontSize: 14 }} />
                              )}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(item._id, item.title)}
                              className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer border-none bg-transparent"
                              title="Delete task"
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ListPager pagination={pagination} onPageChange={setPage} label="tasks" />
        </div>
      ) : (
        <TaskKanbanView
          tasks={items}
          canWrite={canWrite}
          onOpenTask={(task) => navigate(`/tasks/${task._id}`)}
          onMoveStatus={(taskId, nextStatus) => void handleStatusChange(taskId, nextStatus)}
          onResendReminder={(taskId, title) => void handleResendReminder(taskId, title)}
        />
      )}

      {/* Task Templates Studio Modal */}
      <TaskTemplateModal
        open={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onTaskCreated={() => void load()}
        showToast={showToast}
      />

      {/* Recurring Tasks Automation Modal */}
      <RecurringTasksModal
        open={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        onOpenCreateRecurring={() => {
          setRecurringModalOpen(false);
          navigate('/tasks/create?recurring=true');
        }}
        showToast={showToast}
      />
    </div>
  );
};
export default TasksPage;
