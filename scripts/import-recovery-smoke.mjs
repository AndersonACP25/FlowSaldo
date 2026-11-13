import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { claimImport, failImport, finishImport } from '../apps/worker/src/jobs.ts';
export async function checkImportRecovery(request, connectionString) {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const prefix = 'recovery-' + Date.now();
  const settings = { limit: 2, leaseMs: 1000, baseDelayMs: 1000, maxDelayMs: 4000 };
  const now = new Date();
  const create = (id) =>
    db.mailImport.create({
      data: {
        id: prefix + id,
        externalId: prefix + id,
        body: 'FLOWSALDO-DEMO|EXPENSE|DOP|12.50|2026-10-21|Recovery CORE',
        nextAttemptAt: now,
      },
    });
  try {
    const row = await create('-backoff');
    const first = await claimImport(db, settings, now);
    assert.equal(first.id, row.id);
    assert.equal(first.attempts, 1);
    await failImport(
      db,
      first,
      new Error('password=do-not-expose synthetic fixture'),
      settings,
      now,
    );
    const pending = await db.mailImport.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(pending.status, 'PENDING');
    assert.equal(pending.nextAttemptAt.getTime(), now.getTime() + 1000);
    assert.equal(await claimImport(db, settings, new Date(now.getTime() + 500)), null);
    const second = await claimImport(db, settings, new Date(now.getTime() + 1000));
    await failImport(
      db,
      second,
      new Error('synthetic failure'),
      settings,
      new Date(now.getTime() + 1000),
    );
    const failed = await db.mailImport.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.attempts, 2);
    assert.equal(failed.lockToken, null);
    assert.ok(!JSON.stringify(failed).includes('do-not-expose'));
    const stats = await (await request('/imports/stats')).json();
    assert.ok(stats.counts.FAILED >= 1);
    const list = await (await request('/imports?page=true&status=FAILED')).json();
    assert.ok(list.items.some((i) => i.id === row.id));
    assert.ok(list.items.every((i) => !('lockToken' in i) && !('body' in i)));
    const retries = await Promise.all(
      [1, 2].map(() => request('/imports/' + row.id + '/retry', { method: 'POST' })),
    );
    assert.deepEqual(retries.map((r) => r.status).sort(), [202, 409]);
    const manualNow = new Date();
    const owner = await claimImport(db, settings, manualNow);
    assert.equal(owner.attempts, 1);
    assert.equal(owner.manualRetries, 1);
    const recovered = await claimImport(db, settings, new Date(manualNow.getTime() + 1001));
    assert.equal(recovered.attempts, 2);
    assert.notEqual(recovered.lockToken, owner.lockToken);
    assert.equal(await finishImport(db, owner), false);
    await failImport(db, owner, new Error('stale'), settings);
    assert.equal(
      (await db.mailImport.findUniqueOrThrow({ where: { id: row.id } })).lockToken,
      recovered.lockToken,
    );
    assert.equal(await finishImport(db, recovered), true);
    assert.equal(await finishImport(db, recovered), false);
    assert.equal(await db.movement.count({ where: { importId: row.id } }), 1);
    assert.equal((await request('/imports/' + row.id + '/retry', { method: 'POST' })).status, 409);
    const exhausted = await create('-crash');
    await claimImport(db, { ...settings, limit: 1 }, now);
    assert.equal(
      await claimImport(db, { ...settings, limit: 1 }, new Date(now.getTime() + 1001)),
      null,
    );
    assert.equal(
      (await db.mailImport.findUniqueOrThrow({ where: { id: exhausted.id } })).status,
      'FAILED',
    );
    console.info(
      'PASS CORE API: bounded backoff, durable attempts, crash recovery/fencing, exhausted lease, manual retry concurrency and one movement per import',
    );
  } finally {
    await db.movement.deleteMany({ where: { importId: { startsWith: prefix } } });
    await db.mailImport.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.$disconnect();
  }
}
