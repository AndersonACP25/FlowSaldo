import { Router } from 'express';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
import { movementsCsv, validDate, dailyCashFlow, type Currency, type Movement } from '@flowsaldo/domain';

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/).refine(v => validDate(v + '-01'));
const dateSchema = z.string().refine(validDate);
const paging = z.object({
 page: z.literal('true').optional(),
 limit: z.coerce.number().int().min(1).max(200).default(50),
 cursor: z.string().max(1000).transform((value, ctx) => {
  try { return z.object({ date: z.iso.datetime(), id: z.string().min(1).max(200) }).parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))); }
  catch { ctx.addIssue({code:'custom',message:'Cursor inválido'}); return z.NEVER; }
 }).optional()
});
const filters = z.object({
 currency: z.enum(['DOP','USD']).optional(), month: monthSchema.optional(),
 categoryId:z.string().min(1).max(200).optional(), type: z.enum(['INCOME','EXPENSE','TRANSFER']).optional(), search: z.string().trim().max(100).optional()
});
function monthRange(month: string) {
 const gte = new Date(month+'-01T00:00:00.000Z'); const lt = new Date(gte); lt.setUTCMonth(lt.getUTCMonth()+1);
 return {gte,lt};
}
function movementWhere(filter: z.infer<typeof filters>) {
 // Escape LIKE metacharacters so a text search has the same literal meaning as the demo.
 const search = filter.search?.replace(/[\\%_]/g, '\\$&');
 return {currency:filter.currency,type:filter.type,categoryId:filter.categoryId,...(filter.month?{occurredAt:monthRange(filter.month)}:{}),
  ...(search?{OR:[{description:{contains:search,mode:'insensitive' as const}},{category:{contains:search,mode:'insensitive' as const}}]}:{})};
}
function nextCursor(row: {id:string}, date:Date) { return Buffer.from(JSON.stringify({date:date.toISOString(),id:row.id})).toString('base64url'); }
function after(cursor: z.infer<typeof paging>['cursor'], field: 'occurredAt'|'createdAt') {
 return cursor?{OR:[{[field]:{lt:new Date(cursor.date)}},{[field]:new Date(cursor.date),id:{gt:cursor.id}}]}:{};
}
export const history = Router();
// Legacy array responses remain available when page=true is omitted.
history.get('/movements',async(req,res,next)=>{
 if(req.query.page===undefined) {next();return;}
 const page=paging.parse(req.query); const filter=filters.parse(req.query); const where=movementWhere(filter);
 const result=await db.$transaction(async tx=>{
  const [rows,total]=await Promise.all([
   tx.movement.findMany({where:{AND:[where,after(page.cursor,'occurredAt')]},orderBy:[{occurredAt:'desc'},{id:'asc'}],take:page.limit+1}),
   tx.movement.count({where})
  ]);
  const items=rows.slice(0,page.limit);const last=items.at(-1);
  return {items,total,nextCursor:rows.length>page.limit&&last?nextCursor(last,last.occurredAt):null};
 },{isolationLevel:'RepeatableRead'});
 res.json(result);
});
history.get('/movements/export',async(req,res)=>{
 const filter=filters.extend({month:monthSchema,currency:z.enum(['DOP','USD'])}).parse(req.query);
 const rows=await db.movement.findMany({where:movementWhere(filter),orderBy:[{occurredAt:'desc'},{id:'asc'}]});
 const movements=rows.map(row=>({...row,occurredAt:row.occurredAt.toISOString()}));
 res.setHeader('Content-Disposition',`attachment; filename="FlowSaldo-${filter.month}.csv"`);
 res.type('text/csv').send('\uFEFF'+movementsCsv(movements));
});
history.get('/summary',async(req,res,next)=>{
 if(req.query.month===undefined){next();return;}
 const {month,currency}=filters.extend({month:monthSchema,currency:z.enum(['DOP','USD']).default('DOP')}).parse(req.query);
 const where={currency,occurredAt:monthRange(month)};
 const today=new Date().toISOString().slice(0,10);
 const end=today.startsWith(month)?today:new Date(monthRange(month).lt.getTime()-86400000).toISOString().slice(0,10);
 const start=new Date(end+'T00:00:00.000Z'); start.setUTCDate(start.getUTCDate()-6);
 const result=await db.$transaction(async tx=>{
  const [types,categories,daily,total,categoryTotals]=await Promise.all([
   tx.movement.groupBy({by:['type'],where,_sum:{amountMinor:true}}),
   tx.movement.groupBy({by:['category'],where:{...where,type:'EXPENSE'},_sum:{amountMinor:true},orderBy:{_sum:{amountMinor:'desc'}}}),
   tx.$queryRaw<Array<{day:string;type:string;amount:bigint}>>`SELECT to_char("occurredAt", 'YYYY-MM-DD') AS day, type, SUM("amountMinor") AS amount FROM "Movement" WHERE currency::text=${currency} AND "occurredAt">=${start} AND "occurredAt"<${new Date(Date.parse(end+'T00:00:00.000Z')+86400000)} AND "occurredAt">=${where.occurredAt.gte} GROUP BY day,type`,
   tx.movement.count({where}),
   tx.movement.groupBy({by:['categoryId'],where:{...where,type:'EXPENSE'},_sum:{amountMinor:true}})
  ]);
  const safe=(value:unknown)=>{const n=Number(value??0);if(!Number.isSafeInteger(n))throw new Error('Total fuera de rango');return n;};
  const incomeMinor=safe(types.find(v=>v.type==='INCOME')?._sum.amountMinor);
  const expenseMinor=safe(types.find(v=>v.type==='EXPENSE')?._sum.amountMinor);
  const weeklyRows=daily.map((v,i)=>({id:String(i),amountMinor:safe(v.amount),currency:currency as Currency,type:v.type,occurredAt:v.day,description:'',category:''})) as Movement[];
  return {categoryTotals:categoryTotals.map(v=>({categoryId:v.categoryId,amountMinor:safe(v._sum.amountMinor)})),currency,month,scope:'month',incomeMinor,expenseMinor,differenceMinor:safe(incomeMinor-expenseMinor),total,
   categories:categories.map(v=>({category:v.category,amountMinor:safe(v._sum.amountMinor)})),days:dailyCashFlow(weeklyRows,end)};
 },{isolationLevel:'RepeatableRead'});
 res.json(result);
});
history.get('/imports',async(req,res,next)=>{
 if(req.query.page===undefined){next();return;}
 const page=paging.parse(req.query);
 const filter=z.object({status:z.enum(['PENDING','REVIEW','PARSED','DISMISSED']).optional(),from:dateSchema.optional(),to:dateSchema.optional()}).refine(v=>!v.from||!v.to||v.from<=v.to,{message:'Rango de fechas inválido'}).parse(req.query);
 const where={status:filter.status,...(filter.from||filter.to?{createdAt:{...(filter.from?{gte:new Date(filter.from+'T00:00:00.000Z')}:{}),...(filter.to?{lt:new Date(Date.parse(filter.to+'T00:00:00.000Z')+86400000)}:{})}}:{})};
 const result=await db.$transaction(async tx=>{
  const [rows,total,pendingTotal]=await Promise.all([
   tx.mailImport.findMany({where:{AND:[where,after(page.cursor,'createdAt')]},select:{id:true,externalId:true,status:true,reason:true,parserVersion:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'asc'}],take:page.limit+1}),
   tx.mailImport.count({where}),tx.mailImport.count({where:{status:'REVIEW'}})
  ]);
  const items=rows.slice(0,page.limit);const last=items.at(-1);
  return {items,total,pendingTotal,nextCursor:rows.length>page.limit&&last?nextCursor(last,last.createdAt):null};
 },{isolationLevel:'RepeatableRead'});
 res.json(result);
});
