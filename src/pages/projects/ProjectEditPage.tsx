import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';

import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import {
  DEFAULT_PROJECT_PRIORITIES,
  DEFAULT_PROJECT_STATUSES,
  isLiveProjectStatus,
  LIVE_PROJECT_STATUS,
  ProgressCalculationMethod,
} from '../../types/projects';
import { ClientOption } from '../../types/reports';
import { AssignableUser } from '../../types/leads';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { LiveLinkModal } from '../../components/projects/LiveLinkModal';

const fieldClass =
  'h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white';

export const ProjectEditPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isClient } = useAuth();
  const canWrite = hasPermission('crm.projects.write') && !isClient;

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([...DEFAULT_PROJECT_STATUSES]);
  const [customFieldDefs, setCustomFieldDefs] = useState<
    { key: string; label: string; type?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Not Started');
  const [initialStatus, setInitialStatus] = useState('Not Started');
  const [liveUrl, setLiveUrl] = useState('');
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [statusBeforeLive, setStatusBeforeLive] = useState('Not Started');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [progressMethod, setProgressMethod] = useState<ProgressCalculationMethod>('tasks');
  const [currency, setCurrency] = useState('INR');
  const [budget, setBudget] = useState('0');
  const [hoursEstimate, setHoursEstimate] = useState('0');
  const [progress, setProgress] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [projRes, cl, us, cat, tg, cf, st] = await Promise.all([
          crmApi.getProject(id),
          crmApi.getClients({ limit: 200 }).catch(() => ({ data: [] as ClientOption[] })),
          crmApi.getAssignableUsers().catch(() => ({ data: [] as AssignableUser[] })),
          crmApi.getProjectCategories(),
          crmApi.getProjectTags(),
          crmApi.getProjectCustomFields(),
          crmApi.getProjectStatuses().catch(() => ({ data: [...DEFAULT_PROJECT_STATUSES] })),
        ]);
        if (cancelled) return;
        const p = projRes.data;
        setName(p.name || '');
        setClientId(p.clientId || '');
        setCategory(p.category || '');
        setPriority(p.priority || 'Medium');
        const loadedStatus = p.status || 'Not Started';
        setStatus(loadedStatus);
        setInitialStatus(loadedStatus);
        setLiveUrl(p.liveUrl || '');
        setSelectedTags(p.tags || []);
        setProgressMethod(p.progressCalculationMethod || 'tasks');
        setCurrency(p.currency || 'INR');
        setBudget(String(p.budget ?? 0));
        setHoursEstimate(String(p.hoursEstimate ?? 0));
        setProgress(String(p.progress ?? 0));
        setStartDate(p.startDate ? String(p.startDate).slice(0, 10) : '');
        setDeadline(p.deadline ? String(p.deadline).slice(0, 10) : '');
        setAssignedTo(p.assignedTo || []);
        setDescription(p.description || '');
        const cfVals: Record<string, string> = {};
        Object.entries(p.customFields || {}).forEach(([k, v]) => {
          cfVals[k] = v == null ? '' : String(v);
        });
        setCustomFields(cfVals);
        setClients(cl.data || []);
        setUsers(us.data || []);
        setCategories(cat.data || []);
        setTags(tg.data || []);
        setCustomFieldDefs(cf.data || []);
        const statusList = st.data?.length ? st.data : [...DEFAULT_PROJECT_STATUSES];
        if (loadedStatus && !statusList.some((s) => s === loadedStatus)) {
          statusList.push(loadedStatus);
        }
        setStatuses(statusList);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleStatusSelect = (next: string) => {
    if (isLiveProjectStatus(next) && !isLiveProjectStatus(status)) {
      setStatusBeforeLive(status);
      setLiveModalOpen(true);
      return;
    }
    setStatus(next);
  };

  const confirmLiveFromEdit = async (url: string) => {
    setLiveUrl(url);
    setStatus(LIVE_PROJECT_STATUS);
    setLiveModalOpen(false);
  };

  const cancelLiveFromEdit = () => {
    setStatus(statusBeforeLive);
    setLiveModalOpen(false);
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      const res = await crmApi.createProjectCategory(newCategory.trim());
      setCategories(res.data || []);
      setCategory(newCategory.trim());
      setNewCategory('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const addTag = async () => {
    if (!newTag.trim()) return;
    try {
      const res = await crmApi.addProjectTag(newTag.trim());
      setTags(res.data || []);
      setSelectedTags((prev) =>
        prev.includes(newTag.trim()) ? prev : [...prev, newTag.trim()]
      );
      setNewTag('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!clientId) {
      setError('Client is required');
      return;
    }
    if (isLiveProjectStatus(status) && !liveUrl.trim()) {
      setStatusBeforeLive(isLiveProjectStatus(initialStatus) ? 'In Progress' : initialStatus);
      setLiveModalOpen(true);
      return;
    }
    setSaving(true);
    try {
      const client = clients.find((c) => c._id === clientId);
      await crmApi.updateProject(id, {
        name: name.trim(),
        clientId,
        clientName: client?.name,
        category,
        priority,
        status,
        liveUrl: isLiveProjectStatus(status) ? liveUrl.trim() : liveUrl.trim() || null,
        tags: selectedTags,
        progressCalculationMethod: progressMethod,
        currency,
        budget: Number(budget) || 0,
        hoursEstimate: Number(hoursEstimate) || 0,
        progress: progressMethod === 'manual' ? Number(progress) || 0 : undefined,
        startDate: startDate || null,
        deadline: deadline || null,
        assignedTo,
        description,
        customFields,
      });
      navigate(`/projects/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  if (!canWrite) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        You do not have permission to edit projects (`crm.projects.write`).
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="pb-1 border-b border-zinc-200">
        <Link
          to={id ? `/projects/${id}` : '/projects'}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 no-underline hover:text-zinc-950 mb-2"
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          Back to Project
        </Link>
        <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">Edit Project</h1>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-zinc-300 rounded-xl p-10 text-center text-sm text-zinc-500 animate-pulse">
          Loading project…
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                Project name *
              </span>
              <input
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Client *</span>
              <ClientSelect
                clients={clients}
                value={clientId}
                required
                placeholder="Select client…"
                onChange={(nextId) => setClientId(nextId)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Category</span>
              <select
                className={fieldClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 items-end">
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Add category
                </span>
                <input
                  className={fieldClass}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={addCategory}
                className="h-9 px-3 rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <AddIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Priority</span>
              <select
                className={fieldClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {DEFAULT_PROJECT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Status</span>
              <select
                className={fieldClass}
                value={status}
                onChange={(e) => handleStatusSelect(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {(isLiveProjectStatus(status) || liveUrl) && (
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Live link {isLiveProjectStatus(status) ? '*' : ''}
                </span>
                <input
                  className={fieldClass}
                  type="url"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  placeholder="https://example.com"
                  required={isLiveProjectStatus(status)}
                />
                <span className="text-[11px] text-zinc-400">
                  Required when status is Live. Saving as Live emails this URL to the client.
                </span>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                Progress method
              </span>
              <select
                className={fieldClass}
                value={progressMethod}
                onChange={(e) =>
                  setProgressMethod(e.target.value as ProgressCalculationMethod)
                }
              >
                <option value="tasks">Based on tasks</option>
                <option value="time">Based on time</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            {progressMethod === 'manual' && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                  Progress %
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={fieldClass}
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Currency</span>
              <select
                className={fieldClass}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {['INR', 'USD', 'EUR', 'GBP'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Budget</span>
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                Hours estimate
              </span>
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={hoursEstimate}
                onChange={(e) => setHoursEstimate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Start date</span>
              <input
                type="date"
                className={fieldClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase">Deadline</span>
              <input
                type="date"
                className={fieldClass}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                    )
                  }
                  className={`px-2 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                    selectedTags.includes(t)
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-700 border-zinc-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={fieldClass}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag"
              />
              <button
                type="button"
                onClick={addTag}
                className="h-9 px-3 rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <AddIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase mb-2">
              Assigned to
            </div>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const uid = u.id || u._id || u.userId || '';
                const label = u.displayName || u.name || u.username || uid;
                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() =>
                      setAssignedTo((prev) =>
                        prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
                      )
                    }
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                      assignedTo.includes(uid)
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : 'bg-white text-zinc-700 border-zinc-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase">Description</span>
            <textarea
              className="min-h-[100px] px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {customFieldDefs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customFieldDefs.map((f) => (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                    {f.label}
                  </span>
                  <input
                    className={fieldClass}
                    value={customFields[f.key] || ''}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <Link
              to={`/projects/${id}`}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-800 no-underline"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      <LiveLinkModal
        open={liveModalOpen}
        projectName={name}
        initialUrl={liveUrl}
        onCancel={cancelLiveFromEdit}
        onConfirm={confirmLiveFromEdit}
      />
    </div>
  );
};
