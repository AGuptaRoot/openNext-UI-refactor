import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { crmApi } from '../../services/api';
import type { CrmNotification } from '../../types/notifications';

/** How often the bell checks for new alerts while the CRM is open. */
const POLL_MS = 5 * 60 * 1000;

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * In-app notifications of the signed-in user (CRM 3.33.0, GET /notifications): a bell with the unread
 * count; the panel lists the newest alerts with their link (e.g. "View Traveller"). Opening a link
 * marks the alert read. Staff only — the caller does not render it for client users.
 */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<CrmNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await crmApi.getNotifications();
      setItems(res.data?.items || []);
      setUnread(Number(res.data?.unread) || 0);
    } catch {
      // A bell that cannot load must never interrupt the app.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markRead = async (item: CrmNotification) => {
    if (item.read) return;
    setItems((list) => list.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    setUnread((n) => Math.max(0, n - 1));
    await crmApi.markNotificationRead(item.id).catch(() => undefined);
  };

  const openLink = (item: CrmNotification) => {
    void markRead(item);
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  const readAll = async () => {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await crmApi.markAllNotificationsRead().catch(() => undefined);
  };

  return (
    <div ref={boxRef} className="relative shrink-0" data-testid="crm-notifications">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-10 z-[80] w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
            <span className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Notifications</span>
            {unread ? (
              <button type="button" onClick={() => void readAll()} className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-blue-700 hover:underline">
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length ? (
            <ul className="m-0 max-h-[24rem] list-none overflow-y-auto p-0">
              {items.map((item) => (
                <li key={item.id} className={`border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800 ${item.read ? '' : 'bg-blue-50/60 dark:bg-blue-950/30'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50">{item.title}</span>
                    <span className="shrink-0 text-[10px] text-zinc-500">{when(item.createdAt)}</span>
                  </div>
                  {item.message ? <p className="m-0 mt-1 text-xs text-zinc-700 dark:text-zinc-300">{item.message}</p> : null}
                  <div className="mt-2 flex items-center gap-3">
                    {item.link ? (
                      <button type="button" onClick={() => openLink(item)} className="cursor-pointer rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                        {item.linkLabel || 'Open'}
                      </button>
                    ) : null}
                    {!item.read ? (
                      <button type="button" onClick={() => void markRead(item)} className="cursor-pointer border-0 bg-transparent text-[11px] text-zinc-500 hover:underline">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 px-4 py-6 text-center text-xs text-zinc-500">No notifications yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
};
