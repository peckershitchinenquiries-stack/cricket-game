import type { AnswerResult, GameResult, SubmitScoreRequest } from '@/types';
import { MAX_SCORE } from './config';
import { getDeviceId, playedKey, progressKey, safeStorage } from './device-id';

interface Progress {
  date: string;
  answers: AnswerResult[];
}

export function loadProgress(date: string): AnswerResult[] {
  const p = safeStorage.getJSON<Progress>(progressKey(date));
  return p && p.date === date && Array.isArray(p.answers) ? p.answers : [];
}

export function saveProgress(date: string, answers: AnswerResult[]): void {
  safeStorage.setJSON(progressKey(date), { date, answers } satisfies Progress);
}

export function clearProgress(date: string): void {
  safeStorage.remove(progressKey(date));
}

export function loadResult(date: string): GameResult | null {
  const r = safeStorage.getJSON<GameResult>(playedKey(date));
  return r && r.date === date && Array.isArray(r.answers) ? r : null;
}

export function saveResult(result: GameResult): void {
  safeStorage.setJSON(playedKey(result.date), result);
}

export function buildResult(date: string, roundNumber: number, answers: AnswerResult[]): GameResult {
  const sorted = [...answers].sort((a, b) => a.position - b.position);
  return {
    date,
    round_number: roundNumber,
    total_score: sorted.reduce((sum, a) => sum + a.points, 0),
    max_score: MAX_SCORE,
    answers: sorted,
    completed_at: new Date().toISOString(),
    synced: false,
  };
}

/** Sends the final score. Server recomputes totals from its own answer records. */
export async function submitScore(result: GameResult): Promise<boolean> {
  const body: SubmitScoreRequest = {
    device_id: getDeviceId(),
    round_date: result.date,
    total_score: result.total_score,
    question_scores: result.answers.map((a) => a.points),
    accuracy_colors: result.answers.map((a) => a.color),
  };
  try {
    const res = await fetch('/api/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    saveResult({ ...result, synced: true });
    return true;
  } catch {
    return false;
  }
}

/** Retry a score that failed to sync (e.g. finished the round offline). */
export async function syncPendingScore(date: string): Promise<void> {
  const result = loadResult(date);
  if (result && !result.synced) await submitScore(result);
}
