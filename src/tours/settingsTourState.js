import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-settings-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:settings';

export function getSettingsTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSettingsTourProgress(patch) {
  try {
    const prev = getSettingsTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearSettingsTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedSettingsTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSettingsTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearSettingsTourProgress();
}

export function clearSettingsTourCompleted() {
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

/** @param {'general'|'shipping'|'finance'|'email'|'projects'|'leads'|'clients'|'users'} tab */
export function requestSettingsTourTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-settings-tour-tab', { detail: { tab } }));
}

export function requestSettingsTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-settings-tour-jump', { detail: detail || {} }));
}
