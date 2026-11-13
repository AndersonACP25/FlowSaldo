import { Router } from 'express';
import { db } from '@flowsaldo/database';
import { categoryName, categoryKey } from '@flowsaldo/domain';
import { z } from 'zod';
import { deleteCategory, updateCategory } from '../models/categories';
const schema = z.object({
  name: z.string().transform((v, ctx) => {
    try {
      return categoryName(v);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Nombre inválido' });
      return z.NEVER;
    }
  }),
});
export const categoryRoutes = Router();
categoryRoutes.get('/categories', async (_req, res) =>
  res.json(await db.category.findMany({ orderBy: [{ archived: 'asc' }, { name: 'asc' }] })),
);
categoryRoutes.post('/categories', async (req, res) => {
  const { name } = schema.parse(req.body);
  res
    .status(201)
    .json(await db.category.create({ data: { name, normalizedName: categoryKey(name) } }));
});
categoryRoutes.patch('/categories/:id', async (req, res) => {
  const patch = schema
    .partial()
    .extend({ archived: z.boolean().optional() })
    .refine((v) => v.name !== undefined || v.archived !== undefined)
    .parse(req.body);
  const item = await updateCategory(req.params.id, patch);
  res.json(item);
});
categoryRoutes.delete('/categories/:id', async (req, res) => {
  await deleteCategory(req.params.id);
  res.status(204).end();
});
