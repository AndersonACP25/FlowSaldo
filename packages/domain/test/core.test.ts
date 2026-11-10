import test from 'node:test';
import assert from 'node:assert/strict';
import {ledgerBalance,parseSignedAmount,parseAmount,summarize,filterMovements,demoMovements,parseDemoMail,upgradeCategories,selectedCategory,budgetStatus,nextMonthlyDate,prepareOccurrence,changeSince,previousMonth,movementsCsv,validateExportTable,movementExportHeaders,type RecurringTemplate} from '../src/index.ts';

test('CORE: monetary precision and input bounds',()=>{
 assert.equal(parseSignedAmount('-100.29'),-10029);assert.equal(parseSignedAmount('0.00'),0);assert.throws(()=>parseSignedAmount('-21474836.48'));assert.equal(parseSignedAmount('90071992547409.91',Number.MAX_SAFE_INTEGER),Number.MAX_SAFE_INTEGER);assert.throws(()=>parseSignedAmount('90071992547409.92',Number.MAX_SAFE_INTEGER));
 assert.equal(parseAmount('100.29'),10029);assert.equal(parseAmount('200,50'),20050);
 for(const value of ['-1','0','1.001','1,000.50','21474836.48'])assert.throws(()=>parseAmount(value));
});
test('CORE: totals isolate currencies/months and exclude own transfers',()=>{
 const rows=filterMovements(demoMovements,{month:'2026-10',currency:'DOP'});
 assert.deepEqual(summarize(rows,'DOP'),{incomeMinor:4500000,expenseMinor:245050,differenceMinor:4254950});
 assert.equal(summarize(demoMovements,'USD').expenseMinor,1299);
 // Payment transfers reduce source cash and debt equally; no new expense.
 assert.equal(ledgerBalance(100000,0,25000,0),75000);assert.equal(ledgerBalance(-50000,0,0,25000),-25000);assert.equal(ledgerBalance(0,10029,0,0),10029);assert.throws(()=>ledgerBalance(Number.MAX_SAFE_INTEGER,1,0,0));
 assert.equal(filterMovements(rows,{month:'2026-09',currency:'DOP'}).length,0);
});
test('CORE: only explicit valid synthetic messages become movements',()=>{
 assert.equal(parseDemoMail('FLOWSALDO-DEMO|EXPENSE|DOP|12.50|2026-10-21|Compra').status,'PARSED');
 for(const body of ['desconocido','FLOWSALDO-DEMO|EXPENSE|DOP|0.00|2026-10-21|Compra','FLOWSALDO-DEMO|INCOME|USD|10.00|2026-02-30|Ingreso'])assert.equal(parseDemoMail(body).status,'REVIEW');
});
test('CORE: category migration/archive preserves history and prevents new assignment',()=>{
 const data=upgradeCategories(demoMovements);const category=data.categories.find(c=>c.name==='Alimentación')!;
 const catalog=data.categories.map(c=>c.id===category.id?{...c,name:'Comida',normalizedName:'comida',archived:true}:c);
 const migrated=upgradeCategories(data.movements,catalog);
 assert.deepEqual(migrated.movements,data.movements);assert.equal(migrated.movements[1].category,'Alimentación');
 assert.throws(()=>selectedCategory(catalog,category.id,'Comida'));
 assert.equal(selectedCategory(catalog,category.id,'Comida',migrated.movements[1]).category,'Alimentación');
 assert.deepEqual(upgradeCategories(migrated.movements,catalog),migrated);
});
test('CORE: budget alerts respect exact 80/100 thresholds and excess',()=>{
 assert.equal(budgetStatus(7999,10000).state,'normal');assert.equal(budgetStatus(8000,10000).state,'warning');
 assert.equal(budgetStatus(9999,10000).state,'warning');assert.equal(budgetStatus(10000,10000).state,'exceeded');
 assert.equal(budgetStatus(12501,10000).excessMinor,2501);assert.equal(budgetStatus(0,10000).availableMinor,10000);
 assert.throws(()=>budgetStatus(0,0));
});
test('CORE: monthly recurrence keeps anchor through leap/short months and year boundaries',()=>{
 assert.equal(nextMonthlyDate('2027-01-31',31),'2027-02-28');assert.equal(nextMonthlyDate('2027-02-28',31),'2027-03-31');
 assert.equal(nextMonthlyDate('2028-01-31',31),'2028-02-29');assert.equal(nextMonthlyDate('2026-12-15',15),'2027-01-15');
 assert.throws(()=>nextMonthlyDate('2026-02-30',30));
});
test('CORE: recurrence requires due/active/unconfirmed occurrence before posting',()=>{
 const t:RecurringTemplate={id:'rent',version:0,description:'Alquiler',amountMinor:10000,currency:'DOP',type:'EXPENSE',category:'Servicios',categoryId:'services',startDate:'2026-01-31',nextDate:'2026-01-31',anchorDay:31,active:true};
 const prepared=prepareOccurrence(t,t.nextDate,'2026-02-01');assert.equal(prepared.nextDate,'2026-02-28');assert.equal(prepared.movement.amountMinor,10000);
 assert.throws(()=>prepareOccurrence(t,t.nextDate,'2026-01-30'));
 assert.throws(()=>prepareOccurrence({...t,active:false},t.nextDate,'2026-02-01'));
 assert.throws(()=>prepareOccurrence(t,t.nextDate,'2026-02-01',[{templateId:t.id,scheduledFor:t.nextDate,movementId:null}]));
 assert.throws(()=>prepareOccurrence({...t,nextDate:prepared.nextDate},t.nextDate,'2026-02-01'));
});
test('CORE: monthly comparison handles zero baselines and year rollover',()=>{
 assert.deepEqual(changeSince(10000,0),{previousMinor:0,deltaMinor:10000,percentage:null});
 assert.equal(changeSince(0,0).percentage,0);assert.equal(changeSince(8000,10000).percentage,-20);
 assert.equal(previousMonth('2027-01'),'2026-12');
});
test('CORE: CSV preserves values/columns and neutralizes spreadsheet formulas',()=>{
 const csv=movementsCsv([{...demoMovements[0],description:'=SUM(1,2)',category:'A "B"\nC'}]);
 assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('"A ""B""\nC"'));assert.ok(csv.includes('45000.00'));
 validateExportTable(movementExportHeaders,[[1,2,3,4,5,6]]);assert.throws(()=>validateExportTable(['Fecha','Monto'],[['a;b']]));
});
