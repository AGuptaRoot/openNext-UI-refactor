import React, { useState, useEffect, useMemo } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';

import { crmApi } from '../../services/api';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { useDialog } from '../../context/DialogContext';
import {
  ProjectPriority,
  ProjectTemplate,
  ProjectTemplateMilestone,
  ProjectTemplateTask,
  priorityBadgeClass,
} from '../../types/projects';

export interface ProjectTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onUseTemplate: (template: ProjectTemplate) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const fieldClass =
  'h-9 px-3 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white text-zinc-900';

export const ProjectTemplateModal: React.FC<ProjectTemplateModalProps> = ({
  open,
  onClose,
  onUseTemplate,
  showToast,
}) => {
  const { confirm } = useDialog();
  const settingsCurrency = useDefaultCurrency();
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('Medium');
  const [hoursEstimate, setHoursEstimate] = useState<string>('0');
  const [budget, setBudget] = useState<string>('0');
  const [currency, setCurrency] = useState<string>(settingsCurrency);
  const [description, setDescription] = useState('');

  // Milestones & Tasks builders
  const [milestones, setMilestones] = useState<ProjectTemplateMilestone[]>([]);
  const [tasks, setTasks] = useState<ProjectTemplateTask[]>([]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getProjectTemplates();
      setTemplates(res.data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplates();
      setViewMode('list');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onTourView = (e: Event) => {
      const view = (e as CustomEvent<{ view?: string }>).detail?.view;
      if (view === 'list') {
        setViewMode('list');
        return;
      }
      if (view === 'form') {
        handleStartCreate();
      }
    };
    window.addEventListener('crm-projects-tour-templates-view', onTourView as EventListener);
    return () =>
      window.removeEventListener('crm-projects-tour-templates-view', onTourView as EventListener);
  }, [open]);

  const handleStartCreate = () => {
    setEditingTemplateId(null);
    setName('');
    setCategory('Web Development');
    setPriority('Medium');
    setHoursEstimate('80');
    setBudget('100000');
    setCurrency(settingsCurrency);
    setDescription('');
    setMilestones([
      { name: 'Phase 1: Discovery & Architecture', dueDayOffset: 7, order: 0 },
      { name: 'Phase 2: Core Development', dueDayOffset: 21, order: 1 },
      { name: 'Phase 3: Testing & Delivery', dueDayOffset: 30, order: 2 },
    ]);
    setTasks([
      {
        title: 'Project kick-off & requirements briefing',
        milestoneIndex: 0,
        dayOffset: 0,
        dueDayOffset: 3,
        priority: 'High',
        hoursEstimate: 6,
      },
      {
        title: 'Architecture & technical specification',
        milestoneIndex: 0,
        dayOffset: 2,
        dueDayOffset: 7,
        priority: 'High',
        hoursEstimate: 16,
      },
      {
        title: 'Build primary modules & integrations',
        milestoneIndex: 1,
        dayOffset: 7,
        dueDayOffset: 20,
        priority: 'Medium',
        hoursEstimate: 40,
      },
      {
        title: 'User acceptance testing & handover',
        milestoneIndex: 2,
        dayOffset: 21,
        dueDayOffset: 29,
        priority: 'High',
        hoursEstimate: 12,
      },
    ]);
    setViewMode('form');
  };

  const handleStartEdit = (tpl: ProjectTemplate) => {
    setEditingTemplateId(tpl._id);
    setName(tpl.name);
    setCategory(tpl.category || '');
    setPriority(tpl.priority || 'Medium');
    setHoursEstimate(String(tpl.hoursEstimate || 0));
    setBudget(String(tpl.budget || 0));
    setCurrency(tpl.currency || settingsCurrency);
    setDescription(tpl.description || '');

    // Normalize milestones
    const msList: ProjectTemplateMilestone[] = (tpl.milestones || []).map((m, i) => {
      if (typeof m === 'string') {
        return { name: m, dueDayOffset: (i + 1) * 14, order: i };
      }
      return {
        name: m.name,
        dueDayOffset: m.dueDayOffset ?? (i + 1) * 14,
        description: m.description,
        order: i,
      };
    });
    setMilestones(msList);

    // Normalize tasks
    const tList: ProjectTemplateTask[] = (tpl.tasks || []).map((t) => ({
      title: t.title,
      description: t.description || '',
      milestoneIndex: t.milestoneIndex ?? (msList.length ? 0 : null),
      dayOffset: t.dayOffset ?? 0,
      dueDayOffset: t.dueDayOffset ?? 7,
      priority: t.priority || 'Medium',
      hoursEstimate: t.hoursEstimate ?? 0,
    }));
    setTasks(tList);

    setViewMode('form');
  };

  const handleDelete = async (tplId: string, tplName: string) => {
    if (!(await confirm({ message: `Are you sure you want to delete template "${tplName}"?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteProjectTemplate(tplId);
      setTemplates((prev) => prev.filter((t) => t._id !== tplId));
      showToast(`Template "${tplName}" deleted`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete template', 'error');
    }
  };

  const handleAddMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      {
        name: `Milestone ${prev.length + 1}`,
        dueDayOffset: 14 * (prev.length + 1),
        order: prev.length,
      },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
    setTasks((prev) =>
      prev.map((t) => {
        if (t.milestoneIndex === index) return { ...t, milestoneIndex: null };
        if (t.milestoneIndex != null && t.milestoneIndex > index) {
          return { ...t, milestoneIndex: t.milestoneIndex - 1 };
        }
        return t;
      })
    );
  };

  const handleUpdateMilestone = (index: number, field: keyof ProjectTemplateMilestone, value: unknown) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddTask = () => {
    setTasks((prev) => [
      ...prev,
      {
        title: `Task ${prev.length + 1}`,
        milestoneIndex: milestones.length ? 0 : null,
        dayOffset: 0,
        dueDayOffset: 7,
        priority: 'Medium',
        hoursEstimate: 8,
      },
    ]);
  };

  const handleRemoveTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTask = (index: number, field: keyof ProjectTemplateTask, value: unknown) => {
    setTasks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Template name is required', 'error');
      return;
    }

    const payload: Partial<ProjectTemplate> = {
      name: name.trim(),
      category: category.trim() || undefined,
      priority,
      hoursEstimate: Number(hoursEstimate) || 0,
      budget: Number(budget) || 0,
      currency: currency || settingsCurrency,
      description: description.trim() || undefined,
      milestones: milestones.map((m, idx) => ({
        name: m.name.trim() || `Milestone ${idx + 1}`,
        dueDayOffset: Number(m.dueDayOffset) || (idx + 1) * 14,
        order: idx,
      })),
      tasks: tasks.map((t) => ({
        title: t.title.trim() || 'Untitled Task',
        milestoneIndex: t.milestoneIndex != null ? Number(t.milestoneIndex) : null,
        dayOffset: Number(t.dayOffset) || 0,
        dueDayOffset: Number(t.dueDayOffset) || 7,
        priority: t.priority || 'Medium',
        hoursEstimate: Number(t.hoursEstimate) || 0,
      })),
    };

    setSaving(true);
    try {
      if (editingTemplateId) {
        await crmApi.updateProjectTemplate(editingTemplateId, payload);
        showToast('Project template updated successfully');
      } else {
        await crmApi.createProjectTemplate(payload);
        showToast('Project template created successfully');
      }
      await loadTemplates();
      setViewMode('list');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.trim().toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  if (!open) return null;

  return (
    <div
      data-tour="projects-templates-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ─── Modal Header ──────────────────────────────────────────────── */}
        <div
          data-tour="projects-templates-header"
          className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70 shrink-0"
        >
          <div className="flex items-center gap-2.5">
            {viewMode === 'form' && (
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="p-1 rounded-lg hover:bg-zinc-200 text-zinc-600 transition-colors border-0 bg-transparent cursor-pointer mr-1"
                title="Back to templates list"
              >
                <ArrowBackIcon sx={{ fontSize: 18 }} />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-sm">
              📑
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950 m-0">
                {viewMode === 'form'
                  ? editingTemplateId
                    ? 'Edit Project Template'
                    : 'Create Project Template'
                  : 'Reusable Project Templates'}
              </h2>
              <p className="text-[11px] text-zinc-500 m-0">
                {viewMode === 'form'
                  ? 'Define standardized milestones, task breakdown, and timelines.'
                  : 'Manage blueprints to rapidly spin up consistent client projects.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors border-0 bg-transparent cursor-pointer"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* ─── Modal Body: LIST VIEW ─────────────────────────────────────── */}
        {viewMode === 'list' && (
          <div data-tour="projects-templates-list" className="flex flex-col flex-1 overflow-hidden">
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-zinc-100 flex items-center justify-between gap-3 bg-white shrink-0">
              <div className="relative flex-1 max-w-sm">
                <SearchIcon
                  sx={{ fontSize: 16 }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates by name or category..."
                  className="h-8 pl-8 pr-3 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full"
                />
              </div>

              <button
                type="button"
                data-tour="projects-templates-new-btn"
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer hover:bg-zinc-800 transition-colors shrink-0"
              >
                <AddIcon sx={{ fontSize: 15 }} />
                New Template
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 divide-y divide-zinc-100">
              {loading ? (
                <div className="py-12 text-center text-xs font-semibold text-zinc-400">
                  Loading templates…
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-2">📑</div>
                  <h3 className="text-sm font-bold text-zinc-900 m-0 mb-1">
                    No project templates configured
                  </h3>
                  <p className="text-xs text-zinc-500 m-0 mb-4 max-w-sm mx-auto">
                    Create reusable blueprints with standardized milestones, tasks, and hour
                    estimates to speed up project delivery.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none cursor-pointer hover:bg-zinc-800"
                  >
                    <AddIcon sx={{ fontSize: 15 }} />
                    Create First Template
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredTemplates.map((tpl, idx) => (
                    <div
                      key={tpl._id}
                      {...(idx === 0 ? { 'data-tour': 'projects-templates-card' } : {})}
                      className="border border-zinc-200 rounded-xl p-4 bg-white hover:border-zinc-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-zinc-950">{tpl.name}</span>
                          {tpl.category && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                              {tpl.category}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${priorityBadgeClass(
                              tpl.priority
                            )}`}
                          >
                            {tpl.priority || 'Medium'}
                          </span>
                        </div>

                        {tpl.description && (
                          <p className="text-xs text-zinc-600 m-0 mt-1 line-clamp-1">
                            {tpl.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500 flex-wrap">
                          <span className="flex items-center gap-1 font-medium">
                            <FlagOutlinedIcon sx={{ fontSize: 13 }} className="text-blue-600" />
                            {(tpl.milestones || []).length} Milestones
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-medium">
                            <PlaylistAddCheckIcon sx={{ fontSize: 14 }} className="text-indigo-600" />
                            {(tpl.tasks || []).length} Tasks
                          </span>
                          <span>·</span>
                          <span>⏱️ {tpl.hoursEstimate || 0} Estimated Hours</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          {...(idx === 0 ? { 'data-tour': 'projects-templates-use' } : {})}
                          onClick={() => {
                            onClose();
                            onUseTemplate(tpl);
                          }}
                          className="inline-flex items-center gap-1 h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 text-white border-none hover:bg-blue-700 cursor-pointer transition-colors"
                        >
                          <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                          Use Template
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEdit(tpl)}
                          className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-700 cursor-pointer transition-colors"
                          title="Edit template"
                        >
                          <EditOutlinedIcon sx={{ fontSize: 15 }} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(tpl._id, tpl.name)}
                          className="w-8 h-8 rounded-lg border border-red-200 bg-white hover:bg-red-50 flex items-center justify-center text-red-600 cursor-pointer transition-colors"
                          title="Delete template"
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Modal Body: FORM VIEW (Create/Edit) ────────────────────────── */}
        {viewMode === 'form' && (
          <form
            data-tour="projects-templates-form"
            onSubmit={handleSaveTemplate}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
              {/* Basic Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-zinc-700 uppercase">
                    Template Name *
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    placeholder="e.g., Full-Stack Web MVP (4 Weeks)"
                    className={fieldClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700 uppercase">
                    Category
                  </span>
                  <input
                    type="text"
                    placeholder="e.g., Web Development, Mobile, UI/UX"
                    className={fieldClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700 uppercase">
                    Default Priority
                  </span>
                  <select
                    className={fieldClass}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700 uppercase">
                    Estimated Hours
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g., 120"
                    className={fieldClass}
                    value={hoursEstimate}
                    onChange={(e) => setHoursEstimate(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700 uppercase">
                    Default Budget (Optional)
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g., 250000"
                    className={fieldClass}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-zinc-700 uppercase">
                    Description
                  </span>
                  <textarea
                    rows={2}
                    placeholder="Brief description of what this project template delivers..."
                    className="p-3 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full bg-white text-zinc-900 resize-y"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
              </div>

              {/* ─── Milestones Builder ───────────────────────────────────── */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FlagOutlinedIcon sx={{ fontSize: 16 }} className="text-blue-600" />
                    <span className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
                      Reusable Milestones ({milestones.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 cursor-pointer"
                  >
                    <AddIcon sx={{ fontSize: 14 }} />
                    Add Milestone
                  </button>
                </div>

                {milestones.length === 0 ? (
                  <p className="text-xs text-zinc-400 m-0 py-3 text-center">
                    No milestones defined yet. Click "+ Add Milestone" to add delivery phases.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {milestones.map((m, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs"
                      >
                        <div className="col-span-1 text-center font-bold text-xs text-zinc-400">
                          #{idx + 1}
                        </div>
                        <div className="col-span-7 sm:col-span-8">
                          <input
                            type="text"
                            required
                            placeholder="Milestone title *"
                            className={fieldClass}
                            value={m.name}
                            onChange={(e) => handleUpdateMilestone(idx, 'name', e.target.value)}
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2 flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            placeholder="Due offset"
                            className={fieldClass}
                            value={m.dueDayOffset ?? (idx + 1) * 14}
                            onChange={(e) =>
                              handleUpdateMilestone(idx, 'dueDayOffset', Number(e.target.value))
                            }
                            title="Due day offset from project start"
                          />
                          <span className="text-[10px] text-zinc-400 font-semibold">days</span>
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestone(idx)}
                            className="text-red-500 hover:text-red-700 font-bold border-0 bg-transparent cursor-pointer p-1"
                            title="Remove milestone"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── Tasks Builder ───────────────────────────────────────── */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <PlaylistAddCheckIcon sx={{ fontSize: 18 }} className="text-indigo-600" />
                    <span className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
                      Reusable Tasks ({tasks.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 cursor-pointer"
                  >
                    <AddIcon sx={{ fontSize: 14 }} />
                    Add Task
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <p className="text-xs text-zinc-400 m-0 py-3 text-center">
                    No tasks defined yet. Click "+ Add Task" to set up template work breakdown.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tasks.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs"
                      >
                        <div className="flex-1 min-w-[180px]">
                          <input
                            type="text"
                            required
                            placeholder="Task title *"
                            className={fieldClass}
                            value={t.title}
                            onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                          />
                        </div>

                        <div className="w-full sm:w-44">
                          <select
                            className={fieldClass}
                            value={t.milestoneIndex ?? ''}
                            onChange={(e) =>
                              handleUpdateTask(
                                idx,
                                'milestoneIndex',
                                e.target.value !== '' ? Number(e.target.value) : null
                              )
                            }
                          >
                            <option value="">-- No Milestone --</option>
                            {milestones.map((m, mIdx) => (
                              <option key={mIdx} value={mIdx}>
                                🚩 {m.name || `Milestone ${mIdx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="flex items-center gap-1 text-[10px] text-zinc-500 font-semibold" title="Day offset from project start">
                            Start:
                            <input
                              type="number"
                              min={0}
                              className="h-9 w-14 px-2 text-xs border border-zinc-200 rounded-lg"
                              value={t.dayOffset ?? 0}
                              onChange={(e) =>
                                handleUpdateTask(idx, 'dayOffset', Number(e.target.value))
                              }
                            />
                            d
                          </label>

                          <label className="flex items-center gap-1 text-[10px] text-zinc-500 font-semibold" title="Due day offset from project start">
                            Due:
                            <input
                              type="number"
                              min={1}
                              className="h-9 w-14 px-2 text-xs border border-zinc-200 rounded-lg"
                              value={t.dueDayOffset ?? 7}
                              onChange={(e) =>
                                handleUpdateTask(idx, 'dueDayOffset', Number(e.target.value))
                              }
                            />
                            d
                          </label>

                          <label className="flex items-center gap-1 text-[10px] text-zinc-500 font-semibold" title="Estimated hours">
                            <input
                              type="number"
                              min={0}
                              className="h-9 w-14 px-2 text-xs border border-zinc-200 rounded-lg"
                              value={t.hoursEstimate ?? 0}
                              onChange={(e) =>
                                handleUpdateTask(idx, 'hoursEstimate', Number(e.target.value))
                              }
                            />
                            h
                          </label>

                          <button
                            type="button"
                            onClick={() => handleRemoveTask(idx)}
                            className="text-red-500 hover:text-red-700 font-bold border-0 bg-transparent cursor-pointer p-1 ml-1"
                            title="Remove task"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Form Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-end gap-2 bg-zinc-50 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="h-9 px-4 text-xs font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 text-xs font-semibold rounded-lg bg-zinc-950 text-white border-none hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
              >
                {saving
                  ? 'Saving…'
                  : editingTemplateId
                  ? 'Save Template Changes'
                  : 'Create Project Template'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
