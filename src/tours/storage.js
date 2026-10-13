const STORAGE_PREFIX = 'crm-tour-seen:v1:';
const MODULE_PROGRESS_KEY = 'crm-module-tour-progress:v1';

export function emitTourStateChange() {
  try {
    window.dispatchEvent(new CustomEvent('crm-tour-state'));
  } catch {
    // ignore
  }
}

/** Current HashRouter path without query (e.g. `/opportunities/abc`). */
export function getTourHashPath() {
  try {
    const hash = String(window.location.hash || '');
    return hash.replace(/^#/, '').split('?')[0] || '/';
  } catch {
    return '/';
  }
}

/**
 * Soft SPA navigate for tours. No-ops when already on the target path so
 * step `before` hooks do not remount the page on every Next click.
 */
export function requestTourNavigate(path) {
  try {
    const next = String(path || '').trim();
    if (!next) return;
    const current = getTourHashPath();
    const target = next.split('?')[0] || '/';
    if (current === target) return;
    window.dispatchEvent(new CustomEvent('crm-tour-navigate', { detail: { path: next } }));
  } catch {
    // ignore
  }
}

export function hasSeenTour(moduleId) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + moduleId) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen(moduleId) {
  try {
    localStorage.setItem(STORAGE_PREFIX + moduleId, '1');
  } catch {
    // ignore quota / private mode
  }
  clearModuleTourProgress();
  emitTourStateChange();
}

export function getModuleTourProgress() {
  try {
    const raw = sessionStorage.getItem(MODULE_PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setModuleTourProgress(patch) {
  try {
    const prev = getModuleTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(MODULE_PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearModuleTourProgress() {
  try {
    sessionStorage.removeItem(MODULE_PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

/** Dev helper — clear all CRM tour flags */
export function clearAllTours() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(MODULE_PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}
