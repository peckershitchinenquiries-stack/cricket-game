import type { QuestionInput } from '@/types';
import { adminHandler } from '@/lib/server/admin-route';
import { errorResponse, json, readJson } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo';
import { validateQuestion } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';

const MAX_BULK = 500;

/** Import many questions at once. All-or-nothing: any invalid row rejects the batch. */
export const POST = adminHandler('questions.bulk', async (request) => {
  const body = await readJson<{ questions: unknown[] }>(request);
  const rows = body?.questions;
  if (!Array.isArray(rows) || rows.length === 0) return errorResponse('Provide a non-empty "questions" array');
  if (rows.length > MAX_BULK) return errorResponse(`Import at most ${MAX_BULK} questions at a time`);

  const valid: QuestionInput[] = [];
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const result = validateQuestion(row);
    if (result.ok) valid.push(result.value as QuestionInput);
    else errors.push(`Row ${i + 1}: ${result.error}`);
  });
  if (errors.length) {
    return json({ error: 'Some rows are invalid', details: errors.slice(0, 20) }, { status: 400 });
  }

  const created = await getRepo().createQuestions(valid);
  return json({ imported: created.length }, { status: 201 });
});
