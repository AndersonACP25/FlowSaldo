import { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { parseBankWithdrawal, validDate, summarize, type Movement } from '@flowsaldo/domain';
import { importMetadata } from './imports';
import { createMovement, updateMovement, deleteMovement, resolveImport } from '../models/records';

export const records = Router();
const movementSchema = z.object({
  accountId: z.string().min(1).max(200).nullish(),
  targetAccountId: z.string().min(1).max(200).nullish(),
  amountMinor: z.number().int().positive().max(2147483647),
  currency: z.enum(['DOP', 'USD']),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  description: z.string().trim().min(1).max(100),
  categoryId: z.string().min(1).max(200).nullish(),
  category: z.string().trim().min(1).max(60).default('Sin categorizar'),
  occurredAt: z.iso.datetime(),
});
records.get('/movements', async (req, res) => {
  const filter = z
    .object({
      currency: z.enum(['DOP', 'USD']).optional(),
      month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .refine((v) => validDate(v + '-01'))
        .optional(),
    })
    .parse(req.query);
  const from = filter.month ? new Date(filter.month + '-01T00:00:00.000Z') : undefined;
  const to = from ? new Date(from) : undefined;
  if (to) to.setUTCMonth(to.getUTCMonth() + 1);
  res.json(
    await db.movement.findMany({
      where: { currency: filter.currency, ...(from ? { occurredAt: { gte: from, lt: to } } : {}) },
      orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
      take: 200,
    }),
  );
});
records.get('/movements/:id', async (req, res) => {
  const item = await db.movement.findUnique({ where: { id: req.params.id } });
  if (!item) {
    res.status(404).json({ error: 'Movimiento no encontrado' });
    return;
  }
  res.json(item);
});
records.post('/movements', async (req, res) => {
  const data = movementSchema
    .extend({ requestKey: z.string().min(10).max(100).optional() })
    .parse(req.body);
  const result = await createMovement(data);
  res.status(201).json(result);
});

records.patch('/movements/:id', async (req, res) => {
  const data = movementSchema.parse(req.body);
  const result = await updateMovement(req.params.id, data);
  if (!result) {
    res.status(404).json({ error: 'Movimiento no encontrado' });
    return;
  }
  res.json(result);
});
records.delete('/movements/:id', async (req, res) => {
  const result = await deleteMovement(req.params.id);
  if (!result) {
    res.status(404).json({ error: 'Movimiento no encontrado' });
    return;
  }
  res.status(204).end();
});
records.get('/summary', async (req, res) => {
  const currency = z.enum(['DOP', 'USD']).parse(req.query.currency ?? 'DOP');
  const rows = await db.movement.findMany({ where: { currency } });
  res.json({
    currency,
    scope: 'all-recorded-movements',
    ...summarize(
      rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })) as Movement[],
      currency,
    ),
  });
});
records.post('/imports', async (req, res) => {
  const data = z
    .object({ externalId: z.string().trim().min(1).max(200), body: z.string().min(1).max(10000) })
    .parse(req.body);
  const item = await db.mailImport.upsert({
    where: { externalId: data.externalId },
    create: data,
    update: {},
  });
  res.status(202).json({ id: item.id, status: item.status });
});
records.get('/imports/:id', async (req, res) => {
  const item = await db.mailImport.findUnique({
    where: { id: req.params.id },
    select: {
      ...importMetadata,
      id: true,
      body: true,
      status: true,
      externalId: true,
      parserVersion: true,
      movement: { select: { id: true } },
    },
  });
  if (!item) {
    res.status(404).json({ error: 'Importación no encontrada' });
    return;
  }
  const bank = item.status === 'REVIEW' ? parseBankWithdrawal(item.body) : null;
  res.json({ ...item, ...(bank ? { suggestion: { id: item.id, ...bank.movement } } : {}) });
});
records.post('/imports/:id/resolve', async (req, res) => {
  const data = movementSchema.parse(req.body);
  const id = req.params.id;
  const result = await resolveImport(id, data);
  if (result.status !== 201) {
    res.status(result.status).json({
      error:
        result.status === 404
          ? 'Importación no encontrada'
          : 'El correo ya no está pendiente de revisión',
    });
    return;
  }
  res.status(201).json(result.movement);
});
records.post('/imports/:id/dismiss', async (req, res) => {
  const id = req.params.id;
  const result = await db.mailImport.updateMany({
    where: { id, status: 'REVIEW' },
    data: { status: 'DISMISSED', body: '', reason: 'Descartado manualmente' },
  });
  if (!result.count) {
    res.status(409).json({ error: 'El correo no está pendiente de revisión' });
    return;
  }
  res.status(204).end();
});
records.get('/imports', async (_req, res) =>
  res.json(
    await db.mailImport.findMany({
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
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ),
);
