import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
export async function checkAccessTransport(){
 for(const trusted of [false,true]){
  const child=spawn(process.execPath,['--import','tsx','--env-file=.env','apps/api/src/index.ts'],{stdio:'inherit',env:{...process.env,NODE_ENV:'production',PORT:'3001',HOST:'127.0.0.1',TRUST_PROXY_LOOPBACK:trusted?'1':'0'}});
  try{
   let ready=false;for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3001/health')).ok){ready=true;break;}}catch{/* Process starts asynchronously. */}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
   assert.equal((await fetch('http://127.0.0.1:3001/auth/status')).status,403);
   const forwarded=await fetch('http://127.0.0.1:3001/auth/status',{headers:{'X-Forwarded-Proto':'https'}});assert.equal(forwarded.status,trusted?200:403);
  }finally{const exited=once(child,'exit');child.kill('SIGTERM');await exited;}
 }
 console.info('PASS CORE ACCESS: production rejects plain HTTP and only honors HTTPS forwarding from explicitly trusted loopback proxy');
}
