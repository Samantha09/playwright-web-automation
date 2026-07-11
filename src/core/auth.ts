import { Page } from '@playwright/test';
import { HeuristicFinder } from './HeuristicFinder';
import { DiscoveredForm } from '../types/discovery';

/** 登录凭据 */
export interface LoginConfig {
  username: string;
  password: string;
}

const DISMISS_TEXTS = ['知道了', '确定', '确认', 'OK', '关闭', 'Close', 'Got it', 'I understand', 'Dismiss', 'Continue'];

/** 通用:关闭登录/安全提示类弹窗(仅限 modal/dialog 内,按常见按钮文本) */
export async function dismissOverlays(page: Page): Promise<void> {
  for (const t of DISMISS_TEXTS) {
    if (t.includes('"')) continue;
    const btn = page
      .locator(`.ant-modal-content button:has-text("${t}"), [role="dialog"] button:has-text("${t}")`)
      .first();
    if ((await btn.count().catch(() => 0)) > 0 && (await btn.isVisible().catch(() => false))) {
      await btn.click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
  }
}

/**
 * 用发现的登录表单选择器 + 凭据登录,dismiss 登录后弹窗。
 * 返回用到的登录表单(便于记录)。
 */
export async function performLogin(
  page: Page,
  entryUrl: string,
  login: LoginConfig,
): Promise<DiscoveredForm | undefined> {
  const finder = new HeuristicFinder();
  await page.goto(entryUrl, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(1000);
  const forms = await finder.findForms(page, entryUrl);
  const loginForm = forms.find((f) => f.fields.some((x) => x.role === 'password'));
  if (!loginForm) {
    console.warn(`Login requested but no login form found at ${entryUrl}`);
    return undefined;
  }
  const usernameField = loginForm.fields.find((f) => f.role === 'username') || loginForm.fields[0];
  const passwordField = loginForm.fields.find((f) => f.role === 'password');
  if (usernameField) await page.locator(usernameField.selector).first().fill(login.username);
  if (passwordField) await page.locator(passwordField.selector).first().fill(login.password);
  if (loginForm.submitSelector) await page.locator(loginForm.submitSelector).first().click();
  await page.waitForTimeout(1500); // 等登录后弹窗出现
  await dismissOverlays(page);
  await page.waitForTimeout(1500); // 等应用渲染
  return loginForm;
}
