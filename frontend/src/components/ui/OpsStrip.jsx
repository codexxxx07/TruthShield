import { FiActivity, FiAlertTriangle, FiCpu, FiRadio, FiShield } from 'react-icons/fi';
import { cn } from '../../lib/utils';

const LEVELS = [0, 1, 2, 3, 4];

const CELLS = [
  {
    id: 'posture',
    label: 'Threat posture',
    icon: FiShield,
    value: 'ELEVATED',
    tone: 'text-medium',
    foot: '3 of 5 · material risk',
    custom: 'posture',
  },
  {
    id: 'campaigns',
    label: 'Active campaigns',
    icon: FiActivity,
    value: '06',
    tone: 'text-ink',
    foot: '+1 in the last 24h',
  },
  {
    id: 'queue',
    label: 'Triage queue',
    icon: FiAlertTriangle,
    value: '12',
    tone: 'text-ink',
    foot: '3 critical · 4 high',
    accent: true,
  },
  {
    id: 'sensors',
    label: 'Sensor mesh',
    icon: FiRadio,
    value: '13/13',
    tone: 'text-safe',
    foot: 'All modules reporting',
  },
];

export default function OpsStrip({ className }) {
  return (
    <div className={cn('card relative overflow-hidden', className)}>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand/50 via-accent/30 to-transparent" aria-hidden="true" />
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <span className="hud-label">Operational command strip</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">
          <span className="h-1.5 w-1.5 rounded-full bg-safe anim-blink" aria-hidden="true" />
          synced 2 min ago
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-line/60 sm:grid-cols-4 sm:divide-y-0">
        {CELLS.map((cell) => {
          const Icon = cell.icon;
          return (
            <div key={cell.id} className="relative px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="hud-label">{cell.label}</span>
                <Icon className="text-[11px] text-ink-3" aria-hidden="true" />
              </div>
              {cell.custom === 'posture' ? (
                <div className="mt-1.5">
                  <p className="font-display text-[19px] font-semibold leading-none tracking-[-0.01em] text-medium">{cell.value}</p>
                  <div className="mt-2 flex gap-1" aria-hidden="true">
                    {LEVELS.map((level) => (
                      <span
                        key={level}
                        className={cn('h-1 flex-1 rounded-full', level < 3 ? 'bg-medium/80' : 'bg-surface-3')}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 font-mono text-[9.5px] text-ink-3">{cell.foot}</p>
                </div>
              ) : (
                <div className="mt-1.5">
                  <p className={cn('font-display text-[19px] font-semibold leading-none tracking-[-0.01em] tabular', cell.tone)}>
                    {cell.value}
                    {cell.accent ? <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-critical align-middle anim-alert-pulse" /> : null}
                  </p>
                  <p className="mt-1.5 font-mono text-[9.5px] text-ink-3">{cell.foot}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-4 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">
          <FiCpu className="text-[10px]" aria-hidden="true" /> Top vector · credential phishing
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">demo telemetry</span>
      </div>
    </div>
  );
}
