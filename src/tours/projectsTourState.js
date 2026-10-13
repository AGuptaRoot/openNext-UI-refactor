import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };
const PROGRESS_KEY = 'crm-projects-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:projects';

export function getProjectsTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setProjectsTourProgress(patch) {
  try {
    const prev = getProjectsTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearProjectsTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedProjectsTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markProjectsTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearProjectsTourProgress();
}

export function clearProjectsTourCompleted() {
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

export function requestProjectsView(view) {
  window.dispatchEvent(new CustomEvent('crm-projects-tour-view', { detail: { view } }));
}

export function requestProjectDetailTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-projects-tour-tab', { detail: { tab } }));
}

export function requestProjectsTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-projects-tour-jump', { detail: detail || {} }));
}

/** Open/close the listing Export menu (tour-only). */
export function requestProjectsExportMenu(open) {
  window.dispatchEvent(
    new CustomEvent('crm-projects-tour-export-menu', { detail: { open: Boolean(open) } })
  );
}

/** Open/close the Templates modal (tour-only). */
export function requestProjectsTemplatesOpen(open) {
  window.dispatchEvent(
    new CustomEvent('crm-projects-tour-templates', { detail: { open: Boolean(open) } })
  );
}

/** Switch Templates modal between list and create/edit form (tour-only). */
export function requestProjectsTemplatesView(view) {
  window.dispatchEvent(
    new CustomEvent('crm-projects-tour-templates-view', { detail: { view } })
  );
}

/** Set listing Archive filter: 'false' | 'true' | 'all' (tour-only). */
export function requestProjectsArchiveFilter(filter) {
  window.dispatchEvent(
    new CustomEvent('crm-projects-tour-archive', { detail: { filter } })
  );
}
