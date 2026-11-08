import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRight, FiChevronDown, FiChevronRight, FiClock, FiLogOut, FiMenu, FiMoon, FiShield,
  FiSun, FiUser, FiX, FiLayout, FiActivity,
} from 'react-icons/fi';
import { DETECTION_FEATURES, PRIMARY_NAV } from '../../data/features';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from './Logo';
import FeatureIcon from '../ui/FeatureIcon';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

function isActive(pathname, to) {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavItem({ to, children, className }) {
  const { pathname } = useLocation();
  return (
    <NavLink to={to} className={cn('nav-link', className)} data-active={isActive(pathname, to)}>
      {children}
    </NavLink>
  );
}

function AdvancedMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  const { pathname } = useLocation();
  const active = pathname.startsWith('/advanced');

  const schedule = (value) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(value), value ? 90 : 160);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      className="relative"
      onMouseEnter={() => schedule(true)}
      onMouseLeave={() => schedule(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="nav-link"
        data-active={active}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Advanced Detection
        <FiChevronDown className={cn('text-[12px] transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="cyber-menu fixed left-1/2 top-[66px] z-[75] w-[min(780px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl anim-pop"
          role="menu"
        >
          <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/40 px-5 py-3.5">
            <div>
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-neon">
                <span className="status-dot text-neon" aria-hidden="true" /> Advanced detection
              </p>
              <p className="mt-1 text-[12.5px] text-ink-2">13 specialised modules for deep infrastructure analysis</p>
            </div>
            <Link to="/advanced" onClick={() => setOpen(false)} className="arrow-link inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-ink-2 transition hover:text-neon">
              All modules <FiArrowRight className="arrow-link-icon text-[13px]" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-0.5 p-2 sm:grid-cols-2">
            {DETECTION_FEATURES.map((feature) => (
              <Link
                key={feature.slug}
                to={`/advanced/${feature.slug}`}
                onClick={() => setOpen(false)}
                role="menuitem"
                className={cn(
                  'group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
                  pathname === `/advanced/${feature.slug}` ? 'bg-brand/10' : 'hover:bg-surface-2',
                )}
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2 transition-colors group-hover:border-brand/30 group-hover:bg-brand/10 group-hover:text-brand">
                  <FeatureIcon name={feature.icon} className="text-[14px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{feature.name}</span>
                    <FiChevronRight className="shrink-0 text-[12px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-3">{feature.category}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2/60 text-ink-2 transition hover:border-brand/40 hover:bg-brand/10 hover:text-neon hover:shadow-[0_0_20px_-6px_var(--brand-glow)]',
        className,
      )}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? <FiSun className="text-[16px]" aria-hidden="true" /> : <FiMoon className="text-[16px]" aria-hidden="true" />}
    </button>
  );
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 py-1 pl-1 pr-2 transition hover:border-brand/30"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-brand/15 text-[11px] font-semibold text-brand">{initials}</span>
        <span className="hidden max-w-[90px] truncate text-[12px] font-medium text-ink xl:block">{user.name.split(' ')[0]}</span>
        <FiChevronDown className={cn('text-[12px] text-ink-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <div className="cyber-menu absolute right-0 z-[75] mt-2 w-64 overflow-hidden rounded-xl p-1.5 anim-pop">
          <div className="border-b border-line px-2.5 pb-2.5 pt-1.5">
            <p className="truncate text-[12.5px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[11.5px] text-ink-3">{user.email}</p>
          </div>
          <Link to="/dashboard" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-ink-2 transition hover:bg-surface-2 hover:text-ink">
            <FiLayout className="text-[14px]" aria-hidden="true" /> Workspace dashboard
          </Link>
          <Link to="/report-threat" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-ink-2 transition hover:bg-surface-2 hover:text-ink">
            <FiShield className="text-[14px]" aria-hidden="true" /> Submit a report
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              setOpen(false);
              navigate('/');
              toast.info('Signed out', 'Your demo session has ended.');
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-critical transition hover:bg-critical/10"
          >
            <FiLogOut className="text-[14px]" aria-hidden="true" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAdvanced, setMobileAdvanced] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <header
      className={cn(
        'sticky top-0 z-[70] w-full transition-all duration-300',
        scrolled
          ? 'border-b border-line bg-bg/80 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl'
          : 'border-b border-transparent bg-bg/55 backdrop-blur-md',
      )}
    >
      <span className="accent-rail absolute inset-x-0 top-0 opacity-70" aria-hidden="true" />
      <div className="shell flex h-16 items-center gap-3">
        <Logo />

        <nav className="ml-1 hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">
          <NavItem to="/">{PRIMARY_NAV[0].label}</NavItem>
          <NavItem to="/scan">{PRIMARY_NAV[1].label}</NavItem>
          <NavItem to="/analysis" className="hidden xl:inline-flex">{PRIMARY_NAV[2].label}</NavItem>
          <NavItem to="/ssl-checker" className="hidden xl:inline-flex">{PRIMARY_NAV[3].label}</NavItem>
          <NavItem to="/threat-intelligence">{PRIMARY_NAV[4].label}</NavItem>
          <NavItem to="/report-threat" className="hidden 2xl:inline-flex">{PRIMARY_NAV[5].label}</NavItem>
          <NavItem to="/dashboard" className="hidden xl:inline-flex">{PRIMARY_NAV[6].label}</NavItem>
          <AdvancedMenu />
          <NavItem to="/about" className="hidden 2xl:inline-flex">{PRIMARY_NAV[7].label}</NavItem>

          {/* Condensed groups for narrower desktop widths */}
          <div className="relative xl:hidden">
            <MoreMenu
              label="More"
              items={[
                { to: '/analysis', label: 'Security Analysis' },
                { to: '/ssl-checker', label: 'SSL Checker' },
                { to: '/report-threat', label: 'Report Threat' },
                { to: '/dashboard', label: 'Dashboard' },
                { to: '/about', label: 'About' },
              ]}
            />
          </div>
          <div className="relative hidden xl:block 2xl:hidden">
            <MoreMenu
              label="More"
              items={[
                { to: '/report-threat', label: 'Report Threat' },
                { to: '/about', label: 'About' },
              ]}
            />
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded border border-line bg-surface-2/40 px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3 2xl:inline-flex">
            <span className="status-dot text-safe" aria-hidden="true" /> Session secure
          </span>
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} logout={logout} />
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-lg px-3 py-2 text-[12.5px] font-medium text-ink-2 transition hover:bg-surface-2 hover:text-neon sm:inline-flex"
              >
                Login
              </Link>
              <Button to="/signup" size="sm" className="hidden sm:inline-flex">
                Sign Up
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2/60 text-ink-2 transition hover:border-brand/40 hover:text-neon lg:hidden"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
          >
            <FiMenu className="text-[17px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div className={cn('lg:hidden', mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div
          className={cn('fixed inset-0 z-[85] bg-overlay transition-opacity duration-300', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={closeMobile}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cn(
            'fixed right-0 top-0 z-[86] flex h-full w-[min(92vw,400px)] flex-col border-l border-line bg-surface/95 backdrop-blur-2xl transition-transform duration-300 ease-out',
            mobileOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <span className="accent-rail absolute inset-x-0 top-0 opacity-70" aria-hidden="true" />
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
            <Logo />
            <button
              type="button"
              onClick={closeMobile}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-2 transition hover:text-ink"
              aria-label="Close navigation menu"
            >
              <FiX className="text-[17px]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
            <nav aria-label="Mobile navigation" className="space-y-0.5">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition',
                    isActive(pathname, item.to)
                      ? 'bg-brand/10 text-brand shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--neon)_18%,transparent)]'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {item.label}
                  <FiChevronRight className="text-[13px] opacity-50" aria-hidden="true" />
                </Link>
              ))}
            </nav>

            <div className="mt-4 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setMobileAdvanced((value) => !value)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
                aria-expanded={mobileAdvanced}
              >
                <span className="flex items-center gap-2">
                  Advanced Detection
                  <Badge tone="brand" size="sm">13</Badge>
                </span>
                <FiChevronDown className={cn('text-[14px] transition-transform', mobileAdvanced && 'rotate-180')} aria-hidden="true" />
              </button>
              {mobileAdvanced ? (
                <div className="mt-1 space-y-0.5 pl-1 anim-fade">
                  {DETECTION_FEATURES.map((feature) => (
                    <Link
                      key={feature.slug}
                      to={`/advanced/${feature.slug}`}
                      onClick={closeMobile}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-ink-2 transition hover:bg-surface-2 hover:text-ink"
                    >
                      <FeatureIcon name={feature.icon} className="text-[13px] text-ink-3" />
                      <span className="min-w-0 flex-1 truncate">{feature.name}</span>
                    </Link>
                  ))}
                  <Link
                    to="/advanced"
                    onClick={closeMobile}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium text-brand transition hover:bg-brand/10"
                  >
                    View all modules <FiArrowRight className="text-[12px]" aria-hidden="true" />
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12px] font-medium text-ink">
                  <FiClock className="text-[13px] text-ink-3" aria-hidden="true" /> Appearance
                </span>
                <ThemeToggle className="h-8 w-8" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12px] text-ink-2">
                  <FiActivity className="text-[13px] text-safe" aria-hidden="true" /> Demo environment
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">simulated</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-line p-4">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 text-[12px] font-semibold text-brand">
                    {user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-ink">{user.name}</p>
                    <p className="truncate text-[11px] text-ink-3">{user.email}</p>
                  </div>
                </div>
                <Button to="/dashboard" full size="sm" onClick={closeMobile} icon={FiLayout}>
                  Open dashboard
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button to="/login" variant="secondary" size="sm" onClick={closeMobile} icon={FiUser}>
                  Login
                </Button>
                <Button to="/signup" size="sm" onClick={closeMobile}>
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MoreMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = items.some((item) => isActive(pathname, item.to));

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="nav-link"
        data-active={active}
        aria-expanded={open}
      >
        {label}
        <FiChevronDown className={cn('text-[12px] transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <div className="cyber-menu absolute left-0 z-[75] mt-2 w-56 overflow-hidden rounded-xl p-1.5 anim-pop">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                'block rounded-lg px-2.5 py-2 text-[12.5px] transition',
                isActive(pathname, item.to) ? 'bg-brand/10 text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
