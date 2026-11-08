import { FiAlertTriangle, FiCpu, FiGlobe, FiHardDrive, FiInfo, FiMapPin, FiServer, FiWifi } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../../components/ui/Card';
import { Gauge, Meter } from '../../components/ui/Progress';
import Notice from '../../components/ui/Notice';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn, formatDate, formatNumber } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['hosting-fingerprint'];

export default function HostingFingerprint() {
  return (
    <>
      <ToolHeader feature={feature} index={12} />
      <DetectionWorkbench feature={feature} inputKind="domain" cta="Fingerprint host" analyze={(target, options) => runDetection(feature.slug, target, options)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.reputation.score > 55 ? 'bg-critical' : 'bg-safe')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.reputation.score > 55 ? 'critical' : 'safe'} dot>
                      {result.reputation.score > 55 ? 'High-risk infrastructure' : 'Low abuse volume'}
                    </Badge>
                    <Badge tone="neutral">{result.asn}</Badge>
                    <Badge tone="brand" icon={FiGlobe}>{result.geo.country}</Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      { label: 'IP address', value: result.ip, icon: FiServer },
                      { label: 'Organisation', value: result.org, icon: FiHardDrive },
                      { label: 'Reverse DNS', value: result.reverse, icon: FiWifi },
                      { label: 'Location', value: `${result.geo.city}, ${result.geo.country}`, icon: FiMapPin },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
                          <Icon className="mt-0.5 shrink-0 text-[12px] text-ink-3" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.06em] text-ink-3">{item.label}</p>
                            <p className="truncate font-mono text-[10.5px] text-ink">{item.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mx-auto flex w-[160px] flex-col items-center gap-2">
                  <Gauge label="Host reputation" value={result.reputation.score} tone={result.reputation.score > 55 ? 'critical' : 'safe'} />
                  <div className="flex flex-wrap justify-center gap-1">
                    {result.reputation.tags.map((tag) => (
                      <Badge key={tag} tone={result.reputation.score > 55 ? 'high' : 'neutral'} size="sm">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <SectionCard title="DNS records" description="Published resource records" icon={FiGlobe}>
                <div className="space-y-2.5">
                  {[
                    { type: 'A', values: result.dns.a },
                    { type: 'AAAA', values: result.dns.aaaa },
                    { type: 'MX', values: result.dns.mx },
                    { type: 'NS', values: result.dns.ns },
                    { type: 'TXT', values: result.dns.txt },
                  ].map((record) => (
                    <div key={record.type} className="flex items-start gap-3">
                      <span className="mt-0.5 w-12 shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-center font-mono text-[9.5px] text-ink-3">{record.type}</span>
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        {record.values.length ? record.values.map((value) => (
                          <span key={value} className="max-w-full truncate rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-2">{value}</span>
                        )) : <span className="text-[10.5px] text-ink-3">no record</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-line pt-2.5">
                  <DataRow label="Region code" value={result.geo.region} mono />
                  <DataRow label="First seen" value={formatDate(result.reputation.firstSeen)} />
                </div>
              </SectionCard>

              <SectionCard title="Shared hosting" description="Neighbourhood and abuse density" icon={FiHardDrive}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
                    <p className="text-[18px] font-semibold tabular text-ink">{formatNumber(result.shared.totalDomains)}</p>
                    <p className="text-[9.5px] uppercase tracking-[0.06em] text-ink-3">domains on host</p>
                  </div>
                  <div className="rounded-lg border border-critical/25 bg-critical/[0.05] px-3 py-2.5">
                    <p className="text-[18px] font-semibold tabular text-critical">{formatNumber(result.shared.malicious)}</p>
                    <p className="text-[9.5px] uppercase tracking-[0.06em] text-ink-3">previously reported</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="text-ink-2">Abuse ratio</span>
                    <span className="font-mono text-ink-3">{((result.shared.malicious / Math.max(result.shared.totalDomains, 1)) * 100).toFixed(1)}%</span>
                  </div>
                  <Meter value={(result.shared.malicious / Math.max(result.shared.totalDomains, 1)) * 100 * 4} tone={result.shared.malicious > 50 ? 'critical' : 'medium'} className="mt-1.5" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.shared.categories.map((category) => (
                    <Badge key={category} tone="neutral" size="sm">{category}</Badge>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.07em] text-ink-3">Reports · 30 days</p>
                  <p className="mt-0.5 text-[16px] font-semibold tabular text-ink">{result.reputation.reports30d}</p>
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Neighbouring hosts" description="Other IPs in the same allocation" icon={FiServer} flush>
                <ul className="divide-y divide-line/70">
                  {result.neighbours.map((neighbour) => (
                    <li key={neighbour.ip} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="font-mono text-[10.5px] text-ink">{neighbour.ip}</p>
                        <p className="text-[9.5px] text-ink-3">{neighbour.note}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-ink-3">{neighbour.domains} domains</span>
                        <SeverityBadge severity={neighbour.risk} size="sm" />
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Open ports" description="Observed from passive scanning" icon={FiWifi} flush>
                <ul className="divide-y divide-line/70">
                  {result.ports.map((port) => (
                    <li key={port.port} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <span className="font-mono text-[10.5px] text-ink">{port.port}</span>
                      <span className="text-[10.5px] text-ink-2">{port.service}</span>
                      <Badge tone={port.state === 'open' ? 'medium' : port.state === 'redirect' ? 'low' : 'neutral'} size="sm">{port.state}</Badge>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>

            <Notice tone={result.reputation.score > 55 ? 'warning' : 'safe'} icon={result.reputation.score > 55 ? FiAlertTriangle : FiInfo} title={result.reputation.score > 55 ? 'Infrastructure has an abuse history' : 'No strong infrastructure signals'}>
              {result.reputation.score > 55
                ? `${formatNumber(result.shared.malicious)} domains on this host have been reported previously. Correlate with redirect chains and certificate history before allowing traffic.`
                : 'The host has a low abuse ratio and no bulletproof-hosting indicators. Continue routine monitoring.'}
            </Notice>

            {!result.live ? (
              <Notice tone="neutral" icon={FiCpu}>
              Hosting intelligence is simulated. No DNS lookup, port scan or IP reputation query was performed.
            </Notice>
            ) : null}
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
