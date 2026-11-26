import assert from 'node:assert/strict';
import { loginAsTestAccount } from './test-account-flow.mjs';

export async function checkDemoPlanning(page, button, stored) {
  await button('Abrir menú').click();
  const drawer = page.getByRole('dialog');
  const drawerHome = drawer.getByRole('button', { name: 'Inicio', exact: true });
  assert.equal(await drawer.getByRole('button').nth(1).getAttribute('aria-label'), 'Inicio');
  assert.ok(await drawerHome.locator('[aria-hidden="true"]').count());
  await drawerHome.click();
  await page.getByRole('heading', { name: 'Inicio', exact: true }).waitFor();
  await button('Abrir menú').click();
  await button('Metas de ahorro').click();
  await button('Nueva meta de ahorro').click();
  assert.equal(
    (await button('Cancelar meta').boundingBox()).width,
    (await button('Guardar meta').boundingBox()).width,
  );
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
  assert.equal(await button('Volver').innerText(), '←');
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
}
