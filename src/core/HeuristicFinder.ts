import { Page, Locator } from '@playwright/test';
import { DiscoveredForm, DiscoveredField } from '../types/discovery';

export class HeuristicFinder {
  async findForms(page: Page, pageUrl: string): Promise<DiscoveredForm[]> {
    const forms: DiscoveredForm[] = [];
    const formLocators = page.locator('form');
    const count = await formLocators.count();

    for (let i = 0; i < count; i++) {
      const form = formLocators.nth(i);
      const fields = await this.findFields(form);
      const hasPassword = fields.some((f) => f.role === 'password');
      if (!hasPassword && fields.length === 0) continue;

      const submitSelector =
        (await this.findSubmitSelector(form)) ??
        (await this.findSubmitSelector(page.locator('body')));
      forms.push({
        id: `form-${i}`,
        pageUrl,
        formSelector: await this.getSelector(form),
        confidence: hasPassword ? 0.95 : 0.7,
        fields,
        submitSelector,
      });
    }

    const standalonePasswords = page.locator('input[type="password"]');
    const pwCount = await standalonePasswords.count();
    for (let i = 0; i < pwCount; i++) {
      const pw = standalonePasswords.nth(i);
      const alreadyInForm = forms.some((f) =>
        f.fields.some((field) => field.role === 'password'),
      );
      if (alreadyInForm) continue;

      const fields = await this.findFieldsForPassword(pw, page);
      forms.push({
        id: `standalone-form-${i}`,
        pageUrl,
        confidence: 0.85,
        fields,
        submitSelector: await this.findSubmitSelector(page.locator('body')),
      });
    }

    return forms;
  }

  private async findFields(form: Locator): Promise<DiscoveredField[]> {
    const fields: DiscoveredField[] = [];
    const inputs = form.locator('input, select, textarea');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const role = await this.inferFieldRole(input);
      if (!role) continue;
      const selector = await this.getSelector(input);
      const label = await this.getLabel(input);
      fields.push({ role, selector, label, confidence: 0.8 });
    }

    return fields;
  }

  private async findFieldsForPassword(passwordInput: Locator, page: Page): Promise<DiscoveredField[]> {
    const fields: DiscoveredField[] = [];
    const pwSelector = await this.getSelector(passwordInput);
    fields.push({ role: 'password', selector: pwSelector, confidence: 0.95 });

    const nearbyInputs = page.locator(
      'input[type="email"], input[type="text"], input[name*="user"], input[name*="email"]',
    );
    const count = await nearbyInputs.count();
    if (count > 0) {
      const selector = await this.getSelector(nearbyInputs.nth(0));
      fields.push({ role: 'username', selector, confidence: 0.7 });
    }

    return fields;
  }

  private async inferFieldRole(input: Locator): Promise<string | null> {
    const type = await input.getAttribute('type').catch(() => null);
    const name = await input.getAttribute('name').catch(() => null);
    const placeholder = await input.getAttribute('placeholder').catch(() => null);
    const ariaLabel = await input.getAttribute('aria-label').catch(() => null);

    const text = `${type || ''} ${name || ''} ${placeholder || ''} ${ariaLabel || ''}`.toLowerCase();

    if (type === 'password') return 'password';
    if (type === 'email' || text.includes('email') || text.includes('用户名') || text.includes('账号')) {
      return 'username';
    }
    if (text.includes('search') || text.includes('搜索') || text.includes('query')) return 'search';
    if (text.includes('captcha') || text.includes('验证码') || text.includes('verify')) return 'captcha';
    if (type === 'text') return 'text';
    if (type === 'textarea') return 'textarea';

    const tagName = await input.evaluate((el: Element) => el.tagName.toLowerCase()).catch(() => '');
    if (tagName === 'select') return 'select';

    return null;
  }

  private async findSubmitSelector(scope: Locator): Promise<string | undefined> {
    // 1) 标准提交按钮
    const typed = scope.locator('button[type="submit"], input[type="submit"]');
    if ((await typed.count()) > 0) return this.getSelector(typed.nth(0));

    // 2) 按文本匹配（兼容 type="button"、文本含空格/大小写，如 "登 录"）
    const byText = scope
      .locator('button, input[type="button"], input[type="submit"]')
      .filter({ hasText: /登\s*录|登录|login|log\s*in|submit|提交/i });
    if ((await byText.count()) > 0) return this.getSelector(byText.nth(0));

    return undefined;
  }

  private async getLabel(input: Locator): Promise<string | undefined> {
    const id = await input.getAttribute('id').catch(() => null);
    if (id) {
      const label = input.page().locator(`label[for="${id}"]`);
      if ((await label.count()) > 0) {
        const text = await label.textContent().catch(() => null);
        if (text) return text;
      }
    }
    const ariaLabel = await input.getAttribute('aria-label').catch(() => null);
    const placeholder = await input.getAttribute('placeholder').catch(() => null);
    return ariaLabel ?? placeholder ?? undefined;
  }

  private async getSelector(locator: Locator): Promise<string> {
    const id = await locator.getAttribute('id').catch(() => null);
    if (id) return `#${id}`;
    const name = await locator.getAttribute('name').catch(() => null);
    if (name) return `[name="${name}"]`;

    const tagName = await locator.evaluate((el: Element) => el.tagName.toLowerCase()).catch(() => '');
    const type = await locator.getAttribute('type').catch(() => null);

    if (tagName === 'button') {
      const text = (await locator.innerText().catch(() => '')).trim();
      if (text) return `button:has-text("${text}")`;
      if (type) return `button[type="${type}"]`;
    }
    if (tagName === 'input' && type) return `input[type="${type}"]`;
    if (tagName && type) return `${tagName}[type="${type}"]`;
    return locator.toString();
  }
}
