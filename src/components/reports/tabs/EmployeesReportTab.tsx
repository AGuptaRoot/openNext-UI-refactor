import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { EmployeesReportData } from '../../../types/reports';
import {
  MetricCard,
  MetricGrid,
  ChartCard,
  ReportEmptyState,
  formatDate,
} from '../ReportCharts';

export interface EmployeesReportTabProps {
  data: EmployeesReportData;
}

export const EmployeesReportTab: React.FC<EmployeesReportTabProps> = ({ data }) => {
  const employees = data.employees || [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const totals = useMemo(() => {
    const totalTasks = data.totalTasks ?? employees.reduce((s, e) => s + e.totalTasks, 0);
    const completedTasks =
      data.completedTasks ?? employees.reduce((s, e) => s + e.completedTasks, 0);
    const avgProgress =
      data.avgProgress ??
      (employees.filter((e) => e.totalTasks > 0).length
        ? Math.round(
            employees.filter((e) => e.totalTasks > 0).reduce((s, e) => s + e.progress, 0) /
              employees.filter((e) => e.totalTasks > 0).length
          )
        : 0);
    return {
      totalEmployees: data.totalEmployees ?? employees.length,
      totalTasks,
      completedTasks,
      avgProgress,
    };
  }, [data, employees]);

  const toggle = (userId: string) => {
    setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  if (!employees.length) {
    return (
      <div data-tour="report-tab-employees">
        <ReportEmptyState
          message={data.message || 'No employee task progress to show yet.'}
        />
      </div>
    );
  }

  return (
    <div data-tour="report-tab-employees" className="flex flex-col gap-5">
      <div data-tour="report-employees-kpis">
        <MetricGrid>
          <MetricCard
            label="Employees"
            value={totals.totalEmployees}
            icon={<Users className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
            hint="Team"
            sub="Assignable staff"
            to="/tasks"
          />
          <MetricCard
            label="Assigned Tasks"
            value={totals.totalTasks}
            icon={<ClipboardList className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
            hint="Workload"
            sub="Across team"
            to="/tasks?due=open"
          />
          <MetricCard
            label="Completed"
            value={totals.completedTasks}
            icon={<CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
            hint="Done"
            sub={`${totals.totalTasks > 0 ? Math.round((totals.completedTasks / totals.totalTasks) * 100) : 0}% of assigned`}
            to="/tasks?status=Completed"
          />
          <MetricCard
            label="Avg Progress"
            value={`${totals.avgProgress}%`}
            icon={<TrendingUp className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
            hint="Delivery"
            sub="Per employee with work"
            to="/tasks?due=open"
          />
        </MetricGrid>
      </div>

      <ChartCard
        tourId="report-employees-list"
        title="Employee task progress"
        subtitle="Expand a row to see incomplete assigned tasks. Click a task to open it."
      >
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="w-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500" />
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Employee
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Role
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Tasks
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 min-w-[160px]">
                  Progress
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 text-right">
                  Incomplete
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const isOpen = Boolean(expanded[emp.userId]);
                const canExpand = emp.incompleteTasks > 0;
                return (
                  <React.Fragment key={emp.userId}>
                    <tr className="border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors">
                      <td className="px-2 py-3 align-middle">
                        <button
                          type="button"
                          data-tour={
                            canExpand ? 'report-employees-expand' : undefined
                          }
                          disabled={!canExpand}
                          onClick={() => canExpand && toggle(emp.userId)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent ${
                            canExpand
                              ? 'cursor-pointer text-zinc-700 hover:bg-zinc-100'
                              : 'cursor-default text-zinc-300'
                          }`}
                          aria-expanded={isOpen}
                          title={
                            canExpand
                              ? isOpen
                                ? 'Hide incomplete tasks'
                                : 'Show incomplete tasks'
                              : 'No incomplete tasks'
                          }
                        >
                          {isOpen ? (
                            <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
                          ) : (
                            <KeyboardArrowRightIcon sx={{ fontSize: 20 }} />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <Link
                          to={`/tasks?assignedTo=${encodeURIComponent(emp.userId)}&due=open`}
                          className="flex items-center gap-2.5 min-w-0 no-underline text-inherit hover:opacity-90"
                          title={`Open tasks assigned to ${emp.name}`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-bold text-white">
                            {(emp.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-950 underline-offset-2 group-hover:underline">
                              {emp.name}
                            </div>
                            {emp.email && (
                              <div className="truncate text-[11px] text-zinc-500">{emp.email}</div>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                          {emp.role || 'Team member'}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle text-sm font-medium text-zinc-800">
                        <span className="font-semibold text-zinc-950">{emp.completedTasks}</span>
                        <span className="text-zinc-400"> / {emp.totalTasks}</span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                emp.progress >= 100
                                  ? 'bg-emerald-500'
                                  : emp.progress >= 50
                                    ? 'bg-zinc-800'
                                    : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, emp.progress))}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs font-semibold text-zinc-800">
                            {emp.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle text-right">
                        {emp.incompleteTasks > 0 ? (
                          <Link
                            to={`/tasks?assignedTo=${encodeURIComponent(emp.userId)}&due=open`}
                            className="inline-flex min-w-[1.75rem] justify-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 no-underline"
                            title="Open incomplete tasks"
                          >
                            {emp.incompleteTasks}
                          </Link>
                        ) : (
                          <span className="inline-flex min-w-[1.75rem] justify-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                            {emp.incompleteTasks}
                          </span>
                        )}
                      </td>
                    </tr>

                    {isOpen && canExpand && (
                      <tr className="border-b border-zinc-100 bg-zinc-50/60">
                        <td colSpan={6} className="px-3 py-3">
                          <div
                            data-tour="report-employees-incomplete"
                            className="ml-8 flex flex-col gap-1.5"
                          >
                            <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                              Incomplete tasks ({emp.incompleteTaskList.length})
                            </p>
                            {emp.incompleteTaskList.map((task) => (
                              <Link
                                key={task.id}
                                to={`/tasks/${task.id}`}
                                className="group flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 no-underline transition-colors hover:border-zinc-400 hover:bg-white"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-sm font-semibold text-zinc-950 group-hover:underline">
                                      {task.title}
                                    </span>
                                    <OpenInNewIcon
                                      sx={{ fontSize: 13 }}
                                      className="shrink-0 text-zinc-400 opacity-0 group-hover:opacity-100"
                                    />
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                                    {task.projectName && (
                                      <span className="font-medium text-zinc-600">
                                        {task.projectName}
                                      </span>
                                    )}
                                    <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-semibold text-zinc-700">
                                      {task.status}
                                    </span>
                                    {task.priority && (
                                      <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-medium">
                                        {task.priority}
                                      </span>
                                    )}
                                    {task.dueDate && (
                                      <span
                                        className={
                                          task.isOverdue
                                            ? 'font-semibold text-red-600'
                                            : 'text-zinc-500'
                                        }
                                      >
                                        Due {formatDate(task.dueDate)}
                                        {task.isOverdue ? ' · Overdue' : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
};
