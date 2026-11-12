import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: 'artifacts/test-results',
  use: {
    baseURL: 'http://localhost:8082',
    viewport: { width: 390, height: 844 },
    timezoneId: 'Europe/Istanbul',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run web -- --host localhost --port 8082',
    url: 'http://localhost:8082',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { EXPO_NO_TELEMETRY: '1', EXPO_OFFLINE: '1' },
  },
});
