import { chromium } from '@playwright/test';
import { ActionRegistry } from './ActionRegistry';
import { JsonCaseEngine } from './JsonCaseEngine';
import { ProgressTracker } from './ProgressTracker';
import { performLogin, type LoginConfig } from './auth';
import { substituteEnvVars } from '../utils/caseLoader';
import { Case } from '../types/case';

export interface RunOptions {
  /** target 名(决定输出目录 projects/<target>/runs) */
  target: string;
  /** 入口 URL(用于登录 + 解析 origin 作 baseURL) */
  entryUrl: string;
  cases: Case[];
  login?: LoginConfig;
  headless?: boolean;
  outputDir?: string;
}

export interface RunCaseResult {
  id: string;
  name?: string;
  source?: string;
  status: 'passed' | 'failed';
  error?: string;
  steps: { index: number; action: string; status: string; durationMs?: number; error?: string }[];
}

export interface RunSummary {
  runId: string;
  status: 'completed' | 'failed';
  summary: { total: number; passed: number; failed: number; skipped: number };
  results: RunCaseResult[];
  file?: string;
}

/**
 * 测试执行器:可选登录前置 → 逐个跑候选用例 → 汇总 pass/fail + 每步状态。
 * 结果由 ProgressTracker 写到 projects/<target>/runs/<runId>.json。
 */
export class TestRunner {
  async run(options: RunOptions): Promise<RunSummary> {
    const { target, entryUrl, cases, login, headless = true, outputDir } = options;
    const resolvedOutputDir = outputDir ?? `projects/${target}/runs`;

    let origin: string;
    try {
      origin = new URL(entryUrl).origin;
    } catch {
      origin = entryUrl;
    }

    // 登录凭据写入环境变量,供 ${USERNAME}/${PASSWORD} 占位替换
    if (login) {
      process.env.USERNAME = login.username;
      process.env.PASSWORD = login.password;
      process.env.CAPTCHA = '';
    }

    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({ baseURL: origin });
    const page = await context.newPage();

    const tracker = new ProgressTracker(resolvedOutputDir);
    const registry = new ActionRegistry();
    const engine = new JsonCaseEngine(registry, tracker);

    const results: RunCaseResult[] = [];
    let loginOk = true;
    try {
      if (login) {
        try {
          const form = await performLogin(page, entryUrl, login);
          loginOk = !!form;
        } catch (error) {
          loginOk = false;
          console.warn(`Login failed: ${error}`);
        }
      }

      // 登录态下跳过 heuristic-login 候选(认证前置已覆盖登录)
      const toRun = cases.filter((c) => !(login && (c as { source?: string }).source === 'heuristic-login'));

      for (const c of toRun) {
        const substituted = substituteEnvVars(c) as Case;
        const result = await engine.runCase(page, substituted);
        results.push({
          id: c.id,
          name: c.name,
          source: (c as { source?: string }).source,
          status: result.status === 'passed' ? 'passed' : 'failed',
          error: result.error,
          steps: result.steps.map((s) => ({
            index: s.index,
            action: s.action,
            status: s.status,
            durationMs: s.durationMs,
            error: s.error,
          })),
        });
      }
    } finally {
      await browser.close();
    }

    const file = tracker.finishRun('completed');
    const run = tracker.getRun();
    return {
      runId: run.runId,
      status: loginOk ? 'completed' : 'failed',
      summary: { ...run.summary, skipped: cases.length - results.length },
      results,
      file,
    };
  }
}
