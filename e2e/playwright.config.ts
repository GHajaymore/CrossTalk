// End-to-end tests: the real app (built web + server) in mock mode, driven in Chromium.
// Run with `npm run e2e`. Set CHROMIUM_PATH to use an already-installed Chromium instead of
// `npx playwright install chromium`.
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PORT = 8799;
const root = fileURLToPath(new URL('..', import.meta.url));
const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, launchOptions, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, launchOptions }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    // A fresh database each run; no key needed, and nothing leaves this machine.
    command: 'rm -rf e2e/.data && npm run build && npm start',
    cwd: root,
    url: `http://127.0.0.1:${PORT}/api/access`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { PROVIDER_MODE: 'mock', PORT: String(PORT), HOST: '127.0.0.1', DB_PATH: `${root}e2e/.data/e2e.sqlite`, MAX_REQUESTS_PER_DAY: '2000', ACCESS_CODE: '' },
  },
});
