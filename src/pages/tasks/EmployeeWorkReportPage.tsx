import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { crmApi } from '../../services/api';
import type { EmployeeWorkReport } from '../../types/workReports';
import { triggerFileDownload } from '../../utils/fileDownload';
import { useNotifyMessage } from '@/components/notifications';
import { formatClock, formatDay, formatHours, formatSpan, localIsoDate, plural } from '../../components/tasks/workReportFormat';

type Period = 'day' | 'month';

const btnSecondary =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50';
const th = 'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500';
const td = 'px-4 py-3 align-top text-sm text-zinc-800';

const APPROVAL_STYLE: Record<string, string> = {
  Approved: 'bg-emerald-50 text-emerald-700',
  Pending: 'bg-amber-50 text-amber-800',
  Draft: 'bg-zinc-100 text-zinc-600',
  Rejected: 'bg-red-50 text-red-700',
};

function shiftDay(iso: string, by: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return localIsoDate(new Date(y, m - 1, d + by));
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * One employee's work report (from Tasks → Reports): daily or monthly, with every task they logged
 * time on, how many entries and hours, each time-log entry, and a PDF / Word download.
 */
export const EmployeeWorkReportPage: React.FC = () => {
  const { userId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = localIsoDate(new Date());
  const period: Period = searchParams.get('period') === 'month' ? 'month' : 'day';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') || '') ? String(searchParams.get('date')) : today;
  const month = /^\d{4}-\d{2}$/.test(searchParams.get('month') || '') ? String(searchParams.get('month')) : date.slice(0, 7);

  const [report, setReport] = useState<EmployeeWorkReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useNotifyMessage(error, 'error', () => setError(''));
  const [downloading, setDownloading] = useState<'' | 'pdf' | 'docx'>('');
  const [downloadError, setDownloadError] = useState('');
  useNotifyMessage(downloadError, 'error', () => setDownloadError(''));

  const query = useMemo(() => (period === 'month' ? { period, month } : { period, date }), [period, month, date]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await crmApi.getEmployeeWorkReport(userId, query);
      setReport(res.data || null);
    } catch (reason) {
      setReport(null);
      setError(reason instanceof Error ? reason.message : 'The report could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [userId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => params.set(k, v));
    setSearchParams(params, { replace: true });
  };

  const download = async (format: 'pdf' | 'docx') => {
    setDownloading(format);
    setDownloadError('');
    try {
      const file = await crmApi.downloadEmployeeWorkReport(userId, { ...query, format });
      triggerFileDownload({ filename: file.filename, content: file.blob, mimeType: file.blob.type });
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : 'The download failed');
    } finally {
      setDownloading('');
    }
  };

  const summary = report?.summary;
  const maxDayHours = Math.max(1, ...(report?.days || []).map((d) => d.hours));
  const atLatest = period === 'month' ? month >= today.slice(0, 7) : date >= today;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link
            to="/tasks?view=reports"
            onClick={() => {
              try {
                sessionStorage.setItem('crm-tasks-view', 'reports');
              } catch {
                /* ignore */
              }
            }}
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-900"
          >
            <ArrowBackIcon sx={{ fontSize: 14 }} /> Tasks · Reports
          </Link>
          <h1 className="m-0 truncate text-2xl font-bold text-zinc-950">{report?.employee.name || 'Employee report'}</h1>
          <p className="m-0 mt-1 text-sm text-zinc-500">
            {period === 'month' ? 'Monthly' : 'Daily'} work report{report ? ` · ${report.label}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnSecondary} disabled={!report || Boolean(downloading)} onClick={() => void download('pdf')}>
            <PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />
            {downloading === 'pdf' ? 'Preparing…' : 'Download PDF'}
          </button>
          <button type="button" className={btnSecondary} disabled={!report || Boolean(downloading)} onClick={() => void download('docx')}>
            <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />
            {downloading === 'docx' ? 'Preparing…' : 'Download Word'}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5" role="tablist" aria-label="Report period">
          {(['day', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => update({ period: p })}
              className={`inline-flex h-8 cursor-pointer items-center rounded-md border-0 px-3 text-xs font-semibold ${
                period === p ? 'bg-zinc-950 text-white' : 'bg-transparent text-zinc-600'
              }`}
            >
              {p === 'day' ? 'Daily' : 'Monthly'}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            aria-label={period === 'month' ? 'Previous month' : 'Previous day'}
            onClick={() => (period === 'month' ? update({ month: shiftMonth(month, -1) }) : update({ date: shiftDay(date, -1) }))}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </button>
          {period === 'month' ? (
            <input
              type="month"
              aria-label="Month"
              value={month}
              max={today.slice(0, 7)}
              onChange={(e) => e.target.value && update({ month: e.target.value })}
              className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
            />
          ) : (
            <input
              type="date"
              aria-label="Day"
              value={date}
              max={today}
              onChange={(e) => e.target.value && update({ date: e.target.value })}
              className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
            />
          )}
          <button
            type="button"
            aria-label={period === 'month' ? 'Next month' : 'Next day'}
            disabled={atLatest}
            onClick={() => (period === 'month' ? update({ month: shiftMonth(month, 1) }) : update({ date: shiftDay(date, 1) }))}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
        {summary?.running && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> A timer is running
          </span>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500 animate-pulse">
          Loading report…
        </div>
      ) : report && summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total hours', value: formatHours(summary.hours), note: `${formatHours(summary.billableHours)} billable` },
              {
                label: 'Approved',
                value: formatHours(summary.approvedHours),
                note: `${formatHours(summary.pendingHours)} pending · ${formatHours(summary.rejectedHours)} rejected`,
              },
              { label: 'Time-log entries', value: String(summary.entries), note: `${plural(summary.tasks, 'task')} · ${plural(summary.projects, 'project')}` },
              period === 'month'
                ? { label: 'Days worked', value: String(summary.daysWorked), note: `${formatHours(summary.averageHoursPerDay)} per day worked` }
                : { label: 'Tasks worked on', value: String(summary.tasks), note: `${plural(report.assignedOpenTasks.length, 'open task')} assigned` },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{card.label}</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-zinc-950">{card.value}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{card.note}</div>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
            <h2 className="m-0 border-b border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-950">Tasks worked on</h2>
            {report.tasks.length === 0 ? (
              <p className="m-0 p-6 text-center text-sm text-zinc-500">
                No time logged {period === 'month' ? 'this month' : 'on this day'}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className={th}>Task</th>
                      <th className={th}>Status</th>
                      <th className={`${th} text-right`}>Entries</th>
                      <th className={`${th} text-right`}>Hours</th>
                      <th className={`${th} text-right`}>Approved</th>
                      <th className={th}>{period === 'month' ? 'Days' : 'First in – last out'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.tasks.map((t) => (
                      <tr key={t.taskId || t.title} className="border-b border-zinc-100 last:border-b-0">
                        <td className={td}>
                          {t.taskId ? (
                            <Link to={`/tasks/${encodeURIComponent(t.taskId)}`} className="font-semibold text-zinc-950 no-underline hover:underline">
                              {t.title}
                            </Link>
                          ) : (
                            <span className="font-semibold">{t.title}</span>
                          )}
                          {t.projectName && <span className="block text-xs text-zinc-500">{t.projectName}</span>}
                        </td>
                        <td className={td}>
                          {t.status || '—'}
                          {t.running && <span className="block text-xs font-semibold text-emerald-700">Timer running</span>}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{t.entries}</td>
                        <td className={`${td} text-right font-semibold tabular-nums`}>{formatHours(t.hours)}</td>
                        <td className={`${td} text-right tabular-nums`}>
                          {formatHours(t.approvedHours)}
                          {t.pendingHours > 0 && <span className="block text-xs text-amber-700">{formatHours(t.pendingHours)} pending</span>}
                        </td>
                        <td className={`${td} tabular-nums`}>
                          {period === 'month' ? t.daysWorked : formatSpan(t.firstStart, t.lastEnd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {period === 'month' && (
            <section className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
              <h2 className="m-0 border-b border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-950">Day by day</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className={th}>Day</th>
                      <th className={`${th} w-[40%]`}>Hours</th>
                      <th className={`${th} text-right`}>Entries</th>
                      <th className={`${th} text-right`}>Tasks</th>
                      <th className={th}>First in – last out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* The days still to come are left out. */}
                    {report.days.filter((d) => d.date <= today).map((d) => (
                      <tr
                        key={d.date}
                        className={`border-b border-zinc-100 last:border-b-0 ${d.entries ? 'cursor-pointer hover:bg-zinc-50' : ''}`}
                        onClick={() => d.entries && update({ period: 'day', date: d.date })}
                        title={d.entries ? 'Open this day' : undefined}
                      >
                        <td className={`${td} ${d.entries ? 'font-semibold' : 'text-zinc-400'}`}>{formatDay(d.date)}</td>
                        <td className={td}>
                          {d.entries ? (
                            <span className="flex items-center gap-2">
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                                <span className="block h-full rounded-full bg-zinc-900" style={{ width: `${(d.hours / maxDayHours) * 100}%` }} />
                              </span>
                              <span className="w-16 text-right tabular-nums">{formatHours(d.hours)}</span>
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{d.entries || ''}</td>
                        <td className={`${td} text-right tabular-nums`}>{d.tasks || ''}</td>
                        <td className={`${td} tabular-nums`}>{d.entries ? formatSpan(d.firstStart, d.lastEnd) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
            <h2 className="m-0 border-b border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-950">
              Time log <span className="font-normal text-zinc-500">· {report.logs.length} entries</span>
            </h2>
            {report.logs.length === 0 ? (
              <p className="m-0 p-6 text-center text-sm text-zinc-500">No entries.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      {period === 'month' && <th className={th}>Day</th>}
                      <th className={th}>Task</th>
                      <th className={th}>In – out</th>
                      <th className={`${th} text-right`}>Hours</th>
                      <th className={th}>Approval</th>
                      <th className={th}>Work done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.logs.map((l) => (
                      <tr key={l._id} className="border-b border-zinc-100 last:border-b-0">
                        {period === 'month' && <td className={`${td} whitespace-nowrap`}>{formatDay(l.date)}</td>}
                        <td className={td}>
                          <span className="font-semibold">{l.taskTitle}</span>
                          {l.projectName && <span className="block text-xs text-zinc-500">{l.projectName}</span>}
                        </td>
                        <td className={`${td} whitespace-nowrap tabular-nums`}>
                          {l.status === 'Running' ? (
                            <span className="font-semibold text-emerald-700">{formatClock(l.checkInTime)} – running</span>
                          ) : l.checkInTime ? (
                            `${formatClock(l.checkInTime)} – ${formatClock(l.checkOutTime)}`
                          ) : (
                            <span className="text-zinc-500">Manual entry</span>
                          )}
                        </td>
                        <td className={`${td} text-right font-semibold tabular-nums`}>
                          {l.status === 'Running' ? '—' : formatHours(l.hours)}
                          {!l.isBillable && <span className="block text-[11px] font-normal text-zinc-500">Non-billable</span>}
                        </td>
                        <td className={td}>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${APPROVAL_STYLE[l.approvalStatus] || APPROVAL_STYLE.Draft}`}>
                            {l.approvalStatus}
                          </span>
                        </td>
                        <td className={`${td} max-w-[360px] whitespace-pre-line break-words text-zinc-700`}>{l.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {report.truncated && (
              <p className="m-0 border-t border-zinc-200 px-4 py-2 text-xs text-amber-800">
                Only the first 5,000 entries are shown. Choose a shorter period for the rest.
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
            <h2 className="m-0 border-b border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-950">
              Open tasks assigned <span className="font-normal text-zinc-500">· {report.assignedOpenTasks.length}</span>
            </h2>
            {report.assignedOpenTasks.length === 0 ? (
              <p className="m-0 p-6 text-center text-sm text-zinc-500">No open tasks assigned.</p>
            ) : (
              <ul className="m-0 list-none divide-y divide-zinc-100 p-0">
                {report.assignedOpenTasks.map((t) => (
                  <li key={t.taskId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <Link to={`/tasks/${encodeURIComponent(t.taskId)}`} className="min-w-0 basis-full font-semibold sm:basis-auto sm:flex-1 text-zinc-950 no-underline hover:underline">
                      {t.title}
                      {t.projectName && <span className="ml-2 font-normal text-zinc-500">{t.projectName}</span>}
                    </Link>
                    <span className="text-xs text-zinc-600">{t.status}</span>
                    <span className="text-xs text-zinc-600">{t.priority}</span>
                    <span className="text-xs text-zinc-600">
                      {t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : 'No due date'}
                    </span>
                    {t.workedInPeriod && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">Worked on</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="m-0 text-xs text-zinc-500">
            Times are shown in your time zone ({report.timeZone}). Every entry is counted; approved hours are totalled separately.
          </p>
        </>
      ) : null}
    </div>
  );
};

export default EmployeeWorkReportPage;
