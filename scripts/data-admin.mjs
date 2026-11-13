import { URL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

function connection() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const db = decodeURIComponent(url.pathname.slice(1));
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !url.hostname ||
    !/^[A-Za-z0-9_.-]+$/.test(db) ||
    !url.username ||
    [...url.searchParams.keys()].some((key) => key !== 'sslmode')
  ) {
    throw new Error('Configura DATABASE_URL con una base explícita y, opcionalmente, sslmode.');
  }
  return {
    db,
    env: {
      ...process.env,
      PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
      PGPORT: url.port || '5432',
      PGDATABASE: db,
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get('sslmode') ?? 'prefer',
    },
  };
}

async function postgres(program, args, env, streams = {}) {
  const child = spawn(program, args, { env, stdio: ['pipe', 'pipe', 'ignore'] });
  const done = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error(`No se pudo iniciar ${program}.`)));
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`Falló ${program}. Verifica permisos, conexión y versión de PostgreSQL.`),
          ),
    );
  });
  const input = new Promise((resolve) => {
    child.stdin.once('error', resolve);
    child.stdin.end(streams.sql, resolve);
  });
  let output = '';
  const reading = streams.output
    ? pipeline(child.stdout, streams.output)
    : (async () => {
        for await (const chunk of child.stdout) output += chunk.toString();
      })();
  const results = await Promise.allSettled([done, input, reading]);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return output.trim();
}

const psql = (env, sql) =>
  postgres('psql', ['-X', '-qAt', '-w', '-v', 'ON_ERROR_STOP=1'], env, { sql });
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

const resetSql = `
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$
BEGIN
 IF to_regclass('public."FinanceLock"') IS NULL OR to_regclass('public."_prisma_migrations"') IS NULL THEN
  RAISE EXCEPTION 'Expected FlowSaldo schema';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend') THEN
  RAISE EXCEPTION 'Stop other clients';
 END IF;
END $$;
TRUNCATE public."AppOwner",public."AccessSession",public."AuthThrottle",public."RecoveryCode",
 public."DataCleanup",public."CleanupPreview",public."MovementRequest",public."RecurringOccurrence",
 public."RecurringTemplate",public."Movement",public."MailImport",public."BudgetCategory",
 public."BudgetPeriod",public."Reconciliation",public."FinancialAccount",public."Category";
INSERT INTO public."Category" (id,name,"normalizedName",system)
 SELECT 'category-'||md5(lower(name)),name,lower(name),name='Sin categorizar'
 FROM unnest(ARRAY['Sin categorizar','Alimentación','Transporte','Servicios','Salario','Ocio','Transferencias']) AS name;
COMMIT;
`;

async function main() {
  const [action, file, ...extra] = process.argv.slice(2);
  if (extra.length || !file || !['backup', 'restore', 'erase'].includes(action)) {
    throw new Error('Uso: data-admin backup <archivo> | restore <archivo> | erase <nombre-base>');
  }
  const { db, env } = connection();
  if (action === 'erase') {
    if (file !== db) throw new Error('El nombre de confirmación no coincide con DATABASE_URL.');
    await psql(env, resetSql);
    console.log('Datos y cuenta eliminados. La instalación vuelve a configuración inicial.');
    return;
  }
  if (action === 'backup') {
    const valid = await psql(
      env,
      `SELECT to_regclass('public."AppOwner"') IS NOT NULL AND to_regclass('public."_prisma_migrations"') IS NOT NULL;`,
    );
    if (valid !== 't') throw new Error('La base no contiene una instalación de FlowSaldo.');
    // Exclusive creation prevents replacing a previous backup.
    await writeFile(file, '', { flag: 'wx', mode: 0o600 });
    try {
      await postgres(
        'pg_dump',
        [
          '-w',
          '--format=custom',
          '--schema=public',
          '--no-owner',
          '--no-privileges',
          ...['AccessSession', 'RecoveryCode', 'AuthThrottle', 'CleanupPreview'].map(
            (table) => '--exclude-table-data=public."' + table + '"',
          ),
        ],
        env,
        { output: createWriteStream(file, { flags: 'r+' }) },
      );
      const sha = await digest(file);
      await writeFile(file + '.sha256', sha + '\n', { flag: 'wx', mode: 0o600 });
      console.log('Respaldo y suma SHA-256 creados.');
    } catch (error) {
      await rm(file, { force: true });
      throw error;
    }
    return;
  }
  const expected = (await readFile(file + '.sha256', 'utf8')).trim();
  const temp = await mkdtemp(join(tmpdir(), 'flowsaldo-restore-'));
  try {
    const snapshot = join(temp, 'backup.dump');
    await pipeline(createReadStream(file), createWriteStream(snapshot, { mode: 0o600 }));
    await chmod(snapshot, 0o600);
    if (!/^[a-f0-9]{64}$/.test(expected) || (await digest(snapshot)) !== expected)
      throw new Error('El respaldo no coincide con su suma SHA-256.');
    const list = await postgres('pg_restore', ['--list', snapshot], env);
    if (
      !list.includes('TABLE public AppOwner ') ||
      !list.includes('TABLE public _prisma_migrations ')
    ) {
      throw new Error('El archivo no contiene un respaldo de FlowSaldo.');
    }
    const occupied = await psql(
      env,
      `SELECT EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
  ) OR EXISTS (
   SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'
  );`,
    );
    if (occupied !== 'f')
      throw new Error('La restauración requiere una base vacía y sin otros clientes.');
    // A fresh PostgreSQL database already has a public schema.
    const toc = join(temp, 'restore.list');
    await writeFile(
      toc,
      list
        .split('\n')
        .filter((line) => !/^\d+;\s+\d+\s+\d+\s+SCHEMA - public(?:\s|$)/.test(line))
        .join('\n') + '\n',
      { mode: 0o600 },
    );
    await postgres(
      'pg_restore',
      [
        '-w',
        '--dbname=' + env.PGDATABASE,
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-privileges',
        '--use-list=' + toc,
        snapshot,
      ],
      env,
    );
    console.log('Respaldo verificado y restaurado. Inicia sesión nuevamente.');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
