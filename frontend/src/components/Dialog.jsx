import { useEffect, useId, useRef } from 'react';

/**
 * A modal dialog: Escape or a click on the backdrop closes it, the first field
 * (or button) gets focus, and the page behind it doesn't scroll. Toasts sit
 * above it (z-50), so a failed save still shows its error.
 */
export function Dialog({ title, onClose, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  // Read through a ref so a parent re-render (new onClose) doesn't re-run the
  // effect below and steal focus back to the first field.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    panelRef.current
      ?.querySelector('input:not([type="hidden"]), select, textarea, button')
      ?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

const cancelClass =
  'flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700';
const primaryClass =
  'flex-1 rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60';
const dangerClass =
  'flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60';

/** A Dialog around a form, with Cancel and a submit button. */
export function FormDialog({
  title,
  submitLabel = 'Save',
  submitting,
  onSubmit,
  onClose,
  children,
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-4 space-y-3"
      >
        {children}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className={cancelClass}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={primaryClass}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** "Are you sure?" -- red confirm button for destructive actions, teal otherwise. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = 'danger',
  busy,
  onConfirm,
  onClose,
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{message}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} disabled={busy} className={cancelClass}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={tone === 'danger' ? dangerClass : primaryClass}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

/** A labelled text input for dialog forms. */
export function Field({ label, ...inputProps }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <input
        {...inputProps}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />
    </label>
  );
}
