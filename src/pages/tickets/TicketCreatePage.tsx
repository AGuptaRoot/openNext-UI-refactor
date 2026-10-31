import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import type { AssignableUser } from '../../types/leads';
import type { ProjectItem } from '../../types/projects';
import {
  DEFAULT_PRIORITY_SLA_HOURS,
  TICKET_CHANNELS,
  TICKET_GROUPS,
  TICKET_PRIORITIES,
  TICKET_QUICK_TAGS,
  TICKET_TYPES,
  slaHoursForPriority,
} from '../../types/tickets';

const META_KEY = 'opennext_ticket_meta_v1';

const fieldClass =
  'h-10 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';
const sectionClass = 'rounded-xl border border-zinc-300 bg-white p-5';

interface PriorityMeta {
  name: string;
  slaHours: number;
}

interface TicketMetaStore {
  groups: string[];
  types: string[];
  priorities: PriorityMeta[];
  channels: string[];
}

type ModalKind = 'group' | 'type' | 'priority' | 'channel' | null;

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function defaultPriorities(): PriorityMeta[] {
  return TICKET_PRIORITIES.map((name) => ({
    name,
    slaHours: DEFAULT_PRIORITY_SLA_HOURS[name] ?? 48,
  }));
}

function loadMeta(): TicketMetaStore {
  const defaults: TicketMetaStore = {
    groups: [...TICKET_GROUPS],
    types: [...TICKET_TYPES],
    priorities: defaultPriorities(),
    channels: [...TICKET_CHANNELS],
  };
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TicketMetaStore>;
    const priorities = Array.isArray(parsed.priorities)
      ? parsed.priorities
          .map((entry) => ({
            name: String(entry?.name || '').trim(),
            slaHours: Number(entry?.slaHours) || 48,
          }))
          .filter((entry) => entry.name)
      : [];
    return {
      groups: uniqueStrings([...(parsed.groups || []), ...defaults.groups]),
      types: uniqueStrings([...(parsed.types || []), ...defaults.types]),
      priorities: uniquePriorityMerge(priorities, defaults.priorities),
      channels: uniqueStrings([...(parsed.channels || []), ...defaults.channels]),
    };
  } catch {
    return defaults;
  }
}

function uniquePriorityMerge(custom: PriorityMeta[], defaults: PriorityMeta[]): PriorityMeta[] {
  const map = new Map<string, PriorityMeta>();
  for (const item of defaults) map.set(item.name.toLowerCase(), item);
  for (const item of custom) map.set(item.name.toLowerCase(), item);
  return Array.from(map.values());
}

function saveMeta(meta: TicketMetaStore) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatSlaPreview(hours: number): string {
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return rem > 0 ? `Due in ${hours} hours (${days} Days + ${rem}h)` : `Due in ${hours} hours (${days} Days)`;
  }
  return `Due in ${hours} hour${hours === 1 ? '' : 's'}`;
}

export const TicketCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isClient, canAssignTickets } = useAuth();
  const { showProjects } = useActiveExtension();
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [meta, setMeta] = useState<TicketMetaStore>(() => loadMeta());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [assignGroup, setAssignGroup] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [projectId, setProjectId] = useState('');
  const [ticketType, setTicketType] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [channel, setChannel] = useState('Email');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [modal, setModal] = useState<ModalKind>(null);
  const [modalName, setModalName] = useState('');
  const [modalSla, setModalSla] = useState(24);

  const creatorName = user?.username || user?.email || 'Support Staff';
  const creatorEmail = user?.email || '';
  const creatorBadge = isClient ? 'Client' : 'Employee';

  const priorityMap = useMemo(() => {
    const map: Record<string, number> = { ...DEFAULT_PRIORITY_SLA_HOURS };
    for (const item of meta.priorities) map[item.name] = item.slaHours;
    return map;
  }, [meta.priorities]);

  const slaHours = slaHoursForPriority(priority, priorityMap[priority]);

  useEffect(() => {
    Promise.all([crmApi.getAssignableUsers(), crmApi.listProjects({ limit: 200 })])
      .then(([userResponse, projectResponse]) => {
        setUsers((userResponse.data || []).filter((entry) => !entry.isClient && !entry.isClientUser));
        setProjects(projectResponse.data || []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load ticket options'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const persistMeta = (next: TicketMetaStore) => {
    setMeta(next);
    saveMeta(next);
  };

  const openModal = (kind: ModalKind) => {
    setModal(kind);
    setModalName('');
    setModalSla(24);
  };

  const submitModal = (event: React.FormEvent) => {
    event.preventDefault();
    const name = modalName.trim();
    if (!name) return;
    if (modal === 'group') {
      const groups = uniqueStrings([...meta.groups, name]);
      persistMeta({ ...meta, groups });
      setAssignGroup(name);
    } else if (modal === 'type') {
      const types = uniqueStrings([...meta.types, name]);
      persistMeta({ ...meta, types });
      setTicketType(name);
    } else if (modal === 'channel') {
      const channels = uniqueStrings([...meta.channels, name]);
      persistMeta({ ...meta, channels });
      setChannel(name);
    } else if (modal === 'priority') {
      const hours = Math.min(720, Math.max(1, Number(modalSla) || 1));
      const priorities = uniquePriorityMerge([{ name, slaHours: hours }], meta.priorities);
      persistMeta({ ...meta, priorities });
      setPriority(name);
    }
    setModal(null);
  };

  const addTag = (raw: string) => {
    const value = raw.trim().replace(/,$/, '');
    if (!value) return;
    setTags((current) => (current.some((tag) => tag.toLowerCase() === value.toLowerCase()) ? current : [...current, value]));
    setTagInput('');
  };

  const onTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(tagInput);
    } else if (event.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((current) => current.slice(0, -1));
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!assignGroup) return setError('Assign group is required.');
    if (!ticketType) return setError('Ticket type is required.');
    if (!subject.trim()) return setError('Subject is required.');
    if (!description.trim()) return setError('Description is required.');
    if (!priority) return setError('Priority is required.');
    if (!channel) return setError('Channel is required.');

    setSaving(true);
    try {
      const response = await crmApi.createTicket({
        assignGroup,
        assignedTo: assignedTo || undefined,
        projectId: projectId || null,
        ticketType,
        type: ticketType,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        channel,
        channelName: channel,
        tags,
        slaHours,
        requesterType: isClient ? 'Client' : 'Employee',
        requesterName: creatorName,
        clientId: user?.clientId || undefined,
      });
      navigate(`/tickets/${response.data._id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  const modalTitle =
    modal === 'group'
      ? 'Add Assign Group'
      : modal === 'type'
        ? 'Add Ticket Type'
        : modal === 'priority'
          ? 'Add Priority Level'
          : modal === 'channel'
            ? 'Add Channel'
            : '';

  return (
    <div data-tour="tickets-create-form" className="flex w-full flex-col gap-5">
      <Link
        to="/tickets"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 no-underline hover:text-zinc-950"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to Tickets
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Support & Helpdesk / New Support Ticket
          </p>
          <h1 className="m-0 text-2xl font-bold text-zinc-950">Create Support Ticket</h1>
          <p className="m-0 mt-1 text-sm text-zinc-500">
            Route a service request with priority SLA and channel attribution.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/tickets"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 no-underline"
          >
            Cancel
          </Link>
          <button
            type="submit"
            form="form-full-page-create-ticket"
            disabled={saving || loading}
            className="inline-flex h-10 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <AddIcon sx={{ fontSize: 18 }} /> {saving ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className={`${sectionClass} mb-4 flex items-center gap-3`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
          {initialsFromName(creatorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-zinc-950">{creatorName}</div>
          <div className="truncate text-xs text-zinc-500">
            {creatorEmail || 'Internal staff'} · Creating ticket as authenticated session
          </div>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
          {creatorBadge}
        </span>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          Loading form…
        </div>
      ) : (
        <form id="form-full-page-create-ticket" onSubmit={submit} className="flex flex-col gap-4">
          <section data-tour="tickets-create-assignment" className={sectionClass}>
            <h2 className="mt-0 mb-4 text-base font-bold text-zinc-950">
              1. Assignment, Project & Category
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className={labelClass + ' mb-0'} htmlFor="ticket-select-assign-group">
                    Assign Group *
                  </label>
                  {!isClient && (
                    <button
                      type="button"
                      onClick={() => openModal('group')}
                      className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-zinc-700 underline"
                    >
                      + Add Group
                    </button>
                  )}
                </div>
                <select
                  id="ticket-select-assign-group"
                  required
                  className={fieldClass}
                  value={assignGroup}
                  onChange={(e) => setAssignGroup(e.target.value)}
                >
                  <option value="">Select group</option>
                  {meta.groups.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {canAssignTickets && (
                <label>
                  <span className={labelClass}>Assigned Agent</span>
                  <select
                    id="ticket-select-agent"
                    className={fieldClass}
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map((item) => (
                      <option key={item.id || item._id} value={item.id || item._id}>
                        {item.name || item.displayName || item.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {showProjects && (
                <label>
                  <span className={labelClass}>Project</span>
                  <select
                    id="ticket-select-project"
                    className={fieldClass}
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    <option value="">No project</option>
                    {projects.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className={labelClass + ' mb-0'} htmlFor="ticket-select-type">
                    Ticket Type *
                  </label>
                  {!isClient && (
                    <button
                      type="button"
                      onClick={() => openModal('type')}
                      className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-zinc-700 underline"
                    >
                      + Add Type
                    </button>
                  )}
                </div>
                <select
                  id="ticket-select-type"
                  required
                  className={fieldClass}
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value)}
                >
                  <option value="">Select type</option>
                  {meta.types.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section data-tour="tickets-create-details" className={sectionClass}>
            <h2 className="mt-0 mb-4 text-base font-bold text-zinc-950">
              2. Ticket Subject & Issue Details
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <label>
                <span className={labelClass}>Ticket Subject *</span>
                <input
                  id="ticket-page-subject"
                  required
                  maxLength={500}
                  className={fieldClass}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of issue or inquiry"
                />
              </label>
              <label>
                <span className={labelClass}>Detailed Description *</span>
                <textarea
                  id="ticket-page-description"
                  required
                  maxLength={20000}
                  rows={5}
                  className={`${fieldClass} h-auto py-2`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Full reproduction steps, error logs, or context"
                />
              </label>
            </div>
          </section>

          <section data-tour="tickets-create-priority" className={sectionClass}>
            <h2 className="mt-0 mb-4 text-base font-bold text-zinc-950">
              3. Priority, Channel & Tags
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className={labelClass + ' mb-0'} htmlFor="ticket-select-priority">
                    Priority *
                  </label>
                  <button
                    type="button"
                    onClick={() => openModal('priority')}
                    className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-zinc-700 underline"
                  >
                    + Add Priority
                  </button>
                </div>
                <select
                  id="ticket-select-priority"
                  required
                  className={fieldClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {meta.priorities.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.slaHours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className={labelClass + ' mb-0'} htmlFor="ticket-select-channel">
                    Channel Name *
                  </label>
                  <button
                    type="button"
                    onClick={() => openModal('channel')}
                    className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-zinc-700 underline"
                  >
                    + Add Channel
                  </button>
                </div>
                <select
                  id="ticket-select-channel"
                  required
                  className={fieldClass}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {meta.channels.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <span className="font-semibold" id="page-sla-target-hours">
                    Estimated SLA: {slaHours} Hours
                  </span>
                  <span className="text-emerald-800" id="page-sla-target-text">
                    {formatSlaPreview(slaHours)}
                  </span>
                </div>
              </div>

              <div className="md:col-span-2">
                <span className={labelClass}>Tags & Labels</span>
                <div
                  id="ticket-tag-container"
                  className="mb-2 flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5"
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        onClick={() => setTags((current) => current.filter((entry) => entry !== tag))}
                        className="cursor-pointer border-0 bg-transparent p-0 text-zinc-500"
                      >
                        <CloseIcon sx={{ fontSize: 12 }} />
                      </button>
                    </span>
                  ))}
                  <input
                    id="ticket-tag-input"
                    className="min-w-[140px] flex-1 border-0 bg-transparent text-sm outline-none"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKeyDown}
                    onBlur={() => {
                      if (tagInput.trim()) addTag(tagInput);
                    }}
                    placeholder="Type tag & Enter"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TICKET_QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="tag-quick-btn h-7 cursor-pointer rounded-full border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-600 hover:border-zinc-400"
                      onClick={() => addTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div data-tour="tickets-create-actions" className="flex justify-end gap-3 pb-6">
            <Link
              to="/tickets"
              className="inline-flex h-10 items-center rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 no-underline"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <AddIcon sx={{ fontSize: 18 }} />
              {saving ? 'Creating…' : 'Create Support Ticket'}
            </button>
          </div>
        </form>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-base font-bold text-zinc-950">{modalTitle}</h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="cursor-pointer border-0 bg-transparent text-zinc-500"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form onSubmit={submitModal} className="flex flex-col gap-3">
              <label>
                <span className={labelClass}>
                  {modal === 'priority' ? 'Priority Name *' : 'Name *'}
                </span>
                <input
                  required
                  autoFocus
                  className={fieldClass}
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder={
                    modal === 'group'
                      ? 'e.g. DevOps'
                      : modal === 'type'
                        ? 'e.g. Security Vulnerability'
                        : modal === 'priority'
                          ? 'e.g. Critical Blocker'
                          : 'e.g. Discord'
                  }
                />
              </label>
              {modal === 'priority' && (
                <label>
                  <span className={labelClass}>Target SLA Hours *</span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={720}
                    className={fieldClass}
                    value={modalSla}
                    onChange={(e) => setModalSla(Number(e.target.value))}
                  />
                </label>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 cursor-pointer rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
