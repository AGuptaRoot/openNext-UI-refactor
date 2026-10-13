import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };
const PROGRESS_KEY = 'crm-clients-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:clients';

export function getClientsTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setClientsTourProgress(patch) {
  try {
    const prev = getClientsTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearClientsTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedClientsTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markClientsTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearClientsTourProgress();
}

export function clearClientsTourCompleted() {
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

export function requestClientDetailTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-clients-tour-tab', { detail: { tab } }));
}

/** Jump Joyride to a step index, or finish when `{ finish: true }`. */
export function requestClientsTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-clients-tour-jump', { detail: detail || {} }));
}
