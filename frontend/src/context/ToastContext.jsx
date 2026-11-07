import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import { cn } from '../lib/utils';

const ToastContext = createContext(null);

const TONE = {
  success: { icon: FiCheckCircle, className: 'text-safe', bar: 'var(--safe)' },
  error: { icon: FiAlertTriangle, className: 'text-critical', bar: 'var(--critical)' },
  info: { icon: FiInfo, className: 'text-brand', bar: 'var(--brand)' },
  warning: { icon: FiAlertTriangle, className: 'text-medium', bar: 'var(--medium)' },
};

function ToastCard({ toast, onDismiss }) {
  const meta = TONE[toast.tone] || TONE.info;
  const Icon = meta.icon;
  return (
    <div
      role="status"
      className="pointer-events-auto relative w-[min(92vw,380px)] overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-lg)] anim-slide-left"
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.bar }} aria-hidden="true" />
      <div className="flex items-start gap-3 pl-1.5">
        <Icon className={cn('mt-0.5 shrink-0 text-lg', meta.className)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5 text-ink">{toast.title}</p>
          {toast.message ? <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{toast.message}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="-mr-1 -mt-1 rounded-md p-1 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          aria-label="Dismiss notification"
        >
          <FiX className="text-sm" />
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone, title, message) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((current) => [...current.slice(-3), { id, tone, title, message }]);
      const timer = window.setTimeout(() => dismiss(id), 4800);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      info: (title, message) => push('info', title, message),
      warning: (title, message) => push('warning', title, message),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
