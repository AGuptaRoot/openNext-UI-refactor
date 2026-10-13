import React, { useState, useEffect } from 'react';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import { useTimer } from '../../context/TimerContext';
import { displayLabel } from '../../utils/displayLabels';

const QUICK_NOTES = [
  'Completed checklist deliverable',
  'Code review & testing',
  'Bug fix & verification',
  'Client consultation & follow-up',
  'Feature implementation',
  'Research & documentation',
];

export const CheckoutNoteModal: React.FC = () => {
  const {
    activeTimer,
    elapsedSecs,
    formatTimerSeconds,
    isCheckoutModalOpen,
    closeCheckoutModal,
    submitCheckout,
    saving,
  } = useTimer();

  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isCheckoutModalOpen) {
      setNote(activeTimer?.description || '');
      setError('');
    }
  }, [isCheckoutModalOpen, activeTimer]);

  if (!isCheckoutModalOpen || !activeTimer) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Please enter a work note describing what was accomplished during this session.');
      return;
    }
    setError('');
    try {
      await submitCheckout(note.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out and stop timer.');
    }
  };

  const handleQuickNoteClick = (snippet: string) => {
    setNote((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return snippet;
      if (trimmed.includes(snippet)) return trimmed;
      return `${trimmed}; ${snippet}`;
    });
    setError('');
  };

  const startIso = activeTimer.checkInAt || activeTimer.checkInTime || activeTimer.createdAt;
  const formattedStart = startIso
    ? new Date(startIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Recently';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
              <StopIcon sx={{ fontSize: 18 }} />
            </div>
            <div>
              <h3 className="m-0 text-sm font-bold text-zinc-950">Check Out & Stop Timer</h3>
              <p className="m-0 text-[11px] text-zinc-500">Record your session notes and finish this time log</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCheckoutModal}
            disabled={saving}
            className="w-8 h-8 rounded-lg border border-zinc-300 bg-white text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Session Overview Card */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <AssignmentIcon sx={{ fontSize: 14 }} className="text-zinc-400" />
                Task Deliverable
              </span>
              <span className="text-xs font-mono font-bold text-red-600 flex items-center gap-1">
                <AccessTimeIcon sx={{ fontSize: 14 }} />
                {formatTimerSeconds(elapsedSecs)}
              </span>
            </div>

            <div className="text-xs font-semibold text-zinc-900 leading-snug">
              {displayLabel(activeTimer.taskTitle, 'Active task')}
            </div>

            <div className="text-[11px] text-zinc-500 flex items-center gap-3">
              {activeTimer.projectName && (
                <span>Project: <strong className="text-zinc-700">{activeTimer.projectName}</strong></span>
              )}
              <span>Started: <strong className="text-zinc-700">{formattedStart}</strong></span>
              {activeTimer.isBillable !== false && (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                  Billable
                </span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Note Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <NoteAltOutlinedIcon sx={{ fontSize: 15 }} className="text-zinc-600" />
              Work Note / Accomplishment Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              autoFocus
              disabled={saving}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError('');
              }}
              placeholder="What did you work on or accomplish during this session? e.g. Implemented frontend layout, fixed bug in payment callback, tested with mock data..."
              className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 disabled:bg-zinc-100 resize-y min-h-[90px]"
            />
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-0.5">
              <span>This note will be attached to the time log record.</span>
              <span>{note.length} chars</span>
            </div>
          </div>

          {/* Quick Note Presets */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Quick Suggestions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTES.map((snippet) => (
                <button
                  key={snippet}
                  type="button"
                  onClick={() => handleQuickNoteClick(snippet)}
                  disabled={saving}
                  className="px-2 py-1 rounded-md text-[11px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 cursor-pointer transition-colors"
                >
                  + {snippet}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={closeCheckoutModal}
              disabled={saving}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
            >
              Keep Timer Running
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 border-none rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <StopIcon sx={{ fontSize: 15 }} />
              <span>{saving ? 'Checking Out…' : 'Check Out & Stop Timer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
