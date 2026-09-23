'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button that fires itself after `durationMs` while `running`. A progress bar
 * fills across it; changing `resetKey` restarts the countdown.
 */
export function TimedButton({
  onClick,
  durationMs,
  running,
  resetKey,
  className,
  disabled,
  children,
}: {
  onClick: () => void;
  durationMs: number;
  running: boolean;
  resetKey?: string | number;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const handler = useRef(onClick);
  useEffect(() => {
    handler.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!running || disabled) return;
    const id = window.setTimeout(() => handler.current(), durationMs);
    return () => window.clearTimeout(id);
  }, [running, disabled, durationMs, resetKey]);

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn('relative overflow-hidden', className)}>
      {running && !disabled && (
        <span
          key={resetKey}
          aria-hidden="true"
          className="timer-bar absolute inset-y-0 left-0 w-full bg-black/15"
          style={{ animationDuration: `${durationMs}ms` }}
        />
      )}
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}
