import 'server-only';
import { getServiceSupabase } from './supabase-admin';
import { isSupabaseServerConfigured } from './repo';

export type AdminCheck = { ok: true; email: string } | { ok: false; status: 401 | 403; error: string };

function allowedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verify the caller is an admin: a valid Supabase access token (Bearer) whose
 * email is listed in ADMIN_EMAILS. In local memory mode (no Supabase, not
 * production) the admin panel is open so it can be developed without setup.
 */
export async function requireAdmin(request: Request): Promise<AdminCheck> {
  if (!isSupabaseServerConfigured()) {
    if (process.env.NODE_ENV !== 'production') return { ok: true, email: 'dev@localhost' };
    return { ok: false, status: 403, error: 'Admin is unavailable: Supabase is not configured' };
  }

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { ok: false, status: 401, error: 'Sign in required' };

  const { data, error } = await getServiceSupabase().auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) return { ok: false, status: 401, error: 'Session expired — please sign in again' };

  if (!allowedEmails().includes(email)) {
    return { ok: false, status: 403, error: 'This account is not an admin' };
  }
  return { ok: true, email };
}
