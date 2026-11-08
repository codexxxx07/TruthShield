import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { cn } from '../../lib/utils';

export default function Pagination({ page, pages, onChange, total, pageSize, className }) {
  if (pages <= 1) {
    return total !== undefined ? (
      <p className={cn('text-[11.5px] text-ink-3', className)}>Showing all {total} results</p>
    ) : null;
  }

  const numbers = [];
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  for (let index = start; index <= Math.min(pages, start + 2); index += 1) numbers.push(index);

  const from = pageSize ? (page - 1) * pageSize + 1 : null;
  const to = pageSize ? Math.min(page * pageSize, total) : null;

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      {total !== undefined && pageSize ? (
        <p className="text-[11.5px] text-ink-3">
          Showing <span className="font-medium text-ink-2 tabular">{from}–{to}</span> of{' '}
          <span className="font-medium text-ink-2 tabular">{total}</span>
        </p>
      ) : <span />}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink-2 transition hover:border-brand/40 hover:text-neon disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous page"
        >
          <FiChevronLeft className="text-sm" aria-hidden="true" />
        </button>
        {numbers.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            aria-current={number === page ? 'page' : undefined}
            className={cn(
              'h-8 min-w-8 rounded-lg border px-2 text-[12px] font-medium tabular transition',
              number === page
                ? 'border-brand/35 bg-brand/10 text-brand shadow-[inset_0_0_14px_-8px_var(--brand-glow)]'
                : 'border-line bg-surface text-ink-2 hover:border-brand/25 hover:text-neon',
            )}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink-2 transition hover:border-brand/40 hover:text-neon disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next page"
        >
          <FiChevronRight className="text-sm" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
