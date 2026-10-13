import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride';
import type { EventData } from 'react-joyride';
import { timeLogsTourSteps } from './steps/timeLogs.js';
import {
  clearTimeLogsTourCompleted,
  clearTimeLogsTourProgress,
  getTimeLogsTourProgress,
  hasCompletedTimeLogsTour,
  markTimeLogsTourCompleted,
  setTimeLogsTourProgress,
  requestTourNavigate,
} from './timeLogsTourState.js';
import { getTasksTourProgress } from './tasksTourState.js';
import { getLeadsTourProgress } from './leadsTourState.js';
import { getClientsTourProgress } from './clientsTourState.js';
import { getProjectsTourProgress } from './projectsTourState.js';

class TourErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[TimeLogsTour] disabled after error:', error.message);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function isTimeLogsRoute(pathname: string) {
  return pathname === '/time-logs' || pathname.startsWith('/time-logs/');
}

function upstreamTourActive() {
  return Boolean(
    getLeadsTourProgress()?.active ||
      getClientsTourProgress()?.active ||
      getProjectsTourProgress()?.active ||
      getTasksTourProgress()?.active
  );
}

/**
 * Time Logs Beacon onboarding. UI-only — does not change timer/API logic.
 * Yields to Tasks (and earlier) tours. Finale navigates to Quotations.
 */
const TimeLogsTourInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const onTourRoute = isTimeLogsRoute(location.pathname);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourKey, setTourKey] = useState(0);

  const steps = useMemo(() => timeLogsTourSteps, []);

  const startTour = useCallback((fromIndex = 0) => {
    clearTimeLogsTourCompleted();
    setTimeLogsTourProgress({ active: true, stepIndex: fromIndex });
    setStepIndex(fromIndex);
    setTourKey((k) => k + 1);
    setRun(true);
  }, []);

  const stopTour = useCallback((markDone: boolean, handoffQuotations = false) => {
    setRun(false);
    if (markDone) markTimeLogsTourCompleted();
    else clearTimeLogsTourProgress();
    if (handoffQuotations) {
      window.setTimeout(() => {
        requestTourNavigate('/quotations');
        navigate('/quotations');
      }, 200);
    }
  }, [navigate]);

  useEffect(() => {
    if (!onTourRoute) {
      setRun(false);
      return;
    }
    if (upstreamTourActive()) {
      setRun(false);
      return;
    }
    const progress = getTimeLogsTourProgress();
    if (progress?.active) {
      setStepIndex(Number(progress.stepIndex) || 0);
      setRun(true);
      return;
    }
    if (hasCompletedTimeLogsTour()) {
      setRun(false);
      return;
    }
    const t = window.setTimeout(() => startTour(0), 700);
    return () => window.clearTimeout(t);
  }, [onTourRoute, location.pathname, startTour]);

  useEffect(() => {
    const onNav = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path;
      if (!path) return;
      const target = String(path).split('?')[0] || '/';
      if (location.pathname === target) return;
      navigate(path);
    };
    window.addEventListener('crm-tour-navigate', onNav as EventListener);
    return () => window.removeEventListener('crm-tour-navigate', onNav as EventListener);
  }, [navigate, location.pathname]);

  useEffect(() => {
    const onRestart = () => {
      navigate('/time-logs');
      window.setTimeout(() => startTour(0), 300);
    };
    const onSkip = () => stopTour(true, false);
    const onResume = () => {
      const progress = getTimeLogsTourProgress();
      if (progress?.active) {
        setStepIndex(Number(progress.stepIndex) || 0);
        setTourKey((k) => k + 1);
        setRun(true);
      }
    };
    const onJump = (e: Event) => {
      const detail = (e as CustomEvent<{ stepIndex?: number; finish?: boolean }>).detail || {};
      if (detail.finish) {
        stopTour(true, false);
        return;
      }
      if (typeof detail.stepIndex === 'number' && detail.stepIndex >= 0) {
        const next = Math.min(detail.stepIndex, steps.length - 1);
        setStepIndex(next);
        setTimeLogsTourProgress({ active: true, stepIndex: next });
        setRun(true);
      }
    };
    window.addEventListener('crm-time-logs-tour-restart', onRestart);
    window.addEventListener('crm-time-logs-tour-skip', onSkip);
    window.addEventListener('crm-time-logs-tour-resume', onResume);
    window.addEventListener('crm-time-logs-tour-jump', onJump as EventListener);
    return () => {
      window.removeEventListener('crm-time-logs-tour-restart', onRestart);
      window.removeEventListener('crm-time-logs-tour-skip', onSkip);
      window.removeEventListener('crm-time-logs-tour-resume', onResume);
      window.removeEventListener('crm-time-logs-tour-jump', onJump as EventListener);
    };
  }, [navigate, startTour, stopTour, steps.length]);

  // Start after Tasks tour finishes while still on /time-logs
  useEffect(() => {
    const onState = () => {
      if (!isTimeLogsRoute(location.pathname)) return;
      if (upstreamTourActive()) return;
      if (hasCompletedTimeLogsTour()) return;
      if (getTimeLogsTourProgress()?.active) return;
      startTour(0);
    };
    window.addEventListener('crm-tour-state', onState);
    return () => window.removeEventListener('crm-tour-state', onState);
  }, [location.pathname, startTour]);

  if (!onTourRoute) return null;

  return (
    <Joyride
      key={tourKey}
      run={run}
      steps={steps}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={(data: EventData) => {
        try {
          const { type, status, action, index, size } = data;

          if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
            let next = index;
            if (action === ACTIONS.NEXT || action === ACTIONS.CLOSE) next = index + 1;
            if (action === ACTIONS.PREV) next = Math.max(0, index - 1);
            if (action === ACTIONS.SKIP) {
              stopTour(true, false);
              return;
            }
            // Soft-skip missing targets (e.g. timer banner when idle)
            if (type === EVENTS.TARGET_NOT_FOUND && action !== ACTIONS.PREV) {
              next = index + 1;
            }
            if (next >= size) {
              stopTour(true, true);
              return;
            }
            setStepIndex(next);
            setTimeLogsTourProgress({ active: true, stepIndex: next });
            return;
          }

          if (type === EVENTS.TOUR_END || status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            const handoff = status === STATUS.FINISHED || type === EVENTS.TOUR_END;
            stopTour(true, handoff && status !== STATUS.SKIPPED);
            return;
          }

          if (type === EVENTS.ERROR) {
            const next = Math.min(index + 1, (size || steps.length) - 1);
            if (next !== index) {
              setStepIndex(next);
              setTimeLogsTourProgress({ active: true, stepIndex: next });
            } else {
              setRun(false);
            }
          }
        } catch {
          setRun(false);
        }
      }}
      options={{
        skipBeacon: false,
        beaconTrigger: 'click',
        primaryColor: '#ff7300',
        zIndex: 10000,
        showProgress: true,
        blockTargetInteraction: false,
        targetWaitTimeout: 5000,
        scrollOffset: 96,
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Go to Quotations',
        next: 'Next',
        skip: 'Skip tour',
        open: 'Show tip',
      }}
    />
  );
};

export const TimeLogsTour: React.FC = () => (
  <TourErrorBoundary>
    <TimeLogsTourInner />
  </TourErrorBoundary>
);

export function restartTimeLogsTour() {
  clearTimeLogsTourCompleted();
  clearTimeLogsTourProgress();
  window.dispatchEvent(new CustomEvent('crm-time-logs-tour-restart'));
}
