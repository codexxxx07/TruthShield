import { Link } from 'react-router-dom';
import { FiArrowUpRight, FiCheckCircle } from 'react-icons/fi';
import { DETECTION_FEATURES } from '../../data/features';
import Logo from './Logo';

const PLATFORM = [
  { to: '/scan', label: 'Scan a URL' },
  { to: '/analysis', label: 'Security analysis' },
  { to: '/ssl-checker', label: 'SSL checker' },
  { to: '/threat-intelligence', label: 'Threat intelligence' },
  { to: '/dashboard', label: 'Workspace dashboard' },
];

const COMPANY = [
  { to: '/about', label: 'About TruthShield' },
  { to: '/report-threat', label: 'Report a threat' },
  { to: '/advanced', label: 'Detection modules' },
  { to: '/login', label: 'Sign in' },
  { to: '/signup', label: 'Create account' },
];

export default function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-line bg-surface/30">
      <span className="accent-rail absolute inset-x-0 top-0 opacity-60" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 circuit-grid opacity-40" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-24 left-1/4 h-48 w-[420px] aurora aurora-brand opacity-40" aria-hidden="true" />
      <div className="shell relative">
        <div className="grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr_1.4fr_1fr] lg:gap-8 lg:py-14">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[12.5px] leading-6 text-ink-2">
              A trust layer for the open web — combining certificate intelligence, brand protection and
              behavioural analysis into one explainable verdict.
            </p>
            <div className="neon-chip mt-4 border-safe/30 bg-safe/[0.08] text-safe shadow-[inset_0_0_16px_-8px_rgba(0,255,163,0.5)]">
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
          <p className="text-[11.5px] text-ink-3">
            © 2026 TruthShield Labs · Built as a frontend product demonstration.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <FiCheckCircle className="text-[11px] text-safe" aria-hidden="true" />
              No live scanning service connected
            </span>
            <span className="font-mono uppercase tracking-[0.08em]">build 2.4.0 · demo</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
