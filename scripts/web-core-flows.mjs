import { checkApiHistoryFlow } from './web-api-history-flow.mjs';
import { checkDemoFlow } from './web-demo-flow.mjs';
import { checkRecurringReviewFlow } from './web-recurring-review-flow.mjs';

// Three independent critical journeys. Business-rule combinations live in domain/API tests.
export async function checkCoreFlows(browser) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error('Exporta con EXPO_PUBLIC_API_URL para el recorrido CORE API.');
  const month = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  await checkDemoFlow(browser, apiUrl, month);
  await checkRecurringReviewFlow(browser, today);
  await checkApiHistoryFlow(browser, apiUrl, month);
}
