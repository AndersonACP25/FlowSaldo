import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
export async function checkCategoryMigration(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const schema = 'category_migration_' + Date.now();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(
      await readFile(
        'packages/database/prisma/migrations/20261022000000_initial/migration.sql',
        'utf8',
      ),
    );
    await client.query(
      `INSERT INTO "Movement"(id,"amountMinor",currency,type,description,category,"occurredAt") VALUES ('legacy-a',12345,'DOP','EXPENSE','Histórico A','  HOGAR   y Salud  ','2026-01-01'),('legacy-b',21,'USD','TRANSFER','Histórico B','Hogar y Salud','2026-01-02'),('legacy-c',101,'DOP','INCOME','Histórico C','ALIMENTACIÓN','2026-01-03')`,
    );
    const before = (
      await client.query(
        'SELECT id,"amountMinor",currency,type,description,category,"occurredAt" FROM "Movement" ORDER BY id',
      )
    ).rows;
    await client.query(
      await readFile(
        'packages/database/prisma/migrations/20261110000000_categories/migration.sql',
        'utf8',
      ),
    );
    const after = (
      await client.query(
        'SELECT id,"amountMinor",currency,type,description,category,"occurredAt" FROM "Movement" ORDER BY id',
      )
    ).rows;
    assert.deepEqual(after, before);
    const ids = (await client.query('SELECT "categoryId" FROM "Movement" ORDER BY id')).rows;
    assert.ok(ids.every((row) => row.categoryId));
    assert.equal(ids[0].categoryId, ids[1].categoryId);
    assert.equal(
      (
        await client.query(
          'SELECT count(*) FROM "Category" WHERE "normalizedName"=\'alimentación\'',
        )
      ).rows[0].count,
      '1',
    );
    console.info(
      'PASS: additive category migration preserves legacy labels/amounts/currencies and backfills normalized IDs',
    );
  } finally {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
}
