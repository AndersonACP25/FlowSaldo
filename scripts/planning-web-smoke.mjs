/* global localStorage,document */
import assert from 'node:assert/strict';
import {demoMovements} from '../packages/domain/src/index.ts';
export async function checkPlanningUi(browser) {
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
 const month=new Date().toISOString().slice(0,7);
 const legacy={movements:demoMovements.map(m=>({...m,occurredAt:month+m.occurredAt.slice(7)})),budgets:{['demo:'+month+':DOP']:300000},reviews:[]};
 await context.addInitScript(data=>{if(!localStorage.getItem('flowsaldo.demo.v2'))localStorage.setItem('flowsaldo.demo.v2',JSON.stringify(data));},legacy);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const button=name=>page.getByRole('button',{name,exact:true});
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('flowsaldo.demo.v2')));
 try{
  await page.goto('http://127.0.0.1:8082',{waitUntil:'networkidle'});await button('Explorar demostración').click();
  await page.getByText('82% utilizado · DOP 3,000.00',{exact:true}).waitFor();
  await button('Presupuesto: Alimentación').click();await page.getByLabel('Límite por categoría',{exact:true}).fill('3000');await button('Guardar límite por categoría').click();
  await page.getByText('Presupuesto por categoría guardado.',{exact:true}).waitFor();
  const migrated=await stored();assert.ok(migrated.categories.length>=7);assert.equal(migrated.movements[1].category,'Alimentación');assert.ok(migrated.movements[1].categoryId);
  const foodId=migrated.movements[1].categoryId;assert.equal(migrated.categoryBudgets[`demo:${month}:DOP:${foodId}`],300000);
  await button('Mes siguiente ›').click();assert.equal(await button('Quitar límite de Alimentación').count(),0);
  await button('‹ Mes anterior').click();await button('Quitar límite de Alimentación').waitFor();
  await button('USD').click();assert.equal(await button('Quitar límite de Alimentación').count(),0);await button('DOP').click();
  await button('+ Nuevo movimiento').click();
  const today=new Date().toISOString().slice(0,10);assert.equal(await page.getByLabel('Fecha (AAAA-MM-DD)',{exact:true}).inputValue(),today);
  await button('Elegir fecha en calendario').click();await button(`Elegir ${month}-15`).click();assert.equal(await page.getByLabel('Fecha (AAAA-MM-DD)',{exact:true}).inputValue(),month+'-15');
  await page.getByLabel('Descripción',{exact:true}).fill('Compra rápida');await page.getByLabel('Monto (sin separadores de miles)',{exact:true}).fill('500');await button('Reciente: Alimentación').click();await button('Guardar movimiento').click();await page.getByText('Movimiento guardado.',{exact:true}).waitFor();
  assert.equal((await stored()).movements.length,5);
  await button('Duplicar Compra rápida').click();await page.getByText('Duplicar movimiento',{exact:true}).waitFor();assert.equal((await stored()).movements.length,5,'Duplicate is only a draft');await button('Cancelar').click();assert.equal((await stored()).movements.length,5);
  await button('Duplicar Compra rápida').click();await page.getByLabel('Monto (sin separadores de miles)',{exact:true}).fill('100');await button('Guardar movimiento').click();await page.getByText('Movimiento guardado.',{exact:true}).waitFor();assert.equal((await stored()).movements.length,6);
  await button('Panel').click();await page.getByText('Límite alcanzado o superado (100 %).',{exact:true}).first().waitFor();
  await button('Configuración').click();await page.getByLabel('Nombre de categoría',{exact:true}).fill('Hogar de prueba');await button('Crear categoría').click();await page.getByText('Categoría guardada.',{exact:true}).waitFor();
  await page.getByLabel('Nombre de categoría',{exact:true}).fill('  HOGAR DE PRUEBA  ');await button('Crear categoría').click();await page.getByText('Ya existe una categoría con ese nombre.',{exact:true}).waitFor();
  await button('Renombrar Alimentación').click();await page.getByLabel('Nuevo nombre de categoría',{exact:true}).fill('Comida');await button('Guardar nombre').click();await page.getByText('Comida · Activa',{exact:true}).waitFor();assert.equal((await stored()).movements.find(m=>m.id==='demo-2').category,'Alimentación');
  await button('Archivar Comida').click();await button('Confirmar archivo de categoría').click();await page.getByText('Comida · Archivada',{exact:true}).waitFor();
  await button('Movimientos').click();await button('Filtrar: Comida').click();await page.getByText('3 movimientos',{exact:true}).waitFor();
  await button('Duplicar Supermercado de ejemplo').click();await button('Guardar movimiento').click();await page.getByText('La categoría está archivada. Selecciona una activa.',{exact:true}).waitFor();assert.equal((await stored()).movements.length,6);await button('Cancelar').click();
  await button('Editar Supermercado de ejemplo').click();await page.getByLabel('Descripción',{exact:true}).fill('Supermercado conservado');await button('Guardar movimiento').click();await page.getByText('Movimiento guardado.',{exact:true}).waitFor();assert.equal((await stored()).movements.find(m=>m.id==='demo-2').categoryId,foodId);
  await page.reload({waitUntil:'networkidle'});await button('Explorar demostración').click();await button('Quitar límite de Comida').waitFor();assert.equal((await stored()).categoryBudgets[`demo:${month}:DOP:${foodId}`],300000);
  await button('+ Nuevo movimiento').click();assert.equal(await button('Categoría: Comida').count(),0);await button('Elegir fecha en calendario').click();
  assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('div')).every(e=>e.scrollWidth<=e.clientWidth+2)),'Calendar and catalog fit at 390px');
  assert.deepEqual(errors,[]);console.info('PASS: legacy demo upgrade, category CRUD/archive, budget isolation/thresholds/persistence, quick date/calendar/recent, duplicate draft/save and archived edits at 390px');
 }finally{await context.close();}
}
