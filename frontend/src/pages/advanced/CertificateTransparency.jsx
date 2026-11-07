import { Link } from 'react-router-dom';
import { FiAlertTriangle, FiArrowRight, FiClock, FiCpu, FiDatabase, FiEye, FiLink2, FiShield } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { SectionCard, DataRow } from '../../components/ui/Card';
import Notice from '../../components/ui/Notice';
import EmptyState from '../../components/ui/EmptyState';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn, formatDate, formatNumber, timeAgo } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['certificate-transparency'];

const TYPE_TONE = { issued: 'low', renewed: 'safe', revoked: 'critical' };
const STATUS_TONE = { active: 'critical', revoked: 'safe', expired: 'neutral' };

export default function CertificateTransparency() {
  return (
    <>
      <ToolHeader feature={feature} index={1} />
      <DetectionWorkbench feature={feature} inputKind="domain" cta="Start monitoring" analyze={(target) => runDetection(feature.slug, target)}>
        {(result) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: 'Certificates', value: formatNumber(result.stats.certificates), icon: FiDatabase, tone: 'brand' },
                { label: 'Lookalikes', value: result.stats.lookalikes, icon: FiEye, tone: result.stats.lookalikes ? 'high' : 'safe' },
                { label: 'Open alerts', value: result.stats.alerts, icon: FiAlertTriangle, tone: result.stats.alerts ? 'critical' : 'safe' },
                { label: 'CT log mirrors', value: result.stats.monitors, icon: FiLink2, tone: 'low' },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="card p-3.5">
                    <div className="flex items-start justify-between">
                      <p className="text-[10px] uppercase tracking-[0.06em] text-ink-3">{stat.label}</p>
                      <Icon className={cn('text-[13px]', stat.tone === 'critical' ? 'text-critical' : stat.tone === 'high' ? 'text-high' : stat.tone === 'safe' ? 'text-safe' : stat.tone === 'low' ? 'text-low' : 'text-brand')} aria-hidden="true" />
                    </div>
                    <p className="mt-1.5 text-[20px] font-semibold tabular text-ink">{stat.value}</p>
                  </div>
                );
              })}
            </div>

            <SectionCard
              title="Lookalike certificates"
              description="Issuances that imitate the monitored brand"
              icon={FiEye}
              action={<Badge tone={result.stats.lookalikes ? 'high' : 'safe'} dot>{result.stats.lookalikes ? `${result.stats.lookalikes} flagged` : 'clean'}</Badge>}
              flush
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[11.5px]">
                  <thead className="bg-surface-2/70 text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Domain</th>
                      <th className="px-4 py-2.5 font-semibold">Issuer</th>
                      <th className="px-4 py-2.5 font-semibold">Issued</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Similarity</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.lookalikes.map((item) => (
                      <tr key={item.domain} className="border-t border-line/70">
                        <td className="px-4 py-2.5">
                          <p className="font-mono text-[11px] text-ink">{item.domain}</p>
                        </td>
                        <td className="px-4 py-2.5 text-ink-2">{item.issuer}</td>
                        <td className="px-4 py-2.5 text-ink-2">{formatDate(item.issued)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={cn('font-mono tabular', item.similarity > 85 ? 'text-critical' : 'text-medium')}>{item.similarity}%</span>
                        </td>
                        <td className="px-4 py-2.5 text-right"><Badge tone={STATUS_TONE[item.status]} size="sm">{item.status}</Badge></td>
                        <td className="px-4 py-2.5 text-right">
                          <Link to={`/scan?url=${encodeURIComponent(`https://${item.domain}`)}`} className="text-[10.5px] font-medium text-brand">Scan</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line px-4 py-2.5">
                <ButtonLink />
              </div>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <SectionCard title="Issuance timeline" description="Chronological CT log events for the brand" icon={FiClock}>
                <ol className="rail space-y-4">
                  {result.timeline.map((entry) => (
                    <li key={`${entry.date}-${entry.serial}`} className="relative flex gap-3">
                      <span
                        className={cn(
                          'z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border',
                          entry.flagged ? 'border-critical/35 bg-critical/10 text-critical' : 'border-line bg-surface text-ink-3',
                        )}
                      >
                        {entry.flagged ? <FiAlertTriangle className="text-[11px]" aria-hidden="true" /> : <FiShield className="text-[11px]" aria-hidden="true" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-mono text-[11px] text-ink">{entry.commonName}</p>
                          <Badge tone={TYPE_TONE[entry.type]} size="sm">{entry.type}</Badge>
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-ink-3">
                          {formatDate(entry.date)} · {entry.issuer} · serial {entry.serial}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard title="Alerts" description="Generated from this monitor" icon={FiAlertTriangle} flush>
                  {result.alerts.length ? (
                    <ul className="divide-y divide-line/70">
                      {result.alerts.map((alert) => (
                        <li key={alert.title} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11.5px] font-medium text-ink">{alert.title}</p>
                            <SeverityBadge severity={alert.severity} size="sm" />
                          </div>
                          <p className="mt-1 text-[10.5px] leading-5 text-ink-3">{alert.detail}</p>
                          <p className="mt-1 text-[9.5px] text-ink-3">{timeAgo(alert.time)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4">
                      <EmptyState icon={FiShield} title="No alerts" description="No lookalike issuances in the monitoring window." compact />
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Log mirrors" description="Ingestion health" icon={FiCpu} flush>
                  <ul className="divide-y divide-line/70">
                    {result.logs.map((log) => (
                      <li key={log.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] text-ink">{log.name}</p>
                          <p className="text-[10px] text-ink-3">{formatNumber(log.entries)} entries</p>
                        </div>
                        <Badge tone="safe" size="sm" dot>{log.lag} lag</Badge>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Monitor summary" description="Current posture" icon={FiDatabase}>
                <DataRow label="Monitored target" value={result.target} mono />
                <DataRow label="Total certificates seen" value={formatNumber(result.stats.certificates)} />
                <DataRow label="Flagged issuances" value={result.stats.lookalikes} />
                <DataRow label="Last scan" value={formatDate(result.stats.lastScan)} />
                <DataRow label="Wildcard coverage" value="Apex + *.brand" />
              </SectionCard>
              <Notice tone={result.stats.alerts ? 'warning' : 'safe'} title={result.stats.alerts ? 'Action recommended' : 'Monitoring healthy'} icon={result.stats.alerts ? FiAlertTriangle : FiShield}>
                {result.stats.alerts
                  ? `${result.summary} Consider adding the flagged hosts to your takedown queue and blocking them at the gateway.`
                  : `${result.summary} Continuous monitoring remains active across all configured log mirrors.`}
              </Notice>
            </div>

            <Notice tone="neutral" icon={FiCpu}>
              Certificate transparency data is simulated for this demo. No CT log was queried.
            </Notice>
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}

function ButtonLink() {
  return (
    <Link to="/advanced/ca-reputation" className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
      Check the issuing CA reputation <FiArrowRight className="text-[11px]" aria-hidden="true" />
    </Link>
  );
}
