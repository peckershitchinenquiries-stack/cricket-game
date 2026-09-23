import 'server-only';
import { requireAdmin } from './admin-auth';
import { errorResponse, handleError } from './http';

/** Wrap an admin route handler with auth + error handling. */
export function adminHandler<C = unknown>(
  context: string,
  handler: (request: Request, ctx: C) => Promise<Response>,
) {
  return async (request: Request, ctx: C) => {
    const auth = await requireAdmin(request);
    if (!auth.ok) return errorResponse(auth.error, auth.status);
    try {
      return await handler(request, ctx);
    } catch (error) {
      return handleError(error, `admin:${context}`);
    }
  };
}
