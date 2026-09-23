import { getPublicRound } from '@/lib/server/game';
import { handleError, json } from '@/lib/server/http';
import { msUntilUtcMidnight, utcToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Today's 5 questions (UTC). Correct coordinates are never included. */
export async function GET() {
  try {
    const round = await getPublicRound(utcToday());
    // Cache at the edge, but never past UTC midnight.
    const cacheSeconds = Math.min(300, Math.floor(msUntilUtcMidnight() / 1000) - 5);
    return json(round, { cacheSeconds });
  } catch (error) {
    return handleError(error, 'daily-questions');
  }
}
