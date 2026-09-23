'use client';

import { useEffect, useState } from 'react';
import type { AdminStats } from '@/types';
import { MAX_SCORE } from '@/lib/config';
import { adminFetch } from '@/lib/admin-client';
import { formatDistance, formatNumber } from '@/lib/utils';

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-mist">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-sm text-mist">{sub}</p>}
    </div>
  );
}

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Single-series bar chart of daily plays with per-bar hover tooltips. */
function PlaysChart({ data }: { data: AdminStats['plays_by_day'] }) {
  const max = Math.max(1, ...data.map((d) => d.plays));
  return (
    <figure className="card p-4">
      <figcaption className="mb-4 flex items-baseline justify-between">
        <span className="font-semibold">Plays per day</span>
        <span className="text-sm text-mist">Last 14 days</span>
      </figcaption>
      <div className="relative h-44">
        {/* Recessive gridlines: top (max) and baseline */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/10" aria-hidden="true">
          <span className="absolute -top-2.5 right-0 bg-navy-900 pl-1 text-xs text-mist">{formatNumber(max)}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/20" aria-hidden="true" />
        <div className="absolute inset-0 flex items-end gap-[2px] pr-8" aria-hidden="true">
          {data.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center">
              <div
                className="w-full max-w-[28px] rounded-t-[4px] bg-pitch transition-opacity group-hover:opacity-80"
                style={{ height: `${(d.plays / max) * 100}%`, minHeight: d.plays > 0 ? 2 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg border border-white/10 bg-navy-950 px-3 py-2 text-xs shadow-lg group-hover:block">
                <p className="font-semibold text-white">{shortDate(d.date)}</p>
                <p className="text-mist">
                  {formatNumber(d.plays)} plays{d.average !== null ? ` · avg ${d.average}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pr-8 text-xs text-mist" aria-hidden="true">
        <span>{shortDate(data[0].date)}</span>
        <span>{shortDate(data[data.length - 1].date)}</span>
      </div>
      <table className="sr-only">
        <caption>Plays per day, last 14 days</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Plays</th>
            <th>Average score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.plays}</td>
              <td>{d.average ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function StatsTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<AdminStats>('/stats')
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'));
  }, []);

  if (error) return <p role="alert" className="card p-4 text-dot-red">{error}</p>;
  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Plays today" value={formatNumber(stats.plays_today)} />
        <StatTile label="Plays this week" value={formatNumber(stats.plays_week)} sub="Last 7 days" />
        <StatTile
          label="Average score today"
          value={stats.average_today === null ? '—' : formatNumber(stats.average_today)}
          sub={`out of ${formatNumber(MAX_SCORE)}`}
        />
      </div>

      <PlaysChart data={stats.plays_by_day} />

      <section className="card overflow-hidden">
        <h3 className="px-4 pt-4 font-semibold">Most missed questions</h3>
        <p className="px-4 text-sm text-mist">Lowest average accuracy across all answers</p>
        {stats.most_missed.length === 0 ? (
          <p className="p-4 text-mist">No answers yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-y border-white/10 text-mist">
                <tr>
                  <th className="px-4 py-2 font-medium">Question</th>
                  <th className="px-4 py-2 text-right font-medium">Attempts</th>
                  <th className="px-4 py-2 text-right font-medium">Avg accuracy</th>
                  <th className="px-4 py-2 text-right font-medium">Avg distance</th>
                </tr>
              </thead>
              <tbody>
                {stats.most_missed.map((q) => (
                  <tr key={q.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <p>{q.question_text}</p>
                      <p className="text-mist">{q.correct_label}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(q.attempts)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {q.avg_pct === null ? '—' : `${Math.round(q.avg_pct * 100)}%`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {q.avg_distance_km === null ? '—' : formatDistance(q.avg_distance_km)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
