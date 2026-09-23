import { adminHandler } from '@/lib/server/admin-route';
import { errorResponse, json, readJson } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo';
import { validateQuestion } from '@/lib/server/validate';
import { isUuid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminHandler<Ctx>('questions.update', async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return errorResponse('Invalid id');
  const result = validateQuestion(await readJson(request), true);
  if (!result.ok) return errorResponse(result.error);
  const question = await getRepo().updateQuestion(id, result.value);
  if (!question) return errorResponse('Question not found', 404);
  return json({ question });
});

export const DELETE = adminHandler<Ctx>('questions.delete', async (_request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return errorResponse('Invalid id');
  const outcome = await getRepo().deleteQuestion(id);
  if (outcome === 'not_found') return errorResponse('Question not found', 404);
  return json({ outcome });
});
