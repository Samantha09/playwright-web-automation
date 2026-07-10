import { Page } from '@playwright/test';
import { PageStructure, DiscoveredNavItem, DiscoveredHeading, DiscoveredAction } from '../types/discovery';
import { buildSelector } from './selector';

const MAX_NAV = 20;
const MAX_HEADINGS = 50;
const MAX_ACTIONS = 20;

/**
 * 页面结构解析器:捕获导航、标题大纲、可交互动作。
 * 表单由 HeuristicFinder 单独负责,此处不重复抓取。
 */
export class PageAnalyzer {
  async analyze(page: Page): Promise<PageStructure> {
    const title = await page.title().catch(() => undefined);
    const [nav, headings, actions] = await Promise.all([
      this.extractNav(page),
      this.extractHeadings(page),
      this.extractActions(page),
    ]);
    return { title, nav, headings, actions };
  }

  /** 导航链接(nav / [role=navigation] 内的 a[href]),按 text+href 去重 */
  private async extractNav(page: Page): Promise<DiscoveredNavItem[]> {
    const items = await page
      .locator('nav a[href], [role="navigation"] a[href]')
      .evaluateAll((anchors: HTMLAnchorElement[]) =>
        anchors
          .map((a) => ({ text: (a.innerText || a.textContent || '').trim(), href: a.href }))
          .filter((x) => x.text && x.href),
      );
    const seen = new Set<string>();
    const out: DiscoveredNavItem[] = [];
    for (const it of items) {
      const key = `${it.text}|${it.href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
      if (out.length >= MAX_NAV) break;
    }
    return out;
  }

  /** 标题大纲 h1-h6(文档序),文本非空 */
  private async extractHeadings(page: Page): Promise<DiscoveredHeading[]> {
    const raw = await page
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((hs: HTMLHeadingElement[]) =>
        hs
          .map((h) => ({ level: Number(h.tagName.substring(1)), text: (h.textContent || '').trim() }))
          .filter((h) => h.text),
      );
    return raw.slice(0, MAX_HEADINGS);
  }

  /** 可交互动作:nav 之外的可见 button / a[href],有文本 */
  private async extractActions(page: Page): Promise<DiscoveredAction[]> {
    const loc = page.locator('button, a[href]');
    const count = await loc.count();
    const out: DiscoveredAction[] = [];
    for (let i = 0; i < count && out.length < MAX_ACTIONS; i++) {
      const el = loc.nth(i);
      const inNav = await el
        .evaluate((node) => !!node.closest('nav, [role="navigation"]'))
        .catch(() => false);
      if (inNav) continue;
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;

      let text = (await el.innerText().catch(() => '')).trim();
      if (!text) text = ((await el.textContent().catch(() => '')) ?? '').trim();
      if (!text) continue;

      const tagName = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => '');
      const selector = await buildSelector(el);
      const action: DiscoveredAction = {
        kind: tagName === 'a' ? 'link' : 'button',
        text,
        selector,
      };
      if (tagName === 'a') {
        const href = await el.getAttribute('href').catch(() => null);
        if (href) action.href = href;
      }
      out.push(action);
    }
    return out;
  }
}
