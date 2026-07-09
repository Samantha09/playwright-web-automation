import { test, expect } from '@playwright/test';
import { HeuristicFinder } from '../../src/core/HeuristicFinder';

test('HeuristicFinder finds login form', async ({ page }) => {
  await page.setContent(`
    <form>
      <input type="email" name="email" placeholder="Email" />
      <input type="password" name="password" />
      <button type="submit">Login</button>
    </form>
  `);
  const finder = new HeuristicFinder();
  const forms = await finder.findForms(page, 'http://localhost/login');
  expect(forms.length).toBe(1);
  expect(forms[0].confidence).toBeGreaterThan(0.9);
  expect(forms[0].fields.some((f) => f.role === 'password')).toBe(true);
  expect(forms[0].fields.some((f) => f.role === 'username')).toBe(true);
});

test('HeuristicFinder finds search input', async ({ page }) => {
  await page.setContent(`
    <form>
      <input type="search" name="q" placeholder="Search..." />
      <button type="submit">Search</button>
    </form>
  `);
  const finder = new HeuristicFinder();
  const forms = await finder.findForms(page, 'http://localhost/search');
  expect(forms.length).toBe(1);
  expect(forms[0].fields.some((f) => f.role === 'search')).toBe(true);
});
