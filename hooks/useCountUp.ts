'use client';

import { useEffect, useRef, useState } from 'react';

/** Animates a number from its previous value to `target` with an ease-out curve. */
export function useCountUp(target: number, { duration = 900, delay = 0, from }: { duration?: number; delay?: number; from?: number } = {}) {
  const [value, setValue] = useState(from ?? target);
  const current = useRef(from ?? target);

  useEffect(() => {
    const start = current.current;
    if (start === target) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      current.current = target;
      setValue(target);
      return;
    }

    let raf = 0;
    let t0 = 0;
    const timer = window.setTimeout(() => {
      const step = (now: number) => {
        if (!t0) t0 = now;
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const next = Math.round(start + (target - start) * eased);
        current.current = next;
        setValue(next);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);

  return value;
}
