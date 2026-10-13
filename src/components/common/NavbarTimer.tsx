import React from 'react';
import { Link } from 'react-router-dom';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import StopIcon from '@mui/icons-material/Stop';
import { useTimer } from '../../context/TimerContext';

export const NavbarTimer: React.FC = () => {
  const { activeTimer, elapsedSecs, formatTimerSeconds, openCheckoutModal } = useTimer();

  if (!activeTimer) {
    return null;
  }

  const taskTitle = activeTimer.taskTitle || 'Active Task';
  const taskId = activeTimer.taskId;

  return (
    <div
      className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1 bg-emerald-50 border border-emerald-300/80 rounded-lg shadow-xs text-xs animate-in fade-in duration-200"
      role="timer"
      aria-live="polite"
      title={`Timer running on: ${taskTitle}`}
    >
      {/* Pulsing indicator */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
      </span>

      {/* Clock icon */}
      <AccessTimeFilledIcon sx={{ fontSize: 15 }} className="text-emerald-700 shrink-0" />

      {/* Running elapsed ticker */}
      <span className="font-mono font-bold text-zinc-950 tracking-wider text-xs shrink-0 select-none">
        {formatTimerSeconds(elapsedSecs)}
      </span>

      {/* Task Link (truncated on small screens) */}
      {taskId && (
        <Link
          to={`/tasks/${taskId}`}
          className="no-underline hidden sm:inline-block max-w-[120px] md:max-w-[160px] lg:max-w-[200px] truncate text-[11px] font-medium text-zinc-700 hover:text-zinc-950 transition-colors"
          title={`Go to task: ${taskTitle}`}
        >
          {taskTitle}
        </Link>
      )}

      {/* Check Out button */}
      <button
        type="button"
        onClick={openCheckoutModal}
        className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-md transition-colors border-none shadow-xs shrink-0"
        title="Check Out & Log Session Note"
      >
        <StopIcon sx={{ fontSize: 13 }} />
        <span>Check Out</span>
      </button>
    </div>
  );
};
