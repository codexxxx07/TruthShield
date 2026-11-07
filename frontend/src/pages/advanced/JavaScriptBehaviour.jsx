import { FiAlertTriangle, FiCheckCircle, FiCode, FiCpu, FiInfo, FiTerminal, FiZap } from 'react-icons/fi';
import ToolHeader from '../../components/detection/ToolHeader';
import DetectionWorkbench from '../../components/detection/DetectionWorkbench';
import Badge, { SeverityBadge } from '../../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../../components/ui/Card';
import { ScoreRing } from '../../components/ui/Progress';
import Notice from '../../components/ui/Notice';
import { FEATURE_BY_SLUG } from '../../data/features';
import { runDetection } from '../../lib/detectionEngine';
import { cn } from '../../lib/utils';

const feature = FEATURE_BY_SLUG['javascript-behaviour'];

export default function JavaScriptBehaviour() {
  return (
    <>
      <ToolHeader feature={feature} index={11} />
      <DetectionWorkbench feature={feature} inputKind="url" cta="Run sandbox" analyze={(target) => runDetection(feature.slug, target)}>
        {(result) => (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn('h-1 w-full', result.score > 60 ? 'bg-critical' : 'bg-safe')} />
              <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreRing
                  value={result.score}
                  tone={result.score > 60 ? 'critical' : 'safe'}
                  className="mx-auto h-[104px] w-[104px]"
                  stroke={8}
                  valueClassName="text-[24px]"
                  caption="risk"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={result.score > 60 ? 'critical' : 'safe'} dot>
                      {result.score > 60 ? 'Hostile behaviour' : 'Expected behaviour'}
                    </Badge>
                    <Badge tone="neutral">sandbox {result.sandbox.runMs} ms</Badge>
                    <Badge tone="brand" icon={FiTerminal}>{result.sandbox.evalCalls} eval calls</Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-2">{result.summary}</p>
                  <p className="mt-1.5 break-all font-mono text-[10.5px] text-ink-3">{result.target}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'API calls', value: result.sandbox.apiCalls },
                      { label: 'Requests', value: result.sandbox.networkRequests },
                      { label: 'eval()', value: result.sandbox.evalCalls },
                      { label: 'Scripts', value: result.scripts.length },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
                        <p className="text-[14px] font-semibold tabular text-ink">{stat.value}</p>
                        <p className="text-[9px] uppercase tracking-[0.06em] text-ink-3">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <SectionCard title="Observed behaviours" description="What the sandbox recorded" icon={FiZap}>
              <ul className="space-y-2.5">
                {result.behaviours.map((behaviour) => (
                  <li key={behaviour.id} className="flex items-start gap-3 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
                    <SeverityBadge severity={behaviour.severity} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-medium text-ink">{behaviour.label}</p>
                      <p className="mt-0.5 text-[10.5px] leading-4 text-ink-3">{behaviour.detail}</p>
                      <p className="mt-1 break-all font-mono text-[9.5px] text-ink-3">{behaviour.evidence}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <SectionCard title="Script inventory" description="Bundles loaded by the page" icon={FiCode} flush>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-[11.5px]">
                    <thead className="bg-surface-2/70 text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Script</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Size</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Obfuscated</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.scripts.map((script) => (
                        <tr key={script.url} className="border-t border-line/70">
                          <td className="max-w-[220px] px-4 py-2.5">
                            <p className="truncate font-mono text-[10px] text-ink">{script.url}</p>
                            <p className="mt-0.5 truncate text-[9px] text-ink-3">{script.apis.join(', ')}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-ink-3">{script.size}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Badge tone={script.obfuscated ? 'critical' : 'neutral'} size="sm">{script.obfuscated ? 'yes' : 'no'}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right"><SeverityBadge severity={script.risk} size="sm" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="Payload excerpt" description="Deobfuscated sample from the sandbox" icon={FiTerminal}>
                <pre className="terminal overflow-x-auto p-3 text-[10.5px] leading-5">
                  <code>{result.snippet}</code>
                </pre>
                <div className="mt-2 flex items-center gap-2">
                  <FiInfo className="text-[11px] text-ink-3" aria-hidden="true" />
                  <p className="text-[10px] text-ink-3">Excerpt is illustrative and truncated for readability.</p>
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Sandbox metadata" description="Execution context" icon={FiCpu}>
                <DataRow label="Run time" value={`${result.sandbox.runMs} ms`} />
                <DataRow label="API calls observed" value={result.sandbox.apiCalls} />
                <DataRow label="Network requests" value={result.sandbox.networkRequests} />
                <DataRow label="eval() invocations" value={result.sandbox.evalCalls} />
                <DataRow label="Target" value={result.target} mono />
              </SectionCard>
              <Notice tone={result.score > 60 ? 'critical' : 'safe'} icon={result.score > 60 ? FiAlertTriangle : FiCheckCircle} title={result.score > 60 ? 'Do not interact with this page' : 'No hostile behaviour observed'}>
                {result.score > 60
                  ? 'Scripts capture keystrokes and exfiltrate form data. Any credentials entered on this page should be treated as compromised immediately.'
                  : 'Scripts perform only expected analytics and interaction tracking. No credential access or off-domain exfiltration was observed.'}
              </Notice>
            </div>

            <Notice tone="neutral" icon={FiCpu}>
              JavaScript execution is simulated. No code from the target was executed in your browser.
            </Notice>
          </div>
        )}
      </DetectionWorkbench>
    </>
  );
}
