import { loginAsTestAccount } from './test-account-flow.mjs';
/* global localStorage */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import {
  demoCategoryCatalog,
  demoMovements,
  dominicanDateTime,
  movementsCsv,
} from '../packages/domain/src/index.ts';
import { parseCsv } from './export-guardian.mjs';

// Three independent critical journeys. Business-rule combinations live in domain/API tests.
export async function checkCoreFlows(browser) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error('Exporta con EXPO_PUBLIC_API_URL para el recorrido CORE API.');
  const month = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  async function scenario(name, work, legacy) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    if (legacy)
      await context.addInitScript((data) => {
        if (!localStorage.getItem('flowsaldo.demo.v2'))
          localStorage.setItem('flowsaldo.demo.v2', JSON.stringify(data));
      }, legacy);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const button = (label) => page.getByRole('button', { name: label, exact: true });
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('flowsaldo.demo.v2')));
    try {
      await work(page, button, stored);
      assert.deepEqual(errors, []);
      console.info('PASS CORE UI: ' + name);
    } finally {
      await context.close();
    }
  }
  await scenario('register → persist → export filtered CSV', async (page, button, stored) => {
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
    await page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos' }).waitFor();
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
    await button('EUR').click();
    await button('Guardar preferencias').click();
    await page.getByText('Preferencias guardadas en este dispositivo.', { exact: true }).waitFor();
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
    await page.waitForFunction(() => localStorage.getItem('flowsaldo.theme.v1') === 'midnight');
    await button('Arena').click();
    await page.waitForFunction(() => localStorage.getItem('flowsaldo.theme.v1') === 'sand');
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
    assert.equal(
      await page.getByLabel('Buscar descripción o categoría', { exact: true }).count(),
      0,
    );
    await page.getByLabel('Monto (sin separadores de miles)', { exact: true }).fill('99.00');
    await button('Volver').click();
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
    const original = (await stored()).movements.find((item) => item.description === 'Compra CORE');
    await button('Registrar devolución de Compra CORE').click();
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
    await button('Inicio').click();
    await button('Abrir menú').click();
    await button('Metas de ahorro').click();
    await button('Nueva meta de ahorro').click();
    await page.getByLabel('Nombre de la meta', { exact: true }).fill('Laptop CORE');
    await page.getByLabel('Monto objetivo', { exact: true }).fill('1000');
    await button('Guardar meta').click();
    await page.getByRole('heading', { name: 'Laptop CORE', exact: true }).waitFor();
    await button('Aportar a Laptop CORE').click();
    const cancelContribution = await button('Cancelar aporte').evaluate((el) => {
      const browser = el.ownerDocument.defaultView;
      return {
        border: browser.getComputedStyle(el).borderTopWidth,
        alignment: browser.getComputedStyle(el.parentElement).alignItems,
      };
    });
    assert.deepEqual(cancelContribution, { border: '0px', alignment: 'center' });
    await page.getByLabel('Monto del aporte', { exact: true }).fill('150');
    await button('Guardar aporte').click();
    await page.getByText('EUR 150.00 de EUR 1,000.00', { exact: true }).waitFor();
    await button('Movimientos').click();
    await button('+ Nuevo movimiento').click();
    await page.getByLabel('Descripción', { exact: true }).fill('Apartado CORE');
    await page.getByLabel('Monto (sin separadores de miles)', { exact: true }).fill('350');
    await button('Transferencia').first().click();
    await button('Guardar movimiento').click();
    await button('Vincular a meta: Apartado CORE').click();
    await button('Vincular transferencia a Laptop CORE').click();
    await page.getByText('EUR 500.00 de EUR 1,000.00', { exact: true }).waitFor();
    assert.equal(await button('Vincular transferencia a Laptop CORE').count(), 0);
    assert.equal(
      (await stored()).movements.filter((item) => item.description === 'Apartado CORE').length,
      1,
    );
    assert.equal(
      (await stored()).movements.find((item) => item.description === 'Apartado CORE').type,
      'TRANSFER',
    );
    const beforePlanning = (await stored()).movements;
    await button('Inicio').click();
    await button('Abrir menú').click();
    await button('Simulador de préstamos').click();
    await button('DOP').click();
    await page.getByLabel('Monto del préstamo', { exact: true }).fill('100000');
    await page.getByLabel('Tasa nominal anual (%)', { exact: true }).fill('18');
    await button('Calcular préstamo').click();
    await page.getByRole('heading', { name: 'Comparación de plazos', exact: true }).waitFor();
    await button('Elegir 60 cuotas').waitFor();
    await button('Elegir 12 cuotas').click();
    assert.equal(
      await page.getByLabel('Número de cuotas mensuales', { exact: true }).inputValue(),
      '12',
    );
    const loanFields = {
      'Monto del préstamo': '100000',
      'Tasa nominal anual (%)': '18',
      'Número de cuotas mensuales': '12',
      'Comisión inicial (opcional)': '1000',
      'Seguro mensual (opcional)': '250',
      'Fecha y hora del primer pago (opcional)': '2028-01-31T17:30',
    };
    for (const [label, value] of Object.entries(loanFields))
      await page.getByLabel(label, { exact: true }).fill(value);
    await button('Calcular préstamo').click();
    await page.getByText('DOP 9,418.00', { exact: true }).waitFor();
    await page.getByText('DOP 114,015.99', { exact: true }).waitFor();
    await button('Ver amortización').click();
    await page.getByText('Cuota 2 · 2028-02-29 · 17:30', { exact: true }).waitFor();
    assert.deepEqual((await stored()).movements, beforePlanning);
    assert.equal(await button('Volver').innerText(), 'Volver');
    await button('Abrir menú').click();
    const planLink = button('Plan de pago de tarjetas y préstamos');
    assert.equal(
      await planLink.evaluate(
        (element) => element.ownerDocument.defaultView.getComputedStyle(element).borderTopWidth,
      ),
      '0px',
    );
    await planLink.click();
    const planTitle = page.getByRole('heading', {
      name: 'Plan de pago de tarjetas y préstamos',
      exact: true,
    });
    await planTitle.waitFor();
    const backBounds = await button('Volver').boundingBox();
    const titleBounds = await planTitle.boundingBox();
    assert.ok(backBounds.y + backBounds.height <= titleBounds.y);
    await button('Nuevo plan de pago').click();
    await button('DOP').click();
    const debtFields = {
      'Nombre del plan': 'Tarjeta CORE',
      'Fecha y hora de corte': '2026-11-01T08:00',
      'Fecha y hora del próximo vencimiento': '2026-11-30T19:00',
      'Capital pendiente': '10000',
      'Interés al corte': '250',
      'Cargos al corte': '100',
      'Tasa nominal anual (%)': '24',
      'Cuota mensual': '3000',
      'Abono adicional mensual': '1000',
    };
    for (const [label, value] of Object.entries(debtFields))
      await page.getByLabel(label, { exact: true }).fill(value);
    const principal = await page.getByLabel('Capital pendiente', { exact: true }).boundingBox();
    const interest = await page.getByLabel('Interés al corte', { exact: true }).boundingBox();
    assert.equal(principal.x, interest.x);
    assert.equal(principal.width, interest.width);
    assert.ok(principal.y + principal.height <= interest.y);
    await button('Guardar y comparar').click();
    const savings = page.getByText('DOP 92.14 menos en intereses · 1 cuota menos', { exact: true });
    await savings.waitFor();
    assert.deepEqual((await stored()).movements, beforePlanning);
    await page.reload({ waitUntil: 'networkidle' });
    await loginAsTestAccount(page);
    await button('Abrir menú').click();
    await button('Plan de pago de tarjetas y préstamos').click();
    await savings.waitFor();
    const edited = (await stored()).movements.find((item) => item.description === 'Compra CORE');
    assert.equal(edited.splits.length, 2);
    await button('Volver').click();
    await button('Abrir menú').click();
    await button('Metas de ahorro').click();
    await page.getByText('EUR 500.00 de EUR 1,000.00', { exact: true }).waitFor();
    await button('Quitar aporte 2 de Laptop CORE').click();
    await button('Confirmar retiro de aporte').click();
    await page.getByText('EUR 150.00 de EUR 1,000.00', { exact: true }).waitFor();
    assert.ok((await stored()).movements.some((item) => item.description === 'Apartado CORE'));
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
    await button('Inicio').click();
    await button('Configuración').click();
    await button('Respaldo y restauración').click();
    const backupDownload = page.waitForEvent('download');
    await button('Exportar respaldo').click();
    const backup = await backupDownload;
    assert.match(backup.suggestedFilename(), /^FlowSaldo-Respaldo-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = await backup.path();
    const backupText = await readFile(backupPath, 'utf8');
    const backupData = JSON.parse(backupText);
    assert.deepEqual(backupData.data.movements, (await stored()).movements);
    const restoredPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const restoredButton = (name) => restoredPage.getByRole('button', { name, exact: true });
    const restoredStorage = () =>
      restoredPage.evaluate(() => JSON.parse(localStorage.getItem('flowsaldo.demo.v2')));
    async function chooseBackup(input) {
      const chooser = restoredPage.waitForEvent('filechooser');
      await restoredButton('Seleccionar respaldo').click();
      await (await chooser).setFiles(input);
    }
    const restoredErrors = [];
    restoredPage.on('pageerror', (error) => restoredErrors.push(error.message));
    try {
      await restoredPage.goto(page.url(), { waitUntil: 'networkidle' });
      await loginAsTestAccount(restoredPage);
      await restoredButton('Configuración').click();
      await restoredButton('Respaldo y restauración').click();
      assert.equal(await restoredStorage(), null);
      const invalid = JSON.parse(backupText);
      invalid.data.movements = invalid.data.movements.filter((item) => item.id !== original.id);
      await chooseBackup({
        name: 'Respaldo-inválido.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(invalid)),
      });
      await restoredPage
        .getByRole('alert')
        .filter({ hasText: 'datos incompletos o inválidos' })
        .waitFor();
      assert.equal(await restoredButton('Restaurar y reemplazar datos').count(), 0);
      assert.equal(await restoredStorage(), null);
      await chooseBackup(backupPath);
      await restoredButton('Cancelar').click();
      assert.equal(await restoredStorage(), null);
      await chooseBackup(backupPath);
      await restoredButton('Restaurar y reemplazar datos').click();
      await restoredPage.getByText('Respaldo restaurado.', { exact: true }).waitFor();
      assert.deepEqual(await restoredStorage(), backupData.data);
      await restoredPage.reload({ waitUntil: 'networkidle' });
      await loginAsTestAccount(restoredPage);
      await restoredButton('Abrir menú').click();
      await restoredButton('Analíticas y reportes').click();
      await restoredButton('EUR').click();
      const restoredReportDownload = restoredPage.waitForEvent('download');
      await restoredButton('Exportar reporte CSV').click();
      const restoredReport = await restoredReportDownload;
      assert.deepEqual(parseCsv(await readFile(await restoredReport.path(), 'utf8')), reportRows);
      assert.deepEqual(restoredErrors, []);
    } finally {
      await restoredPage.close();
    }
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
  });
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
  await scenario(
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
      await page.getByLabel('Monto del abono', { exact: true }).fill('5000');
      await button('Registrar abono').click();
      await page.getByText('Abono registrado.', { exact: true }).waitFor();
      assert.equal((await stored()).movements.length, 0);
      await button('Inicio').click();
      await button('Abrir menú').click();
      await button('Cierre mensual').click();
      await button('Elegir período').click();
      await page.getByLabel('Fecha exacta (AAAA-MM-DD)', { exact: true }).fill(day);
      await button('Aplicar fecha').click();
      await page.getByText('Por pagar · DOP 7,000.00', { exact: true }).waitFor();
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
  await scenario(
    'API exports complete results and manually retries a failed import',
    async (page, button) => {
      const rows = Array.from({ length: 205 }, (_, i) => ({
        ...demoMovements[1],
        id: String(i),
        description: 'Movimiento ' + i,
        occurredAt: month + '-01T12:00:00.000Z',
      }));
      let retried = false;
      await page.route(apiUrl + '/**', async (route) => {
        const url = new URL(route.request().url());
        const headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization,content-type',
        };
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers });
          return;
        }
        let data;
        if (url.pathname === '/budgets')
          data = { version: 0, limitMinor: null, categoryLimits: [] };
        else if (url.pathname === '/accounts') data = [];
        else if (url.pathname === '/categories') data = demoCategoryCatalog([]);
        else if (['/recurring', '/banks'].includes(url.pathname)) data = [];
        else if (url.pathname === '/imports/stats')
          data = {
            counts: {
              PENDING: retried ? 1 : 0,
              PROCESSING: 0,
              FAILED: retried ? 0 : 1,
              REVIEW: 0,
              PARSED: 0,
              DISMISSED: 0,
            },
            scheduledRetries: 0,
            expiredLeases: 0,
            nextRetryAt: null,
            lastProcessedAt: null,
          };
        else if (url.pathname === '/imports/job-core/retry') {
          assert.equal(route.request().method(), 'POST');
          assert.equal(retried, false);
          retried = true;
          await route.fulfill({
            headers,
            status: 202,
            json: { id: 'job-core', status: 'PENDING' },
          });
          return;
        } else if (url.pathname === '/imports') {
          const items =
            url.searchParams.get('status') === 'FAILED' && !retried
              ? [
                  {
                    id: 'job-core',
                    externalId: 'Error CORE',
                    status: 'FAILED',
                    attempts: 5,
                    manualRetries: 0,
                    lastErrorCode: 'PROCESSING_FAILED',
                    reason: 'No se pudo procesar el aviso.',
                  },
                ]
              : [];
          data = { items, total: items.length, nextCursor: null, pendingTotal: 0 };
        } else if (url.pathname === '/summary')
          data = {
            incomeMinor: 0,
            expenseMinor: 50235250,
            differenceMinor: -50235250,
            total: 205,
            categories: [],
            categoryTotals: [],
            days: Array.from({ length: 7 }, (_, i) => ({
              day: month + '-0' + (i + 1),
              incomeMinor: 0,
              expenseMinor: 0,
              netMinor: 0,
            })),
          };
        else if (url.pathname === '/movements/export') {
          await route.fulfill({ headers, contentType: 'text/csv', body: movementsCsv(rows) });
          return;
        } else if (url.pathname === '/movements') {
          const offset = Number(url.searchParams.get('cursor') ?? 0);
          data = {
            items: rows.slice(offset, offset + 50),
            total: 205,
            nextCursor: offset + 50 < 205 ? String(offset + 50) : null,
          };
        } else throw new Error('Unexpected API path ' + url.pathname);
        await route.fulfill({ headers, json: data });
      });
      await page.goto('http://127.0.0.1:8082', { waitUntil: 'networkidle' });
      await loginAsTestAccount(page);
      await button('Conexiones').click();
      await page
        .getByLabel('Token de desarrollo', { exact: true })
        .fill('synthetic-core-token-123456789');
      await button('Conectar API').click();
      await button('Movimientos').click();
      await page.getByText('205 movimientos', { exact: true }).waitFor();
      assert.equal(await page.getByText('Movimiento 50', { exact: true }).count(), 0);
      const waiting = page.waitForEvent('download');
      await button('Exportar CSV').click();
      const file = await waiting;
      assert.equal(parseCsv(await readFile(await file.path(), 'utf8')).length, 206);
      await button('Cargar más movimientos').click();
      await page.getByText('Movimiento 99', { exact: true }).waitFor();
      await button('Abrir menú').click();
      await button('Analíticas y reportes').click();
      await page.getByText('205 movimientos · DOP', { exact: true }).waitFor();
      const reportDownload = page.waitForEvent('download');
      await button('Exportar reporte CSV').click();
      const report = await reportDownload;
      const reportRows = parseCsv(await readFile(await report.path(), 'utf8'));
      assert.deepEqual(
        reportRows.find((row) => row[2] === 'Gastos netos'),
        [month, 'DOP', 'Gastos netos', '', '502352.50'],
      );
      await button('Conexiones').click();
      await button('Ver importaciones con error').click();
      await page.getByText('Error CORE', { exact: true }).waitFor();
      await button('Reintentar importación').click();
      await button('Confirmar reintento de importación').click();
      await page
        .getByText('Importación reencolada. Se iniciará otro ciclo limitado de intentos.', {
          exact: true,
        })
        .waitFor();
      assert.equal(retried, true);
    },
  );
}
