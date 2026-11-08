import { useEffect, useRef, useState } from 'react';
import {
  FiAlertTriangle, FiArrowRight, FiCheckCircle, FiCpu, FiCreditCard, FiGrid, FiInfo,
  FiRefreshCw, FiShield, FiXCircle,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import ToolHeader from '../../components/detection/ToolHeader';
import Badge, { DemoBadge, SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../../components/ui/Card';
import { ScoreRing, Spinner, Meter } from '../../components/ui/Progress';
import FileDrop from '../../components/ui/FileDrop';
import Notice from '../../components/ui/Notice';
import Button from '../../components/ui/Button';
import CopyButton from '../../components/ui/CopyButton';
import { FEATURE_BY_SLUG } from '../../data/features';
import { DETECTION_SAMPLES, runDetection } from '../../lib/detectionEngine';
import { api, BackendUnavailable } from '../../lib/api';
import { validateFile, validateUpi } from '../../lib/validation';
import { cn, formatDate } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['upi-qr'];

const CHECK_ICON = { pass: FiCheckCircle, warn: FiAlertTriangle, fail: FiXCircle };
const CHECK_TONE = { pass: 'text-safe', warn: 'text-medium', fail: 'text-critical' };

export default function UpiQrChecker() {
  const [value, setValue] = useState(DETECTION_SAMPLES.upi[0]);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decoded, setDecoded] = useState(null);
  const [phase, setPhase] = useState('scanning');
  const [result, setResult] = useState(null);
  const latestRun = useRef(0);

  const check = async (target, options) => {
    const runId = ++latestRun.current;
    try {
      const next = await runDetection(feature.slug, target, options);
      if (runId !== latestRun.current) return;
      setResult(next);
      setPhase('done');
    } catch (failure) {
      if (runId !== latestRun.current) return;
      setError(failure.message);
      setPhase('idle');
    }
  };

  const run = (raw, options) => {
    const parsed = validateUpi(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    // A payment link also carries the payee name, amount and note, so send it whole.
    const isLink = /[?&]pa=/i.test(raw);
    if (!isLink) setValue(parsed.vpa);
    setPhase('scanning');
    setResult(null);
    check(isLink ? raw.trim() : parsed.vpa, options);
  };

  useEffect(() => {
    // check() only sets state after its request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check(DETECTION_SAMPLES.upi[0]);
    return () => {
      latestRun.current += 1;
    };
  }, []);

  const handleFile = (next) => {
    const checked = validateFile(next);
    if (!checked.ok) {
      setFileError(checked.error);
      return;
    }
    setFileError('');
    setFile(next);
    setDecoding(true);
    setDecoded(null);
    api.uploadQr(next).then(
      (report) => {
        setDecoded(report.decoded);
        setDecoding(false);
        setError('');
        latestRun.current += 1;
        setValue(report.vpa);
        setResult(report);
        setPhase('done');
      },
      (failure) => {
        setDecoding(false);
        if (failure instanceof BackendUnavailable) {
          const sample = DETECTION_SAMPLES.upi[(next.size + next.name.length) % DETECTION_SAMPLES.upi.length];
          setDecoded({ vpa: sample, format: 'UPI QR (EMVCo)', payloadSize: 120 + (next.size % 180), amountLocked: true });
          run(sample);
        } else {
          setFileError(failure.message);
        }
      },
    );
  };

  return (
    <>
      <ToolHeader feature={feature} index={13} />

      <div className="space-y-4">
        <div className="card p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                run(value);
              }}
              noValidate
            >
              <label htmlFor="upi-target" className="text-[12.5px] font-medium text-ink">
                UPI ID or payment link <span className="text-critical">*</span>
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <FiCreditCard className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-3" aria-hidden="true" />
                  <input
                    id="upi-target"
                    value={value}
                    onChange={(event) => {
                      setValue(event.target.value);
                      if (error) setError('');
                    }}
                    placeholder="merchant@okhdfcbank"
                    spellCheck="false"
                    autoComplete="off"
                    aria-invalid={Boolean(error)}
                    className={cn(
                      'h-11 w-full rounded-xl border bg-surface pl-10 pr-3 font-mono text-[12.5px] text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10',
                      error ? 'border-critical/60' : 'border-line-strong',
                    )}
                  />
                </div>
                <Button type="submit" className="h-11 shrink-0 px-4" loading={phase === 'scanning'}>
                  {phase === 'scanning' ? 'Checking…' : 'Check UPI'}
                </Button>
              </div>
              {error ? <p className="mt-1.5 text-[12px] text-critical" role="alert">{error}</p> : <p className="mt-1.5 text-[11.5px] text-ink-3">Accepts a VPA or a upi:// payment link with a pa parameter.</p>}

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                <span className="text-[10.5px] uppercase tracking-[0.07em] text-ink-3">Samples</span>
                {DETECTION_SAMPLES.upi.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => run(sample)}
                    className={cn(
                      'rounded-md border px-2 py-1 font-mono text-[10px] transition',
                      sample === value ? 'border-brand/30 bg-brand/10 text-brand' : 'border-line bg-surface-2/70 text-ink-2 hover:border-brand/30 hover:text-brand',
                    )}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </form>

            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[12.5px] font-medium text-ink">QR code upload</p>
                <span className="text-[10.5px] text-ink-3">optional</span>
              </div>
              <FileDrop
                file={file}
                onFile={handleFile}
                onClear={() => {
                  setFile(null);
                  setDecoded(null);
                }}
                label="Drop a payment QR image, or browse"
                hint="PNG, JPG or WebP · up to 5 MB"
                error={fileError}
                className="mt-1.5"
              />
              {decoding ? (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-2">
                  <Spinner className="h-3.5 w-3.5" label="Decoding QR" /> Decoding QR payload…
                </div>
              ) : null}
              {decoded ? (
                <div className="mt-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                  <p className="text-[9.5px] uppercase tracking-[0.07em] text-ink-3">Decoded payload</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink">{decoded.vpa}</p>
                  <p className="text-[9.5px] text-ink-3">{decoded.format} · {decoded.payloadSize} bytes · {decoded.amountLocked ? 'amount locked in payload' : 'no fixed amount'}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {phase === 'done' && result ? (
          <div className="space-y-4 anim-fade">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/50 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                {result.live ? <Badge tone="safe" size="sm" dot>Live analysis</Badge> : <DemoBadge />}
                <span className="truncate font-mono text-[11px] text-ink-2">{result.vpa}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CopyButton value={result.vpa} label="Copy VPA" compact />
                <button
                  type="button"
                  onClick={() => run(value, { fresh: true })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-2 transition hover:border-brand/30 hover:text-brand"
                >
                  <FiRefreshCw className="text-[12px]" aria-hidden="true" /> Re-check
                </button>
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.score > 55 ? 'bg-critical' : 'bg-safe')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreRing
                  value={result.score}
                  tone={result.score > 55 ? 'critical' : 'safe'}
                  className="mx-auto h-[104px] w-[104px]"
                  stroke={8}
                  valueClassName="text-[24px]"
                  caption="risk"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.score > 55 ? 'critical' : 'safe'} dot>
                      {result.score > 55 ? 'High-risk payment' : 'Low-risk payment'}
                    </Badge>
                    <Badge tone="neutral">{result.payee.type}</Badge>
                    <Badge tone={result.payee.verified ? 'safe' : result.live ? 'neutral' : 'high'}>{result.payee.verified ? 'Merchant verified' : result.live ? 'Owner not verifiable' : 'Unverified payee'}</Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-[0.06em] text-ink-3">Payee</p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-ink">{result.payee.name}</p>
                    </div>
                    <div className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-[0.06em] text-ink-3">Amount</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink">{result.amount}</p>
                    </div>
                    <div className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-[0.06em] text-ink-3">Bank handle</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink">{result.payee.bank}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <SectionCard title="Verification checks" description="Each control assessed for this payee" icon={FiShield}>
                <ul className="space-y-2">
                  {result.checks.map((check) => {
                    const Icon = CHECK_ICON[check.status];
                    return (
                      <li key={check.label} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                        <Icon className={cn('mt-0.5 shrink-0 text-[13px]', CHECK_TONE[check.status])} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11.5px] font-medium text-ink">{check.label}</p>
                          <p className="text-[10px] leading-4 text-ink-3">{check.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard title="Merchant detail" description="Registered payee information" icon={FiCreditCard}>
                  <DataRow label="UPI handle" value={result.vpa} mono />
                  <DataRow label="Display name" value={result.payee.name} />
                  <DataRow label="Account type" value={result.payee.type} />
                  <DataRow label="Account age" value={result.payee.accountAgeDays == null ? 'Not available' : `${result.payee.accountAgeDays} days`} />
                  <DataRow label="Registered" value={result.merchant.registered ? 'Yes' : 'No'} />
                  <DataRow label="GSTIN" value={result.merchant.gstin || 'Not available'} mono />
                  <DataRow label="Category" value={result.merchant.category} />
                  <DataRow label="Note" value={result.note} />
                </SectionCard>

                <SectionCard title="QR payload" description="Decoded payment intent" icon={FiGrid}>
                  <DataRow label="Format" value={result.qr.format} />
                  <DataRow label="Payload size" value={`${result.qr.payloadSize} bytes`} />
                  <DataRow label="Amount locked" value={result.qr.amountLocked ? 'Yes — fixed collect' : 'No — user enters amount'} />
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-[10.5px]">
                      <span className="text-ink-3">Indicator strength</span>
                      <span className="font-mono text-ink-2">{result.score}/100</span>
                    </div>
                    <Meter value={result.score} tone={result.score > 55 ? 'critical' : 'safe'} className="mt-1.5" />
                  </div>
                </SectionCard>
              </div>
            </div>

            <SectionCard
              title="Community scam reports"
              description="Matching reports for this handle"
              icon={FiAlertTriangle}
              action={<Badge tone={result.reports.length ? 'critical' : 'safe'}>{result.reports.length} reports</Badge>}
              flush
            >
              {result.reports.length ? (
                <ul className="divide-y divide-line/70">
                  {result.reports.map((report) => (
                    <li key={report.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                      <span className="font-mono text-[10.5px] text-ink-3">{report.id}</span>
                      <span className="text-[11px] text-ink">{report.category}</span>
                      <span className="text-[10px] text-ink-3">{formatDate(report.date)}</span>
                      <SeverityBadge severity={report.status === 'confirmed' ? 'critical' : 'medium'} size="sm" className="ml-auto" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-6 text-center">
                  <FiCheckCircle className="mx-auto text-safe" aria-hidden="true" />
                  <p className="mt-1.5 text-[11.5px] font-medium text-ink">No scam reports</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-3">This handle has no community reports in the last 12 months.</p>
                </div>
              )}
            </SectionCard>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Payment indicators" description="Signals behind the verdict" icon={FiInfo}>
                <ul className="space-y-2">
                  {result.indicators.map((indicator) => (
                    <li key={indicator} className="flex items-start gap-2">
                      <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', result.score > 55 ? 'bg-critical' : 'bg-safe')} aria-hidden="true" />
                      <span className="text-[11px] leading-5 text-ink-2">{indicator}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Link to="/report-threat" className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                    Report this payee <FiArrowRight className="text-[10px]" aria-hidden="true" />
                  </Link>
                </div>
              </SectionCard>

              <Notice tone={result.score > 55 ? 'critical' : 'safe'} icon={result.score > 55 ? FiAlertTriangle : FiShield} title={result.score > 55 ? 'Do not approve this collect request' : 'Payment looks consistent'}>
                {result.live
                  ? (result.score > 55 ? `${result.summary} UPI payments cannot be reversed once approved.` : 'Check that the name shown in your UPI app matches who you intend to pay before approving.')
                  : result.score > 55
                    ? 'The handle is unregistered, uses an individual account for a cashback promise and has confirmed scam reports. Approving this request will likely result in an irreversible loss.'
                    : 'The payee is a registered merchant with a consistent history and no reports. Confirm the amount and note before approving.'}
              </Notice>
            </div>

            <Notice tone="neutral" icon={FiCpu}>
              {result.live
                ? result.limitations?.[0]
                : 'UPI verification is simulated. No payment network, bank or QR decoder was contacted.'}
            </Notice>
          </div>
        ) : null}
      </div>
    </>
  );
}
