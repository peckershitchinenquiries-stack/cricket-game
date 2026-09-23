export type AccuracyColor = 'green' | 'yellow' | 'orange' | 'red';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Category = 'stadium' | 'world_cup' | 'birthplace' | 'historic_match' | 'general';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Full question row — server/admin only. Contains the answer. */
export interface Question {
  id: string;
  question_text: string;
  hint: string | null;
  correct_lat: number;
  correct_lng: number;
  correct_label: string;
  category: string;
  difficulty: string;
  created_at: string;
  is_active: boolean;
}

export type QuestionInput = Omit<Question, 'id' | 'created_at'>;

/** Question as served to players — no coordinates. */
export interface PublicQuestion {
  id: string;
  question_text: string;
  hint: string | null;
  category: string;
  difficulty: string;
  max_points: number;
  position: number;
}

export interface DailyRoundResponse {
  round_number: number;
  date: string;
  questions: PublicQuestion[];
}

export interface DailyRoundRow {
  round_date: string;
  question_ids: string[];
}

export interface SubmitAnswerRequest {
  question_id: string;
  device_id: string;
  lat: number;
  lng: number;
  round_date?: string;
}

export interface SubmitAnswerResponse {
  question_id: string;
  position: number;
  guess_lat: number;
  guess_lng: number;
  correct_lat: number;
  correct_lng: number;
  correct_label: string;
  distance_km: number;
  points: number;
  max_points: number;
  color: AccuracyColor;
  total_so_far: number;
}

/** A single answered question as stored on the device. */
export interface AnswerResult extends SubmitAnswerResponse {
  question_text: string;
}

export interface GameResult {
  date: string;
  round_number: number;
  total_score: number;
  max_score: number;
  answers: AnswerResult[];
  completed_at: string;
  synced: boolean;
}

export interface SubmitScoreRequest {
  device_id: string;
  round_date: string;
  total_score: number;
  question_scores: number[];
  accuracy_colors: AccuracyColor[];
}

export interface DailyAverageResponse {
  average: number | null;
  total_players: number;
}

/** Stored answer row (server). */
export interface AnswerRow {
  device_id: string;
  round_date: string;
  question_id: string;
  position: number;
  guess_lat: number;
  guess_lng: number;
  distance_km: number;
  points: number;
  max_points: number;
  color: AccuracyColor;
}

export interface ScoreRow {
  device_id: string;
  round_date: string;
  total_score: number;
  question_scores: number[];
  accuracy_colors: AccuracyColor[];
}

export interface QuestionStat {
  id: string;
  question_text: string;
  correct_label: string;
  attempts: number;
  avg_pct: number | null;
  avg_distance_km: number | null;
}

export interface AdminStats {
  plays_today: number;
  plays_week: number;
  average_today: number | null;
  plays_by_day: { date: string; plays: number; average: number | null }[];
  most_missed: QuestionStat[];
}

export interface ApiError {
  error: string;
}
