/* global localStorage,sessionStorage */
import assert from 'node:assert/strict';
import {URL} from 'node:url';
import {demoCategoryCatalog} from '../packages/domain/src/index.ts';
export async function checkAccessFlow(browser){
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(10000);
 const owner={id:1,name:'Cuenta CORE',email:'owner@correo.test'};const token='fs_'+'a'.repeat(43);const nextToken='fs_'+'b'.repeat(43);
 const password='Synthetic-Passphrase-Initial-2026';const updated='Synthetic-Passphrase-Updated-2026';const setupToken='synthetic-registration-token-2026';let changed=false;let recovered=false;let loggedOut=false;const recoveredPassword='Synthetic-Recovered-Passphrase-2026';const recoveryCode='fr_'+'c'.repeat(32);
 const button=name=>page.getByRole('button',{name,exact:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(process.env.EXPO_PUBLIC_API_URL+'/**',async route=>{
  const url=new URL(route.request().url());const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({headers,status:204});return;}
  let data;
  if(url.pathname==='/auth/setup'){
   assert.equal(route.request().headers().authorization,'Bearer '+setupToken);
   assert.deepEqual(route.request().postDataJSON(),{name:owner.name,email:owner.email,password});
   await route.fulfill({headers,status:201,json:{owner}});return;
  }else if(url.pathname==='/auth/login'){
   const body=route.request().postDataJSON();if(body.password!==(changed?updated:recovered?recoveredPassword:password)){await route.fulfill({headers,status:401,json:{error:'Correo o contraseña incorrectos.'}});return;}
   data={token:changed?nextToken:token,owner,sessionId:changed?'session-b':'session-a',expiresAt:new Date(Date.now()+86400000).toISOString()};
  }else if(url.pathname==='/auth/recover'){const body=route.request().postDataJSON();assert.equal(body.code,recoveryCode);assert.equal(body.newPassword,recoveredPassword);recovered=true;await route.fulfill({headers,status:204});return;}else if(url.pathname==='/auth/recovery-codes'){data={codes:[recoveryCode],expiresAt:new Date(Date.now()+86400000).toISOString()};}
  else if(url.pathname==='/auth/data/retention/preview'){data={previewId:'synthetic-preview',cutoff:new Date().toISOString(),reviewBodies:1,failedBodies:0,hasMore:false,totalEligible:1,lastCleanup:null};}
  else if(url.pathname==='/auth/data/retention/apply'){const body=route.request().postDataJSON();assert.equal(body.previewId,'synthetic-preview');assert.equal(body.confirmation,'ELIMINAR CONTENIDO');assert.equal(body.currentPassword,password);data={reviewBodies:1,failedBodies:0};}
  else if(url.pathname==='/auth/me'&&route.request().method()==='PATCH'){
   assert.equal(route.request().headers().authorization,'Bearer '+token);
   const body=route.request().postDataJSON();assert.equal(body.currentPassword,password);
   owner.name=body.name;owner.email=body.email;data={owner};
  }
  else if(url.pathname==='/auth/password'){assert.equal(route.request().postDataJSON().newPassword,updated);changed=true;await route.fulfill({headers,status:204});return;}
  else if(url.pathname==='/auth/logout'){assert.equal(route.request().headers().authorization,'Bearer '+(changed?nextToken:token));loggedOut=true;await route.fulfill({headers,status:204});return;}
  else if(url.pathname==='/budgets')data={version:0,limitMinor:null,categoryLimits:[]};
   else if(url.pathname==='/accounts')data=[];
   else if(url.pathname==='/categories')data=demoCategoryCatalog([]);
  else if(url.pathname==='/recurring')data=[];
  else if(url.pathname==='/imports')data={items:[],total:0,nextCursor:null,pendingTotal:0};
  else if(url.pathname==='/imports/stats')data={counts:{PENDING:0,PROCESSING:0,FAILED:0,REVIEW:0,PARSED:0,DISMISSED:0},scheduledRetries:0,expiredLeases:0,nextRetryAt:null,lastProcessedAt:null};
  else if(url.pathname==='/movements')data={items:[],total:0,nextCursor:null};
  else if(url.pathname==='/summary')data={incomeMinor:0,expenseMinor:0,differenceMinor:0,total:0,categories:[],categoryTotals:[],days:Array.from({length:7},(_,i)=>({day:'2026-01-0'+(i+1),incomeMinor:0,expenseMinor:0,netMinor:0}))};
  else throw new Error('Unexpected access path '+url.pathname);
  await route.fulfill({headers,json:data});
 });
 try{
  await page.goto('http://127.0.0.1:8082',{waitUntil:'networkidle'});
  await button('Registrarse').click();
  await page.getByLabel('Nombre',{exact:true}).fill(owner.name);
  await page.getByLabel('Correo electrónico',{exact:true}).fill(owner.email);
  await page.getByLabel('Contraseña',{exact:true}).fill(password);
  const confirmation=page.getByLabel('Confirmar contraseña',{exact:true});
  await confirmation.fill(password);
  assert.equal(await confirmation.evaluate(input=>input.type),'password');
  await button('Mostrar: Confirmar contraseña').click();
  assert.equal(await confirmation.evaluate(input=>input.type),'text');
  assert.equal(await confirmation.inputValue(),password);
  await button('Ocultar: Confirmar contraseña').click();
  assert.equal(await confirmation.evaluate(input=>input.type),'password');
  await page.getByLabel('Token de configuración inicial',{exact:true}).fill(setupToken);
  await button('Crear cuenta personal').click();
  await page.getByText('Cuenta personal creada. Ahora inicia sesión.',{exact:true}).waitFor();
  await button('Ir a iniciar sesión').click();
  await page.getByLabel('Correo electrónico',{exact:true}).fill(owner.email);await page.getByLabel('Contraseña',{exact:true}).fill('Incorrect-Synthetic-Passphrase');await button('Entrar').click();await page.getByText('Correo o contraseña incorrectos.',{exact:true}).waitFor();
  await page.getByLabel('Contraseña',{exact:true}).fill(password);await button('Entrar').click();await page.getByRole('button',{name:'Ver presupuestos',exact:true}).waitFor();
  const persisted=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));assert.ok(!persisted.includes(token)&&!persisted.includes(password),'Browser credentials stay out of web storage');
  await button('Configuración').click();await page.getByText('Cuenta personal',{exact:true}).waitFor();
  await button('Editar perfil').click();
  await page.getByLabel('Nombre de la cuenta',{exact:true}).fill('Anderson Castillo');
  await page.getByLabel('Correo de la cuenta',{exact:true}).fill('nuevo@correo.test');
  await page.getByLabel('Contraseña actual para editar perfil',{exact:true}).fill(password);
  await button('Guardar perfil').click();await page.getByText('Perfil actualizado.',{exact:true}).waitFor();
  await page.getByText('Anderson Castillo · nuevo@correo.test',{exact:true}).waitFor();
  await button('Volver').click();await button('Configuración').getByText('AC',{exact:true}).waitFor();await button('Configuración').click();
  await page.getByLabel('Contraseña para gestionar códigos',{exact:true}).fill(password);await button('Generar códigos de recuperación').click();await page.getByText(recoveryCode,{exact:true}).waitFor();assert.ok(!(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).includes(recoveryCode));await button('Ocultar códigos').click();
  await button('Previsualizar limpieza').click();await page.getByText('Por revisar: 1 · Con error: 0',{exact:true}).waitFor();assert.equal(await button('Confirmar limpieza de contenido').isDisabled(),true);await page.getByLabel('Contraseña para confirmar limpieza',{exact:true}).fill(password);await page.getByLabel('Escribe ELIMINAR CONTENIDO',{exact:true}).fill('ELIMINAR CONTENIDO');await button('Confirmar limpieza de contenido').click();await page.getByText('Contenido eliminado: 1 por revisar y 0 con error. Movimientos conservados.',{exact:true}).waitFor();
  await button('Cerrar sesión').click();await page.getByText('Sesión cerrada.',{exact:true}).waitFor();
  await button('Recuperar cuenta con código').click();await page.getByLabel('Correo electrónico',{exact:true}).fill(owner.email);await page.getByLabel('Código de recuperación',{exact:true}).fill(recoveryCode);await page.getByLabel('Nueva contraseña de recuperación',{exact:true}).fill(recoveredPassword);await page.getByLabel('Confirmar contraseña',{exact:true}).fill(recoveredPassword);await button('Restablecer contraseña').click();await page.getByText('Contraseña restablecida. Inicia sesión con la nueva contraseña.',{exact:true}).waitFor();assert.equal(recovered,true);
  await page.getByLabel('Correo electrónico',{exact:true}).fill(owner.email);await page.getByLabel('Contraseña',{exact:true}).fill(recoveredPassword);await button('Entrar').click();await button('Configuración').click();
  await page.getByLabel('Contraseña actual',{exact:true}).fill(recoveredPassword);await page.getByLabel('Nueva contraseña',{exact:true}).fill(updated);await page.getByLabel('Confirmar nueva contraseña',{exact:true}).fill(updated);await button('Guardar nueva contraseña').click();await page.getByText('Tu sesión terminó. Inicia sesión nuevamente.',{exact:true}).waitFor();assert.equal(changed,true);
  await page.getByLabel('Correo electrónico',{exact:true}).fill(owner.email);await page.getByLabel('Contraseña',{exact:true}).fill(updated);await button('Entrar').click();await button('Configuración').click();await button('Cerrar sesión').click();await page.getByText('Sesión cerrada.',{exact:true}).waitFor();assert.equal(loggedOut,true);assert.equal(await page.getByLabel('Contraseña',{exact:true}).inputValue(),'');
  assert.deepEqual(errors,[]);console.info('PASS CORE ACCESS UI: rejected/accepted login, no web credential persistence, recovery codes stay out of storage, explicit cleanup, password change/recovery end session, login again and logout');
 }finally{await context.close();}
}
