import { FiAlertTriangle, FiArrowRight, FiClock, FiCpu, FiExternalLink, FiGitBranch, FiGlobe, FiInfo, FiSlash } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { SectionCard } from '../../components/ui/Card';
import Notice from '../../components/ui/Notice';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['redirect-chain'];

export default function RedirectChain() {
  return (
    <>
      <ToolHeader feature={feature} index={7} />
      <DetectionWorkbench feature={feature} inputKind="url" cta="Trace redirects" analyze={(target, options) => runDetection(feature.slug, target, options)}>
        {(result) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: 'Total hops', value: result.hops.length - 1, icon: FiGitBranch, tone: 'brand' },
                { label: 'Domains crossed', value: result.domainsCrossed, icon: FiGlobe, tone: 'medium' },
                { label: 'Total latency', value: `${result.totalMs} ms`, icon: FiClock, tone: 'low' },
                { label: 'Risk score', value: result.score, icon: FiAlertTriangle, tone: result.score > 65 ? 'critical' : 'medium' },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="card p-3.5">
                    <div className="flex items-start justify-between">
                      <p className="text-[10px] uppercase tracking-[0.06em] text-ink-3">{stat.label}</p>
                      <Icon className={cn('text-[13px]', stat.tone === 'critical' ? 'text-critical' : stat.tone === 'medium' ? 'text-medium' : stat.tone === 'low' ? 'text-low' : 'text-brand')} aria-hidden="true" />
                    </div>
                    <p className="mt-1.5 text-[19px] font-semibold tabular text-ink">{stat.value}</p>
                  </div>
                );
              })}
            </div>

            <SectionCard title="Redirect chain" description="Every hop the browser follows" icon={FiGitBranch}>
              <div className="-mx-1 overflow-x-auto px-1 pb-2">
                <div className="flex min-w-max items-stretch gap-2">
                  {result.hops.map((hop, index) => (
                    <div key={hop.url} className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-[220px] rounded-xl border p-3',
                          index === result.hops.length - 1
                            ? 'border-critical/30 bg-critical/[0.05]'
                            : hop.status >= 300 && hop.status < 400
                              ? 'border-medium/25 bg-medium/[0.04]'
                              : 'border-line bg-surface-2/40',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Badge tone={hop.skip ? 'neutral' : hop.status < 300 ? 'critical' : 'medium'} size="sm">{hop.status}</Badge>
                          <span className="font-mono text-[9.5px] text-ink-3">{hop.latency} ms</span>
                        </div>
                        <p className="mt-2 line-clamp-2 break-all font-mono text-[10px] leading-4 text-ink">{hop.url}</p>
                        <p className="mt-1.5 text-[9.5px] text-ink-3">{hop.type} · {hop.server}</p>
                        <p className="mt-0.5 text-[9.5px] text-ink-3">{hop.note}</p>
                      </div>
                      {index < result.hops.length - 1 ? (
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-3">
                          <FiArrowRight className="text-[12px]" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Hop detail" description="Server, method and destination" icon={FiExternalLink} flush>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[11.5px]">
                  <thead className="bg-surface-2/70 text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">#</th>
                      <th className="px-4 py-2.5 font-semibold">From</th>
                      <th className="px-4 py-2.5 font-semibold">To</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Status</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.hops.map((hop, index) => (
                      <tr key={`${hop.url}-${index}`} className="border-t border-line/70">
                        <td className="px-4 py-2.5 font-mono text-ink-3">{index + 1}</td>
                        <td className="max-w-[240px] px-4 py-2.5"><p className="truncate font-mono text-[10.5px] text-ink">{hop.url}</p></td>
                        <td className="max-w-[240px] px-4 py-2.5"><p className="truncate font-mono text-[10.5px] text-ink-2">{index < result.hops.length - 1 ? result.hops[index + 1].url : '—'}</p></td>
                        <td className="px-4 py-2.5 text-ink-2">{hop.type}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink-2">{hop.status}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-ink-3">{hop.latency} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Suspicious indicators" description="What makes this chain risky" icon={FiAlertTriangle}>
                <ul className="space-y-2.5">
                  {result.flags.map((flag) => (
                    <li key={flag.title} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                      <SeverityBadge severity={flag.severity} size="sm" />
                      <div>
                        <p className="text-[11.5px] font-medium text-ink">{flag.title}</p>
                        <p className="mt-0.5 text-[10.5px] leading-4 text-ink-3">{flag.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Final destination" description="Where the user actually lands" icon={FiGlobe}>
                <div className="rounded-xl border border-critical/25 bg-critical/[0.04] p-3.5">
                  <div className="flex items-center gap-2">
                    <FiSlash className="text-critical" aria-hidden="true" />
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-critical">Landing page</p>
                  </div>
                  <p className="mt-1.5 break-all font-mono text-[11.5px] text-ink">{result.final}</p>
                  <p className="mt-1.5 text-[10.5px] text-ink-3">
                    Reached after {result.hops.length - 1} redirects and {result.totalMs} ms of cumulative latency.
                  </p>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-ink-2">{result.summary}</p>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                  <FiInfo className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                  <p className="text-[10px] leading-4 text-ink-3">
                    Meta-refresh and JavaScript hops are invisible to simple HEAD requests, which is why they are traced
                    separately here.
                  </p>
                </div>
              </SectionCard>
            </div>

            {!result.live ? (
              <Notice tone="neutral" icon={FiCpu}>
              Redirect tracing is simulated. No request was issued and no remote server was contacted.
            </Notice>
            ) : null}
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
