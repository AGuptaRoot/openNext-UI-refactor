import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-invoices-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:invoices';

export function getInvoicesTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setInvoicesTourProgress(patch) {
  try {
    const prev = getInvoicesTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearInvoicesTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedInvoicesTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markInvoicesTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearInvoicesTourProgress();
}

export function clearInvoicesTourCompleted() {
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
export function requestInvoicesArchiveView(mode) {
  window.dispatchEvent(
    new CustomEvent('crm-invoices-tour-archive', { detail: { archived: mode === 'archived' } })
  );
}

/** @param {'invoices'|'recurring'} tab */
export function requestInvoicesTourTab(tab) {
  window.dispatchEvent(
    new CustomEvent('crm-invoices-tour-tab', { detail: { tab } })
  );
}

export function requestInvoicesTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-invoices-tour-jump', { detail: detail || {} }));
}

export function firstInvoiceDetailPath() {
  try {
    const link = document.querySelector('[data-tour="invoices-row-first"] a[href*="/invoices/"]');
    if (link) {
      const href = String(link.getAttribute('href') || '');
      const match = href.match(/\/invoices\/[^/?#]+/);
      if (match) return match[0];
    }
    const row = document.querySelector('[data-tour="invoices-row-first"]');
    const id = row?.getAttribute('data-invoice-id');
    if (id) return `/invoices/${id}`;
  } catch {
    // ignore
  }
  return null;
}
