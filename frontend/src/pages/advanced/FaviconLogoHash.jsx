import { FiAlertTriangle, FiCheckCircle, FiCpu, FiHash, FiImage, FiInfo, FiShield } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../../components/ui/Card';
import { Meter } from '../../components/ui/Progress';
import Notice from '../../components/ui/Notice';
import CopyButton from '../../components/ui/CopyButton';
import BrandMark from '../../components/ui/BrandMark';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn, formatNumber } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['favicon-logo-hash'];

export default function FaviconLogoHash() {
  return (
    <>
      <ToolHeader feature={feature} index={10} />
      <DetectionWorkbench feature={feature} inputKind="url" cta="Hash favicon" analyze={(target) => runDetection(feature.slug, target)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.score > 60 ? 'bg-critical' : 'bg-safe')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="mx-auto flex flex-col items-center gap-2">
                  <div className="grid h-[96px] w-[96px] place-items-center rounded-2xl border border-line bg-surface-2 text-brand">
                    <BrandMark className="h-11 w-11" shape={result.score > 60 ? 'blocks' : 'shield'} />
                  </div>
                  <div className="flex gap-1">
                    {result.favicon.colors.map((color) => (
                      <span key={color} className="h-3 w-3 rounded-full border border-line" style={{ background: color }} aria-hidden="true" />
                    ))}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.score > 60 ? 'critical' : 'safe'} dot>
                      {result.score > 60 ? 'Brand asset match' : 'No asset match'}
                    </Badge>
                    <Badge tone="neutral">{result.favicon.format} · {formatNumber(result.favicon.bytes)} bytes</Badge>
                  </div>
                  <p className="mt-2 break-all font-mono text-[11px] text-ink">{result.favicon.url}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] text-ink-3">mmh3</span>
                    <code className="break-all font-mono text-[10.5px] text-ink-2">{result.favicon.hash}</code>
                    <CopyButton value={result.favicon.hash} label="Copy" compact />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      { label: 'Perceptual hash', value: result.favicon.perceptual },
                      { label: 'Asset match', value: result.score > 60 ? '97%' : '< 6%' },
                      { label: 'Ownership', value: result.ownership.aligned ? 'Aligned' : 'Mismatch' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
                        <p className="text-[9px] uppercase tracking-[0.06em] text-ink-3">{item.label}</p>
                        <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <SectionCard title="Brand asset matches" description="Favicon and logo similarity by brand" icon={FiImage} flush>
                <ul className="divide-y divide-line/70">
                  {result.matches.map((match) => (
                    <li key={match.brand} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('grid h-8 w-8 place-items-center rounded-lg border', match.similarity > 70 ? 'border-critical/30 bg-critical/10 text-critical' : 'border-line bg-surface-2 text-ink-3')}>
                            <BrandMark className="h-4 w-4" shape={match.brand.includes('Acme') ? 'shield' : 'blocks'} />
                          </span>
                          <div>
                            <p className="text-[11.5px] font-medium text-ink">{match.brand}</p>
                            <p className="font-mono text-[9.5px] text-ink-3">{match.domain}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={match.similarity > 70 ? 'critical' : match.similarity > 40 ? 'medium' : 'neutral'} size="sm">{match.verdict}</Badge>
                          <span className={cn('font-mono text-[11px] tabular', match.similarity > 70 ? 'text-critical' : 'text-ink-3')}>{match.similarity}%</span>
                        </div>
                      </div>
                      <Meter value={match.similarity} tone={match.similarity > 70 ? 'critical' : match.similarity > 40 ? 'medium' : 'low'} className="mt-2" />
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Ownership check" description="Does the brand owner control this domain?" icon={FiShield}>
                <DataRow label="Domain registrant" value={result.ownership.registrant} />
                <DataRow label="Brand owner" value={result.ownership.brandOwner} />
                <DataRow label="Certificate organisation" value={result.ownership.certificateOrg} />
                <div className={cn('mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5', result.ownership.aligned ? 'border-safe/25 bg-safe/[0.05]' : 'border-critical/25 bg-critical/[0.05]')}>
                  {result.ownership.aligned ? <FiCheckCircle className="mt-0.5 shrink-0 text-safe" aria-hidden="true" /> : <FiAlertTriangle className="mt-0.5 shrink-0 text-critical" aria-hidden="true" />}
                  <p className="text-[11px] leading-5 text-ink-2">
                    {result.ownership.aligned
                      ? 'Registrant, brand owner and certificate organisation agree. Asset reuse is authorised.'
                      : 'The logo belongs to a brand that does not control the registrant or certificate organisation. This is a strong impersonation signal.'}
                  </p>
                </div>
                <div className="mt-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                  <p className="flex items-start gap-1.5 text-[10px] leading-4 text-ink-3">
                    <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
                    Even a low similarity score is risky when ownership does not align with the displayed brand.
                  </p>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Findings" description="Hashing observations" icon={FiHash}>
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

            <Notice tone="neutral" icon={FiCpu}>
              Favicon extraction and perceptual hashing are simulated. No image was downloaded from the target.
            </Notice>
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
