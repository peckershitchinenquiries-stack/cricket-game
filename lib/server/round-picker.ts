import type { Question } from '@/types';
import { QUESTIONS_PER_ROUND } from '@/lib/config';
import { haversineKm } from '@/lib/scoring';

/** Two answers closer than this are considered "the same place" and not paired in one round. */
const MIN_SEPARATION_KM = 300;

const DIFFICULTY_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/** Deterministic PRNG so a date always yields the same pick (memory mode). */
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Choose 5 questions for a round:
 *  - only active questions
 *  - prefer questions not used recently
 *  - avoid two answers at (nearly) the same location
 *  - order easy → hard so the heavier-weighted late questions are the tough ones
 */
export function pickRoundQuestions(
  questions: Question[],
  recentlyUsed: Set<string> = new Set(),
  rng: () => number = Math.random,
): string[] {
  const active = questions.filter((q) => q.is_active);
  if (active.length < QUESTIONS_PER_ROUND) {
    throw new Error(`Need at least ${QUESTIONS_PER_ROUND} active questions to build a round (have ${active.length})`);
  }

  const shuffled = active
    .map((q) => ({ q, r: rng() + (recentlyUsed.has(q.id) ? 1 : 0) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.q);

  const picked: Question[] = [];
  for (const q of shuffled) {
    if (picked.length === QUESTIONS_PER_ROUND) break;
    const tooClose = picked.some(
      (p) => haversineKm({ lat: p.correct_lat, lng: p.correct_lng }, { lat: q.correct_lat, lng: q.correct_lng }) <
        MIN_SEPARATION_KM,
    );
    if (!tooClose) picked.push(q);
  }
  // Not enough geographic variety in the bank — fill up regardless of distance.
  for (const q of shuffled) {
    if (picked.length === QUESTIONS_PER_ROUND) break;
    if (!picked.includes(q)) picked.push(q);
  }

  return picked
    .map((q, i) => ({ q, i }))
    .sort((a, b) => (DIFFICULTY_RANK[a.q.difficulty] ?? 1) - (DIFFICULTY_RANK[b.q.difficulty] ?? 1) || a.i - b.i)
    .map(({ q }) => q.id);
}
