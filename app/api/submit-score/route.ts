import type { SubmitScoreRequest } from '@/types';
import { finalizeScore } from '@/lib/server/game';
import { errorResponse, handleError, json, readJson } from '@/lib/server/http';
import { addDays, isIsoDate, isUuid, utcToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Record a completed round. The client's totals are accepted for API
 * compatibility but the stored score is recomputed from server-side answers.
 */
export async function POST(request: Request) {
  const body = await readJson<SubmitScoreRequest>(request);
  if (!body || !isUuid(body.device_id) || !isIsoDate(body.round_date)) {
    return errorResponse('Invalid request');
  }
  const today = utcToday();
  if (body.round_date > today || body.round_date < addDays(today, -7)) {
    return errorResponse('That round is no longer accepting scores', 410);
  }

  try {
    const total = await finalizeScore(body.device_id, body.round_date);
    return json({ success: true, total_score: total });
  } catch (error) {
    return handleError(error, 'submit-score');
  }
}
