import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { cn } from '../../lib/utils';

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
};

export default function Modal({ open, onClose, title, description, children, footer, size = 'md', className, bodyClassName }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-[3px] anim-fade"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        tabIndex={-1}
        className={cn(
          'cyber-menu relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl outline-none anim-pop sm:rounded-2xl',
          SIZES[size] || SIZES.md,
          className,
        )}
      >
        <span className="accent-rail absolute inset-x-0 top-0 z-10 opacity-70" aria-hidden="true" />
        {title ? (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
              {description ? <p className="mt-1 text-[12.5px] leading-5 text-ink-2">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
              aria-label="Close dialog"
            >
              <FiX className="text-base" />
            </button>
          </div>
        ) : null}
        <div className={cn('flex-1 overflow-y-auto px-5 py-5', bodyClassName)}>{children}</div>
        {footer ? <div className="border-t border-line bg-surface-2/50 px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
