import { cn } from '../../lib/utils';

export default function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-2/40 px-5 text-center',
        compact ? 'py-8' : 'py-14',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-ink-3">
          <Icon className="text-lg" aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-ink-3">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
