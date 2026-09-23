'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DailyRoundResponse } from '@/types';
import { utcToday } from '@/lib/utils';

export type LoadError = 'offline' | 'unavailable';

export function useDailyQuestions() {
  const [data, setData] = useState<DailyRoundResponse | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/daily-questions', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const round = (await res.json()) as DailyRoundResponse;
        // A service-worker cached copy from yesterday is no use for today's game.
        if (round.date !== utcToday() || round.questions?.length !== 5) throw new Error('stale');
        setData(round);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'unavailable');
        console.warn('Failed to load daily questions', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, loading, retry };
}
