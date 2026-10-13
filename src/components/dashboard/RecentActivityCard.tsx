import React from 'react';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { AuditItem } from '../../types/dashboard';

interface RecentActivityCardProps {
  auditList?: AuditItem[];
  onNavigateUnmigrated: (moduleName: string) => void;
}

export const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  auditList = [],
  onNavigateUnmigrated,
}) => {
  return (
    <div data-tour="dashboard-activity" className="bg-white border border-zinc-300 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-950 m-0">
          Recent Activity
        </h3>
        <HistoryOutlinedIcon className="text-zinc-950" sx={{ fontSize: 18 }} />
      </div>

      {auditList.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-zinc-400 m-0">
            No recent activity recorded for this period.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {auditList.slice(0, 4).map((item, idx) => (
            <div
              key={item._id || idx}
              className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 flex flex-col items-start gap-0.5"
            >
              <div className="flex justify-between w-full items-center">
                <span className="text-xs font-semibold text-zinc-950">
                  {item.userName || 'System User'}
                </span>
                <span className="text-[10.5px] text-zinc-400">
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500">
                <strong className="text-zinc-950 uppercase">{item.action}</strong> on {item.entity}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-zinc-200 flex justify-end">
        <button
          type="button"
          onClick={() => onNavigateUnmigrated('Audit History')}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer p-0"
        >
          <span>Full Audit Trail</span>
          <ArrowForwardIcon sx={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  );
};
