import { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import {
  changeSince,
  currencies,
  previousMonth,
  dailyCashFlow,
  type Currency,
  type Movement,
} from '@flowsaldo/domain';
import { filters, monthSchema, dateSchema, monthRange } from './historyQuery';
export const historySummary = Router();
historySummary.get('/summary', async (req, res, next) => {
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
