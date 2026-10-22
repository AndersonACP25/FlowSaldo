import express from 'express';
import helmet from 'helmet';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { summarize, type Movement } from '@flowsaldo/domain';
const token = process.env.DEV_API_TOKEN;
if (!token || token.length < 24) throw new Error('Configura DEV_API_TOKEN con al menos 24 caracteres');
const app = express();
app.use(helmet());
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: 'personal-development' }));
app.use((req, res, next) => {
 const received = Buffer.from(req.headers.authorization ?? '');
 const expected = Buffer.from('Bearer ' + token);
 if (received.length !== expected.length || !timingSafeEqual(received, expected)) { res.status(401).json({ error: 'No autorizado' }); return; }
 next();
});
const movementSchema = z.object({ amountMinor: z.number().int().positive().max(2147483647), currency: z.enum(['DOP','USD']), type: z.enum(['INCOME','EXPENSE','TRANSFER']), description: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(60).default('Sin categorizar'), occurredAt: z.iso.datetime() });
app.get('/movements', async (_req, res) => res.json(await db.movement.findMany({ orderBy: { occurredAt: 'desc' }, take: 200 })));
app.post('/movements', async (req, res) => {
 const data = movementSchema.parse(req.body);
 res.status(201).json(await db.movement.create({ data }));
});
app.get('/summary', async (req, res) => {
 const currency = z.enum(['DOP','USD']).parse(req.query.currency ?? 'DOP');
 const rows = await db.movement.findMany({ where: { currency } });
 res.json({ currency, scope: 'all-recorded-movements', ...summarize(rows.map(row => ({ ...row, occurredAt: row.occurredAt.toISOString() })) as Movement[], currency) });
});
app.post('/imports', async (req, res) => {
 const data = z.object({ externalId: z.string().trim().min(1).max(200), body: z.string().min(1).max(10000) }).parse(req.body);
 const item = await db.mailImport.upsert({ where: { externalId: data.externalId }, create: data, update: {} });
 res.status(202).json({ id: item.id, status: item.status });
});
app.get('/imports', async (_req, res) => res.json(await db.mailImport.findMany({ select: { id: true, externalId: true, status: true, reason: true, parserVersion: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 })));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
 if (error instanceof z.ZodError) { res.status(400).json({ error: 'Datos inválidos', issues: error.issues.map(i => ({ path: i.path, message: i.message })) }); return; }
 res.status(500).json({ error: 'Error interno' });
});
const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? 3000);
const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () => console.info('FlowSaldo API lista en puerto', port));
process.on('SIGTERM', () => server.close(() => { void db.$disconnect(); }));
