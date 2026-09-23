'use client';

import { useEffect, useRef } from 'react';
import { useCountdownToUtcMidnight } from '@/hooks/useCountdown';
import { cn, formatCountdown } from '@/lib/utils';

/** "Next round in HH:MM:SS" — counts to UTC midnight and reloads when it hits zero. */
export function Countdown({ className, onElapsed }: { className?: string; onElapsed?: () => void }) {
  const ms = useCountdownToUtcMidnight();
  const fired = useRef(false);

  useEffect(() => {
    if (ms !== null && ms <= 1000 && !fired.current) {
      fired.current = true;
      onElapsed?.();
    }
  }, [ms, onElapsed]);

  return (
    <div className={cn('text-center', className)}>
      <p className="text-sm text-mist">Next round in</p>
      <p className="font-display text-3xl font-bold tabular-nums tracking-wide" suppressHydrationWarning>
        {ms === null ? '--:--:--' : formatCountdown(ms)}
      </p>
    </div>
  );
}
