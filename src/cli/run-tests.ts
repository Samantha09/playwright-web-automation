import { TestRunner } from '../core/TestRunner';
import { loadCases } from '../utils/caseLoader';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 对一个 target 执行候选用例测试。
 * 用法:npm run test:run -- --target=spug [--login-user=... --login-pass=...]
 * 登录凭据:CLI 参数优先,否则读 projects/<target>/config.json。
 */
async function main() {
  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith('--target='));
  const userArg = args.find((a) => a.startsWith('--login-user='));
  const passArg = args.find((a) => a.startsWith('--login-pass='));

  if (!targetArg) {
    console.error('Usage: npm run test:run -- --target=spug [--login-user=USER --login-pass=PASS]');
    process.exit(1);
  }

  const target = targetArg.split('=')[1];
  const cfgPath = path.join('projects', target, 'config.json');
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) : {};
  const url: string = cfg.url;
  if (!url) {
    console.error(`No url found in ${cfgPath}. 先对该 target 跑一次 discovery。`);
    process.exit(1);
  }

  const username = (userArg ? userArg.split('=')[1] : cfg.loginUser) || '';
  const password = (passArg ? passArg.split('=')[1] : cfg.loginPass) || '';
  const login = username || password ? { username, password } : undefined;

  const candidatesDir = path.join('projects', target, 'discovered', 'candidates');
  const cases = loadCases(candidatesDir);
  console.log(`Loaded ${cases.length} candidates from ${candidatesDir}`);

  const runner = new TestRunner();
  const summary = await runner.run({ target, entryUrl: url, cases, login });

  const { passed, failed, total, skipped } = summary.summary;
  console.log(`\nRun ${summary.runId}: ${passed} passed / ${failed} failed / ${skipped} skipped (of ${total})`);
  for (const r of summary.results) {
    console.log(`  [${r.status.toUpperCase()}] ${r.id}${r.error ? ' — ' + r.error : ''}`);
  }
  console.log(`Result: ${summary.file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
