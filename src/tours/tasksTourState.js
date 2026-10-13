import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };
const PROGRESS_KEY = 'crm-tasks-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:tasks';

export function getTasksTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setTasksTourProgress(patch) {
  try {
    const prev = getTasksTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearTasksTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedTasksTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTasksTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearTasksTourProgress();
}

export function clearTasksTourCompleted() {
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

export function requestTasksView(view) {
  window.dispatchEvent(new CustomEvent('crm-tasks-tour-view', { detail: { view } }));
}

export function requestTaskDetailTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-tasks-tour-tab', { detail: { tab } }));
}

export function requestTasksTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-tasks-tour-jump', { detail: detail || {} }));
}

export function requestTasksExportMenu(open) {
  window.dispatchEvent(
    new CustomEvent('crm-tasks-tour-export-menu', { detail: { open: Boolean(open) } })
  );
}

export function requestTasksTemplatesOpen(open) {
  window.dispatchEvent(
    new CustomEvent('crm-tasks-tour-templates', { detail: { open: Boolean(open) } })
  );
}

export function requestTasksRecurringOpen(open) {
  window.dispatchEvent(
    new CustomEvent('crm-tasks-tour-recurring', { detail: { open: Boolean(open) } })
  );
}
