import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

const VARIANTS = {
  primary: 'btn-primary',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-surface-2 hover:border-brand/40 hover:text-neon',
  outline:
    'bg-transparent text-ink border border-line-strong hover:bg-brand/[0.06] hover:border-brand/45 hover:text-neon',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-2 hover:text-neon',
  subtle: 'bg-surface-3 text-ink border border-transparent hover:bg-line/70',
  brandSoft: 'bg-brand/10 text-brand border border-brand/20 hover:bg-brand/15 hover:border-brand/40',
  danger: 'bg-critical/10 text-critical border border-critical/25 hover:bg-critical/15',
  inverted: 'bg-ink text-bg border border-transparent hover:bg-ink/90',
};

const SIZES = {
  xs: 'h-8 px-2.5 text-[12px] gap-1.5 rounded-lg',
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[13.5px] gap-2 rounded-xl',
  lg: 'h-12 px-5 text-sm gap-2 rounded-xl',
};

const ICON_SIZE = { xs: 'text-[13px]', sm: 'text-[14px]', md: 'text-[15px]', lg: 'text-base' };

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  to,
  href,
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  full = false,
  className,
  disabled,
  type = 'button',
  ...rest
}) {
  const classes = cn(
    'group/btn inline-flex select-none items-center justify-center font-medium transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    full && 'w-full',
    className,
  );

  const content = (
    <>
      {loading ? (
        <span
          className={cn(
            'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
            size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5',
          )}
          aria-hidden="true"
        />
      ) : Icon ? (
        <Icon className={cn('shrink-0', ICON_SIZE[size])} aria-hidden="true" />
      ) : null}
      <span className="truncate">{children}</span>
      {IconRight ? (
        <IconRight
          className={cn('shrink-0 transition-transform duration-200 group-hover/btn:translate-x-0.5', ICON_SIZE[size])}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  if (href && !disabled) {
    return (
      <a href={href} className={classes} target="_blank" rel="noreferrer noopener" {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
}
