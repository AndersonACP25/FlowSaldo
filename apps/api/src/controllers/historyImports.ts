import { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { validDate } from '@flowsaldo/domain';
import { importMetadata } from './imports';
import { after, dateSchema, nextCursor, paging } from './historyQuery';
const receiptBoundary = z.union([dateSchema, z.iso.datetime({ offset: true })]);
const boundaryDate = (value: string, end: boolean) =>
  validDate(value)
    ? new Date(Date.parse(value + 'T00:00:00.000Z') + (end ? 86400000 : 0))
    : new Date(value);
export const historyImports = Router();
historyImports.get('/imports', async (req, res, next) => {
  if (req.query.page === undefined) {
    next();
    return;
  }
  const page = paging.parse(req.query);
  const filter = z
    .object({
      status: z
        .enum(['PENDING', 'PROCESSING', 'FAILED', 'REVIEW', 'PARSED', 'DISMISSED'])
        .optional(),
      from: receiptBoundary.transform((value) => boundaryDate(value, false)).optional(),
      to: receiptBoundary.transform((value) => boundaryDate(value, true)).optional(),
    })
    .refine((v) => !v.from || !v.to || v.from < v.to, { message: 'Rango de fechas inválido' })
    .parse(req.query);
  const where = {
    status: filter.status,
    ...(filter.from || filter.to
      ? {
          createdAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lt: filter.to } : {}),
          },
        }
      : {}),
  };
  const result = await db.$transaction(
    async (tx) => {
      const [rows, total, pendingTotal] = await Promise.all([
        tx.mailImport.findMany({
          where: { AND: [where, after(page.cursor, 'createdAt')] },
          select: {
            ...importMetadata,
            id: true,
            externalId: true,
            status: true,
            reason: true,
            parserVersion: true,
            createdAt: true,
            movement: { select: { id: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: page.limit + 1,
        }),
        tx.mailImport.count({ where }),
        tx.mailImport.count({ where: { status: 'REVIEW' } }),
      ]);
      const items = rows.slice(0, page.limit);
      const last = items.at(-1);
      return {
        items,
        total,
        pendingTotal,
        nextCursor: rows.length > page.limit && last ? nextCursor(last, last.createdAt) : null,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
  res.json(result);
});
