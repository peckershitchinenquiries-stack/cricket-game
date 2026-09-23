'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-shell items-center justify-center px-6 text-center">
      <div className="text-6xl" aria-hidden="true">
        🌧️
      </div>
      <h1 className="mt-4 text-2xl font-bold">Rain stopped play</h1>
      <p className="mt-2 max-w-xs text-mist">Something went wrong. Let&apos;s get the covers off and try again.</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button type="button" className="btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn-ghost">
          Back home
        </Link>
      </div>
    </main>
  );
}
