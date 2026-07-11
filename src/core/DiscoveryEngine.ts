import { chromium, Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { HeuristicFinder } from './HeuristicFinder';
import { NetworkRecorder } from './NetworkRecorder';
import { CandidateGenerator } from './CandidateGenerator';
import { PageAnalyzer } from './PageAnalyzer';
import { targetSlug, slugify } from '../utils/slug';
import { DiscoveredPage, DiscoveredForm, DiscoveredApi, CandidateCase } from '../types/discovery';

/** 登录配置:发现到登录表单后用此凭据登录,再爬取认证后内容 */
export interface LoginConfig {
  username: string;
  password: string;
}

export interface DiscoveryOptions {
  url: string;
  depth?: number;
  maxPages?: number;
  outputDir?: string;
  /** target 目录名(--name);不传按主机名派生 */
  name?: string;
  /** 登录凭据;提供则先登录再爬(认证后内容可达) */
  login?: LoginConfig;
  headless?: boolean;
}

export interface DiscoveryResult {
  outputDir: string;
  pages: DiscoveredPage[];
  forms: DiscoveredForm[];
  apis: DiscoveredApi[];
  candidates: CandidateCase[];
}

const MAX_MENU_CLICKS = 15;

export class DiscoveryEngine {
  private finder = new HeuristicFinder();
  private generator = new CandidateGenerator();
  private analyzer = new PageAnalyzer();

  async discover(options: DiscoveryOptions): Promise<DiscoveryResult> {
    const { url, depth = 2, maxPages = 50, outputDir, name, login, headless = true } = options;
    const resolvedOutputDir = outputDir ?? `projects/${targetSlug(url, name)}/discovered`;
    const origin = (() => {
      try {
        return new URL(url).origin;
      } catch {
        return url;
      }
    })();

    const browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    const page = await context.newPage();
    const recorder = new NetworkRecorder();
    recorder.attach(page);

    const visited = new Set<string>();
    const pages: DiscoveredPage[] = [];
    const allForms: DiscoveredForm[] = [];

    try {
      // 认证阶段:先登录(用发现的登录表单选择器 + 凭据),拿到会话后再爬
      if (login) {
        try {
          const loginForm = await this.performLogin(page, url, login);
          if (loginForm) allForms.push(loginForm);
        } catch (error) {
          console.warn(`Login failed: ${error}; continuing unauthenticated.`);
        }
      }
      // 登录后从落地页(已认证,通常 /home 等)开始爬,避免回 entry 重新渲染登录壳
      const startUrl = login && page.url() !== 'about:blank' ? page.url() : url;
      const queue: { url: string; currentDepth: number }[] = [{ url: startUrl, currentDepth: 0 }];

      while (queue.length > 0 && visited.size < maxPages) {
        const { url: currentUrl, currentDepth } = queue.shift()!;
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        try {
          await page.goto(currentUrl, { waitUntil: 'load', timeout: 15000 });
          await page.waitForTimeout(1200); // 让 SPA 渲染(不用 networkidle:WS/长连接应用永不 idle)
          const title = await page.title().catch(() => undefined);
          const links = await this.extractLinks(page, origin);
          const structure = await this.analyzer.analyze(page);
          const screenshot = await this.captureScreenshot(page, currentUrl, resolvedOutputDir);
          pages.push({ url: currentUrl, title, links, structure, screenshot });

          const forms = await this.finder.findForms(page, currentUrl);
          allForms.push(...forms);

          if (currentDepth < depth) {
            for (const link of links) {
              if (!visited.has(link)) queue.push({ url: link, currentDepth: currentDepth + 1 });
            }
          }
          // SPA 菜单爬取只在首层做一次(菜单通常全局一致),点击菜单项记录跳转 URL
          if (currentDepth === 0) {
            const menuUrls = await this.discoverMenuUrls(page, currentUrl, origin, visited);
            for (const menuUrl of menuUrls) {
              if (!visited.has(menuUrl)) queue.push({ url: menuUrl, currentDepth: 1 });
            }
          }
        } catch (error) {
          console.warn(`Failed to process ${currentUrl}: ${error}`);
        }
      }
    } finally {
      await browser.close();
    }

    const apis = recorder.getApis();
    // 导航候选只从首个含菜单的页面生成一次(侧边栏菜单通常全局一致,避免每页重复)
    const navSource = pages.find((p) => p.structure && p.structure.nav.length > 0);
    const candidates: CandidateCase[] = [
      ...allForms.flatMap((form) => this.generator.generateFromForm(form, origin)),
      ...(navSource && navSource.structure
        ? this.generator.generateFromStructure(navSource.structure, navSource.url, origin)
        : []),
    ];

    this.saveResults(resolvedOutputDir, { pages, forms: allForms, apis, candidates });

    return { outputDir: resolvedOutputDir, pages, forms: allForms, apis, candidates };
  }

  /** 用发现的登录表单选择器 + 凭据登录,并 dismiss 登录后可能出现的弹窗。返回用到的登录表单 */
  private async performLogin(
    page: Page,
    entryUrl: string,
    login: LoginConfig,
  ): Promise<DiscoveredForm | undefined> {
    await page.goto(entryUrl, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(1000);
    const forms = await this.finder.findForms(page, entryUrl);
    const loginForm = forms.find((f) => f.fields.some((x) => x.role === 'password'));
    if (!loginForm) {
      console.warn(`Login requested but no login form found at ${entryUrl}; continuing unauthenticated.`);
      return undefined;
    }
    const usernameField = loginForm.fields.find((f) => f.role === 'username') || loginForm.fields[0];
    const passwordField = loginForm.fields.find((f) => f.role === 'password');
    if (usernameField) await page.locator(usernameField.selector).fill(login.username);
    if (passwordField) await page.locator(passwordField.selector).fill(login.password);
    if (loginForm.submitSelector) await page.locator(loginForm.submitSelector).click();
    await page.waitForTimeout(1500); // 等登录后弹窗出现
    await this.dismissOverlays(page);
    await page.waitForTimeout(1500); // 等应用渲染
    return loginForm;
  }

  /** 通用:关闭登录/安全提示类弹窗(按常见按钮文本,仅限 modal/dialog 内) */
  private async dismissOverlays(page: Page): Promise<void> {
    const texts = ['知道了', '确定', '确认', 'OK', '关闭', 'Close', 'Got it', 'I understand', 'Dismiss', 'Continue'];
    for (const t of texts) {
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

  /** SPA 菜单爬取:展开子菜单,逐个点击菜单项,记录跳转后的同源 URL */
  private async discoverMenuUrls(
    page: Page,
    currentUrl: string,
    origin: string,
    visited: Set<string>,
  ): Promise<string[]> {
    const found: string[] = [];
    const seen = new Set<string>();

    const collectTexts = async (): Promise<string[]> => {
      await this.expandSubmenus(page);
      return page
        .locator('.ant-menu-item, [role="menuitem"]')
        .evaluateAll((els: HTMLElement[]) =>
          els.map((e) => (e.innerText || '').trim()).filter((t) => t && !t.includes('"')),
        );
    };

    let texts = await collectTexts();
    const cap = Math.min(texts.length, MAX_MENU_CLICKS);
    for (let i = 0; i < cap; i++) {
      const text = texts[i];
      // 每次重置回当前页再点击,保证菜单状态稳定
      await page.goto(currentUrl, { waitUntil: 'load', timeout: 12000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      await this.expandSubmenus(page);
      const item = page
        .locator(`.ant-menu-item:has-text("${text}"), [role="menuitem"]:has-text("${text}")`)
        .first();
      if ((await item.count().catch(() => 0)) === 0) continue;
      const before = page.url();
      await item.click().catch(() => undefined);
      await page.waitForTimeout(600);
      const after = page.url();
      if (after !== before && after.startsWith(origin) && !visited.has(after) && !seen.has(after)) {
        seen.add(after);
        found.push(after);
      }
    }
    return found;
  }

  /** 展开折叠的子菜单(点击 submenu 标题) */
  private async expandSubmenus(page: Page): Promise<void> {
    const subs = page.locator('.ant-menu-submenu-title');
    const count = await subs.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      await subs.nth(i).click().catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }

  private async extractLinks(page: Page, origin: string): Promise<string[]> {
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((anchors: HTMLAnchorElement[]) =>
        anchors.map((a) => a.href).filter((href) => href.startsWith('http')),
      );
    return [...new Set(hrefs)].filter((href) => href.startsWith(origin));
  }

  /** 整页截图,存到 discovered/screenshots/<slug>.png,返回相对路径 */
  private async captureScreenshot(
    page: Page,
    url: string,
    outputDir: string,
  ): Promise<string | undefined> {
    try {
      let slug = 'root';
      try {
        slug = slugify(new URL(url).pathname) || 'root';
      } catch {
        /* keep root */
      }
      const dir = path.join(outputDir, 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${slug}.png`);
      await page.screenshot({ path: file, fullPage: true });
      return `screenshots/${slug}.png`;
    } catch (error) {
      console.warn(`Screenshot failed for ${url}: ${error}`);
      return undefined;
    }
  }

  private saveResults(
    outputDir: string,
    data: { pages: DiscoveredPage[]; forms: DiscoveredForm[]; apis: DiscoveredApi[]; candidates: CandidateCase[] },
  ): void {
    fs.mkdirSync(outputDir, { recursive: true });
    const candidatesDir = path.join(outputDir, 'candidates');
    fs.mkdirSync(candidatesDir, { recursive: true });
    // 清理上次运行的候选文件,避免残留导致计数虚高
    for (const old of fs.readdirSync(candidatesDir)) {
      if (old.endsWith('.json')) fs.unlinkSync(path.join(candidatesDir, old));
    }

    fs.writeFileSync(path.join(outputDir, 'pages.json'), JSON.stringify(data.pages, null, 2));
    fs.writeFileSync(path.join(outputDir, 'forms.json'), JSON.stringify(data.forms, null, 2));
    fs.writeFileSync(path.join(outputDir, 'apis.json'), JSON.stringify(data.apis, null, 2));

    const used = new Set<string>();
    for (const candidate of data.candidates) {
      let file = this.safeFileName(candidate.id);
      let suffix = 2;
      while (used.has(file)) {
        file = `${this.safeFileName(candidate.id)}-${suffix++}`;
      }
      used.add(file);
      fs.writeFileSync(
        path.join(outputDir, 'candidates', `${file}.json`),
        JSON.stringify(candidate, null, 2),
      );
    }
  }

  private safeFileName(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'candidate';
  }
}
