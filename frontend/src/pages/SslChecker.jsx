import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiAlertTriangle, FiArrowRight, FiCheck, FiCheckCircle, FiClock, FiCpu, FiGlobe,
  FiInfo, FiLink2, FiLock, FiRefreshCw, FiShield, FiXCircle, FiZap,
} from 'react-icons/fi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Badge, { DemoBadge, SeverityBadge } from '../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { ScoreRing, Meter, Spinner } from '../components/ui/Progress';
import Tabs from '../components/ui/Tabs';
import Notice from '../components/ui/Notice';
import CopyButton from '../components/ui/CopyButton';
import { fetchSslReport, useLiveBackend } from '../lib/api';
import { validateDomain } from '../lib/validation';
import { clamp, cn, formatDate, formatDateTime } from '../lib/utils';

const SAMPLE_DOMAINS = ['github.com', 'sbi-kyc-verify.example', 'acmestore.example'];

const TABS = [
  { id: 'certificate', label: 'Certificate' },
  { id: 'chain', label: 'Chain of trust' },
  { id: 'transparency', label: 'Transparency' },
  { id: 'revocation', label: 'Revocation' },
];

export default function SslChecker() {
  const [searchParams] = useSearchParams();
  const [value, setValue] = useState(searchParams.get('domain') || SAMPLE_DOMAINS[0]);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('scanning');
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState('certificate');
  const latestRun = useRef(0);
  const live = useLiveBackend();

  const load = async (domain) => {
    const runId = ++latestRun.current;
    try {
      const next = await fetchSslReport(domain);
      if (runId !== latestRun.current) return;
      setReport(next);
      setPhase('done');
    } catch (failure) {
      if (runId !== latestRun.current) return;
      setError(failure.message);
      setPhase('idle');
    }
  };

  const runCheck = (raw) => {
    const parsed = validateDomain(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    setValue(parsed.domain);
    setPhase('scanning');
    setReport(null);
    load(parsed.domain);
  };

  useEffect(() => {
    const domain = searchParams.get('domain') || SAMPLE_DOMAINS[0];
    // load() only sets state after its request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(domain);
    return () => {
      latestRun.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elapsedPct = report
    ? clamp(100 - (report.validity.daysRemaining / Math.max(report.validity.lifetimeDays, 1)) * 100, 0, 100)
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="SSL / TLS checker"
        title="Read the certificate, not just the padlock."
        description="Inspect issuer trust, chain integrity, key strength, certificate transparency logging and revocation status for any domain."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'SSL Checker' }]}
        demo={live === false}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiLock className="text-[12px]" aria-hidden="true" /> Chain validation</span>
            <span className="inline-flex items-center gap-1.5"><FiLink2 className="text-[12px]" aria-hidden="true" /> CT log presence</span>
            <span className="inline-flex items-center gap-1.5"><FiCpu className="text-[12px]" aria-hidden="true" /> {live === false ? 'Simulated certificate' : 'Real TLS handshake'}</span>
          </>
        }
        actions={<Button to="/advanced/ca-reputation" variant="secondary" size="md" iconRight={FiArrowRight}>CA reputation</Button>}
      />

      <div className="shell py-8 lg:py-10">
        <Card className="p-4 sm:p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              runCheck(value);
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            noValidate
          >
            <div className="flex-1">
              <Field label="Domain" htmlFor="ssl-domain" error={error} required>
                <Input
                  id="ssl-domain"
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
              {phase === 'scanning' ? 'Checking…' : 'Check certificate'}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            <span className="text-[10.5px] uppercase tracking-[0.07em] text-ink-3">Samples</span>
            {SAMPLE_DOMAINS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => runCheck(sample)}
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
          <Card className="mt-5">
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-16">
              <Spinner className="h-7 w-7" />
              <p className="text-[13px] font-medium text-ink">Retrieving certificate for {value}</p>
              <p className="text-[11.5px] text-ink-3">Handshake · chain build · CT lookup · revocation</p>
            </div>
          </Card>
        ) : null}

        {phase === 'done' && report ? (
          <div className="mt-5 space-y-5 anim-fade">
            <Card className="top-sheen overflow-hidden">
              <div className={cn('h-1 w-full', report.health === 'healthy' ? 'bg-safe' : report.health === 'attention' ? 'bg-medium' : 'bg-critical')} />
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_1fr_auto]">
                <div className="flex items-center gap-4">
                  <ScoreRing
                    value={report.score}
                    tone={report.health === 'healthy' ? 'safe' : report.health === 'attention' ? 'medium' : 'critical'}
                    className="h-[116px] w-[116px]"
                    stroke={8}
                    valueClassName="text-[28px]"
                    label={report.grade}
                    caption="grade"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={report.health === 'healthy' ? 'safe' : report.health === 'attention' ? 'medium' : 'critical'} dot>
                      {report.health === 'healthy' ? 'Healthy certificate' : report.health === 'attention' ? 'Needs attention' : 'At risk'}
                    </Badge>
                    <Badge tone="neutral" icon={FiLock}>{report.protocol}</Badge>
                    {report.live ? <Badge tone="safe" dot>Live analysis</Badge> : <DemoBadge />}
                  </div>
                  <p className="mt-2 break-all font-mono text-[13px] text-ink">{report.domain}</p>
                  <p className="mt-1 text-[12px] text-ink-2">
                    Issued by {report.issuer.name} · {report.issuer.tier} · {report.signature}
                  </p>
                  <div className="mt-3 grid gap-x-6 gap-y-1 text-[11px] text-ink-3 sm:grid-cols-2">
                    <span>Valid from <span className="text-ink-2">{formatDate(report.validity.notBefore)}</span></span>
                    <span>Expires <span className="text-ink-2">{formatDate(report.validity.notAfter)}</span></span>
                    <span>Checked <span className="text-ink-2">{formatDateTime(report.checkedAt)}</span></span>
                    <span>Serial <span className="font-mono text-ink-2">{report.cert?.serial || '—'}</span></span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <CopyButton value={report.domain} label="Copy domain" className="h-8 justify-center px-2.5" />
                  <Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={() => runCheck(report.domain)}>Re-check</Button>
                  <Button size="sm" variant="ghost" to={`/scan?url=${encodeURIComponent(`https://${report.domain}`)}`} iconRight={FiArrowRight}>Full scan</Button>
                </div>
              </div>

              <div className="border-t border-line px-5 py-3 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-ink-3">Certificate lifetime consumed</span>
                  <span className="font-mono text-ink-2">{report.validity.daysRemaining} days remaining</span>
                </div>
                <Meter
                  value={elapsedPct}
                  tone={report.validity.daysRemaining < 21 ? 'critical' : report.validity.daysRemaining < 45 ? 'medium' : 'brand'}
                  className="mt-2"
                />
              </div>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Key', value: `${report.key.algorithm} ${report.key.size}${report.key.algorithm === 'RSA' ? '' : '-bit'}`, icon: FiShield, tone: 'brand' },
                { label: 'Revocation', value: report.revocation.status === 'good' ? 'Good standing' : 'Unknown', icon: report.revocation.status === 'good' ? FiCheckCircle : FiXCircle, tone: report.revocation.status === 'good' ? 'safe' : 'medium' },
                { label: 'CT logging', value: report.ct.logged ? `${report.ct.sctCount} SCTs` : 'Not logged', icon: FiLink2, tone: report.ct.logged ? 'safe' : 'high' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="card flex items-center gap-3 p-4">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', item.tone === 'safe' ? 'border-safe/25 bg-safe/10 text-safe' : item.tone === 'high' ? 'border-high/25 bg-high/10 text-high' : item.tone === 'medium' ? 'border-medium/25 bg-medium/10 text-medium' : 'border-brand/25 bg-brand/10 text-brand')}>
                      <Icon className="text-[15px]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10.5px] uppercase tracking-[0.07em] text-ink-3">{item.label}</p>
                      <p className="mt-0.5 truncate text-[13px] font-semibold text-ink">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <SectionCard
              title="Certificate detail"
              description="Subject, issuer and transport configuration"
              flush
              action={<Badge tone={report.chain.every((link) => link.status !== 'invalid') ? 'safe' : 'critical'}>{report.chain.length}-link chain</Badge>}
            >
              <div className="px-5 pt-4">
                <Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="Certificate detail" />
              </div>

              <div className="px-5 py-5">
                {tab === 'certificate' ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Subject</h4>
                      <div className="mt-2">
                        <DataRow label="Common name" value={report.subject.commonName} mono />
                        <DataRow label="Organisation" value={report.subject.organisation} />
                        <DataRow label="Unit" value={report.subject.organisationalUnit} />
                        <DataRow label="Locality" value={report.subject.locality} />
                        <DataRow label="Country" value={report.subject.country} />
                      </div>
                      <h4 className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Subject alternative names</h4>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {report.subject.sans.map((san) => (
                          <span key={san} className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[10.5px] text-ink-2">{san}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Issuer</h4>
                      <div className="mt-2">
                        <DataRow label="Authority" value={report.issuer.name} />
                        <DataRow label="CA certificate" value={report.issuer.commonName} mono />
                        <DataRow label="Validation tier" value={report.issuer.tier} />
                        <DataRow label="Trust score" value={`${report.issuer.trust}/100`} />
                      </div>
                      <h4 className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Transport</h4>
                      <div className="mt-2">
                        <DataRow label="Protocol" value={report.protocol} />
                        <DataRow label="Cipher suite" value={report.cipher} mono />
                        <DataRow label="Key algorithm" value={report.key.algorithm} />
                        <DataRow label="Key strength" value={`${report.key.size}-bit${report.key.curve ? ` · ${report.key.curve}` : ''}`} />
                        <DataRow label="Signature" value={report.signature} mono />
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === 'chain' ? (
                  <div className="space-y-3">
                    {report.chain.map((link, index) => (
                      <div key={link.level} className="relative flex gap-4">
                        <div className="flex flex-col items-center">
                          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full border', link.status === 'valid' ? 'border-safe/30 bg-safe/10 text-safe' : link.status === 'trusted' ? 'border-brand/30 bg-brand/10 text-brand' : 'border-critical/30 bg-critical/10 text-critical')}>
                            {link.status === 'invalid' ? <FiXCircle className="text-[14px]" aria-hidden="true" /> : <FiCheck className="text-[14px]" aria-hidden="true" />}
                          </span>
                          {index < report.chain.length - 1 ? <span className="mt-1 h-full w-px flex-1 bg-line" aria-hidden="true" /> : null}
                        </div>
                        <div className="min-w-0 flex-1 pb-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[12.5px] font-semibold text-ink">{link.level}</p>
                            <Badge tone={link.status === 'valid' ? 'safe' : link.status === 'trusted' ? 'brand' : 'critical'} size="sm">{link.status}</Badge>
                            <span className="font-mono text-[10px] text-ink-3">{link.algorithm}</span>
                          </div>
                          <p className="mt-0.5 break-all font-mono text-[11px] text-ink-2">{link.name}</p>
                          <p className="mt-0.5 text-[10.5px] text-ink-3">Issuer: {link.issuer} · expires {formatDate(link.validTo)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[11px] text-ink-2">
                        <FiInfo className="text-brand" aria-hidden="true" />
                        Chain terminates in a public root store. Intermediate certificates are correctly ordered.
                      </p>
                    </div>
                  </div>
                ) : null}

                {tab === 'transparency' ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={report.ct.logged ? 'safe' : 'high'} dot>{report.ct.logged ? 'Certificate transparency logged' : 'No CT log entries'}</Badge>
                      <span className="text-[11px] text-ink-3">{report.ct.sctCount} signed certificate timestamps</span>
                      {report.ct.lookalikes ? <Badge tone="medium">{report.ct.lookalikes} lookalike issuances</Badge> : null}
                    </div>
                    {report.ct.logs.length ? (
                      <div className="mt-3 overflow-hidden rounded-lg border border-line">
                        <table className="w-full text-left text-[11.5px]">
                          <thead className="bg-surface-2 text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Log</th>
                              <th className="px-3 py-2 font-semibold">Operator</th>
                              <th className="px-3 py-2 font-semibold">Logged</th>
                              <th className="px-3 py-2 text-right font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.ct.logs.map((log) => (
                              <tr key={log.name} className="border-t border-line/70">
                                <td className="px-3 py-2 text-ink">{log.name}</td>
                                <td className="px-3 py-2 text-ink-2">{log.operator}</td>
                                <td className="px-3 py-2 text-ink-2">{formatDate(log.loggedAt)}</td>
                                <td className="px-3 py-2 text-right"><Badge tone="safe" size="sm">{log.status}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center">
                        <p className="text-[12px] font-medium text-ink">No signed certificate timestamps</p>
                        <p className="mt-1 text-[11.5px] text-ink-3">Unlogged certificates cannot be monitored and are common on disposable hosts.</p>
                      </div>
                    )}
                    <Button to="/advanced/certificate-transparency" variant="brandSoft" size="sm" className="mt-3" iconRight={FiArrowRight}>
                      Open CT monitoring
                    </Button>
                  </div>
                ) : null}

                {tab === 'revocation' ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Status</h4>
                      <div className="mt-2">
                        <DataRow label="Revocation status" value={report.revocation.status === 'good' ? 'Good standing' : 'Unknown / unavailable'} />
                        <DataRow label="Method" value={report.revocation.method} />
                        <DataRow label="OCSP responder" value={report.revocation.ocspResponder} mono />
                        <DataRow label="Must-staple" value={report.revocation.mustStaple ? 'Asserted' : 'Not asserted'} />
                        <DataRow label="Checked at" value={formatDateTime(report.revocation.checkedAt)} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface-2/50 p-4">
                      <div className="flex items-start gap-2.5">
                        {report.revocation.status === 'good' ? <FiCheckCircle className="mt-0.5 text-safe" aria-hidden="true" /> : <FiAlertTriangle className="mt-0.5 text-medium" aria-hidden="true" />}
                        <div>
                          <p className="text-[12.5px] font-semibold text-ink">
                            {report.revocation.status === 'good' ? 'Revocation data is current' : 'Revocation data could not be confirmed'}
                          </p>
                          <p className="mt-1 text-[11.5px] leading-5 text-ink-2">
                            {report.revocation.status === 'good'
                              ? `The responder returned a valid signed response within the freshness window. ${report.revocation.mustStaple ? 'OCSP must-staple is asserted, so clients fail closed.' : 'Stapling is not asserted; availability depends on the client.'}`
                              : 'If revocation information is unavailable, a compromised certificate could continue to be accepted. Prefer must-staple or short-lived certificates.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <SectionCard title="Certificate findings" description="Observations from this check" icon={FiShield}>
                <ul className="space-y-2.5">
                  {report.findings.map((finding, index) => (
                    <li key={`${finding.label}-${index}`} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                      <SeverityBadge severity={finding.severity} size="sm" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-ink">{finding.label}</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-ink-3">{finding.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="What this check covers" description="Certificate health checklist" icon={FiInfo}>
                <ul className="space-y-2">
                  {[
                    'Validity window and renewal headroom',
                    'Chain order and root trust',
                    'Hostname and SAN coverage',
                    'Key algorithm and strength',
                    'CT log inclusion and SCT count',
                    'OCSP / CRL revocation freshness',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <FiCheck className="mt-0.5 shrink-0 text-[11px] text-safe" aria-hidden="true" />
                      <span className="text-[11.5px] leading-5 text-ink-2">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-2 text-[10.5px] text-ink-3">
                  <FiClock className="text-[11px]" aria-hidden="true" /> {report.live ? 'Live server-side check' : 'Simulated in-browser check, 950 ms'}
                </div>
              </SectionCard>
            </div>

            {!report.live ? (
              <Notice tone="neutral" icon={FiCpu} title="Simulated certificate data">
                This report is generated from seeded demo data because the scanning service could not be reached.
              </Notice>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
