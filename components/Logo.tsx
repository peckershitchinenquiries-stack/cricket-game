import { cn } from '@/lib/utils';

export function StumpsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="7" y="8" width="3.4" height="20" rx="1.7" fill="#00c853" />
      <rect x="14.3" y="8" width="3.4" height="20" rx="1.7" fill="#00c853" />
      <rect x="21.6" y="8" width="3.4" height="20" rx="1.7" fill="#00c853" />
      <rect x="6" y="5" width="9.5" height="2.2" rx="1.1" fill="#ffd700" />
      <rect x="16.5" y="5" width="9.5" height="2.2" rx="1.1" fill="#ffd700" />
    </svg>
  );
}

/** Wordmark. The split "Crick" + "Tap" styling lives here — change it with APP_NAME. */
export function Logo({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const text = { sm: 'text-xl', md: 'text-2xl', lg: 'text-5xl' }[size];
  const icon = { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-14 w-14' }[size];
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StumpsIcon className={icon} />
      <span className={cn('font-display font-extrabold tracking-tight', text)}>
        Crick<span className="text-pitch">Tap</span>
      </span>
    </div>
  );
}
