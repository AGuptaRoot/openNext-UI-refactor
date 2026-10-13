import React from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import type { AssignedLeadActivityItem, DashboardData } from '../../types/dashboard';

interface MyAssignedActivitiesCardProps {
  data: DashboardData;
}

function formatWhen(item: AssignedLeadActivityItem): string {
  if (!item.eventDate) return '—';
  const date = new Date(item.eventDate);
  if (Number.isNaN(date.getTime())) return String(item.eventDate);
  if (item.isToday) return `Today · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (item.isOverdue) return `Overdue · ${date.toLocaleString()}`;
  return date.toLocaleString();
}

export const MyAssignedActivitiesCard: React.FC<MyAssignedActivitiesCardProps> = ({ data }) => {
  const navigate = useNavigate();
  const items = data.myAssignedActivities || [];
  const overdueCount = items.filter((item) => item.isOverdue).length;

  return (
    <div
      data-tour="dashboard-my-assigned-activities"
      className="bg-white border border-zinc-300 rounded-xl p-6 flex flex-col h-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-950 m-0 leading-tight">
            My Assigned Lead Activities
          </h3>
          <p className="text-xs text-zinc-500 m-0 mt-1">
            Calls, meetings, and follow-ups assigned to you on leads you can work.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
              {overdueCount} overdue
            </span>
          )}
          <span className="inline-flex rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
            {items.length} open
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
          <EventAvailableOutlinedIcon sx={{ fontSize: 28, color: '#a1a1aa' }} />
          <p className="text-sm text-zinc-500 m-0 mt-2">No lead activities assigned to you.</p>
        </div>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-2 flex-1">
          {items.slice(0, 8).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (item.leadId) {
                    navigate(`/leads/${encodeURIComponent(item.leadId)}?tab=activities`);
                  }
                }}
                className="w-full text-left rounded-lg border border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50 px-3 py-2.5 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-950 truncate">{item.title}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {item.leadName || 'Lead'}
                      {item.eventType ? ` · ${item.eventType}` : ''}
                    </div>
                    <div
                      className={`text-[11px] font-medium mt-1 ${
                        item.isOverdue ? 'text-rose-700' : item.isToday ? 'text-amber-700' : 'text-zinc-600'
                      }`}
                    >
                      {formatWhen(item)}
                    </div>
                  </div>
                  <ArrowForwardIcon sx={{ fontSize: 16, color: '#71717a', flexShrink: 0, mt: '2px' }} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => navigate('/leads')}
        className="mt-4 self-start inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950 bg-transparent border-0 cursor-pointer p-0"
      >
        Open leads
        <ArrowForwardIcon sx={{ fontSize: 14 }} />
      </button>
    </div>
  );
};
