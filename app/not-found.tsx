import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="app-shell items-center justify-center px-6 text-center">
      <p className="font-display text-7xl font-extrabold text-pitch">404</p>
      <h1 className="mt-2 text-2xl font-bold">Lost in the outfield</h1>
      <p className="mt-2 max-w-xs text-mist">That page has gone for six. Let&apos;s get you back to the middle.</p>
      <Link href="/" className="btn-primary mt-8 w-full max-w-xs">
        Back home
      </Link>
    </main>
  );
}
