import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FiAlertTriangle, FiArrowRight, FiCheck, FiCheckCircle, FiClock, FiCpu, FiExternalLink,
  FiGlobe, FiInfo, FiLayers, FiLock, FiRefreshCw, FiShield, FiSlash, FiTarget, FiZap,
} from 'react-icons/fi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Badge, { SeverityBadge, VerdictBadge } from '../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../components/ui/Card';
import { Field, Input, Checkbox } from '../components/ui/Field';
import { ScoreRing, Gauge, Spinner } from '../components/ui/Progress';
import Notice from '../components/ui/Notice';
import Accordion from '../components/ui/Accordion';
import CopyButton from '../components/ui/CopyButton';
import EmptyState from '../components/ui/EmptyState';
import { SCAN_STAGES } from '../data/features';
import { SCAN_HISTORY } from '../data/dashboard';
import { buildScanReport, SAMPLE_TARGETS, VERDICT_META } from '../lib/mockEngine';
import { normalizeUrl } from '../lib/validation';
import { cn, formatDateTime, formatNumber, timeAgo, truncateMiddle } from '../lib/utils';
import { useToast } from '../context/ToastContext';

const EXTRA_MODULES = [
  { id: 'visual', label: 'Visual similarity', hint: 'Compare layout against brand templates' },
  { id: 'behaviour', label: 'JavaScript sandbox', hint: 'Observe clipboard and keystroke access' },
  { id: 'kit', label: 'Phishing-kit match', hint: 'Fingerprint against known kit families' },
  { id: 'payments', label: 'Payment link check', hint: 'Inspect UPI links found in the page' },
];

const TONE_BY_VERDICT = { safe: 'safe', suspicious: 'medium', malicious: 'critical' };

function ScanProgress({ stageIndex, url, onCancel }) {
  const percent = Math.round((stageIndex / SCAN_STAGES.length) * 100);
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-surface-3">
        <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="mx-auto flex w-full max-w-[180px] flex-col items-center justify-center gap-3">
          <div className="relative grid h-[120px] w-[120px] place-items-center">
            <div className="absolute inset-0 rounded-full border border-line" />
            <div className="absolute inset-3 rounded-full border border-dashed border-line-strong anim-spin-slow" />
            <div className="radar absolute inset-0 rounded-full" />
            <div className="relative grid h-14 w-14 place-items-center rounded-full border border-brand/25 bg-brand/10 text-brand">
              <FiGlobe className="text-xl anim-blink" aria-hidden="true" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[22px] font-semibold tabular text-ink">{percent}%</p>
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-ink-3">analysing</p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">Scanning target</p>
              <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-2">{truncateMiddle(url, 42, 14)}</p>
            </div>
            <button type="button" onClick={onCancel} className="shrink-0 text-[11px] font-medium text-ink-3 transition hover:text-critical">
              Cancel
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {SCAN_STAGES.map((stage, index) => {
              const done = index < stageIndex;
              const active = index === stageIndex;
              return (
                <li key={stage.key} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px]',
                      done && 'border-safe/40 bg-safe/15 text-safe',
                      active && 'border-brand/40 bg-brand/15 text-brand',
                      !done && !active && 'border-line bg-surface-2 text-ink-3',
                    )}
                  >
                    {done ? <FiCheck aria-hidden="true" /> : active ? <Spinner className="h-2.5 w-2.5" label={stage.label} /> : <span className="h-1 w-1 rounded-full bg-current" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[12px] font-medium', active ? 'text-ink' : done ? 'text-ink-2' : 'text-ink-3')}>
                      {stage.label}
                    </p>
                    <p className="truncate text-[10.5px] text-ink-3">{stage.detail}</p>
                  </div>
                  {done ? <span className="shrink-0 font-mono text-[10px] text-ink-3">ok</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function IndicatorList({ indicators }) {
  if (!indicators.length) {
    return (
      <EmptyState
        icon={FiCheckCircle}
        title="No risk indicators found"
        description="Content, certificate, redirect and reputation checks returned no signals for this target."
        compact
      />
    );
  }

  return (
    <Accordion
      items={indicators.map((indicator) => ({
        id: indicator.id,
        title: indicator.label,
        meta: indicator.detail,
        icon: FiAlertTriangle,
        badge: <SeverityBadge severity={indicator.severity} size="sm" />,
        children: (
          <div className="space-y-2">
            <p>{indicator.detail}</p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2">
              <span className="text-[10px] uppercase tracking-[0.08em] text-ink-3">Evidence</span>
              <code className="break-all font-mono text-[11px] text-ink-2">{indicator.evidence}</code>
            </div>
          </div>
        ),
      }))}
    />
  );
}

export default function ScanUrl() {
  const [searchParams] = useSearchParams();
  const [value, setValue] = useState(searchParams.get('url') || '');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle');
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [enabled, setEnabled] = useState(() => new Set(EXTRA_MODULES.map((module) => module.id)));
  const timers = useRef([]);
  const autoRan = useRef(false);
  const toast = useToast();

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const startScan = useCallback((raw) => {
    const parsed = normalizeUrl(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      setPhase('idle');
      return false;
    }
    clearTimers();
    setError('');
    setValue(parsed.url);
    setResult(null);
    setPhase('scanning');
    setStageIndex(0);

    SCAN_STAGES.forEach((_, index) => {
      timers.current.push(window.setTimeout(() => setStageIndex(index + 1), 300 * (index + 1)));
    });
    timers.current.push(
      window.setTimeout(() => {
        setResult(buildScanReport(parsed.url));
        setPhase('done');
        toast.success('Scan complete', `Verdict generated for ${parsed.domain}.`);
      }, 300 * SCAN_STAGES.length + 260),
    );
    return true;
  }, [toast]);

  useEffect(() => {
    const target = searchParams.get('url');
    if (target && !autoRan.current) {
      autoRan.current = true;
      startScan(target);
    }
  }, [searchParams, startScan]);

  const handleSubmit = (event) => {
    event.preventDefault();
    startScan(value);
  };

  const toggleModule = (id) => {
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const modulesRun = 9 + enabled.size;
  const tone = result ? TONE_BY_VERDICT[result.verdict] : 'brand';

  return (
    <>
      <PageHeader
        eyebrow="URL scanner"
        title="Scan any link before you open it."
        description="Paste a URL or domain to run the full signal mesh: DNS, TLS, content, redirects, brand similarity and threat intelligence — returned as one explainable verdict."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Scan URL' }]}
        demo
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiLayers className="text-[12px]" aria-hidden="true" /> 9 default checks</span>
            <span className="inline-flex items-center gap-1.5"><FiClock className="text-[12px]" aria-hidden="true" /> ~1.8s simulated</span>
            <span className="inline-flex items-center gap-1.5"><FiShield className="text-[12px]" aria-hidden="true" /> No live scanner connected</span>
          </>
        }
        actions={
          <Button to="/threat-intelligence" variant="secondary" size="md" iconRight={FiArrowRight}>
            Threat database
          </Button>
        }
      />

      <div className="shell py-8 lg:py-10">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
          <div className="min-w-0 space-y-5">
            <Card className="p-4 sm:p-5">
              <form onSubmit={handleSubmit} noValidate>
                <Field
                  label="Website URL or domain"
                  htmlFor="scan-target"
                  hint="Supports http and https targets. Local addresses are rejected."
                  error={error}
                  required
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      <Input
                        id="scan-target"
                        icon={FiGlobe}
                        value={value}
                        onChange={(event) => {
                          setValue(event.target.value);
                          if (error) setError('');
                        }}
                        placeholder="https://secure-login.example/verify"
                        spellCheck="false"
                        autoComplete="off"
                        invalid={Boolean(error)}
                      />
                    </div>
                    <Button type="submit" className="h-11 shrink-0 px-5" icon={FiZap} disabled={phase === 'scanning'}>
                      {phase === 'scanning' ? 'Scanning…' : 'Run scan'}
                    </Button>
                  </div>
                </Field>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                <span className="text-[10.5px] uppercase tracking-[0.07em] text-ink-3">Samples</span>
                {SAMPLE_TARGETS.map((sample) => (
                  <button
                    key={sample.url}
                    type="button"
                    onClick={() => startScan(sample.url)}
                    className="rounded-md border border-line bg-surface-2/70 px-2 py-1 font-mono text-[10px] text-ink-2 transition hover:border-brand/30 hover:text-brand"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </Card>

            {phase === 'scanning' ? (
              <ScanProgress
                stageIndex={stageIndex}
                url={value}
                onCancel={() => {
                  clearTimers();
                  setPhase('idle');
                  setStageIndex(0);
                  toast.info('Scan cancelled');
                }}
              />
            ) : null}

            {phase === 'done' && result ? (
              <>
                {/* Verdict summary */}
                <Card className="relative overflow-hidden">
                  <div className={cn('h-1 w-full', result.verdict === 'malicious' ? 'bg-critical' : result.verdict === 'suspicious' ? 'bg-medium' : 'bg-safe')} />
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      <ScoreRing
                        value={result.riskScore}
                        tone={tone}
                        className="h-[104px] w-[104px]"
                        stroke={8}
                        valueClassName="text-[26px]"
                        caption="risk"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <VerdictBadge verdict={result.verdict} />
                          <Badge tone="neutral">{result.confidence}% confidence</Badge>
                          <Badge tone="brand" icon={FiCpu}>Simulated</Badge>
                        </div>
                        <p className="mt-2 break-all font-mono text-[13px] text-ink">{result.domain}</p>
                        <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-ink-3">
                          <span>Scan ID <span className="font-mono text-ink-2">{result.scanId}</span></span>
                          <span>{formatDateTime(result.scannedAt)}</span>
                          <span>{formatNumber(modulesRun)} modules executed</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-4">
                      {[
                        { label: 'Risk score', value: `${result.riskScore}/100`, tone: tone },
                        { label: 'Indicators', value: result.indicators.length, tone: result.indicators.length ? 'high' : 'safe' },
                        { label: 'Redirect hops', value: result.redirects.length, tone: 'low' },
                        { label: 'Intel matches', value: result.intel.filter((item) => item.status !== 'clean' && item.status !== 'unrated').length, tone: 'medium' },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.06em] text-ink-3">{item.label}</p>
                          <p className={cn('mt-1 text-[15px] font-semibold tabular', item.tone === 'safe' ? 'text-safe' : item.tone === 'critical' ? 'text-critical' : item.tone === 'high' ? 'text-high' : item.tone === 'medium' ? 'text-medium' : 'text-ink')}>
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={() => startScan(result.url)}>
                        Re-scan
                      </Button>
                      <CopyButton value={`${window.location.origin}/scan?url=${encodeURIComponent(result.url)}`} label="Copy report link" className="h-9 px-3 text-[12px]" />
                      <Button size="sm" variant="ghost" to={`/analysis?domain=${encodeURIComponent(result.domain)}`} iconRight={FiArrowRight}>
                        Security assessment
                      </Button>
                      <Button size="sm" variant="ghost" to={`/ssl-checker?domain=${encodeURIComponent(result.domain)}`} icon={FiLock}>
                        SSL report
                      </Button>
                    </div>
                  </div>
                </Card>

                <div className="grid gap-5 md:grid-cols-2">
                  <SectionCard title="Risk breakdown" description="Weighted signal categories" icon={FiTarget}>
                    <div className="space-y-3">
                      {Object.entries(result.categories).map(([key, score]) => (
                        <Gauge
                          key={key}
                          label={key.charAt(0).toUpperCase() + key.slice(1)}
                          value={score}
                          tone={score > 70 ? 'critical' : score > 45 ? 'high' : score > 25 ? 'medium' : 'safe'}
                        />
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Domain information" description="Registration and hosting context" icon={FiGlobe}>
                    <DataRow label="Registrar" value={result.domainInfo.registrar} />
                    <DataRow label="Domain age" value={`${formatNumber(result.domainInfo.ageDays)} days`} />
                    <DataRow label="IP address" value={result.domainInfo.ip} mono />
                    <DataRow label="Hosting ASN" value={`${result.domainInfo.asn} · ${result.domainInfo.org}`} />
                    <DataRow label="Country" value={`${result.domainInfo.country} (${result.domainInfo.countryCode})`} />
                    <DataRow label="Privacy shield" value={result.domainInfo.privacy ? 'Enabled' : 'Not detected'} />
                    <DataRow label="Nameservers" value={result.domainInfo.nameservers.join(', ')} mono />
                  </SectionCard>
                </div>

                <SectionCard
                  title="Detection explanations"
                  description={`${result.indicators.length} risk indicator${result.indicators.length === 1 ? '' : 's'} contributed to the verdict`}
                  icon={FiAlertTriangle}
                  action={<Badge tone={tone}>{VERDICT_META[result.verdict].label}</Badge>}
                >
                  <IndicatorList indicators={result.indicators} />
                </SectionCard>

                <div className="grid gap-5 md:grid-cols-2">
                  <SectionCard title="SSL / TLS status" description="Transport and certificate posture" icon={FiLock}>
                    <div className="flex items-center gap-4">
                      <ScoreRing value={result.ssl.valid ? 92 : 34} tone={result.ssl.valid ? 'safe' : 'critical'} className="h-20 w-20" stroke={7} valueClassName="text-lg" label={result.ssl.grade} caption="grade" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <DataRow label="Issuer" value={result.ssl.issuer} />
                        <DataRow label="Protocol" value={result.ssl.protocol} />
                        <DataRow label="Expires in" value={`${result.ssl.daysRemaining} days`} />
                        <DataRow label="Key" value={result.ssl.keyType} />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone={result.ssl.ctLogged ? 'safe' : 'medium'} dot>
                        {result.ssl.ctLogged ? 'CT logged' : 'No SCTs found'}
                      </Badge>
                      <Badge tone={result.ssl.valid ? 'safe' : 'critical'} dot>
                        {result.ssl.valid ? 'Chain valid' : 'Chain invalid'}
                      </Badge>
                    </div>
                  </SectionCard>

                  <SectionCard title="Threat intelligence matches" description="Independent source consensus" icon={FiTarget}>
                    <ul className="space-y-2">
                      {result.intel.map((source) => (
                        <li key={source.source} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-ink">{source.source}</p>
                            <p className="text-[10.5px] text-ink-3">
                              {source.lastSeen ? `last seen ${timeAgo(source.lastSeen)}` : 'no record'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-mono text-[10.5px] text-ink-3">{source.confidence}%</span>
                            <VerdictBadge verdict={source.status === 'unrated' ? 'monitoring' : source.status === 'clean' ? 'safe' : source.status === 'malicious' ? 'active' : 'suspicious'} size="sm" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <SectionCard title="Redirect chain" description="Every hop from request to landing page" icon={FiExternalLink}>
                    {result.redirects.length ? (
                      <ol className="rail space-y-3">
                        {result.redirects.map((hop) => (
                          <li key={hop.step} className="relative flex gap-3 pl-0">
                            <span className="z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-surface font-mono text-[10px] text-ink-2">
                              {hop.step}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-all font-mono text-[11px] text-ink">{hop.from}</p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-3">
                                <Badge tone="neutral" size="sm">{hop.status}</Badge>
                                <span>{hop.type}</span>
                                <span>·</span>
                                <span>{hop.note}</span>
                              </p>
                              <p className="mt-1 break-all font-mono text-[10.5px] text-brand">→ {hop.to}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <EmptyState icon={FiSlash} title="No redirects" description="The target resolved directly without intermediate hops." compact />
                    )}
                  </SectionCard>

                  <SectionCard title="Recommendations" description="What to do with this result" icon={FiInfo}>
                    <ul className="space-y-2.5">
                      {result.recommendations.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full', result.verdict === 'malicious' ? 'bg-critical/15 text-critical' : 'bg-brand/15 text-brand')}>
                            <FiArrowRight className="text-[9px]" aria-hidden="true" />
                          </span>
                          <span className="text-[12px] leading-5 text-ink-2">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 rounded-lg border border-line bg-surface-2/60 p-3">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Positive signals</p>
                      <ul className="mt-1.5 space-y-1">
                        {result.positiveSignals.map((signal) => (
                          <li key={signal} className="flex items-start gap-1.5 text-[11.5px] leading-5 text-ink-2">
                            <FiCheck className="mt-1 shrink-0 text-[10px] text-safe" aria-hidden="true" /> {signal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </SectionCard>
                </div>

                <Notice tone="neutral" icon={FiCpu} title="This result is simulated">
                  No request left your browser. The verdict was generated from deterministic demo data in the frontend;
                  the same components will render real API output once a scanning service is connected.
                </Notice>
              </>
            ) : null}

            {phase === 'idle' ? (
              <SectionCard
                title="What a scan inspects"
                description="Nine core checks run by default, plus any optional modules you enable."
                icon={FiShield}
              >
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    { icon: FiGlobe, label: 'Domain & DNS', detail: 'Registration age, registrar, nameserver posture' },
                    { icon: FiLock, label: 'TLS & certificate', detail: 'Chain, issuer, CT logs, revocation' },
                    { icon: FiLayers, label: 'Content structure', detail: 'Forms, hidden fields, third-party assets' },
                    { icon: FiExternalLink, label: 'Redirect chain', detail: 'Every hop including meta and JS redirects' },
                    { icon: FiTarget, label: 'Reputation', detail: 'Blocklists, campaign graph, community reports' },
                    { icon: FiCpu, label: 'Behaviour sandbox', detail: 'Scripts, clipboard hooks, keystroke capture' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                        <Icon className="mt-0.5 shrink-0 text-[14px] text-ink-3" aria-hidden="true" />
                        <div>
                          <p className="text-[12px] font-medium text-ink">{item.label}</p>
                          <p className="mt-0.5 text-[11px] leading-4 text-ink-3">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-[84px]">
            <SectionCard title="Scan configuration" description="Enable deeper modules" icon={FiZap}>
              <div className="space-y-3">
                {EXTRA_MODULES.map((module) => (
                  <Checkbox
                    key={module.id}
                    label={module.label}
                    description={module.hint}
                    checked={enabled.has(module.id)}
                    onChange={() => toggleModule(module.id)}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                <span className="text-[11.5px] text-ink-2">Modules per scan</span>
                <span className="font-mono text-[12px] font-semibold text-brand">{modulesRun}</span>
              </div>
              <p className="mt-2 text-[10.5px] leading-4 text-ink-3">
                Toggles affect the displayed module count only — all results are simulated locally.
              </p>
            </SectionCard>

            <SectionCard title="Recent scans" description="From your demo workspace" action={<Link to="/dashboard" className="text-[11px] font-medium text-brand">View all</Link>} flush>
              <ul className="divide-y divide-line/70">
                {SCAN_HISTORY.slice(0, 6).map((scan) => (
                  <li key={scan.id}>
                    <button
                      type="button"
                      onClick={() => startScan(`https://${scan.target}`)}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-surface-2/60"
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', scan.verdict === 'malicious' ? 'bg-critical' : scan.verdict === 'suspicious' ? 'bg-medium' : 'bg-safe')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[11px] text-ink">{truncateMiddle(scan.target, 26, 8)}</span>
                        <span className="block text-[10px] text-ink-3">{timeAgo(scan.scannedAt)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-ink-3">{scan.score}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <Notice tone="info" icon={FiInfo} title="Frontend-only build">
              Detection is not real. The interface, contracts and states are production-shaped so a backend can be
              attached without changing this page.
            </Notice>
          </aside>
        </div>
      </div>
    </>
  );
}
