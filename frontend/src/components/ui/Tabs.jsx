import { cn } from '../../lib/utils';

export default function Tabs({ items, value, onChange, variant = 'underline', className, ariaLabel = 'Tabs' }) {
  if (variant === 'pill') {
    return (
      <div className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2 p-1', className)} role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all',
                active
                  ? 'bg-brand/10 text-brand shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--neon)_22%,transparent),inset_0_0_18px_-10px_var(--brand-glow)]'
                  : 'text-ink-2 hover:text-neon',
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className={cn('rounded px-1 text-[10.5px] tabular', active ? 'bg-brand/10 text-brand' : 'bg-surface-3 text-ink-3')}>
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex max-w-full gap-1 overflow-x-auto border-b border-line', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative shrink-0 px-3.5 py-2.5 text-[13px] font-medium transition-colors',
              active ? 'text-neon' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.count !== undefined ? <span className="text-[11px] tabular text-ink-3">{item.count}</span> : null}
            </span>
            {active ? <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-transparent via-brand to-transparent shadow-[0_0_10px_var(--glow-cyan)]" /> : null}
          </button>
        );
      })}
    </div>
  );
}
