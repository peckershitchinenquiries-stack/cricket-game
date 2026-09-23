import { cn } from '@/lib/utils';

export function StreakCounter({ streak, best, className }: { streak: number; best?: number; className?: string }) {
  const days = streak === 1 ? 'day' : 'days';
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
          streak > 0 ? 'bg-gold/15' : 'bg-white/5 grayscale',
        )}
        aria-hidden="true"
      >
        🔥
      </div>
      <div>
        <p className="font-display text-xl font-bold leading-tight">
          {streak} {days}
        </p>
        <p className="text-sm text-mist">
          {streak > 0 ? 'Current streak' : 'Start a streak today'}
          {best !== undefined && best > 0 ? ` · Best ${best}` : ''}
        </p>
      </div>
    </div>
  );
}
