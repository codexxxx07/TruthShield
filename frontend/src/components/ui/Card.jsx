import { cn } from '../../lib/utils';

export function Card({ children, className, hover = false, as: Tag = 'div', ...rest }) {
  return (
    <Tag className={cn('card overflow-hidden', hover && 'card-lift', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  footer,
  flush = false,
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2">
                <Icon className="text-[15px]" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
              {description ? <p className="mt-0.5 text-[12.5px] leading-5 text-ink-2">{description}</p> : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(!flush && 'px-5 py-5', 'flex-1', bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-line bg-surface-2/60 px-5 py-3">{footer}</div> : null}
    </Card>
  );
}

export function Panel({ children, className, ...rest }) {
  return (
    <div className={cn('card-inset px-4 py-3.5', className)} {...rest}>
      {children}
    </div>
  );
}

export function DataRow({ label, value, mono = false, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line/70 py-2.5 last:border-0 last:pb-0', className)}>
      <span className="text-[12.5px] text-ink-3">{label}</span>
      <span className={cn('max-w-[62%] break-words text-right text-[12.5px] font-medium text-ink', mono && 'font-mono text-[11.5px]')}>
        {value}
      </span>
    </div>
  );
}
