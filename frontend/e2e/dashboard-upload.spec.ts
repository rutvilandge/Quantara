import { test, expect } from '@playwright/test';
import { authenticate } from './helpers';

test('an uploaded dataset creates and persists a dashboard without E-commerce columns', async ({ page }) => {
  await authenticate(page);
  await page.goto('/app/datasets');
  await page.locator('input[type=file]').setInputFiles({ name: 'own-sales.csv', mimeType: 'text/csv', buffer: Buffer.from('department,amount\nBooks,100\nGames,250\nBooks,50\n') });
  await expect(page.getByRole('heading', { name: 'own-sales' })).toBeVisible();
  await page.goto('/app/dashboards');
  await page.getByLabel('Dashboard name', { exact: true }).fill('My uploaded data');
  // Even an explicit incompatible template should fall back to a valid overview.
  await page.getByLabel('Dashboard template').selectOption('ecommerce');
  await page.getByRole('button', { name: 'Create dashboard' }).click();
  await expect(page).toHaveURL(/\/app\/dashboards\/[a-f0-9-]+$/);
  await expect(page.locator('.q-builder-widget')).toHaveCount(4);
  await expect(page.locator('.q-kpi-result strong').first()).toHaveText('3');
  await expect(page.locator('.q-kpi-result strong').nth(1)).toHaveText('400');
  await expect(page.getByText('amount by department', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.q-builder-widget')).toHaveCount(4);
  await expect(page.locator('.q-kpi-result strong').nth(1)).toHaveText('400');
});
