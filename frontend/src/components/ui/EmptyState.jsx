import { cn } from '../../lib/utils';

export default function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface-2/40 px-5 text-center',
        compact ? 'py-8' : 'py-14',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" aria-hidden="true" />
      {Icon ? (
        <span className="relative mb-3 grid h-11 w-11 place-items-center rounded-xl border border-brand/20 bg-brand/[0.07] text-brand">
          <Icon className="text-lg" aria-hidden="true" />
        </span>
      ) : null}
      <p className="relative text-[13.5px] font-semibold text-ink">{title}</p>
      {description ? <p className="relative mt-1 max-w-sm text-[12.5px] leading-5 text-ink-3">{description}</p> : null}
      {action ? <div className="relative mt-4">{action}</div> : null}
    </div>
  );
}
