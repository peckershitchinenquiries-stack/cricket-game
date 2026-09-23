import { QUESTIONS_PER_ROUND } from '@/lib/config';
import { adminHandler } from '@/lib/server/admin-route';
import { errorResponse, json, readJson } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo';
import { addDays, isIsoDate, isUuid, utcToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const GET = adminHandler('rounds.list', async (request) => {
  const params = new URL(request.url).searchParams;
  const today = utcToday();
  const from = params.get('from') ?? addDays(today, -7);
  const to = params.get('to') ?? addDays(today, 45);
  if (!isIsoDate(from) || !isIsoDate(to)) return errorResponse('Invalid date range');
  return json({ rounds: await getRepo().listRounds(from, to) });
});

/** Manually set the 5 questions (in order) for a date. */
export const PUT = adminHandler('rounds.set', async (request) => {
  const body = await readJson<{ date: string; question_ids: string[] }>(request);
  const ids = body?.question_ids;
  if (!body || !isIsoDate(body.date)) return errorResponse('Invalid date');
  if (!Array.isArray(ids) || ids.length !== QUESTIONS_PER_ROUND || !ids.every(isUuid)) {
    return errorResponse(`Pick exactly ${QUESTIONS_PER_ROUND} questions`);
  }
  if (new Set(ids).size !== ids.length) return errorResponse('A question can only appear once per round');
  // Today's round may already be half-played; changing it would invalidate in-flight answers.
  if (body.date <= utcToday()) return errorResponse('Today and past rounds are locked');

  const repo = getRepo();
  const found = await repo.getQuestions(ids);
  if (found.length !== ids.length) return errorResponse('One or more questions no longer exist');

  await repo.upsertRound(body.date, ids);
  return json({ round: { round_date: body.date, question_ids: ids } });
});

export const DELETE = adminHandler('rounds.delete', async (request) => {
  const date = new URL(request.url).searchParams.get('date');
  if (!isIsoDate(date)) return errorResponse('Invalid date');
  if (date <= utcToday()) return errorResponse('Today and past rounds cannot be removed');
  await getRepo().deleteRound(date);
  return json({ success: true });
});
