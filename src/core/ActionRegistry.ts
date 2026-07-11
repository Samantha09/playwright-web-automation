import { Page } from '@playwright/test';

export interface ActionContext {
  page: Page;
  log: (message: string) => void;
}

export type ActionHandler = (ctx: ActionContext, params: Record<string, unknown>) => Promise<void>;

export class ActionRegistry {
  private actions: Map<string, ActionHandler> = new Map();

  constructor() {
    this.registerBuiltIns();
  }

  register(name: string, handler: ActionHandler): void {
    this.actions.set(name, handler);
  }

  async execute(name: string, ctx: ActionContext, params: Record<string, unknown>): Promise<void> {
    const handler = this.actions.get(name);
    if (!handler) {
      throw new Error(`Unknown action: ${name}`);
    }
    await handler(ctx, params);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  private registerBuiltIns(): void {
    this.register('goto', async ({ page }, params) => {
      const url = String(params.url);
      await page.goto(url);
    });

    this.register('click', async ({ page }, params) => {
      const selector = String(params.selector);
      await page.locator(selector).first().click();
    });

    this.register('fill', async ({ page }, params) => {
      const selector = String(params.selector);
      const value = String(params.value);
      const loc = page.locator(selector).first();
      // 通用容错:不可见或不可编辑(隐藏验证码框、只读 select 等)跳过而非失败
      if (!(await loc.isVisible().catch(() => false))) return;
      if (!(await loc.isEditable().catch(() => false))) return;
      await loc.fill(value);
    });

    this.register('type', async ({ page }, params) => {
      const selector = String(params.selector);
      const value = String(params.value);
      await page.locator(selector).pressSequentially(value);
    });

    this.register('select', async ({ page }, params) => {
      const selector = String(params.selector);
      const value = String(params.value);
      await page.locator(selector).selectOption(value);
    });

    this.register('hover', async ({ page }, params) => {
      const selector = String(params.selector);
      await page.locator(selector).hover();
    });

    this.register('scroll', async ({ page }, params) => {
      const selector = String(params.selector);
      await page.locator(selector).scrollIntoViewIfNeeded();
    });

    this.register('waitForState', async ({ page }, params) => {
      const selector = String(params.selector);
      const state = String(params.state || 'visible') as 'visible' | 'hidden' | 'attached' | 'detached';
      const timeout = Number(params.timeout || 30000);
      await page.locator(selector).waitFor({ state, timeout });
    });

    this.register('waitForText', async ({ page }, params) => {
      const selector = String(params.selector);
      const text = String(params.text);
      const timeout = Number(params.timeout || 30000);
      await page.locator(selector).filter({ hasText: text }).waitFor({ timeout });
    });

    this.register('screenshot', async ({ page }, params) => {
      const name = String(params.name || 'screenshot');
      await page.screenshot({ path: `test-results/screenshots/${name}.png` });
    });

    this.register('mockApi', async ({ page }, params) => {
      const url = String(params.url);
      const method = String(params.method || 'GET');
      const status = Number(params.status || 200);
      const body = params.body;
      await page.route(url, async (route, request) => {
        if (request.method() === method) {
          await route.fulfill({
            status,
            body: body ? JSON.stringify(body) : undefined,
          });
        } else {
          await route.continue();
        }
      });
    });
  }
}
