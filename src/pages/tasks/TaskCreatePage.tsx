import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import { AssignableUser } from '../../types/leads';
import { ProjectItem, ProjectMilestone } from '../../types/projects';
import {
  TaskCreateInput,
  TaskItem,
  TaskTemplate,
  TaskTemplateSubtask,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_CLIENT_STATUSES,
} from '../../types/tasks';
import {
  loadProjectAssigneeOptions,
  filterAssigneeOptionsToSelf,
  type ProjectAssigneeOption,
} from '../../utils/projectAssigneeOptions';
import { canCreateTasks, isEmployeeRole } from '../../utils/permissions';

const fieldClass =
  'h-10 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 text-zinc-900';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';

export const TaskCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, isClient, activeRole, user } = useAuth();
  const canWrite = canCreateTasks({
    hasTaskWrite: hasPermission('crm.tasks.write') && !isClient,
    isClient,
  });
  const isEmployee = isEmployeeRole(activeRole);
  const myUserId = String(user?.userId || '').trim();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<ProjectAssigneeOption[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [form, setForm] = useState<TaskCreateInput>({
    projectId: searchParams.get('projectId') || '',
    title: '',
    status: 'To Do',
    priority: 'Medium',
    assignedTo: isEmployee && myUserId ? myUserId : '',
    dueDate: '',
    startDate: '',
    milestoneId: searchParams.get('milestoneId') || '',
    dependsOnTaskId: '',
    templateId: searchParams.get('templateId') || '',
    notifyClientOnCompletion: false,
    isRecurring: searchParams.get('recurring') === 'true',
    recurringEvery: 1,
    recurringInterval: 'month',
    recurringTotalCycles: 0,
    recurringNextDate: '',
    clientSatisfied: null,
    clientFeedbackStatus: 'Pending Review',
    clientFeedbackNotes: '',
    followers: [],
    description: '',
  });

  // Selected template & preview subtasks
  const [, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [customSubtasks, setCustomSubtasks] = useState<TaskTemplateSubtask[]>([]);

  const applyAssigneeOptions = (
    options: ProjectAssigneeOption[],
    loadedUsers: AssignableUser[] = users
  ) => {
    if (!isEmployee) {
      setAssigneeOptions(options);
      return options;
    }
    const selfUser =
      loadedUsers.find(
        (u) =>
          String(u.id || u._id || u.userId || '') === myUserId
      ) || null;
    const scoped = filterAssigneeOptionsToSelf(options, myUserId, selfUser);
    setAssigneeOptions(scoped);
    if (myUserId) {
      setForm((current) =>
        current.assignedTo === myUserId ? current : { ...current, assignedTo: myUserId }
      );
    }
    return scoped;
  };

  useEffect(() => {
    Promise.all([
      crmApi.listProjects({ limit: 200 }),
      crmApi.getAssignableUsers(),
      crmApi.listTasks({ limit: 500 }),
      crmApi.getTaskTemplates(),
    ])
      .then(async ([projectResponse, userResponse, taskResponse, templateResponse]) => {
        const loadedUsers = userResponse.data || [];
        setProjects(projectResponse.data || []);
        setUsers(loadedUsers);
        setTasks(taskResponse.data || []);
        const tpls = templateResponse.data || [];
        setTemplates(tpls);

        // Pre-apply template from URL if present
        const initTplId = searchParams.get('templateId');
        if (initTplId) {
          const tpl = tpls.find((t) => t._id === initTplId);
          if (tpl) {
            setSelectedTemplate(tpl);
            setCustomSubtasks(tpl.subtasks || []);
            setForm((current) => ({
              ...current,
              templateId: tpl._id,
              title: tpl.title || tpl.name,
              description: tpl.description || '',
              priority: tpl.priority || current.priority,
            }));
          }
        }

        const initialProjectId = searchParams.get('projectId') || '';
        if (initialProjectId) {
          const options = await loadProjectAssigneeOptions(
            initialProjectId,
            loadedUsers,
            isEmployee && myUserId ? [myUserId] : []
          );
          applyAssigneeOptions(options, loadedUsers);
        } else if (isEmployee && myUserId) {
          applyAssigneeOptions([], loadedUsers);
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load form options'))
      .finally(() => setLoading(false));
  }, [searchParams, isEmployee, myUserId]);

  const update = <K extends keyof TaskCreateInput>(key: K, value: TaskCreateInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const selectProject = async (projectId: string) => {
    update('projectId', projectId);
    update('milestoneId', '');
    update('dependsOnTaskId', '');
    update('assignedTo', isEmployee && myUserId ? myUserId : '');
    update('followers', []);
    if (!projectId) {
      setMilestones([]);
      if (isEmployee) applyAssigneeOptions([], users);
      else setAssigneeOptions([]);
      return;
    }
    try {
      const [milestoneResponse, options] = await Promise.all([
        crmApi.getProjectMilestones(projectId),
        loadProjectAssigneeOptions(
          projectId,
          users,
          isEmployee && myUserId ? [myUserId] : []
        ),
      ]);
      setMilestones(milestoneResponse.data || []);
      applyAssigneeOptions(options, users);
    } catch {
      setMilestones([]);
      setAssigneeOptions([]);
    }
  };

  const applyTemplate = (templateId: string) => {
    update('templateId', templateId);
    if (!templateId) {
      setSelectedTemplate(null);
      setCustomSubtasks([]);
      return;
    }
    const template = templates.find((item) => item._id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setCustomSubtasks(template.subtasks ? JSON.parse(JSON.stringify(template.subtasks)) : []);
      setForm((current) => ({
        ...current,
        templateId,
        title: template.title || template.name,
        description: template.description || '',
        priority: template.priority || current.priority,
      }));
    }
  };

  const toggleFollower = (id: string) =>
    update(
      'followers',
      form.followers?.includes(id)
        ? form.followers.filter((item) => item !== id)
        : [...(form.followers || []), id]
    );

  // Subtask item handlers
  const handleAddSubtask = () => {
    setCustomSubtasks((prev) => [...prev, { title: '', description: '' }]);
  };

  const handleUpdateSubtask = (index: number, key: keyof TaskTemplateSubtask, val: string) => {
    setCustomSubtasks((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [key]: val } : s))
    );
  };

  const handleRemoveSubtask = (index: number) => {
    setCustomSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit form
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) return;
    setError('');
    if (!form.projectId || !form.title.trim()) {
      return setError('Project and task title are required.');
    }
    if (
      form.isRecurring &&
      (!(Number(form.recurringEvery) > 0) || Number(form.recurringTotalCycles) < 0)
    ) {
      return setError('Recurring interval must be greater than zero. Total cycles may be 0 for infinite.');
    }

    const cleanSubtasks = customSubtasks
      .filter((st) => st.title.trim().length > 0)
      .map((st) => ({ title: st.title.trim(), description: st.description?.trim() || '' }));

    setSaving(true);
    try {
      const response = await crmApi.createTask({
        ...form,
        title: form.title.trim(),
        assignedTo: isEmployee ? myUserId : form.assignedTo,
        dueDate: form.dueDate || null,
        startDate: form.startDate || null,
        milestoneId: form.milestoneId || null,
        dependsOnTaskId: form.dependsOnTaskId || null,
        templateId: form.templateId || null,
        recurringNextDate: form.recurringNextDate || null,
        subtasks: cleanSubtasks,
      });
      navigate(`/tasks/${response.data._id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const projectTasks = useMemo(() => {
    return tasks.filter((t) => !form.projectId || t.projectId === form.projectId);
  }, [tasks, form.projectId]);

  if (!canWrite) {
    return (
      <div className="py-20 px-6 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
          <CloseIcon sx={{ fontSize: 24 }} />
        </div>
        <h3 className="text-base font-bold text-zinc-950 mb-1">Permission Denied</h3>
        <p className="text-xs text-zinc-500 mb-6">
          You do not have permission to create tasks (`crm.tasks.write`).
        </p>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 text-white text-xs font-semibold rounded-lg no-underline hover:bg-zinc-800 transition-colors"
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          <span>Back to tasks</span>
        </Link>
      </div>
    );
  }

  return (
    <div data-tour="tasks-create-form" className="flex w-full flex-col gap-5">
      <Link
        to="/tasks"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-600 no-underline hover:text-zinc-950 transition-colors"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} />
        Back to Tasks
      </Link>

      <header className="border-b border-zinc-200 pb-4">
        <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Delivery
        </p>
        <h1 className="m-0 text-2xl font-bold tracking-tight text-zinc-950">Create Task</h1>
        <p className="m-0 mt-1 text-sm text-zinc-500">
          Configure deliverable details, checklist subtasks, recurrence, and client sign-off settings.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500 animate-pulse">
          Loading task options…
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          {/* SECTION 1: TEMPLATE PREFILL & CHECKLIST PREVIEW */}
          <section data-tour="tasks-section-template" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-bold text-zinc-900">
              1. Prefill from Task Template (Optional)
            </h2>
            <p className="m-0 mb-4 text-xs text-zinc-500">
              Select a standardized blueprint to auto-populate title, description, priority, and checklist subtasks.
            </p>

            <div className="flex flex-col gap-3">
              <label>
                <span className={labelClass}>Template</span>
                <select
                  id="modal-task-template-select"
                  className={fieldClass}
                  value={form.templateId || ''}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  <option value="">-- Blank Task / Select Template --</option>
                  {templates.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title || item.name} ({item.category || 'General'})
                    </option>
                  ))}
                </select>
              </label>

              {/* Checklist Preview Box (#modal-tpl-subtasks-preview-box) */}
              <div
                id="modal-tpl-subtasks-preview-box"
                className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <PlaylistAddCheckIcon sx={{ fontSize: 16 }} />
                    <span>Checklist Subtasks Included ({customSubtasks.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSubtask}
                    className="h-6 px-2 text-[11px] font-semibold rounded bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 cursor-pointer flex items-center gap-0.5"
                  >
                    <AddIcon sx={{ fontSize: 13 }} />
                    <span>Add Item</span>
                  </button>
                </div>

                {customSubtasks.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {customSubtasks.map((st, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-white p-2 rounded-md border border-zinc-200"
                      >
                        <span className="text-xs font-bold text-blue-600 w-4 text-center">
                          {i + 1}.
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Subtask title *"
                          className="h-7 px-2 text-xs border border-zinc-200 rounded outline-none focus:border-zinc-400 flex-1 bg-white"
                          value={st.title}
                          onChange={(e) => handleUpdateSubtask(i, 'title', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Acceptance notes (optional)"
                          className="h-7 px-2 text-xs border border-zinc-200 rounded outline-none focus:border-zinc-400 flex-1 bg-white"
                          value={st.description || ''}
                          onChange={(e) => handleUpdateSubtask(i, 'description', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(i)}
                          className="text-zinc-400 hover:text-red-600 text-xs p-1 border-none bg-transparent cursor-pointer"
                          title="Remove item"
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic m-0">
                    No checklist subtasks. Select a template above or click "+ Add Item" to add checklist steps.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 2: PROJECT, MILESTONE & TASK DEPENDENCY */}
          <section data-tour="tasks-section-project" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-bold text-zinc-900">
              2. Project, Milestone &amp; Task Dependency
            </h2>
            <p className="text-xs text-zinc-500 m-0 mb-4">
              Bind this deliverable to a parent client project and identify prerequisite dependencies.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label>
                <span className={labelClass}>Project *</span>
                <select
                  id="modal-task-project-select"
                  className={fieldClass}
                  value={form.projectId}
                  onChange={(e) => selectProject(e.target.value)}
                  required
                >
                  <option value="">Select Project…</option>
                  {projects.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className={labelClass}>Milestone</span>
                <select
                  id="modal-task-milestone-select"
                  className={fieldClass}
                  value={form.milestoneId || ''}
                  onChange={(e) => update('milestoneId', e.target.value)}
                  disabled={!form.projectId}
                >
                  <option value="">None / General Task</option>
                  {milestones.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className={labelClass}>Depends on Task</span>
                <select
                  id="modal-task-depends-on-select"
                  className={fieldClass}
                  value={form.dependsOnTaskId || ''}
                  onChange={(e) => update('dependsOnTaskId', e.target.value)}
                  disabled={!form.projectId}
                >
                  <option value="">None / No prerequisite</option>
                  {projectTasks.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title} [{item.status}]
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* SECTION 3: CORE TASK DETAILS */}
          <section data-tour="tasks-section-core" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-bold text-zinc-900">
              3. Core Task Details
            </h2>
            <p className="text-xs text-zinc-500 m-0 mb-4">
              Specify deliverable title, execution status, priority level, assignee, and target deadline.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="md:col-span-2">
                <span className={labelClass}>Task Title *</span>
                <input
                  id="modal-task-title-input"
                  className={fieldClass}
                  placeholder="e.g. Build checkout flow UI & stripe integration"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  maxLength={200}
                  required
                />
              </label>

              <label>
                <span className={labelClass}>Status</span>
                <select
                  className={fieldClass}
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                >
                  {TASK_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className={labelClass}>Priority</span>
                <select
                  id="modal-task-priority-select"
                  className={fieldClass}
                  value={form.priority}
                  onChange={(e) => update('priority', e.target.value)}
                >
                  {TASK_PRIORITIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className={labelClass}>Assigned To</span>
                <select
                  id="modal-task-assigned-select"
                  className={fieldClass}
                  value={form.assignedTo}
                  onChange={(e) => {
                    if (isEmployee) return;
                    update('assignedTo', e.target.value);
                  }}
                  disabled={!form.projectId || isEmployee}
                  title={
                    isEmployee
                      ? 'Employees can only assign tasks to themselves'
                      : undefined
                  }
                >
                  {!isEmployee && (
                    <option value="">
                      {!form.projectId
                        ? 'Select a project first'
                        : assigneeOptions.length === 0
                          ? 'No project members available'
                          : 'Unassigned'}
                    </option>
                  )}
                  {assigneeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label || item.name}
                    </option>
                  ))}
                </select>
                {isEmployee && (
                  <p className="mt-1.5 mb-0 text-[11px] text-zinc-500">
                    You can create tasks on your projects, but assignment is locked to you
                    {assigneeOptions[0]?.designation
                      ? ` (${assigneeOptions[0].designation})`
                      : ''}
                    .
                  </p>
                )}
              </label>

              <label>
                <span className={labelClass}>Due Date</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.dueDate || ''}
                  onChange={(e) => update('dueDate', e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* SECTION 4: CLIENT NOTIFICATION */}
          <section data-tour="tasks-section-notify" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-bold text-zinc-900">
              4. Client Notification &amp; Email Automation
            </h2>
            <p className="text-xs text-zinc-500 m-0 mb-4">
              Keep external stakeholders notified automatically upon deliverable completion.
            </p>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
              <input
                id="modal-task-notify-client"
                type="checkbox"
                checked={form.notifyClientOnCompletion || false}
                onChange={(e) => update('notifyClientOnCompletion', e.target.checked)}
                className="w-4 h-4 rounded text-zinc-950 cursor-pointer"
              />
              <span>Send automatic email notification to client when marked Completed</span>
            </label>
          </section>

          {/* SECTION 5: RECURRING TASK AUTOMATION SCHEDULE */}
          <section data-tour="tasks-section-recurring" className="rounded-xl border border-zinc-300 bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="m-0 text-sm font-bold text-zinc-900">
                5. Recurring Task Schedule
              </h2>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
                <input
                  id="modal-task-recurring-cb"
                  type="checkbox"
                  checked={form.isRecurring || false}
                  onChange={(e) => update('isRecurring', e.target.checked)}
                  className="w-4 h-4 rounded text-zinc-950 cursor-pointer"
                />
                <span>Repeat this task on schedule</span>
              </label>
            </div>
            <p className="text-xs text-zinc-500 m-0 mb-4">
              Automatically spawn new task instances with cloned subtasks on interval cadence.
            </p>

            {form.isRecurring && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                <label>
                  <span className={labelClass}>Repeat Every</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    className={fieldClass}
                    value={form.recurringEvery || 1}
                    onChange={(e) => update('recurringEvery', Number(e.target.value))}
                  />
                </label>

                <label>
                  <span className={labelClass}>Interval</span>
                  <select
                    className={fieldClass}
                    value={form.recurringInterval || 'month'}
                    onChange={(e) => update('recurringInterval', e.target.value)}
                  >
                    <option value="day">Day(s)</option>
                    <option value="week">Week(s)</option>
                    <option value="month">Month(s)</option>
                    <option value="quarter">Quarter(s)</option>
                    <option value="year">Year(s)</option>
                  </select>
                </label>

                <label>
                  <span className={labelClass}>Total Cycles (0 = Infinite)</span>
                  <input
                    type="number"
                    min="0"
                    className={fieldClass}
                    value={form.recurringTotalCycles ?? 0}
                    onChange={(e) => update('recurringTotalCycles', Number(e.target.value))}
                  />
                </label>

                <label>
                  <span className={labelClass}>Next Run Date</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={form.recurringNextDate || ''}
                    onChange={(e) => update('recurringNextDate', e.target.value)}
                  />
                </label>
              </div>
            )}
          </section>

          {/* SECTION 6: CLIENT SATISFACTION & FEEDBACK STATUS */}
          <section data-tour="tasks-section-client" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-bold text-zinc-900">
              6. Client Satisfaction &amp; Feedback
            </h2>
            <p className="text-xs text-zinc-500 m-0 mb-4">
              Track client review responses, approval statuses, and revision notes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label>
                <span className={labelClass}>Client Status</span>
                <select
                  id="modal-task-feedback-select"
                  className={fieldClass}
                  value={form.clientFeedbackStatus || 'Pending Review'}
                  onChange={(e) => update('clientFeedbackStatus', e.target.value)}
                >
                  {TASK_CLIENT_STATUSES.map((cs) => (
                    <option key={cs} value={cs}>
                      {cs}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className={labelClass}>Client is Satisfied</span>
                <select
                  id="modal-task-satisfied-cb"
                  className={fieldClass}
                  value={form.clientSatisfied === null ? '' : String(form.clientSatisfied)}
                  onChange={(e) =>
                    update(
                      'clientSatisfied',
                      e.target.value === '' ? null : e.target.value === 'true'
                    )
                  }
                >
                  <option value="">Pending / Not provided</option>
                  <option value="true">Satisfied</option>
                  <option value="false">Dissatisfied / Needs revision</option>
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className={labelClass}>Feedback Notes</span>
                <input
                  className={fieldClass}
                  placeholder="Client feedback notes, acceptance meeting remarks, or revision directives…"
                  value={form.clientFeedbackNotes || ''}
                  onChange={(e) => update('clientFeedbackNotes', e.target.value)}
                  maxLength={2000}
                />
              </label>
            </div>
          </section>

          {/* SECTION 7: TASK WATCHERS / FOLLOWERS */}
          <section data-tour="tasks-section-watchers" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-bold text-zinc-900">
              7. Task Watchers / Followers
            </h2>
            <p className="text-xs text-zinc-500 m-0 mb-4">
              Select team members who follow this deliverable to receive automated progress notifications.
            </p>

            <div
              id="modal-task-followers-list"
              className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 rounded-lg bg-zinc-50 border border-zinc-200"
            >
              {!form.projectId ? (
                <span className="text-xs text-zinc-500">Select a project to choose team members.</span>
              ) : assigneeOptions.length === 0 ? (
                <span className="text-xs text-zinc-500">No project members available</span>
              ) : (
                assigneeOptions.map((item) => (
                  <label
                    key={item.id}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                      form.followers?.includes(item.id)
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.followers?.includes(item.id)}
                      onChange={() => toggleFollower(item.id)}
                      className="w-3.5 h-3.5 rounded text-zinc-950 cursor-pointer"
                    />
                    <span>{item.label || item.name}</span>
                  </label>
                ))
              )}
            </div>
          </section>

          {/* SECTION 8: DESCRIPTION & ACCEPTANCE CRITERIA */}
          <section data-tour="tasks-section-description" className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-bold text-zinc-900">
              8. Description &amp; Acceptance Criteria
            </h2>
            <p className="text-xs text-zinc-500 m-0 mb-4">
              Comprehensive objectives, technical instructions, deliverable requirements, and verification criteria.
            </p>

            <label>
              <textarea
                id="modal-task-desc-input"
                rows={4}
                maxLength={4000}
                placeholder="Detailed objectives, acceptance criteria, wireframe links, technical constraints…"
                className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-xs outline-none focus:border-zinc-500 text-zinc-900"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </label>
          </section>

          {/* SECTION 9: FORM ACTION CONTROLS */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              id="modal-cancel-task-btn"
              to="/tasks"
              className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 no-underline hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              data-tour="tasks-save-btn"
              disabled={saving}
              className="h-10 rounded-lg border-0 bg-zinc-950 hover:bg-zinc-800 px-6 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? 'Adding Task…' : '+ Add Task'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
export default TaskCreatePage;
