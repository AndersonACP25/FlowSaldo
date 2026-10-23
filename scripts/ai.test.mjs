import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, URL } from 'node:url';
import { validateCatalog, createPlan, validateTask, validateHandoff, safePath, createPacket, readRepo } from './ai-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=await validateCatalog(root);
test('every route produces an acyclic plan with bounded delegation',()=>{
 for(const scope of Object.keys(manifest.routes)){
  const plan=createPlan(manifest,'Implementar una mejora sintética',scope);const visited=new Set();
  for(const task of plan.tasks){assert.ok(task.dependsOn.every(id=>visited.has(id)));assert.ok(!visited.has(task.id));visited.add(task.id);}
  assert.equal(plan.mode,'plan-only');assert.equal(plan.limits.maxDelegationDepth,1);assert.equal(plan.limits.maxParallelAgents,2);
 }
});
test('rejects unknown scope and oversized objectives',()=>{assert.throws(()=>createPlan(manifest,'Tarea','unknown'));assert.throws(()=>createPlan(manifest,'x'.repeat(2001),'frontend'));});
test('serializes fullstack implementers before QA',()=>{
 const tasks=createPlan(manifest,'Mejora','fullstack').tasks;const implementers=tasks.filter(t=>t.id.startsWith('implement-'));
 for(let i=1;i<implementers.length;i++)assert.deepEqual(implementers[i].dependsOn,[implementers[i-1].id]);
 assert.deepEqual(tasks.find(t=>t.id==='qa').dependsOn,[implementers.at(-1).id]);
});
test('rejects traversal, absolute paths and scope expansion',()=>{
 for(const path of ['../.env','/etc/passwd','C:/secret','apps/../.env','apps\\secret'])assert.equal(safePath(path),false);
 const task=createPlan(manifest,'Mejora','frontend').tasks.find(t=>t.agent==='frontend');
 assert.throws(()=>validateTask({...task,scope:['apps/api/']},manifest));
});
test('done requires execution evidence for every required check',()=>{
 const task=createPlan(manifest,'Mejora','frontend').tasks.find(t=>t.agent==='qa');
 const handoff={taskId:task.id,agent:task.agent,status:'done',summary:'Validado',files:[],checks:[],findings:[],blockers:[]};
 assert.throws(()=>validateHandoff(handoff,task,manifest));
 handoff.checks=task.requiredChecks.map(command=>({command,status:'pass',evidence:'Fixture de prueba: salida sintética de ejecución'}));
 assert.equal(validateHandoff(handoff,task,manifest).status,'done');
 assert.throws(()=>validateHandoff({...handoff,checks:handoff.checks.map(c=>({...c,status:'not_run'}))},task,manifest));
 assert.throws(()=>validateHandoff({...handoff,findings:[{severity:'high',file:'apps/api/src/index.ts',message:'Hallazgo sintético'}]},task,manifest));
});
test('reviewers cannot claim writes and blocked needs a reason',()=>{
 const task=createPlan(manifest,'Mejora','frontend').tasks.find(t=>t.agent==='reviewer');
 const handoff={taskId:task.id,agent:task.agent,status:'blocked',summary:'Sin entorno',files:[],checks:[],findings:[],blockers:['Entorno ausente']};
 assert.equal(validateHandoff(handoff,task,manifest).status,'blocked');
 assert.throws(()=>validateHandoff({...handoff,blockers:[]},task,manifest));
 assert.throws(()=>validateHandoff({...handoff,files:['apps/api/src/index.ts']},task,manifest));
});
test('packets use only declared context, not secrets or arbitrary files',async()=>{
 const packet=await createPacket(root,manifest,createPlan(manifest,'Mejora','frontend'),'frontend');
 assert.equal(packet.agent,'frontend');assert.ok(packet.context.some(c=>c.path==='apps/mobile/AGENTS.md'));assert.ok(packet.context.every(c=>!c.path.includes('.env')));
 await assert.rejects(()=>readRepo(root,'../.env'));
 await assert.rejects(()=>createPacket(root,manifest,createPlan(manifest,'Mejora','frontend'),'data'));
});
test('rejects symlink aliases to secret files inside the repo',async(t)=>{
 const { mkdtemp, writeFile, symlink, rm }=await import('node:fs/promises');
 const { tmpdir }=await import('node:os');
 const { join }=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'flowsaldo-ai-'));
 try {await writeFile(join(dir,'.env'),'SYNTHETIC=fixture');try{await symlink(join(dir,'.env'),join(dir,'alias.md'));}catch(error){if(process.platform==='win32'&&error.code==='EPERM'){t.skip('Windows sin permiso para symlinks');return;}throw error;}await assert.rejects(()=>readRepo(dir,'alias.md'));}finally{await rm(dir,{recursive:true,force:true});}
});
test('catalog rejects duplicate roles and writable reviewers',async()=>{
 const { validateManifest }=await import('./ai-core.mjs');
 assert.throws(()=>validateManifest({...manifest,agents:[...manifest.agents,manifest.agents[0]]}));
 assert.throws(()=>validateManifest({...manifest,agents:manifest.agents.map(a=>a.id==='security'?{...a,readOnly:false,writablePaths:['apps/api/']}:a)}));
});
test('language and export reviews are required before documentation',()=>{
 const tasks=createPlan(manifest,'Mejora','frontend').tasks;
 const language=tasks.find(t=>t.agent==='language-editor');const guardian=tasks.find(t=>t.agent==='export-guardian');
 assert.ok(language.requiredChecks.includes('pnpm text:check'));assert.deepEqual(guardian.dependsOn,[language.id]);assert.ok(guardian.requiredChecks.includes('pnpm exports:test'));assert.deepEqual(tasks.find(t=>t.agent==='docs').dependsOn,[guardian.id]);
});
