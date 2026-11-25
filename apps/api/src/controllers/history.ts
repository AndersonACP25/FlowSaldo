import { Router } from 'express';
import { importMetadata } from './imports';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import {
  changeSince,
  currencies,
  previousMonth,
  movementsCsv,
  validDate,
  dailyCashFlow,
  type Currency,
  type Movement,
} from '@flowsaldo/domain';

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((v) => validDate(v + '-01'));
const dateSchema = z.string().refine(validDate);
const receiptBoundary = z.union([dateSchema, z.iso.datetime({ offset: true })]);
const boundaryDate = (value: string, end: boolean) =>
  validDate(value)
    ? new Date(Date.parse(value + 'T00:00:00.000Z') + (end ? 86400000 : 0))
    : new Date(value);
const paging = z.object({
  page: z.literal('true').optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z
    .string()
    .max(1000)
    .transform((value, ctx) => {
      try {
        return z
          .object({ date: z.iso.datetime(), id: z.string().min(1).max(200) })
          .parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Cursor inválido' });
        return z.NEVER;
      }
    })
    .optional(),
});
const filters = z.object({
  currency: z.enum(currencies).optional(),
  month: monthSchema.optional(),
  accountId: z.string().min(1).max(200).optional(),
  categoryId: z.string().min(1).max(200).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  search: z.string().trim().max(100).optional(),
});
function monthRange(month: string) {
  const gte = new Date(month + '-01T00:00:00.000Z');
  const lt = new Date(gte);
  lt.setUTCMonth(lt.getUTCMonth() + 1);
  return { gte, lt };
}
function movementWhere(filter: z.infer<typeof filters>) {
  // Escape LIKE metacharacters so a text search has the same literal meaning as the demo.
  const search = filter.search?.replace(/[\\%_]/g, '\\$&');
  return {
    currency: filter.currency,
    ...(filter.type === 'EXPENSE'
      ? { OR: [{ type: 'EXPENSE' as const }, { refundOfId: { not: null } }] }
      : { type: filter.type, ...(filter.type === 'INCOME' ? { refundOfId: null } : {}) }),
    ...(filter.month ? { occurredAt: monthRange(filter.month) } : {}),
    AND: [
      ...(filter.categoryId
        ? [
            {
              OR: [
                { categoryId: filter.categoryId, splits: { none: {} } },
                { splits: { some: { categoryId: filter.categoryId } } },
              ],
            },
          ]
        : []),
      ...(search
        ? [
            {
              OR: [
                { description: { contains: search, mode: 'insensitive' as const } },
                {
                  category: { contains: search, mode: 'insensitive' as const },
                  splits: { none: {} },
                },
                {
                  splits: {
                    some: { category: { contains: search, mode: 'insensitive' as const } },
                  },
                },
              ],
            },
          ]
        : []),
      ...(filter.accountId
        ? [{ OR: [{ accountId: filter.accountId }, { targetAccountId: filter.accountId }] }]
        : []),
    ],
  };
}
function nextCursor(row: { id: string }, date: Date) {
  return Buffer.from(JSON.stringify({ date: date.toISOString(), id: row.id })).toString(
    'base64url',
  );
}
function after(cursor: z.infer<typeof paging>['cursor'], field: 'occurredAt' | 'createdAt') {
  return cursor
    ? {
        OR: [
          { [field]: { lt: new Date(cursor.date) } },
          { [field]: new Date(cursor.date), id: { gt: cursor.id } },
        ],
      }
    : {};
}
export const history = Router();
// Legacy array responses remain available when page=true is omitted.
history.get('/movements', async (req, res, next) => {
  if (req.query.page === undefined) {
    next();
    return;
  }
  const page = paging.parse(req.query);
  const filter = filters.parse(req.query);
  const where = movementWhere(filter);
  const result = await db.$transaction(
    async (tx) => {
      const [rows, total] = await Promise.all([
        tx.movement.findMany({
          where: { AND: [where, after(page.cursor, 'occurredAt')] },
          orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
          take: page.limit + 1,
          include: { splits: true },
        }),
        tx.movement.count({ where }),
      ]);
      const items = rows.slice(0, page.limit);
      const last = items.at(-1);
      return {
        items,
        total,
        nextCursor: rows.length > page.limit && last ? nextCursor(last, last.occurredAt) : null,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
  res.json(result);
});
history.get('/movements/export', async (req, res) => {
  const filter = filters
    .extend({ month: monthSchema, currency: z.enum(currencies) })
    .parse(req.query);
  const rows = await db.movement.findMany({
    where: movementWhere(filter),
    include: { splits: true },
    orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
  });
  const movements = rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
  res.setHeader('Content-Disposition', `attachment; filename="FlowSaldo-${filter.month}.csv"`);
  res.type('text/csv').send('\uFEFF' + movementsCsv(movements));
});
history.get('/summary', async (req, res, next) => {
  if (req.query.month === undefined) {
    next();
    return;
  }
  const { month, currency, weekEnd } = filters
    .extend({
      month: monthSchema,
      currency: z.enum(currencies).default('DOP'),
      weekEnd: dateSchema.optional(),
    })
    .refine((value) => !value.weekEnd || value.weekEnd.startsWith(value.month), {
      message: 'El fin de semana debe pertenecer al mes consultado.',
    })
    .parse(req.query);
  const where = { currency, occurredAt: monthRange(month) };
  const priorMonth = previousMonth(month);
  const today = new Date().toISOString().slice(0, 10);
  const end =
    weekEnd ??
    (today.startsWith(month)
      ? today
      : new Date(monthRange(month).lt.getTime() - 86400000).toISOString().slice(0, 10));
  const start = new Date(end + 'T00:00:00.000Z');
  start.setUTCDate(start.getUTCDate() - 6);
  const result = await db.$transaction(
    async (tx) => {
      function totalsFor(range: { gte: Date; lt: Date }) {
        return tx.$queryRaw<Array<{ income: bigint | null; expense: bigint | null }>>`
          SELECT SUM(CASE WHEN type = 'INCOME' AND "refundOfId" IS NULL THEN "amountMinor" ELSE 0 END) AS income,
                 SUM(CASE WHEN "refundOfId" IS NOT NULL THEN -"amountMinor"
                          WHEN type = 'EXPENSE' THEN "amountMinor" ELSE 0 END) AS expense
          FROM "Movement" WHERE currency::text = ${currency}
            AND "occurredAt" >= ${range.gte} AND "occurredAt" < ${range.lt}
        `;
      }
      const [types, categoryRows, daily, total, prior] = await Promise.all([
        totalsFor(where.occurredAt),
        tx.$queryRaw<Array<{ categoryId: string | null; category: string; amount: bigint }>>`
          SELECT COALESCE(s."categoryId", m."categoryId") AS "categoryId",
                 COALESCE(s.category, m.category) AS category,
                 SUM(COALESCE(s."amountMinor", m."amountMinor") * CASE WHEN m."refundOfId" IS NULL THEN 1 ELSE -1 END) AS amount
          FROM "Movement" m
          LEFT JOIN "MovementSplit" s ON s."movementId" = m.id
          WHERE m.currency::text = ${currency} AND (m.type = 'EXPENSE' OR m."refundOfId" IS NOT NULL)
            AND m."occurredAt" >= ${where.occurredAt.gte} AND m."occurredAt" < ${where.occurredAt.lt}
          GROUP BY 1, 2
        `,
        tx.$queryRaw<
          Array<{ day: string; kind: string; amount: bigint }>
        >`SELECT to_char("occurredAt", 'YYYY-MM-DD') AS day, CASE WHEN "refundOfId" IS NOT NULL THEN 'REFUND' ELSE type::text END AS kind, SUM("amountMinor") AS amount FROM "Movement" WHERE currency::text=${currency} AND "occurredAt">=${start} AND "occurredAt"<${new Date(Date.parse(end + 'T00:00:00.000Z') + 86400000)} AND "occurredAt">=${weekEnd ? start : where.occurredAt.gte} GROUP BY day,kind`,
        tx.movement.count({ where }),
        totalsFor(monthRange(priorMonth)),
      ]);
      const safe = (value: unknown) => {
        const n = Number(value ?? 0);
        if (!Number.isSafeInteger(n)) throw new Error('Total fuera de rango');
        return n;
      };
      const byName = new Map<string, number>();
      const byId = new Map<string | null, number>();
      for (const row of categoryRows) {
        const amount = safe(row.amount);
        byName.set(row.category, safe((byName.get(row.category) ?? 0) + amount));
        byId.set(row.categoryId, safe((byId.get(row.categoryId) ?? 0) + amount));
      }
      const incomeMinor = safe(types[0]?.income);
      const expenseMinor = safe(types[0]?.expense);
      const weeklyRows = daily.map((v, i) => ({
        id: String(i),
        amountMinor: safe(v.amount),
        currency: currency as Currency,
        type: v.kind === 'REFUND' ? 'INCOME' : v.kind,
        refundOfId: v.kind === 'REFUND' ? 'aggregate' : null,
        occurredAt: v.day,
        description: '',
        category: '',
      })) as Movement[];
      return {
        comparison: {
          previousMonth: priorMonth,
          income: changeSince(incomeMinor, safe(prior[0]?.income)),
          expense: changeSince(expenseMinor, safe(prior[0]?.expense)),
        },
        categoryTotals: Array.from(byId, ([categoryId, amountMinor]) => ({
          categoryId,
          amountMinor,
        })),
        currency,
        month,
        scope: 'month',
        incomeMinor,
        expenseMinor,
        differenceMinor: safe(incomeMinor - expenseMinor),
        total,
        categories: Array.from(byName, ([category, amountMinor]) => ({
          category,
          amountMinor,
        })).sort((a, b) => b.amountMinor - a.amountMinor),
        days: dailyCashFlow(weeklyRows, end),
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
  res.json(result);
});
history.get('/imports', async (req, res, next) => {
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
