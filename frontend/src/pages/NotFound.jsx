import { Link } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiCompass, FiSearch } from 'react-icons/fi';
import Button from '../components/ui/Button';
import Logo from '../components/layout/Logo';
import CyberBackdrop from '../components/layout/CyberBackdrop';

const LINKS = [
  { to: '/', label: 'Home', body: 'Platform overview and live demo scanner' },
  { to: '/scan', label: 'Scan URL', body: 'Full risk report for any address' },
  { to: '/advanced', label: 'Detection modules', body: 'Thirteen specialised checks' },
  { to: '/dashboard', label: 'Dashboard', body: 'Scans, findings and activity' },
];

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg">
      <CyberBackdrop />
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 circuit-grid opacity-30" aria-hidden="true" />
      <div className="aurora aurora-brand left-1/2 top-[-6rem] h-64 w-[520px] -translate-x-1/2" aria-hidden="true" />

      <header className="relative z-10 shell flex h-16 items-center justify-between">
        <Logo />
        <Link to="/" className="text-[11.5px] font-medium text-ink-3 transition hover:text-neon">Return home</Link>
      </header>

      <main className="relative z-10 shell flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-3xl">
          <div className="card hud-corners scanlines relative grid gap-8 overflow-hidden rounded-2xl p-6 shadow-[var(--shadow-lg)] backdrop-blur sm:p-9 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center lg:gap-10">
            <span className="accent-rail absolute inset-x-0 top-0 opacity-60" aria-hidden="true" />
            <div className="mx-auto flex w-full max-w-[190px] flex-col items-center">
              <div className="relative grid aspect-square w-full place-items-center">
                {[100, 76, 52].map((size) => (
                  <span
                    key={size}
                    className="absolute rounded-full border border-line-strong/60"
                    style={{ width: `${size}%`, height: `${size}%` }}
                    aria-hidden="true"
                  />
                ))}
                <span className="radar absolute inset-0 rounded-full opacity-60" aria-hidden="true" />
                <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow-[0_0_16px_var(--brand)]" aria-hidden="true" />
                <span className="relative font-mono text-[38px] font-semibold tracking-[-0.04em] text-ink title-glow">404</span>
              </div>
              <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-3">route not resolved</p>
            </div>

            <div>
              <span className="neon-chip border-medium/30 bg-medium/10 text-medium">
                <FiCompass className="text-[11px]" aria-hidden="true" /> Off the map
              </span>
              <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[30px]">
                This address did not resolve.
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-ink-2">
                The page you asked for does not exist in this build. Nothing is broken — the link is either outdated or
                mistyped.
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button to="/" size="md" icon={FiArrowLeft}>Back to home</Button>
                <Button to="/scan" variant="secondary" size="md" icon={FiSearch}>Scan a URL</Button>
              </div>

              <div className="cyber-divider mt-6" />
              <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">Popular destinations</p>
              <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                {LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="group flex items-start justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-line hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium text-ink">{link.label}</span>
                        <span className="block truncate text-[10.5px] text-ink-3">{link.body}</span>
                      </span>
                      <FiArrowRight className="mt-1 shrink-0 text-[11px] text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
            TruthShield · error 404 · simulated frontend build
          </p>
        </div>
      </main>
    </div>
  );
}
