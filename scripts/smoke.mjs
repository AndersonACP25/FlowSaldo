import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const api = spawn('node', ['--import', 'tsx', '--env-file=.env', 'apps/api/src/index.ts'], { stdio: 'inherit' });
const worker = spawn('node', ['--import', 'tsx', '--env-file=.env', 'apps/worker/src/index.ts'], { stdio: 'inherit' });
const { readFile } = await import('node:fs/promises');
const env = await readFile('.env', 'utf8');
const token = /^DEV_API_TOKEN=(.+)$/m.exec(env)?.[1];
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const request = (path, options = {}) => fetch('http://127.0.0.1:3000' + path, { ...options, headers });
const pause = () => new Promise(r => setTimeout(r, 500));
try {
 let ready = false;
 for (let i=0;i<40;i++) { try { if ((await request('/health')).ok) { ready=true; break; } } catch { /* API may still be starting. */ } await pause(); }
 assert.ok(ready, 'API ready');
 assert.equal((await fetch('http://127.0.0.1:3000/movements')).status, 401);
 assert.equal((await request('/movements', { method:'POST', body: JSON.stringify({ amountMinor: -1 }) })).status, 400);
 const body = JSON.stringify({ externalId:'ci-demo', body:'FLOWSALDO-DEMO|EXPENSE|DOP|12.50|2026-10-22|Smoke' });
 for(let i=0;i<2;i++) assert.equal((await request('/imports', { method:'POST', body })).status, 202);
 await request('/imports', { method:'POST', body:JSON.stringify({ externalId:'ci-review', body:'desconocido' }) });
 let imports = [];
 for(let i=0;i<40;i++) {
  imports = await (await request('/imports')).json();
  if(imports.find(x=>x.externalId==='ci-demo')?.status==='PARSED' && imports.find(x=>x.externalId==='ci-review')?.status==='REVIEW') break;
  await pause();
 }
 assert.equal(imports.find(x=>x.externalId==='ci-demo')?.status, 'PARSED');
 assert.equal(imports.find(x=>x.externalId==='ci-review')?.status, 'REVIEW');
 const movements = await (await request('/movements')).json();
 assert.equal(movements.filter(x=>x.description==='Smoke').length, 1);
 const preflight=await fetch('http://127.0.0.1:3000/movements',{method:'OPTIONS',headers:{Origin:'http://localhost:8081','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
 assert.equal(preflight.headers.get('access-control-allow-origin'),'http://localhost:8081');
 const denied=await fetch('http://127.0.0.1:3000/health',{headers:{Origin:'https://untrusted.example'}});
 assert.equal(denied.headers.get('access-control-allow-origin'),null);
 const created=await request('/movements',{method:'POST',body:JSON.stringify({amountMinor:12345,currency:'USD',type:'EXPENSE',description:'Manual smoke',category:'Servicios',occurredAt:'2026-09-12T12:00:00.000Z'})});
 assert.equal(created.status,201); const manual=await created.json();
 const filtered=await (await request('/movements?month=2026-09&currency=USD')).json();
 assert.ok(filtered.some(x=>x.id===manual.id)); assert.ok(filtered.every(x=>x.currency==='USD'&&x.occurredAt.startsWith('2026-09')));
 assert.equal((await request('/movements?month=2026-13')).status,400);
 assert.equal((await request('/movements/'+manual.id,{method:'PATCH',body:JSON.stringify({...manual,description:'Updated smoke'})})).status,200);
 assert.equal((await request('/movements/'+manual.id,{method:'DELETE'})).status,204);
 assert.equal((await request('/movements/'+manual.id,{method:'DELETE'})).status,404);
 console.info('Smoke: auth, validation, persistence, idempotency and review passed');
} finally { api.kill('SIGTERM'); worker.kill('SIGTERM'); }
