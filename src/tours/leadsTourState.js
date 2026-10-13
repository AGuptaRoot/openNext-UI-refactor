import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };
const PROGRESS_KEY = 'crm-leads-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:leads';

export function getLeadsTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLeadsTourProgress(patch) {
  try {
    const prev = getLeadsTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearLeadsTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedLeadsTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLeadsTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearLeadsTourProgress();
}

export function clearLeadsTourCompleted() {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

/** Soft-wait for a selector (resolves null on timeout — never throws). */
export function waitForSelector(selector, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      try {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
          return;
        }
      } catch {
        // ignore
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 80);
    };
    tick();
  });
}

export function requestLeadsView(view) {
  window.dispatchEvent(new CustomEvent('crm-leads-tour-view', { detail: { view } }));
}

export function requestLeadDetailTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-leads-tour-tab', { detail: { tab } }));
}

/** Jump Joyride to a step index, or finish when `{ finish: true }`. */
export function requestLeadsTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-leads-tour-jump', { detail: detail || {} }));
}
