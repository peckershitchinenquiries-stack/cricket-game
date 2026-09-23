import 'server-only';
import seed from '@/data/seed-questions.json';
import type { AnswerRow, DailyRoundRow, Question, QuestionStat, ScoreRow } from '@/types';
import { addDays, utcToday } from '@/lib/utils';
import type { DayStats, Repo } from './repo';
import { pickRoundQuestions, seededRng } from './round-picker';

/**
 * In-process store used when Supabase isn't configured (local dev, previews).
 * Data lives until the server restarts; rounds are deterministic per date.
 */
interface MemoryState {
  questions: Map<string, Question>;
  rounds: Map<string, string[]>;
  answers: Map<string, AnswerRow>;
  scores: Map<string, ScoreRow>;
}

const globalForMemory = globalThis as unknown as { __cricktapMemory?: MemoryState };

function initialState(): MemoryState {
  const createdAt = new Date('2026-09-01T00:00:00Z').toISOString();
  const questions = new Map<string, Question>(
    seed.map((q) => [q.id, { ...q, created_at: createdAt, is_active: true } satisfies Question]),
  );

  // Pre-schedule the next 30 days, like the Supabase seed migration does.
  const rounds = new Map<string, string[]>();
  const today = utcToday();
  const all = [...questions.values()];
  for (let i = -1; i < 30; i++) {
    const date = addDays(today, i);
    const recent = new Set([1, 2, 3].flatMap((d) => rounds.get(addDays(date, -d)) ?? []));
    rounds.set(date, pickRoundQuestions(all, recent, seededRng(date)));
  }
  return { questions, rounds, answers: new Map(), scores: new Map() };
}

function state(): MemoryState {
  if (!globalForMemory.__cricktapMemory) globalForMemory.__cricktapMemory = initialState();
  return globalForMemory.__cricktapMemory;
}

const answerKey = (deviceId: string, date: string, questionId: string) => `${deviceId}|${date}|${questionId}`;

export function createMemoryRepo(): Repo {
  return {
    mode: 'memory',

    async getRound(date) {
      const ids = state().rounds.get(date);
      return ids ? { round_date: date, question_ids: [...ids] } : null;
    },

    async listRounds(from, to) {
      return [...state().rounds.entries()]
        .filter(([date]) => date >= from && date <= to)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([round_date, ids]): DailyRoundRow => ({ round_date, question_ids: [...ids] }));
    },

    async insertRoundIfMissing(date, questionIds) {
      if (!state().rounds.has(date)) state().rounds.set(date, [...questionIds]);
    },

    async upsertRound(date, questionIds) {
      state().rounds.set(date, [...questionIds]);
    },

    async deleteRound(date) {
      state().rounds.delete(date);
    },

    async listQuestions() {
      return [...state().questions.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getQuestions(ids) {
      return ids.map((id) => state().questions.get(id)).filter((q): q is Question => Boolean(q));
    },

    async createQuestions(inputs) {
      const created = inputs.map(
        (input): Question => ({ ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() }),
      );
      created.forEach((q) => state().questions.set(q.id, q));
      return created;
    },

    async updateQuestion(id, patch) {
      const existing = state().questions.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, id };
      state().questions.set(id, updated);
      return updated;
    },

    async deleteQuestion(id) {
      const existing = state().questions.get(id);
      if (!existing) return 'not_found';
      const used = [...state().rounds.values()].some((ids) => ids.includes(id));
      if (used) {
        state().questions.set(id, { ...existing, is_active: false });
        return 'archived';
      }
      state().questions.delete(id);
      return 'deleted';
    },

    async getAnswers(deviceId, date) {
      return [...state().answers.values()]
        .filter((a) => a.device_id === deviceId && a.round_date === date)
        .sort((a, b) => a.position - b.position);
    },

    async insertAnswer(row) {
      const key = answerKey(row.device_id, row.round_date, row.question_id);
      if (!state().answers.has(key)) state().answers.set(key, { ...row });
    },

    async insertScore(row) {
      const key = `${row.device_id}|${row.round_date}`;
      if (!state().scores.has(key)) state().scores.set(key, { ...row });
    },

    async statsByDay(from, to) {
      const byDay = new Map<string, number[]>();
      for (const s of state().scores.values()) {
        if (s.round_date < from || s.round_date > to) continue;
        byDay.set(s.round_date, [...(byDay.get(s.round_date) ?? []), s.total_score]);
      }
      return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, totals]): DayStats => ({
          date,
          plays: totals.length,
          average: Math.round(totals.reduce((a, b) => a + b, 0) / totals.length),
        }));
    },

    async questionStats() {
      const agg = new Map<string, { n: number; pct: number; dist: number }>();
      for (const a of state().answers.values()) {
        const cur = agg.get(a.question_id) ?? { n: 0, pct: 0, dist: 0 };
        agg.set(a.question_id, { n: cur.n + 1, pct: cur.pct + a.points / a.max_points, dist: cur.dist + a.distance_km });
      }
      return [...agg.entries()]
        .map(([id, { n, pct, dist }]): QuestionStat | null => {
          const q = state().questions.get(id);
          if (!q) return null;
          return {
            id,
            question_text: q.question_text,
            correct_label: q.correct_label,
            attempts: n,
            avg_pct: pct / n,
            avg_distance_km: dist / n,
          };
        })
        .filter((s): s is QuestionStat => s !== null)
        .sort((a, b) => (a.avg_pct ?? 0) - (b.avg_pct ?? 0))
        .slice(0, 15);
    },
  };
}
