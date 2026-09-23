'use client';

import { useState } from 'react';
import { AdminApiError, adminFetch } from '@/lib/admin-client';
import { parseQuestionImport } from '@/lib/csv';

const EXAMPLE_CSV = `question_text,hint,correct_lat,correct_lng,correct_label,category,difficulty
"Where is the Adelaide Oval?","Cathedral end",-34.9156,138.5961,"Adelaide, Australia",stadium,medium`;

export function BulkImport({ onImported, onCancel }: { onImported: (count: number) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  let preview: number | null = null;
  let parseError: string | null = null;
  try {
    preview = text.trim() ? parseQuestionImport(text).length : null;
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Could not parse input';
  }

  const onFile = async (file: File | undefined) => {
    if (file) setText(await file.text());
  };

  const onSubmit = async () => {
    setBusy(true);
    setErrors([]);
    try {
      const questions = parseQuestionImport(text);
      const { imported } = await adminFetch<{ imported: number }>('/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ questions }),
      });
      onImported(imported);
    } catch (err) {
      if (err instanceof AdminApiError && err.details?.length) setErrors([err.message, ...err.details]);
      else setErrors([err instanceof Error ? err.message : 'Import failed']);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[15px] text-mist">
        Paste a JSON array or CSV with columns{' '}
        <code className="text-white">
          question_text, hint, correct_lat, correct_lng, correct_label, category, difficulty
        </code>
        . The whole batch is rejected if any row is invalid.
      </p>

      <label className="btn-ghost w-full cursor-pointer">
        Choose .json or .csv file
        <input
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder={EXAMPLE_CSV}
        className="input py-2 font-mono text-sm"
        aria-label="Import data"
      />

      <p className="text-sm text-mist" aria-live="polite">
        {parseError ? (
          <span className="text-dot-red">{parseError}</span>
        ) : preview !== null ? (
          `${preview} question${preview === 1 ? '' : 's'} detected`
        ) : (
          'Nothing to import yet'
        )}
      </p>

      {errors.length > 0 && (
        <ul role="alert" className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-dot-red/10 p-3 text-sm text-dot-red">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !preview || !!parseError}
          className="btn-primary flex-1"
        >
          {busy ? 'Importing…' : `Import ${preview ?? ''}`}
        </button>
      </div>
    </div>
  );
}
