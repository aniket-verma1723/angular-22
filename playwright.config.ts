import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4213';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `${npm} run start:mock -- --host 127.0.0.1 --port 4213`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
