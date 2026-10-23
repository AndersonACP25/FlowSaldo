import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, URL } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const child=spawn(process.execPath,['scripts/expo.mjs','web','--localhost','--port','8083'],{cwd:root,env:{...process.env,CI:'1',EXPO_UNSTABLE_BONJOUR:'0'},stdio:'inherit'});
let browser;
try {
 let ready=false;
 for(let i=0;i<120;i++) {try{const r=await fetch('http://localhost:8083/status');if(r.ok){ready=true;break;}}catch { /* Metro starts asynchronously. */ }await new Promise(r=>setTimeout(r,500));}
 assert.ok(ready,'Metro debe iniciar');
 const response=await fetch('http://localhost:8083/apps/mobile/index.ts.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable');
 if(!response.ok)throw new Error(`Metro ${response.status}: ${(await response.text()).slice(0,2000)}`);
 assert.ok((await response.text()).length>1000,'bundle con contenido');
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']}: {})});
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8083',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Explorar demostración',exact:true}).click();
 await page.getByText('Tu presupuesto mensual',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Por revisar',exact:true}).click();
 await page.getByText('3 movimientos por confirmar',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.info('PASS: Metro development bundle 200 + frontend loaded + review navigation');
} finally {
 await browser?.close();
 const exited=once(child,'exit');
 if(process.platform==='win32') { const killer=spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore'}); await once(killer,'exit'); } else child.kill('SIGTERM');
 await Promise.race([exited,new Promise(r=>setTimeout(r,4000))]);
}
