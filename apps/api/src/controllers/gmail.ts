import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';

const callbackPath = '/integrations/gmail/callback';
const scope = 'https://www.googleapis.com/auth/gmail.readonly';
const settingsSchema = z.object({
  GMAIL_CLIENT_ID: z.string().min(1),
  GMAIL_CLIENT_SECRET: z.string().min(1),
  GMAIL_TOKEN_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  GMAIL_REDIRECT_URI: z.url(),
});
const tokenSchema = z.object({
  refresh_token: z.string().min(1),
  scope: z.string().refine((value) => value.split(/\s+/).includes(scope)),
});

type Attempt = {
  state: string;
  verifier: string;
  sessionId: string;
  ownerId: number;
  expires: number;
};

function encrypt(token: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const result = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), result].map((part) => part.toString('base64url')).join('.');
}

export function createGmail(env = process.env, send = fetch) {
  const publicRoutes = Router();
  const sessionRoutes = Router();
  const result = settingsSchema.safeParse(env);
  const settings = result.success ? result.data : null;
  if (!settings && Object.keys(settingsSchema.shape).some((name) => env[name])) {
    throw new Error('Completa las cuatro variables GMAIL_* antes de arrancar FlowSaldo.');
  }
  if (settings) {
    const uri = new URL(settings.GMAIL_REDIRECT_URI);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(uri.hostname);
    if (
      (uri.protocol !== 'https:' &&
        !(uri.protocol === 'http:' && env.NODE_ENV !== 'production' && loopback)) ||
      uri.pathname !== callbackPath ||
      uri.search ||
      uri.hash ||
      uri.username ||
      uri.password
    ) {
      throw new Error(
        'GMAIL_REDIRECT_URI debe apuntar al callback de Gmail por HTTPS o loopback local.',
      );
    }
  }

  let attempt: Attempt | undefined;
  let exchanging = false;
  sessionRoutes.use('/integrations/gmail', (_req, res, next) => {
    if (!res.locals.accessSession) {
      res.status(401).json({ error: 'Inicia sesión con la cuenta personal.' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    next();
  });

  sessionRoutes.get('/integrations/gmail', async (_req, res) => {
    if (!settings) {
      res.json({ status: 'unavailable' });
      return;
    }
    const existing = await db.gmailConnection.findUnique({
      where: { ownerId: res.locals.accessSession.ownerId },
      select: { ownerId: true },
    });
    res.json({ status: existing ? 'connected' : 'disconnected' });
  });

  sessionRoutes.delete('/integrations/gmail', async (_req, res) => {
    if (exchanging) {
      res.status(409).json({ error: 'Espera a que termine la autorización.' });
      return;
    }
    attempt = undefined;
    await db.gmailConnection.deleteMany({ where: { ownerId: res.locals.accessSession.ownerId } });
    res.sendStatus(204);
  });

  sessionRoutes.post('/integrations/gmail/connect', (_req, res) => {
    if (!settings || exchanging) {
      res
        .status(settings ? 409 : 503)
        .json({ error: 'La conexión de Gmail no está disponible en este momento.' });
      return;
    }
    const { id, ownerId } = res.locals.accessSession;
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    attempt = { state, verifier, sessionId: id, ownerId, expires: Date.now() + 10 * 60 * 1000 };
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: settings.GMAIL_CLIENT_ID,
      redirect_uri: settings.GMAIL_REDIRECT_URI,
      response_type: 'code',
      scope,
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    res.json({ authorizationUrl: url.href });
  });

  publicRoutes.get(callbackPath, async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    const pending = attempt;
    if (
      !settings ||
      !pending ||
      req.query.state !== pending.state ||
      pending.expires <= Date.now()
    ) {
      res
        .status(400)
        .type('text')
        .send('La solicitud venció o ya se usó. Inicia la conexión desde FlowSaldo.');
      return;
    }
    attempt = undefined;
    const code = req.query.code;
    if (req.query.error || typeof code !== 'string' || !code || code.length > 4096) {
      res.status(400).type('text').send('Google no completó la autorización. Regresa a FlowSaldo.');
      return;
    }
    exchanging = true;
    try {
      const response = await send('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
          code,
          client_id: settings.GMAIL_CLIENT_ID,
          client_secret: settings.GMAIL_CLIENT_SECRET,
          redirect_uri: settings.GMAIL_REDIRECT_URI,
          grant_type: 'authorization_code',
          code_verifier: pending.verifier,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Google rechazó el intercambio.');
      const { refresh_token } = tokenSchema.parse(await response.json());
      const stored = await db.$transaction(async (tx) => {
        const [session] = await tx.$queryRaw<Array<{ valid: boolean }>>`
          SELECT ("revokedAt" IS NULL AND "expiresAt" > NOW()) AS valid
          FROM "AccessSession" WHERE id = ${pending.sessionId} AND "ownerId" = ${pending.ownerId}
          FOR UPDATE
        `;
        if (!session?.valid) return false;
        const encryptedToken = encrypt(refresh_token, settings.GMAIL_TOKEN_KEY);
        await tx.gmailConnection.upsert({
          where: { ownerId: pending.ownerId },
          create: { ownerId: pending.ownerId, encryptedToken },
          update: { encryptedToken },
        });
        return true;
      });
      if (!stored) {
        res
          .status(401)
          .type('text')
          .send('La sesión de FlowSaldo venció. Inicia sesión y vuelve a conectar.');
        return;
      }
      res.type('text').send('Gmail conectado. Regresa a FlowSaldo y pulsa Actualizar estado.');
    } catch {
      res
        .status(502)
        .type('text')
        .send('No se pudo guardar la conexión. Vuelve a intentarlo desde FlowSaldo.');
    } finally {
      exchanging = false;
    }
  });

  return { publicRoutes, sessionRoutes };
}
