/* global localStorage */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { parseCsv } from './export-guardian.mjs';
import { loginAsTestAccount } from './test-account-flow.mjs';

export async function checkDemoBackup({
  browser,
  page,
  button,
  stored,
  original,
  refund,
  reportRows,
}) {
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
    const legacyBackup = JSON.parse(backupText);
    legacyBackup.version = 1;
    delete legacyBackup.data.accounts;
    legacyBackup.data.movements = legacyBackup.data.movements.filter(
      (movement) => !movement.balanceAdjustment,
    );
    for (const movement of legacyBackup.data.movements) {
      delete movement.accountId;
      delete movement.targetAccountId;
    }
    const legacyFile = {
      name: 'Respaldo-v1.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(legacyBackup)),
    };
    await chooseBackup(legacyFile);
    await restoredPage.getByText(/· 0 cuentas$/).waitFor();
    await restoredButton('Cancelar').click();
    assert.equal(await restoredStorage(), null);
    await chooseBackup(legacyFile);
    await restoredButton('Restaurar y reemplazar datos').click();
    await restoredPage.getByText('Respaldo restaurado.', { exact: true }).waitFor();
    const legacyData = await restoredStorage();
    assert.deepEqual(legacyData.accounts, []);
    assert.deepEqual(legacyData.movements, legacyBackup.data.movements);
    assert.equal(
      legacyData.movements.find((movement) => movement.id === refund.id).refundOfId,
      original.id,
    );
    await chooseBackup(backupPath);
    await restoredButton('Restaurar y reemplazar datos').click();
    await restoredPage.getByText('Respaldo restaurado.', { exact: true }).waitFor();
    assert.deepEqual(await restoredStorage(), backupData.data);
    await restoredPage.reload({ waitUntil: 'networkidle' });
    await loginAsTestAccount(restoredPage);
    await restoredButton('Configuración').click();
    await restoredButton('Cuentas y saldos').click();
    await restoredPage.getByText('Saldo · EUR 848.71', { exact: true }).waitFor();
    await restoredPage.getByText('Saldo · EUR 84.25', { exact: true }).waitFor();
    await restoredPage.getByText('Deuda · EUR 25.51', { exact: true }).waitFor();
    await restoredButton('Reactivar cuenta Efectivo CORE').waitFor();
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
}
