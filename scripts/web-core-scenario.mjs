/* global localStorage */
import assert from 'node:assert/strict';

export async function runCoreWebScenario(browser, name, work, legacy) {
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
