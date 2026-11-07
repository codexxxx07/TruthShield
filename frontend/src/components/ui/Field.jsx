import { useId } from 'react';
import { FiAlertCircle, FiChevronDown } from 'react-icons/fi';
import { cn } from '../../lib/utils';

const CONTROL =
  'w-full rounded-xl border bg-surface text-sm text-ink outline-none transition-all duration-200 placeholder:text-ink-3 ' +
  'focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-60';

export function Field({ label, htmlFor, hint, error, required, children, className, action }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label || action ? (
        <div className="flex items-baseline justify-between gap-3">
          {label ? (
            <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink">
              {label}
              {required ? <span className="ml-0.5 text-critical">*</span> : null}
            </label>
          ) : <span />}
          {action}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[12px] text-critical" role="alert">
          <FiAlertCircle className="text-[13px] shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] leading-5 text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ icon: Icon, invalid = false, className, id, ...rest }) {
  return (
    <div className="relative">
      {Icon ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
          <Icon className="text-[15px]" aria-hidden="true" />
        </span>
      ) : null}
      <input
        id={id}
        className={cn(
          CONTROL,
          'h-11 px-3.5',
          Icon && 'pl-10',
          invalid ? 'border-critical/60 focus:border-critical focus:ring-critical/10' : 'border-line-strong',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    </div>
  );
}

export function Textarea({ invalid = false, className, rows = 4, ...rest }) {
  return (
    <textarea
      rows={rows}
      className={cn(CONTROL, 'resize-y px-3.5 py-2.5 leading-6', invalid ? 'border-critical/60 focus:border-critical focus:ring-critical/10' : 'border-line-strong', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({ invalid = false, className, children, ...rest }) {
  return (
    <div className="relative">
      <select
        className={cn(CONTROL, 'h-11 appearance-none pl-3.5 pr-10', invalid ? 'border-critical/60' : 'border-line-strong', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
      <FiChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
    </div>
  );
}

export function Checkbox({ label, description, className, id: providedId, ...rest }) {
  const generated = useId();
  const id = providedId || generated;
  return (
    <label htmlFor={id} className={cn('group flex cursor-pointer items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-surface transition checked:border-brand checked:bg-brand focus-visible:ring-2 focus-visible:ring-brand/40"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-[12px] leading-5 text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', onClear, className, id }) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(CONTROL, 'h-11 border-line-strong pl-10 pr-9', className)}
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 transition hover:bg-surface-3 hover:text-ink"
          aria-label="Clear search"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
