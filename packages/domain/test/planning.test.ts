import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetStatus,categoryKey,demoMovements,filterMovements,movementDate,selectedCategory,upgradeCategories} from '../src/index.ts';

test('legacy demo upgrade preserves labels and amounts, and is idempotent after rename/archive',()=>{
 const before=structuredClone(demoMovements);const upgraded=upgradeCategories(before);
 assert.deepEqual(before,demoMovements);
 assert.deepEqual(upgraded.movements.map(({categoryId,...m})=>{assert.ok(categoryId);return m;}),before);
 const category=upgraded.categories.find(c=>c.name==='Alimentación')!;
 const renamed=upgraded.categories.map(c=>c.id===category.id?{...c,name:'Comida',normalizedName:'comida',archived:true}:c);
 const repeated=upgradeCategories(upgraded.movements,renamed);
 assert.equal(repeated.movements[1].category,'Alimentación');assert.equal(repeated.movements[1].categoryId,category.id);
 assert.equal(repeated.categories.find(c=>c.id===category.id)?.archived,true);
 assert.deepEqual(upgradeCategories(repeated.movements,repeated.categories),repeated);
 assert.throws(()=>selectedCategory(renamed,category.id,'Comida'),/archivada/);
 assert.equal(selectedCategory(renamed,category.id,'Comida',repeated.movements[1]).category,'Alimentación');
 assert.equal(filterMovements(repeated.movements,{month:'2026-10',currency:'DOP',categoryId:category.id}).length,1);
});
test('category normalization prevents case/spacing duplicates and rejects corrupted catalog',()=>{
 assert.equal(categoryKey('  Hogar   y Salud  '),'hogar y salud');
 assert.throws(()=>categoryKey('   '));assert.throws(()=>categoryKey('X'.repeat(61)));
 const data=upgradeCategories(demoMovements);
 assert.throws(()=>upgradeCategories(data.movements,[...data.categories,data.categories[0]]));
 assert.throws(()=>upgradeCategories([{...data.movements[0],categoryId:'missing'}],data.categories));
});
test('budget alerts use exact 80/100 thresholds, including rounding near a threshold',()=>{
 assert.equal(budgetStatus(7999,10000).state,'normal');
 assert.equal(budgetStatus(8000,10000).state,'warning');
 assert.equal(budgetStatus(9999,10000).state,'warning');
 assert.deepEqual(budgetStatus(10000,10000),{state:'exceeded',percentage:100,availableMinor:0,excessMinor:0});
 assert.equal(budgetStatus(12501,10000).excessMinor,2501);
 assert.throws(()=>budgetStatus(0,0));assert.throws(()=>budgetStatus(1.5,10));
 assert.equal(budgetStatus(0,10000).availableMinor,10000);
});
test('quick entry defaults to today in the selected month and its first day otherwise',()=>{
 assert.equal(movementDate('2026-11','2026-11-10'),'2026-11-10');
 assert.equal(movementDate('2026-10','2026-11-10'),'2026-10-01');
});
