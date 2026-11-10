import {Router} from 'express';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {db} from '@flowsaldo/database';
import {ledgerBalance,validDate} from '@flowsaldo/domain';
import {CategoryError} from './categories';
type Tx=Prisma.TransactionClient;
export const financeRoutes=Router();
financeRoutes.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
const positive=z.number().int().positive().max(2147483647);
const signed=z.number().int().min(-2147483647).max(2147483647);
const date=z.string().refine(validDate);
const month=z.string().regex(/^\d{4}-\d{2}$/).refine(v=>validDate(v+'-01'));
const currency=z.enum(['DOP','USD']);
// All account-affecting writes and reconciliation share one installation-level lock.
export async function lockFinance(tx:Tx){await tx.$queryRaw`SELECT id FROM "FinanceLock" WHERE id=1 FOR UPDATE`;}
interface Linked {accountId?:string|null;targetAccountId?:string|null;currency:string;type:string;occurredAt:string|Date}
export async function checkAccountMovement(tx:Tx,data:Linked,existing?:Linked){
 const ids=[...new Set([data.accountId,data.targetAccountId,existing?.accountId,existing?.targetAccountId].filter((v):v is string=>!!v))];
 if(!ids.length)return;
 if((data.accountId||data.targetAccountId)&&(!data.accountId||(data.type==='TRANSFER'?(!data.targetAccountId||data.targetAccountId===data.accountId):!!data.targetAccountId)))throw new CategoryError('Selecciona una cuenta y, en transferencias, otra cuenta de destino distinta.',400);
 const accounts=await tx.financialAccount.findMany({where:{id:{in:ids}}});
 if(accounts.length!==ids.length)throw new CategoryError('Cuenta no encontrada.',404);
 for(const account of accounts){
  const next=[data.accountId,data.targetAccountId].includes(account.id);const previous=existing&&[existing.accountId,existing.targetAccountId].includes(account.id);
  if(next&&account.currency!==data.currency)throw new CategoryError('Las cuentas y el movimiento deben usar la misma moneda.',400);
  if(next&&account.archived)throw new CategoryError('Reactiva la cuenta antes de modificar sus movimientos.',409);
  const cutoff=account.reconciledThrough;
  const day=(value:string|Date)=>new Date(value).toISOString().slice(0,10);
  if(cutoff&&((next&&day(data.occurredAt)<=cutoff)||(previous&&day(existing!.occurredAt)<=cutoff)))throw new CategoryError('El período está conciliado. No se puede cambiar su historial.',409);
 }
}
export async function touchAccounts(tx:Tx,...items:Linked[]){const ids=[...new Set(items.flatMap(i=>[i.accountId,i.targetAccountId]).filter((v):v is string=>!!v))];if(ids.length)await tx.financialAccount.updateMany({where:{id:{in:ids}},data:{revision:{increment:1}}});}
export async function checkAccountDelete(tx:Tx,item:Linked){
 const accounts=await tx.financialAccount.findMany({where:{id:{in:[item.accountId,item.targetAccountId].filter((v):v is string=>!!v)}}});
 if(accounts.some(a=>a.reconciledThrough&&new Date(item.occurredAt).toISOString().slice(0,10)<=a.reconciledThrough!))throw new CategoryError('El período está conciliado. No se puede eliminar este movimiento.',409);
}
async function balance(tx:Tx,account:{id:string;openingMinor:number},asOf?:string){
 const occurredAt=asOf?{lt:new Date(Date.parse(asOf+'T00:00:00.000Z')+86400000)}:undefined;
 const [out,incoming]=await Promise.all([tx.movement.groupBy({by:['type'],where:{accountId:account.id,occurredAt},_sum:{amountMinor:true}}),tx.movement.aggregate({where:{targetAccountId:account.id,type:'TRANSFER',occurredAt},_sum:{amountMinor:true}})]);
 return ledgerBalance(account.openingMinor,Number(out.find(r=>r.type==='INCOME')?._sum.amountMinor??0),out.filter(r=>r.type!=='INCOME').reduce((n,r)=>n+Number(r._sum.amountMinor??0),0),Number(incoming._sum.amountMinor??0));
}
financeRoutes.get('/accounts',async(_req,res)=>{
 const result=await db.$transaction(async tx=>{
  const rows=await tx.financialAccount.findMany({orderBy:[{archived:'asc'},{name:'asc'},{id:'asc'}]});
  return Promise.all(rows.map(async a=>{const balanceMinor=await balance(tx,a);return {...a,balanceMinor,debtMinor:a.kind==='CREDIT_CARD'||a.kind==='LOAN'?Math.max(0,-balanceMinor):0,availableCreditMinor:a.creditLimitMinor===null?null:ledgerBalance(a.creditLimitMinor,balanceMinor,0,0)};}));
 },{isolationLevel:'RepeatableRead'});res.json(result);
});
financeRoutes.post('/accounts',async(req,res)=>{
 const data=z.object({name:z.string().trim().min(1).max(60),currency,kind:z.enum(['BANK','CASH','CREDIT_CARD','LOAN']),openingMinor:signed,creditLimitMinor:positive.nullable().default(null)}).strict().refine(v=>(v.kind==='CREDIT_CARD'||v.creditLimitMinor===null)&&(!['CREDIT_CARD','LOAN'].includes(v.kind)||v.openingMinor<=0)).parse(req.body);
 const result=await db.$transaction(async tx=>{await lockFinance(tx);if(await tx.financialAccount.count()>=100)throw new CategoryError('Máximo de 100 cuentas por instalación.',409);return tx.financialAccount.create({data});});res.status(201).json(result);
});
financeRoutes.patch('/accounts/:id',async(req,res)=>{
 const data=z.object({name:z.string().trim().min(1).max(60).optional(),archived:z.boolean().optional(),expectedRevision:z.number().int().nonnegative()}).strict().refine(v=>v.name!==undefined||v.archived!==undefined).parse(req.body);
 const result=await db.$transaction(async tx=>{await lockFinance(tx);const a=await tx.financialAccount.findUnique({where:{id:req.params.id}});if(!a)throw new CategoryError('Cuenta no encontrada.',404);if(a.revision!==data.expectedRevision)throw new CategoryError('La cuenta cambió. Actualiza antes de guardar.',409);return tx.financialAccount.update({where:{id:a.id},data:{name:data.name,archived:data.archived,revision:{increment:1}}});});res.json(result);
});
const reconcile=z.object({asOf:date,statementMinor:z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)}).strict();
async function reconcileState(tx:Tx,id:string,input:z.infer<typeof reconcile>){
 const account=await tx.financialAccount.findUnique({where:{id}});if(!account)throw new CategoryError('Cuenta no encontrada.',404);
 if(account.archived)throw new CategoryError('Reactiva la cuenta antes de conciliar.',409);
 if(input.asOf>new Date().toISOString().slice(0,10)||(account.reconciledThrough&&input.asOf<=account.reconciledThrough))throw new CategoryError('Selecciona una fecha no futura y posterior a la última conciliación.',409);
 const expectedMinor=await balance(tx,account,input.asOf);const differenceMinor=ledgerBalance(input.statementMinor,0,expectedMinor,0);
 return {accountId:id,asOf:input.asOf,statementMinor:input.statementMinor,expectedMinor,differenceMinor,expectedRevision:account.revision};
}
financeRoutes.post('/accounts/:id/reconciliation/preview',async(req,res)=>{const input=reconcile.parse(req.body);res.json(await db.$transaction(async tx=>{await lockFinance(tx);return reconcileState(tx,req.params.id,input);}));});
financeRoutes.post('/accounts/:id/reconciliation',async(req,res)=>{
 const {expectedRevision,...input}=reconcile.extend({expectedRevision:z.number().int().nonnegative()}).parse(req.body);
 const result=await db.$transaction(async tx=>{await lockFinance(tx);const state=await reconcileState(tx,req.params.id,input);if(state.expectedRevision!==expectedRevision)throw new CategoryError('La cuenta cambió. Compara los saldos nuevamente.',409);if(state.differenceMinor!==0)throw new CategoryError('Existe una diferencia. Revisa los movimientos antes de conciliar.',409);
  const row=await tx.reconciliation.create({data:{accountId:state.accountId,asOf:state.asOf,balanceMinor:BigInt(state.expectedMinor)}});await tx.financialAccount.update({where:{id:state.accountId},data:{reconciledThrough:state.asOf,revision:{increment:1}}});return {...row,balanceMinor:Number(row.balanceMinor)};});res.status(201).json(result);
});
financeRoutes.get('/accounts/:id/reconciliations',async(req,res)=>res.json((await db.reconciliation.findMany({where:{accountId:req.params.id},orderBy:{asOf:'desc'},take:100})).map(r=>({...r,balanceMinor:Number(r.balanceMinor)}))));
function budgetResult(period:{version:number;limitMinor:number|null;categories:Array<{categoryId:string;limitMinor:number}>}|null){return {version:period?.version??0,limitMinor:period?.limitMinor??null,categoryLimits:period?.categories.map(c=>({categoryId:c.categoryId,limitMinor:c.limitMinor}))??[]};}
financeRoutes.get('/budgets',async(req,res)=>{const filter=z.object({month,currency}).parse(req.query);res.json(await db.$transaction(async tx=>budgetResult(await tx.budgetPeriod.findUnique({where:{month_currency:filter},include:{categories:true}})),{isolationLevel:'RepeatableRead'}));});
financeRoutes.post('/budgets',async(req,res)=>{
 const data=z.object({month,currency,expectedVersion:z.number().int().nonnegative(),limitMinor:positive.nullable(),categoryLimits:z.array(z.object({categoryId:z.string().min(1).max(200),limitMinor:positive})).max(200)}).strict().refine(v=>new Set(v.categoryLimits.map(c=>c.categoryId)).size===v.categoryLimits.length).parse(req.body);
 const result=await db.$transaction(async tx=>{await lockFinance(tx);const where={month:data.month,currency:data.currency};const previous=await tx.budgetPeriod.findUnique({where:{month_currency:where},include:{categories:true}});if((previous?.version??0)!==data.expectedVersion)throw new CategoryError('El presupuesto cambió en otro dispositivo. Actualiza y revisa antes de guardar.',409);
  // Same lock order as category assignment; archived limits may be preserved, never newly assigned.
  for(const entry of [...data.categoryLimits].sort((a,b)=>a.categoryId.localeCompare(b.categoryId))){const [category]=await tx.$queryRaw<Array<{archived:boolean}>>`SELECT archived FROM "Category" WHERE id=${entry.categoryId} FOR UPDATE`;if(!category)throw new CategoryError('Categoría no encontrada.',404);if(category.archived&&!previous?.categories.some(c=>c.categoryId===entry.categoryId&&c.limitMinor===entry.limitMinor))throw new CategoryError('No se puede asignar un límite nuevo a una categoría archivada.',409);}
  const period=previous?await tx.budgetPeriod.update({where:{id:previous.id},data:{limitMinor:data.limitMinor,version:{increment:1}}}):await tx.budgetPeriod.create({data:{...where,limitMinor:data.limitMinor}});
  await tx.budgetCategory.deleteMany({where:{periodId:period.id}});if(data.categoryLimits.length)await tx.budgetCategory.createMany({data:data.categoryLimits.map(c=>({...c,periodId:period.id}))});
  return budgetResult(await tx.budgetPeriod.findUnique({where:{id:period.id},include:{categories:true}}));
 });res.json(result);
});
