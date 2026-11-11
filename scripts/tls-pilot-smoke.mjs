import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {request} from 'node:https';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export async function checkNativeTls(activeToken, revokedToken) {
 const directory = await mkdtemp(join(tmpdir(),'flowsaldo-tls-'));
 const cert = join(directory,'certificate.pem');
 const key = join(directory,'private-key.pem');
 let child;
 let exited;
 try {
  execFileSync('openssl',[
   'req','-x509','-newkey','rsa:2048','-nodes','-days','1',
   '-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1',
   '-keyout',key,'-out',cert,
  ],{stdio:'ignore'});
  const ca = await readFile(cert);
  child = spawn(process.execPath,['--import','tsx','--env-file=.env','apps/api/src/index.ts'],{
   stdio:'inherit',
   env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3443',
    TRUST_PROXY_LOOPBACK:'0',TLS_CERT_FILE:cert,TLS_KEY_FILE:key},
  });
  exited = once(child,'exit');
  const call = (path,token) => new Promise((resolve,reject) => {
   const req = request({
    hostname:'127.0.0.1',port:3443,path,ca,timeout:3000,
    headers:token?{Authorization:'Bearer '+token}:{},
   },res => {
    res.resume();
    res.on('end',()=>resolve(res.statusCode));
    res.on('error',reject);
   });
   req.on('timeout',()=>req.destroy(new Error('Tiempo de espera TLS agotado.')));
   req.on('error',reject);
   req.end();
  });
  let ready = false;
  for(let attempt=0;attempt<40 && child.exitCode===null;attempt++){
   try { ready = await call('/health')===200; } catch { /* API starting */ }
   if(ready) break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'API TLS lista con certificado verificado');
  assert.equal(await call('/auth/me'),401);
  assert.equal(await call('/auth/me',activeToken),200);
  assert.equal(await call('/auth/me',revokedToken),401);
  console.info('PASS CORE TLS PILOT: trusted certificate, authenticated session and revoked token over HTTPS');
 } finally {
  if(child && exited){
   child.kill('SIGTERM');
   await exited;
  }
  await rm(directory,{recursive:true,force:true});
 }
}
