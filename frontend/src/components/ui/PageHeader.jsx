import { Link } from 'react-router-dom';
import { FiShield } from 'react-icons/fi';
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
  const path = breadcrumb.length ? breadcrumb[breadcrumb.length - 1].label : eyebrow;

  return (
    <header className={cn('relative overflow-hidden border-b border-line bg-bg-soft/20', className)}>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 circuit-grid opacity-20" aria-hidden="true" />
      <div className="aurora aurora-brand -top-28 left-1/4 h-48 w-[420px]" aria-hidden="true" />
      <div className="aurora aurora-accent -top-20 right-[8%] h-40 w-[300px] opacity-40" aria-hidden="true" />
      <div className={cn('shell relative', compact ? 'pb-7 pt-7' : 'pb-10 pt-8 sm:pb-12 sm:pt-10')}>
        {/* Console path + channel state */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
          {breadcrumb.length ? (
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5">
              {breadcrumb.map((item, index) => (
                <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 ? <span className="text-ink-3/60" aria-hidden="true">/</span> : null}
                  {item.to ? (
                    <Link to={item.to} className="transition hover:text-neon">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-brand">{item.label}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : (
            <span className="flex items-center gap-1.5 text-brand">
              <span className="h-1.5 w-1.5 border border-brand/70" aria-hidden="true" />
              {path || 'Console'}
            </span>
          )}
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="status-dot text-safe" aria-hidden="true" />
            Secure channel · operator view
          </span>
        </div>

        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            {eyebrow ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="neon-chip rounded-[4px]">
                  <FiShield className="text-[10px]" aria-hidden="true" />
                  {eyebrow}
                </span>
                {demo ? <DemoBadge /> : null}
              </div>
            ) : null}
            <h1
              className={cn(
                'font-display font-semibold leading-[1.08] tracking-[-0.025em] text-ink',
                compact ? 'text-[26px] sm:text-[30px]' : 'text-[31px] sm:text-[38px] lg:text-[44px]',
              )}
            >
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-2xl text-[13.5px] leading-6 text-ink-2 sm:text-sm sm:leading-6">{description}</p>
            ) : null}
            {meta ? <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-3">{meta}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>

        <div className="pointer-events-none absolute bottom-0 left-4 hidden h-2 w-px bg-brand/40 sm:block" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-0 right-4 hidden h-2 w-px bg-brand/40 sm:block" aria-hidden="true" />
      </div>
    </header>
  );
}
