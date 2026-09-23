'use client';

import { useMemo, useState } from 'react';
import type { Question } from '@/types';
import { AdminQuestionForm } from '@/components/AdminQuestionForm';
import { adminFetch } from '@/lib/admin-client';
import { categoryLabel, cn } from '@/lib/utils';
import { BulkImport } from './BulkImport';
import { Modal } from './Modal';

type Editing = { kind: 'new' } | { kind: 'edit'; question: Question } | { kind: 'bulk' } | null;

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: 'bg-pitch/15 text-pitch',
  medium: 'bg-gold/15 text-gold',
  hard: 'bg-dot-red/15 text-dot-red',
};

export function QuestionsTab({ questions, onChange }: { questions: Question[] | null; onChange: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set((questions ?? []).map((q) => q.category))].sort(),
    [questions],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (questions ?? []).filter(
      (q) =>
        (category === 'all' || q.category === category) &&
        (status === 'all' || (status === 'active') === q.is_active) &&
        (!term || q.question_text.toLowerCase().includes(term) || q.correct_label.toLowerCase().includes(term)),
    );
  }, [questions, search, category, status]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const toggleActive = async (q: Question) => {
    try {
      await adminFetch(`/questions/${q.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !q.is_active }) });
      await onChange();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const remove = async (q: Question) => {
    if (!window.confirm(`Delete "${q.question_text}"?\n\nQuestions already used in a round are archived instead.`)) return;
    try {
      const { outcome } = await adminFetch<{ outcome: string }>(`/questions/${q.id}`, { method: 'DELETE' });
      flash(outcome === 'archived' ? 'Used in a round, so archived (set inactive)' : 'Question deleted');
      await onChange();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const closeAndReload = async (message: string) => {
    setEditing(null);
    flash(message);
    await onChange();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions or answers…"
          className="input min-w-[200px] flex-1"
          aria-label="Search"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-auto" aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="input w-auto"
          aria-label="Status"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist">
          {questions ? `${filtered.length} of ${questions.length} questions` : 'Loading…'}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setEditing({ kind: 'bulk' })} className="btn-ghost min-h-[44px] px-4">
            Bulk import
          </button>
          <button type="button" onClick={() => setEditing({ kind: 'new' })} className="btn-primary min-h-[44px] px-4">
            + Add question
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-pitch/10 px-4 py-3 text-[15px] text-pitch">
          {notice}
        </p>
      )}

      <ul className="space-y-2">
        {!questions &&
          Array.from({ length: 6 }, (_, i) => <li key={i} className="skeleton h-20 rounded-2xl" aria-hidden="true" />)}
        {filtered.map((q) => (
          <li key={q.id} className={cn('card flex flex-wrap items-center gap-3 p-4', !q.is_active && 'opacity-60')}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{q.question_text}</p>
              <p className="mt-1 text-sm text-mist">
                📍 {q.correct_label}{' '}
                <span className="text-mist/60">
                  ({q.correct_lat.toFixed(3)}, {q.correct_lng.toFixed(3)})
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">{categoryLabel(q.category)}</span>
                <span className={cn('chip', DIFFICULTY_STYLE[q.difficulty])}>{q.difficulty}</span>
                {!q.is_active && <span className="chip">Inactive</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleActive(q)}
                className="btn-ghost min-h-[40px] px-3 text-sm"
                title={q.is_active ? 'Exclude from auto-scheduling' : 'Include in auto-scheduling'}
              >
                {q.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => setEditing({ kind: 'edit', question: q })}
                className="btn-ghost min-h-[40px] px-3 text-sm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(q)}
                className="btn-ghost min-h-[40px] px-3 text-sm text-dot-red"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {questions && filtered.length === 0 && (
          <li className="card p-8 text-center text-mist">No questions match these filters.</li>
        )}
      </ul>

      {editing?.kind === 'new' && (
        <Modal title="Add question" onClose={() => setEditing(null)}>
          <AdminQuestionForm onCancel={() => setEditing(null)} onSaved={() => closeAndReload('Question added')} />
        </Modal>
      )}
      {editing?.kind === 'edit' && (
        <Modal title="Edit question" onClose={() => setEditing(null)}>
          <AdminQuestionForm
            question={editing.question}
            onCancel={() => setEditing(null)}
            onSaved={() => closeAndReload('Changes saved')}
          />
        </Modal>
      )}
      {editing?.kind === 'bulk' && (
        <Modal title="Bulk import" onClose={() => setEditing(null)} wide>
          <BulkImport onCancel={() => setEditing(null)} onImported={(n) => closeAndReload(`Imported ${n} questions`)} />
        </Modal>
      )}
    </div>
  );
}
