import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { validDate } from '@flowsaldo/domain';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { summarize, type Movement } from '@flowsaldo/domain';
const token = process.env.DEV_API_TOKEN;
if (!token || token.length < 24) throw new Error('Configura DEV_API_TOKEN con al menos 24 caracteres');
const app = express();
app.use(helmet());
const origins = (process.env.WEB_ORIGINS ?? 'http://localhost:8081,http://127.0.0.1:8081').split(',').map(s => s.trim());
app.use(cors({ origin: origins, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type'] }));
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: 'personal-development' }));
app.use((req, res, next) => {
 const received = Buffer.from(req.headers.authorization ?? '');
 const expected = Buffer.from('Bearer ' + token);
 if (received.length !== expected.length || !timingSafeEqual(received, expected)) { res.status(401).json({ error: 'No autorizado' }); return; }
 next();
});
const movementSchema = z.object({ amountMinor: z.number().int().positive().max(2147483647), currency: z.enum(['DOP','USD']), type: z.enum(['INCOME','EXPENSE','TRANSFER']), description: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(60).default('Sin categorizar'), occurredAt: z.iso.datetime() });
app.get('/movements', async (req, res) => {
 const filter = z.object({ currency: z.enum(['DOP','USD']).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).refine(v => validDate(v+'-01')).optional() }).parse(req.query);
 const from = filter.month ? new Date(filter.month+'-01T00:00:00.000Z') : undefined;
 const to = from ? new Date(from) : undefined;
 if(to) to.setUTCMonth(to.getUTCMonth()+1);
 res.json(await db.movement.findMany({ where: { currency: filter.currency, ...(from ? {occurredAt:{gte:from,lt:to}} : {}) }, orderBy: [{ occurredAt: 'desc' },{id:'asc'}], take: 200 }));
});
app.post('/movements', async (req, res) => {
 const data = movementSchema.parse(req.body);
 res.status(201).json(await db.movement.create({ data }));
});

app.patch('/movements/:id', async (req, res) => {
 const data = movementSchema.parse(req.body);
 const result = await db.movement.updateMany({where:{id:req.params.id},data});
 if(!result.count) {res.status(404).json({error:'Movimiento no encontrado'});return;}
 res.json(await db.movement.findUnique({where:{id:req.params.id}}));
});
app.delete('/movements/:id', async (req, res) => {
 const result = await db.movement.deleteMany({where:{id:req.params.id}});
 if(!result.count) {res.status(404).json({error:'Movimiento no encontrado'});return;}
 res.status(204).end();
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
app.get('/imports/:id', async (req,res)=>{
 const item=await db.mailImport.findUnique({where:{id:req.params.id},select:{id:true,body:true,status:true,externalId:true}});
 if(!item){res.status(404).json({error:'Importación no encontrada'});return;}
 res.json(item);
});
app.post('/imports/:id/resolve',async(req,res)=>{
 const data=movementSchema.parse(req.body); const id=req.params.id;
 const result=await db.$transaction(async tx=>{
  const rows=await tx.$queryRaw<Array<{id:string;status:string}>>`SELECT id,status FROM "MailImport" WHERE id=${id} FOR UPDATE`;
  if(!rows[0])return {status:404};
  if(rows[0].status!=='REVIEW')return {status:409};
  const movement=await tx.movement.create({data:{...data,importId:id}});
  await tx.mailImport.update({where:{id},data:{status:'PARSED',body:'',reason:'Confirmado manualmente'}});
  return {status:201,movement};
 });
 if(result.status!==201){res.status(result.status).json({error:result.status===404?'Importación no encontrada':'El correo ya no está pendiente de revisión'});return;}
 res.status(201).json(result.movement);
});
app.post('/imports/:id/dismiss',async(req,res)=>{
 const id=req.params.id;
 const result=await db.mailImport.updateMany({where:{id,status:'REVIEW'},data:{status:'DISMISSED',body:'',reason:'Descartado manualmente'}});
 if(!result.count){res.status(409).json({error:'El correo no está pendiente de revisión'});return;}
 res.status(204).end();
});
app.get('/imports', async (_req, res) => res.json(await db.mailImport.findMany({ select: { id: true, externalId: true, status: true, reason: true, parserVersion: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 })));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
 if (error instanceof SyntaxError) { res.status(400).json({ error: 'JSON inválido' }); return; }
 if (error instanceof z.ZodError) { res.status(400).json({ error: 'Datos inválidos', issues: error.issues.map(i => ({ path: i.path, message: i.message })) }); return; }
 res.status(500).json({ error: 'Error interno' });
});
const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? 3000);
const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () => console.info('FlowSaldo API lista en puerto', port));
process.on('SIGTERM', () => server.close(() => { void db.$disconnect(); }));
