import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-audit-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:audit';

export function getAuditTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuditTourProgress(patch) {
  try {
    const prev = getAuditTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearAuditTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedAuditTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAuditTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearAuditTourProgress();
}

export function clearAuditTourCompleted() {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

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

export function requestAuditTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-audit-tour-jump', { detail: detail || {} }));
}
