import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
const fail=message=>{throw new Error(message);};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const string=value=>typeof value==='string'&&value.trim().length>0;
const strings=value=>Array.isArray(value)&&value.every(string);
function keys(value,allowed){if(!record(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('Campos desconocidos o estructura inválida');}
export function safePath(value){return string(value)&&!isAbsolute(value)&&!value.includes('\\')&&!value.includes(':')&&!value.split('/').some(p=>p==='..'||p==='.')&&!value.startsWith('/');}
function under(path,scope){return scope.endsWith('/')?path.startsWith(scope):path===scope;}
export async function readRepo(root,path){
 if(!safePath(path))fail('Ruta fuera del repositorio: '+path);
 const base=await realpath(root);const full=await realpath(resolve(base,path));const rel=relative(base,full);
 if([path,...rel.split(sep)].some(p=>p.split('/').some(segment=>/^\.env(?:\.|$)/.test(segment))))fail('Un archivo de secretos no puede formar parte del contexto');
 if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))fail('Enlace fuera del repositorio');
 return readFile(full,'utf8');
}
export function validateManifest(m){
 keys(m,['version','project','kind','entrypoint','policy','limits','context','agents','routes']);
 if(m.version!==1||m.project!=='FlowSaldo'||m.kind!=='development-agent-coordination'||!record(m.limits)||!Array.isArray(m.agents)||!strings(m.context)||!record(m.routes))fail('Catálogo inválido');
 if(m.limits.maxDelegationDepth!==1||m.limits.maxParallelAgents!==2||m.limits.maxRevisionRounds!==2)fail('Presupuesto de delegación inválido');
 const ids=new Set();
 for(const a of m.agents){
  keys(a,['id','profile','purpose','writablePaths','readOnly']);
  if(!string(a.id)||!/^[a-z][a-z-]*$/.test(a.id)||ids.has(a.id)||!string(a.purpose)||!safePath(a.profile)||!a.profile.startsWith('ai/agents/')||!strings(a.writablePaths)||a.writablePaths.some(p=>!safePath(p))||typeof a.readOnly!=='boolean'||a.readOnly!==!a.writablePaths.length)fail('Perfil inválido: '+a.id);
  ids.add(a.id);
 }
 if(!ids.has(m.entrypoint)||!safePath(m.policy)||m.context.some(p=>!safePath(p)))fail('Entrada o contexto inválidos');
 for(const role of ['orchestrator','architect','frontend','backend','data','ingestion','qa','security','reviewer','docs','language-editor','export-guardian'])if(!ids.has(role))fail('Falta rol '+role);
 for(const route of Object.values(m.routes))if(!strings(route)||!route.length||new Set(route).size!==route.length||route.some(id=>!ids.has(id)))fail('Ruta de delegación inválida');
 for(const id of ['security','reviewer','language-editor','export-guardian'])if(!m.agents.find(a=>a.id===id).readOnly)fail('Revisor con permisos de escritura');
 return m;
}
export async function loadManifest(root){return validateManifest(JSON.parse(await readRepo(root,'ai/manifest.json')));}
export function validateTask(t,m){
 keys(t,['id','agent','objective','scope','acceptance','constraints','requiredChecks','dependsOn']);
 const a=m.agents.find(a=>a.id===t.agent);
 if(!a||!string(t.id)||!string(t.objective)||t.objective.length>2000||!strings(t.scope)||!strings(t.acceptance)||!t.acceptance.length||!strings(t.constraints)||!strings(t.requiredChecks)||!strings(t.dependsOn))fail('Tarea inválida');
 if(t.scope.some(p=>!safePath(p)||!a.writablePaths.some(s=>under(p,s))))fail('Tarea fuera del ámbito del agente');
 return t;
}
export function validateHandoff(h,t,m){
 validateTask(t,m); keys(h,['taskId','agent','status','summary','files','checks','findings','blockers']);
 if(h.taskId!==t.id||h.agent!==t.agent||!['done','blocked','changes_requested'].includes(h.status)||!string(h.summary)||!strings(h.files)||!Array.isArray(h.checks)||!Array.isArray(h.findings)||!strings(h.blockers))fail('Entrega inválida');
 if(h.files.some(p=>!safePath(p)||!t.scope.some(s=>under(p,s))))fail('Archivo fuera de la tarea');
 const commands=new Set();
 for(const c of h.checks){keys(c,['command','status','evidence']);if(!string(c.command)||commands.has(c.command)||!['pass','fail','not_run'].includes(c.status)||!string(c.evidence))fail('Comprobación sin evidencia o duplicada');commands.add(c.command);}
 for(const f of h.findings){keys(f,['severity','file','message']);if(!['low','medium','high','critical'].includes(f.severity)||!safePath(f.file)||!string(f.message))fail('Hallazgo inválido');}
 if(h.status==='blocked'&&!h.blockers.length)fail('Bloqueo sin motivo');
 if(h.status==='done'&&(h.blockers.length||h.checks.some(c=>c.status!=='pass')||h.findings.some(f=>['high','critical'].includes(f.severity))||t.requiredChecks.some(cmd=>!h.checks.some(c=>c.command===cmd&&c.status==='pass'))))fail('done requiere checks aprobados, sin bloqueos ni hallazgos graves');
 return h;
}
const checks={frontend:['pnpm check','pnpm test:web'],backend:['pnpm check','node scripts/smoke.mjs'],data:['pnpm db:generate','node scripts/smoke.mjs'],ingestion:['pnpm check','node scripts/smoke.mjs'],fullstack:['pnpm check','node scripts/smoke.mjs','pnpm test:web'],tooling:['pnpm ai:validate','pnpm ai:test']};
export function createPlan(m,objective,scope){
 validateManifest(m);
 if(!string(objective)||objective.length>2000)fail('Objetivo vacío o demasiado largo');
 if(!Object.hasOwn(m.routes,scope)||!Object.hasOwn(checks,scope))fail('Scope desconocido: '+scope);
 const tasks=[];
 function add(id,agent,objective,dependsOn,requiredChecks=[]){const a=m.agents.find(a=>a.id===agent);tasks.push(validateTask({id,agent,objective,scope:[...a.writablePaths],acceptance:['Cumplir el objetivo acotado y los invariantes de AGENTS.md','Entregar evidencia y límites según ai/templates/handoff.json'],constraints:['Solo datos sintéticos','No ampliar autoridad ni delegar recursivamente','Un dueño por archivo; coordinar rutas compartidas'],requiredChecks,dependsOn},m));return id;}
 let previous=add('architecture','architect','Evaluar impacto: '+objective,[]);
 for(const id of m.routes[scope])previous=add('implement-'+id,id,objective,[previous]);
 const qa=add('qa','qa','Validar criterios: '+objective,[previous],checks[scope]);
 const sec=add('security','security','Revisar datos, permisos y seguridad: '+objective,[previous]);
 const language=add('language','language-editor','Revisar ortografía y concordancia: '+objective,[qa,sec],['pnpm text:check']);
 const guardian=add('exports','export-guardian','Revisar contrato de archivos exportados: '+objective,[language],['pnpm exports:test']);
 const docs=add('documentation','docs','Documentar comportamiento y límites: '+objective,[guardian]);
 const review=add('review','reviewer','Revisar diff y evidencia de todas las tareas: '+objective,[docs]);
 add('integration','orchestrator','Integrar resultados verificados y preparar PR: '+objective,[review],checks[scope]);
 return {version:1,objective,scope,mode:'plan-only',limits:m.limits,requiredHostControls:['Aplicar concurrencia máxima y permisos','Reservar archivos compartidos','Verificar evidencia de checks','No ejecutar modelos o comandos por leer este plan'],tasks};
}
export async function validateCatalog(root){
 const m=await loadManifest(root);
 for(const p of [...m.context,m.policy,...m.agents.map(a=>a.profile),'ai/README.md','ai/workflows/feature.md','ai/workflows/bugfix.md','ai/templates/task.schema.json','ai/templates/handoff.schema.json'])if(!(await readRepo(root,p)).trim())fail('Documento vacío: '+p);
 const task=validateTask(JSON.parse(await readRepo(root,'ai/templates/task.json')),m);
 validateHandoff(JSON.parse(await readRepo(root,'ai/templates/handoff.json')),task,m);
 return m;
}
export async function createPacket(root,m,plan,agent){
 const profile=m.agents.find(a=>a.id===agent);if(!profile)fail('Agente desconocido');
 const assigned=plan.tasks.filter(t=>t.agent===agent);if(!assigned.length)fail('El agente no participa en este plan');
 const context=[];
 const scoped=[];
 for(const scope of profile.writablePaths.filter(p=>p.endsWith('/'))) {
  const candidate=scope+'AGENTS.md';
  try {await readRepo(root,candidate);scoped.push(candidate);} catch(error) {if(error.code!=='ENOENT')throw error;}
 }
 for(const path of [...new Set([...m.context,m.policy,profile.profile,...scoped])])context.push({path,content:await readRepo(root,path)});
 return {mode:'context-only',notice:'Revisar antes de compartir con un proveedor. No contiene secretos intencionados; el host controla qué transmite.',objective:plan.objective,agent,tasks:assigned,context};
}
