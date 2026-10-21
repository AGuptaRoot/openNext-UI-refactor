import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { Check } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { crmApi } from '../../services/api';
import { DocumentUploadControl } from '../../components/common/DocumentUploadControl';
import { downloadAttachment } from '../../components/common/AttachmentPreviewModal';
import { displayUserLabel } from '../../utils/displayLabels';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { formatCrmMoney } from '../../utils/currency';
import { canFullyManageTasks } from '../../utils/permissions';
import {
  CLIENT_FEEDBACK_STATUSES,
  DEFAULT_DOC_CATEGORIES,
  DEFAULT_TASK_STATUSES,
  PROJECT_MILESTONE_STATUSES,
  ProjectActivityEntry,
  ProjectDocument,
  ProjectExpense,
  ProjectItem,
  ProjectMember,
  ProjectMilestone,
  ProjectOverview,
  ProjectTaskSummary,
  ProjectTimeLog,
  isLiveProjectStatus,
  priorityBadgeClass,
  statusBadgeClass,
} from '../../types/projects';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types/expenses';
import { AssignableUser } from '../../types/leads';
import { ProjectGanttChart } from '../../components/projects/ProjectGanttChart';
import { LiveLinkModal } from '../../components/projects/LiveLinkModal';

type TabId =
  | 'overview'
  | 'members'
  | 'milestones'
  | 'tasks'
  | 'board'
  | 'gantt'
  | 'time'
  | 'expenses'
  | 'documents'
  | 'activity';


type TaskModalState = Partial<ProjectTaskSummary>;

type MilestoneFormState = {
  title: string;
  cost: string;
  addCostToBudget: boolean;
  status: string;
  startDate: string;
  endDate: string;
  summary: string;
};

const fieldClass =
  'h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white';

const btnSecondary =
  'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const btnPrimary =
  'inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed';

const btnDanger =
  'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const emptyMilestoneForm = (): MilestoneFormState => ({
  title: '',
  cost: '',
  addCostToBudget: false,
  status: 'Pending',
  startDate: '',
  endDate: '',
  summary: '',
});

const emptyTaskModal = (): TaskModalState => ({
  title: '',
  status: 'To Do',
  priority: 'Medium',
  milestoneId: '',
  dependsOnTaskId: '',
  assigneeId: '',
  dueDate: '',
  startDate: '',
  notifyClientOnCompletion: false,
  isRecurring: false,
  every: 1,
  interval: 'week',
  cycles: 0,
  clientFeedbackStatus: 'Pending Review',
  description: '',
});

function formatMoney(value?: number, currency?: string) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return formatCrmMoney(value, currency, { maximumFractionDigits: 0 });
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatLogDate(val?: string | Date | null): { date: string; sub: string; tooltip: string } {
  if (!val) return { date: '—', sub: '', tooltip: 'No date recorded' };
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) {
    return { date: String(val).slice(0, 10), sub: '', tooltip: String(val) };
  }
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()] || '';
  const year = d.getFullYear();
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = weekdayNames[d.getDay()] || '';

  return {
    date: `${day} ${month} ${year}`,
    sub: weekday,
    tooltip: d.toLocaleDateString('en-US', { dateStyle: 'full' }),
  };
}

function userOptionId(u: AssignableUser) {
  return u.id || u._id || u.userId || '';
}

function userOptionLabel(u: AssignableUser) {
  const label = u.displayName || u.name || u.username || (u.email ? u.email.split('@')[0] : '');
  if (label && !/^[0-9a-fA-F]{24}$/.test(label)) return label;
  return 'Team Member';
}

/** Linked URL docs (Link URL form) vs uploaded binary files. */
function isProjectDocumentExternalLink(doc: ProjectDocument): boolean {
  const provider = String(doc.storageProvider || '')
    .trim()
    .toLowerCase();
  if (provider === 'external' || provider === 'link' || provider === 'url') return true;
  const url = String(doc.url || '').trim();
  if (!url) return false;
  // Fallback for older records without storageProvider
  if (!provider && /^https?:\/\//i.test(url) && !Number(doc.size || 0)) {
    const looksLikeMedia =
      /\/api\/plugins\/s3-media-plugin\//i.test(url) || /\/media\//i.test(url);
    return !looksLikeMedia;
  }
  return false;
}

export const ProjectDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isClient, activeRole, user, isAdmin } = useAuth();
  const { confirm } = useDialog();

  const canRead = hasPermission('crm.projects.read');
  const canWrite = hasPermission('crm.projects.write') && !isClient;
  const canDelete = hasPermission('crm.projects.delete') && !isClient;
  const canTaskStatus = hasPermission('crm.tasks.write') && !isClient;
  const canTaskWrite = canFullyManageTasks({
    hasTaskWrite:
      (hasPermission('crm.tasks.write') || hasPermission('crm.projects.write')) && !isClient,
    isClient,
    activeRole,
  });
  const canTimeWrite = (hasPermission('crm.time.write') || hasPermission('crm.projects.write')) && !isClient;
  const canExpenseWrite = (hasPermission('crm.expenses.write') || hasPermission('crm.projects.write')) && !isClient;
  const canExpenseApprove = hasPermission('crm.expenses.approve');
  const settingsCurrency = useDefaultCurrency();

  const [tab, setTab] = useState<TabId>('overview');

  useEffect(() => {
    const onTourTab = (e: Event) => {
      const next = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (!next) return;
      const allowed: TabId[] = [
        'overview',
        'members',
        'milestones',
        'tasks',
        'board',
        'gantt',
        'time',
        'expenses',
        'documents',
        'activity',
      ];
      if (allowed.includes(next as TabId)) setTab(next as TabId);
    };
    window.addEventListener('crm-projects-tour-tab', onTourTab as EventListener);
    return () => window.removeEventListener('crm-projects-tour-tab', onTourTab as EventListener);
  }, []);

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [tasks, setTasks] = useState<ProjectTaskSummary[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [allDocuments, setAllDocuments] = useState<ProjectDocument[]>([]);
  const [activity, setActivity] = useState<ProjectActivityEntry[]>([]);
  const [timeLogs, setTimeLogs] = useState<ProjectTimeLog[]>([]);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const currentUserId = String(
    user?.userId || (user as { id?: string; _id?: string } | null)?.id || (user as { _id?: string } | null)?._id || ''
  ).trim();

  const isLeadRoleToken = (role?: string) => {
    const token = String(role || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
    return ['lead', 'leader', 'owner', 'manager', 'project-lead', 'project-leader', 'projectlead'].includes(
      token
    );
  };

  const isPlatformAdmin =
    Boolean(isAdmin || user?.isAdmin || (user as { isSuperAdmin?: boolean } | null)?.isSuperAdmin) ||
    ['superadmin', 'super-admin', 'admin', '0', '1', '100', 'tenant-admin'].includes(
      String(activeRole || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
    );

  /** Only project leaders (and platform admins) can create/edit/delete milestones. */
  const canManageMilestones = useMemo(() => {
    if (!canWrite) return false;
    if (isPlatformAdmin) return true;
    if (!currentUserId || !project) return false;
    if (String(project.createdBy || '').trim() === currentUserId) return true;
    const assigned = Array.isArray(project.assignedTo)
      ? project.assignedTo
      : project.assignedTo
        ? [project.assignedTo]
        : [];
    if (assigned.some((entry) => String(entry || '').trim() === currentUserId)) return true;
    const me = members.find((m) => String(m.userId || '').trim() === currentUserId);
    return isLeadRoleToken(me?.role);
  }, [canWrite, isPlatformAdmin, currentUserId, project, members]);

  // Task filters
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [taskMilestoneFilter, setTaskMilestoneFilter] = useState('');
  const [taskFeedbackFilter, setTaskFeedbackFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');

  // Docs / activity / expenses filters
  const [docCategory, setDocCategory] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('');


  // Lifecycle
  const [dropReason, setDropReason] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [liveLinkModalOpen, setLiveLinkModalOpen] = useState(false);

  // Members form
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRate, setMemberRate] = useState('0');
  const [editingRateUserId, setEditingRateUserId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');

  // Milestone form
  const [msForm, setMsForm] = useState<MilestoneFormState>(emptyMilestoneForm);

  // Task modal
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);

  // Time log form & modal
  const [tlTaskId, setTlTaskId] = useState('');
  const [tlUserId, setTlUserId] = useState('');
  const [tlDate, setTlDate] = useState(new Date().toISOString().slice(0, 10));
  const [tlHours, setTlHours] = useState('1');
  const [tlBillable, setTlBillable] = useState(true);
  const [tlHourlyRate, setTlHourlyRate] = useState('0');
  const [tlNote, setTlNote] = useState('');
  const [timeLogModalOpen, setTimeLogModalOpen] = useState(false);
  const [tlFilterMember, setTlFilterMember] = useState('all');
  const [tlFilterBillable, setTlFilterBillable] = useState<'all' | 'billable' | 'non-billable'>('all');
  const [tlSearch, setTlSearch] = useState('');

  // Document forms
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docCat, setDocCat] = useState('General');
  const [docDescription, setDocDescription] = useState('');
  const [docMilestoneId, setDocMilestoneId] = useState('');
  const [docTaskId, setDocTaskId] = useState('');
  const [uploadingDoc] = useState(false);
  const [docLinkSaving, setDocLinkSaving] = useState(false);

  const isReadOnly = Boolean(project?.isArchived || project?.isDropped);
  const currency = overview?.currency || project?.currency || settingsCurrency;

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadCore = useCallback(async () => {
    if (!id || !canRead) return;
    setLoading(true);
    try {
      const [p, o] = await Promise.all([
        crmApi.getProject(id),
        crmApi.getProjectOverview(id),
      ]);
      setProject(p.data);
      setOverview(o.data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load project', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, canRead, showToast]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  // Prefetch tasks + milestones (+ members for header team) for smooth tab switches
  useEffect(() => {
    if (!id || !canRead) return;
    let cancelled = false;
    (async () => {
      try {
        const [t, m, mem] = await Promise.all([
          crmApi.getProjectTasks(id, { limit: 100 }),
          crmApi.getProjectMilestones(id),
          crmApi.getProjectMembers(id).catch(() => ({ data: [] as ProjectMember[] })),
        ]);
        if (!cancelled) {
          setTasks(t.data || []);
          setMilestones(m.data || []);
          setMembers(mem.data || []);
        }
      } catch {
        // Prefetch failures are non-blocking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, canRead]);

  const refreshTasks = useCallback(async () => {
    if (!id) return;
    const t = await crmApi.getProjectTasks(id, { limit: 100 });
    setTasks(t.data || []);
  }, [id]);

  const refreshMilestones = useCallback(async () => {
    if (!id) return;
    const m = await crmApi.getProjectMilestones(id);
    setMilestones(m.data || []);
  }, [id]);

  const refreshMembers = useCallback(async () => {
    if (!id) return;
          const [m, u] = await Promise.all([
            crmApi.getProjectMembers(id),
            crmApi.getAssignableUsers().catch(() => ({ data: [] as AssignableUser[] })),
          ]);
            setMembers(m.data || []);
            setUsers(u.data || []);
  }, [id]);

  const refreshDocuments = useCallback(async () => {
    if (!id) return;
    const [filtered, all] = await Promise.all([
      crmApi.getProjectDocuments(id, { category: docCategory || undefined }),
      crmApi.getProjectDocuments(id),
    ]);
    setDocuments(filtered.data || []);
    setAllDocuments(all.data || []);
  }, [id, docCategory]);

  const refreshTimeLogs = useCallback(async () => {
    if (!id) return;
    const t = await crmApi.getTimeLogs({ projectId: id, limit: 100 });
    setTimeLogs(t.data || []);
  }, [id]);

  const refreshExpenses = useCallback(async () => {
    if (!id) return;
    const e = await crmApi.getExpenses({
      projectId: id,
      category: expenseCategoryFilter || undefined,
      limit: 100,
    });
    setExpenses(e.data || []);
  }, [id, expenseCategoryFilter]);

  const refreshActivity = useCallback(async () => {
    if (!id) return;
    const a = await crmApi.getProjectActivity(id);
    setActivity(a.data || []);
  }, [id]);

  useEffect(() => {
    if (!id || !canRead) return;
    let cancelled = false;
    (async () => {
      try {
        if (tab === 'members') {
          await refreshMembers();
        } else if (tab === 'milestones') {
          await refreshMilestones();
        } else if (tab === 'tasks' || tab === 'board' || tab === 'gantt') {
          await refreshTasks();
          if (milestones.length === 0) await refreshMilestones();
          if (tab !== 'board' && members.length === 0) {
            const m = await crmApi.getProjectMembers(id);
            if (!cancelled) setMembers(m.data || []);
          }
        } else if (tab === 'documents') {
          if (milestones.length === 0) await refreshMilestones();
          if (tasks.length === 0) await refreshTasks();
          await refreshDocuments();
        } else if (tab === 'activity') {
          await refreshActivity();
        } else if (tab === 'time') {
          if (tasks.length === 0) await refreshTasks();
          if (members.length === 0) await refreshMembers();
          await refreshTimeLogs();
        } else if (tab === 'expenses' && !isClient) {
          await refreshExpenses();
        } else if (tab === 'overview') {
          const o = await crmApi.getProjectOverview(id);
          if (!cancelled) setOverview(o.data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : 'Failed to load tab data', 'error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional tab-driven loads
  }, [tab, id, canRead, docCategory, expenseCategoryFilter, isClient]);

  const tabs: { id: TabId; label: string; hide?: boolean }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members' },
    { id: 'milestones', label: 'Milestones' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'board', label: 'Board' },
    { id: 'gantt', label: 'Gantt' },
    { id: 'time', label: 'Time' },
    { id: 'expenses', label: 'Expenses', hide: isClient },
    { id: 'documents', label: 'Documents' },
    { id: 'activity', label: 'Activity' },
  ];

  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) => !t.isArchived);
    if (taskStatusFilter) list = list.filter((t) => t.status === taskStatusFilter);
    if (taskMilestoneFilter) list = list.filter((t) => t.milestoneId === taskMilestoneFilter);
    if (taskFeedbackFilter) {
      list = list.filter((t) => (t.clientFeedbackStatus || '') === taskFeedbackFilter);
    }
    if (taskSearch.trim()) {
      const q = taskSearch.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.assigneeName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [tasks, taskStatusFilter, taskMilestoneFilter, taskFeedbackFilter, taskSearch]);


  const filteredActivity = useMemo(() => {
    if (!activitySearch.trim()) return activity;
    const q = activitySearch.trim().toLowerCase();
    return activity.filter(
      (a) =>
        a.message.toLowerCase().includes(q) ||
        (a.userName || '').toLowerCase().includes(q) ||
        (a.action || '').toLowerCase().includes(q)
    );
  }, [activity, activitySearch]);

  const docCategoryMetrics = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of DEFAULT_DOC_CATEGORIES) counts[cat] = 0;
    for (const d of allDocuments) {
      const cat = d.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [allDocuments]);

  const taskBreakdownBars = useMemo(() => {
    if (overview?.taskBreakdown && Object.keys(overview.taskBreakdown).length) {
      return Object.entries(overview.taskBreakdown);
    }
    const stats = overview?.taskStats;
    if (!stats) return [] as [string, number][];
    return [
      ['Completed', stats.completed || 0],
      ['In Progress', stats.inProgress || 0],
      ['Overdue', stats.overdue || 0],
      ['Total', stats.total || 0],
    ];
  }, [overview]);

  const maxBreakdown = useMemo(
    () => Math.max(1, ...taskBreakdownBars.map(([, n]) => Number(n) || 0)),
    [taskBreakdownBars]
  );

  const maxHoursByUser = useMemo(() => {
    const rows = overview?.hoursByUser || [];
    return Math.max(1, ...rows.map((r) => Number(r.hours) || 0));
  }, [overview]);

  const clientFeedbackOptions = useMemo(() => {
    if (isClient) return ['Satisfied', 'Dissatisfied'] as const;
    return CLIENT_FEEDBACK_STATUSES;
  }, [isClient]);

  const isHexId = (val?: string) => Boolean(val && /^[0-9a-fA-F]{24}$/.test(val));

  const getMemberDisplayName = useCallback(
    (m: ProjectMember): string => {
      // 1. Check member object's own direct name fields
      const candidates = [
        m.displayName,
        m.userName,
        (m as unknown as { username?: string }).username,
        (m as unknown as { name?: string }).name,
      ];
      for (const cand of candidates) {
        if (cand && !isHexId(cand) && cand !== m.userId) {
          return cand;
        }
      }

      // 2. Look up in loaded users list by userId / _id / id
      const matchedUser = users.find((u) => {
        const uid = userOptionId(u);
        return uid && (uid === m.userId || String(u._id) === m.userId || String(u.id) === m.userId);
      });
      if (matchedUser) {
        const uLabel = matchedUser.displayName || matchedUser.name || matchedUser.username;
        if (uLabel && !isHexId(uLabel)) return uLabel;
        if (matchedUser.email) return matchedUser.email.split('@')[0];
      }

      // 3. Fall back to email prefix if available
      if (m.email && m.email.includes('@')) {
        return m.email.split('@')[0];
      }

      // 4. Default friendly fallback - NEVER return an ID
      return 'Team Member';
    },
    [users]
  );

  const getMemberEmail = useCallback(
    (m: ProjectMember): string | undefined => {
      if (m.email && !isHexId(m.email)) return m.email;
      const matchedUser = users.find((u) => {
        const uid = userOptionId(u);
        return uid && (uid === m.userId || String(u._id) === m.userId || String(u.id) === m.userId);
      });
      return matchedUser?.email;
    },
    [users]
  );

  const getMemberRole = useCallback(
    (m: ProjectMember): string => {
      if (m.role && m.role !== '—' && !isHexId(m.role)) return m.role;
      const matchedUser = users.find((u) => {
        const uid = userOptionId(u);
        return uid && (uid === m.userId || String(u._id) === m.userId || String(u.id) === m.userId);
      });
      return matchedUser?.designation || matchedUser?.role || 'Member';
    },
    [users]
  );

  const teamNames = useMemo(() => {
    if (members.length) return members.map((m) => getMemberDisplayName(m)).filter(Boolean);
    return [];
  }, [members, getMemberDisplayName]);

  const timeLogStats = useMemo(() => {
    let totalHours = 0;
    let billableHours = 0;
    let totalBillableAmount = 0;

    for (const tl of timeLogs) {
      const h = Number(tl.hours) || 0;
      totalHours += h;
      const isBill = tl.isBillable !== undefined ? Boolean(tl.isBillable) : Boolean(tl.billable);
      if (isBill) {
        billableHours += h;
        totalBillableAmount += h * (Number(tl.hourlyRate) || 0);
      }
    }

    const nonBillableHours = totalHours - billableHours;
    const billablePercent = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      billableHours: Math.round(billableHours * 100) / 100,
      nonBillableHours: Math.round(nonBillableHours * 100) / 100,
      billablePercent,
      totalBillableAmount: Math.round(totalBillableAmount),
      count: timeLogs.length,
    };
  }, [timeLogs]);

  const filteredTimeLogs = useMemo(() => {
    return timeLogs.filter((tl) => {
      const isBill = tl.isBillable !== undefined ? Boolean(tl.isBillable) : Boolean(tl.billable);
      if (tlFilterMember !== 'all' && tl.userId !== tlFilterMember) return false;
      if (tlFilterBillable === 'billable' && !isBill) return false;
      if (tlFilterBillable === 'non-billable' && isBill) return false;
      if (tlSearch.trim()) {
        const q = tlSearch.trim().toLowerCase();
        const m = members.find((x) => x.userId === tl.userId);
        const memberName = m ? getMemberDisplayName(m).toLowerCase() : (tl.userName || '').toLowerCase();
        const taskTitle = (tl.taskTitle || '').toLowerCase();
        const note = (tl.description || tl.note || '').toLowerCase();
        const dateStr = (tl.workDate || tl.date || '').toLowerCase();
        if (!memberName.includes(q) && !taskTitle.includes(q) && !note.includes(q) && !dateStr.includes(q)) return false;
      }
      return true;
    });
  }, [timeLogs, tlFilterMember, tlFilterBillable, tlSearch, members, getMemberDisplayName]);

  const openTimeLogModal = (presetTaskId?: string) => {
    setTlTaskId(presetTaskId || tasks[0]?._id || '');
    const firstMember = members[0];
    setTlUserId(firstMember?.userId || '');
    setTlDate(new Date().toISOString().slice(0, 10));
    setTlHours('1');
    setTlBillable(true);
    setTlHourlyRate(String(firstMember?.hourlyRate || 0));
    setTlNote('');
    setTimeLogModalOpen(true);
  };

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  const handleArchiveToggle = async () => {
    if (!project || !canWrite) return;
    try {
      if (project.isArchived) {
        await crmApi.restoreProject(project._id);
        showToast('Project restored');
      } else {
        await crmApi.archiveProject(project._id);
        showToast('Project archived');
      }
      await loadCore();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    }
  };

  const confirmDrop = async () => {
    if (!project || !canDelete) return;
    try {
      await crmApi.dropProject(project._id, { reason: dropReason.trim() || undefined });
      setDropOpen(false);
      setDropReason('');
      showToast('Project dropped');
      await loadCore();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Drop failed', 'error');
    }
  };

  const handleReactivate = async () => {
    if (!project || !canWrite) return;
    try {
      await crmApi.reactivateProject(project._id);
      showToast('Project reactivated');
      await loadCore();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Reactivate failed', 'error');
    }
  };

  const saveLiveLink = async (url: string) => {
    if (!project || !canWrite) return;
    await crmApi.updateProject(project._id, {
      status: isLiveProjectStatus(project.status) ? project.status : 'Live',
      liveUrl: url,
    });
    setLiveLinkModalOpen(false);
    showToast(
      isLiveProjectStatus(project.status)
        ? 'Live link updated'
        : 'Project is Live — client notified with the live link'
    );
    await loadCore();
  };

  // ─── Members ──────────────────────────────────────────────────────────────

  const addMember = async () => {
    if (!id || !memberUserId || isReadOnly || !canWrite) return;
    const u = users.find((x) => userOptionId(x) === memberUserId);
    try {
      setSaving(true);
      await crmApi.addProjectMember(id, {
        userId: memberUserId,
        hourlyRate: Number(memberRate) || 0,
        userName: u?.displayName || u?.name,
        email: u?.email,
      });
      setMemberUserId('');
      setMemberRate('0');
      await refreshMembers();
      showToast('Member added');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Add member failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveMemberRate = async (userId: string) => {
    if (!id || !canWrite || isReadOnly) return;
    try {
      setSaving(true);
      await crmApi.updateProjectMember(id, userId, {
        hourlyRate: Number(editingRateValue) || 0,
      });
      setEditingRateUserId(null);
      await refreshMembers();
      showToast('Rate updated');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Rate update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (userId: string) => {
    const target = members.find((m) => m.userId === userId);
    const label = target ? getMemberDisplayName(target) : 'this member';
    if (!id || !canWrite || isReadOnly || !(await confirm({ message: `Remove member "${label}" from this project?`, tone: 'danger', confirmLabel: 'Remove' }))) return;
    try {
      await crmApi.removeProjectMember(id, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      showToast('Member removed');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Remove failed', 'error');
    }
  };

  // ─── Milestones ───────────────────────────────────────────────────────────

  const addMilestone = async () => {
    if (!id || !msForm.title.trim() || isReadOnly || !canManageMilestones) return;
    try {
      setSaving(true);
      await crmApi.createProjectMilestone(id, {
        title: msForm.title.trim(),
        summary: msForm.summary.trim(),
        description: msForm.summary.trim(),
        startDate: msForm.startDate || null,
        endDate: msForm.endDate || null,
        dueDate: msForm.endDate || undefined,
        status: msForm.status || 'Pending',
        cost: msForm.cost !== '' ? Number(msForm.cost) : 0,
        addCostToBudget: msForm.addCostToBudget,
      });
      setMsForm(emptyMilestoneForm());
      await refreshMilestones();
      await loadCore();
      showToast('Milestone created');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateMilestoneStatus = async (ms: ProjectMilestone, status: string) => {
    if (!canManageMilestones || isReadOnly) return;
    try {
      await crmApi.updateMilestone(ms._id, { status });
      setMilestones((prev) => prev.map((m) => (m._id === ms._id ? { ...m, status } : m)));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  const deleteMilestone = async (msId: string) => {
    if (
      !canManageMilestones ||
      isReadOnly ||
      !(await confirm({ message: 'Delete milestone?', tone: 'danger', confirmLabel: 'Delete' }))
    )
      return;
    try {
      await crmApi.deleteMilestone(msId);
      setMilestones((prev) => prev.filter((m) => m._id !== msId));
      showToast('Milestone deleted');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const viewMilestoneTasks = (msId: string) => {
    setTaskMilestoneFilter(msId);
    setTaskStatusFilter('');
    setTaskFeedbackFilter('');
    setTaskSearch('');
    setTab('tasks');
  };

  // ─── Tasks ────────────────────────────────────────────────────────────────

  const openNewTaskModal = (prefill?: Partial<TaskModalState>) => {
    if (isReadOnly || !canTaskWrite) return;
    setTaskModal({ ...emptyTaskModal(), ...prefill });
  };

  const openEditTaskModal = (t: ProjectTaskSummary) => {
    if (!canTaskWrite) return;
    setTaskModal({
      ...t,
    });
  };

  const saveTask = async () => {
    if (!id || !taskModal?.title?.trim()) {
      showToast('Task title required', 'error');
      return;
    }
    if (isReadOnly && !taskModal._id) {
      showToast('Project is read-only', 'error');
      return;
    }
    if (!canTaskWrite) {
      showToast('No permission to save tasks', 'error');
      return;
    }

    const followers = taskModal.followers || [];

    const member = members.find((m) => m.userId === taskModal.assigneeId);

    const payload: Partial<ProjectTaskSummary> & {
      projectId?: string;
      assignedTo?: string;
      title: string;
    } = {
      title: taskModal.title.trim(),
      status: taskModal.status || 'To Do',
      priority: taskModal.priority || 'Medium',
      milestoneId: taskModal.milestoneId || null,
      dependsOnTaskId: taskModal.dependsOnTaskId || null,
      assigneeId: taskModal.assigneeId || undefined,
      assignedTo: taskModal.assigneeId || undefined,
      assigneeName: member ? getMemberDisplayName(member) : undefined,
      dueDate: taskModal.dueDate || null,
      startDate: taskModal.startDate || null,
      notifyClientOnCompletion: Boolean(taskModal.notifyClientOnCompletion),
      isRecurring: Boolean(taskModal.isRecurring),
      every: taskModal.isRecurring ? Number(taskModal.every) || 1 : undefined,
      interval: taskModal.isRecurring ? taskModal.interval || 'week' : undefined,
      cycles: taskModal.isRecurring ? Number(taskModal.cycles) || 0 : undefined,
      clientFeedbackStatus: taskModal.clientFeedbackStatus || undefined,
      description: taskModal.description || '',
      followers,
    };

    try {
      setSaving(true);
      if (taskModal._id) {
        await crmApi.updateTask(taskModal._id, payload);
      } else {
        await crmApi.createTask({
          projectId: id,
          ...payload,
        });
      }
      setTaskModal(null);
      await refreshTasks();
      await loadCore();
      showToast(taskModal._id ? 'Task updated' : 'Task created');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Task save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeTaskStatus = async (task: ProjectTaskSummary, status: string) => {
    if (!canTaskStatus || isReadOnly) return;
    try {
      await crmApi.updateTask(task._id, { status });
      setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status } : t)));
      loadCore();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Status update failed', 'error');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!canTaskWrite || isReadOnly || !(await confirm({ message: 'Delete task?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      await loadCore();
      showToast('Task deleted');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const archiveTask = async (task: ProjectTaskSummary) => {
    if (!canTaskWrite || isReadOnly) return;
    try {
      await crmApi.updateTask(task._id, { isArchived: true });
      setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, isArchived: true } : t)));
      showToast('Task archived');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Archive failed', 'error');
    }
  };

  const updateClientFeedback = async (taskId: string, status: string) => {
    try {
      await crmApi.updateTask(taskId, { clientFeedbackStatus: status });
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, clientFeedbackStatus: status } : t))
      );
      const o = await crmApi.getProjectOverview(id);
      setOverview(o.data);
      showToast(`Marked as ${status}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Feedback update failed', 'error');
    }
  };

  const resendTaskReminder = async (taskId: string) => {
    try {
      const res = await crmApi.sendTaskReminderEmail(taskId);
      showToast(res.message || 'Reminder email sent to client');
      await refreshTasks();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send reminder', 'error');
    }
  };

  // ─── Gantt dates ──────────────────────────────────────────────────────────

  const handleUpdateTaskDates = async (taskId: string, startDate: string, dueDate: string) => {
    if (!canTaskWrite || isReadOnly) return;
    try {
      await crmApi.updateTask(taskId, {
        startDate: startDate || null,
        dueDate: dueDate || null,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t._id === taskId ? { ...t, startDate: startDate || null, dueDate: dueDate || null } : t
        )
      );
      showToast('Task schedule updated successfully');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update task schedule', 'error');
      throw err;
    }
  };

  // ─── Time logs ────────────────────────────────────────────────────────────

  const addTimeLog = async () => {
    if (!id || isReadOnly || !canTimeWrite) return;
    if (!(Number(tlHours) > 0)) {
      showToast('Hours must be greater than 0', 'error');
      return;
    }
    const selectedTask = tasks.find((t) => t._id === tlTaskId);
    const selectedMember = members.find((m) => m.userId === tlUserId);
    const noteClean = tlNote.trim();
    try {
      setSaving(true);
      await crmApi.createTimeLog({
        projectId: id,
        taskId: tlTaskId || undefined,
        taskTitle: selectedTask?.title,
        userId: tlUserId || undefined,
        userName: selectedMember ? getMemberDisplayName(selectedMember) : undefined,
        hours: Number(tlHours) || 0,
        note: noteClean,
        description: noteClean,
        date: tlDate,
        workDate: tlDate,
        billable: tlBillable,
        isBillable: tlBillable,
        hourlyRate: Number(tlHourlyRate) || selectedMember?.hourlyRate || 0,
      });
      setTlHours('1');
      setTlNote('');
      setTlTaskId('');
      setTlUserId('');
      setTlHourlyRate('0');
      setTlBillable(true);
      setTimeLogModalOpen(false);
      await refreshTimeLogs();
      await loadCore();
      showToast('Time logged successfully');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Log failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeTimeLog = async (logId: string) => {
    if (!canTimeWrite || isReadOnly || !(await confirm({ message: 'Delete this time log?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteTimeLog(logId);
      setTimeLogs((prev) => prev.filter((t) => t._id !== logId));
      await loadCore();
      showToast('Time log deleted');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // ─── Expenses ─────────────────────────────────────────────────────────────

  const submitExpense = async (expenseId: string) => {
    if (!canExpenseWrite || isReadOnly) return;
    try {
      await crmApi.submitProjectExpense(expenseId);
      await refreshExpenses();
      await loadCore();
      showToast('Expense submitted');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Submit failed', 'error');
    }
  };

  const approveExpense = async (expenseId: string) => {
    if (!canExpenseApprove || isReadOnly) return;
    try {
      await crmApi.approveProjectExpense(expenseId);
      await refreshExpenses();
      await loadCore();
      showToast('Expense approved');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Approve failed', 'error');
    }
  };

  const rejectExpense = async (expenseId: string) => {
    if (!canExpenseApprove || isReadOnly) return;
    try {
      await crmApi.rejectProjectExpense(expenseId);
      await refreshExpenses();
      await loadCore();
      showToast('Expense rejected');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Reject failed', 'error');
    }
  };

  const removeExpense = async (expenseId: string) => {
    if (!canExpenseWrite || isReadOnly || !(await confirm({ message: 'Delete this expense?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteProjectExpense(expenseId);
      setExpenses((prev) => prev.filter((e) => e._id !== expenseId));
      await loadCore();
      showToast('Expense deleted');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // ─── Documents ────────────────────────────────────────────────────────────

  const addDocumentLink = async () => {
    if (!id || isReadOnly || !canWrite) return;
    if (!docName.trim() || !docUrl.trim()) {
      showToast('Name and URL required', 'error');
      return;
    }
    try {
      setDocLinkSaving(true);
      await crmApi.createProjectDocument(id, {
        name: docName.trim(),
        url: docUrl.trim(),
        category: docCat,
        description: docDescription.trim() || undefined,
        milestoneId: docMilestoneId || null,
        taskId: docTaskId || null,
      });
      setDocName('');
      setDocUrl('');
      setDocDescription('');
      await refreshDocuments();
      showToast('Link added');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Add failed', 'error');
    } finally {
      setDocLinkSaving(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    if (!id || !canWrite || isReadOnly || !(await confirm({ message: 'Delete document?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteProjectDocument(id, docId);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      setAllDocuments((prev) => prev.filter((d) => d._id !== docId));
      showToast('Document deleted');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // ─── Render guards ────────────────────────────────────────────────────────

  if (!canRead) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        You do not have permission to view projects.
      </div>
    );
  }

  if (loading && !project) {
    return (
      <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center text-sm text-zinc-500 animate-pulse">
        Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        Project not found.{' '}
        <Link to="/projects" className="text-zinc-950 font-semibold">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div data-tour="projects-detail-root" className="flex flex-col gap-5">
      {toast && (
        <div
          className={`fixed top-20 right-6 z-[80] px-4 py-2.5 rounded-lg text-xs font-semibold border shadow-sm ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div data-tour="projects-detail-hero" className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-1 border-b border-zinc-200">
        <div className="min-w-0">
          <Link
            to="/projects"
            data-tour="projects-detail-back"
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 no-underline hover:text-zinc-950 mb-2"
          >
            <ArrowBackIcon sx={{ fontSize: 14 }} />
            Back to Projects
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">{project.name}</h1>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${statusBadgeClass(project.status)}`}
            >
              {project.status}
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${priorityBadgeClass(project.priority)}`}
            >
              {project.priority}
            </span>
            {project.isArchived && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-zinc-100 text-zinc-600 border-zinc-200">
                Archived
              </span>
            )}
            {project.isDropped && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">
                Dropped
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 m-0 mt-1.5 flex flex-wrap gap-x-2 gap-y-1 items-center">
            {project.clientId ? (
              <Link
                to={`/clients/${project.clientId}`}
                className="text-zinc-800 font-semibold no-underline hover:underline"
              >
                {project.clientName || 'Client'}
              </Link>
            ) : (
              <span>{project.clientName || '—'}</span>
            )}
            {project.category ? <span>· {project.category}</span> : null}
            {project.deadline ? <span>· Due {toDateInput(project.deadline)}</span> : null}
          </p>
          {(project.tags?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {project.tags!.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600"
                >
                  {tag}
                </span>
              ))}
        </div>
          )}
          {(isLiveProjectStatus(project.status) || project.liveUrl) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2">
              <LinkIcon sx={{ fontSize: 16 }} className="text-violet-700" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">
                Live link
              </span>
              {project.liveUrl ? (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-violet-900 no-underline hover:underline"
                >
                  {project.liveUrl}
                </a>
              ) : (
                <span className="flex-1 text-xs text-violet-700">No URL yet</span>
              )}
              {project.liveUrl ? (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] font-semibold text-violet-800 no-underline hover:bg-violet-50"
                >
                  <OpenInNewOutlinedIcon sx={{ fontSize: 13 }} />
                  Open
                </a>
              ) : null}
              {canWrite && !isReadOnly ? (
              <button
                type="button"
                  onClick={() => setLiveLinkModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-2 py-1 text-[11px] font-semibold text-violet-900 cursor-pointer hover:bg-violet-50"
              >
                  {project.liveUrl ? 'Edit' : 'Add'} link
              </button>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-zinc-600">
            <span>
              <span className="font-semibold text-zinc-800">Budget:</span>{' '}
              {formatMoney(project.budget, currency)}
            </span>
            <span>
              <span className="font-semibold text-zinc-800">Hours est:</span>{' '}
              {project.hoursEstimate != null ? `${project.hoursEstimate}h` : '—'}
            </span>
            <span>
              <span className="font-semibold text-zinc-800">Team:</span>{' '}
              {teamNames.length ? teamNames.join(', ') : project.ownerName || '—'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {canWrite && !project.isDropped && isLiveProjectStatus(project.status) && (
              <button
                type="button"
              onClick={() => setLiveLinkModalOpen(true)}
              className={btnSecondary}
              >
              <LinkIcon sx={{ fontSize: 15 }} />
              {project.liveUrl ? 'Edit live link' : 'Add live link'}
              </button>
          )}
          {canWrite && !project.isDropped && (
                <button
                  type="button"
              data-tour="projects-edit-btn"
              onClick={() => navigate(`/projects/${id}/edit`)}
              className={btnSecondary}
            >
              <EditOutlinedIcon sx={{ fontSize: 15 }} />
              Edit
            </button>
          )}
          {canWrite && !project.isDropped && (
            <button type="button" data-tour="projects-archive-btn" onClick={handleArchiveToggle} className={btnSecondary}>
              {project.isArchived ? (
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
          {project.isDropped ? (
            canWrite && (
              <button type="button" onClick={handleReactivate} className={btnSecondary}>
                  Reactivate
                </button>
            )
          ) : (
            canDelete && (
              <button type="button" data-tour="projects-drop-btn" onClick={() => setDropOpen(true)} className={btnDanger}>
                  Drop
                </button>
            )
          )}
        </div>
      </div>

      {project.isArchived && (
        <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          This project is <strong>archived</strong>. Creating members, milestones, tasks, time
          logs, expenses, and documents is disabled until restored.
        </div>
      )}
      {project.isDropped && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          This project is <strong>dropped</strong>
          {project.droppedReason ? `: ${project.droppedReason}` : ''}. Reactivate to resume work.
          Creating new records is blocked.
        </div>
      )}

      {/* Tabs */}
      <div data-tour="projects-detail-tabs" className="flex flex-wrap gap-1 border-b border-zinc-200 pb-px">
        {tabs
          .filter((t) => !t.hide)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              data-tour={`projects-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg border border-b-0 cursor-pointer ${
                tab === t.id
                  ? 'bg-white text-zinc-950 border-zinc-200'
                  : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && overview && (
        <div data-tour="projects-overview-root" className="flex flex-col gap-4">
          <div data-tour="projects-overview-kpis" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {[
              { label: 'Budget', value: formatMoney(overview.budget, currency), hide: false },
              {
                label: isClient ? 'Paid Invoices' : 'Earnings',
                value: formatMoney(overview.earnings, currency),
                hide: false,
              },
              {
                label: 'Expenses',
                value: formatMoney(overview.expenses, currency),
                hide: isClient,
              },
              {
                label: 'Profit',
                value: formatMoney(overview.profit, currency),
                hide: isClient,
              },
              { label: 'Progress', value: `${Number(overview.progress) || 0}%`, hide: false },
              {
                label: 'Hours',
                value: `${Number(overview.hoursLogged) || 0} / ${Number(overview.hoursEstimate) || 0}h`,
                hide: false,
              },
              {
                label: 'Tasks done',
                value: `${overview.taskStats?.completed ?? 0}/${overview.taskStats?.total ?? 0}`,
                hide: false,
              },
              {
                label: 'Overdue tasks',
                value: String(overview.taskStats?.overdue ?? 0),
                hide: false,
              },
            ]
              .filter((c) => !c.hide)
              .map((c) => (
                <div key={c.label} className="bg-white border border-zinc-300 rounded-xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {c.label}
                </div>
                <div className="text-lg font-bold text-zinc-950 mt-1">{c.value}</div>
              </div>
            ))}
          </div>

          <div data-tour="projects-overview-progress" className="bg-white border border-zinc-300 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-700">Progress</span>
              <span className="text-xs font-semibold text-zinc-950">
                {Number(overview.progress) || 0}%
              </span>
            </div>
            <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
              <div
                className="h-full bg-zinc-900 transition-all"
                style={{ width: `${Math.min(100, Number(overview.progress) || 0)}%` }}
              />
            </div>
          </div>

          {taskBreakdownBars.length > 0 && (
            <div className="bg-white border border-zinc-300 rounded-xl p-5">
              <h3 className="text-sm font-bold text-zinc-950 m-0 mb-3">Task breakdown</h3>
              <div className="flex flex-col gap-2.5">
                {taskBreakdownBars.map(([label, count]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-zinc-600">{label}</span>
                    <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                      <div
                        className="h-full bg-slate-700 rounded-full"
                        style={{
                          width: `${Math.min(100, (Number(count) / maxBreakdown) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold text-zinc-800">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(overview.hoursByUser?.length || 0) > 0 && (
            <div className="bg-white border border-zinc-300 rounded-xl p-5">
              <h3 className="text-sm font-bold text-zinc-950 m-0 mb-3">Hours by user</h3>
              <div className="flex flex-col gap-2.5">
                {overview.hoursByUser!.map((row) => (
                  <div key={row.userName} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-zinc-600 truncate">
                      {row.userName}
                    </span>
                    <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                      <div
                        className="h-full bg-slate-600 rounded-full"
                        style={{
                          width: `${Math.min(100, (Number(row.hours) / maxHoursByUser) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs font-semibold text-zinc-800">
                      {row.hours}h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(overview.blockedAwaitingClientTasks?.length || 0) > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="font-semibold mb-2">Blocked — awaiting client feedback</div>
              <ul className="m-0 pl-0 list-none flex flex-col gap-3">
                {overview.blockedAwaitingClientTasks!.map((item) => (
                  <li
                    key={item.taskId}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-amber-200/80 rounded-lg bg-white/60 px-3 py-2.5"
                  >
                    <div>
                      {item.alertMessage ||
                        `${item.taskTitle || 'Task'} depends on ${item.dependsOnTaskTitle || 'another task'}`}
                      {item.clientFeedbackStatus ? (
                        <div className="text-[11px] text-amber-800 mt-0.5">
                          Feedback: {item.clientFeedbackStatus}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {isClient ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 cursor-pointer"
                            onClick={() => updateClientFeedback(item.taskId, 'Satisfied')}
                          >
                            <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                            Satisfied
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold rounded-lg border border-red-300 bg-red-50 text-red-700 cursor-pointer"
                            onClick={() => updateClientFeedback(item.taskId, 'Dissatisfied')}
                          >
                            <CancelOutlinedIcon sx={{ fontSize: 14 }} />
                            Dissatisfied
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold rounded-lg border border-amber-300 bg-white text-amber-900 cursor-pointer"
                          onClick={() => resendTaskReminder(item.taskId)}
                        >
                          <EmailOutlinedIcon sx={{ fontSize: 14 }} />
                          Resend email
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white border border-zinc-300 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-950 m-0 mb-3">Project details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <p className="m-0 text-zinc-600">
                <span className="font-semibold text-zinc-950">Priority:</span> {project.priority}
              </p>
              <p className="m-0 text-zinc-600">
                <span className="font-semibold text-zinc-950">Owner:</span>{' '}
                {project.ownerName || '—'}
              </p>
              <p className="m-0 text-zinc-600">
                <span className="font-semibold text-zinc-950">Category:</span>{' '}
                {project.category || '—'}
              </p>
              <p className="m-0 text-zinc-600">
                <span className="font-semibold text-zinc-950">Progress method:</span>{' '}
                {project.progressCalculationMethod || 'tasks'}
              </p>
              <p className="m-0 text-zinc-600">
                <span className="font-semibold text-zinc-950">Start:</span>{' '}
                {toDateInput(project.startDate) || '—'}
              </p>
              <p className="m-0 text-zinc-600">
                <span className="font-semibold text-zinc-950">Deadline:</span>{' '}
                {toDateInput(project.deadline) || '—'}
              </p>
              <p className="m-0 text-zinc-600 sm:col-span-2">
                <span className="font-semibold text-zinc-950">Description:</span>{' '}
                {project.description || '—'}
              </p>
            </div>
            {project.customFields && Object.keys(project.customFields).length > 0 && (
              <>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-5 mb-2">
                  Custom fields
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {Object.entries(project.customFields).map(([k, v]) => (
                  <p key={k} className="m-0 text-zinc-600">
                    <span className="font-semibold text-zinc-950">{k}:</span> {String(v ?? '—')}
                  </p>
                ))}
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Members ──────────────────────────────────────────────────────── */}
      {tab === 'members' && (
        <div className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4">
          {canWrite && !isReadOnly && (
            <div className="flex flex-wrap gap-2 items-end border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
              <label className="flex flex-col gap-1 min-w-[200px] flex-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">User</span>
                <select
                  className={fieldClass}
                  value={memberUserId}
                  onChange={(e) => setMemberUserId(e.target.value)}
                >
                  <option value="">Select user…</option>
                  {users
                    .filter((u) => !members.some((m) => m.userId === userOptionId(u)))
                    .map((u) => {
                      const uid = userOptionId(u);
                    return (
                      <option key={uid} value={uid}>
                          {userOptionLabel(u)}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="flex flex-col gap-1 w-32">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Hourly rate
                </span>
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={memberRate}
                  onChange={(e) => setMemberRate(e.target.value)}
                />
              </label>
              <button type="button" onClick={addMember} disabled={saving} className={btnPrimary}>
                <AddIcon sx={{ fontSize: 15 }} />
                Add
              </button>
            </div>
          )}
          {members.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-8">No members yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr className="border-b border-zinc-200">
                  {['Name', 'Role', 'Rate', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-2 py-2 text-[11px] font-semibold uppercase text-zinc-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                  {members.map((m) => {
                    const displayName = getMemberDisplayName(m);
                    const email = getMemberEmail(m);
                    const role = getMemberRole(m);
                    const initials = displayName
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'TM';

                    return (
                      <tr key={m.userId} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-zinc-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0 select-none shadow-xs">
                              {initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold text-zinc-950 truncate">
                                {displayName}
                              </span>
                              {email && (
                                <span className="text-[11px] text-zinc-500 font-normal truncate">
                                  {email}
                                </span>
                              )}
                            </div>
                          </div>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-zinc-600">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                            {role}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-xs text-zinc-600">
                          {editingRateUserId === m.userId ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                className="h-8 w-24 px-2 text-xs border border-zinc-200 rounded-lg"
                                value={editingRateValue}
                                onChange={(e) => setEditingRateValue(e.target.value)}
                              />
                              <button
                                type="button"
                                className="h-8 px-2 text-[11px] font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer"
                                onClick={() => saveMemberRate(m.userId)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="h-8 px-2 text-[11px] font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
                                onClick={() => setEditingRateUserId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-zinc-700 bg-transparent border-none p-0 cursor-pointer hover:underline disabled:no-underline disabled:cursor-default"
                              disabled={!canWrite || isReadOnly}
                              onClick={() => {
                                setEditingRateUserId(m.userId);
                                setEditingRateValue(String(m.hourlyRate ?? 0));
                              }}
                              title={canWrite && !isReadOnly ? 'Click to edit rate' : undefined}
                            >
                              {formatMoney(m.hourlyRate, currency)}/h
                            </button>
                          )}
                    </td>
                    <td className="px-2 py-2.5">
                          {canWrite && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => removeMember(m.userId)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 bg-white cursor-pointer hover:bg-red-50 transition-colors"
                              title="Remove member"
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </button>
                      )}
                    </td>
                  </tr>
                    );
                  })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* ── Milestones ───────────────────────────────────────────────────── */}
      {tab === 'milestones' && (
        <div className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4">
          {canManageMilestones && !isReadOnly && (
            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                    Title *
                  </span>
                <input
                  className={fieldClass}
                    value={msForm.title}
                    onChange={(e) => setMsForm({ ...msForm, title: e.target.value })}
                />
              </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Cost</span>
                  <input
                    type="number"
                    min={0}
                    className={fieldClass}
                    value={msForm.cost}
                    onChange={(e) => setMsForm({ ...msForm, cost: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Status</span>
                  <select
                    className={fieldClass}
                    value={msForm.status}
                    onChange={(e) => setMsForm({ ...msForm, status: e.target.value })}
                  >
                    {PROJECT_MILESTONE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                    Start date
                  </span>
                <input
                  type="date"
                  className={fieldClass}
                    value={msForm.startDate}
                    onChange={(e) => setMsForm({ ...msForm, startDate: e.target.value })}
                />
              </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                    End / due date
                  </span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={msForm.endDate}
                    onChange={(e) => setMsForm({ ...msForm, endDate: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 pt-5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={msForm.addCostToBudget}
                    onChange={(e) =>
                      setMsForm({ ...msForm, addCostToBudget: e.target.checked })
                    }
                  />
                  <span className="text-xs font-semibold text-zinc-700">Add cost to budget</span>
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">Summary</span>
                <textarea
                  className="min-h-[64px] px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white"
                  value={msForm.summary}
                  onChange={(e) => setMsForm({ ...msForm, summary: e.target.value })}
                />
              </label>
              <div>
              <button
                type="button"
                onClick={addMilestone}
                  disabled={saving}
                  className={btnPrimary}
              >
                  <AddIcon sx={{ fontSize: 15 }} />
                Add Milestone
              </button>
              </div>
            </div>
          )}

          {canWrite && !canManageMilestones && !isReadOnly && (
            <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
              Only the project leader can create or change milestones. You can still view them and
              open related tasks.
            </div>
          )}

          {milestones.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-8">No milestones.</div>
          ) : (
            milestones.map((ms) => (
              <div
                key={ms._id}
                className="border border-zinc-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-950">{ms.title}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 flex flex-wrap gap-x-2">
                    <span>
                      {toDateInput(ms.startDate) || '—'} →{' '}
                      {toDateInput(ms.endDate || ms.dueDate) || '—'}
                    </span>
                    {ms.cost != null ? <span>· {formatMoney(ms.cost, currency)}</span> : null}
                    {ms.addCostToBudget ? <span>· +budget</span> : null}
                </div>
                  {(ms.summary || ms.description) && (
                    <p className="text-xs text-zinc-600 m-0 mt-1 line-clamp-2">
                      {ms.summary || ms.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {canManageMilestones && !isReadOnly ? (
                    <select
                      className="h-8 px-2 text-xs border border-zinc-300 rounded-lg bg-white"
                      value={ms.status || 'Pending'}
                      onChange={(e) => updateMilestoneStatus(ms, e.target.value)}
                    >
                      {PROJECT_MILESTONE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-zinc-600 px-2">{ms.status}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => viewMilestoneTasks(ms._id)}
                    className={btnSecondary}
                  >
                    View tasks
                  </button>
                  {canManageMilestones && !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => deleteMilestone(ms._id)}
                      className="p-1.5 rounded-lg border border-red-200 text-red-600 bg-white cursor-pointer"
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tasks ────────────────────────────────────────────────────────── */}
      {tab === 'tasks' && (
        <div className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 items-end justify-between">
            <div className="flex flex-wrap gap-2 flex-1">
            <select
                className={`${fieldClass} max-w-[160px]`}
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {DEFAULT_TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
              <select
                className={`${fieldClass} max-w-[180px]`}
                value={taskMilestoneFilter}
                onChange={(e) => setTaskMilestoneFilter(e.target.value)}
              >
                <option value="">All milestones</option>
                {milestones.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title}
                  </option>
                ))}
              </select>
              <select
                className={`${fieldClass} max-w-[180px]`}
                value={taskFeedbackFilter}
                onChange={(e) => setTaskFeedbackFilter(e.target.value)}
              >
                <option value="">All feedback</option>
                {CLIENT_FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className={`${fieldClass} max-w-[220px]`}
                placeholder="Search tasks…"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
            </div>
            {canTaskWrite && !isReadOnly && (
              <button type="button" onClick={() => openNewTaskModal()} className={btnPrimary}>
                <AddIcon sx={{ fontSize: 15 }} />
                New Task
              </button>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-8">No tasks.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                    {['Title', 'Status', 'Priority', 'Feedback', 'Due', 'Assignee', ''].map(
                      (h) => (
                    <th
                      key={h || 'a'}
                      className="px-3 py-2 text-[11px] font-semibold uppercase text-zinc-500"
                    >
                      {h}
                    </th>
                      )
                    )}
                </tr>
              </thead>
              <tbody>
                  {filteredTasks.map((t) => (
                  <tr key={t._id} className="border-b border-zinc-100">
                      <td className="px-3 py-2.5 text-sm font-semibold text-zinc-950">
                        <Link
                          to={`/tasks/${t._id}`}
                          className="text-zinc-950 no-underline hover:underline"
                        >
                          {t.title}
                        </Link>
                      </td>
                    <td className="px-3 py-2.5">
                        {canTaskStatus && !isReadOnly ? (
                        <select
                            className="h-8 px-2 text-xs border border-zinc-300 rounded-lg bg-white"
                          value={t.status}
                          onChange={(e) => changeTaskStatus(t, e.target.value)}
                        >
                          {DEFAULT_TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                          <span className="text-xs text-zinc-700">{t.status}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityBadgeClass(t.priority)}`}
                      >
                        {t.priority || '—'}
                      </span>
                    </td>
                      <td className="px-3 py-2.5 text-[11px] text-zinc-600">
                        {t.clientFeedbackStatus || '—'}
                      </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-600">
                        {toDateInput(t.dueDate) || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-zinc-600">
                        {displayUserLabel(t.assigneeName, t.assigneeId)}
                    </td>
                    <td className="px-3 py-2.5">
                        {canTaskWrite && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                              onClick={() => openEditTaskModal(t)}
                              className="p-1.5 rounded-lg border border-zinc-300 bg-white cursor-pointer"
                              title="Edit"
                          >
                            <EditOutlinedIcon sx={{ fontSize: 14 }} />
                            </button>
                            {!isReadOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => archiveTask(t)}
                                  className="p-1.5 rounded-lg border border-zinc-300 bg-white cursor-pointer"
                                  title="Archive"
                                >
                                  <ArchiveOutlinedIcon sx={{ fontSize: 14 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTask(t._id)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 bg-white cursor-pointer"
                                  title="Delete"
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                          </button>
                              </>
                            )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* ── Board ────────────────────────────────────────────────────────── */}
      {tab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {DEFAULT_TASK_STATUSES.map((status) => {
            const col = tasks.filter((t) => !t.isArchived && t.status === status);
            return (
              <div
                key={status}
                className="bg-white border border-zinc-300 rounded-xl"
                onDragOver={(e) => {
                  if (!canTaskStatus || isReadOnly) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  if (!canTaskStatus || isReadOnly) return;
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('text/task-id');
                  const task = tasks.find((t) => t._id === taskId);
                  if (task && task.status !== status) changeTaskStatus(task, status);
                }}
              >
                <div className="px-3 py-2.5 border-b border-zinc-200 text-xs font-semibold text-zinc-950 flex justify-between">
                  <span>{status}</span>
                  <span className="text-zinc-500">{col.length}</span>
                </div>
                <div className="p-2 flex flex-col gap-2 min-h-[120px]">
                  {col.map((t) => (
                    <div
                      key={t._id}
                      className="border border-zinc-200 rounded-lg p-2.5 bg-zinc-50/40 cursor-grab active:cursor-grabbing"
                      draggable={canTaskStatus && !isReadOnly}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/task-id', t._id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      <Link
                        to={`/tasks/${t._id}`}
                        className="text-xs font-semibold text-zinc-950 no-underline hover:underline"
                      >
                        {t.title}
                      </Link>
                      <div className="text-[10px] text-zinc-500 mt-1">
                        {toDateInput(t.dueDate) || 'No due date'}
                        {t.assigneeName ? ` · ${displayUserLabel(t.assigneeName, t.assigneeId)}` : ''}
                      </div>
                      <span
                        className={`inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${priorityBadgeClass(t.priority)}`}
                      >
                        {t.priority || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Gantt ────────────────────────────────────────────────────────── */}
      {tab === 'gantt' && project && (
        <ProjectGanttChart
          project={project}
          tasks={tasks}
          milestones={milestones}
          canTaskWrite={canTaskWrite}
          isReadOnly={isReadOnly}
          onAddTask={() => openNewTaskModal()}
          onRefresh={refreshTasks}
          onUpdateTaskDates={handleUpdateTaskDates}
          showToast={showToast}
        />
      )}

      {/* ── Time ─────────────────────────────────────────────────────────── */}
      {tab === 'time' && (
        <div className="flex flex-col gap-4">
          {/* Header Card with Metrics & "+ Log Time" Action */}
          <div className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
                  <AccessTimeIcon sx={{ fontSize: 22 }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 m-0">Time Tracking</h3>
                  <p className="text-xs text-zinc-500 m-0 mt-0.5">
                    Monitor billable team effort, task progress, and logged hours for this project.
                  </p>
            </div>
                      </div>

              {canTimeWrite && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => openTimeLogModal()}
                  className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer hover:bg-zinc-800 transition-colors shadow-xs"
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                  <span>Log Time</span>
                </button>
              )}
                      </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Total Logged
                </span>
                <div className="text-xl font-bold text-zinc-950 font-mono">
                  {timeLogStats.totalHours} <span className="text-xs font-normal text-zinc-500">hrs</span>
                    </div>
                <span className="text-[11px] text-zinc-500">
                  {timeLogStats.count} {timeLogStats.count === 1 ? 'entry' : 'entries'} recorded
                </span>
            </div>

              <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                  Billable Hours
                </span>
                <div className="text-xl font-bold text-emerald-950 font-mono">
                  {timeLogStats.billableHours} <span className="text-xs font-normal text-emerald-600">hrs</span>
        </div>
                <span className="text-[11px] text-emerald-600 font-medium">
                  {timeLogStats.billablePercent}% billable ratio
                </span>
              </div>

              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Non-Billable
                </span>
                <div className="text-xl font-bold text-zinc-900 font-mono">
                  {timeLogStats.nonBillableHours} <span className="text-xs font-normal text-zinc-500">hrs</span>
                </div>
                <span className="text-[11px] text-zinc-500">
                  Internal & unbilled work
                </span>
              </div>

              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Billable Value
                </span>
                <div className="text-xl font-bold text-zinc-950 font-mono">
                  {formatMoney(timeLogStats.totalBillableAmount, currency)}
                </div>
                <span className="text-[11px] text-zinc-500">
                  Based on member rates
                </span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-100">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <SearchIcon
                    sx={{ fontSize: 16 }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                <input
                    type="text"
                    value={tlSearch}
                    onChange={(e) => setTlSearch(e.target.value)}
                    placeholder="Search task, member, note…"
                    className="w-full h-8 pl-8 pr-3 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 bg-white"
                  />
                </div>

                <select
                  value={tlFilterMember}
                  onChange={(e) => setTlFilterMember(e.target.value)}
                  className="h-8 px-2.5 text-xs border border-zinc-300 rounded-lg bg-white text-zinc-700 outline-none focus:border-zinc-950 cursor-pointer"
                >
                  <option value="all">All Members</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {getMemberDisplayName(m)}
                    </option>
                  ))}
                </select>

                <select
                  value={tlFilterBillable}
                  onChange={(e) => setTlFilterBillable(e.target.value as 'all' | 'billable' | 'non-billable')}
                  className="h-8 px-2.5 text-xs border border-zinc-300 rounded-lg bg-white text-zinc-700 outline-none focus:border-zinc-950 cursor-pointer"
                >
                  <option value="all">All Billing</option>
                  <option value="billable">Billable Only</option>
                  <option value="non-billable">Non-Billable Only</option>
                </select>

                {(tlSearch || tlFilterMember !== 'all' || tlFilterBillable !== 'all') && (
              <button
                type="button"
                    onClick={() => {
                      setTlSearch('');
                      setTlFilterMember('all');
                      setTlFilterBillable('all');
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-800 underline border-none bg-transparent cursor-pointer"
                  >
                    Reset filters
              </button>
                )}
            </div>

              <div className="text-xs text-zinc-500 font-medium">
                Showing <strong>{filteredTimeLogs.length}</strong> of <strong>{timeLogs.length}</strong> logs
              </div>
            </div>
          </div>

          {/* Time Logs Table Card */}
          <div className="bg-white border border-zinc-300 rounded-xl overflow-hidden shadow-xs">
            {filteredTimeLogs.length === 0 ? (
              <div className="text-center py-16 px-4 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <AccessTimeIcon sx={{ fontSize: 26 }} />
                </div>
                <div className="text-sm font-semibold text-zinc-900">
                  {timeLogs.length === 0 ? 'No time logs recorded yet' : 'No matching time logs found'}
                </div>
                <p className="text-xs text-zinc-500 max-w-sm m-0">
                  {timeLogs.length === 0
                    ? 'Start tracking hours worked on tasks and project deliverables to monitor team velocity and billable work.'
                    : 'Try clearing your filters or changing your search terms to see time entries.'}
                </p>
                {canTimeWrite && !isReadOnly && timeLogs.length === 0 && (
                  <button
                    type="button"
                    onClick={() => openTimeLogModal()}
                    className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer hover:bg-zinc-800 transition-colors shadow-xs mt-2"
                  >
                    <AddIcon sx={{ fontSize: 15 }} />
                    <span>Log First Time Entry</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/70">
                      {['Date', 'Team Member', 'Task', 'Hours', 'Rate & Amount', 'Status', 'Note', ''].map(
                        (h) => (
                          <th
                            key={h || 'action'}
                            className="px-3.5 py-2.5 text-[11px] font-semibold uppercase text-zinc-500 tracking-wider"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredTimeLogs.map((tl) => {
                      const m = members.find((x) => x.userId === tl.userId);
                      const memberName = m
                        ? getMemberDisplayName(m)
                        : tl.userName && !isHexId(tl.userName)
                        ? tl.userName
                        : (users.find((u) => userOptionId(u) === tl.userId)?.displayName || 'Team Member');
                      const initials = memberName
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'TM';
                      const hourly = Number(tl.hourlyRate) || (m?.hourlyRate ? Number(m.hourlyRate) : 0);
                      const totalCost = (Number(tl.hours) || 0) * hourly;
                      const isBillable = tl.isBillable !== undefined ? Boolean(tl.isBillable) : Boolean(tl.billable);
                      const noteText = (tl.description || tl.note || '').trim();
                      const dateInfo = formatLogDate(tl.workDate || tl.date || tl.createdAt);

                      return (
                        <tr key={tl._id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex flex-col" title={dateInfo.tooltip}>
                              <span className="text-xs font-semibold text-zinc-900 font-sans">
                                {dateInfo.date}
                              </span>
                              {dateInfo.sub && (
                                <span className="text-[10px] text-zinc-400 font-medium">
                                  {dateInfo.sub}
                                </span>
                              )}
                  </div>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 select-none shadow-xs">
                                {initials}
                  </div>
                              <span className="text-xs font-semibold text-zinc-950 truncate max-w-[140px]">
                                {memberName}
                              </span>
                </div>
                          </td>
                          <td className="px-3.5 py-3">
                            {tl.taskId ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-800 truncate max-w-[180px]">
                                {tl.taskTitle || 'Task'}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400 italic">General (no task)</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-xs font-bold text-zinc-900 font-mono whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-900">
                              {tl.hours} hrs
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-xs text-zinc-700 whitespace-nowrap font-mono">
                            {hourly > 0 ? (
                              <div className="flex flex-col">
                                <span className="font-semibold text-zinc-900">
                                  {formatMoney(totalCost, currency)}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-normal">
                                  {formatMoney(hourly, currency)}/h
                                </span>
              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            {isBillable ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="h-3 w-3 shrink-0" aria-hidden />
                                Billable
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-500">
                                Non-billable
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-xs max-w-[280px]">
                            {noteText ? (
                              <div className="flex items-start" title={noteText}>
                                <span className="text-xs text-zinc-800 leading-snug line-clamp-2 break-words">
                                  {noteText}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-400 italic font-normal">No notes</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-right whitespace-nowrap">
                            {canTimeWrite && !isReadOnly && (
                              <button
                                type="button"
                                onClick={() => removeTimeLog(tl._id)}
                                className="p-1.5 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 cursor-pointer transition-colors"
                                title="Delete time log"
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Expenses ─────────────────────────────────────────────────────── */}
      {tab === 'expenses' && !isClient && (
        <div className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex flex-col gap-1 w-48">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Filter category
                </span>
                <select
                  className={fieldClass}
                  value={expenseCategoryFilter}
                  onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {canExpenseWrite && !isReadOnly && (
              <button
                type="button"
                onClick={() => navigate(`/expenses/create?projectId=${encodeURIComponent(project?._id || id || '')}`)}
                className={btnPrimary}
              >
                + Add Expense
              </button>
            )}
          </div>

          {expenses.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-8">No expenses.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="border-b border-zinc-200">
                    {['Title', 'Amount', 'Category', 'Status', 'Date', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-2 py-2 text-[11px] font-semibold uppercase text-zinc-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                  {expenses.map((e) => {
                    const status = e.status || 'Draft';
                    return (
                      <tr
                        key={e._id}
                        className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                        onClick={() => navigate(`/expenses/${encodeURIComponent(e._id)}`)}
                      >
                        <td className="px-2 py-2.5 text-sm font-semibold text-zinc-950">
                          {e.title}
                          {e.note ? (
                            <div className="text-[11px] text-zinc-500 font-normal">{e.note}</div>
                          ) : null}
                        </td>
                    <td className="px-2 py-2.5 text-xs">
                          {formatMoney(e.amount, e.currency || currency)}
                    </td>
                        <td className="px-2 py-2.5 text-xs text-zinc-600">
                          {e.category || '—'}
                        </td>
                        <td className="px-2 py-2.5 text-xs text-zinc-600">{status}</td>
                        <td className="px-2 py-2.5 text-xs text-zinc-600">
                          {toDateInput(e.date) || '—'}
                        </td>
                        <td
                          className="px-2 py-2.5"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex flex-wrap gap-1">
                            {canExpenseWrite &&
                              !isReadOnly &&
                              (status === 'Draft' || status === 'Rejected') && (
                                <button
                                  type="button"
                                  onClick={() => submitExpense(e._id)}
                                  className="inline-flex items-center gap-0.5 h-7 px-2 text-[10px] font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
                                  title="Submit"
                                >
                                  <SendOutlinedIcon sx={{ fontSize: 12 }} />
                                  Submit
                                </button>
                              )}
                            {canExpenseApprove && !isReadOnly && status === 'Submitted' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => approveExpense(e._id)}
                                  className="inline-flex items-center gap-0.5 h-7 px-2 text-[10px] font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-white cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectExpense(e._id)}
                                  className="inline-flex items-center gap-0.5 h-7 px-2 text-[10px] font-semibold rounded-lg border border-red-200 text-red-700 bg-white cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {canExpenseWrite && !isReadOnly && (
                              <button
                                type="button"
                                onClick={() => removeExpense(e._id)}
                                className="p-1 rounded-lg border border-red-200 text-red-600 bg-white cursor-pointer"
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
          )}
        </div>
      )}

      {/* ── Documents ────────────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <div className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {DEFAULT_DOC_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setDocCategory(docCategory === cat ? '' : cat)}
                className={`text-left rounded-lg border px-3 py-2 cursor-pointer ${
                  docCategory === cat
                    ? 'border-zinc-900 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
                }`}
              >
                <div
                  className={`text-[10px] font-semibold uppercase ${
                    docCategory === cat ? 'text-zinc-300' : 'text-zinc-500'
                  }`}
                >
                  {cat}
                </div>
                <div
                  className={`text-sm font-bold ${
                    docCategory === cat ? 'text-white' : 'text-zinc-950'
                  }`}
                >
                  {docCategoryMetrics[cat] || 0}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 w-44">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                Filter category
              </span>
              <select
                className={fieldClass}
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
              >
                <option value="">All</option>
                {DEFAULT_DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {canWrite && !isReadOnly && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Upload document */}
              <div className="rounded-xl border border-zinc-300 bg-white p-4 flex flex-col gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">Upload document</div>
                  <p className="m-0 mt-0.5 text-[11px] text-zinc-500">
                    PDF, Office, images, text, CSV — max 20MB. Choose a file, then click Upload document.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">Category</span>
                    <select
                      className={fieldClass}
                      value={docCat}
                      onChange={(e) => setDocCat(e.target.value)}
                    >
                      {DEFAULT_DOC_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                      Description
                    </span>
                    <input
                      className={fieldClass}
                      value={docDescription}
                      onChange={(e) => setDocDescription(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                      Milestone
                    </span>
                    <select
                      className={fieldClass}
                      value={docMilestoneId}
                      onChange={(e) => setDocMilestoneId(e.target.value)}
                    >
                      <option value="">None</option>
                      {milestones.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">Task</span>
                    <select
                      className={fieldClass}
                      value={docTaskId}
                      onChange={(e) => setDocTaskId(e.target.value)}
                    >
                      <option value="">None</option>
                      {tasks
                        .filter((t) => !t.isArchived)
                        .map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <DocumentUploadControl
                  mode="button"
                  buttonLabel="Choose file"
                  uploadButtonLabel="Upload document"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.md,.rtf,.zip"
                  disabled={uploadingDoc || isReadOnly || !canWrite}
                  hint="Select a file, then click Upload document"
                  uploadFn={async (file) => {
                    const res = await crmApi.uploadProjectDocument(id, file, {
                      category: docCat,
                      description: docDescription.trim() || undefined,
                      milestoneId: docMilestoneId || null,
                      taskId: docTaskId || null,
                    });
                    return {
                      url: res.data.url || '',
                      fileUrl: res.data.url || '',
                      fileName: res.data.name || file.name,
                      mimeType: res.data.mimeType || file.type,
                      fileSize: res.data.size || file.size,
                    };
                  }}
                  onUploaded={async () => {
                    setDocDescription('');
                    await refreshDocuments();
                    showToast('Document uploaded');
                  }}
                  onError={(msg) => showToast(msg, 'error')}
                />
                {uploadingDoc ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                    <CloudUploadOutlinedIcon sx={{ fontSize: 14 }} />
                    Uploading to storage…
                  </span>
                ) : null}
              </div>

              {/* Add link */}
              <div className="rounded-xl border border-zinc-300 bg-white p-4 flex flex-col gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">Add link</div>
                  <p className="m-0 mt-0.5 text-[11px] text-zinc-500">
                    Save an external URL (Drive, Dropbox, Notion, etc.). Opens in a new tab.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                      Link name *
                    </span>
                <input
                  className={fieldClass}
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                      placeholder="e.g. Design brief"
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">URL *</span>
                <input
                  className={fieldClass}
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://"
                />
              </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">Category</span>
                <select
                  className={fieldClass}
                  value={docCat}
                  onChange={(e) => setDocCat(e.target.value)}
                >
                  {DEFAULT_DOC_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                      Description
                    </span>
                    <input
                      className={fieldClass}
                      value={docDescription}
                      onChange={(e) => setDocDescription(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void addDocumentLink()}
                  disabled={docLinkSaving}
                  className={`${btnPrimary} w-fit disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <LinkIcon sx={{ fontSize: 15 }} />
                  {docLinkSaving ? 'Saving…' : 'Add link'}
                </button>
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-8">
              No documents or links yet.
              {canWrite && !isReadOnly
                ? ' Upload a file or add a link using the panels above.'
                : ''}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Uploaded files */}
              <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                  <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                    Documents (
                    {documents.filter((d) => !isProjectDocumentExternalLink(d)).length})
                  </h3>
                  <p className="m-0 mt-0.5 text-[11px] text-zinc-500">Uploaded files — download</p>
                </div>
                {documents.filter((d) => !isProjectDocumentExternalLink(d)).length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500">
                    No uploaded files
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {documents
                      .filter((d) => !isProjectDocumentExternalLink(d))
                      .map((d) => (
              <div
                key={d._id}
                          className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-950">
                              {d.name || 'Document'}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {d.category || 'General'}
                              {d.size
                                ? ` · ${Math.max(1, Math.round(d.size / 1024))} KB`
                                : ''}
                              {d.uploadedByName || d.uploadedBy
                                ? ` · ${d.uploadedByName || d.uploadedBy}`
                                : ''}
                              {d.createdAt
                                ? ` · ${new Date(d.createdAt).toLocaleDateString()}`
                                : ''}
                            </div>
                            {d.description ? (
                              <div className="mt-0.5 text-[11px] text-zinc-600">
                                {d.description}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {d.url ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await downloadAttachment(d.url, d.name || 'document');
                                    showToast('Download started');
                                  } catch (err) {
                                    showToast(
                                      err instanceof Error ? err.message : 'Download failed',
                                      'error'
                                    );
                                  }
                                }}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 cursor-pointer hover:bg-zinc-50"
                              >
                                <DownloadOutlinedIcon sx={{ fontSize: 15 }} />
                                Download
                              </button>
                            ) : null}
                            {canWrite && !isReadOnly && (
                              <button
                                type="button"
                                onClick={() => void deleteDocument(d._id)}
                                className="p-1.5 rounded-lg border border-red-200 text-red-600 bg-white cursor-pointer"
                                aria-label={`Delete ${d.name || 'document'}`}
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                  <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                    Links ({documents.filter((d) => isProjectDocumentExternalLink(d)).length})
                  </h3>
                  <p className="m-0 mt-0.5 text-[11px] text-zinc-500">External URLs — view</p>
                </div>
                {documents.filter((d) => isProjectDocumentExternalLink(d)).length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500">No links yet</div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {documents
                      .filter((d) => isProjectDocumentExternalLink(d))
                      .map((d) => (
                        <div
                          key={d._id}
                          className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-950">
                              {d.name || 'Link'}
                            </div>
                  <div className="text-[11px] text-zinc-500">
                              {d.category || 'General'}
                              {d.createdAt
                                ? ` · ${new Date(d.createdAt).toLocaleDateString()}`
                                : ''}
                  </div>
                            {d.url ? (
                              <div
                                className="mt-0.5 text-[11px] text-zinc-500 truncate max-w-xl"
                                title={d.url}
                              >
                                {d.url}
                </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {d.url ? (
                              <a
                                href={
                                  d.url.startsWith('http')
                                    ? d.url
                                    : `https://${d.url}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 no-underline hover:bg-zinc-50"
                              >
                                <OpenInNewOutlinedIcon sx={{ fontSize: 15 }} />
                                View
                              </a>
                            ) : null}
                            {canWrite && !isReadOnly && (
                  <button
                    type="button"
                                onClick={() => void deleteDocument(d._id)}
                    className="p-1.5 rounded-lg border border-red-200 text-red-600 bg-white cursor-pointer"
                                aria-label={`Delete ${d.name || 'link'}`}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                  </button>
                )}
              </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Activity ─────────────────────────────────────────────────────── */}
      {tab === 'activity' && (
        <div className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-3">
          <input
            className={`${fieldClass} max-w-sm`}
            placeholder="Search activity…"
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
          />
          {filteredActivity.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-8">No activity yet.</div>
          ) : (
            filteredActivity.map((a) => (
              <div key={a._id} className="border-b border-zinc-100 pb-3 last:border-0">
                <div className="text-sm text-zinc-900">{a.message}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {(a.userName && !isHexId(a.userName) ? a.userName : 'System')} · {new Date(a.createdAt).toLocaleString()} · {a.action}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Drop modal */}
      {dropOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-zinc-300 rounded-xl w-full max-w-md p-5 shadow-lg">
            <h3 className="text-base font-bold text-zinc-950 m-0 mb-2">Drop project</h3>
            <p className="text-xs text-zinc-500 m-0 mb-3">
              Dropped projects are hidden from the active workspace until reactivated.
            </p>
            <label className="flex flex-col gap-1 mb-4">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Reason</span>
              <textarea
                className="min-h-[80px] px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400"
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                placeholder="Optional reason…"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDropOpen(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDrop}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-red-700 bg-red-700 text-white cursor-pointer"
              >
                Drop Project
              </button>
            </div>
          </div>
        </div>
      )}

      <LiveLinkModal
        open={liveLinkModalOpen}
        projectName={project?.name}
        initialUrl={project?.liveUrl || ''}
        title={project?.liveUrl ? 'Update live link' : 'Add live link'}
        submitLabel={
          project && isLiveProjectStatus(project.status) ? 'Save link' : 'Save & go Live'
        }
        subtitle={
          project && isLiveProjectStatus(project.status)
            ? 'Update the public URL for this live project.'
            : undefined
        }
        onCancel={() => setLiveLinkModalOpen(false)}
        onConfirm={saveLiveLink}
      />

      {/* Task modal */}
      {taskModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white border border-zinc-300 rounded-xl w-full max-w-lg p-5 flex flex-col gap-3 my-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-zinc-950 m-0">
              {taskModal._id ? 'Edit Task' : 'New Task'}
            </h3>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Title *</span>
              <input
                className={fieldClass}
                value={taskModal.title || ''}
                onChange={(e) => setTaskModal({ ...taskModal, title: e.target.value })}
                disabled={isReadOnly && !isClient}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Status</span>
              <select
                className={fieldClass}
                value={taskModal.status || 'To Do'}
                onChange={(e) => setTaskModal({ ...taskModal, status: e.target.value })}
                  disabled={!canTaskWrite || isReadOnly}
              >
                {DEFAULT_TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">Priority</span>
                <select
                  className={fieldClass}
                  value={taskModal.priority || 'Medium'}
                  onChange={(e) => setTaskModal({ ...taskModal, priority: e.target.value })}
                  disabled={!canTaskWrite || isReadOnly}
                >
                  {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Milestone
                </span>
                <select
                  className={fieldClass}
                  value={taskModal.milestoneId || ''}
                  onChange={(e) =>
                    setTaskModal({ ...taskModal, milestoneId: e.target.value || null })
                  }
                  disabled={!canTaskWrite || isReadOnly}
                >
                  <option value="">None</option>
                  {milestones.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Depends on task
                </span>
                <select
                  className={fieldClass}
                  value={taskModal.dependsOnTaskId || ''}
                  onChange={(e) =>
                    setTaskModal({ ...taskModal, dependsOnTaskId: e.target.value || null })
                  }
                  disabled={!canTaskWrite || isReadOnly}
                >
                  <option value="">None</option>
                  {tasks
                    .filter((t) => t._id !== taskModal._id && !t.isArchived)
                    .map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Assignee</span>
              <select
                className={fieldClass}
                value={taskModal.assigneeId || ''}
                onChange={(e) => setTaskModal({ ...taskModal, assigneeId: e.target.value })}
                disabled={!canTaskWrite || isReadOnly}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {getMemberDisplayName(m)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Start date
                </span>
                <input
                  type="date"
                  className={fieldClass}
                  value={toDateInput(taskModal.startDate)}
                  onChange={(e) => setTaskModal({ ...taskModal, startDate: e.target.value })}
                  disabled={!canTaskWrite || isReadOnly}
                />
              </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Due date</span>
              <input
                type="date"
                className={fieldClass}
                  value={toDateInput(taskModal.dueDate)}
                onChange={(e) => setTaskModal({ ...taskModal, dueDate: e.target.value })}
                  disabled={!canTaskWrite || isReadOnly}
              />
            </label>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(taskModal.notifyClientOnCompletion)}
                onChange={(e) =>
                  setTaskModal({ ...taskModal, notifyClientOnCompletion: e.target.checked })
                }
                disabled={!canTaskWrite || isReadOnly}
              />
              <span className="text-xs font-semibold text-zinc-700">
                Notify client on completion
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(taskModal.isRecurring)}
                onChange={(e) =>
                  setTaskModal({ ...taskModal, isRecurring: e.target.checked })
                }
                disabled={!canTaskWrite || isReadOnly}
              />
              <span className="text-xs font-semibold text-zinc-700">Recurring</span>
            </label>

            {taskModal.isRecurring && (
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Every</span>
                  <input
                    type="number"
                    min={1}
                    className={fieldClass}
                    value={taskModal.every ?? 1}
                    onChange={(e) =>
                      setTaskModal({ ...taskModal, every: Number(e.target.value) || 1 })
                    }
                    disabled={!canTaskWrite || isReadOnly}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                    Interval
                  </span>
                  <select
                    className={fieldClass}
                    value={taskModal.interval || 'week'}
                    onChange={(e) => setTaskModal({ ...taskModal, interval: e.target.value })}
                    disabled={!canTaskWrite || isReadOnly}
                  >
                    {['day', 'week', 'month', 'year'].map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Cycles</span>
                  <input
                    type="number"
                    min={0}
                    className={fieldClass}
                    value={taskModal.cycles ?? 0}
                    onChange={(e) =>
                      setTaskModal({ ...taskModal, cycles: Number(e.target.value) || 0 })
                    }
                    disabled={!canTaskWrite || isReadOnly}
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                Client feedback
              </span>
              <select
                className={fieldClass}
                value={taskModal.clientFeedbackStatus || ''}
                onChange={(e) =>
                  setTaskModal({ ...taskModal, clientFeedbackStatus: e.target.value })
                }
                disabled={isReadOnly && !isClient}
              >
                <option value="">—</option>
                {clientFeedbackOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>


            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                Description
              </span>
              <textarea
                className="min-h-[80px] px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border"
                value={taskModal.description || ''}
                onChange={(e) => setTaskModal({ ...taskModal, description: e.target.value })}
                disabled={!canTaskWrite || isReadOnly}
              />
            </label>

            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setTaskModal(null)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTask}
                disabled={saving}
                className={btnPrimary}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Log Modal */}
      {timeLogModalOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shadow-xs">
                  <AccessTimeIcon sx={{ fontSize: 18 }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 m-0">Log Project Time</h3>
                  <p className="text-[11px] text-zinc-500 m-0 mt-0.5">
                    Record billable or non-billable hours spent on project deliverables.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTimeLogModalOpen(false)}
                className="w-7 h-7 rounded-lg border border-zinc-300 bg-white text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex flex-col gap-4">
              {/* Task select */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-700">Associated Task</span>
                <select
                  className={fieldClass}
                  value={tlTaskId}
                  onChange={(e) => setTlTaskId(e.target.value)}
                >
                  <option value="">General (no specific task)</option>
                  {tasks
                    .filter((t) => !t.isArchived)
                    .map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.title} ({t.status})
                      </option>
                    ))}
                </select>
              </label>

              {/* Member select */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-700">Team Member *</span>
                <select
                  className={fieldClass}
                  value={tlUserId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setTlUserId(uid);
                    const m = members.find((x) => x.userId === uid);
                    if (m?.hourlyRate != null) setTlHourlyRate(String(m.hourlyRate));
                  }}
                  required
                >
                  <option value="">Select team member…</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {getMemberDisplayName(m)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Date & Hours Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700">Date *</span>
                    <button
                      type="button"
                      onClick={() => setTlDate(new Date().toISOString().slice(0, 10))}
                      className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 border-none bg-transparent cursor-pointer p-0"
                    >
                      Today
                    </button>
                  </div>
                  <input
                    type="date"
                    className={fieldClass}
                    value={tlDate}
                    onChange={(e) => setTlDate(e.target.value)}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-zinc-700">Hours *</span>
                  <input
                    type="number"
                    min={0.25}
                    step={0.25}
                    className={fieldClass}
                    value={tlHours}
                    onChange={(e) => setTlHours(e.target.value)}
                    placeholder="e.g. 2.5"
                    required
                  />
                </label>
              </div>

              {/* Quick Hours Presets */}
              <div className="flex items-center gap-1.5 -mt-1">
                <span className="text-[10px] text-zinc-400 font-medium mr-1">Quick presets:</span>
                {['0.5', '1', '2', '4', '8'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTlHours(preset)}
                    className={`px-2.5 py-0.5 text-[11px] font-mono rounded border cursor-pointer transition-colors ${
                      tlHours === preset
                        ? 'border-zinc-950 bg-zinc-950 text-white font-bold'
                        : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {preset}h
                  </button>
                ))}
              </div>

              {/* Hourly Rate & Billable Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-zinc-700">Hourly Rate ({currency})</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={fieldClass}
                    value={tlHourlyRate}
                    onChange={(e) => setTlHourlyRate(e.target.value)}
                  />
                </label>

                <label className="flex flex-col justify-end">
                  <div className="flex items-center gap-2.5 h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50/50 cursor-pointer hover:bg-zinc-100/50 select-none">
                    <input
                      type="checkbox"
                      checked={tlBillable}
                      onChange={(e) => setTlBillable(e.target.checked)}
                      className="rounded text-zinc-950 focus:ring-zinc-950 cursor-pointer"
                      id="tl-modal-billable"
                    />
                    <label htmlFor="tl-modal-billable" className="text-xs font-semibold text-zinc-800 cursor-pointer">
                      Billable to Client
                    </label>
                  </div>
                </label>
              </div>

              {/* Note / Description */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-700">Description / Work Note</span>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 box-border font-sans"
                  value={tlNote}
                  onChange={(e) => setTlNote(e.target.value)}
                  placeholder="Summary of work completed during this period…"
                />
              </label>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-zinc-200 flex items-center justify-end gap-2 bg-zinc-50/70">
              <button
                type="button"
                onClick={() => setTimeLogModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addTimeLog}
                disabled={saving || !tlUserId || !(Number(tlHours) > 0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white border-none cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
              >
                <AccessTimeIcon sx={{ fontSize: 14 }} />
                <span>{saving ? 'Logging…' : 'Save Time Log'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
