import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../lib/auth.js';
import { generatePin } from '../lib/tokens.js';
import { getOwnedInvitation } from './invitations.js';

const householdSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().nullish().or(z.literal('').transform(() => null)),
  members: z.array(z.string().min(1).max(120)).min(1).max(20),
});

const bulkSchema = z.object({
  households: z.array(householdSchema).min(1).max(500),
});

async function createWithUniquePin(invitationId: string, data: z.infer<typeof householdSchema>) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await prisma.household.create({
        data: {
          invitationId,
          name: data.name,
          email: data.email ?? null,
          pin: generatePin(),
          members: { create: data.members.map((name) => ({ name })) },
        },
        include: { members: true },
      });
    } catch (err) {
      // P2002 = unique constraint violation (PIN collision within the invitation): retry
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
      throw err;
    }
  }
  throw new Error('could not allocate a unique PIN');
}

export async function householdRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireUser);

  app.post('/api/invitations/:id/households', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedInvitation(request.userId, id))) {
      return reply.code(404).send({ error: 'errors.notFound' });
    }
    const parsed = householdSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    return createWithUniquePin(id, parsed.data);
  });

  app.post('/api/invitations/:id/households/bulk', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedInvitation(request.userId, id))) {
      return reply.code(404).send({ error: 'errors.notFound' });
    }
    const parsed = bulkSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    const created = [];
    for (const h of parsed.data.households) created.push(await createWithUniquePin(id, h));
    return created;
  });

  const updateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().nullish().or(z.literal('').transform(() => null)),
    members: z
      .array(z.object({ id: z.string().optional(), name: z.string().min(1).max(120) }))
      .min(1)
      .max(20)
      .optional(),
  });

  async function getOwnedHousehold(userId: string, householdId: string) {
    return prisma.household.findFirst({
      where: { id: householdId, invitation: { hostId: userId } },
      include: { members: true },
    });
  }

  app.patch('/api/households/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const household = await getOwnedHousehold(request.userId, id);
    if (!household) return reply.code(404).send({ error: 'errors.notFound' });

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    const { members, ...rest } = parsed.data;

    return prisma.$transaction(async (tx) => {
      if (members) {
        const keepIds = members.filter((m) => m.id).map((m) => m.id as string);
        await tx.member.deleteMany({ where: { householdId: id, id: { notIn: keepIds } } });
        for (const m of members) {
          if (m.id) await tx.member.update({ where: { id: m.id }, data: { name: m.name } });
          else await tx.member.create({ data: { householdId: id, name: m.name } });
        }
      }
      return tx.household.update({
        where: { id },
        data: rest,
        include: { members: true },
      });
    });
  });

  app.post('/api/households/:id/regenerate-pin', async (request, reply) => {
    const { id } = request.params as { id: string };
    const household = await getOwnedHousehold(request.userId, id);
    if (!household) return reply.code(404).send({ error: 'errors.notFound' });
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return await prisma.household.update({ where: { id }, data: { pin: generatePin() } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    return reply.code(500).send({ error: 'errors.server' });
  });

  app.delete('/api/households/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const household = await getOwnedHousehold(request.userId, id);
    if (!household) return reply.code(404).send({ error: 'errors.notFound' });
    await prisma.household.delete({ where: { id } });
    return { ok: true };
  });
}
