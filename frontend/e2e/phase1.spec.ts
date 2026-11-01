import { test, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('existing landing and authentication design sources are preserved', async ({ page }) => {
  const manifest = JSON.parse(readFileSync(resolve('../docs/landing-preservation.json'), 'utf8'));
  for (const [name, digest] of Object.entries(manifest.files)) {
    expect(createHash('sha256').update(readFileSync(resolve('src', name))).digest('hex')).toBe(digest);
  }
  const source = readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
  expect(createHash('sha256').update(source.slice(source.indexOf('const sales ='), source.indexOf('export default function App()'))).digest('hex')).toBe(manifest.landingCodeSha256);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Intelligence begins with a question.' })).toBeVisible();
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/landing-desktop.png' });
  const typography = await page.locator('.hero h1').evaluate(el => ({ headingFont: getComputedStyle(el).fontFamily, bodyFont: getComputedStyle(document.body).fontFamily, color: getComputedStyle(el).color }));
  console.log('Existing landing typography:', typography);
});

test('Neon signup, login, session persistence, dashboard, mobile, and logout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `Qa!${randomUUID()}`;
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Workspace Test');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'A little clarity, Workspace.' })).toBeVisible();
  await expect(page.locator('.q-kpi').first().locator('strong')).toHaveText('0');
  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect((await me.json()).email).toBe(email);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A little clarity, Workspace.' })).toBeVisible();
  await page.getByLabel('Activity date range').selectOption('7');
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('.quantara-app')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'artifacts/dashboard-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'A little clarity, Workspace.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Your account, thoughtfully.' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/settings-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Sign out securely' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  expect((await page.request.post('/api/auth/login', { data: { email, password } })).status()).toBe(403);
  expect(errors).toEqual([]);
});
