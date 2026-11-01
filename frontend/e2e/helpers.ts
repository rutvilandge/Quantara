import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export async function mutate(request: APIRequestContext, path: string, body?: unknown) {
  const csrfResponse = await request.get('/api/auth/csrf');
  expect(csrfResponse.ok()).toBeTruthy();
  const csrf = await csrfResponse.json();
  return request.post(path, { headers: { [csrf.headerName]: csrf.token }, data: body });
}
export async function authenticate(page: Page) {
  await expect.poll(async () => {
    try { return (await page.request.get('/api/auth/csrf')).status(); } catch { return 0; }
  }, { timeout: 90_000, intervals: [1000, 2000, 5000] }).toBe(200);
  const email = `workspace-${randomUUID()}@example.test`;
  const password = `Qa!${randomUUID()}`;
  expect((await mutate(page.request, '/api/auth/signup', { fullName: 'Analytics Test', email, password })).status()).toBe(201);
  expect((await mutate(page.request, '/api/auth/login', { email, password })).status()).toBe(200);
  return email;
}
