'use client';

import { useEffect, useState } from 'react';
import type { GameResult } from '@/types';
import { renderShareImage, shareResult } from '@/lib/share';
import { cn, haptic } from '@/lib/utils';

/** Share-card preview with the primary Share CTA (falls back to a clipboard copy where the OS share sheet isn't available). */
export function ShareCard({ result, showPreview = true }: { result: GameResult; showPreview?: boolean }) {
  const [image, setImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    renderShareImage(result)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage(blob);
        setPreviewUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [result]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const onShare = async () => {
    haptic(10);
    setBusy(true);
    const outcome = await shareResult(result, image);
    setBusy(false);
    if (outcome === 'copied') setToast('Result copied — paste it anywhere!');
    else if (outcome === 'failed') setToast('Couldn’t share — try copying instead');
  };

  return (
    <div className="relative">
      {showPreview && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-navy-950 shadow-lg">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL
            <img
              src={previewUrl}
              alt={`Share card: ${result.total_score} out of ${result.max_score}`}
              width={600}
              height={315}
              className="block h-auto w-full animate-fade-in"
            />
          ) : (
            <div className="skeleton aspect-[600/315] w-full" />
          )}
        </div>
      )}

      <button type="button" onClick={onShare} disabled={busy} className="btn-primary w-full animate-bounce-soft text-lg">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Share result
      </button>

      <div
        role="status"
        className={cn(
          'pointer-events-none absolute inset-x-0 -top-14 mx-auto w-fit rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-navy-950 shadow-lg transition-all duration-300',
          toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        )}
      >
        {toast}
      </div>
    </div>
  );
}
