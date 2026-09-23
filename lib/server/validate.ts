import 'server-only';
import type { QuestionInput } from '@/types';

export const DIFFICULTIES = ['easy', 'medium', 'hard'];

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;

/** Validate a full question (partial=false) or a patch (partial=true). */
export function validateQuestion(raw: unknown, partial = false): Result<Partial<QuestionInput>> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid question' };
  const r = raw as Record<string, unknown>;
  const out: Partial<QuestionInput> = {};
  const has = (k: string) => k in r && r[k] !== undefined;

  if (!partial || has('question_text')) {
    const v = str(r.question_text);
    if (v.length < 5 || v.length > 300) return { ok: false, error: 'Question text must be 5–300 characters' };
    out.question_text = v;
  }
  if (!partial || has('correct_label')) {
    const v = str(r.correct_label);
    if (v.length < 2 || v.length > 120) return { ok: false, error: 'Answer label must be 2–120 characters' };
    out.correct_label = v;
  }
  if (!partial || has('correct_lat')) {
    const v = num(r.correct_lat);
    if (!Number.isFinite(v) || v < -90 || v > 90) return { ok: false, error: 'Latitude must be between -90 and 90' };
    out.correct_lat = v;
  }
  if (!partial || has('correct_lng')) {
    const v = num(r.correct_lng);
    if (!Number.isFinite(v) || v < -180 || v > 180) {
      return { ok: false, error: 'Longitude must be between -180 and 180' };
    }
    out.correct_lng = v;
  }
  if (!partial || has('hint')) {
    const v = str(r.hint);
    if (v.length > 200) return { ok: false, error: 'Hint must be under 200 characters' };
    out.hint = v || null;
  }
  if (!partial || has('category')) {
    const v = str(r.category).toLowerCase().replace(/\s+/g, '_') || 'general';
    if (!/^[a-z_]{2,40}$/.test(v)) return { ok: false, error: 'Category must be letters and underscores' };
    out.category = v;
  }
  if (!partial || has('difficulty')) {
    const v = str(r.difficulty).toLowerCase() || 'medium';
    if (!DIFFICULTIES.includes(v)) return { ok: false, error: 'Difficulty must be easy, medium or hard' };
    out.difficulty = v;
  }
  if (!partial || has('is_active')) {
    const v = r.is_active;
    out.is_active = v === undefined || v === '' ? true : v === true || v === 'true' || v === '1' || v === 1;
  }
  return { ok: true, value: out };
}
