'use client';

import type { AnswerResult } from '@/types';
import { COLOR_HEX, COLOR_LABEL } from '@/lib/scoring';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';
import { Confetti } from './Confetti';

/** Animated "+points" with the accuracy dot. Celebrates very close answers. */
export function ScoreReveal({ answer }: { answer: AnswerResult }) {
  const points = useCountUp(answer.points, { from: 0, duration: 800, delay: 350 });
  const celebrate = answer.distance_km <= 100;
  const color = COLOR_HEX[answer.color];

  return (
    <div className="relative flex shrink-0 flex-col items-end text-right">
      {celebrate && <Confetti />}
      <div className="flex items-center gap-2">
        <span
          className={cn('h-4 w-4 animate-dot-pop rounded-full', answer.color === 'green' && 'animate-glow-pulse')}
          style={{ backgroundColor: color, animationDelay: '250ms' }}
          aria-hidden="true"
        />
        <span className="font-display text-3xl font-extrabold tabular-nums" style={{ color }}>
          +{points}
        </span>
      </div>
      <p className="text-[14px] text-mist">
        {COLOR_LABEL[answer.color]} · of {answer.max_points}
      </p>
    </div>
  );
}
