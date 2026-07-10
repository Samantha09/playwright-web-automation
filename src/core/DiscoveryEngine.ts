import { chromium, Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { HeuristicFinder } from './HeuristicFinder';
import { NetworkRecorder } from './NetworkRecorder';
import { CandidateGenerator } from './CandidateGenerator';
import { PageAnalyzer } from './PageAnalyzer';
import { targetSlug } from '../utils/slug';
import { DiscoveredPage, DiscoveredForm, DiscoveredApi, CandidateCase } from '../types/discovery';

export interface DiscoveryOptions {
  url: string;
  depth?: number;
  maxPages?: number;
  outputDir?: string;
  /** target 目录名(--name);不传按主机名派生 */
  name?: string;
  headless?: boolean;
}

export interface DiscoveryResult {
  outputDir: string;
  pages: DiscoveredPage[];
  forms: DiscoveredForm[];
  apis: DiscoveredApi[];
  candidates: CandidateCase[];
}

export class DiscoveryEngine {
  private finder = new HeuristicFinder();
  private generator = new CandidateGenerator();
  private analyzer = new PageAnalyzer();

  async discover(options: DiscoveryOptions): Promise<DiscoveryResult> {
    const { url, depth = 2, maxPages = 50, outputDir, name, headless = true } = options;
    const resolvedOutputDir = outputDir ?? `projects/${targetSlug(url, name)}/discovered`;

    const browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    const page = await context.newPage();
    const recorder = new NetworkRecorder();
    recorder.attach(page);

    const visited = new Set<string>();
    const queue: { url: string; currentDepth: number }[] = [{ url, currentDepth: 0 }];
    const pages: DiscoveredPage[] = [];
    const allForms: DiscoveredForm[] = [];

    try {
      while (queue.length > 0 && visited.size < maxPages) {
        const { url: currentUrl, currentDepth } = queue.shift()!;
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        try {
          await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: 15000 });
          const title = await page.title().catch(() => undefined);
          const links = await this.extractLinks(page, new URL(url).origin);
          const structure = await this.analyzer.analyze(page);
          pages.push({ url: currentUrl, title, links, structure });

          const forms = await this.finder.findForms(page, currentUrl);
          allForms.push(...forms);

          if (currentDepth < depth) {
            for (const link of links) {
              if (!visited.has(link)) {
                queue.push({ url: link, currentDepth: currentDepth + 1 });
              }
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
    const origin = new URL(url).origin;
    const candidates: CandidateCase[] = [
      ...allForms.flatMap((form) => this.generator.generateFromForm(form, origin)),
      ...pages.flatMap((p) =>
        p.structure ? this.generator.generateFromStructure(p.structure, p.url, origin) : [],
      ),
    ];

    this.saveResults(resolvedOutputDir, { pages, forms: allForms, apis, candidates });

    return { outputDir: resolvedOutputDir, pages, forms: allForms, apis, candidates };
  }

  private async extractLinks(page: Page, origin: string): Promise<string[]> {
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((anchors: HTMLAnchorElement[]) =>
        anchors.map((a) => a.href).filter((href) => href.startsWith('http')),
      );
    return [...new Set(hrefs)].filter((href) => href.startsWith(origin));
  }

  private saveResults(
    outputDir: string,
    data: { pages: DiscoveredPage[]; forms: DiscoveredForm[]; apis: DiscoveredApi[]; candidates: CandidateCase[] },
  ): void {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(path.join(outputDir, 'candidates'), { recursive: true });

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
