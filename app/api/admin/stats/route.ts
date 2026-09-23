import type { AdminStats } from '@/types';
import { adminHandler } from '@/lib/server/admin-route';
import { json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo';
import { addDays, utcToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const GET = adminHandler('stats', async () => {
  const repo = getRepo();
  const today = utcToday();
  const from = addDays(today, -13);
  const [byDay, mostMissed] = await Promise.all([repo.statsByDay(from, today), repo.questionStats()]);

  const lookup = new Map(byDay.map((d) => [d.date, d]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(from, i);
    return lookup.get(date) ?? { date, plays: 0, average: null };
  });

  const body: AdminStats = {
    plays_today: lookup.get(today)?.plays ?? 0,
    plays_week: series.slice(-7).reduce((sum, d) => sum + d.plays, 0),
    average_today: lookup.get(today)?.average ?? null,
    plays_by_day: series,
    most_missed: mostMissed,
  };
  return json(body);
});
