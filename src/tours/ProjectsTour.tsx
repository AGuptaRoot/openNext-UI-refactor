import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride';
import type { EventData } from 'react-joyride';
import { projectsTourSteps } from './steps/projects.js';
import {
  clearProjectsTourCompleted,
  clearProjectsTourProgress,
  getProjectsTourProgress,
  hasCompletedProjectsTour,
  markProjectsTourCompleted,
  setProjectsTourProgress,
} from './projectsTourState.js';
import { getClientsTourProgress } from './clientsTourState.js';
import { getLeadsTourProgress } from './leadsTourState.js';
import { getTasksTourProgress } from './tasksTourState.js';

class TourErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[ProjectsTour] disabled after error:', error.message);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function isProjectsTourRoute(pathname: string) {
  return (
    pathname === '/projects' ||
    pathname.startsWith('/projects/') ||
    pathname === '/tasks' ||
    pathname.startsWith('/tasks/')
  );
}

/**
 * Projects Beacon onboarding. UI-only — does not change project CRM logic.
 * Yields to active Leads/Clients/Tasks tours (Clients finale on /projects; Tasks starts on /tasks).
 */
const ProjectsTourInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const onTourRoute = isProjectsTourRoute(location.pathname);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourKey, setTourKey] = useState(0);

  const steps = useMemo(() => projectsTourSteps, []);

  const startTour = useCallback((fromIndex = 0) => {
    clearProjectsTourCompleted();
    setProjectsTourProgress({ active: true, stepIndex: fromIndex });
    setStepIndex(fromIndex);
    setTourKey((k) => k + 1);
    setRun(true);
  }, []);

  const stopTour = useCallback((markDone: boolean) => {
    setRun(false);
    if (markDone) markProjectsTourCompleted();
    else clearProjectsTourProgress();
  }, []);

  useEffect(() => {
    if (!onTourRoute) {
      setRun(false);
      return;
    }
    // Yield while Clients/Leads/Tasks Beacon tours finish
    if (
      getClientsTourProgress()?.active ||
      getLeadsTourProgress()?.active ||
      getTasksTourProgress()?.active
    ) {
      setRun(false);
      return;
    }
    const progress = getProjectsTourProgress();
    if (progress?.active) {
      setStepIndex(Number(progress.stepIndex) || 0);
      setRun(true);
      return;
    }
    if (hasCompletedProjectsTour()) {
      setRun(false);
      return;
    }
    if (location.pathname === '/projects') {
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
      navigate('/projects');
      window.setTimeout(() => startTour(0), 300);
    };
    const onSkip = () => stopTour(true);
    const onResume = () => {
      const progress = getProjectsTourProgress();
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
        setProjectsTourProgress({ active: true, stepIndex: next });
        setRun(true);
      }
    };
    window.addEventListener('crm-projects-tour-restart', onRestart);
    window.addEventListener('crm-projects-tour-skip', onSkip);
    window.addEventListener('crm-projects-tour-resume', onResume);
    window.addEventListener('crm-projects-tour-jump', onJump as EventListener);
    return () => {
      window.removeEventListener('crm-projects-tour-restart', onRestart);
      window.removeEventListener('crm-projects-tour-skip', onSkip);
      window.removeEventListener('crm-projects-tour-resume', onResume);
      window.removeEventListener('crm-projects-tour-jump', onJump as EventListener);
    };
  }, [navigate, startTour, stopTour, steps.length]);

  // Re-start after Clients tour clears progress on /projects
  useEffect(() => {
    const onState = () => {
      if (location.pathname !== '/projects') return;
      if (
        getClientsTourProgress()?.active ||
        getLeadsTourProgress()?.active ||
        getTasksTourProgress()?.active
      )
        return;
      if (hasCompletedProjectsTour()) return;
      if (getProjectsTourProgress()?.active) return;
      startTour(0);
    };
    window.addEventListener('crm-tour-state', onState);
    return () => window.removeEventListener('crm-tour-state', onState);
  }, [location.pathname, startTour]);

  // Only show Joyride while this tour is running (finale may land on /tasks)
  const showJoyride =
    run &&
    (location.pathname === '/projects' ||
      location.pathname.startsWith('/projects/') ||
      location.pathname === '/tasks' ||
      location.pathname.startsWith('/tasks/'));

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
            setProjectsTourProgress({ active: true, stepIndex: next });
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
              setProjectsTourProgress({ active: true, stepIndex: next });
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

export const ProjectsTour: React.FC = () => (
  <TourErrorBoundary>
    <ProjectsTourInner />
  </TourErrorBoundary>
);

export function restartProjectsTour() {
  clearProjectsTourCompleted();
  clearProjectsTourProgress();
  window.dispatchEvent(new CustomEvent('crm-projects-tour-restart'));
}
