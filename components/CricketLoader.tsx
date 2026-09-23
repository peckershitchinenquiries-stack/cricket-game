import { cn } from '@/lib/utils';

/** Spinning cricket ball. */
export function CricketLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)} role="status">
      <svg viewBox="0 0 64 64" className="h-14 w-14" style={{ animation: 'spin-ball 0.9s linear infinite' }}>
        <defs>
          <radialGradient id="loader-ball" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#ff6b5b" />
            <stop offset="1" stopColor="#a4221b" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="url(#loader-ball)" />
        <path
          d="M14 14 C 26 26 26 38 14 50"
          stroke="#fff"
          strokeOpacity=".85"
          strokeWidth="2.5"
          strokeDasharray="3 3.5"
          fill="none"
        />
        <path
          d="M20 9 C 34 22 34 42 20 55"
          stroke="#fff"
          strokeOpacity=".85"
          strokeWidth="2.5"
          strokeDasharray="3 3.5"
          fill="none"
        />
      </svg>
      {label && <p className="text-[15px] text-mist">{label}</p>}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  );
}
