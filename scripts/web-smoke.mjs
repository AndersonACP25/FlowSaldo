import { chromium } from 'playwright';
import {checkFinanceFlow} from './finance-web-flow.mjs';
import {checkAccessFlow} from './access-web-flow.mjs';
import {checkCoreFlows} from './web-core-flows.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve(process.env.WEB_DIST ?? 'dist/web');
const server=createServer(async(req,res)=>{
 try {
  const path=resolve(root,'.'+decodeURIComponent((req.url??'/').split('?')[0] === '/' ? '/index.html' : (req.url??'/').split('?')[0]));
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(path);res.setHeader('Content-Type',extname(path)==='.js'?'application/javascript':extname(path)==='.html'?'text/html':'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(8082,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']}: {})});
try{await checkCoreFlows(browser);await checkAccessFlow(browser);await checkFinanceFlow(browser);}finally{await browser.close();server.close();}
