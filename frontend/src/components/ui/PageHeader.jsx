import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { DemoBadge } from './Badge';

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  breadcrumb = [],
  demo = false,
  className,
  compact = false,
}) {
  return (
    <header className={cn('relative overflow-hidden border-b border-line', className)}>
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-70" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 circuit-grid opacity-25" aria-hidden="true" />
      <div className="aurora aurora-brand -top-24 left-1/4 h-48 w-[420px]" aria-hidden="true" />
      <div className="aurora aurora-accent -top-16 right-[8%] h-40 w-[300px] opacity-30" aria-hidden="true" />
      <div className={cn('shell relative', compact ? 'pb-7 pt-8' : 'pb-10 pt-9 sm:pb-12 sm:pt-12')}>
        {breadcrumb.length ? (
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-[11.5px] text-ink-3">
            {breadcrumb.map((item, index) => (
              <span key={`${item.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <FiChevronRight className="text-[10px] opacity-60" aria-hidden="true" /> : null}
                {item.to ? (
                  <Link to={item.to} className="transition hover:text-neon">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-ink-2">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            {eyebrow ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="neon-chip">
                  <span className="status-dot" aria-hidden="true" />
                  {eyebrow}
                </span>
                {demo ? <DemoBadge /> : null}
              </div>
            ) : null}
            <h1
              className={cn(
                'font-display font-semibold tracking-[-0.035em] text-ink',
                compact ? 'text-[26px] leading-tight sm:text-[30px]' : 'text-[30px] leading-[1.12] sm:text-[36px] lg:text-[42px]',
              )}
            >
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-2xl text-[13.5px] leading-6 text-ink-2 sm:text-sm sm:leading-6">{description}</p>
            ) : null}
            {meta ? <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-ink-3">{meta}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
