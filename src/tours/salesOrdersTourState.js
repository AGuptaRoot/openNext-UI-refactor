import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-sales-orders-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:sales-orders';

export function getSalesOrdersTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSalesOrdersTourProgress(patch) {
  try {
    const prev = getSalesOrdersTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearSalesOrdersTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedSalesOrdersTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSalesOrdersTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearSalesOrdersTourProgress();
}

export function clearSalesOrdersTourCompleted() {
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

/** @param {string} tab — e.g. "All Orders", "Processing" */
export function requestSalesOrdersTourTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-sales-orders-tour-tab', { detail: { tab } }));
}

export function requestSalesOrdersTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-sales-orders-tour-jump', { detail: detail || {} }));
}

/** Prefer a rich mock order when present; otherwise first list row; else known mock id. */
export function firstSalesOrderDetailPath() {
  try {
    const preferred = document.querySelector('[data-sales-order-id="sales_order_3"]');
    if (preferred) return '/sales-orders/sales_order_3';

    const link = document.querySelector(
      '[data-tour="sales-orders-row-first"] a[href*="/sales-orders/"]'
    );
    if (link) {
      const href = String(link.getAttribute('href') || '');
      const match = href.match(/\/sales-orders\/[^/?#]+/);
      if (match) return match[0];
    }
    const row = document.querySelector('[data-tour="sales-orders-row-first"]');
    const id = row?.getAttribute('data-sales-order-id');
    if (id) return `/sales-orders/${id}`;
  } catch {
    // ignore
  }
  return '/sales-orders/sales_order_3';
}
