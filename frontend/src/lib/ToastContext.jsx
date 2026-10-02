import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DURATION_MS = { error: 6000, success: 4000 };
const MAX_TOASTS = 4;

const STYLES = {
  error: {
    role: 'alert',
    box: 'bg-red-600 ring-red-700/40 dark:bg-red-700 dark:ring-red-500/30',
    icon: 'text-red-100',
    close: 'text-red-100 hover:bg-red-700 dark:hover:bg-red-800',
    track: 'bg-red-900/30',
    // Exclamation circle.
    path: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  },
  success: {
    role: 'status',
    box: 'bg-teal-600 ring-teal-700/40 dark:bg-teal-700 dark:ring-teal-500/30',
    icon: 'text-teal-100',
    close: 'text-teal-100 hover:bg-teal-700 dark:hover:bg-teal-800',
    track: 'bg-teal-900/30',
    // Check circle.
    path: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z',
  },
};

/**
 * Floating toasts (errors and successes), top-right. Each one dismisses itself
 * when its progress bar runs out; hovering or focusing it pauses the bar (and
 * so the dismissal), because the bar's CSS animation is what ends it.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((kind, message, { duration = DURATION_MS[kind] } = {}) => {
    const id = ++nextId.current;
    setToasts((list) =>
      // The same message again replaces the old toast (restarting its timer).
      [...list.filter((t) => t.message !== message), { id, kind, message, duration }].slice(
        -MAX_TOASTS,
      ),
    );
    return id;
  }, []);

  const api = useMemo(
    () => ({
      error: (message, opts) => show('error', message, opts),
      success: (message, opts) => show('success', message, opts),
      dismiss,
    }),
    [show, dismiss],
  );

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
  const s = STYLES[toast.kind];
  return (
    <div
      role={s.role}
      className={`toast-enter group pointer-events-auto overflow-hidden rounded-lg text-white shadow-lg ring-1 ${s.box}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`mt-0.5 size-5 shrink-0 ${s.icon}`}
        >
          <path fillRule="evenodd" d={s.path} clipRule="evenodd" />
        </svg>
        <p className="flex-1 text-sm leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          className={`-mr-1 -mt-0.5 rounded p-1 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${s.close}`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
      <div className={`h-1 ${s.track}`}>
        <div
          className="toast-progress h-full bg-white/70 group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]"
          style={{ animationDuration: `${toast.duration}ms` }}
          onAnimationEnd={() => onDismiss(toast.id)}
        />
      </div>
    </div>
  );
}
