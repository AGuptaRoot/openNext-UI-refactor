import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-quotations-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:quotations';

export function getQuotationsTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setQuotationsTourProgress(patch) {
  try {
    const prev = getQuotationsTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearQuotationsTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedQuotationsTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markQuotationsTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearQuotationsTourProgress();
}

export function clearQuotationsTourCompleted() {
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

/** @param {'active'|'archived'} mode */
export function requestQuotationsArchiveView(mode) {
  window.dispatchEvent(
    new CustomEvent('crm-quotations-tour-archive', { detail: { archived: mode === 'archived' } })
  );
}

export function requestQuotationsTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-quotations-tour-jump', { detail: detail || {} }));
}

export function firstQuotationDetailPath() {
  try {
    const link = document.querySelector('[data-tour="quotations-row-first"] a[href*="/quotations/"]');
    if (link) {
      const href = String(link.getAttribute('href') || '');
      const match = href.match(/\/quotations\/[^/?#]+/);
      if (match) return match[0];
    }
    const row = document.querySelector('[data-tour="quotations-row-first"]');
    const id = row?.getAttribute('data-quotation-id');
    if (id) return `/quotations/${id}`;
  } catch {
    // ignore
  }
  return null;
}
