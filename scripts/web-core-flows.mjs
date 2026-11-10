/* global localStorage */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {URL} from 'node:url';
import {demoCategoryCatalog,demoMovements,movementsCsv} from '../packages/domain/src/index.ts';
import {parseCsv} from './export-guardian.mjs';

// Three independent critical journeys. Business-rule combinations live in domain/API tests.
export async function checkCoreFlows(browser) {
 const month=new Date().toISOString().slice(0,7);const today=new Date().toISOString().slice(0,10);
 async function scenario(name,work,legacy) {
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(10000);
  if(legacy)await context.addInitScript(data=>{if(!localStorage.getItem('flowsaldo.demo.v2'))localStorage.setItem('flowsaldo.demo.v2',JSON.stringify(data));},legacy);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const button=label=>page.getByRole('button',{name:label,exact:true});
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('flowsaldo.demo.v2')));
  try{await work(page,button,stored);assert.deepEqual(errors,[]);console.info('PASS CORE UI: '+name);}finally{await context.close();}
 }
 await scenario('register → persist → export filtered CSV',async(page,button)=>{
  await page.goto('http://127.0.0.1:8082',{waitUntil:'networkidle'});await button('Explorar demostración').click();await button('+ Nuevo movimiento').click();
  await page.getByLabel('Descripción',{exact:true}).fill('Compra CORE');await page.getByLabel('Monto (sin separadores de miles)',{exact:true}).fill('100.29');
  await button('Guardar movimiento').click();await page.getByText('Movimiento guardado.',{exact:true}).waitFor();
  await page.reload({waitUntil:'networkidle'});await button('Explorar demostración').click();await button('Movimientos').click();
  await page.getByLabel('Buscar descripción o categoría',{exact:true}).fill('Compra CORE');await page.getByText('1 movimiento',{exact:true}).waitFor();
  const waiting=page.waitForEvent('download');await button('Exportar CSV').click();const file=await waiting;assert.equal(file.suggestedFilename(),`FlowSaldo-${month}.csv`);
  const csv=parseCsv(await readFile(await file.path(),'utf8'));assert.equal(csv.length,2);assert.equal(csv[1][3],'100.29');assert.equal(csv[1][4],'Compra CORE');
 });
 const legacy={movements:[],budgets:{},reviews:[{id:'review-core',externalId:'Aviso CORE',status:'REVIEW',reason:'Revisar importe',body:'Aviso sintético',suggestion:{id:'suggestion',description:'Compra revisada CORE',amountMinor:1250,currency:'DOP',type:'EXPENSE',category:'Servicios',occurredAt:today+'T12:00:00.000Z'}}]};
 await scenario('confirm recurrence once → confirm review → open generated movement',async(page,button,stored)=>{
  await page.goto('http://127.0.0.1:8082',{waitUntil:'networkidle'});await button('Explorar demostración').click();await button('Movimientos').click();await button('Nueva plantilla mensual').click();
  await page.getByLabel('Descripción',{exact:true}).fill('Alquiler CORE');await page.getByLabel('Monto (sin separadores de miles)',{exact:true}).fill('100');await button('Categoría: Servicios').click();
  await button('Guardar plantilla mensual').click();await page.getByText('Plantilla mensual guardada.',{exact:true}).waitFor();assert.equal((await stored()).movements.length,0);
  await button('Registrar vencimiento Alquiler CORE').click();await button('Confirmar registro de vencimiento').click();await page.getByText('Vencimiento registrado una sola vez.',{exact:true}).waitFor();
  assert.equal((await stored()).movements.length,1);assert.equal((await stored()).receipts.length,1);
  await page.reload({waitUntil:'networkidle'});await button('Explorar demostración').click();await button('Movimientos').click();assert.ok(await button('Registrar vencimiento Alquiler CORE').isDisabled());
  await button('Por revisar').click();await button('Revisar y confirmar').click();await button('Guardar movimiento').click();await page.getByText('Revisión confirmada. Movimiento registrado.',{exact:true}).waitFor();
  await button('Confirmados').click();await button('Ver movimiento generado').click();await page.getByText('Movimiento generado',{exact:true}).waitFor();await page.getByText(/Referencia: reviewed-review-core/).waitFor();
  assert.equal((await stored()).movements.length,2);
 },legacy);
 if(!process.env.EXPO_PUBLIC_API_URL)throw new Error('Exporta con EXPO_PUBLIC_API_URL para el recorrido CORE API.');
 await scenario('API exports all 205 results before loading next page',async(page,button)=>{
  const rows=Array.from({length:205},(_,i)=>({...demoMovements[1],id:String(i),description:'Movimiento '+i,occurredAt:month+'-01T12:00:00.000Z'}));
  await page.route(process.env.EXPO_PUBLIC_API_URL+'/**',async route=>{
   const url=new URL(route.request().url());const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type'};
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   let data;
   if(url.pathname==='/categories')data=demoCategoryCatalog([]);
   else if(url.pathname==='/recurring')data=[];
   else if(url.pathname==='/imports')data={items:[],total:0,nextCursor:null,pendingTotal:0};
   else if(url.pathname==='/summary')data={incomeMinor:0,expenseMinor:50235250,differenceMinor:-50235250,total:205,categories:[],categoryTotals:[],days:Array.from({length:7},(_,i)=>({day:month+'-0'+(i+1),incomeMinor:0,expenseMinor:0,netMinor:0}))};
   else if(url.pathname==='/movements/export'){await route.fulfill({headers,contentType:'text/csv',body:movementsCsv(rows)});return;}
   else if(url.pathname==='/movements'){const offset=Number(url.searchParams.get('cursor')??0);data={items:rows.slice(offset,offset+50),total:205,nextCursor:offset+50<205?String(offset+50):null};}
   else throw new Error('Unexpected API path '+url.pathname);
   await route.fulfill({headers,json:data});
  });
  await page.goto('http://127.0.0.1:8082',{waitUntil:'networkidle'});await button('Explorar demostración').click();await button('Conexiones').click();await page.getByLabel('Token de desarrollo',{exact:true}).fill('synthetic-core-token-123456789');await button('Conectar API').click();
  await button('Movimientos').click();await page.getByText('205 movimientos',{exact:true}).waitFor();assert.equal(await page.getByText('Movimiento 50',{exact:true}).count(),0);
  const waiting=page.waitForEvent('download');await button('Exportar CSV').click();const file=await waiting;assert.equal(parseCsv(await readFile(await file.path(),'utf8')).length,206);
  await button('Cargar más movimientos').click();await page.getByText('Movimiento 99',{exact:true}).waitFor();
 });
}
