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
 console.info('Smoke: auth, validation, persistence, idempotency and review passed');
} finally { api.kill('SIGTERM'); worker.kill('SIGTERM'); }
