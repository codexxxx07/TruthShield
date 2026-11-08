import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Badge from '../ui/Badge';
import FeatureIcon from '../ui/FeatureIcon';
import { cn } from '../../lib/utils';

const TONE_BG = {
  low: 'border-low/25 bg-low/10 text-low',
  medium: 'border-medium/25 bg-medium/10 text-medium',
  high: 'border-high/25 bg-high/10 text-high',
  critical: 'border-critical/25 bg-critical/10 text-critical',
};

export default function ToolHeader({ feature, actions, index }) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl border shadow-[inset_0_0_18px_-8px_currentColor]', TONE_BG[feature.tone] || TONE_BG.low)}>
            <FeatureIcon name={feature.icon} className="text-[19px]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral" size="sm">{feature.category}</Badge>
              {index ? <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-3">Module {index}/13</span> : null}
            </div>
            <h1 className="mt-1.5 font-display text-[21px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[25px]">
              {feature.name}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <Link
            to="/advanced"
            className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-ink-2 transition hover:border-brand/40 hover:text-neon sm:inline-flex"
          >
            <FiArrowLeft className="text-[12px]" aria-hidden="true" /> Modules
          </Link>
        </div>
      </div>
      <p className="mt-2.5 max-w-3xl text-[12.5px] leading-6 text-ink-2">{feature.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {feature.capabilities.map((capability) => (
          <span key={capability} className="rounded-md border border-line bg-surface-2/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-3 transition-colors hover:border-brand/25 hover:text-ink-2">
            {capability}
          </span>
        ))}
      </div>
    </div>
  );
}
