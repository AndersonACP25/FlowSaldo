import { fileURLToPath, URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateCatalog, createPlan, createPacket, validateHandoff } from './ai-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
try {
 const [command='validate',...args]=process.argv.slice(2); const options={};
 for(let i=0;i<args.length;i+=2){if(!['--task','--scope','--agent','--file','--task-file'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--')||Object.hasOwn(options,args[i]))throw new Error('Argumentos inválidos');options[args[i]]=args[i+1];}
 const manifest=await validateCatalog(root);
 if(command==='validate')console.log('Catálogo, perfiles, rutas y contratos válidos: '+manifest.agents.length+' agentes.');
 else if(command==='plan'||command==='packet'){
  const plan=createPlan(manifest,options['--task'],options['--scope']??'frontend');
  const output=command==='plan'?plan:await createPacket(root,manifest,plan,options['--agent']??manifest.entrypoint);
  console.log(JSON.stringify(output,null,2));
 } else if(command==='handoff'){
  if(!options['--file']||!options['--task-file'])throw new Error('Usa --file entrega.json --task-file tarea.json');
  const task=JSON.parse(await readFile(resolve(options['--task-file']),'utf8'));
  const handoff=JSON.parse(await readFile(resolve(options['--file']),'utf8'));
  validateHandoff(handoff,task,manifest);
  console.log('Entrega consistente. La ejecución declarada debe contrastarse con evidencia real.');
 } else throw new Error('Comando desconocido. Usa validate, plan, packet o handoff.');
} catch(error){console.error(error instanceof Error?error.message:'Error de coordinación IA');process.exitCode=1;}
