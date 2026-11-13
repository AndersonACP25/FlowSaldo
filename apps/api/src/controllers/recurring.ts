import { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { prepareOccurrence, validDate, type RecurringTemplate } from '@flowsaldo/domain';
import { assignCategory, CategoryError } from '../models/categories';
const fields = z.object({
  description: z.string().trim().min(1).max(100),
  amountMinor: z.number().int().positive().max(2147483647),
  currency: z.enum(['DOP', 'USD']),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  categoryId: z.string().min(1).max(200),
  category: z.string().trim().min(1).max(60).default('Sin categorizar'),
});
const date = z.string().refine(validDate);
export const recurringRoutes = Router();
recurringRoutes.get('/recurring', async (_req, res) =>
  res.json(await db.recurringTemplate.findMany({ orderBy: [{ nextDate: 'asc' }, { id: 'asc' }] })),
);
recurringRoutes.post('/recurring', async (req, res) => {
  const { startDate, ...data } = fields.extend({ startDate: date }).parse(req.body);
  res.status(201).json(
    await db.$transaction(async (tx) =>
      tx.recurringTemplate.create({
        data: {
          ...data,
          ...(await assignCategory(tx, data)),
          startDate,
          nextDate: startDate,
          anchorDay: Number(startDate.slice(8)),
        },
      }),
    ),
  );
});
recurringRoutes.patch('/recurring/:id', async (req, res) => {
  const data = fields
    .omit({ category: true })
    .partial()
    .extend({
      category: z.string().trim().min(1).max(60).optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0)
    .parse(req.body);
  const item = await db.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<
      RecurringTemplate[]
    >`SELECT * FROM "RecurringTemplate" WHERE id=${req.params.id} FOR UPDATE`;
    if (!existing) throw new CategoryError('Plantilla no encontrada.', 404);
    const category =
      data.categoryId && data.categoryId !== existing.categoryId
        ? await assignCategory(tx, {
            categoryId: data.categoryId,
            category: data.category ?? existing.category,
          })
        : {};
    return tx.recurringTemplate.update({
      where: { id: existing.id },
      data: { ...data, category: existing.category, ...category, version: { increment: 1 } },
    });
  });
  res.json(item);
});
recurringRoutes.post('/recurring/:id/confirm', async (req, res) => {
  const { scheduledFor, expectedVersion } = z
    .object({ scheduledFor: date, expectedVersion: z.number().int().nonnegative() })
    .parse(req.body);
  const result = await db.$transaction(async (tx) => {
    const [template] = await tx.$queryRaw<
      RecurringTemplate[]
    >`SELECT * FROM "RecurringTemplate" WHERE id=${req.params.id} FOR UPDATE`;
    if (!template) throw new CategoryError('Plantilla no encontrada.', 404);
    if (template.version !== expectedVersion)
      throw new CategoryError(
        'La plantilla cambió. Actualiza y revisa sus datos antes de confirmar.',
        409,
      );
    let occurrence;
    try {
      occurrence = prepareOccurrence(template, scheduledFor, new Date().toISOString().slice(0, 10));
    } catch (e) {
      throw new CategoryError((e as Error).message, 409);
    }
    const category = await assignCategory(tx, template);
    const movement = await tx.movement.create({ data: { ...occurrence.movement, ...category } });
    await tx.recurringOccurrence.create({
      data: { templateId: template.id, scheduledFor, movementId: movement.id },
    });
    await tx.recurringTemplate.update({
      where: { id: template.id },
      data: { nextDate: occurrence.nextDate, version: { increment: 1 } },
    });
    return { movement, nextDate: occurrence.nextDate };
  });
  res.status(201).json(result);
});
