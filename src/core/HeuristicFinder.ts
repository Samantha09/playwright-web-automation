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

      const submitSelector = await this.findSubmitSelector(form);
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
    if (type === 'text') return 'text';
    if (type === 'textarea') return 'textarea';

    const tagName = await input.evaluate((el: Element) => el.tagName.toLowerCase()).catch(() => '');
    if (tagName === 'select') return 'select';

    return null;
  }

  private async findSubmitSelector(scope: Locator): Promise<string | undefined> {
    const candidates = scope.locator(
      'button[type="submit"], input[type="submit"], button:has-text("登录"), button:has-text("Login"), button:has-text("提交"), button:has-text("Submit")',
    );
    const count = await candidates.count();
    if (count === 0) return undefined;
    return this.getSelector(candidates.nth(0));
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
    const type = await locator.getAttribute('type').catch(() => null);
    if (type) return `input[type="${type}"]`;
    return locator.toString();
  }
}
