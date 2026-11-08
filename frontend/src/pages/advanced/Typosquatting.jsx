import { FiAlertTriangle, FiArrowRight, FiCheckCircle, FiCpu, FiGlobe, FiInfo, FiType, FiXCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge from '../../components/ui/Badge';
import { Card, SectionCard } from '../../components/ui/Card';
import { ScoreRing, Meter } from '../../components/ui/Progress';
import Notice from '../../components/ui/Notice';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn } from '../../lib/utils';

const feature = FEATURE_BY_SLUG.typosquatting;

export default function Typosquatting() {
  return (
    <>
      <ToolHeader feature={feature} index={5} />
      <DetectionWorkbench feature={feature} inputKind="domain" cta="Find lookalikes" analyze={(target, options) => runDetection(feature.slug, target, options)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.riskScore > 70 ? 'bg-critical' : result.riskScore > 40 ? 'bg-medium' : 'bg-safe')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreRing
                  value={result.riskScore}
                  tone={result.riskScore > 70 ? 'critical' : result.riskScore > 40 ? 'medium' : 'safe'}
                  className="mx-auto h-[104px] w-[104px]"
                  stroke={8}
                  valueClassName="text-[24px]"
                  caption="risk"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.riskScore > 70 ? 'critical' : 'medium'} dot>
                      {result.riskScore > 70 ? 'High impersonation risk' : 'Moderate risk'}
                    </Badge>
                    <Badge tone="neutral">{result.permutations.monitored.toLocaleString()} permutations</Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Generated', value: result.variants.length },
                      { label: 'Registered', value: result.permutations.registered },
                      { label: 'High risk', value: result.permutations.highRisk },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
                        <p className="text-[15px] font-semibold tabular text-ink">{item.value}</p>
                        <p className="text-[9.5px] uppercase tracking-[0.06em] text-ink-3">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <SectionCard title="Generated variants" description="Lookalike domains and their status" icon={FiGlobe} flush>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[11.5px]">
                  <thead className="bg-surface-2/70 text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Domain</th>
                      <th className="px-4 py-2.5 font-semibold">Technique</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Distance</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Age</th>
                      <th className="px-4 py-2.5 font-semibold">Risk</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.variants.map((variant) => (
                      <tr key={variant.domain} className="border-t border-line/70">
                        <td className="px-4 py-3">
                          <p className="font-mono text-[11px] text-ink">{variant.domain}</p>
                          <p className="mt-0.5 text-[9.5px] text-ink-3">{variant.registered ? 'resolves today' : 'unregistered'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={variant.technique.includes('homoglyph') ? 'critical' : 'neutral'} size="sm">{variant.technique}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-2">{variant.distance}</td>
                        <td className="px-4 py-3 text-right font-mono text-ink-3">{variant.ageDays ? `${variant.ageDays}d` : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Meter value={variant.risk} tone={variant.risk > 80 ? 'critical' : variant.risk > 55 ? 'medium' : 'low'} className="w-16" />
                            <span className="font-mono text-[10px] text-ink-3">{variant.risk}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {variant.registered ? (
                            <Link to={`/scan?url=${encodeURIComponent(`https://${variant.domain}`)}`} className="text-[10.5px] font-medium text-brand">Scan</Link>
                          ) : (
                            <span className="text-[10.5px] text-ink-3">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <SectionCard title="Unicode confusables" description="Characters that render like Latin letters" icon={FiType}>
                <ul className="space-y-2">
                  {result.unicode.map((item) => (
                    <li key={item.codepoint} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface font-mono text-[17px] text-ink">
                        {item.char}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10.5px] font-medium text-ink">{item.name}</p>
                        <p className="font-mono text-[10px] text-ink-3">{item.codepoint} · looks like “{item.looksLike}”</p>
                      </div>
                      <Badge tone={item.used ? 'critical' : 'neutral'} size="sm">{item.used ? 'in variant' : 'available'}</Badge>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-medium/25 bg-medium/[0.05] px-3 py-2">
                  <FiInfo className="mt-0.5 shrink-0 text-medium" aria-hidden="true" />
                  <p className="text-[10.5px] leading-4 text-ink-2">
                    Homoglyphs are invisible in a browser address bar. Prefer password managers, which bind credentials to
                    the registrable domain.
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="Domain comparison" description="Legitimate vs. suspicious form" icon={FiAlertTriangle}>
                <div className="space-y-3">
                  <div className="rounded-xl border border-safe/25 bg-safe/[0.05] p-3.5">
                    <div className="flex items-center gap-2">
                      <FiCheckCircle className="text-safe" aria-hidden="true" />
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-safe">Legitimate</p>
                    </div>
                    <p className="mt-1.5 break-all font-mono text-[13px] text-ink">{result.target}</p>
                    <p className="mt-1 text-[10.5px] text-ink-3">ASCII only · registered to the brand · certificate organisation matches</p>
                  </div>
                  <div className="rounded-xl border border-critical/25 bg-critical/[0.05] p-3.5">
                    <div className="flex items-center gap-2">
                      <FiXCircle className="text-critical" aria-hidden="true" />
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-critical">Suspicious variant</p>
                    </div>
                    <p className="mt-1.5 break-all font-mono text-[13px] text-ink">{result.variants[1].domain}</p>
                    <p className="mt-1 text-[10.5px] text-ink-3">Cyrillic characters · privacy-shielded · issued days ago</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.variants.filter((variant) => variant.registered).slice(0, 2).map((variant) => (
                    <Link
                      key={variant.domain}
                      to={`/advanced/certificate-transparency?target=${encodeURIComponent(variant.domain)}`}
                      className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[10.5px] text-ink-2 transition hover:border-brand/30 hover:text-brand"
                    >
                      Monitor CT <FiArrowRight className="text-[10px]" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </SectionCard>
            </div>

            {!result.live ? (
              <Notice tone="neutral" icon={FiCpu}>
              Domain permutation and registration data is simulated. Production checks would use WHOIS/RDAP and DNS
              resolution for each generated variant.
            </Notice>
            ) : null}
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
