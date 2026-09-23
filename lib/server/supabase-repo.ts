import 'server-only';
import type { AnswerRow, DailyRoundRow, Question, QuestionStat } from '@/types';
import type { DayStats, Repo } from './repo';
import { getServiceSupabase } from './supabase-admin';

const QUESTION_COLUMNS =
  'id, question_text, hint, correct_lat, correct_lng, correct_label, category, difficulty, created_at, is_active';

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown error'}`);
}

export function createSupabaseRepo(): Repo {
  const db = () => getServiceSupabase();

  return {
    mode: 'supabase',

    async getRound(date) {
      const { data, error } = await db()
        .from('daily_rounds')
        .select('round_date, question_ids')
        .eq('round_date', date)
        .maybeSingle();
      if (error) fail('getRound', error);
      return (data as DailyRoundRow | null) ?? null;
    },

    async listRounds(from, to) {
      const { data, error } = await db()
        .from('daily_rounds')
        .select('round_date, question_ids')
        .gte('round_date', from)
        .lte('round_date', to)
        .order('round_date');
      if (error) fail('listRounds', error);
      return (data ?? []) as DailyRoundRow[];
    },

    async insertRoundIfMissing(date, questionIds) {
      const { error } = await db()
        .from('daily_rounds')
        .upsert({ round_date: date, question_ids: questionIds }, { onConflict: 'round_date', ignoreDuplicates: true });
      if (error) fail('insertRoundIfMissing', error);
    },

    async upsertRound(date, questionIds) {
      const { error } = await db()
        .from('daily_rounds')
        .upsert({ round_date: date, question_ids: questionIds }, { onConflict: 'round_date' });
      if (error) fail('upsertRound', error);
    },

    async deleteRound(date) {
      const { error } = await db().from('daily_rounds').delete().eq('round_date', date);
      if (error) fail('deleteRound', error);
    },

    async listQuestions() {
      const { data, error } = await db().from('questions').select(QUESTION_COLUMNS).order('created_at', {
        ascending: false,
      });
      if (error) fail('listQuestions', error);
      return (data ?? []) as Question[];
    },

    async getQuestions(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await db().from('questions').select(QUESTION_COLUMNS).in('id', ids);
      if (error) fail('getQuestions', error);
      return (data ?? []) as Question[];
    },

    async createQuestions(inputs) {
      const { data, error } = await db().from('questions').insert(inputs).select(QUESTION_COLUMNS);
      if (error) fail('createQuestions', error);
      return (data ?? []) as Question[];
    },

    async updateQuestion(id, patch) {
      const { data, error } = await db()
        .from('questions')
        .update(patch)
        .eq('id', id)
        .select(QUESTION_COLUMNS)
        .maybeSingle();
      if (error) fail('updateQuestion', error);
      return (data as Question | null) ?? null;
    },

    async deleteQuestion(id) {
      const { count, error: countError } = await db()
        .from('daily_rounds')
        .select('round_date', { count: 'exact', head: true })
        .contains('question_ids', [id]);
      if (countError) fail('deleteQuestion.count', countError);

      if ((count ?? 0) > 0) {
        const { data, error } = await db()
          .from('questions')
          .update({ is_active: false })
          .eq('id', id)
          .select('id');
        if (error) fail('deleteQuestion.archive', error);
        return data && data.length > 0 ? 'archived' : 'not_found';
      }

      const { data, error } = await db().from('questions').delete().eq('id', id).select('id');
      if (error) fail('deleteQuestion', error);
      return data && data.length > 0 ? 'deleted' : 'not_found';
    },

    async getAnswers(deviceId, date) {
      const { data, error } = await db()
        .from('answers')
        .select('device_id, round_date, question_id, position, guess_lat, guess_lng, distance_km, points, max_points, color')
        .eq('device_id', deviceId)
        .eq('round_date', date)
        .order('position');
      if (error) fail('getAnswers', error);
      return (data ?? []) as AnswerRow[];
    },

    async insertAnswer(row) {
      const { error } = await db().from('answers').insert(row);
      if (error && error.code !== UNIQUE_VIOLATION) fail('insertAnswer', error);
    },

    async insertScore(row) {
      const { error } = await db().from('scores').insert(row);
      if (error && error.code !== UNIQUE_VIOLATION) fail('insertScore', error);
    },

    async statsByDay(from, to) {
      const { data, error } = await db().rpc('score_stats_by_day', { p_from: from, p_to: to });
      if (error) fail('statsByDay', error);
      return ((data ?? []) as { round_date: string; plays: number; average: number | null }[]).map(
        (r): DayStats => ({
          date: r.round_date,
          plays: Number(r.plays),
          average: r.average === null ? null : Math.round(Number(r.average)),
        }),
      );
    },

    async questionStats() {
      const { data, error } = await db()
        .from('question_stats')
        .select('id, question_text, correct_label, attempts, avg_pct, avg_distance_km')
        .gt('attempts', 0)
        .order('avg_pct', { ascending: true })
        .limit(15);
      if (error) fail('questionStats', error);
      return ((data ?? []) as QuestionStat[]).map((r) => ({
        ...r,
        attempts: Number(r.attempts),
        avg_pct: r.avg_pct === null ? null : Number(r.avg_pct),
        avg_distance_km: r.avg_distance_km === null ? null : Number(r.avg_distance_km),
      }));
    },
  };
}
