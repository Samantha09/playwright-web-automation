import { test, expect } from '@playwright/test';
import { NetworkRecorder } from '../../src/core/NetworkRecorder';

test('NetworkRecorder records API requests', async ({ page }) => {
  const recorder = new NetworkRecorder();
  recorder.attach(page);
  await page.route('https://api.example.com/test', async (route) => {
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto('https://api.example.com/test');
  const apis = recorder.getApis();
  expect(apis.length).toBeGreaterThan(0);
  expect(apis.some((a) => a.url.includes('api.example.com/test'))).toBe(true);
});
