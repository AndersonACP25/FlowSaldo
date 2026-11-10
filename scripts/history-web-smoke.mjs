/* global document */
import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { demoCategoryCatalog,movementsCsv } from '../packages/domain/src/index.ts';
import { parseCsv } from './export-guardian.mjs';

export async function checkHistoryUi(browser) {
 if(!process.env.EXPO_PUBLIC_API_URL){console.info('SKIP: API history UI requires EXPO_PUBLIC_API_URL during web export');return;}
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const month=new Date().toISOString().slice(0,7);
 const rows=Array.from({length:205},(_,i)=>({id:String(i),amountMinor:10000,currency:'DOP',type:'EXPENSE',description:'Movimiento '+i,category:'Servicios',occurredAt:month+'-01T12:00:00.000Z'}));
 const reviews=Array.from({length:105},(_,i)=>({id:String(i),externalId:'Correo '+i,status:'REVIEW',reason:'Revisión de prueba',createdAt:month+'-01T12:00:00.000Z'}));
 const catalog=demoCategoryCatalog([]);let failSummary=false;
 await page.route(process.env.EXPO_PUBLIC_API_URL+'/**',async route=>{
  const url=new URL(route.request().url());let data;
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type'}});return;}
  if(url.pathname==='/categories'){data=catalog;}else if(url.pathname==='/summary'){
   if(failSummary){await route.fulfill({status:500,json:{error:'Prueba sin resumen'},headers:{'Access-Control-Allow-Origin':'*'}});return;}
   data={categoryTotals:[],total:205,incomeMinor:0,expenseMinor:2050000,differenceMinor:-2050000,categories:[{category:'Servicios',amountMinor:2050000}],days:Array.from({length:7},(_,i)=>({day:month+'-'+String(i+1).padStart(2,'0'),incomeMinor:0,expenseMinor:0,netMinor:0}))};
  }else if(url.pathname==='/movements/export'){
   await route.fulfill({contentType:'text/csv',body:movementsCsv(rows),headers:{'Access-Control-Allow-Origin':'*'}});return;
  }else if(url.pathname==='/movements'){
   const offset=Number(url.searchParams.get('cursor')??0);const selected=url.searchParams.has('search')?[rows[204]]:rows;
   data={items:selected.slice(offset,offset+50),total:selected.length,nextCursor:offset+50<selected.length?String(offset+50):null};
  }else if(url.pathname==='/imports'){
   const offset=Number(url.searchParams.get('cursor')??0);const selected=url.searchParams.get('status')==='DISMISSED'?[]:reviews;
   data={items:selected.slice(offset,offset+50),total:selected.length,pendingTotal:105,nextCursor:offset+50<selected.length?String(offset+50):null};
  }else throw new Error('Unexpected path '+url.pathname);
  await route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
 });
 try{
  await page.goto('http://127.0.0.1:8082',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Explorar demostración',exact:true}).click();
  await page.getByRole('button',{name:'Conexiones',exact:true}).click();
  await page.getByLabel('Token de desarrollo',{exact:true}).fill('synthetic-token-for-ui-test-only');
  await page.getByRole('button',{name:'Conectar API',exact:true}).click();
  await page.getByText('DOP 20,500.00',{exact:true}).first().waitFor();
  await page.getByText('105 correos necesitan tu criterio',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Movimientos',exact:true}).click();
  await page.getByText('205 movimientos',{exact:true}).waitFor();
  assert.equal(await page.getByText('Movimiento 50',{exact:true}).count(),0);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
  const file=await download;assert.equal(parseCsv(await readFile(await file.path(),'utf8')).length,206,'Export includes unloaded pages');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Cargar más movimientos',exact:true}).click();
  await page.getByText('Movimiento 204',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Cargar más movimientos',exact:true}).count(),0);
  await page.getByLabel('Buscar descripción o categoría',{exact:true}).fill('204');
  await page.getByText('1 movimiento',{exact:true}).waitFor();
  assert.equal(await page.getByText('Movimiento 0',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Por revisar',exact:true}).click();
  await page.getByText('105 movimientos por confirmar',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cargar más revisiones',exact:true}).click();
  await page.getByText('Correo 99',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Descartados',exact:true}).click();
  await page.getByText('Sin resultados',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Revisar y confirmar',exact:true}).count(),0);
  await page.getByRole('button',{name:'Limpiar filtros de revisiones',exact:true}).click();
  await page.getByText('105 movimientos por confirmar',{exact:true}).waitFor();
  await page.getByLabel('Recibido desde (AAAA-MM-DD)',{exact:true}).fill(month+'-01');
  await page.getByLabel('Recibido hasta (AAAA-MM-DD)',{exact:true}).fill(month+'-28');
  assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('div')).every(e=>e.scrollWidth<=e.clientWidth+2)),'Review filters fit mobile');
  await page.screenshot({path:'/tmp/flowsaldo-history-mobile.png'});
  // A failed summary must not present a false zero balance.
  failSummary=true;await page.getByRole('button',{name:'Panel',exact:true}).click();
  await page.getByRole('button',{name:'‹ Mes anterior',exact:true}).click();
  await page.getByText('No se pudo cargar el resumen mensual.',{exact:true}).waitFor();
  assert.equal(await page.getByText('Diferencia registrada · '+month,{exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.info('PASS: API UI complete totals, 205-row CSV before loading pages, pagination, filter reset, review states/dates, error state and 390px layout');
 }finally{await context.close();}
}
