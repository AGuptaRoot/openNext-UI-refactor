import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import {
  DEFAULT_PROJECT_PRIORITIES,
  DEFAULT_PROJECT_STATUSES,
  DEFAULT_PROJECT_CATEGORIES,
  DEFAULT_PROJECT_TAGS,
  DEFAULT_PROJECT_CURRENCIES,
  ProgressCalculationMethod,
  ProjectTemplate,
  isLiveProjectStatus,
  LIVE_PROJECT_STATUS,
} from '../../types/projects';
import { ClientItem } from '../../types/clients';
import { AssignableUser } from '../../types/leads';
import { AddLeadItemModal } from '../../components/leads/AddLeadItemModal';
import { ProjectTemplateModal } from '../../components/projects/ProjectTemplateModal';
import { LiveLinkModal } from '../../components/projects/LiveLinkModal';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { resolveClientAvatarColor } from '../../utils/clientAvatar';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

const fieldClass =
  'h-9 px-3 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white text-zinc-900 transition-colors';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #a855f7)',
  'linear-gradient(135deg, #3b82f6, #06b6d4)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #2563eb)',
];

function getAvatarGradient(str: string): string {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function getInitials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/);
  if (!parts.length || !parts[0]) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ExtraCustomField {
  id: string;
  key: string;
  value: string;
}

export const ProjectCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, isClient } = useAuth();
  const canWrite = hasPermission('crm.projects.write') && !isClient;
  const settingsCurrency = useDefaultCurrency();

  // Metadata states
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_PROJECT_CATEGORIES);
  const [tags, setTags] = useState<string[]>(DEFAULT_PROJECT_TAGS);
  const [priorities, setPriorities] = useState<string[]>(DEFAULT_PROJECT_PRIORITIES);
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_PROJECT_STATUSES);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [customFieldDefs, setCustomFieldDefs] = useState<
    { key: string; label: string; type?: string; options?: string[]; required?: boolean }[]
  >([]);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState(searchParams.get('clientId') || '');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Not Started');
  const [liveUrl, setLiveUrl] = useState('');
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [statusBeforeLive, setStatusBeforeLive] = useState('Not Started');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [progressMethod, setProgressMethod] = useState<ProgressCalculationMethod>('tasks');
  const [currency, setCurrency] = useState(settingsCurrency);
  const [budget, setBudget] = useState('0');
  const [hoursEstimate, setHoursEstimate] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});
  const [extraCustomFields, setExtraCustomFields] = useState<ExtraCustomField[]>([]);
  const [templateId, setTemplateId] = useState(searchParams.get('templateId') || '');

  // Search filter for team members
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Inline modal states
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddTagModal, setShowAddTagModal] = useState(false);

  const handleStatusSelect = (next: string) => {
    if (isLiveProjectStatus(next) && !isLiveProjectStatus(status)) {
      setStatusBeforeLive(status);
      setLiveModalOpen(true);
      return;
    }
    setStatus(next);
  };

  const confirmLiveFromCreate = async (url: string) => {
    setLiveUrl(url);
    setStatus(LIVE_PROJECT_STATUS);
    setLiveModalOpen(false);
  };

  const cancelLiveFromCreate = () => {
    setStatus(statusBeforeLive);
    setLiveModalOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [clRes, usRes, catRes, tagRes, prioRes, stsRes, tplRes, cfRes] =
          await Promise.allSettled([
            crmApi.listClients({ limit: 200 }),
            crmApi.getAssignableUsers(),
            crmApi.getProjectCategories(),
            crmApi.getProjectTags(),
            crmApi.getProjectPriorities(),
            crmApi.getProjectStatuses(),
            crmApi.getProjectTemplates(),
            crmApi.getProjectCustomFields(),
          ]);

        if (cancelled) return;

        if (clRes.status === 'fulfilled' && clRes.value?.data?.length) {
          setClients(clRes.value.data);
        } else {
          // Fallback to getClients if listClients is empty
          const fallback = await crmApi.getClients({ limit: 200 }).catch(() => ({ data: [] }));
          if (fallback.data?.length) {
            setClients(fallback.data as unknown as ClientItem[]);
          }
        }

        if (usRes.status === 'fulfilled' && Array.isArray(usRes.value?.data)) {
          setUsers(usRes.value.data);
        }
        if (catRes.status === 'fulfilled' && Array.isArray(catRes.value?.data) && catRes.value.data.length) {
          setCategories(catRes.value.data);
        }
        if (tagRes.status === 'fulfilled' && Array.isArray(tagRes.value?.data) && tagRes.value.data.length) {
          setTags(tagRes.value.data);
        }
        if (prioRes.status === 'fulfilled' && Array.isArray(prioRes.value?.data) && prioRes.value.data.length) {
          setPriorities(prioRes.value.data);
        }
        if (stsRes.status === 'fulfilled' && Array.isArray(stsRes.value?.data) && stsRes.value.data.length) {
          setStatuses(stsRes.value.data);
        }
        if (tplRes.status === 'fulfilled' && Array.isArray(tplRes.value?.data)) {
          setTemplates(tplRes.value.data);
        }
        if (cfRes.status === 'fulfilled' && Array.isArray(cfRes.value?.data)) {
          setCustomFieldDefs(cfRes.value.data);
        }
      } catch (err) {
        console.warn('Failed loading project creation metadata:', err);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter out client users so only internal staff/members are assignable (matching old CRM rule)
  const assignableMembers = useMemo(() => {
    return users.filter((u) => {
      const role = String(
        u.role ||
        (u as unknown as Record<string, unknown>).roleName ||
        u.designation ||
        ''
      ).toLowerCase();
      const isClient = Boolean(
        u.isClient ||
        u.isClientUser ||
        u.clientId ||
        role === 'client' ||
        role.includes('client') ||
        role.includes('customer') ||
        role.includes('portal')
      );
      return !isClient;
    });
  }, [users]);

  // Filtered members based on search input
  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return assignableMembers;
    const q = memberSearchQuery.toLowerCase().trim();
    return assignableMembers.filter((u) => {
      const uName = (u.displayName || u.name || u.username || '').toLowerCase();
      const des = (u.designation || u.role || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return uName.includes(q) || des.includes(q) || email.includes(q);
    });
  }, [assignableMembers, memberSearchQuery]);

  // Selected client record for sidebar preview card
  const selectedClient = useMemo(() => {
    return clients.find((c) => String(c._id) === String(clientId));
  }, [clients, clientId]);

  // Selected template details
  const selectedTemplate = useMemo(() => {
    return templates.find((t) => String(t._id) === String(templateId));
  }, [templates, templateId]);

  // Apply template
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (!id) return;
    const tpl = templates.find((t) => String(t._id) === String(id));
    if (!tpl) return;

    if (!name.trim() || templates.some((t) => t.name === name.trim())) {
      setName(tpl.name);
    }
    if (tpl.category) setCategory(tpl.category);
    if (tpl.priority) setPriority(tpl.priority);
    if (tpl.currency) setCurrency(tpl.currency);
    if (tpl.budget) setBudget(String(tpl.budget));
    if (tpl.hoursEstimate) setHoursEstimate(String(tpl.hoursEstimate));
    if (tpl.description) setDescription(tpl.description);
  };

  // Auto-apply template from URL if present
  useEffect(() => {
    const urlTplId = searchParams.get('templateId');
    if (urlTplId && templates.length > 0) {
      applyTemplate(urlTplId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, searchParams]);

  const toggleTag = (t: string) => {
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const toggleAssignee = (userId: string) => {
    setAssignedTo((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllMembers = () => {
    const allIds = assignableMembers
      .map((u) => u.id || u._id || u.userId || '')
      .filter(Boolean);
    setAssignedTo(allIds);
  };

  const handleClearAllMembers = () => {
    setAssignedTo([]);
  };

  // Extra dynamic custom fields
  const addExtraCustomField = () => {
    setExtraCustomFields((prev) => [
      ...prev,
      { id: 'cf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7), key: '', value: '' },
    ]);
  };

  const updateExtraCustomField = (id: string, field: 'key' | 'value', val: string) => {
    setExtraCustomFields((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const removeExtraCustomField = (id: string) => {
    setExtraCustomFields((prev) => prev.filter((item) => item.id !== id));
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Project name is required.');
      return;
    }
    if (!clientId) {
      setError('Please select a client.');
      return;
    }
    if (isLiveProjectStatus(status) && !liveUrl.trim()) {
      setStatusBeforeLive('Not Started');
      setLiveModalOpen(true);
      return;
    }

    setSaving(true);

    try {
      // Assemble custom fields (global defined + extra dynamic key-value rows)
      const mergedCustomFields: Record<string, string | number | boolean> = { ...customFields };
      extraCustomFields.forEach((item) => {
        const cleanK = item.key.trim().replace(/\s+/g, '_');
        if (cleanK) {
          mergedCustomFields[cleanK] = item.value.trim();
        }
      });

      const payload = {
        name: trimmedName,
        clientId,
        clientName: selectedClient?.name,
        category: category || '',
        priority: priority || 'Medium',
        tags: selectedTags,
        label: selectedTags[0] || '',
        status: status || 'Not Started',
        liveUrl: liveUrl.trim() || undefined,
        progressCalculationMethod: progressMethod || 'tasks',
        currency: currency || settingsCurrency,
        budget: Number(budget) || 0,
        hoursEstimate: Number(hoursEstimate) || 0,
        startDate: startDate || null,
        deadline: deadline || null,
        description: description.trim(),
        assignedTo,
        customFields: mergedCustomFields,
      };

      let createdId = '';
      if (templateId) {
        const res = await crmApi.createProjectFromTemplate(templateId, payload);
        createdId = res.data?._id || (res.data as unknown as { id?: string })?.id || '';
      } else {
        const res = await crmApi.createProject(payload);
        createdId = res.data?._id || (res.data as unknown as { id?: string })?.id || '';
      }

      if (createdId) {
        navigate(`/projects/${createdId}`);
      } else {
        navigate('/projects');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setSaving(false);
    }
  };

  if (!canWrite) {
    return (
      <div className="py-20 px-6 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
          <CloseIcon sx={{ fontSize: 24 }} />
        </div>
        <h3 className="text-base font-bold text-zinc-950 mb-1">Permission Denied</h3>
        <p className="text-xs text-zinc-500 mb-6">
          You do not have permission to create projects (`crm.projects.write`).
        </p>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 text-white text-xs font-semibold rounded-lg no-underline hover:bg-zinc-800 transition-colors"
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          <span>Back to projects</span>
        </Link>
      </div>
    );
  }

  return (
    <div data-tour="projects-create-form" className="flex w-full flex-col gap-6 font-sans pb-16">
      {/* ─── HERO HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 pb-4 border-b border-zinc-200">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-950 no-underline transition-colors w-fit mb-1"
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          <span>Back to projects</span>
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xl font-bold select-none shrink-0"
            aria-hidden="true"
          >
            📁
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 m-0">
              Project Delivery
            </p>
            <h1 className="text-xl font-bold text-zinc-950 m-0 tracking-tight leading-snug">
              Create project
            </h1>
            <p className="text-xs text-zinc-500 m-0 mt-0.5 leading-relaxed">
              Set up client deliverables, budget, milestones, member team assignments, and tracking methods.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 bg-transparent border-0 cursor-pointer p-0 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {loadingMeta ? (
        <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center text-xs font-semibold text-zinc-400 animate-pulse">
          Loading project creation workspace…
        </div>
      ) : (
        /* ─── TWO-COLUMN WORKSPACE LAYOUT (Matching Old CRM lead-detail-layout) ──── */
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ─── LEFT SIDEBAR (4 COLS) ────────────────────────────────────── */}
          <aside className="lg:col-span-4 flex flex-col gap-5 order-2 lg:order-1">
            {/* CARD 1: SELECTED CLIENT PREVIEW CARD */}
            <div data-tour="projects-section-client" className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none">
              <div className="border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-xs font-bold text-zinc-950 m-0">Client Information</h3>
                <span className="text-[11px] text-zinc-400">Selected client profile</span>
              </div>

              {!selectedClient ? (
                <div className="py-8 px-4 text-center flex flex-col items-center justify-center">
                  <div className="text-3xl mb-2 select-none opacity-80">🏢</div>
                  <p className="text-xs text-zinc-500 m-0 leading-relaxed max-w-[220px]">
                    Select a client from the form to view their details, contact information, and account status.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Hero with round avatar & badges */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-13 h-13 rounded-full flex items-center justify-center font-bold text-base text-white overflow-hidden shrink-0 border-2 border-white shadow-sm select-none"
                      style={{
                        background: selectedClient.avatarColor
                          ? resolveClientAvatarColor(selectedClient.avatarColor)
                          : getAvatarGradient(selectedClient.name + selectedClient._id),
                        width: 48,
                        height: 48,
                      }}
                    >
                      {selectedClient.avatarUrl ? (
                        <img
                          src={selectedClient.avatarUrl}
                          alt={selectedClient.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <span>{getInitials(selectedClient.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-zinc-950 m-0 truncate">
                        {selectedClient.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            String(selectedClient.status || 'Active').toLowerCase() === 'inactive'
                              ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              String(selectedClient.status || 'Active').toLowerCase() === 'inactive'
                                ? 'bg-zinc-400'
                                : 'bg-emerald-500'
                            }`}
                          />
                          {selectedClient.status || 'Active'}
                        </span>
                        {selectedClient.category && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                            🏷️ {selectedClient.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info Row List */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-zinc-100 text-xs">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400 text-[11px]">✉ Email</span>
                      <span className="font-medium text-zinc-800 truncate max-w-[190px]" title={selectedClient.email}>
                        {selectedClient.email || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-t border-zinc-50">
                      <span className="text-zinc-400 text-[11px]">📞 Phone</span>
                      <span className="font-medium text-zinc-800">
                        {selectedClient.phone || '—'}
                      </span>
                    </div>
                    {selectedClient.website && (
                      <div className="flex justify-between items-center py-1 border-t border-zinc-50">
                        <span className="text-zinc-400 text-[11px]">🌐 Website</span>
                        <a
                          href={selectedClient.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline truncate max-w-[190px]"
                        >
                          {selectedClient.website}
                        </a>
                      </div>
                    )}
                    {selectedClient.taxId && (
                      <div className="flex justify-between items-center py-1 border-t border-zinc-50">
                        <span className="text-zinc-400 text-[11px]">🆔 Tax ID</span>
                        <span className="font-mono text-zinc-800 text-[11px]">
                          {selectedClient.taxId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: DELIVERY GUIDELINES CARD */}
            <div className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none">
              <div className="border-b border-zinc-100 pb-3 mb-3">
                <h3 className="text-xs font-bold text-zinc-950 m-0">Delivery Guidelines</h3>
                <span className="text-[11px] text-zinc-400">Best practices</span>
              </div>
              <ul className="flex flex-col gap-2.5 m-0 p-0 list-none text-xs text-zinc-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold select-none">•</span>
                  <span>
                    <strong className="text-zinc-950 font-semibold">Task vs. Time:</strong> Choose progress calculation to reflect milestone completions or real-time log hours.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold select-none">•</span>
                  <span>
                    <strong className="text-zinc-950 font-semibold">Multi-Assignees:</strong> Assign team members with role designations to give them direct workspace access.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold select-none">•</span>
                  <span>
                    <strong className="text-zinc-950 font-semibold">Labels & Categories:</strong> Segment projects for reports and client billing analysis.
                  </span>
                </li>
              </ul>
            </div>
          </aside>

          {/* ─── MAIN FORM CONTENT (8 COLS) ───────────────────────────────── */}
          <div className="lg:col-span-8 flex flex-col gap-5 order-1 lg:order-2">
            {/* 1. REUSABLE PROJECT TEMPLATE CARD */}
            <div className="bg-gradient-to-r from-zinc-50 via-blue-50/20 to-indigo-50/30 border border-blue-200 rounded-xl p-5 shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-900">⚡ Reusable Project Template</span>
                    <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                      Optional
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 m-0 mt-0.5">
                    Instantly populate milestone schedules, task structures, and hour estimates from a template.
                  </p>
                </div>
                <div className="flex items-center gap-2 min-w-[280px]">
                  <select
                    className="h-9 px-3 text-xs border border-blue-300 rounded-lg outline-none focus:border-blue-500 w-full bg-white text-zinc-900"
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">-- Blank Project (No Template) --</option>
                    {templates.map((t) => (
                      <option key={t._id} value={t._id}>
                        📦 {t.name} ({(t.milestones || []).length} Milestones, {(t.tasks || []).length} Tasks)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setTemplatesModalOpen(true)}
                    className="h-9 px-3 text-xs font-semibold rounded-lg border border-blue-300 bg-white text-blue-700 hover:bg-blue-50 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    title="Manage or create project templates"
                  >
                    📑 Templates
                  </button>
                </div>
              </div>

              {selectedTemplate && (
                <div className="mt-3 pt-3 border-t border-dashed border-blue-200 text-xs text-zinc-700 flex flex-col gap-1">
                  <div>
                    🚩 <strong className="font-semibold text-zinc-950">Milestones ({(selectedTemplate.milestones || []).length}):</strong>{' '}
                    <span className="text-zinc-600">
                      {(selectedTemplate.milestones || []).map((m) => (typeof m === 'string' ? m : (m as { name?: string }).name || '')).filter(Boolean).join(', ') || 'None'}
                    </span>
                  </div>
                  <div>
                    📋 <strong className="font-semibold text-zinc-950">Tasks ({(selectedTemplate.tasks || []).length}):</strong>{' '}
                    <span className="text-zinc-600">
                      {(selectedTemplate.tasks || []).map((t) => t.title).join(', ') || 'None'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. PROJECT OVERVIEW CARD */}
            <div data-tour="projects-section-overview" className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-4">
              <div className="border-b border-zinc-100 pb-3">
                <h3 className="text-xs font-bold text-zinc-950 m-0">Project Overview</h3>
                <span className="text-[11px] text-zinc-400">Basic details and categorization</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Project Name (Full Width) */}
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-zinc-700">Project name *</span>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    placeholder="e.g., Enterprise E-Commerce Platform Redesign"
                    className={fieldClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                {/* Client Select (Full Width) */}
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-zinc-700">Client *</span>
                  <ClientSelect
                    clients={clients}
                    value={clientId}
                    required
                    placeholder="Select client organization…"
                    onChange={(nextId) => setClientId(nextId)}
                  />
                  <span className="text-[10px] text-zinc-400">
                    The company or client organization commissioning this project.
                  </span>
                </label>

                {/* Category with inline + Add Category modal trigger */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-700">Project Category</span>
                    <button
                      type="button"
                      onClick={() => setShowAddCategoryModal(true)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold bg-transparent border-0 cursor-pointer p-0"
                    >
                      + Add Category
                    </button>
                  </div>
                  <select
                    className={fieldClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Select Category (Optional)</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority with Emojis */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">Project Priority</span>
                  <select
                    className={fieldClass}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {priorities.map((p) => {
                      const emoji =
                        p === 'Urgent'
                          ? '🔥'
                          : p === 'High'
                          ? '⚡'
                          : p === 'Medium'
                          ? '🔹'
                          : '⚪';
                      return (
                        <option key={p} value={p}>
                          {emoji} {p} Priority
                        </option>
                      );
                    })}
                  </select>
                </label>

                {/* Tags / Labels with selectable chips */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-700">
                      Project Tags / Labels
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddTagModal(true)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold bg-transparent border-0 cursor-pointer p-0"
                    >
                      + Create Tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-2.5 border border-zinc-200 rounded-lg bg-zinc-50/50 min-h-[44px] items-center">
                    {tags.map((t) => {
                      const isSelected = selectedTags.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTag(t)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400'
                          }`}
                        >
                          <span
                            className={`w-3 h-3 rounded-sm flex items-center justify-center border text-[9px] ${
                              isSelected ? 'bg-white text-zinc-950 border-white font-bold' : 'border-zinc-400'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                          <span>{t}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    Select one or multiple tags to categorize and filter this deliverable.
                  </span>
                </div>
              </div>
            </div>

            {/* 3. TIMELINE, BUDGET & TRACKING CARD */}
            <div data-tour="projects-section-timeline" className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-4">
              <div className="border-b border-zinc-100 pb-3">
                <h3 className="text-xs font-bold text-zinc-950 m-0">Timeline, Budget & Tracking</h3>
                <span className="text-[11px] text-zinc-400">Financial estimation and progress method</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">Status</span>
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
                    <span className="text-[11px] font-semibold text-zinc-700">
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
                  </label>
                )}

                {/* Progress Calculation Method */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">
                    Calculate project progress through
                  </span>
                  <select
                    className={fieldClass}
                    value={progressMethod}
                    onChange={(e) => setProgressMethod(e.target.value as ProgressCalculationMethod)}
                  >
                    <option value="tasks">based on task completion</option>
                    <option value="time">based on project total time</option>
                    <option value="manual">manual</option>
                  </select>
                  <span className="text-[10px] text-zinc-400">Determines how the progress bar advances.</span>
                </label>

                {/* Currency (8 options matching old CRM) */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">Currency</span>
                  <select
                    className={fieldClass}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {DEFAULT_PROJECT_CURRENCIES.map((cur) => (
                      <option key={cur.code} value={cur.code}>
                        {cur.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Budget */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">Project Budget</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className={fieldClass}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                  <span className="text-[10px] text-zinc-400">Allocated total budget amount.</span>
                </label>

                {/* Hours Estimate */}
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-zinc-700">
                    Hours Estimate (In Hours)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder="e.g., 80"
                    className={fieldClass}
                    value={hoursEstimate}
                    onChange={(e) => setHoursEstimate(e.target.value)}
                  />
                  <span className="text-[10px] text-zinc-400">
                    Used for time-based progress calculation.
                  </span>
                </label>

                {/* Start Date */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">Start date</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>

                {/* Deadline */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">Deadline</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </label>
              </div>
            </div>

            {/* 4. CUSTOM FIELDS & ATTRIBUTES CARD */}
            <div data-tour="projects-section-custom-fields" className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-zinc-950 m-0">Custom Fields & Attributes</h3>
                  <span className="text-[11px] text-zinc-400">
                    Deliverable metadata, repository links, or contract fields
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addExtraCustomField}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 cursor-pointer"
                >
                  <AddIcon sx={{ fontSize: 15 }} />
                  <span>Add Extra Field</span>
                </button>
              </div>

              {/* Defined global fields */}
              {customFieldDefs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {customFieldDefs.map((f) => {
                    const type = String(f.type || 'text');
                    return (
                      <label key={f.key} className={`flex flex-col gap-1 ${type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                        <span className="text-[11px] font-semibold text-zinc-700">
                          {f.label}
                          {f.required ? ' *' : ''}
                        </span>
                        {type === 'boolean' ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              id={`cf_${f.key}`}
                              checked={Boolean(customFields[f.key])}
                              onChange={(e) =>
                                setCustomFields((prev) => ({ ...prev, [f.key]: e.target.checked }))
                              }
                              className="w-4 h-4 rounded border-zinc-300 cursor-pointer"
                            />
                            <span className="text-xs text-zinc-700 font-medium cursor-pointer">
                              Enabled / Yes
                            </span>
                          </div>
                        ) : type === 'textarea' ? (
                          <textarea
                            rows={2}
                            className="px-3 py-2 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full"
                            placeholder={`Enter ${f.label}…`}
                            value={String(customFields[f.key] ?? '')}
                            onChange={(e) =>
                              setCustomFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                            }
                          />
                        ) : type === 'select' ? (
                          <select
                            className={fieldClass}
                            value={String(customFields[f.key] ?? '')}
                            onChange={(e) =>
                              setCustomFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                            }
                          >
                            <option value="">Select {f.label}</option>
                            {(f.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={
                              type === 'number'
                                ? 'number'
                                : type === 'date'
                                ? 'date'
                                : type === 'email'
                                ? 'email'
                                : type === 'url'
                                ? 'url'
                                : 'text'
                            }
                            className={fieldClass}
                            placeholder={`Enter ${f.label}…`}
                            value={
                              customFields[f.key] === undefined || customFields[f.key] === null
                                ? ''
                                : String(customFields[f.key])
                            }
                            onChange={(e) =>
                              setCustomFields((prev) => ({
                                ...prev,
                                [f.key]:
                                  type === 'number'
                                    ? e.target.value === ''
                                      ? ''
                                      : Number(e.target.value)
                                    : e.target.value,
                              }))
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Dynamic Extra Custom Key-Value Rows */}
              {extraCustomFields.length > 0 && (
                <div className="flex flex-col gap-2.5 pt-2">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    Extra Attributes
                  </span>
                  {extraCustomFields.map((cf) => (
                    <div key={cf.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Attribute Key (e.g. Server IP)"
                          className={fieldClass}
                          value={cf.key}
                          onChange={(e) => updateExtraCustomField(cf.id, 'key', e.target.value)}
                        />
                      </div>
                      <div className="col-span-6">
                        <input
                          type="text"
                          placeholder="Attribute Value"
                          className={fieldClass}
                          value={cf.value}
                          onChange={(e) => updateExtraCustomField(cf.id, 'value', e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeExtraCustomField(cf.id)}
                          className="h-9 w-9 flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer bg-white"
                          title="Remove field"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. ASSIGN TEAM MEMBERS CARD */}
            <div data-tour="projects-section-team" className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-zinc-950 m-0">Assign Team Members</h3>
                  <span className="text-[11px] text-zinc-400">
                    Select team members and view designations ({assignedTo.length} selected)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllMembers}
                    className="px-2.5 py-1 rounded border border-zinc-200 hover:bg-zinc-50 text-[11px] font-semibold text-zinc-700 cursor-pointer bg-white"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllMembers}
                    className="px-2.5 py-1 rounded border border-zinc-200 hover:bg-zinc-50 text-[11px] font-semibold text-zinc-700 cursor-pointer bg-white"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Search Filter */}
              <div>
                <input
                  type="text"
                  placeholder="🔍 Search team members by name or designation…"
                  className={fieldClass}
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                />
              </div>

              {/* Team Member Cards Grid (Matching old CRM layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                {filteredMembers.map((u) => {
                  const uid = String(u.id || u._id || u.userId || '');
                  const uName = u.displayName || u.name || u.username || 'Team Member';
                  const designation = u.designation || u.role || 'Member';
                  const email = u.email || '';
                  const isSelected = assignedTo.includes(uid);
                  const gradient = getAvatarGradient(uName + uid);

                  return (
                    <div
                      key={uid}
                      onClick={() => toggleAssignee(uid)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                        isSelected
                          ? 'border-zinc-950 bg-zinc-50/80 ring-1 ring-zinc-950'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden shrink-0 select-none"
                        style={{ background: gradient }}
                      >
                        {getInitials(uName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-zinc-950 truncate">{uName}</div>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 mt-0.5">
                          {designation}
                        </span>
                        {email && (
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5" title={email}>
                            {email}
                          </div>
                        )}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-zinc-950 text-white'
                            : 'border border-zinc-300 text-transparent bg-white'
                        }`}
                      >
                        {isSelected ? <CheckIcon sx={{ fontSize: 13 }} /> : null}
                      </div>
                    </div>
                  );
                })}

                {filteredMembers.length === 0 && (
                  <div className="col-span-full py-8 text-center text-xs text-zinc-400">
                    No matching internal team members found.
                  </div>
                )}
              </div>

              <span className="text-[10px] text-zinc-400">
                Selected members will automatically be added as project members and will receive workspace visibility.
              </span>
            </div>

            {/* 6. PROJECT SCOPE & DESCRIPTION CARD */}
            <div data-tour="projects-section-scope" className="bg-white border border-zinc-300 rounded-xl p-5 shadow-none flex flex-col gap-3">
              <div className="border-b border-zinc-100 pb-3">
                <h3 className="text-xs font-bold text-zinc-950 m-0">Project Scope & Description</h3>
                <span className="text-[11px] text-zinc-400">Deliverable summary and client notes</span>
              </div>
              <textarea
                rows={4}
                maxLength={4000}
                placeholder="Outline the main objectives, project scope, deliverables, milestones, and special requirements…"
                className="px-3 py-2 text-xs border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full resize-y font-sans"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* 7. FORM ACTIONS */}
            <div className="flex items-center gap-3 pt-2">
              <button data-tour="projects-save-btn"
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border border-zinc-950 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {saving ? 'Creating Project…' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="px-5 py-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 bg-white text-zinc-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ─── MODAL: ADD CATEGORY INLINE ─────────────────────────────────── */}
      <AddLeadItemModal
        open={showAddCategoryModal}
        title="Add Project Category"
        subtitle="Create a new category for classifying project deliverables."
        label="Category Name *"
        placeholder="e.g. Web Development, Mobile App, UI/UX Design, Cloud / DevOps"
        hint="A descriptive category name for organizing client deliverables."
        submitLabel="Save Category"
        onClose={() => setShowAddCategoryModal(false)}
        onSubmit={async (newCat) => {
          const res = await crmApi.createProjectCategory(newCat);
          setCategories(res.data || [...categories, newCat]);
          setCategory(newCat);
        }}
      />

      {/* ─── MODAL: CREATE TAG INLINE ───────────────────────────────────── */}
      <AddLeadItemModal
        open={showAddTagModal}
        title="Add Project Tag"
        subtitle="Create a tag or label for flagging and filtering projects."
        label="Tag Name *"
        placeholder="e.g. High Priority, Feature MVP, Bug Fix, Q3 Deliverable, Client Work"
        hint="A short tag to highlight key project attributes."
        submitLabel="Save Tag"
        onClose={() => setShowAddTagModal(false)}
        onSubmit={async (newTag) => {
          const res = await crmApi.addProjectTag(newTag);
          setTags(res.data || [...tags, newTag]);
          setSelectedTags((prev) => (prev.includes(newTag) ? prev : [...prev, newTag]));
        }}
      />

      {/* ─── MODAL: REUSABLE PROJECT TEMPLATES ─────────────────────────── */}
      <ProjectTemplateModal
        open={templatesModalOpen}
        onClose={() => {
          setTemplatesModalOpen(false);
          crmApi.getProjectTemplates().then((res) => {
            if (res.data) setTemplates(res.data);
          });
        }}
        onUseTemplate={(tpl) => {
          setTemplatesModalOpen(false);
          crmApi.getProjectTemplates().then((res) => {
            if (res.data) setTemplates(res.data);
          });
          applyTemplate(tpl._id);
        }}
        showToast={(msg, type) => {
          if (type === 'error') setError(msg);
        }}
      />

      <LiveLinkModal
        open={liveModalOpen}
        projectName={name}
        initialUrl={liveUrl}
        onCancel={cancelLiveFromCreate}
        onConfirm={confirmLiveFromCreate}
      />
    </div>
  );
};
