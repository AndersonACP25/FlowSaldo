import type { PrismaClient } from '@prisma/client';

export function retentionDays(value: string | undefined): number | null {
  if (value === undefined || value === '' || value === '0') return null;
  if (!/^\d+$/.test(value) || Number(value) < 7 || Number(value) > 365) {
    throw new Error('AUTO_RETENTION_DAYS debe ser 0 o un entero entre 7 y 365.');
  }
  return Number(value);
}

export async function runRetention(db: PrismaClient, days: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 86400000);
  return db.$transaction(async (tx) => {
    const [owner] = await tx.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM "AppOwner" WHERE id=1 FOR UPDATE SKIP LOCKED`;
    if (!owner) return 0;
    const rows = await tx.$queryRaw<Array<{ id: string; status: 'REVIEW' | 'FAILED' }>>`
   SELECT i.id, i.status::text AS status
   FROM "MailImport" i
   WHERE i.status IN ('REVIEW','FAILED') AND i.body <> '' AND i."createdAt" < ${cutoff}
     AND NOT EXISTS (SELECT 1 FROM "Movement" m WHERE m."importId" = i.id)
   ORDER BY i."createdAt", i.id
   LIMIT 1000 FOR UPDATE OF i SKIP LOCKED`;
    if (!rows.length) return 0;
    await tx.mailImport.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: {
        body: '',
        status: 'DISMISSED',
        reason: 'Contenido eliminado por retención automática.',
        processedAt: now,
        lockToken: null,
        lockedUntil: null,
      },
    });
    const reviewBodies = rows.filter((row) => row.status === 'REVIEW').length;
    await tx.dataCleanup.create({
      data: {
        ownerId: owner.id,
        cutoff,
        reviewBodies,
        failedBodies: rows.length - reviewBodies,
        accessRecords: 0,
      },
    });
    return rows.length;
  });
}
