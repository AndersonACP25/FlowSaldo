import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, validDate, filterMovements, categoryExpenses, movementsCsv, demoMovements } from '../src/index.ts';
test('manual amounts preserve cents and accept decimal comma', () => {
 assert.equal(parseAmount('0.29'),29); assert.equal(parseAmount('1250,5'),125050);
 for (const s of ['0','-1','1.234','1,000.00','Infinity','21474836.48','']) assert.throws(()=>parseAmount(s));
});
test('date validation rejects normalized invalid dates', () => { assert.ok(validDate('2024-02-29')); assert.ok(!validDate('2026-02-29')); assert.ok(!validDate('2026-13-01')); });
test('month, currency, type and category search compose', () => {
 assert.equal(filterMovements(demoMovements, {currency:'DOP',month:'2026-10',type:'EXPENSE',search:'alimentación'}).length,1);
 assert.equal(filterMovements(demoMovements, {currency:'DOP',month:'2026-09'}).length,0);
 assert.equal(filterMovements(demoMovements, {currency:'USD',month:'2026-10'}).length,1);
});
test('category expenses exclude income and own transfers', () => {
 assert.deepEqual(categoryExpenses(filterMovements(demoMovements,{currency:'DOP',month:'2026-10'})),[{category:'Alimentación',amountMinor:245050}]);
});
test('CSV escapes quotes/newlines and neutralizes formulas', () => {
 const csv=movementsCsv([{...demoMovements[0],description:'=SUM(1,2)',category:'A "B"\nC'}]);
 assert.ok(csv.includes('"\'=SUM(1,2)"')); assert.ok(csv.includes('"A ""B""\nC"')); assert.ok(csv.includes('45000.00'));
});
