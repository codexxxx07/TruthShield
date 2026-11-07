import { FiAward, FiCheck, FiClock, FiCpu, FiInfo, FiShield, FiAlertTriangle, FiGlobe } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../../components/ui/Card';
import { ScoreRing, Gauge } from '../../components/ui/Progress';
import Notice from '../../components/ui/Notice';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['ca-reputation'];

export default function CaReputation() {
  return (
    <>
      <ToolHeader feature={feature} index={2} />
      <DetectionWorkbench feature={feature} inputKind="domain" cta="Score this CA" analyze={(target) => runDetection(feature.slug, target)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.score > 85 ? 'bg-safe' : result.score > 70 ? 'bg-medium' : 'bg-critical')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreRing
                  value={result.score}
                  tone={result.score > 85 ? 'safe' : result.score > 70 ? 'medium' : 'critical'}
                  className="mx-auto h-[112px] w-[112px]"
                  stroke={8}
                  valueClassName="text-[26px]"
                  label={result.grade}
                  caption="CA grade"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.verdict === 'trusted' ? 'safe' : 'medium'} dot>
                      {result.verdict === 'trusted' ? 'Trusted CA' : 'Monitor closely'}
                    </Badge>
                    <Badge tone="neutral">{result.ca.type}</Badge>
                    <Badge tone="brand" icon={FiAward}>Since {result.ca.since}</Badge>
                  </div>
                  <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-ink">{result.ca.name}</h2>
                  <p className="mt-1 text-[12px] leading-5 text-ink-2">{result.summary}</p>
                  <div className="mt-3 grid gap-x-6 gap-y-1 text-[11px] text-ink-3 sm:grid-cols-2">
                    <span>Root certificates <span className="font-mono text-ink-2">{result.ca.roots}</span></span>
                    <span>Validation tier <span className="text-ink-2">{result.ca.tier}</span></span>
                    <span>Country <span className="text-ink-2">{result.ca.country}</span></span>
                    <span>Issuing for <span className="text-ink-2">{result.target}</span></span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <SectionCard title="Reputation dimensions" description="Weighted assessment of the authority" icon={FiAward}>
                <div className="space-y-3.5">
                  {result.dimensions.map((dimension) => (
                    <Gauge
                      key={dimension.label}
                      label={dimension.label}
                      value={dimension.value}
                      tone={dimension.value > 85 ? 'safe' : dimension.value > 70 ? 'brand' : 'medium'}
                    />
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
                  <p className="flex items-start gap-2 text-[11px] leading-5 text-ink-2">
                    <FiInfo className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                    Scores combine audit history, incident response times, revocation velocity and root program
                    standing. Demo weights are illustrative.
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="Trust store coverage" description="Where the root is accepted" icon={FiGlobe}>
                <ul className="space-y-2">
                  {result.trustStores.map((store) => (
                    <li key={store.store} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-safe/10 text-safe">
                          <FiCheck className="text-[10px]" aria-hidden="true" />
                        </span>
                        <span className="text-[12px] text-ink">{store.store}</span>
                      </div>
                      <span className="font-mono text-[10.5px] text-ink-3">since {store.since}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <DataRow label="Audit standard" value="WebTrust for CA 2.2" />
                  <DataRow label="Last audit" value="Current cycle" />
                  <DataRow label="Revocation SLA" value={result.score > 85 ? '24 hours' : '72 hours'} />
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Assessment signals" description="Evidence behind the grade" icon={FiShield} flush>
              <ul className="divide-y divide-line/70">
                {result.signals.map((signal) => (
                  <li key={signal.label} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                    <span className="text-[11.5px] text-ink-2">{signal.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-right text-[11px] text-ink">{signal.value}</span>
                      <SeverityBadge severity={signal.tone === 'safe' ? 'info' : signal.tone} size="sm" />
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Incident history" description="Published CA incidents" icon={FiAlertTriangle}>
              <ol className="space-y-3">
                {result.incidents.map((incident) => (
                  <li key={`${incident.year}-${incident.title}`} className="rounded-xl border border-line bg-surface-2/40 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-ink-3">{incident.year}</span>
                      <p className="text-[12px] font-medium text-ink">{incident.title}</p>
                      <SeverityBadge severity={incident.severity} size="sm" />
                      <Badge tone="safe" size="sm" className="ml-auto">{incident.status}</Badge>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-ink-2">{incident.summary}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex items-center gap-2 text-[10.5px] text-ink-3">
                <FiClock className="text-[11px]" aria-hidden="true" /> Incident records are simulated for this demo.
              </div>
            </SectionCard>

            <Notice tone={result.verdict === 'trusted' ? 'safe' : 'warning'} icon={result.verdict === 'trusted' ? FiShield : FiAlertTriangle} title={result.verdict === 'trusted' ? 'CA is currently trusted' : 'CA warrants monitoring'}>
              {result.verdict === 'trusted'
                ? 'The issuing authority maintains current audits, full root coverage and an incident response history within policy. No distrust indicators were found.'
                : 'The authority has a history of incidents or slower revocation publication. Prefer short-lived certificates and monitor CT logs for this domain.'}
            </Notice>

            <Notice tone="neutral" icon={FiCpu}>
              Reputation scoring is simulated. In production this module would consume CA/Browser Forum records, audit
              statements and CT incident disclosures.
            </Notice>
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
