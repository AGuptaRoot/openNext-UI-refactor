import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride';
import type { EventData } from 'react-joyride';
import { reportsTourSteps } from './steps/reports.js';
import {
  clearModuleTourProgress,
  hasSeenTour,
  markTourSeen,
  setModuleTourProgress,
  getModuleTourProgress,
} from './storage.js';

class TourErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[ReportsTour] disabled after error:', error.message);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function isReportsRoute(pathname: string) {
  return pathname === '/reports' || pathname.startsWith('/reports/');
}

/**
 * Reports Beacon onboarding. UI-only — does not change report fetch/export logic.
 */
const ReportsTourInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const onRoute = isReportsRoute(location.pathname);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourKey, setTourKey] = useState(0);

  const steps = useMemo(() => reportsTourSteps, []);

  const startTour = useCallback((fromIndex = 0) => {
    try {
      localStorage.removeItem('crm-tour-seen:v1:reports');
    } catch {
      // ignore
    }
    setModuleTourProgress({ active: true, moduleId: 'reports', stepIndex: fromIndex });
    setStepIndex(fromIndex);
    setTourKey((k) => k + 1);
    setRun(true);
  }, []);

  const stopTour = useCallback((markDone: boolean) => {
    setRun(false);
    if (markDone) markTourSeen('reports');
    else clearModuleTourProgress();
  }, []);

  useEffect(() => {
    if (!onRoute) {
      setRun(false);
      return;
    }
    const progress = getModuleTourProgress();
    if (progress?.active && progress.moduleId === 'reports') {
      setStepIndex(Number(progress.stepIndex) || 0);
      setRun(true);
      return;
    }
    if (hasSeenTour('reports')) {
      setRun(false);
      return;
    }
    const t = window.setTimeout(() => startTour(0), 500);
    return () => window.clearTimeout(t);
  }, [onRoute, location.pathname, startTour]);

  useEffect(() => {
    const onRestart = () => {
      navigate('/reports');
      window.setTimeout(() => startTour(0), 300);
    };
    const onSkip = (e: Event) => {
      const id = (e as CustomEvent<{ moduleId?: string }>).detail?.moduleId;
      if (id && id !== 'reports') return;
      stopTour(true);
    };
    window.addEventListener('crm-reports-tour-restart', onRestart);
    window.addEventListener('crm-module-tour-skip', onSkip);
    return () => {
      window.removeEventListener('crm-reports-tour-restart', onRestart);
      window.removeEventListener('crm-module-tour-skip', onSkip);
    };
  }, [navigate, startTour, stopTour]);

  if (!onRoute) return null;

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
            // Soft-skip missing tabs/targets (RBAC / empty / no export)
            if (type === EVENTS.TARGET_NOT_FOUND && action !== ACTIONS.PREV) {
              next = index + 1;
            }
            if (next >= size) {
              stopTour(true);
              return;
            }
            setStepIndex(next);
            setModuleTourProgress({
              active: true,
              moduleId: 'reports',
              stepIndex: next,
            });
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
              setModuleTourProgress({
                active: true,
                moduleId: 'reports',
                stepIndex: next,
              });
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
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
        open: 'Show tip',
      }}
    />
  );
};

export const ReportsTour: React.FC = () => (
  <TourErrorBoundary>
    <ReportsTourInner />
  </TourErrorBoundary>
);

export function restartReportsTour() {
  try {
    localStorage.removeItem('crm-tour-seen:v1:reports');
  } catch {
    // ignore
  }
  clearModuleTourProgress();
  window.dispatchEvent(new CustomEvent('crm-reports-tour-restart'));
}
