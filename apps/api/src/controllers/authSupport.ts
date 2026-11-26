import type { RequestHandler } from 'express';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
  }
}
export const publicOwner = { id: true, name: true, email: true } as const;
export const password = z.string().min(15).max(128);
export const name = z.string().trim().min(1).max(60);
export const email = z
  .string()
  .trim()
  .email()
  .max(120)
  .transform((v) => v.toLowerCase());
export const sessionLifetime = 24 * 60 * 60 * 1000;
export const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');
let hashing = 0;
async function derive(value: string, salt: Buffer) {
  if (hashing >= 2)
    throw new AuthError('Hay otra validación de acceso en curso. Reintenta en unos segundos.', 503);
  hashing++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(value, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 }, (error, key) =>
        error ? reject(error) : resolve(key),
      ),
    );
  } finally {
    hashing--;
  }
}
export async function hashPassword(value: string) {
  const salt = randomBytes(16);
  return `scrypt-v1$${salt.toString('base64url')}$${(await derive(value, salt)).toString('base64url')}`;
}
export async function verify(value: string, stored?: string) {
  const parts = stored?.split('$');
  const valid =
    parts?.length === 3 &&
    parts[0] === 'scrypt-v1' &&
    /^[\w-]{22}$/.test(parts[1]) &&
    /^[\w-]{86}$/.test(parts[2]);
  const actual = await derive(
    value,
    valid ? Buffer.from(parts![1], 'base64url') : Buffer.alloc(16),
  );
  return (
    timingSafeEqual(actual, valid ? Buffer.from(parts![2], 'base64url') : Buffer.alloc(64)) &&
    !!valid
  );
}
export function bearer(header: string | undefined) {
  return header?.startsWith('Bearer ') ? header.slice(7) : '';
}
export function bootstrapMatches(value: string, secret: string) {
  const a = Buffer.from(value),
    b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
// Persisted throttling survives process restarts. No user-supplied password/email is a bucket key.
export const throttle =
  (action: string, limit: number): RequestHandler =>
  async (req, res, next) => {
    const key = tokenDigest(action + ':' + req.ip);
    const now = new Date();
    const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
    const [bucket] = await db.$queryRaw<
      Array<{ attempts: number; startedAt: Date }>
    >`INSERT INTO "AuthThrottle" (key,"startedAt",attempts) VALUES (${key},${now},1) ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN "AuthThrottle"."startedAt"<=${cutoff} THEN 1 ELSE "AuthThrottle".attempts+1 END,"startedAt"=CASE WHEN "AuthThrottle"."startedAt"<=${cutoff} THEN ${now} ELSE "AuthThrottle"."startedAt" END RETURNING attempts,"startedAt"`;
    if (bucket.attempts > limit) {
      res.setHeader(
        'Retry-After',
        String(
          Math.max(1, Math.ceil((bucket.startedAt.getTime() + 900000 - now.getTime()) / 1000)),
        ),
      );
      res.status(429).json({ error: 'Demasiados intentos de acceso. Espera antes de reintentar.' });
      return;
    }
    // Bound retained throttle records to recent activity; run after accepting a bucket.
    await db.authThrottle.deleteMany({
      where: { startedAt: { lt: new Date(now.getTime() - 86400000) } },
    });
    next();
  };
