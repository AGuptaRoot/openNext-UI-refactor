import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-data-quality-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:data-quality';

export function getDataQualityTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setDataQualityTourProgress(patch) {
  try {
    const prev = getDataQualityTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearDataQualityTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedDataQualityTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markDataQualityTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearDataQualityTourProgress();
}

export function clearDataQualityTourCompleted() {
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

/** @param {'duplicates'|'low-quality'} view */
export function requestDataQualityTourView(view) {
  window.dispatchEvent(new CustomEvent('crm-data-quality-tour-view', { detail: { view } }));
}

/** @param {boolean} open */
export function requestDataQualityRulesModal(open) {
  window.dispatchEvent(
    new CustomEvent('crm-data-quality-tour-rules', { detail: { open: Boolean(open) } })
  );
}

/** @param {boolean} open */
export function requestDataQualityExportMenu(open) {
  window.dispatchEvent(
    new CustomEvent('crm-data-quality-tour-export', { detail: { open: Boolean(open) } })
  );
}

export function requestDataQualityTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-data-quality-tour-jump', { detail: detail || {} }));
}
