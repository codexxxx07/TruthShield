import { Link } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiShield, FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';
import Logo from './Logo';
import Badge from '../ui/Badge';
import { Meter } from '../ui/Progress';

export default function AuthLayout({ children, title, description, footer, eyebrow }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface/50 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="pointer-events-none absolute inset-0 grid-lines" aria-hidden="true" />
        <div className="aurora aurora-brand -left-20 top-[18%] h-64 w-[380px]" aria-hidden="true" />
        <div className="aurora aurora-safe -bottom-16 right-0 h-52 w-[300px] opacity-40" aria-hidden="true" />

        <div className="relative">
          <Logo />
        </div>

        <div className="relative max-w-md">
          <Badge tone="brand" size="sm" icon={FiShield}>Trust workspace</Badge>
          <h2 className="mt-4 text-[30px] font-semibold leading-[1.14] tracking-[-0.035em] text-ink">
            Every click deserves a second opinion.
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-ink-2">
            Scan links, investigate certificates, track brand clones and keep a full evidence trail — all in one
            workspace built for analysts.
          </p>

          <ul className="mt-6 space-y-2.5">
            {[
              '13 detection modules in a single workspace',
              'Explainable risk scores with evidence',
              'Report queue with community confirmation',
              'Export-ready findings for incident tickets',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-safe/15 text-safe">
                  <FiCheck className="text-[10px]" aria-hidden="true" />
                </span>
                <span className="text-[12px] leading-5 text-ink-2">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-ink-3">Sample verdict</span>
              <Badge tone="critical" size="sm" dot>malicious</Badge>
            </div>
            <p className="mt-2 font-mono text-[11px] text-ink">paypal-secure-login.example</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-baseline justify-between text-[10.5px]">
                <span className="text-ink-3">Risk score</span>
                <span className="font-mono text-critical">94 / 100</span>
              </div>
              <Meter value={94} tone="critical" />
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-line pt-4 text-[10.5px] text-ink-3">
          <span>Frontend demo — no real authentication</span>
          <span className="font-mono">build 2.4.0</span>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex h-16 items-center justify-between px-5 sm:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3 transition hover:text-ink"
          >
            <FiArrowLeft className="text-[12px]" aria-hidden="true" /> Back to site
          </Link>
          <div className="flex items-center gap-2">
            <span className="lg:hidden">
              <Logo />
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink-2 transition hover:border-brand/30 hover:text-ink"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <FiSun className="text-[15px]" aria-hidden="true" /> : <FiMoon className="text-[15px]" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-[400px]">
            {eyebrow ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand">
                {eyebrow}
              </span>
            ) : null}
            <h1 className="mt-3 text-[27px] font-semibold leading-tight tracking-[-0.035em] text-ink">{title}</h1>
            <p className="mt-1.5 text-[12.5px] leading-6 text-ink-2">{description}</p>
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-5 text-center text-[12px] text-ink-2">{footer}</div> : null}
          </div>
        </div>

        <p className="px-5 pb-5 text-center text-[10.5px] leading-4 text-ink-3 sm:px-8">
          Demo build — credentials are not transmitted and no account is created.
        </p>
      </main>
    </div>
  );
}
