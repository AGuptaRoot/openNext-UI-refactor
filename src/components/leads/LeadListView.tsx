import React from 'react';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { LeadItem, AssignableUser, LeadPaginationMeta } from '../../types/leads';
import { isLeadConvertibleStage } from '../../utils/leadPipeline';
import { displayUserLabel } from '../../utils/displayLabels';
import { getLeadStatusChipClass } from '../../utils/leadStatusStyle';

interface LeadListViewProps {
  leads: LeadItem[];
  pipelineStages: string[];
  assignableUsers: AssignableUser[];
  selectedLeadIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onBulkAssign: (assignedTo: string) => Promise<void>;
  onBulkChangeStage: (stage: string) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onViewLead: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onConvertLead: (lead: LeadItem) => void;
  pagination: LeadPaginationMeta | null;
  onPageChange: (page: number) => void;
  currentSortField: string | null;
  currentSortAsc: boolean;
  onSort: (field: string) => void;
  canWrite?: boolean;
  canDelete?: boolean;
  canConvert?: boolean;
  /** When false (sales representative), bulk assign only offers self via assignableUsers. */
  canAssignOthers?: boolean;
}

export const LeadListView: React.FC<LeadListViewProps> = ({
  leads,
  pipelineStages,
  assignableUsers,
  selectedLeadIds,
  onToggleSelect,
  onToggleSelectAll,
  onClearSelection,
  onBulkAssign,
  onBulkChangeStage,
  onBulkDelete,
  onViewLead,
  onDeleteLead,
  onConvertLead,
  pagination,
  onPageChange,
  currentSortField,
  currentSortAsc,
  onSort,
  canWrite = false,
  canDelete = false,
  canConvert = false,
  canAssignOthers = true,
}) => {
  const [bulkAssignUser, setBulkAssignUser] = React.useState('');
  const [bulkStage, setBulkStage] = React.useState('');
  const [bulkWorking, setBulkWorking] = React.useState(false);

  React.useEffect(() => {
    if (!canAssignOthers && assignableUsers[0]?.id) {
      setBulkAssignUser(assignableUsers[0].id);
    }
  }, [canAssignOthers, assignableUsers]);

  const allSelected = leads.length > 0 && leads.every((l) => selectedLeadIds.has(l._id));
  const firstNewLeadId = React.useMemo(() => {
    const hit = leads.find((l) => String(l.stage || '').trim().toLowerCase() === 'new');
    return hit?._id || null;
  }, [leads]);

  const handleApplyBulkAssign = async () => {
    if (!bulkAssignUser) return;
    setBulkWorking(true);
    try {
      await onBulkAssign(bulkAssignUser);
      setBulkAssignUser('');
    } finally {
      setBulkWorking(false);
    }
  };

  const handleApplyBulkStage = async () => {
    if (!bulkStage) return;
    setBulkWorking(true);
    try {
      await onBulkChangeStage(bulkStage);
      setBulkStage('');
    } finally {
      setBulkWorking(false);
    }
  };

  const getStageBadgeStyle = (stage: string) => {
    const s = stage.toLowerCase();
    if (s.includes('won')) return 'bg-zinc-950 text-white border-zinc-950';
    if (s.includes('lost') || s.includes('disqualified')) return 'bg-zinc-100 text-zinc-600 border-zinc-300';
    if (s.includes('proposal')) return 'bg-zinc-100 text-zinc-900 border-zinc-300 font-semibold';
    if (s.includes('qualified')) return 'bg-zinc-900 text-white border-zinc-900';
    if (s.includes('contacted')) return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    return 'bg-zinc-50 text-zinc-700 border-zinc-200';
  };

  const getAgeingBadge = (lead: LeadItem) => {
    const ageing = lead.ageing;
    if (!ageing) return null;
    const days = ageing.stageAgeDays;
    const status = ageing.status;

    let style = 'bg-zinc-100 text-zinc-700 border-zinc-200';
    let icon = '🌱';

    if (status === 'Stale' || days > 14) {
      style = 'bg-zinc-100 text-zinc-950 font-bold border-zinc-400';
      icon = '🔴';
    } else if (status === 'Attention' || days > 7) {
      style = 'bg-zinc-100 text-zinc-800 border-zinc-300';
      icon = '⚠️';
    } else if (status === 'Active' || days > 3) {
      style = 'bg-zinc-50 text-zinc-700 border-zinc-200';
      icon = '🕒';
    }

    return (
      <span
        className={`inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded border ${style}`}
        title={`Stage Age: ${days} days · Total Age: ${ageing.totalAgeDays} days`}
      >
        <span>{icon}</span>
        <span>{days}d in stage</span>
      </span>
    );
  };

  const getMatchBadge = (lead: LeadItem) => {
    const raw = lead.commercialRequirement?.score;
    const score = raw == null || Number.isNaN(Number(raw)) ? null : Math.round(Number(raw));
    if (score == null) {
      return (
        <span
          className="inline-flex text-[11px] font-semibold text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded"
          title="Qualification match not scored yet"
        >
          —
        </span>
      );
    }
    let tone = 'bg-red-50 text-red-800 border-red-200';
    let label = 'Poor';
    if (score >= 80) {
      tone = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      label = 'Strong';
    } else if (score >= 55) {
      tone = 'bg-amber-50 text-amber-800 border-amber-200';
      label = 'Partial';
    } else if (score >= 30) {
      tone = 'bg-orange-50 text-orange-800 border-orange-200';
      label = 'Weak';
    }
    return (
      <span
        className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded border ${tone}`}
        title={`Qualification match: ${score}% (${label})`}
      >
        {score}%
      </span>
    );
  };

  const getFollowUpBadge = (lead: LeadItem) => {
    const fu = lead.followUpSummary;
    if (!fu || fu.status === 'none' || !fu.openCount) return null;

    if (fu.hasOverdue || fu.status === 'overdue') {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-zinc-950 text-white border border-zinc-950"
          title={`${fu.overdueCount} overdue follow-up(s) by ${fu.overdueDays} day(s)`}
        >
          <span>🚨</span>
          <span>Overdue {fu.overdueDays}d</span>
        </span>
      );
    }
    if (fu.status === 'due_today') {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-900 border border-zinc-300"
          title={`Follow-up due today: ${fu.nextDueTitle || 'Follow-up'}`}
        >
          <span>🔔</span>
          <span>Due Today</span>
        </span>
      );
    }
    if (fu.nextDueDate) {
      const dateStr = new Date(fu.nextDueDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
      return (
        <span
          className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-600 border border-zinc-200"
          title={`Next follow-up: ${fu.nextDueTitle || ''}`}
        >
          <span>📅</span>
          <span>{dateStr}</span>
        </span>
      );
    }
    return null;
  };

  const renderSortIndicator = (field: string) => {
    if (currentSortField !== field) {
      return <SwapVertIcon sx={{ fontSize: 14 }} className="text-zinc-400" />;
    }
    return currentSortAsc ? (
      <ArrowUpwardIcon sx={{ fontSize: 13 }} className="text-zinc-950" />
    ) : (
      <ArrowDownwardIcon sx={{ fontSize: 13 }} className="text-zinc-950" />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Bulk Actions Bar */}
      {selectedLeadIds.size > 0 && (canWrite || canDelete) && (
        <div className="bg-zinc-50 border border-zinc-300 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-950">
              {selectedLeadIds.size} lead{selectedLeadIds.size === 1 ? '' : 's'} selected
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-zinc-500 hover:text-zinc-900 bg-white border border-zinc-200 hover:border-zinc-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Bulk Assign */}
            {canWrite && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-600">Assign:</span>
              <select
                value={bulkAssignUser}
                onChange={(e) => setBulkAssignUser(e.target.value)}
                disabled={!canAssignOthers && assignableUsers.length <= 1}
                className="text-xs border border-zinc-300 rounded-md px-2 py-1 bg-white text-zinc-900 outline-none disabled:bg-zinc-50 disabled:text-zinc-600"
                title={
                  canAssignOthers
                    ? undefined
                    : 'Sales representatives can only assign leads to themselves'
                }
              >
                {canAssignOthers ? <option value="">Select Agent…</option> : null}
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {canAssignOthers ? u.displayName || u.name : 'You (current user)'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!bulkAssignUser || bulkWorking}
                onClick={handleApplyBulkAssign}
                className="text-xs font-semibold bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50 px-2.5 py-1 rounded border border-zinc-950 cursor-pointer transition-colors"
              >
                Apply
              </button>
            </div>
            )}

            {/* Bulk Stage */}
            {canWrite && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-600">Move Stage:</span>
              <select
                value={bulkStage}
                onChange={(e) => setBulkStage(e.target.value)}
                className="text-xs border border-zinc-300 rounded-md px-2 py-1 bg-white text-zinc-900 outline-none"
              >
                <option value="">Select Stage…</option>
                {pipelineStages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!bulkStage || bulkWorking}
                onClick={handleApplyBulkStage}
                className="text-xs font-semibold bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50 px-2.5 py-1 rounded border border-zinc-950 cursor-pointer transition-colors"
              >
                Apply
              </button>
            </div>
            )}

            {/* Bulk Delete */}
            {canDelete && (
            <button
              type="button"
              disabled={bulkWorking}
              onClick={onBulkDelete}
              className="text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 px-2.5 py-1 rounded bg-white cursor-pointer transition-colors"
            >
              Delete Selected
            </button>
            )}
          </div>
        </div>
      )}

      {/* Leads Table Wrapper */}
      <div data-tour="leads-table" className="bg-white border border-zinc-300 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
              <th className="w-10 px-3 py-3 text-center">
                {(canWrite || canDelete) ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    className="rounded border-zinc-300 text-zinc-950 cursor-pointer"
                    aria-label="Select all leads"
                  />
                ) : null}
              </th>
              <th
                data-tour="leads-col-name"
                onClick={() => onSort('name')}
                className="px-4 py-3 cursor-pointer hover:text-zinc-950 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Lead Name</span>
                  {renderSortIndicator('name')}
                </div>
              </th>
              <th
                data-tour="leads-col-company"
                onClick={() => onSort('company')}
                className="px-4 py-3 cursor-pointer hover:text-zinc-950 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Company</span>
                  {renderSortIndicator('company')}
                </div>
              </th>
              <th
                data-tour="leads-col-contact"
                onClick={() => onSort('email')}
                className="px-4 py-3 cursor-pointer hover:text-zinc-950 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Contact</span>
                  {renderSortIndicator('email')}
                </div>
              </th>
              <th
                data-tour="leads-col-stage"
                onClick={() => onSort('stage')}
                className="px-4 py-3 cursor-pointer hover:text-zinc-950 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Stage</span>
                  {renderSortIndicator('stage')}
                </div>
              </th>
              <th
                data-tour="leads-col-match"
                onClick={() => onSort('match')}
                className="px-4 py-3 cursor-pointer hover:text-zinc-950 transition-colors select-none"
                title="Qualification match %"
              >
                <div className="flex items-center gap-1">
                  <span>Match %</span>
                  {renderSortIndicator('match')}
                </div>
              </th>
              <th
                data-tour="leads-col-owner"
                onClick={() => onSort('rep')}
                className="px-4 py-3 cursor-pointer hover:text-zinc-950 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Assigned Rep</span>
                  {renderSortIndicator('rep')}
                </div>
              </th>
              <th data-tour="leads-col-actions" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-xs text-zinc-900">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-zinc-500 text-sm">
                  No leads found matching current criteria.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedLeadIds.has(lead._id);
                const leadTitle = lead.title?.trim() || '';
                const leadName = leadTitle || lead.name || 'Unnamed Lead';
                const initial = (leadName.charAt(0) || 'L').toUpperCase();
                const repUser = assignableUsers.find(
                  (u) => u.id === lead.assignedTo || u.username === lead.assignedUsername
                );
                const repName = displayUserLabel(
                  repUser || lead.assignedToName,
                  lead.assignedUsername || lead.assignedTo,
                  'Unassigned'
                );
                const repInitials =
                  repUser?.initials ||
                  repName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() ||
                  '?';

                return (
                  <tr
                    key={lead._id}
                    data-lead-id={lead._id}
                    {...(lead._id === firstNewLeadId
                      ? { 'data-tour': 'leads-row-new' }
                      : {})}
                    className={`hover:bg-zinc-50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-zinc-50/80' : ''
                    }`}
                    onClick={() => onViewLead(lead)}
                  >
                    {/* Checkbox */}
                    <td
                      className="w-10 px-3 py-3 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canWrite || canDelete) onToggleSelect(lead._id);
                      }}
                    >
                      {(canWrite || canDelete) ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-zinc-300 text-zinc-950 cursor-pointer"
                          aria-label={`Select lead ${leadName}`}
                        />
                      ) : null}
                    </td>

                    {/* Name + Badges */}
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-zinc-950 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                          {lead.photoUrl || lead.avatarUrl ? (
                            <img
                              src={lead.photoUrl || lead.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (sibling) sibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span
                            className="w-full h-full items-center justify-center"
                            style={{ display: lead.photoUrl || lead.avatarUrl ? 'none' : 'flex' }}
                          >
                            {initial}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewLead(lead);
                            }}
                            className="text-xs font-semibold text-zinc-950 hover:underline text-left truncate p-0 bg-transparent border-none cursor-pointer"
                          >
                            {leadName}
                          </button>
                          {leadTitle && lead.name && (
                            <span className="text-[11px] text-zinc-500 truncate">{lead.name}</span>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {lead.status && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getLeadStatusChipClass(
                                  lead.status
                                )}`}
                              >
                                {lead.status}
                              </span>
                            )}
                            {lead.source && (
                              <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                                {lead.source}
                              </span>
                            )}
                            {getFollowUpBadge(lead)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900 truncate">
                          {lead.company || '—'}
                        </span>
                        {lead.jobTitle && (
                          <span className="text-[11px] text-zinc-500 truncate">
                            {lead.jobTitle}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-zinc-900 truncate">{lead.email || '—'}</span>
                        {lead.phone && (
                          <span className="text-zinc-500 flex items-center gap-1 truncate">
                            <span>📞</span>
                            <span>{lead.phone}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stage & Ageing */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded border ${getStageBadgeStyle(
                            lead.stage
                          )}`}
                        >
                          {lead.stage}
                        </span>
                        {getAgeingBadge(lead)}
                      </div>
                    </td>

                    {/* Match % */}
                    <td className="px-4 py-3">{getMatchBadge(lead)}</td>

                    {/* Assigned Rep */}
                    <td className="px-4 py-3">
                      {lead.assignedTo ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: repUser?.bgColor || '#09090b' }}
                          >
                            {repInitials}
                          </div>
                          <span className="text-xs font-medium text-zinc-900 truncate max-w-[120px]">
                            {repName}
                          </span>
                        </div>
                      ) : (
                        <span
                          className="inline-flex text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded"
                          title="This lead is not assigned"
                        >
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewLead(lead)}
                          title="View lead profile"
                          className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 cursor-pointer transition-colors"
                        >
                          <VisibilityOutlinedIcon sx={{ fontSize: 14 }} />
                        </button>
                        {!lead.convertedClientId && canConvert && isLeadConvertibleStage(lead.stage, pipelineStages) && (
                          <button
                            type="button"
                            onClick={() => onConvertLead(lead)}
                            title="Convert to client"
                            className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-950 hover:text-white text-zinc-700 cursor-pointer transition-colors"
                          >
                            <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDeleteLead(lead)}
                            title="Delete lead"
                            className="p-1 rounded border border-zinc-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-400 cursor-pointer transition-colors"
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div data-tour="leads-pagination">
        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between px-2 py-1 text-xs text-zinc-600">
            <div>
              Showing{' '}
              <strong className="text-zinc-950">
                {(pagination.page - 1) * pagination.limit + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-zinc-950">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of <strong className="text-zinc-950">{pagination.total}</strong> leads
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => onPageChange(pagination.page - 1)}
                className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 cursor-pointer transition-colors"
              >
                <ChevronLeftIcon sx={{ fontSize: 16 }} />
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                    p === pagination.page
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => onPageChange(pagination.page + 1)}
                className="p-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 cursor-pointer transition-colors"
              >
                <ChevronRightIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
          </div>
        ) : (
          <p className="m-0 px-2 py-1 text-[11px] text-zinc-400">
            All matching leads fit on this page.
          </p>
        )}
      </div>
    </div>
  );
};
