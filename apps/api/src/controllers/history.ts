import { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { currencies, movementsCsv } from '@flowsaldo/domain';
import { after, filters, monthRange, monthSchema, nextCursor, paging } from './historyQuery';
import { historySummary } from './historySummary';
import { historyImports } from './historyImports';
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
history.use(historySummary, historyImports);
