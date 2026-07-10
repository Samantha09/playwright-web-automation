import { test, expect } from '@playwright/test';
import { buildSelector } from '../../src/core/selector';

test('buildSelector tag-qualifies id to avoid wrapper ambiguity', async ({ page }) => {
  // Ant Design 风格:div 与 input 共用 id
  await page.setContent(`
    <div id="captcha"><input id="captcha" type="text" /></div>
    <input id="username" type="text" />
    <button id="go">Go</button>
  `);
  expect(await buildSelector(page.locator('input#captcha'))).toBe('input#captcha');
  expect(await buildSelector(page.locator('input#username'))).toBe('input#username');
  expect(await buildSelector(page.locator('button#go'))).toBe('button#go');
});

test('buildSelector falls back to name then text', async ({ page }) => {
  await page.setContent(`<form><input name="email" type="email" /><button>提交</button></form>`);
  expect(await buildSelector(page.locator('input[name="email"]'))).toBe('input[name="email"]');
  expect(await buildSelector(page.locator('button'))).toBe('button:has-text("提交")');
});
