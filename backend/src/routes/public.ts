import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signHouseholdToken, verifyHouseholdToken } from '../lib/auth.js';

function publicInvitation(inv: {
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  rsvpDeadline: Date | null;
  imageUrl: string | null;
  isOpen: boolean;
  defaultLocale: string;
}) {
  return {
    slug: inv.slug,
    title: inv.title,
    description: inv.description,
    location: inv.location,
    startsAt: inv.startsAt,
    rsvpDeadline: inv.rsvpDeadline,
    imageUrl: inv.imageUrl,
    isOpen: inv.isOpen,
    defaultLocale: inv.defaultLocale,
  };
}

function rsvpClosed(inv: { isOpen: boolean; rsvpDeadline: Date | null }): boolean {
  if (!inv.isOpen) return true;
  return inv.rsvpDeadline !== null && inv.rsvpDeadline.getTime() < Date.now();
}

interface HouseholdContext {
  householdId: string;
  invitation: { id: string; slug: string; isOpen: boolean; rsvpDeadline: Date | null };
}

async function resolveHouseholdToken(
  request: FastifyRequest,
  reply: FastifyReply,
  slug: string,
): Promise<HouseholdContext | null> {
  const token = request.headers['x-household-token'];
  const payload = typeof token === 'string' ? verifyHouseholdToken(token) : null;
  if (!payload) {
    reply.code(401).send({ error: 'errors.pin.sessionExpired' });
    return null;
  }
  const invitation = await prisma.invitation.findUnique({ where: { slug } });
  if (!invitation || invitation.id !== payload.invitationId) {
    reply.code(404).send({ error: 'errors.notFound' });
    return null;
  }
  return { householdId: payload.householdId, invitation };
}

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/i/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const invitation = await prisma.invitation.findUnique({ where: { slug } });
    if (!invitation) return reply.code(404).send({ error: 'errors.notFound' });
    return { ...publicInvitation(invitation), rsvpClosed: rsvpClosed(invitation) };
  });

  app.post(
    '/api/i/:slug/pin',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const parsed = z.object({ pin: z.string().regex(/^\d{6}$/) }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'errors.pin.invalid' });

      const invitation = await prisma.invitation.findUnique({ where: { slug } });
      if (!invitation) return reply.code(404).send({ error: 'errors.notFound' });

      let household = await prisma.household.findUnique({
        where: { invitationId_pin: { invitationId: invitation.id, pin: parsed.data.pin } },
      });
      // Follow merges done by the duplicate resolver (bounded to avoid cycles)
      for (let hops = 0; household?.duplicateOfId && hops < 5; hops++) {
        household = await prisma.household.findUnique({ where: { id: household.duplicateOfId } });
      }
      if (!household || household.duplicateOfId) {
        return reply.code(401).send({ error: 'errors.pin.invalid' });
      }
      return { token: signHouseholdToken(household.id, invitation.id) };
    },
  );

  app.get('/api/i/:slug/household', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const ctx = await resolveHouseholdToken(request, reply, slug);
    if (!ctx) return;

    const household = await prisma.household.findUnique({
      where: { id: ctx.householdId },
      include: { members: true, answers: true },
    });
    if (!household) return reply.code(404).send({ error: 'errors.notFound' });

    const questions = await prisma.question.findMany({
      where: { invitationId: ctx.invitation.id },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      household: {
        id: household.id,
        name: household.name,
        rsvpStatus: household.rsvpStatus,
        message: household.message,
        members: household.members.map((m) => ({ id: m.id, name: m.name, attending: m.attending })),
        answers: household.answers.map((a) => ({
          questionId: a.questionId,
          memberId: a.memberId,
          value: JSON.parse(a.value) as unknown,
        })),
      },
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        scope: q.scope,
        required: q.required,
        labelEn: q.labelEn,
        labelDe: q.labelDe,
        optionsEn: JSON.parse(q.optionsEn) as string[],
        optionsDe: JSON.parse(q.optionsDe) as string[],
      })),
      rsvpClosed: rsvpClosed(ctx.invitation),
    };
  });

  const rsvpSchema = z.object({
    members: z.array(z.object({ id: z.string(), attending: z.boolean() })).min(1),
    message: z.string().max(2000).nullish(),
    answers: z
      .array(
        z.object({
          questionId: z.string(),
          memberId: z.string().nullish(),
          value: z.unknown(),
        }),
      )
      .max(500)
      .default([]),
  });

  app.put('/api/i/:slug/rsvp', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const ctx = await resolveHouseholdToken(request, reply, slug);
    if (!ctx) return;
    if (rsvpClosed(ctx.invitation)) return reply.code(403).send({ error: 'errors.rsvp.closed' });

    const parsed = rsvpSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    const data = parsed.data;

    const household = await prisma.household.findUnique({
      where: { id: ctx.householdId },
      include: { members: true },
    });
    if (!household) return reply.code(404).send({ error: 'errors.notFound' });

    const memberIds = new Set(household.members.map((m) => m.id));
    if (data.members.some((m) => !memberIds.has(m.id)) || data.members.length !== memberIds.size) {
      return reply.code(400).send({ error: 'errors.validation' });
    }

    const questions = await prisma.question.findMany({ where: { invitationId: ctx.invitation.id } });
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const attendingIds = new Set(data.members.filter((m) => m.attending).map((m) => m.id));

    const validAnswers: { questionId: string; memberId: string | null; value: string }[] = [];
    for (const answer of data.answers) {
      const question = questionById.get(answer.questionId);
      if (!question) return reply.code(400).send({ error: 'errors.validation' });
      const memberId = answer.memberId ?? null;
      if (question.scope === 'PER_MEMBER') {
        if (!memberId || !memberIds.has(memberId)) return reply.code(400).send({ error: 'errors.validation' });
        if (!attendingIds.has(memberId)) continue; // only attending members answer
      } else if (memberId) {
        return reply.code(400).send({ error: 'errors.validation' });
      }
      const encoded = validateAnswerValue(question, answer.value);
      if (encoded === undefined) return reply.code(400).send({ error: 'errors.validation' });
      if (encoded === null) continue; // empty optional answer
      validAnswers.push({ questionId: question.id, memberId, value: encoded });
    }

    // Required questions: per household always; per member for each attending member
    for (const question of questions) {
      if (!question.required) continue;
      if (question.scope === 'PER_HOUSEHOLD') {
        if (!validAnswers.some((a) => a.questionId === question.id)) {
          return reply.code(400).send({ error: 'errors.rsvp.missingRequired' });
        }
      } else {
        for (const memberId of attendingIds) {
          if (!validAnswers.some((a) => a.questionId === question.id && a.memberId === memberId)) {
            return reply.code(400).send({ error: 'errors.rsvp.missingRequired' });
          }
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const m of data.members) {
        await tx.member.update({ where: { id: m.id }, data: { attending: m.attending } });
      }
      await tx.answer.deleteMany({ where: { householdId: household.id } });
      if (validAnswers.length > 0) {
        await tx.answer.createMany({
          data: validAnswers.map((a) => ({ ...a, householdId: household.id })),
        });
      }
      await tx.household.update({
        where: { id: household.id },
        data: {
          rsvpStatus: 'RESPONDED',
          message: data.message ?? null,
          respondedAt: new Date(),
        },
      });
    });

    return { ok: true };
  });
}

/**
 * Validates an answer value against the question type.
 * Returns the JSON-encoded value, null for "empty, skip it", or undefined for "invalid".
 */
function validateAnswerValue(
  question: { type: string; optionsEn: string },
  value: unknown,
): string | null | undefined {
  const optionCount = (JSON.parse(question.optionsEn) as string[]).length;
  switch (question.type) {
    case 'TEXT': {
      if (typeof value !== 'string' || value.length > 2000) return undefined;
      if (value.trim() === '') return null;
      return JSON.stringify(value.trim());
    }
    case 'YES_NO': {
      if (value === '' || value === null || value === undefined) return null;
      if (value !== 'yes' && value !== 'no') return undefined;
      return JSON.stringify(value);
    }
    case 'SINGLE_CHOICE': {
      if (value === '' || value === null || value === undefined) return null;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= optionCount) {
        return undefined;
      }
      return JSON.stringify(value);
    }
    case 'MULTI_CHOICE': {
      if (!Array.isArray(value)) return undefined;
      if (value.length === 0) return null;
      if (!value.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < optionCount)) {
        return undefined;
      }
      return JSON.stringify([...new Set(value as number[])].sort((a, b) => a - b));
    }
    default:
      return undefined;
  }
}
