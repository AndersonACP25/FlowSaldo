import assert from 'node:assert/strict';
import { dominicanDateTime } from '../packages/domain/src/index.ts';
import { loginAsTestAccount } from './test-account-flow.mjs';
import { runCoreWebScenario } from './web-core-scenario.mjs';

export async function checkRecurringReviewFlow(browser, today) {
  const legacy = {
    movements: [],
    budgets: {},
    reviews: [
      {
        id: 'review-core',
        externalId: 'Aviso CORE',
        status: 'REVIEW',
        reason: 'Revisar importe',
        body: 'Aviso sintético',
        suggestion: {
          id: 'suggestion',
          description: 'Compra revisada CORE',
          amountMinor: 1250,
          currency: 'DOP',
          type: 'EXPENSE',
          category: 'Servicios',
          occurredAt: today + 'T12:00:00.000Z',
        },
      },
    ],
  };
  await runCoreWebScenario(
    browser,
    'settle a recurring expense in parts → confirm review → open generated movement',
    async (page, button, stored) => {
      await page.goto('http://127.0.0.1:8082', { waitUntil: 'networkidle' });
      await loginAsTestAccount(page);
      await button('Movimientos').click();
      await button('Nueva plantilla mensual').click();
      await page.getByRole('heading', { name: 'Nueva plantilla mensual', exact: true }).waitFor();
      assert.equal(
        await page.getByLabel('Buscar descripción o categoría', { exact: true }).count(),
        0,
      );
      const day = dominicanDateTime(new Date()).slice(0, 10);
      await page.getByLabel('Fecha y hora de inicio', { exact: true }).fill(day + 'T00:00');
      await page.getByLabel('Descripción', { exact: true }).fill('Alquiler CORE');
      await page.getByLabel('Monto (sin separadores de miles)', { exact: true }).fill('12000');
      await button('Categoría: Servicios').click();
      await button('Guardar plantilla mensual').click();
      await page.getByText('Plantilla mensual guardada.', { exact: true }).waitFor();
      assert.equal((await stored()).movements.length, 0);
      await button('Inicio').click();
      await button('Abrir menú').click();
      await button('Disponible hasta el próximo cobro').click();
      await page.getByLabel('Saldo disponible hoy', { exact: true }).fill('20000');
      const payday = dominicanDateTime(new Date(Date.now() + 86_400_000));
      await page.getByLabel('Fecha y hora del próximo cobro', { exact: true }).fill(payday);
      await page.getByText('DOP 8,000.00', { exact: true }).waitFor();
      await page.getByLabel('Gasto simulado', { exact: true }).fill('3000');
      await page.getByText('Después del gasto: DOP 5,000.00', { exact: true }).waitFor();
      await button('Guardar proyección').click();
      await page.getByText('Proyección guardada.', { exact: true }).waitFor();
      assert.equal((await stored()).movements.length, 0);
      await button('EUR').click();
      assert.equal(await page.getByLabel('Saldo disponible hoy', { exact: true }).inputValue(), '');
      await button('Movimientos').click();
      await button('Registrar pendiente Alquiler CORE').click();
      await page.getByRole('heading', { name: 'Pagos y cobros pendientes', exact: true }).waitFor();
      await page.getByLabel('Monto del abono', { exact: true }).fill('4000');
      await button('Registrar abono').click();
      await page.getByText('Abono registrado.', { exact: true }).waitFor();
      const originalSettlement = (await stored()).pendingItems.demo[0].settlements[0];
      await button('Editar abono manual').click();
      const editedAmount = page.getByLabel('Nuevo monto del abono', { exact: true });
      assert.equal(await editedAmount.inputValue(), '4000');
      await editedAmount.fill('12001');
      await button('Guardar cambios del abono').click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'El abono excede el monto pendiente.' })
        .waitFor();
      assert.deepEqual((await stored()).pendingItems.demo[0].settlements, [originalSettlement]);
      await editedAmount.fill('5000');
      await button('Guardar cambios del abono').click();
      await page.getByText('Abono actualizado.', { exact: true }).waitFor();
      assert.deepEqual((await stored()).pendingItems.demo[0].settlements, [
        { ...originalSettlement, amountMinor: 500000 },
      ]);
      assert.equal((await stored()).movements.length, 0);
      await button('Inicio').click();
      await button('Abrir menú').click();
      await button('Cierre mensual').click();
      await button('Elegir período').click();
      await page.getByLabel('Fecha exacta (AAAA-MM-DD)', { exact: true }).fill(day);
      await button('Aplicar fecha').click();
      await page.getByText('Por pagar · DOP 7,000.00', { exact: true }).waitFor();
      const incomeBounds = await page.getByText(/^Ingresos · DOP /).boundingBox();
      const expenseBounds = await page.getByText(/^Gastos · DOP /).boundingBox();
      assert.ok(
        incomeBounds && expenseBounds && expenseBounds.y >= incomeBounds.y + incomeBounds.height,
      );
      await button('Revisar pendiente Alquiler CORE').click();
      await page.getByRole('heading', { name: 'Pagos y cobros pendientes', exact: true }).waitFor();
      await button('Volver').click();
      await button('Guardar cierre mensual').click();
      await page.getByText('Cierre mensual guardado.', { exact: true }).waitFor();
      assert.equal((await stored()).monthlyClosings.demo[0].toPayMinor, 700_000);
      await button('Volver').click();
      await button('Abrir menú').click();
      await button('Disponible hasta el próximo cobro').click();
      await page.getByText('DOP 13,000.00', { exact: true }).waitFor();
      await button('Movimientos').click();
      await button('+ Nuevo movimiento').click();
      await page.getByLabel('Descripción', { exact: true }).fill('Abono alquiler CORE');
      await page.getByLabel('Monto (sin separadores de miles)', { exact: true }).fill('7000');
      await button('Guardar movimiento').click();
      await page.getByText('Movimiento guardado.', { exact: true }).waitFor();
      await button('Vincular a pendiente: Abono alquiler CORE').click();
      await button('Vincular a Alquiler CORE').click();
      await page.getByText('Movimiento vinculado.', { exact: true }).waitFor();
      await button('Ver todos los pendientes').click();
      await button('Cerrar vencimiento').click();
      await page.getByText('Vencimiento cerrado.', { exact: true }).waitFor();
      assert.equal((await stored()).movements.length, 1);
      assert.equal((await stored()).receipts.length, 1);
      assert.equal((await stored()).receipts[0].movementId, null);
      await page.reload({ waitUntil: 'networkidle' });
      await loginAsTestAccount(page);
      await button('Abrir menú').click();
      await button('Cierre mensual').click();
      await button('Elegir período').click();
      await page.getByLabel('Fecha exacta (AAAA-MM-DD)', { exact: true }).fill(day);
      await button('Aplicar fecha').click();
      await page.getByText('Por pagar · DOP 0.00', { exact: true }).waitFor();
      await button('Cierre guardado').click();
      await page.getByText('Por pagar · DOP 7,000.00', { exact: true }).waitFor();
      await button('Volver').click();
      await button('Abrir menú').click();
      await button('Disponible hasta el próximo cobro').click();
      await page.getByText('DOP 20,000.00', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Gasto simulado', { exact: true }).inputValue(), '');
      await button('Movimientos').click();
      assert.ok(await button('Registrar vencimiento Alquiler CORE').isDisabled());
      await button('Por revisar').click();
      await page.getByLabel('Recibido desde', { exact: true }).fill('2026-01-01T09:45');
      await page.getByText('Sin resultados', { exact: true }).waitFor();
      await button('Limpiar filtros de revisiones').click();
      await button('Revisar y confirmar').click();
      await button('Guardar movimiento').click();
      await page
        .getByText('Revisión confirmada. Movimiento registrado.', { exact: true })
        .waitFor();
      await button('Confirmados').click();
      assert.equal(await button('Confirmados').getAttribute('aria-pressed'), 'true');
      await button('Ver movimiento generado').click();
      await page.getByText('Movimiento generado', { exact: true }).waitFor();
      await page.getByText(/Referencia: reviewed-review-core/).waitFor();
      assert.equal((await stored()).movements.length, 2);
    },
    legacy,
  );
}
