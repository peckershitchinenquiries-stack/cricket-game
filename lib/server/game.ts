import 'server-only';
import type {
  AnswerRow,
  DailyRoundResponse,
  DailyRoundRow,
  LatLng,
  PublicQuestion,
  Question,
  SubmitAnswerResponse,
} from '@/types';
import { QUESTIONS_PER_ROUND } from '@/lib/config';
import { maxPointsForPosition, scoreAnswer } from '@/lib/scoring';
import { addDays, roundNumberFor } from '@/lib/utils';
import { getRepo } from './repo';
import { pickRoundQuestions } from './round-picker';

export class GameError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function recentlyUsedIds(date: string, lookbackDays = 7): Promise<Set<string>> {
  const rounds = await getRepo().listRounds(addDays(date, -lookbackDays), addDays(date, -1));
  return new Set(rounds.flatMap((r) => r.question_ids));
}

/** Get the round for a date, auto-generating one if an admin hasn't scheduled it. */
export async function ensureRound(date: string): Promise<DailyRoundRow> {
  const repo = getRepo();
  const existing = await repo.getRound(date);
  if (existing) return existing;

  const ids = pickRoundQuestions(await repo.listQuestions(), await recentlyUsedIds(date));
  await repo.insertRoundIfMissing(date, ids);
  const created = await repo.getRound(date);
  if (!created) throw new GameError('Could not create a round for today', 500);
  return created;
}

function toPublic(q: Question, position: number): PublicQuestion {
  return {
    id: q.id,
    question_text: q.question_text,
    hint: q.hint,
    category: q.category,
    difficulty: q.difficulty,
    max_points: maxPointsForPosition(position),
    position,
  };
}

export async function getPublicRound(date: string): Promise<DailyRoundResponse> {
  const round = await ensureRound(date);
  const questions = await getRepo().getQuestions(round.question_ids);
  const byId = new Map(questions.map((q) => [q.id, q]));

  const ordered = round.question_ids.map((id, i) => {
    const q = byId.get(id);
    return q ? toPublic(q, i + 1) : null;
  });
  if (ordered.length !== QUESTIONS_PER_ROUND || ordered.some((q) => q === null)) {
    throw new GameError("Today's round is misconfigured", 500);
  }

  return { round_number: roundNumberFor(date), date, questions: ordered as PublicQuestion[] };
}

/**
 * Score one answer server-side. Idempotent: the first answer for a
 * (device, date, question) is final — re-submitting returns the original result.
 */
export async function answerQuestion(
  deviceId: string,
  date: string,
  questionId: string,
  guess: LatLng,
): Promise<SubmitAnswerResponse> {
  const repo = getRepo();
  const [round, questions, previous] = await Promise.all([
    repo.getRound(date),
    repo.getQuestions([questionId]),
    repo.getAnswers(deviceId, date),
  ]);
  if (!round) throw new GameError('No round is scheduled for that date', 404);

  const position = round.question_ids.indexOf(questionId) + 1;
  const question = questions[0];
  if (position === 0 || !question) throw new GameError('That question is not part of this round', 400);

  let answer = previous.find((a) => a.question_id === questionId);
  let answers = previous;
  if (!answer) {
    const maxPoints = maxPointsForPosition(position);
    const scored = scoreAnswer(guess, { lat: question.correct_lat, lng: question.correct_lng }, maxPoints);
    const row: AnswerRow = {
      device_id: deviceId,
      round_date: date,
      question_id: questionId,
      position,
      guess_lat: guess.lat,
      guess_lng: guess.lng,
      max_points: maxPoints,
      ...scored,
    };
    await repo.insertAnswer(row);
    // Re-read so a concurrent duplicate submit resolves to the stored (first) answer.
    answers = await repo.getAnswers(deviceId, date);
    answer = answers.find((a) => a.question_id === questionId) ?? row;
  }

  return {
    question_id: questionId,
    position,
    guess_lat: answer.guess_lat,
    guess_lng: answer.guess_lng,
    correct_lat: question.correct_lat,
    correct_lng: question.correct_lng,
    correct_label: question.correct_label,
    distance_km: answer.distance_km,
    points: answer.points,
    max_points: answer.max_points,
    color: answer.color,
    total_so_far: answers.reduce((sum, a) => sum + a.points, 0),
  };
}

/** Record the final score, trusting only the server's own answer records. */
export async function finalizeScore(deviceId: string, date: string): Promise<number> {
  const repo = getRepo();
  const answers = await repo.getAnswers(deviceId, date);
  if (answers.length < QUESTIONS_PER_ROUND) {
    throw new GameError('Answer all five questions before submitting a score', 400);
  }
  const sorted = [...answers].sort((a, b) => a.position - b.position);
  const total = sorted.reduce((sum, a) => sum + a.points, 0);
  await repo.insertScore({
    device_id: deviceId,
    round_date: date,
    total_score: total,
    question_scores: sorted.map((a) => a.points),
    accuracy_colors: sorted.map((a) => a.color),
  });
  return total;
}

/** Fill (or overwrite) rounds for a date range. Returns the dates that were assigned. */
export async function autoAssignRounds(start: string, days: number, overwrite: boolean): Promise<string[]> {
  const repo = getRepo();
  const end = addDays(start, days - 1);
  const [questions, existing, history] = await Promise.all([
    repo.listQuestions(),
    repo.listRounds(start, end),
    repo.listRounds(addDays(start, -7), addDays(start, -1)),
  ]);
  const existingDates = new Set(existing.map((r) => r.round_date));
  const timeline = new Map<string, string[]>([...history, ...existing].map((r) => [r.round_date, r.question_ids]));

  const assigned: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    if (existingDates.has(date) && !overwrite) continue;
    const recent = new Set(
      Array.from({ length: 7 }, (_, d) => timeline.get(addDays(date, -(d + 1))) ?? []).flat(),
    );
    const ids = pickRoundQuestions(questions, recent);
    await repo.upsertRound(date, ids);
    timeline.set(date, ids);
    assigned.push(date);
  }
  return assigned;
}
