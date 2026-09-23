'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DailyRoundRow, Question } from '@/types';
import { QUESTION_WEIGHTS, QUESTIONS_PER_ROUND } from '@/lib/config';
import { adminFetch } from '@/lib/admin-client';
import { addDays, cn, formatDateLong, roundNumberFor, utcToday } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(first, -weekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ScheduleTab({ questions }: { questions: Question[] }) {
  const today = utcToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [rounds, setRounds] = useState<Map<string, string[]>>(new Map());
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const grid = useMemo(() => monthGrid(month), [month]);
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const load = useCallback(async () => {
    const { rounds: list } = await adminFetch<{ rounds: DailyRoundRow[] }>(
      `/rounds?from=${grid[0]}&to=${grid[grid.length - 1]}`,
    );
    setRounds(new Map(list.map((r) => [r.round_date, r.question_ids])));
  }, [grid]);

  useEffect(() => {
    load().catch((err) => setMessage({ tone: 'error', text: err.message }));
  }, [load]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await action();
      await load();
      setMessage({ tone: 'ok', text });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Action failed' });
    } finally {
      setBusy(false);
    }
  };

  const fillNext30 = () =>
    run(async () => {
      const { assigned } = await adminFetch<{ assigned: string[] }>('/rounds/auto', {
        method: 'POST',
        body: JSON.stringify({ start: today, days: 30, overwrite: false }),
      });
      return assigned.length ? `Scheduled ${assigned.length} new rounds` : 'The next 30 days are already scheduled';
    });

  const autoPick = (date: string) =>
    run(async () => {
      await adminFetch('/rounds/auto', { method: 'POST', body: JSON.stringify({ start: date, days: 1, overwrite: true }) });
      return `New random round for ${formatDateLong(date)}`;
    });

  const removeRound = (date: string) =>
    run(async () => {
      await adminFetch(`/rounds?date=${date}`, { method: 'DELETE' });
      return 'Round removed — it will be auto-generated if left empty';
    });

  const saveDraft = (date: string, ids: string[]) =>
    run(async () => {
      await adminFetch('/rounds', { method: 'PUT', body: JSON.stringify({ date, question_ids: ids }) });
      setDraft(null);
      return `Saved round for ${formatDateLong(date)}`;
    });

  const selectedIds = rounds.get(selected) ?? null;
  const locked = selected <= today;
  const draftValid = draft !== null && draft.every(Boolean) && new Set(draft).size === QUESTIONS_PER_ROUND;
  const pickable = questions.filter((q) => q.is_active || draft?.includes(q.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="btn-ghost h-10 min-h-0 w-10 px-0"
              aria-label="Previous month"
            >
              ‹
            </button>
            <h2 className="min-w-[10rem] text-center text-lg font-semibold">{monthLabel(month)}</h2>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="btn-ghost h-10 min-h-0 w-10 px-0"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <button type="button" onClick={fillNext30} disabled={busy} className="btn-primary min-h-[44px] px-4 text-sm">
            Auto-fill next 30 days
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-mist">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((date) => {
            const inMonth = date.startsWith(month);
            const has = rounds.has(date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  setSelected(date);
                  setDraft(null);
                }}
                className={cn(
                  'flex aspect-square min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors',
                  inMonth ? 'text-white' : 'text-mist/40',
                  date < today && 'opacity-50',
                  selected === date ? 'bg-pitch/20 ring-2 ring-pitch' : 'hover:bg-white/5',
                  date === today && selected !== date && 'ring-1 ring-gold',
                )}
                aria-label={`${formatDateLong(date)}${has ? ', scheduled' : ', empty'}`}
                aria-pressed={selected === date}
              >
                <span className="font-semibold">{Number(date.slice(8))}</span>
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', has ? 'bg-pitch' : 'bg-white/15')}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-mist">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-pitch" /> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" /> Empty (auto-generated on the day)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded ring-1 ring-gold" /> Today
          </span>
        </div>
      </section>

      <section className="card p-4">
        <p className="text-sm text-mist">
          Round #{roundNumberFor(selected)} {selected === today && '· Today'}
        </p>
        <h3 className="text-lg font-semibold">{formatDateLong(selected)}</h3>

        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'mt-3 rounded-xl px-3 py-2 text-sm',
              message.tone === 'ok' ? 'bg-pitch/10 text-pitch' : 'bg-dot-red/10 text-dot-red',
            )}
          >
            {message.text}
          </p>
        )}

        {draft ? (
          <div className="mt-4 space-y-3">
            {draft.map((id, i) => (
              <div key={i}>
                <label className="label" htmlFor={`slot-${i}`}>
                  Q{i + 1} · {QUESTION_WEIGHTS[i]} pts
                </label>
                <select
                  id={`slot-${i}`}
                  value={id}
                  onChange={(e) => setDraft(draft.map((d, j) => (j === i ? e.target.value : d)))}
                  className="input text-sm"
                >
                  <option value="">Choose a question…</option>
                  {pickable.map((q) => (
                    <option key={q.id} value={q.id} disabled={draft.includes(q.id) && q.id !== id}>
                      [{q.difficulty}] {q.question_text}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {!draftValid && <p className="text-sm text-mist">Pick five different questions.</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setDraft(null)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                type="button"
                disabled={!draftValid || busy}
                onClick={() => saveDraft(selected, draft)}
                className="btn-primary flex-1"
              >
                Save round
              </button>
            </div>
          </div>
        ) : (
          <>
            {selectedIds ? (
              <ol className="mt-4 space-y-2">
                {selectedIds.map((id, i) => {
                  const q = byId.get(id);
                  return (
                    <li key={id} className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs font-semibold text-mist">
                        Q{i + 1} · {QUESTION_WEIGHTS[i]} pts {q && `· ${q.difficulty}`}
                      </p>
                      <p className="text-[15px]">{q ? q.question_text : 'Deleted question'}</p>
                      {q && <p className="text-sm text-mist">📍 {q.correct_label}</p>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl bg-white/5 p-4 text-[15px] text-mist">
                No round scheduled. {selected >= today && 'One will be generated automatically when the day starts.'}
              </p>
            )}

            {locked ? (
              <p className="mt-4 text-sm text-mist">
                {selected === today
                  ? 'Today’s round is live and can’t be changed.'
                  : 'Past rounds are locked.'}
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(selectedIds ? [...selectedIds] : Array(QUESTIONS_PER_ROUND).fill(''))}
                  disabled={busy}
                  className="btn-ghost"
                >
                  {selectedIds ? 'Edit questions' : 'Pick questions manually'}
                </button>
                <button type="button" onClick={() => autoPick(selected)} disabled={busy} className="btn-ghost">
                  {selectedIds ? 'Re-roll randomly' : 'Auto-pick 5 questions'}
                </button>
                {selectedIds && (
                  <button
                    type="button"
                    onClick={() => removeRound(selected)}
                    disabled={busy}
                    className="btn-ghost text-dot-red"
                  >
                    Clear round
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
