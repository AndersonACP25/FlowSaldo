import {Router,type RequestHandler} from 'express';
import {createHash,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {db} from '@flowsaldo/database';
export class AuthError extends Error{constructor(message:string,public status=401){super(message);}}
const publicOwner={id:true,name:true,email:true} as const;
const password=z.string().min(15).max(128);
const name=z.string().trim().min(1).max(60);
const email=z.string().trim().email().max(120).transform(v=>v.toLowerCase());
const sessionLifetime=24*60*60*1000;
export const tokenDigest=(token:string)=>createHash('sha256').update(token).digest('hex');
let hashing=0;
async function derive(value:string,salt:Buffer){
 if(hashing>=2)throw new AuthError('Hay otra validación de acceso en curso. Reintenta en unos segundos.',503);
 hashing++;try{return await new Promise<Buffer>((resolve,reject)=>scrypt(value,salt,64,{N:131072,r:8,p:1,maxmem:192*1024*1024},(error,key)=>error?reject(error):resolve(key)));}finally{hashing--;}
}
async function hashPassword(value:string){const salt=randomBytes(16);return `scrypt-v1$${salt.toString('base64url')}$${(await derive(value,salt)).toString('base64url')}`;}
async function verify(value:string,stored?:string){
 const parts=stored?.split('$');const valid=parts?.length===3&&parts[0]==='scrypt-v1'&&/^[\w-]{22}$/.test(parts[1])&&/^[\w-]{86}$/.test(parts[2]);
 const actual=await derive(value,valid?Buffer.from(parts![1],'base64url'):Buffer.alloc(16));
 return timingSafeEqual(actual,valid?Buffer.from(parts![2],'base64url'):Buffer.alloc(64))&&!!valid;
}
function bearer(header:string|undefined){return header?.startsWith('Bearer ')?header.slice(7):'';}
function bootstrapMatches(value:string,secret:string){const a=Buffer.from(value),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b);}
// Persisted throttling survives process restarts. No user-supplied password/email is a bucket key.
const throttle=(action:string,limit:number):RequestHandler=>async(req,res,next)=>{
 const key=tokenDigest(action+':'+req.ip);const now=new Date();const cutoff=new Date(now.getTime()-15*60*1000);
 const [bucket]=await db.$queryRaw<Array<{attempts:number;startedAt:Date}>>`INSERT INTO "AuthThrottle" (key,"startedAt",attempts) VALUES (${key},${now},1) ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN "AuthThrottle"."startedAt"<=${cutoff} THEN 1 ELSE "AuthThrottle".attempts+1 END,"startedAt"=CASE WHEN "AuthThrottle"."startedAt"<=${cutoff} THEN ${now} ELSE "AuthThrottle"."startedAt" END RETURNING attempts,"startedAt"`;
 if(bucket.attempts>limit){res.setHeader('Retry-After',String(Math.max(1,Math.ceil((bucket.startedAt.getTime()+900000-now.getTime())/1000))));res.status(429).json({error:'Demasiados intentos de acceso. Espera antes de reintentar.'});return;}
 // Bound retained throttle records to recent activity; run after accepting a bucket.
 await db.authThrottle.deleteMany({where:{startedAt:{lt:new Date(now.getTime()-86400000)}}});next();
};
export function createAuth(bootstrapSecret:string){
 const publicRoutes=Router(),sessionRoutes=Router();
 const authorize:RequestHandler=async(req,res,next)=>{
  const token=bearer(req.headers.authorization);
  if(/^fs_[A-Za-z0-9_-]{43}$/.test(token)){
   const session=await db.accessSession.findUnique({where:{tokenHash:tokenDigest(token)},include:{owner:{select:publicOwner}}});
   if(session&&!session.revokedAt&&session.expiresAt>new Date()){res.locals.accessSession=session;next();return;}
  }
  if(bootstrapMatches(token,bootstrapSecret)&&!await db.appOwner.findUnique({where:{id:1},select:{id:true}})){res.locals.developmentAccess=true;next();return;}
  res.status(401).json({error:'La sesión no es válida o ha vencido. Inicia sesión nuevamente.'});
 };
 const requireSession:RequestHandler=(_req,res,next)=>{if(!res.locals.accessSession){res.status(401).json({error:'Esta acción requiere iniciar sesión con la cuenta personal.'});return;}next();};
 publicRoutes.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 sessionRoutes.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 publicRoutes.get('/auth/status',async(_req,res)=>res.json({configured:!!await db.appOwner.findUnique({where:{id:1},select:{id:true}})}));
 publicRoutes.post('/auth/setup',throttle('setup',5),async(req,res)=>{
  if(!bootstrapMatches(bearer(req.headers.authorization),bootstrapSecret))throw new AuthError('Token de configuración no válido.');
  const data=z.object({name,email,password}).parse(req.body);
  if(await db.appOwner.findUnique({where:{id:1},select:{id:true}}))throw new AuthError('Esta instalación ya tiene una cuenta personal.',409);
  const passwordHash=await hashPassword(data.password);
  try{const owner=await db.appOwner.create({data:{id:1,name:data.name,email:data.email,passwordHash},select:publicOwner});res.status(201).json({owner});}
  catch(error){if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='P2002')throw new AuthError('Esta instalación ya tiene una cuenta personal.',409);throw error;}
 });
 publicRoutes.post('/auth/login',throttle('login',10),async(req,res)=>{
  const data=z.object({email,password:z.string().min(1).max(128)}).parse(req.body);
  const owner=await db.appOwner.findUnique({where:{email:data.email}});
  if(!await verify(data.password,owner?.passwordHash)||!owner)throw new AuthError('Correo o contraseña incorrectos.');
  const token='fs_'+randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+sessionLifetime);
  const session=await db.$transaction(async tx=>{
   const [current]=await tx.$queryRaw<Array<{passwordHash:string}>>`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
   if(current?.passwordHash!==owner.passwordHash)throw new AuthError('La contraseña cambió. Inicia sesión nuevamente.');
   // Expired/revoked sessions are unnecessary credentials and are removed when issuing a new one.
   await tx.accessSession.deleteMany({where:{OR:[{expiresAt:{lte:new Date()}},{revokedAt:{not:null}}]}});
   if(await tx.accessSession.count({where:{ownerId:1}})>=10){const oldest=await tx.accessSession.findFirstOrThrow({where:{ownerId:1},orderBy:[{createdAt:'asc'},{id:'asc'}],select:{id:true}});await tx.accessSession.update({where:{id:oldest.id},data:{revokedAt:new Date()}});}
   return tx.accessSession.create({data:{ownerId:1,tokenHash:tokenDigest(token),expiresAt},select:{id:true}});
  });
  res.json({token,expiresAt,sessionId:session.id,owner:{id:owner.id,name:owner.name,email:owner.email}});
 });
 publicRoutes.post('/auth/recover',throttle('recover',5),async(req,res)=>{
  const data=z.object({email,code:z.string().regex(/^fr_[A-Za-z0-9_-]{32}$/),newPassword:password}).parse(req.body);
  // Hash before checking the code so unknown accounts/codes follow the same expensive path.
  const passwordHash=await hashPassword(data.newPassword);
  await db.$transaction(async tx=>{
   const [owner]=await tx.$queryRaw<Array<{email:string}>>`SELECT email FROM "AppOwner" WHERE id=1 FOR UPDATE`;
   const code=await tx.recoveryCode.findUnique({where:{codeHash:tokenDigest(data.code)}});
   if(!owner||owner.email!==data.email||!code||code.ownerId!==1||code.usedAt||code.expiresAt<=new Date())throw new AuthError('El correo o el código de recuperación no son válidos.');
   await tx.appOwner.update({where:{id:1},data:{passwordHash}});
   // Recovering control invalidates the entire old batch, not just the presented code.
   await tx.recoveryCode.deleteMany({where:{ownerId:1}});
   await tx.accessSession.updateMany({where:{ownerId:1,revokedAt:null},data:{revokedAt:new Date()}});
  });res.status(204).end();
 });
 sessionRoutes.use('/auth',requireSession);
 sessionRoutes.get('/auth/me',(_req,res)=>{const s=res.locals.accessSession;res.json({owner:s.owner,expiresAt:s.expiresAt,sessionId:s.id});});
 sessionRoutes.patch('/auth/me',throttle('profile',5),async(req,res)=>{
  const {name:displayName,email:address,currentPassword}=z.object({name,email,currentPassword:z.string().min(1).max(128)}).strict().parse(req.body);
  const session=res.locals.accessSession;
  const existing=await db.appOwner.findUniqueOrThrow({where:{id:session.owner.id}});
  if(!await verify(currentPassword,existing.passwordHash))throw new AuthError('La contraseña actual no es correcta.');
  const owner=await db.$transaction(async tx=>{
   const result=await tx.appOwner.updateMany({where:{id:existing.id,passwordHash:existing.passwordHash,
    sessions:{some:{id:session.id,revokedAt:null,expiresAt:{gt:new Date()}}}},data:{name:displayName,email:address}});
   if(!result.count)throw new AuthError('La sesión cambió. Inicia sesión nuevamente.');
   return tx.appOwner.findUniqueOrThrow({where:{id:existing.id},select:publicOwner});
  });
  res.json({owner});
 });
 sessionRoutes.post('/auth/logout',async(_req,res)=>{await db.accessSession.updateMany({where:{id:res.locals.accessSession.id,revokedAt:null},data:{revokedAt:new Date()}});res.status(204).end();});
 sessionRoutes.get('/auth/sessions',async(_req,res)=>{const sessions=await db.accessSession.findMany({where:{ownerId:1,revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true,createdAt:true,expiresAt:true},orderBy:{createdAt:'desc'}});res.json(sessions.map(s=>({...s,current:s.id===res.locals.accessSession.id})));});
 sessionRoutes.post('/auth/sessions/revoke-others',async(_req,res)=>{const result=await db.accessSession.updateMany({where:{ownerId:1,id:{not:res.locals.accessSession.id},revokedAt:null},data:{revokedAt:new Date()}});res.json({revoked:result.count});});
 sessionRoutes.get('/auth/recovery-codes',async(_req,res)=>{
  const now=new Date();const where={ownerId:1,usedAt:null,expiresAt:{gt:now}};
  const [remaining,first]=await Promise.all([db.recoveryCode.count({where}),db.recoveryCode.findFirst({where,select:{expiresAt:true},orderBy:{expiresAt:'asc'}})]);
  res.json({remaining,expiresAt:first?.expiresAt??null});
 });
 sessionRoutes.post('/auth/recovery-codes',throttle('recovery-codes',5),async(req,res)=>{
  const {currentPassword}=z.object({currentPassword:z.string().min(1).max(128)}).parse(req.body);
  const existing=await db.appOwner.findUniqueOrThrow({where:{id:1}});if(!await verify(currentPassword,existing.passwordHash))throw new AuthError('La contraseña actual no es correcta.');
  const codes=Array.from({length:5},()=> 'fr_'+randomBytes(24).toString('base64url'));const expiresAt=new Date(Date.now()+90*86400000);
  await db.$transaction(async tx=>{
   const [owner]=await tx.$queryRaw<Array<{passwordHash:string}>>`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
   if(owner.passwordHash!==existing.passwordHash)throw new AuthError('La contraseña cambió. Inicia sesión nuevamente.',409);
   await tx.recoveryCode.deleteMany({where:{ownerId:1}});await tx.recoveryCode.createMany({data:codes.map(code=>({ownerId:1,codeHash:tokenDigest(code),expiresAt}))});
  });res.status(201).json({codes,expiresAt});
 });
 sessionRoutes.post('/auth/recovery-codes/revoke',throttle('recovery-codes',5),async(req,res)=>{
  const {currentPassword}=z.object({currentPassword:z.string().min(1).max(128)}).parse(req.body);
  const existing=await db.appOwner.findUniqueOrThrow({where:{id:1}});if(!await verify(currentPassword,existing.passwordHash))throw new AuthError('La contraseña actual no es correcta.');
  await db.$transaction(async tx=>{const [owner]=await tx.$queryRaw<Array<{passwordHash:string}>>`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;if(owner.passwordHash!==existing.passwordHash)throw new AuthError('La contraseña cambió.',409);await tx.recoveryCode.deleteMany({where:{ownerId:1}});});res.status(204).end();
 });
 sessionRoutes.post('/auth/data/retention/preview',async(req,res)=>{
  const {olderThanDays}=z.object({olderThanDays:z.number().int().min(7).max(365)}).parse(req.body);const cutoff=new Date(Date.now()-olderThanDays*86400000);
  const where={body:{not:''},createdAt:{lt:cutoff},movement:{is:null},status:{in:['REVIEW','FAILED'] as Array<'REVIEW'|'FAILED'>}};
  const result=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "AppOwner" WHERE id=1 FOR UPDATE`;
   const [rows,totalEligible,lastCleanup]=await Promise.all([tx.mailImport.findMany({where,orderBy:[{createdAt:'asc'},{id:'asc'}],take:1000,select:{id:true,status:true}}),tx.mailImport.count({where}),tx.dataCleanup.findFirst({where:{ownerId:1},orderBy:{createdAt:'desc'},select:{createdAt:true,reviewBodies:true,failedBodies:true}})]);
   const id=randomBytes(24).toString('base64url');const expiresAt=new Date(Date.now()+10*60000);const data={id,cutoff,expiresAt,importIds:rows.map(row=>row.id)};
   await tx.cleanupPreview.upsert({where:{ownerId:1},create:{ownerId:1,...data},update:data});
   return {previewId:id,cutoff,expiresAt,reviewBodies:rows.filter(r=>r.status==='REVIEW').length,failedBodies:rows.filter(r=>r.status==='FAILED').length,totalEligible,hasMore:totalEligible>rows.length,lastCleanup};
  });res.json(result);
 });
 sessionRoutes.post('/auth/data/retention/apply',throttle('retention',5),async(req,res)=>{
  const data=z.object({previewId:z.string().min(1).max(100),currentPassword:z.string().min(1).max(128),confirmation:z.literal('ELIMINAR CONTENIDO')}).strict().parse(req.body);
  const existing=await db.appOwner.findUniqueOrThrow({where:{id:1}});if(!await verify(data.currentPassword,existing.passwordHash))throw new AuthError('La contraseña actual no es correcta.');
  const result=await db.$transaction(async tx=>{
   const [owner]=await tx.$queryRaw<Array<{passwordHash:string}>>`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
   if(owner.passwordHash!==existing.passwordHash)throw new AuthError('La contraseña cambió. Inicia sesión nuevamente.',409);
   const preview=await tx.cleanupPreview.findUnique({where:{ownerId:1}});if(!preview||preview.id!==data.previewId||preview.expiresAt<=new Date())throw new AuthError('La vista previa venció o cambió. Previsualiza nuevamente.',409);
   const cutoff=preview.cutoff;const where={id:{in:preview.importIds},body:{not:''},createdAt:{lt:cutoff},movement:{is:null}};const now=new Date();
   // updateMany rechecks state under row locks: a concurrently confirmed record is preserved.
   const review=await tx.mailImport.updateMany({where:{...where,status:'REVIEW'},data:{body:'',status:'DISMISSED',reason:'Contenido eliminado por retención manual.',processedAt:now}});
   const failed=await tx.mailImport.updateMany({where:{...where,status:'FAILED'},data:{body:'',status:'DISMISSED',reason:'Contenido eliminado por retención manual.',processedAt:now,lockToken:null,lockedUntil:null}});
   const sessions=await tx.accessSession.deleteMany({where:{OR:[{revokedAt:{not:null}},{expiresAt:{lte:now}}]}});
   const codes=await tx.recoveryCode.deleteMany({where:{OR:[{usedAt:{not:null}},{expiresAt:{lte:now}}]}});
   const throttles=await tx.authThrottle.deleteMany({where:{startedAt:{lt:new Date(now.getTime()-86400000)}}});
   await tx.cleanupPreview.delete({where:{ownerId:1}});
   return tx.dataCleanup.create({data:{ownerId:1,cutoff,reviewBodies:review.count,failedBodies:failed.count,accessRecords:sessions.count+codes.count+throttles.count},select:{id:true,cutoff:true,reviewBodies:true,failedBodies:true,accessRecords:true,createdAt:true}});
  });res.json(result);
 });
 sessionRoutes.post('/auth/password',throttle('password',5),async(req,res)=>{
  const data=z.object({currentPassword:z.string().min(1).max(128),newPassword:password}).refine(v=>v.currentPassword!==v.newPassword).parse(req.body);
  const existing=await db.appOwner.findUniqueOrThrow({where:{id:1}});
  if(!await verify(data.currentPassword,existing.passwordHash))throw new AuthError('La contraseña actual no es correcta.');
  const passwordHash=await hashPassword(data.newPassword);
  await db.$transaction(async tx=>{
   const [current]=await tx.$queryRaw<Array<{passwordHash:string}>>`SELECT "passwordHash" FROM "AppOwner" WHERE id=1 FOR UPDATE`;
   if(current.passwordHash!==existing.passwordHash)throw new AuthError('La contraseña cambió. Inicia sesión nuevamente.',409);
   await tx.appOwner.update({where:{id:1},data:{passwordHash}});await tx.recoveryCode.deleteMany({where:{ownerId:1}});await tx.accessSession.updateMany({where:{ownerId:1,revokedAt:null},data:{revokedAt:new Date()}});
  });res.status(204).end();
 });
 return {publicRoutes,authorize,sessionRoutes};
}
