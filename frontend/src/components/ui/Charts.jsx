import { useId } from 'react';
import { cn, formatCompact } from '../../lib/utils';

/** Lightweight, dependency-free SVG charts. Data-driven geometry only. */

export function Sparkline({ data = [], className = 'h-9 w-full', area = true }) {
  const gradientId = useId().replace(/:/g, '');
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 30 - ((value - min) / span) * 24 - 3;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn('overflow-visible', className)} aria-hidden="true">
      {area ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,30 ${points.join(' ')} 100,30`} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AreaChart({ series = [], labels = [], height = 190, className, showGrid = true }) {
  const gradientId = useId().replace(/:/g, '');
  const max = Math.max(1, ...series.flatMap((item) => item.data));
  const count = series[0]?.data.length || 0;
  if (!count) return null;

  const pointFor = (value, index) => {
    const x = count === 1 ? 50 : (index / (count - 1)) * 100;
    const y = 96 - (value / max) * 88;
    return [x, y];
  };

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
          <defs>
            {series.map((item, index) => (
              <linearGradient key={item.key} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {showGrid
            ? [8, 30, 52, 74, 96].map((y) => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
              ))
            : null}
          {series.map((item, index) => {
            const points = item.data.map((value, i) => pointFor(value, i).map((n) => n.toFixed(2)).join(','));
            return (
              <g key={item.key}>
                <polygon points={`0,100 ${points.join(' ')} 100,100`} fill={`url(#${gradientId}-${index})`} />
                <polyline
                  points={points.join(' ')}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>
      </div>
      {labels.length ? (
        <div className="mt-2 flex justify-between gap-1 text-[10px] text-ink-3">
          {labels.map((label, index) => (
            <span key={label} className={cn(index % 2 === 1 && 'hidden sm:inline', 'tabular')}>
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DonutChart({ data = [], size = 'h-40 w-40', thickness = 13, centerValue, centerLabel }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 50 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = data.map((item, index) => {
    const from = data
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.value / total) * circumference, 0);
    const length = (item.value / total) * circumference;
    return { item, from, length };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className={cn('relative shrink-0', size)}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Distribution chart">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
          {segments.map(({ item, from, length }) => {
            const visible = Math.max(length - 2.5, 0);
            return (
              <circle
                key={item.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={thickness}
                strokeDasharray={`${visible} ${circumference - visible}`}
                strokeDashoffset={-from}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tracking-[-0.02em] tabular text-ink">{centerValue}</span>
          {centerLabel ? <span className="text-[10px] uppercase tracking-[0.08em] text-ink-3">{centerLabel}</span> : null}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden="true" />
              <span className="truncate text-ink-2">{item.label}</span>
            </span>
            <span className="shrink-0 font-mono text-[11.5px] tabular text-ink">{item.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StackedBars({ data = [], className, height = 150 }) {
  const totals = data.map((item) => (item.safe || 0) + (item.suspicious || 0) + (item.malicious || 0));
  const max = Math.max(1, ...totals);

  return (
    <div className={className}>
      <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height }}>
        {data.map((item) => (
            <div key={item.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="relative flex h-full w-full max-w-[30px] flex-col justify-end overflow-hidden rounded-md">
                <div
                  className="w-full bg-critical/75 transition-opacity group-hover:opacity-100"
                  style={{ height: `${((item.malicious || 0) / max) * 100}%` }}
                  title={`${item.malicious} malicious`}
                />
                <div
                  className="w-full bg-medium/70"
                  style={{ height: `${((item.suspicious || 0) / max) * 100}%` }}
                  title={`${item.suspicious} suspicious`}
                />
                <div
                  className="w-full bg-safe/25"
                  style={{ height: `${((item.safe || 0) / max) * 100}%` }}
                  title={`${item.safe} safe`}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-full opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="absolute inset-x-0 top-0 h-px bg-brand" />
                </div>
              </div>
              <span className="text-[9.5px] tabular text-ink-3">{item.day.split(' ')[1]}</span>
            </div>
          ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-safe/40" /> Safe</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-medium/70" /> Suspicious</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-critical/75" /> Malicious</span>
        <span className="ml-auto font-mono text-ink-3">peak {formatCompact(max)}</span>
      </div>
    </div>
  );
}

export function Legend({ items, className }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
