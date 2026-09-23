import type { QuestionInput } from '@/types';
import { adminHandler } from '@/lib/server/admin-route';
import { errorResponse, json, readJson } from '@/lib/server/http';
import { getRepo } from '@/lib/server/repo';
import { validateQuestion } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';

export const GET = adminHandler('questions.list', async () => {
  return json({ questions: await getRepo().listQuestions() });
});

export const POST = adminHandler('questions.create', async (request) => {
  const result = validateQuestion(await readJson(request));
  if (!result.ok) return errorResponse(result.error);
  const [question] = await getRepo().createQuestions([result.value as QuestionInput]);
  return json({ question }, { status: 201 });
});
