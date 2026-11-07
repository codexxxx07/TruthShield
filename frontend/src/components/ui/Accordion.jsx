import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { cn } from '../../lib/utils';

/**
 * items: [{ id, title, meta, icon, children }]
 * Multiple panels can be open; the first item can start expanded.
 */
export default function Accordion({ items = [], defaultOpen = [], className, variant = 'card' }) {
  const [open, setOpen] = useState(() => new Set(defaultOpen));

  const toggle = (id) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn(variant === 'card' ? 'space-y-2' : 'divide-y divide-line', className)}>
      {items.map((item) => {
        const expanded = open.has(item.id);
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className={cn(
              variant === 'card' && 'overflow-hidden rounded-xl border border-line bg-surface transition-colors',
              variant === 'card' && expanded && 'border-brand/25',
            )}
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60"
            >
              {Icon ? (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2">
                  <Icon className="text-[14px]" aria-hidden="true" />
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-5 text-ink">{item.title}</span>
                {item.meta ? <span className="mt-0.5 block text-[11.5px] text-ink-3">{item.meta}</span> : null}
              </span>
              {item.badge ? <span className="shrink-0">{item.badge}</span> : null}
              <FiChevronDown
                className={cn('shrink-0 text-[15px] text-ink-3 transition-transform duration-300', expanded && 'rotate-180 text-brand')}
                aria-hidden="true"
              />
            </button>
            {expanded ? (
              <div className="border-t border-line bg-surface px-4 py-4 text-[12.5px] leading-6 text-ink-2 anim-fade">{item.children}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
