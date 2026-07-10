import { Page, Request, Response } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { DiscoveredApi } from '../types/discovery';

const MAX_BODY = 16 * 1024;
const STATIC_RE = /\.(js|css|png|jpe?g|svg|gif|woff2?|ttf|ico|map)(\?|#|$)/i;
const API_CT_RE = /json|text|xml/i;

/**
 * 网络录制器:记录 API 类请求的 URL/method/计数,并抓取 request/response 载荷样本。
 * 静态资源(按扩展名)与非 API 响应(按 content-type)被过滤,避免膨胀。
 */
export class NetworkRecorder {
  private apis = new Map<string, DiscoveredApi>();

  attach(page: Page): void {
    page.on('request', (request: Request) => this.handleRequest(request));
    page.on('response', (response: Response) => {
      // 异步抓 body,不阻塞页面
      this.handleResponse(response).catch(() => undefined);
    });
  }

  getApis(): DiscoveredApi[] {
    return Array.from(this.apis.values()).sort((a, b) => b.seenCount - a.seenCount);
  }

  save(dir: string): string {
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'apis.json');
    fs.writeFileSync(filePath, JSON.stringify(this.getApis(), null, 2), 'utf-8');
    return filePath;
  }

  private handleRequest(request: Request): void {
    const url = request.url();
    if (STATIC_RE.test(url)) return;
    const method = request.method();
    const key = `${method} ${url}`;
    const existing = this.apis.get(key);
    if (existing) {
      existing.seenCount += 1;
      return;
    }
    const entry: DiscoveredApi = { url, method, seenCount: 1 };
    const body = request.postData();
    if (body) entry.sampleRequest = { body };
    this.apis.set(key, entry);
  }

  private async handleResponse(response: Response): Promise<void> {
    const request = response.request();
    const url = request.url();
    if (STATIC_RE.test(url)) return;
    const ct = response.headers()['content-type'] || '';
    if (!API_CT_RE.test(ct)) return;

    const method = request.method();
    const key = `${method} ${url}`;
    const entry = this.apis.get(key);
    if (!entry || entry.sampleResponse) return;

    const status = response.status();
    let body: unknown;
    try {
      const raw = await response.text();
      body = raw.length > MAX_BODY ? raw.slice(0, MAX_BODY) + '\n(truncated)' : raw;
    } catch {
      body = undefined;
    }
    entry.sampleResponse = { status, body };
  }
}
