import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiAlertTriangle, FiArrowRight, FiCheck, FiCheckCircle, FiCpu, FiExternalLink, FiGlobe, FiInfo,
  FiLayers, FiLock, FiRefreshCw, FiServer, FiShield, FiX, FiXCircle, FiZap,
} from 'react-icons/fi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Badge, { DemoBadge, SeverityBadge } from '../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { ScoreRing, Meter, Spinner } from '../components/ui/Progress';
import Notice from '../components/ui/Notice';
import Accordion from '../components/ui/Accordion';
import EmptyState from '../components/ui/EmptyState';
import TerminalLog from '../components/ui/TerminalLog';
import { buildSecurityAssessment } from '../lib/mockEngine';
import { validateDomain } from '../lib/validation';
import { clamp, cn, formatDateTime } from '../lib/utils';

const SAMPLE_DOMAINS = ['sbi-kyc-verify.example', 'github.com', 'secure-update-portal.example'];

/** Only validated domains from the query string reach the assessment engine. */
function resolveInitialDomain(raw) {
  const parsed = validateDomain(raw || '');
  return parsed.ok ? parsed.domain : SAMPLE_DOMAINS[0];
}
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

function HeaderRow({ header }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-line/70 py-2.5 last:border-0">
      <span
        className={cn(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]',
          header.present ? 'border-safe/30 bg-safe/10 text-safe' : 'border-critical/30 bg-critical/10 text-critical',
        )}
      >
        {header.present ? <FiCheck aria-hidden="true" /> : <FiX aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-ink">{header.name}</p>
        <p className={cn('mt-0.5 break-all font-mono text-[10.5px]', header.present ? 'text-ink-2' : 'text-ink-3')}>
          {header.present ? header.value : 'not set'}
        </p>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-ink-3">{header.weight} pts</span>
    </div>
  );
}

export default function SecurityAnalysis() {
  const [searchParams] = useSearchParams();
  const initialDomain = resolveInitialDomain(searchParams.get('domain'));
  const [value, setValue] = useState(initialDomain);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('scanning');
  const [report, setReport] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const timers = useRef([]);

  const runAssessment = (raw) => {
    const parsed = validateDomain(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setError('');
    setValue(parsed.domain);
    setPhase('scanning');
    setReport(null);
    timers.current.push(
      window.setTimeout(() => {
        setReport(buildSecurityAssessment(parsed.domain));
        setPhase('done');
      }, 1100),
    );
  };

  useEffect(() => {
    const domain = initialDomain;
    const target = domain || SAMPLE_DOMAINS[0];
    timers.current.push(
      window.setTimeout(() => {
        setReport(buildSecurityAssessment(target));
        setPhase('done');
      }, 1050),
    );
    return () => timers.current.forEach((timer) => window.clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredFindings = report
    ? report.findings.filter((finding) => severityFilter === 'all' || finding.severity === severityFilter)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Security analysis"
        title="A full security assessment of any website."
        description="Headers, transport, exposure and misconfiguration checks graded against a hardened baseline — grouped by severity, with impact and remediation for every finding."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Security Analysis' }]}
        demo
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiShield className="text-[12px]" aria-hidden="true" /> 7-point header baseline</span>
            <span className="inline-flex items-center gap-1.5"><FiServer className="text-[12px]" aria-hidden="true" /> Exposure probing</span>
            <span className="inline-flex items-center gap-1.5"><FiCpu className="text-[12px]" aria-hidden="true" /> Simulated results</span>
          </>
        }
        actions={<Button to="/report-threat" variant="secondary" size="md" iconRight={FiArrowRight}>Report an issue</Button>}
      />

      <div className="shell py-8 lg:py-10">
        <Card className="p-4 sm:p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              runAssessment(value);
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            noValidate
          >
            <div className="flex-1">
              <Field label="Domain to assess" htmlFor="assessment-domain" error={error} required>
                <Input
                  id="assessment-domain"
                  icon={FiGlobe}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    if (error) setError('');
                  }}
                  placeholder="yourbrand.com"
                  spellCheck="false"
                  autoComplete="off"
                  invalid={Boolean(error)}
                />
              </Field>
            </div>
            <Button type="submit" className="h-11 shrink-0 px-5" icon={FiZap} disabled={phase === 'scanning'}>
              {phase === 'scanning' ? 'Assessing…' : 'Run assessment'}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            <span className="text-[10.5px] uppercase tracking-[0.07em] text-ink-3">Samples</span>
            {SAMPLE_DOMAINS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => runAssessment(sample)}
                className={cn(
                  'rounded-md border px-2 py-1 font-mono text-[10px] transition',
                  sample === value ? 'border-brand/30 bg-brand/10 text-brand' : 'border-line bg-surface-2/70 text-ink-2 hover:border-brand/30 hover:text-brand',
                )}
              >
                {sample}
              </button>
            ))}
          </div>
        </Card>

        {phase === 'scanning' ? (
          <Card className="mt-5 p-4 sm:p-5">
            <div className="flex flex-col items-center justify-center gap-2.5 py-6 text-center">
              <Spinner className="h-7 w-7" />
              <p className="text-[13px] font-medium text-ink">Assessing {value}</p>
              <p className="text-[11.5px] text-ink-3">Header baseline · transport · exposure · software fingerprints</p>
            </div>
            <TerminalLog
              title="assess@truthshield"
              subtitle="7-point baseline"
              live
              dense
              lines={[
                { time: '00.041', level: 'ok', text: `dns.resolve target=${value}` },
                { time: '00.118', level: 'ok', text: 'transport.tls chain · protocol · hsts' },
                { time: '00.236', level: 'info', text: 'header.baseline evaluate 7 policies' },
                { time: '00.348', level: 'warn', text: 'exposure.probe 14 common paths' },
                { time: '00.472', level: 'info', text: 'fingerprint.software passive banner read' },
                { time: '00.590', level: 'sys', text: 'grade.compute · findings grouped by severity' },
              ]}
              bodyClassName="min-h-[132px]"
            />
          </Card>
        ) : null}

        {phase === 'done' && report ? (
          <div className="mt-5 space-y-5 anim-fade">
            <Card className="top-sheen overflow-hidden">
              <div className={cn('h-1 w-full', report.score > 80 ? 'bg-safe' : report.score > 60 ? 'bg-medium' : 'bg-critical')} />
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_1fr_auto]">
                <ScoreRing
                  value={report.score}
                  tone={report.score > 80 ? 'safe' : report.score > 60 ? 'medium' : 'critical'}
                  className="h-[120px] w-[120px]"
                  stroke={8}
                  valueClassName="text-[30px]"
                  caption="score"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={report.score > 80 ? 'safe' : report.score > 60 ? 'medium' : 'critical'} dot>
                      Grade {report.grade}
                    </Badge>
                    <Badge tone="neutral">{report.domain}</Badge>
                    <DemoBadge />
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">
                    {report.score > 80
                      ? 'The site meets the baseline. Remaining findings are hardening opportunities rather than exposure risks.'
                      : report.score > 60
                        ? 'The site is partially hardened. Several controls are missing and at least one finding increases attack surface.'
                        : 'Significant gaps were found across headers, transport and exposure. Treat this assessment as an urgent remediation list.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[10.5px] text-ink-3">
                    <span>{formatDateTime(report.assessedAt)}</span>
                    <span>Header score {report.headerScore}/100</span>
                    <span>{report.latencyMs} ms simulated</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {SEVERITY_ORDER.map((severity) => (
                      <button
                        key={severity}
                        type="button"
                        onClick={() => setSeverityFilter(severityFilter === severity ? 'all' : severity)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-left transition',
                          severityFilter === severity ? 'border-brand/35 bg-brand/10' : 'border-line bg-surface-2/50 hover:border-line-strong',
                        )}
                      >
                        <span className="block text-[15px] font-semibold tabular text-ink">{report.counts[severity]}</span>
                        <span className="block text-[9.5px] uppercase tracking-[0.06em] text-ink-3">{severity}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={() => runAssessment(report.domain)}>
                    Re-assess
                  </Button>
                  <Button size="sm" variant="ghost" to={`/scan?url=${encodeURIComponent(`https://${report.domain}`)}`} iconRight={FiArrowRight}>
                    Scan this site
                  </Button>
                  <Button size="sm" variant="ghost" to={`/ssl-checker?domain=${encodeURIComponent(report.domain)}`} icon={FiLock}>
                    SSL report
                  </Button>
                </div>
              </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              <SectionCard
                title="Security headers"
                description="Baseline controls and their configured values"
                icon={FiLayers}
                action={<Badge tone={report.headerScore > 80 ? 'safe' : report.headerScore > 55 ? 'medium' : 'critical'}>{report.headerScore}/100</Badge>}
              >
                <div className="-my-1">
                  {report.headers.map((header) => (
                    <HeaderRow key={header.name} header={header} />
                  ))}
                </div>
              </SectionCard>

              <div className="space-y-5">
                <SectionCard title="HTTPS configuration" description="Transport enforcement" icon={FiLock}>
                  <DataRow label="HTTPS enforced" value={report.https.enforced ? 'Yes' : 'No'} />
                  <DataRow label="HSTS preload" value={report.https.hstsPreload ? 'Eligible' : 'Not present'} />
                  <DataRow label="HTTP → HTTPS redirect" value={report.https.redirectsHttp ? '301 redirect' : 'Missing'} />
                  <DataRow label="Mixed content" value={report.https.mixedContent ? `${report.https.mixedContent} insecure assets` : 'None detected'} />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {report.tls.versions.map((version) => (
                      <Badge key={version} tone={version === 'TLS 1.0' || version === 'TLS 1.1' ? 'high' : 'safe'} size="sm">
                        {version}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.07em] text-ink-3">Preferred cipher</p>
                    <p className="mt-0.5 break-all font-mono text-[10.5px] text-ink-2">{report.tls.cipher}</p>
                  </div>
                </SectionCard>

                <SectionCard title="Exposed endpoints" description="Common sensitive paths" icon={FiServer}>
                  <ul className="space-y-2">
                    {report.endpoints.map((endpoint) => (
                      <li key={endpoint.path} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[10.5px] text-ink">{endpoint.path}</p>
                          <p className="text-[10px] text-ink-3">{endpoint.label}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={cn('font-mono text-[10.5px]', endpoint.status < 300 ? 'text-critical' : endpoint.status === 401 || endpoint.status === 403 ? 'text-medium' : 'text-ink-3')}>
                            {endpoint.status}
                          </span>
                          <SeverityBadge severity={endpoint.severity} size="sm" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>
            </div>

            <SectionCard
              title="Findings"
              description={`${filteredFindings.length} finding${filteredFindings.length === 1 ? '' : 's'}${severityFilter === 'all' ? '' : ` · filtered by ${severityFilter}`}`}
              icon={FiAlertTriangle}
              action={
                severityFilter === 'all' ? (
                  <span className="text-[11px] text-ink-3">Click a severity above to filter</span>
                ) : (
                  <button type="button" onClick={() => setSeverityFilter('all')} className="text-[11px] font-medium text-brand">
                    Clear filter
                  </button>
                )
              }
            >
              {filteredFindings.length ? (
                <Accordion
                  items={filteredFindings.map((finding) => ({
                    id: finding.id,
                    title: finding.title,
                    meta: `${finding.area} · ${finding.evidence}`,
                    icon: finding.severity === 'critical' || finding.severity === 'high' ? FiAlertTriangle : finding.severity === 'info' ? FiInfo : FiShield,
                    badge: <SeverityBadge severity={finding.severity} size="sm" />,
                    children: (
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">Issue</p>
                          <p className="mt-1">{finding.description}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">Potential impact</p>
                          <p className="mt-1">{finding.impact}</p>
                        </div>
                        <div className="rounded-lg border border-safe/20 bg-safe/[0.06] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-safe">Recommendation</p>
                          <p className="mt-1 text-ink-2">{finding.recommendation}</p>
                        </div>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <EmptyState
                  icon={FiCheckCircle}
                  title="No findings at this severity"
                  description="Clear the filter to review the rest of the assessment."
                  compact
                  action={<Button size="sm" variant="secondary" onClick={() => setSeverityFilter('all')}>Show all findings</Button>}
                />
              )}
            </SectionCard>

            <div className="grid gap-5 md:grid-cols-2">
              <SectionCard title="Priority recommendations" description="Ordered by expected risk reduction" icon={FiShield}>
                <ol className="space-y-2.5">
                  {report.recommendations.map((item, index) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-brand/25 bg-brand/10 font-mono text-[9.5px] text-brand">
                        {index + 1}
                      </span>
                      <span className="text-[12px] leading-5 text-ink-2">{item}</span>
                    </li>
                  ))}
                </ol>
              </SectionCard>

              <SectionCard title="Vulnerability overview" description="Findings by category" icon={FiZap}>
                <div className="space-y-3">
                  {[
                    { label: 'Missing headers', value: report.headers.filter((header) => !header.present).length, max: report.headers.length },
                    { label: 'Exposed surfaces', value: report.endpoints.filter((endpoint) => endpoint.status < 300).length, max: report.endpoints.length },
                    { label: 'Transport issues', value: report.tls.versions.filter((version) => version !== 'TLS 1.3' && version !== 'TLS 1.2').length, max: 2 },
                    { label: 'Total findings', value: report.findings.length, max: 12 },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11.5px] text-ink-2">{row.label}</span>
                        <span className="font-mono text-[11px] tabular text-ink">{row.value}/{row.max}</span>
                      </div>
                      <Meter
                        value={clamp((row.value / row.max) * 100, 0, 100)}
                        tone={row.value === 0 ? 'safe' : row.value / row.max > 0.5 ? 'critical' : 'medium'}
                        className="mt-1.5"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                  {report.score > 80 ? <FiCheckCircle className="text-safe" aria-hidden="true" /> : <FiXCircle className="text-critical" aria-hidden="true" />}
                  <p className="text-[11px] text-ink-2">
                    {report.score > 80 ? 'Baseline controls satisfied' : 'Remediation required before production use'}
                  </p>
                </div>
              </SectionCard>
            </div>

            <Notice tone="neutral" icon={FiCpu} title="Simulated assessment">
              Headers, endpoints and software versions are demo values generated in the browser. No request was made to{' '}
              <span className="code-inline">{report.domain}</span>. Wiring a real scanner only requires replacing{' '}
              <span className="code-inline">buildSecurityAssessment()</span>.
            </Notice>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
              <p className="text-[11.5px] text-ink-3">Need the certificate view for this domain?</p>
              <Button to={`/ssl-checker?domain=${encodeURIComponent(report.domain)}`} variant="outline" size="sm" iconRight={FiExternalLink}>
                Open SSL checker
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
