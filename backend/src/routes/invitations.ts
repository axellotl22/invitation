import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../lib/auth.js';
import { generateSlug } from '../lib/tokens.js';
import { findDuplicates } from '../services/duplicates.js';

const invitationSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullish(),
  location: z.string().max(300).nullish(),
  startsAt: z.coerce.date(),
  rsvpDeadline: z.coerce.date().nullish(),
  imageUrl: z.string().max(500).nullish(),
  isOpen: z.boolean().optional(),
  defaultLocale: z.enum(['en', 'de']).optional(),
});

export async function getOwnedInvitation(userId: string, invitationId: string) {
  return prisma.invitation.findFirst({ where: { id: invitationId, hostId: userId } });
}

export async function invitationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireUser);

  app.get('/api/invitations', async (request) => {
    const invitations = await prisma.invitation.findMany({
      where: { hostId: request.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        households: {
          where: { duplicateOfId: null },
          include: { members: true },
        },
      },
    });
    return invitations.map((inv) => ({
      ...inv,
      households: undefined,
      stats: computeStats(inv.households),
    }));
  });

  app.post('/api/invitations', async (request, reply) => {
    const parsed = invitationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    const invitation = await prisma.invitation.create({
      data: { ...parsed.data, slug: generateSlug(), hostId: request.userId },
    });
    return invitation;
  });

  app.get('/api/invitations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invitation = await prisma.invitation.findFirst({
      where: { id, hostId: request.userId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        households: {
          where: { duplicateOfId: null },
          include: { members: true, answers: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!invitation) return reply.code(404).send({ error: 'errors.notFound' });
    return { ...invitation, stats: computeStats(invitation.households) };
  });

  app.patch('/api/invitations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedInvitation(request.userId, id))) {
      return reply.code(404).send({ error: 'errors.notFound' });
    }
    const parsed = invitationSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    return prisma.invitation.update({ where: { id }, data: parsed.data });
  });

  app.delete('/api/invitations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedInvitation(request.userId, id))) {
      return reply.code(404).send({ error: 'errors.notFound' });
    }
    await prisma.invitation.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/api/invitations/:id/duplicates', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedInvitation(request.userId, id))) {
      return reply.code(404).send({ error: 'errors.notFound' });
    }
    return findDuplicates(id);
  });

  const resolveSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('merge'), winnerId: z.string(), loserId: z.string() }),
    z.object({ action: z.literal('keep'), aId: z.string(), bId: z.string() }),
    z.object({ action: z.literal('delete'), householdId: z.string() }),
  ]);

  app.post('/api/invitations/:id/duplicates/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedInvitation(request.userId, id))) {
      return reply.code(404).send({ error: 'errors.notFound' });
    }
    const parsed = resolveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    const data = parsed.data;

    if (data.action === 'merge') {
      const [winner, loser] = await Promise.all([
        prisma.household.findFirst({ where: { id: data.winnerId, invitationId: id } }),
        prisma.household.findFirst({ where: { id: data.loserId, invitationId: id } }),
      ]);
      if (!winner || !loser || winner.id === loser.id) {
        return reply.code(400).send({ error: 'errors.validation' });
      }
      await prisma.household.update({
        where: { id: loser.id },
        data: { duplicateOfId: winner.id },
      });
    } else if (data.action === 'keep') {
      const [aId, bId] = [data.aId, data.bId].sort();
      await prisma.dismissedPair.upsert({
        where: { invitationId_aId_bId: { invitationId: id, aId, bId } },
        create: { invitationId: id, aId, bId },
        update: {},
      });
    } else {
      const household = await prisma.household.findFirst({
        where: { id: data.householdId, invitationId: id },
      });
      if (!household) return reply.code(404).send({ error: 'errors.notFound' });
      await prisma.household.delete({ where: { id: household.id } });
    }
    return { ok: true };
  });

  app.get('/api/invitations/:id/rsvps.csv', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invitation = await prisma.invitation.findFirst({
      where: { id, hostId: request.userId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        households: {
          where: { duplicateOfId: null },
          include: { members: true, answers: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!invitation) return reply.code(404).send({ error: 'errors.notFound' });

    const lang = (request.query as { lang?: string }).lang === 'de' ? 'de' : 'en';
    const csv = buildCsv(invitation, lang);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="rsvps-${invitation.slug}.csv"`);
    return csv;
  });
}

function computeStats(households: { rsvpStatus: string; members: { attending: boolean | null }[] }[]) {
  const stats = {
    households: households.length,
    responded: 0,
    pending: 0,
    attending: 0,
    declined: 0,
    unanswered: 0,
  };
  for (const h of households) {
    if (h.rsvpStatus === 'RESPONDED') stats.responded++;
    else stats.pending++;
    for (const m of h.members) {
      if (m.attending === true) stats.attending++;
      else if (m.attending === false) stats.declined++;
      else stats.unanswered++;
    }
  }
  return stats;
}

interface CsvInvitation {
  questions: { id: string; type: string; scope: string; labelEn: string; labelDe: string; optionsEn: string; optionsDe: string }[];
  households: {
    name: string;
    email: string | null;
    pin: string;
    rsvpStatus: string;
    message: string | null;
    members: { id: string; name: string; attending: boolean | null }[];
    answers: { questionId: string; memberId: string | null; value: string }[];
  }[];
}

function buildCsv(invitation: CsvInvitation, lang: 'en' | 'de'): string {
  const label = (q: CsvInvitation['questions'][number]) => (lang === 'de' ? q.labelDe : q.labelEn);
  const options = (q: CsvInvitation['questions'][number]) =>
    JSON.parse(lang === 'de' ? q.optionsDe : q.optionsEn) as string[];

  const header = ['Household', 'Email', 'PIN', 'Status', 'Members attending', 'Members declined', 'Message'];
  for (const q of invitation.questions) header.push(label(q));

  const rows = [header];
  for (const h of invitation.households) {
    const attending = h.members.filter((m) => m.attending === true).map((m) => m.name);
    const declined = h.members.filter((m) => m.attending === false).map((m) => m.name);
    const row = [
      h.name,
      h.email ?? '',
      h.pin,
      h.rsvpStatus,
      attending.join('; '),
      declined.join('; '),
      h.message ?? '',
    ];
    for (const q of invitation.questions) {
      const answers = h.answers.filter((a) => a.questionId === q.id);
      const fmt = (value: string): string => {
        const parsed = JSON.parse(value) as unknown;
        if (q.type === 'SINGLE_CHOICE' && typeof parsed === 'number') return options(q)[parsed] ?? '';
        if (q.type === 'MULTI_CHOICE' && Array.isArray(parsed)) {
          return (parsed as number[]).map((i) => options(q)[i] ?? '').join('; ');
        }
        return String(parsed ?? '');
      };
      if (q.scope === 'PER_HOUSEHOLD') {
        row.push(answers[0] ? fmt(answers[0].value) : '');
      } else {
        row.push(
          answers
            .map((a) => {
              const member = h.members.find((m) => m.id === a.memberId);
              return `${member?.name ?? '?'}: ${fmt(a.value)}`;
            })
            .join('; '),
        );
      }
    }
    rows.push(row);
  }
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
