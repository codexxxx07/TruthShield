import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiAlertTriangle, FiArrowRight, FiArrowUpRight, FiCheck, FiChevronRight, FiCpu, FiCrosshair,
  FiEye, FiGlobe, FiLayers, FiLock, FiShield, FiTarget, FiTrendingUp, FiZap,
} from 'react-icons/fi';
import Button from '../components/ui/Button';
import Badge, { DemoBadge } from '../components/ui/Badge';
import { ScoreRing, Gauge } from '../components/ui/Progress';
import { AreaChart, DonutChart } from '../components/ui/Charts';
import SectionHeading from '../components/ui/SectionHeading';
import FeatureIcon from '../components/ui/FeatureIcon';
import Notice from '../components/ui/Notice';
import { CORE_FEATURES, DETECTION_FEATURES } from '../data/features';
import { DAILY_DETECTIONS, THREAT_DISTRIBUTION } from '../data/dashboard';
import { THREAT_RECORDS, THREAT_STATS } from '../data/threats';
import { buildScanReport, SAMPLE_TARGETS } from '../lib/mockEngine';
import { normalizeUrl } from '../lib/validation';
import { cn, formatNumber, timeAgo } from '../lib/utils';
import useCountUp from '../hooks/useCountUp';

const HERO_SAMPLE = buildScanReport('https://paypal-secure-login.example/session/verify');

const HERO_STATS = [
  { label: 'Indicators tracked', value: THREAT_STATS.totalIndicators, suffix: '', icon: FiTarget },
  { label: 'Active campaigns', value: THREAT_STATS.activeCampaigns, suffix: '', icon: FiZap },
  { label: 'Takedowns this week', value: THREAT_STATS.takedowns7d, suffix: '', icon: FiShield },
  { label: 'Verdict precision', value: 98.2, suffix: '%', icon: FiTrendingUp, decimals: 1 },
];

const PIPELINE = [
  {
    step: '01',
    title: 'Ingest the target',
    body: 'A URL, domain, certificate, UPI handle or QR code — normalised and fingerprinted in milliseconds.',
    icon: FiCrosshair,
  },
  {
    step: '02',
    title: 'Run the mesh',
    body: 'Content, certificate, infrastructure and behaviour checks execute in parallel against our signal graph.',
    icon: FiLayers,
  },
  {
    step: '03',
    title: 'Explain the verdict',
    body: 'Signals are weighted into one risk score, with every contributing factor written out for your team.',
    icon: FiEye,
  },
];

const WHY = [
  { title: 'Explainable by default', body: 'Every score decomposes into named signals, evidence and impact — no opaque black box.', metric: '100%', metricLabel: 'findings explained' },
  { title: 'Signal over noise', body: 'Weighted scoring across certificate, content, brand and infrastructure layers reduces alert fatigue.', metric: '1.8%', metricLabel: 'false positive rate' },
  { title: 'Built for analysts', body: 'Deep-dive views for every module, from CT log timelines to sandboxed JavaScript traces.', metric: '13', metricLabel: 'detection modules' },
  { title: 'Ready for integration', body: 'The UI is layered over a clean data contract so a real scanning API can drop in without a rewrite.', metric: '1', metricLabel: 'swap-in API layer' },
];

function HeroStat({ stat }) {
  const animated = useCountUp(stat.value, { duration: 1200 });
  const Icon = stat.icon;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand/20 bg-brand/[0.07] text-brand">
        <Icon className="text-[14px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[19px] font-semibold leading-none tracking-[-0.02em] tabular text-ink">
          {stat.decimals ? animated.toFixed(stat.decimals) : formatNumber(Math.round(animated))}
          {stat.suffix}
        </p>
        <p className="mt-1 truncate font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-3">{stat.label}</p>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      <div className="pointer-events-none absolute -inset-6 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/70" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line/60" />
        <div className="radar absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40" />
      </div>

      <div className="card top-sheen hud-corners relative overflow-hidden p-0 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <span className="flex items-center gap-2 text-[11.5px] font-medium text-ink-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-critical opacity-60 anim-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-critical" />
            </span>
            Live signal trace
          </span>
          <DemoBadge />
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">Target</p>
              <p className="mt-1 truncate font-mono text-[12.5px] text-ink">paypal-secure-login.example</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="critical" dot>Malicious</Badge>
                <Badge tone="neutral">96% confidence</Badge>
              </div>
            </div>
            <ScoreRing value={HERO_SAMPLE.riskScore} className="h-[76px] w-[76px]" stroke={7} valueClassName="text-[19px]" caption="risk" />
          </div>

          <div className="stagger mt-4 space-y-2">
            {HERO_SAMPLE.indicators.slice(0, 3).map((indicator) => (
              <div
                key={indicator.id}
                className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/60 px-2.5 py-2"
              >
                <FiAlertTriangle
                  className={cn(
                    'mt-0.5 shrink-0 text-[12px]',
                    indicator.severity === 'critical' ? 'text-critical' : 'text-high',
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-[11.5px] font-medium text-ink">{indicator.label}</p>
                  <p className="truncate font-mono text-[10px] text-ink-3">{indicator.evidence}</p>
                </div>
                <span className="ml-auto shrink-0 font-mono text-[9.5px] uppercase tracking-wide text-ink-3">
                  {indicator.severity}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface-2/40">
            {[
              { label: 'Certificate', value: 'DV · 9d' },
              { label: 'Domain age', value: '9 days' },
              { label: 'Intel hits', value: '4 / 5' },
            ].map((item) => (
              <div key={item.label} className="px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-[0.08em] text-ink-3">{item.label}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-ink">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-4 py-2.5">
          <span className="font-mono text-[10px] text-ink-3">scan TS-9F21C4 · 6 stages · 1.8s</span>
          <Link to="/scan" className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
            Full report <FiArrowUpRight className="text-[11px]" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-md)] sm:flex anim-float">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-safe/10 text-safe">
          <FiLock className="text-[13px]" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[10.5px] font-semibold text-ink">Lookalike blocked</p>
          <p className="font-mono text-[9.5px] text-ink-3">ct_logs · 2 min ago</p>
        </div>
      </div>
    </div>
  );
}

function HeroScanner() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = (event) => {
    event.preventDefault();
    const parsed = normalizeUrl(value);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    navigate(`/scan?url=${encodeURIComponent(parsed.url)}`);
  };

  return (
    <div className="mt-7">
      <form onSubmit={submit} noValidate>
        <div className="scanner-shell flex flex-col gap-2 p-1.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5">
            <FiGlobe className="shrink-0 text-[16px] text-ink-3" aria-hidden="true" />
            <label htmlFor="hero-url" className="sr-only">Website URL to scan</label>
            <input
              id="hero-url"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError('');
              }}
              placeholder="Paste a URL or domain — e.g. secure-login.example"
              className="h-11 w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
              autoComplete="off"
              spellCheck="false"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'hero-url-error' : undefined}
            />
          </div>
          <Button type="submit" size="md" className="h-11 shrink-0 sm:px-5" iconRight={FiArrowRight}>
            Scan Website
          </Button>
        </div>
        {error ? (
          <p id="hero-url-error" role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] text-critical">
            <FiAlertTriangle className="text-[13px]" aria-hidden="true" /> {error}
          </p>
        ) : null}
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-ink-3">Try a sample:</span>
        {SAMPLE_TARGETS.slice(0, 4).map((sample) => (
          <button
            key={sample.url}
            type="button"
            onClick={() => navigate(`/scan?url=${encodeURIComponent(sample.url)}`)}
            className="rounded-md border border-line bg-surface-2/70 px-2 py-1 font-mono text-[10.5px] text-ink-2 transition hover:border-brand/30 hover:text-brand"
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [activePipeline, setActivePipeline] = useState(1);
  const recentThreats = useMemo(() => THREAT_RECORDS.slice(0, 4), []);

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-lines" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 circuit-grid opacity-30" aria-hidden="true" />
        <div className="aurora aurora-brand -top-40 left-[8%] h-72 w-[520px]" aria-hidden="true" />
        <div className="aurora aurora-accent right-[2%] top-[10%] h-56 w-[320px] opacity-30" aria-hidden="true" />
        <div className="aurora aurora-safe right-[4%] top-[30%] h-56 w-[360px] opacity-30" aria-hidden="true" />

        <div className="shell relative pb-14 pt-12 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="neon-chip">
                  <FiShield className="text-[11px]" aria-hidden="true" /> Digital trust platform
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10.5px] font-medium text-ink-3">
                  <span className="status-dot text-safe" aria-hidden="true" /> 13 detection modules online
                </span>
              </div>

              <h1 className="mt-5 font-display text-[38px] font-semibold leading-[1.04] tracking-[-0.045em] text-ink sm:text-[52px] lg:text-[58px]">
                Trust nothing.
                <br />
                <span className="text-gradient title-glow">Verify everything.</span>
              </h1>

              <p className="mt-4 max-w-xl text-[14px] leading-6 text-ink-2 sm:text-[15px] sm:leading-7">
                TruthShield inspects any link across certificates, hosting, content and behaviour — then
                returns a single, explainable verdict your team can act on before anyone clicks.
              </p>

              <HeroScanner />

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11.5px] text-ink-3">
                <span className="inline-flex items-center gap-1.5"><FiCheck className="text-safe" aria-hidden="true" /> No sign-up to scan</span>
                <span className="inline-flex items-center gap-1.5"><FiCheck className="text-safe" aria-hidden="true" /> Explainable risk score</span>
                <span className="inline-flex items-center gap-1.5"><FiCheck className="text-safe" aria-hidden="true" /> Frontend demo data</span>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-2.5">
                <Button to="/advanced" variant="outline" size="md" iconRight={FiArrowUpRight}>
                  Explore security features
                </Button>
                <Button to="/dashboard" variant="ghost" size="md" iconRight={FiChevronRight}>
                  See the analyst dashboard
                </Button>
              </div>
            </div>

            <HeroVisual />
          </div>

          <div className="mt-12 grid grid-cols-2 gap-5 border-t border-line pt-6 sm:grid-cols-4 sm:gap-6 lg:mt-16">
            {HERO_STATS.map((stat) => (
              <HeroStat key={stat.label} stat={stat} />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[10.5px] text-ink-3">
            <FiCpu className="text-[11px]" aria-hidden="true" />
            Simulated demo dataset — figures are illustrative, not live telemetry.
          </p>
        </div>
      </section>

      {/* ---------------- PLATFORM OVERVIEW ---------------- */}
      <section className="border-t border-line bg-surface/30 py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-14">
            <div className="lg:sticky lg:top-24">
              <SectionHeading
                eyebrow="Platform overview"
                title="One verdict, assembled from every layer of the web."
                description="Most scanners look at a blocklist and stop. TruthShield correlates what a site is, who issued it, where it lives, how it behaves and what it imitates."
              />
              <div className="mt-6 space-y-3">
                {[
                  'Certificate and CA trust analysis',
                  'Brand, favicon and visual clone detection',
                  'Hosting, DNS and redirect infrastructure',
                  'Sandboxed JavaScript behaviour',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-safe/15 text-safe">
                      <FiCheck className="text-[10px]" aria-hidden="true" />
                    </span>
                    <span className="text-[12.5px] leading-5 text-ink-2">{item}</span>
                  </div>
                ))}
              </div>
              <Button to="/analysis" variant="brandSoft" size="sm" className="mt-6" iconRight={FiArrowRight}>
                View a security assessment
              </Button>
            </div>

            <div className="relative">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">Analysis pipeline</span>
                  </div>
                  <DemoBadge label="Illustrative" />
                </div>
                <div className="p-4 sm:p-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PIPELINE.map((item, index) => {
                      const Icon = item.icon;
                      const active = activePipeline === index;
                      return (
                        <button
                          key={item.step}
                          type="button"
                          onMouseEnter={() => setActivePipeline(index)}
                          onFocus={() => setActivePipeline(index)}
                          onClick={() => setActivePipeline(index)}
                          className={cn(
                            'relative rounded-xl border p-3.5 text-left transition-all duration-300',
                            active
                              ? 'border-brand/35 bg-brand/[0.06] shadow-[var(--shadow-sm)]'
                              : 'border-line bg-surface-2/40 hover:border-line-strong',
                          )}
                          aria-pressed={active}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn('grid h-8 w-8 place-items-center rounded-lg border', active ? 'border-brand/25 bg-brand/10 text-brand' : 'border-line bg-surface text-ink-3')}>
                              <Icon className="text-[14px]" aria-hidden="true" />
                            </span>
                            <span className="font-mono text-[10px] text-ink-3">{item.step}</span>
                          </div>
                          <p className="mt-3 text-[12.5px] font-semibold leading-5 text-ink">{item.title}</p>
                          <p className="mt-1 text-[11.5px] leading-5 text-ink-3">{item.body}</p>
                          {index < PIPELINE.length - 1 ? (
                            <FiChevronRight className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-[14px] text-ink-3 sm:block" aria-hidden="true" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-xl border border-line bg-surface-2/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                        {activePipeline === 0 ? 'Input normalisation' : activePipeline === 1 ? 'Signal extraction' : 'Weighted scoring'}
                      </p>
                      <span className="font-mono text-[10px] text-ink-3">
                        {activePipeline === 1 ? '6 parallel stages' : activePipeline === 2 ? 'explainable factors' : 'deterministic'}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {(activePipeline === 0
                        ? [
                            { label: 'Scheme + host normalised', value: 100, tone: 'safe' },
                            { label: 'Punycode / homoglyph check', value: 100, tone: 'safe' },
                            { label: 'Fingerprint assigned', value: 100, tone: 'brand' },
                          ]
                        : activePipeline === 1
                          ? [
                              { label: 'Certificate & CA signals', value: 92, tone: 'safe' },
                              { label: 'Content & brand similarity', value: 78, tone: 'medium' },
                              { label: 'Infrastructure reputation', value: 64, tone: 'high' },
                            ]
                          : [
                              { label: 'Risk confidence', value: 96, tone: 'critical' },
                              { label: 'Evidence coverage', value: 88, tone: 'safe' },
                              { label: 'Analyst agreement (demo)', value: 94, tone: 'brand' },
                            ]
                      ).map((row) => (
                        <Gauge key={row.label} label={row.label} value={row.value} tone={row.tone} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="py-16 sm:py-20">
        <div className="shell">
          <SectionHeading
            eyebrow="How it works"
            title="From a pasted link to a defensible decision."
            description="Three steps, no black boxes. Each stage produces evidence you can attach to an incident ticket or share with a customer."
            action={<Button to="/scan" variant="secondary" size="sm" iconRight={FiArrowRight}>Run a scan</Button>}
          />

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {PIPELINE.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="card card-lift relative p-5">
                  <div className="flex items-start justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/20 bg-brand/[0.07] text-brand">
                      <Icon className="text-[17px]" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[26px] font-semibold leading-none tracking-tight text-line-strong">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[14px] font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-6 text-ink-2">{item.body}</p>
                  {index === 2 ? (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-2.5 py-2">
                      <FiCheck className="text-[12px] text-safe" aria-hidden="true" />
                      <span className="font-mono text-[10.5px] text-ink-2">verdict: malicious · 94/100</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- CORE FEATURES ---------------- */}
      <section id="features" className="scroll-mt-24 border-y border-line bg-surface/30 py-16 sm:py-20">
        <div className="shell">
          <SectionHeading
            eyebrow="Core security features"
            title="The six checks behind every verdict."
            description="Each feature is a first-class module with its own depth view, so analysts can drill into the exact signal that changed a score."
          />
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_FEATURES.map((feature) => (
              <div key={feature.title} className="card card-lift group p-5">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2 transition-colors group-hover:border-brand/30 group-hover:bg-brand/10 group-hover:text-brand">
                    <FeatureIcon name={feature.icon} className="text-[15px]" />
                  </span>
                  <FiArrowUpRight className="text-[13px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[13.5px] font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-[12px] leading-5 text-ink-2">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- ADVANCED DETECTION ---------------- */}
      <section className="py-16 sm:py-20">
        <div className="shell">
          <SectionHeading
            eyebrow="Advanced detection"
            title="Thirteen modules for the signals others miss."
            description="Certificate transparency, homoglyph variants, cloaking, phishing-kit fingerprints, UPI fraud — each one opens a dedicated analysis workspace."
            action={<Button to="/advanced" variant="secondary" size="sm" iconRight={FiArrowRight}>Browse all modules</Button>}
          />

          <div className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {DETECTION_FEATURES.map((feature) => (
              <Link
                key={feature.slug}
                to={`/advanced/${feature.slug}`}
                className="group rounded-xl border border-line bg-surface p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2 transition-colors group-hover:border-brand/25 group-hover:text-brand">
                    <FeatureIcon name={feature.icon} className="text-[14px]" />
                  </span>
                  <FiArrowUpRight className="text-[12px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </div>
                <p className="mt-3 text-[12px] font-semibold leading-4 text-ink">{feature.name}</p>
                <p className="mt-1 text-[10.5px] text-ink-3">{feature.category}</p>
              </Link>
            ))}
            <Link
              to="/advanced"
              className="group flex flex-col justify-between rounded-xl border border-brand/25 bg-brand/[0.06] p-3.5 transition hover:border-brand/45 hover:bg-brand/10"
            >
              <div className="flex items-start justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand">
                  <FiCpu className="text-[14px]" aria-hidden="true" />
                </span>
                <FiArrowRight className="text-[12px] text-brand" aria-hidden="true" />
              </div>
              <div>
                <p className="mt-3 text-[12px] font-semibold text-brand">Open the workspace</p>
                <p className="mt-1 text-[10.5px] text-brand/80">All 13 modules in one place</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- THREAT INTELLIGENCE ---------------- */}
      <section className="border-y border-line bg-surface/30 py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-critical/20 bg-critical/[0.07] text-critical">
                    <FiTarget className="text-[14px]" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Latest confirmed indicators</p>
                    <p className="text-[11px] text-ink-3">Community and automated detections</p>
                  </div>
                </div>
                <DemoBadge />
              </div>
              <div className="divide-y divide-line/70">
                {recentThreats.map((threat) => (
                  <div key={threat.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/50">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', threat.severity === 'critical' ? 'bg-critical' : threat.severity === 'high' ? 'bg-high' : 'bg-medium')} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11.5px] text-ink">{threat.indicator}</p>
                      <p className="mt-0.5 text-[10.5px] text-ink-3">{threat.category} · {threat.reports} reports</p>
                    </div>
                    <Badge tone={threat.severity} size="sm">{threat.severity}</Badge>
                    <span className="hidden w-16 shrink-0 text-right text-[10.5px] text-ink-3 sm:block">{timeAgo(threat.lastSeen)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-line bg-surface-2/40 px-5 py-3">
                <span className="text-[11px] text-ink-3">{formatNumber(THREAT_STATS.new24h)} new indicators in the last 24 hours</span>
                <Link to="/threat-intelligence" className="arrow-link inline-flex items-center gap-1 text-[11.5px] font-medium text-brand">
                  Open database <FiArrowRight className="arrow-link-icon text-[11px]" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeading
                eyebrow="Threat intelligence"
                title="A searchable memory of what has already been weaponised."
                description="Query domains, URLs and IPs across categories, severity and reporting history."
                className="block"
              />
              <div className="card p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-ink-3">Detections this week</p>
                  <span className="font-mono text-[10.5px] text-ink-3">demo</span>
                </div>
                <AreaChart
                  className="mt-3"
                  height={130}
                  labels={DAILY_DETECTIONS.map((day) => day.day)}
                  series={[
                    { key: 'safe', color: 'var(--safe)', data: DAILY_DETECTIONS.map((day) => day.safe) },
                    { key: 'malicious', color: 'var(--critical)', data: DAILY_DETECTIONS.map((day) => day.malicious) },
                  ]}
                />
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-2"><span className="h-2 w-2 rounded-full bg-safe" /> Clean traffic</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-2"><span className="h-2 w-2 rounded-full bg-critical" /> Malicious</span>
                </div>
              </div>
              <Button to="/threat-intelligence" full variant="outline" size="sm" iconRight={FiArrowRight}>
                Search the intelligence database
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- SECURITY STATISTICS ---------------- */}
      <section className="py-16 sm:py-20">
        <div className="shell">
          <SectionHeading
            eyebrow="Security statistics"
            title="What the platform sees at a glance."
            description="A demonstration snapshot of the workspace analytics, rendered from the same components used in the live dashboard."
            action={<DemoBadge />}
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Scan volume · last 14 days</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">Clean vs. confirmed malicious</p>
                </div>
                <Badge tone="safe" dot>+12.4%</Badge>
              </div>
              <AreaChart
                className="mt-5"
                height={210}
                labels={DAILY_DETECTIONS.map((day) => day.day)}
                series={[
                  { key: 'safe', color: 'var(--safe)', data: DAILY_DETECTIONS.map((day) => day.safe) },
                  { key: 'suspicious', color: 'var(--medium)', data: DAILY_DETECTIONS.map((day) => day.suspicious) },
                  { key: 'malicious', color: 'var(--critical)', data: DAILY_DETECTIONS.map((day) => day.malicious) },
                ]}
              />
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
                {[
                  { label: 'Median scan', value: '1.8s' },
                  { label: 'Scans today', value: '473' },
                  { label: 'Verdict precision', value: '98.2%' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[15px] font-semibold tabular text-ink">{item.value}</p>
                    <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-ink-3">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <p className="text-[13px] font-semibold text-ink">Threat distribution</p>
              <p className="mt-0.5 text-[11.5px] text-ink-3">Across confirmed indicators</p>
              <div className="mt-6">
                <DonutChart
                  data={THREAT_DISTRIBUTION.map((item) => ({ label: item.label, value: item.value, color: item.color }))}
                  centerValue={formatNumber(THREAT_STATS.totalIndicators)}
                  centerLabel="indicators"
                  size="h-36 w-36"
                  thickness={12}
                />
              </div>
              <div className="mt-6 space-y-2 border-t border-line pt-4">
                {[
                  { label: 'Phishing', value: 68, tone: 'critical' },
                  { label: 'Brand abuse', value: 54, tone: 'high' },
                  { label: 'Payment fraud', value: 37, tone: 'medium' },
                ].map((row) => (
                  <Gauge key={row.label} label={row.label} value={row.value} tone={row.tone} />
                ))}
              </div>
            </div>
          </div>

          <Notice tone="neutral" className="mt-4" icon={FiCpu}>
            All charts on this page render simulated data from <span className="code-inline">src/data</span>. No telemetry,
            third-party feed or live scan is connected.
          </Notice>
        </div>
      </section>

      {/* ---------------- WHY CHOOSE ---------------- */}
      <section className="border-t border-line bg-surface/30 py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div>
              <SectionHeading
                eyebrow="Why TruthShield"
                title="Serious tooling for teams that have to explain themselves."
                description="A national-level security review does not accept “the scanner said so”. Every verdict here comes with the reasoning attached."
              />
              <div className="mt-6 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Model quality (demo)</span>
                  <Badge tone="brand" size="sm">calibrated</Badge>
                </div>
                <div className="mt-3 space-y-2.5">
                  <Gauge label="Precision" value={98} tone="safe" />
                  <Gauge label="Recall" value={95} tone="brand" />
                  <Gauge label="False positives" value={1.8} tone="medium" />
                </div>
              </div>
              <Button to="/about" variant="ghost" size="sm" className="mt-4" iconRight={FiArrowRight}>
                Read the platform story
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {WHY.map((item, index) => (
                <div key={item.title} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <FiCheck className="mt-0.5 text-[13px] text-safe" aria-hidden="true" />
                    <span className="font-mono text-[9.5px] text-ink-3">0{index + 1}</span>
                  </div>
                  <p className="mt-3 text-[12.5px] font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-[11.5px] leading-5 text-ink-2">{item.body}</p>
                  <div className="mt-3 flex items-baseline gap-1.5 border-t border-line pt-2.5">
                    <span className="text-[16px] font-semibold tabular text-brand">{item.metric}</span>
                    <span className="text-[10px] text-ink-3">{item.metricLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="py-16 sm:py-20">
        <div className="shell">
          <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-surface p-6 shadow-[var(--shadow-lg),0_0_60px_-30px_var(--brand-glow)] sm:p-10">
            <span className="accent-rail absolute inset-x-0 top-0 opacity-70" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 grid-lines opacity-80" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 circuit-grid opacity-30" aria-hidden="true" />
            <div className="aurora aurora-brand -right-10 -top-16 h-56 w-[420px]" aria-hidden="true" />
            <div className="aurora aurora-hot -bottom-24 left-1/4 h-48 w-[340px] opacity-30" aria-hidden="true" />
            <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/25 bg-brand/10 text-brand shadow-[inset_0_0_18px_-8px_var(--brand-glow)]">
                    <FiShield className="text-[15px]" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">Start with one link</span>
                </div>
                <h2 className="mt-4 font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.035em] text-ink sm:text-[34px]">
                  Put every link on trial before your users do.
                </h2>
                <p className="mt-2.5 max-w-xl text-[13px] leading-6 text-ink-2">
                  Scan a URL, open a deep-dive module, or explore the analyst workspace. The full product surface is
                  available in this demo — with clearly labelled simulated results.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
                <Button to="/scan" size="lg" full iconRight={FiArrowRight}>Scan a website</Button>
                <Button to="/signup" variant="secondary" size="lg" full>Create a workspace</Button>
                <p className="text-center text-[10.5px] text-ink-3 lg:text-left">No credit card · demo environment</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
