'use client';

export function ReloadButton({ className, label = 'Try again' }: { className?: string; label?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.location.reload()}>
      {label}
    </button>
  );
}
