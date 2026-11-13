import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseCsv } from './export-guardian.mjs';

export async function checkHistory(request, connectionString) {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const prefix = `history-${Date.now()}-`;
  const stamp = new Date('2040-01-31T12:00:00.000Z');
  const fixtures = Array.from({ length: 205 }, (_, i) => ({
    id: prefix + String(i).padStart(4, '0'),
    amountMinor: i === 203 ? 10000 : 101,
    currency: 'DOP',
    type: i === 203 ? 'INCOME' : i === 204 ? 'TRANSFER' : 'EXPENSE',
    description: i === 0 ? 'Compra %_ literal' : 'Historial sintético',
    category: 'Prueba',
    occurredAt: stamp,
  }));
  try {
    await db.movement.createMany({
      data: [
        ...fixtures,
        { ...fixtures[0], id: prefix + 'usd', currency: 'USD' },
        {
          ...fixtures[0],
          id: prefix + 'other-month',
          occurredAt: new Date('2039-12-31T12:00:00Z'),
        },
      ],
    });
    await db.mailImport.createMany({
      data: Array.from({ length: 106 }, (_, i) => ({
        id: prefix + i,
        externalId: prefix + i,
        body: '',
        status: i === 105 ? 'DISMISSED' : 'REVIEW',
        createdAt: new Date(i === 105 ? '2040-01-02T00:00:00Z' : '2040-01-01T23:59:59Z'),
      })),
    });
    const get = async (path) => {
      const res = await request(path);
      assert.equal(res.status, 200, path);
      return res.json();
    };
    const summary = await get('/summary?month=2040-01&currency=DOP');
    assert.equal(summary.total, 205);
    assert.equal(summary.incomeMinor, 10000);
    assert.equal(summary.expenseMinor, 203 * 101);
    assert.equal(summary.differenceMinor, 10000 - 203 * 101);
    assert.deepEqual(summary.categories, [{ category: 'Prueba', amountMinor: 203 * 101 }]);
    assert.equal(summary.days.at(-1).expenseMinor, 203 * 101);
    assert.equal(summary.days.at(-1).incomeMinor, 10000);
    const week = await get('/summary?month=2040-01&currency=DOP&weekEnd=2040-01-03');
    assert.equal(week.expenseMinor, summary.expenseMinor);
    assert.equal(week.days.at(-1).day, '2040-01-03');
    assert.equal(week.days.find((day) => day.day === '2039-12-31').expenseMinor, 101);
    assert.equal((await request('/summary?month=2040-01&weekEnd=2040-02-01')).status, 400);
    const empty = await get('/summary?month=2041-01&currency=DOP');
    assert.equal(empty.total, 0);
    assert.equal(empty.days.length, 7);
    assert.equal(empty.expenseMinor, 0);
    const ids = [];
    let cursor = null;
    do {
      const page = await get(
        '/movements?page=true&month=2040-01&currency=DOP&limit=37' +
          (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      assert.equal(page.total, 205);
      ids.push(...page.items.map((v) => v.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.deepEqual(
      ids,
      fixtures.map((v) => v.id),
    );
    assert.equal(new Set(ids).size, 205);
    const literal = await get('/movements?page=true&month=2040-01&currency=DOP&search=%25_');
    assert.equal(literal.total, 1);
    const typed = await get('/movements?page=true&month=2040-01&currency=DOP&type=TRANSFER');
    assert.equal(typed.total, 1);
    const csv = await request('/movements/export?month=2040-01&currency=DOP');
    assert.match(csv.headers.get('content-disposition'), /FlowSaldo-2040-01.csv/);
    assert.equal(parseCsv(await csv.text()).length, 206);
    const exportFiltered = await request(
      '/movements/export?month=2040-01&currency=DOP&type=EXPENSE&search=literal',
    );
    assert.equal(parseCsv(await exportFiltered.text()).length, 2);
    const first = await get('/movements?page=true&month=2040-01&currency=DOP&limit=1');
    await db.movement.delete({ where: { id: first.items[0].id } });
    const second = await get(
      '/movements?page=true&month=2040-01&currency=DOP&limit=1&cursor=' +
        encodeURIComponent(first.nextCursor),
    );
    assert.equal(second.items[0].id, fixtures[1].id, 'Deleted anchor still allows continuation');
    const importIds = [];
    cursor = null;
    do {
      const page = await get(
        '/imports?page=true&status=REVIEW&from=2040-01-01&to=2040-01-01&limit=29' +
          (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      assert.equal(page.total, 105);
      assert.ok(page.pendingTotal >= 105);
      assert.ok(page.items.every((v) => v.status === 'REVIEW' && !('body' in v)));
      importIds.push(...page.items.map((v) => v.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(new Set(importIds).size, 105);
    assert.equal(importIds.length, 105);
    assert.equal(
      (await get('/imports?page=true&status=DISMISSED&from=2040-01-02&to=2040-01-02')).total,
      1,
    );
    for (const path of [
      '/movements?page=true&cursor=invalid',
      '/movements?page=true&limit=201',
      '/summary?month=2040-13',
      '/imports?page=true&from=2040-02-30',
      '/imports?page=true&from=2040-02-01&to=2040-01-01',
    ])
      assert.equal((await request(path)).status, 400, path);
    console.info(
      'PASS: 205 movements, complete monthly totals/categories/week/CSV, literal filters, deleted cursor, 105 reviews and validation',
    );
  } finally {
    await db.movement.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.mailImport.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.$disconnect();
  }
}
