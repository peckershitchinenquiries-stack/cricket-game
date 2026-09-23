'use client';

import { useState } from 'react';
import type { Question } from '@/types';
import { LocationPicker } from '@/components/admin/LocationPicker';
import { adminFetch } from '@/lib/admin-client';
import { CATEGORY_LABELS } from '@/lib/utils';

interface FormState {
  question_text: string;
  hint: string;
  correct_label: string;
  correct_lat: string;
  correct_lng: string;
  category: string;
  difficulty: string;
  is_active: boolean;
}

function toForm(q?: Question | null): FormState {
  return {
    question_text: q?.question_text ?? '',
    hint: q?.hint ?? '',
    correct_label: q?.correct_label ?? '',
    correct_lat: q ? String(q.correct_lat) : '',
    correct_lng: q ? String(q.correct_lng) : '',
    category: q?.category ?? 'stadium',
    difficulty: q?.difficulty ?? 'medium',
    is_active: q?.is_active ?? true,
  };
}

/** Create or edit a question. Location can be typed or picked on the mini globe. */
export function AdminQuestionForm({
  question,
  onSaved,
  onCancel,
}: {
  question?: Question | null;
  onSaved: (q: Question) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(question));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const lat = Number(form.correct_lat);
  const lng = Number(form.correct_lng);
  const hasPoint = form.correct_lat !== '' && form.correct_lng !== '' && Number.isFinite(lat) && Number.isFinite(lng);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, correct_lat: lat, correct_lng: lng };
    try {
      const { question: saved } = question
        ? await adminFetch<{ question: Question }>(`/questions/${question.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await adminFetch<{ question: Question }>('/questions', { method: 'POST', body: JSON.stringify(payload) });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="q-text">
          Question
        </label>
        <textarea
          id="q-text"
          required
          rows={2}
          maxLength={300}
          value={form.question_text}
          onChange={(e) => set('question_text', e.target.value)}
          className="input py-2"
          placeholder="Where is the Melbourne Cricket Ground?"
        />
      </div>

      <div>
        <label className="label" htmlFor="q-hint">
          Hint <span className="text-mist/60">(optional)</span>
        </label>
        <input
          id="q-hint"
          maxLength={200}
          value={form.hint}
          onChange={(e) => set('hint', e.target.value)}
          className="input"
          placeholder="Home of the Boxing Day Test"
        />
      </div>

      <div>
        <label className="label" htmlFor="q-label">
          Answer label (shown after answering)
        </label>
        <input
          id="q-label"
          required
          maxLength={120}
          value={form.correct_label}
          onChange={(e) => set('correct_label', e.target.value)}
          className="input"
          placeholder="Melbourne, Australia"
        />
      </div>

      <div>
        <span className="label">Answer location</span>
        <LocationPicker
          value={hasPoint ? { lat, lng } : null}
          onChange={(p) => setForm((f) => ({ ...f, correct_lat: String(p.lat), correct_lng: String(p.lng) }))}
        />
        <div className="mt-2 grid grid-cols-2 gap-3">
          <input
            aria-label="Latitude"
            required
            inputMode="decimal"
            value={form.correct_lat}
            onChange={(e) => set('correct_lat', e.target.value)}
            className="input"
            placeholder="Latitude (-37.82)"
          />
          <input
            aria-label="Longitude"
            required
            inputMode="decimal"
            value={form.correct_lng}
            onChange={(e) => set('correct_lng', e.target.value)}
            className="input"
            placeholder="Longitude (144.98)"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="q-cat">
            Category
          </label>
          <select id="q-cat" value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q-diff">
            Difficulty
          </label>
          <select
            id="q-diff"
            value={form.difficulty}
            onChange={(e) => set('difficulty', e.target.value)}
            className="input"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => set('is_active', e.target.checked)}
          className="h-5 w-5 accent-pitch"
        />
        <span>Active (eligible for auto-scheduling)</span>
      </label>

      {error && (
        <p role="alert" className="text-dot-red">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? 'Saving…' : question ? 'Save changes' : 'Add question'}
        </button>
      </div>
    </form>
  );
}
