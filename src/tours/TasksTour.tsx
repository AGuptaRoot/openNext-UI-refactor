import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride';
import type { EventData } from 'react-joyride';
import { tasksTourSteps } from './steps/tasks.js';
import {
  clearTasksTourCompleted,
  clearTasksTourProgress,
  getTasksTourProgress,
  hasCompletedTasksTour,
  markTasksTourCompleted,
  setTasksTourProgress,
} from './tasksTourState.js';
import { getClientsTourProgress } from './clientsTourState.js';
import { getLeadsTourProgress } from './leadsTourState.js';
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
    console.warn('[TasksTour] disabled after error:', error.message);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function isTasksTourRoute(pathname: string) {
  return (
    pathname === '/tasks' ||
    pathname.startsWith('/tasks/') ||
    pathname === '/time-logs' ||
    pathname.startsWith('/time-logs/')
  );
}

function upstreamTourActive() {
  return Boolean(
    getLeadsTourProgress()?.active ||
      getClientsTourProgress()?.active ||
      getProjectsTourProgress()?.active
  );
}

/**
 * Tasks Beacon onboarding. UI-only — does not change task CRM logic.
 * Yields to Leads/Clients/Projects (Projects finale lands on /tasks).
 * Finale redirects to Time Logs.
 */
const TasksTourInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const onTourRoute = isTasksTourRoute(location.pathname);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourKey, setTourKey] = useState(0);

  const steps = useMemo(() => tasksTourSteps, []);

  const startTour = useCallback((fromIndex = 0) => {
    clearTasksTourCompleted();
    setTasksTourProgress({ active: true, stepIndex: fromIndex });
    setStepIndex(fromIndex);
    setTourKey((k) => k + 1);
    setRun(true);
  }, []);

  const stopTour = useCallback((markDone: boolean) => {
    setRun(false);
    if (markDone) markTasksTourCompleted();
    else clearTasksTourProgress();
  }, []);

  useEffect(() => {
    if (!onTourRoute) {
      setRun(false);
      return;
    }
    if (upstreamTourActive()) {
      setRun(false);
      return;
    }
    const progress = getTasksTourProgress();
    if (progress?.active) {
      setStepIndex(Number(progress.stepIndex) || 0);
      setRun(true);
      return;
    }
    if (hasCompletedTasksTour()) {
      setRun(false);
      return;
    }
    if (location.pathname === '/tasks') {
      const t = window.setTimeout(() => startTour(0), 600);
      return () => window.clearTimeout(t);
    }
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
      navigate('/tasks');
      window.setTimeout(() => startTour(0), 300);
    };
    const onSkip = () => stopTour(true);
    const onResume = () => {
      const progress = getTasksTourProgress();
      if (progress?.active) {
        setStepIndex(Number(progress.stepIndex) || 0);
        setTourKey((k) => k + 1);
        setRun(true);
      }
    };
    const onJump = (e: Event) => {
      const detail = (e as CustomEvent<{ stepIndex?: number; finish?: boolean }>).detail || {};
      if (detail.finish) {
        stopTour(true);
        return;
      }
      if (typeof detail.stepIndex === 'number' && detail.stepIndex >= 0) {
        const next = Math.min(detail.stepIndex, steps.length - 1);
        setStepIndex(next);
        setTasksTourProgress({ active: true, stepIndex: next });
        setRun(true);
      }
    };
    window.addEventListener('crm-tasks-tour-restart', onRestart);
    window.addEventListener('crm-tasks-tour-skip', onSkip);
    window.addEventListener('crm-tasks-tour-resume', onResume);
    window.addEventListener('crm-tasks-tour-jump', onJump as EventListener);
    return () => {
      window.removeEventListener('crm-tasks-tour-restart', onRestart);
      window.removeEventListener('crm-tasks-tour-skip', onSkip);
      window.removeEventListener('crm-tasks-tour-resume', onResume);
      window.removeEventListener('crm-tasks-tour-jump', onJump as EventListener);
    };
  }, [navigate, startTour, stopTour, steps.length]);

  // Re-start after Projects tour clears progress on /tasks
  useEffect(() => {
    const onState = () => {
      if (location.pathname !== '/tasks') return;
      if (upstreamTourActive()) return;
      if (hasCompletedTasksTour()) return;
      if (getTasksTourProgress()?.active) return;
      startTour(0);
    };
    window.addEventListener('crm-tour-state', onState);
    return () => window.removeEventListener('crm-tour-state', onState);
  }, [location.pathname, startTour]);

  const showJoyride =
    location.pathname === '/tasks' ||
    location.pathname.startsWith('/tasks/') ||
    location.pathname === '/time-logs' ||
    location.pathname.startsWith('/time-logs/');

  if (!showJoyride) return null;

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
              stopTour(true);
              return;
            }
            if (type === EVENTS.TARGET_NOT_FOUND && action !== ACTIONS.PREV) {
              next = index + 1;
            }
            if (next >= size) {
              stopTour(true);
              return;
            }
            setStepIndex(next);
            setTasksTourProgress({ active: true, stepIndex: next });
            return;
          }

          if (type === EVENTS.TOUR_END || status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            stopTour(true);
            return;
          }

          if (type === EVENTS.ERROR) {
            const next = Math.min(index + 1, (size || steps.length) - 1);
            if (next !== index) {
              setStepIndex(next);
              setTasksTourProgress({ active: true, stepIndex: next });
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
        targetWaitTimeout: 3500,
        scrollOffset: 96,
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
        open: 'Show tip',
      }}
    />
  );
};

export const TasksTour: React.FC = () => (
  <TourErrorBoundary>
    <TasksTourInner />
  </TourErrorBoundary>
);

export function restartTasksTour() {
  clearTasksTourCompleted();
  clearTasksTourProgress();
  window.dispatchEvent(new CustomEvent('crm-tasks-tour-restart'));
}
