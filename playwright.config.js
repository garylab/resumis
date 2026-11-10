import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8788', headless: true },
  webServer: {
    command: 'npm run dev -- --ip 127.0.0.1 --port 8788',
    url: 'http://127.0.0.1:8788/health',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
