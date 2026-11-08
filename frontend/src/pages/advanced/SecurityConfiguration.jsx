import { FiAlertTriangle, FiCheck, FiCpu, FiInfo, FiLock, FiServer, FiShield, FiSliders, FiX } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../../components/ui/Card';
import { ScoreRing, Gauge } from '../../components/ui/Progress';
import Notice from '../../components/ui/Notice';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['security-configuration'];

export default function SecurityConfiguration() {
  return (
    <>
      <ToolHeader feature={feature} index={6} />
      <DetectionWorkbench feature={feature} inputKind="url" cta="Scan configuration" analyze={(target, options) => runDetection(feature.slug, target, options)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.score > 80 ? 'bg-safe' : result.score > 60 ? 'bg-medium' : 'bg-critical')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreRing
                  value={result.score}
                  tone={result.score > 80 ? 'safe' : result.score > 60 ? 'medium' : 'critical'}
                  className="mx-auto h-[104px] w-[104px]"
                  stroke={8}
                  valueClassName="text-[24px]"
                  label={result.grade}
                  caption="grade"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.score > 80 ? 'safe' : result.score > 60 ? 'medium' : 'critical'} dot>
                      {result.score > 80 ? 'Hardened' : result.score > 60 ? 'Partially hardened' : 'Weak configuration'}
                    </Badge>
                    <Badge tone="neutral">{result.headers.filter((header) => header.present).length}/{result.headers.length} headers</Badge>
                    <Badge tone="brand" icon={FiSliders}>{result.tls.preferred}</Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                  <p className="mt-1.5 font-mono text-[10.5px] text-ink-3">{result.target}</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <SectionCard title="Security headers" description="Baseline controls on the document response" icon={FiShield}>
                <ul className="space-y-1.5">
                  {result.headers.map((header) => (
                    <li key={header.name} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 px-2.5 py-2">
                      <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full', header.present ? 'bg-safe/15 text-safe' : 'bg-critical/15 text-critical')}>
                        {header.present ? <FiCheck className="text-[9px]" aria-hidden="true" /> : <FiX className="text-[9px]" aria-hidden="true" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-ink">{header.name}</p>
                        <p className={cn('truncate font-mono text-[9.5px]', header.present ? 'text-ink-3' : 'text-critical/80')}>
                          {header.present ? header.value : 'header absent'}
                        </p>
                      </div>
                      <Badge tone={header.present ? 'safe' : 'critical'} size="sm">{header.present ? 'set' : 'missing'}</Badge>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard title="TLS configuration" description="Negotiated protocol and cipher posture" icon={FiLock}>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tls.versions.map((version) => (
                      <Badge key={version} tone={version === 'TLS 1.0' || version === 'TLS 1.1' ? 'critical' : 'safe'} size="sm">{version}</Badge>
                    ))}
                  </div>
                  <div className="mt-3">
                    <DataRow label="Preferred" value={result.tls.preferred} />
                    <DataRow label="Cipher" value={result.tls.cipher} mono />
                    <DataRow label="Forward secrecy" value={result.tls.forwardSecrecy ? 'Enabled' : 'Not guaranteed'} />
                    <DataRow label="OCSP stapling" value={result.tls.ocspStapling ? 'Enabled' : 'Disabled'} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Gauge label="Transport" value={result.tls.forwardSecrecy ? 92 : 46} tone={result.tls.forwardSecrecy ? 'safe' : 'medium'} />
                    <Gauge label="Header coverage" value={(result.headers.filter((header) => header.present).length / result.headers.length) * 100} tone="brand" />
                  </div>
                </SectionCard>

                <SectionCard title="Outdated software" description="Detected from asset fingerprints" icon={FiServer} flush>
                  <ul className="divide-y divide-line/70">
                    {result.software.map((item) => (
                      <li key={item.name} className="flex items-center justify-between gap-2 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[11px] text-ink">{item.name}</p>
                          <p className="font-mono text-[9.5px] text-ink-3">{item.version} → {item.current}</p>
                        </div>
                        <Badge tone={item.status === 'outdated' ? 'medium' : 'low'} size="sm">{item.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>
            </div>

            <SectionCard title="Exposed surfaces" description="Common administrative and sensitive paths" icon={FiServer} flush>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[11.5px]">
                  <thead className="bg-surface-2/70 text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Path</th>
                      <th className="px-4 py-2.5 font-semibold">Surface</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Response</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.exposed.map((item) => (
                      <tr key={item.path} className="border-t border-line/70">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-ink">{item.path}</td>
                        <td className="px-4 py-2.5 text-ink-2">{item.label}</td>
                        <td className={cn('px-4 py-2.5 text-right font-mono', item.status < 300 ? 'text-critical' : item.status === 401 || item.status === 403 ? 'text-medium' : 'text-ink-3')}>
                          {item.status}
                        </td>
                        <td className="px-4 py-2.5 text-right"><SeverityBadge severity={item.severity} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Misconfigurations" description="Issues that widen the attack surface" icon={FiAlertTriangle}>
                <ul className="space-y-2.5">
                  {result.misconfigs.map((item) => (
                    <li key={item.title} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                      <SeverityBadge severity={item.severity} size="sm" />
                      <div>
                        <p className="text-[11.5px] font-medium text-ink">{item.title}</p>
                        <p className="mt-0.5 text-[10.5px] leading-4 text-ink-3">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Remediation order" description="Highest expected risk reduction first" icon={FiInfo}>
                <ol className="space-y-2">
                  {result.recommendations.map((item, index) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-brand/25 bg-brand/10 font-mono text-[9px] text-brand">
                        {index + 1}
                      </span>
                      <span className="text-[11px] leading-5 text-ink-2">{item}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.07em] text-ink-3">Deep-dive</p>
                  <p className="mt-0.5 text-[11px] text-ink-2">
                    Need the full graded report with evidence? Use the Security Analysis page.
                  </p>
                </div>
              </SectionCard>
            </div>

            {!result.live ? (
              <Notice tone="neutral" icon={FiCpu}>
              Configuration probing is simulated. No HTTP requests were made and no endpoints were actually tested.
            </Notice>
            ) : null}
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
