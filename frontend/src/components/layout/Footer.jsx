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
    <footer className="relative mt-auto overflow-hidden border-t border-line bg-surface/40">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" aria-hidden="true" />
      <div className="shell relative">
        <div className="grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr_1.4fr_1fr] lg:gap-8 lg:py-14">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[12.5px] leading-6 text-ink-2">
              A trust layer for the open web — combining certificate intelligence, brand protection and
              behavioural analysis into one explainable verdict.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-safe/25 bg-safe/[0.07] px-2.5 py-1 text-[11px] font-medium text-safe">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-safe opacity-70 anim-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-safe" />
              </span>
              All demo systems operational
            </div>
          </div>

          <nav aria-label="Platform">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">Platform</h2>
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
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">Detection</h2>
            <ul className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
              {DETECTION_FEATURES.slice(0, 6).map((feature) => (
                <li key={feature.slug}>
                  <Link to={`/advanced/${feature.slug}`} className="link-quiet text-[12.5px]">
                    {feature.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/advanced" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand">
                  All 13 modules <FiArrowUpRight className="text-[11px]" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">Workspace</h2>
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

        <div className="hairline" />

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
