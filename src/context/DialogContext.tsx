import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CloseIcon from '@mui/icons-material/Close';

export type AlertOptions = {
  title?: string;
  message: string;
  okLabel?: string;
};

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use danger styling for destructive actions */
  tone?: 'default' | 'danger';
};

export type PromptOptions = {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, empty input cannot submit */
  required?: boolean;
  inputLabel?: string;
};

type DialogApi = {
  alert: (messageOrOptions: string | AlertOptions) => Promise<void>;
  confirm: (messageOrOptions: string | ConfirmOptions) => Promise<boolean>;
  prompt: (
    messageOrOptions: string | PromptOptions,
    defaultValue?: string
  ) => Promise<string | null>;
};

type DialogState =
  | {
      kind: 'alert';
      options: Required<Pick<AlertOptions, 'message'>> & AlertOptions;
      resolve: (value: void) => void;
    }
  | {
      kind: 'confirm';
      options: Required<Pick<ConfirmOptions, 'message'>> & ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'prompt';
      options: Required<Pick<PromptOptions, 'message'>> & PromptOptions;
      resolve: (value: string | null) => void;
    }
  | null;

const DialogContext = createContext<DialogApi | null>(null);

function normalizeAlert(input: string | AlertOptions): AlertOptions {
  return typeof input === 'string' ? { message: input } : input;
}

function normalizeConfirm(input: string | ConfirmOptions): ConfirmOptions {
  return typeof input === 'string' ? { message: input } : input;
}

function normalizePrompt(
  input: string | PromptOptions,
  defaultValue?: string
): PromptOptions {
  if (typeof input === 'string') {
    return { message: input, defaultValue: defaultValue ?? '' };
  }
  return {
    ...input,
    defaultValue: input.defaultValue ?? defaultValue ?? '',
  };
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<DialogState[]>([]);

  const showNext = useCallback(() => {
    setDialog((current) => {
      if (current) return current;
      const next = queueRef.current.shift() || null;
      if (next?.kind === 'prompt') {
        setPromptValue(next.options.defaultValue || '');
        setPromptError(null);
      }
      return next;
    });
  }, []);

  const enqueue = useCallback(
    (entry: Exclude<DialogState, null>) => {
      queueRef.current.push(entry);
      showNext();
    },
    [showNext]
  );

  const closeAndContinue = useCallback(() => {
    setDialog(null);
    setPromptError(null);
    // Allow React to unmount current dialog before opening next
    window.setTimeout(() => showNext(), 0);
  }, [showNext]);

  const alertFn = useCallback(
    (messageOrOptions: string | AlertOptions) =>
      new Promise<void>((resolve) => {
        enqueue({ kind: 'alert', options: normalizeAlert(messageOrOptions), resolve });
      }),
    [enqueue]
  );

  const confirmFn = useCallback(
    (messageOrOptions: string | ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        enqueue({ kind: 'confirm', options: normalizeConfirm(messageOrOptions), resolve });
      }),
    [enqueue]
  );

  const promptFn = useCallback(
    (messageOrOptions: string | PromptOptions, defaultValue?: string) =>
      new Promise<string | null>((resolve) => {
        enqueue({
          kind: 'prompt',
          options: normalizePrompt(messageOrOptions, defaultValue),
          resolve,
        });
      }),
    [enqueue]
  );

  const api = useMemo<DialogApi>(
    () => ({ alert: alertFn, confirm: confirmFn, prompt: promptFn }),
    [alertFn, confirmFn, promptFn]
  );

  useEffect(() => {
    if (!dialog) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (dialog.kind === 'alert') {
        dialog.resolve();
        closeAndContinue();
      } else if (dialog.kind === 'confirm') {
        dialog.resolve(false);
        closeAndContinue();
      } else {
        dialog.resolve(null);
        closeAndContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, closeAndContinue]);

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [dialog]);

  const title =
    dialog?.options.title ||
    (dialog?.kind === 'alert'
      ? 'Notice'
      : dialog?.kind === 'confirm'
      ? 'Please confirm'
      : dialog?.kind === 'prompt'
      ? 'Input required'
      : '');

  const isDanger = dialog?.kind === 'confirm' && dialog.options.tone === 'danger';

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4 backdrop-blur-[1px]"
          role="presentation"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (dialog.kind === 'alert') {
              dialog.resolve();
              closeAndContinue();
            } else if (dialog.kind === 'confirm') {
              dialog.resolve(false);
              closeAndContinue();
            } else {
              dialog.resolve(null);
              closeAndContinue();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="crm-dialog-title"
            aria-describedby="crm-dialog-message"
            className="bg-white border border-zinc-300 rounded-xl max-w-md w-full p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
              <h3 id="crm-dialog-title" className="text-sm font-bold text-zinc-950 m-0">
                {title}
              </h3>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950 cursor-pointer bg-transparent"
                onClick={() => {
                  if (dialog.kind === 'alert') dialog.resolve();
                  else if (dialog.kind === 'confirm') dialog.resolve(false);
                  else dialog.resolve(null);
                  closeAndContinue();
                }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>

            <p id="crm-dialog-message" className="text-sm text-zinc-700 m-0 mt-3 whitespace-pre-wrap">
              {dialog.options.message}
            </p>

            {dialog.kind === 'prompt' && (
              <div className="mt-3 flex flex-col gap-1.5">
                {dialog.options.inputLabel && (
                  <label htmlFor="crm-dialog-prompt-input" className="text-[11px] font-semibold uppercase text-zinc-500">
                    {dialog.options.inputLabel}
                  </label>
                )}
                <input
                  ref={inputRef}
                  id="crm-dialog-prompt-input"
                  type="text"
                  value={promptValue}
                  placeholder={dialog.options.placeholder || ''}
                  onChange={(e) => {
                    setPromptValue(e.target.value);
                    if (promptError) setPromptError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = promptValue.trim();
                      if (dialog.options.required && !trimmed) {
                        setPromptError('This field cannot be empty');
                        return;
                      }
                      dialog.resolve(promptValue);
                      closeAndContinue();
                    }
                  }}
                  className="h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white"
                />
                {promptError && (
                  <p className="m-0 text-xs font-semibold text-red-600">{promptError}</p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {dialog.kind !== 'alert' && (
                <button
                  type="button"
                  className="inline-flex h-9 items-center px-3.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-800 cursor-pointer hover:bg-zinc-50"
                  onClick={() => {
                    if (dialog.kind === 'confirm') dialog.resolve(false);
                    else dialog.resolve(null);
                    closeAndContinue();
                  }}
                >
                  {dialog.options.cancelLabel || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                className={`inline-flex h-9 items-center px-3.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                  isDanger
                    ? 'border-red-700 bg-red-700 text-white hover:bg-red-800'
                    : 'border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800'
                }`}
                onClick={() => {
                  if (dialog.kind === 'alert') {
                    dialog.resolve();
                    closeAndContinue();
                    return;
                  }
                  if (dialog.kind === 'confirm') {
                    dialog.resolve(true);
                    closeAndContinue();
                    return;
                  }
                  const trimmed = promptValue.trim();
                  if (dialog.options.required && !trimmed) {
                    setPromptError('This field cannot be empty');
                    return;
                  }
                  dialog.resolve(promptValue);
                  closeAndContinue();
                }}
              >
                {dialog.kind === 'alert'
                  ? dialog.options.okLabel || 'OK'
                  : dialog.kind === 'confirm'
                  ? dialog.options.confirmLabel || 'Confirm'
                  : dialog.options.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}
