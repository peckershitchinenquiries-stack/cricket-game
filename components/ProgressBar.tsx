import type { AnswerResult } from '@/types';
import { QUESTIONS_PER_ROUND } from '@/lib/config';
import { COLOR_HEX } from '@/lib/scoring';
import { cn } from '@/lib/utils';

/** Five segments: answered ones take their accuracy colour, the current one glows. */
export function ProgressBar({ current, answers }: { current: number; answers: AnswerResult[] }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Question ${current + 1} of ${QUESTIONS_PER_ROUND}`}>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: QUESTIONS_PER_ROUND }, (_, i) => {
          const answer = answers.find((a) => a.position === i + 1);
          return (
            <div key={i} className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  'absolute inset-0 origin-left rounded-full transition-transform duration-500',
                  !answer && i === current && 'bg-white/40',
                  !answer && i !== current && 'scale-x-0',
                )}
                style={answer ? { backgroundColor: COLOR_HEX[answer.color] } : undefined}
              />
            </div>
          );
        })}
      </div>
      <span className="min-w-[2.5rem] text-right font-display text-sm font-semibold text-mist">
        {Math.min(current + 1, QUESTIONS_PER_ROUND)}/{QUESTIONS_PER_ROUND}
      </span>
    </div>
  );
}
