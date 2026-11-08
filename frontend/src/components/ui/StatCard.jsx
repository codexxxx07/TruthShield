import { FiArrowDownRight, FiArrowUpRight } from 'react-icons/fi';
import { cn, formatNumber } from '../../lib/utils';
import useCountUp from '../../hooks/useCountUp';
import { Sparkline } from './Charts';

const TONE = {
  brand: { text: 'text-brand', icon: 'bg-brand/10 border-brand/20' },
  safe: { text: 'text-safe', icon: 'bg-safe/10 border-safe/20' },
  medium: { text: 'text-medium', icon: 'bg-medium/10 border-medium/20' },
  critical: { text: 'text-critical', icon: 'bg-critical/10 border-critical/20' },
  low: { text: 'text-low', icon: 'bg-low/10 border-low/20' },
  high: { text: 'text-high', icon: 'bg-high/10 border-high/20' },
};

export default function StatCard({ label, value, delta, trend = 'up', hint, icon: Icon, tone = 'brand', spark, className }) {
  const animated = useCountUp(value);
  const meta = TONE[tone] || TONE.brand;
  const positive = trend === 'up';
  const deltaGood = tone === 'critical' || tone === 'medium' ? !positive : positive;

  return (
    <div className={cn('card top-sheen group relative overflow-hidden p-4 transition-colors hover:border-brand/35 hover:shadow-[var(--shadow-md),0_0_34px_-18px_var(--brand-glow)] sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-3">{label}</p>
          <p className="mt-2 font-display text-[26px] font-semibold leading-none tracking-[-0.03em] tabular text-ink sm:text-[28px]">
            {formatNumber(Math.round(animated))}
          </p>
        </div>
        {Icon ? (
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors', meta.icon, meta.text)}>
            <Icon className="text-[16px]" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {delta !== undefined ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11.5px] font-medium tabular',
                deltaGood ? 'text-safe' : 'text-critical',
              )}
            >
              {positive ? <FiArrowUpRight className="text-[12px]" /> : <FiArrowDownRight className="text-[12px]" />}
              {Math.abs(delta)}%
            </span>
          ) : null}
          {hint ? <span className="ml-2 text-[11px] text-ink-3">{hint}</span> : null}
        </div>
        {spark ? (
          <span className={cn('w-16 shrink-0 sm:w-20', meta.text)}>
            <Sparkline data={spark} className="h-7 w-full" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
