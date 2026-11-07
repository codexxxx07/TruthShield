import { FiAlertTriangle, FiCheckCircle, FiCpu, FiEye, FiLayers, FiMonitor, FiSearch, FiSmartphone } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard } from '../../components/ui/Card';
import { ScoreRing } from '../../components/ui/Progress';
import MockSitePreview from '../../components/ui/MockSitePreview';
import Notice from '../../components/ui/Notice';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn } from '../../lib/utils';

const feature = FEATURE_BY_SLUG.cloaking;

const AGENT_ICON = [FiMonitor, FiSmartphone, FiSearch];

export default function Cloaking() {
  return (
    <>
      <ToolHeader feature={feature} index={8} />
      <DetectionWorkbench feature={feature} inputKind="url" cta="Run three-way render" analyze={(target) => runDetection(feature.slug, target)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.cloakingDetected ? 'bg-critical' : 'bg-safe')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreRing
                  value={result.score}
                  tone={result.cloakingDetected ? 'critical' : 'safe'}
                  className="mx-auto h-[104px] w-[104px]"
                  stroke={8}
                  valueClassName="text-[24px]"
                  caption="risk"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.cloakingDetected ? 'critical' : 'safe'} dot>
                      {result.cloakingDetected ? 'Cloaking detected' : 'Consistent rendering'}
                    </Badge>
                    <Badge tone="neutral">3 user agents</Badge>
                    <Badge tone="brand" icon={FiEye}>DOM + script diff</Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                  <p className="mt-1.5 break-all font-mono text-[10.5px] text-ink-3">{result.target}</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-3 lg:grid-cols-3">
              {result.variants.map((variant, index) => {
                const Icon = AGENT_ICON[index] || FiMonitor;
                return (
                  <Card key={variant.label} className="overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="text-[13px] text-ink-3" aria-hidden="true" />
                        <span className="text-[11.5px] font-medium text-ink">{variant.label}</span>
                      </div>
                      <Badge tone={index === 2 && result.cloakingDetected ? 'medium' : 'neutral'} size="sm">{variant.status}</Badge>
                    </div>
                    <div className="p-3">
                      <MockSitePreview
                        url={result.target}
                        brand={index === 2 ? 'Health Blog' : 'Acme Bank'}
                        palette={index === 2 ? 'slate' : 'navy'}
                        variant={index === 2 ? 'article' : 'login'}
                        label={variant.label}
                        className="border-0 bg-transparent"
                      />
                      <p className="mt-2 text-[9.5px] text-ink-3">{variant.agent}</p>
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'Words', value: variant.words },
                          { label: 'Scripts', value: variant.scripts },
                          { label: 'Hash', value: variant.hash },
                        ].map((item) => (
                          <div key={item.label} className="rounded-md border border-line bg-surface-2/60 px-1.5 py-1">
                            <p className="text-[8.5px] uppercase tracking-[0.05em] text-ink-3">{item.label}</p>
                            <p className="truncate font-mono text-[10px] text-ink">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <SectionCard title="Content differences" description="Field-by-field comparison across renders" icon={FiLayers} flush>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[11.5px]">
                  <thead className="bg-surface-2/70 text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Aspect</th>
                      <th className="px-4 py-2.5 font-semibold">Desktop</th>
                      <th className="px-4 py-2.5 font-semibold">Mobile</th>
                      <th className="px-4 py-2.5 font-semibold">Crawler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.diffs.map((diff) => {
                      const divergent = new Set([diff.desktop, diff.mobile, diff.crawler]).size > 1;
                      return (
                        <tr key={diff.aspect} className="border-t border-line/70">
                          <td className="px-4 py-2.5 text-ink-2">{diff.aspect}</td>
                          <td className={cn('px-4 py-2.5 font-mono text-[10.5px]', divergent ? 'text-medium' : 'text-ink-2')}>{diff.desktop}</td>
                          <td className={cn('px-4 py-2.5 font-mono text-[10.5px]', divergent ? 'text-medium' : 'text-ink-2')}>{diff.mobile}</td>
                          <td className={cn('px-4 py-2.5 font-mono text-[10.5px]', divergent ? 'text-critical' : 'text-ink-2')}>{diff.crawler}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Findings" description="Cloaking indicators" icon={FiAlertTriangle}>
                <ul className="space-y-2.5">
                  {result.findings.map((finding) => (
                    <li key={finding.title} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                      <SeverityBadge severity={finding.severity} size="sm" />
                      <div>
                        <p className="text-[11.5px] font-medium text-ink">{finding.title}</p>
                        <p className="mt-0.5 text-[10.5px] leading-4 text-ink-3">{finding.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Why cloaking matters" description="How conditional serving is used" icon={FiCheckCircle}>
                <ul className="space-y-2.5">
                  {[
                    ['Search engine evasion', 'Crawlers see harmless content so the site stays indexed while real visitors get the lure.'],
                    ['Review bypass', 'Manual reviewers on desktop see a different page than mobile users who receive the SMS.'],
                    ['Referrer gating', 'Only visitors arriving from a specific link see the payload, hiding it from direct checks.'],
                  ].map(([title, body]) => (
                    <li key={title} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
                      <p className="text-[11px] leading-5 text-ink-2"><span className="font-medium text-ink">{title}.</span> {body}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>

            <Notice tone="neutral" icon={FiCpu}>
              Render comparison is simulated. A real implementation would use headless browsers with distinct user agents
              and compare DOM hashes, network logs and visible text.
            </Notice>
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
