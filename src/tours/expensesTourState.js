import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-expenses-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:expenses';

export function getExpensesTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setExpensesTourProgress(patch) {
  try {
    const prev = getExpensesTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearExpensesTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedExpensesTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markExpensesTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearExpensesTourProgress();
}

export function clearExpensesTourCompleted() {
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
export function requestExpensesArchiveView(mode) {
  window.dispatchEvent(
    new CustomEvent('crm-expenses-tour-archive', {
      detail: { archived: mode === 'archived' },
    })
  );
}

/** @param {'expenses'|'recurring'} tab */
export function requestExpensesTourTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-expenses-tour-tab', { detail: { tab } }));
}

export function requestExpensesTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-expenses-tour-jump', { detail: detail || {} }));
}

export function firstExpenseDetailPath() {
  try {
    const link = document.querySelector('[data-tour="expenses-row-first"] a[href*="/expenses/"]');
    if (link) {
      const href = String(link.getAttribute('href') || '');
      const match = href.match(/\/expenses\/[^/?#]+/);
      if (match) return match[0];
    }
    const row = document.querySelector('[data-tour="expenses-row-first"]');
    const id = row?.getAttribute('data-expense-id');
    if (id) return `/expenses/${id}`;
  } catch {
    // ignore
  }
  return null;
}
