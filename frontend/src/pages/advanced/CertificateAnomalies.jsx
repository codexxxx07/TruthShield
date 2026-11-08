import { FiAlertTriangle, FiCheckCircle, FiCpu, FiInfo, FiLock, FiShield, FiXCircle } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../../components/ui/Card';
import { ScoreRing } from '../../components/ui/Progress';
import Notice from '../../components/ui/Notice';
import CopyButton from '../../components/ui/CopyButton';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn, formatDate } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['certificate-anomalies'];

const STATUS_META = {
  pass: { icon: FiCheckCircle, className: 'text-safe', label: 'Pass' },
  warn: { icon: FiAlertTriangle, className: 'text-medium', label: 'Warning' },
  fail: { icon: FiXCircle, className: 'text-critical', label: 'Fail' },
};

export default function CertificateAnomalies() {
  return (
    <>
      <ToolHeader feature={feature} index={3} />
      <DetectionWorkbench feature={feature} inputKind="domain" cta="Check certificate" analyze={(target, options) => runDetection(feature.slug, target, options)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.failed ? 'bg-medium' : 'bg-safe')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreRing
                  value={result.score}
                  tone={result.score > 80 ? 'safe' : result.score > 50 ? 'medium' : 'critical'}
                  className="mx-auto h-[104px] w-[104px]"
                  stroke={8}
                  valueClassName="text-[24px]"
                  caption="integrity"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.failed ? 'medium' : 'safe'} dot>
                      {result.failed ? `${result.failed} anomalies` : 'No anomalies'}
                    </Badge>
                    <Badge tone="neutral">{result.checks.length} checks</Badge>
                    <Badge tone="brand" icon={FiLock}>{result.cert.key}</Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                  <p className="mt-2 font-mono text-[10.5px] text-ink-3">serial {result.cert.serial} · lifetime {result.cert.lifetime} days</p>
                </div>
              </div>
            </Card>

            <SectionCard title="Anomaly checks" description="Expected vs. observed certificate properties" icon={FiShield} flush>
              <ul className="divide-y divide-line/70">
                {result.checks.map((check) => {
                  const meta = STATUS_META[check.status];
                  const Icon = meta.icon;
                  return (
                    <li key={check.id} className="px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-start gap-3">
                        <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border', check.status === 'pass' ? 'border-safe/30 bg-safe/10' : check.status === 'warn' ? 'border-medium/30 bg-medium/10' : 'border-critical/30 bg-critical/10', meta.className)}>
                          <Icon className="text-[12px]" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[12px] font-medium text-ink">{check.title}</p>
                            <Badge tone={check.status === 'pass' ? 'safe' : check.status === 'warn' ? 'medium' : 'critical'} size="sm">{meta.label}</Badge>
                            <SeverityBadge severity={check.severity} size="sm" className="ml-auto" />
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-ink-3">{check.detail}</p>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                            <span className="text-ink-3">expected <span className="font-mono text-ink-2">{check.expected}</span></span>
                            <span className="text-ink-3">actual <span className={cn('font-mono', check.status === 'pass' ? 'text-ink-2' : 'text-medium')}>{check.actual}</span></span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Certificate under review" description="Parsed leaf properties" icon={FiLock}>
                <DataRow label="Subject" value={result.cert.subject} mono />
                <DataRow label="Issuer" value={result.cert.issuer} />
                <DataRow label="Serial" value={result.cert.serial} mono />
                <DataRow label="Valid from" value={formatDate(result.cert.validFrom)} />
                <DataRow label="Valid to" value={formatDate(result.cert.validTo)} />
                <DataRow label="Lifetime" value={`${result.cert.lifetime} days`} />
                <DataRow label="Key" value={result.cert.key} />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.cert.sans.map((san) => (
                    <span key={san} className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[10px] text-ink-2">{san}</span>
                  ))}
                </div>
                <div className="mt-3">
                  <CopyButton value={result.cert.serial} label="Copy serial" />
                </div>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard title="Why anomalies matter" description="How each failure is abused" icon={FiInfo}>
                  <ul className="space-y-2.5">
                    {[
                      ['Weak keys', 'A 1024-bit RSA key can be factored by well-resourced attackers, enabling impersonation.'],
                      ['Short lifetimes', 'Certificates issued for days instead of months signal disposable phishing infrastructure.'],
                      ['Hostname mismatch', 'A SAN that does not cover the visited host means the certificate was never issued for this site.'],
                      ['Missing revocation', 'Without OCSP or CRL data, a compromised certificate stays trusted until expiry.'],
                    ].map(([title, body]) => (
                      <li key={title} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
                        <p className="text-[11px] leading-5 text-ink-2">
                          <span className="font-medium text-ink">{title}.</span> {body}
                        </p>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
                <Notice tone={result.failed ? 'warning' : 'safe'} icon={result.failed ? FiAlertTriangle : FiCheckCircle} title={result.failed ? 'Review recommended' : 'Certificate is well-formed'}>
                  {result.failed
                    ? 'At least one check returned a warning or failure. Correlate with CT logs and hosting reputation before trusting this endpoint.'
                    : 'All checks passed against the baseline: modern key, compliant lifetime, matching SANs and complete revocation data.'}
                </Notice>
              </div>
            </div>

            {!result.live ? (
              <Notice tone="neutral" icon={FiCpu}>
              Certificate parsing is simulated locally. No handshake or X.509 validation was performed.
            </Notice>
            ) : null}
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
