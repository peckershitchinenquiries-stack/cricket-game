import { autoAssignRounds } from '@/lib/server/game';
import { adminHandler } from '@/lib/server/admin-route';
import { errorResponse, json, readJson } from '@/lib/server/http';
import { isIsoDate, utcToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Auto-assign random rounds. By default only fills dates with no round. */
export const POST = adminHandler('rounds.auto', async (request) => {
  const body = await readJson<{ start: string; days: number; overwrite: boolean }>(request);
  const start = body?.start ?? utcToday();
  const days = Number(body?.days ?? 30);
  if (!isIsoDate(start)) return errorResponse('Invalid start date');
  if (!Number.isInteger(days) || days < 1 || days > 366) return errorResponse('Days must be between 1 and 366');
  if (body?.overwrite && start <= utcToday()) {
    return errorResponse('Overwriting can only start from tomorrow, as today may already be in play');
  }
  const assigned = await autoAssignRounds(start, days, Boolean(body?.overwrite));
  return json({ assigned });
});
