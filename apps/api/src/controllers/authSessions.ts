import type { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { AuthError, hashPassword, password, throttle, verify } from './authSupport';
export function registerSessionManagement(sessionRoutes: Router) {
  sessionRoutes.post('/auth/logout', async (_req, res) => {
    await db.accessSession.updateMany({
      where: { id: res.locals.accessSession.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(204).end();
  });
  sessionRoutes.get('/auth/sessions', async (_req, res) => {
    const sessions = await db.accessSession.findMany({
      where: { ownerId: 1, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sessions.map((s) => ({ ...s, current: s.id === res.locals.accessSession.id })));
  });
  sessionRoutes.post('/auth/sessions/revoke-others', async (_req, res) => {
    const result = await db.accessSession.updateMany({
      where: { ownerId: 1, id: { not: res.locals.accessSession.id }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ revoked: result.count });
  });
}

export function registerPasswordChange(sessionRoutes: Router) {
  sessionRoutes.post('/auth/password', throttle('password', 5), async (req, res) => {
    const data = z
      .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
      .refine((v) => v.currentPassword !== v.newPassword)
      .parse(req.body);
    const existing = await db.appOwner.findUniqueOrThrow({ where: { id: 1 } });
    if (!(await verify(data.currentPassword, existing.passwordHash)))
      throw new AuthError('La contraseña actual no es correcta.');
    const passwordHash = await hashPassword(data.newPassword);
    await db.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<
        Array<{ passwordHash: string }>
      >`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
      if (current.passwordHash !== existing.passwordHash)
        throw new AuthError('La contraseña cambió. Inicia sesión nuevamente.', 409);
      await tx.appOwner.update({ where: { id: 1 }, data: { passwordHash } });
      await tx.recoveryCode.deleteMany({ where: { ownerId: 1 } });
      await tx.accessSession.updateMany({
        where: { ownerId: 1, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    res.status(204).end();
  });
}
