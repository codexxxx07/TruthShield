import { useMemo, useState } from 'react';
import { FiArrowRight, FiArrowUpRight, FiCpu, FiGrid, FiLayers, FiSearch, FiShield, FiZap } from 'react-icons/fi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Badge, { DemoBadge } from '../components/ui/Badge';
import { Card, SectionCard } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Notice from '../components/ui/Notice';
import FeatureIcon from '../components/ui/FeatureIcon';
import { DETECTION_FEATURES, FEATURE_CATEGORIES } from '../data/features';
import { cn } from '../lib/utils';

const TONE_CLASS = {
  low: 'border-low/25 bg-low/10 text-low',
  medium: 'border-medium/25 bg-medium/10 text-medium',
  high: 'border-high/25 bg-high/10 text-high',
  critical: 'border-critical/25 bg-critical/10 text-critical',
};

const CATEGORY_SUMMARY = {
  Certificates: 'Trust anchors, issuance history and anomaly detection across the TLS ecosystem.',
  'Brand Integrity': 'Clones, lookalikes and stolen assets that never touch your own domain.',
  Infrastructure: 'Where the abuse is hosted, who announces the route and what else lives there.',
  'Content & Behaviour': 'What the page actually does once scripts start running.',
  Payments: 'UPI links, QR payloads and payee verification before money moves.',
};

export default function AdvancedDetection() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const features = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return DETECTION_FEATURES.filter((feature) => {
      if (category !== 'All' && feature.category !== category) return false;
      if (!needle) return true;
      return `${feature.name} ${feature.description} ${feature.capabilities.join(' ')} ${feature.category}`.toLowerCase().includes(needle);
    });
  }, [query, category]);

  return (
    <>
      <PageHeader
        eyebrow="Advanced detection"
        title="Thirteen modules. One investigation workspace."
        description="Every module has its own dedicated page, purpose-built result view and sample targets — from CT log monitoring to UPI fraud screening."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Advanced Detection' }]}
        demo
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiGrid className="text-[12px]" aria-hidden="true" /> 13 modules</span>
            <span className="inline-flex items-center gap-1.5"><FiLayers className="text-[12px]" aria-hidden="true" /> 5 categories</span>
            <span className="inline-flex items-center gap-1.5"><FiCpu className="text-[12px]" aria-hidden="true" /> Simulated analysis</span>
          </>
        }
        actions={<Button to="/scan" variant="secondary" size="md" iconRight={FiArrowRight}>Start with a URL scan</Button>}
      />

      <div className="shell py-8 lg:py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: FiSearch, title: 'Choose a module', body: 'Each page focuses on one signal family, so results stay readable and explainable.' },
            { icon: FiZap, title: 'Run it on a target', body: 'Validated input, staged progress and a consistent result envelope across every module.' },
            { icon: FiShield, title: 'Act on evidence', body: 'Findings carry severity, impact and next actions — ready for an incident ticket.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="card flex items-start gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/20 bg-brand/[0.07] text-brand">
                  <Icon className="text-[15px]" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">{item.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {['All', ...FEATURE_CATEGORIES].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition',
                  category === item
                    ? 'border-brand/30 bg-brand/10 text-brand'
                    : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:max-w-xs">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-ink-3" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter modules…"
              aria-label="Filter detection modules"
              className="h-10 w-full rounded-xl border border-line-strong bg-surface pl-9 pr-3 text-[12.5px] text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </div>
        </div>

        {features.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.slug} hover className="group flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className={cn('grid h-10 w-10 place-items-center rounded-xl border', TONE_CLASS[feature.tone] || TONE_CLASS.low)}>
                    <FeatureIcon name={feature.icon} className="text-[17px]" />
                  </span>
                  <Badge tone="neutral" size="sm">{feature.category}</Badge>
                </div>
                <h2 className="mt-4 text-[14px] font-semibold leading-5 text-ink">{feature.name}</h2>
                <p className="mt-1.5 flex-1 text-[12px] leading-5 text-ink-2">{feature.description}</p>

                <ul className="mt-3 space-y-1.5">
                  {feature.capabilities.map((capability) => (
                    <li key={capability} className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
                      <span className="h-1 w-1 rounded-full bg-ink-3" aria-hidden="true" />
                      {capability}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-3">
                    {feature.input === 'upi' ? 'UPI / QR' : feature.input === 'url' ? 'URL target' : 'Domain target'}
                  </span>
                  <Button to={`/advanced/${feature.slug}`} variant="ghost" size="xs" iconRight={FiArrowUpRight}>
                    Explore feature
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={FiSearch}
              title="No modules match"
              description="Try a different keyword, or clear the category filter."
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setCategory('All');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <SectionCard title="Category coverage" description="What each module group answers" icon={FiLayers}>
            <ul className="space-y-3">
              {FEATURE_CATEGORIES.map((item) => {
                const count = DETECTION_FEATURES.filter((feature) => feature.category === item).length;
                return (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface-2 font-mono text-[10px] text-ink-3">
                      {count}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-ink">{item}</p>
                      <p className="mt-0.5 text-[11px] leading-5 text-ink-3">{CATEGORY_SUMMARY[item]}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <div className="space-y-4">
            <Notice tone="info" icon={FiCpu} title="About this workspace">
              Each module runs locally against seeded demo data. Results are deterministic per target, so demos are
              repeatable — and the data contract is ready for a real backend.
            </Notice>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold text-ink">Need a starting point?</p>
                <DemoBadge />
              </div>
              <p className="mt-1.5 text-[11.5px] leading-5 text-ink-2">
                Open the URL scanner for a combined verdict, then drill into any module with the target preserved.
              </p>
              <Button to="/scan" size="sm" className="mt-3" full iconRight={FiArrowRight}>
                Scan a URL
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
