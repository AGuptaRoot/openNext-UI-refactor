import React, { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Slide from '@mui/material/Slide';
import type { SlideProps } from '@mui/material/Slide';
import Snackbar from '@mui/material/Snackbar';
import type { SnackbarCloseReason } from '@mui/material/Snackbar';
import {
  dismissNotification,
  notify,
  subscribeNotifications,
  type Notify,
  type NotifyItem,
  type NotifySeverity,
} from './notify';

const DEFAULT_DURATION: Record<NotifySeverity, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 7000,
};

function SlideFromRight(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

const CrmSnackbarItem: React.FC<{ item: NotifyItem }> = ({ item }) => {
  const [open, setOpen] = useState(true);
  const duration = item.duration === undefined ? DEFAULT_DURATION[item.severity] : item.duration;

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
    // A click elsewhere on the page must not hide a message the user has not read.
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={handleClose}
      TransitionComponent={SlideFromRight}
      TransitionProps={{ onExited: () => dismissNotification(item.id) }}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      // The host stacks the snackbars, so each one is not fixed on its own.
      sx={{ position: 'static', transform: 'none', inset: 'auto', pointerEvents: 'auto' }}
    >
      <Alert
        onClose={() => handleClose()}
        severity={item.severity}
        variant="filled"
        role={item.severity === 'error' || item.severity === 'warning' ? 'alert' : 'status'}
        data-testid={`crm-snackbar-${item.severity}`}
        sx={{
          width: '100%',
          alignItems: 'flex-start',
          fontSize: 13,
          lineHeight: 1.45,
          boxShadow: 6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {item.title ? <AlertTitle sx={{ fontSize: 13, fontWeight: 700, mb: 0.25 }}>{item.title}</AlertTitle> : null}
        {item.message}
      </Alert>
    </Snackbar>
  );
};

/** Mounted once in App: shows every CRM notification as a Snackbar stack at the top right. */
export const CrmSnackbarHost: React.FC = () => {
  const [items, setItems] = useState<NotifyItem[]>([]);
  useEffect(() => subscribeNotifications(setItems), []);
  if (!items.length) return null;
  return (
    <div
      className="crm-snackbar-host"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 'min(380px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}
    >
      {items.map((item) => (
        <CrmSnackbarItem key={item.id} item={item} />
      ))}
    </div>
  );
};

/** `const notify = useNotify(); notify.error('…')`. */
export function useNotify(): Notify {
  return notify;
}

/**
 * Shows a message held in state (e.g. `const [error, setError] = useState<string | null>(null)`)
 * as a snackbar each time it changes to a new non-empty value.
 * Pass `clear` (e.g. `() => setError(null)`) to empty the state once shown, so the same message
 * set again shows again.
 */
export function useNotifyMessage(
  message: string | null | undefined | false,
  severity: NotifySeverity = 'error',
  clear?: () => void
): void {
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useEffect(() => {
    if (!message) return;
    notify.show(severity, message);
    clearRef.current?.();
  }, [message, severity]);
}
