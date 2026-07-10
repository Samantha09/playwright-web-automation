import { Locator } from '@playwright/test';

/**
 * 为元素生成稳定选择器,策略(按优先级):
 *   id → name → button/a 文本 → input[type] → tag[type] → 回退 toString。
 * HeuristicFinder 与 PageAnalyzer 共用,保证选择器风格一致。
 */
export async function buildSelector(locator: Locator): Promise<string> {
  const tagName = await locator
    .evaluate((el: Element) => el.tagName.toLowerCase())
    .catch(() => '');
  // 带标签名限定,避免 wrapper 与控件共用 id/name(Ant Design 等常见)导致的二义
  const id = await locator.getAttribute('id').catch(() => null);
  if (id && tagName) return `${tagName}#${id}`;
  const name = await locator.getAttribute('name').catch(() => null);
  if (name) return tagName ? `${tagName}[name="${name}"]` : `[name="${name}"]`;

  const type = await locator.getAttribute('type').catch(() => null);
  if (tagName === 'button' || tagName === 'a') {
    const text = (await locator.innerText().catch(() => '')).trim();
    if (text && !text.includes('"')) return `${tagName}:has-text("${text}")`;
    if (tagName === 'button' && type) return `button[type="${type}"]`;
  }
  if (tagName === 'input' && type) return `input[type="${type}"]`;
  if (tagName && type) return `${tagName}[type="${type}"]`;
  return locator.toString();
}
