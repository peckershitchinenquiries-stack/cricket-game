'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GlobePov } from '@/components/Globe';
import { Globe } from '@/components/Globe';
import { CricketLoader } from '@/components/CricketLoader';
import { DistanceReveal } from '@/components/DistanceReveal';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionCard } from '@/components/QuestionCard';
import { ScoreReveal } from '@/components/ScoreReveal';
import { TimedButton } from '@/components/TimedButton';
import { useCountUp } from '@/hooks/useCountUp';
import { useGameState } from '@/hooks/useGameState';
import { AUTO_CONFIRM_MS } from '@/lib/config';
import { midpoint } from '@/lib/scoring';
import { clamp, fitGlobeAltitude, formatNumber } from '@/lib/utils';

/** Far enough out to see the whole globe in the viewport (portrait phones need more). */
function overviewAltitude(): number {
  if (typeof window === 'undefined') return 2.5;
  return fitGlobeAltitude(window.innerWidth, window.innerHeight, 1.06);
}

export function PlayScreen() {
  const game = useGameState();
  const { phase, question, guess, currentAnswer, answers, index, total } = game;

  const [pov, setPov] = useState<GlobePov | null>(null);
  // Pause the confirm-pin auto-timer while a finger is on the globe (rotating / zooming to refine).
  const [holding, setHolding] = useState(false);
  const [interactions, setInteractions] = useState(0);

  const runningTotal = useCountUp(total, { duration: 900, delay: 600 });

  useEffect(() => {
    if (!holding) return;
    const release = () => {
      setHolding(false);
      setInteractions((n) => n + 1);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [holding]);

  // New question → pull the camera back out so the whole hemisphere is in play.
  useEffect(() => {
    if (phase !== 'aiming') return;
    const altitude = overviewAltitude();
    setPov(index === 0 ? { lat: 18, lng: 60, altitude, ms: 0 } : { altitude, ms: 1000 });
  }, [index, phase]);

  // Reveal → frame both the guess and the answer.
  useEffect(() => {
    if (phase !== 'revealed' || !currentAnswer) return;
    const mid = midpoint(
      { lat: currentAnswer.guess_lat, lng: currentAnswer.guess_lng },
      { lat: currentAnswer.correct_lat, lng: currentAnswer.correct_lng },
    );
    // Close calls zoom right in; distant misses pull back far enough to show both pins.
    const altitude = clamp(0.5 + currentAnswer.distance_km / 2600, 0.6, overviewAltitude());
    setPov({ ...mid, altitude, ms: 1400 });
  }, [phase, currentAnswer]);

  const onInteract = useCallback(() => setHolding(true), []);

  const correctPin = useMemo(
    () =>
      phase === 'revealed' && currentAnswer
        ? {
            lat: currentAnswer.correct_lat,
            lng: currentAnswer.correct_lng,
            // Short form on the globe ("Wanderers Stadium"); the full label is in the sheet.
            label: currentAnswer.correct_label.split(',')[0],
          }
        : null,
    [phase, currentAnswer],
  );

  if (phase === 'error') {
    const offline = game.loadError === 'offline';
    return (
      <main className="app-shell items-center justify-center px-6 text-center">
        <div className="text-5xl" aria-hidden="true">
          {offline ? '📡' : '🌧️'}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{offline ? "You're offline" : 'Rain delay'}</h1>
        <p className="mt-2 max-w-xs text-mist">
          {offline
            ? 'Come back when you’re connected — today’s round will be waiting.'
            : 'We couldn’t load today’s questions. Give it a moment and try again.'}
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <button type="button" className="btn-primary" onClick={game.retry}>
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell-fixed-wide bg-stars">
      {/* Globe fills the screen; shifted up to sit above the sheet. */}
      <div className="absolute inset-0">
        <Globe
          mode="play"
          userPin={guess}
          correctPin={correctPin}
          pov={pov}
          verticalOffset={0.14}
          onTap={game.tap}
          onInteract={onInteract}
        />
      </div>

      {/* Top bar */}
      <header className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-20 px-4">
        <div className="pointer-events-auto mx-auto flex max-w-[600px] items-center gap-3 rounded-2xl border border-white/10 bg-navy-950/80 p-2 pl-3">
          <Link
            href="/"
            aria-label="Quit to home"
            className="-m-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-mist hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </Link>
          <div className="flex-1">
            <ProgressBar current={index} answers={answers} />
          </div>
          <div className="min-w-[4.5rem] rounded-xl bg-white/5 px-3 py-1.5 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-mist">Score</p>
            <p className="font-display text-lg font-bold leading-none tabular-nums text-gold">
              {formatNumber(runningTotal)}
            </p>
          </div>
        </div>
      </header>

      {/* Bottom sheet */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[600px]">
        <QuestionCard question={phase === 'loading' ? null : question} compact={phase === 'revealed'}>
          {phase === 'aiming' && (
            <div className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-[15px] text-mist">
              <span className="animate-bounce-soft" aria-hidden="true">
                👆
              </span>
              Tap the globe to drop your pin
            </div>
          )}

          {(phase === 'pinned' || phase === 'submitting') && (
            <div>
              <TimedButton
                onClick={game.confirm}
                durationMs={AUTO_CONFIRM_MS}
                running={phase === 'pinned' && !holding && !game.submitError}
                resetKey={`${guess?.lat}:${guess?.lng}:${interactions}`}
                disabled={phase === 'submitting'}
                className="btn-primary w-full"
              >
                {phase === 'submitting' ? 'Locking in…' : 'Confirm pin'}
              </TimedButton>
              <p className="mt-2 text-center text-[14px] text-mist" role={game.submitError ? 'alert' : undefined}>
                {game.submitError ? (
                  <span className="text-dot-red">{game.submitError}</span>
                ) : (
                  'Not quite? Tap again to move it — zoom in for precision.'
                )}
              </p>
            </div>
          )}

          {phase === 'revealed' && currentAnswer && (
            <div>
              <div className="flex items-start gap-4">
                <DistanceReveal answer={currentAnswer} />
                <ScoreReveal answer={currentAnswer} />
              </div>
              <button
                type="button"
                onClick={game.next}
                className={game.isLast ? 'btn-gold mt-4 w-full' : 'btn-primary mt-4 w-full'}
              >
                {game.isLast ? 'See my results' : 'Next question'}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </QuestionCard>
      </div>

      {phase === 'finishing' && (
        <div className="absolute inset-0 z-40 flex animate-fade-in items-center justify-center bg-navy-950/85">
          <CricketLoader label="Tallying up your score…" />
        </div>
      )}
    </main>
  );
}
