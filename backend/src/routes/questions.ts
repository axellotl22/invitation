import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../lib/auth.js';
import { getOwnedInvitation } from './invitations.js';

const questionSchema = z
  .object({
    type: z.enum(['TEXT', 'YES_NO', 'SINGLE_CHOICE', 'MULTI_CHOICE']),
    scope: z.enum(['PER_HOUSEHOLD', 'PER_MEMBER']),
    required: z.boolean().optional(),
    labelEn: z.string().min(1).max(500),
    labelDe: z.string().min(1).max(500),
    optionsEn: z.array(z.string().min(1).max(200)).max(20).optional(),
    optionsDe: z.array(z.string().min(1).max(200)).max(20).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (q) => {
      if (q.type !== 'SINGLE_CHOICE' && q.type !== 'MULTI_CHOICE') return true;
      const en = q.optionsEn ?? [];
      const de = q.optionsDe ?? [];
      return en.length >= 2 && en.length === de.length;
    },
    { message: 'choice questions need the same number of options (>= 2) in both languages' },
  );

function serialize(data: z.infer<typeof questionSchema>) {
  return {
    type: data.type,
    scope: data.scope,
    required: data.required ?? false,
    labelEn: data.labelEn,
    labelDe: data.labelDe,
    optionsEn: JSON.stringify(data.optionsEn ?? []),
    optionsDe: JSON.stringify(data.optionsDe ?? []),
    sortOrder: data.sortOrder ?? 0,
  };
}

export async function questionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireUser);

  app.post('/api/invitations/:id/questions', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedInvitation(request.userId, id))) {
      return reply.code(404).send({ error: 'errors.notFound' });
    }
    const parsed = questionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    return prisma.question.create({ data: { invitationId: id, ...serialize(parsed.data) } });
  });

  app.patch('/api/questions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const question = await prisma.question.findFirst({
      where: { id, invitation: { hostId: request.userId } },
    });
    if (!question) return reply.code(404).send({ error: 'errors.notFound' });
    const parsed = questionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    return prisma.question.update({ where: { id }, data: serialize(parsed.data) });
  });

  app.delete('/api/questions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const question = await prisma.question.findFirst({
      where: { id, invitation: { hostId: request.userId } },
    });
    if (!question) return reply.code(404).send({ error: 'errors.notFound' });
    await prisma.question.delete({ where: { id } });
    return { ok: true };
  });
}
