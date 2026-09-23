import 'server-only';
import type { AnswerRow, DailyRoundRow, Question, QuestionInput, QuestionStat, ScoreRow } from '@/types';
import { createMemoryRepo } from './memory-repo';
import { createSupabaseRepo } from './supabase-repo';

export interface DayStats {
  date: string;
  plays: number;
  average: number | null;
}

export interface Repo {
  mode: 'supabase' | 'memory';

  getRound(date: string): Promise<DailyRoundRow | null>;
  listRounds(from: string, to: string): Promise<DailyRoundRow[]>;
  /** Insert only if no round exists for that date (race-safe). */
  insertRoundIfMissing(date: string, questionIds: string[]): Promise<void>;
  upsertRound(date: string, questionIds: string[]): Promise<void>;
  deleteRound(date: string): Promise<void>;

  listQuestions(): Promise<Question[]>;
  getQuestions(ids: string[]): Promise<Question[]>;
  createQuestions(inputs: QuestionInput[]): Promise<Question[]>;
  updateQuestion(id: string, patch: Partial<QuestionInput>): Promise<Question | null>;
  /** Hard-deletes unused questions; archives (is_active=false) ones already used in a round. */
  deleteQuestion(id: string): Promise<'deleted' | 'archived' | 'not_found'>;

  getAnswers(deviceId: string, date: string): Promise<AnswerRow[]>;
  /** Insert, ignoring a duplicate (device, date, question). */
  insertAnswer(row: AnswerRow): Promise<void>;
  /** Insert, ignoring a duplicate (device, date). */
  insertScore(row: ScoreRow): Promise<void>;

  statsByDay(from: string, to: string): Promise<DayStats[]>;
  questionStats(): Promise<QuestionStat[]>;
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let repo: Repo | null = null;

export function getRepo(): Repo {
  if (!repo) repo = isSupabaseServerConfigured() ? createSupabaseRepo() : createMemoryRepo();
  return repo;
}
