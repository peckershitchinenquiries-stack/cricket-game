'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Question } from '@/types';
import { CricketLoader } from '@/components/CricketLoader';
import { Logo } from '@/components/Logo';
import { AdminApiError, adminFetch, adminSignOut } from '@/lib/admin-client';
import { cn } from '@/lib/utils';
import { QuestionsTab } from './QuestionsTab';
import { ScheduleTab } from './ScheduleTab';
import { StatsTab } from './StatsTab';

type Tab = 'questions' | 'schedule' | 'stats';
type AuthState = { status: 'loading' } | { status: 'ok'; email: string; mode: string } | { status: 'denied'; error: string };

const TABS: { id: Tab; label: string }[] = [
  { id: 'questions', label: 'Questions' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'stats', label: 'Stats' },
];

export function AdminDashboard() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('questions');
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ email: string; mode: string }>('/me')
      .then((me) => setAuth({ status: 'ok', ...me }))
      .catch((err) => {
        if (err instanceof AdminApiError && err.status === 401) router.replace('/admin/login');
        else setAuth({ status: 'denied', error: err instanceof Error ? err.message : 'Not authorised' });
      });
  }, [router]);

  const reloadQuestions = useCallback(async () => {
    try {
      const { questions: list } = await adminFetch<{ questions: Question[] }>('/questions');
      setQuestions(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load questions');
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'ok') void reloadQuestions();
  }, [auth.status, reloadQuestions]);

  const signOut = async () => {
    await adminSignOut();
    router.replace('/admin/login');
  };

  if (auth.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <CricketLoader label="Checking access…" />
      </main>
    );
  }

  if (auth.status === 'denied') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">No access</h1>
        <p className="mt-2 text-mist">{auth.error}</p>
        <button type="button" onClick={signOut} className="btn-ghost mt-6 w-full">
          Sign in with another account
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <span className="chip">Admin</span>
          {auth.mode === 'memory' && (
            <span className="chip bg-dot-orange/15 text-dot-orange" title="Supabase not configured">
              Memory mode — changes reset on restart
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-mist">
          <span className="hidden sm:inline">{auth.email}</span>
          {auth.mode !== 'memory' && (
            <button type="button" onClick={signOut} className="btn-ghost min-h-[40px] px-4 text-sm">
              Sign out
            </button>
          )}
        </div>
      </header>

      <nav className="sticky top-0 z-10 -mx-4 mb-6 flex gap-1 border-b border-white/10 bg-navy-950/95 px-4 sm:-mx-6 sm:px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'min-h-[48px] border-b-2 px-4 font-display font-semibold transition-colors',
              tab === t.id ? 'border-pitch text-white' : 'border-transparent text-mist hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loadError && (
        <p role="alert" className="card mb-4 p-4 text-dot-red">
          {loadError}
        </p>
      )}

      {tab === 'questions' && <QuestionsTab questions={questions} onChange={reloadQuestions} />}
      {tab === 'schedule' && <ScheduleTab questions={questions ?? []} />}
      {tab === 'stats' && <StatsTab />}
    </main>
  );
}
