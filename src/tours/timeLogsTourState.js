import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-time-logs-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:time-logs';

export function getTimeLogsTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setTimeLogsTourProgress(patch) {
  try {
    const prev = getTimeLogsTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearTimeLogsTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedTimeLogsTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTimeLogsTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearTimeLogsTourProgress();
}

export function clearTimeLogsTourCompleted() {
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

export function requestTimeLogsView(view) {
  window.dispatchEvent(
    new CustomEvent('crm-time-logs-tour-view', { detail: { view } })
  );
}

/** @param {'manual'|'check-in'|null} mode */
export function requestTimeLogsModal(mode) {
  window.dispatchEvent(
    new CustomEvent('crm-time-logs-tour-modal', { detail: { mode } })
  );
}

export function requestTimeLogsTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-time-logs-tour-jump', { detail: detail || {} }));
}
