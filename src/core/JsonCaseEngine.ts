import { Page } from '@playwright/test';
import { Case, CaseResult, StepResult } from '../types/case';
import { ActionRegistry, ActionContext } from './ActionRegistry';
import { ProgressTracker } from './ProgressTracker';

export class JsonCaseEngine {
  constructor(
    private registry: ActionRegistry,
    private tracker: ProgressTracker,
  ) {}

  async runCase(page: Page, testCase: Case): Promise<CaseResult> {
    this.tracker.startCase(testCase.id);
    const screenshots: string[] = [];

    const ctx: ActionContext = {
      page,
      log: (msg) => console.log(`[${testCase.id}] ${msg}`),
    };

    if (testCase.target?.entry) {
      await page.goto(testCase.target.entry);
    }

    for (const mock of testCase.mocks || []) {
      await page.route(mock.url, async (route, request) => {
        if (mock.method && request.method() !== mock.method) {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: mock.status || 200,
          headers: mock.headers,
          body: mock.body ? JSON.stringify(mock.body) : undefined,
        });
      });
    }

    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i];
      const stepStarted = Date.now();
      try {
        await this.registry.execute(step.action, ctx, step.params);
        this.tracker.recordStep(testCase.id, {
          index: i,
          action: step.action,
          status: 'passed',
          durationMs: Date.now() - stepStarted,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.tracker.recordStep(testCase.id, {
          index: i,
          action: step.action,
          status: 'failed',
          durationMs: Date.now() - stepStarted,
          error: errorMsg,
        });
        const result: CaseResult = {
          status: 'failed',
          completedAt: new Date().toISOString(),
          steps: this.tracker.getRun().cases[testCase.id].steps,
          error: errorMsg,
          screenshots,
        };
        this.tracker.finishCase(testCase.id, result);
        return result;
      }
    }

    for (const assertion of testCase.assertions || []) {
      try {
        await this.runAssertion(page, assertion);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const result: CaseResult = {
          status: 'failed',
          completedAt: new Date().toISOString(),
          steps: this.tracker.getRun().cases[testCase.id].steps,
          error: `Assertion failed: ${errorMsg}`,
          screenshots,
        };
        this.tracker.finishCase(testCase.id, result);
        return result;
      }
    }

    const result: CaseResult = {
      status: 'passed',
      completedAt: new Date().toISOString(),
      steps: this.tracker.getRun().cases[testCase.id].steps,
      screenshots,
    };
    this.tracker.finishCase(testCase.id, result);
    return result;
  }

  private async runAssertion(
    page: Page,
    assertion: { type: string; selector?: string; expected?: unknown },
  ): Promise<void> {
    switch (assertion.type) {
      case 'visible': {
        if (!assertion.selector) throw new Error('visible assertion requires selector');
        await page.locator(assertion.selector).waitFor({ state: 'visible', timeout: 5000 });
        break;
      }
      case 'notVisible': {
        if (!assertion.selector) throw new Error('notVisible assertion requires selector');
        await page.locator(assertion.selector).waitFor({ state: 'hidden', timeout: 5000 });
        break;
      }
      case 'urlContains': {
        if (!assertion.expected) throw new Error('urlContains assertion requires expected');
        await page.waitForURL(String(assertion.expected), { timeout: 5000 });
        break;
      }
      case 'urlNotContains': {
        if (!assertion.expected) throw new Error('urlNotContains assertion requires expected');
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
        const currentUrl = page.url();
        if (currentUrl.includes(String(assertion.expected))) {
          throw new Error(`URL should not contain "${assertion.expected}", got: ${currentUrl}`);
        }
        break;
      }
      case 'textContains': {
        if (!assertion.selector || !assertion.expected) {
          throw new Error('textContains assertion requires selector and expected');
        }
        await page
          .locator(assertion.selector)
          .filter({ hasText: String(assertion.expected) })
          .waitFor({ timeout: 5000 });
        break;
      }
      default:
        throw new Error(`Unknown assertion type: ${assertion.type}`);
    }
  }
}
