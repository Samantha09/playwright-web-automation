import { test, expect } from '@playwright/test';
import { env } from '../../src/utils/env';

test('env provides sensible defaults', () => {
  expect(env.BASE_URL).toBe('http://127.0.0.1:3000');
  expect(env.API_URL).toBe('http://127.0.0.1:8000');
  expect(env.HEADLESS).toBe(true);
  expect(env.SCREENSHOT).toBe('only-on-failure');
});
