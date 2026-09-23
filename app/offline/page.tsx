import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { ReloadButton } from '@/components/ReloadButton';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

/** Precached by the service worker and served when a page can't be reached. */
export default function OfflinePage() {
  return (
    <main className="app-shell items-center justify-center px-6 text-center">
      <Logo size="md" className="justify-center" />
      <div className="mt-10 text-6xl" aria-hidden="true">
        📡
      </div>
      <h1 className="mt-4 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-mist">
        Come back when you&apos;re connected — today&apos;s round will be waiting for you.
      </p>
      <ReloadButton className="btn-primary mt-8 w-full max-w-xs" />
    </main>
  );
}
