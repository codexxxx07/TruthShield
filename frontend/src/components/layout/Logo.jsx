import { Link } from 'react-router-dom';
import { FiShield } from 'react-icons/fi';
import { cn } from '../../lib/utils';

export default function Logo({ className, compact = false, link = true }) {
  const content = (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-brand/25 bg-brand/10 text-brand transition-colors group-hover:border-brand/45">
        <FiShield className="text-[17px]" aria-hidden="true" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-bg bg-safe" aria-hidden="true" />
      </span>
      <span className={cn('min-w-0 leading-none', compact && 'sr-only')}>
        <span className="block text-[15.5px] font-semibold tracking-[-0.035em] text-ink">
          Truth<span className="text-brand">Shield</span>
        </span>
        <span className="mt-[5px] block text-[8.5px] font-medium uppercase tracking-[0.2em] text-ink-3">
          Security Intelligence
        </span>
      </span>
    </span>
  );

  if (!link) return <span className={cn('group', className)}>{content}</span>;

  return (
    <Link to="/" className={cn('group inline-flex items-center rounded-lg', className)} aria-label="TruthShield home">
      {content}
    </Link>
  );
}
