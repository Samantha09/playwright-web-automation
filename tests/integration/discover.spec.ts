import { test, expect } from '@playwright/test';
import { DiscoveryEngine } from '../../src/core/DiscoveryEngine';
import * as fs from 'fs';
import * as path from 'path';

test('DiscoveryEngine discovers forms on local static page', async () => {
  const outputDir = 'test-results/integration-discover';
  const htmlPath = path.resolve('test-results/test-login.html');
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(
    htmlPath,
    `<html><body>
      <form>
        <input type="email" name="email" />
        <input type="password" name="password" />
        <button type="submit">Login</button>
      </form>
    </body></html>`,
  );

  const engine = new DiscoveryEngine();
  const result = await engine.discover({
    url: `file://${htmlPath}`,
    depth: 0,
    maxPages: 1,
    outputDir,
  });

  expect(result.forms.length).toBeGreaterThan(0);
  expect(fs.existsSync(path.join(outputDir, 'forms.json'))).toBe(true);
  expect(fs.existsSync(path.join(outputDir, 'candidates'))).toBe(true);
});
