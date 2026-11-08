import { Link } from 'react-router-dom';
import { FiShield } from 'react-icons/fi';
import { cn } from '../../lib/utils';

export default function Logo({ className, compact = false, link = true }) {
  const content = (
    <span className="flex items-center gap-2.5">
      <span className="logo-mark grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neon">
        <FiShield className="text-[17px] drop-shadow-[0_0_5px_var(--brand-glow)]" aria-hidden="true" />
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-bg bg-safe shadow-[0_0_6px_var(--safe)]"
          aria-hidden="true"
        />
      </span>
      <span className={cn('min-w-0 leading-none', compact && 'sr-only')}>
        <span className="block font-display text-[14px] font-bold uppercase leading-none tracking-[0.09em] text-ink">
          Truth<span className="text-neon">Shield</span>
        </span>
        <span className="mt-[5px] block font-mono text-[7.5px] font-medium uppercase tracking-[0.22em] text-ink-3">
          Security Operations
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
