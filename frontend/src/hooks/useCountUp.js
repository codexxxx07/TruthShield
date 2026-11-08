import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** Animate a number once on mount (or when the target changes). */
export default function useCountUp(target, { duration = 900, start = 0 } = {}) {
  const [reduced] = useState(prefersReducedMotion);
  const [value, setValue] = useState(start);
  const frame = useRef(0);

  useEffect(() => {
    if (reduced) return undefined;

    const from = start;
    const delta = target - from;
    const began = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, Math.max(0, (now - began) / duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + delta * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [reduced, target, duration, start]);

  return reduced ? target : value;
}
