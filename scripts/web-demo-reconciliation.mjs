import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCsv } from './export-guardian.mjs';

export async function checkDemoReconciliation({ page, button, stored, original, refund }) {
  await button('Inicio').click();
  await button('Volver a hoy').click();
  await button('Configuración').click();
  await button('Cuentas y saldos').click();
  await button('Nueva cuenta').click();
  await page.getByLabel('Nombre de la cuenta', { exact: true }).fill('Efectivo CORE');
  await button('Efectivo').click();
  await button('EUR').click();
  await page.getByLabel('Saldo inicial', { exact: true }).fill('1000');
  await button('Guardar cuenta').click();
  await page.getByText('Saldo · EUR 1,000.00', { exact: true }).waitFor();
  await button('Nueva cuenta').click();
  await page.getByLabel('Nombre de la cuenta', { exact: true }).fill('Tarjeta CORE');
  await button('Tarjeta de crédito').click();
  await button('EUR').click();
  await page.getByLabel('Deuda inicial', { exact: true }).fill('25');
  await button('Guardar cuenta').click();
  await page.getByText('Deuda · EUR 25.00', { exact: true }).waitFor();

  await button('Movimientos').click();
  await button('Editar Compra CORE').click();
  await button('Cuenta: Efectivo CORE').click();
  await button('Guardar movimiento').click();
  await page.getByText('Movimiento guardado.', { exact: true }).waitFor();
  await button('Editar COMPRA-CORE factura 2').click();
  await button('Cuenta: Tarjeta CORE').click();
  await button('Guardar movimiento').click();
  await page.getByText('Movimiento guardado.', { exact: true }).waitFor();
  const assigned = await stored();
  const assignedExpense = assigned.movements.find((movement) => movement.id === original.id);
  const assignedRefund = assigned.movements.find((movement) => movement.id === refund.id);
  assert.equal(assignedRefund.accountId, assignedExpense.accountId);
  assert.equal(
    assigned.accounts.find((account) => account.id === assignedExpense.accountId).name,
    'Efectivo CORE',
  );
  await button('Filtrar cuenta: Efectivo CORE').click();
  await page.getByText('2 movimientos', { exact: true }).waitFor();
  assert.equal(await button('Editar COMPRA-CORE factura 2').count(), 0);

  await button('Configuración').click();
  await button('Cuentas y saldos').click();
  await page.getByText('Saldo · EUR 948.71', { exact: true }).waitFor();
  await page.getByText('Deuda · EUR 45.51', { exact: true }).waitFor();
  await button('Nueva cuenta').click();
  await page.getByLabel('Nombre de la cuenta', { exact: true }).fill('Banco CORE');
  await button('Guardar cuenta').click();
  await page.getByText('Saldo · EUR 0.00', { exact: true }).waitFor();

  await button('Movimientos').click();
  await button('+ Nuevo movimiento').click();
  await button('Transferencia').first().click();
  await page.getByLabel('Descripción', { exact: true }).fill('Depositar efectivo CORE');
  const transferAmount = page.getByLabel('Monto (sin separadores de miles)', { exact: true });
  await transferAmount.fill('100');
  await button('Cuenta: Efectivo CORE').click();
  await button('Guardar movimiento').click();
  await page.getByRole('alert').filter({ hasText: 'Selecciona otra cuenta de destino.' }).waitFor();
  await button('Destino: Banco CORE').click();
  await button('Guardar movimiento').click();
  await page.getByText('Movimiento guardado.', { exact: true }).waitFor();

  await button('+ Nuevo movimiento').click();
  await button('Transferencia').first().click();
  await page.getByLabel('Descripción', { exact: true }).fill('Abono CORE');
  await transferAmount.fill('10');
  await button('Cuenta: Banco CORE').click();
  await button('Destino: Tarjeta CORE').click();
  await button('Guardar pago de tarjeta').click();
  await page.getByText('Movimiento guardado.', { exact: true }).waitFor();
  await button('Filtrar cuenta: Tarjeta CORE').click();
  await page.getByText('2 movimientos', { exact: true }).waitFor();
  await page.getByText(/· Pago de tarjeta$/).waitFor();
  assert.equal(await button('Vincular a meta: Abono CORE').count(), 0);
  await button('Editar Abono CORE').click();
  await transferAmount.fill('20');
  await button('Guardar pago de tarjeta').click();
  await page.getByText('Movimiento guardado.', { exact: true }).waitFor();
  const afterPayment = await stored();
  const cardPayment = afterPayment.movements.filter(
    (movement) => movement.description === 'Abono CORE',
  );
  assert.equal(cardPayment.length, 1);
  assert.equal(cardPayment[0].type, 'TRANSFER');
  assert.equal(cardPayment[0].amountMinor, 2000);
  assert.equal(
    cardPayment[0].targetAccountId,
    afterPayment.accounts.find((account) => account.name === 'Tarjeta CORE').id,
  );

  await button('Configuración').click();
  await button('Cuentas y saldos').click();
  await page.getByText('Saldo · EUR 848.71', { exact: true }).waitFor();
  await page.getByText('Saldo · EUR 80.00', { exact: true }).waitFor();
  await page.getByText('Deuda · EUR 25.51', { exact: true }).waitFor();
  await button('Conciliar cuenta Banco CORE').click();
  await page
    .getByLabel('Fecha y hora de corte', { exact: true })
    .fill(original.occurredAt.slice(0, 10) + 'T19:00');
  const statement = page.getByLabel('Saldo del estado de cuenta', { exact: true });
  await statement.fill('80');
  await button('Comparar saldos').click();
  await page.getByText('Los saldos coinciden.', { exact: true }).waitFor();
  assert.equal(await button('Confirmar ajuste').count(), 0);
  await statement.fill('84.25');
  await button('Comparar saldos').click();
  await page.getByText('Diferencia · EUR 4.25', { exact: true }).waitFor();
  assert.ok(!(await stored()).movements.some((movement) => movement.balanceAdjustment));
  await button('Confirmar ajuste').click();
  await page.getByText('Ajuste registrado.', { exact: true }).waitFor();
  await page.getByText('Saldo · EUR 84.25', { exact: true }).waitFor();
  const adjustments = (await stored()).movements.filter((movement) => movement.balanceAdjustment);
  assert.equal(adjustments.length, 1);
  assert.deepEqual(adjustments[0].balanceAdjustment, {
    expectedMinor: 8000,
    statementMinor: 8425,
  });
  await button('Cerrar conciliación').click();
  await button('Archivar cuenta Efectivo CORE').click();
  await button('Reactivar cuenta Efectivo CORE').waitFor();
  await page.getByText('Saldo · EUR 848.71', { exact: true }).waitFor();
  await button('Movimientos').click();
  await button('Filtrar cuenta: Banco CORE').click();
  await page.getByText('Ajuste de conciliación · Banco CORE', { exact: true }).waitFor();
  const adjustmentDownload = page.waitForEvent('download');
  await button('Exportar CSV').click();
  const adjustmentsCsv = parseCsv(await readFile(await (await adjustmentDownload).path(), 'utf8'));
  assert.deepEqual(adjustmentsCsv.find((row) => row[1] === 'ADJUSTMENT_IN')?.slice(2, 4), [
    'EUR',
    '4.25',
  ]);
}
