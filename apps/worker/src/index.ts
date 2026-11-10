import {db} from '@flowsaldo/database';
import {runImport} from './jobs.ts';
let stopped=false;let databaseFailures=0;
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
try{
 while(!stopped){
  let delay=1000;
  try{const worked=await runImport(db);databaseFailures=0;delay=worked?0:1000;}
  catch{databaseFailures=Math.min(databaseFailures+1,5);delay=Math.min(30000,1000*2**databaseFailures);console.error('No se pudo acceder a la cola. Se aplicará espera antes de reintentar.');}
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 }
}finally{await db.$disconnect();}
