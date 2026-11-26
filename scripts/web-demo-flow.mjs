import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { parseCsv } from './export-guardian.mjs';
import { loginAsTestAccount } from './test-account-flow.mjs';
import { checkDemoBackup } from './web-demo-backup.mjs';
import { checkDemoReconciliation } from './web-demo-reconciliation.mjs';
import { checkDemoPlanning } from './web-demo-planning.mjs';
import { runCoreWebScenario } from './web-core-scenario.mjs';

export async function checkDemoFlow(browser, apiUrl, month) {
  await runCoreWebScenario(
    browser,
    'register → persist → export filtered CSV',
    async (page, button, stored) => {
      let apiRequests = 0;
      await page.route(apiUrl + '/**', (route) => {
        apiRequests++;
        return route.abort();
      });
      await page.goto('http://127.0.0.1:8082', { waitUntil: 'networkidle' });
      for (const label of ['Usar cuenta de prueba', 'Registrarse', 'Recuperar cuenta con código']) {
        const option = await button(label).evaluate((el) => {
          const style = el.ownerDocument.defaultView.getComputedStyle(el);
          return {
            border: style.borderTopWidth,
            align: el.ownerDocument.defaultView.getComputedStyle(el.firstElementChild).textAlign,
          };
        });
        assert.deepEqual(option, { border: '0px', align: 'center' });
      }
      await button('Usar cuenta de prueba').click();
      await page.getByLabel('Contraseña', { exact: true }).fill('Contraseña incorrecta');
      await button('Entrar').click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Correo o contraseña incorrectos' })
        .waitFor();
      await button('Usar cuenta de prueba').click();
      await button('Entrar').click();
      await button('Configuración').click();
      await button('Preguntas frecuentes').click();
      await button('¿Cómo registro mis ingresos y gastos?').click();
      const faqAnswer = page.getByText(/Puedes dividir un gasto entre varias categorías/);
      await faqAnswer.waitFor();
      assert.equal(
        await faqAnswer.evaluate(
          (node) => node.ownerDocument.defaultView.getComputedStyle(node).textAlign,
        ),
        'left',
      );
      await button('Volver').click();
      await button('Preferencias').click();
      const backStyle = await button('Volver').evaluate((control) => {
        const style = control.ownerDocument.defaultView.getComputedStyle(control);
        return { radius: style.borderTopLeftRadius, border: style.borderTopWidth };
      });
      assert.deepEqual(backStyle, { radius: '12px', border: '1px' });
      await button('EUR').click();
      await button('Guardar preferencias').click();
      await page
        .getByText('Preferencias guardadas en este dispositivo.', { exact: true })
        .waitFor();
      await button('Volver').click();
      await button('Reglas por comercio').click();
      await button('Nueva regla por comercio').click();
      await page.getByLabel('Comercio o frase', { exact: true }).fill('Compra CORE');
      await button('Asignar Servicios').click();
      await button('Guardar regla').click();
      await page.getByText('Regla guardada.', { exact: true }).waitFor();
      await button('Volver').click();
      await button('Volver').click();
      await button('+ Nuevo movimiento').click();
      await page.getByLabel('Descripción', { exact: true }).fill('Compra CORE');
      await page.getByLabel('Monto (sin separadores de miles)', { exact: true }).fill('100.29');
      await button('Usar Servicios').click();
      await button('Guardar movimiento').click();
      await page.getByText('Movimiento guardado.', { exact: true }).waitFor();
      assert.equal(
        (await stored()).movements.find((item) => item.description === 'Compra CORE').category,
        'Servicios',
      );
      await button('Configuración').click();
      await button('Mis bancos').click();
      await button('Agregar bancos').click();
      await page.getByLabel('Buscar banco', { exact: true }).fill('BHD');
      await button('Agregar Banco BHD').click();
      await button('Quitar Banco BHD').waitFor();
      await button('Volver').click();
      await button('Apariencia').click();
      await button('Medianoche').click();
      await page.waitForFunction(
        () => globalThis.localStorage.getItem('flowsaldo.theme.v1') === 'midnight',
      );
      await button('Arena').click();
      await page.waitForFunction(
        () => globalThis.localStorage.getItem('flowsaldo.theme.v1') === 'sand',
      );
      await page.reload({ waitUntil: 'networkidle' });
      await loginAsTestAccount(page);
      await button('Conexiones').click();
      await page.getByText('Conexión pendiente', { exact: true }).waitFor();
      await button('Administrar mis bancos').click();
      await button('Quitar Banco BHD').waitFor();
      await button('Volver').click();
      await button('Acerca de la aplicación').click();
      const about = page.getByRole('heading', { name: 'Acerca de la aplicación', exact: true });
      await about.waitFor();
      assert.equal(
        await about.evaluate(
          (element) => element.ownerDocument.defaultView.getComputedStyle(element).color,
        ),
        'rgb(48, 34, 24)',
      );
      await page.getByText('Versión', { exact: true }).waitFor();
      await button('Volver').click();
      await button('Volver').click();
      await button('Movimientos').click();
      await button('+ Nuevo movimiento').click();
      await page.getByLabel('Descripción', { exact: true }).fill('COMPRA-CORE factura 2');
      await page.getByLabel('Monto (sin separadores de miles)', { exact: true }).fill('20.51');
      await button('Usar Servicios').waitFor();
      await button('Categoría: Transporte').click();
      await button('Guardar movimiento').click();
      await page.getByText('Movimiento guardado.', { exact: true }).waitFor();
      assert.equal(
        (await stored()).movements.find((item) => item.description === 'COMPRA-CORE factura 2')
          .category,
        'Transporte',
      );
      await page.getByLabel('Buscar descripción o categoría', { exact: true }).fill('Compra CORE');
      await page.getByText('1 movimiento', { exact: true }).waitFor();
      await button('Editar Compra CORE').click();
      await page.getByRole('heading', { name: 'Editar movimiento', exact: true }).waitFor();
      const saveMovementButton = button('Guardar movimiento');
      const cancelMovementButton = button('Cancelar');
      assert.equal(
        (await saveMovementButton.boundingBox()).width,
        (await cancelMovementButton.boundingBox()).width,
      );
      const background = (control) =>
        control.evaluate(
          (element) => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor,
        );
      assert.notEqual(await background(saveMovementButton), await background(cancelMovementButton));
      assert.equal(
        await page.getByLabel('Buscar descripción o categoría', { exact: true }).count(),
        0,
      );
      await page.getByLabel('Monto (sin separadores de miles)', { exact: true }).fill('99.00');
      await button('Configuración').click();
      await button('Preferencias').click();
      await button('Volver').click();
      await page.getByRole('heading', { name: 'Configuración', exact: true }).waitFor();
      await button('Volver').click();
      await page.getByRole('heading', { name: 'Movimientos', exact: true }).waitFor();
      assert.equal(
        await page.getByLabel('Buscar descripción o categoría', { exact: true }).inputValue(),
        'Compra CORE',
      );
      await button('Editar Compra CORE').click();
      const amount = page.getByLabel('Monto (sin separadores de miles)', { exact: true });
      assert.equal(await amount.inputValue(), '100.29');
      await amount.fill('101.29');
      await button('Dividir gasto').click();
      await button('Parte 1: Alimentación').click();
      await button('Parte 2: Transporte').click();
      await page.getByLabel('Importe de la parte 1', { exact: true }).fill('70.20');
      await page.getByLabel('Importe de la parte 2', { exact: true }).fill('31.00');
      await button('Guardar movimiento').click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Las partes deben sumar el importe total del gasto.' })
        .waitFor();
      await page.getByLabel('Importe de la parte 2', { exact: true }).fill('31.09');
      await button('Guardar movimiento').click();
      await page.getByText('Movimiento guardado.', { exact: true }).waitFor();
      await page.getByLabel('Buscar descripción o categoría', { exact: true }).fill('Compra CORE');
      await page.getByText('1 movimiento', { exact: true }).waitFor();
      const waiting = page.waitForEvent('download');
      await button('Exportar CSV').click();
      const file = await waiting;
      assert.equal(file.suggestedFilename(), `FlowSaldo-${month}.csv`);
      const rows = parseCsv(await readFile(await file.path(), 'utf8'));
      assert.equal(rows.length, 2);
      assert.equal(rows[1].at(-1), 'Gasto dividido');
      const original = (await stored()).movements.find(
        (item) => item.description === 'Compra CORE',
      );
      const refundAction = button('Registrar devolución de Compra CORE');
      assert.ok(await refundAction.locator('[aria-hidden="true"]').count());
      await refundAction.click();
      await page.getByLabel('Importe de la devolución', { exact: true }).fill('50.00');
      await page
        .getByLabel('Fecha y hora de la devolución', { exact: true })
        .fill(original.occurredAt.slice(0, 10) + 'T13:00');
      await button('Guardar devolución').click();
      await page.getByText('Devolución registrada.', { exact: true }).waitFor();
      const refund = (await stored()).movements.find((item) => item.refundOfId === original.id);
      assert.equal(refund.amountMinor, 5000);
      assert.equal(
        refund.splits.reduce((sum, split) => sum + split.amountMinor, 0),
        5000,
      );
      await button('Registrar devolución de Compra CORE').click();
      await page.getByText('Pendiente de devolver · EUR 51.29', { exact: true }).waitFor();
      await button('Volver').click();
      await button('Abrir menú').click();
      await button('Analíticas y reportes').click();
      await page.getByRole('heading', { name: 'Analíticas y reportes', exact: true }).waitFor();
      const reportDownload = page.waitForEvent('download');
      await button('Exportar reporte CSV').click();
      const report = await reportDownload;
      assert.equal(report.suggestedFilename(), `FlowSaldo-Reporte-${month}-EUR.csv`);
      const reportRows = parseCsv(await readFile(await report.path(), 'utf8'));
      assert.deepEqual(reportRows[0], ['Período', 'Moneda', 'Indicador', 'Categoría', 'Importe']);
      assert.deepEqual(
        reportRows.find((row) => row[2] === 'Gastos netos'),
        [month, 'EUR', 'Gastos netos', '', '71.80'],
      );
      assert.deepEqual(
        reportRows.find((row) => row[3] === 'Alimentación'),
        [month, 'EUR', 'Gasto neto por categoría', 'Alimentación', '35.55'],
      );
      await checkDemoPlanning(page, button, stored);
      await button('Inicio').click();
      await page.route('https://api.frankfurter.dev/v2/rate/**', async (route) => {
        const url = new URL(route.request().url());
        const base = url.pathname.split('/').at(-2);
        const historical = url.searchParams.get('date');
        await route.fulfill({
          headers: { 'Access-Control-Allow-Origin': '*' },
          json: {
            base,
            quote: 'DOP',
            date: historical ?? '2025-01-03',
            rate: base === 'USD' ? (historical ? 60 : 61) : 65,
          },
        });
      });
      await button('Configuración').click();
      const dailyRate = button('Tasa del día');
      assert.equal(await dailyRate.innerText(), 'Tasa del día');
      assert.ok(await dailyRate.locator('[aria-hidden="true"]').count());
      assert.equal(
        await dailyRate.evaluate(
          (element) => element.ownerDocument.defaultView.getComputedStyle(element).borderTopWidth,
        ),
        '0px',
      );
      await dailyRate.click();
      await page.getByText('USD → DOP', { exact: true }).waitFor();
      await page.getByText('EUR → DOP', { exact: true }).waitFor();
      await button('Volver').click();
      await button('Volver').click();
      await button('Inicio').click();
      await button('Elegir período').click();
      await page.getByLabel('Año', { exact: true }).fill('2040');
      await button('febrero de 2040').click();
      await page.getByText('2040-02-29', { exact: true }).waitFor();
      assert.equal(await button('Semana anterior').innerText(), '−7 días');
      assert.equal(await button('Semana siguiente').innerText(), '+7 días');
      await button('Semana siguiente').click();
      await page.getByText('2040-03-07', { exact: true }).waitFor();
      await button('Abrir menú').click();
      await button('Ver tasas de cambio').click();
      await page.getByText('USD → DOP', { exact: true }).waitFor();
      await page.getByText('EUR → DOP', { exact: true }).waitFor();
      for (const tab of ['Inicio', 'Movimientos', 'Por revisar', 'Conexiones'])
        assert.ok(await button(tab).isVisible(), tab);
      await page.getByLabel('Fecha y hora de consulta', { exact: true }).fill('2024-01-03T14:25');
      await button('Consultar fecha').click();
      await page.getByText('Publicada el 2024-01-03', { exact: true }).first().waitFor();
      await page.getByLabel('Monto en USD', { exact: true }).fill('2');
      await page.getByText(/DOP\s*120[.,]00/).waitFor();
      const usdRate = page.getByLabel('Tasa USD a DOP', { exact: true });
      const eurRate = page.getByLabel('Tasa EUR a DOP', { exact: true });
      assert.equal(await usdRate.inputValue(), '60');
      assert.equal(await eurRate.inputValue(), '65');
      await usdRate.fill('61,25');
      await page.getByText(/DOP\s*122[.,]50/).waitFor();
      await usdRate.fill('0');
      await page.getByRole('alert').filter({ hasText: 'Escribe una tasa positiva.' }).waitFor();
      await button('Restaurar tasa de USD').click();
      await page.getByText(/DOP\s*120[.,]00/).waitFor();
      await checkDemoReconciliation({ page, button, stored, original, refund });
      await checkDemoBackup({ browser, page, button, stored, original, refund, reportRows });
      await button('Volver').click();
      await button('Volver').click();
      await button('Configuración').getByText('UD', { exact: true }).waitFor();
      await button('Abrir menú').click();
      await button('Salir').click();
      await page.getByText('Iniciar sesión', { exact: true }).waitFor();
      const csv = parseCsv(await readFile(await file.path(), 'utf8'));
      assert.equal(csv.length, 2);
      assert.equal(csv[1][2], 'EUR');
      assert.equal(csv[1][3], '101.29');
      assert.equal(csv[1][4], 'Compra CORE');
      assert.equal(apiRequests, 0, 'El flujo local funciona sin solicitudes a la API');
    },
  );
}
