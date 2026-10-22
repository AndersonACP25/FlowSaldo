/* global document */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
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
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8082',{waitUntil:'networkidle'});
 await page.getByText('Tu presupuesto mensual',{exact:true}).waitFor();

 await page.getByLabel('Nuevo límite mensual',{exact:true}).fill('3000');
 await page.getByRole('button',{name:'Guardar presupuesto',exact:true}).click();
 await page.getByText('82% utilizado · DOP 3,000.00',{exact:true}).waitFor();
 await page.getByRole('button',{name:'+ Nuevo movimiento',exact:true}).click();
 await page.getByLabel('Descripción',{exact:true}).fill('Prueba persistencia');
 await page.getByLabel('Monto (sin separadores de miles)',{exact:true}).fill('100.29');
 await page.getByLabel('Fecha (AAAA-MM-DD)',{exact:true}).fill(new Date().toISOString().slice(0,7)+'-15');
 await page.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
 await page.getByText('Movimiento guardado.',{exact:true}).waitFor();
 await page.getByLabel('Buscar descripción o categoría',{exact:true}).fill('Prueba persistencia');
 assert.equal(await page.getByText('Prueba persistencia',{exact:true}).count(),1);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
 const downloaded=await download;assert.ok(downloaded.suggestedFilename().endsWith('.csv'));
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Movimientos',exact:true}).click();
 await page.getByText('Prueba persistencia',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Editar Prueba persistencia',exact:true}).click();
 await page.getByLabel('Descripción',{exact:true}).fill('Prueba editada');
 await page.getByLabel('Monto (sin separadores de miles)',{exact:true}).fill('200,50');
 await page.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
 await page.getByText('Prueba editada',{exact:true}).waitFor();
 await page.getByLabel('Buscar descripción o categoría',{exact:true}).fill('Prueba editada');
 await page.getByRole('button',{name:'Eliminar',exact:true}).click();
 await page.getByRole('button',{name:'Cancelar eliminación',exact:true}).click();
 await page.getByText('Prueba editada',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Eliminar',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar eliminación',exact:true}).click();
 await page.getByText('No hay movimientos con estos filtros',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Resumen',exact:true}).click();
 await page.getByText('82% utilizado · DOP 3,000.00',{exact:true}).waitFor();
 await page.getByRole('button',{name:'USD',exact:true}).click();
 await page.getByText('USD 12.99',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'‹ Mes anterior',exact:true}).click();
 await page.getByText('Todavía no hay gastos este mes en esta moneda.',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Mes siguiente ›',exact:true}).click();
 await page.getByRole('button',{name:'DOP',exact:true}).click();

 assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('div')).every(e=>e.scrollWidth<=e.clientWidth+2)), 'no horizontal overflow in scroll containers');
 assert.deepEqual(errors,[]);
 console.log('PASS: create/edit/delete + cancel, persistence, budget, month/currency filters, CSV download, mobile width; no page errors.');
}finally{await browser.close();server.close();}
