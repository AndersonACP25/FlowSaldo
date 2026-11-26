import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { demoCategoryCatalog, demoMovements, movementsCsv } from '../packages/domain/src/index.ts';
import { parseCsv } from './export-guardian.mjs';
import { loginAsTestAccount } from './test-account-flow.mjs';
import { runCoreWebScenario } from './web-core-scenario.mjs';

export async function checkApiHistoryFlow(browser, apiUrl, month) {
  const apiScope = JSON.stringify([new URL(apiUrl).toString().replace(/\/$/, ''), 'development']);
  const otherScope = JSON.stringify(['https://otro-servidor.example.test', 'development']);
  const legacyProjection = { balanceMinor: 900, nextIncomeAt: '2035-01-01T09:00' };
  await runCoreWebScenario(
    browser,
    'API exports complete results, isolates the local projection and retries a failed import',
    async (page, button, stored) => {
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
      await button('Abrir menú').click();
      await button('Disponible hasta el próximo cobro').click();
      const balance = page.getByLabel('Saldo disponible hoy', { exact: true });
      await balance.waitFor();
      assert.equal(await balance.inputValue(), '80.00');
      await balance.fill('81.00');
      await button('Guardar proyección').click();
      await page.getByText('Proyección guardada.', { exact: true }).waitFor();
      const { cashProjections } = await stored();
      assert.equal(cashProjections[apiScope + ':DOP'].balanceMinor, 8100);
      assert.deepEqual(cashProjections[otherScope + ':DOP'], legacyProjection);
      assert.deepEqual(cashProjections['api:DOP'], legacyProjection);
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
    {
      movements: [],
      budgets: {},
      reviews: [],
      cashProjections: {
        [apiScope + ':DOP']: { ...legacyProjection, balanceMinor: 8000 },
        [otherScope + ':DOP']: legacyProjection,
        'api:DOP': legacyProjection,
      },
    },
  );
}
