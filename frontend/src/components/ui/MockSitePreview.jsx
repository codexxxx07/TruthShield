import { cn } from '../../lib/utils';
import BrandMark from './BrandMark';

const PALETTES = {
  navy: { mark: 'bg-[#0b3d91]', accent: 'bg-[#0b3d91]', soft: 'bg-[#e7eefb]', text: 'text-[#0b3d91]' },
  crimson: { mark: 'bg-[#b3122f]', accent: 'bg-[#b3122f]', soft: 'bg-[#fbe9ec]', text: 'text-[#b3122f]' },
  emerald: { mark: 'bg-[#0a7a5f]', accent: 'bg-[#0a7a5f]', soft: 'bg-[#e6f5f0]', text: 'text-[#0a7a5f]' },
  slate: { mark: 'bg-[#1f2937]', accent: 'bg-[#1f2937]', soft: 'bg-[#eef1f6]', text: 'text-[#1f2937]' },
};

/**
 * A simulated, wireframe-style render of a web page. Used where a real
 * screenshot would sit, without embedding third-party brand assets.
 */
export default function MockSitePreview({
  url = 'https://example.com',
  brand = 'Acme',
  palette = 'navy',
  variant = 'login',
  label,
  shape = 'shield',
  className,
}) {
  const tone = PALETTES[palette] || PALETTES.navy;

  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-surface-2', className)}>
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" aria-hidden="true" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" aria-hidden="true" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" aria-hidden="true" />
        <span className="ml-2 min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-2 py-1 font-mono text-[9.5px] text-ink-3">
          {url}
        </span>
        <span className="hidden shrink-0 items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-ink-3 sm:inline-flex">
          {label || 'Captured render'}
        </span>
      </div>

      <div className="bg-[#eef2f8] p-2.5">
        <div className="overflow-hidden rounded-md bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e8edf5] px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className={cn('grid h-5 w-5 place-items-center rounded-[5px] text-white', tone.mark)}>
                <BrandMark className="h-3 w-3" shape={shape} />
              </span>
              <span className="text-[9px] font-bold tracking-tight text-[#0b1220]">{brand}</span>
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="h-1 w-4 rounded-full bg-[#dbe3ef]" />
              <span className="h-1 w-3 rounded-full bg-[#dbe3ef]" />
              <span className="h-1 w-3.5 rounded-full bg-[#dbe3ef]" />
              <span className="h-1 w-2.5 rounded-full bg-[#dbe3ef]" />
              <span className={cn('ml-1 h-3 w-10 rounded-sm', tone.accent)} />
            </div>
          </div>

          {variant === 'login' ? (
            <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5 py-1">
                <span className={cn('block h-1.5 w-14 rounded-full', tone.soft)} />
                <span className="block h-2 w-[92%] rounded-sm bg-[#c9d5e6]" />
                <span className="block h-2 w-[64%] rounded-sm bg-[#c9d5e6]" />
                <div className="space-y-1 pt-2">
                  <span className="block h-1 w-4/5 rounded-full bg-[#e3e9f2]" />
                  <span className="block h-1 w-[70%] rounded-full bg-[#e3e9f2]" />
                  <span className="block h-1 w-3/4 rounded-full bg-[#e3e9f2]" />
                </div>
                <span className={cn('mt-2 inline-block h-1.5 w-16 rounded-full', tone.soft)} />
              </div>
              <div className="w-full rounded-md border border-[#e3e9f2] bg-[#fbfcfe] p-2.5 sm:w-32">
                <span className="mb-2 block h-1.5 w-12 rounded-full bg-[#c9d5e6]" />
                <div className="space-y-1.5">
                  <span className="block h-4 w-full rounded border border-[#dce4ef] bg-white" />
                  <span className="block h-4 w-full rounded border border-[#dce4ef] bg-white" />
                  <span className={cn('block h-4 w-full rounded', tone.accent)} />
                </div>
                <span className="mx-auto mt-2 block h-1 w-12 rounded-full bg-[#cfd9e8]" />
              </div>
            </div>
          ) : variant === 'shop' ? (
            <div className="p-3">
              <div className="mb-2 flex items-end justify-between">
                <div className="space-y-1">
                  <span className="block h-1.5 w-20 rounded-full bg-[#c9d5e6]" />
                  <span className="block h-1 w-12 rounded-full bg-[#e3e9f2]" />
                </div>
                <span className={cn('h-3 w-12 rounded-sm', tone.accent)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="space-y-1">
                    <span className={cn('block h-10 w-full rounded', tone.soft)} />
                    <span className="block h-1 w-full rounded-full bg-[#dbe3ef]" />
                    <span className="block h-1 w-2/3 rounded-full bg-[#e8edf5]" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 p-3">
              <span className="block h-2 w-3/4 rounded-sm bg-[#c9d5e6]" />
              <span className="block h-1.5 w-1/2 rounded-sm bg-[#dbe3ef]" />
              <div className="space-y-1 pt-2">
                <span className="block h-1 w-[92%] rounded-full bg-[#e3e9f2]" />
                <span className="block h-1 w-[86%] rounded-full bg-[#e3e9f2]" />
                <span className="block h-1 w-[94%] rounded-full bg-[#e3e9f2]" />
                <span className="block h-1 w-[70%] rounded-full bg-[#e3e9f2]" />
                <span className="block h-1 w-[88%] rounded-full bg-[#e3e9f2]" />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="border-t border-line px-3 py-1.5 text-[9.5px] uppercase tracking-[0.08em] text-ink-3">
        Simulated render · no third-party assets used
      </p>
    </div>
  );
}
