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

test('NetworkRecorder captures API response payload', async ({ page }) => {
  const recorder = new NetworkRecorder();
  recorder.attach(page);
  await page.route('https://api.example.com/data', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
  await page.goto('https://api.example.com/data');

  let api = recorder.getApis().find((a) => a.url.includes('/data'));
  for (let i = 0; i < 20 && !api?.sampleResponse; i++) {
    await page.waitForTimeout(50);
    api = recorder.getApis().find((a) => a.url.includes('/data'));
  }
  expect(api?.sampleResponse?.status).toBe(200);
  expect(api?.sampleResponse?.body).toContain('"ok":true');
});

test('NetworkRecorder filters static assets', async ({ page }) => {
  const recorder = new NetworkRecorder();
  recorder.attach(page);
  await page.route('https://api.example.com/logo.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: 'x' }),
  );
  await page.goto('https://api.example.com/logo.png').catch(() => undefined);
  const apis = recorder.getApis();
  expect(apis.find((a) => a.url.includes('logo.png'))).toBeUndefined();
});

test('NetworkRecorder captures POST request body', async ({ page }) => {
  const recorder = new NetworkRecorder();
  recorder.attach(page);
  await page.route('**/api.example.com/submit', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.setContent('<html></html>');
  await page.evaluate(async () => {
    await fetch('https://api.example.com/submit', { method: 'POST', body: '{"a":1}' });
  });
  const api = recorder.getApis().find((a) => a.url.includes('/submit'));
  expect(api?.sampleRequest?.body).toBe('{"a":1}');
});
