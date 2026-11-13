import { checkNativeTls } from './tls-pilot-smoke.mjs';
import assert from 'node:assert/strict';
import { checkRecoveryRetention } from './recovery-retention-smoke.mjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'node:crypto';
import { apiBase } from '../apps/mobile/src/access.ts';
export async function checkPersonalAccess(bootstrapToken, connectionString) {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const base = 'http://127.0.0.1:3000';
  const call = (path, body, token, method = body === undefined ? 'GET' : 'POST') =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const credentials = {
    name: 'Cuenta sintética CORE',
    email: 'owner@correo.test',
    password: 'Synthetic-Passphrase-Initial-2026',
  };
  const nextPassword = 'Synthetic-Passphrase-Updated-2026';
  const digest = (token) => createHash('sha256').update(token).digest('hex');
  try {
    assert.equal((await (await call('/auth/status')).json()).configured, false);
    assert.equal((await call('/auth/setup', credentials, 'incorrect-bootstrap')).status, 401);
    assert.equal(
      (await call('/auth/setup', { ...credentials, password: 'short' }, bootstrapToken)).status,
      400,
    );
    const creations = await Promise.all(
      [1, 2].map(() => call('/auth/setup', credentials, bootstrapToken)),
    );
    assert.deepEqual(creations.map((r) => r.status).sort(), [201, 409]);
    const payload = await creations.find((r) => r.status === 201).json();
    assert.ok(!JSON.stringify(payload).includes('passwordHash'));
    const owner = await db.appOwner.findUniqueOrThrow({ where: { id: 1 } });
    assert.match(owner.passwordHash, /^scrypt-v1\$/);
    assert.notEqual(owner.passwordHash, credentials.password);
    assert.equal(
      (await call('/movements', undefined, bootstrapToken)).status,
      401,
      'Bootstrap token stops granting data access once the personal account exists',
    );
    assert.equal((await call('/auth/setup', credentials, bootstrapToken)).status, 409);
    assert.equal(
      (
        await call('/auth/login', {
          email: credentials.email,
          password: 'Incorrect-Synthetic-Passphrase',
        })
      ).status,
      401,
    );
    const login = async (password) => {
      const r = await call('/auth/login', { email: credentials.email, password });
      assert.equal(r.status, 200);
      return r.json();
    };
    const first = await login(credentials.password);
    const second = await login(credentials.password);
    assert.match(first.token, /^fs_[\w-]{43}$/);
    assert.equal((await call('/movements', undefined, first.token)).status, 200);
    const stored = await db.accessSession.findUniqueOrThrow({ where: { id: first.sessionId } });
    assert.equal(stored.tokenHash, digest(first.token));
    assert.notEqual(stored.tokenHash, first.token);
    const sessions = await (await call('/auth/sessions', undefined, first.token)).json();
    assert.equal(sessions.length, 2);
    assert.equal(sessions.filter((s) => s.current).length, 1);
    assert.ok(sessions.every((s) => !('tokenHash' in s) && !('token' in s)));
    assert.equal((await call('/auth/sessions/revoke-others', {}, first.token)).status, 200);
    assert.equal((await call('/movements', undefined, second.token)).status, 401);
    assert.equal((await call('/auth/me', undefined, first.token)).status, 200);
    const profile = {
      name: 'Perfil actualizado',
      email: credentials.email.toUpperCase(),
      currentPassword: credentials.password,
    };
    assert.equal((await call('/auth/me', profile, second.token, 'PATCH')).status, 401);
    assert.equal(
      (await call('/auth/me', { ...profile, currentPassword: 'wrong' }, first.token, 'PATCH'))
        .status,
      401,
    );
    const edit = await call('/auth/me', profile, first.token, 'PATCH');
    assert.equal(edit.status, 200);
    const expected = { id: 1, name: profile.name, email: credentials.email };
    assert.deepEqual(await edit.json(), { owner: expected });
    assert.deepEqual(
      (await (await call('/auth/me', undefined, first.token)).json()).owner,
      expected,
    );
    await checkNativeTls(first.token, second.token);
    assert.equal(
      (
        await call(
          '/auth/password',
          { currentPassword: credentials.password, newPassword: nextPassword },
          first.token,
        )
      ).status,
      204,
    );
    assert.equal((await call('/auth/me', undefined, first.token)).status, 401);
    assert.equal(
      (await call('/auth/login', { email: credentials.email, password: credentials.password }))
        .status,
      401,
    );
    const changed = await login(nextPassword);
    assert.equal((await call('/auth/logout', {}, changed.token)).status, 204);
    assert.equal((await call('/movements', undefined, changed.token)).status, 401);
    const expired = await login(nextPassword);
    await db.accessSession.update({
      where: { id: expired.sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await call('/auth/me', undefined, expired.token)).status, 401);
    await checkRecoveryRetention(call, db, nextPassword);
    let limited = false;
    for (let i = 0; i < 12; i++) {
      const result = await call('/auth/login', { email: 'invalid' });
      if (result.status === 429) {
        assert.ok(result.headers.get('retry-after'));
        limited = true;
        break;
      }
    }
    assert.ok(limited, 'Login attempts are throttled');
    const oldUrl = process.env.EXPO_PUBLIC_API_URL;
    try {
      for (const url of [
        'http://10.evil.example',
        'http://192.168.evil.example',
        'http://example.test',
        'https://user:password@example.test',
      ]) {
        process.env.EXPO_PUBLIC_API_URL = url;
        assert.throws(apiBase);
      }
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:3000';
      assert.equal(apiBase(), 'http://192.168.1.10:3000');
    } finally {
      if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = oldUrl;
    }
    console.info(
      'PASS CORE ACCESS: singleton setup, scrypt/hash-only sessions, bootstrap disabled, login/logout/expiry, password revocation, other sessions, throttling and API URL boundary',
    );
  } finally {
    await db.$disconnect();
  }
}
