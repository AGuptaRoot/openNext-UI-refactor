import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-marketing-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:marketing';

export function getMarketingTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setMarketingTourProgress(patch) {
  try {
    const prev = getMarketingTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearMarketingTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedMarketingTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markMarketingTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearMarketingTourProgress();
}

export function clearMarketingTourCompleted() {
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

/** @param {'campaigns'|'analytics'} tab */
export function requestMarketingTourTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-marketing-tour-tab', { detail: { tab } }));
}

/**
 * Open/close the Create Campaign modal (tour-only; does not save).
 * @param {{ open?: boolean }} detail
 */
export function requestMarketingTourCreateModal(detail) {
  window.dispatchEvent(
    new CustomEvent('crm-marketing-tour-create', { detail: detail || {} })
  );
}

export function requestMarketingTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-marketing-tour-jump', { detail: detail || {} }));
}
