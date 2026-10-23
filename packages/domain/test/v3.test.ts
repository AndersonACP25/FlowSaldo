import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyCashFlow, demoMovements } from '../src/index.ts';
test('weekly flow spans seven dates across month boundary',()=>{
 const days=dailyCashFlow([], '2026-11-02'); assert.equal(days.length,7);assert.equal(days[0].day,'2026-10-27');assert.equal(days[6].day,'2026-11-02');assert.ok(days.every(d=>d.netMinor===0));
});
test('weekly flow aggregates actual entries and excludes transfers',()=>{
 const days=dailyCashFlow(demoMovements.filter(m=>m.currency==='DOP'),'2026-10-22');
 assert.equal(days[4].incomeMinor,4500000);assert.equal(days[5].expenseMinor,245050);assert.equal(days[6].netMinor,0);
 assert.throws(()=>dailyCashFlow([], '2026-02-30'));
});
