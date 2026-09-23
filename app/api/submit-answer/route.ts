import type { SubmitAnswerRequest } from '@/types';
import { answerQuestion } from '@/lib/server/game';
import { errorResponse, handleError, json, readJson } from '@/lib/server/http';
import { addDays, isIsoDate, isUuid, normalizeLng, utcToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Score a single tap. Returns the correct location only after the guess is locked in. */
export async function POST(request: Request) {
  const body = await readJson<SubmitAnswerRequest>(request);
  if (!body) return errorResponse('Invalid request');

  const { question_id, device_id, lat, lng } = body;
  if (!isUuid(question_id) || !isUuid(device_id)) return errorResponse('Invalid question or device');
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return errorResponse('Invalid coordinates');
  }
  if (lat < -90 || lat > 90) return errorResponse('Invalid coordinates');

  // Allow finishing yesterday's round if you started it just before UTC midnight.
  const today = utcToday();
  const date = body.round_date ?? today;
  if (!isIsoDate(date) || (date !== today && date !== addDays(today, -1))) {
    return errorResponse("That round has closed — today's round is waiting for you", 410);
  }

  try {
    const result = await answerQuestion(device_id, date, question_id, { lat, lng: normalizeLng(lng) });
    return json(result);
  } catch (error) {
    return handleError(error, 'submit-answer');
  }
}
