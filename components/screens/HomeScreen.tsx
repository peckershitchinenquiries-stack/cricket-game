'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { GameResult } from '@/types';
import { Countdown } from '@/components/Countdown';
import { DailyAverage } from '@/components/DailyAverage';
import { Globe } from '@/components/Globe';
import { Logo } from '@/components/Logo';
import { ResultsDots } from '@/components/ResultsDots';
import { ShareCard } from '@/components/ShareCard';
import { StreakCounter } from '@/components/StreakCounter';
import { APP_TAGLINE, MAX_SCORE, QUESTION_WEIGHTS } from '@/lib/config';
import { getDeviceId, getStreak, type StreakInfo } from '@/lib/device-id';
import { loadProgress, loadResult, syncPendingScore } from '@/lib/game-storage';
import { COLOR_HEX } from '@/lib/scoring';
import { formatNumber, roundNumberFor, utcToday } from '@/lib/utils';

interface HomeState {
  today: string;
  result: GameResult | null;
  answered: number;
  streak: StreakInfo;
}

const LEGEND = [
  { color: COLOR_HEX.green, label: 'Within 200 km' },
  { color: COLOR_HEX.yellow, label: 'Within 500 km' },
  { color: COLOR_HEX.orange, label: 'Within 1,500 km' },
  { color: COLOR_HEX.red, label: 'Further away' },
];

function HowToPlay() {
  return (
    <details className="card group p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-[32px] cursor-pointer list-none items-center justify-between font-display font-semibold">
        How to play
        <span className="text-mist transition-transform group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-[15px] text-mist">
        <p>
          Five cricket questions a day — grounds, birthplaces, famous matches. Spin the globe, tap where you think the
          answer is, and confirm your pin.
        </p>
        <p>
          The closer you are, the more you score. Stakes rise as you go: questions are worth{' '}
          <span className="text-white">{QUESTION_WEIGHTS.join(' · ')}</span> points, for a perfect{' '}
          <span className="text-white">{formatNumber(MAX_SCORE)}</span>.
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
        <p>A new round drops every day at midnight UTC. Keep your streak alive!</p>
      </div>
    </details>
  );
}

export function HomeScreen() {
  const [state, setState] = useState<HomeState | null>(null);

  const refresh = useCallback(() => {
    const today = utcToday();
    getDeviceId();
    setState({
      today,
      result: loadResult(today),
      answered: loadProgress(today).length,
      streak: getStreak(today),
    });
    void syncPendingScore(today);
  }, []);

  useEffect(() => {
    refresh();
    // Returning to the tab after midnight should show the new round.
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const result = state?.result ?? null;

  return (
    <main className="app-shell bg-stars">
      {/* Ambient globe */}
      <div className="relative h-[42vh] min-h-[260px] w-full shrink-0">
        <Globe mode="ambient" autoRotate />
        <div className="pt-safe absolute inset-x-0 top-0 flex justify-center px-5">
          <span className="chip mt-1 bg-navy-950/70">
            {state ? `Daily round #${roundNumberFor(state.today)}` : 'Daily round'}
          </span>
        </div>
      </div>

      <div className="relative -mt-6 flex flex-1 flex-col px-5 pb-safe">
        <div className="animate-rise text-center">
          <Logo size="lg" className="justify-center" />
          <p className="mx-auto mt-3 max-w-xs text-[17px] leading-snug text-mist">{APP_TAGLINE}</p>
        </div>

        <div className="mt-7">
          {!state ? (
            <div className="skeleton h-14 w-full rounded-2xl" />
          ) : result ? (
            <section className="card animate-rise p-5 text-center" aria-label="Today's result">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-mist">Today&apos;s score</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-gold">
                {formatNumber(result.total_score)}
                <span className="text-xl font-semibold text-white"> / {formatNumber(result.max_score)}</span>
              </p>
              <ResultsDots colors={result.answers.map((a) => a.color)} className="mt-3 justify-center" stagger />
              <div className="mt-5">
                <ShareCard result={result} showPreview={false} />
              </div>
              <Link href="/results" className="mt-3 inline-flex min-h-[48px] items-center font-medium text-pitch">
                View full results →
              </Link>
              <Countdown className="mt-2 border-t border-white/10 pt-4" onElapsed={refresh} />
            </section>
          ) : (
            <div className="animate-rise">
              <Link href="/play" className="btn-primary h-16 w-full text-xl tracking-wide">
                {state.answered > 0 ? `RESUME ROUND · Q${state.answered + 1}/5` : 'PLAY TODAY'}
              </Link>
              <p className="mt-2 text-center text-sm text-mist">5 questions · about 2 minutes</p>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4">
          {state && (state.streak.current > 0 || state.streak.gamesPlayed > 0) && (
            <div className="card p-4">
              <StreakCounter streak={state.streak.current} best={state.streak.best} />
            </div>
          )}
          <DailyAverageCard refreshKey={result?.synced} />
          <HowToPlay />
        </div>

        <footer className="mt-auto pt-8 text-center text-[13px] text-mist/70">
          A new round every day at 00:00 UTC
        </footer>
      </div>
    </main>
  );
}

function DailyAverageCard({ refreshKey }: { refreshKey?: unknown }) {
  // DailyAverage renders nothing until there is data, so the card wrapper is conditional via CSS.
  return (
    <div className="card p-4 empty:hidden">
      <DailyAverage refreshKey={refreshKey} />
    </div>
  );
}
