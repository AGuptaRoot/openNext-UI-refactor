import React from 'react';
import { LeadItem, AssignableUser } from '../../types/leads';
import { displayUserLabel } from '../../utils/displayLabels';

interface LeadReportViewProps {
  leads: LeadItem[];
  pipelineStages: string[];
  assignableUsers: AssignableUser[];
}

export const LeadReportView: React.FC<LeadReportViewProps> = ({
  leads,
  pipelineStages,
  assignableUsers,
}) => {
  if (leads.length === 0) {
    return (
      <div className="bg-white border border-zinc-300 rounded-xl p-8 text-center text-sm text-zinc-500">
        No leads data available to generate report.
      </div>
    );
  }

  const converted = leads.filter((l) => l.convertedClientId).length;
  const won = leads.filter((l) => l.stage.toLowerCase().includes('won') && !l.convertedClientId).length;
  const lost = leads.filter((l) => l.stage.toLowerCase().includes('lost')).length;
  const active = leads.length - converted - lost;

  // Stages count
  const stages = pipelineStages.length > 0 ? pipelineStages : ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'];
  const stageCounts: Record<string, number> = {};
  for (const s of stages) stageCounts[s] = 0;
  for (const l of leads) {
    const s = l.stage || stages[0];
    stageCounts[s] = (stageCounts[s] || 0) + 1;
  }
  const maxStageCount = Math.max(...Object.values(stageCounts), 1);

  // Owner aggregation
  const byOwner: Record<string, { user: AssignableUser | null; count: number; name: string }> = {};
  for (const l of leads) {
    const ownerKey = l.assignedTo || l.assignedUsername || 'unassigned';
    if (!byOwner[ownerKey]) {
      const u = assignableUsers.find(
        (usr) => usr.id === ownerKey || usr.username === ownerKey
      ) || null;
      const name = displayUserLabel(
        u || l.assignedToName,
        ownerKey === 'unassigned' ? undefined : ownerKey,
        ownerKey === 'unassigned' ? 'Unassigned' : 'Team member'
      );
      byOwner[ownerKey] = { user: u, count: 0, name };
    }
    byOwner[ownerKey].count += 1;
  }
  const ownerRows = Object.values(byOwner).sort((a, b) => b.count - a.count);
  const maxOwnerCount = Math.max(...ownerRows.map((o) => o.count), 1);

  // Source aggregation
  const bySource: Record<string, number> = {};
  for (const l of leads) {
    const src = l.source || 'Other';
    bySource[src] = (bySource[src] || 0) + 1;
  }
  const sourceRows = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
  const maxSourceCount = Math.max(...sourceRows.map((s) => s[1]), 1);

  return (
    <div data-tour="leads-report-root" className="flex flex-col gap-5">
      {/* 5-Column Scorecards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div data-tour="leads-kpi-total" className="bg-white border border-zinc-300 rounded-xl p-4">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
            Total Leads
          </span>
          <span className="text-2xl font-bold text-zinc-950 block">{leads.length}</span>
          <span className="text-[11px] text-zinc-500 mt-1 block">In database</span>
        </div>

        <div data-tour="leads-kpi-active" className="bg-white border border-zinc-300 rounded-xl p-4">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
            Active Pipeline
          </span>
          <span className="text-2xl font-bold text-zinc-950 block">{active}</span>
          <span className="text-[11px] text-zinc-500 mt-1 block">In progress</span>
        </div>

        <div data-tour="leads-kpi-won" className="bg-white border border-zinc-300 rounded-xl p-4">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
            Won Deals
          </span>
          <span className="text-2xl font-bold text-zinc-950 block">{won}</span>
          <span className="text-[11px] text-zinc-500 mt-1 block">Closed successfully</span>
        </div>

        <div data-tour="leads-kpi-converted" className="bg-white border border-zinc-300 rounded-xl p-4">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
            Converted
          </span>
          <span className="text-2xl font-bold text-zinc-950 block">{converted}</span>
          <span className="text-[11px] text-zinc-500 mt-1 block">Promoted to Clients</span>
        </div>

        <div data-tour="leads-kpi-lost" className="bg-white border border-zinc-300 rounded-xl p-4">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
            Lost Deals
          </span>
          <span className="text-2xl font-bold text-zinc-950 block">{lost}</span>
          <span className="text-[11px] text-zinc-500 mt-1 block">Disqualified or lost</span>
        </div>
      </div>

      {/* Pipeline by Stage Card */}
      <div data-tour="leads-chart-stage" className="bg-white border border-zinc-300 rounded-xl p-5">
        <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-100">
          Pipeline Breakdown by Stage
        </h3>
        <div className="flex flex-col gap-3">
          {stages.map((stage) => {
            const count = stageCounts[stage] || 0;
            const pct = Math.round((count / maxStageCount) * 100);
            const totalPct = Math.round((count / (leads.length || 1)) * 100);

            return (
              <div key={stage} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">{stage}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{totalPct}%</span>
                    <span className="font-mono font-bold text-zinc-950">{count}</span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-Column Grid: Leads by Owner & Top Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Leads by Owner */}
        <div data-tour="leads-chart-owner" className="bg-white border border-zinc-300 rounded-xl p-5">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-100">
            Leads by Representative
          </h3>
          <div className="flex flex-col gap-3">
            {ownerRows.map(({ user, name, count }) => {
              const pct = Math.round((count / maxOwnerCount) * 100);
              const sharePct = Math.round((count / leads.length) * 100);
              const initials =
                user?.initials ||
                name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() ||
                '?';

              return (
                <div
                  key={name}
                  className="p-3 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center gap-3"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: user?.bgColor || '#09090b' }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-bold text-zinc-900 truncate">
                          {name}
                        </span>
                        {user?.designation && (
                          <span className="text-[10px] text-zinc-500 bg-white border border-zinc-200 px-1.5 py-0.5 rounded">
                            {user.designation}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-zinc-950">
                        {count} <span className="text-[10px] text-zinc-500">({sharePct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                      <div
                        className="h-full bg-zinc-950 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Sources */}
        <div data-tour="leads-chart-source" className="bg-white border border-zinc-300 rounded-xl p-5">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-100">
            Top Acquisition Sources
          </h3>
          <div className="flex flex-col gap-3">
            {sourceRows.map(([srcName, count]) => {
              const pct = Math.round((count / maxSourceCount) * 100);
              const sharePct = Math.round((count / leads.length) * 100);

              return (
                <div key={srcName} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-900">{srcName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">{sharePct}%</span>
                      <span className="font-mono font-bold text-zinc-950">{count}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden">
                    <div
                      className="h-full bg-zinc-950 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
