import { Router } from 'express';
import { z } from 'zod';
import { listBanks, setBankRegistration } from '../models/banks';

const bankId = z.string().regex(/^[a-z0-9-]{1,64}$/u);
const registration = z.object({ registered: z.boolean() });

export const bankRoutes = Router();
bankRoutes.use('/banks', (_req, res, next) => {
  if (!res.locals.accessSession) {
    res
      .status(401)
      .json({ error: 'Inicia sesión con tu cuenta personal para administrar bancos.' });
    return;
  }
  next();
});
bankRoutes.get('/banks', async (_req, res) => {
  res.json(await listBanks(res.locals.accessSession.ownerId));
});
bankRoutes.patch('/banks/:id', async (req, res) => {
  const { registered } = registration.parse(req.body);
  const found = await setBankRegistration(
    res.locals.accessSession.ownerId,
    bankId.parse(req.params.id),
    registered,
  );
  if (!found) {
    res.status(404).json({ error: 'Banco no encontrado en el catálogo.' });
    return;
  }
  res.status(204).end();
});
