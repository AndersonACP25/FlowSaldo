import { Router, type RequestHandler } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { registerAccountRecovery, registerRecoveryCodes } from './authRecovery';
import { registerPasswordChange, registerSessionManagement } from './authSessions';
import { registerRetention } from './authRetention';
import {
  AuthError,
  bearer,
  bootstrapMatches,
  email,
  hashPassword,
  name,
  password,
  publicOwner,
  sessionLifetime,
  throttle,
  tokenDigest,
  verify,
} from './authSupport';
export { AuthError, tokenDigest } from './authSupport';
export function createAuth(bootstrapSecret: string) {
  const publicRoutes = Router(),
    sessionRoutes = Router();
  const authorize: RequestHandler = async (req, res, next) => {
    const token = bearer(req.headers.authorization);
    if (/^fs_[A-Za-z0-9_-]{43}$/.test(token)) {
      const session = await db.accessSession.findUnique({
        where: { tokenHash: tokenDigest(token) },
        include: { owner: { select: publicOwner } },
      });
      if (session && !session.revokedAt && session.expiresAt > new Date()) {
        res.locals.accessSession = session;
        next();
        return;
      }
    }
    if (
      bootstrapMatches(token, bootstrapSecret) &&
      !(await db.appOwner.findUnique({ where: { id: 1 }, select: { id: true } }))
    ) {
      res.locals.developmentAccess = true;
      next();
      return;
    }
    res
      .status(401)
      .json({ error: 'La sesión no es válida o ha vencido. Inicia sesión nuevamente.' });
  };
  const requireSession: RequestHandler = (_req, res, next) => {
    if (!res.locals.accessSession) {
      res
        .status(401)
        .json({ error: 'Esta acción requiere iniciar sesión con la cuenta personal.' });
      return;
    }
    next();
  };
  publicRoutes.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  sessionRoutes.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  publicRoutes.get('/auth/status', async (_req, res) =>
    res.json({
      configured: !!(await db.appOwner.findUnique({ where: { id: 1 }, select: { id: true } })),
    }),
  );
  publicRoutes.post('/auth/setup', throttle('setup', 5), async (req, res) => {
    if (!bootstrapMatches(bearer(req.headers.authorization), bootstrapSecret))
      throw new AuthError('Token de configuración no válido.');
    const data = z.object({ name, email, password }).parse(req.body);
    if (await db.appOwner.findUnique({ where: { id: 1 }, select: { id: true } }))
      throw new AuthError('Esta instalación ya tiene una cuenta personal.', 409);
    const passwordHash = await hashPassword(data.password);
    try {
      const owner = await db.appOwner.create({
        data: { id: 1, name: data.name, email: data.email, passwordHash },
        select: publicOwner,
      });
      res.status(201).json({ owner });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')
        throw new AuthError('Esta instalación ya tiene una cuenta personal.', 409);
      throw error;
    }
  });
  publicRoutes.post('/auth/login', throttle('login', 10), async (req, res) => {
    const data = z.object({ email, password: z.string().min(1).max(128) }).parse(req.body);
    const owner = await db.appOwner.findUnique({ where: { email: data.email } });
    if (!(await verify(data.password, owner?.passwordHash)) || !owner)
      throw new AuthError('Correo o contraseña incorrectos.');
    const token = 'fs_' + randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionLifetime);
    const session = await db.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<
        Array<{ passwordHash: string }>
      >`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
      if (current?.passwordHash !== owner.passwordHash)
        throw new AuthError('La contraseña cambió. Inicia sesión nuevamente.');
      // Expired/revoked sessions are unnecessary credentials and are removed when issuing a new one.
      await tx.accessSession.deleteMany({
        where: { OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] },
      });
      if ((await tx.accessSession.count({ where: { ownerId: 1 } })) >= 10) {
        const oldest = await tx.accessSession.findFirstOrThrow({
          where: { ownerId: 1 },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });
        await tx.accessSession.update({
          where: { id: oldest.id },
          data: { revokedAt: new Date() },
        });
      }
      return tx.accessSession.create({
        data: { ownerId: 1, tokenHash: tokenDigest(token), expiresAt },
        select: { id: true },
      });
    });
    res.json({
      token,
      expiresAt,
      sessionId: session.id,
      owner: { id: owner.id, name: owner.name, email: owner.email },
    });
  });
  registerAccountRecovery(publicRoutes);
  sessionRoutes.use('/auth', requireSession);
  sessionRoutes.get('/auth/me', (_req, res) => {
    const s = res.locals.accessSession;
    res.json({ owner: s.owner, expiresAt: s.expiresAt, sessionId: s.id });
  });
  sessionRoutes.patch('/auth/me', throttle('profile', 5), async (req, res) => {
    const {
      name: displayName,
      email: address,
      currentPassword,
    } = z
      .object({ name, email, currentPassword: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    const session = res.locals.accessSession;
    const existing = await db.appOwner.findUniqueOrThrow({ where: { id: session.owner.id } });
    if (!(await verify(currentPassword, existing.passwordHash)))
      throw new AuthError('La contraseña actual no es correcta.');
    const owner = await db.$transaction(async (tx) => {
      const result = await tx.appOwner.updateMany({
        where: {
          id: existing.id,
          passwordHash: existing.passwordHash,
          sessions: { some: { id: session.id, revokedAt: null, expiresAt: { gt: new Date() } } },
        },
        data: { name: displayName, email: address },
      });
      if (!result.count) throw new AuthError('La sesión cambió. Inicia sesión nuevamente.');
      return tx.appOwner.findUniqueOrThrow({ where: { id: existing.id }, select: publicOwner });
    });
    res.json({ owner });
  });
  registerSessionManagement(sessionRoutes);
  registerRecoveryCodes(sessionRoutes);
  registerRetention(sessionRoutes);
  registerPasswordChange(sessionRoutes);
  return { publicRoutes, authorize, sessionRoutes };
}
