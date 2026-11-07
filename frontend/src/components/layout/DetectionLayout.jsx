import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiCpu } from 'react-icons/fi';
import { DETECTION_FEATURES, FEATURE_CATEGORIES } from '../../data/features';
import { cn } from '../../lib/utils';
import FeatureIcon from '../ui/FeatureIcon';

export default function DetectionLayout() {
  const { pathname } = useLocation();

  return (
    <div className="shell py-6 lg:py-9">
      <div className="grid gap-7 lg:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[84px]">
            <Link
              to="/advanced"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3 transition hover:text-brand"
            >
              <FiArrowLeft className="text-[12px]" aria-hidden="true" /> All modules
            </Link>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Detection workspace</p>
            <nav className="mt-2 max-h-[calc(100vh-230px)] space-y-4 overflow-y-auto pb-2 pr-1" aria-label="Detection modules">
              {FEATURE_CATEGORIES.map((category) => (
                <div key={category}>
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3/80">{category}</p>
                  <ul className="space-y-0.5">
                    {DETECTION_FEATURES.filter((feature) => feature.category === category).map((feature) => {
                      const active = pathname === `/advanced/${feature.slug}`;
                      return (
                        <li key={feature.slug}>
                          <NavLink
                            to={`/advanced/${feature.slug}`}
                            className={cn(
                              'group flex items-start gap-2.5 rounded-lg border border-transparent px-2 py-2 text-[12px] leading-4 transition-colors',
                              active
                                ? 'border-brand/20 bg-brand/10 font-medium text-brand'
                                : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                            )}
                            aria-current={active ? 'page' : undefined}
                          >
                            <FeatureIcon
                              name={feature.icon}
                              className={cn('mt-0.5 shrink-0 text-[13px]', active ? 'text-brand' : 'text-ink-3 group-hover:text-ink-2')}
                            />
                            <span className="min-w-0">{feature.name}</span>
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                <FiCpu className="text-[11px]" aria-hidden="true" /> Simulated output
              </p>
              <p className="mt-1.5 text-[11px] leading-4 text-ink-3">
                Every result on this page is generated locally for demonstration. No live scanner is connected.
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link to="/advanced" className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3 transition hover:text-brand">
                <FiArrowLeft className="text-[12px]" aria-hidden="true" /> All modules
              </Link>
              <span className="rounded-full border border-line bg-surface-2 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-3">
                simulated
              </span>
            </div>
            <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
              {DETECTION_FEATURES.map((feature) => {
                const active = pathname === `/advanced/${feature.slug}`;
                return (
                  <Link
                    key={feature.slug}
                    to={`/advanced/${feature.slug}`}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition',
                      active
                        ? 'border-brand/25 bg-brand/10 text-brand'
                        : 'border-line bg-surface text-ink-2 hover:border-brand/25 hover:text-ink',
                    )}
                  >
                    <FeatureIcon name={feature.icon} className="text-[12px]" />
                    {feature.short}
                  </Link>
                );
              })}
            </div>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
