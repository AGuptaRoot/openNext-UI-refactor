import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Joyride, EVENTS, STATUS, ACTIONS } from 'react-joyride';
import type { EventData } from 'react-joyride';
import { ticketsTourSteps } from './steps/tickets.js';
import {
  clearTicketsTourCompleted,
  clearTicketsTourProgress,
  getTicketsTourProgress,
  hasCompletedTicketsTour,
  markTicketsTourCompleted,
  setTicketsTourProgress,
} from './ticketsTourState.js';
import { getOpportunitiesTourProgress } from './opportunitiesTourState.js';
import { getCustomerSuccessTourProgress } from './customerSuccessTourState.js';
import { getSamplesTourProgress } from './samplesTourState.js';
import { getSalesOrdersTourProgress } from './salesOrdersTourState.js';
import { getDataQualityTourProgress } from './dataQualityTourState.js';
import { getExpensesTourProgress } from './expensesTourState.js';
import { getInvoicesTourProgress } from './invoicesTourState.js';
import { getQuotationsTourProgress } from './quotationsTourState.js';
import { getTimeLogsTourProgress } from './timeLogsTourState.js';
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
    console.warn('[TicketsTour] disabled after error:', error.message);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function isTicketsTourRoute(pathname: string) {
  return pathname === '/tickets' || pathname.startsWith('/tickets/');
}

function upstreamTourActive() {
  return Boolean(
    getLeadsTourProgress()?.active ||
      getClientsTourProgress()?.active ||
      getProjectsTourProgress()?.active ||
      getTasksTourProgress()?.active ||
      getTimeLogsTourProgress()?.active ||
      getQuotationsTourProgress()?.active ||
      getInvoicesTourProgress()?.active ||
      getExpensesTourProgress()?.active ||
      getDataQualityTourProgress()?.active ||
      getSalesOrdersTourProgress()?.active ||
      getSamplesTourProgress()?.active ||
      getOpportunitiesTourProgress()?.active ||
      getCustomerSuccessTourProgress()?.active
  );
}

const TicketsTourInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const onTourRoute = isTicketsTourRoute(location.pathname);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourKey, setTourKey] = useState(0);

  const steps = useMemo(() => ticketsTourSteps, []);

  const startTour = useCallback((fromIndex = 0) => {
    clearTicketsTourCompleted();
    setTicketsTourProgress({ active: true, stepIndex: fromIndex });
    setStepIndex(fromIndex);
    setTourKey((k) => k + 1);
    setRun(true);
  }, []);

  const stopTour = useCallback((markDone: boolean) => {
    setRun(false);
    if (markDone) markTicketsTourCompleted();
    else clearTicketsTourProgress();
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
    const progress = getTicketsTourProgress();
    if (progress?.active) {
      setStepIndex(Number(progress.stepIndex) || 0);
      setRun(true);
      return;
    }
    if (hasCompletedTicketsTour()) {
      setRun(false);
      return;
    }
    if (location.pathname === '/tickets' || location.pathname.startsWith('/tickets/')) {
      const t = window.setTimeout(() => startTour(0), 700);
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
      navigate('/tickets');
      window.setTimeout(() => startTour(0), 300);
    };
    const onSkip = () => stopTour(true);
    const onResume = () => {
      const progress = getTicketsTourProgress();
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
        setTicketsTourProgress({ active: true, stepIndex: next });
        setRun(true);
      }
    };
    window.addEventListener('crm-tickets-tour-restart', onRestart);
    window.addEventListener('crm-tickets-tour-skip', onSkip);
    window.addEventListener('crm-tickets-tour-resume', onResume);
    window.addEventListener('crm-tickets-tour-jump', onJump as EventListener);
    return () => {
      window.removeEventListener('crm-tickets-tour-restart', onRestart);
      window.removeEventListener('crm-tickets-tour-skip', onSkip);
      window.removeEventListener('crm-tickets-tour-resume', onResume);
      window.removeEventListener('crm-tickets-tour-jump', onJump as EventListener);
    };
  }, [navigate, startTour, stopTour, steps.length]);

  useEffect(() => {
    const onState = () => {
      if (location.pathname !== '/tickets') return;
      if (upstreamTourActive()) return;
      if (hasCompletedTicketsTour()) return;
      if (getTicketsTourProgress()?.active) return;
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
            setTicketsTourProgress({ active: true, stepIndex: next });
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
              setTicketsTourProgress({ active: true, stepIndex: next });
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

export const TicketsTour: React.FC = () => (
  <TourErrorBoundary>
    <TicketsTourInner />
  </TourErrorBoundary>
);

export function restartTicketsTour() {
  clearTicketsTourCompleted();
  clearTicketsTourProgress();
  window.dispatchEvent(new CustomEvent('crm-tickets-tour-restart'));
}
