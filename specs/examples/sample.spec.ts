import { test, expect } from '@playwright/test';
import { BasePage } from '../../src/core/BasePage';

class ExampleHomePage extends BasePage {
  async open(): Promise<void> {
    await this.goto('/');
  }

  get heading() {
    return this.page.locator('h1');
  }
}

test('example TypeScript spec using BasePage', async ({ page }) => {
  const home = new ExampleHomePage(page, 'https://example.com');
  await home.open();
  await expect(home.heading).toBeVisible();
});
