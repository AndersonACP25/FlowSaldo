import { db } from '@flowsaldo/database';
import { parseDemoMail } from '@flowsaldo/domain';
let stopped = false;
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });
try {
 while (!stopped) {
  try {
   await db.$transaction(async tx => {
    // Row lock + SKIP LOCKED allows recovery on rollback and multiple worker processes.
    const rows = await tx.$queryRaw<Array<{ id: string; body: string }>>`SELECT id, body FROM "MailImport" WHERE status = 'PENDING' ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
    const item = rows[0];
    if (!item) return;
    const result = parseDemoMail(item.body);
    if (result.status === 'PARSED' && result.movement.amountMinor <= 2147483647) {
     await tx.movement.create({ data: { ...result.movement, importId: item.id } });
     await tx.mailImport.update({ where: { id: item.id }, data: { status: 'PARSED', body: '', reason: null } });
    } else {
     await tx.mailImport.update({ where: { id: item.id }, data: { status: 'REVIEW', reason: result.status === 'REVIEW' ? result.reason : 'Monto fuera de rango' } });
    }
   });
  } catch { console.error('Falló el ciclo del worker; se reintentará sin registrar contenido sensible'); }
  await new Promise(resolve => setTimeout(resolve, 2000));
 }
} finally { await db.$disconnect(); }
