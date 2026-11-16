/* global Response */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import express from 'express';
import { register } from 'tsx/esm/api';

export async function checkGmailConnection(connectionString, sessionId, db) {
  process.env.DATABASE_URL = connectionString;
  const unregister = register();
  const { createGmail } = await import('../apps/api/src/controllers/gmail.ts');
  const redirect = 'http://127.0.0.1:3000/integrations/gmail/callback';
  const syntheticToken = 'refresh-token-for-test-only';
  let challenge;
  let exchanges = 0;
  const gmail = createGmail(
    {
      GMAIL_CLIENT_ID: 'client-for-test',
      GMAIL_CLIENT_SECRET: 'secret-for-test',
      GMAIL_TOKEN_KEY: '01'.repeat(32),
      GMAIL_REDIRECT_URI: redirect,
    },
    async (_url, { body }) => {
      exchanges++;
      assert.equal(body.get('code'), 'synthetic-code');
      assert.equal(body.get('redirect_uri'), redirect);
      assert.equal(
        createHash('sha256').update(body.get('code_verifier')).digest('base64url'),
        challenge,
      );
      return Response.json({
        refresh_token: syntheticToken,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      });
    },
  );
  const app = express();
  app.use(gmail.publicRoutes);
  app.use((req, res, next) => {
    if (req.headers.authorization === 'Bearer synthetic-session') {
      res.locals.accessSession = { id: sessionId, ownerId: 1 };
    }
    next();
  });
  app.use(gmail.sessionRoutes);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port + '/integrations/gmail';
    const headers = { Authorization: 'Bearer synthetic-session' };
    assert.equal((await fetch(base + '/connect', { method: 'POST' })).status, 401);
    const start = await fetch(base + '/connect', { method: 'POST', headers });
    const url = new URL((await start.json()).authorizationUrl);
    challenge = url.searchParams.get('code_challenge');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal((await fetch(base + '/callback?state=invalid&code=synthetic-code')).status, 400);
    const callback =
      base + '/callback?state=' + url.searchParams.get('state') + '&code=synthetic-code';
    assert.equal((await fetch(callback)).status, 200);
    assert.equal((await fetch(callback)).status, 400);
    assert.equal(exchanges, 1);
    assert.deepEqual(await (await fetch(base, { headers })).json(), { status: 'connected' });
    const saved = await db.gmailConnection.findUniqueOrThrow({ where: { ownerId: 1 } });
    assert.ok(!saved.encryptedToken.includes(syntheticToken));
    assert.equal((await fetch(base, { method: 'DELETE', headers })).status, 204);
    assert.deepEqual(await (await fetch(base, { headers })).json(), { status: 'disconnected' });
    console.log('PASS: Gmail OAuth, PKCE, callback de un solo uso y eliminación de credencial.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const { db: gmailDb } = await import('../packages/database/src/index.ts');
    await gmailDb.$disconnect();
    unregister();
  }
}
