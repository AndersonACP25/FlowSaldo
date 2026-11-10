import assert from 'node:assert/strict';
export async function checkFinance(request){
 const prefix='finance-'+Date.now();const accounts=[];const movements=[];
 const post=(path,body,method='POST')=>request(path,{method,body:JSON.stringify(body)});
 const read=async path=>{const r=await request(path);assert.equal(r.status,200);return r.json();};
 const create=async(name,kind,currency,openingMinor,creditLimitMinor=null)=>{const r=await post('/accounts',{name:prefix+name,kind,currency,openingMinor,creditLimitMinor});assert.equal(r.status,201);const a=await r.json();accounts.push(a.id);return a;};
 const bank=await create('Bank','BANK','DOP',100000);const card=await create('Card','CREDIT_CARD','DOP',-50000,200000);const usd=await create('USD','BANK','USD',1000);await create('Loan','LOAN','DOP',-100000);
 const input={description:prefix,amountMinor:25000,currency:'DOP',type:'TRANSFER',category:'Sin categorizar',occurredAt:'2026-02-02T12:00:00.000Z',accountId:bank.id,targetAccountId:card.id,requestKey:prefix+'-payment'};
 const before=await read('/summary?month=2026-02&currency=DOP');
 assert.equal((await post('/movements',{...input,targetAccountId:usd.id})).status,400,'Cross-currency transfer rejected');
 assert.equal((await post('/movements',{...input,targetAccountId:bank.id})).status,400);
 const results=await Promise.all([post('/movements',input),post('/movements',input)]);assert.deepEqual(results.map(r=>r.status),[201,201]);const copies=await Promise.all(results.map(r=>r.json()));assert.equal(copies[0].id,copies[1].id);movements.push(copies[0].id);
 assert.equal((await post('/movements',{...input,amountMinor:25001})).status,409,'Key reuse cannot change amount');
 const accountPage=await read(`/movements?page=true&accountId=${card.id}`);assert.equal(accountPage.total,1);assert.equal(accountPage.items[0].id,copies[0].id);
 const accountCsv=await request(`/movements/export?month=2026-02&currency=DOP&accountId=${card.id}`);assert.equal(accountCsv.status,200);assert.ok((await accountCsv.text()).includes(prefix));
 const after=await read('/summary?month=2026-02&currency=DOP');assert.equal(after.incomeMinor,before.incomeMinor);assert.equal(after.expenseMinor,before.expenseMinor,'Debt payment must not double expense');
 const expense={description:prefix+' expense',amountMinor:1000,currency:'DOP',type:'EXPENSE',category:'Sin categorizar',occurredAt:'2026-02-03T12:00:00.000Z',accountId:bank.id};
 const er=await post('/movements',expense);assert.equal(er.status,201);const e=await er.json();movements.push(e.id);
 let rows=await read('/accounts');assert.equal(rows.find(a=>a.id===bank.id).balanceMinor,74000);assert.equal(rows.find(a=>a.id===card.id).debtMinor,25000);assert.equal(rows.find(a=>a.id===card.id).availableCreditMinor,175000);assert.equal(rows.find(a=>a.id===usd.id).balanceMinor,1000);
 // Preview changes cannot silently reconcile a different snapshot.
 const reconcile={asOf:'2026-02-28',statementMinor:74000};const preview=await (await post(`/accounts/${bank.id}/reconciliation/preview`,reconcile)).json();assert.equal(preview.differenceMinor,0);
 assert.equal((await post(`/accounts/${bank.id}/reconciliation`,{...reconcile,statementMinor:73999,expectedRevision:preview.expectedRevision})).status,409);
 const concurrent=await post('/movements',{...expense,occurredAt:'2026-03-01T12:00:00.000Z'});assert.equal(concurrent.status,201);const c=await concurrent.json();movements.push(c.id);
 assert.equal((await post(`/accounts/${bank.id}/reconciliation`,{...reconcile,expectedRevision:preview.expectedRevision})).status,409,'Even an out-of-period account change invalidates old preview');
 const fresh=await (await post(`/accounts/${bank.id}/reconciliation/preview`,reconcile)).json();
 const confirmations=await Promise.all([1,2].map(()=>post(`/accounts/${bank.id}/reconciliation`,{...reconcile,expectedRevision:fresh.expectedRevision})));assert.deepEqual(confirmations.map(r=>r.status).sort(),[201,409]);
 assert.equal((await read(`/accounts/${bank.id}/reconciliations`))[0].balanceMinor,74000);
 assert.equal((await post('/movements',expense)).status,409,'New backdated posting prohibited');
 assert.equal((await post('/movements/'+e.id,{...expense,occurredAt:'2026-03-04T12:00:00.000Z'},'PATCH')).status,409,'Moving a reconciled row to another date prohibited');
 assert.equal((await request('/movements/'+copies[0].id,{method:'DELETE'})).status,409,'Transfer affects protected source');
 assert.equal((await post('/movements/'+e.id,{...expense,accountId:null},'PATCH')).status,409,'Detaching account cannot bypass period protection');
 rows=await read('/accounts');const a=rows.find(a=>a.id===bank.id);
 assert.equal((await post('/accounts/'+bank.id,{archived:true,expectedRevision:a.revision},'PATCH')).status,200);
 assert.equal((await post('/movements',{...expense,occurredAt:'2026-04-02T12:00:00.000Z'})).status,409);
 assert.equal((await post('/accounts/'+bank.id,{name:'Changed stale',expectedRevision:a.revision},'PATCH')).status,409);
 assert.equal((await post('/accounts/'+bank.id,{openingMinor:0,expectedRevision:a.revision+1},'PATCH')).status,400,'Opening amount immutable');
 // Deleting an unprotected movement cannot allow replay of the same request key.
 const keyed={...expense,accountId:usd.id,currency:'USD',requestKey:prefix+'-deleted'};const kr=await post('/movements',keyed);assert.equal(kr.status,201);const k=await kr.json();assert.equal((await request('/movements/'+k.id,{method:'DELETE'})).status,204);assert.equal((await post('/movements',keyed)).status,409);
 const categories=await read('/categories');const category=categories.find(c=>!c.archived&&!c.system)??categories[0];
 const budget={month:'2036-02',currency:'DOP',expectedVersion:0,limitMinor:100000,categoryLimits:[{categoryId:category.id,limitMinor:20000}]};
 const writes=await Promise.all([post('/budgets',budget),post('/budgets',{...budget,limitMinor:99999})]);assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
 const saved=await read('/budgets?month=2036-02&currency=DOP');assert.equal(saved.version,1);assert.equal(saved.categoryLimits[0].limitMinor,20000);
 assert.deepEqual(await read('/budgets?month=2036-02&currency=USD'),{version:0,limitMinor:null,categoryLimits:[]});
 assert.equal((await post('/budgets',{...budget,expectedVersion:1,limitMinor:null,categoryLimits:[]})).status,200);
 assert.equal((await read('/budgets?month=2036-02&currency=DOP')).version,2,'Removing limits preserves version tombstone');
 assert.equal((await post('/budgets',budget)).status,409,'A stale empty-period client cannot overwrite tombstone');
 console.info('PASS CORE FINANCE: currency-safe debt payments/idempotency, accurate balances, snapshot reconciliation/protected history, archive/version guards, server budgets isolate currencies and reject stale concurrent writes');
}
