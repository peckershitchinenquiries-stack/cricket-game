import type { AnswerResult } from '@/types';
import { formatDistance } from '@/lib/utils';

/** Correct answer + how far the pin landed from it. */
export function DistanceReveal({ answer }: { answer: AnswerResult }) {
  const bullseye = answer.distance_km <= 50;
  return (
    <div className="animate-rise min-w-0 flex-1">
      <p className="text-[13px] font-medium uppercase tracking-wider text-mist">Answer</p>
      <p className="truncate font-display text-lg font-semibold text-white" title={answer.correct_label}>
        📍 {answer.correct_label}
      </p>
      <p className="mt-0.5 text-[15px] text-mist">
        {bullseye ? (
          <span className="font-semibold text-pitch">Bullseye! {formatDistance(answer.distance_km)} away</span>
        ) : (
          <>
            <span className="font-semibold text-white">{formatDistance(answer.distance_km)}</span> away
          </>
        )}
      </p>
    </div>
  );
}
