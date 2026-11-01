import { test, expect } from '@playwright/test';
import { authenticate, mutate } from './helpers';

test('real Ollama SQL draft, execution, and secure Python ML analysis', async ({ page }) => {
  test.setTimeout(240_000);
  await authenticate(page);
  const demo = await (await mutate(page.request, '/api/datasets/demo')).json();
  const status = await (await page.request.get('/api/copilot/status')).json();
  expect(status.available).toBe(true);
  expect(status.modelReady).toBe(true);
  await page.goto(`/app/copilot?dataset=${demo.id}`);
  await page.getByLabel('Ask your data a question').fill('Calculate total revenue by region, highest first.');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('button', { name: 'Run this analysis' })).toBeVisible({ timeout: 130_000 });
  await expect(page.locator('.q-assistant-answer .sql-code')).toContainText(/SELECT/i);
  await page.getByRole('button', { name: 'Run this analysis' }).click();
  await expect(page.locator('.q-grounded-result .q-table tbody tr')).toHaveCount(4);
  await page.screenshot({ path: 'artifacts/copilot-real-results.png', fullPage: true });
  const ml = await (await page.request.get('/api/analytics/status')).json();
  expect(ml.available).toBe(true);
  await page.goto(`/app/statistics?dataset=${demo.id}`);
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Actuals, possibilities, and uncertainty' })).toBeVisible({ timeout: 65_000 });
  await expect(page.getByRole('heading', { name: 'Evaluation, in the open' })).toBeVisible();
  await expect(page.getByText('95% prediction interval', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/statistical-analytics.png', fullPage: true });
  const direct = await page.request.post('http://127.0.0.1:8001/v1/analyze', { data: { rows: [], dateColumn: 'date', metricColumn: 'revenue' } });
  expect(direct.status()).toBe(401);
});
