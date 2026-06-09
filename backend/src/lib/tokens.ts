import { randomBytes, randomInt } from 'node:crypto';

const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** URL-safe random slug for public invitation links. */
export function generateSlug(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

/** 6-digit numeric PIN (leading zeros allowed). */
export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
