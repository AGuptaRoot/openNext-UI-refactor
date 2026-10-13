import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-tickets-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:tickets';

export function getTicketsTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setTicketsTourProgress(patch) {
  try {
    const prev = getTicketsTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearTicketsTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedTicketsTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTicketsTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearTicketsTourProgress();
}

export function clearTicketsTourCompleted() {
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

/** @param {'table'|'kanban'} view */
export function requestTicketsTourView(view) {
  window.dispatchEvent(new CustomEvent('crm-tickets-tour-view', { detail: { view } }));
}

/** @param {'active'|'archived'} archive */
export function requestTicketsTourArchive(archive) {
  window.dispatchEvent(new CustomEvent('crm-tickets-tour-archive', { detail: { archive } }));
}

/** @param {'conversation'|'timeline'|'watchers'} tab */
export function requestTicketsTourTab(tab) {
  window.dispatchEvent(new CustomEvent('crm-tickets-tour-tab', { detail: { tab } }));
}

export function requestTicketsTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-tickets-tour-jump', { detail: detail || {} }));
}

export function firstTicketDetailPath() {
  try {
    const link = document.querySelector(
      '[data-tour="tickets-row-first"] a[href*="/tickets/"]'
    );
    if (link) {
      const href = String(link.getAttribute('href') || '');
      const match = href.match(/\/tickets\/[^/?#]+/);
      if (match && !match[0].endsWith('/create')) return match[0];
    }
    const row = document.querySelector('[data-tour="tickets-row-first"]');
    const id = row?.getAttribute('data-ticket-id');
    if (id) return `/tickets/${id}`;
  } catch {
    // ignore
  }
  return null;
}
