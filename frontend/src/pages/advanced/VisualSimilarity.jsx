import { FiAlertTriangle, FiArrowRight, FiCheckCircle, FiCpu, FiEye, FiInfo, FiLayers, FiTarget } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard } from '../../components/ui/Card';
import { ScoreRing, Gauge } from '../../components/ui/Progress';
import MockSitePreview from '../../components/ui/MockSitePreview';
import Notice from '../../components/ui/Notice';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['visual-similarity'];

const VERDICT = {
  clone: { tone: 'critical', label: 'Clone detected' },
  partial: { tone: 'medium', label: 'Partial similarity' },
  distinct: { tone: 'safe', label: 'Distinct design' },
};

export default function VisualSimilarity() {
  return (
    <>
      <ToolHeader feature={feature} index={4} />
      <DetectionWorkbench feature={feature} inputKind="url" cta="Compare visuals" analyze={(target, options) => runDetection(feature.slug, target, options)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.verdict === 'clone' ? 'bg-critical' : result.verdict === 'partial' ? 'bg-medium' : 'bg-safe')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <ScoreRing
                  value={result.score}
                  tone={result.verdict === 'clone' ? 'critical' : result.verdict === 'partial' ? 'medium' : 'safe'}
                  className="mx-auto h-[104px] w-[104px]"
                  stroke={8}
                  valueClassName="text-[24px]"
                  caption="similarity"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={VERDICT[result.verdict].tone} dot>{VERDICT[result.verdict].label}</Badge>
                    <Badge tone="brand" icon={FiEye}>Brand: {result.brand}</Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">
                    {result.verdict === 'clone'
                      ? `The page reproduces the protected ${result.brand} template with ${result.score}% structural overlap. Layout, palette and form composition are effectively identical.`
                      : result.verdict === 'partial'
                        ? 'Some brand cues are shared, but structural differences outweigh them. This may be a partner site or a lookalike under construction.'
                        : 'Layout, palette and form composition differ enough that this is not a brand clone.'}
                  </p>
                  <p className="mt-2 break-all font-mono text-[10.5px] text-ink-3">{result.suspect.url}</p>
                </div>
                <Link to={`/scan?url=${encodeURIComponent(result.suspect.url)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/[0.07] px-2.5 py-1.5 text-[11.5px] font-medium text-brand">
                  Full scan <FiArrowRight className="text-[11px]" aria-hidden="true" />
                </Link>
              </div>
            </Card>

            <SectionCard title="Side-by-side render" description="Protected template vs. analysed page" icon={FiLayers}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Reference brand</span>
                    <Badge tone="safe" size="sm" icon={FiCheckCircle}>legitimate</Badge>
                  </div>
                  <MockSitePreview
                    url={result.legitimate.url}
                    brand={result.brand}
                    palette="navy"
                    variant={result.legitimate.render}
                    label="Reference render"
                  />
                  <p className="mt-2 text-[10.5px] text-ink-3">{result.legitimate.title} · owned template</p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Analysed page</span>
                    <Badge tone={VERDICT[result.verdict].tone} size="sm" icon={FiAlertTriangle}>
                      {result.verdict === 'clone' ? 'match' : 'candidate'}
                    </Badge>
                  </div>
                  <MockSitePreview
                    url={result.suspect.url}
                    brand={result.brand}
                    palette={result.verdict === 'clone' ? 'crimson' : 'slate'}
                    variant={result.suspect.render}
                    label="Suspect render"
                  />
                  <p className="mt-2 text-[10.5px] text-ink-3">{result.suspect.title} · unverified origin</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                <FiInfo className="shrink-0 text-brand" aria-hidden="true" />
                <p className="text-[10.5px] leading-4 text-ink-3">
                  Previews are abstract wireframes built in the browser — no third-party logos or live screenshots are used.
                </p>
              </div>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <SectionCard title="Similarity breakdown" description="Per-aspect comparison scores" icon={FiTarget}>
                <div className="space-y-3.5">
                  {result.similarity.map((aspect) => (
                    <Gauge
                      key={aspect.aspect}
                      label={aspect.aspect}
                      value={aspect.value}
                      tone={aspect.value > 80 ? 'critical' : aspect.value > 55 ? 'medium' : 'safe'}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Region matches" description="Where the layouts converge" icon={FiEye}>
                <ul className="space-y-2.5">
                  {result.regions.map((region) => (
                    <li key={region.label} className="rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-medium text-ink">{region.label}</span>
                        <span className={cn('font-mono text-[10.5px] tabular', region.match > 80 ? 'text-critical' : region.match > 55 ? 'text-medium' : 'text-safe')}>
                          {region.match}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-4 text-ink-3">{region.note}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>

            <SectionCard title="Findings" description="Impersonation indicators" icon={FiAlertTriangle}>
              <ul className="space-y-2.5">
                {result.findings.map((finding) => (
                  <li key={finding.title} className="flex items-start gap-3 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                    <SeverityBadge severity={finding.severity} size="sm" />
                    <div>
                      <p className="text-[12px] font-medium text-ink">{finding.title}</p>
                      <p className="mt-0.5 text-[11px] leading-5 text-ink-3">{finding.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>

            {!result.live ? (
              <Notice tone="neutral" icon={FiCpu}>
              Visual comparison is simulated. A production implementation would render both pages headlessly and compare
              perceptual hashes, DOM structure and computed styles.
            </Notice>
            ) : null}
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
