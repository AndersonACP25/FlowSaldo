import {Router} from 'express';
import {db} from '@flowsaldo/database';
import {CategoryError} from './categories';
export const importRoutes=Router();
export const importMetadata={attempts:true,manualRetries:true,nextAttemptAt:true,lastAttemptAt:true,lastErrorCode:true,processedAt:true,lockedUntil:true} as const;
importRoutes.get('/imports/stats',async(_req,res)=>{
 const now=new Date();
 const result=await db.$transaction(async tx=>{
  const [groups,scheduledRetries,expiredLeases,next,finished]=await Promise.all([
   tx.mailImport.groupBy({by:['status'],_count:{_all:true}}),
   tx.mailImport.count({where:{status:'PENDING',attempts:{gt:0},nextAttemptAt:{gt:now}}}),
   tx.mailImport.count({where:{status:'PROCESSING',lockedUntil:{lte:now}}}),
   tx.mailImport.findFirst({where:{status:'PENDING',attempts:{gt:0},nextAttemptAt:{gt:now}},orderBy:{nextAttemptAt:'asc'},select:{nextAttemptAt:true}}),
   tx.mailImport.aggregate({_max:{processedAt:true}})
  ]);
  const counts={PENDING:0,PROCESSING:0,FAILED:0,REVIEW:0,PARSED:0,DISMISSED:0};for(const group of groups)counts[group.status]=group._count._all;
  return {counts,scheduledRetries,expiredLeases,nextRetryAt:next?.nextAttemptAt??null,lastProcessedAt:finished._max.processedAt};
 },{isolationLevel:'RepeatableRead'});
 res.json(result);
});
importRoutes.post('/imports/:id/retry',async(req,res)=>{
 const result=await db.$transaction(async tx=>{
  const [row]=await tx.$queryRaw<Array<{id:string;status:string}>>`SELECT id,status FROM "MailImport" WHERE id=${req.params.id} FOR UPDATE`;
  if(!row)throw new CategoryError('Importación no encontrada.',404);
  if(row.status!=='FAILED'||await tx.movement.findUnique({where:{importId:row.id}}))throw new CategoryError('Solo se pueden reintentar importaciones con error y sin movimiento generado.',409);
  return tx.mailImport.update({where:{id:row.id},data:{status:'PENDING',attempts:0,manualRetries:{increment:1},nextAttemptAt:new Date(),lastAttemptAt:null,lastErrorCode:null,processedAt:null,reason:null,lockedUntil:null,lockToken:null},select:{id:true,status:true}});
 });res.status(202).json(result);
});
