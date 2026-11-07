import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export default function Dropdown({ trigger, children, align = 'right', panelClassName, width = 'w-60' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value), panelId })}
      {open ? (
        <div
          id={panelId}
          className={cn(
            'absolute z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)] anim-pop',
            align === 'right' ? 'right-0' : 'left-0',
            width,
            panelClassName,
          )}
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({ children, icon: Icon, to, href, onClick, danger = false, active = false, close, description }) {
  const classes = cn(
    'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
    danger ? 'text-critical hover:bg-critical/10' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
    active && 'bg-brand/10 text-brand',
  );

  const content = (
    <>
      {Icon ? <Icon className="mt-0.5 shrink-0 text-[14px]" aria-hidden="true" /> : null}
      <span className="min-w-0">
        <span className="block truncate font-medium">{children}</span>
        {description ? <span className="mt-0.5 block text-[11.5px] leading-4 text-ink-3">{description}</span> : null}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} onClick={close} role="menuitem">
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} role="menuitem" target="_blank" rel="noreferrer noopener" onClick={close}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      className={classes}
      onClick={() => {
        onClick?.();
        close?.();
      }}
    >
      {content}
    </button>
  );
}

export function DropdownLabel({ children }) {
  return <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">{children}</p>;
}

export function DropdownDivider() {
  return <div className="my-1.5 h-px bg-line" role="separator" />;
}
