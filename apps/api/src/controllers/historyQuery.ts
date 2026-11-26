import { z } from 'zod';
import { currencies, validDate } from '@flowsaldo/domain';
export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((v) => validDate(v + '-01'));
export const dateSchema = z.string().refine(validDate);
export const paging = z.object({
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
export const filters = z.object({
  currency: z.enum(currencies).optional(),
  month: monthSchema.optional(),
  accountId: z.string().min(1).max(200).optional(),
  categoryId: z.string().min(1).max(200).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  search: z.string().trim().max(100).optional(),
});
export function monthRange(month: string) {
  const gte = new Date(month + '-01T00:00:00.000Z');
  const lt = new Date(gte);
  lt.setUTCMonth(lt.getUTCMonth() + 1);
  return { gte, lt };
}
export function nextCursor(row: { id: string }, date: Date) {
  return Buffer.from(JSON.stringify({ date: date.toISOString(), id: row.id })).toString(
    'base64url',
  );
}
export function after(cursor: z.infer<typeof paging>['cursor'], field: 'occurredAt' | 'createdAt') {
  return cursor
    ? {
        OR: [
          { [field]: { lt: new Date(cursor.date) } },
          { [field]: new Date(cursor.date), id: { gt: cursor.id } },
        ],
      }
    : {};
}
