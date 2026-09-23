'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { adminFetch, adminSignOut, isSupabaseConfigured } from '@/lib/admin-client';
import { getBrowserSupabase } from '@/lib/supabase';

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'Wrong email or password' : signInError.message);
      setBusy(false);
      return;
    }
    try {
      await adminFetch('/me');
      router.replace('/admin');
    } catch (err) {
      await adminSignOut();
      setError(err instanceof Error ? err.message : 'Not authorised');
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Logo className="justify-center" />
      <h1 className="mt-6 text-center text-2xl font-bold">Admin sign in</h1>

      {!isSupabaseConfigured ? (
        <div className="card mt-6 p-5 text-[15px] text-mist">
          <p className="font-semibold text-white">Supabase isn&apos;t configured.</p>
          <p className="mt-2">
            The app is running in local memory mode. In development the admin panel is open without signing in.
          </p>
          <Link href="/admin" className="btn-primary mt-4 w-full">
            Open admin (dev)
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-5">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          {error && (
            <p role="alert" className="text-[15px] text-dot-red">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </main>
  );
}
