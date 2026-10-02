import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DEFAULT_DURATION_MS = 6000;
const MAX_TOASTS = 4;

/**
 * Floating error toasts, top-right. Each one dismisses itself when its progress
 * bar runs out; hovering or focusing it pauses the bar (and so the dismissal),
 * because the bar's CSS animation is what ends it.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const error = useCallback((message, { duration = DEFAULT_DURATION_MS } = {}) => {
    const id = ++nextId.current;
    setToasts((list) =>
      // The same message again replaces the old toast (restarting its timer).
      [...list.filter((t) => t.message !== message), { id, message, duration }].slice(-MAX_TOASTS),
    );
    return id;
  }, []);

  const api = useMemo(() => ({ error, dismiss }), [error, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

function Toast({ toast, onDismiss }) {
  return (
    <div
      role="alert"
      className="toast-enter group pointer-events-auto overflow-hidden rounded-lg bg-red-600 text-white shadow-lg ring-1 ring-red-700/40 dark:bg-red-700 dark:ring-red-500/30"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-red-100"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
        <p className="flex-1 text-sm leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 rounded p-1 text-red-100 hover:bg-red-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 dark:hover:bg-red-800"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
      <div className="h-1 bg-red-900/30">
        <div
          className="toast-progress h-full bg-white/70 group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]"
          style={{ animationDuration: `${toast.duration}ms` }}
          onAnimationEnd={() => onDismiss(toast.id)}
        />
      </div>
    </div>
  );
}
