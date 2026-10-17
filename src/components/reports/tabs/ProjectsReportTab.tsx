import React from 'react';
import { CheckCircle2, ClipboardList, FolderKanban, Siren } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectsReportData, ReportRolePermissions } from '../../../types/reports';
import {
  MetricCard,
  MetricGrid,
  ChartCard,
  DonutChart,
  VerticalBarChart,
  HorizontalBar,
  formatDate,
  ReportEmptyState,
} from '../ReportCharts';
import { displayUserLabel } from '../../../utils/displayLabels';

export interface ProjectsReportTabProps {
  data: ProjectsReportData;
  perms: ReportRolePermissions;
}

export const ProjectsReportTab: React.FC<ProjectsReportTabProps> = ({ data, perms }) => {
  const byStatus = data.byStatus || [];
  const projects = data.projects || [];
  const overdueTasks = data.overdueTasks || [];
  const hoursByAssignee = data.hoursByAssignee || [];

  const totalTasks = projects.reduce(
    (acc, p) => acc + (Number(p.totalTasks ?? p.tasksTotal) || 0),
    0
  );
  const completedTasks = projects.reduce(
    (acc, p) => acc + (Number(p.completedTasks ?? p.tasksCompleted) || 0),
    0
  );
  const statusMax = Math.max(...byStatus.map((s) => s.count), 1);

  if (!projects.length && !byStatus.length && !overdueTasks.length) {
    return (
      <div data-tour="report-tab-projects">
        <ReportEmptyState
          message={data.message || 'No projects or deliverables found for this date range.'}
        />
      </div>
    );
  }

  return (
    <div data-tour="report-tab-projects" className="flex flex-col gap-5">
      <div data-tour="report-projects-kpis">
      <MetricGrid>
        <MetricCard
          label="Total Projects"
          value={projects.length}
          icon={<FolderKanban className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Portfolio"
          sub="Active & completed"
          to="/projects"
        />
        <MetricCard
          label="Deliverables"
          value={totalTasks}
          icon={<ClipboardList className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Tasks"
          sub="Across projects"
          to="/tasks"
        />
        <MetricCard
          label="Completed"
          value={completedTasks}
          icon={<CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Delivery"
          sub={`${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% complete`}
          to="/tasks?status=Completed"
        />
        <MetricCard
          label="Overdue Tasks"
          value={overdueTasks.length}
          icon={<Siren className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
          hint="Attention"
          sub="Past due date"
          to="/tasks?due=overdue"
        />
      </MetricGrid>
      </div>

      <div data-tour="report-projects-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {byStatus.length > 0 && (
          <ChartCard tourId="report-projects-by-status" title="Projects by status" subtitle="Click a status to open filtered projects">
            <DonutChart
              items={byStatus.map((s) => ({ label: s.status, value: s.count }))}
              title="Project status"
            />
            <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-1">
              {byStatus.map((s, i) => (
                <HorizontalBar
                  key={i}
                  label={s.status}
                  value={s.count}
                  max={statusMax}
                  to={`/projects?status=${encodeURIComponent(s.status)}`}
                />
              ))}
            </div>
          </ChartCard>
        )}

        {perms.canTime && hoursByAssignee.length > 0 && (
          <ChartCard tourId="report-projects-hours" title="Labor hours by team member" subtitle="Click a member to open their time logs">
            <VerticalBarChart
              items={hoursByAssignee.map((h) => ({
                label: String(h.name || 'Team member'),
                value: Number(h.hours) || 0,
              }))}
              title="Team logged hours"
            />
            <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-1">
              {hoursByAssignee.map((h, i) => {
                const max = Math.max(...hoursByAssignee.map((x) => Number(x.hours) || 0), 1);
                return (
                  <HorizontalBar
                    key={i}
                    label={String(h.name || 'Team member')}
                    value={Number(h.hours) || 0}
                    max={max}
                    to={
                      h.userId
                        ? `/time-logs?userId=${encodeURIComponent(h.userId)}`
                        : '/time-logs'
                    }
                  />
                );
              })}
            </div>
          </ChartCard>
        )}
      </div>

      {overdueTasks.length > 0 && (
        <ChartCard tourId="report-projects-overdue" title="Overdue deliverables" subtitle="Immediate attention required">
          <div className="border border-red-200 bg-red-50/20 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-red-50/60 border-b border-red-200 text-red-900 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Task Title</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3 text-right">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {overdueTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-red-50/40">
                    <td className="py-2.5 px-3 font-semibold text-zinc-950">
                      <a
                        href={`#/tasks/${t.id}`}
                        className="text-zinc-950 no-underline hover:underline"
                      >
                        {t.title}
                      </a>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600">
                      <a
                        href={`#/projects/${t.projectId}`}
                        className="text-zinc-600 no-underline hover:underline"
                      >
                        {t.projectName}
                      </a>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600">
                      {displayUserLabel(t.assignedToName, t.assignedTo, 'Unassigned')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-red-700">
                      {formatDate(t.dueDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {projects.length > 0 && (
        <ChartCard tourId="report-projects-portfolio" title="Project portfolio progress" subtitle="Deliverable completion tracking">
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Tasks</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Progress</th>
                  {perms.canTime && <th className="py-2.5 px-3 text-right">Hours</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {projects.map((p) => {
                  const tasksTotal = Number(p.totalTasks ?? p.tasksTotal) || 0;
                  const tasksDone = Number(p.completedTasks ?? p.tasksCompleted) || 0;
                  const pct =
                    Number(
                      p.progress ??
                        p.completionPct ??
                        (tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0)
                    ) || 0;
                  const hours = p.loggedHours ?? p.hoursLogged;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50">
                      <td className="py-2.5 px-3 font-semibold text-zinc-950">
                        {p.id ? (
                          <Link
                            to={`/projects/${encodeURIComponent(p.id)}`}
                            className="text-zinc-950 no-underline hover:underline"
                            title="Open project"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600">{p.clientName || '—'}</td>
                      <td className="py-2.5 px-3">
                        <Link
                          to={`/projects?status=${encodeURIComponent(p.status)}`}
                          className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-zinc-800 no-underline hover:underline"
                        >
                          {p.status}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-700">
                        {p.id ? (
                          <Link
                            to={`/tasks?projectId=${encodeURIComponent(p.id)}`}
                            className="text-zinc-700 no-underline hover:underline"
                            title="Open project tasks"
                          >
                            {tasksDone}/{tasksTotal}
                          </Link>
                        ) : (
                          `${tasksDone}/${tasksTotal}`
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200">
                            <div
                              className="bg-zinc-950 h-full rounded-full"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10.5px] font-bold text-zinc-700 w-8 text-right">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      {perms.canTime && (
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                          {hours !== undefined ? `${hours}h` : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
};
