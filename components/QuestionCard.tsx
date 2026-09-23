'use client';

import { useEffect, useState } from 'react';
import type { PublicQuestion } from '@/types';
import { categoryLabel, cn } from '@/lib/utils';

/** Bottom-sheet question card that sits over the lower part of the globe. */
export function QuestionCard({
  question,
  children,
  compact = false,
}: {
  question: PublicQuestion | null;
  children?: React.ReactNode;
  /** Shrinks the question text once the answer is revealed, to give the reveal room. */
  compact?: boolean;
}) {
  const [showHint, setShowHint] = useState(false);
  useEffect(() => setShowHint(false), [question?.id]);

  return (
    <section
      className="pointer-events-auto relative z-20 rounded-t-[28px] border-t border-white/10 bg-navy-900/[0.97] px-5 pb-safe pt-3 shadow-sheet"
      aria-live="polite"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />

      {question ? (
        <div key={question.id} className="animate-sheet-up">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="chip bg-pitch/15 text-pitch">Q{question.position}</span>
            <span className={cn('chip', question.max_points >= 300 && 'bg-gold/15 text-gold')}>
              Worth {question.max_points} pts
            </span>
            <span className="chip">{categoryLabel(question.category)}</span>
          </div>

          <h2
            className={cn(
              'font-display font-semibold leading-snug transition-all duration-300',
              compact ? 'text-base text-mist' : 'text-xl',
            )}
          >
            {question.question_text}
          </h2>

          {question.hint && !compact && (
            <div className="mt-1.5 min-h-[28px]">
              {showHint ? (
                <p className="animate-fade-in text-[15px] italic text-mist">💡 {question.hint}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="-ml-1 min-h-[32px] px-1 text-[15px] font-medium text-pitch underline-offset-4 hover:underline"
                >
                  Need a hint?
                </button>
              )}
            </div>
          )}

          <div className="mt-3">{children}</div>
        </div>
      ) : (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-6 w-40 rounded-full" />
          <div className="skeleton h-7 w-full rounded-lg" />
          <div className="skeleton h-7 w-3/4 rounded-lg" />
          <div className="skeleton mt-4 h-12 w-full rounded-2xl" />
        </div>
      )}
    </section>
  );
}
