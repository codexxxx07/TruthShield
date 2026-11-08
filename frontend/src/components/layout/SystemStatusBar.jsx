import { useEffect, useMemo, useState } from 'react';
import { THREAT_RECORDS } from '../../data/threats';
import { cn } from '../../lib/utils';

const SEVERITY_TEXT = {
  critical: 'text-critical',
  high: 'text-high',
  medium: 'text-medium',
  low: 'text-low',
};

const SEVERITY_MARK = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
};

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Persistent operational strip under the primary navigation. Communicates
 * platform state, current threat posture and a rolling indicator feed.
 * Every value is demo data — nothing here is fetched from a service.
 */
export default function SystemStatusBar() {
  const now = useUtcClock();
  const feed = useMemo(
    () =>
      THREAT_RECORDS.slice(0, 7).map((record) => ({
        id: record.id,
        indicator: record.indicator,
        severity: record.severity,
        category: record.category,
      })),
    [],
  );

  const time = now.toISOString().slice(11, 19);
  const date = now.toISOString().slice(0, 10);

  return (
    <div className="relative z-[65] border-b border-line bg-bg-soft/90">
      <div className="shell flex h-8 items-center gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">
        <span className="flex shrink-0 items-center gap-1.5 text-safe">
          <span className="status-dot" aria-hidden="true" />
          <span className="hidden sm:inline">SOC</span> Operational
        </span>

        <span className="hidden h-3 w-px shrink-0 bg-line-strong md:block" aria-hidden="true" />

        <span className="hidden shrink-0 items-center gap-1.5 md:flex">
          Threat level
          <span className="inline-flex items-center gap-1 text-medium">
            <span className="flex items-end gap-[2px]" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={cn(
                    'w-[3px] rounded-[1px]',
                    step < 3 ? 'bg-medium' : 'bg-surface-3',
                    step === 0 ? 'h-1' : step === 1 ? 'h-1.5' : step === 2 ? 'h-2' : step === 3 ? 'h-2.5' : 'h-3',
                  )}
                />
              ))}
            </span>
            Elevated
          </span>
        </span>

        <span className="hidden h-3 w-px shrink-0 bg-line-strong md:block" aria-hidden="true" />

        {/* Rolling IOC feed */}
        <div className="relative hidden min-w-0 flex-1 overflow-hidden lg:block" aria-label="Recent indicators">
          <div className="flex w-max anim-ticker items-center gap-6 [animation-duration:55s]">
            {[...feed, ...feed].map((item, index) => (
              <span key={`${item.id}-${index}`} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                <span className={cn('h-1 w-1 rounded-full', SEVERITY_MARK[item.severity] || 'bg-ink-3')} aria-hidden="true" />
                <span className="text-ink-3">IOC</span>
                <span className="normal-case tracking-normal text-ink-2">{item.indicator}</span>
                <span className={cn('tracking-[0.08em]', SEVERITY_TEXT[item.severity] || 'text-ink-3')}>{item.severity}</span>
              </span>
            ))}
          </div>
          <span className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg-soft to-transparent" aria-hidden="true" />
          <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg-soft to-transparent" aria-hidden="true" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="text-ink-3">Sensors</span>
            <span className="text-safe">13/13</span>
          </span>
          <span className="hidden h-3 w-px bg-line-strong sm:block" aria-hidden="true" />
          <span className="flex items-center gap-1.5" title="Coordinated Universal Time">
            <span className="hidden text-ink-3 sm:inline">{date}</span>
            <span className="tabular text-ink-2">{time}Z</span>
          </span>
          <span className="hidden rounded border border-line bg-surface-2/60 px-1.5 py-[1px] text-[8px] tracking-[0.14em] text-ink-3 md:inline">
            Demo
          </span>
        </div>
      </div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/25 to-transparent" aria-hidden="true" />
    </div>
  );
}
