import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiArrowUpRight, FiCheck, FiCheckCircle, FiCode, FiCpu, FiDatabase,
  FiEyeOff, FiGlobe, FiLock, FiServer, FiShield, FiSliders, FiTarget, FiTerminal, FiX,
} from 'react-icons/fi';
import PageHeader from '../components/ui/PageHeader';
import SectionHeading from '../components/ui/SectionHeading';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import FeatureIcon from '../components/ui/FeatureIcon';
import { CORE_FEATURES } from '../data/features';

const PROBLEMS = [
  {
    title: 'Trust is inferred from decoration',
    body: 'A green padlock only proves a TLS handshake. It says nothing about who is behind the domain, how old the certificate is, or whether the page was built to steal credentials.',
    metric: '83%',
    caption: 'of phishing sites in our demo set served valid TLS',
  },
  {
    title: 'Clones are cheaper than defences',
    body: 'A copied login screen, a re-used logo and a lookalike domain cost an attacker minutes. Brand teams typically learn about the clone from a customer complaint.',
    metric: '4.1h',
    caption: 'median demo time-to-detection for brand clones',
  },
  {
    title: 'Signals live in separate tools',
    body: 'Certificate logs sit in one console, DNS in another, screenshot diffing in a third. Analysts stitch the story together by hand, which is where context and confidence get lost.',
    metric: '9',
    caption: 'separate sources folded into one verdict',
  },
  {
    title: 'Payment fraud bypasses the browser',
    body: 'UPI links and QR codes move the victim to their banking app. There is no page to inspect, no certificate to validate — only a handle that needs to be screened.',
    metric: '₹1.2Cr',
    caption: 'simulated losses in the demo payment dataset',
  },
];

const PRINCIPLES = [
  {
    icon: FiEyeOff,
    title: 'Collect the minimum',
    body: 'Only the URL under investigation is processed. No page content is stored, and no credentials are ever requested.',
  },
  {
    icon: FiSliders,
    title: 'Show the reasoning',
    body: 'Every score decomposes into weighted factors. An analyst can disagree with a signal and see exactly what it contributed.',
  },
  {
    icon: FiDatabase,
    title: 'Evidence, not verdicts',
    body: 'Findings carry timestamps, sources and confidence so they can be attached to an incident ticket or a takedown request.',
  },
  {
    icon: FiLock,
    title: 'Server-side by design',
    body: 'Checks belong behind our API so keys and scanning logic never reach a browser. The UI only renders results.',
  },
];

const STACK = [
  { name: 'React 19', detail: 'Function components, hooks, context for theme, auth and notifications' },
  { name: 'Vite 7', detail: 'Development server and production build pipeline' },
  { name: 'Tailwind CSS v4', detail: 'Installed via the Vite plugin — no CDN, no runtime JIT' },
  { name: 'React Router 7', detail: 'Nested layouts, 13 module routes, scroll restoration' },
  { name: 'Custom SVG charts', detail: 'Hand-built visualisations — no charting dependency' },
  { name: 'Deterministic mock layer', detail: 'Seeded generators so every scan is reproducible and swappable for an API' },
];

const ROADMAP = [
  {
    phase: 'Now',
    status: 'Shipped',
    title: 'Complete frontend workspace',
    body: 'Every route, detection module and report flow implemented with simulated data and full keyboard and mobile support.',
    items: ['13 detection modules', 'Report queue', 'Light & dark themes'],
  },
  {
    phase: 'Next',
    status: 'Planned',
    title: 'Live scanning API',
    body: 'Replace the mock engine with server-side collectors for DNS, TLS, headers and rendering, keeping the same result contracts.',
    items: ['REST + streaming scan API', 'Server-side scanning', 'Signed result receipts'],
  },
  {
    phase: 'Later',
    status: 'Exploring',
    title: 'Team intelligence graph',
    body: 'Shared campaign clustering across customers, with role-based access and takedown workflow automation.',
    items: ['Campaign graph', 'RBAC & audit log', 'Takedown automation'],
  },
];

export default function About() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'About' }]}
        eyebrow="About TruthShield"
        title="A padlock is not proof of trust."
        description="TruthShield is a website trust platform: it combines certificate intelligence, brand-integrity matching, behavioural analysis and payment screening into one explainable risk verdict."
        actions={
          <>
            <Button to="/advanced" size="md" iconRight={FiArrowRight}>Explore the modules</Button>
            <Button to="/scan" variant="secondary" size="md">Try a scan</Button>
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiShield className="text-[12px]" aria-hidden="true" /> Built as a frontend product demonstration</span>
            <span className="inline-flex items-center gap-1.5"><FiCpu className="text-[12px]" aria-hidden="true" /> Deterministic simulated results</span>
            <span className="inline-flex items-center gap-1.5"><FiServer className="text-[12px]" aria-hidden="true" /> API-ready architecture</span>
          </>
        }
      />

      {/* Mission */}
      <section className="shell py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
              <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" /> Our mission
            </span>
            <h2 className="mt-4 max-w-xl text-[27px] font-semibold leading-[1.18] tracking-[-0.035em] text-ink sm:text-[34px]">
              Make trust in a website something you can verify — not something you assume.
            </h2>
            <div className="mt-5 max-w-xl space-y-4 text-[13.5px] leading-7 text-ink-2">
              <p>
                Most people judge a site in under three seconds: does it look familiar, and is there a lock in the
                address bar? Both signals are trivially copied. The result is a web where the visual language of
                security has outrun the substance of it.
              </p>
              <p>
                We built TruthShield around a different question — not “does this site look safe?” but “what can we
                prove about it?”. Each module answers one narrow question with evidence, and the platform folds those
                answers into a single score an analyst can defend.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Digital trust', 'Threat intelligence', 'Brand protection', 'Certificate validation', 'Payment safety'].map((tag) => (
                <Badge key={tag} tone="neutral" size="sm">{tag}</Badge>
              ))}
            </div>
          </div>

          <figure className="top-sheen relative overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-md)]">
            <div className="pointer-events-none absolute inset-0 grid-lines opacity-50" aria-hidden="true" />
            <div className="relative rounded-xl border border-line bg-bg/60 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
                    <FiTerminal className="text-[13px]" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11.5px] font-semibold text-ink">Evidence ledger</p>
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-3">demo · 6 signals</p>
                  </div>
                </div>
                <Badge tone="safe" size="sm" dot>verified</Badge>
              </div>

              <dl className="mt-4 space-y-2">
                {[
                  { label: 'TLS chain', value: 'trusted · 2 intermediates', ok: true },
                  { label: 'Certificate age', value: '9 days', warn: true },
                  { label: 'CT log presence', value: '2 precerts found', ok: true },
                  { label: 'Domain age', value: '14 days', warn: true },
                  { label: 'Brand asset match', value: 'no reuse detected', ok: true },
                  { label: 'Redirect hops', value: '1 · same origin', ok: true },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 border-b border-line/70 pb-2 last:border-0 last:pb-0">
                    <dt className="text-[11.5px] text-ink-2">{row.label}</dt>
                    <dd className="flex items-center gap-1.5 font-mono text-[10.5px]">
                      <span className={row.warn ? 'text-medium' : 'text-safe'}>
                        {row.warn ? <FiX aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
                      </span>
                      <span className="text-ink-2">{row.value}</span>
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-medium/25 bg-medium/[0.07] px-3 py-2.5">
                <div>
                  <p className="text-[11px] font-semibold text-ink">Two weak signals</p>
                  <p className="text-[10.5px] text-ink-3">Young domain + young certificate</p>
                </div>
                <span className="font-mono text-[16px] font-semibold text-medium">42</span>
              </div>
            </div>
            <figcaption className="px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.07em] text-ink-3">
              Illustrative sample · generated locally
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-line bg-surface/40">
        <div className="shell py-14 lg:py-18">
          <SectionHeading
            eyebrow="The problem"
            title="Attackers do not break encryption. They borrow its credibility."
            description="Four gaps explain most of the phishing and brand-abuse cases we modelled. Each one is a place where a familiar security cue fails to carry real evidence."
          />
          <div className="mt-9 divide-y divide-line border-y border-line">
            {PROBLEMS.map((problem, index) => (
              <article key={problem.title} className="grid gap-3 py-6 sm:grid-cols-[48px_minmax(0,1fr)_180px] sm:gap-6 lg:py-7">
                <span className="font-mono text-[11px] font-medium text-ink-3">0{index + 1}</span>
                <div className="max-w-2xl">
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{problem.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-6 text-ink-2">{problem.body}</p>
                </div>
                <div className="sm:text-right">
                  <p className="font-mono text-[20px] font-semibold leading-none tracking-[-0.02em] text-ink">{problem.metric}</p>
                  <p className="mt-1.5 text-[10.5px] leading-4 text-ink-3">{problem.caption}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-[10.5px] text-ink-3">
            Figures above come from the bundled demo dataset and are illustrative, not measured telemetry.
          </p>
        </div>
      </section>

      {/* Capabilities */}
      <section className="shell py-14 lg:py-20">
        <SectionHeading
          eyebrow="Core capabilities"
          title="Six checks, one coherent verdict."
          description="Each capability is a separate module with its own evidence view, so a finding can be inspected without reading a wall of raw output."
          action={<Button to="/advanced" variant="secondary" size="sm" iconRight={FiArrowUpRight}>All 13 modules</Button>}
        />
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map((capability) => (
            <div key={capability.title} className="group bg-surface p-5 transition-colors hover:bg-surface-2/70 lg:p-6">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2 transition-colors group-hover:border-brand/30 group-hover:text-brand">
                <FeatureIcon name={capability.icon} className="text-[16px]" />
              </span>
              <h3 className="mt-3.5 text-[13.5px] font-semibold text-ink">{capability.title}</h3>
              <p className="mt-1.5 text-[12px] leading-5 text-ink-2">{capability.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security-first + honesty */}
      <section className="shell pb-14 lg:pb-20">
        <div className="top-sheen relative overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid lg:grid-cols-[1fr_1fr]">
            <div className="border-b border-line p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-safe/25 bg-safe/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-safe">
                <FiShield className="text-[11px]" aria-hidden="true" /> Security-first approach
              </span>
              <h2 className="mt-4 text-[24px] font-semibold leading-[1.2] tracking-[-0.03em] text-ink sm:text-[28px]">
                A security product should hold itself to the standard it sells.
              </h2>
              <ul className="mt-6 space-y-5">
                {PRINCIPLES.map((principle) => (
                  <li key={principle.title} className="flex gap-3.5">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-brand">
                      <principle.icon className="text-[14px]" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[12.5px] font-semibold text-ink">{principle.title}</p>
                      <p className="mt-1 text-[12px] leading-5 text-ink-2">{principle.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surface-2/40 p-6 sm:p-8 lg:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                <FiCpu className="text-[11px]" aria-hidden="true" /> This build, honestly
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">What the frontend demo does — and does not — do</h3>
              <div className="mt-5 space-y-3">
                {[
                  { ok: true, text: 'Generates deterministic, clearly labelled sample findings for any valid input.' },
                  { ok: true, text: 'Stores theme and demo session in localStorage only.' },
                  { ok: true, text: 'Keeps mock data, UI components and analysis logic in separate folders.' },
                  { ok: false, text: 'Does not resolve DNS, connect to hosts or render live pages.' },
                  { ok: false, text: 'Does not call a threat-intelligence or certificate authority API.' },
                  { ok: false, text: 'Does not send credentials, screenshots or reports anywhere.' },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${item.ok ? 'bg-safe/15 text-safe' : 'bg-critical/12 text-critical'}`}>
                      {item.ok ? <FiCheck className="text-[10px]" aria-hidden="true" /> : <FiX className="text-[10px]" aria-hidden="true" />}
                    </span>
                    <p className="text-[12px] leading-5 text-ink-2">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-line bg-surface p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Integration seam</p>
                <p className="mt-1.5 text-[11.5px] leading-5 text-ink-2">
                  Every view consumes a result object from <code className="code-inline">src/lib</code>. Swapping the mock
                  generator for <code className="code-inline">fetch()</code> is a change in one layer, not a rewrite.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="border-y border-line bg-surface/40">
        <div className="shell py-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <div>
              <SectionHeading
                eyebrow="Technology"
                title="A deliberately small stack."
                description="No UI framework, no charting library, no component kit. The interface is plain React and Tailwind so every interaction is owned and inspectable."
              />
              <dl className="mt-7 divide-y divide-line border-y border-line">
                {STACK.map((item) => (
                  <div key={item.name} className="grid gap-1 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
                    <dt className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                      <FiCode className="text-[12px] text-ink-3" aria-hidden="true" /> {item.name}
                    </dt>
                    <dd className="text-[12px] leading-5 text-ink-2">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="terminal overflow-hidden p-0 shadow-[var(--shadow-md)]">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#7f93b3]">project structure</span>
                <span className="flex gap-1.5" aria-hidden="true">
                  <i className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                  <i className="h-2 w-2 rounded-full bg-[#febc2e]" />
                  <i className="h-2 w-2 rounded-full bg-[#28c840]" />
                </span>
              </div>
              <pre className="overflow-x-auto px-4 py-4 text-[11.5px] leading-[1.9] text-[#a9bcd8]">
{`src/
├─ components/
│  ├─ layout/     navbar · footer · auth shell
│  ├─ ui/         26 primitives (cards, tables…)
│  └─ detection/  shared workbench + tool header
├─ pages/
│  └─ advanced/   13 detection modules
├─ data/          feature catalogue · threats
├─ lib/           mockEngine · detectionEngine
│                 validation · formatters
├─ context/       theme · auth · notifications
└─ styles/        tokens · animations · layers`}
              </pre>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 px-4 py-2.5 font-mono text-[10px] text-[#6d81a1]">
                <span className="text-[#35ddb0]">● 0 console errors</span>
                <span>19 routes</span>
                <span>~0 runtime deps beyond React</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="shell py-14 lg:py-20">
        <SectionHeading
          eyebrow="Platform vision"
          title="From a scanner to a shared trust layer."
          description="The interface is finished; the intelligence behind it is the next chapter. Here is how the product is meant to grow."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {ROADMAP.map((stage, index) => (
            <article key={stage.phase} className="card-lift top-sheen relative flex flex-col rounded-xl border border-line bg-surface p-5 lg:p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand">{stage.phase}</span>
                <Badge tone={index === 0 ? 'safe' : index === 1 ? 'brand' : 'neutral'} size="sm" dot>{stage.status}</Badge>
              </div>
              <h3 className="mt-3 text-[14px] font-semibold leading-snug text-ink">{stage.title}</h3>
              <p className="mt-1.5 flex-1 text-[12px] leading-5 text-ink-2">{stage.body}</p>
              <ul className="mt-4 space-y-1.5 border-t border-line pt-3.5">
                {stage.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[11.5px] text-ink-2">
                    <FiCheckCircle className="text-[11px] text-ink-3" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="shell pb-16 lg:pb-24">
        <div className="hud-corners relative overflow-hidden rounded-2xl border border-line bg-surface-2/60 px-6 py-10 text-center sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute inset-0 dot-grid opacity-50" aria-hidden="true" />
          <div className="aurora aurora-brand left-1/2 top-0 h-40 w-[420px] -translate-x-1/2" aria-hidden="true" />
          <div className="relative mx-auto max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
              <FiGlobe className="text-[11px]" aria-hidden="true" /> Start exploring
            </span>
            <h2 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[30px]">
              See the verdict before you trust the page.
            </h2>
            <p className="mt-2.5 text-[13px] leading-6 text-ink-2">
              Run a sample scan, open the evidence behind a score, or browse all thirteen detection modules.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Button to="/scan" size="md" iconRight={FiArrowRight}>Scan a URL</Button>
              <Button to="/dashboard" variant="secondary" size="md" icon={FiTarget}>Open dashboard</Button>
            </div>
            <p className="mt-4 text-[10.5px] text-ink-3">
              Or read <Link to="/advanced" className="text-brand hover:underline">how each module works</Link>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
