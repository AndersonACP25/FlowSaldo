import type { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { randomBytes } from 'node:crypto';
import {
  AuthError,
  email,
  hashPassword,
  password,
  throttle,
  tokenDigest,
  verify,
} from './authSupport';
export function registerAccountRecovery(publicRoutes: Router) {
  publicRoutes.post('/auth/recover', throttle('recover', 5), async (req, res) => {
    const data = z
      .object({ email, code: z.string().regex(/^fr_[A-Za-z0-9_-]{32}$/), newPassword: password })
      .parse(req.body);
    // Hash before checking the code so unknown accounts/codes follow the same expensive path.
    const passwordHash = await hashPassword(data.newPassword);
    await db.$transaction(async (tx) => {
      const [owner] = await tx.$queryRaw<
        Array<{ email: string }>
      >`SELECT email FROM "AppOwner" WHERE id=1 FOR UPDATE`;
      const code = await tx.recoveryCode.findUnique({
        where: { codeHash: tokenDigest(data.code) },
      });
      if (
        !owner ||
        owner.email !== data.email ||
        !code ||
        code.ownerId !== 1 ||
        code.usedAt ||
        code.expiresAt <= new Date()
      )
        throw new AuthError('El correo o el código de recuperación no son válidos.');
      await tx.appOwner.update({ where: { id: 1 }, data: { passwordHash } });
      // Recovering control invalidates the entire old batch, not just the presented code.
      await tx.recoveryCode.deleteMany({ where: { ownerId: 1 } });
      await tx.accessSession.updateMany({
        where: { ownerId: 1, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    res.status(204).end();
  });
}
export function registerRecoveryCodes(sessionRoutes: Router) {
  sessionRoutes.get('/auth/recovery-codes', async (_req, res) => {
    const now = new Date();
    const where = { ownerId: 1, usedAt: null, expiresAt: { gt: now } };
    const [remaining, first] = await Promise.all([
      db.recoveryCode.count({ where }),
      db.recoveryCode.findFirst({
        where,
        select: { expiresAt: true },
        orderBy: { expiresAt: 'asc' },
      }),
    ]);
    res.json({ remaining, expiresAt: first?.expiresAt ?? null });
  });
  sessionRoutes.post('/auth/recovery-codes', throttle('recovery-codes', 5), async (req, res) => {
    const { currentPassword } = z
      .object({ currentPassword: z.string().min(1).max(128) })
      .parse(req.body);
    const existing = await db.appOwner.findUniqueOrThrow({ where: { id: 1 } });
    if (!(await verify(currentPassword, existing.passwordHash)))
      throw new AuthError('La contraseña actual no es correcta.');
    const codes = Array.from({ length: 5 }, () => 'fr_' + randomBytes(24).toString('base64url'));
    const expiresAt = new Date(Date.now() + 90 * 86400000);
    await db.$transaction(async (tx) => {
      const [owner] = await tx.$queryRaw<
        Array<{ passwordHash: string }>
      >`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
      if (owner.passwordHash !== existing.passwordHash)
        throw new AuthError('La contraseña cambió. Inicia sesión nuevamente.', 409);
      await tx.recoveryCode.deleteMany({ where: { ownerId: 1 } });
      await tx.recoveryCode.createMany({
        data: codes.map((code) => ({ ownerId: 1, codeHash: tokenDigest(code), expiresAt })),
      });
    });
    res.status(201).json({ codes, expiresAt });
  });
  sessionRoutes.post(
    '/auth/recovery-codes/revoke',
    throttle('recovery-codes', 5),
    async (req, res) => {
      const { currentPassword } = z
        .object({ currentPassword: z.string().min(1).max(128) })
        .parse(req.body);
      const existing = await db.appOwner.findUniqueOrThrow({ where: { id: 1 } });
      if (!(await verify(currentPassword, existing.passwordHash)))
        throw new AuthError('La contraseña actual no es correcta.');
      await db.$transaction(async (tx) => {
        const [owner] = await tx.$queryRaw<
          Array<{ passwordHash: string }>
        >`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
        if (owner.passwordHash !== existing.passwordHash)
          throw new AuthError('La contraseña cambió.', 409);
        await tx.recoveryCode.deleteMany({ where: { ownerId: 1 } });
      });
      res.status(204).end();
    },
  );
}
