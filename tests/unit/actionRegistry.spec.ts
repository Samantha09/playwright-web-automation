import { test, expect } from '@playwright/test';
import { ActionRegistry } from '../../src/core/ActionRegistry';

test('ActionRegistry has built-in actions', () => {
  const registry = new ActionRegistry();
  expect(registry.has('goto')).toBe(true);
  expect(registry.has('click')).toBe(true);
  expect(registry.has('fill')).toBe(true);
  expect(registry.has('waitForState')).toBe(true);
  expect(registry.has('mockApi')).toBe(true);
});

test('ActionRegistry supports custom actions', () => {
  const registry = new ActionRegistry();
  registry.register('custom', async () => {});
  expect(registry.has('custom')).toBe(true);
});

test('ActionRegistry executes goto action', async ({ page }) => {
  const registry = new ActionRegistry();
  await registry.execute('goto', { page, log: () => {} }, { url: 'about:blank' });
  expect(page.url()).toBe('about:blank');
});

test('ActionRegistry throws on unknown action', async ({ page }) => {
  const registry = new ActionRegistry();
  await expect(
    registry.execute('nonexistent', { page, log: () => {} }, {}),
  ).rejects.toThrow('Unknown action: nonexistent');
});
