import React, { Component, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Joyride, EVENTS, STATUS } from 'react-joyride';
import type { EventData } from 'react-joyride';
import { getTourSteps, resolveModuleIdFromPath } from './registry.js';
import {
  clearModuleTourProgress,
  hasSeenTour,
  markTourSeen,
  setModuleTourProgress,
} from './storage.js';
import { getClientsTourProgress } from './clientsTourState.js';
import { getLeadsTourProgress } from './leadsTourState.js';
import { getProjectsTourProgress } from './projectsTourState.js';
import { getTasksTourProgress } from './tasksTourState.js';
import { getTimeLogsTourProgress } from './timeLogsTourState.js';
import { getQuotationsTourProgress } from './quotationsTourState.js';
import { getInvoicesTourProgress } from './invoicesTourState.js';
import { getExpensesTourProgress } from './expensesTourState.js';
import { getDataQualityTourProgress } from './dataQualityTourState.js';
import { getSalesOrdersTourProgress } from './salesOrdersTourState.js';
import { getSamplesTourProgress } from './samplesTourState.js';
import { getOpportunitiesTourProgress } from './opportunitiesTourState.js';
import { getTicketsTourProgress } from './ticketsTourState.js';
import { getCustomerSuccessTourProgress } from './customerSuccessTourState.js';
import { getMarketingTourProgress } from './marketingTourState.js';
import { getAuditTourProgress } from './auditTourState.js';
import { getSettingsTourProgress } from './settingsTourState.js';

function dedicatedTourActive() {
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
      getTicketsTourProgress()?.active ||
      getCustomerSuccessTourProgress()?.active ||
      getMarketingTourProgress()?.active ||
      getAuditTourProgress()?.active ||
      getSettingsTourProgress()?.active
  );
}
/** Isolates Joyride failures so CRM pages keep working. */
class TourErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[ModuleTour] disabled after error:', error.message);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * First-visit Joyride per module. UI-only:
 * - Does not call CRM APIs
 * - Does not change auth, timers, forms, or page state
 * - Only reads/writes localStorage tour flags
 */
const ModuleTourInner: React.FC = () => {
  const location = useLocation();
  const moduleId = useMemo(
    () => resolveModuleIdFromPath(location.pathname),
    [location.pathname]
  );
  const steps = useMemo(() => getTourSteps(moduleId), [moduleId]);
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!moduleId || !steps?.length) {
      setRun(false);
      return;
    }
    // Yield while dedicated Beacon tours finish (e.g. Clients → Projects)
    if (dedicatedTourActive()) {
      setRun(false);
      return;
    }
    if (hasSeenTour(moduleId)) {
      setRun(false);
      clearModuleTourProgress();
      return;
    }
    const t = window.setTimeout(() => {
      if (dedicatedTourActive()) {
        setRun(false);
        return;
      }
      setModuleTourProgress({ active: true, moduleId });
      setRun(true);
    }, 450);
    return () => window.clearTimeout(t);
  }, [moduleId, steps]);

  // Re-check after dedicated tours clear progress
  useEffect(() => {
    const onState = () => {
      if (!moduleId || !steps?.length) return;
      if (dedicatedTourActive()) {
        setRun(false);
        return;
      }
      if (hasSeenTour(moduleId)) return;
      if (!run) {
        setModuleTourProgress({ active: true, moduleId });
        setRun(true);
      }
    };
    window.addEventListener('crm-tour-state', onState);
    return () => window.removeEventListener('crm-tour-state', onState);
  }, [moduleId, steps, run]);

  // Top bar Stop / Skip
  useEffect(() => {
    const onStop = () => {
      clearModuleTourProgress();
      setRun(false);
    };
    const onSkip = (e: Event) => {
      const id =
        (e as CustomEvent<{ moduleId?: string }>).detail?.moduleId || moduleId;
      if (id) markTourSeen(id);
      setRun(false);
    };
    window.addEventListener('crm-module-tour-stop', onStop);
    window.addEventListener('crm-module-tour-skip', onSkip);
    return () => {
      window.removeEventListener('crm-module-tour-stop', onStop);
      window.removeEventListener('crm-module-tour-skip', onSkip);
    };
  }, [moduleId]);

  // Excluded modules (dashboard, reports, etc.) resolve to no steps
  if (!moduleId || !steps?.length) return null;

  const finishTour = () => {
    markTourSeen(moduleId);
    setRun(false);
  };

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      scrollToFirstStep
      onEvent={(data: EventData) => {
        try {
          const { type, status } = data;
          if (
            type === EVENTS.TOUR_END ||
            type === EVENTS.ERROR ||
            type === EVENTS.TARGET_NOT_FOUND ||
            status === STATUS.FINISHED ||
            status === STATUS.SKIPPED
          ) {
            // Mark seen on end/skip; also stop on target errors so UI is never stuck
            if (
              type === EVENTS.TOUR_END ||
              status === STATUS.FINISHED ||
              status === STATUS.SKIPPED
            ) {
              finishTour();
            } else if (type === EVENTS.ERROR) {
              setRun(false);
            }
          }
        } catch {
          setRun(false);
        }
      }}
      options={{
        skipBeacon: true,
        primaryColor: '#ff7300',
        zIndex: 10000,
        // Allow clicking CRM controls under the spotlight if needed
        blockTargetInteraction: false,
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
};

export const ModuleTour: React.FC = () => (
  <TourErrorBoundary>
    <ModuleTourInner />
  </TourErrorBoundary>
);
