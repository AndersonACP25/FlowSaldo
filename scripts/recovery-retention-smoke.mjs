import {runRetention,retentionDays} from '../apps/worker/src/retention.ts';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export async function checkRecoveryRetention(call,db,currentPassword){
 // Independent security scenarios should not consume each other's artificial test buckets.
 await db.authThrottle.deleteMany();
 const email='owner@correo.test';const newPassword='Synthetic-Recovered-Passphrase-2026';
 const login=async password=>{const r=await call('/auth/login',{email,password});assert.equal(r.status,200);return r.json();};
 const session=await login(currentPassword);const digest=value=>createHash('sha256').update(value).digest('hex');
 const generate=pass=>call('/auth/recovery-codes',{currentPassword:pass},session.token);
 assert.equal((await generate('Wrong-Synthetic-Password')).status,401);
 const firstResponse=await generate(currentPassword);assert.equal(firstResponse.status,201);const first=await firstResponse.json();assert.equal(first.codes.length,5);assert.equal(new Set(first.codes).size,5);
 const stored=await db.recoveryCode.findMany();assert.equal(stored.length,5);assert.ok(stored.every(row=>first.codes.some(code=>digest(code)===row.codeHash)));assert.ok(stored.every(row=>!first.codes.includes(row.codeHash)));
 const second=await (await generate(currentPassword)).json();assert.equal((await call('/auth/recover',{email,code:first.codes[0],newPassword})).status,401,'Rotating invalidates previous batch');
 await db.recoveryCode.update({where:{codeHash:digest(second.codes[1])},data:{expiresAt:new Date(Date.now()-1000)}});
 assert.equal((await call('/auth/recover',{email,code:second.codes[1],newPassword})).status,401);
 const results=await Promise.all([1,2].map(()=>call('/auth/recover',{email,code:second.codes[0],newPassword})));assert.deepEqual(results.map(r=>r.status).sort(),[204,401]);
 assert.equal(await db.recoveryCode.count(),0,'A recovery invalidates the full old batch');assert.equal((await call('/auth/me',undefined,session.token)).status,401);
 assert.equal((await call('/auth/recover',{email,code:second.codes[0],newPassword})).status,401,'A code cannot be reused');
 assert.equal((await call('/auth/login',{email,password:currentPassword})).status,401);const recovered=await login(newPassword);
 const third=await call('/auth/recovery-codes',{currentPassword:newPassword},recovered.token);assert.equal(third.status,201);
 assert.equal((await call('/auth/recovery-codes/revoke',{currentPassword:newPassword},recovered.token)).status,204);assert.equal(await db.recoveryCode.count(),0);
 const prefix='retention-'+Date.now();const old=new Date(Date.now()-60*86400000);const today=new Date();
 const rows=[['review','REVIEW',old],['failed','FAILED',old],['fresh','REVIEW',today],['pending','PENDING',old],['processing','PROCESSING',old],['protected','REVIEW',old]].map(([suffix,status,createdAt])=>({id:prefix+'-'+suffix,externalId:prefix+'-'+suffix,status,createdAt,body:'Synthetic content '+suffix}));
 try{
  await db.mailImport.createMany({data:rows});
  const movement=await db.movement.create({data:{description:'Financial record retained',amountMinor:12345,currency:'DOP',type:'EXPENSE',occurredAt:today,importId:prefix+'-protected'}});
  const before=await db.movement.count();
  await db.accessSession.create({data:{id:prefix+'-expired',ownerId:1,tokenHash:digest(prefix+'session'),expiresAt:old}});
  await db.recoveryCode.createMany({data:[{id:prefix+'-code-expired',ownerId:1,codeHash:digest(prefix+'expired'),expiresAt:old},{id:prefix+'-code-active',ownerId:1,codeHash:digest(prefix+'active'),expiresAt:new Date(Date.now()+86400000)}]});
  const previewResponse=await call('/auth/data/retention/preview',{olderThanDays:30},recovered.token);assert.equal(previewResponse.status,200);const preview=await previewResponse.json();assert.equal(preview.reviewBodies,1);assert.equal(preview.failedBodies,1);
  await db.mailImport.create({data:{id:prefix+'-after-preview',externalId:prefix+'-after-preview',status:'FAILED',createdAt:old,body:'Synthetic later arrival'}});
  const body={previewId:preview.previewId,currentPassword:newPassword,confirmation:'ELIMINAR CONTENIDO'};
  assert.equal((await call('/auth/data/retention/apply',{...body,confirmation:'no'},recovered.token)).status,400);
  assert.equal((await call('/auth/data/retention/apply',{...body,previewId:'unavailable-preview'},recovered.token)).status,409);
  assert.equal((await call('/auth/data/retention/apply',{...body,currentPassword:'Wrong-Synthetic-Password'},recovered.token)).status,401);
  const result=await call('/auth/data/retention/apply',body,recovered.token);assert.equal(result.status,200);const cleanup=await result.json();assert.equal(cleanup.reviewBodies,1);assert.equal(cleanup.failedBodies,1);
  for(const suffix of ['review','failed']){const item=await db.mailImport.findUniqueOrThrow({where:{id:prefix+'-'+suffix}});assert.equal(item.status,'DISMISSED');assert.equal(item.body,'');}
  for(const suffix of ['fresh','pending','processing','protected','after-preview'])assert.ok((await db.mailImport.findUniqueOrThrow({where:{id:prefix+'-'+suffix}})).body);
  assert.equal(await db.movement.count(),before);assert.ok(await db.movement.findUnique({where:{id:movement.id}}));
  assert.equal((await call('/imports/'+prefix+'-failed'+'/retry',{},recovered.token)).status,409);
  assert.equal((await call('/auth/me',undefined,recovered.token)).status,200);assert.ok(await db.recoveryCode.findUnique({where:{id:prefix+'-code-active'}}));assert.equal(await db.recoveryCode.findUnique({where:{id:prefix+'-code-expired'}}),null);
  assert.ok(await db.dataCleanup.findUnique({where:{id:cleanup.id}}));
  assert.equal((await call('/auth/data/retention/apply',body,recovered.token)).status,409,'Preview is single use');
  assert.equal(retentionDays(undefined),null);
  assert.equal(retentionDays('30'),30);
  assert.throws(()=>retentionDays('6'));
  await Promise.all([runRetention(db,30,today),runRetention(db,30,today)]);
  const automaticallyDiscarded=await db.mailImport.findUniqueOrThrow({where:{id:prefix+'-after-preview'}});
  assert.equal(automaticallyDiscarded.body,'');
  assert.equal(automaticallyDiscarded.status,'DISMISSED');
  for(const suffix of ['fresh','pending','processing','protected'])assert.ok((await db.mailImport.findUniqueOrThrow({where:{id:prefix+'-'+suffix}})).body);
  assert.equal(await db.movement.count(),before);
  assert.equal(await runRetention(db,30,today),0);
  console.info('PASS CORE AUTO RETENTION: optional policy, eligible bodies cleared once, live queue and movements preserved');
 }finally{await db.movement.deleteMany({where:{importId:{startsWith:prefix}}});await db.mailImport.deleteMany({where:{id:{startsWith:prefix}}});await db.recoveryCode.deleteMany({where:{id:{startsWith:prefix}}});}
 console.info('PASS CORE RECOVERY/RETENTION: hashed/rotated/expired single-use codes, concurrent reset/session revocation, preview/reauth/confirmation, cleanup preserves financial/live data and audit');
}
