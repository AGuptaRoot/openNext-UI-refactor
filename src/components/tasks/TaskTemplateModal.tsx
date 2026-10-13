import React, { useState, useEffect, useMemo } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import {
  TaskPriority,
  TaskTemplate,
  TaskTemplateSubtask,
  TASK_PRIORITIES,
} from '../../types/tasks';
import { ProjectItem, ProjectMilestone } from '../../types/projects';
import { AssignableUser } from '../../types/leads';
import {
  loadProjectAssigneeOptions,
  type ProjectAssigneeOption,
} from '../../utils/projectAssigneeOptions';

export interface TaskTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onTaskCreated?: (taskId: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const fieldClass =
  'h-9 px-3 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white text-zinc-900';

export const TaskTemplateModal: React.FC<TaskTemplateModalProps> = ({
  open,
  onClose,
  onTaskCreated,
  showToast,
}) => {
  const { confirm } = useDialog();
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'instantiate'>('list');
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<ProjectAssigneeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Form state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [hoursEstimate, setHoursEstimate] = useState<string>('0');
  const [tagsInput, setTagsInput] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState<TaskTemplateSubtask[]>([]);

  // Instantiate state
  const [selectedTemplateForInstantiate, setSelectedTemplateForInstantiate] =
    useState<TaskTemplate | null>(null);
  const [instantiateProject, setInstantiateProject] = useState('');
  const [instantiateMilestone, setInstantiateMilestone] = useState('');
  const [instantiateAssignee, setInstantiateAssignee] = useState('');
  const [instantiateDueDate, setInstantiateDueDate] = useState('');
  const [instantiateMilestonesList, setInstantiateMilestonesList] = useState<ProjectMilestone[]>([]);

  // Load templates, projects, and users
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getTaskTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load task templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadTemplates();
      crmApi.listProjects({ limit: 200 }).then((res) => setProjects(res.data || [])).catch(() => {});
      crmApi.getAssignableUsers().then((res) => setUsers(res.data || [])).catch(() => {});
    }
  }, [open]);

  // Load milestones + project team assignees when project changes in instantiate view
  useEffect(() => {
    if (!instantiateProject) {
      setInstantiateMilestonesList([]);
      setInstantiateMilestone('');
      setAssigneeOptions([]);
      setInstantiateAssignee('');
      return;
    }
    setInstantiateAssignee('');
    crmApi
      .getProjectMilestones(instantiateProject)
      .then((res) => setInstantiateMilestonesList(res.data || []))
      .catch(() => setInstantiateMilestonesList([]));
    loadProjectAssigneeOptions(instantiateProject, users)
      .then(setAssigneeOptions)
      .catch(() => setAssigneeOptions([]));
  }, [instantiateProject, users]);

  // Unique categories for filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [templates]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        (t.title || t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.category || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = !selectedCategory || t.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [templates, searchQuery, selectedCategory]);

  const handleOpenCreateForm = () => {
    setEditingTemplateId(null);
    setTitle('');
    setCategory('General');
    setPriority('Medium');
    setHoursEstimate('0');
    setTagsInput('');
    setDescription('');
    setSubtasks([{ title: '', description: '' }]);
    setViewMode('form');
  };

  const handleOpenEditForm = (tpl: TaskTemplate) => {
    setEditingTemplateId(tpl._id);
    setTitle(tpl.title || tpl.name || '');
    setCategory(tpl.category || 'General');
    setPriority(tpl.priority || 'Medium');
    setHoursEstimate(String(tpl.hoursEstimate || 0));
    setTagsInput(Array.isArray(tpl.tags) ? tpl.tags.join(', ') : '');
    setDescription(tpl.description || '');
    setSubtasks(
      Array.isArray(tpl.subtasks) && tpl.subtasks.length > 0
        ? JSON.parse(JSON.stringify(tpl.subtasks))
        : [{ title: '', description: '' }]
    );
    setViewMode('form');
  };

  const handleOpenInstantiate = (tpl: TaskTemplate) => {
    setSelectedTemplateForInstantiate(tpl);
    setInstantiateProject(projects[0]?._id || '');
    setInstantiateMilestone('');
    setInstantiateAssignee('');
    setInstantiateDueDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    setViewMode('instantiate');
  };

  // Subtask Builder Handlers
  const handleAddSubtaskRow = () => {
    setSubtasks((prev) => [...prev, { title: '', description: '' }]);
  };

  const handleUpdateSubtaskRow = (index: number, field: keyof TaskTemplateSubtask, val: string) => {
    setSubtasks((prev) =>
      prev.map((st, i) => (i === index ? { ...st, [field]: val } : st))
    );
  };

  const handleRemoveSubtaskRow = (index: number) => {
    setSubtasks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ title: '', description: '' }];
    });
  };

  // Save template (create or update)
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Template title is required', 'error');
      return;
    }

    const cleanSubtasks = subtasks
      .filter((st) => st.title.trim().length > 0)
      .map((st) => ({ title: st.title.trim(), description: st.description?.trim() || '' }));

    const tagsArray = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const payload: Partial<TaskTemplate> = {
        title: title.trim(),
        name: title.trim(),
        category: category.trim() || 'General',
        priority,
        hoursEstimate: parseFloat(hoursEstimate) || 0,
        tags: tagsArray,
        description: description.trim(),
        subtasks: cleanSubtasks,
      };

      if (editingTemplateId) {
        await crmApi.updateTaskTemplate(editingTemplateId, payload);
        showToast('Task template updated successfully');
      } else {
        await crmApi.createTaskTemplate(payload);
        showToast('Task template created successfully');
      }

      await loadTemplates();
      setViewMode('list');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (id: string, tTitle: string) => {
    if (!(await confirm({ message: `Delete template "${tTitle}"? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteTaskTemplate(id);
      showToast('Template deleted');
      await loadTemplates();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete template', 'error');
    }
  };

  // Instantiate template into project
  const handleExecuteInstantiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateForInstantiate) return;
    if (!instantiateProject) {
      showToast('Please select a project', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await crmApi.instantiateTaskTemplate(selectedTemplateForInstantiate._id, {
        projectId: instantiateProject,
        milestoneId: instantiateMilestone || undefined,
        assignedTo: instantiateAssignee || undefined,
        dueDate: instantiateDueDate || undefined,
        title: selectedTemplateForInstantiate.title || selectedTemplateForInstantiate.name,
      });

      showToast(`Task created with ${selectedTemplateForInstantiate.subtasks?.length || 0} subtasks!`);
      if (onTaskCreated && res.data?._id) {
        onTaskCreated(res.data._id);
      }
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to instantiate task', 'error');
    } finally {
      setSaving(false);
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
        <div className="p-4 sm:px-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📋</span>
            <div>
              <h2 className="text-base font-bold text-zinc-950 m-0">
                {viewMode === 'list'
                  ? 'Task Templates Studio'
                  : viewMode === 'form'
                  ? editingTemplateId
                    ? 'Edit Task Template'
                    : 'Create Task Template'
                  : `Instantiate Template: ${selectedTemplateForInstantiate?.title || ''}`}
              </h2>
              <p className="m-0 mt-0.5 text-xs text-zinc-500">
                {viewMode === 'list'
                  ? 'Standardize deliverables, priorities, instructions, and checklist subtasks.'
                  : viewMode === 'form'
                  ? 'Define predefined checklist items that auto-clone when instantiated.'
                  : 'Spawn a new task in a project with all predefined checklist subtasks cloned.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'list' ? (
              <button
                type="button"
                onClick={handleOpenCreateForm}
                className="h-8 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-none transition-colors"
              >
                <AddIcon sx={{ fontSize: 16 }} />
                <span>+ Create Template</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="h-8 px-3 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ArrowBackIcon sx={{ fontSize: 14 }} />
                <span>Back to List</span>
              </button>
            )}

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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* VIEW 1: TEMPLATES LIST */}
          {viewMode === 'list' && (
            <div className="flex flex-col gap-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <input
                    type="search"
                    className={`${fieldClass} pl-8`}
                    placeholder="Search templates by title, description, or category…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <SearchIcon
                    sx={{ fontSize: 16 }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                </div>

                {categories.length > 0 && (
                  <select
                    className="h-9 px-3 text-xs border border-zinc-200 rounded-lg outline-none bg-white text-zinc-800"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}

                <div className="text-xs text-zinc-500 font-semibold">
                  <strong>{filteredTemplates.length}</strong> template(s)
                </div>
              </div>

              {/* Loading / Empty / Grid */}
              {loading ? (
                <div className="py-16 text-center text-xs text-zinc-500 animate-pulse">
                  Loading task templates…
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-zinc-200 rounded-xl">
                  <p className="text-sm font-semibold text-zinc-900 m-0 mb-1">
                    No task templates found
                  </p>
                  <p className="text-xs text-zinc-500 m-0 mb-4">
                    Create reusable blueprints with predefined checklists to standardize workflows.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreateForm}
                    className="px-4 py-2 rounded-lg bg-zinc-950 text-white text-xs font-semibold cursor-pointer border-none"
                  >
                    + Create First Template
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates.map((tpl) => {
                    const stCount = tpl.subtasks?.length || 0;

                    return (
                      <div
                        key={tpl._id}
                        className="rounded-xl border border-zinc-300 bg-white p-4.5 flex flex-col justify-between hover:border-zinc-300 transition-all shadow-none group"
                      >
                        <div>
                          {/* Badges row */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                              {tpl.category || 'General'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                tpl.priority === 'Urgent'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : tpl.priority === 'High'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {tpl.priority || 'Medium'}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-zinc-950 m-0 mb-1.5">
                            {tpl.title || tpl.name}
                          </h3>

                          {tpl.description && (
                            <p className="text-xs text-zinc-600 line-clamp-2 m-0 mb-3 leading-relaxed">
                              {tpl.description}
                            </p>
                          )}

                          {/* Subtasks summary */}
                          <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 mb-3">
                            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 mb-1">
                              <span className="flex items-center gap-1">
                                <PlaylistAddCheckIcon sx={{ fontSize: 16 }} />
                                <span>Checklist Subtasks ({stCount})</span>
                              </span>
                              {tpl.hoursEstimate ? (
                                <span className="text-[11px] text-zinc-500 font-normal">
                                  ~{tpl.hoursEstimate} hrs estimate
                                </span>
                              ) : null}
                            </div>

                            {stCount > 0 ? (
                              <ul className="m-0 p-0 list-none flex flex-col gap-1 text-[11px] text-zinc-600">
                                {tpl.subtasks?.slice(0, 3).map((st, i) => (
                                  <li key={i} className="flex items-center gap-1.5 truncate">
                                    <span className="text-emerald-600 font-bold">✓</span>
                                    <span className="truncate">{st.title}</span>
                                  </li>
                                ))}
                                {stCount > 3 && (
                                  <li className="text-[10px] text-zinc-400 italic">
                                    +{stCount - 3} more checklist items
                                  </li>
                                )}
                              </ul>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">
                                No predefined checklist items
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-zinc-100 mt-2">
                          <button
                            type="button"
                            onClick={() => handleOpenInstantiate(tpl)}
                            className="h-8 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-none transition-colors"
                          >
                            <PlayArrowIcon sx={{ fontSize: 14 }} />
                            <span>Use Template</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(tpl)}
                              className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer bg-white"
                              title="Edit template"
                            >
                              <EditOutlinedIcon sx={{ fontSize: 15 }} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl._id, tpl.title || tpl.name)}
                              className="p-1.5 rounded-md border border-zinc-200 hover:bg-red-50 text-red-600 cursor-pointer bg-white"
                              title="Delete template"
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: CREATE / EDIT FORM */}
          {viewMode === 'form' && (
            <form onSubmit={handleSaveTemplate} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="md:col-span-2 block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Template Title *</span>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    placeholder="e.g., Client Onboarding & Tech Setup Deliverable"
                    className={fieldClass}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>

                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Category</span>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g., Client Delivery, QA, DevOps"
                    className={fieldClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Default Priority</span>
                  <select
                    className={fieldClass}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Estimated Hours</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="4.0"
                    className={fieldClass}
                    value={hoursEstimate}
                    onChange={(e) => setHoursEstimate(e.target.value)}
                  />
                </label>

                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Tags (comma-separated)</span>
                  <input
                    type="text"
                    placeholder="audit, client, release"
                    className={fieldClass}
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-zinc-700">
                <span className="mb-1 block">Description &amp; Acceptance Instructions</span>
                <textarea
                  rows={3}
                  maxLength={4000}
                  placeholder="Detailed guidelines, scope of work, and verification criteria for this deliverable…"
                  className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs outline-none focus:border-zinc-400 text-zinc-900"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              {/* DYNAMIC CHECKLIST SUBTASKS BUILDER */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 m-0">
                      ☑️ Predefined Checklist Subtasks
                    </h4>
                    <p className="text-[11px] text-zinc-500 m-0 mt-0.5">
                      These checklist steps will be auto-generated whenever a task is created from this template.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSubtaskRow}
                    className="h-7 px-2.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <AddIcon sx={{ fontSize: 14 }} />
                    <span>+ Add Item</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {subtasks.map((st, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white border border-zinc-200"
                    >
                      <span className="text-xs font-bold text-blue-600 w-5 text-center">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        placeholder="Subtask title *"
                        required
                        className="h-8 px-2 text-xs border border-zinc-200 rounded-md outline-none focus:border-zinc-400 flex-[1.5] bg-white"
                        value={st.title}
                        onChange={(e) => handleUpdateSubtaskRow(idx, 'title', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Optional details / criteria"
                        className="h-8 px-2 text-xs border border-zinc-200 rounded-md outline-none focus:border-zinc-400 flex-[2] bg-white"
                        value={st.description || ''}
                        onChange={(e) => handleUpdateSubtaskRow(idx, 'description', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtaskRow(idx)}
                        className="p-1 rounded text-zinc-400 hover:text-red-600 border-none bg-transparent cursor-pointer"
                        title="Remove checklist item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Action Controls */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : editingTemplateId ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: INSTANTIATE TEMPLATE MODAL */}
          {viewMode === 'instantiate' && selectedTemplateForInstantiate && (
            <form onSubmit={handleExecuteInstantiate} className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900">
                <strong className="block font-bold mb-1">
                  Using Template: {selectedTemplateForInstantiate.title}
                </strong>
                <span>
                  This will instantiate a new deliverable task and auto-generate{' '}
                  <strong>{selectedTemplateForInstantiate.subtasks?.length || 0} checklist subtask(s)</strong>.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Target Project *</span>
                  <select
                    className={fieldClass}
                    required
                    value={instantiateProject}
                    onChange={(e) => setInstantiateProject(e.target.value)}
                  >
                    <option value="">Select Project…</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Milestone (Optional)</span>
                  <select
                    className={fieldClass}
                    value={instantiateMilestone}
                    onChange={(e) => setInstantiateMilestone(e.target.value)}
                    disabled={!instantiateProject}
                  >
                    <option value="">No Milestone / General Task</option>
                    {instantiateMilestonesList.map((m) => (
                      <option key={m._id} value={m._id}>
                        🚩 {m.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Assign To</span>
                  <select
                    className={fieldClass}
                    value={instantiateAssignee}
                    onChange={(e) => setInstantiateAssignee(e.target.value)}
                    disabled={!instantiateProject}
                  >
                    <option value="">
                      {!instantiateProject
                        ? 'Select a project first'
                        : assigneeOptions.length === 0
                          ? 'No project members available'
                          : 'Unassigned'}
                    </option>
                    {assigneeOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label || u.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-zinc-700">
                  <span className="mb-1 block">Due Date</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={instantiateDueDate}
                    onChange={(e) => setInstantiateDueDate(e.target.value)}
                  />
                </label>
              </div>

              {/* Preview of subtasks to be created */}
              {selectedTemplateForInstantiate.subtasks &&
                selectedTemplateForInstantiate.subtasks.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <strong className="text-xs text-zinc-900 block mb-2">
                      Subtasks that will be generated:
                    </strong>
                    <div className="flex flex-col gap-1 text-xs text-zinc-700">
                      {selectedTemplateForInstantiate.subtasks.map((st, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold">☑️</span>
                          <span className="font-medium">{st.title}</span>
                          {st.description && (
                            <span className="text-zinc-400 text-[11px]">({st.description})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Instantiating…' : 'Instantiate Task'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default TaskTemplateModal;
