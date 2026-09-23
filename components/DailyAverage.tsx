'use client';

import { useEffect, useState } from 'react';
import type { DailyAverageResponse } from '@/types';
import { MAX_SCORE } from '@/lib/config';
import { cn, formatNumber } from '@/lib/utils';

export function useDailyAverage(refreshKey?: unknown) {
  const [data, setData] = useState<DailyAverageResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/daily-average', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DailyAverageResponse | null) => d && setData(d))
      .catch(() => undefined);
    return () => controller.abort();
  }, [refreshKey]);
  return data;
}

/** "Today's average: X / 1,000", optionally compared against the player's score. */
export function DailyAverage({
  playerScore,
  refreshKey,
  className,
}: {
  playerScore?: number;
  refreshKey?: unknown;
  className?: string;
}) {
  const data = useDailyAverage(refreshKey);
  if (!data || data.average === null || data.total_players === 0) return null;

  const diff = playerScore !== undefined ? playerScore - data.average : null;
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div>
        <p className="text-sm text-mist">Today&apos;s average</p>
        <p className="font-display text-xl font-bold">
          {formatNumber(data.average)} <span className="text-base font-medium text-mist">/ {formatNumber(MAX_SCORE)}</span>
        </p>
        <p className="text-[13px] text-mist">
          {formatNumber(data.total_players)} player{data.total_players === 1 ? '' : 's'} today
        </p>
      </div>
      {diff !== null && data.total_players > 1 && (
        <span
          className={cn(
            'rounded-full px-3 py-1.5 font-display text-sm font-semibold',
            diff >= 0 ? 'bg-pitch/15 text-pitch' : 'bg-dot-orange/15 text-dot-orange',
          )}
        >
          {diff >= 0 ? `+${formatNumber(diff)} above` : `${formatNumber(Math.abs(diff))} below`}
        </span>
      )}
    </div>
  );
}
