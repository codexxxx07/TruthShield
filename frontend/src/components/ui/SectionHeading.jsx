import { cn } from '../../lib/utils';

export default function SectionHeading({ eyebrow, title, description, action, align = 'left', className, tone = 'brand' }) {
  const tones = {
    brand: 'border-brand/20 bg-brand/10 text-brand',
    critical: 'border-critical/25 bg-critical/10 text-critical',
    safe: 'border-safe/25 bg-safe/10 text-safe',
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow ? (
          <span
            className={cn(
              'mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]',
              tones[tone] || tones.brand,
            )}
          >
            <span className="h-1 w-1 rounded-full bg-current shadow-[0_0_8px_currentColor]" aria-hidden="true" />
            {eyebrow}
          </span>
        ) : null}
        <h2 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.03em] text-ink sm:text-[30px]">{title}</h2>
        {description ? <p className="mt-3 text-[13.5px] leading-6 text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
