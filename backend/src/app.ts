import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { config } from './lib/config.js';
import { authRoutes } from './routes/auth.js';
import { invitationRoutes } from './routes/invitations.js';
import { householdRoutes } from './routes/households.js';
import { questionRoutes } from './routes/questions.js';
import { publicRoutes } from './routes/public.js';
import { uploadRoutes } from './routes/uploads.js';

export async function buildApp() {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await app.register(cookie);
  await app.register(multipart);
  await app.register(rateLimit, { global: false });

  mkdirSync(config.uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: path.resolve(config.uploadDir),
    prefix: '/uploads/',
    decorateReply: false,
  });

  app.get('/api/health', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(invitationRoutes);
  await app.register(householdRoutes);
  await app.register(questionRoutes);
  await app.register(publicRoutes);
  await app.register(uploadRoutes);

  return app;
}
