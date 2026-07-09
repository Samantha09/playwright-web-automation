import { defineConfig, devices } from '@playwright/test';
import { env } from './src/utils/env';

export default defineConfig({
  testDir: './tests/json-runner',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: env.BASE_URL,
    trace: env.TRACE ? 'on' : 'on-first-retry',
    video: env.VIDEO ? 'on' : 'off',
    screenshot: env.SCREENSHOT as 'on' | 'off' | 'only-on-failure',
    headless: env.HEADLESS,
    launchOptions: {
      slowMo: env.SLOW_MO,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
