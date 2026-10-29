import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { ListPager, type ListPaginationMeta } from '../../components/common/ListPager';
import { TaskItem } from '../../types/tasks';
import { ProjectItem } from '../../types/projects';
import {
  TimeLogItem,
  WeeklyTimesheet,
  TIME_DURATION_PRESETS,
  normalizeApprovalStatus,
  resolveTimeLogHours,
  resolveTimeLogBillableAmount,
} from '../../types/timeLogs';
import { TourButton } from '../../ui/tour';
import { displayLabel, displayUserLabel } from '../../utils/displayLabels';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { formatCrmMoney } from '../../utils/currency';

const fieldClass =
  'h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500';
const btnClass =
  'inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50';
const btnPrimary =
  'inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white cursor-pointer disabled:opacity-50';

type ViewMode = 'list' | 'weekly';
type ModalMode = 'manual' | 'check-in' | 'timer' | 'checkout' | 'reject' | null;
type SortKey = 'workDate' | 'taskTitle' | 'hours';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function mondayOf(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = parseLocalDate(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return formatLocalDate(d);
}

function dayHeaderLabel(iso: string): string {
  const d = parseLocalDate(iso);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${names[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`;
}

function checkInIso(item?: TimeLogItem | null): string | undefined {
  return item?.checkInAt || item?.checkInTime;
}

function formatElapsedHHMMSS(checkInAt?: string, _tick = 0): string {
  void _tick;
  if (!checkInAt) return '00:00:00';
  const ms = Math.max(0, Date.now() - new Date(checkInAt).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatElapsedReadable(checkInAt?: string, _tick = 0): string {
  void _tick;
  if (!checkInAt) return '0h 0m 0s (~0.00 hrs)';
  const ms = Math.max(0, Date.now() - new Date(checkInAt).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const decimal = Math.round((ms / 3600000) * 100) / 100;
  return `${h}h ${m}m ${s}s (~${decimal.toFixed(2)} hrs)`;
}

function formatClock(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMoney(value?: number, currency?: string) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return formatCrmMoney(value, currency, { maximumFractionDigits: 2 });
}

function normalizeDuration(hours: number, minutes: number): { hours: number; minutes: number; decimal: number } {
  let total = Math.max(0, Math.floor(hours) * 60 + Math.floor(minutes));
  if (total > 24 * 60) total = 24 * 60;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return { hours: h, minutes: m, decimal: Math.round((h + m / 60) * 100) / 100 };
}

function durationBadgeLabel(hours: number, minutes: number): string {
  const n = normalizeDuration(hours, minutes);
  return `${n.hours}h ${n.minutes}m (${n.decimal.toFixed(2)} hrs)`;
}

function approvalPillClass(status: string): string {
  const s = normalizeApprovalStatus(status);
  if (s === 'Approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (s === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (s === 'Rejected') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-zinc-200 bg-zinc-50 text-zinc-700';
}

function dayCellClass(status?: string): string {
  const s = normalizeApprovalStatus(status);
  if (s === 'Approved') return 'ts-entry-approved text-emerald-800';
  if (s === 'Pending') return 'ts-entry-pending text-amber-800';
  if (s === 'Rejected') return 'ts-entry-rejected text-red-700';
  return 'text-zinc-700';
}

function timeLogMemberName(item: TimeLogItem): string {
  return displayUserLabel(
    item.userName ||
      item.memberUsername ||
      item.username ||
      item.assignedUsername ||
      item.taskAssignedUsername,
    item.userId || item.createdBy,
    'Team Member'
  );
}

function timeLogMemberInitial(item: TimeLogItem): string {
  const name = timeLogMemberName(item);
  return (name && name !== '—' ? name : 'U').slice(0, 1).toUpperCase();
}

function emptyForm(overrides: Partial<{
  taskId: string;
  workDate: string;
  hours: string;
  minutes: string;
  hourlyRate: string;
  isBillable: boolean;
  description: string;
}> = {}) {
  return {
    taskId: '',
    workDate: localToday(),
    hours: '1',
    minutes: '30',
    hourlyRate: '0',
    isBillable: true,
    description: '',
    ...overrides,
  };
}

export const TimeLogsPage: React.FC = () => {
  const { alert, confirm } = useDialog();
  const settingsCurrency = useDefaultCurrency();
  const [view, setView] = useState<ViewMode>('list');
  const [items, setItems] = useState<TimeLogItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [week, setWeek] = useState<WeeklyTimesheet | null>(null);
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [activeTimer, setActiveTimer] = useState<TimeLogItem | null>(null);

  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectId, setProjectId] = useState(() => searchParams.get('projectId') || '');
  const [userId, setUserId] = useState(() => searchParams.get('userId') || '');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState(() => searchParams.get('entryType') || '');
  const [lockedFilter, setLockedFilter] = useState(() => searchParams.get('locked') || '');
  const [billableFilter, setBillableFilter] = useState(
    () => searchParams.get('billable') || ''
  );
  const [sortBy, setSortBy] = useState<SortKey>(
    () => (['workDate', 'taskTitle', 'hours'].includes(searchParams.get('sortBy') || '')
      ? (searchParams.get('sortBy') as SortKey)
      : 'workDate')
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    () => (searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc')
  );
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListPaginationMeta | null>(null);

  const [modal, setModal] = useState<ModalMode>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState(emptyForm());
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const loadActiveTimer = useCallback(async () => {
    try {
      const res = await crmApi.getActiveCheckIn();
      setActiveTimer(res.data || null);
    } catch {
      setActiveTimer(null);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listTimeLogs({
        search: search || undefined,
        projectId: projectId || undefined,
        userId: userId || undefined,
        approvalStatus: approvalFilter || undefined,
        entryType: methodFilter || undefined,
        isLocked:
          lockedFilter === 'locked' ? true : lockedFilter === 'unlocked' ? false : undefined,
        isBillable:
          billableFilter === 'billable'
            ? true
            : billableFilter === 'non'
              ? false
              : undefined,
        sortBy,
        sortDir,
        page,
        limit: 20,
      });
      setItems(response.data || []);
      setPagination(response.pagination || null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load time logs');
    } finally {
      setLoading(false);
    }
  }, [search, projectId, userId, approvalFilter, methodFilter, lockedFilter, billableFilter, sortBy, sortDir, page]);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.getWeeklyTimesheet({
        weekStart,
        projectId: projectId || undefined,
      });
      setWeek(response.data || null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load timesheet');
    } finally {
      setLoading(false);
    }
  }, [weekStart, projectId]);

  const refreshAfterAction = useCallback(async () => {
    await loadActiveTimer();
    if (view === 'list') await loadList();
    else await loadWeek();
  }, [loadActiveTimer, loadList, loadWeek, view]);

  // Sync when timer changes globally (e.g. from navbar or task detail page)
  useEffect(() => {
    const handleTimerChanged = () => {
      void loadActiveTimer();
      if (view === 'list') void loadList();
      else void loadWeek();
    };
    window.addEventListener('crm:timer-changed', handleTimerChanged);
    return () => {
      window.removeEventListener('crm:timer-changed', handleTimerChanged);
    };
  }, [loadActiveTimer, loadList, loadWeek, view]);

  useEffect(() => {
    setPage(1);
  }, [search, projectId, userId, approvalFilter, methodFilter, lockedFilter, billableFilter, sortBy, sortDir]);

  useEffect(() => {
    crmApi.listTasks({ limit: 100 }).then((response) => setTasks(response.data || [])).catch(() => setTasks([]));
    crmApi
      .listProjects({ limit: 200, view: 'all' })
      .then((response) => setProjects(response.data || []))
      .catch(() => setProjects([]));
    loadActiveTimer();
  }, [loadActiveTimer]);

  useEffect(() => {
    if (view === 'list') {
      const timer = window.setTimeout(loadList, 250);
      return () => clearTimeout(timer);
    }
    loadWeek();
    return undefined;
  }, [view, loadList, loadWeek]);

  const runningFromList = useMemo(
    () => items.find((item) => item.status === 'Running') || null,
    [items]
  );
  const running = activeTimer || runningFromList;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onTourView = (e: Event) => {
      const view = (e as CustomEvent<{ view?: ViewMode }>).detail?.view;
      if (view === 'list' || view === 'weekly') setView(view);
    };
    const onTourModal = (e: Event) => {
      const mode = (e as CustomEvent<{ mode?: ModalMode }>).detail?.mode;
      if (mode === 'manual') {
        openManual();
        return;
      }
      if (mode === 'check-in') {
        openCheckIn();
        return;
      }
      if (mode === null || mode === undefined) {
        setModal(null);
      }
    };
    window.addEventListener('crm-time-logs-tour-view', onTourView as EventListener);
    window.addEventListener('crm-time-logs-tour-modal', onTourModal as EventListener);
    return () => {
      window.removeEventListener('crm-time-logs-tour-view', onTourView as EventListener);
      window.removeEventListener('crm-time-logs-tour-modal', onTourModal as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalHours = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.hours || 0), 0),
    [items]
  );

  const formHours = Number(form.hours) || 0;
  const formMinutes = Number(form.minutes) || 0;
  const normalizedForm = normalizeDuration(formHours, formMinutes);

  const openManual = (prefill?: { taskId?: string; workDate?: string }) => {
    setForm(
      emptyForm({
        taskId: prefill?.taskId || '',
        workDate: prefill?.workDate || localToday(),
      })
    );
    setModal('manual');
    setError('');
  };

  useEffect(() => {
    const action = String(searchParams.get('action') || '').toLowerCase();
    if (action !== 'log' && action !== 'manual' && action !== 'new') return;
    openManual();
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const nextBillable = searchParams.get('billable') || '';
    const nextProjectId = searchParams.get('projectId') || '';
    const nextUserId = searchParams.get('userId') || '';
    const nextMethod = searchParams.get('entryType') || '';
    const nextLocked = searchParams.get('locked') || '';
    const nextSortBy = (searchParams.get('sortBy') as SortKey) || '';
    const nextSortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : searchParams.get('sortDir') === 'desc' ? 'desc' : '';
    setBillableFilter((prev) => (prev === nextBillable ? prev : nextBillable));
    setProjectId((prev) => (prev === nextProjectId ? prev : nextProjectId));
    setUserId((prev) => (prev === nextUserId ? prev : nextUserId));
    setMethodFilter((prev) => (prev === nextMethod ? prev : nextMethod));
    setLockedFilter((prev) => (prev === nextLocked ? prev : nextLocked));
    if (nextSortBy === 'workDate' || nextSortBy === 'taskTitle' || nextSortBy === 'hours') {
      setSortBy((prev) => (prev === nextSortBy ? prev : nextSortBy));
    }
    if (nextSortDir) {
      setSortDir((prev) => (prev === nextSortDir ? prev : nextSortDir));
    }
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (billableFilter) params.set('billable', billableFilter);
    else params.delete('billable');
    if (projectId) params.set('projectId', projectId);
    else params.delete('projectId');
    if (userId) params.set('userId', userId);
    else params.delete('userId');
    if (methodFilter) params.set('entryType', methodFilter);
    else params.delete('entryType');
    if (lockedFilter) params.set('locked', lockedFilter);
    else params.delete('locked');
    if (sortBy) params.set('sortBy', sortBy);
    else params.delete('sortBy');
    if (sortDir) params.set('sortDir', sortDir);
    else params.delete('sortDir');
    setSearchParams(params, { replace: true });
  }, [billableFilter, projectId, userId, methodFilter, lockedFilter, sortBy, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCheckIn = () => {
    setForm(emptyForm({ hours: '0', minutes: '0' }));
    setModal('check-in');
    setError('');
  };

  const openTimerView = () => {
    if (!running) return openCheckIn();
    setModal('timer');
    setError('');
  };

  const openCheckout = (log?: TimeLogItem | null) => {
    const target = log || running;
    if (!target) return;
    setActiveTimer(target);
    setCheckoutNotes(target.description || target.note || '');
    setModal('checkout');
    setError('');
  };

  const openReject = (id: string) => {
    setRejectTargetId(id);
    setRejectReason('');
    setModal('reject');
    setError('');
  };

  const resetFilters = () => {
    setSearch('');
    setProjectId('');
    setUserId('');
    setApprovalFilter('');
    setMethodFilter('');
    setLockedFilter('');
    setBillableFilter('');
    setSortBy('workDate');
    setSortDir('desc');
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir(key === 'workDate' ? 'desc' : 'asc');
    }
  };

  const addPreset = (addH: number, addM: number) => {
    const next = normalizeDuration(formHours + addH, formMinutes + addM);
    setForm((current) => ({
      ...current,
      hours: String(next.hours),
      minutes: String(next.minutes),
    }));
  };

  const saveManualOrCheckIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const task = tasks.find((item) => item._id === form.taskId);
    if (!task) return setError('Task is required.');
    setSaving(true);
    try {
      if (modal === 'check-in') {
        const checkInRes = await crmApi.checkIn({
          taskId: task._id,
          projectId: task.projectId,
          hourlyRate: Number(form.hourlyRate) || 0,
          isBillable: form.isBillable,
          description: form.description,
          workDate: localToday(),
        });
        window.dispatchEvent(
          new CustomEvent('crm:timer-changed', {
            detail: { activeTimer: checkInRes.data, action: 'check-in' },
          })
        );
      } else {
        const hours = normalizedForm.decimal;
        if (!(hours > 0)) return setError('Enter hours or minutes greater than zero.');
        await crmApi.createTimeLog({
          taskId: task._id,
          taskTitle: task.title,
          projectId: task.projectId,
          workDate: form.workDate,
          date: form.workDate,
          hours,
          hourlyRate: Number(form.hourlyRate) || 0,
          isBillable: form.isBillable,
          description: form.description,
          entryType: 'manual',
        });
      }
      setModal(null);
      setForm(emptyForm());
      await refreshAfterAction();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save time log');
    } finally {
      setSaving(false);
    }
  };

  const submitCheckout = async () => {
    if (!running) return;
    setSaving(true);
    try {
      const checkOutRes = await crmApi.checkOut({
        timeLogId: running._id,
        description: checkoutNotes,
      });
      setModal(null);
      setCheckoutNotes('');
      window.dispatchEvent(
        new CustomEvent('crm:timer-changed', {
          detail: { activeTimer: null, action: 'check-out', completed: checkOutRes.data },
        })
      );
      await refreshAfterAction();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to check out');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: TimeLogItem) => {
    if (item.isLocked) {
      setError('Locked time logs cannot be deleted.');
      return;
    }
    if (!(await confirm({ message: 'Delete this time log?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteTimeLog(item._id);
      setItems((current) => current.filter((row) => row._id !== item._id));
      await loadActiveTimer();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete time log');
    }
  };

  const setApproval = async (id: string, action: 'submit' | 'approve') => {
    try {
      if (action === 'submit') await crmApi.submitTimeLog(id);
      if (action === 'approve') await crmApi.approveTimeLog(id);
      await refreshAfterAction();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Approval action failed');
    }
  };

  const submitReject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rejectReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setSaving(true);
    try {
      await crmApi.rejectTimeLog(rejectTargetId, { reason: rejectReason.trim() });
      setModal(null);
      setRejectReason('');
      setRejectTargetId('');
      await refreshAfterAction();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reject failed');
    } finally {
      setSaving(false);
    }
  };

  const bulkApproveWeek = async () => {
    const days = week?.days || [];
    if (!days.length) {
      setError('No week loaded.');
      return;
    }
    if (!(await confirm('Bulk approve all pending/submitted entries for this week?'))) return;
    try {
      const all = await crmApi.listTimeLogs({ projectId: projectId || undefined, limit: 100 });
      const ids = (all.data || [])
        .filter((item) => {
          const status = item.approvalStatus;
          const normalized = normalizeApprovalStatus(status);
          const isPendingLike =
            normalized === 'Pending' || status === 'Submitted' || status === 'Pending';
          const workDate = String(item.workDate || item.date || '').slice(0, 10);
          return isPendingLike && days.includes(workDate);
        })
        .map((item) => item._id);
      if (!ids.length) {
        setError('No pending or submitted entries to approve for this week.');
        return;
      }
      const res = await crmApi.bulkApproveTimeLogs(ids);
      setError('');
      await refreshAfterAction();
      await alert(`Approved ${res.data.approved} entries.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Bulk approve failed');
    }
  };

  useEffect(() => {
    if (!exportOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [exportOpen]);

  const exportData = async (format: 'csv' | 'json') => {
    setExportOpen(false);
    try {
      const res = await crmApi.exportTimeLogs({
        format,
        search: search || undefined,
        projectId: projectId || undefined,
        approvalStatus: approvalFilter || undefined,
        entryType: methodFilter || undefined,
        isLocked:
          lockedFilter === 'locked' ? true : lockedFilter === 'unlocked' ? false : undefined,
        isBillable:
          billableFilter === 'billable'
            ? true
            : billableFilter === 'non'
              ? false
              : undefined,
      });
      const mime =
        format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8';
      const blob = new Blob([res.data.content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.data.filename ||
        `time-logs-${Date.now()}.${format === 'json' ? 'json' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    }
  };

  const todayIso = localToday();
  const elapsed = formatElapsedHHMMSS(checkInIso(running), tick);

  const sortLabel = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="border-0 bg-transparent p-0 text-xs font-semibold uppercase text-zinc-500 cursor-pointer"
    >
      {label}
      {sortBy === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );

  return (
    <div data-tour="time-logs-tour-landing" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
        <div data-tour="time-logs-title">
          <h1 className="m-0 text-2xl font-bold">Time Logs</h1>
          <p className="mt-1 mb-0 text-sm text-zinc-500">
            {view === 'list'
              ? `${totalHours.toFixed(2)} hours in this view.`
              : week
                ? `Week of ${week.weekStart} → ${week.weekEnd} · ${Number(week.grandTotal || 0).toFixed(2)} h`
                : 'Weekly timesheet'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div
            data-tour="time-logs-view-tabs"
            className="inline-flex rounded-lg border border-zinc-300 bg-white p-0.5"
          >
            <button
              type="button"
              data-tour="time-logs-view-list"
              onClick={() => setView('list')}
              className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer ${
                view === 'list' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
              }`}
            >
              List
            </button>
            <button
              type="button"
              data-tour="time-logs-view-weekly"
              onClick={() => setView('weekly')}
              className={`h-8 px-3 text-xs font-semibold rounded-md border-0 cursor-pointer ${
                view === 'weekly' ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
              }`}
            >
              Weekly
            </button>
          </div>
          {running ? (
            <button
              type="button"
              data-tour="time-logs-checkin-btn"
              disabled={saving}
              onClick={() => openCheckout(running)}
              className={`${btnClass} border-emerald-300 bg-emerald-50 text-emerald-800`}
            >
              <StopIcon sx={{ fontSize: 16 }} />
              Check Out
            </button>
          ) : (
            <button
              type="button"
              data-tour="time-logs-checkin-btn"
              onClick={openCheckIn}
              className={btnClass}
            >
              <PlayArrowIcon sx={{ fontSize: 16 }} />
              Check In
            </button>
          )}
          <button
            type="button"
            data-tour="time-logs-manual-btn"
            onClick={() => openManual()}
            className={btnPrimary}
          >
            <AddIcon sx={{ fontSize: 16 }} />
            Manual Time Entry
          </button>
          <div className="relative" ref={exportRef} data-tour="time-logs-export-btn">
            <button
              type="button"
              onClick={() => setExportOpen((open) => !open)}
              className={btnClass}
            >
              <DownloadIcon sx={{ fontSize: 16 }} />
              Export
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg">
                <button
                  type="button"
                  data-tour="time-logs-export-csv"
                  onClick={() => void exportData('csv')}
                  className="w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  data-tour="time-logs-export-json"
                  onClick={() => void exportData('json')}
                  className="w-full cursor-pointer border-0 border-t border-zinc-100 bg-transparent px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>
          <TourButton moduleId="time-logs" className={btnClass} />
        </div>
      </div>

      {running && (
        <div
          data-tour="time-logs-timer-banner"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <strong>Timer running</strong>
            </span>
            <span className="font-mono text-base font-bold tracking-wider">{elapsed}</span>
            <span className="text-emerald-800">
              on {displayLabel(running.taskTitle)}
              {running.projectName ? ` · ${running.projectName}` : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={openTimerView} className={`${btnClass} border-emerald-300 bg-white text-emerald-900`}>
              View timer
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => openCheckout(running)}
              className="h-8 px-3 rounded-lg border border-emerald-700 bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Check Out
            </button>
          </div>
        </div>
      )}

      {view === 'list' && (
        <div
          data-tour="time-logs-filters"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-300 bg-white p-3"
        >
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500">Search</span>
            <input
              className={fieldClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Task, project, member, notes…"
            />
          </label>
          <label className="flex min-w-40 flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500">Project</span>
            <select className={fieldClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          {userId ? (
            <div className="flex min-w-40 flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500">Team member</span>
              <div className="flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-2">
                <span className="truncate font-mono text-[11px] font-semibold text-zinc-800">{userId}</span>
                <button
                  type="button"
                  className="shrink-0 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer"
                  onClick={() => setUserId('')}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
          <label className="flex min-w-36 flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500">Approval</span>
            <select className={fieldClass} value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)}>
              <option value="">All</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </label>
          <label className="flex min-w-32 flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500">Method</span>
            <select
              className={fieldClass}
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="timer">Timer</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="flex min-w-32 flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500">Locked</span>
            <select
              className={fieldClass}
              value={lockedFilter}
              onChange={(e) => {
                setLockedFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="locked">Locked</option>
              <option value="unlocked">Unlocked</option>
            </select>
          </label>
          <label className="flex min-w-36 flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500">Billable</span>
            <select
              className={fieldClass}
              value={billableFilter}
              onChange={(e) => {
                setBillableFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="billable">Billable</option>
              <option value="non">Non-billable</option>
            </select>
          </label>
          <label className="flex min-w-36 flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500">Sort</span>
            <select
              className={fieldClass}
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
                setSortBy(key);
                setSortDir(dir);
                setPage(1);
              }}
            >
              <option value="workDate:desc">Date ↓</option>
              <option value="workDate:asc">Date ↑</option>
              <option value="taskTitle:asc">Task ↑</option>
              <option value="taskTitle:desc">Task ↓</option>
              <option value="hours:desc">Hours ↓</option>
              <option value="hours:asc">Hours ↑</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters} className={btnClass}>
            Reset
          </button>
          <button type="button" onClick={() => { loadList(); loadActiveTimer(); }} className={btnClass}>
            <RefreshIcon sx={{ fontSize: 16 }} />
            Refresh
          </button>
        </div>
      )}

      {view === 'weekly' && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-300 bg-white p-3">
          <label className="flex min-w-44 flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500">Project</span>
            <select className={fieldClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => { loadWeek(); loadActiveTimer(); }} className={btnClass}>
            <RefreshIcon sx={{ fontSize: 16 }} />
            Refresh
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {view === 'weekly' ? (
        <div
          data-tour="time-logs-weekly"
          className="overflow-hidden rounded-xl border border-zinc-300 bg-white"
        >
          <div
            data-tour="time-logs-weekly-nav"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={btnClass} onClick={() => setWeekStart(shiftWeek(weekStart, -1))}>
                ← Prev Week
              </button>
              <button type="button" className={btnClass} onClick={() => setWeekStart(mondayOf())}>
                This Week
              </button>
              <button type="button" className={btnClass} onClick={() => setWeekStart(shiftWeek(weekStart, 1))}>
                Next Week →
              </button>
              {week && (
                <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700">
                  {week.weekStart} → {week.weekEnd}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={bulkApproveWeek}
              className="h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 cursor-pointer"
            >
              Bulk Approve Week
            </button>
          </div>
          {loading || !week ? (
            <div className="p-10 text-center text-sm text-zinc-500">Loading timesheet…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="p-3">Task / Project</th>
                    {(week.days || []).map((day) => (
                      <th
                        key={day}
                        className={`p-3 text-center ${day === todayIso ? 'bg-emerald-50 today-col' : ''}`}
                      >
                        {dayHeaderLabel(day)}
                      </th>
                    ))}
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(week.rows || []).length === 0 ? (
                    <tr>
                      <td colSpan={(week.days?.length || 0) + 2} className="p-10 text-center text-zinc-500">
                        No hours logged this week.
                      </td>
                    </tr>
                  ) : (
                    (week.rows || []).map((row) => (
                      <tr key={`${row.taskId}-${row.projectId}`} className="border-t border-zinc-100">
                        <td className="p-3">
                          <Link
                            to={`/tasks/${row.taskId}`}
                            className="font-semibold text-zinc-950 no-underline hover:underline"
                          >
                            {row.taskTitle}
                          </Link>
                          <div className="text-[11px] text-zinc-500">
                            {row.projectId ? (
                              <Link
                                to={`/projects/${row.projectId}`}
                                className="text-zinc-500 no-underline hover:underline"
                              >
                                {displayLabel(row.projectName)}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </div>
                        </td>
                        {(week.days || []).map((day) => {
                          const hours = Number(row.days?.[day] || 0);
                          const meta = row.dayMeta?.[day];
                          const isToday = day === todayIso;
                          return (
                            <td
                              key={day}
                              className={`p-2 text-center ${isToday ? 'bg-emerald-50 today-cell' : ''} ${dayCellClass(meta?.approvalStatus)}`}
                              title={
                                meta
                                  ? `${meta.count || 0} entries${meta.notes ? ` — ${meta.notes}` : ''}`
                                  : undefined
                              }
                            >
                              {hours > 0 ? (
                                <span className="font-semibold">{hours.toFixed(2)}</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openManual({ taskId: row.taskId, workDate: day })}
                                  className="h-7 rounded-md border border-dashed border-zinc-300 bg-white px-2 text-[11px] font-semibold text-zinc-600 cursor-pointer hover:border-zinc-500"
                                >
                                  + Log
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-3 text-right font-semibold">{Number(row.total || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {(week.rows || []).length > 0 && (
                  <tfoot>
                    <tr className="border-t border-zinc-200 bg-zinc-50 font-semibold">
                      <td className="p-3">Day totals</td>
                      {(week.days || []).map((day) => (
                        <td
                          key={day}
                          className={`p-3 text-center ${day === todayIso ? 'bg-emerald-50' : ''}`}
                        >
                          {Number(week.dayTotals?.[day] || 0).toFixed(2)}
                        </td>
                      ))}
                      <td className="p-3 text-right">{Number(week.grandTotal || 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      ) : (
        <div
          data-tour="time-logs-list"
          className="overflow-hidden rounded-xl border border-zinc-300 bg-white"
        >
          {loading ? (
            <div className="p-10 text-center text-sm text-zinc-500">Loading time logs…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">No time logs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="p-3">{sortLabel('workDate', 'Date')}</th>
                    <th className="p-3">{sortLabel('taskTitle', 'Task')}</th>
                    <th className="p-3">Project</th>
                    <th className="p-3">Member</th>
                    <th className="p-3">Method / Range</th>
                    <th className="p-3">Approval</th>
                    <th className="p-3">{sortLabel('hours', 'Hours')}</th>
                    <th className="p-3">Billable</th>
                    <th className="p-3">Billable Amount</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const approval = normalizeApprovalStatus(item.approvalStatus);
                    const note = item.description || item.note || '';
                    const amount = resolveTimeLogBillableAmount(item);
                    const displayHours = resolveTimeLogHours(item);
                    const entryType =
                      item.entryType ||
                      (item.checkInAt || item.checkInTime || item.status === 'Running'
                        ? 'timer'
                        : 'manual');
                    const started = checkInIso(item);
                    const ended = item.checkOutAt || item.checkOutTime;
                    return (
                      <tr key={item._id} className="border-t border-zinc-100 align-top">
                        <td className="p-3 text-zinc-600 whitespace-nowrap">
                          {String(item.workDate || item.date || '').slice(0, 10)}
                        </td>
                        <td className="p-3">
                          <Link
                            to={`/tasks/${item.taskId}`}
                            className="font-semibold text-zinc-950 no-underline hover:underline"
                          >
                            {displayLabel(item.taskTitle)}
                          </Link>
                          {note ? (
                            <div className="mt-1 text-[11px] text-zinc-500 line-clamp-2">
                              Note: {note.slice(0, 80)}
                              {note.length > 80 ? '…' : ''}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-3">
                          {item.projectId ? (
                            <Link
                              to={`/projects/${item.projectId}`}
                              className="text-zinc-600 no-underline hover:underline"
                            >
                              {displayLabel(item.projectName)}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                              {timeLogMemberInitial(item)}
                            </span>
                            <span className="text-zinc-600">{timeLogMemberName(item)}</span>
                          </div>
                        </td>
                        <td className="p-3 text-zinc-600">
                          <div className="text-xs font-semibold">
                            {entryType === 'timer' ? 'Timer' : 'Manual'}
                          </div>
                          <div className="text-[11px]">
                            {item.status === 'Running'
                              ? `Running · ${formatElapsedHHMMSS(started, tick)}`
                              : started
                                ? `${formatClock(started)} – ${formatClock(ended)}`
                                : '—'}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${approvalPillClass(approval)}`}
                            >
                              {approval}
                            </span>
                            {item.isLocked ? (
                              <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                                Locked
                              </span>
                            ) : null}
                          </div>
                          {approval === 'Rejected' && item.rejectionReason ? (
                            <div className="mt-1 text-[11px] text-red-600" title={item.rejectionReason}>
                              {item.rejectionReason.slice(0, 40)}
                              {item.rejectionReason.length > 40 ? '…' : ''}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-3 font-semibold">
                          {item.status === 'Running' ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                              {formatElapsedHHMMSS(started, tick)}
                            </span>
                          ) : (
                            `${Number(displayHours || 0).toFixed(2)}h`
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              item.isBillable ?? item.billable
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                            }`}
                          >
                            {item.isBillable ?? item.billable ? 'Billable' : 'Non-billable'}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-zinc-800">
                          {formatMoney(amount, settingsCurrency)}
                          {item.status === 'Running' && Number(item.hourlyRate || 0) > 0 ? (
                            <div className="mt-0.5 text-[10px] font-normal text-zinc-500">
                              @ {formatMoney(Number(item.hourlyRate || 0), settingsCurrency)}/hr
                            </div>
                          ) : null}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="inline-flex flex-wrap justify-end gap-1">
                            {item.status === 'Running' && (
                              <button
                                type="button"
                                onClick={() => openCheckout(item)}
                                className="h-7 rounded-md border border-emerald-300 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-800 cursor-pointer"
                              >
                                Check Out
                              </button>
                            )}
                            {(approval === 'Draft' || approval === 'Rejected') &&
                              item.status !== 'Running' && (
                                <button
                                  type="button"
                                  onClick={() => setApproval(item._id, 'submit')}
                                  className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-700 cursor-pointer"
                                >
                                  Submit
                                </button>
                              )}
                            {approval === 'Pending' && item.status !== 'Running' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setApproval(item._id, 'approve')}
                                  className="h-7 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-800 cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReject(item._id)}
                                  className="h-7 rounded-md border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-700 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {!item.isLocked && item.status !== 'Running' && (
                              <button
                                type="button"
                                onClick={() => remove(item)}
                                className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-600 hover:text-red-600 cursor-pointer"
                              >
                                Delete
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
          <ListPager pagination={pagination} onPageChange={setPage} label="time logs" />
        </div>
      )}

      {(modal === 'manual' || modal === 'check-in') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form
            data-tour={modal === 'check-in' ? 'time-logs-checkin-modal' : 'time-logs-manual-modal'}
            onSubmit={saveManualOrCheckIn}
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
          >
            <h2 className="mt-0 mb-4 text-lg font-bold">
              {modal === 'check-in' ? 'Check In / Start Timer' : 'Manual Time Entry'}
            </h2>
            <div className="space-y-4">
              <label
                data-tour={
                  modal === 'check-in' ? 'time-logs-checkin-task' : 'time-logs-manual-task'
                }
                className="block"
              >
                <span className="mb-1 block text-xs font-semibold">Task *</span>
                <select
                  className={fieldClass}
                  value={form.taskId}
                  onChange={(e) => setForm({ ...form, taskId: e.target.value })}
                  required
                >
                  <option value="">Select task</option>
                  {tasks.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title} · {displayLabel(item.projectName)}
                      {item.assigneeName ? ` (${item.assigneeName})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {modal === 'manual' && (
                <>
                  <label data-tour="time-logs-manual-date" className="block">
                    <span className="mb-1 block text-xs font-semibold">Work date *</span>
                    <input
                      type="date"
                      className={fieldClass}
                      value={form.workDate}
                      onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                      required
                    />
                  </label>
                  <div data-tour="time-logs-manual-duration" className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="mb-1 block text-xs font-semibold">Hours</span>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        className={fieldClass}
                        value={form.hours}
                        onChange={(e) => setForm({ ...form, hours: e.target.value })}
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-semibold">Minutes</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        step={5}
                        className={fieldClass}
                        value={form.minutes}
                        onChange={(e) => setForm({ ...form, minutes: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
                    {durationBadgeLabel(formHours, formMinutes)}
                  </div>
                  <div data-tour="time-logs-manual-presets" className="flex flex-wrap gap-1.5">
                    {TIME_DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => addPreset(preset.hours, preset.minutes)}
                        className="h-8 rounded-lg border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 cursor-pointer hover:border-zinc-400"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div data-tour="time-logs-manual-rate" className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">Hourly rate</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className={fieldClass}
                    value={form.hourlyRate}
                    onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isBillable}
                    onChange={(e) => setForm({ ...form, isBillable: e.target.checked })}
                  />
                  Billable
                </label>
              </div>
              <label
                data-tour={
                  modal === 'check-in' ? 'time-logs-checkin-note' : 'time-logs-manual-description'
                }
                className="block"
              >
                <span className="mb-1 block text-xs font-semibold">
                  {modal === 'check-in' ? 'Work note' : 'Description'}
                </span>
                {modal === 'check-in' ? (
                  <input
                    type="text"
                    maxLength={2000}
                    className={fieldClass}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                ) : (
                  <textarea
                    maxLength={2000}
                    className={`${fieldClass} h-24 py-2`}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                )}
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className={btnClass}>
                Cancel
              </button>
              <button
                data-tour={
                  modal === 'check-in' ? 'time-logs-checkin-submit' : 'time-logs-manual-save'
                }
                disabled={saving}
                className={btnPrimary}
              >
                {saving
                  ? 'Saving…'
                  : modal === 'check-in'
                    ? 'Start Timer'
                    : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === 'timer' && running && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl text-center">
            <div
              className="mx-auto mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-6 font-mono text-[42px] font-bold leading-none text-emerald-800"
            >
              {formatElapsedHHMMSS(checkInIso(running), tick)}
            </div>
            <h2 className="m-0 text-lg font-bold text-zinc-950">{displayLabel(running.taskTitle)}</h2>
            <p className="mt-2 mb-1 text-sm text-zinc-600">
              Project: {displayLabel(running.projectName)}
            </p>
            <p className="mt-0 mb-4 text-sm text-zinc-600">
              Started: {formatClock(checkInIso(running))} ·{' '}
              {running.isBillable !== false
                ? `Billable (${formatMoney(Number(running.hourlyRate || 0), settingsCurrency)}/hr)`
                : 'Non-billable'}
            </p>
            {(running.description || running.note) && (
              <p className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs text-zinc-600">
                {running.description || running.note}
              </p>
            )}
            <div className="flex justify-center gap-2">
              <button type="button" onClick={() => setModal(null)} className={btnClass}>
                Keep Running
              </button>
              <button
                type="button"
                onClick={() => openCheckout(running)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-emerald-700 px-3 text-xs font-semibold text-white cursor-pointer"
              >
                <StopIcon sx={{ fontSize: 16 }} />
                Check Out
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'checkout' && running && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="mt-0 mb-3 text-lg font-bold">Check Out & Log Time</h2>
            <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center">
              <div className="font-mono text-3xl font-bold text-emerald-800">
                {formatElapsedHHMMSS(checkInIso(running), tick)}
              </div>
              <div className="mt-1 text-xs font-semibold text-emerald-900">
                Duration: {formatElapsedReadable(checkInIso(running), tick)}
              </div>
            </div>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 checkout-session-summary">
              <div className="font-semibold">{displayLabel(running.taskTitle)}</div>
              <div className="text-xs text-slate-500">
                {displayLabel(running.projectName)} · Started {formatClock(checkInIso(running))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Work notes</span>
              <textarea
                maxLength={2000}
                className={`${fieldClass} h-28 py-2`}
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder="What did you accomplish?"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className={btnClass}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submitCheckout}
                className="inline-flex h-9 items-center gap-1 rounded-lg border-0 bg-emerald-700 px-3 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                <StopIcon sx={{ fontSize: 16 }} />
                {saving ? 'Saving…' : 'Save Note & Check Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'reject' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form onSubmit={submitReject} className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="mt-0 mb-3 text-lg font-bold">Reject Time Log</h2>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Reason *</span>
              <textarea
                required
                className={`${fieldClass} h-28 py-2`}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this entry is rejected…"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className={btnClass}>
                Cancel
              </button>
              <button
                disabled={saving || !rejectReason.trim()}
                className="inline-flex h-9 items-center rounded-lg border-0 bg-red-600 px-3 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
