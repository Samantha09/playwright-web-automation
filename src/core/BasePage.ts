import { Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export abstract class BasePage {
  constructor(
    protected page: Page,
    protected baseUrl: string,
  ) {}

  async goto(path: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}${path}`);
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async screenshot(name: string): Promise<string> {
    const dir = 'test-results/screenshots';
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${name}.png`);
    await this.page.screenshot({ path: filePath });
    return filePath;
  }

  async click(selector: string): Promise<void> {
    await this.page.locator(selector).click();
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).fill(value);
  }

  async waitForVisible(selector: string, timeout = 10000): Promise<void> {
    await this.page.locator(selector).waitFor({ state: 'visible', timeout });
  }

  async waitForHidden(selector: string, timeout = 10000): Promise<void> {
    await this.page.locator(selector).waitFor({ state: 'hidden', timeout });
  }

  getLocator(selector: string): Locator {
    return this.page.locator(selector);
  }
}
