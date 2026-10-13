import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { crmApi } from '../services/api';
import { TimeLogItem } from '../types/timeLogs';

interface StartTimerParams {
  taskId: string;
  projectId?: string;
  taskTitle?: string;
  hourlyRate?: number;
  isBillable?: boolean;
  description?: string;
}

interface TimerContextValue {
  activeTimer: TimeLogItem | null;
  elapsedSecs: number;
  formatTimerSeconds: (secs?: number) => string;
  isCheckoutModalOpen: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  startTimer: (params: StartTimerParams) => Promise<TimeLogItem>;
  openCheckoutModal: () => void;
  closeCheckoutModal: () => void;
  submitCheckout: (note: string) => Promise<TimeLogItem | null>;
  refreshActiveTimer: () => Promise<TimeLogItem | null>;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export const formatTimerSeconds = (sec: number = 0): string => {
  const safeSec = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTimer, setActiveTimer] = useState<TimeLogItem | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const calculateElapsed = (timer: TimeLogItem | null): number => {
    if (!timer) return 0;
    const startStr = timer.checkInAt || timer.checkInTime || timer.createdAt;
    if (!startStr) return 0;
    const startTime = new Date(startStr).getTime();
    if (isNaN(startTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  };

  const refreshActiveTimer = useCallback(async (): Promise<TimeLogItem | null> => {
    try {
      const res = await crmApi.getActiveCheckIn();
      const current = res.data || null;
      setActiveTimer(current);
      if (current) {
        setElapsedSecs(calculateElapsed(current));
      } else {
        setElapsedSecs(0);
      }
      return current;
    } catch {
      setActiveTimer(null);
      setElapsedSecs(0);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshActiveTimer();
  }, [refreshActiveTimer]);

  useEffect(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }

    if (activeTimer) {
      setElapsedSecs(calculateElapsed(activeTimer));

      tickerRef.current = setInterval(() => {
        setElapsedSecs((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSecs(0);
    }

    return () => {
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };
  }, [activeTimer]);

  useEffect(() => {
    const handleTimerChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ activeTimer?: TimeLogItem | null }>;
      if (customEvent.detail && 'activeTimer' in customEvent.detail) {
        const next = customEvent.detail.activeTimer ?? null;
        setActiveTimer(next);
        setElapsedSecs(calculateElapsed(next));
      } else {
        void refreshActiveTimer();
      }
    };

    window.addEventListener('crm:timer-changed', handleTimerChanged);
    return () => {
      window.removeEventListener('crm:timer-changed', handleTimerChanged);
    };
  }, [refreshActiveTimer]);

  const startTimer = useCallback(async (params: StartTimerParams): Promise<TimeLogItem> => {
    setSaving(true);
    setError('');
    try {
      const res = await crmApi.checkIn({
        taskId: params.taskId,
        projectId: params.projectId,
        hourlyRate: params.hourlyRate,
        isBillable: params.isBillable,
        description: params.description,
      });

      const created = res.data as unknown as TimeLogItem;
      setActiveTimer(created);
      setElapsedSecs(0);

      window.dispatchEvent(
        new CustomEvent('crm:timer-changed', {
          detail: { activeTimer: created, action: 'check-in' },
        })
      );

      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start timer';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const openCheckoutModal = useCallback(() => {
    setIsCheckoutModalOpen(true);
  }, []);

  const closeCheckoutModal = useCallback(() => {
    setIsCheckoutModalOpen(false);
  }, []);

  const submitCheckout = useCallback(
    async (note: string): Promise<TimeLogItem | null> => {
      if (!activeTimer) return null;
      setSaving(true);
      setError('');
      try {
        const res = await crmApi.checkOut({
          timeLogId: activeTimer._id,
          description: note,
          note: note,
        });

        const completed = res.data as unknown as TimeLogItem;
        setActiveTimer(null);
        setElapsedSecs(0);
        setIsCheckoutModalOpen(false);

        window.dispatchEvent(
          new CustomEvent('crm:timer-changed', {
            detail: { activeTimer: null, action: 'check-out', completed },
          })
        );

        return completed;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to check out';
        setError(msg);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [activeTimer]
  );

  const value: TimerContextValue = {
    activeTimer,
    elapsedSecs,
    formatTimerSeconds: (s) => formatTimerSeconds(s !== undefined ? s : elapsedSecs),
    isCheckoutModalOpen,
    loading,
    saving,
    error,
    startTimer,
    openCheckoutModal,
    closeCheckoutModal,
    submitCheckout,
    refreshActiveTimer,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export const useTimer = (): TimerContextValue => {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return ctx;
};
