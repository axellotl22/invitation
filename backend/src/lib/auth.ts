import jwt from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';

const SESSION_COOKIE = 'session';

interface SessionPayload {
  sub: string;
  purpose: 'session';
}

export interface HouseholdTokenPayload {
  householdId: string;
  invitationId: string;
  purpose: 'household';
}

export function setSessionCookie(reply: FastifyReply, userId: string): void {
  const token = jwt.sign({ sub: userId, purpose: 'session' } satisfies SessionPayload, config.jwtSecret, {
    expiresIn: '7d',
  });
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 7 * 24 * 3600,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** preHandler: requires a logged-in host; sets request.userId. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return reply.code(401).send({ error: 'errors.auth.required' });
  try {
    const payload = jwt.verify(token, config.jwtSecret) as SessionPayload;
    if (payload.purpose !== 'session') throw new Error('wrong purpose');
    request.userId = payload.sub;
  } catch {
    return reply.code(401).send({ error: 'errors.auth.required' });
  }
}

export function signHouseholdToken(householdId: string, invitationId: string): string {
  return jwt.sign(
    { householdId, invitationId, purpose: 'household' } satisfies HouseholdTokenPayload,
    config.jwtSecret,
    { expiresIn: '45m' },
  );
}

export function verifyHouseholdToken(token: string): HouseholdTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as HouseholdTokenPayload;
    if (payload.purpose !== 'household') return null;
    return payload;
  } catch {
    return null;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}
