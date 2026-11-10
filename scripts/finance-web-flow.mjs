import {URL} from 'node:url';
import assert from 'node:assert/strict';
import {demoCategoryCatalog} from '../packages/domain/src/index.ts';
export async function checkFinanceFlow(browser){
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(10000);
 const accounts=[];const movements=[];let budget={version:0,limitMinor:null,categoryLimits:[]};let reconciled=false;
 const today=new Date().toISOString().slice(0,10);const month=today.slice(0,7);const button=name=>page.getByRole('button',{name,exact:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(process.env.EXPO_PUBLIC_API_URL+'/**',async route=>{
  const url=new URL(route.request().url());const method=route.request().method();const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type'};
  if(method==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  const body=method==='POST'?route.request().postDataJSON():null;let data;let status=200;
  if(url.pathname==='/accounts'&&method==='POST'){const a={...body,id:'account-'+accounts.length,archived:false,revision:0,reconciledThrough:null,balanceMinor:body.openingMinor,debtMinor:Math.max(0,-body.openingMinor),availableCreditMinor:null};accounts.push(a);data=a;status=201;}
  else if(url.pathname==='/accounts')data=accounts;
  else if(url.pathname==='/movements'&&method==='POST'){assert.equal(body.type,'TRANSFER');assert.equal(body.amountMinor,25029);assert.equal(body.accountId,accounts[0].id);assert.equal(body.targetAccountId,accounts[1].id);assert.ok(body.requestKey);const m={...body,id:'payment-core'};movements.push(m);accounts[0].balanceMinor-=body.amountMinor;accounts[1].balanceMinor+=body.amountMinor;accounts[1].debtMinor=-accounts[1].balanceMinor;accounts.forEach(a=>a.revision++);data=m;status=201;}
  else if(url.pathname==='/accounts/account-0/reconciliation/preview'){assert.equal(body.statementMinor,74971);data={accountId:accounts[0].id,asOf:body.asOf,statementMinor:body.statementMinor,expectedMinor:accounts[0].balanceMinor,differenceMinor:body.statementMinor-accounts[0].balanceMinor,expectedRevision:accounts[0].revision};}
  else if(url.pathname==='/accounts/account-0/reconciliation'){assert.equal(body.expectedRevision,accounts[0].revision);accounts[0].reconciledThrough=body.asOf;accounts[0].revision++;reconciled=true;data={id:'reconcile-core'};status=201;}
  else if(url.pathname==='/budgets'){if(method==='POST'){assert.equal(body.expectedVersion,budget.version);budget={version:budget.version+1,limitMinor:body.limitMinor,categoryLimits:body.categoryLimits};}data=budget;}
  else if(url.pathname==='/categories')data=demoCategoryCatalog([]);
  else if(url.pathname==='/recurring')data=[];
  else if(url.pathname==='/imports')data={items:[],total:0,nextCursor:null,pendingTotal:0};
  else if(url.pathname==='/imports/stats')data={counts:{PENDING:0,PROCESSING:0,FAILED:0,REVIEW:0,PARSED:0,DISMISSED:0},scheduledRetries:0,expiredLeases:0,nextRetryAt:null,lastProcessedAt:null};
  else if(url.pathname==='/movements')data={items:movements,total:movements.length,nextCursor:null};
  else if(url.pathname==='/summary')data={incomeMinor:0,expenseMinor:0,differenceMinor:0,total:movements.length,categories:[],categoryTotals:[],days:Array.from({length:7},(_,i)=>({day:month+'-0'+(i+1),incomeMinor:0,expenseMinor:0,netMinor:0}))};
  else throw new Error('Unexpected finance path '+url.pathname);
  await route.fulfill({headers,status,json:data});
 });
 async function connect(){await button('Explorar demostración').click();await button('Conexiones').click();await page.getByLabel('Token de desarrollo',{exact:true}).fill('synthetic-finance-token-123456789');await button('Conectar API').click();await page.getByText('Tu presupuesto mensual',{exact:true}).waitFor();}
 try{
  await page.goto('http://127.0.0.1:8082',{waitUntil:'networkidle'});await connect();await button('Configuración').click();await button('Administrar cuentas y conciliación').click();await page.getByText('Crear cuenta',{exact:true}).waitFor();
  await page.getByLabel('Nombre de la nueva cuenta',{exact:true}).fill('Banco CORE');await page.getByLabel('Saldo inicial de la cuenta',{exact:true}).fill('1000');await button('Crear cuenta financiera').click();await page.getByText('Cuenta financiera creada.',{exact:true}).waitFor();
  await page.getByLabel('Nombre de la nueva cuenta',{exact:true}).fill('Tarjeta CORE');await button('Tarjeta de crédito').click();await page.getByLabel('Saldo inicial de la cuenta',{exact:true}).fill('-500');await button('Crear cuenta financiera').click();await page.getByText('Tarjeta CORE',{exact:true}).waitFor();
  await button('+ Nuevo movimiento').click();await page.getByLabel('Descripción',{exact:true}).fill('Pago tarjeta CORE');await page.getByLabel('Monto (sin separadores de miles)',{exact:true}).fill('250.29');await button('Transferencia').first().click();await button('Cuenta: Banco CORE').click();await button('Destino: Tarjeta CORE').click();await button('Guardar movimiento').click();await page.getByText('Movimiento guardado.',{exact:true}).waitFor();assert.equal(movements.length,1);assert.equal(accounts[1].debtMinor,24971);
  await button('Configuración').click();await button('Gestionar Banco CORE').click();await page.getByLabel('Fecha de conciliación (AAAA-MM-DD)',{exact:true}).fill(today);await page.getByLabel('Saldo del estado de cuenta',{exact:true}).fill('749.71');await button('Comparar saldos').click();await button('Confirmar conciliación y proteger período').click();await page.getByText('Conciliación confirmada. El período quedó protegido.',{exact:true}).waitFor();assert.equal(reconciled,true);
  await button('Panel').click();await page.getByLabel('Nuevo límite mensual',{exact:true}).fill('900');await button('Guardar presupuesto').click();await page.getByText('Presupuesto guardado.',{exact:true}).waitFor();assert.equal(budget.limitMinor,90000);
  await page.reload({waitUntil:'networkidle'});await connect();await page.getByText('0% utilizado · DOP 900.00',{exact:true}).waitFor();assert.equal(budget.version,1);assert.deepEqual(errors,[]);
  console.info('PASS CORE FINANCE UI: create cash/debt accounts → pay card once → compare/confirm reconciliation → persist server budget across reload');
 }finally{await context.close();}
}
