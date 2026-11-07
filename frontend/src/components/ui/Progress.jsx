import { clamp, cn } from '../../lib/utils';

const TONE_CLASS = {
  brand: 'text-brand',
  safe: 'text-safe',
  low: 'text-low',
  medium: 'text-medium',
  high: 'text-high',
  critical: 'text-critical',
  info: 'text-info',
};

const TONE_VAR = {
  brand: 'var(--brand)',
  safe: 'var(--safe)',
  low: 'var(--low)',
  medium: 'var(--medium)',
  high: 'var(--high)',
  critical: 'var(--critical)',
  info: 'var(--info)',
};

export function toneForScore(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'safe';
}

export function Meter({ value = 0, tone = 'brand', height = 6, className, animate = false, trackClassName }) {
  const pct = clamp(value, 0, 100);
  return (
    <div
      className={cn('meter', trackClassName, className)}
      style={{ height, '--value': `${pct}%`, '--meter-color': TONE_VAR[tone] || TONE_VAR.brand }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('meter-fill', animate && 'animate-[ts-bar_1s_cubic-bezier(0.22,1,0.36,1)_both]')} />
    </div>
  );
}

export function ScoreRing({
  value = 0,
  stroke = 8,
  tone,
  className = 'h-36 w-36',
  valueClassName = 'text-[30px]',
  label,
  caption,
  showValue = true,
}) {
  const pct = clamp(value, 0, 100);
  const radius = 50 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const resolvedTone = tone || toneForScore(pct);

  return (
    <div className={cn('relative shrink-0', className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Score ${Math.round(pct)} out of 100`}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} opacity="0.7" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-1000 ease-out', TONE_CLASS[resolvedTone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {showValue ? (
          <span className={cn('font-semibold leading-none tracking-[-0.03em] tabular text-ink', valueClassName)}>
            {label ?? Math.round(pct)}
          </span>
        ) : null}
        {caption ? <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">{caption}</span> : null}
      </div>
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4', label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <svg className={cn('animate-spin text-brand', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.18" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Gauge({ value = 0, tone, label }) {
  const pct = clamp(value, 0, 100);
  const resolvedTone = tone || toneForScore(pct);
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <div className="flex items-baseline justify-between text-[11.5px]">
          <span className="text-ink-2">{label}</span>
          <span className={cn('font-mono font-semibold tabular', TONE_CLASS[resolvedTone])}>{Math.round(pct)}</span>
        </div>
      ) : null}
      <Meter value={pct} tone={resolvedTone} />
    </div>
  );
}
