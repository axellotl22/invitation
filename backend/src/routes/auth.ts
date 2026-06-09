import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { clearSessionCookie, requireUser, setSessionCookie } from '../lib/auth.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().max(100).optional(),
  locale: z.enum(['en', 'de']).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });
    const { email, password, name, locale } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return reply.code(409).send({ error: 'errors.auth.emailTaken' });

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 10),
        name: name ?? null,
        locale: locale ?? 'en',
      },
    });
    setSessionCookie(reply, user.id);
    return { id: user.id, email: user.email, name: user.name, locale: user.locale };
  });

  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'errors.validation' });

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'errors.auth.invalidCredentials' });
    }
    setSessionCookie(reply, user.id);
    return { id: user.id, email: user.email, name: user.name, locale: user.locale };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireUser }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (!user) return reply.code(401).send({ error: 'errors.auth.required' });
    return { id: user.id, email: user.email, name: user.name, locale: user.locale };
  });
}
