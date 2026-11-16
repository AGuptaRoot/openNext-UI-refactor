/**
 * CRM notifications — one place for every error, warning, info and success message.
 *
 * `notify.error('…')` works anywhere (components, services, the extension SDK); the
 * <CrmSnackbarHost /> mounted once in App shows it as an MUI Snackbar at the top right.
 */

export type NotifySeverity = 'success' | 'info' | 'warning' | 'error';

export type NotifyOptions = {
  /** Optional bold first line. */
  title?: string;
  /** Milliseconds before it hides; null keeps it until closed. Defaults by severity. */
  duration?: number | null;
};

export type NotifyItem = NotifyOptions & {
  id: number;
  message: string;
  severity: NotifySeverity;
};

type Listener = (items: NotifyItem[]) => void;

/** Most messages visible at once; the oldest closes first. */
const MAX_VISIBLE = 4;

let items: NotifyItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(items);
}

export function subscribeNotifications(listener: Listener): () => void {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissNotification(id: number) {
  const before = items.length;
  items = items.filter((item) => item.id !== id);
  if (items.length !== before) emit();
}

function show(severity: NotifySeverity, message: unknown, options: NotifyOptions = {}): number {
  const text = typeof message === 'string' ? message.trim() : String(message ?? '').trim();
  if (!text) return 0;
  // The same message already on screen is shown again (fresh timer) instead of stacking a copy.
  const same = items.find(
    (item) => item.severity === severity && item.message === text && item.title === options.title
  );
  const id = nextId++;
  items = [...items.filter((item) => item !== same), { ...options, id, message: text, severity }].slice(
    -MAX_VISIBLE
  );
  emit();
  return id;
}

/** The readable message of a thrown value, or the fallback. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export const notify = {
  success: (message: string, options?: NotifyOptions) => show('success', message, options),
  info: (message: string, options?: NotifyOptions) => show('info', message, options),
  warning: (message: string, options?: NotifyOptions) => show('warning', message, options),
  error: (message: string, options?: NotifyOptions) => show('error', message, options),
  /** Shows a caught error: its message, or the fallback when it has none. */
  fromError: (error: unknown, fallback?: string, options?: NotifyOptions) =>
    show('error', errorMessage(error, fallback), options),
  show,
  dismiss: dismissNotification,
};

export type Notify = typeof notify;
