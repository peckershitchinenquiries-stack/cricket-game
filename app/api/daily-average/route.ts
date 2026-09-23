import type { DailyAverageResponse } from '@/types';
import { handleError, json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo';
import { isIsoDate, utcToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get('date');
  const date = param && isIsoDate(param) ? param : utcToday();
  try {
    const [stats] = await getRepo().statsByDay(date, date);
    const body: DailyAverageResponse = { average: stats?.average ?? null, total_players: stats?.plays ?? 0 };
    return json(body, { cacheSeconds: 30 });
  } catch (error) {
    return handleError(error, 'daily-average');
  }
}
