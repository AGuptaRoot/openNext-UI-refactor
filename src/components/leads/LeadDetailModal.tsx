import React, { useState } from 'react';
import { useDialog } from '../../context/DialogContext';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';

import { LeadItem, AssignableUser, LeadEvent, LeadFollowUp } from '../../types/leads';
import { isLeadConvertibleStage, resolveWonStage } from '../../utils/leadPipeline';
import { displayUserLabel } from '../../utils/displayLabels';

interface LeadDetailModalProps {
  open: boolean;
  lead: LeadItem | null;
  onClose: () => void;
  onStageChange: (leadId: string, newStage: string) => Promise<void>;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  onConvert: (lead: LeadItem) => Promise<void>;
  onDelete: (lead: LeadItem) => Promise<void>;
  pipelineStages: string[];
  leadStatuses: string[];
  assignableUsers: AssignableUser[];
  canWrite?: boolean;
  canDelete?: boolean;
  canConvert?: boolean;
}

type TabKey = 'details' | 'qualification' | 'activities' | 'followups';

function formatMoney(amount: number | undefined, currency = 'INR'): string {
  const num = Number(amount || 0);
  return `${currency} ${num.toLocaleString('en-IN')}`;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  open,
  lead,
  onClose,
  onStageChange,
  onStatusChange,
  onConvert,
  onDelete,
  pipelineStages,
  leadStatuses,
  assignableUsers,
  canWrite = false,
  canDelete = false,
  canConvert = false,
}) => {
  const { confirm } = useDialog();
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [stageUpdating, setStageUpdating] = useState(false);
  const [converting, setConverting] = useState(false);

  // Activities state (local mock list initialized with sample entries)
  const [activities, setActivities] = useState<LeadEvent[]>([
    {
      _id: 'act_1',
      leadId: lead?._id || '',
      type: 'Meeting',
      title: 'Initial Discovery & Architecture Discussion',
      description: 'Discussed cloud migration timelines and security compliance requirements.',
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      completed: true,
      createdBy: 'Priya Patel',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      _id: 'act_2',
      leadId: lead?._id || '',
      type: 'Call',
      title: 'Budget and Commercial Scope Sync',
      description: 'Reviewed preliminary quotation breakdown with CTO.',
      date: new Date(Date.now() - 86400000 * 5).toISOString(),
      completed: true,
      createdBy: 'Rajesh Sharma',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ]);
  const [newActType, setNewActType] = useState<LeadEvent['type']>('Call');
  const [newActTitle, setNewActTitle] = useState('');
  const [newActDesc, setNewActDesc] = useState('');

  // Follow-ups state
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([
    {
      _id: 'fu_1',
      leadId: lead?._id || '',
      title: 'Send updated commercial quotation and SOW draft',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      status: 'open',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [newFuTitle, setNewFuTitle] = useState('');
  const [newFuDueDate, setNewFuDueDate] = useState('');

  if (!lead) return null;

  const repUser = assignableUsers.find(
    (u) => u.id === lead.assignedTo || u.username === lead.assignedUsername
  );
  const repName = displayUserLabel(
    repUser || lead.assignedToName,
    lead.assignedUsername || lead.assignedTo,
    'Unassigned'
  );

  const handleStageSelect = async (newStage: string) => {
    setStageUpdating(true);
    try {
      await onStageChange(lead._id, newStage);
    } finally {
      setStageUpdating(false);
    }
  };

  const handleStatusSelect = async (newStatus: string) => {
    setStageUpdating(true);
    try {
      await onStatusChange(lead._id, newStatus);
    } finally {
      setStageUpdating(false);
    }
  };

  const handleConvertClick = async () => {
    if (!lead) return;
    if (!isLeadConvertibleStage(lead.stage, pipelineStages)) {
      await confirm({
        message: `Move this lead to "${resolveWonStage(pipelineStages)}" stage before converting.`,
        confirmLabel: 'OK',
        tone: 'default',
      });
      return;
    }
    if (!(await confirm({ message: `Convert "${lead.name}" to an active Client profile?` }))) return;
    setConverting(true);
    try {
      await onConvert(lead);
    } finally {
      setConverting(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!(await confirm({ message: `Are you sure you want to delete lead "${lead.name}"?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    await onDelete(lead);
    onClose();
  };

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActTitle.trim()) return;
    const newEntry: LeadEvent = {
      _id: `act_${Date.now()}`,
      leadId: lead._id,
      type: newActType,
      title: newActTitle.trim(),
      description: newActDesc.trim() || undefined,
      date: new Date().toISOString(),
      completed: true,
      createdBy: repName,
      createdAt: new Date().toISOString(),
    };
    setActivities([newEntry, ...activities]);
    setNewActTitle('');
    setNewActDesc('');
  };

  const handleAddFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFuTitle.trim() || !newFuDueDate) return;
    const newEntry: LeadFollowUp = {
      _id: `fu_${Date.now()}`,
      leadId: lead._id,
      title: newFuTitle.trim(),
      dueDate: newFuDueDate,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    setFollowUps([...followUps, newEntry]);
    setNewFuTitle('');
    setNewFuDueDate('');
  };

  const handleCompleteFollowUp = (id: string) => {
    setFollowUps(
      followUps.map((fu) => (fu._id === id ? { ...fu, status: 'completed' as const } : fu))
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        className: 'rounded-xl border border-zinc-300 bg-white p-0 shadow-none',
        style: { borderRadius: '12px', boxShadow: 'none' },
      }}
    >
      {/* Modal Top Header */}
      <div className="p-6 border-b border-zinc-200 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(lead.name.charAt(0) || 'L').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-950 m-0 leading-tight">
                  {lead.name}
                </h2>
                {lead.convertedClientId && (
                  <span className="text-xs bg-zinc-950 text-white px-2 py-0.5 rounded font-semibold">
                    ✓ Converted Client
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 m-0 mt-0.5 font-medium">
                {lead.jobTitle ? `${lead.jobTitle} • ` : ''}
                {lead.company}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Convert Button — only when lead is in Won stage */}
            {!lead.convertedClientId && canConvert && isLeadConvertibleStage(lead.stage, pipelineStages) && (
              <button
                type="button"
                onClick={handleConvertClick}
                disabled={converting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-xs font-semibold text-white border border-zinc-950 cursor-pointer transition-colors"
              >
                <CheckCircleOutlineIcon sx={{ fontSize: 15 }} />
                <span>{converting ? 'Converting…' : 'Convert to Client'}</span>
              </button>
            )}

            {/* Delete Button */}
            {canDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                title="Delete lead"
                className="p-1.5 rounded-lg border border-zinc-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 text-zinc-400 cursor-pointer transition-colors"
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </button>
            )}

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 cursor-pointer transition-colors"
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        {/* Quick Stage & Status Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-zinc-100">
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-500">Stage:</span>
              {canWrite ? (
              <select
                value={lead.stage}
                disabled={stageUpdating}
                onChange={(e) => handleStageSelect(e.target.value)}
                className="text-xs font-bold border border-zinc-300 rounded px-2 py-1 bg-white text-zinc-950 outline-none cursor-pointer"
              >
                {pipelineStages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              ) : (
                <span className="text-xs font-bold text-zinc-950">{lead.stage || '—'}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-500">Status:</span>
              {canWrite ? (
              <select
                value={lead.status}
                disabled={stageUpdating}
                onChange={(e) => handleStatusSelect(e.target.value)}
                className="text-xs border border-zinc-300 rounded px-2 py-1 bg-white text-zinc-900 outline-none cursor-pointer"
              >
                {leadStatuses.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              ) : (
                <span className="text-xs text-zinc-900">{lead.status || '—'}</span>
              )}
            </div>

            <div className="flex items-center gap-1 text-zinc-600">
              <span>Deal Value:</span>
              <strong className="font-mono text-zinc-950">
                {formatMoney(lead.value, lead.currency || 'INR')}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            {lead.ageing && (
              <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 font-medium">
                🕒 {lead.ageing.stageAgeDays}d in stage ({lead.ageing.totalAgeDays}d total)
              </span>
            )}
            {lead.dataQuality && (
              <span className="px-2 py-0.5 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                Quality: <strong>{lead.dataQuality.score}/100</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-200 bg-zinc-50 px-6 gap-1">
        {[
          { key: 'details', label: 'Overview & Details' },
          { key: 'qualification', label: 'BANT Qualification' },
          { key: 'activities', label: `Activities (${activities.length})` },
          { key: 'followups', label: `Follow-ups (${followUps.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors bg-transparent border-t-0 border-l-0 border-r-0 ${
              activeTab === tab.key
                ? 'border-zinc-950 text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels Body */}
      <div className="p-6 max-h-[60vh] overflow-y-auto">
        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 flex flex-col gap-2.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Contact Information
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <EmailOutlinedIcon sx={{ fontSize: 16 }} className="text-zinc-500" />
                  <span className="font-mono text-zinc-900">{lead.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <PhoneOutlinedIcon sx={{ fontSize: 16 }} className="text-zinc-500" />
                  <span className="font-mono text-zinc-900">{lead.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <BusinessOutlinedIcon sx={{ fontSize: 16 }} className="text-zinc-500" />
                  <span className="text-zinc-900">{lead.company}</span>
                </div>
                {lead.pan && (
                  <div className="text-xs text-zinc-600">
                    PAN: <span className="font-mono font-bold text-zinc-900">{lead.pan}</span>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 flex flex-col gap-2.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Pipeline & Ownership
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Source:</span>
                  <span className="font-semibold text-zinc-900">{lead.source || '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Assigned To:</span>
                  <span className="font-semibold text-zinc-900">{repName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Created Date:</span>
                  <span className="text-zinc-700">
                    {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Last Updated:</span>
                  <span className="text-zinc-700">
                    {lead.updatedAt
                      ? new Date(lead.updatedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {lead.tags && lead.tags.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                  Tags & Segments
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-800 font-medium"
                    >
                      🏷️ {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Address */}
            {lead.address && (
              <div>
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  Location Address
                </span>
                <p className="text-xs text-zinc-700 m-0 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
                  {lead.address}
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Internal Prospect Notes
              </span>
              <p className="text-xs text-zinc-700 m-0 p-3 rounded-lg border border-zinc-200 bg-zinc-50 whitespace-pre-wrap leading-relaxed">
                {lead.notes || 'No internal notes added yet.'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: QUALIFICATION (BANT) */}
        {activeTab === 'qualification' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-950 uppercase tracking-wider m-0">
                  BANT Qualification Score
                </h4>
                <p className="text-xs text-zinc-500 m-0 mt-0.5">
                  Budget, Authority, Need, and Timeline verification.
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded border ${
                  lead.qualification?.isQualified
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-white text-zinc-600 border-zinc-300'
                }`}
              >
                {lead.qualification?.isQualified ? '✓ Qualified Deal' : 'Unqualified'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg border border-zinc-300 bg-white">
                <span className="text-[11px] font-bold text-zinc-500 uppercase block mb-1">
                  💰 Budget
                </span>
                <span className="text-xs font-medium text-zinc-900 block">
                  {lead.qualification?.budget
                    ? formatMoney(Number(lead.qualification.budget))
                    : 'Budget not verified'}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-zinc-300 bg-white">
                <span className="text-[11px] font-bold text-zinc-500 uppercase block mb-1">
                  👑 Authority / Decision Maker
                </span>
                <span className="text-xs font-medium text-zinc-900 block">
                  {lead.qualification?.authority || 'Decision maker not identified'}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-zinc-300 bg-white">
                <span className="text-[11px] font-bold text-zinc-500 uppercase block mb-1">
                  🎯 Business Need
                </span>
                <span className="text-xs font-medium text-zinc-900 block">
                  {lead.qualification?.need || 'Scope not specified'}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-zinc-300 bg-white">
                <span className="text-[11px] font-bold text-zinc-500 uppercase block mb-1">
                  ⏳ Timeline
                </span>
                <span className="text-xs font-medium text-zinc-900 block">
                  {lead.qualification?.timeline || 'Timeline flexible'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACTIVITIES */}
        {activeTab === 'activities' && (
          <div className="flex flex-col gap-5">
            {/* Add Activity Form */}
            <form onSubmit={handleAddActivity} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
                  Log New Activity
                </span>
                <select
                  value={newActType}
                  onChange={(e) => setNewActType(e.target.value as LeadEvent['type'])}
                  className="text-xs border border-zinc-300 rounded px-2 py-1 bg-white text-zinc-900 outline-none"
                >
                  <option value="Call">📞 Call</option>
                  <option value="Meeting">🤝 Meeting</option>
                  <option value="Email">✉️ Email</option>
                  <option value="Note">📝 Note</option>
                </select>
              </div>

              <input
                type="text"
                required
                value={newActTitle}
                onChange={(e) => setNewActTitle(e.target.value)}
                placeholder="Activity summary (e.g. Call with CTO regarding compliance)"
                className="text-xs border border-zinc-300 rounded-lg p-2 bg-white text-zinc-900 outline-none"
              />

              <textarea
                rows={2}
                value={newActDesc}
                onChange={(e) => setNewActDesc(e.target.value)}
                placeholder="Details, key outcomes, next steps…"
                className="text-xs border border-zinc-300 rounded-lg p-2 bg-white text-zinc-900 outline-none"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                  <span>Log Activity</span>
                </button>
              </div>
            </form>

            {/* Activities List */}
            <div className="flex flex-col gap-2.5">
              {activities.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-6">
                  No activity logged yet.
                </div>
              ) : (
                activities.map((act) => (
                  <div
                    key={act._id}
                    className="p-3.5 rounded-lg border border-zinc-300 bg-white flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-800">
                          {act.type}
                        </span>
                        <strong className="text-xs text-zinc-950">{act.title}</strong>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(act.date || act.eventDate || Date.now()).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-xs text-zinc-600 m-0 mt-1 pl-1 leading-relaxed">
                        {act.description}
                      </p>
                    )}
                    {act.createdBy && (
                      <span className="text-[10px] text-zinc-400 mt-1">
                        By {act.createdBy}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: FOLLOW-UPS */}
        {activeTab === 'followups' && (
          <div className="flex flex-col gap-5">
            {/* Add Follow-up Form */}
            <form onSubmit={handleAddFollowUp} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col gap-3">
              <span className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
                Schedule New Follow-up
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={newFuTitle}
                    onChange={(e) => setNewFuTitle(e.target.value)}
                    placeholder="Task title (e.g. Call to finalize payment terms)"
                    className="w-full text-xs border border-zinc-300 rounded-lg p-2 bg-white text-zinc-900 outline-none"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    required
                    value={newFuDueDate}
                    onChange={(e) => setNewFuDueDate(e.target.value)}
                    className="w-full text-xs border border-zinc-300 rounded-lg p-2 bg-white text-zinc-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  <CalendarMonthOutlinedIcon sx={{ fontSize: 14 }} />
                  <span>Schedule Follow-up</span>
                </button>
              </div>
            </form>

            {/* Follow-ups List */}
            <div className="flex flex-col gap-2.5">
              {followUps.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-6">
                  No follow-ups scheduled.
                </div>
              ) : (
                followUps.map((fu) => {
                  const isCompleted = fu.status === 'completed';
                  return (
                    <div
                      key={fu._id}
                      className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
                        isCompleted
                          ? 'bg-zinc-50 border-zinc-200 opacity-60'
                          : 'bg-white border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          disabled={isCompleted}
                          onClick={() => handleCompleteFollowUp(fu._id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${
                            isCompleted
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-white border-zinc-300 hover:border-zinc-950 text-transparent hover:text-zinc-400'
                          }`}
                        >
                          <CheckIcon sx={{ fontSize: 13 }} />
                        </button>
                        <span
                          className={`text-xs font-medium text-zinc-900 ${
                            isCompleted ? 'line-through text-zinc-500' : ''
                          }`}
                        >
                          {fu.title}
                        </span>
                      </div>

                      <span className="text-xs font-mono font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                        📅 {fu.dueDate}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
