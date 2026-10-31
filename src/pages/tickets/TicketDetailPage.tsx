import { displayLabel, displayUserLabel } from '../../utils/displayLabels';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { DocumentUploadControl } from '../../components/common/DocumentUploadControl';
import type { AssignableUser } from '../../types/leads';
import {
  ESCALATION_LEVELS,
  TICKET_STATUSES,
  evaluateSla,
  slaToneClass,
  type TicketItem,
} from '../../types/tickets';

type DetailTab = 'conversation' | 'timeline' | 'watchers';
type ModalKind = 'resolve' | 'reassign' | 'escalate' | null;

const fieldClass =
  'h-10 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500';
const labelClass = 'mb-1.5 block text-xs font-semibold text-zinc-700';

function priorityBadgeClass(priority: string): string {
  const map: Record<string, string> = {
    Urgent: 'bg-red-50 text-red-800 border-red-200',
    High: 'bg-amber-50 text-amber-800 border-amber-200',
    Medium: 'bg-sky-50 text-sky-800 border-sky-200',
    Low: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  };
  return map[priority] || 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    Open: 'bg-sky-50 text-sky-800 border-sky-200',
    'In Progress': 'bg-amber-50 text-amber-800 border-amber-200',
    'Pending Client': 'bg-orange-50 text-orange-800 border-orange-200',
    Resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Closed: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function userLabel(user: AssignableUser): string {
  return user.name || user.displayName || user.username || user.email || user.id;
}

function userId(user: AssignableUser): string {
  return user.id || user._id || user.userId || '';
}

export const TicketDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { isClient, canAssignTickets, hasPermission } = useAuth();
  const { showProjects } = useActiveExtension();
  const canManageStatus = hasPermission('crm.tickets.write') && !isClient;
  const canResolve = hasPermission('crm.tickets.resolve') && !isClient;

  const [ticket, setTicket] = useState<TicketItem | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DetailTab>('conversation');
  const [tick, setTick] = useState(0);

  const [replyType, setReplyType] = useState<'public' | 'internal'>('public');
  const [replyMessage, setReplyMessage] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const [modal, setModal] = useState<ModalKind>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [csat, setCsat] = useState(5);
  const [reassignTo, setReassignTo] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [escalateLevel, setEscalateLevel] = useState('Level 2');
  const [escalateTo, setEscalateTo] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [watcherToAdd, setWatcherToAdd] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [ticketResponse, usersResponse] = await Promise.all([
        crmApi.getTicket(id),
        crmApi.getAssignableUsers().catch(() => ({ data: [] as AssignableUser[] })),
      ]);
      setTicket(ticketResponse.data);
      setUsers((usersResponse.data || []).filter((entry) => !entry.isClient && !entry.isClientUser));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load ticket');
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<{ tab?: DetailTab }>).detail?.tab;
      if (next === 'conversation' || next === 'timeline' || next === 'watchers') {
        setTab(next);
      }
    };
    window.addEventListener('crm-tickets-tour-tab', onTab as EventListener);
    return () => window.removeEventListener('crm-tickets-tour-tab', onTab as EventListener);
  }, []);

  const sla = useMemo(() => {
    void tick;
    return ticket ? evaluateSla(ticket) : null;
  }, [ticket, tick]);

  const assignableForWatchers = useMemo(() => {
    if (!ticket) return users;
    const existing = new Set(ticket.watchers || []);
    return users.filter((user) => !existing.has(userId(user)));
  }, [users, ticket]);

  const isAssigned = Boolean(ticket?.assignedTo);

  const applyTicket = (next: TicketItem) => setTicket(next);

  const changeStatus = async (status: string) => {
    if (!ticket || ticket.status === status) return;
    if (!canManageStatus) return;
    if (['Resolved', 'Closed'].includes(status) && !canResolve) {
      setError('You do not have permission to resolve or close tickets.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await crmApi.updateTicketStatus(ticket._id, { status });
      applyTicket(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticket) return;
    if (!replyMessage.trim()) return setError('Enter a message.');
    setSaving(true);
    setError('');
    try {
      const response = await crmApi.addTicketReply(ticket._id, {
        message: replyMessage.trim(),
        isInternal: !isClient && replyType === 'internal',
        attachmentUrl: attachmentUrl.trim() || undefined,
      });
      setTicket((current) =>
        current
          ? {
              ...current,
              messages: [...(current.messages || []), response.data],
              status:
                current.status === 'Open' && replyType === 'public'
                  ? 'In Progress'
                  : current.status === 'Pending Client' && replyType === 'public'
                    ? 'In Progress'
                    : current.status,
            }
          : current
      );
      setReplyMessage('');
      setAttachmentUrl('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to send reply');
    } finally {
      setSaving(false);
    }
  };

  const submitResolve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticket) return;
    if (!resolveNotes.trim()) return setError('Resolution notes are required.');
    setSaving(true);
    setError('');
    try {
      const response = await crmApi.resolveTicket(ticket._id, {
        resolutionNotes: resolveNotes.trim(),
        satisfactionRating: Number(csat),
      });
      applyTicket(response.data);
      setModal(null);
      setResolveNotes('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to resolve ticket');
    } finally {
      setSaving(false);
    }
  };

  const submitReassign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticket) return;
    if (!reassignTo) return setError('Select a target agent.');
    if (isAssigned && !reassignReason.trim()) {
      return setError('Handoff reason is required when reassigning.');
    }
    const agent = users.find((user) => userId(user) === reassignTo);
    setSaving(true);
    setError('');
    try {
      const response = await crmApi.reassignTicket(ticket._id, {
        assignedTo: reassignTo,
        assignedToName: agent ? userLabel(agent) : reassignTo,
        reason: reassignReason.trim() || undefined,
      });
      applyTicket(response.data);
      setModal(null);
      setReassignTo('');
      setReassignReason('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to reassign ticket');
    } finally {
      setSaving(false);
    }
  };

  const submitEscalate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticket) return;
    if (!escalateReason.trim()) return setError('Escalation reason is required.');
    const agent = users.find((user) => userId(user) === escalateTo);
    setSaving(true);
    setError('');
    try {
      const response = await crmApi.escalateTicket(ticket._id, {
        level: escalateLevel,
        assignedTo: escalateTo || undefined,
        assignedToName: agent ? userLabel(agent) : undefined,
        reason: escalateReason.trim(),
      });
      applyTicket(response.data);
      setModal(null);
      setEscalateReason('');
      setEscalateTo('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to escalate ticket');
    } finally {
      setSaving(false);
    }
  };

  const addWatcher = async () => {
    if (!ticket || !watcherToAdd) return;
    const agent = users.find((user) => userId(user) === watcherToAdd);
    setSaving(true);
    setError('');
    try {
      const response = await crmApi.addTicketWatcher(ticket._id, {
        userId: watcherToAdd,
        userName: agent ? userLabel(agent) : watcherToAdd,
      });
      applyTicket(response.data);
      setWatcherToAdd('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to add watcher');
    } finally {
      setSaving(false);
    }
  };

  const removeWatcher = async (watcherId: string) => {
    if (!ticket) return;
    setSaving(true);
    setError('');
    try {
      const response = await crmApi.removeTicketWatcher(ticket._id, { userId: watcherId });
      applyTicket(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to remove watcher');
    } finally {
      setSaving(false);
    }
  };

  const archiveOrRestore = async () => {
    if (!ticket) return;
    setSaving(true);
    setError('');
    try {
      const response = ticket.isArchived
        ? await crmApi.restoreTicket(ticket._id)
        : await crmApi.archiveTicket(ticket._id);
      applyTicket(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Archive action failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-zinc-500">Loading ticket…</div>;
  }

  if (!ticket) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error || 'Ticket not found.'}
      </div>
    );
  }

  const timeline = [...(ticket.reassignmentHistory || [])].sort(
    (a, b) => new Date(a.reassignedAt).getTime() - new Date(b.reassignedAt).getTime()
  );

  const watcherEntries = (ticket.watchers || []).map((watcherId, index) => {
    const matched = users.find((user) => userId(user) === watcherId);
    return {
      id: watcherId,
      name: ticket.watcherNames?.[index] || (matched ? userLabel(matched) : watcherId),
    };
  });

  const completed = ticket.status === 'Resolved' || ticket.status === 'Closed';

  return (
    <div data-tour="tickets-detail" className="flex flex-col gap-5">
      <Link
        to="/tickets"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 no-underline hover:text-zinc-950"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to Tickets
      </Link>

      <header data-tour="tickets-detail-header" className="mb-5 border-b border-zinc-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-zinc-500">{ticket.ticketNumber}</div>
            <h1 className="mt-1 mb-0 text-2xl font-bold text-zinc-950">{ticket.subject}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(String(ticket.status))}`}
              >
                {ticket.status}
              </span>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityBadgeClass(ticket.priority)}`}
              >
                {ticket.priority}
              </span>
              {ticket.escalationLevel && ticket.escalationLevel !== 'Standard' && (
                <span className="tkt-escalation-chip rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                  Escalated · {ticket.escalationLevel}
                </span>
              )}
              {sla && (
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${slaToneClass(sla.tone)}`}
                >
                  SLA · {sla.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <main className="min-w-0 space-y-4">
          <div data-tour="tickets-detail-tabs" className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
            {(
              [
                { id: 'conversation', label: 'Conversation' },
                { id: 'timeline', label: 'Timeline' },
                ...(!isClient ? [{ id: 'watchers', label: 'Watchers' } as const] : []),
              ] as Array<{ id: DetailTab; label: string }>
            ).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`h-8 cursor-pointer rounded-md border-0 px-3 text-xs font-semibold ${
                  tab === entry.id ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === 'conversation' && (
            <section data-tour="tickets-detail-conversation" className="rounded-xl border border-zinc-300 bg-white p-5">
              <h2 className="mt-0 mb-4 text-base font-bold text-zinc-950">Conversation</h2>
              {(ticket.messages || []).length === 0 ? (
                <p className="text-sm text-zinc-500">No replies yet.</p>
              ) : (
                <div className="mb-5 space-y-3">
                  {(ticket.messages || []).map((message) => (
                    <article
                      key={message._id}
                      className={`rounded-lg border p-3 ${
                        message.isInternal
                          ? 'tkt-message is-internal border-amber-200 bg-amber-50'
                          : 'border-zinc-200 bg-zinc-50'
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
                        <span>{message.senderName || message.senderRole || 'Support'}</span>
                        <span>·</span>
                        <span>{formatDateTime(message.createdAt)}</span>
                        {message.isInternal && (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
                            Internal note
                          </span>
                        )}
                      </div>
                      <p className="mb-0 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
                        {message.message}
                      </p>
                      {(message.attachments || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.attachments?.map((file, index) => (
                            <a
                              key={`${file.url}-${index}`}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-zinc-700 underline"
                            >
                              {file.name || 'Attachment'}
                            </a>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              <form id="form-detail-page-reply" onSubmit={sendReply} className="border-t border-zinc-100 pt-4">
                {!isClient && (
                  <div className="mb-3 flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                      <input
                        type="radio"
                        name="replyType"
                        checked={replyType === 'public'}
                        onChange={() => setReplyType('public')}
                      />
                      Public Reply
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                      <input
                        type="radio"
                        name="replyType"
                        checked={replyType === 'internal'}
                        onChange={() => setReplyType('internal')}
                      />
                      Internal Note
                    </label>
                  </div>
                )}
                <textarea
                  id="reply-message-detail"
                  required
                  rows={4}
                  maxLength={5000}
                  className={`${fieldClass} h-auto py-2`}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder={replyType === 'internal' ? 'Write an internal note…' : 'Write a public reply…'}
                />
                <DocumentUploadControl
                  className="mt-2"
                  folder="tickets"
                  entityId={id || 'shared'}
                  mode="button"
                  buttonLabel="Choose attachment"
                  uploadButtonLabel="Upload document"
                  currentUrl={attachmentUrl || null}
                  onUploaded={(res) => setAttachmentUrl(res.url || res.fileUrl || '')}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    id="btn-submit-detail-reply"
                    type="submit"
                    disabled={saving}
                    className="h-9 cursor-pointer rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {tab === 'timeline' && (
            <section className="rounded-xl border border-zinc-300 bg-white p-5">
              <h2 className="mt-0 mb-4 text-base font-bold text-zinc-950">Reassignment Timeline</h2>
              {timeline.length === 0 ? (
                <p className="text-sm text-zinc-500">No reassignment history yet.</p>
              ) : (
                <ol className="m-0 space-y-3 p-0 list-none">
                  {timeline.map((entry, index) => (
                    <li
                      key={`${entry.reassignedAt}-${index}`}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
                    >
                      <div className="font-semibold text-zinc-900">
                        {displayUserLabel(entry.fromUser, undefined, 'Unassigned')} →{' '}
                        {displayUserLabel(entry.toUserName, entry.toUser)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        By {displayUserLabel(entry.reallocatedBy, undefined, 'System')} ·{' '}
                        {formatDateTime(entry.reassignedAt)}
                      </div>
                      {entry.reason && (
                        <p className="mb-0 mt-2 text-sm text-zinc-700">{entry.reason}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {tab === 'watchers' && !isClient && (
            <section className="rounded-xl border border-zinc-300 bg-white p-5">
              <h2 className="mt-0 mb-4 text-base font-bold text-zinc-950">Watchers</h2>
              {watcherEntries.length === 0 ? (
                <p className="text-sm text-zinc-500">No watchers subscribed.</p>
              ) : (
                <ul className="m-0 mb-4 space-y-2 p-0 list-none">
                  {watcherEntries.map((watcher) => (
                    <li
                      key={watcher.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-zinc-800">{watcher.name}</span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => removeWatcher(watcher.id)}
                        className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <select
                  className={`${fieldClass} max-w-xs`}
                  value={watcherToAdd}
                  onChange={(e) => setWatcherToAdd(e.target.value)}
                >
                  <option value="">Select user…</option>
                  {assignableForWatchers.map((user) => (
                    <option key={userId(user)} value={userId(user)}>
                      {userLabel(user)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={saving || !watcherToAdd}
                  onClick={addWatcher}
                  className="h-10 cursor-pointer rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add Watcher
                </button>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="mt-0 mb-2 text-base font-bold text-zinc-950">Description</h2>
            <p className="mb-0 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{ticket.description}</p>
            {ticket.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ticket.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {ticket.resolutionNotes && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <div className="font-semibold">Resolution</div>
                <p className="mb-0 mt-1 whitespace-pre-wrap">{ticket.resolutionNotes}</p>
                {ticket.satisfactionRating != null && (
                  <div className="mt-2 text-xs font-semibold">CSAT: {ticket.satisfactionRating}/5</div>
                )}
              </div>
            )}
          </section>
        </main>

        <aside data-tour="tickets-detail-sidebar" className="space-y-4">
          <section className="rounded-xl border border-zinc-300 bg-white p-4 text-sm">
            <h2 className="mt-0 mb-3 text-base font-bold text-zinc-950">Ticket details</h2>
            <dl className="m-0 space-y-3">
              <div>
                <dt className="text-xs text-zinc-500">Requester</dt>
                <dd className="m-0 mt-1 font-semibold text-zinc-800">
                  {ticket.requesterName || ticket.contactPerson || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Assigned agent</dt>
                <dd className="m-0 mt-1 font-semibold text-zinc-800">
                  {displayUserLabel(ticket.assignedToName, ticket.assignedTo, 'Unassigned')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Assign group</dt>
                <dd className="m-0 mt-1 text-zinc-700">{ticket.assignGroup}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Type</dt>
                <dd className="m-0 mt-1 text-zinc-700">{ticket.type}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Channel</dt>
                <dd className="m-0 mt-1 text-zinc-700">{ticket.channelName}</dd>
              </div>
              {showProjects && (
                <div>
                  <dt className="text-xs text-zinc-500">Project</dt>
                  <dd className="m-0 mt-1 text-zinc-700">{displayLabel(ticket.projectName)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-500">Created</dt>
                <dd className="m-0 mt-1 text-zinc-700">{formatDateTime(ticket.createdAt)}</dd>
              </div>
            </dl>
          </section>

          {canManageStatus && (
            <section className="rounded-xl border border-zinc-300 bg-white p-4">
              <h2 className="mt-0 mb-3 text-base font-bold text-zinc-950">Actions</h2>
              <label className="mb-3 block">
                <span className={labelClass}>Status</span>
                <select
                  className={fieldClass}
                  value={ticket.status}
                  disabled={saving}
                  onChange={(e) => changeStatus(e.target.value)}
                >
                  {TICKET_STATUSES.filter(
                    (status) =>
                      !['Resolved', 'Closed'].includes(status) ||
                      canResolve ||
                      ticket.status === status
                  ).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-2">
                {canAssignTickets && (
                  <button
                    id="btn-sidebar-assign"
                    type="button"
                    disabled={saving || completed}
                    onClick={() => {
                      setReassignTo(ticket.assignedTo || '');
                      setReassignReason('');
                      setModal('reassign');
                    }}
                    className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    {isAssigned ? 'Reassign' : 'Assign Agent'}
                  </button>
                )}
                <button
                  id="btn-action-escalate"
                  type="button"
                  disabled={saving || completed}
                  onClick={() => {
                    setEscalateLevel('Level 2');
                    setEscalateTo('');
                    setEscalateReason('');
                    setModal('escalate');
                  }}
                  className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 disabled:opacity-50"
                >
                  Escalate
                </button>
                {canResolve && ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                  <button
                    id="btn-action-resolve"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setResolveNotes('');
                      setCsat(5);
                      setModal('resolve');
                    }}
                    className="h-9 cursor-pointer rounded-lg border-0 bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Mark Resolved
                  </button>
                )}
                {canResolve && ticket.status === 'Resolved' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => changeStatus('Closed')}
                    className="h-9 cursor-pointer rounded-lg border-0 bg-zinc-900 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Close Ticket
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={archiveOrRestore}
                  className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 disabled:opacity-50"
                >
                  {ticket.isArchived ? 'Restore' : 'Archive'}
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>

      {modal === 'resolve' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-base font-bold text-zinc-950">Resolve Ticket</h3>
              <button type="button" onClick={() => setModal(null)} className="cursor-pointer border-0 bg-transparent">
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form id="form-resolve-ticket" onSubmit={submitResolve} className="flex flex-col gap-3">
              <input type="hidden" id="resolve-ticket-id" value={ticket._id} />
              <label>
                <span className={labelClass}>Resolution Notes *</span>
                <textarea
                  id="resolve-input-notes"
                  required
                  rows={4}
                  className={`${fieldClass} h-auto py-2`}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                />
              </label>
              <label>
                <span className={labelClass}>CSAT Rating *</span>
                <select
                  id="resolve-input-rating"
                  required
                  className={fieldClass}
                  value={csat}
                  onChange={(e) => setCsat(Number(e.target.value))}
                >
                  <option value={5}>5 — Very Satisfied</option>
                  <option value={4}>4 — Satisfied</option>
                  <option value={3}>3 — Neutral</option>
                  <option value={2}>2 — Unsatisfied</option>
                  <option value={1}>1 — Very Unsatisfied</option>
                </select>
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 cursor-pointer rounded-lg border-0 bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Mark Resolved
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'reassign' && canAssignTickets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-base font-bold text-zinc-950">
                {isAssigned ? 'Reassign Ticket' : 'Assign Agent'}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="cursor-pointer border-0 bg-transparent">
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form id="form-reassign-ticket" onSubmit={submitReassign} className="flex flex-col gap-3">
              <input type="hidden" id="reassign-ticket-id" value={ticket._id} />
              <label>
                <span className={labelClass}>Target Agent *</span>
                <select
                  id="reassign-select-agent"
                  required
                  className={fieldClass}
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                >
                  <option value="">Select agent</option>
                  {users.map((user) => (
                    <option key={userId(user)} value={userId(user)}>
                      {userLabel(user)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>
                  Handoff Reason {isAssigned ? '*' : '(optional)'}
                </span>
                <textarea
                  id="reassign-input-reason"
                  required={isAssigned}
                  rows={3}
                  className={`${fieldClass} h-auto py-2`}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 cursor-pointer rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'escalate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-base font-bold text-zinc-950">Escalate Ticket</h3>
              <button type="button" onClick={() => setModal(null)} className="cursor-pointer border-0 bg-transparent">
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form id="form-escalate-ticket" onSubmit={submitEscalate} className="flex flex-col gap-3">
              <input type="hidden" id="escalate-ticket-id" value={ticket._id} />
              <label>
                <span className={labelClass}>Escalation Level *</span>
                <select
                  id="escalate-select-level"
                  required
                  className={fieldClass}
                  value={escalateLevel}
                  onChange={(e) => setEscalateLevel(e.target.value)}
                >
                  {ESCALATION_LEVELS.filter((level) => level !== 'Standard').map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Escalate To (optional)</span>
                <select
                  id="escalate-select-agent"
                  className={fieldClass}
                  value={escalateTo}
                  onChange={(e) => setEscalateTo(e.target.value)}
                >
                  <option value="">Auto-route / keep current</option>
                  {users.map((user) => (
                    <option key={userId(user)} value={userId(user)}>
                      {userLabel(user)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Escalation Reason *</span>
                <textarea
                  id="escalate-input-reason"
                  required
                  rows={3}
                  className={`${fieldClass} h-auto py-2`}
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                />
              </label>
              <p className="m-0 text-xs text-zinc-500">
                Escalation promotes priority to Urgent (4h SLA).
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 cursor-pointer rounded-lg border-0 bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Confirm Escalation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
