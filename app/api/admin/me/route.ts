import { requireAdmin } from '@/lib/server/admin-auth';
import { errorResponse, json } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return errorResponse(auth.error, auth.status);
  return json({ email: auth.email, mode: getRepo().mode });
}
