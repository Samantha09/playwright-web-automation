import { Page, Request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { DiscoveredApi } from '../types/discovery';

export class NetworkRecorder {
  private apis: Map<string, DiscoveredApi> = new Map();

  attach(page: Page): void {
    page.on('request', (request: Request) => this.handleRequest(request));
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
    const method = request.method();
    const key = `${method} ${url}`;
    const existing = this.apis.get(key);
    if (existing) {
      existing.seenCount += 1;
      return;
    }

    this.apis.set(key, {
      url,
      method,
      seenCount: 1,
    });
  }
}
