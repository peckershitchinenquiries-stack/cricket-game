'use client';

import { getBrowserSupabase, isSupabaseConfigured } from './supabase';

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: string[],
  ) {
    super(message);
  }
}

async function accessToken(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** fetch() for /api/admin/* with the admin's bearer token attached. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = await accessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api/admin${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AdminApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.details);
  }
  return body as T;
}

export async function adminSignOut(): Promise<void> {
  await getBrowserSupabase()?.auth.signOut();
}

export { isSupabaseConfigured };
