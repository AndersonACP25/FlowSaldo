import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDemoMail, summarize, demoMovements } from '../src/index.ts';
test('extracts minor units without floating point rounding', () => {
 const result = parseDemoMail('FLOWSALDO-DEMO|EXPENSE|DOP|2450.50|2026-10-21|Supermercado');
 assert.equal(result.status, 'PARSED');
 if (result.status === 'PARSED') assert.equal(result.movement.amountMinor, 245050);
});
for (const input of ['correo desconocido', 'FLOWSALDO-DEMO|EXPENSE|DOP|0.00|2026-10-21|Compra', 'FLOWSALDO-DEMO|INCOME|USD|10.00|2026-02-30|Ingreso', 'FLOWSALDO-DEMO|EXPENSE|DOP|9999999999999999999.00|2026-10-21|Compra', 'FLOWSALDO-DEMO|EXPENSE|DOP|1.001|2026-10-21|Compra']) {
 test('requires review: ' + input, () => assert.equal(parseDemoMail(input).status, 'REVIEW'));
}
test('separates currencies and excludes own transfers', () => {
 assert.deepEqual(summarize(demoMovements, 'DOP'), { incomeMinor: 4500000, expenseMinor: 245050, differenceMinor: 4254950 });
 assert.equal(summarize(demoMovements, 'USD').expenseMinor, 1299);
});
