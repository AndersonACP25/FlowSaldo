import type express from 'express';
import { z } from 'zod';
import { AuthError } from '../controllers/auth';
import { CategoryError } from '../models/categories';

export function renderError(
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) {
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof CategoryError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    res
      .status(409)
      .json({ error: 'El registro ya existe; actualiza la lista antes de reintentar.' });
    return;
  }
  if (typeof error === 'object' && error !== null) {
    const code =
      ('code' in error ? error.code : undefined) ??
      ('errorCode' in error ? error.errorCode : undefined);
    if (code === 'P1001' || code === 'P1002' || code === 'P1017' || code === 'P2024') {
      res.status(503).json({
        error:
          'PostgreSQL no está disponible. Verifica que esté activo y que DATABASE_URL use el puerto correcto.',
      });
      return;
    }
    if (code === 'P1000' || code === 'P1010') {
      res.status(503).json({
        error:
          'La API no pudo autenticarse en PostgreSQL. Revisa las credenciales y permisos de DATABASE_URL.',
      });
      return;
    }
    if (code === 'P2021' || code === 'P2022') {
      res.status(503).json({
        error: 'La base de datos de FlowSaldo requiere migraciones. Ejecuta pnpm db:setup.',
      });
      return;
    }
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }
  res.status(500).json({ error: 'Error interno' });
}
