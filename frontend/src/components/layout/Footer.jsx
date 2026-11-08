import { Link } from 'react-router-dom';
import { FiArrowUpRight, FiCheckCircle } from 'react-icons/fi';
import { DETECTION_FEATURES } from '../../data/features';
import Logo from './Logo';

const PLATFORM = [
  { to: '/scan', label: 'Scan a URL' },
  { to: '/analysis', label: 'Security analysis' },
  { to: '/ssl-checker', label: 'SSL checker' },
  { to: '/threat-intelligence', label: 'Threat intelligence' },
  { to: '/dashboard', label: 'SOC dashboard' },
];

const COMPANY = [
  { to: '/about', label: 'About TruthShield' },
  { to: '/report-threat', label: 'Report a threat' },
  { to: '/advanced', label: 'Detection modules' },
  { to: '/login', label: 'Sign in' },
  { to: '/signup', label: 'Create account' },
];

const TELEMETRY = [
  { label: 'Sensors', value: '13 / 13' },
  { label: 'Playbooks', value: '42' },
  { label: 'Queue depth', value: '12' },
  { label: 'Demo uptime', value: '99.98%' },
];

export default function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-line bg-surface/25">
      <span className="accent-rail absolute inset-x-0 top-0 opacity-45" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 circuit-grid opacity-30" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-20" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-24 left-1/4 h-48 w-[420px] aurora aurora-brand opacity-30" aria-hidden="true" />
      <div className="shell relative">
        {/* Telemetry strip */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-none border-x border-b border-line bg-line/60 sm:grid-cols-4">
          {TELEMETRY.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 bg-bg-soft/80 px-4 py-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">{item.label}</span>
              <span className="font-mono text-[10.5px] tabular text-ink-2">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-10 py-11 lg:grid-cols-[1.4fr_1fr_1.4fr_1fr] lg:gap-8 lg:py-12">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[12.5px] leading-6 text-ink-2">
              A trust layer for the open web — certificate intelligence, brand protection and behavioural analysis
              combined into one explainable verdict.
            </p>
            <div className="neon-chip mt-4 rounded-[4px] border-safe/30 bg-safe/[0.07] text-safe">
              <span className="status-dot text-safe" aria-hidden="true" />
              All demo systems operational
            </div>
          </div>

          <nav aria-label="Platform">
            <h2 className="hud-label">Platform</h2>
            <ul className="mt-3.5 space-y-2.5">
              {PLATFORM.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="link-quiet text-[12.5px]">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Detection modules">
            <h2 className="hud-label">Detection</h2>
            <ul className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
              {DETECTION_FEATURES.slice(0, 6).map((feature) => (
                <li key={feature.slug}>
                  <Link to={`/advanced/${feature.slug}`} className="link-quiet text-[12.5px]">
                    {feature.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/advanced" className="arrow-link inline-flex items-center gap-1 text-[12.5px] font-medium text-brand transition hover:text-neon">
                  All 13 modules <FiArrowUpRight className="arrow-link-icon text-[11px]" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className="hud-label">Workspace</h2>
            <ul className="mt-3.5 space-y-2.5">
              {COMPANY.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="link-quiet text-[12.5px]">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="cyber-divider" />

        <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-3">
            © 2026 TruthShield Labs · Build 3.0.0 · Node LON-01
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <FiCheckCircle className="text-[10px] text-safe" aria-hidden="true" />
              No live scanning connected
            </span>
            <span className="rounded border border-line bg-surface-2/50 px-1.5 py-[1px]">Unclassified // demo data</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
