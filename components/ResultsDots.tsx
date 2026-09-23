import type { AccuracyColor } from '@/types';
import { COLOR_HEX, COLOR_LABEL } from '@/lib/scoring';
import { cn } from '@/lib/utils';

/** Row of accuracy dots. `stagger` makes them pop in one by one. */
export function ResultsDots({
  colors,
  size = 'md',
  stagger = false,
  delayMs = 0,
  className,
}: {
  colors: AccuracyColor[];
  size?: 'sm' | 'md' | 'lg';
  stagger?: boolean;
  delayMs?: number;
  className?: string;
}) {
  const dim = { sm: 'h-3.5 w-3.5', md: 'h-6 w-6', lg: 'h-10 w-10' }[size];
  return (
    <div
      className={cn('flex items-center gap-2.5', className)}
      role="img"
      aria-label={colors.map((c) => COLOR_LABEL[c]).join(', ')}
    >
      {colors.map((color, i) => (
        <span
          key={i}
          className={cn('rounded-full', dim, stagger && 'animate-dot-pop')}
          style={{
            backgroundColor: COLOR_HEX[color],
            boxShadow: `0 0 14px ${COLOR_HEX[color]}66`,
            animationDelay: stagger ? `${delayMs + i * 180}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
