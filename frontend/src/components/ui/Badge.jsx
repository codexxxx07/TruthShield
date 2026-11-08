import { FiCpu } from 'react-icons/fi';
import { cn } from '../../lib/utils';

const TONES = {
  neutral: 'border-line bg-surface-3 text-ink-2',
  brand: 'border-brand/30 bg-brand/10 text-brand shadow-[inset_0_0_14px_-8px_var(--brand-glow)]',
  safe: 'border-safe/30 bg-safe/10 text-safe shadow-[inset_0_0_14px_-8px_rgba(0,255,163,0.45)]',
  low: 'border-low/30 bg-low/10 text-low',
  medium: 'border-medium/35 bg-medium/10 text-medium shadow-[inset_0_0_14px_-8px_rgba(255,209,102,0.4)]',
  high: 'border-high/35 bg-high/10 text-high',
  critical: 'border-critical/35 bg-critical/10 text-critical shadow-[inset_0_0_14px_-8px_rgba(255,56,100,0.5)]',
  info: 'border-info/30 bg-info/10 text-info',
};

const DOTS = {
  safe: 'bg-safe',
  low: 'bg-low',
  medium: 'bg-medium',
  high: 'bg-high',
  critical: 'bg-critical',
  brand: 'bg-brand',
  info: 'bg-info',
  neutral: 'bg-ink-3',
};

export default function Badge({ children, tone = 'neutral', dot = false, icon: Icon, className, size = 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium tracking-[0.01em]',
        size === 'sm' ? 'px-2 py-[2px] text-[10.5px]' : 'px-2.5 py-0.5 text-[11px]',
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone] || DOTS.neutral)} aria-hidden="true" /> : null}
      {Icon ? <Icon className="text-[11px]" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export const SEVERITY_LABEL = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Informational',
  safe: 'Clean',
};

export function SeverityBadge({ severity = 'info', size = 'md', className }) {
  const tone = severity === 'informational' ? 'info' : severity;
  return (
    <Badge tone={tone} dot size={size} className={className}>
      {SEVERITY_LABEL[tone] || tone}
    </Badge>
  );
}

export function VerdictBadge({ verdict = 'safe', className, size = 'md' }) {
  const map = {
    safe: { tone: 'safe', label: 'Safe' },
    suspicious: { tone: 'medium', label: 'Suspicious' },
    malicious: { tone: 'critical', label: 'Malicious' },
    clean: { tone: 'safe', label: 'Clean' },
    active: { tone: 'critical', label: 'Active' },
    takedown: { tone: 'safe', label: 'Taken down' },
    monitoring: { tone: 'medium', label: 'Monitoring' },
  };
  const meta = map[verdict] || { tone: 'neutral', label: verdict };
  return (
    <Badge tone={meta.tone} dot size={size} className={className}>
      {meta.label}
    </Badge>
  );
}

export function DemoBadge({ label = 'Simulated data', className }) {
  return (
    <span
      title="Generated locally from demo data. No live scanning service is connected."
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3',
        className,
      )}
    >
      <FiCpu className="text-[11px]" aria-hidden="true" />
      {label}
    </span>
  );
}
