import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const systemBrowsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.BROWSER_PATH || systemBrowsers.find(existsSync) },
    screenshot: 'only-on-failure',
    trace: 'off',
  },
});
