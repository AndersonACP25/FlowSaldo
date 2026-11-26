import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createApiClient } from '../apps/mobile/src/apiClient.ts';
import {
  readFinancialAccounts,
  readMovementPage,
  readRefundInfo,
} from '../apps/mobile/src/apiContracts.ts';

test('FlowSaldo HTTP keeps login errors separate from expired sessions and supports CSV and 204', async (t) => {
  const baseUrl = 'https://saldo.example.test';
  let expired = 0;
  const responses = [
    globalThis.Response.json({ error: 'Credenciales incorrectas.' }, { status: 401 }),
    globalThis.Response.json({ error: 'Sesión revocada.' }, { status: 401 }),
    new globalThis.Response('Fecha,Monto\r\n2026-11-26,25.00'),
    new globalThis.Response(null, { status: 204 }),
  ];
  t.mock.method(globalThis, 'fetch', async (url, { headers }) => {
    assert.ok(url.startsWith(baseUrl + '/'));
    if (url.endsWith('/export')) assert.equal(headers.has('Content-Type'), false);
    else assert.equal(headers.get('Content-Type'), 'application/json');
    if (!url.endsWith('/login'))
      assert.equal(headers.get('Authorization'), 'Bearer token-sintético');
    return responses.shift();
  });
  const login = createApiClient({ baseUrl });
  const personal = createApiClient({
    baseUrl,
    token: 'token-sintético',
    onUnauthorized: async () => {
      expired++;
    },
  });
  await assert.rejects(login.json('/auth/login'), {
    status: 401,
    message: 'Credenciales incorrectas.',
  });
  assert.equal(expired, 0);
  await assert.rejects(
    personal.json('/movements'),
    (error) => error instanceof ApiError && error.status === 401 && /sesión/.test(error.message),
  );
  assert.equal(expired, 1);
  assert.equal(await personal.text('/movements/export'), 'Fecha,Monto\r\n2026-11-26,25.00');
  assert.equal(await personal.json('/movements/fixture', { method: 'DELETE' }), null);
});

test('FlowSaldo HTTP honors caller cancellation and reports its own timeout', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    if (signal.aborted) throw signal.reason;
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
    );
  });
  const client = createApiClient({ baseUrl: 'https://saldo.example.test', timeoutMs: 5 });
  await assert.rejects(client.json('/accounts'), /tardó demasiado/);
  const controller = new globalThis.AbortController();
  const pending = client.json('/accounts', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('financial responses reject invalid amounts and preserve the supported wire shapes', () => {
  const expense = {
    id: 'gasto-fixture',
    description: 'Compra sintética',
    category: 'Servicios',
    occurredAt: '2026-11-26T14:00:00.000Z',
    currency: 'DOP',
    type: 'EXPENSE',
    amountMinor: 2500,
  };
  const history = { items: [expense], total: 1, nextCursor: null };
  assert.deepEqual(readMovementPage(history), history);
  assert.throws(() =>
    readMovementPage({ ...history, items: [{ ...expense, amountMinor: '2500' }] }),
  );
  assert.throws(() => readMovementPage({ ...history, nextCursor: 4 }));

  const refund = { source: expense, refundedMinor: 1000, remainingMinor: 1500 };
  assert.deepEqual(readRefundInfo(refund, expense.id), refund);
  assert.throws(() => readRefundInfo(refund, 'otro-gasto'));
  assert.throws(() => readRefundInfo({ ...refund, remainingMinor: 2500 }, expense.id));

  const account = {
    id: 'cuenta-fixture',
    name: 'Cuenta sintética',
    kind: 'BANK',
    currency: 'DOP',
    openingMinor: 0,
    balanceMinor: -1000,
    debtMinor: 0,
    creditLimitMinor: null,
    availableCreditMinor: null,
    archived: false,
    revision: 0,
    reconciledThrough: null,
  };
  assert.deepEqual(readFinancialAccounts([account]), [account]);
  assert.throws(() => readFinancialAccounts([{ ...account, balanceMinor: -10.5 }]));
});
