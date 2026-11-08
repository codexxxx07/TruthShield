import { FiAlertTriangle, FiCheckCircle, FiCpu, FiDatabase, FiInfo, FiLayers, FiTarget } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../../components/ui/Card';
import { ScoreRing, Meter } from '../../components/ui/Progress';
import Notice from '../../components/ui/Notice';
import CopyButton from '../../components/ui/CopyButton';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['phishing-kits'];

const NODE_TONE = {
  target: 'border-critical/40 bg-critical/10 text-critical',
  kit: 'border-high/35 bg-high/10 text-high',
  host: 'border-line-strong bg-surface text-ink-2',
  infra: 'border-medium/30 bg-medium/10 text-medium',
};

export default function PhishingKits() {
  return (
    <>
      <ToolHeader feature={feature} index={9} />
      <DetectionWorkbench feature={feature} inputKind="url" cta="Fingerprint page" analyze={(target, options) => runDetection(feature.slug, target, options)}>
        {(result) => {
          const nodesById = Object.fromEntries(result.cluster.nodes.map((node) => [node.id, node]));

          return (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className={cn('h-1 w-full', result.confidence ? 'bg-critical' : 'bg-safe')} />
                <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                  <ScoreRing
                    value={result.score}
                    tone={result.confidence ? 'critical' : 'safe'}
                    className="mx-auto h-[104px] w-[104px]"
                    stroke={8}
                    valueClassName="text-[24px]"
                    caption="match"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={result.confidence ? 'critical' : 'safe'} dot>
                        {result.confidence ? `${result.confidence}% kit confidence` : 'No kit match'}
                      </Badge>
                      <Badge tone="neutral">Family: {result.family}</Badge>
                      <CopyButton value={result.fingerprint} label="Copy fingerprint" compact />
                    </div>
                    <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                    <p className="mt-2 break-all font-mono text-[10.5px] text-ink-3">{result.target}</p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
                <SectionCard title="Kit family matches" description="Structural similarity to known kits" icon={FiTarget}>
                  <ul className="space-y-2.5">
                    {result.matches.map((match) => (
                      <li key={match.kit} className="rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11.5px] font-medium text-ink">{match.kit}</p>
                            <p className="text-[10px] text-ink-3">{match.family} · first seen {match.firstSeen} · {match.campaigns} campaigns</p>
                          </div>
                          <span className={cn('font-mono text-[11px] tabular', match.similarity > 70 ? 'text-critical' : 'text-ink-3')}>{match.similarity}%</span>
                        </div>
                        <Meter value={match.similarity} tone={match.similarity > 70 ? 'critical' : match.similarity > 40 ? 'medium' : 'low'} className="mt-2" />
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                <SectionCard title="Threat relationship graph" description="Target, kit family and related hosts" icon={FiLayers}>
                  <div className="relative h-[268px] overflow-hidden rounded-xl border border-line bg-surface-2/40 dot-grid">
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      {result.cluster.edges.map(([from, to]) => {
                        const a = nodesById[from];
                        const b = nodesById[to];
                        if (!a || !b) return null;
                        return (
                          <line
                            key={`${from}-${to}`}
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            stroke="var(--line-strong)"
                            strokeWidth="0.6"
                            strokeDasharray="2 2"
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })}
                    </svg>
                    {result.cluster.nodes.map((node) => (
                      <div
                        key={node.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      >
                        <div className={cn('flex max-w-[140px] flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-center shadow-[var(--shadow-xs)]', NODE_TONE[node.type])}>
                          <span className="text-[9px] uppercase tracking-[0.08em] opacity-70">{node.type}</span>
                          <span className="max-w-full truncate font-mono text-[9px] text-ink">{node.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-ink-3">
                    <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
                    Edges are inferred from shared assets and kit fingerprints, not network connections.
                  </p>
                </SectionCard>
              </div>

              <SectionCard title="Shared assets" description="Static files reused across tracked hosts" icon={FiDatabase} flush>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[11.5px]">
                    <thead className="bg-surface-2/70 text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Asset</th>
                        <th className="px-4 py-2.5 font-semibold">Hash</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Hosts</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.sharedAssets.map((asset) => (
                        <tr key={asset.asset} className="border-t border-line/70">
                          <td className="px-4 py-2.5 font-mono text-[10.5px] text-ink">{asset.asset}</td>
                          <td className="px-4 py-2.5 font-mono text-[10px] text-ink-3">{asset.hash}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-ink-2">{asset.seenOn}</td>
                          <td className="px-4 py-2.5 text-right"><SeverityBadge severity={asset.severity} size="sm" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <div className="grid gap-4 md:grid-cols-2">
                <SectionCard title="Fingerprint detail" description="Values used for matching" icon={FiTarget}>
                  <DataRow label="Page fingerprint" value={result.fingerprint} mono />
                  <DataRow label="Kit family" value={result.family} />
                  <DataRow label="Confidence" value={`${result.confidence}%`} />
                  <DataRow label="Related hosts" value={result.matches.reduce((sum, match) => sum + match.campaigns, 0)} />
                  <DataRow label="Target" value={result.target} mono />
                </SectionCard>
                <Notice tone={result.confidence ? 'warning' : 'safe'} icon={result.confidence ? FiAlertTriangle : FiCheckCircle}>
                  {result.confidence
                    ? 'This page is structurally consistent with a tracked phishing kit. Treat any credential input as compromised and block the host.'
                    : 'No kit fingerprint matched. Continue to monitor the host if it impersonates a brand.'}
                </Notice>
              </div>

              {!result.live ? (
                <Notice tone="neutral" icon={FiCpu}>
                Kit fingerprinting is simulated. Production matching would hash static assets, form structures and
                obfuscated relay scripts against a maintained corpus.
              </Notice>
              ) : null}
            </div>
          );
        }}
      </DetectionWorkbench>
    </>
  );
}
