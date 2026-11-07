import { FiAlertTriangle, FiCheckCircle, FiInfo, FiXCircle } from 'react-icons/fi';
import { cn } from '../../lib/utils';

const TONES = {
  info: { wrap: 'border-brand/20 bg-brand/[0.06]', icon: 'text-brand', Icon: FiInfo },
  warning: { wrap: 'border-medium/25 bg-medium/[0.07]', icon: 'text-medium', Icon: FiAlertTriangle },
  critical: { wrap: 'border-critical/25 bg-critical/[0.06]', icon: 'text-critical', Icon: FiXCircle },
  safe: { wrap: 'border-safe/25 bg-safe/[0.06]', icon: 'text-safe', Icon: FiCheckCircle },
  neutral: { wrap: 'border-line bg-surface-2', icon: 'text-ink-3', Icon: FiInfo },
};

export default function Notice({ children, tone = 'info', title, icon: CustomIcon, className, action }) {
  const meta = TONES[tone] || TONES.info;
  const Icon = CustomIcon || meta.Icon;
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-3.5 py-3', meta.wrap, className)}>
      <Icon className={cn('mt-0.5 shrink-0 text-[15px]', meta.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[12.5px] font-semibold text-ink">{title}</p> : null}
        <div className={cn('text-[12px] leading-5 text-ink-2', title && 'mt-0.5')}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
