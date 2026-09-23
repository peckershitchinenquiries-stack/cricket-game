'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AnswerResult, LatLng, SubmitAnswerResponse } from '@/types';
import { QUESTIONS_PER_ROUND } from '@/lib/config';
import { getDeviceId, pruneOldEntries, recordPlay } from '@/lib/device-id';
import {
  buildResult,
  clearProgress,
  loadProgress,
  loadResult,
  saveProgress,
  saveResult,
  submitScore,
} from '@/lib/game-storage';
import { haptic } from '@/lib/utils';
import { useDailyQuestions } from './useDailyQuestions';

/**
 * Game flow:
 *   loading → aiming ⇄ pinned → submitting → revealed → (next question: aiming) … → finishing → /results
 */
export type GamePhase = 'loading' | 'error' | 'aiming' | 'pinned' | 'submitting' | 'revealed' | 'finishing';

const SCORE_SUBMIT_TIMEOUT_MS = 4000;

export function useGameState() {
  const router = useRouter();
  const { data: round, error: loadError, retry } = useDailyQuestions();

  const [phase, setPhase] = useState<GamePhase>('loading');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const finishing = useRef(false);

  const finish = useCallback(
    async (final: AnswerResult[]) => {
      if (!round || finishing.current) return;
      finishing.current = true;
      setPhase('finishing');

      const result = buildResult(round.date, round.round_number, final);
      saveResult(result); // local first — the results screen works even if the network drops
      recordPlay(round.date);
      clearProgress(round.date);
      pruneOldEntries(round.date);

      await Promise.race([
        submitScore(result),
        new Promise((resolve) => setTimeout(resolve, SCORE_SUBMIT_TIMEOUT_MS)),
      ]);
      router.replace('/results');
    },
    [round, router],
  );

  // Initialise (or resume) once today's round has loaded.
  useEffect(() => {
    if (!round) return;
    if (loadResult(round.date)) {
      router.replace('/results');
      return;
    }
    const ids = new Set(round.questions.map((q) => q.id));
    const saved = loadProgress(round.date).filter((a) => ids.has(a.question_id));
    setAnswers(saved);
    if (saved.length >= QUESTIONS_PER_ROUND) {
      void finish(saved);
    } else {
      setIndex(saved.length);
      setPhase('aiming');
    }
  }, [round, router, finish]);

  useEffect(() => {
    if (loadError) setPhase('error');
    else if (!round) setPhase('loading');
  }, [loadError, round]);

  const question = round?.questions[index] ?? null;
  const currentAnswer = useMemo(
    () => (question ? answers.find((a) => a.question_id === question.id) ?? null : null),
    [answers, question],
  );
  const total = useMemo(() => answers.reduce((sum, a) => sum + a.points, 0), [answers]);

  const tap = useCallback(
    (point: LatLng) => {
      if (phase !== 'aiming' && phase !== 'pinned') return;
      haptic(12);
      setSubmitError(null);
      setGuess(point);
      setPhase('pinned');
    },
    [phase],
  );

  const confirm = useCallback(async () => {
    if (phase !== 'pinned' || !guess || !round || !question) return;
    setPhase('submitting');
    setSubmitError(null);

    try {
      const res = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.id,
          device_id: getDeviceId(),
          lat: guess.lat,
          lng: guess.lng,
          round_date: round.date,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((body && typeof body.error === 'string' && body.error) || 'Could not submit your answer');
      }

      const answer: AnswerResult = { ...(body as SubmitAnswerResponse), question_text: question.question_text };
      const next = [...answers.filter((a) => a.question_id !== answer.question_id), answer].sort(
        (a, b) => a.position - b.position,
      );
      saveProgress(round.date, next);
      setAnswers(next);
      // Show the server's recorded guess (matters only if this was a resubmission).
      setGuess({ lat: answer.guess_lat, lng: answer.guess_lng });
      setPhase('revealed');
      haptic(answer.color === 'green' ? [20, 60, 30] : 20);
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setSubmitError(
        offline ? "You're offline — reconnect and tap Confirm again." : err instanceof Error ? err.message : 'Something went wrong',
      );
      setPhase('pinned');
    }
  }, [phase, guess, round, question, answers]);

  const next = useCallback(() => {
    if (phase !== 'revealed') return;
    if (index < QUESTIONS_PER_ROUND - 1) {
      setIndex(index + 1);
      setGuess(null);
      setPhase('aiming');
    } else {
      void finish(answers);
    }
  }, [phase, index, answers, finish]);

  return {
    phase,
    round,
    question,
    index,
    answers,
    guess,
    currentAnswer,
    total,
    loadError,
    submitError,
    isLast: index === QUESTIONS_PER_ROUND - 1,
    tap,
    confirm,
    next,
    retry,
  };
}
