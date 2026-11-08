import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCpu, FiGlobe, FiPlay, FiRefreshCw, FiCreditCard, FiLock } from 'react-icons/fi';
import Badge, { DemoBadge } from '../ui/Badge';
import Button from '../ui/Button';
import CopyButton from '../ui/CopyButton';
import { Meter } from '../ui/Progress';
import { DETECTION_SAMPLES } from '../../lib/detectionEngine';
import { runDetection } from '../../lib/detectionEngine';
import { normalizeUrl, validateDomain, validateUpi } from '../../lib/validation';
import { cn, formatDateTime } from '../../lib/utils';

const STAGES = [
  { key: 'fetch', label: 'Fetching target', detail: 'DNS, HTTP and TLS handshake' },
  { key: 'extract', label: 'Extracting signals', detail: 'Certificates, headers, DOM and assets' },
  { key: 'correlate', label: 'Correlating intelligence', detail: 'Feeds, clusters and history' },
  { key: 'score', label: 'Scoring risk', detail: 'Weighted, explainable factors' },
];

const KIND_META = {
  domain: { icon: FiLock, label: 'Domain', placeholder: 'yourbrand.com', hint: 'Enter a registrable domain, without a path.' },
  url: { icon: FiGlobe, label: 'Website URL', placeholder: 'https://secure-login.example/verify', hint: 'Include a path to analyse the exact page.' },
  upi: { icon: FiCreditCard, label: 'UPI ID or payment link', placeholder: 'merchant@okhdfcbank', hint: 'Accepts a VPA or a upi:// payment link.' },
};

function parseTarget(kind, raw) {
  if (kind === 'upi') {
    const parsed = validateUpi(raw);
    return parsed.ok ? { ok: true, value: parsed.vpa } : parsed;
  }
  if (kind === 'url') {
    const parsed = normalizeUrl(raw);
    return parsed.ok ? { ok: true, value: parsed.url } : parsed;
  }
  const parsed = validateDomain(raw);
  return parsed.ok ? { ok: true, value: parsed.domain } : parsed;
}

/**
 * Shared shell for the 13 advanced modules: validated target input,
 * staged progress, and a result slot. Pages supply only their analysis UI.
 */
export default function DetectionWorkbench({
  feature,
  inputKind = 'domain',
  samples,
  cta = 'Run analysis',
  analyze,
  children,
  footer,
  autoRun = true,
  notice,
}) {
  const meta = KIND_META[inputKind] || KIND_META.domain;
  const sampleList = samples || DETECTION_SAMPLES[inputKind] || DETECTION_SAMPLES.domain;
  const [value, setValue] = useState(feature?.demoTarget || sampleList[0]);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);
  const [target, setTarget] = useState('');
  const timers = useRef([]);
  const started = useRef(false);
  const Icon = meta.icon;

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const run = useCallback(
    (raw) => {
      const parsed = parseTarget(inputKind, raw);
      if (!parsed.ok) {
        setError(parsed.error);
        setPhase(result ? 'done' : 'idle');
        return;
      }
      clearTimers();
      setError('');
      setValue(raw);
      setTarget(parsed.value);
      setResult(null);
      setStage(0);
      setPhase('scanning');

      STAGES.forEach((_, index) => {
        timers.current.push(window.setTimeout(() => setStage(index + 1), 340 * (index + 1)));
      });
      timers.current.push(
        window.setTimeout(() => {
          const data = analyze ? analyze(parsed.value) : runDetection(feature.slug, parsed.value);
          setResult(data);
          setPhase('done');
        }, 340 * STAGES.length + 240),
      );
    },
    [analyze, feature, inputKind, result],
  );

  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      run(value);
    }
  }, [autoRun, run, value]);

  const percent = phase === 'scanning' ? Math.round((stage / STAGES.length) * 100) : phase === 'done' ? 100 : 0;

  return (
    <div className="space-y-5">
      <div className="card top-sheen relative overflow-hidden p-4 sm:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(value);
          }}
          noValidate
        >
          <label htmlFor="detection-target" className="text-[12.5px] font-medium text-ink">
            {meta.label} <span className="text-critical">*</span>
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-3" aria-hidden="true" />
              <input
                id="detection-target"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  if (error) setError('');
                }}
                placeholder={meta.placeholder}
                spellCheck="false"
                autoComplete="off"
                aria-invalid={Boolean(error)}
                className={cn(
                  'h-11 w-full rounded-xl border bg-surface pl-10 pr-3 font-mono text-[12.5px] text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10',
                  error ? 'border-critical/60' : 'border-line-strong hover:border-brand/30',
                )}
              />
            </div>
            <Button type="submit" className="h-11 shrink-0 px-5" icon={phase === 'scanning' ? undefined : FiPlay} loading={phase === 'scanning'}>
              {phase === 'scanning' ? 'Analysing…' : cta}
            </Button>
          </div>
          {error ? <p className="mt-1.5 text-[12px] text-critical" role="alert">{error}</p> : <p className="mt-1.5 text-[11.5px] text-ink-3">{meta.hint}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            <span className="text-[10.5px] uppercase tracking-[0.07em] text-ink-3">Samples</span>
            {sampleList.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => run(sample)}
                className={cn(
                  'rounded-md border px-2 py-1 font-mono text-[10px] transition',
                  sample === value
                    ? 'border-brand/35 bg-brand/10 text-brand shadow-[inset_0_0_12px_-6px_var(--brand-glow)]'
                    : 'border-line bg-surface-2/70 text-ink-2 hover:border-brand/30 hover:text-brand',
                )}
              >
                {sample}
              </button>
            ))}
          </div>
        </form>
      </div>

      {phase === 'scanning' ? (
        <div className="card p-4 sm:p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-60 anim-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              Analysing <span className="truncate font-mono text-ink-2">{target}</span>
            </span>
            <span className="font-mono text-[11.5px] tabular text-ink-3">{percent}%</span>
          </div>
          <Meter value={percent} tone="brand" className="mt-2.5" />
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {STAGES.map((item, index) => {
              const done = index < stage;
              const active = index === stage;
              return (
                <div
                  key={item.key}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 transition-colors',
                    done ? 'border-safe/25 bg-safe/[0.05]' : active ? 'border-brand/30 bg-brand/[0.06]' : 'border-line bg-surface-2/40',
                  )}
                >
                  <p className={cn('text-[11px] font-medium', done ? 'text-safe' : active ? 'text-brand' : 'text-ink-3')}>{item.label}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-ink-3">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {phase === 'done' && result ? (
        <div className="anim-fade">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <DemoBadge />
              <span className="truncate font-mono text-[11px] text-ink-2">{target}</span>
              <span className="hidden text-[10.5px] text-ink-3 sm:inline">{formatDateTime(new Date())}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge tone="brand" size="sm" icon={FiCpu}>{feature?.short || 'Module'}</Badge>
              <CopyButton value={`${window.location.origin}${window.location.pathname}?target=${encodeURIComponent(target)}`} label="Copy link" compact />
              <button
                type="button"
                onClick={() => run(value)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-2 transition hover:border-brand/30 hover:text-brand"
              >
                <FiRefreshCw className="text-[12px]" aria-hidden="true" /> Run again
              </button>
            </div>
          </div>
          {children(result)}
          {notice ? <div className="mt-4">{notice}</div> : null}
          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
