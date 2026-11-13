import assert from 'node:assert/strict';
export async function checkRecurring(request) {
  const send = (path, method, body) => request(path, { method, body: JSON.stringify(body) });
  const get = async (path) => {
    const r = await request(path);
    assert.equal(r.status, 200);
    return r.json();
  };
  const category = (await get('/categories')).find((c) => c.system);
  const name = 'Recurrencia CORE ' + Date.now();
  const response = await send('/recurring', 'POST', {
    description: name,
    amountMinor: 12345,
    currency: 'DOP',
    type: 'EXPENSE',
    categoryId: category.id,
    startDate: '2026-01-31',
  });
  assert.equal(response.status, 201);
  const t = await response.json();
  const confirm = () =>
    send('/recurring/' + t.id + '/confirm', 'POST', {
      scheduledFor: t.nextDate,
      expectedVersion: t.version,
    });
  const results = await Promise.all([confirm(), confirm()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const result = await results.find((r) => r.status === 201).json();
  assert.equal(result.nextDate, '2026-02-28');
  assert.equal(
    (
      await get(
        `/movements?page=true&month=2026-01&currency=DOP&search=${encodeURIComponent(name)}`,
      )
    ).total,
    1,
  );
  await request('/movements/' + result.movement.id, { method: 'DELETE' });
  assert.equal(
    (await confirm()).status,
    409,
    'Deleting a movement cannot reopen a confirmed occurrence',
  );
  await send('/recurring/' + t.id, 'PATCH', { active: false });
  assert.equal(
    (
      await send('/recurring/' + t.id + '/confirm', 'POST', {
        scheduledFor: '2026-02-28',
        expectedVersion: 2,
      })
    ).status,
    409,
  );
  await send('/recurring/' + t.id, 'PATCH', { active: true, description: name + ' editado' });
  const current = (await get('/recurring')).find((r) => r.id === t.id);
  assert.equal(
    (
      await send('/recurring/' + t.id + '/confirm', 'POST', {
        scheduledFor: current.nextDate,
        expectedVersion: 0,
      })
    ).status,
    409,
    'Stale amounts/categories cannot be confirmed',
  );
  const next = await send('/recurring/' + t.id + '/confirm', 'POST', {
    scheduledFor: current.nextDate,
    expectedVersion: current.version,
  });
  assert.equal(next.status, 201);
  const nextResult = await next.json();
  assert.equal(nextResult.nextDate, '2026-03-31');
  await request('/movements/' + nextResult.movement.id, { method: 'DELETE' });
  const future = await send('/recurring', 'POST', {
    description: 'Futuro CORE',
    amountMinor: 1,
    currency: 'USD',
    type: 'INCOME',
    categoryId: category.id,
    startDate: '2099-01-01',
  });
  assert.equal(future.status, 201);
  const f = await future.json();
  assert.equal(
    (
      await send('/recurring/' + f.id + '/confirm', 'POST', {
        scheduledFor: f.nextDate,
        expectedVersion: f.version,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await send('/recurring', 'POST', {
        description: 'Fecha inválida',
        amountMinor: 1,
        currency: 'DOP',
        type: 'EXPENSE',
        categoryId: category.id,
        startDate: '2026-02-30',
      })
    ).status,
    400,
  );
  // Complete prior/current monthly comparison and empty baseline; no UI matrix for arithmetic.
  const movement = {
    amountMinor: 10000,
    currency: 'DOP',
    type: 'EXPENSE',
    categoryId: category.id,
    description: 'Comparativa CORE',
    occurredAt: '2045-01-01T12:00:00.000Z',
  };
  const a = await (await send('/movements', 'POST', movement)).json();
  const b = await (
    await send('/movements', 'POST', {
      ...movement,
      amountMinor: 8000,
      occurredAt: '2045-02-01T12:00:00.000Z',
    })
  ).json();
  const comparison = (await get('/summary?month=2045-02&currency=DOP')).comparison;
  assert.equal(comparison.previousMonth, '2045-01');
  assert.equal(comparison.expense.percentage, -20);
  assert.equal(comparison.income.percentage, 0);
  assert.equal(
    (await get('/summary?month=2045-01&currency=DOP')).comparison.expense.percentage,
    null,
  );
  for (const id of [a.id, b.id]) await request('/movements/' + id, { method: 'DELETE' });
  console.info(
    'PASS CORE API: monthly recurrence concurrency/ledger/pause/date rules and monthly comparison zero baseline',
  );
}
