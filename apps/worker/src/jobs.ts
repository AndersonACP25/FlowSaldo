import { randomUUID } from 'node:crypto';
import type { PrismaClient, MailImport } from '@prisma/client';
import { parseBankWithdrawal, parseDemoMail, type ParseResult } from '@flowsaldo/domain';
export interface RetrySettings {
  limit: number;
  leaseMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
}
export const retrySettings: RetrySettings = {
  limit: 5,
  leaseMs: 30000,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
};
const unlocked = { lockedUntil: null, lockToken: null };
// A durable claim increments attempts before processing. A crashed process cannot own it forever.
export async function claimImport(db: PrismaClient, settings = retrySettings, now = new Date()) {
  return db.$transaction(async (tx) => {
    const [item] = await tx.$queryRaw<
      MailImport[]
    >`SELECT * FROM "MailImport" WHERE (status='PENDING' AND "nextAttemptAt"<=${now}) OR (status='PROCESSING' AND "lockedUntil"<=${now}) ORDER BY "nextAttemptAt","createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!item) return null;
    if (item.attempts >= settings.limit) {
      await tx.mailImport.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
          reason:
            'Se agotaron los intentos automáticos. Revisa el aviso y reintenta cuando se resuelva el problema.',
          lastErrorCode: 'LEASE_EXPIRED',
          processedAt: now,
          ...unlocked,
        },
      });
      return null;
    }
    return tx.mailImport.update({
      where: { id: item.id },
      data: {
        status: 'PROCESSING',
        reason: null,
        attempts: { increment: 1 },
        lastAttemptAt: now,
        lockedUntil: new Date(now.getTime() + settings.leaseMs),
        lockToken: randomUUID(),
        ...(item.status === 'PROCESSING' ? { lastErrorCode: 'LEASE_EXPIRED' } : {}),
      },
    });
  });
}
export async function failImport(
  db: PrismaClient,
  item: MailImport,
  error: unknown,
  settings = retrySettings,
  now = new Date(),
) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025'
      ? 'CATEGORY_UNAVAILABLE'
      : 'PROCESSING_FAILED';
  const exhausted = item.attempts >= settings.limit || code === 'CATEGORY_UNAVAILABLE';
  const delay = Math.min(
    settings.maxDelayMs,
    settings.baseDelayMs * 2 ** Math.max(0, item.attempts - 1),
  );
  // Fencing token prevents an expired owner from changing a job reclaimed by another worker.
  await db.mailImport.updateMany({
    where: { id: item.id, status: 'PROCESSING', lockToken: item.lockToken },
    data: {
      status: exhausted ? 'FAILED' : 'PENDING',
      nextAttemptAt: new Date(now.getTime() + delay),
      lastErrorCode: code,
      reason: exhausted
        ? 'No se pudo procesar el aviso. Revisa el problema antes de reintentar.'
        : 'Se programó un reintento automático.',
      processedAt: exhausted ? now : null,
      ...unlocked,
    },
  });
}
export async function finishImport(
  db: PrismaClient,
  item: MailImport,
  parse: (body: string) => ParseResult = parseDemoMail,
  now = new Date(),
) {
  const result = parse(item.body);
  const bank = result.status === 'REVIEW' ? parseBankWithdrawal(item.body) : null;
  return db.$transaction(async (tx) => {
    const [owner] = await tx.$queryRaw<
      MailImport[]
    >`SELECT * FROM "MailImport" WHERE id=${item.id} FOR UPDATE`;
    if (!owner || owner.status !== 'PROCESSING' || owner.lockToken !== item.lockToken) return false;
    if (result.status === 'PARSED' && result.movement.amountMinor <= 2147483647) {
      const category = await tx.category.findUniqueOrThrow({
        where: { normalizedName: 'sin categorizar' },
      });
      await tx.movement.create({
        data: { ...result.movement, categoryId: category.id, importId: item.id },
      });
      await tx.mailImport.update({
        where: { id: item.id },
        data: {
          status: 'PARSED',
          body: '',
          reason: null,
          lastErrorCode: null,
          processedAt: now,
          ...unlocked,
        },
      });
    } else {
      await tx.mailImport.update({
        where: { id: item.id },
        data: {
          status: 'REVIEW',
          parserVersion: bank?.parserVersion ?? 'demo-v1',
          reason: bank
            ? 'Retiro identificado. Confirma monto, fecha y cuenta. Si registras el efectivo como cuenta propia, selecciona Transferencia.'
            : result.status === 'REVIEW'
              ? result.reason
              : 'Monto fuera de rango',
          lastErrorCode: null,
          processedAt: now,
          ...unlocked,
        },
      });
    }
    return true;
  });
}
export async function runImport(db: PrismaClient, settings = retrySettings) {
  const item = await claimImport(db, settings);
  if (!item) return false;
  try {
    await finishImport(db, item);
  } catch (error) {
    await failImport(db, item, error, settings);
  }
  return true;
}
