'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AnswerResult, GameResult } from '@/types';
import { CricketLoader } from '@/components/CricketLoader';
import { Countdown } from '@/components/Countdown';
import { DailyAverage } from '@/components/DailyAverage';
import { Logo } from '@/components/Logo';
import { ResultsDots } from '@/components/ResultsDots';
import { ShareCard } from '@/components/ShareCard';
import { StreakCounter } from '@/components/StreakCounter';
import { useCountUp } from '@/hooks/useCountUp';
import { getStreak, type StreakInfo } from '@/lib/device-id';
import { loadProgress, loadResult, syncPendingScore } from '@/lib/game-storage';
import { COLOR_HEX } from '@/lib/scoring';
import { cn, formatDateLong, formatDistance, formatNumber, utcToday } from '@/lib/utils';

export function scoreVerdict(score: number): string {
  if (score >= 900) return 'Bradman-esque. An all-time great innings! 🏆';
  if (score >= 750) return 'A classy century. Take a bow! 🏏';
  if (score >= 500) return 'Solid half-century — the crowd approves.';
  if (score >= 250) return 'A useful cameo. Tomorrow’s a new innings.';
  return 'Out cheaply today — back in the nets tomorrow!';
}

function BreakdownRow({ answer }: { answer: AnswerResult }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left"
      >
        <span
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: COLOR_HEX[answer.color] }}
          aria-hidden="true"
        />
        <span className="w-7 shrink-0 font-display text-sm font-semibold text-mist">Q{answer.position}</span>
        <span className="min-w-0 flex-1 truncate text-[15px]">{answer.correct_label}</span>
        <span className="shrink-0 font-display font-semibold tabular-nums">
          {answer.points}
          <span className="text-sm font-normal text-mist">/{answer.max_points}</span>
        </span>
        <svg
          viewBox="0 0 20 20"
          className={cn('h-4 w-4 shrink-0 text-mist transition-transform', open && 'rotate-180')}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" />
        </svg>
      </button>
      {open && (
        <div className="animate-fade-in pb-3 pl-14 pr-2 text-[15px] text-mist">
          <p className="text-white">{answer.question_text}</p>
          <p className="mt-1">
            Your pin was <span className="font-semibold text-white">{formatDistance(answer.distance_km)}</span> away ·{' '}
            {answer.points} of {answer.max_points} points
          </p>
        </div>
      )}
    </li>
  );
}

export function ResultsScreen() {
  const router = useRouter();
  const [result, setResult] = useState<GameResult | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const today = utcToday();
    const r = loadResult(today);
    if (!r) {
      router.replace(loadProgress(today).length > 0 ? '/play' : '/');
      return;
    }
    setResult(r);
    setStreak(getStreak(today));
    syncPendingScore(today).finally(() => setSynced(true));
  }, [router]);

  const score = useCountUp(result?.total_score ?? 0, { from: 0, duration: 1400, delay: 300 });

  if (!result) {
    return (
      <main className="app-shell items-center justify-center">
        <CricketLoader />
      </main>
    );
  }

  return (
    <main className="app-shell bg-seam px-5 pb-safe pt-safe">
      <header className="flex items-center justify-between py-2">
        <Link href="/" aria-label="Home">
          <Logo size="sm" />
        </Link>
        <span className="chip">
          #{result.round_number} · {formatDateLong(result.date)}
        </span>
      </header>

      <section className="mt-6 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-mist">Your score</p>
        <p className="mt-1 font-display text-6xl font-extrabold tabular-nums text-gold" aria-live="polite">
          {formatNumber(score)}
          <span className="text-2xl font-semibold text-white"> / {formatNumber(result.max_score)}</span>
        </p>
        <ResultsDots
          colors={result.answers.map((a) => a.color)}
          size="lg"
          stagger
          delayMs={500}
          className="mt-5 justify-center"
        />
        <p className="mt-4 animate-rise text-[17px] text-mist" style={{ animationDelay: '1.4s' }}>
          {scoreVerdict(result.total_score)}
        </p>
      </section>

      <section className="card mt-6 px-4 py-1" aria-label="Question breakdown">
        <ul>
          {result.answers.map((a) => (
            <BreakdownRow key={a.question_id} answer={a} />
          ))}
        </ul>
      </section>

      <section className="mt-4 grid gap-4">
        <div className="card p-4">
          <DailyAverage playerScore={result.total_score} refreshKey={synced} />
          {streak && <StreakCounter streak={streak.current} best={streak.best} className="mt-4 first:mt-0" />}
        </div>
      </section>

      <section className="mt-6">
        <ShareCard result={result} />
      </section>

      <section className="card mt-6 p-5">
        <p className="mb-1 text-center font-display font-semibold">Play again tomorrow</p>
        <Countdown onElapsed={() => router.replace('/')} />
      </section>

      <Link href="/" className="btn-ghost mt-4 w-full">
        Back home
      </Link>
    </main>
  );
}
