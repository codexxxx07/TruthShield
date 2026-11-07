/**
 * Abstract brand mark used inside simulated site previews.
 * (Deliberately generic — no real third-party logo is reproduced.)
 */
export default function BrandMark({ className = 'h-4 w-4', shape = 'shield' }) {
  if (shape === 'orbit') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="18.5" cy="6.5" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (shape === 'blocks') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="4" />
        <rect x="3" y="13" width="8" height="8" rx="4" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 2.6 20 5.4v6.1c0 4.6-3.2 8.5-8 9.9-4.8-1.4-8-5.3-8-9.9V5.4L12 2.6Z" fill="currentColor" opacity="0.16" />
      <path d="M12 2.6 20 5.4v6.1c0 4.6-3.2 8.5-8 9.9-4.8-1.4-8-5.3-8-9.9V5.4L12 2.6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m8.8 11.9 2.3 2.3 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
