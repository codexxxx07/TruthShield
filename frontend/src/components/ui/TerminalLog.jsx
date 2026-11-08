import { cn } from '../../lib/utils';

const LEVEL_META = {
  sys: { tag: 'SYS', tone: 'text-brand' },
  info: { tag: 'INF', tone: 'text-ink-2' },
  ok: { tag: ' OK', tone: 'text-safe' },
  warn: { tag: 'WRN', tone: 'text-medium' },
  err: { tag: 'ERR', tone: 'text-critical' },
  dim: { tag: ' · ', tone: 'text-ink-3' },
};

function normalizeLine(line, index) {
  if (typeof line === 'string') return { id: index, level: 'info', time: null, text: line };
  return {
    id: line.id ?? index,
    level: line.level || 'info',
    time: line.time || null,
    text: line.text || '',
  };
}

export default function TerminalLog({
  title = 'truthshield@signal-mesh',
  subtitle,
  lines = [],
  live = false,
  caret = '▌',
  className,
  bodyClassName,
  footer,
  dense = false,
  maxHeight,
}) {
  return (
    <div className={cn('terminal relative overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line/70 bg-black/20 px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex shrink-0 gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-critical/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-medium/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-safe/70" />
          </span>
          <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {subtitle ? (
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3 sm:inline">{subtitle}</span>
          ) : null}
          {live ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-safe">
              <span className="h-1.5 w-1.5 rounded-full bg-safe anim-blink" aria-hidden="true" />
              live
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={cn('relative overflow-y-auto px-3.5 py-3', dense ? 'space-y-1' : 'space-y-1.5', bodyClassName)}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" aria-hidden="true" />
        {lines.length ? (
          lines.map((raw, index) => {
            const line = normalizeLine(raw, index);
            const meta = LEVEL_META[line.level] || LEVEL_META.info;
            return (
              <div key={line.id} className="flex items-start gap-2 leading-[1.65]">
                {line.time ? (
                  <span className="shrink-0 select-none font-mono text-[9.5px] tabular text-ink-3/70">{line.time}</span>
                ) : null}
                <span className={cn('shrink-0 select-none font-mono text-[9.5px] font-semibold', meta.tone)}>{meta.tag}</span>
                <span className={cn('min-w-0 break-words font-mono text-[11px]', line.level === 'err' ? 'text-critical/90' : line.level === 'warn' ? 'text-medium/90' : line.level === 'ok' ? 'text-safe/90' : line.level === 'dim' ? 'text-ink-3' : 'text-[#bfe6d6]')}>
                  {line.text}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex items-center gap-2 font-mono text-[11px] text-ink-3">
            <span className="text-safe">$</span> awaiting input<span className="anim-caret text-brand">{caret}</span>
          </div>
        )}
        {live && lines.length ? (
          <div className="flex items-center gap-2 pt-0.5 font-mono text-[11px] text-ink-3">
            <span className="text-safe">$</span>
            <span className="anim-caret text-brand" aria-hidden="true">{caret}</span>
            <span className="sr-only">Live output</span>
          </div>
        ) : null}
      </div>

      {footer ? <div className="border-t border-line/70 bg-black/20 px-3.5 py-2">{footer}</div> : null}
    </div>
  );
}
