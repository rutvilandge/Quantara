import { test, expect } from '@playwright/test';
import { authenticate, mutate } from './helpers';

test('XLSX upload, input limits, CSRF, CORS, and bounded SQL results', async ({ page }) => {
  await authenticate(page);
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  await page.goto('/app/datasets');
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/orders.xlsx');
  await expect(page.getByRole('heading', { name: 'orders' })).toBeVisible();
  await expect(page.locator('.q-kpi').first().locator('strong')).toHaveText('3');
  const id = page.url().split('/').pop();
  const total = await (await mutate(page.request, '/api/queries/run', { datasetId: id, sql: 'SELECT SUM(revenue) AS total FROM data' })).json();
  expect(total.rows[0].total).toBe(375);
  const bad = await page.request.post('/api/datasets', { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'bad.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('invalid workbook') } } });
  expect(bad.status()).toBe(400);
  const columns = Array.from({ length: 51 }, (_, i) => `column${i}`).join(',');
  const wide = await page.request.post('/api/datasets', { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'wide.csv', mimeType: 'text/csv', buffer: Buffer.from(`${columns}\n${columns}`) } } });
  expect(wide.status()).toBe(400);
  expect((await page.request.post('/api/datasets/demo')).status()).toBe(403);
  const cors = await page.request.fetch('http://127.0.0.1:8080/api/datasets', { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'POST' } });
  expect(cors.status()).toBe(403);
  const demo = await (await mutate(page.request, '/api/datasets/demo')).json();
  const limited = await (await mutate(page.request, '/api/queries/run', { datasetId: demo.id, sql: 'SELECT * FROM data' })).json();
  expect(limited.rows).toHaveLength(500);
  expect(limited.truncated).toBe(true);
  const health = await page.request.get('http://127.0.0.1:8080/actuator/health');
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe('UP');
});
