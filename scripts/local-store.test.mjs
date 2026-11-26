import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalStore } from '../apps/mobile/src/localStore.ts';
import {
  cashProjectionKey,
  hasUnassignedConnectedData,
  isCashProjectionKey,
  localDataScope,
  replaceDemoData,
} from '../apps/mobile/src/dataScopes.ts';
import { movementCommands } from '../apps/mobile/src/movementCommands.ts';

test('local writes use the last committed snapshot and reject a stale restore preview', async () => {
  const initial = { movements: ['existing'], limitMinor: 0 };
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  let saved = initial;
  let writes = 0;
  const store = createLocalStore(
    async () => saved,
    async (next) => {
      if (++writes === 1) {
        started.resolve();
        await release.promise;
      }
      saved = next;
    },
  );
  const preview = await store.load();
  const first = store.update(initial, (current) => ({ ...current, limitMinor: 250 }));
  await started.promise;
  const second = store.update(initial, (current) => ({
    ...current,
    movements: [...current.movements, 'new'],
  }));
  const restore = assert.rejects(
    store.update(initial, (current) => {
      if (current !== preview) throw new Error('Los datos locales cambiaron.');
      return initial;
    }),
    /datos locales cambiaron/,
  );
  assert.equal(saved, initial);
  release.resolve();
  await Promise.all([first, second, restore]);
  assert.deepEqual(saved, { movements: ['existing', 'new'], limitMinor: 250 });
  assert.equal(await store.load(), saved);
  assert.equal(writes, 2);
  saved = { ...saved, limitMinor: 300 };
  assert.equal((await store.load()).limitMinor, 300);
});

test('a failed write preserves the committed snapshot and the next update can succeed', async () => {
  const initial = { remainingMinor: 500 };
  let saved = initial;
  let fail = true;
  const store = createLocalStore(
    async () => saved,
    async (next) => {
      if (fail) {
        fail = false;
        throw new Error('No hay espacio');
      }
      saved = next;
    },
  );
  const failed = assert.rejects(
    store.update(initial, (current) => ({ remainingMinor: current.remainingMinor - 200 })),
    /No hay espacio/,
  );
  await Promise.all([
    failed,
    store.update(initial, (current) => ({ remainingMinor: current.remainingMinor - 100 })),
  ]);
  assert.deepEqual(saved, { remainingMinor: 400 });

  let damaged = true;
  const unreadable = createLocalStore(
    async () => {
      if (damaged) throw new Error('Archivo dañado');
      return saved;
    },
    async (next) => {
      saved = next;
      damaged = false;
    },
  );
  await assert.rejects(unreadable.load(), /Archivo dañado/);
  await assert.rejects(
    unreadable.update(initial, () => initial),
    /Archivo dañado/,
  );
  assert.deepEqual(saved, { remainingMinor: 400 });
  await unreadable.update(initial, () => initial, true);
  assert.equal(await unreadable.load(), initial);
});

test('concurrent local refunds respect the original amount and replay only once', async () => {
  const expense = {
    id: 'purchase',
    amountMinor: 1_000,
    currency: 'DOP',
    type: 'EXPENSE',
    description: 'Compra sintética',
    occurredAt: '2026-11-25T12:00:00.000Z',
    category: 'Servicios',
    categoryId: 'services',
  };
  const initial = { movements: [expense], accounts: [], reviews: [], receipts: [] };
  let saved = initial;
  const store = createLocalStore(
    async () => saved,
    async (next) => {
      saved = next;
    },
  );
  const commands = movementCommands({
    request: null,
    persist: (change) => store.update(initial, change),
    refreshMovements: async () => {},
  });
  const occurredAt = '2026-11-25T15:00:00.000Z';
  const draft = { expense, requestKey: 'refund-1' };
  await Promise.all([
    commands.refund(draft, 600, occurredAt),
    commands.refund(draft, 600, occurredAt),
    assert.rejects(commands.refund({ ...draft, requestKey: 'refund-2' }, 500, occurredAt)),
  ]);
  assert.deepEqual(
    saved.movements
      .filter((movement) => movement.refundOfId === expense.id)
      .map((movement) => movement.amountMinor),
    [600],
  );
});

test('demo replacement preserves connected and unassigned records across accounts and servers', () => {
  const url = 'https://saldo.example.test:8443/api';
  const personal = localDataScope(url, 1);
  const otherOwner = localDataScope(url, 2);
  const otherServer = localDataScope('https://saldo2.example.test/api', 1);
  const development = localDataScope(url, 'development');
  assert.equal(personal, JSON.stringify([url, 1]));
  assert.equal(
    new Set([personal, otherOwner, otherServer, development, localDataScope(url, null)]).size,
    5,
  );

  const personalKey = cashProjectionKey(personal, 'EUR');
  for (const key of [personalKey, 'demo:DOP', 'api:USD']) assert.ok(isCashProjectionKey(key));
  for (const key of [
    personalKey.replace('EUR', 'GBP'),
    'owner:1:EUR',
    '["https://saldo.example.test",0]:EUR',
  ])
    assert.equal(isCashProjectionKey(key), false);

  const cache = {
    budgets: {},
    categoryBudgets: {},
    cashProjections: { [personalKey]: { balanceMinor: 1250 }, 'api:USD': { balanceMinor: 700 } },
    savingsGoals: {
      demo: ['old demo'],
      api: ['unassigned'],
      [personal]: ['personal'],
      [development]: ['dev'],
    },
    pendingItems: {
      demo: ['old demo'],
      'owner:1': ['unassigned'],
      [personal]: ['personal'],
      [otherServer]: ['other'],
    },
    debtPlans: { [personal]: ['existing plan'] },
    monthlyClosings: { [otherOwner]: ['existing closing'] },
    commerceRules: { [otherServer]: ['existing rule'] },
  };
  const demo = {
    budgets: {},
    categoryBudgets: {},
    cashProjections: { 'demo:EUR': { balanceMinor: 900 } },
    savingsGoals: { demo: ['restored demo'], api: [] },
    pendingItems: {},
    debtPlans: {},
    monthlyClosings: {},
    commerceRules: {},
  };
  assert.equal(hasUnassignedConnectedData(demo), false);
  const restored = replaceDemoData(cache, demo);
  assert.deepEqual(restored, {
    ...cache,
    cashProjections: { ...cache.cashProjections, ...demo.cashProjections },
    savingsGoals: { ...cache.savingsGoals, demo: demo.savingsGoals.demo },
    pendingItems: { 'owner:1': ['unassigned'], [personal]: ['personal'], [otherServer]: ['other'] },
  });
  assert.equal(hasUnassignedConnectedData(restored), true);
});
