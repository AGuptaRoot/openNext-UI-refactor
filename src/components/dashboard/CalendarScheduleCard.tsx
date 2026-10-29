import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CloseIcon from '@mui/icons-material/Close';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { DashboardData } from '../../types/dashboard';
import {
  type CalendarEventRow,
  collectCalendarEvents,
  parseCalendarEventDate,
} from '../../utils/activityReminders';

interface CalendarScheduleCardProps {
  data: DashboardData;
  onNavigateUnmigrated?: (moduleName: string) => void;
}

type DayCell = {
  dayNum: number;
  isCurrentMonth: boolean;
  dateStr: string | null;
  isToday?: boolean;
  isSelected?: boolean;
  hasEvents?: boolean;
  evCount?: number;
};

function toYmd(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/**
 * Creation time, used to order the Upcoming Agenda newest-first. Falls back to
 * the event date when a source collection has no timestamps.
 */
function eventCreatedTime(event: CalendarEventRow): number {
  const raw = (event as { createdAt?: string }).createdAt;
  if (raw) {
    const parsed = new Date(String(raw));
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  const fallback = parseCalendarEventDate(event);
  return fallback ? fallback.getTime() : 0;
}

function formatShortDate(ymd: string): string {
  const parsed = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return ymd;
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function eventTimeLabel(event: CalendarEventRow): string {
  if (event.time) return String(event.time);
  const parsed = parseCalendarEventDate(event);
  if (!parsed) return 'All Day';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function collectEvents(data: DashboardData): CalendarEventRow[] {
  return collectCalendarEvents(data);
}

function resolveEntityLink(event: CalendarEventRow): {
  path: string;
  label: string;
  name: string;
} | null {
  const entityId = String(event.entityId || '').trim();
  if (!entityId) return null;

  const entityType = String(event.entityType || '').toLowerCase();
  const category = String(event.category || '').toLowerCase();
  const type = String(event.type || '').toLowerCase();
  const name =
    String(event.entityName || event.clientName || '').trim() ||
    (entityType === 'lead' ? 'Lead' : entityType === 'client' ? 'Client' : 'Record');

  if (entityType === 'lead' || category === 'followup' || type === 'follow-up') {
    // The lead page no longer has a Follow-ups tab, so every lead-side event
    // opens on Activities rather than a tab that would fall back to Details.
    const tab = 'activities';
    return {
      path: `/leads/${entityId}?tab=${tab}`,
      label: 'Open Lead',
      name,
    };
  }

  if (entityType === 'client') {
    return {
      path: `/clients/${entityId}?tab=timeline`,
      label: 'Open Client',
      name,
    };
  }

  return null;
}

function entityDisplayName(event: CalendarEventRow): string {
  return (
    String(event.entityName || event.clientName || '').trim() ||
    String(event.entityType || 'Scheduled Event')
  );
}

export const CalendarScheduleCard: React.FC<CalendarScheduleCardProps> = ({ data }) => {
  const navigate = useNavigate();
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);

  const allEvents = useMemo(() => collectEvents(data), [data]);
  const todayYmd = toYmd(new Date());

  const openLinkedEntity = (event: CalendarEventRow) => {
    const link = resolveEntityLink(event);
    if (!link) {
      setFullOpen(true);
      return;
    }
    setFullOpen(false);
    navigate(link.path);
  };

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    allEvents.forEach((event) => {
      const parsed = parseCalendarEventDate(event);
      if (!parsed) return;
      const ymd = toYmd(parsed);
      const list = map.get(ymd) || [];
      list.push(event);
      map.set(ymd, list);
    });
    return map;
  }, [allEvents]);

  const dayCells = useMemo(() => {
    const viewYear = viewMonth.getFullYear();
    const monthIndex = viewMonth.getMonth();
    const firstDayOfWeek = new Date(viewYear, monthIndex, 1).getDay();
    const daysInMonth = new Date(viewYear, monthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, monthIndex, 0).getDate();
    const cells: DayCell[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i -= 1) {
      cells.push({
        dayNum: daysInPrevMonth - i,
        isCurrentMonth: false,
        dateStr: null,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${viewYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const evCount = eventsByDate.get(dateStr)?.length || 0;
      cells.push({
        dayNum: day,
        isCurrentMonth: true,
        dateStr,
        isToday: todayYmd === dateStr,
        isSelected: selectedDate === dateStr,
        hasEvents: evCount > 0,
        evCount,
      });
    }

    const remainder = cells.length % 7;
    if (remainder > 0) {
      for (let n = 1; n <= 7 - remainder; n += 1) {
        cells.push({ dayNum: n, isCurrentMonth: false, dateStr: null });
      }
    }
    return cells;
  }, [viewMonth, eventsByDate, selectedDate, todayYmd]);

  /**
   * A chosen day reads best in chronological order, but the default agenda
   * shows the most recently created activities first so new work surfaces at
   * the top instead of being buried behind old overdue rows.
   */
  const displayEvents = useMemo(() => {
    if (selectedDate) return eventsByDate.get(selectedDate) || [];
    return [...allEvents]
      .sort((a, b) => eventCreatedTime(b) - eventCreatedTime(a))
      .slice(0, 4);
  }, [selectedDate, eventsByDate, allEvents]);

  const agendaTitle = selectedDate
    ? `Schedule for ${formatShortDate(selectedDate)}`
    : 'Upcoming Agenda';

  const eventsToday = data.calendarSummary?.scheduledEventsToday ?? eventsByDate.get(todayYmd)?.length ?? 0;
  const eventsThisWeek = data.calendarSummary?.scheduledEventsThisWeek ?? 0;
  const monthTitle = viewMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      <div
        data-tour="dashboard-calendar"
        className="bg-white border border-zinc-300 rounded-xl p-6 flex-1 flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-950 m-0 leading-tight">
                Upcoming Schedule
              </h3>
              <p className="text-xs text-zinc-500 m-0 mt-1">
                Your assigned activities (managers see the full team schedule) — click to open lead or client
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFullOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-transparent border-none cursor-pointer p-0"
            >
              Full Calendar
              <ArrowForwardIcon sx={{ fontSize: 13 }} />
            </button>
          </div>

          <div className="flex items-center justify-around p-3 bg-zinc-50 border border-zinc-200 rounded-lg mb-4 text-center">
            <div>
              <div className="text-xl font-bold font-mono text-zinc-950">{eventsToday}</div>
              <span className="text-[11px] text-zinc-500 block mt-0.5">Meetings Today</span>
            </div>
            <div className="h-6 w-px bg-zinc-200" />
            <div>
              <div className="text-xl font-bold font-mono text-zinc-950">{eventsThisWeek}</div>
              <span className="text-[11px] text-zinc-500 block mt-0.5">This Week</span>
            </div>
            <div className="h-6 w-px bg-zinc-200" />
            <div>
              <div className="text-xl font-bold font-mono text-zinc-950">
                {data.upcomingMilestones?.length || 0}
              </div>
              <span className="text-[11px] text-zinc-500 block mt-0.5">Milestones Due</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 mb-4">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                title="Previous month"
                onClick={() =>
                  setViewMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                  )
                }
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border-0 bg-transparent text-zinc-700 hover:bg-zinc-200 cursor-pointer"
              >
                <ArrowBackIosNewIcon sx={{ fontSize: 12 }} />
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-900">{monthTitle}</span>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                    setSelectedDate(todayYmd);
                  }}
                  className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Today
                </button>
              </div>
              <button
                type="button"
                title="Next month"
                onClick={() =>
                  setViewMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                  )
                }
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border-0 bg-transparent text-zinc-700 hover:bg-zinc-200 cursor-pointer"
              >
                <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {dayCells.map((cell, index) => {
                if (!cell.isCurrentMonth || !cell.dateStr) {
                  return (
                    <div
                      key={`pad-${index}`}
                      className="flex h-7 items-center justify-center select-none text-[11px] text-zinc-300"
                    >
                      {cell.dayNum}
                    </div>
                  );
                }

                let cellClass =
                  'relative mx-auto flex h-7 w-7 cursor-pointer flex-col items-center justify-center rounded-full text-xs transition-colors border-0';
                if (cell.isSelected) {
                  cellClass += ' bg-zinc-950 text-white font-bold';
                } else if (cell.isToday) {
                  cellClass += ' border border-zinc-950 bg-white text-zinc-950 font-bold hover:bg-zinc-200/60';
                } else if (cell.hasEvents) {
                  cellClass += ' bg-transparent font-semibold text-zinc-900 hover:bg-zinc-200/60';
                } else {
                  cellClass += ' bg-transparent text-zinc-700 hover:bg-zinc-200/60';
                }

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    title={`${cell.dateStr}${cell.hasEvents ? ` (${cell.evCount} events)` : ''}`}
                    className={cellClass}
                    onClick={() =>
                      setSelectedDate((current) =>
                        current === cell.dateStr ? null : cell.dateStr
                      )
                    }
                  >
                    <span>{cell.dayNum}</span>
                    {cell.hasEvents && !cell.isSelected ? (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-zinc-950" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-800">{agendaTitle}</span>
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                {displayEvents.length}
              </span>
            </div>
            {selectedDate ? (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-zinc-500 underline hover:text-zinc-900"
              >
                Show upcoming
              </button>
            ) : null}
          </div>

          {displayEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-3 py-6 text-center">
              <EventNoteOutlinedIcon sx={{ fontSize: 28, color: '#a1a1aa' }} className="mb-1" />
              <p className="m-0 text-xs text-zinc-500">
                No events scheduled {selectedDate ? 'for this date' : 'currently'}.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {displayEvents.map((event, index) => {
                const link = resolveEntityLink(event);
                return (
                  <button
                    key={String(event._id || event.id || `${event.title}-${index}`)}
                    type="button"
                    onClick={() => openLinkedEntity(event)}
                    title={link ? `${link.label}: ${link.name}` : 'View event'}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-zinc-100 bg-white p-2 text-left transition-colors hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-zinc-900">
                        {event.title || 'Event'}
                      </div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {entityDisplayName(event)} • {eventTimeLabel(event)}
                        {event.assignedToName || event.assignedToLabel
                          ? ` • Assigned: ${event.assignedToLabel || event.assignedToName}`
                          : ''}
                      </div>
                      {link ? (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-800">
                          <OpenInNewIcon sx={{ fontSize: 11 }} />
                          <span>
                            {link.label}: {link.name}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {event.isMissed ? (
                        <span
                          className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700"
                          title="Scheduled activity was not completed by its due time"
                        >
                          Missed
                        </span>
                      ) : null}
                      <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-800">
                        {String(event.relativeDate || event.type || 'Meeting')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
          <span className="text-xs text-zinc-500">
            {allEvents.length} events total this period
          </span>
          <button
            type="button"
            onClick={() => setFullOpen(true)}
            className="inline-flex items-center gap-1 border-0 bg-transparent text-xs font-semibold text-zinc-950 hover:text-zinc-600 cursor-pointer"
          >
            <CalendarMonthOutlinedIcon sx={{ fontSize: 14 }} />
            <span>Open Calendar</span>
            <ArrowForwardIcon sx={{ fontSize: 13 }} />
          </button>
        </div>
      </div>

      {fullOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[1px]"
          onClick={() => setFullOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <CalendarMonthOutlinedIcon sx={{ fontSize: 22 }} className="text-zinc-900" />
                <div>
                  <h2 className="m-0 text-lg font-semibold text-zinc-900">
                    Calendar & Scheduled Events
                  </h2>
                  <p className="m-0 text-xs text-zinc-500">
                    Click an activity to open its lead or client page
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setFullOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
              {allEvents.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-400">
                  No additional events scheduled for this period.
                </div>
              ) : (
                allEvents.map((event, index) => {
                  const link = resolveEntityLink(event);
                  return (
                    <button
                      key={String(event._id || event.id || `${event.title}-full-${index}`)}
                      type="button"
                      onClick={() => openLinkedEntity(event)}
                      title={link ? `${link.label}: ${link.name}` : 'View event'}
                      className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50"
                    >
                      <div className="min-w-0">
                        <strong className="block text-sm font-semibold text-zinc-900">
                          {event.title || 'Meeting'}
                        </strong>
                        <span className="text-xs text-zinc-500">
                          {entityDisplayName(event)} • {eventTimeLabel(event)}
                          {(() => {
                            const parsed = parseCalendarEventDate(event);
                            return parsed ? ` • ${formatShortDate(toYmd(parsed))}` : '';
                          })()}
                          {event.assignedToName || event.assignedToLabel
                            ? ` • Assigned: ${event.assignedToLabel || event.assignedToName}`
                            : ''}
                        </span>
                        {link ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-800">
                            <OpenInNewIcon sx={{ fontSize: 12 }} />
                            {link.label}: {link.name}
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                        {String(event.relativeDate || event.type || 'Scheduled')}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
