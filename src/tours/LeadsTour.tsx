import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride';
import type { EventData } from 'react-joyride';
import { leadsTourSteps } from './steps/leads.js';
import {
  clearLeadsTourCompleted,
  clearLeadsTourProgress,
  getLeadsTourProgress,
  hasCompletedLeadsTour,
  markLeadsTourCompleted,
  setLeadsTourProgress,
} from './leadsTourState.js';

class TourErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[LeadsTour] disabled after error:', error.message);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function isLeadsTourRoute(pathname: string) {
  return (
    pathname === '/leads' ||
    pathname.startsWith('/leads/') ||
    pathname === '/clients' ||
    pathname.startsWith('/clients/')
  );
}

/**
 * Full Leads Beacon onboarding. UI-only aside from convert→clients navigation
 * already handled on successful convert in LeadDetailPage.
 */
const LeadsTourInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const onTourRoute = isLeadsTourRoute(location.pathname);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourKey, setTourKey] = useState(0);

  const steps = useMemo(() => leadsTourSteps, []);

  const startTour = useCallback((fromIndex = 0) => {
    clearLeadsTourCompleted();
    setLeadsTourProgress({ active: true, stepIndex: fromIndex });
    setStepIndex(fromIndex);
    setTourKey((k) => k + 1);
    setRun(true);
  }, []);

  const stopTour = useCallback((markDone: boolean) => {
    setRun(false);
    if (markDone) markLeadsTourCompleted();
    else clearLeadsTourProgress();
  }, []);

  // First visit auto-start (listing only)
  useEffect(() => {
    if (!onTourRoute) {
      setRun(false);
      return;
    }
    const progress = getLeadsTourProgress();
    if (progress?.active) {
      setStepIndex(Number(progress.stepIndex) || 0);
      setRun(true);
      return;
    }
    if (hasCompletedLeadsTour()) {
      setRun(false);
      return;
    }
    if (location.pathname === '/leads') {
      const t = window.setTimeout(() => startTour(0), 500);
      return () => window.clearTimeout(t);
    }
  }, [onTourRoute, location.pathname, startTour]);

  // Navigation + view helpers used by step before() hooks
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

  // Restart / start from header button
  useEffect(() => {
    const onRestart = () => {
      navigate('/leads');
      window.setTimeout(() => startTour(0), 300);
    };
    window.addEventListener('crm-leads-tour-restart', onRestart);
    return () => window.removeEventListener('crm-leads-tour-restart', onRestart);
  }, [navigate, startTour]);

  // Top bar: Stop / Skip / Resume after navigate-away or reload
  useEffect(() => {
    const onStop = () => stopTour(false);
    const onSkip = () => stopTour(true);
    const onResume = () => {
      const progress = getLeadsTourProgress();
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
        setLeadsTourProgress({ active: true, stepIndex: next });
        setRun(true);
      }
    };
    window.addEventListener('crm-leads-tour-stop', onStop);
    window.addEventListener('crm-leads-tour-skip', onSkip);
    window.addEventListener('crm-leads-tour-resume', onResume);
    window.addEventListener('crm-leads-tour-jump', onJump as EventListener);
    return () => {
      window.removeEventListener('crm-leads-tour-stop', onStop);
      window.removeEventListener('crm-leads-tour-skip', onSkip);
      window.removeEventListener('crm-leads-tour-resume', onResume);
      window.removeEventListener('crm-leads-tour-jump', onJump as EventListener);
    };
  }, [stopTour, steps.length]);

  // Keep Joyride mounted only on tour routes; progress stays for the top bar
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
              stopTour(true);
              return;
            }
            // Empty list / missing lead detail targets — advance past without waiting on user
            if (type === EVENTS.TARGET_NOT_FOUND && action !== ACTIONS.PREV) {
              next = index + 1;
            }
            if (next >= size) {
              stopTour(true);
              return;
            }
            setStepIndex(next);
            setLeadsTourProgress({ active: true, stepIndex: next });
            return;
          }

          if (type === EVENTS.TOUR_END || status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            stopTour(true);
            return;
          }

          if (type === EVENTS.ERROR) {
            // Soft-fail: advance past broken step when possible
            const next = Math.min(index + 1, (size || steps.length) - 1);
            if (next !== index) {
              setStepIndex(next);
              setLeadsTourProgress({ active: true, stepIndex: next });
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
        skip: 'Skip',
        open: 'Show tip',
      }}
    />
  );
};

export const LeadsTour: React.FC = () => (
  <TourErrorBoundary>
    <LeadsTourInner />
  </TourErrorBoundary>
);

/** Call from Leads header to replay the tour */
export function restartLeadsTour() {
  clearLeadsTourCompleted();
  clearLeadsTourProgress();
  window.dispatchEvent(new CustomEvent('crm-leads-tour-restart'));
}
