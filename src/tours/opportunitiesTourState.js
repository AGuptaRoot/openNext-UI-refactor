import { emitTourStateChange, requestTourNavigate } from './storage.js';
export { requestTourNavigate };

const PROGRESS_KEY = 'crm-opportunities-tour-progress:v1';
const SEEN_KEY = 'crm-tour-seen:v1:opportunities';

export function getOpportunitiesTourProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setOpportunitiesTourProgress(patch) {
  try {
    const prev = getOpportunitiesTourProgress() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    emitTourStateChange();
    return next;
  } catch {
    return null;
  }
}

export function clearOpportunitiesTourProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
  emitTourStateChange();
}

export function hasCompletedOpportunitiesTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOpportunitiesTourCompleted() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
  clearOpportunitiesTourProgress();
}

export function clearOpportunitiesTourCompleted() {
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

/** @param {string} stage — empty string for All */
export function requestOpportunitiesTourStage(stage) {
  window.dispatchEvent(
    new CustomEvent('crm-opportunities-tour-stage', { detail: { stage: stage || '' } })
  );
}

export function requestOpportunitiesTourJump(detail) {
  window.dispatchEvent(new CustomEvent('crm-opportunities-tour-jump', { detail: detail || {} }));
}

/** First deal row → detail path for Beacon tour. */
export function firstOpportunityDetailPath() {
  try {
    const link = document.querySelector(
      '[data-tour="opportunities-row-first"] a[href*="/opportunities/"]'
    );
    if (link) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/opportunities\/([^/?#]+)/);
      if (match?.[1] && match[1] !== 'create') return `/opportunities/${match[1]}`;
    }
    const row = document.querySelector('[data-tour="opportunities-row-first"]');
    const id = row?.getAttribute('data-opportunity-id');
    if (id) return `/opportunities/${id}`;
  } catch {
    // ignore
  }
  return null;
}
