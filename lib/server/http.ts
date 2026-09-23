import 'server-only';
import { NextResponse } from 'next/server';
import { GameError } from './game';

export function json<T>(data: T, init?: ResponseInit & { cacheSeconds?: number }): NextResponse<T> {
  const headers = new Headers(init?.headers);
  if (init?.cacheSeconds && init.cacheSeconds > 0) {
    headers.set('Cache-Control', `public, s-maxage=${init.cacheSeconds}, stale-while-revalidate=${init.cacheSeconds}`);
  } else if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store');
  }
  return NextResponse.json(data, { ...init, headers });
}

export function errorResponse(message: string, status = 400) {
  return json({ error: message }, { status });
}

/** Map any thrown error to a player-friendly response; log the real cause. */
export function handleError(error: unknown, context: string) {
  if (error instanceof GameError) return errorResponse(error.message, error.status);
  console.error(`[${context}]`, error);
  return errorResponse('Something went wrong on our side. Please try again in a moment.', 500);
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<Partial<T> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Partial<T>) : null;
  } catch {
    return null;
  }
}
