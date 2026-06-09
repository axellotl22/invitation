import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { requireUser } from '../lib/auth.js';
import { config } from '../lib/config.js';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/uploads', { preHandler: requireUser }, async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_BYTES, files: 1 } });
    if (!file || !ALLOWED.has(file.mimetype)) {
      return reply.code(400).send({ error: 'errors.upload.invalidType' });
    }
    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      return reply.code(400).send({ error: 'errors.upload.tooLarge' });
    }

    const name = randomBytes(12).toString('hex');
    await mkdir(config.uploadDir, { recursive: true });
    try {
      // Re-encoding to webp also strips EXIF and defuses malformed images
      await sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(config.uploadDir, `${name}.webp`));
    } catch {
      return reply.code(400).send({ error: 'errors.upload.invalidType' });
    }
    return { url: `/uploads/${name}.webp` };
  });
}
