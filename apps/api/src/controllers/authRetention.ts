import type { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { randomBytes } from 'node:crypto';
import { AuthError, throttle, verify } from './authSupport';
export function registerRetention(sessionRoutes: Router) {
  sessionRoutes.post('/auth/data/retention/preview', async (req, res) => {
    const { olderThanDays } = z
      .object({ olderThanDays: z.number().int().min(7).max(365) })
      .parse(req.body);
    const cutoff = new Date(Date.now() - olderThanDays * 86400000);
    const where = {
      body: { not: '' },
      createdAt: { lt: cutoff },
      movement: { is: null },
      status: { in: ['REVIEW', 'FAILED'] as Array<'REVIEW' | 'FAILED'> },
    };
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AppOwner" WHERE id=1 FOR UPDATE`;
      const [rows, totalEligible, lastCleanup] = await Promise.all([
        tx.mailImport.findMany({
          where,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1000,
          select: { id: true, status: true },
        }),
        tx.mailImport.count({ where }),
        tx.dataCleanup.findFirst({
          where: { ownerId: 1 },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, reviewBodies: true, failedBodies: true },
        }),
      ]);
      const id = randomBytes(24).toString('base64url');
      const expiresAt = new Date(Date.now() + 10 * 60000);
      const data = { id, cutoff, expiresAt, importIds: rows.map((row) => row.id) };
      await tx.cleanupPreview.upsert({
        where: { ownerId: 1 },
        create: { ownerId: 1, ...data },
        update: data,
      });
      return {
        previewId: id,
        cutoff,
        expiresAt,
        reviewBodies: rows.filter((r) => r.status === 'REVIEW').length,
        failedBodies: rows.filter((r) => r.status === 'FAILED').length,
        totalEligible,
        hasMore: totalEligible > rows.length,
        lastCleanup,
      };
    });
    res.json(result);
  });
  sessionRoutes.post('/auth/data/retention/apply', throttle('retention', 5), async (req, res) => {
    const data = z
      .object({
        previewId: z.string().min(1).max(100),
        currentPassword: z.string().min(1).max(128),
        confirmation: z.literal('ELIMINAR CONTENIDO'),
      })
      .strict()
      .parse(req.body);
    const existing = await db.appOwner.findUniqueOrThrow({ where: { id: 1 } });
    if (!(await verify(data.currentPassword, existing.passwordHash)))
      throw new AuthError('La contraseña actual no es correcta.');
    const result = await db.$transaction(async (tx) => {
      const [owner] = await tx.$queryRaw<
        Array<{ passwordHash: string }>
      >`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
      if (owner.passwordHash !== existing.passwordHash)
        throw new AuthError('La contraseña cambió. Inicia sesión nuevamente.', 409);
      const preview = await tx.cleanupPreview.findUnique({ where: { ownerId: 1 } });
      if (!preview || preview.id !== data.previewId || preview.expiresAt <= new Date())
        throw new AuthError('La vista previa venció o cambió. Previsualiza nuevamente.', 409);
      const cutoff = preview.cutoff;
      const where = {
        id: { in: preview.importIds },
        body: { not: '' },
        createdAt: { lt: cutoff },
        movement: { is: null },
      };
      const now = new Date();
      // updateMany rechecks state under row locks: a concurrently confirmed record is preserved.
      const review = await tx.mailImport.updateMany({
        where: { ...where, status: 'REVIEW' },
        data: {
          body: '',
          status: 'DISMISSED',
          reason: 'Contenido eliminado por retención manual.',
          processedAt: now,
        },
      });
      const failed = await tx.mailImport.updateMany({
        where: { ...where, status: 'FAILED' },
        data: {
          body: '',
          status: 'DISMISSED',
          reason: 'Contenido eliminado por retención manual.',
          processedAt: now,
          lockToken: null,
          lockedUntil: null,
        },
      });
      const sessions = await tx.accessSession.deleteMany({
        where: { OR: [{ revokedAt: { not: null } }, { expiresAt: { lte: now } }] },
      });
      const codes = await tx.recoveryCode.deleteMany({
        where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lte: now } }] },
      });
      const throttles = await tx.authThrottle.deleteMany({
        where: { startedAt: { lt: new Date(now.getTime() - 86400000) } },
      });
      await tx.cleanupPreview.delete({ where: { ownerId: 1 } });
      return tx.dataCleanup.create({
        data: {
          ownerId: 1,
          cutoff,
          reviewBodies: review.count,
          failedBodies: failed.count,
          accessRecords: sessions.count + codes.count + throttles.count,
        },
        select: {
          id: true,
          cutoff: true,
          reviewBodies: true,
          failedBodies: true,
          accessRecords: true,
          createdAt: true,
        },
      });
    });
    res.json(result);
  });
}
