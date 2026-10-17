import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-contacts-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:contacts';

export function getContactsTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setContactsTourProgress(patch) {
  try {
    const prev = getContactsTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearContactsTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedContactsTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markContactsTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearContactsTourProgress();
}

export function clearContactsTourCompleted() {
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

export function requestContactsTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-contacts-tour-jump', { detail: detail || {} }));
}

export function firstContactDetailPath() {
  try {
    const link = document.querySelector(
      '[data-tour="contacts-row-first"] a[href*="/contacts/"]'
    );
    if (link) {
      const href = String(link.getAttribute('href') || '');
      const match = href.match(/\/contacts\/[^/?#]+/);
      if (match && !match[0].endsWith('/create')) return match[0];
    }
    const row = document.querySelector('[data-tour="contacts-row-first"]');
    const id = row?.getAttribute('data-contact-id');
    if (id) return `/contacts/${id}`;
  } catch {
    // ignore
  }
  return null;
}
