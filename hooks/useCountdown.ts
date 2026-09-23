'use client';

import { useEffect, useState } from 'react';
import { msUntilUtcMidnight } from '@/lib/utils';

/** Live milliseconds until the next UTC midnight (null before mount to avoid hydration mismatch). */
export function useCountdownToUtcMidnight(): number | null {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMs(msUntilUtcMidnight());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return ms;
}
