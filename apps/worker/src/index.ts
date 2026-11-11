import {db} from '@flowsaldo/database';
import {runImport} from './jobs.ts';
import {retentionDays,runRetention} from './retention.ts';
const days=retentionDays(process.env.AUTO_RETENTION_DAYS);
let nextRetention=0;
let stopped=false;let databaseFailures=0;
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
try{
 while(!stopped){
  if (days !== null && Date.now() >= nextRetention) {
   nextRetention=Date.now()+3600000;
   try { await runRetention(db,days); }
   catch { console.error('Falló la retención automática. Se reintentará en el próximo ciclo.'); }
  }
  let delay=1000;
  try{const worked=await runImport(db);databaseFailures=0;delay=worked?0:1000;}
  catch{databaseFailures=Math.min(databaseFailures+1,5);delay=Math.min(30000,1000*2**databaseFailures);console.error('No se pudo acceder a la cola. Se aplicará espera antes de reintentar.');}
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 }
}finally{await db.$disconnect();}
